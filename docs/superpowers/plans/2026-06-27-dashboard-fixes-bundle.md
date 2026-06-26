# 대시보드 소소한 수정 묶음 (이슈 #11) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 버전 드롭다운 내림차순·'평균 천장'→'평균 뽑기 수' 용어 정정·게임 실행 중 파일 점유 버그(FILE_SHARE_DELETE) 3건과 관련 문서를 한 PR로 수정한다.

**Architecture:** 대시보드는 빌드 스텝 없이 Babel standalone 으로 `.jsx` 를 브라우저에서 직접 트랜스파일하므로 `.jsx` 파일이 곧 소스다(번들 재생성 불필요). 파일 점유는 Go `os.ReadFile` 이 `FILE_SHARE_DELETE` 를 빠뜨려 생기며, stdlib `syscall.CreateFile` 로 세 공유 비트를 모두 켠 헬퍼로 해결한다. 각 코드 변경에 닿는 문서를 같은 태스크에서 함께 갱신한다.

**Tech Stack:** Go 1.26(stdlib `syscall`), React 18 + Babel standalone(브라우저 내 JSX), Node 테스트(`web/analyze.test.js`).

## Global Constraints

- 새 의존성 금지 — Item 3 은 stdlib `syscall` 만 사용(`go.mod` 의존성 0개 유지).
- 이 도구는 Windows 전용 — `syscall.CreateFile` 사용은 무방하며 빌드 태그 불필요.
- `web/analyze.js` 의 `versionWindows` 정렬(`a.s-b.s` 오름차순)은 **절대 변경 금지** — 버전 윈도우 계산에 의존. 표시 정렬만 렌더 시점에서 뒤집는다.
- Item 2 기준 용어는 **'평균 뽑기 수'**(라벨 맥락 따라 수식어 유지). 평균 지표만 정정하고, cap(90)·개별 pity·분포의 '천장' 표기는 유지.
- 포맷·정적검사 권위: `gofmt -w .` 와 `go vet ./...`. 전체 테스트: `go test ./... && node web/analyze.test.js`.
- 작업 브랜치 `fix/issue-11-dashboard-fixes` 에서 진행(이미 생성됨).

---

## File Structure

- `internal/collector/cache.go` — `readShared` 헬퍼 추가, `FindAuthContext` 의 읽기 호출 교체(Task 1)
- `internal/collector/cache_test.go` — 점유 재현 테스트 추가(Task 1)
- `docs/architecture.html`, `docs/ARCHITECTURE.md` — 공유 열기 동작 정정(Task 1)
- `web/ui_kits/dashboard/Dashboard.jsx` — 버전 드롭다운 내림차순(Task 2)
- `web/ui_kits/dashboard/{BannerCards,BannersView,HeroSummary,VersionsView}.jsx` — 용어 정정(Task 3)
- `README.md` — 평균 지표 용어 정정(Task 3)

---

### Task 1: 게임 실행 중 파일 점유 버그 (Item 3 + 관련 문서)

**Files:**
- Modify: `internal/collector/cache.go` (import 추가, `readShared` 추가, `FindAuthContext` 의 `os.ReadFile` 교체 `:182`)
- Test: `internal/collector/cache_test.go` (신규 테스트 함수 추가)
- Modify: `docs/architecture.html:335`, `docs/ARCHITECTURE.md:14`

**Interfaces:**
- Produces: `readShared(path string) ([]byte, error)` — `FILE_SHARE_READ|WRITE|DELETE` 로 파일을 열어 전체 바이트 반환. 게임이 `data_2` 를 점유한 상태에서도 읽는다.

- [ ] **Step 1: 실패하는 테스트 작성**

`internal/collector/cache_test.go` 끝에 추가(파일 상단 `import "testing"` 를 아래 블록으로 교체):

```go
import (
	"os"
	"path/filepath"
	"syscall"
	"testing"
)
```

함수 추가:

```go
// TestReadShared_SucceedsWhenOsReadFileBlocked 는 게임이 webCache data_2 를
// DELETE 권한으로 쥔 상황을 재현한다. 표준 os.ReadFile 은 FILE_SHARE_DELETE 가
// 없어 ERROR_SHARING_VIOLATION 으로 실패하고, readShared 는 성공해야 한다.
func TestReadShared_SucceedsWhenOsReadFileBlocked(t *testing.T) {
	const want = "authkey-blob-내용"
	path := filepath.Join(t.TempDir(), "data_2")
	if err := os.WriteFile(path, []byte(want), 0o644); err != nil {
		t.Fatal(err)
	}

	// 게임 흉내: DELETE 접근 + 풀 공유로 선점한 채 핸들 유지.
	p, err := syscall.UTF16PtrFromString(path)
	if err != nil {
		t.Fatal(err)
	}
	const deleteAccess = 0x00010000 // 표준 액세스 권리 DELETE (syscall 미노출)
	h, err := syscall.CreateFile(p, deleteAccess,
		syscall.FILE_SHARE_READ|syscall.FILE_SHARE_WRITE|syscall.FILE_SHARE_DELETE,
		nil, syscall.OPEN_EXISTING, syscall.FILE_ATTRIBUTE_NORMAL, 0)
	if err != nil {
		t.Fatalf("선점 open 실패: %v", err)
	}
	defer syscall.CloseHandle(h)

	// 기준선: 표준 os.ReadFile 은 공유 위반으로 실패해야 한다(이 fix 의 동기).
	if _, err := os.ReadFile(path); err == nil {
		t.Fatal("os.ReadFile 가 성공함 — 점유 시나리오가 재현되지 않음")
	}

	got, err := readShared(path)
	if err != nil {
		t.Fatalf("readShared 실패: %v", err)
	}
	if string(got) != want {
		t.Fatalf("내용 불일치: got %q want %q", string(got), want)
	}
}
```

- [ ] **Step 2: 테스트가 실패(컴파일 에러)함을 확인**

Run: `cd "C:/Users/jkas3/Documents/Workspace/hsr-warp" && export PATH="/c/Program Files/Go/bin:$PATH" && go test ./internal/collector/ -run TestReadShared -v`
Expected: FAIL — `undefined: readShared` (컴파일 실패).

- [ ] **Step 3: `readShared` 구현 + import 추가**

`internal/collector/cache.go` 의 import 블록에 `io` 와 `syscall` 추가:

```go
import (
	"errors"
	"io"
	"log/slog"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"syscall"
	"time"
)
```

`FindAuthContext` 함수 위(또는 아래)에 헬퍼 추가:

```go
// readShared 는 FILE_SHARE_DELETE 까지 포함해 열어 게임 실행 중에도 읽는다.
// os.ReadFile 은 FILE_SHARE_READ|WRITE 만 써서(stdlib syscall_windows.go),
// DELETE 권한으로 매핑된 webCache data_2 를 ERROR_SHARING_VIOLATION(32) 으로 못 읽는다.
func readShared(path string) ([]byte, error) {
	p, err := syscall.UTF16PtrFromString(path)
	if err != nil {
		return nil, err
	}
	h, err := syscall.CreateFile(p, syscall.GENERIC_READ,
		syscall.FILE_SHARE_READ|syscall.FILE_SHARE_WRITE|syscall.FILE_SHARE_DELETE,
		nil, syscall.OPEN_EXISTING, syscall.FILE_ATTRIBUTE_NORMAL, 0)
	if err != nil {
		return nil, err
	}
	f := os.NewFile(uintptr(h), path)
	defer f.Close()
	return io.ReadAll(f)
}
```

- [ ] **Step 4: `FindAuthContext` 의 읽기 호출 교체**

`internal/collector/cache.go:181-182` 를 교체:

```go
	dataFile := filepath.Join(webCaches, chosen, "Cache", "Cache_Data", "data_2")
	// readShared 로 FILE_SHARE_DELETE 포함 열기 — 게임 실행 중에도 읽는다.
	blob, err := readShared(dataFile)
	if err != nil {
		return nil, err
	}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd "C:/Users/jkas3/Documents/Workspace/hsr-warp" && export PATH="/c/Program Files/Go/bin:$PATH" && go test ./internal/collector/ -run TestReadShared -v`
Expected: PASS.

- [ ] **Step 6: 포맷·정적검사·전체 Go 테스트**

Run: `cd "C:/Users/jkas3/Documents/Workspace/hsr-warp" && export PATH="/c/Program Files/Go/bin:$PATH" && gofmt -w . && go vet ./... && go test ./...`
Expected: gofmt 무출력(또는 정렬만), go vet 무출력, 모든 패키지 `ok`/`no test files`.

- [ ] **Step 7: 관련 문서 정정**

`docs/architecture.html:335` 한 행 교체:

```html
      <tr><td>게임 실행 중 캐시 파일 읽기 (FILE_SHARE_DELETE)</td><td><code>internal/collector/cache.go</code> 의 <code>readShared</code> — <code>os.ReadFile</code> 은 <code>FILE_SHARE_DELETE</code> 누락으로 게임 점유 시 실패하므로 <code>syscall.CreateFile</code> 로 READ|WRITE|DELETE 공유 열기. 근거: <a href="https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-createfilew">Win32 CreateFileW</a></td></tr>
```

`docs/ARCHITECTURE.md:14` 의 `FindAuthContext(...)` 괄호 안 끝부분에 절 추가 — `authkey URL 추출;` 바로 뒤에 삽입:

```
authkey URL 추출(readShared 로 FILE_SHARE_DELETE 포함 공유 열기 — 게임 실행 중에도 읽음);
```

- [ ] **Step 8: 커밋**

```bash
cd "C:/Users/jkas3/Documents/Workspace/hsr-warp"
git add internal/collector/cache.go internal/collector/cache_test.go docs/architecture.html docs/ARCHITECTURE.md
git commit -m "$(printf 'fix: 게임 실행 중 캐시 파일 점유 에러 해결 (FILE_SHARE_DELETE)\n\nos.ReadFile 은 FILE_SHARE_DELETE 누락으로 점유 시 실패. syscall.CreateFile\n로 세 공유 비트를 켠 readShared 헬퍼로 교체. 문서도 정정.\n\nCloses #11 (3/3)\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

### Task 2: 버전 구간 드롭다운 내림차순 (Item 1)

**Files:**
- Modify: `web/ui_kits/dashboard/Dashboard.jsx:111`

**Interfaces:**
- Consumes: 전역 `WARP_DATA` 의 `data.versions`(오름차순 배열) — `data.js` 가 채움. 본 태스크는 표시 순서만 뒤집고 원본은 비파괴.

> 참고: JSX 렌더용 자동 테스트 하네스가 없어 이 태스크는 red-green 사이클 대신 편집 → 회귀 가드 → 육안 검증으로 진행한다.

- [ ] **Step 1: 드롭다운 map 을 역순으로 변경**

`web/ui_kits/dashboard/Dashboard.jsx:111` 를 교체:

```jsx
                  {[...data.versions].reverse().map((v) => <option key={v.v} value={v.v}>{v.v}</option>)}
```

(앞줄 `<option value="전체">전체 기간</option>` 정적 옵션은 그대로 — 맨 위 고정 유지. `[...data.versions]` 얕은 복사로 원본 비파괴.)

- [ ] **Step 2: 회귀 가드 — analyze 테스트 통과 확인**

Run: `cd "C:/Users/jkas3/Documents/Workspace/hsr-warp" && node web/analyze.test.js`
Expected: 모든 assert 통과(분석 로직 무변경이므로 그대로 통과해야 함).

- [ ] **Step 3: 변경 적용 확인**

Run: `cd "C:/Users/jkas3/Documents/Workspace/hsr-warp" && grep -n "reverse().map" web/ui_kits/dashboard/Dashboard.jsx`
Expected: `:111` 한 줄 매치.

- [ ] **Step 4: 육안 검증(수동)**

`hsr-warp.exe` 실행 → 대시보드 우상단 '버전 구간' 드롭다운이 **최신 버전 위(내림차순)**, '전체 기간'이 **맨 위**인지 확인. (자동 테스트 불가 항목 — 실행 환경에서 한 번 확인.)

- [ ] **Step 5: 커밋**

```bash
cd "C:/Users/jkas3/Documents/Workspace/hsr-warp"
git add web/ui_kits/dashboard/Dashboard.jsx
git commit -m "$(printf 'feat: 버전 구간 드롭다운 내림차순 정렬\n\n최신 버전을 위로(전체 기간은 맨 위 고정). 표시용 얕은 복사 reverse 로\nanalyze.js versionWindows 정렬은 건드리지 않음.\n\nCloses #11 (1/3)\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

### Task 3: '평균 천장' → '평균 뽑기 수' 용어 정정 (Item 2 + README)

**Files:**
- Modify: `web/ui_kits/dashboard/BannerCards.jsx:31`, `web/ui_kits/dashboard/BannersView.jsx:51`, `web/ui_kits/dashboard/HeroSummary.jsx:25`, `web/ui_kits/dashboard/HeroSummary.jsx:65`, `web/ui_kits/dashboard/VersionsView.jsx:27`, `web/ui_kits/dashboard/VersionsView.jsx:33`
- Modify: `README.md:64`, `README.md:65`

**Interfaces:**
- Consumes: 없음(라벨 문자열만 교체, 로직·`avgPity5` 데이터 흐름 무변경).

> 참고: 자동 테스트 하네스 없음 → 편집 → 회귀 가드 → 잔여 검색 → 육안 검증.

- [ ] **Step 1: JSX 라벨 6곳 교체**

`web/ui_kits/dashboard/BannerCards.jsx:31`:

```jsx
              <Row k="평균 뽑기 수" v={b.avgPity5 ? b.avgPity5.toFixed(1) : '-'} />
```

`web/ui_kits/dashboard/BannersView.jsx:51`:

```jsx
            <Mini k="평균 뽑기 수" v={`${b.avgPity5.toFixed(1)}회`} />
```

`web/ui_kits/dashboard/HeroSummary.jsx:25`:

```jsx
          <div className="lbl">운 지표 · 캐릭터 평균 뽑기 수</div>
```

`web/ui_kits/dashboard/HeroSummary.jsx:65`:

```jsx
          <div className="lbl">평균 뽑기 수 · 캐릭터</div>
```

`web/ui_kits/dashboard/VersionsView.jsx:27`:

```jsx
        <div className="lbl" style={{ marginBottom: 12 }}>캐릭터 평균 뽑기 수 비교 <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>· 짧을수록 행운 (기준 62.5)</span></div>
```

`web/ui_kits/dashboard/VersionsView.jsx:33`(테이블 헤더, 폭 제약상 축약):

```jsx
          <thead><tr><th>버전</th><th>기간</th><th>뽑기</th><th>5★</th><th>캐릭 평균뽑기</th><th>픽승 / 픽뚫</th></tr></thead>
```

- [ ] **Step 2: README 평균 지표 용어 2곳 교체**

`README.md:64`:

```markdown
- **운 지표** — 5★ 평균 뽑기 수를 이론 평균 **62.5회**(종합 확률 1.6%)와 비교. 낮을수록 행운입니다.
```

`README.md:65`:

```markdown
- **평균 뽑기 수** — 캐릭터 5★ 평균 뽑기 수(+ 최고/최악 운).
```

- [ ] **Step 3: 평균 지표 '천장' 잔여 0건 확인**

Run: `cd "C:/Users/jkas3/Documents/Workspace/hsr-warp" && grep -rn "평균 천장\|평균천장" web/ui_kits/dashboard/ README.md`
Expected: 매치 없음(출력 없음).

- [ ] **Step 4: 정당한 '천장' 표기 보존 확인(과잉 치환 방지)**

Run: `cd "C:/Users/jkas3/Documents/Workspace/hsr-warp" && grep -rn "cap} 천장\|5★ 천장 분포\|하드천장" web/ui_kits/dashboard/ README.md`
Expected: cap 표기·분포·하드천장 표기는 **여전히 존재**(이들은 유지 대상).

- [ ] **Step 5: 회귀 가드 — analyze 테스트 통과 확인**

Run: `cd "C:/Users/jkas3/Documents/Workspace/hsr-warp" && node web/analyze.test.js`
Expected: 모든 assert 통과.

- [ ] **Step 6: 육안 검증(수동)**

`hsr-warp.exe` 실행 → 히어로·배너카드·배너 심화·버전 비교 화면의 해당 라벨이 모두 '평균 뽑기 수' 계열로 표시되는지 확인.

- [ ] **Step 7: 커밋**

```bash
cd "C:/Users/jkas3/Documents/Workspace/hsr-warp"
git add web/ui_kits/dashboard/BannerCards.jsx web/ui_kits/dashboard/BannersView.jsx web/ui_kits/dashboard/HeroSummary.jsx web/ui_kits/dashboard/VersionsView.jsx README.md
git commit -m "$(printf \"fix: '평균 천장' 문구를 '평균 뽑기 수'로 정정\n\n천장은 hard pity(90) 용어라 평균값에 부적절. avgPity5(모든 5성 평균\n뽑기 수) 라벨 6곳과 README 2곳 정정. cap/개별 pity 의 천장 표기는 유지.\n\nCloses #11 (2/3)\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>\")"
```

---

## Self-Review

**Spec coverage:**
- Item 1(드롭다운 내림차순) → Task 2 ✓
- Item 2(용어 6곳) → Task 3 Step 1 ✓
- Item 3(파일 점유) → Task 1 ✓
- Item 4(문서: README 2곳 → Task 3 Step 2 ✓ / architecture.html:335 → Task 1 Step 7 ✓ / ARCHITECTURE.md:14 → Task 1 Step 7 ✓)
- 비범위(다른 '천장' 재검토 안 함, read-deny 폴백 없음) → Task 3 Step 4 가 보존 검증으로 강제, 폴백 미포함 ✓

**Placeholder scan:** 모든 코드 스텝에 실제 코드·명령·기대 출력 포함. 플레이스홀더 없음.

**Type consistency:** `readShared(path string) ([]byte, error)` 시그니처가 Task 1 정의·테스트·`FindAuthContext` 호출에서 일치. `data.versions`/`avgPity5` 명칭이 기존 코드와 일치. ✓

**Test honesty:** Item 1·2 는 JSX 자동 테스트 하네스 부재로 수동 검증임을 각 태스크에 명시. Item 3 만 결정적 자동 테스트.
