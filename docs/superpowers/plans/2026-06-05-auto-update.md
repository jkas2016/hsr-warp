# 사용자 자동 업데이트 구현 계획 (이슈 #3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 배너 데이터(SCHEDULE)는 시작 시 `main` raw 파일에서 자동 갱신(재설치 없음), 코드 변경은 GitHub 릴리스 감지 후 Inno Setup 설치본 재설치로 안내하는 콘텐츠 타입 기준 2채널 업데이트를 만든다.

**Architecture:** Go 백엔드가 `/api/updates` 첫 호출 시 두 체크(베스트에포트·캐시)를 수행한다 — (1) raw `schedule.json` 받아 검증 후 신규면 `data/schedule.json` 기록, (2) `releases/latest`(프리릴리스 자동 제외)와 `main.version` semver 비교. `analyze.js`는 `SCHEDULE`을 떼어내 `analyze(data, schedule)` 순수 함수가 되고, 데이터는 `schedule.json`(내장 기본값 + raw 갱신)으로 분리된다. 설치본은 per-user `{localappdata}` 설치(앱이 exe 옆에 쓰기 때문).

**Tech Stack:** Go(표준 라이브러리만, 외부 의존성 0), `log/slog`, `go:embed`, vanilla JS(UMD `analyze.js`), Inno Setup(`ISCC`), GitHub Actions.

> 상세 설계: `docs/superpowers/specs/2026-06-05-auto-update-design.md`

---

## 파일 구조

- 신규 `internal/updater/updater.go` — schedule 검증/선택, semver 비교, raw·릴리스 조회. 외부 통신 단일 지점.
- 신규 `internal/updater/updater_test.go` — 위 단위 테스트.
- 신규 `web/schedule.json` — `{version, schedule:[{s,e,c,l}]}`. 배너 데이터 단일 소스(내장 + raw 갱신).
- 수정 `web/analyze.js` — `SCHEDULE` 제거, `analyze(data, schedule)`/`analyzeBanner(records, meta, schedule)` 순수화.
- 수정 `web/analyze.test.js` — `schedule.json` 주입형으로.
- 수정 `web/dashboard.html` — `/schedule.json` 받아 주입, `/api/updates` 배너 렌더.
- 수정 `internal/server/server.go` — `/schedule.json`·`/api/updates` 라우트, 업데이트 체크 캐시.
- 수정 `main.go` — `schedule.json` 임베드, `NewWithAssets`에 version 전달.
- 신규 `installer/hsr-warp.iss` — Inno Setup per-user 설치 스크립트.
- 수정 `.github/workflows/release.yml` — windows 설치본 job 추가.
- 수정 `docs/ARCHITECTURE.md` — 단일 소스 규칙 갱신 + 업데이트 채널 기술.

각 태스크는 커밋 단위로 독립적으로 동작·테스트 가능하다. **Task 2는 Task 3보다 먼저** 실행해야 한다(`schedule.json`을 아직 `SCHEDULE`을 export 하는 `analyze.js`에서 추출하므로).

---

### Task 1: updater 패키지 — schedule 검증·선택 (순수)

**Files:**
- Create: `internal/updater/updater.go`
- Test: `internal/updater/updater_test.go`

- [ ] **Step 1: 실패 테스트 작성**

`internal/updater/updater_test.go`:

```go
package updater

import (
	"os"
	"path/filepath"
	"testing"
)

const goodSchedule = `{"version":3,"schedule":[{"s":"2023-04-26","e":"2023-05-17","c":["1102"],"l":["23001"]}]}`

func TestScheduleVersion(t *testing.T) {
	if v, ok := ScheduleVersion([]byte(goodSchedule)); !ok || v != 3 {
		t.Fatalf("good: got (%d,%v), want (3,true)", v, ok)
	}
	bad := []string{
		`not json`,
		`{"version":0,"schedule":[]}`,                                  // version<1
		`{"version":2,"schedule":[]}`,                                  // 빈 배열
		`{"version":2,"schedule":[{"s":"nope","e":"2023-05-17"}]}`,     // 날짜 파싱 불가
	}
	for _, b := range bad {
		if _, ok := ScheduleVersion([]byte(b)); ok {
			t.Fatalf("expected invalid: %s", b)
		}
	}
}

func TestEffectiveSchedule(t *testing.T) {
	embedded := []byte(`{"version":3,"schedule":[{"s":"2023-04-26","e":"2023-05-17","c":["1102"],"l":["23001"]}]}`)
	dir := t.TempDir()
	// data/ 없음 → 내장본.
	if got := EffectiveSchedule(dir, embedded); string(got) != string(embedded) {
		t.Fatal("missing data/ should fall back to embedded")
	}
	// data/ 가 더 높은 version → data/.
	higher := []byte(`{"version":5,"schedule":[{"s":"2023-04-26","e":"2023-05-17","c":["1102"],"l":["23001"]}]}`)
	if err := os.WriteFile(filepath.Join(dir, "schedule.json"), higher, 0644); err != nil {
		t.Fatal(err)
	}
	if got := EffectiveSchedule(dir, embedded); string(got) != string(higher) {
		t.Fatal("higher data/ should win")
	}
	// data/ 가 같거나 낮으면 내장본.
	lower := []byte(`{"version":3,"schedule":[{"s":"2023-04-26","e":"2023-05-17","c":["1102"],"l":["23001"]}]}`)
	_ = os.WriteFile(filepath.Join(dir, "schedule.json"), lower, 0644)
	if got := EffectiveSchedule(dir, embedded); string(got) != string(embedded) {
		t.Fatal("equal/lower data/ should fall back to embedded")
	}
	// data/ 가 깨졌으면 내장본.
	_ = os.WriteFile(filepath.Join(dir, "schedule.json"), []byte("corrupt"), 0644)
	if got := EffectiveSchedule(dir, embedded); string(got) != string(embedded) {
		t.Fatal("corrupt data/ should fall back to embedded")
	}
}
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `go test ./internal/updater/ -run 'TestScheduleVersion|TestEffectiveSchedule' -v`
Expected: FAIL (`undefined: ScheduleVersion`).

- [ ] **Step 3: 최소 구현**

`internal/updater/updater.go`:

```go
// Package updater 는 시작 시 두 업데이트를 베스트에포트로 확인한다:
// (1) 배너 데이터(schedule.json) — main raw 파일에서 받아 신규면 data/ 에 기록(인앱 갱신).
// (2) 코드 버전 — GitHub releases/latest 와 main.version 을 semver 비교(설치본 재설치 안내).
// 외부 통신은 전부 이 패키지에서만 일어난다. 실패는 예상된 동작이라 호출부에서 Warn 으로 남긴다.
package updater

import (
	"encoding/json"
	"os"
	"path/filepath"
	"time"
)

type scheduleFile struct {
	Version  int `json:"version"`
	Schedule []struct {
		S string   `json:"s"`
		E string   `json:"e"`
		C []string `json:"c"`
		L []string `json:"l"`
	} `json:"schedule"`
}

// ScheduleVersion 은 schedule.json 바이트를 검증하고 version 을 돌려준다.
// 구조가 깨졌거나 version<1 이거나 항목이 없거나 s/e 가 YYYY-MM-DD 로 파싱 불가면 ok=false.
func ScheduleVersion(b []byte) (int, bool) {
	var f scheduleFile
	if err := json.Unmarshal(b, &f); err != nil {
		return 0, false
	}
	if f.Version < 1 || len(f.Schedule) == 0 {
		return 0, false
	}
	for _, e := range f.Schedule {
		if _, err := time.Parse("2006-01-02", e.S); err != nil {
			return 0, false
		}
		if _, err := time.Parse("2006-01-02", e.E); err != nil {
			return 0, false
		}
	}
	return f.Version, true
}

// EffectiveSchedule 는 서빙할 schedule.json 바이트를 고른다:
// data/schedule.json 이 유효하고 version 이 내장본보다 크면 그걸, 아니면 내장본.
func EffectiveSchedule(dataDir string, embedded []byte) []byte {
	b, err := os.ReadFile(filepath.Join(dataDir, "schedule.json"))
	if err != nil {
		return embedded
	}
	rv, rok := ScheduleVersion(b)
	ev, _ := ScheduleVersion(embedded)
	if rok && rv > ev {
		return b
	}
	return embedded
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `go test ./internal/updater/ -run 'TestScheduleVersion|TestEffectiveSchedule' -v`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add internal/updater/updater.go internal/updater/updater_test.go
git commit -m "feat: updater 패키지 schedule 검증·선택 (#3)"
```

---

### Task 2: schedule.json 생성 + 임베드 + /schedule.json 서빙

**Files:**
- Create: `web/schedule.json` (현재 `analyze.js`의 `SCHEDULE`에서 추출 — 전사 오류 방지)
- Modify: `main.go:27` (go:embed 목록)
- Modify: `internal/server/server.go` (라우트 + 핸들러)
- Test: `internal/server/server_test.go` (신규 테스트 추가)

- [ ] **Step 1: SCHEDULE → schedule.json 추출**

저장소 루트에서 실행(아직 `analyze.js`가 `SCHEDULE`을 export 하는 상태여야 함):

```bash
node -e "const {SCHEDULE}=require('./web/analyze.js');const fs=require('fs');fs.writeFileSync('web/schedule.json',JSON.stringify({version:1,schedule:SCHEDULE},null,0)+'\n');console.log('entries',SCHEDULE.length);"
```

Expected: `entries 57` (또는 현재 항목 수) 출력, `web/schedule.json` 생성.

- [ ] **Step 2: 추출 검증(임시)**

```bash
node -e "const j=require('./web/schedule.json');if(j.version!==1)throw'version';if(!Array.isArray(j.schedule)||!j.schedule.length)throw'schedule';if(j.schedule[0].c[0]!=='1102')throw'first entry';console.log('OK',j.schedule.length);"
```

Expected: `OK 57` (첫 항목 `c:['1102']` 확인).

- [ ] **Step 3: 실패 테스트 작성 (/schedule.json 서빙)**

`internal/server/server_test.go` 파일 끝에 추가:

```go
func TestHandleSchedule_DataOverridesEmbedded(t *testing.T) {
	embedded := []byte(`{"version":1,"schedule":[{"s":"2023-04-26","e":"2023-05-17","c":["1102"],"l":["23001"]}]}`)
	assets := fstest.MapFS{"schedule.json": {Data: embedded}}
	dir := t.TempDir()
	s := NewWithAssets(Paths{DataDir: dir, ConfigFile: filepath.Join(dir, "config.json")}, assets, "dev")

	// data/ 없음 → 내장본.
	rr := httptest.NewRecorder()
	s.Handler().ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/schedule.json", nil))
	if !strings.Contains(rr.Body.String(), `"version":1`) {
		t.Fatalf("expected embedded v1, got %s", rr.Body.String())
	}

	// 더 높은 data/ → data/.
	higher := []byte(`{"version":9,"schedule":[{"s":"2023-04-26","e":"2023-05-17","c":["1102"],"l":["23001"]}]}`)
	if err := os.WriteFile(filepath.Join(dir, "schedule.json"), higher, 0644); err != nil {
		t.Fatal(err)
	}
	rr = httptest.NewRecorder()
	s.Handler().ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/schedule.json", nil))
	if !strings.Contains(rr.Body.String(), `"version":9`) {
		t.Fatalf("expected data/ v9, got %s", rr.Body.String())
	}
}
```

`internal/server/server_test.go` import 블록에 `"os"`, `"testing/fstest"` 추가(이미 있으면 생략).

> 주의: 이 테스트는 `NewWithAssets`가 3번째 인자 `version`을 받도록 요구한다(Task 7에서 시그니처 확정). 이 태스크에서 `NewWithAssets`를 3-인자로 먼저 바꾼다.

- [ ] **Step 4: 테스트 실패 확인**

Run: `go test ./internal/server/ -run TestHandleSchedule_DataOverridesEmbedded -v`
Expected: FAIL (컴파일 에러: `NewWithAssets` 인자 수 / `handleSchedule` 미정의).

- [ ] **Step 5: 구현 — embed + 라우트 + 핸들러 + 시그니처**

`main.go:27` 의 go:embed 한 줄을 교체:

```go
//go:embed web/dashboard.html web/analyze.js web/schedule.json web/favicon.ico web/favicon.svg
```

`internal/server/server.go` 상단 import 에 `"hsr-warp/internal/updater"` 추가.

`NewWithAssets`를 version 인자를 받게 바꾸고 `version` 필드를 추가:

```go
// Server 는 대시보드와 API 를 제공한다.
type Server struct {
	paths   Paths
	assets  fs.FS // web/ (dashboard.html, analyze.js, schedule.json). nil 이면 자산 라우트 비활성(테스트용).
	version string
}

// New 는 자산 없이 Server 를 만든다(API 테스트용).
func New(p Paths) *Server { return &Server{paths: p} }

// NewWithAssets 는 임베드 자산과 빌드 버전을 주입한다(실제 실행용).
func NewWithAssets(p Paths, assets fs.FS, version string) *Server {
	return &Server{paths: p, assets: assets, version: version}
}
```

`Handler()` 의 라우트 등록부에 `/schedule.json` 추가(ServeMux 는 더 긴 패턴을 우선하므로 `/` FileServer 보다 먼저 매칭됨):

```go
	mux.HandleFunc("/api/fetch", s.handleFetch)
	mux.HandleFunc("/schedule.json", s.handleSchedule)
	if s.assets != nil {
```

핸들러 추가(파일 하단, `handleFetch` 뒤):

```go
// handleSchedule 은 배너 일정 데이터를 서빙한다. data/schedule.json 이 유효하고 내장본보다
// version 이 높으면 그걸, 아니면 내장본을 준다(updater.EffectiveSchedule).
func (s *Server) handleSchedule(w http.ResponseWriter, r *http.Request) {
	var emb []byte
	if s.assets != nil {
		emb, _ = fs.ReadFile(s.assets, "schedule.json")
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_, _ = w.Write(updater.EffectiveSchedule(s.paths.DataDir, emb))
}
```

`main.go:144` 의 호출을 3-인자로:

```go
	srv := server.NewWithAssets(paths, assets, version)
```

- [ ] **Step 6: 테스트 통과 + 전체 빌드 확인**

Run: `go test ./internal/server/ -run TestHandleSchedule_DataOverridesEmbedded -v && go build ./...`
Expected: PASS, 빌드 성공.

- [ ] **Step 7: 커밋**

```bash
git add web/schedule.json main.go internal/server/server.go internal/server/server_test.go
git commit -m "feat: schedule.json 분리·임베드 + /schedule.json 서빙 (#3)"
```

---

### Task 3: analyze.js 데이터/로직 분리 + 대시보드 주입

**Files:**
- Modify: `web/analyze.js` (SCHEDULE 제거, 시그니처 변경)
- Modify: `web/analyze.test.js` (schedule.json 주입형)
- Modify: `web/dashboard.html` (`/schedule.json` 받아 주입)

- [ ] **Step 1: 테스트를 주입형으로 교체(실패 테스트)**

`web/analyze.test.js` 전체를 아래로 교체:

```js
const assert = require('assert');
const { analyzeBanner, analyze, monthly, BANNERS } = require('./analyze.js');
const { schedule } = require('./schedule.json'); // 배너 일정은 데이터 파일에서 주입

let id = 1000n;
// 3.7 phase 1 (2025-11-04..11-25): featured char includes 1415,1409 ; featured lc includes 23052.
const T = '2025-11-10 12:00:00';
const r5 = (item_id, time = T) => ({ id: String(id++), rank_type: '5', item_id: String(item_id), name: 'x', item_type: 'C', time, gacha_type: '11' });
const r34 = (rank, time = T) => ({ id: String(id++), rank_type: String(rank), item_id: '0', name: 'y', item_type: 'C', time, gacha_type: '11' });

// ---- pity ----
const seq = ['3', '3', '3', '4', '3'].map(r => r34(r)).concat([r5(1415)]); // 6 pulls, 5* at pity 6
const b = analyzeBanner(seq, BANNERS['11'], schedule);
assert.strictEqual(b.total, 6);
assert.strictEqual(b.count5, 1);
assert.strictEqual(b.fives[0].pity, 6, 'pity counts the winning pull');
assert.strictEqual(b.currentPity5, 0, 'reset after 5*');

// ---- 50/50 (schedule-based, all within 3.7 p1): loss -> guaranteed win -> contested win -> loss ----
id = 5000n;
const banner11 = [
  r5(1102),  // Seele NOT featured in 3.7 -> contested LOSS -> guaranteed
  r5(1415),  // featured -> guaranteed WIN
  r5(1409),  // featured -> contested WIN
  r5(1102),  // not featured -> contested LOSS -> guaranteed
];
const s = analyzeBanner(banner11, BANNERS['11'], schedule);
assert.strictEqual(s.contested, 3, '3 contested (#1,#3,#4)');
assert.strictEqual(s.cWins, 1, '1 contested win');
assert.strictEqual(s.cLoss, 2, '2 contested losses');
assert.strictEqual(s.gWins, 1, '1 guaranteed win');
assert.strictEqual(s.pickupTotal, 2, 'featured obtained = contested wins + guaranteed wins');
assert.ok(Math.abs(s.win5050Rate - 1 / 3) < 1e-9, '50/50 win rate = 1/3');
assert.strictEqual(s.currentGuaranteed, true, 'ends on loss -> next guaranteed');
assert.deepStrictEqual(s.fives.map(f => f.result), ['loss', 'guaranteed', 'win', 'loss']);
assert.deepStrictEqual(s.fives.map(f => f.isPickup), [false, true, true, false]);
assert.strictEqual(s.unknown5, 0, 'all ids covered by schedule');

// ---- core fix: win/loss depends on TIME, not pool membership ----
id = 5200n;
const win10 = analyzeBanner([r5(1102, '2023-05-01 00:00:00')], BANNERS['11'], schedule); // 1.0 p1: Seele featured
assert.strictEqual(win10.fives[0].result, 'win', 'Seele during 1.0 p1 = 픽승');
const loss37 = analyzeBanner([r5(1102, '2025-11-10 00:00:00')], BANNERS['11'], schedule); // 3.7 p1: not featured
assert.strictEqual(loss37.fives[0].result, 'loss', 'Seele during 3.7 p1 = 픽뚫');

// ---- unidentified: time outside the known schedule ----
id = 5500n;
const u = analyzeBanner([r5(1415, '2030-01-01 00:00:00')], BANNERS['11'], schedule);
assert.strictEqual(u.fives[0].unidentified, true, 'no period -> unidentified');
assert.strictEqual(u.fives[0].result, null, 'unidentified not classified');
assert.strictEqual(u.fives[0].isPickup, null);
assert.strictEqual(u.unknown5, 1);
assert.strictEqual(u.contested, 0, 'unidentified excluded from 50/50');

// ---- light cone (banner 12), 3.7 p1: 23052 featured, 23000 standard ----
const r5lc = (iid, time = T) => ({ id: String(id++), rank_type: '5', item_id: String(iid), name: 'z', item_type: 'L', time, gacha_type: '12' });
const banner12 = [r5lc(23000) /*standard -> loss*/, r5lc(23052) /*featured -> guaranteed*/];
const sl = analyzeBanner(banner12, BANNERS['12'], schedule);
assert.deepStrictEqual(sl.fives.map(f => f.result), ['loss', 'guaranteed'], 'LC: loss then guaranteed');
assert.strictEqual(sl.unknown5, 0);

// ---- luck (소프트천장/early 제거 확인) ----
id = 6000n;
const lk = analyzeBanner([r5(1415)], BANNERS['11'], schedule); // pity 1, featured -> 픽승, 매우 행운
assert.ok(lk.luckPct > 90, 'pity 1 is ~98% luckier than 62.5 avg');
assert.strictEqual(lk.fives[0].result, 'win');
assert.ok(!('earlyCount' in lk), 'soft-pity earlyCount removed');
assert.ok(!('earlyRate' in lk), 'soft-pity earlyRate removed');

// ---- monthly bucketing ----
const mlist = [
  { rank_type: '5', gacha_type: '11', name: 'a', time: '2025-01-15 10:00:00' },
  { rank_type: '3', gacha_type: '11', name: 'b', time: '2025-01-20 10:00:00' },
  { rank_type: '4', gacha_type: '12', name: 'c', time: '2025-02-02 10:00:00' },
];
const mo = monthly(mlist);
assert.strictEqual(mo.length, 2, 'two months');
assert.strictEqual(mo[0].month, '202501');
assert.strictEqual(mo[0].total, 2);
assert.strictEqual(mo[0].c5, 1);
assert.strictEqual(mo[0].jade, 320);
assert.strictEqual(mo[1].month, '202502');

// ---- analyze() integration ----
id = 7000n;
const data = { info: { uid: '1' }, list: [r5(1102), r5(1415), r34(3), { ...r5lc(23000) }] };
const A = analyze(data, schedule);
assert.ok(A.banners.length >= 1);
assert.strictEqual(A.count5, 3);
assert.strictEqual(A.unknown5, 0, 'account-wide unknown5 exposed');
assert.ok(A.luck.charBanner, 'char banner luck present');
assert.ok(A.all5[0].time >= A.all5[A.all5.length - 1].time, 'all5 newest first');

// ---- schedule 누락 방어: throw 없이 모두 unidentified ----
id = 8000n;
const noSched = analyzeBanner([r5(1415)], BANNERS['11'], []);
assert.strictEqual(noSched.fives[0].unidentified, true, 'empty schedule -> unidentified, no throw');

console.log('OK  all analyze tests passed');
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node web/analyze.test.js`
Expected: FAIL — 현재 `analyzeBanner`는 schedule 인자를 무시하고 내부 SCHEDULE을 쓰므로, 추가한 `noSched`(빈 schedule) 케이스가 `unidentified:false`로 떨어져 실패한다.

- [ ] **Step 3: analyze.js 리팩터 — SCHEDULE 제거 + schedule 주입**

`web/analyze.js`에서 다음을 적용한다.

(a) `const SCHEDULE = [ … ];` 블록(라인 11–69)과 바로 위 주석 3줄(라인 8–10), 그리고 `const SCHED_END = …;`(라인 80)을 **삭제**한다.

(b) `wasPickup` 시그니처와 루프를 교체:

```js
  function wasPickup(id, t, poolKey, schedule) {
    for (const p of schedule) {
```

(c) `analyzeBanner` 시그니처 교체 + 함수 본문 첫 줄에 `schedEnd` 계산 추가:

```js
  function analyzeBanner(records, meta, schedule) {
    schedule = schedule || [];
    const schedEnd = schedule.length ? Date.parse(schedule[schedule.length - 1].e) : 0;
    const list = records.slice().sort(byId);
```

(d) `analyzeBanner` 안의 두 참조 교체:
- `if (!(t < SCHED_END))` → `if (!(t < schedEnd))`
- `f.isPickup = wasPickup(id, t, poolKey);` → `f.isPickup = wasPickup(id, t, poolKey, schedule);`

(e) `analyze` 시그니처 + 호출 교체:

```js
  function analyze(data, schedule) {
```
그리고 `.map(k => ({ type: k, meta: BANNERS[k], stats: analyzeBanner(groups[k], BANNERS[k]) }))` →
`.map(k => ({ type: k, meta: BANNERS[k], stats: analyzeBanner(groups[k], BANNERS[k], schedule) }))`

(f) api export 에서 `SCHEDULE` 제거:

```js
  const api = { analyze, analyzeBanner, monthly, BANNERS, ORDER };
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node web/analyze.test.js`
Expected: `OK  all analyze tests passed`.

- [ ] **Step 5: 대시보드가 /schedule.json 을 받아 주입**

`web/dashboard.html` 의 `let charts=[];`(라인 104) 바로 아래에 추가:

```js
let scheduleData=[];
```

`loadStored` 함수(라인 116–120)를 교체:

```js
function loadStored(){
  fetch('/schedule.json').then(r=>r.json()).then(j=>{scheduleData=(j&&j.schedule)||[];}).catch(()=>{}).finally(()=>{
    fetch('/api/data').then(r=>r.json()).then(d=>{
      if(d&&Array.isArray(d.list)&&d.list.length)render(WarpAnalyze.analyze(d,scheduleData));
    }).catch(()=>{});
  });
}
```

runFetch 의 done 핸들러(라인 149) 교체:

```js
    if(d.data&&Array.isArray(d.data.list))render(WarpAnalyze.analyze(d.data,scheduleData));
```

미확인 경고 문구(라인 173) 중 `analyze.js의 SCHEDULE를 갱신하세요.` 를 `최신 배너는 시작 시 자동 반영됩니다(미반영 시 잠시 후 재실행).` 로 교체.

- [ ] **Step 6: 라이브 렌더 확인 (chrome-devtools-mcp)**

`go build -ldflags="-s -w" -o hsr-warp.exe .` 후 실행(또는 로컬 서버), 대시보드를 열어 기존 데이터가 있으면 정상 렌더되고 콘솔 에러가 없음을 확인. (데이터 없으면 `/schedule.json` 200 응답만 확인.)

- [ ] **Step 7: 커밋**

```bash
git add web/analyze.js web/analyze.test.js web/dashboard.html
git commit -m "refactor: analyze.js SCHEDULE 분리, schedule 주입 (#3)"
```

---

### Task 4: updater — semver 비교

**Files:**
- Modify: `internal/updater/updater.go`
- Test: `internal/updater/updater_test.go`

- [ ] **Step 1: 실패 테스트 작성**

`internal/updater/updater_test.go` 에 추가:

```go
func TestCompareVersions(t *testing.T) {
	cases := []struct {
		a, b string
		want int
	}{
		{"v1.4.0", "1.4.0", 0},
		{"1.4.1", "1.4.0", 1},
		{"1.4.0", "1.5.0", -1},
		{"1.10.0", "1.9.0", 1}, // 숫자 비교(문자열 아님)
		{"2.0.0", "1.99.99", 1},
		{"v1.2.3-snapshot", "1.2.3", 0}, // 프리릴리스 꼬리표 무시
		{"1.2", "1.2.0", 0},             // 빠진 자리는 0
	}
	for _, c := range cases {
		if got := CompareVersions(c.a, c.b); got != c.want {
			t.Fatalf("CompareVersions(%q,%q)=%d, want %d", c.a, c.b, got, c.want)
		}
	}
}
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `go test ./internal/updater/ -run TestCompareVersions -v`
Expected: FAIL (`undefined: CompareVersions`).

- [ ] **Step 3: 구현**

`internal/updater/updater.go` import 에 `"strconv"`, `"strings"` 추가. 함수 추가:

```go
// CompareVersions 는 semver 두 개를 비교한다(-1/0/1). 앞의 'v' 무시, X.Y.Z 정수 비교, 빠진 자리는 0,
// '-'/'+' 이후(프리릴리스·빌드메타)는 무시. 외부 의존성 없이 처리한다.
func CompareVersions(a, b string) int {
	pa, pb := parseVer(a), parseVer(b)
	for i := 0; i < 3; i++ {
		if pa[i] < pb[i] {
			return -1
		}
		if pa[i] > pb[i] {
			return 1
		}
	}
	return 0
}

func parseVer(s string) [3]int {
	s = strings.TrimPrefix(strings.TrimSpace(s), "v")
	if i := strings.IndexAny(s, "-+"); i >= 0 {
		s = s[:i]
	}
	var out [3]int
	for i, part := range strings.SplitN(s, ".", 3) {
		n, _ := strconv.Atoi(part)
		out[i] = n
	}
	return out
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `go test ./internal/updater/ -run TestCompareVersions -v`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add internal/updater/updater.go internal/updater/updater_test.go
git commit -m "feat: updater semver 비교 (#3)"
```

---

### Task 5: updater — CheckRelease (코드 채널 감지)

**Files:**
- Modify: `internal/updater/updater.go`
- Test: `internal/updater/updater_test.go`

- [ ] **Step 1: 실패 테스트 작성**

`internal/updater/updater_test.go` import 에 `"net/http"`, `"net/http/httptest"` 추가. 테스트 추가:

```go
func releaseServer(t *testing.T, body string) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(body))
	}))
}

func TestCheckRelease(t *testing.T) {
	body := `{"tag_name":"v1.5.0","html_url":"https://example/releases/v1.5.0","assets":[{"name":"hsr-warp-setup-1.5.0.exe","browser_download_url":"https://example/setup.exe"},{"name":"hsr-warp_1.5.0_windows_amd64.zip","browser_download_url":"https://example/zip"}]}`
	srv := releaseServer(t, body)
	defer srv.Close()
	client := srv.Client()

	// 더 높은 버전 → newer, setup 자산 URL.
	got, err := CheckRelease(client, srv.URL, "1.4.0")
	if err != nil {
		t.Fatal(err)
	}
	if !got.Newer || got.Version != "1.5.0" || got.URL != "https://example/setup.exe" {
		t.Fatalf("got %+v", got)
	}

	// 같은 버전 → not newer.
	if got, _ := CheckRelease(client, srv.URL, "1.5.0"); got.Newer {
		t.Fatalf("equal should not be newer: %+v", got)
	}

	// dev → 스킵(외부 호출 없이 빈 결과).
	if got, _ := CheckRelease(client, srv.URL, "dev"); got.Newer {
		t.Fatalf("dev should skip: %+v", got)
	}
}

func TestCheckRelease_NoSetupAssetFallsBackToHTMLURL(t *testing.T) {
	body := `{"tag_name":"v2.0.0","html_url":"https://example/releases/v2.0.0","assets":[{"name":"hsr-warp_2.0.0_windows_amd64.zip","browser_download_url":"https://example/zip"}]}`
	srv := releaseServer(t, body)
	defer srv.Close()
	got, _ := CheckRelease(srv.Client(), srv.URL, "1.0.0")
	if !got.Newer || got.URL != "https://example/releases/v2.0.0" {
		t.Fatalf("expected html_url fallback, got %+v", got)
	}
}
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `go test ./internal/updater/ -run TestCheckRelease -v`
Expected: FAIL (`undefined: CheckRelease`).

- [ ] **Step 3: 구현**

`internal/updater/updater.go` import 에 `"io"` 추가. 추가:

```go
// CodeStatus 는 코드 채널 결과다.
type CodeStatus struct {
	Newer   bool   `json:"newer"`
	Version string `json:"version"`
	URL     string `json:"url"`
}

type release struct {
	TagName string `json:"tag_name"`
	HTMLURL string `json:"html_url"`
	Assets  []struct {
		Name string `json:"name"`
		URL  string `json:"browser_download_url"`
	} `json:"assets"`
}

// CheckRelease 는 releases/latest(프리릴리스·드래프트 제외) 와 current 를 semver 비교한다.
// current 가 "" 또는 "dev" 면 외부 호출 없이 스킵. setup 자산이 있으면 그 URL, 없으면 릴리스 페이지.
func CheckRelease(client *http.Client, apiURL, current string) (CodeStatus, error) {
	if current == "" || current == "dev" {
		return CodeStatus{}, nil
	}
	b, err := fetch(client, apiURL)
	if err != nil {
		return CodeStatus{}, err
	}
	var rel release
	if err := json.Unmarshal(b, &rel); err != nil {
		return CodeStatus{}, err
	}
	if rel.TagName == "" || CompareVersions(rel.TagName, current) <= 0 {
		return CodeStatus{}, nil
	}
	url := rel.HTMLURL
	for _, a := range rel.Assets {
		n := strings.ToLower(a.Name)
		if strings.Contains(n, "setup") && strings.HasSuffix(n, ".exe") {
			url = a.URL
			break
		}
	}
	return CodeStatus{Newer: true, Version: strings.TrimPrefix(rel.TagName, "v"), URL: url}, nil
}

func fetch(client *http.Client, url string) ([]byte, error) {
	resp, err := client.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status %d", resp.StatusCode)
	}
	return io.ReadAll(io.LimitReader(resp.Body, 1<<20)) // 1MB 상한
}
```

import 에 `"fmt"`, `"net/http"` 추가.

- [ ] **Step 4: 테스트 통과 확인**

Run: `go test ./internal/updater/ -run TestCheckRelease -v`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add internal/updater/updater.go internal/updater/updater_test.go
git commit -m "feat: updater CheckRelease 코드 채널 감지 (#3)"
```

---

### Task 6: updater — CheckSchedule (데이터 채널 갱신)

**Files:**
- Modify: `internal/updater/updater.go`
- Test: `internal/updater/updater_test.go`

- [ ] **Step 1: 실패 테스트 작성**

`internal/updater/updater_test.go` 에 추가:

```go
func TestCheckSchedule(t *testing.T) {
	embedded := []byte(`{"version":3,"schedule":[{"s":"2023-04-26","e":"2023-05-17","c":["1102"],"l":["23001"]}]}`)
	remote := `{"version":7,"schedule":[{"s":"2023-04-26","e":"2023-05-17","c":["1102"],"l":["23001"]}]}`
	srv := releaseServer(t, remote)
	defer srv.Close()
	dir := t.TempDir()

	// 원격이 더 높음 → data/ 기록 + Updated.
	got, err := CheckSchedule(srv.Client(), srv.URL, dir, embedded)
	if err != nil {
		t.Fatal(err)
	}
	if !got.Updated || got.Version != 7 {
		t.Fatalf("got %+v", got)
	}
	wrote, _ := os.ReadFile(filepath.Join(dir, "schedule.json"))
	if v, _ := ScheduleVersion(wrote); v != 7 {
		t.Fatalf("data/schedule.json version=%d, want 7", v)
	}

	// 다시 호출 → 같은 version 이라 미갱신.
	if got, _ := CheckSchedule(srv.Client(), srv.URL, dir, embedded); got.Updated {
		t.Fatalf("second call should not update: %+v", got)
	}
}

func TestCheckSchedule_InvalidRemoteIgnored(t *testing.T) {
	embedded := []byte(`{"version":3,"schedule":[{"s":"2023-04-26","e":"2023-05-17","c":["1102"],"l":["23001"]}]}`)
	srv := releaseServer(t, `garbage`)
	defer srv.Close()
	dir := t.TempDir()
	got, err := CheckSchedule(srv.Client(), srv.URL, dir, embedded)
	if err != nil || got.Updated {
		t.Fatalf("invalid remote should be ignored: got %+v err %v", got, err)
	}
	if _, err := os.Stat(filepath.Join(dir, "schedule.json")); err == nil {
		t.Fatal("should not write data/schedule.json for invalid remote")
	}
}
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `go test ./internal/updater/ -run TestCheckSchedule -v`
Expected: FAIL (`undefined: CheckSchedule`).

- [ ] **Step 3: 구현**

`internal/updater/updater.go` 에 추가:

```go
// ScheduleStatus 는 데이터 채널 결과다.
type ScheduleStatus struct {
	Updated bool `json:"updated"`
	Version int  `json:"version"`
}

// CheckSchedule 은 rawURL 에서 schedule.json 을 받아 검증하고, 현재 유효 version 보다 높으면
// data/schedule.json 에 원자적으로 기록한다(인앱 갱신). 깨진 응답·동일/구버전은 무시(에러 아님).
func CheckSchedule(client *http.Client, rawURL, dataDir string, embedded []byte) (ScheduleStatus, error) {
	cur, _ := ScheduleVersion(EffectiveSchedule(dataDir, embedded))
	b, err := fetch(client, rawURL)
	if err != nil {
		return ScheduleStatus{Version: cur}, err
	}
	v, ok := ScheduleVersion(b)
	if !ok || v <= cur {
		return ScheduleStatus{Version: cur}, nil
	}
	if err := writeAtomic(filepath.Join(dataDir, "schedule.json"), b); err != nil {
		return ScheduleStatus{Version: cur}, err
	}
	return ScheduleStatus{Updated: true, Version: v}, nil
}

func writeAtomic(path string, b []byte) error {
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, b, 0644); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}
```

- [ ] **Step 4: 테스트 통과 + 패키지 전체 테스트**

Run: `go test ./internal/updater/ -v`
Expected: 모든 테스트 PASS.

- [ ] **Step 5: 커밋**

```bash
git add internal/updater/updater.go internal/updater/updater_test.go
git commit -m "feat: updater CheckSchedule 데이터 채널 갱신 (#3)"
```

---

### Task 7: /api/updates 엔드포인트 + 캐시 + 와이어링

**Files:**
- Modify: `internal/server/server.go`
- Test: `internal/server/server_test.go`

- [ ] **Step 1: 실패 테스트 작성**

`internal/server/server_test.go` 에 추가:

```go
func TestHandleUpdates_ReturnsBothChannels(t *testing.T) {
	dir := t.TempDir()
	embedded := []byte(`{"version":1,"schedule":[{"s":"2023-04-26","e":"2023-05-17","c":["1102"],"l":["23001"]}]}`)
	assets := fstest.MapFS{"schedule.json": {Data: embedded}}
	s := NewWithAssets(Paths{DataDir: dir, ConfigFile: filepath.Join(dir, "config.json")}, assets, "1.0.0")

	// 외부 소스를 httptest 로 주입(같은 패키지라 필드 직접 설정).
	sched := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"version":5,"schedule":[{"s":"2023-04-26","e":"2023-05-17","c":["1102"],"l":["23001"]}]}`))
	}))
	defer sched.Close()
	rel := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"tag_name":"v1.2.0","html_url":"https://example/r","assets":[]}`))
	}))
	defer rel.Close()
	s.scheduleURL, s.releaseURL, s.client = sched.URL, rel.URL, sched.Client()

	rr := httptest.NewRecorder()
	s.Handler().ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/api/updates", nil))
	if rr.Code != 200 {
		t.Fatalf("status %d", rr.Code)
	}
	var got struct {
		Schedule struct {
			Updated bool `json:"updated"`
			Version int  `json:"version"`
		} `json:"schedule"`
		Code struct {
			Newer   bool   `json:"newer"`
			Version string `json:"version"`
		} `json:"code"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if !got.Schedule.Updated || got.Schedule.Version != 5 {
		t.Fatalf("schedule: %+v", got.Schedule)
	}
	if !got.Code.Newer || got.Code.Version != "1.2.0" {
		t.Fatalf("code: %+v", got.Code)
	}
}
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `go test ./internal/server/ -run TestHandleUpdates_ReturnsBothChannels -v`
Expected: FAIL (컴파일 에러: `s.scheduleURL` 등 미정의).

- [ ] **Step 3: 구현 — 필드·기본값·핸들러**

`internal/server/server.go` import 에 `"sync"`, `"time"` 추가(`time` 이 이미 있으면 생략).

`Server` 구조체와 생성자를 교체:

```go
const (
	defaultScheduleURL = "https://raw.githubusercontent.com/jkas2016/hsr-warp/main/web/schedule.json"
	defaultReleaseURL  = "https://api.github.com/repos/jkas2016/hsr-warp/releases/latest"
)

// Server 는 대시보드와 API 를 제공한다.
type Server struct {
	paths       Paths
	assets      fs.FS // web/ (dashboard.html, analyze.js, schedule.json). nil 이면 자산 라우트 비활성(테스트용).
	version     string
	scheduleURL string
	releaseURL  string
	client      *http.Client
	once        sync.Once
	cached      updater.Updates
}

// New 는 자산 없이 Server 를 만든다(API 테스트용).
func New(p Paths) *Server { return newServer(p, nil, "") }

// NewWithAssets 는 임베드 자산과 빌드 버전을 주입한다(실제 실행용).
func NewWithAssets(p Paths, assets fs.FS, version string) *Server { return newServer(p, assets, version) }

func newServer(p Paths, assets fs.FS, version string) *Server {
	return &Server{
		paths: p, assets: assets, version: version,
		scheduleURL: defaultScheduleURL, releaseURL: defaultReleaseURL,
		client: &http.Client{Timeout: 5 * time.Second},
	}
}
```

`Handler()` 라우트에 추가(`/schedule.json`은 Task 2에서 이미 등록했으므로 **`/api/updates`만** 추가 — 같은 패턴 중복 등록은 mux panic):

```go
	mux.HandleFunc("/api/updates", s.handleUpdates)
```

핸들러 추가:

```go
// handleUpdates 는 첫 호출 시 두 업데이트 체크를 베스트에포트로 수행하고 프로세스 수명 동안 캐시한다.
// 대시보드가 시작 직후 1회 호출 → "시작 시 자동 확인". 실패는 예상된 동작이라 Warn 으로만 남긴다.
func (s *Server) handleUpdates(w http.ResponseWriter, r *http.Request) {
	s.once.Do(func() {
		var emb []byte
		if s.assets != nil {
			emb, _ = fs.ReadFile(s.assets, "schedule.json")
		}
		sch, err := updater.CheckSchedule(s.client, s.scheduleURL, s.paths.DataDir, emb)
		if err != nil {
			slog.Warn("배너 데이터 업데이트 확인 실패", "err", err)
		}
		code, err := updater.CheckRelease(s.client, s.releaseURL, s.version)
		if err != nil {
			slog.Warn("릴리스 업데이트 확인 실패", "err", err)
		}
		s.cached = updater.Updates{Schedule: sch, Code: code}
	})
	writeJSON(w, s.cached)
}
```

`internal/updater/updater.go` 에 `Updates` 타입 추가:

```go
// Updates 는 /api/updates 응답 본문이다.
type Updates struct {
	Schedule ScheduleStatus `json:"schedule"`
	Code     CodeStatus     `json:"code"`
}
```

- [ ] **Step 4: 테스트 통과 + 전체 테스트 + 빌드**

Run: `go test ./... && go build ./...`
Expected: 전부 PASS, 빌드 성공. (기존 `New(p)` 사용 테스트들도 컴파일·통과해야 한다.)

- [ ] **Step 5: 커밋**

```bash
git add internal/server/server.go internal/server/server_test.go internal/updater/updater.go
git commit -m "feat: /api/updates 엔드포인트 + 체크 캐시 (#3)"
```

---

### Task 8: 대시보드 업데이트 배너

**Files:**
- Modify: `web/dashboard.html`

- [ ] **Step 1: 배너 컨테이너 추가**

`web/dashboard.html` 의 헤더 블록에서 `<div class="sub" id="subline">…</div>` 줄 바로 아래(닫는 `</div>` 앞)에 추가:

```html
    <div id="updateBar"></div>
```

- [ ] **Step 2: checkUpdates 함수 추가 + 초기화 순서 변경**

`web/dashboard.html` 의 `function loadStored(){…}` 정의 바로 위에 추가:

```js
// 시작 시 1회 업데이트 확인(버튼 없음). /api/updates 가 데이터 갱신을 data/ 에 반영하므로
// 반드시 loadStored(=/schedule.json 재조회)보다 먼저 끝나야 한다.
function checkUpdates(){
  return fetch('/api/updates').then(r=>r.json()).then(u=>{
    const bar=$('#updateBar'); if(!bar||!u)return;
    let html='';
    if(u.code&&u.code.newer){
      html+=`<div style="margin:14px 0 0;padding:10px 14px;border-radius:10px;background:rgba(164,116,255,.14);color:var(--txt);font-size:13px">새 버전 <b>v${u.code.version}</b>가 나왔습니다 — <a href="${u.code.url}" target="_blank" rel="noopener" style="color:var(--gold);font-weight:700">설치본 다운로드</a><span id="updateClose" style="float:right;cursor:pointer;color:var(--muted)">✕</span></div>`;
    }
    if(u.schedule&&u.schedule.updated){
      html+=`<div style="margin:14px 0 0;padding:8px 14px;border-radius:10px;background:rgba(82,211,154,.12);color:var(--green);font-size:12.5px">배너 데이터 v${u.schedule.version}로 갱신되었습니다.</div>`;
    }
    bar.innerHTML=html;
    const c=$('#updateClose'); if(c)c.addEventListener('click',()=>{bar.innerHTML='';});
  }).catch(()=>{});
}
```

초기화 호출(`fillPath();` 다음 줄의 `loadStored();`)을 교체:

```js
fillPath();
checkUpdates().finally(loadStored);
```

- [ ] **Step 3: 라이브 확인 (chrome-devtools-mcp)**

`go build -ldflags="-s -w" -o hsr-warp.exe .` 후 실행. 대시보드에서:
- 콘솔 에러 없음, `/api/updates`가 200 JSON 반환.
- (현재 버전이 최신이면 배너 미표시가 정상. dev 빌드는 코드 배너 안 뜸 — 설계대로.)
- `/schedule.json` 200, 기존 데이터 정상 렌더.

- [ ] **Step 4: 커밋**

```bash
git add web/dashboard.html
git commit -m "feat: 대시보드 업데이트 배너 (#3)"
```

---

### Task 9: Inno Setup 설치본 + 릴리스 CI

**Files:**
- Create: `installer/hsr-warp.iss`
- Modify: `.github/workflows/release.yml`

> 이 태스크는 로컬(darwin)에서 빌드 검증 불가 — `v*` 태그 push 시 GitHub Actions(windows runner)에서 검증된다. 로컬에서는 `.iss`/YAML 문법만 확인한다.

- [ ] **Step 1: Inno Setup 스크립트 작성**

`installer/hsr-warp.iss`:

```iss
; Inno Setup 스크립트 — per-user 설치(관리자 불필요).
; 앱은 exe 디렉터리에 data/·config.json·logs/ 를 쓰므로(main.go baseDir) 쓰기 가능한
; {localappdata} 에 설치한다. Program Files 설치는 쓰기 실패를 유발하므로 피한다.
; 버전은 ISCC /DMyAppVersion=1.2.3 로 주입한다.
#define MyAppName "HSR Warp"
#ifndef MyAppVersion
  #define MyAppVersion "0.0.0"
#endif

[Setup]
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher=jkas2016
DefaultDirName={localappdata}\HSR Warp
DefaultGroupName=HSR Warp
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir=Output
OutputBaseFilename=hsr-warp-setup-{#MyAppVersion}
SetupIconFile=..\icon.ico
Compression=lzma2
SolidCompression=yes

[Files]
Source: "..\hsr-warp.exe"; DestDir: "{app}"; Flags: ignoreversion

[Tasks]
Name: "desktopicon"; Description: "바탕화면 바로가기 만들기"; GroupDescription: "추가 아이콘:"

[Icons]
Name: "{group}\HSR Warp"; Filename: "{app}\hsr-warp.exe"
Name: "{group}\HSR Warp 제거"; Filename: "{uninstallexe}"
Name: "{userdesktop}\HSR Warp"; Filename: "{app}\hsr-warp.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\hsr-warp.exe"; Description: "지금 실행"; Flags: nowait postinstall skipifsilent
```

- [ ] **Step 2: 릴리스 워크플로우에 windows 설치본 job 추가**

`.github/workflows/release.yml` 의 `jobs:` 아래, 기존 `goreleaser:` job 다음에 추가:

```yaml
  installer:
    needs: goreleaser
    runs-on: windows-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Go
        uses: actions/setup-go@v5
        with:
          go-version: stable

      - name: Build exe
        shell: pwsh
        run: |
          $ver = "${{ github.ref_name }}".TrimStart('v')
          go build -ldflags "-s -w -X main.version=$ver" -o hsr-warp.exe .

      - name: Install Inno Setup
        shell: pwsh
        run: choco install innosetup -y --no-progress

      - name: Build installer
        shell: pwsh
        run: |
          $ver = "${{ github.ref_name }}".TrimStart('v')
          & "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" /DMyAppVersion=$ver installer\hsr-warp.iss

      - name: Upload installer to release
        shell: pwsh
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          $ver = "${{ github.ref_name }}".TrimStart('v')
          gh release upload ${{ github.ref_name }} "installer\Output\hsr-warp-setup-$ver.exe" --clobber
```

- [ ] **Step 3: 로컬 문법 점검**

Run: `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/release.yml')); print('yaml ok')"`
Expected: `yaml ok`. (`.iss`는 windows runner 에서만 컴파일 가능.)

- [ ] **Step 4: 커밋**

```bash
git add installer/hsr-warp.iss .github/workflows/release.yml
git commit -m "feat: Inno Setup 설치본 + 릴리스 CI (#3)"
```

---

### Task 10: ARCHITECTURE.md 갱신

**Files:**
- Modify: `docs/ARCHITECTURE.md`

- [ ] **Step 1: 단일 소스 규칙 + SCHEDULE 위치 갱신**

`docs/ARCHITECTURE.md` 에서 다음을 교체.

(a) 패키지 구조의 `main.go` 줄(라인 16) 끝에 `, web/schedule.json` 임베드를 반영:

old:
```
- **`main.go`** — `os.Executable()` 기준 baseDir, `data/`·`config.json` 경로, 빈 포트 선택, `go:embed web/dashboard.html web/analyze.js`, 브라우저 자동 오픈, 로깅 셋업.
```
new:
```
- **`main.go`** — `os.Executable()` 기준 baseDir, `data/`·`config.json` 경로, 빈 포트 선택, `go:embed web/dashboard.html web/analyze.js web/schedule.json`, 브라우저 자동 오픈, 로깅 셋업.
- **`internal/updater`** — 시작 시 업데이트 2채널 확인(외부 통신 단일 지점). `CheckSchedule`(raw `schedule.json` → 신규면 `data/`에 기록), `CheckRelease`(`releases/latest` semver 비교), `EffectiveSchedule`(data/ override > 내장본), `CompareVersions`.
```

(b) SCHEDULE 추가 안내(라인 22)를 데이터 파일 기준으로 교체:

old:
```
신규 패치 출시 시 **`SCHEDULE` 배열에 `{s,e,c,l}` 항목 추가**(c=캐릭터 픽업, l=광추 픽업 item_id; 픽업=Mantan21/HSR-Warp-Simulator, item_id=StarRailRes). `gacha_type`: `11`=캐릭터, `12`=광추, `1`=일반(스텔라), `2`=출발.
```
new:
```
신규 패치 출시 시 **`web/schedule.json`의 `schedule` 배열에 `{s,e,c,l}` 항목 추가 + 최상위 `version` +1**(c=캐릭터 픽업, l=광추 픽업 item_id; 픽업=Mantan21/HSR-Warp-Simulator, item_id=StarRailRes). `main` 에 push 하면 사용자 앱이 시작 시 자동으로 받아 반영한다(릴리스 불필요). `gacha_type`: `11`=캐릭터, `12`=광추, `1`=일반(스텔라), `2`=출발.
```

(c) "analyze.js 는 단일 소스다" 불변식(라인 28)을 로직/데이터 분리로 교체:

old(첫 문장):
```
**`analyze.js` 는 단일 소스다.** `web/analyze.js`가 유일 소스이며 서버가 `/analyze.js`로 서빙하고 exe에 `go:embed`로 내장된다.
```
new:
```
**로직은 `analyze.js`, 데이터는 `schedule.json` 단일 소스다.** 50/50 판정 로직은 `web/analyze.js`(순수 함수 `analyze(data, schedule)`/`analyzeBanner(records, meta, schedule)` — 일정을 인자로 주입받는다), 배너 일정 데이터는 `web/schedule.json`이 유일 소스다. 서버가 `/analyze.js`·`/schedule.json`(data/ override > 내장본)로 서빙하고 exe에 `go:embed`로 내장된다.
```

- [ ] **Step 2: 업데이트 채널 섹션 추가**

`docs/ARCHITECTURE.md` 의 "## 외부 명세 의존" 섹션 바로 위에 추가:

```
## 업데이트 (자동, 콘텐츠 타입 2채널)

시작 시 대시보드가 `/api/updates`를 1회 호출하면 백엔드가 두 체크를 베스트에포트로 수행·캐시한다(`internal/updater`). 외부 통신은 이때뿐(raw 1회 + GitHub API 1회) — "완전 로컬" 원칙 유지.

- **데이터 채널**: `main`의 `web/schedule.json`을 받아 스키마 검증 후 version 이 높으면 `data/schedule.json`에 원자적 기록(인앱 자동 갱신, 재설치 불필요). 내장본은 오프라인·최초 실행 fallback.
- **코드 채널**: `releases/latest`(프리릴리스·드래프트 자동 제외)의 `tag_name`을 `main.version`과 semver 비교. 새 버전이면 대시보드가 설치본 다운로드 배너만 표시(셀프 업데이트 없음). `version=="dev"`면 스킵.
- 설치본은 **per-user `{localappdata}` 설치**(Inno Setup) — 앱이 exe 옆에 쓰기 때문에 쓰기 가능 위치여야 한다.
```

- [ ] **Step 3: 커밋**

```bash
git add docs/ARCHITECTURE.md
git commit -m "docs: 업데이트 채널·단일 소스 규칙 갱신 (#3)"
```

---

## 최종 검증

- [ ] **전체 테스트**

Run: `go test ./... && node web/analyze.test.js`
Expected: Go 전부 PASS, `OK  all analyze tests passed`.

- [ ] **릴리스 빌드 + gofmt/vet**

Run: `gofmt -l . && go vet ./... && go build -ldflags="-s -w" -o hsr-warp.exe .`
Expected: `gofmt -l` 출력 없음(포맷 OK), vet 무경고, 빌드 성공.

- [ ] **라이브 스모크 (chrome-devtools-mcp)**: 대시보드 로드 → `/schedule.json`·`/api/updates` 200, 기존 데이터 렌더, 콘솔 에러 없음.
