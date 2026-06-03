# HSR 워프 트래커 단일 실행파일화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PowerShell 수집기·수동 HTML 열기 흐름을, 게임 캐시에서 authkey를 추출해 `getGachaLog`를 증분 조회하고 로컬 웹 UI에 실시간 표시하는 단일 Go 실행파일로 대체한다.

**Architecture:** Go 정적 바이너리가 (1) 게임 캐시에서 authkey URL 추출, (2) 배너별 증분 페이지네이션, (3) 영향받은 월 파일만 비파괴 병합·재작성, (4) `go:embed`로 내장한 대시보드/`analyze.js`를 로컬 HTTP로 서빙하고 SSE로 진행을 스트리밍한다. 분석 로직(`analyze.js`)은 포팅 없이 브라우저에서 그대로 실행된다.

**Tech Stack:** Go(표준 라이브러리 `net/http`, `embed`, `math/big`, `regexp`만 사용 — 외부 의존 없음), 기존 `analyze.js`(브라우저), Chart.js(CDN, 기존 유지).

**Spec:** `docs/superpowers/specs/2026-06-03-hsr-warp-single-exe-design.md`

---

## File Structure

새 Go 모듈을 기존 `outputs/` 루트에 만든다. 기존 `analyze.js`/`analyze.test.js`는 유지하고 대시보드 자산은 `web/`로 옮긴다.

```
go.mod                       모듈 정의 (go mod init 으로 생성)
main.go                      진입점: baseDir 결정, 빈 포트 선택, 서버 기동, 브라우저 오픈
internal/store/srgf.go       SRGF 타입(Info/Record/SRGF), 큰 ID 비교(math/big)
internal/store/store.go      월별 로드·병합·중복제거·영향월 원자적 재작성·합본 구성
internal/store/store_test.go store 단위 테스트
internal/collector/cache.go  캐시 data_2 탐색 → authkey URL 추출 → API 베이스/쿼리 파싱
internal/collector/cache_test.go
internal/collector/fetch.go  배너별 증분 페이지네이션(getGachaLog)
internal/collector/fetch_test.go  mock HTTP 서버 기반 테스트
internal/server/config.go    config.json(마지막 게임 경로) 읽기/쓰기, 경로 자동탐지
internal/server/config_test.go
internal/server/server.go    라우팅, /api/*, SSE, go:embed 자산 서빙
web/dashboard.html           기존 template을 서버용으로 수정(경로 입력·조회·SSE·요약)
web/analyze.js               기존 analyze.js 복사본(서버가 /analyze.js 로 서빙)
```

**유지:** `analyze.js`(루트, `analyze.test.js`가 require), `analyze.test.js`, `README.md`, `gen_sample.js`, `warp_data.sample.json`.
**폐기(Task 10에서 삭제):** `Get-HSRWarp.ps1`, `Update-HSRDashboard.ps1`, `Register-Schedule.ps1`, `sim_incremental.js`, `dashboard.template.html`.

> **불변 규칙:** `internal/store` 는 `internal/collector` 를 import 하지 않는다(역방향만 허용). 모든 ID 비교는 `math/big.Int` 또는 문자열 기반이며 `int`/`float` 변환 금지(정밀도 손실).

---

## Task 0: Go 설치 · 모듈 스캐폴딩 · 자산 이동

**Files:**
- Create: `go.mod` (명령으로 생성)
- Create: `web/analyze.js` (복사), `web/dashboard.html` (복사)

- [ ] **Step 1: Go 설치 여부 확인**

Run (PowerShell):
```powershell
go version
```
Expected: `go version goX.Y.Z windows/amd64` 출력. `'go' ... not recognized` 가 나오면 Step 2 진행, 정상 출력되면 Step 2 건너뜀.

- [ ] **Step 2: Go 설치 (미설치 시)**

Run (PowerShell, winget 사용):
```powershell
winget install --id GoLang.Go -e --accept-source-agreements --accept-package-agreements
```
설치 후 **새 PowerShell 창**에서 `go version` 으로 확인(PATH 갱신 위해 셸 재시작 필요). winget이 없으면 https://go.dev/dl/ 의 Windows MSI(amd64)를 받아 설치.
Expected: 재확인 시 `go version goX.Y.Z windows/amd64`.

- [ ] **Step 3: 모듈 초기화**

Run (작업 디렉터리 = `outputs/`):
```powershell
go mod init hsr-warp
```
Expected: `go: creating new go.mod: module hsr-warp` 출력, `go.mod` 생성(go 라인은 설치된 버전으로 자동 기입).

- [ ] **Step 4: 대시보드 자산을 web/ 로 복사**

Run (PowerShell):
```powershell
New-Item -ItemType Directory -Force -Path web | Out-Null
Copy-Item analyze.js web\analyze.js -Force
Copy-Item dashboard.template.html web\dashboard.html -Force
```
Expected: `web\analyze.js`, `web\dashboard.html` 생성. (이후 Task 9에서 `web\dashboard.html` 수정. 루트 `analyze.js`는 `analyze.test.js`용으로 그대로 둔다.)

- [ ] **Step 5: Commit**

```powershell
git init 2>$null; git add go.mod web/analyze.js web/dashboard.html; git commit -m "chore: scaffold go module and copy dashboard assets to web/"
```

---

## Task 1: SRGF 타입과 큰 ID 비교 (store/srgf.go)

**Files:**
- Create: `internal/store/srgf.go`
- Test: `internal/store/store_test.go`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `internal/store/store_test.go`:
```go
package store

import "testing"

func TestIDLess_BigIntPrecision(t *testing.T) {
	// 16자리 이상 — float64로는 구분 불가한 인접 값
	a := "1700000000000000001"
	b := "1700000000000000002"
	if !idLess(a, b) {
		t.Fatalf("expected %s < %s", a, b)
	}
	if idLess(b, a) {
		t.Fatalf("expected NOT %s < %s", b, a)
	}
	if idLess(a, a) {
		t.Fatalf("equal must not be less")
	}
}
```

- [ ] **Step 2: 테스트 실패 확인**

Run:
```powershell
go test ./internal/store/ -run TestIDLess_BigIntPrecision -v
```
Expected: FAIL — `undefined: idLess`.

- [ ] **Step 3: 최소 구현 작성**

Create `internal/store/srgf.go`:
```go
// Package store 는 SRGF v1.0 워프 기록의 로드·병합·월별 저장을 담당한다.
package store

import "math/big"

// Info 는 SRGF 메타데이터다.
type Info struct {
	UID              string `json:"uid"`
	Lang             string `json:"lang"`
	Region           string `json:"region"`
	RegionTimeZone   int    `json:"region_time_zone"`
	ExportTimestamp  int64  `json:"export_timestamp"`
	ExportApp        string `json:"export_app"`
	ExportAppVersion string `json:"export_app_version"`
	SRGFVersion      string `json:"srgf_version"`
}

// Record 는 단일 워프 기록이다. 모든 필드는 SRGF 규약상 문자열이다.
type Record struct {
	GachaID   string `json:"gacha_id"`
	GachaType string `json:"gacha_type"`
	ItemID    string `json:"item_id"`
	Count     string `json:"count"`
	Time      string `json:"time"`
	Name      string `json:"name"`
	ItemType  string `json:"item_type"`
	RankType  string `json:"rank_type"`
	ID        string `json:"id"`
}

// SRGF 는 파일 한 개의 루트 구조다.
type SRGF struct {
	Info Info     `json:"info"`
	List []Record `json:"list"`
}

// idLess 는 a < b 를 큰 정수 정밀도로 비교한다. 파싱 실패 시 문자열 비교로 폴백한다.
func idLess(a, b string) bool {
	ai, okA := new(big.Int).SetString(a, 10)
	bi, okB := new(big.Int).SetString(b, 10)
	if !okA || !okB {
		return a < b
	}
	return ai.Cmp(bi) < 0
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run:
```powershell
go test ./internal/store/ -run TestIDLess_BigIntPrecision -v
```
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add internal/store/srgf.go internal/store/store_test.go; git commit -m "feat(store): SRGF types and big-int id comparison"
```

---

## Task 2: 월별 로드·병합·영향월 재작성 (store/store.go)

**Files:**
- Create: `internal/store/store.go`
- Test: `internal/store/store_test.go` (Task 1 파일에 추가)

- [ ] **Step 1: 실패하는 테스트 작성 (영향월만 갱신·미영향월 보존)**

Append to `internal/store/store_test.go`:
```go
import (
	"os"
	"path/filepath"
)

func rec(id, gt, tm, rank string) Record {
	return Record{ID: id, GachaType: gt, Time: tm, RankType: rank, Name: "X", ItemID: "1001"}
}

func TestWriteAffectedMonths_PreservesUntouchedMonths(t *testing.T) {
	dir := t.TempDir()
	info := Info{UID: "100", SRGFVersion: "v1.0"}

	// 기존 2026-05 파일을 미리 만든다(과거 월).
	may := []Record{rec("10", "11", "2026-05-10 12:00:00", "3")}
	if _, err := WriteAffectedMonths(dir, info, may); err != nil {
		t.Fatal(err)
	}
	mayPath := filepath.Join(dir, "warp_202605.json")
	mayBefore, _ := os.ReadFile(mayPath)

	// 2026-06 신규만 들어온다 → 05 파일은 절대 건드리면 안 된다.
	jun := []Record{rec("20", "11", "2026-06-01 09:00:00", "5")}
	updated, err := WriteAffectedMonths(dir, info, jun)
	if err != nil {
		t.Fatal(err)
	}
	if len(updated) != 1 || updated[0] != "202606" {
		t.Fatalf("expected only 202606 updated, got %v", updated)
	}
	mayAfter, _ := os.ReadFile(mayPath)
	if string(mayBefore) != string(mayAfter) {
		t.Fatalf("untouched month 202605 was modified")
	}
	if _, err := os.Stat(filepath.Join(dir, "warp_202606.json")); err != nil {
		t.Fatalf("202606 not written: %v", err)
	}
}

func TestWriteAffectedMonths_MergesAndDedupsWithinMonth(t *testing.T) {
	dir := t.TempDir()
	info := Info{UID: "100"}
	first := []Record{rec("10", "11", "2026-06-01 09:00:00", "3")}
	if _, err := WriteAffectedMonths(dir, info, first); err != nil {
		t.Fatal(err)
	}
	// 같은 월에 신규 1건 + 중복 1건(id 10) → 결과는 2건, id 오름차순.
	more := []Record{rec("10", "11", "2026-06-01 09:00:00", "3"), rec("11", "11", "2026-06-02 09:00:00", "5")}
	if _, err := WriteAffectedMonths(dir, info, more); err != nil {
		t.Fatal(err)
	}
	all, _, err := LoadAll(dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(all) != 2 {
		t.Fatalf("expected 2 deduped records, got %d", len(all))
	}
	if all[0].ID != "10" || all[1].ID != "11" {
		t.Fatalf("expected id-sorted [10,11], got [%s,%s]", all[0].ID, all[1].ID)
	}
}

func TestMaxIDByBanner(t *testing.T) {
	recs := []Record{rec("5", "11", "t", "3"), rec("9", "11", "t", "3"), rec("3", "12", "t", "3")}
	m := MaxIDByBanner(recs)
	if m["11"] != "9" {
		t.Fatalf("expected max 9 for banner 11, got %s", m["11"])
	}
	if m["12"] != "3" {
		t.Fatalf("expected max 3 for banner 12, got %s", m["12"])
	}
	if m["1"] != "0" {
		t.Fatalf("expected baseline 0 for banner 1, got %s", m["1"])
	}
}
```

- [ ] **Step 2: 테스트 실패 확인**

Run:
```powershell
go test ./internal/store/ -v
```
Expected: FAIL — `undefined: WriteAffectedMonths`, `undefined: LoadAll`, `undefined: MaxIDByBanner`.

- [ ] **Step 3: 최소 구현 작성**

Create `internal/store/store.go`:
```go
package store

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// monthOf 는 "2026-06-03 12:00:00" → "202606" 으로 변환한다. 형식 불일치 시 "".
func monthOf(t string) string {
	if len(t) < 7 {
		return ""
	}
	ym := t[:7] // "2026-06"
	if ym[4] != '-' {
		return ""
	}
	return ym[:4] + ym[5:7]
}

func sortByID(recs []Record) {
	sort.SliceStable(recs, func(i, j int) bool { return idLess(recs[i].ID, recs[j].ID) })
}

// dedupByID 는 id 기준 중복을 제거하고 id 오름차순으로 정렬한 새 슬라이스를 반환한다.
func dedupByID(recs []Record) []Record {
	seen := make(map[string]bool, len(recs))
	out := make([]Record, 0, len(recs))
	for _, r := range recs {
		if !seen[r.ID] {
			seen[r.ID] = true
			out = append(out, r)
		}
	}
	sortByID(out)
	return out
}

// readSRGF 는 SRGF 파일을 읽는다. 선행 UTF-8 BOM(구 PowerShell 출력)을 제거한다.
func readSRGF(path string) (SRGF, error) {
	var s SRGF
	b, err := os.ReadFile(path)
	if err != nil {
		return s, err
	}
	b = bytes.TrimPrefix(b, []byte{0xEF, 0xBB, 0xBF})
	if len(bytes.TrimSpace(b)) == 0 {
		return s, nil
	}
	err = json.Unmarshal(b, &s)
	return s, err
}

// writeSRGFAtomic 는 같은 디렉터리 임시 파일에 쓴 뒤 rename 으로 원자적 교체한다.
func writeSRGFAtomic(path string, s SRGF) error {
	b, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return err
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, b, 0644); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

// LoadAll 은 dir 의 모든 warp_*.json 을 읽어 id 중복제거·정렬한 전체 기록과 마지막 Info 를 반환한다.
func LoadAll(dir string) ([]Record, *Info, error) {
	files, err := filepath.Glob(filepath.Join(dir, "warp_*.json"))
	if err != nil {
		return nil, nil, err
	}
	var all []Record
	var info *Info
	for _, f := range files {
		s, err := readSRGF(f)
		if err != nil {
			return nil, nil, err
		}
		all = append(all, s.List...)
		if s.Info.UID != "" {
			cp := s.Info
			info = &cp
		}
	}
	return dedupByID(all), info, nil
}

// MaxIDByBanner 는 배너별('1','2','11','12') 최대 id 를 반환한다(없으면 "0").
func MaxIDByBanner(recs []Record) map[string]string {
	max := map[string]string{"1": "0", "2": "0", "11": "0", "12": "0"}
	for _, r := range recs {
		cur, ok := max[r.GachaType]
		if ok && idLess(cur, r.ID) {
			max[r.GachaType] = r.ID
		}
	}
	return max
}

// WriteAffectedMonths 는 newRecords 를 월별로 그룹핑해, 신규가 생긴 월 파일만
// 기존 내용과 병합(중복제거·정렬)해 재작성한다. 손대지 않은 월 파일은 보존된다.
// 갱신된 월 코드 목록(정렬됨)을 반환한다.
func WriteAffectedMonths(dir string, info Info, newRecords []Record) ([]string, error) {
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, err
	}
	byMonth := map[string][]Record{}
	for _, r := range newRecords {
		m := monthOf(r.Time)
		if m == "" {
			continue
		}
		byMonth[m] = append(byMonth[m], r)
	}
	var updated []string
	for m, recs := range byMonth {
		path := filepath.Join(dir, "warp_"+m+".json")
		existing, err := readSRGF(path) // 없으면 zero 값(빈 List)
		if err != nil && !os.IsNotExist(err) {
			return updated, err
		}
		merged := dedupByID(append(existing.List, recs...))
		if err := writeSRGFAtomic(path, SRGF{Info: info, List: merged}); err != nil {
			return updated, err
		}
		updated = append(updated, m)
	}
	sort.Strings(updated)
	return updated, nil
}

// TZForRegion 은 region 문자열로 SRGF region_time_zone 을 정한다(기존 PS 로직 동일).
func TZForRegion(region string) int {
	r := strings.ToLower(region)
	switch {
	case strings.Contains(r, "asia"):
		return 8
	case strings.Contains(r, "usa"):
		return -5
	case strings.Contains(r, "euro"):
		return 1
	case strings.Contains(r, "cht"):
		return 8
	default:
		return 8
	}
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run:
```powershell
go test ./internal/store/ -v
```
Expected: PASS (4개 테스트 모두).

- [ ] **Step 5: Commit**

```powershell
git add internal/store/store.go internal/store/store_test.go; git commit -m "feat(store): non-destructive per-month merge/write, LoadAll, MaxIDByBanner"
```

---

## Task 3: 캐시에서 authkey 추출 (collector/cache.go)

**Files:**
- Create: `internal/collector/cache.go`
- Test: `internal/collector/cache_test.go`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `internal/collector/cache_test.go`:
```go
package collector

import "testing"

func TestParseAuthURL(t *testing.T) {
	// 캐시 바이너리에 섞여 있을 법한 형태: 널바이트로 둘러싸인 URL.
	blob := []byte("\x00\x00garbagehttps://public-operation-hkrpg.hoyoverse.com/common/gacha_record/api/getGachaLog?" +
		"authkey=ABC%2Bdef&lang=ko-kr&region=prod_official_asia&game_biz=hkrpg_global&size=5&gacha_type=11&page=2&end_id=999\x00\x00")
	ac, err := parseAuthURL(blob)
	if err != nil {
		t.Fatal(err)
	}
	if ac.APIBase != "https://public-operation-hkrpg.hoyoverse.com/common/gacha_record/api/getGachaLog" {
		t.Fatalf("bad APIBase: %s", ac.APIBase)
	}
	if ac.Region != "prod_official_asia" || ac.Lang != "ko-kr" {
		t.Fatalf("bad region/lang: %s / %s", ac.Region, ac.Lang)
	}
	// 페이지네이션 파라미터는 제거되어야 한다.
	for _, banned := range []string{"page=", "size=", "gacha_type=", "end_id="} {
		if contains(ac.BaseQuery, banned) {
			t.Fatalf("BaseQuery must not contain %q: %s", banned, ac.BaseQuery)
		}
	}
	// authkey 는 보존(원본 인코딩 유지).
	if !contains(ac.BaseQuery, "authkey=ABC%2Bdef") {
		t.Fatalf("authkey lost or re-encoded: %s", ac.BaseQuery)
	}
}

func TestParseAuthURL_NoURL(t *testing.T) {
	if _, err := parseAuthURL([]byte("no url here")); err == nil {
		t.Fatal("expected error when no authkey url present")
	}
}

func contains(s, sub string) bool {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}
```

- [ ] **Step 2: 테스트 실패 확인**

Run:
```powershell
go test ./internal/collector/ -run TestParseAuthURL -v
```
Expected: FAIL — `undefined: parseAuthURL`.

- [ ] **Step 3: 최소 구현 작성**

Create `internal/collector/cache.go`:
```go
// Package collector 는 게임 캐시에서 authkey 를 추출하고 getGachaLog 를 증분 조회한다.
package collector

import (
	"errors"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
)

// AuthContext 는 getGachaLog 호출에 필요한 베이스 정보다.
type AuthContext struct {
	APIBase   string // https://host/common/gacha_record/api/getGachaLog
	BaseQuery string // 페이지 관련 제외한 쿼리(원본 인코딩 유지), '&' 결합
	Region    string
	Lang      string
}

var authURLRe = regexp.MustCompile(`https://[^\x00-\x1f"\\]+?authkey=[^\x00-\x1f"\\]+`)

// 페이지네이션 시 우리가 직접 지정하므로 베이스 쿼리에서 제거할 키.
var pageKeys = map[string]bool{
	"page": true, "size": true, "gacha_type": true, "end_id": true,
	"begin_id": true, "default_gacha_type": true, "gacha_id": true,
}

// parseAuthURL 은 캐시 바이트에서 최신 authkey URL 을 찾아 AuthContext 로 만든다.
func parseAuthURL(blob []byte) (*AuthContext, error) {
	matches := authURLRe.FindAll(blob, -1)
	var raw string
	for _, m := range matches {
		s := string(m)
		if strings.Contains(s, "hkrpg") {
			raw = s // 가장 최근(마지막) 항목 채택
		}
	}
	if raw == "" {
		return nil, errors.New("캐시에서 authkey URL을 찾지 못했습니다. 게임에서 전언 기록 화면을 한 번 연 뒤 다시 시도하세요")
	}
	u, err := url.Parse(raw)
	if err != nil {
		return nil, err
	}
	// 쿼리 문자열을 원본 인코딩 보존하며 직접 파싱(authkey의 %2B 등 보존).
	var kept []string
	region, lang := "", ""
	for _, pair := range strings.Split(u.RawQuery, "&") {
		if pair == "" {
			continue
		}
		kv := strings.SplitN(pair, "=", 2)
		key := kv[0]
		val := ""
		if len(kv) == 2 {
			val = kv[1]
		}
		switch key {
		case "region":
			region, _ = url.QueryUnescape(val)
		case "lang":
			lang, _ = url.QueryUnescape(val)
		}
		if !pageKeys[key] {
			kept = append(kept, pair)
		}
	}
	return &AuthContext{
		APIBase:   u.Scheme + "://" + u.Host + "/common/gacha_record/api/getGachaLog",
		BaseQuery: strings.Join(kept, "&"),
		Region:    region,
		Lang:      lang,
	}, nil
}

// FindAuthContext 는 gamePath 의 최신 webCaches data_2 를 읽어 AuthContext 를 만든다.
func FindAuthContext(gamePath string) (*AuthContext, error) {
	webCaches := filepath.Join(gamePath, "StarRail_Data", "webCaches")
	entries, err := os.ReadDir(webCaches)
	if err != nil {
		return nil, errors.New("webCaches 폴더를 찾을 수 없습니다: " + webCaches)
	}
	// data_2 를 가진 버전 디렉터리 중 이름 기준 최신 선택.
	var verDirs []string
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		p := filepath.Join(webCaches, e.Name(), "Cache", "Cache_Data", "data_2")
		if _, err := os.Stat(p); err == nil {
			verDirs = append(verDirs, e.Name())
		}
	}
	if len(verDirs) == 0 {
		return nil, errors.New("캐시 데이터(data_2)가 없습니다. 게임에서 전언 기록을 한 번 열었나요?")
	}
	sort.Strings(verDirs)
	dataFile := filepath.Join(webCaches, verDirs[len(verDirs)-1], "Cache", "Cache_Data", "data_2")
	// Go 는 Windows 에서 공유 모드로 파일을 열어 게임 실행 중에도 읽기 가능.
	blob, err := os.ReadFile(dataFile)
	if err != nil {
		return nil, err
	}
	return parseAuthURL(blob)
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run:
```powershell
go test ./internal/collector/ -run TestParseAuthURL -v
```
Expected: PASS (2개).

- [ ] **Step 5: Commit**

```powershell
git add internal/collector/cache.go internal/collector/cache_test.go; git commit -m "feat(collector): authkey URL extraction from game cache"
```

---

## Task 4: 증분 페이지네이션 조회 (collector/fetch.go)

**Files:**
- Create: `internal/collector/fetch.go`
- Test: `internal/collector/fetch_test.go`

- [ ] **Step 1: 실패하는 테스트 작성 (mock 서버, 증분 중단)**

Create `internal/collector/fetch_test.go`:
```go
package collector

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestFetchIncremental_StopsAtStoredID(t *testing.T) {
	// 배너 11 은 id 30,20,10 보유. lastID=20 이면 30만 신규.
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gt := r.URL.Query().Get("gacha_type")
		endID := r.URL.Query().Get("end_id")
		var list []map[string]string
		if gt == "11" && endID == "0" {
			list = []map[string]string{
				{"id": "30", "gacha_type": "11", "rank_type": "5", "time": "2026-06-03 10:00:00", "name": "A", "item_id": "1", "uid": "777"},
				{"id": "20", "gacha_type": "11", "rank_type": "4", "time": "2026-06-02 10:00:00", "name": "B", "item_id": "2", "uid": "777"},
				{"id": "10", "gacha_type": "11", "rank_type": "3", "time": "2026-06-01 10:00:00", "name": "C", "item_id": "3", "uid": "777"},
			}
		}
		resp := map[string]any{"retcode": 0, "message": "ok", "data": map[string]any{"list": list, "region": "asia"}}
		_ = json.NewEncoder(w).Encode(resp)
	}))
	defer srv.Close()

	ac := &AuthContext{APIBase: srv.URL, BaseQuery: "lang=ko-kr", Region: "asia"}
	lastID := map[string]string{"1": "0", "2": "0", "11": "20", "12": "0"}

	recs, uid, err := FetchIncremental(ac, lastID, 0, func(string, int) {})
	if err != nil {
		t.Fatal(err)
	}
	if uid != "777" {
		t.Fatalf("expected uid 777, got %s", uid)
	}
	if len(recs) != 1 || recs[0].ID != "30" {
		t.Fatalf("expected only new record id 30, got %+v", recs)
	}
}

func TestFetchIncremental_AuthkeyExpired(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{"retcode": -101, "message": "authkey timeout"})
	}))
	defer srv.Close()
	ac := &AuthContext{APIBase: srv.URL, BaseQuery: "lang=ko-kr"}
	_, _, err := FetchIncremental(ac, map[string]string{"1": "0", "2": "0", "11": "0", "12": "0"}, 0, func(string, int) {})
	if err == nil || !contains(err.Error(), "authkey") {
		t.Fatalf("expected authkey error, got %v", err)
	}
	_ = time.Second
}
```

- [ ] **Step 2: 테스트 실패 확인**

Run:
```powershell
go test ./internal/collector/ -run TestFetchIncremental -v
```
Expected: FAIL — `undefined: FetchIncremental`.

- [ ] **Step 3: 최소 구현 작성**

Create `internal/collector/fetch.go`:
```go
package collector

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"time"

	"hsr-warp/internal/store"
)

// bannerOrder 는 조회 순서다(기존 PS 동일).
var bannerOrder = []string{"1", "2", "11", "12"}
var bannerName = map[string]string{"1": "일반", "2": "출발", "11": "캐릭터", "12": "광추"}

type apiRecord struct {
	UID       string `json:"uid"`
	GachaID   string `json:"gacha_id"`
	GachaType string `json:"gacha_type"`
	ItemID    string `json:"item_id"`
	Count     string `json:"count"`
	Time      string `json:"time"`
	Name      string `json:"name"`
	ItemType  string `json:"item_type"`
	RankType  string `json:"rank_type"`
	ID        string `json:"id"`
}

type apiResp struct {
	Retcode int    `json:"retcode"`
	Message string `json:"message"`
	Data    struct {
		List []apiRecord `json:"list"`
	} `json:"data"`
}

func idLessEq(a, b string) bool {
	ai, okA := new(big.Int).SetString(a, 10)
	bi, okB := new(big.Int).SetString(b, 10)
	if !okA || !okB {
		return a <= b
	}
	return ai.Cmp(bi) <= 0
}

// FetchIncremental 은 배너별로 lastID 보다 최신인 기록만 수집한다.
// onProgress(배너이름, 누적신규건수) 는 페이지마다 호출된다. uid 도 반환한다.
func FetchIncremental(ac *AuthContext, lastID map[string]string, delay time.Duration, onProgress func(banner string, added int)) ([]store.Record, string, error) {
	client := &http.Client{Timeout: 20 * time.Second}
	var out []store.Record
	uid := ""
	for _, gt := range bannerOrder {
		endID := "0"
		page := 1
		added := 0
		stop := false
		for !stop {
			u := fmt.Sprintf("%s?%s&size=20&gacha_type=%s&page=%d&end_id=%s", ac.APIBase, ac.BaseQuery, gt, page, endID)
			req, _ := http.NewRequest(http.MethodGet, u, nil)
			req.Header.Set("User-Agent", "Mozilla/5.0")
			resp, err := client.Do(req)
			if err != nil {
				return out, uid, fmt.Errorf("API 호출 실패: %w", err)
			}
			body, _ := io.ReadAll(resp.Body)
			resp.Body.Close()
			var ar apiResp
			if err := json.Unmarshal(body, &ar); err != nil {
				return out, uid, fmt.Errorf("응답 파싱 실패: %w", err)
			}
			if ar.Retcode != 0 {
				if ar.Retcode == -101 {
					return out, uid, errors.New("authkey 만료. 게임에서 전언 기록을 다시 열고 재시도하세요")
				}
				return out, uid, fmt.Errorf("API 오류 (retcode=%d): %s", ar.Retcode, ar.Message)
			}
			if len(ar.Data.List) == 0 {
				break
			}
			for _, it := range ar.Data.List {
				if idLessEq(it.ID, lastID[gt]) {
					stop = true
					break
				}
				if uid == "" {
					uid = it.UID
				}
				out = append(out, store.Record{
					GachaID: it.GachaID, GachaType: it.GachaType, ItemID: it.ItemID,
					Count: it.Count, Time: it.Time, Name: it.Name,
					ItemType: it.ItemType, RankType: it.RankType, ID: it.ID,
				})
				added++
			}
			endID = ar.Data.List[len(ar.Data.List)-1].ID
			page++
			onProgress(bannerName[gt], added)
			if delay > 0 {
				time.Sleep(delay)
			}
		}
	}
	return out, uid, nil
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run:
```powershell
go test ./internal/collector/ -v
```
Expected: PASS (4개 — cache 2 + fetch 2).

- [ ] **Step 5: Commit**

```powershell
git add internal/collector/fetch.go internal/collector/fetch_test.go; git commit -m "feat(collector): incremental paginated getGachaLog fetch"
```

---

## Task 5: config 저장/로드 · 경로 자동탐지 (server/config.go)

**Files:**
- Create: `internal/server/config.go`
- Test: `internal/server/config_test.go`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `internal/server/config_test.go`:
```go
package server

import (
	"path/filepath"
	"testing"
)

func TestConfigRoundTrip(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "config.json")
	if got := LoadConfig(path).GamePath; got != "" {
		t.Fatalf("expected empty GamePath on missing file, got %q", got)
	}
	if err := SaveConfig(path, Config{GamePath: `D:\Game\Star Rail Games`}); err != nil {
		t.Fatal(err)
	}
	if got := LoadConfig(path).GamePath; got != `D:\Game\Star Rail Games` {
		t.Fatalf("round-trip mismatch: %q", got)
	}
}

func TestDetectGamePath_PicksExisting(t *testing.T) {
	dir := t.TempDir()
	// webCaches 가 있는 후보만 선택되어야 한다.
	good := filepath.Join(dir, "good", "StarRail_Data", "webCaches")
	mustMkdir(t, good)
	candidates := []string{filepath.Join(dir, "nope"), filepath.Join(dir, "good")}
	if got := detectGamePath(candidates); got != filepath.Join(dir, "good") {
		t.Fatalf("expected good path, got %q", got)
	}
}
```

Append helper to the same file:
```go
import "os"

func mustMkdir(t *testing.T, p string) {
	t.Helper()
	if err := os.MkdirAll(p, 0755); err != nil {
		t.Fatal(err)
	}
}
```

- [ ] **Step 2: 테스트 실패 확인**

Run:
```powershell
go test ./internal/server/ -v
```
Expected: FAIL — `undefined: LoadConfig` 등.

- [ ] **Step 3: 최소 구현 작성**

Create `internal/server/config.go`:
```go
package server

import (
	"encoding/json"
	"os"
	"path/filepath"
)

// Config 는 사용자별 영속 설정이다(사용자 머신 로컬 파일에만 기록).
type Config struct {
	GamePath string `json:"game_path"`
}

// LoadConfig 는 config 파일을 읽는다. 없거나 깨졌으면 zero 값 Config 반환.
func LoadConfig(path string) Config {
	var c Config
	b, err := os.ReadFile(path)
	if err != nil {
		return c
	}
	_ = json.Unmarshal(b, &c)
	return c
}

// SaveConfig 는 config 를 원자적으로 저장한다.
func SaveConfig(path string, c Config) error {
	b, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return err
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, b, 0644); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

// defaultCandidates 는 흔한 HoYoPlay 설치 경로 후보다.
func defaultCandidates() []string {
	return []string{
		`D:\Game\HoYoPlay\games\Star Rail Games`,
		`C:\Program Files\HoYoPlay\games\Star Rail Games`,
		`D:\Program Files\HoYoPlay\games\Star Rail Games`,
		`C:\Games\HoYoPlay\games\Star Rail Games`,
		`C:\Program Files\Star Rail\Games`,
	}
}

// detectGamePath 는 webCaches 가 존재하는 첫 후보 경로를 반환한다(없으면 "").
func detectGamePath(candidates []string) string {
	for _, c := range candidates {
		if _, err := os.Stat(filepath.Join(c, "StarRail_Data", "webCaches")); err == nil {
			return c
		}
	}
	return ""
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run:
```powershell
go test ./internal/server/ -v
```
Expected: PASS (2개).

- [ ] **Step 5: Commit**

```powershell
git add internal/server/config.go internal/server/config_test.go; git commit -m "feat(server): config persistence and game-path auto-detect"
```

---

## Task 6: HTTP 서버 · 자산 임베드 · /api/data (server/server.go)

**Files:**
- Create: `internal/server/server.go`
- Test: `internal/server/server_test.go`

> 이 태스크는 라우팅 골격과 정적/`/api/data`/`/api/config`/`/api/detect` 핸들러를 만든다. SSE(`/api/fetch`)는 Task 7에서 추가한다.

- [ ] **Step 1: 실패하는 테스트 작성**

Create `internal/server/server_test.go`:
```go
package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"hsr-warp/internal/store"
)

func TestHandleData_ReturnsStored(t *testing.T) {
	dir := t.TempDir()
	if _, err := store.WriteAffectedMonths(dir, store.Info{UID: "555"},
		[]store.Record{{ID: "1", GachaType: "11", Time: "2026-06-01 00:00:00", RankType: "5", Name: "Z"}}); err != nil {
		t.Fatal(err)
	}
	s := New(Paths{DataDir: dir, ConfigFile: filepath.Join(dir, "config.json")})
	rr := httptest.NewRecorder()
	s.Handler().ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/api/data", nil))
	if rr.Code != 200 {
		t.Fatalf("status %d", rr.Code)
	}
	var got store.SRGF
	if err := json.Unmarshal(rr.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if len(got.List) != 1 || got.List[0].ID != "1" {
		t.Fatalf("unexpected data: %+v", got)
	}
}

func TestHandleConfig_PostThenGet(t *testing.T) {
	dir := t.TempDir()
	s := New(Paths{DataDir: dir, ConfigFile: filepath.Join(dir, "config.json")})
	h := s.Handler()

	rr := httptest.NewRecorder()
	body := `{"game_path":"D:\\Game\\Star Rail Games"}`
	h.ServeHTTP(rr, httptest.NewRequest(http.MethodPost, "/api/config", stringReader(body)))
	if rr.Code != 200 {
		t.Fatalf("post status %d", rr.Code)
	}

	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/api/config", nil))
	var c Config
	_ = json.Unmarshal(rr.Body.Bytes(), &c)
	if c.GamePath != `D:\Game\Star Rail Games` {
		t.Fatalf("config not persisted: %q", c.GamePath)
	}
}
```

Append helper:
```go
import "strings"

func stringReader(s string) *strings.Reader { return strings.NewReader(s) }
```

- [ ] **Step 2: 테스트 실패 확인**

Run:
```powershell
go test ./internal/server/ -run "TestHandleData|TestHandleConfig" -v
```
Expected: FAIL — `undefined: New`, `undefined: Paths` 등.

- [ ] **Step 3: 최소 구현 작성**

먼저 `web/` 자산을 server 패키지에서 임베드하려면 embed 파일이 패키지 디렉터리 하위여야 한다. 루트의 `web/`을 server가 참조할 수 있도록 **임베드 전용 파일을 루트에 둔다**. Create `assets.go` (루트, package main 아님 — 별도 처리):

> Go `embed` 는 임베드 지시문이 있는 `.go` 파일과 같은 디렉터리(또는 하위)의 파일만 포함할 수 있다. `web/`이 루트에 있으므로 임베드는 **루트 패키지(main)** 에서 하고, 그 `fs.FS` 를 server 에 주입한다.

Create `internal/server/server.go`:
```go
package server

import (
	"encoding/json"
	"io/fs"
	"net/http"
	"path/filepath"

	"hsr-warp/internal/store"
)

// Paths 는 서버가 사용할 파일 경로 모음이다.
type Paths struct {
	DataDir    string
	ConfigFile string
}

// Server 는 대시보드와 API 를 제공한다.
type Server struct {
	paths  Paths
	assets fs.FS // web/ (dashboard.html, analyze.js). nil 이면 자산 라우트 비활성(테스트용).
}

// New 는 자산 없이 Server 를 만든다(API 테스트용).
func New(p Paths) *Server { return &Server{paths: p} }

// NewWithAssets 는 임베드 자산을 주입한다(실제 실행용).
func NewWithAssets(p Paths, assets fs.FS) *Server { return &Server{paths: p, assets: assets} }

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(v)
}

// Handler 는 라우팅된 http.Handler 를 반환한다.
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/data", s.handleData)
	mux.HandleFunc("/api/config", s.handleConfig)
	mux.HandleFunc("/api/detect", s.handleDetect)
	mux.HandleFunc("/api/fetch", s.handleFetch) // Task 7 에서 구현
	if s.assets != nil {
		mux.Handle("/", http.FileServer(http.FS(s.assets)))
	}
	return mux
}

func (s *Server) handleData(w http.ResponseWriter, r *http.Request) {
	recs, info, err := store.LoadAll(s.paths.DataDir)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	out := store.SRGF{List: recs}
	if info != nil {
		out.Info = *info
	}
	writeJSON(w, out)
}

func (s *Server) handleConfig(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodPost {
		var c Config
		if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if err := SaveConfig(s.paths.ConfigFile, c); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		writeJSON(w, map[string]bool{"ok": true})
		return
	}
	writeJSON(w, LoadConfig(s.paths.ConfigFile))
}

func (s *Server) handleDetect(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, map[string]string{"path": detectGamePath(defaultCandidates())})
}

var _ = filepath.Join // (filepath 는 Task 7 에서 사용)
```

> `var _ = filepath.Join` 줄은 Task 7에서 `filepath` 를 실제 사용하면 삭제한다. 임시 미사용 방지용.

- [ ] **Step 4: 테스트 통과 확인**

`handleFetch` 가 아직 없으므로 빈 스텁을 추가한다. Append to `internal/server/server.go`:
```go
func (s *Server) handleFetch(w http.ResponseWriter, r *http.Request) {
	http.Error(w, "not implemented", http.StatusNotImplemented)
}
```

Run:
```powershell
go test ./internal/server/ -v
```
Expected: PASS (config 2 + data/config 2 = 4개).

- [ ] **Step 5: Commit**

```powershell
git add internal/server/server.go internal/server/server_test.go; git commit -m "feat(server): routing, embedded-asset injection point, /api/data /api/config /api/detect"
```

---

## Task 7: SSE 증분 조회 핸들러 (server/server.go)

**Files:**
- Modify: `internal/server/server.go` (handleFetch 교체)
- Test: `internal/server/fetch_handler_test.go`

- [ ] **Step 1: 실패하는 테스트 작성 (SSE done 이벤트 검증)**

Create `internal/server/fetch_handler_test.go`:
```go
package server

import (
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
)

func TestHandleFetch_MissingPath(t *testing.T) {
	dir := t.TempDir()
	s := New(Paths{DataDir: dir, ConfigFile: filepath.Join(dir, "config.json")})
	rr := httptest.NewRecorder()
	s.Handler().ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/api/fetch", nil))
	// path 없으면 SSE error 이벤트를 보내야 한다.
	if !strings.Contains(rr.Body.String(), "event: error") {
		t.Fatalf("expected SSE error event, got: %s", rr.Body.String())
	}
}

func TestHandleFetch_BadGamePathEmitsError(t *testing.T) {
	dir := t.TempDir()
	s := New(Paths{DataDir: dir, ConfigFile: filepath.Join(dir, "config.json")})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/fetch?path="+filepath.Join(dir, "nonexistent"), nil)
	s.Handler().ServeHTTP(rr, req)
	body := rr.Body.String()
	if !strings.Contains(body, "event: error") {
		t.Fatalf("expected error event for bad path, got: %s", body)
	}
	if rr.Header().Get("Content-Type") != "text/event-stream" {
		t.Fatalf("expected SSE content-type, got %q", rr.Header().Get("Content-Type"))
	}
}
```

- [ ] **Step 2: 테스트 실패 확인**

Run:
```powershell
go test ./internal/server/ -run TestHandleFetch -v
```
Expected: FAIL — 현재 스텁이 501 만 반환하므로 `event: error` 없음.

- [ ] **Step 3: handleFetch 구현 교체**

`internal/server/server.go` 에서 `var _ = filepath.Join` 줄을 삭제하고, Task 6 Step 4 에서 추가한 스텁 `handleFetch` 를 아래로 교체. 파일 상단 import 에 `fmt`, `time`, `hsr-warp/internal/collector` 추가:
```go
import (
	"encoding/json"
	"fmt"
	"io/fs"
	"net/http"
	"time"

	"hsr-warp/internal/collector"
	"hsr-warp/internal/store"
)
```

교체할 핸들러:
```go
// handleFetch 는 증분 조회를 SSE 로 스트리밍한다.
// 이벤트: progress {banner,added} / error {message} / done {summary,data}.
func (s *Server) handleFetch(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	flusher, _ := w.(http.Flusher)

	send := func(event string, payload any) {
		b, _ := json.Marshal(payload)
		fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event, b)
		if flusher != nil {
			flusher.Flush()
		}
	}
	fail := func(msg string) { send("error", map[string]string{"message": msg}) }

	gamePath := r.URL.Query().Get("path")
	if gamePath == "" {
		fail("게임 경로가 비어 있습니다.")
		return
	}

	ac, err := collector.FindAuthContext(gamePath)
	if err != nil {
		fail(err.Error())
		return
	}
	// config 에 경로 저장(다음 실행 자동 채움).
	_ = SaveConfig(s.paths.ConfigFile, Config{GamePath: gamePath})

	existing, prevInfo, err := store.LoadAll(s.paths.DataDir)
	if err != nil {
		fail(err.Error())
		return
	}
	lastID := store.MaxIDByBanner(existing)

	newRecs, uid, err := collector.FetchIncremental(ac, lastID, 400*time.Millisecond,
		func(banner string, added int) {
			send("progress", map[string]any{"banner": banner, "added": added})
		})
	if err != nil {
		fail(err.Error())
		return
	}

	if uid == "" && prevInfo != nil {
		uid = prevInfo.UID
	}
	info := store.Info{
		UID: uid, Lang: ac.Lang, Region: ac.Region,
		RegionTimeZone:  store.TZForRegion(ac.Region),
		ExportTimestamp: time.Now().Unix(),
		ExportApp:       "DIY-HSR-Warp", ExportAppVersion: "3.0", SRGFVersion: "v1.0",
	}

	updatedMonths, err := store.WriteAffectedMonths(s.paths.DataDir, info, newRecs)
	if err != nil {
		fail(err.Error())
		return
	}

	// 갱신 후 전체 합본 재구성.
	all, finalInfo, err := store.LoadAll(s.paths.DataDir)
	if err != nil {
		fail(err.Error())
		return
	}
	out := store.SRGF{List: all}
	if finalInfo != nil {
		out.Info = *finalInfo
	} else {
		out.Info = info
	}

	// 배너별 신규 건수 요약.
	perBanner := map[string]int{}
	for _, r := range newRecs {
		perBanner[r.GachaType]++
	}
	send("done", map[string]any{
		"summary": map[string]any{
			"newTotal":      len(newRecs),
			"perBanner":     perBanner,
			"updatedMonths": updatedMonths,
		},
		"data": out,
	})
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run:
```powershell
go test ./internal/server/ -v
```
Expected: PASS (config 2 + data/config 2 + fetch 2 = 6개).

- [ ] **Step 5: Commit**

```powershell
git add internal/server/server.go internal/server/fetch_handler_test.go; git commit -m "feat(server): SSE incremental fetch handler"
```

---

## Task 8: 진입점 — 포트 선택·자산 임베드·브라우저 오픈 (main.go)

**Files:**
- Create: `main.go`

- [ ] **Step 1: main.go 작성**

> `go:embed` 가 `web/`(루트 하위)를 포함하므로 임베드는 main 패키지에서 한다. `os.Executable()` 로 baseDir 을 정해 data/config 경로를 exe 옆에 둔다.

Create `main.go`:
```go
package main

import (
	"embed"
	"fmt"
	"io/fs"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"

	"hsr-warp/internal/server"
)

//go:embed web/dashboard.html web/analyze.js
var webFiles embed.FS

func baseDir() string {
	exe, err := os.Executable()
	if err != nil {
		wd, _ := os.Getwd()
		return wd
	}
	return filepath.Dir(exe)
}

// freeListener 는 start 부터 빈 포트를 찾아 리스너를 연다.
func freeListener(start int) (net.Listener, int, error) {
	for p := start; p < start+50; p++ {
		ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", p))
		if err == nil {
			return ln, p, nil
		}
	}
	return nil, 0, fmt.Errorf("빈 포트를 찾지 못했습니다(%d~%d)", start, start+49)
}

func openBrowser(url string) {
	// Windows: rundll32 로 기본 브라우저 오픈(따옴표 이슈 없음).
	_ = exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()
}

func main() {
	base := baseDir()
	paths := server.Paths{
		DataDir:    filepath.Join(base, "data"),
		ConfigFile: filepath.Join(base, "config.json"),
	}
	assets, err := fs.Sub(webFiles, "web")
	if err != nil {
		fmt.Println("자산 로드 실패:", err)
		os.Exit(1)
	}
	srv := server.NewWithAssets(paths, assets)

	ln, port, err := freeListener(8787)
	if err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
	url := fmt.Sprintf("http://127.0.0.1:%d/dashboard.html", port)
	fmt.Printf("HSR 워프 대시보드: %s\n(종료하려면 이 창에서 Ctrl+C)\n", url)
	openBrowser(url)
	if err := http.Serve(ln, srv.Handler()); err != nil {
		fmt.Println("서버 종료:", err)
	}
}
```

> 루트 경로 `/` 는 `http.FileServer` 가 디렉터리 목록을 보일 수 있어, 진입 URL 을 명시적으로 `/dashboard.html` 로 연다. (원하면 Task 9 후속으로 `/` → dashboard 리다이렉트를 추가할 수 있으나 YAGNI: 자동 오픈 URL 로 충분.)

- [ ] **Step 2: 빌드 확인**

Run:
```powershell
go build -o hsr-warp.exe .
```
Expected: 에러 없이 `hsr-warp.exe` 생성.

- [ ] **Step 3: 전체 테스트 재확인**

Run:
```powershell
go test ./...
```
Expected: 모든 패키지 `ok` (store, collector, server).

- [ ] **Step 4: Commit**

```powershell
git add main.go; git commit -m "feat: entrypoint with port selection, embedded assets, browser open"
```

---

## Task 9: 대시보드를 서버 연동형으로 수정 (web/dashboard.html)

**Files:**
- Modify: `web/dashboard.html`

기존 파일은 `analyze.js` 인라인(마커) + `window.__WARP_DATA__` + 드롭존 구조다. 이를 (1) `/analyze.js` 외부 로드, (2) 경로 입력·조회 컨트롤 패널, (3) `/api/data` 자동 로드, (4) SSE 진행/요약, (5) 비파괴(조회 실패가 기존 표시를 지우지 않음) 로 바꾼다. `render(A)`/`drawCharts(A)` 함수는 그대로 둔다.

- [ ] **Step 1: analyze.js 인라인 마커를 외부 스크립트로 교체**

In `web/dashboard.html`, replace:
```html
<script>/*__ANALYZE_JS__*/</script>
<script>window.__WARP_DATA__ = /*__DATA__*/ null;</script>
```
with:
```html
<script src="/analyze.js"></script>
```

- [ ] **Step 2: 드롭존 마크업을 컨트롤 패널로 교체**

Replace the entire `<div id="drop"> ... </div>` block (현재 78–84행):
```html
  <div id="drop">
    <div style="font-size:32px">📂</div>
    <div style="margin-top:10px"><b>warp_data</b> JSON 을 끌어다 놓거나 클릭해서 선택</div>
    <div class="hint">스크립트로 생성된 대시보드는 데이터가 내장돼 자동으로 표시됩니다.</div>
    <input type="file" id="file" accept=".json,application/json" hidden>
    <div id="err" class="err"></div>
  </div>
```
with:
```html
  <div id="panel" class="card" style="margin-top:20px">
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
      <input id="path" type="text" placeholder="게임 경로 (…\Star Rail Games)"
        style="flex:1;min-width:280px;padding:10px 12px;border-radius:8px;border:1px solid var(--line);background:var(--panel2);color:var(--txt);font-size:14px">
      <button id="go" style="padding:10px 18px;border:0;border-radius:8px;background:var(--gold);color:#0d1018;font-weight:700;font-size:14px;cursor:pointer">조회</button>
    </div>
    <div class="hint" style="color:var(--muted);font-size:12.5px;margin-top:8px">
      게임에서 <b>전언 기록</b> 화면을 최근 24시간 내 한 번 연 뒤 조회하세요. 기존 데이터는 안전하게 보존되며 신규만 추가됩니다.
    </div>
    <div id="progress" style="font-family:Consolas,monospace;font-size:12.5px;color:var(--muted);margin-top:10px;white-space:pre-line"></div>
    <div id="summary" style="font-size:13px;margin-top:8px"></div>
    <div id="err" class="err"></div>
  </div>
```

- [ ] **Step 3: 하단 스크립트의 파일 드롭 로직을 서버 연동으로 교체**

Replace this block (현재 104–111행):
```javascript
drop.addEventListener('click',()=>fileInput.click());
fileInput.addEventListener('change',e=>{if(e.target.files[0])readFile(e.target.files[0]);});
['dragover','dragenter'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('over');}));
['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('over');}));
drop.addEventListener('drop',e=>{const f=e.dataTransfer.files[0];if(f)readFile(f);});
function readFile(file){err.textContent='';const fr=new FileReader();
  fr.onload=()=>{try{const d=JSON.parse(fr.result);if(!d||!Array.isArray(d.list))throw new Error('list 배열이 없습니다.');render(WarpAnalyze.analyze(d));}catch(ex){err.textContent='읽기 실패: '+ex.message;}};
  fr.readAsText(file);}
```
with:
```javascript
const pathInput=$('#path'),goBtn=$('#go'),progress=$('#progress'),summary=$('#summary');
const bannerLabel={'11':'캐릭터','12':'광추','1':'일반','2':'출발'};

// 기존 데이터가 있으면 화면에 즉시 표시(조회 안 해도 과거 기록 열람 가능).
function loadStored(){
  fetch('/api/data').then(r=>r.json()).then(d=>{
    if(d&&Array.isArray(d.list)&&d.list.length)render(WarpAnalyze.analyze(d));
  }).catch(()=>{});
}
// 경로 입력란 자동 채움: config(마지막 사용) 우선, 없으면 자동탐지.
function fillPath(){
  fetch('/api/config').then(r=>r.json()).then(c=>{
    if(c&&c.game_path){pathInput.value=c.game_path;return;}
    fetch('/api/detect').then(r=>r.json()).then(d=>{if(d&&d.path)pathInput.value=d.path;});
  }).catch(()=>{});
}

function runFetch(){
  const p=pathInput.value.trim();
  err.textContent='';summary.innerHTML='';
  if(!p){err.textContent='게임 경로를 입력하세요.';return;}
  goBtn.disabled=true;goBtn.textContent='조회 중…';
  progress.textContent='연결 중…';
  const es=new EventSource('/api/fetch?path='+encodeURIComponent(p));
  es.addEventListener('progress',e=>{
    const d=JSON.parse(e.data);
    progress.textContent=`${d.banner} +${d.added}건…`;
  });
  es.addEventListener('error',e=>{
    es.close();goBtn.disabled=false;goBtn.textContent='조회';
    // 서버가 보낸 SSE error 이벤트 vs 네트워크 끊김 구분.
    if(e.data){try{err.textContent='조회 실패: '+JSON.parse(e.data).message;}catch{err.textContent='조회 실패';}}
    else if(progress.textContent==='연결 중…'){err.textContent='서버 연결 실패';}
    progress.textContent='';
  });
  es.addEventListener('done',e=>{
    es.close();goBtn.disabled=false;goBtn.textContent='조회';progress.textContent='';
    const d=JSON.parse(e.data),s=d.summary;
    const parts=Object.keys(s.perBanner||{}).map(k=>`${bannerLabel[k]||k} +${s.perBanner[k]}`);
    summary.innerHTML = s.newTotal
      ? `<span style="color:var(--green)">신규 ${s.newTotal}건</span> · ${parts.join(' · ')} · 갱신 월: ${(s.updatedMonths||[]).map(m=>m.slice(0,4)+'.'+m.slice(4)).join(', ')}`
      : '<span class="muted">변경 없음 (신규 기록 없음)</span>';
    if(d.data&&Array.isArray(d.data.list))render(WarpAnalyze.analyze(d.data));
  });
}
goBtn.addEventListener('click',runFetch);
fillPath();
loadStored();
```

- [ ] **Step 4: 임베드된 자동로드 라인 제거**

Replace (현재 241–242행):
```javascript
// auto-load embedded data (generated dashboards)
if(window.__WARP_DATA__&&Array.isArray(window.__WARP_DATA__.list))render(WarpAnalyze.analyze(window.__WARP_DATA__));
```
with:
```javascript
// 데이터 로드는 위 loadStored()/runFetch() 가 담당한다.
```

- [ ] **Step 5: render()가 패널을 숨기지 않도록 확인**

`render(A)` 함수 안의 `drop.style.display='none'` 줄을 찾는다. `drop` 변수는 더 이상 존재하지 않으므로(상단 `const drop=$('#drop')` 도 제거 대상), 다음을 수행:
- 상단 `const drop=$('#drop'),fileInput=$('#file'),err=$('#err'),app=$('#app');` 를
  `const err=$('#err'),app=$('#app');` 로 교체.
- `render()` 내부 `drop.style.display='none';app.style.display='block';` 를
  `app.style.display='block';` 로 교체(패널은 계속 보이게 둔다 — 재조회 가능).

- [ ] **Step 6: 빌드 후 수동 확인 (자산 임베드 갱신)**

Run:
```powershell
go build -o hsr-warp.exe .
.\hsr-warp.exe
```
Expected: 콘솔에 `http://127.0.0.1:8787/dashboard.html` 출력 + 브라우저 자동 오픈. 데이터가 없으면 빈 대시보드 + 컨트롤 패널 표시, 경로 입력란 자동 채움. (실제 조회는 게임 설치 + 전언기록 오픈 환경에서 검증 — Task 10.)
확인 후 콘솔에서 Ctrl+C 로 종료.

- [ ] **Step 7: Commit**

```powershell
git add web/dashboard.html; git commit -m "feat(web): server-driven dashboard with path input, /api/data load, SSE progress/summary"
```

---

## Task 10: 실사용 검증 · 빌드 최적화 · 레거시 제거

**Files:**
- Delete: `Get-HSRWarp.ps1`, `Update-HSRDashboard.ps1`, `Register-Schedule.ps1`, `sim_incremental.js`, `dashboard.template.html`
- Modify: `README.md`, `CLAUDE.md`

- [ ] **Step 1: 최적화 빌드**

Run:
```powershell
go build -ldflags="-s -w" -o hsr-warp.exe .
(Get-Item hsr-warp.exe).Length / 1MB
```
Expected: 빌드 성공, 크기 약 7–12MB 출력.

- [ ] **Step 2: 실제 게임 환경에서 엔드투엔드 검증**

게임에서 **전언 기록 화면을 한 번 연 뒤**:
```powershell
.\hsr-warp.exe
```
브라우저에서 경로 자동 채움 확인 → **조회** 클릭 → 진행 로그(`캐릭터 +20건…`) 실시간 표시 → 완료 시 요약(`신규 N건 · … · 갱신 월 …`) + 차트 렌더 확인.
Expected:
- `data\warp_YYYYMM.json` 이 영향받은 월만 생성/갱신됨.
- 재조회 시 신규 0건이면 "변경 없음" + 기존 차트 유지.
- 과거 월 파일 타임스탬프가 미영향 시 바뀌지 않음(`Get-ChildItem data\*.json | Select Name,LastWriteTime` 로 확인).

> authkey 만료/경로 오류 등 실패 시 빨간 메시지가 뜨고 기존 차트는 유지되는지(비파괴) 확인.

- [ ] **Step 3: analyze.js 단위 테스트가 여전히 통과하는지 확인**

루트 `analyze.js` 는 변경하지 않았으므로 그대로 통과해야 한다.
Run:
```powershell
node analyze.test.js
```
Expected: `OK ...` 출력 후 종료(0).

> 주의: `web\analyze.js` 와 루트 `analyze.js` 는 같은 내용이어야 한다. 향후 분석 로직 변경 시 둘 다 갱신(또는 빌드 전 `Copy-Item analyze.js web\analyze.js -Force`). README 에 이 점을 명시(Step 5).

- [ ] **Step 4: 레거시 파일 제거**

Run:
```powershell
git rm Get-HSRWarp.ps1 Update-HSRDashboard.ps1 Register-Schedule.ps1 sim_incremental.js dashboard.template.html
```
Expected: 5개 파일 삭제 스테이징. (PS 수집기·스케줄러·증분 시뮬레이터·템플릿은 Go 구현으로 대체됨.)

- [ ] **Step 5: README.md / CLAUDE.md 갱신**

`README.md` 와 `CLAUDE.md` 의 다음 내용을 새 흐름으로 교체:
- 빌드: `go build -ldflags="-s -w" -o hsr-warp.exe .`
- 실행: `.\hsr-warp.exe` → 브라우저 자동 오픈 → 경로 입력/자동채움 → 조회.
- 테스트: `go test ./...` (Go), `node analyze.test.js` (브라우저 분석 로직).
- 저장: `data\warp_YYYYMM.json`, **영향받은 월만 비파괴 재작성**(전량 삭제 폐기).
- 50/50 유지보수 지점: `analyze.js` 상단 `STANDARD` 배열(루트 + `web/` 둘 다).
- 폐기된 PowerShell 스크립트/스케줄러 언급 제거.

> `gen_sample.js` 는 합성 데이터 수동 확인용으로 유지(선택). `.gitignore` 에 `hsr-warp.exe`, `data/`, `config.json`, `*.tmp` 추가 권장.

- [ ] **Step 6: Commit**

```powershell
git add README.md CLAUDE.md .gitignore; git commit -m "docs: document single-exe workflow; remove legacy PowerShell collectors and scheduler"
```

---

## Self-Review (작성자 점검 완료)

**Spec coverage:**
- 단일 실행파일 → Task 0(모듈)·8(main)·10(빌드). ✅
- 경로 동적 입력 + 자동탐지 + 기억 → Task 5(detect/config)·7(저장)·9(UI 채움). ✅
- 로컬서버 + 라이브 표시 → Task 6(서버)·7(SSE)·8(기동)·9(UI). ✅
- 월별 분리 + 영향월만 비파괴 재작성 → Task 2 + 테스트. ✅
- UI/UX 비파괴(전량삭제 없음, 변경요약, 읽기우선) → Task 9 Step 3/5 + Task 10 Step 2. ✅
- 큰 ID 정밀도(big.Int) → Task 1·4(idLess/idLessEq). ✅
- 도메인 상수(gacha_type, STANDARD) → `analyze.js` 불변, 브라우저 실행 유지. ✅
- 에러 처리(-101, 경로/캐시, 포트) → Task 4·7(SSE error)·8(freeListener). ✅
- 스케줄러 폐기 → Task 10 Step 4. ✅

**Placeholder scan:** 모든 코드 스텝에 실제 코드 포함. "TBD"/"적절히 처리" 없음. ✅
**Type consistency:** `Record`/`Info`/`SRGF`(store), `AuthContext`(collector), `Config`/`Paths`/`Server`(server), `idLess`/`idLessEq`/`MaxIDByBanner`/`WriteAffectedMonths`/`LoadAll`/`FindAuthContext`/`FetchIncremental`/`TZForRegion`/`detectGamePath`/`LoadConfig`/`SaveConfig`/`New`/`NewWithAssets`/`Handler` — 정의 태스크와 사용 태스크 시그니처 일치. ✅
**임베드 경로:** `go:embed web/...` 은 main 패키지(루트), server 는 `fs.Sub` 주입 — 패키지 경계와 embed 제약 일치. ✅
