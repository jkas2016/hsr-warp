# ZZZ 멀티게임 지원 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `hsr-warp.exe` 하나가 HSR과 젠레스 존 제로(ZZZ)의 가챠 기록을 모두 수집·분석·표시한다.

**Architecture:** 게임 간 차이를 `internal/game` 의 값 테이블(Go 수집 계층)과 `schedule.json` 의 `ranks`/`banners` 블록(JS 분석 계층) 두 곳에만 격리한다. 수집·저장·서빙·업데이터·대시보드 인프라는 그대로 재사용하고, 코드에 `if game == "zzz"` 분기를 흩뿌리지 않는다. 저장은 `data/hsr`·`data/zzz` 로 디렉터리만 분리하며 월별 SRGF 파일 구조 자체는 바뀌지 않는다.

**Tech Stack:** Go 1.26.4 (표준 라이브러리 only, 외부 의존성 0), 브라우저 React 18 + Babel standalone (no-build, CDN+SRI), Node 내장 `assert` 기반 평문 테스트 스크립트.

**Spec:** `docs/superpowers/specs/2026-08-14-zzz-multigame-support-design.md`

## Global Constraints

이 절의 규칙은 **모든 태스크의 요구사항에 암묵적으로 포함**된다.

- **외부 의존성 추가 금지.** `go.mod` 에 `require` 블록이 없고 `go.sum` 도 없다. testify 등 어떤 라이브러리도 추가하지 않는다. npm `dependencies`/`devDependencies` 도 추가하지 않는다.
- **ID는 거대 정수.** Go 는 `math/big`(`store.idLess`, `collector.idLessEq`), JS 는 `BigInt`. `Number`/float 비교 금지.
- **저장은 비파괴.** `WriteAffectedMonths` 는 신규 레코드가 생긴 월만 재작성한다. `TestWriteAffectedMonths_PreservesUntouchedMonths` 는 **한 줄도 수정하지 않고** 통과해야 한다.
- **분석 로직 단일 소스는 `web/analyze.js`.** `data.js` 는 출력 형태만 재구성하고 분석을 재구현하지 않는다(`web/ui_kits/dashboard/data.js:1-5` 주석이 이 규율을 명시).
- **에러 로그엔 항상 스택.** 새 로그는 `log` 가 아니라 `slog` 를 쓴다(`main.go` 의 `stackHandler` 가 ERROR 이상에 스택을 자동 첨부).
- **authkey 는 절대 로그·응답에 남기지 않는다.** 호스트·경로·region·lang·발급시각만 기록한다.
- **사용자 기록은 외부로 전송하지 않는다.** 수집·분석·저장 전부 로컬 처리.
- **Go 테스트 스타일:** 표준 `testing` 만. `t.Run` 서브테스트를 쓰지 않는다(기존 10개 테스트 파일에서 사용 0건). 테이블은 `map`/슬라이스를 `for` 로 직접 순회하고 `t.Errorf` 로 보고한다. 테스트 이름은 `TestFunc_Behavior` 형식. 각 테스트 위에 "왜 이 동작이어야 하는가"를 설명하는 한국어 주석을 단다. 패키지 내부(white-box) 테스트로 작성한다.
- **JS 테스트 스타일:** 러너 프레임워크 없음. `require('assert')` + 순차 실행되는 평문 스크립트. `describe`/`it` 금지. 섹션은 `// ---- 제목 ----` 주석으로 구분하고 파일 끝에서 `console.log('<이름> OK')`.
- **새 테스트 파일은 `package.json` 의 `test` 체인에 수동 등록해야 한다.** 자동 수집이 없다(`package.json:13` 의 `&&` 로 이어진 10개 명령).
- **`gofmt -w .` 와 `go vet ./...` 가 포맷·정적검사의 권위.** 커밋 전 실행한다.
- **Go 실행은 `node scripts/run-go.mjs <args>` 를 쓴다.** PATH 에 `go` 가 없어도 동작한다. 직접 쓰려면 `$env:Path = 'C:\Program Files\Go\bin;' + $env:Path`.
- **확률·천장·`expAvg` 수치는 추론 금지.** 전부 인게임 공시 원문 값이며 이 플랜에 명시된 값을 그대로 쓴다.

### 확정된 도메인 값 (공시 원문 + E2E 실측)

**ZZZ 배너 테이블** — `expAvg = 1 / 종합확률(general_prob_star5)`

| 채널 | `real_gacha_type` | role | `cap` | `rateUp` | `expAvg` | 종합확률 |
|---|---|---|---|---|---|---|
| 독점(에이전트) | `2` | `limited-char` | 90 | 0.5 | 62.5 | 1.600% |
| 음의 엔진 | `3` | `limited-weapon` | 80 | 0.75 | 50.0 | 2.000% |
| 상시 | `1` | `standard` | 90 | null | 62.5 | 1.600% |
| 본디 | `5` | `bangboo` | 80 | null | 50.0 | 2.000% |

**HSR 배너 테이블** (현행 `web/analyze.js:8-13` 값과 동일 — 변경 없음)

| 채널 | `gacha_type` | role | `cap` | `rateUp` | `expAvg` |
|---|---|---|---|---|---|
| 캐릭터 이벤트 | `11` | `limited-char` | 90 | 0.5 | 62.5 |
| 광추 이벤트 | `12` | `limited-weapon` | 80 | 0.75 | 53.5 |
| 스텔라(일반) | `1` | `standard` | 90 | null | 62.5 |
| 출발 워프 | `2` | `beginner` | 50 | null | null |

**랭크 코드** — HSR `{top:"5", mid:"4"}`, ZZZ `{top:"4", mid:"3"}` (ZZZ 는 B=2/A=3/S=4 체계)

**수집 계층 실측 사실**
- 응답 레코드의 `gacha_type` 은 요청한 `real_gacha_type` 과 같은 1자리 코드다. 4자리 코드는 응답에 나오지 않는다.
- **`real_gacha_type` 이 authkey URL 의 베이스 쿼리에 이미 들어 있다.** `pageKeys` 에 추가하지 않으면 파라미터가 중복되고 서버가 앞의 값을 채택해 4채널이 전부 같은 데이터를 반환한다.
- ZZZ 응답의 `gacha_id` 는 전 레코드 `"0"` 이다. 배너 인스턴스 식별에 쓸 수 없다.
- API 응답의 `name`·`item_type` 은 authkey 의 `lang` 을 따라 현지화되어 온다.

---

## 파일 구조

**신규**
| 경로 | 책임 |
|---|---|
| `internal/game/game.go` | 게임 어댑터 값 테이블. `Game`/`Banner` 타입, `ByID`, `All`, `Default` |
| `internal/game/game_test.go` | 값 테이블 무결성 검증 |
| `internal/store/migrate.go` | `data/warp_*.json` → `data/hsr/` 1회 이동(멱등) |
| `internal/store/migrate_test.go` | 마이그레이션 멱등성·비파괴 검증 |
| `web/zzz/schedule.json` | ZZZ 배너 일정·`ranks`·`banners` (스크립트 생성물) |
| `scripts/extract-zzz-schedule.mjs` | `zzz_formatted.json` → `web/zzz/schedule.json` |
| `scripts/extract-zzz-schedule.test.mjs` | 고정 픽스처 → 기대 출력 검증 |
| `web/analyze.zzz.test.js` | ZZZ 분석 회귀 테스트 |

**수정**
| 경로 | 변경 요지 |
|---|---|
| `internal/collector/cache.go` | `FindAuthContext(gamePath, g)`, `pageKeys` 에 `real_gacha_type` 추가 |
| `internal/collector/fetch.go` | `FetchIncremental(..., g, ...)`, `g.BannerParam`·`g.Banners` 로 순회 |
| `internal/store/store.go` | `MaxIDByBanner(recs, g)` 게임별 기본 키 |
| `internal/store/srgf.go` | `Info` 에 `UIGFVersion` 추가, 두 버전 필드 `omitempty` |
| `internal/server/config.go` | `Config` 게임별 스키마 + 구 스키마 승격, ZZZ 후보 경로 |
| `internal/server/server.go` | `?game=` 스코프, `/zzz/schedule.json`, `handleFetch` 게임화 |
| `internal/updater/updater.go` | `EffectiveSchedule(dataDir, embedded, gameID)` |
| `web/analyze.js` | `ranks`/`banners` 주입, role 기반 일반화, `62.5` 매직넘버 제거 |
| `web/schedule.json` | `ranks`·`banners` 블록 추가, `version` 증가 |
| `web/ui_kits/dashboard/data.js` | 게임 스코프, role 기반 제외 필터 |
| `web/ui_kits/dashboard/Dashboard.jsx` | 게임 스위처, 제목 동적화 |
| `web/ui_kits/dashboard/i18n.js` | `BANNER_CODE` 에 ZZZ 배너 추가 |
| `web/ui_kits/dashboard/i18n/{ko,en,zh,ja}.js` | ZZZ 용어 키 추가 |
| `web/ui_kits/dashboard/nohardcode.test.js` | `ALLOW` 에 ZZZ 배너 `short` 추가 |
| `package.json` | 새 테스트 등록, `schedule:status` 두 게임 보고 |

---

### Task 1: 게임 어댑터 값 테이블 (`internal/game`)

게임 간 차이를 담는 단일 값 테이블. 이후 모든 태스크가 이 타입을 소비한다.

**Files:**
- Create: `internal/game/game.go`
- Test: `internal/game/game_test.go`

**Interfaces:**
- Consumes: (없음 — 첫 태스크)
- Produces:
  - `type Banner struct { Code string; Role string }`
  - `type Game struct { ID, DataDirName, BannerParam, InfoFormat string; Banners []Banner; Candidates []string }`
  - `func ByID(id string) (Game, bool)`
  - `func All() []Game`
  - `func Default() Game` — `hsr` 를 반환 (게임 미지정 시 폴백)
  - `func (g Game) Codes() []string` — `Banners` 의 `Code` 만 순서대로
  - `func (g Game) RoleOf(code string) string` — 배너 코드의 역할 (없으면 빈 문자열)
  - 역할 상수: `RoleLimitedChar`, `RoleLimitedWeapon`, `RoleStandard`, `RoleBeginner`, `RoleBangboo`

- [ ] **Step 1: 실패하는 테스트를 작성한다**

`internal/game/game_test.go`:

```go
package game

import "testing"

// 게임 ID 로 조회한 결과가 값 테이블과 일치해야 한다. 수집 계층이 이 값에
// 전적으로 의존하므로 오타 하나가 조용히 잘못된 캐시 경로/쿼리를 만든다.
func TestByID_ReturnsExpectedTable(t *testing.T) {
	hsr, ok := ByID("hsr")
	if !ok {
		t.Fatal("hsr 를 찾지 못했다")
	}
	if hsr.DataDirName != "StarRail_Data" {
		t.Errorf("hsr DataDirName = %q, want StarRail_Data", hsr.DataDirName)
	}
	if hsr.BannerParam != "gacha_type" {
		t.Errorf("hsr BannerParam = %q, want gacha_type", hsr.BannerParam)
	}
	if hsr.InfoFormat != "srgf-v1.0" {
		t.Errorf("hsr InfoFormat = %q, want srgf-v1.0", hsr.InfoFormat)
	}

	zzz, ok := ByID("zzz")
	if !ok {
		t.Fatal("zzz 를 찾지 못했다")
	}
	if zzz.DataDirName != "ZenlessZoneZero_Data" {
		t.Errorf("zzz DataDirName = %q, want ZenlessZoneZero_Data", zzz.DataDirName)
	}
	// 실측: ZZZ 는 gacha_type 이 아니라 real_gacha_type 으로 채널을 지정한다.
	if zzz.BannerParam != "real_gacha_type" {
		t.Errorf("zzz BannerParam = %q, want real_gacha_type", zzz.BannerParam)
	}
	if zzz.InfoFormat != "uigf-v4.0" {
		t.Errorf("zzz InfoFormat = %q, want uigf-v4.0", zzz.InfoFormat)
	}
}

// 알 수 없는 게임 ID 는 조용히 폴백하지 않고 ok=false 여야 한다.
// 서버가 이 값으로 400 을 내려 오타를 즉시 드러낸다.
func TestByID_UnknownIsNotOK(t *testing.T) {
	if _, ok := ByID("genshin"); ok {
		t.Error("genshin 은 아직 지원하지 않는데 ok=true 였다")
	}
	if _, ok := ByID(""); ok {
		t.Error("빈 ID 가 ok=true 였다")
	}
}

// 미지정 시 폴백은 hsr 이다(기존 사용자 동작 보존).
func TestDefault_IsHSR(t *testing.T) {
	if Default().ID != "hsr" {
		t.Errorf("Default().ID = %q, want hsr", Default().ID)
	}
}

// 모든 게임의 배너가 정의된 역할만 쓰고, 코드가 게임 안에서 유일해야 한다.
// 중복 코드는 수집 루프가 같은 채널을 두 번 도는 버그가 된다.
func TestAll_BannersUseKnownRolesAndUniqueCodes(t *testing.T) {
	known := map[string]bool{
		RoleLimitedChar: true, RoleLimitedWeapon: true,
		RoleStandard: true, RoleBeginner: true, RoleBangboo: true,
	}
	for _, g := range All() {
		if len(g.Banners) == 0 {
			t.Errorf("%s: 배너가 비었다", g.ID)
		}
		seen := map[string]bool{}
		for _, b := range g.Banners {
			if !known[b.Role] {
				t.Errorf("%s: 알 수 없는 역할 %q (code=%s)", g.ID, b.Role, b.Code)
			}
			if seen[b.Code] {
				t.Errorf("%s: 배너 코드 %q 가 중복됐다", g.ID, b.Code)
			}
			seen[b.Code] = true
		}
	}
}

// 배너 코드 목록과 순서는 수집 순서이자 저장 키다. 실측으로 확정한 값에서
// 벗어나면 API 가 빈 응답을 주거나 채널이 뒤섞인다.
func TestCodes_MatchesVerifiedValues(t *testing.T) {
	want := map[string][]string{
		"hsr": {"11", "12", "1", "2"},
		"zzz": {"2", "3", "1", "5"},
	}
	for id, exp := range want {
		g, ok := ByID(id)
		if !ok {
			t.Fatalf("%s 를 찾지 못했다", id)
		}
		got := g.Codes()
		if len(got) != len(exp) {
			t.Errorf("%s: Codes() = %v, want %v", id, got, exp)
			continue
		}
		for i := range exp {
			if got[i] != exp[i] {
				t.Errorf("%s: Codes()[%d] = %q, want %q", id, i, got[i], exp[i])
			}
		}
	}
}

// 자동탐지 후보가 비어 있으면 사용자가 매번 경로를 손으로 넣어야 한다.
func TestAll_HaveCandidates(t *testing.T) {
	for _, g := range All() {
		if len(g.Candidates) == 0 {
			t.Errorf("%s: 설치 경로 후보가 비었다", g.ID)
		}
	}
}

// All() 이 내부 슬라이스를 그대로 노출하면 호출자가 값 테이블을 오염시킬 수 있다.
func TestAll_ReturnsCopy(t *testing.T) {
	a := All()
	if len(a) == 0 {
		t.Fatal("All() 이 비었다")
	}
	a[0].ID = "tampered"
	if All()[0].ID == "tampered" {
		t.Error("All() 이 내부 상태를 노출한다")
	}
}
```

- [ ] **Step 2: 실패를 확인한다**

Run: `node scripts/run-go.mjs test ./internal/game/`
Expected: FAIL — `no Go files in ...\internal\game` 또는 `undefined: ByID`

- [ ] **Step 3: 최소 구현을 작성한다**

`internal/game/game.go`:

```go
// Package game 은 지원 게임 간의 차이를 값 테이블 하나로 격리한다.
// 수집 계층이 필요로 하는 것(캐시 디렉터리명, 배너 쿼리 파라미터, 채널 코드와
// 순서)만 담는다. 천장·픽업 확률·표시 이름 같은 분석용 값은 여기 두지 않고
// web/schedule.json 의 banners 블록에 둔다(분석 로직 단일 소스 원칙).
package game

// 배너 역할. 게임마다 채널 코드는 다르지만 역할은 공통이라, 분석·표시 계층은
// 코드가 아니라 역할로 분기한다.
const (
	RoleLimitedChar   = "limited-char"   // 한정 캐릭터/에이전트
	RoleLimitedWeapon = "limited-weapon" // 한정 광추/음의 엔진
	RoleStandard      = "standard"       // 상시
	RoleBeginner      = "beginner"       // 초보자 전용(HSR 출발 워프)
	RoleBangboo       = "bangboo"        // ZZZ 본디
)

// Banner 는 한 게임의 가챠 채널 하나다.
type Banner struct {
	Code string // API 가 쓰는 채널 코드(HSR gacha_type / ZZZ real_gacha_type)
	Role string // 위 Role* 상수 중 하나
}

// Game 은 게임 하나의 수집 파라미터다.
type Game struct {
	ID          string   // "hsr" | "zzz"
	DataDirName string   // 게임 설치 폴더 아래 캐시 루트 디렉터리명
	BannerParam string   // 채널을 지정하는 쿼리 파라미터 이름
	InfoFormat  string   // 저장 파일 info 블록 규격
	Banners     []Banner // 조회 순서 = 슬라이스 순서
	Candidates  []string // 설치 경로 자동탐지 후보
}

// Codes 는 배너 코드를 정의 순서대로 반환한다.
func (g Game) Codes() []string {
	out := make([]string, len(g.Banners))
	for i, b := range g.Banners {
		out[i] = b.Code
	}
	return out
}

// RoleOf 는 배너 코드의 역할을 반환한다(없으면 빈 문자열).
func (g Game) RoleOf(code string) string {
	for _, b := range g.Banners {
		if b.Code == code {
			return b.Role
		}
	}
	return ""
}

var games = []Game{
	{
		ID:          "hsr",
		DataDirName: "StarRail_Data",
		BannerParam: "gacha_type",
		InfoFormat:  "srgf-v1.0",
		Banners: []Banner{
			{Code: "11", Role: RoleLimitedChar},
			{Code: "12", Role: RoleLimitedWeapon},
			{Code: "1", Role: RoleStandard},
			{Code: "2", Role: RoleBeginner},
		},
		Candidates: []string{
			`D:\Game\HoYoPlay\games\Star Rail Games`,
			`C:\Program Files\HoYoPlay\games\Star Rail Games`,
			`D:\Program Files\HoYoPlay\games\Star Rail Games`,
			`C:\Games\HoYoPlay\games\Star Rail Games`,
			`C:\Program Files\Star Rail\Games`,
		},
	},
	{
		ID:          "zzz",
		DataDirName: "ZenlessZoneZero_Data",
		BannerParam: "real_gacha_type",
		InfoFormat:  "uigf-v4.0",
		// 실측으로 확정한 채널 코드. 응답 레코드의 gacha_type 도 같은 1자리 값이다.
		Banners: []Banner{
			{Code: "2", Role: RoleLimitedChar},   // 독점(에이전트)
			{Code: "3", Role: RoleLimitedWeapon}, // 음의 엔진
			{Code: "1", Role: RoleStandard},      // 상시
			{Code: "5", Role: RoleBangboo},       // 본디
		},
		Candidates: []string{
			`D:\Game\HoYoPlay\games\ZenlessZoneZero Game`,
			`C:\Program Files\HoYoPlay\games\ZenlessZoneZero Game`,
			`D:\Program Files\HoYoPlay\games\ZenlessZoneZero Game`,
			`C:\Games\HoYoPlay\games\ZenlessZoneZero Game`,
		},
	},
}

// ByID 는 게임 ID 로 값 테이블을 찾는다. 알 수 없는 ID 는 폴백하지 않고
// ok=false 를 준다 — 서버가 400 으로 오타를 즉시 드러내기 위함이다.
func ByID(id string) (Game, bool) {
	for _, g := range games {
		if g.ID == id {
			return g, true
		}
	}
	return Game{}, false
}

// Default 는 게임 미지정 시 쓰는 게임이다. 기존 사용자 동작을 보존한다.
func Default() Game {
	g, _ := ByID("hsr")
	return g
}

// All 은 지원 게임 목록의 복사본을 반환한다.
func All() []Game {
	out := make([]Game, len(games))
	copy(out, games)
	return out
}
```

- [ ] **Step 4: 테스트 통과를 확인한다**

Run: `node scripts/run-go.mjs test ./internal/game/ -v`
Expected: PASS — 7개 테스트 전부

- [ ] **Step 5: 커밋한다**

```bash
node scripts/run-go.mjs vet ./internal/game/
gofmt -w internal/game/
git add internal/game/
git commit -m "feat(game): 게임 어댑터 값 테이블 신설"
```

---

### Task 2: collector 게임 주입 + `real_gacha_type` 중복 제거

수집 계층이 `game.Game` 을 받아 캐시 경로와 배너 쿼리를 게임별로 조립한다.

**Files:**
- Modify: `internal/collector/cache.go:30-33` (pageKeys), `:167` (FindAuthContext)
- Modify: `internal/collector/fetch.go:19-20` (bannerOrder/bannerName), `:87` (FetchIncremental), `:91` (순회), `:104` (URL 조립)
- Test: `internal/collector/cache_test.go`, `internal/collector/fetch_test.go` (기존 파일에 추가)

**Interfaces:**
- Consumes: `game.Game`, `game.ByID`, `game.Game.Codes()`, `game.Game.RoleOf()`, `game.Role*` 상수 (Task 1)
- Produces:
  - `func FindAuthContext(gamePath string, g game.Game) (*AuthContext, error)`
  - `func FetchIncremental(ctx context.Context, ac *AuthContext, g game.Game, lastID map[string]string, delay time.Duration, onProgress func(banner string, added int)) ([]store.Record, string, error)`
  - `func BannerLabel(g game.Game, code string) string` — 로그·SSE progress 용 표시명

- [ ] **Step 1: 실패하는 테스트를 작성한다**

`internal/collector/cache_test.go` 끝에 추가:

```go
// ZZZ 는 캐시 루트 디렉터리 이름이 다르다. 게임 값 테이블의 DataDirName 을
// 실제로 쓰는지 확인한다 — 하드코딩된 StarRail_Data 가 남아 있으면 실패한다.
func TestFindAuthContext_UsesGameDataDirName(t *testing.T) {
	root := t.TempDir()
	// ZZZ 캐시 구조만 만들고 HSR 구조는 만들지 않는다.
	dir := filepath.Join(root, "ZenlessZoneZero_Data", "webCaches", "2.51.0.0", "Cache", "Cache_Data")
	if err := os.MkdirAll(dir, 0755); err != nil {
		t.Fatal(err)
	}
	raw := "https://public-operation-common-sg.hoyoverse.com/common/gacha_record/api/getGachaLog" +
		"?authkey=AAA&region=prod_gf_jp&lang=ko&real_gacha_type=2&timestamp=1700000000"
	if err := os.WriteFile(filepath.Join(dir, "data_2"), []byte(raw), 0644); err != nil {
		t.Fatal(err)
	}

	zzz, _ := game.ByID("zzz")
	ac, err := FindAuthContext(root, zzz)
	if err != nil {
		t.Fatalf("ZZZ 캐시를 찾지 못했다: %v", err)
	}
	if ac.Region != "prod_gf_jp" || ac.Lang != "ko" {
		t.Errorf("region/lang = %q/%q, want prod_gf_jp/ko", ac.Region, ac.Lang)
	}

	// 같은 루트를 HSR 로 보면 StarRail_Data 가 없으므로 실패해야 한다.
	hsr, _ := game.ByID("hsr")
	if _, err := FindAuthContext(root, hsr); err == nil {
		t.Error("HSR 캐시가 없는데 성공했다")
	}
}

// 실측: authkey URL 의 베이스 쿼리에 real_gacha_type 이 이미 들어 있다.
// pageKeys 로 제거하지 않으면 페이지 조립 시 파라미터가 중복되고 서버가 앞의
// 값을 채택해 4개 채널이 전부 같은 데이터를 반환한다.
func TestParseAuthURL_StripsRealGachaType(t *testing.T) {
	raw := "https://h/common/gacha_record/api/getGachaLog" +
		"?authkey=AAA&region=prod_gf_jp&lang=ko&real_gacha_type=2&size=20&timestamp=1700000000"
	ac, err := parseAuthURL([]byte(raw))
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(ac.BaseQuery, "real_gacha_type") {
		t.Errorf("BaseQuery 에 real_gacha_type 이 남았다: %q", ac.BaseQuery)
	}
	// 다른 파라미터는 보존돼야 한다.
	if !strings.Contains(ac.BaseQuery, "authkey=AAA") || !strings.Contains(ac.BaseQuery, "lang=ko") {
		t.Errorf("필요한 쿼리가 사라졌다: %q", ac.BaseQuery)
	}
}
```

`internal/collector/cache_test.go` 의 import 에 `"hsr-warp/internal/game"` 을 추가한다(`os`, `path/filepath`, `strings` 는 이미 있으면 그대로).

`internal/collector/fetch_test.go` 끝에 추가:

```go
// ZZZ 는 real_gacha_type 으로 채널을 지정한다. 조립된 요청 URL 에 이 파라미터가
// 정확히 한 번만, 우리가 지정한 값으로 나타나야 한다. 중복되면 서버가 앞의 값을
// 채택해 모든 채널이 같은 데이터를 반환하는 조용한 버그가 된다.
func TestFetchIncremental_ZZZUsesRealGachaTypeExactlyOnce(t *testing.T) {
	var got []string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got = append(got, r.URL.RawQuery)
		_, _ = w.Write([]byte(`{"retcode":0,"message":"OK","data":{"list":[]}}`))
	}))
	defer srv.Close()

	zzz, _ := game.ByID("zzz")
	ac := &AuthContext{
		APIBase:   srv.URL,
		BaseQuery: "authkey=AAA&lang=ko", // pageKeys 가 real_gacha_type 을 이미 제거한 상태
		Region:    "prod_gf_jp",
		Lang:      "ko",
	}
	if _, _, err := FetchIncremental(context.Background(), ac, zzz, nil, 0, nil); err != nil {
		t.Fatal(err)
	}

	if len(got) != len(zzz.Banners) {
		t.Fatalf("요청 수 = %d, want %d", len(got), len(zzz.Banners))
	}
	wantCodes := zzz.Codes()
	for i, q := range got {
		if strings.Count(q, "real_gacha_type=") != 1 {
			t.Errorf("요청 %d: real_gacha_type 이 %d번 나타났다: %q", i, strings.Count(q, "real_gacha_type="), q)
		}
		if strings.Contains(q, "gacha_type=") && !strings.Contains(q, "real_gacha_type=") {
			t.Errorf("요청 %d: ZZZ 인데 gacha_type 을 썼다: %q", i, q)
		}
		if !strings.Contains(q, "real_gacha_type="+wantCodes[i]) {
			t.Errorf("요청 %d: 채널 %q 를 기대했으나 %q", i, wantCodes[i], q)
		}
	}
}

// HSR 은 기존대로 gacha_type 을 쓰고 채널 순서도 그대로여야 한다(회귀 방지).
func TestFetchIncremental_HSRKeepsGachaType(t *testing.T) {
	var got []string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got = append(got, r.URL.RawQuery)
		_, _ = w.Write([]byte(`{"retcode":0,"message":"OK","data":{"list":[]}}`))
	}))
	defer srv.Close()

	hsr, _ := game.ByID("hsr")
	ac := &AuthContext{APIBase: srv.URL, BaseQuery: "authkey=AAA", Region: "asia", Lang: "ko"}
	if _, _, err := FetchIncremental(context.Background(), ac, hsr, nil, 0, nil); err != nil {
		t.Fatal(err)
	}

	want := []string{"11", "12", "1", "2"}
	if len(got) != len(want) {
		t.Fatalf("요청 수 = %d, want %d", len(got), len(want))
	}
	for i, q := range got {
		if strings.Contains(q, "real_gacha_type=") {
			t.Errorf("요청 %d: HSR 인데 real_gacha_type 을 썼다: %q", i, q)
		}
		if !strings.Contains(q, "gacha_type="+want[i]) {
			t.Errorf("요청 %d: gacha_type=%s 를 기대했으나 %q", i, want[i], q)
		}
	}
}

// 배너 표시명은 역할에서 유도한다. 게임마다 코드가 달라도 진행 로그가 읽혀야 한다.
func TestBannerLabel_DerivesFromRole(t *testing.T) {
	zzz, _ := game.ByID("zzz")
	if got := BannerLabel(zzz, "2"); got == "" || got == "2" {
		t.Errorf("ZZZ 코드 2 의 표시명이 유도되지 않았다: %q", got)
	}
	hsr, _ := game.ByID("hsr")
	if got := BannerLabel(hsr, "11"); got == "" || got == "11" {
		t.Errorf("HSR 코드 11 의 표시명이 유도되지 않았다: %q", got)
	}
	// 모르는 코드는 코드 자체로 폴백한다(로그가 비지 않게).
	if got := BannerLabel(hsr, "99"); got != "99" {
		t.Errorf("알 수 없는 코드 폴백 = %q, want 99", got)
	}
}
```

`internal/collector/fetch_test.go` 의 import 에 `"hsr-warp/internal/game"` 과 `"strings"` 를 추가한다(없다면).

- [ ] **Step 2: 실패를 확인한다**

Run: `node scripts/run-go.mjs test ./internal/collector/`
Expected: FAIL — `too many arguments in call to FindAuthContext`, `undefined: BannerLabel`

- [ ] **Step 3: 구현한다**

`internal/collector/cache.go` — `pageKeys` 에 `real_gacha_type` 추가:

```go
// 페이지네이션 시 우리가 직접 지정하므로 베이스 쿼리에서 제거할 키.
// real_gacha_type(ZZZ)은 authkey URL 에 이미 들어 있어, 제거하지 않으면 조립 시
// 중복되고 서버가 앞의 값을 채택해 모든 채널이 같은 데이터를 반환한다(실측).
var pageKeys = map[string]bool{
	"page": true, "size": true, "gacha_type": true, "real_gacha_type": true,
	"end_id": true, "begin_id": true, "default_gacha_type": true, "gacha_id": true,
}
```

`internal/collector/cache.go:167` — 시그니처와 경로 조립만 바꾼다. 나머지 본문(버전 디렉터리 선택, `readShared`, `parseAuthURL`)은 그대로 둔다:

```go
func FindAuthContext(gamePath string, g game.Game) (*AuthContext, error) {
	webCaches := filepath.Join(gamePath, g.DataDirName, "webCaches")
```

import 에 `"hsr-warp/internal/game"` 을 추가한다.

`internal/collector/fetch.go:19-20` — 고정 테이블을 역할 기반 표시명으로 교체:

```go
// 배너 표시명은 로그·SSE progress 용이다. 게임마다 채널 코드가 다르므로
// 코드가 아니라 역할에서 유도한다.
var roleName = map[string]string{
	game.RoleLimitedChar:   "캐릭터",
	game.RoleLimitedWeapon: "무기",
	game.RoleStandard:      "일반",
	game.RoleBeginner:      "출발",
	game.RoleBangboo:       "본디",
}

// BannerLabel 은 배너 코드의 사람이 읽는 이름을 반환한다.
// 알 수 없는 코드는 코드 자체로 폴백해 로그가 비지 않게 한다.
func BannerLabel(g game.Game, code string) string {
	if n, ok := roleName[g.RoleOf(code)]; ok {
		return n
	}
	return code
}
```

`internal/collector/fetch.go:87` — 시그니처에 `g game.Game` 추가:

```go
func FetchIncremental(ctx context.Context, ac *AuthContext, g game.Game, lastID map[string]string, delay time.Duration, onProgress func(banner string, added int)) ([]store.Record, string, error) {
```

`:91` 의 순회를 `for _, gt := range g.Codes() {` 로, `:104` 의 URL 조립을 게임별 파라미터로 바꾼다:

```go
		url := fmt.Sprintf("%s?%s&size=20&%s=%s&page=%d&end_id=%s",
			ac.APIBase, ac.BaseQuery, g.BannerParam, gt, page, endID)
```

`:166` 의 진행 콜백을 `onProgress(BannerLabel(g, gt), added)` 로 바꾼다. `bannerOrder`/`bannerName` 은 삭제한다(내 변경이 만든 orphan). `-101`/`-110` retcode 처리, `maxPagesPerBanner`, `end_id` 진전 없음 백스톱은 **손대지 않는다**.

- [ ] **Step 4: 테스트 통과를 확인한다**

Run: `node scripts/run-go.mjs test ./internal/collector/ -v`
Expected: PASS — 기존 테스트 전부 + 신규 5개. 이 시점에 `internal/server` 는 아직 컴파일되지 않는다(Task 6에서 고친다).

- [ ] **Step 5: 커밋한다**

```bash
gofmt -w internal/collector/
git add internal/collector/
git commit -m "feat(collector): 게임 어댑터 주입, real_gacha_type 중복 제거"
```

---

### Task 3: store 게임별 격리 + UIGF `info`

저장 구조는 바꾸지 않고 `dir` 과 `info` 만 게임별로 가른다.

**Files:**
- Modify: `internal/store/srgf.go:7-16` (Info)
- Modify: `internal/store/store.go:138` (MaxIDByBanner)
- Test: `internal/store/store_test.go` (기존 파일에 추가)

**Interfaces:**
- Consumes: `game.Game`, `game.Game.Codes()` (Task 1)
- Produces:
  - `Info` 에 `UIGFVersion string \`json:"uigf_version,omitempty"\`` 추가, `SRGFVersion` 에 `omitempty` 부여
  - `func MaxIDByBanner(recs []Record, g game.Game) map[string]string`

- [ ] **Step 1: 실패하는 테스트를 작성한다**

`internal/store/store_test.go` 끝에 추가:

```go
// 게임별 디렉터리는 서로를 침범하지 않아야 한다. 구조는 그대로고 dir 만
// 다르므로, 같은 월 파일명이 양쪽에 생겨도 내용이 섞이면 안 된다.
func TestWriteAffectedMonths_IsolatesGames(t *testing.T) {
	root := t.TempDir()
	hsrDir := filepath.Join(root, "hsr")
	zzzDir := filepath.Join(root, "zzz")

	hsrRec := []Record{{ID: "100", GachaType: "11", Time: "2026-08-01 10:00:00", ItemID: "1102", RankType: "5"}}
	zzzRec := []Record{{ID: "200", GachaType: "2", Time: "2026-08-01 10:00:00", ItemID: "1191", RankType: "4"}}

	if _, err := WriteAffectedMonths(hsrDir, Info{UID: "1"}, hsrRec); err != nil {
		t.Fatal(err)
	}
	if _, err := WriteAffectedMonths(zzzDir, Info{UID: "2"}, zzzRec); err != nil {
		t.Fatal(err)
	}

	h, hi, err := LoadAll(hsrDir)
	if err != nil {
		t.Fatal(err)
	}
	z, zi, err := LoadAll(zzzDir)
	if err != nil {
		t.Fatal(err)
	}
	if len(h) != 1 || h[0].ID != "100" {
		t.Errorf("hsr 레코드 = %+v, want ID 100 하나", h)
	}
	if len(z) != 1 || z[0].ID != "200" {
		t.Errorf("zzz 레코드 = %+v, want ID 200 하나", z)
	}
	if hi == nil || hi.UID != "1" || zi == nil || zi.UID != "2" {
		t.Error("info 가 게임 간에 섞였다")
	}
}

// 증분 조회의 시작점은 게임의 배너 코드마다 있어야 한다. HSR 코드가 ZZZ 조회에
// 쓰이면 모든 채널이 처음부터 다시 긁힌다.
func TestMaxIDByBanner_UsesGameCodes(t *testing.T) {
	zzz, _ := game.ByID("zzz")
	got := MaxIDByBanner(nil, zzz)
	for _, c := range zzz.Codes() {
		if got[c] != "0" {
			t.Errorf("zzz 코드 %q 기본값 = %q, want 0", c, got[c])
		}
	}
	if _, ok := got["11"]; ok {
		t.Error("zzz 결과에 HSR 코드 11 이 들어 있다")
	}

	hsr, _ := game.ByID("hsr")
	recs := []Record{
		{ID: "500", GachaType: "11"},
		{ID: "400", GachaType: "11"},
		{ID: "700", GachaType: "12"},
	}
	h := MaxIDByBanner(recs, hsr)
	if h["11"] != "500" {
		t.Errorf("hsr 11 최대 ID = %q, want 500", h["11"])
	}
	if h["12"] != "700" {
		t.Errorf("hsr 12 최대 ID = %q, want 700", h["12"])
	}
	if h["1"] != "0" || h["2"] != "0" {
		t.Errorf("레코드 없는 채널 기본값이 0 이 아니다: %+v", h)
	}
}

// 한 Info 구조체가 두 규격을 표현한다. 쓰지 않는 버전 필드는 JSON 에서
// 빠져야 규격 검증기가 통과한다.
func TestInfo_VersionFieldsAreExclusive(t *testing.T) {
	srgf, err := json.Marshal(Info{UID: "1", SRGFVersion: "v1.0"})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(srgf), `"srgf_version":"v1.0"`) {
		t.Errorf("srgf_version 이 빠졌다: %s", srgf)
	}
	if strings.Contains(string(srgf), "uigf_version") {
		t.Errorf("HSR info 에 uigf_version 이 들어갔다: %s", srgf)
	}

	uigf, err := json.Marshal(Info{UID: "2", UIGFVersion: "v4.0"})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(uigf), `"uigf_version":"v4.0"`) {
		t.Errorf("uigf_version 이 빠졌다: %s", uigf)
	}
	if strings.Contains(string(uigf), "srgf_version") {
		t.Errorf("ZZZ info 에 srgf_version 이 들어갔다: %s", uigf)
	}
}
```

import 에 `"encoding/json"`, `"strings"`, `"hsr-warp/internal/game"` 을 추가한다(없다면).

- [ ] **Step 2: 실패를 확인한다**

Run: `node scripts/run-go.mjs test ./internal/store/`
Expected: FAIL — `too many arguments in call to MaxIDByBanner`, `unknown field UIGFVersion`

- [ ] **Step 3: 구현한다**

`internal/store/srgf.go:7-16`:

```go
// Info 는 저장 파일의 메타 블록이다. HSR 은 SRGF v1.0, ZZZ 는 UIGF v4.0 을
// 쓰므로 버전 필드를 둘 다 두고 omitempty 로 쓰지 않는 쪽을 뺀다.
type Info struct {
	UID              string `json:"uid"`
	Lang             string `json:"lang"`
	Region           string `json:"region"`
	RegionTimeZone   int    `json:"region_time_zone"`
	ExportTimestamp  int64  `json:"export_timestamp"`
	ExportApp        string `json:"export_app"`
	ExportAppVersion string `json:"export_app_version"`
	SRGFVersion      string `json:"srgf_version,omitempty"`
	UIGFVersion      string `json:"uigf_version,omitempty"`
}
```

`internal/store/store.go:138` — 기본 키를 게임에서 받는다:

```go
// MaxIDByBanner 는 배너별로 이미 저장된 최대 ID 를 반환한다. 증분 조회의
// 시작점이므로 게임의 모든 배너 코드가 키로 존재해야 한다.
func MaxIDByBanner(recs []Record, g game.Game) map[string]string {
	out := map[string]string{}
	for _, c := range g.Codes() {
		out[c] = "0"
	}
	// 이하 기존 최대값 갱신 로직은 그대로.
```

import 에 `"hsr-warp/internal/game"` 을 추가한다. `LoadAll`/`WriteAffectedMonths` 는 **시그니처도 본문도 바꾸지 않는다** — 이미 `dir` 을 인자로 받는다.

- [ ] **Step 4: 테스트 통과를 확인한다**

Run: `node scripts/run-go.mjs test ./internal/store/ -v`
Expected: PASS. **특히 `TestWriteAffectedMonths_PreservesUntouchedMonths` 가 무수정으로 통과해야 한다** — 실패하면 비파괴 불변식이 깨진 것이므로 즉시 되돌린다.

- [ ] **Step 5: 커밋한다**

```bash
gofmt -w internal/store/
git add internal/store/
git commit -m "feat(store): 게임별 저장 격리와 UIGF info 필드"
```

---

### Task 4: 데이터 마이그레이션 (`data/warp_*.json` → `data/hsr/`)

기존 사용자의 기록을 게임별 디렉터리로 1회 이동한다. 멱등이어야 하고 실패해도 앱이 죽으면 안 된다.

**Files:**
- Create: `internal/store/migrate.go`
- Test: `internal/store/migrate_test.go`

**Interfaces:**
- Consumes: (없음 — 표준 라이브러리만)
- Produces: `func MigrateLegacyLayout(dataDir string) (moved int, err error)` — `dataDir` 은 `data/` 루트. 이동한 파일 수를 반환한다.

- [ ] **Step 1: 실패하는 테스트를 작성한다**

`internal/store/migrate_test.go`:

```go
package store

import (
	"os"
	"path/filepath"
	"testing"
)

// 구버전 레이아웃(data/warp_*.json)은 data/hsr/ 로 옮겨져야 한다.
// 내용은 그대로여야 하고 원본은 남지 않아야 한다.
func TestMigrateLegacyLayout_MovesFiles(t *testing.T) {
	dir := t.TempDir()
	body := []byte(`{"info":{"uid":"1"},"list":[]}`)
	if err := os.WriteFile(filepath.Join(dir, "warp_202607.json"), body, 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "warp_202608.json"), body, 0644); err != nil {
		t.Fatal(err)
	}

	n, err := MigrateLegacyLayout(dir)
	if err != nil {
		t.Fatal(err)
	}
	if n != 2 {
		t.Errorf("이동 수 = %d, want 2", n)
	}
	got, err := os.ReadFile(filepath.Join(dir, "hsr", "warp_202607.json"))
	if err != nil {
		t.Fatalf("옮겨진 파일을 읽지 못했다: %v", err)
	}
	if string(got) != string(body) {
		t.Errorf("내용이 바뀌었다: %s", got)
	}
	if _, err := os.Stat(filepath.Join(dir, "warp_202607.json")); !os.IsNotExist(err) {
		t.Error("원본이 남아 있다")
	}
}

// 두 번 돌려도 결과가 같아야 한다. 매 실행마다 호출되므로 멱등이 아니면
// 이미 옮긴 파일을 덮어쓰거나 에러로 앱을 멈출 수 있다.
func TestMigrateLegacyLayout_IsIdempotent(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "warp_202607.json"), []byte(`{}`), 0644); err != nil {
		t.Fatal(err)
	}
	if _, err := MigrateLegacyLayout(dir); err != nil {
		t.Fatal(err)
	}
	n, err := MigrateLegacyLayout(dir)
	if err != nil {
		t.Fatalf("두 번째 실행이 실패했다: %v", err)
	}
	if n != 0 {
		t.Errorf("두 번째 실행 이동 수 = %d, want 0", n)
	}
}

// 이미 data/hsr/ 에 같은 이름이 있으면 덮어쓰지 않는다. 신규 레이아웃 쪽이
// 최신이므로 구파일로 덮으면 데이터가 사라진다.
func TestMigrateLegacyLayout_DoesNotOverwrite(t *testing.T) {
	dir := t.TempDir()
	if err := os.MkdirAll(filepath.Join(dir, "hsr"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "hsr", "warp_202607.json"), []byte(`NEW`), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "warp_202607.json"), []byte(`OLD`), 0644); err != nil {
		t.Fatal(err)
	}

	if _, err := MigrateLegacyLayout(dir); err != nil {
		t.Fatal(err)
	}
	got, err := os.ReadFile(filepath.Join(dir, "hsr", "warp_202607.json"))
	if err != nil {
		t.Fatal(err)
	}
	if string(got) != "NEW" {
		t.Errorf("신규 파일이 덮어써졌다: %s", got)
	}
}

// 새로 설치한 사용자에겐 아무 일도 일어나지 않아야 한다.
func TestMigrateLegacyLayout_NoopOnFreshInstall(t *testing.T) {
	dir := t.TempDir()
	n, err := MigrateLegacyLayout(dir)
	if err != nil {
		t.Fatalf("빈 디렉터리에서 실패했다: %v", err)
	}
	if n != 0 {
		t.Errorf("이동 수 = %d, want 0", n)
	}
	// 옮길 게 없으면 hsr 디렉터리를 만들지 않는다.
	if _, err := os.Stat(filepath.Join(dir, "hsr")); !os.IsNotExist(err) {
		t.Error("옮길 파일이 없는데 hsr 디렉터리를 만들었다")
	}
}

// data 디렉터리 자체가 없어도 에러가 아니다(첫 실행).
func TestMigrateLegacyLayout_MissingDirIsNotError(t *testing.T) {
	n, err := MigrateLegacyLayout(filepath.Join(t.TempDir(), "nope"))
	if err != nil {
		t.Errorf("없는 디렉터리에서 에러가 났다: %v", err)
	}
	if n != 0 {
		t.Errorf("이동 수 = %d, want 0", n)
	}
}

// schedule.json 같은 비-기록 파일은 건드리지 않는다. updater 가 data 루트에
// 이 파일을 쓰기 때문에 옮기면 override 가 사라진다.
func TestMigrateLegacyLayout_LeavesNonRecordFiles(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "schedule.json"), []byte(`{}`), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "warp_202607.json"), []byte(`{}`), 0644); err != nil {
		t.Fatal(err)
	}
	if _, err := MigrateLegacyLayout(dir); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(dir, "schedule.json")); err != nil {
		t.Error("schedule.json 이 옮겨졌다")
	}
}
```

- [ ] **Step 2: 실패를 확인한다**

Run: `node scripts/run-go.mjs test ./internal/store/ -run TestMigrateLegacyLayout`
Expected: FAIL — `undefined: MigrateLegacyLayout`

- [ ] **Step 3: 구현한다**

`internal/store/migrate.go`:

```go
package store

import (
	"log/slog"
	"os"
	"path/filepath"
)

// MigrateLegacyLayout 은 구버전 레이아웃(data/warp_*.json)을 게임별
// 디렉터리(data/hsr/)로 옮긴다. 멱등하며, 이미 옮겨진 상태나 새 설치에서는
// 아무 일도 하지 않는다. 대상 이름이 이미 있으면 덮어쓰지 않고 건너뛴다 —
// 신규 레이아웃 쪽이 최신이기 때문이다.
func MigrateLegacyLayout(dataDir string) (int, error) {
	old, err := filepath.Glob(filepath.Join(dataDir, "warp_*.json"))
	if err != nil {
		return 0, err
	}
	if len(old) == 0 {
		return 0, nil
	}
	dst := filepath.Join(dataDir, "hsr")
	if err := os.MkdirAll(dst, 0755); err != nil {
		return 0, err
	}
	moved := 0
	for _, src := range old {
		target := filepath.Join(dst, filepath.Base(src))
		if _, err := os.Stat(target); err == nil {
			slog.Warn("마이그레이션 건너뜀 — 대상이 이미 있다", "src", src, "dst", target)
			continue
		}
		if err := os.Rename(src, target); err != nil {
			return moved, err
		}
		moved++
	}
	if moved > 0 {
		slog.Info("구버전 데이터 레이아웃 마이그레이션", "moved", moved, "dst", dst)
	}
	return moved, nil
}
```

- [ ] **Step 4: 테스트 통과를 확인한다**

Run: `node scripts/run-go.mjs test ./internal/store/ -run TestMigrateLegacyLayout -v`
Expected: PASS — 6개 전부

- [ ] **Step 5: 커밋한다**

```bash
gofmt -w internal/store/
git add internal/store/migrate.go internal/store/migrate_test.go
git commit -m "feat(store): 구버전 데이터 레이아웃 마이그레이션"
```

---

### Task 5: Config 게임별 스키마 + 자동탐지

**Files:**
- Modify: `internal/server/config.go` 전체 (11-13 Config, 16-27 LoadConfig, 47-55 defaultCandidates, 58-65 detectGamePath)
- Test: `internal/server/config_test.go` (기존 파일에 추가)

**Interfaces:**
- Consumes: `game.Game`, `game.ByID`, `game.All` (Task 1)
- Produces:
  - `type GameConfig struct { GamePath string \`json:"game_path"\` }`
  - `type Config struct { Games map[string]GameConfig \`json:"games,omitempty"\`; ActiveGame string \`json:"active_game,omitempty"\`; GamePath string \`json:"game_path,omitempty"\` }` — `GamePath` 는 구 스키마 읽기 전용 잔재이며 승격 후 비워진다
  - `func (c Config) PathFor(gameID string) string`
  - `func (c *Config) SetPath(gameID, path string)`
  - `func detectGamePath(g game.Game) string`

- [ ] **Step 1: 실패하는 테스트를 작성한다**

`internal/server/config_test.go` 끝에 추가:

```go
// 구 스키마({"game_path": "..."})는 games.hsr.game_path 로 승격돼야 한다.
// 승격에 실패하면 기존 사용자가 게임 경로를 다시 지정해야 한다.
func TestLoadConfig_PromotesLegacySchema(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "config.json")
	if err := os.WriteFile(p, []byte(`{"game_path":"D:\\Game\\Star Rail Games"}`), 0644); err != nil {
		t.Fatal(err)
	}
	c := LoadConfig(p)
	if got := c.PathFor("hsr"); got != `D:\Game\Star Rail Games` {
		t.Errorf("PathFor(hsr) = %q, want D:\\Game\\Star Rail Games", got)
	}
	if c.PathFor("zzz") != "" {
		t.Errorf("zzz 경로가 생겼다: %q", c.PathFor("zzz"))
	}
	// 승격 후 구 필드는 비워져 다음 저장 때 새 스키마로만 기록된다.
	if c.GamePath != "" {
		t.Errorf("승격 후 구 필드가 남았다: %q", c.GamePath)
	}
}

// 신 스키마는 그대로 읽힌다.
func TestLoadConfig_ReadsNewSchema(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "config.json")
	body := `{"games":{"hsr":{"game_path":"A"},"zzz":{"game_path":"B"}},"active_game":"zzz"}`
	if err := os.WriteFile(p, []byte(body), 0644); err != nil {
		t.Fatal(err)
	}
	c := LoadConfig(p)
	if c.PathFor("hsr") != "A" || c.PathFor("zzz") != "B" {
		t.Errorf("경로가 잘못 읽혔다: hsr=%q zzz=%q", c.PathFor("hsr"), c.PathFor("zzz"))
	}
	if c.ActiveGame != "zzz" {
		t.Errorf("ActiveGame = %q, want zzz", c.ActiveGame)
	}
}

// 저장→로드 왕복에서 게임별 경로가 보존돼야 한다.
func TestSaveConfig_RoundTripsGames(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "config.json")
	var c Config
	c.SetPath("hsr", "A")
	c.SetPath("zzz", "B")
	c.ActiveGame = "zzz"
	if err := SaveConfig(p, c); err != nil {
		t.Fatal(err)
	}
	got := LoadConfig(p)
	if got.PathFor("hsr") != "A" || got.PathFor("zzz") != "B" || got.ActiveGame != "zzz" {
		t.Errorf("왕복 실패: %+v", got)
	}
	// 새 스키마로 기록됐는지 — 구 필드가 파일에 남으면 다음 로드에서 승격이 또 돈다.
	raw, err := os.ReadFile(p)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(raw), `"game_path"`) && !strings.Contains(string(raw), `"games"`) {
		t.Errorf("구 스키마로 기록됐다: %s", raw)
	}
}

// SetPath 는 nil 맵에서도 동작해야 한다(zero value Config).
func TestSetPath_InitializesMap(t *testing.T) {
	var c Config
	c.SetPath("hsr", "X")
	if c.PathFor("hsr") != "X" {
		t.Errorf("PathFor(hsr) = %q, want X", c.PathFor("hsr"))
	}
}

// 자동탐지는 게임의 캐시 루트 디렉터리가 실제로 있는 후보만 고른다.
func TestDetectGamePath_MatchesGameDataDir(t *testing.T) {
	root := t.TempDir()
	mustMkdir(t, filepath.Join(root, "ZenlessZoneZero_Data", "webCaches"))

	zzz, _ := game.ByID("zzz")
	zzz.Candidates = []string{filepath.Join(root, "nope"), root}
	if got := detectGamePath(zzz); got != root {
		t.Errorf("detectGamePath = %q, want %q", got, root)
	}

	// HSR 로 보면 StarRail_Data 가 없으므로 빈 문자열이다.
	hsr, _ := game.ByID("hsr")
	hsr.Candidates = []string{root}
	if got := detectGamePath(hsr); got != "" {
		t.Errorf("HSR 탐지 = %q, want 빈 문자열", got)
	}
}
```

import 에 `"strings"`, `"hsr-warp/internal/game"` 을 추가한다.

- [ ] **Step 2: 실패를 확인한다**

Run: `node scripts/run-go.mjs test ./internal/server/ -run "TestLoadConfig|TestSaveConfig|TestSetPath|TestDetectGamePath"`
Expected: FAIL — `c.PathFor undefined`, `too many arguments in call to detectGamePath`

- [ ] **Step 3: 구현한다**

`internal/server/config.go` 를 다음으로 바꾼다(파일 상단 주석과 `SaveConfig` 의 원자적 쓰기 방식은 유지):

```go
// GameConfig 는 게임 하나의 사용자 설정이다.
type GameConfig struct {
	GamePath string `json:"game_path"`
}

// Config 는 앱 설정이다. GamePath 는 구 스키마 호환용 잔재로, LoadConfig 가
// games.hsr 로 승격한 뒤 비운다 — 다음 저장부터 새 스키마로만 기록된다.
type Config struct {
	Games      map[string]GameConfig `json:"games,omitempty"`
	ActiveGame string                `json:"active_game,omitempty"`
	GamePath   string                `json:"game_path,omitempty"`
}

// PathFor 는 게임의 설치 경로를 반환한다(미설정이면 빈 문자열).
func (c Config) PathFor(gameID string) string {
	return c.Games[gameID].GamePath
}

// SetPath 는 게임의 설치 경로를 기록한다.
func (c *Config) SetPath(gameID, path string) {
	if c.Games == nil {
		c.Games = map[string]GameConfig{}
	}
	c.Games[gameID] = GameConfig{GamePath: path}
}
```

`LoadConfig` 의 언마샬 직후에 승격을 넣는다:

```go
	// 구 스키마 승격: {"game_path": "..."} → games.hsr.game_path.
	// 이미 games 가 있으면 신 스키마이므로 건드리지 않는다.
	if c.GamePath != "" && c.Games[game.Default().ID].GamePath == "" {
		c.SetPath(game.Default().ID, c.GamePath)
	}
	c.GamePath = ""
```

`defaultCandidates()` 는 삭제하고(값 테이블이 대체) `detectGamePath` 를 게임 기반으로 바꾼다:

```go
// detectGamePath 는 게임의 설치 경로 후보 중 캐시 루트가 실제로 있는 첫 번째를
// 반환한다. 없으면 빈 문자열.
func detectGamePath(g game.Game) string {
	for _, c := range g.Candidates {
		if _, err := os.Stat(filepath.Join(c, g.DataDirName, "webCaches")); err == nil {
			return c
		}
	}
	return ""
}
```

import 에 `"hsr-warp/internal/game"` 을 추가한다.

- [ ] **Step 4: 테스트 통과를 확인한다**

Run: `node scripts/run-go.mjs test ./internal/server/ -run "TestLoadConfig|TestSaveConfig|TestSetPath|TestDetectGamePath" -v`
Expected: PASS. 패키지 전체는 아직 컴파일되지 않는다(Task 6에서 `server.go` 호출부를 고친다).

- [ ] **Step 5: 커밋한다**

```bash
gofmt -w internal/server/config.go
git add internal/server/config.go internal/server/config_test.go
git commit -m "feat(config): 게임별 경로 스키마와 구 스키마 승격"
```

---

### Task 6: updater 게임별 스케줄 + server `?game=` 스코프

두 파일이 함께 컴파일돼야 하므로 한 태스크로 묶는다.

**Files:**
- Modify: `internal/updater/updater.go:194-205` (EffectiveSchedule), `:142-156` (CheckSchedule)
- Modify: `internal/server/server.go:66-78` (라우트), `:95` (handleData), `:128` (handleDetect), `:134` (handleFetch), `:253` (handleSchedule)
- Modify: `main.go:146-149` (Paths), 초기화에 마이그레이션 추가
- Test: `internal/updater/updater_test.go`, `internal/server/server_test.go` (기존 파일에 추가)

**Interfaces:**
- Consumes: `game.ByID`, `game.Default` (Task 1); `collector.FindAuthContext(gamePath, g)`, `collector.FetchIncremental(ctx, ac, g, ...)`, `collector.BannerLabel` (Task 2); `store.MaxIDByBanner(recs, g)`, `store.Info.UIGFVersion` (Task 3); `store.MigrateLegacyLayout` (Task 4); `Config.PathFor`, `Config.SetPath`, `detectGamePath(g)` (Task 5)
- Produces:
  - `func EffectiveSchedule(dataDir string, embedded []byte, gameID string) []byte`
  - `func CheckSchedule(client *http.Client, rawURL, dataDir string, embedded []byte, gameID string) (ScheduleStatus, error)`
  - `func (s *Server) gameOf(r *http.Request) (game.Game, bool)` — `?game=` 파싱, 미지정 시 `game.Default()`
  - `func (s *Server) dataDirFor(g game.Game) string` — `filepath.Join(s.paths.DataDir, g.ID)`

- [ ] **Step 1: 실패하는 테스트를 작성한다**

`internal/updater/updater_test.go` 끝에 추가:

```go
// 게임별 override 파일은 서로를 침범하지 않아야 한다. ZZZ override 가 HSR
// 스케줄로 서빙되면 50/50 판정이 통째로 어긋난다.
func TestEffectiveSchedule_IsPerGame(t *testing.T) {
	dir := t.TempDir()
	emb := []byte(`{"version":1,"schedule":[{"s":"2024-01-01","e":"2024-02-01","c":[],"l":[]}]}`)
	zzzOverride := []byte(`{"version":9,"schedule":[{"s":"2025-01-01","e":"2025-02-01","c":[],"l":[]}]}`)
	if err := os.WriteFile(filepath.Join(dir, "zzz-schedule.json"), zzzOverride, 0644); err != nil {
		t.Fatal(err)
	}

	if got := EffectiveSchedule(dir, emb, "zzz"); string(got) != string(zzzOverride) {
		t.Errorf("zzz override 가 적용되지 않았다: %s", got)
	}
	// HSR 은 자기 override 파일(data/schedule.json)이 없으므로 내장본이다.
	if got := EffectiveSchedule(dir, emb, "hsr"); string(got) != string(emb) {
		t.Errorf("hsr 이 zzz override 에 오염됐다: %s", got)
	}
}

// HSR override 경로는 data/schedule.json 그대로여야 한다 — 구버전 exe 가
// 계속 이 파일을 쓰기 때문이다.
func TestEffectiveSchedule_HSRKeepsLegacyPath(t *testing.T) {
	dir := t.TempDir()
	emb := []byte(`{"version":1,"schedule":[{"s":"2024-01-01","e":"2024-02-01","c":[],"l":[]}]}`)
	override := []byte(`{"version":5,"schedule":[{"s":"2025-01-01","e":"2025-02-01","c":[],"l":[]}]}`)
	if err := os.WriteFile(filepath.Join(dir, "schedule.json"), override, 0644); err != nil {
		t.Fatal(err)
	}
	if got := EffectiveSchedule(dir, emb, "hsr"); string(got) != string(override) {
		t.Errorf("hsr override 가 적용되지 않았다: %s", got)
	}
}
```

`internal/server/server_test.go` 끝에 추가:

```go
// ?game= 미지정은 hsr 로 폴백한다(기존 클라이언트 동작 보존).
func TestGameOf_DefaultsToHSR(t *testing.T) {
	s := New(Paths{})
	g, ok := s.gameOf(httptest.NewRequest("GET", "/api/data", nil))
	if !ok || g.ID != "hsr" {
		t.Errorf("gameOf = %q ok=%v, want hsr true", g.ID, ok)
	}
}

// 알 수 없는 game 값은 조용히 폴백하지 않고 거절돼야 한다 — 오타가 엉뚱한
// 게임의 데이터를 보여주면 사용자가 알아채기 어렵다.
func TestHandleData_RejectsUnknownGame(t *testing.T) {
	s := New(Paths{DataDir: t.TempDir()})
	w := httptest.NewRecorder()
	s.Handler().ServeHTTP(w, httptest.NewRequest("GET", "/api/data?game=genshin", nil))
	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400", w.Code)
	}
}

// 게임별 데이터가 격리돼 서빙돼야 한다.
func TestHandleData_ScopesByGame(t *testing.T) {
	root := t.TempDir()
	s := New(Paths{DataDir: root})
	hsrRec := []store.Record{{ID: "100", GachaType: "11", Time: "2026-08-01 10:00:00"}}
	zzzRec := []store.Record{{ID: "200", GachaType: "2", Time: "2026-08-01 10:00:00"}}
	if _, err := store.WriteAffectedMonths(filepath.Join(root, "hsr"), store.Info{UID: "1"}, hsrRec); err != nil {
		t.Fatal(err)
	}
	if _, err := store.WriteAffectedMonths(filepath.Join(root, "zzz"), store.Info{UID: "2"}, zzzRec); err != nil {
		t.Fatal(err)
	}

	for q, wantID := range map[string]string{"": "100", "?game=hsr": "100", "?game=zzz": "200"} {
		w := httptest.NewRecorder()
		s.Handler().ServeHTTP(w, httptest.NewRequest("GET", "/api/data"+q, nil))
		if w.Code != http.StatusOK {
			t.Errorf("%q: status = %d, want 200", q, w.Code)
			continue
		}
		var out store.SRGF
		if err := json.Unmarshal(w.Body.Bytes(), &out); err != nil {
			t.Errorf("%q: %v", q, err)
			continue
		}
		if len(out.List) != 1 || out.List[0].ID != wantID {
			t.Errorf("%q: 레코드 = %+v, want ID %s", q, out.List, wantID)
		}
	}
}

// ZZZ 스케줄은 별도 경로로 서빙된다. HSR 경로는 구버전 호환을 위해 그대로다.
func TestHandleSchedule_ServesPerGamePaths(t *testing.T) {
	hsrBody := `{"version":1,"schedule":[{"s":"2024-01-01","e":"2024-02-01","c":[],"l":[]}]}`
	zzzBody := `{"version":1,"schedule":[{"s":"2025-01-01","e":"2025-02-01","c":[],"l":[]}]}`
	s := NewWithAssets(Paths{DataDir: t.TempDir()}, fstest.MapFS{
		"schedule.json":     {Data: []byte(hsrBody)},
		"zzz/schedule.json": {Data: []byte(zzzBody)},
	}, "test")

	for path, want := range map[string]string{"/schedule.json": hsrBody, "/zzz/schedule.json": zzzBody} {
		w := httptest.NewRecorder()
		s.Handler().ServeHTTP(w, httptest.NewRequest("GET", path, nil))
		if w.Body.String() != want {
			t.Errorf("%s = %s, want %s", path, w.Body.String(), want)
		}
	}
}

// 자동탐지도 게임별이어야 한다.
func TestHandleDetect_ScopesByGame(t *testing.T) {
	s := New(Paths{})
	w := httptest.NewRecorder()
	s.Handler().ServeHTTP(w, httptest.NewRequest("GET", "/api/detect?game=zzz", nil))
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}
	var out map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &out); err != nil {
		t.Fatal(err)
	}
	if _, ok := out["path"]; !ok {
		t.Errorf("path 키가 없다: %v", out)
	}

	w = httptest.NewRecorder()
	s.Handler().ServeHTTP(w, httptest.NewRequest("GET", "/api/detect?game=nope", nil))
	if w.Code != http.StatusBadRequest {
		t.Errorf("알 수 없는 게임 status = %d, want 400", w.Code)
	}
}
```

import 에 `"encoding/json"`, `"path/filepath"`, `"testing/fstest"`, `"hsr-warp/internal/store"` 를 추가한다(없다면).

- [ ] **Step 2: 실패를 확인한다**

Run: `node scripts/run-go.mjs test ./internal/updater/ ./internal/server/`
Expected: FAIL — `too many arguments in call to EffectiveSchedule`, `s.gameOf undefined`

- [ ] **Step 3: 구현한다**

`internal/updater/updater.go` — 게임별 override 파일명을 유도한다:

```go
// scheduleFileName 은 게임의 override 파일명을 반환한다. HSR 은 구버전 exe 가
// 계속 쓰는 schedule.json 을 그대로 유지한다.
func scheduleFileName(gameID string) string {
	if gameID == "hsr" {
		return "schedule.json"
	}
	return gameID + "-schedule.json"
}

// EffectiveSchedule 은 data 디렉터리의 override 가 내장본보다 새 버전일 때만
// override 를, 아니면 내장본을 반환한다.
func EffectiveSchedule(dataDir string, embedded []byte, gameID string) []byte {
	b, err := os.ReadFile(filepath.Join(dataDir, scheduleFileName(gameID)))
	// 이하 기존 버전 비교 로직 그대로.
```

`CheckSchedule` 에도 `gameID string` 파라미터를 추가하고 내부의 `EffectiveSchedule`·`writeAtomic` 경로에 `scheduleFileName(gameID)` 를 쓴다.

`internal/server/server.go` — 헬퍼 두 개를 추가한다:

```go
// gameOf 는 ?game= 쿼리로 게임을 고른다. 미지정이면 hsr 로 폴백해 기존
// 클라이언트 동작을 보존하고, 알 수 없는 값은 ok=false 로 400 을 유도한다.
func (s *Server) gameOf(r *http.Request) (game.Game, bool) {
	id := r.URL.Query().Get("game")
	if id == "" {
		return game.Default(), true
	}
	return game.ByID(id)
}

// dataDirFor 는 게임의 저장 디렉터리다.
func (s *Server) dataDirFor(g game.Game) string {
	return filepath.Join(s.paths.DataDir, g.ID)
}
```

`handleData`·`handleDetect`·`handleFetch` 각 진입부에 다음을 넣는다:

```go
	g, ok := s.gameOf(r)
	if !ok {
		http.Error(w, "알 수 없는 게임입니다", http.StatusBadRequest)
		return
	}
```

- `handleData`: `store.LoadAll(s.dataDirFor(g))`
- `handleDetect`: `writeJSON(w, map[string]string{"path": detectGamePath(g)})`
- `handleFetch`: `collector.FindAuthContext(gamePath, g)`, `store.LoadAll(s.dataDirFor(g))`, `store.MaxIDByBanner(existing, g)`, `collector.FetchIncremental(r.Context(), ac, g, lastID, 400*time.Millisecond, onProgress)`, `store.WriteAffectedMonths(s.dataDirFor(g), info, recs)`. 경로 저장은 `cfg := LoadConfig(s.paths.ConfigFile); cfg.SetPath(g.ID, gamePath); SaveConfig(...)` 로 바꾼다(기존 `Config{GamePath: gamePath}` 통째 덮어쓰기는 다른 게임 경로를 지운다). `info` 구성은 게임 규격을 따른다:

```go
	info := store.Info{
		UID: uid, Lang: ac.Lang, Region: ac.Region,
		RegionTimeZone:  store.TZForRegion(ac.Region),
		ExportTimestamp: time.Now().Unix(),
		ExportApp:       "DIY-HSR-Warp",
		ExportAppVersion: "0.1.0",
	}
	if g.InfoFormat == "uigf-v4.0" {
		info.UIGFVersion = "v4.0"
	} else {
		info.SRGFVersion = "v1.0"
	}
```

라우트에 ZZZ 스케줄을 추가한다(`handleSchedule` 을 게임별로 일반화):

```go
	mux.HandleFunc("/schedule.json", s.scheduleHandler(game.Default()))
	for _, g := range game.All() {
		if g.ID == game.Default().ID {
			continue
		}
		gg := g
		mux.HandleFunc("/"+gg.ID+"/schedule.json", s.scheduleHandler(gg))
	}
```

```go
// scheduleHandler 는 게임의 스케줄을 서빙한다. 내장본과 data 디렉터리의
// override 중 버전이 높은 쪽이 나간다.
func (s *Server) scheduleHandler(g game.Game) http.HandlerFunc {
	name := "schedule.json"
	if g.ID != game.Default().ID {
		name = g.ID + "/schedule.json"
	}
	return func(w http.ResponseWriter, r *http.Request) {
		var emb []byte
		if s.assets != nil {
			emb, _ = fs.ReadFile(s.assets, name)
		}
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_, _ = w.Write(updater.EffectiveSchedule(s.paths.DataDir, emb, g.ID))
	}
}
```

`handleUpdates` 의 `updater.CheckSchedule` 호출에 `game.Default().ID` 를 넘긴다(HSR 스케줄 갱신 채널은 현행 유지).

`main.go` — `setupLogging` 직후, 서버 생성 전에 마이그레이션을 넣는다:

```go
	// 구버전 레이아웃을 게임별 디렉터리로 옮긴다. 실패해도 앱은 계속 뜬다 —
	// 최악의 경우 기존 기록이 안 보일 뿐이고, 재수집으로 복구된다.
	if _, err := store.MigrateLegacyLayout(paths.DataDir); err != nil {
		slog.Error("데이터 마이그레이션 실패", "err", err)
	}
```

- [ ] **Step 4: 테스트 통과를 확인한다**

Run: `node scripts/run-go.mjs test ./...`
Expected: PASS — Go 전체. 여기서 처음으로 전체 트리가 컴파일된다.

- [ ] **Step 5: 커밋한다**

```bash
node scripts/run-go.mjs vet ./...
gofmt -w .
git add internal/updater/ internal/server/ main.go
git commit -m "feat(server): game 스코프 라우팅과 게임별 스케줄 채널"
```

---

### Task 7: `analyze.js` 일반화 — `ranks`/`banners` 주입

분석 로직 단일 소스를 유지하면서 게임 차이를 데이터로 받는다. **50/50 판정 함수(`wasPickup`, `guaranteed` 전이)는 손대지 않는다.**

**Files:**
- Modify: `web/analyze.js` — `:8-14`(BANNERS/ORDER), `:55-72`(combineLimited), `:84-98`·`:117-119`·`:146-147`(rank 리터럴), `:166-167`·`:198-199`·`:221-223`(배너 코드 리터럴), `:179`·`:235`(`62.5` 매직넘버)
- Modify: `web/schedule.json` (`ranks`·`banners` 추가, `version` 4→5)
- Test: `web/analyze.test.js` (기존 — 무수정 통과해야 함)

**Interfaces:**
- Consumes: (없음 — 순수 JS)
- Produces:
  - `analyze(data, schedule)` — `schedule` 이 배열이면 기존처럼 픽업 일정으로 취급하고, 객체면 `{schedule, versions, ranks, banners}` 로 해석한다
  - `WarpAnalyze.resolveConfig(schedule)` → `{ list, ranks: {top, mid}, banners }` — 테스트에서 직접 검증할 수 있게 노출
  - `WarpAnalyze.BANNERS` — HSR 기본 테이블(하위 호환 유지)

- [ ] **Step 1: 실패하는 테스트를 작성한다**

`web/analyze.zzz.test.js` 생성:

```js
// ZZZ 분석 회귀 테스트. HSR 과 구조적으로 동형이므로 50/50 판정 함수는
// 그대로 두고, 배너 코드·랭크 코드만 주입으로 갈리는지 확인한다.
const assert = require('assert');
const { analyze, resolveConfig } = require('./analyze.js');

// 공시 원문 기준 ZZZ 설정. expAvg = 1 / 종합확률.
const ZZZ = {
  ranks: { top: '4', mid: '3' },
  banners: {
    '2': { role: 'limited-char', short: '독점', cap: 90, rateUp: 0.5, expAvg: 62.5 },
    '3': { role: 'limited-weapon', short: 'W-엔진', cap: 80, rateUp: 0.75, expAvg: 50.0 },
    '1': { role: 'standard', short: '상시', cap: 90, rateUp: null, expAvg: 62.5 },
    '5': { role: 'bangboo', short: '본디', cap: 80, rateUp: null, expAvg: 50.0 },
  },
  schedule: [{ s: '2026-07-29', e: '2026-08-19', c: ['1501'], l: ['14158'] }],
  versions: [{ v: '2.5', s: '2026-07-29' }],
};

let id = 1000n;
const T = '2026-08-01 12:00:00';
// ZZZ 는 S급이 rank_type 4, A급이 3, B급이 2다(실측).
const s4 = (item_id, gacha_type = '2', time = T) => ({
  id: String(id++), rank_type: '4', item_id: String(item_id),
  name: 'x', item_type: '에이전트', time, gacha_type,
});
const low = (rank, gacha_type = '2', time = T) => ({
  id: String(id++), rank_type: String(rank), item_id: '0',
  name: 'y', item_type: 'W-엔진', time, gacha_type,
});

// ---- 설정 주입 ----
{
  const cfg = resolveConfig(ZZZ);
  assert.strictEqual(cfg.ranks.top, '4', 'ZZZ 최고등급 코드');
  assert.strictEqual(cfg.ranks.mid, '3', 'ZZZ 중간등급 코드');
  assert.strictEqual(cfg.banners['3'].expAvg, 50.0, '음의 엔진 기준선');
  assert.deepStrictEqual(cfg.list, ZZZ.schedule, '픽업 일정 통과');
}

// ---- 구 스키마 호환: 배열이 들어오면 HSR 기본값 ----
{
  const cfg = resolveConfig([{ s: '2023-04-26', e: '2023-05-17', c: ['1102'], l: ['23001'] }]);
  assert.strictEqual(cfg.ranks.top, '5', '구 스키마는 HSR 랭크로 폴백');
  assert.strictEqual(cfg.ranks.mid, '4');
  assert.strictEqual(cfg.banners['11'].expAvg, 62.5, '구 스키마는 HSR 배너로 폴백');
}

// ---- ZZZ 랭크 코드로 집계 ----
{
  id = 2000n;
  const list = [...Array(5)].map(() => low(2)).concat(low(3), s4(1501));
  const out = analyze({ info: {}, list }, ZZZ);
  assert.strictEqual(out.count5, 1, 'rank_type 4 를 최고등급으로 셌다');
  assert.strictEqual(out.count4, 1, 'rank_type 3 을 중간등급으로 셌다');
  assert.strictEqual(out.count3, 5, 'rank_type 2 를 그 외로 셌다');
}

// ---- 독점 채널 50/50 전이 (HSR 과 동일 규칙) ----
{
  id = 3000n;
  // 1501 은 픽업, 9999 는 비픽업 → 픽뚫 후 다음 S급은 확정.
  const list = [s4(9999), s4(1501)];
  const out = analyze({ info: {}, list }, ZZZ);
  const b = out.banners.find((x) => x.type === '2');
  assert.strictEqual(b.stats.fives[0].result, 'loss', '비픽업은 픽뚫');
  assert.strictEqual(b.stats.fives[1].result, 'guaranteed', '픽뚫 다음은 확정');
  assert.strictEqual(b.stats.fives[1].fromGuarantee, true);
}

// ---- 음의 엔진 채널 75/25 ----
{
  id = 4000n;
  const out = analyze({ info: {}, list: [s4(14158, '3')] }, ZZZ);
  const b = out.banners.find((x) => x.type === '3');
  assert.strictEqual(b.meta.rateUp, 0.75, '음의 엔진 픽업 확률');
  assert.strictEqual(b.meta.cap, 80, '음의 엔진 하드천장');
  assert.strictEqual(b.stats.fives[0].result, 'win', '픽업 S급은 픽승');
}

// ---- 본디 채널: 천장·평균은 집계되되 50/50 판정 없음 ----
{
  id = 5000n;
  const list = [...Array(9)].map(() => low(2, '5')).concat(s4(53001, '5'));
  const out = analyze({ info: {}, list }, ZZZ);
  const b = out.banners.find((x) => x.type === '5');
  assert.strictEqual(b.stats.count5, 1, '본디 S급 집계');
  assert.strictEqual(b.stats.avgPity5, 10, '본디 평균 뽑기 집계');
  assert.strictEqual(b.stats.fives[0].result, null, '본디는 50/50 판정 없음');
  assert.strictEqual(b.meta.rateUp, null);
}

// ---- 상시 채널: 픽업 판정 없음 ----
{
  id = 6000n;
  const out = analyze({ info: {}, list: [s4(1501, '1')] }, ZZZ);
  const b = out.banners.find((x) => x.type === '1');
  assert.strictEqual(b.stats.fives[0].result, null, '상시는 픽업 판정 없음');
  assert.strictEqual(b.stats.fives[0].isPickup, null);
}

// ---- 합산 한정 지표는 role 로 고른다 ----
{
  id = 7000n;
  const list = [s4(1501, '2'), s4(14158, '3')];
  const out = analyze({ info: {}, list }, ZZZ);
  assert.strictEqual(out.luck.limited.count5, 2, '독점+음의엔진이 합산됐다');
  // 기준선은 5★ 개수 가중 평균: (62.5*1 + 50.0*1) / 2
  assert.strictEqual(out.luck.limited.base, 56.25, '가중 기준선');
}

// ---- BigInt id 정렬 불변식 ----
{
  id = 8000n;
  const big = { ...s4(1501), id: '1785859200000027932' };
  const small = { ...s4(1501), id: '999999999999999999' };
  const out = analyze({ info: {}, list: [big, small] }, ZZZ);
  assert.strictEqual(out.total, 2);
  const b = out.banners.find((x) => x.type === '2');
  assert.ok(b.stats.fives.length === 2, '거대 정수 id 가 정렬돼 처리됐다');
}

console.log('OK  analyze.zzz tests passed');
```

- [ ] **Step 2: 실패를 확인한다**

Run: `node web/analyze.zzz.test.js`
Expected: FAIL — `resolveConfig is not a function`

- [ ] **Step 3: 구현한다**

`web/analyze.js` 상단의 `BANNERS`/`ORDER` 를 기본값으로 남기고 설정 해석기를 추가한다:

```js
  // HSR 기본 배너 테이블. 구 schedule.json(banners 블록이 없는)과의 호환을 위해
  // 내장 폴백으로 남는다. expAvg = 1 / 공식 종합확률(보증 포함).
  const BANNERS = {
    '11': { role: 'limited-char',   name: '캐릭터 이벤트', short: '캐릭터', color: '#a474ff', cap: 90, kind: 'limited',  pool: 'char', rateUp: 0.5,  expAvg: 62.5 },
    '12': { role: 'limited-weapon', name: '광추 이벤트',   short: '광추',   color: '#5aa9ff', cap: 80, kind: 'limited',  pool: 'lc',   rateUp: 0.75, expAvg: 53.5 },
    '1':  { role: 'standard',       name: '스텔라(일반)',  short: '일반',   color: '#52d39a', cap: 90, kind: 'standard', pool: null,   rateUp: null, expAvg: 62.5 },
    '2':  { role: 'beginner',       name: '출발 워프',     short: '출발',   color: '#ff9e45', cap: 50, kind: 'beginner', pool: null,   rateUp: null, expAvg: null },
  };
  const ORDER = ['11', '12', '1', '2'];
  const DEFAULT_RANKS = { top: '5', mid: '4' };

  // 역할 → 분석 동작 매핑. 게임마다 채널 코드는 달라도 역할은 공통이다.
  //   kind  : 'limited' 만 50/50 판정을 받는다.
  //   pool  : schedule 항목의 픽업 키('c' 캐릭터 / 'l' 무기). null 이면 판정 없음.
  const ROLE_SPEC = {
    'limited-char':   { kind: 'limited',  pool: 'char' },
    'limited-weapon': { kind: 'limited',  pool: 'lc' },
    'standard':       { kind: 'standard', pool: null },
    'beginner':       { kind: 'beginner', pool: null },
    'bangboo':        { kind: 'standard', pool: null },
  };

  // resolveConfig 는 analyze() 의 schedule 인자를 정규화한다.
  // 배열이면 구 스키마(픽업 일정만)로 보고 HSR 기본 테이블을 쓴다.
  function resolveConfig(schedule) {
    if (Array.isArray(schedule) || !schedule) {
      return { list: schedule || [], ranks: DEFAULT_RANKS, banners: BANNERS, order: ORDER };
    }
    const banners = {};
    const src = schedule.banners || BANNERS;
    for (const [code, b] of Object.entries(src)) {
      const spec = ROLE_SPEC[b.role] || ROLE_SPEC.standard;
      banners[code] = Object.assign({}, b, { kind: spec.kind, pool: spec.pool });
    }
    return {
      list: schedule.schedule || [],
      ranks: Object.assign({}, DEFAULT_RANKS, schedule.ranks),
      banners,
      order: Object.keys(banners),
    };
  }

  // 역할로 배너 코드를 찾는다. 하드코딩된 '11'/'12' 를 대체한다.
  function codesByRole(cfg, ...roles) {
    return cfg.order.filter((c) => roles.includes(cfg.banners[c].role));
  }
```

랭크 리터럴 3개소를 `cfg.ranks` 로 바꾼다:
- `:85` `if (rank === '5')` → `if (rank === ranks.top)`
- `:98` `else if (rank === '4')` → `else if (rank === ranks.mid)`
- `:118` `if (rank === '5')` → `if (rank === ranks.top)`
- `:119` `else if (rank === '4') b.c4++; else b.c3++;` → `else if (rank === ranks.mid) b.c4++; else b.c3++;`
- `:147` `if (rk === '4') cnt[t].c4++; else if (rk !== '5') cnt[t].c3++;` → `if (rk === ranks.mid) cnt[t].c4++; else if (rk !== ranks.top) cnt[t].c3++;`

배너 코드 리터럴을 role 조회로 바꾼다:
- `combineLimited(cfg, banners)` 로 시그니처를 바꾸고, 내부의 `BANNERS['11'].expAvg`/`BANNERS['12'].expAvg` 를 `cfg.banners[charCode].expAvg`/`cfg.banners[lcCode].expAvg` 로. `charCode = codesByRole(cfg,'limited-char')[0]`, `lcCode = codesByRole(cfg,'limited-weapon')[0]`
- `:166`·`:221` `b.type === '11' || b.type === '1'` → `codesByRole(cfg, 'limited-char', 'standard').includes(b.type)`
- `:167`·`:222` `b.type === '11'` → `b.meta.role === 'limited-char'`
- `:167`·`:223` `b.type === '12'` → `b.meta.role === 'limited-weapon'`
- `:198-199` `analyzeVersions` 의 `all` 계산도 같은 방식으로. **`combineLimited` 와 산식이 같으므로 인라인 중복을 제거하고 `combineLimited` 를 호출하도록 통합한다** — 두 곳이 갈리면 게임을 늘릴 때마다 버그가 난다.
- `:179`·`:235` 의 `62.5` 매직넘버는 `cfg.banners[charCode].expAvg` 로 대체한다. **BANNERS 를 우회한 하드코딩이므로 반드시 제거한다.**

`analyze(data, schedule)` 진입부에서 `const cfg = resolveConfig(schedule);` 를 만들고 `cfg.list` 를 `wasPickup` 으로, `cfg.order` 를 그룹 초기화에 넘긴다. `filterAnalysis`·`analyzeVersions` 도 `cfg` 를 받도록 한다.

**`wasPickup` 과 `guaranteed` 전이 블록은 한 글자도 바꾸지 않는다.**

`module.exports`/`root.WarpAnalyze` 에 `resolveConfig` 와 `ROLE_SPEC` 을 추가로 노출한다.

`web/schedule.json` 을 갱신한다. 파일은 1줄 minified JSON 이며 `schedule`(60건)·`versions`(29건) 배열은 **한 글자도 건드리지 않는다**. 편집은 다음 스크립트로 하면 안전하다:

```bash
node -e "
const fs=require('fs'); const p='web/schedule.json';
const s=JSON.parse(fs.readFileSync(p,'utf8'));
s.version = 5;
s.ranks = { top: '5', mid: '4' };
s.banners = {
  '11': { role:'limited-char',   name:'캐릭터 이벤트', short:'캐릭터', color:'#a474ff', cap:90, rateUp:0.5,  expAvg:62.5 },
  '12': { role:'limited-weapon', name:'광추 이벤트',   short:'광추',   color:'#5aa9ff', cap:80, rateUp:0.75, expAvg:53.5 },
  '1':  { role:'standard',       name:'스텔라(일반)',  short:'일반',   color:'#52d39a', cap:90, rateUp:null, expAvg:62.5 },
  '2':  { role:'beginner',       name:'출발 워프',     short:'출발',   color:'#ff9e45', cap:50, rateUp:null, expAvg:null },
};
// 키 순서를 고정해 diff 를 읽기 쉽게 유지한다.
const out = { version:s.version, ranks:s.ranks, banners:s.banners, schedule:s.schedule, versions:s.versions };
fs.writeFileSync(p, JSON.stringify(out), 'utf8');
console.log('schedule:', out.schedule.length, 'versions:', out.versions.length);
"
```
Expected: `schedule: 60 versions: 29` — 이 수가 다르면 배열이 손상된 것이므로 되돌린다.

값은 현행 내장 테이블(`web/analyze.js:8-13`)과 동일하다. `version` 을 올리는 이유는 업데이터가 version 비교로 배포하기 때문이다.

- [ ] **Step 4: 테스트 통과를 확인한다**

Run: `node web/analyze.zzz.test.js && node web/analyze.test.js`
Expected: 둘 다 PASS. **`analyze.test.js` 는 무수정으로 통과해야 한다** — 실패하면 HSR 회귀이므로 되돌린다. 단 `web/analyze.test.js:3` 이 실 `schedule.json` 을 읽으므로, 이 파일이 이제 객체 형태 설정을 담게 된 점이 `resolveConfig` 로 흡수되는지 확인한다.

- [ ] **Step 5: 커밋한다**

```bash
node web/ui_kits/dashboard/nohardcode.test.js
git add web/analyze.js web/analyze.zzz.test.js web/schedule.json
git commit -m "feat(analyze): 랭크·배너 테이블 주입으로 게임 일반화"
```

---

### Task 8: ZZZ 배너 일정 추출 스크립트

**Files:**
- Create: `scripts/extract-zzz-schedule.mjs`
- Create: `scripts/extract-zzz-schedule.test.mjs`
- Create: `web/zzz/schedule.json` (스크립트 산출물)
- Modify: `package.json` (`schedule:status` 확장, 새 테스트 등록)

**Interfaces:**
- Consumes: `web/analyze.js` 의 `ranks`/`banners` 스키마 (Task 7)
- Produces: `export function buildSchedule(raw)` → `{ schedule: [{s,e,c,l}], skipped: [{name, reason}] }` — 순수 함수라 테스트가 네트워크 없이 돈다

- [ ] **Step 1: 실패하는 테스트를 작성한다**

`scripts/extract-zzz-schedule.test.mjs`:

```js
// 원본 데이터에 실재하는 함정들을 픽스처로 고정한다. 소스가 갱신되며
// 스키마가 흔들려도 조용히 잘못된 일정을 만들지 않게 한다.
import assert from 'assert';
import { buildSchedule } from './extract-zzz-schedule.mjs';

// 함정 1: top-level 키를 믿으면 안 된다 — 키 "3" 배열에 banner_type 2 가 섞여 있다.
// 함정 2: rank / rarity 필드명 혼재, id 가 string / number 혼재.
// 함정 3: uprate_5 에 빈 객체가 들어 있는 항목이 있다.
// 함정 4: 타임존이 +08:00 / +01:00 혼재, is_server_time 플래그가 따로 있다.
// 함정 5: banner_type 12/13 은 특별 채널로 각각 독점 / 음의 엔진에 대응한다.
const RAW = {
  '2': [
    {
      name: 'Mellow Waveride', banner_type: 2,
      uprate_5: [{ id: '1191', name: 'Ellen', rank: 5, item_type: 'character' }],
      start_time: { time: '2024-07-04 02:00:00+08:00', is_server_time: false },
      end_time: { time: '2024-07-24 11:59:59+01:00', is_server_time: true },
    },
    {
      name: 'Neon Angel', banner_type: 2,
      uprate_5: [{ id: 1501, name: 'Aria', rarity: 5, item_type: 'character' }],
      start_time: { time: '2026-07-29 02:00:00+08:00', is_server_time: false },
      end_time: { time: '2026-08-19 11:59:59+01:00', is_server_time: true },
    },
    { name: 'Paradise Regained', banner_type: 2, uprate_5: [{}],
      start_time: { time: '2026-07-29 02:00:00+08:00', is_server_time: false },
      end_time: { time: '2026-08-19 11:59:59+01:00', is_server_time: true } },
  ],
  '3': [
    {
      name: 'Dissonant Sonata', banner_type: 3,
      uprate_5: [{ id: '14158', name: 'Returning Wings', rank: 5, item_type: 'weapon' }],
      start_time: { time: '2026-07-29 02:00:00+08:00', is_server_time: false },
      end_time: { time: '2026-08-19 11:59:59+01:00', is_server_time: true },
    },
    {
      name: 'Misfiled Exclusive', banner_type: 2,
      uprate_5: [{ id: '1381', name: 'Soldier 0', rank: 5, item_type: 'character' }],
      start_time: { time: '2026-07-29 02:00:00+08:00', is_server_time: false },
      end_time: { time: '2026-08-19 11:59:59+01:00', is_server_time: true },
    },
  ],
  '12': [{
    name: 'Sworn to Noble Courage', banner_type: 12,
    uprate_5: [{ id: '1401', name: 'Alice', rank: 5, item_type: 'character' }],
    start_time: { time: '2026-01-21 12:00:00+01:00', is_server_time: true },
    end_time: { time: '2026-02-05 14:59:59+01:00', is_server_time: true },
  }],
  '13': [{
    name: 'Dazzling Melody', banner_type: 13,
    uprate_5: [{ id: '14138', name: 'Severed Innocence', rank: 5, item_type: 'weapon' }],
    start_time: { time: '2026-01-21 12:00:00+01:00', is_server_time: true },
    end_time: { time: '2026-02-05 14:59:59+01:00', is_server_time: true },
  }],
};

const { schedule, skipped } = buildSchedule(RAW);

// ---- 같은 기간은 한 항목으로 병합된다 ----
{
  const aug = schedule.filter((p) => p.s === '2026-07-29');
  assert.strictEqual(aug.length, 1, '같은 시작일은 한 항목으로 병합');
  // 독점 2건(Neon Angel, 잘못 분류된 Misfiled Exclusive)이 c 에 모인다.
  assert.deepStrictEqual(aug[0].c.sort(), ['1381', '1501'], 'banner_type 필드가 권위');
  assert.deepStrictEqual(aug[0].l, ['14158'], '음의 엔진은 l 로');
}

// ---- 특별 채널 12/13 매핑 ----
{
  const jan = schedule.find((p) => p.s === '2026-01-21');
  assert.ok(jan, '특별 채널 기간이 있다');
  assert.deepStrictEqual(jan.c, ['1401'], 'banner_type 12 → c');
  assert.deepStrictEqual(jan.l, ['14138'], 'banner_type 13 → l');
}

// ---- id 는 문자열로 정규화된다 (analyze.js 가 문자열 비교를 한다) ----
for (const p of schedule) {
  for (const arr of [p.c, p.l]) {
    for (const v of arr) assert.strictEqual(typeof v, 'string', `id 가 문자열이 아니다: ${v}`);
  }
}

// ---- 빈 uprate_5 항목은 조용히 무시되지 않고 보고된다 ----
{
  assert.strictEqual(skipped.length, 1, '건너뛴 항목 수');
  assert.strictEqual(skipped[0].name, 'Paradise Regained');
}

// ---- 날짜는 UTC 정규화 후 YYYY-MM-DD ----
{
  const first = schedule.find((p) => p.s === '2024-07-04');
  assert.ok(first, '타임존 혼재 항목이 날짜로 정규화됐다');
  assert.match(first.e, /^\d{4}-\d{2}-\d{2}$/, '종료일 형식');
}

// ---- 시작일 오름차순 ----
for (let i = 1; i < schedule.length; i++) {
  assert.ok(schedule[i - 1].s <= schedule[i].s, '시작일 오름차순');
}

// ---- 모든 항목이 c 와 l 키를 갖는다 ----
// analyze.js 의 wasPickup 이 p[poolKey].includes 를 옵셔널 체이닝 없이 부른다.
for (const p of schedule) {
  assert.ok(Array.isArray(p.c), 'c 키 필수');
  assert.ok(Array.isArray(p.l), 'l 키 필수');
}

console.log('OK  extract-zzz-schedule tests passed');
```

- [ ] **Step 2: 실패를 확인한다**

Run: `node scripts/extract-zzz-schedule.test.mjs`
Expected: FAIL — `Cannot find module './extract-zzz-schedule.mjs'`

- [ ] **Step 3: 구현한다**

`scripts/extract-zzz-schedule.mjs`:

```js
// ZZZ 배너 일정을 web/zzz/schedule.json 으로 추출한다.
//
//   node scripts/extract-zzz-schedule.mjs
//
// 소스: FuriaPaladins/Hoyoverse-Data (GitHub Actions 로 매일 자동 갱신).
// 산출물은 repo 에 벤더링하므로 런타임 의존은 없다 — 소스가 죽어도 기존
// 사용자 앱은 정상 동작하고, 신규 패치 반영 경로만 막힌다.
//
// 확률·천장 값(banners 블록)은 인게임 공시 원문의 general_prob_star5 기준이며
// 추론이 아니다. expAvg = 1 / 종합확률.
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const SRC = 'https://raw.githubusercontent.com/FuriaPaladins/Hoyoverse-Data/main/banners/zzz_formatted.json';

// banner_type → schedule 픽업 키. 12/13 은 특별 채널로 각각 독점·음의 엔진과
// 확률 파라미터가 같다(공시 원문 확인).
const POOL_OF = { 2: 'c', 3: 'l', 12: 'c', 13: 'l' };

// 게임 버전 목록은 소스에 없어 별도 관리한다. 신규 패치마다 한 줄 추가한다.
//
// 확인된 값만 넣는다 — 잘못된 버전 경계는 버전별 통계를 조용히 왜곡한다.
// 1.0 시작일만 zzz_formatted.json 의 최초 배너 시작일로 확정돼 있다.
// 나머지는 공식 출처(패치 노트·업데이트 공지)로 확인한 뒤 추가한다.
// 비어 있어도 앱은 동작한다: analyzeVersions 가 빈 배열을 반환해 버전 비교
// 탭이 빈 상태가 될 뿐이고, 다른 지표는 전부 정상이다.
const VERSIONS = [
  { v: '1.0', s: '2024-07-04' },
];

// 공시 원문(general_prob_star5) 기준. 값은 32개 배너 표본에서 채널별로 일정했다.
const BANNERS = {
  '2': { role: 'limited-char',   name: '독점 채널',   short: '독점',   color: '#ff5a6e', cap: 90, rateUp: 0.5,  expAvg: 62.5 },
  '3': { role: 'limited-weapon', name: 'W-엔진 채널', short: 'W-엔진', color: '#f5a524', cap: 80, rateUp: 0.75, expAvg: 50.0 },
  '1': { role: 'standard',       name: '상시 채널',   short: '상시',   color: '#52d39a', cap: 90, rateUp: null, expAvg: 62.5 },
  '5': { role: 'bangboo',        name: '본디 채널',   short: '본디',   color: '#7aa2ff', cap: 80, rateUp: null, expAvg: 50.0 },
};

// ZZZ 는 B급=2 / A급=3 / S급=4 다(실측). HSR 의 3/4/5 와 다르다.
const RANKS = { top: '4', mid: '3' };

// utcDate 는 오프셋이 섞인 시각 문자열을 UTC 로 정규화해 날짜만 취한다.
// wasPickup 이 ±60일 여유를 두므로 하루 오차는 판정에 영향이 없다.
function utcDate(t) {
  if (!t || !t.time) return null;
  const d = new Date(t.time.replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

// buildSchedule 은 원본을 schedule 배열로 변환한다. 순수 함수라 테스트가
// 네트워크 없이 돈다.
export function buildSchedule(raw) {
  const byStart = new Map();
  const skipped = [];

  // top-level 키는 신뢰하지 않는다 — 키 "3" 배열에 banner_type 2 가 섞여 있다.
  const all = [];
  for (const v of Object.values(raw)) if (Array.isArray(v)) all.push(...v);

  for (const b of all) {
    const pool = POOL_OF[b.banner_type];
    if (!pool) {
      skipped.push({ name: b.name, reason: `알 수 없는 banner_type ${b.banner_type}` });
      continue;
    }
    const s = utcDate(b.start_time);
    const e = utcDate(b.end_time);
    if (!s || !e) {
      skipped.push({ name: b.name, reason: '시각 파싱 실패' });
      continue;
    }
    // id 는 string / number 가 섞여 있고, 빈 객체 항목도 있다.
    const ids = (b.uprate_5 || [])
      .map((u) => (u && u.id !== undefined && u.id !== null ? String(u.id) : null))
      .filter(Boolean);
    if (ids.length === 0) {
      skipped.push({ name: b.name, reason: 'uprate_5 에 id 가 없다' });
      continue;
    }
    if (!byStart.has(s)) byStart.set(s, { s, e, c: [], l: [] });
    const slot = byStart.get(s);
    // 같은 기간 안에서 종료일이 다르면 늦은 쪽을 취한다(동시 병행 배너).
    if (e > slot.e) slot.e = e;
    for (const id of ids) if (!slot[pool].includes(id)) slot[pool].push(id);
  }

  const schedule = [...byStart.values()].sort((a, b) => (a.s < b.s ? -1 : a.s > b.s ? 1 : 0));
  return { schedule, skipped };
}

async function main() {
  const res = await fetch(SRC, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`소스 응답 ${res.status}`);
  const { schedule, skipped } = buildSchedule(await res.json());

  for (const s of skipped) console.warn(`건너뜀: ${s.name} — ${s.reason}`);
  if (schedule.length === 0) throw new Error('일정이 비었다 — 소스 스키마가 바뀐 것 같다');

  const out = { version: 1, ranks: RANKS, banners: BANNERS, schedule, versions: VERSIONS };
  const dst = join(dirname(fileURLToPath(import.meta.url)), '..', 'web', 'zzz', 'schedule.json');
  mkdirSync(dirname(dst), { recursive: true });
  writeFileSync(dst, JSON.stringify(out), 'utf8');
  console.log(`${dst} 기록 — 일정 ${schedule.length}건, 건너뜀 ${skipped.length}건`);
}

// 테스트에서 import 할 때는 실행하지 않는다.
if (process.argv[1] && process.argv[1].endsWith('extract-zzz-schedule.mjs')) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
```

**주의:** `VERSIONS` 는 확인된 `1.0` 하나만 담고 출하한다. 나머지 버전 경계는 추론하지 말고 공식 패치 공지로 확인한 뒤 한 줄씩 추가한다 — 잘못된 경계는 버전별 통계를 조용히 왜곡한다. 이 목록이 짧아도 다른 지표는 전부 정상 동작하며, 버전 비교 탭만 비어 보인다.

- [ ] **Step 4: 테스트 통과를 확인한다**

Run: `node scripts/extract-zzz-schedule.test.mjs && node scripts/extract-zzz-schedule.mjs`
Expected: 테스트 PASS, 그리고 `web/zzz/schedule.json` 생성 + 일정 건수 출력

- [ ] **Step 5: `package.json` 갱신 후 커밋한다**

`test` 체인에 세 줄을 추가하고 `schedule:status` 를 두 게임 보고로 바꾼다:

```json
"test": "… && node web/analyze.test.js && node web/analyze.zzz.test.js && node scripts/extract-zzz-schedule.test.mjs && …",
"schedule:status": "node -e \"for (const g of [['HSR','./web/schedule.json'],['ZZZ','./web/zzz/schedule.json']]) { const s=require(g[1]); const v=s.versions[s.versions.length-1]; const p=s.schedule[s.schedule.length-1]; console.log(g[0]+' 배너 데이터 version :', s.version); console.log(g[0]+' 최신 대응 게임 버전 :', v.v, '('+v.s+' ~)'); console.log(g[0]+' 픽업 일정 커버      : ~'+p.e); }\""
```

```bash
npm run schedule:status
git add scripts/extract-zzz-schedule.mjs scripts/extract-zzz-schedule.test.mjs web/zzz/schedule.json package.json
git commit -m "feat(scripts): ZZZ 배너 일정 추출과 두 게임 상태 보고"
```

---

### Task 9: 대시보드 게임 스위처 + i18n

**Files:**
- Modify: `web/ui_kits/dashboard/data.js:37`, `:83-85`, `:103`, `:121` (배너 코드 리터럴), `:13-21` (init), `:143-176` (fetch)
- Modify: `web/ui_kits/dashboard/Dashboard.jsx:84-86` (제목), `:92-101` (컨트롤 그룹)
- Modify: `web/ui_kits/dashboard/i18n.js:35` (BANNER_CODE)
- Modify: `web/ui_kits/dashboard/i18n/{ko,en,zh,ja}.js` (키 추가)
- Modify: `web/ui_kits/dashboard/nohardcode.test.js:21` (ALLOW)
- Test: `web/ui_kits/dashboard/i18n.test.js` (기존 — 4개 사전 키 일치 검사가 강제)

**Interfaces:**
- Consumes: `WarpAnalyze.resolveConfig`, 게임별 `schedule.json` 스키마 (Task 7); `/api/data?game=`, `/api/fetch?game=`, `/api/detect?game=`, `/zzz/schedule.json` (Task 6)
- Produces: `WarpData.setGame(id)`, `WarpData.game()` — 현재 게임 전환/조회

- [ ] **Step 1: 실패하는 테스트를 작성한다**

기존 `i18n.test.js` 가 4개 사전의 키 완전 일치를 이미 강제하므로, 게임 스위처 전용 검사를 `web/ui_kits/dashboard/i18n.test.js` 끝에 추가한다:

```js
// ---- 게임별 용어 키 ----
// 게임 스위처가 생기면 두 게임의 배너 라벨과 제목이 모두 번역돼야 한다.
// 키가 한 언어에만 있으면 위의 키 일치 검사가 이미 잡지만, 여기서는
// 필요한 키가 아예 빠지지 않았는지 확인한다.
{
  const required = [
    'game.hsr', 'game.zzz',
    'banner.exclusive', 'banner.wengine', 'banner.standard', 'banner.bangboo',
  ];
  for (const lang of ['ko', 'en', 'zh', 'ja']) {
    for (const k of required) {
      assert.ok(window.I18N_DICTS[lang][k], `${lang} 사전에 ${k} 가 없다`);
    }
  }
}

// 배너 short → i18n 코드 매핑이 두 게임을 모두 덮어야 한다.
{
  const codes = window.I18N.BANNER_CODE;
  for (const short of ['캐릭터', '광추', '일반', '출발', '독점', 'W-엔진', '상시', '본디']) {
    assert.ok(codes[short], `BANNER_CODE 에 ${short} 가 없다`);
  }
}
```

- [ ] **Step 2: 실패를 확인한다**

Run: `node web/ui_kits/dashboard/i18n.test.js`
Expected: FAIL — `ko 사전에 game.hsr 가 없다`

- [ ] **Step 3: 구현한다**

`i18n/{ko,en,zh,ja}.js` 각각에 키를 추가한다. **네 파일 모두 같은 키 집합이어야 한다**(기존 검사가 강제):

```js
  'game.hsr': '붕괴: 스타레일',
  'game.zzz': '젠레스 존 제로',
  'banner.exclusive': '독점',
  'banner.wengine': 'W-엔진',
  'banner.standard': '상시',
  'banner.bangboo': '본디',
```
(en: `Honkai: Star Rail` / `Zenless Zone Zero` / `Exclusive` / `W-Engine` / `Stable` / `Bangboo`. zh·ja 는 각 게임의 공식 현지 표기를 쓴다.)

`i18n.js:35` 의 `BANNER_CODE` 를 확장한다:

```js
  // 배너 short 문자열은 표시 문자열이 아니라 정규 키다. 표시할 땐 반드시
  // bannerLabel() 로 감싼다.
  const BANNER_CODE = {
    '캐릭터': 'char', '광추': 'lc', '일반': 'std', '출발': 'departure',
    '독점': 'exclusive', 'W-엔진': 'wengine', '상시': 'standard', '본디': 'bangboo',
  };
```

`nohardcode.test.js:21` 의 `ALLOW` 에 ZZZ 배너 `short` 를 추가한다:

```js
const ALLOW = /['"](캐릭터|광추|일반|출발|전체|독점|상시|본디)['"]/g;
```
(`W-엔진` 은 한글이 포함되므로 반드시 넣는다.)

`data.js` — 게임 스코프를 넣고 하드코딩 배너 코드를 role 조회로 바꾼다:

```js
  // 현재 게임. localStorage 에 저장해 새로고침에도 유지한다.
  let gameID = localStorage.getItem('hsrwarp-game') || 'hsr';
  let cfg = null; // resolveConfig 결과 — 배너 역할 조회에 쓴다

  function scheduleURL() { return gameID === 'hsr' ? '/schedule.json' : `/${gameID}/schedule.json`; }
  function q(extra) { return `game=${encodeURIComponent(gameID)}${extra ? '&' + extra : ''}`; }

  function setGame(id) {
    if (id === gameID) return;
    gameID = id;
    localStorage.setItem('hsrwarp-game', id);
    _full = _list = _fullData = cfg = null; // 캐시 무효화
  }
  function game() { return gameID; }

  // 역할로 배너를 찾는다. 게임마다 코드가 다르므로 '11'/'12' 를 쓰지 않는다.
  function byRole(role) {
    if (!cfg) return null;
    return Object.keys(cfg.banners).find((c) => cfg.banners[c].role === role) || null;
  }
```

- `init()`: `fetch(scheduleURL())` 로 바꾸고 응답 전체를 `WarpAnalyze.resolveConfig` 에 넘겨 `cfg` 에 담는다. `schedule`/`versions` 는 `cfg.list` / 응답의 `versions` 에서 취한다.
- `:37` `b.type !== '2'` → `cfg.banners[b.type].role !== 'beginner'` (역할 기반 제외)
- `:83-85` `b.type === '11'`/`'12'`/`BANNERS['11'].expAvg` → `byRole('limited-char')`/`byRole('limited-weapon')`/`cfg.banners[byRole('limited-char')].expAvg`
- `:103` `oddsOf('11')`, `oddsOf('12')` → `oddsOf(byRole('limited-char'))`, `oddsOf(byRole('limited-weapon'))`
- `:121` 의 집계 제외 필터 → 역할 기반. **HSR 현행 동작(상시·출발 제외)을 보존**하되 ZZZ 본디는 표시한다:
  ```js
  // 대시보드 집계에서 뺄 채널: 상시·초보자. 본디(bangboo)는 천장·평균이
  // 의미 있으므로 남긴다. 수집·저장은 전부 그대로다.
  const HIDDEN = ['standard', 'beginner'];
  const list = (raw.list || []).filter((r) => {
    const b = cfg && cfg.banners[String(r.gacha_type)];
    return !b || !HIDDEN.includes(b.role);
  });
  ```
- `loadStored()`/`runFetch()`/`configPath()` 의 URL 에 `?${q()}` 를 붙인다.
- `setGame`/`game` 을 반환 객체에 노출한다.

`Dashboard.jsx` — 제목 동적화와 스위처:

```jsx
      <h1>{t('game.' + gameID)} <span>{t('header.title2')}</span></h1>
```

`:92` 의 우측 컨트롤 그룹에서 언어 Select **앞**에 게임 Select 를 넣는다:

```jsx
      <Select value={gameID} onChange={(e) => changeGame(e.target.value)} aria-label="Game">
        <option value="hsr">{t('game.hsr')}</option>
        <option value="zzz">{t('game.zzz')}</option>
      </Select>
```

```jsx
  // 게임 전환은 데이터 재로드를 동반한다. setGame 이 캐시를 비우므로
  // 곧바로 loadStored 를 다시 부른다.
  const changeGame = (id) => { window.WarpData.setGame(id); setGameID(id); reload(); };
```

`gameID` 는 `useState(() => window.WarpData.game())` 로 초기화한다(`lang` 과 같은 패턴 — `lang-reactivity.test.js` 의 `ALLOW_INIT` 예외와 동일한 형태이며, `window.I18N.lang` 이 아니므로 그 검사에 걸리지 않는다).

- [ ] **Step 4: 테스트 통과를 확인한다**

Run: `npm test`
Expected: PASS — 전체 체인. 특히 `i18n.test.js`(4개 사전 키 일치), `nohardcode.test.js`, `lang-reactivity.test.js` 가 통과해야 한다.

- [ ] **Step 5: 커밋한다**

```bash
git add web/ui_kits/dashboard/
git commit -m "feat(dashboard): 게임 스위처와 게임별 용어 i18n"
```

---

### Task 10: 실제 앱으로 E2E 검증 + 문서 갱신

빌드한 exe 를 실제로 띄워 두 게임을 모두 수집·표시한다. 단위 테스트가 잡지 못하는 통합 문제를 여기서 잡는다.

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `docs/ARCHITECTURE.md` (게임 어댑터 계층, 데이터 레이아웃)

**Interfaces:**
- Consumes: 전 태스크의 산출물
- Produces: (없음 — 검증과 문서)

- [ ] **Step 1: 전체 테스트와 정적 검사를 돌린다**

```bash
npm test
node scripts/run-go.mjs vet ./...
gofmt -l .
```
Expected: 테스트 전부 PASS, `vet` 무출력, `gofmt -l` 무출력

- [ ] **Step 2: 디버그 빌드로 앱을 띄운다**

```bash
npm run build:debug
./hsr-warp-debug.exe
```

- [ ] **Step 3: 두 게임을 실제로 수집한다**

브라우저에서 대시보드를 열고:
1. 게임 스위처가 HSR/ZZZ 둘 다 보이는지
2. HSR 로 수집 — 기존 기록이 그대로 보이고(마이그레이션 성공), 신규 수집이 되는지
3. ZZZ 로 전환 후 수집 — 4개 채널이 **서로 다른** 데이터를 반환하는지(`real_gacha_type` 중복 회귀 확인). 로그에서 채널별 신규 건수가 전부 같은 값이면 회귀다
4. ZZZ S급이 최고등급으로 집계되는지(`rank_type` 4)
5. 본디 채널 카드가 보이고 픽승률이 `-` 로 표시되는지
6. `data/hsr/`·`data/zzz/` 디렉터리가 분리 생성됐고 `data/warp_*.json` 이 남아 있지 않은지

로그 확인: `logs/hsr-warp-YYYY-MM-DD.log` 에 authkey 가 절대 남지 않았는지 grep 으로 확인한다.

Expected: 6개 항목 전부 통과. 실패 항목은 해당 태스크로 돌아가 고친다.

- [ ] **Step 4: 문서를 갱신한다**

`docs/ARCHITECTURE.md` 에 다음을 반영한다: 게임 어댑터 계층(`internal/game`)의 위치와 값 테이블이 단일 소스라는 점, `data/<game>/` 레이아웃과 마이그레이션, `?game=` 라우팅, `schedule.json` 의 `ranks`/`banners` 블록이 분석 파라미터의 단일 소스라는 점, `real_gacha_type` 이 `pageKeys` 에 있어야 하는 이유.

`CHANGELOG.md` 에 항목을 추가한다.

- [ ] **Step 5: 커밋한다**

```bash
git add CHANGELOG.md docs/ARCHITECTURE.md
git commit -m "docs: ZZZ 멀티게임 지원 아키텍처와 변경 내역"
```

---

## 완료 조건

- `npm test` 전체 통과 (Go + analyze + analyze.zzz + 대시보드 + 스크립트 + 사이트)
- `node scripts/run-go.mjs vet ./...` 무출력, `gofmt -l .` 무출력
- `TestWriteAffectedMonths_PreservesUntouchedMonths` 가 **무수정으로** 통과
- `web/analyze.test.js` 가 **무수정으로** 통과 (HSR 회귀 없음)
- 실제 앱에서 두 게임 수집·표시 확인 (Task 10 Step 3의 6개 항목)
- `npm run schedule:status` 가 두 게임을 보고
