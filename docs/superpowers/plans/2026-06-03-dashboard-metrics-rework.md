# 대시보드 지표 재설계 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 대시보드의 천장(소프트천장 제거)·픽승/픽뚫 판정(한정 목록 기반)·analyze.js 단일화·로컬 산출물 추적 해제를 적용한다.

**Architecture:** 분석 로직은 `web/analyze.js`(단일 소스, Node+브라우저 UMD)에 있고 `web/analyze.test.js`가 단위 테스트한다. 50/50 판정은 하드코딩된 `LIMITED` 목록(StarRailRes 도출) 기반으로 바뀌고, `STANDARD`는 "미확인 5★" 플래그 판별에만 쓴다. 대시보드(`web/dashboard.html`)는 라벨·카드만 갱신한다.

**Tech Stack:** Go(`go:embed`), 바닐라 JS, Node 단위 테스트, Chart.js.

---

## File Structure

- `web/analyze.js` — 단일 분석 소스(이동·수정). `LIMITED` 추가, `soft`/`early*` 제거, 판정 변경.
- `web/analyze.test.js` — 루트에서 이동. 새 판정/미확인/soft제거 테스트.
- `analyze.js`(루트) — **삭제**.
- `analyze.test.js`(루트) — **삭제**(이동).
- `web/dashboard.html` — 라벨·카드·차트·캡션·미확인 경고 갱신.
- `package.json` — `sync-analyze`/`prebuild` 제거, 테스트 경로 갱신.
- `.gitignore` — `docs/superpowers/`, `tools/` 추가.
- `CLAUDE.md` — 단일 소스·새 판정으로 문서 갱신.

---

## Task 1: analyze.js 단일화 (이동·삭제·스크립트)

**Files:**
- Delete: `analyze.js`, `analyze.test.js`
- Create: `web/analyze.test.js` (루트 `analyze.test.js` 내용 이동)
- Modify: `package.json`

- [ ] **Step 1: 루트 테스트를 web/로 이동(require 경로 동일 디렉터리화)**

`web/analyze.test.js`를 생성. 루트 `analyze.test.js`와 동일하되 첫 줄 require만 변경:

```js
const { analyzeBanner, analyze, monthly, BANNERS } = require('./analyze.js');
```

(이미 `./analyze.js`이므로 같은 디렉터리에서 그대로 동작. 파일 내용 전체를 그대로 옮긴다.)

- [ ] **Step 2: 루트 원본 2개 삭제**

```bash
git rm analyze.js analyze.test.js
```

- [ ] **Step 3: package.json 스크립트 갱신**

`scripts`를 다음으로 교체(중복 복사 제거, 테스트 경로 web/):

```json
  "scripts": {
    "build": "node scripts/run-go.mjs build -ldflags=\"-s -w\" -o hsr-warp.exe .",
    "start": "npm run build && hsr-warp.exe",
    "vet": "node scripts/run-go.mjs vet ./...",
    "test": "node scripts/run-go.mjs test ./... && node web/analyze.test.js",
    "test:go": "node scripts/run-go.mjs test ./...",
    "test:analyze": "node web/analyze.test.js"
  }
```

- [ ] **Step 4: 이동 후 기존 테스트가 새 경로로 통과하는지 확인**

Run: `node web/analyze.test.js`
Expected: PASS — "OK  all analyze tests passed" (아직 로직 변경 전이므로 기존 어설션 통과)

- [ ] **Step 5: Commit**

```bash
git add web/analyze.test.js package.json
git commit -m "refactor: analyze.js 단일 소스화 (web/로 통일, 중복 복사 제거)"
```

---

## Task 2: analyze.js 판정 변경 — 소프트천장 제거 + 픽승/픽뚫(LIMITED) + 미확인 플래그 (TDD)

**Files:**
- Modify: `web/analyze.js`
- Test: `web/analyze.test.js`

- [ ] **Step 1: 실패하는 테스트 작성 (web/analyze.test.js)**

`web/analyze.test.js`에서 **50/50 블록·라이트콘 블록·luck 블록·통합 블록**을 아래로 교체하고, 미확인/soft제거 테스트를 추가한다. (id 헬퍼·pity 블록·monthly 블록은 유지)

50/50 블록 교체:

```js
// ---- 50/50: loss -> guaranteed win -> contested win -> loss (LIMITED 기반) ----
// standard char: 1003(Himeko),1101(Bronya) | limited(픽업): 1005(Kafka),1006(Silver Wolf)
id = 5000n;
const banner11 = [
  r5(1003),  // standard -> contested LOSS(픽뚫) -> guaranteed
  r5(1005),  // guaranteed WIN(픽업)
  r5(1006),  // contested WIN(픽승, 픽업)
  r5(1101),  // standard -> contested LOSS(픽뚫) -> guaranteed
];
const s = analyzeBanner(banner11, BANNERS['11']);
assert.strictEqual(s.contested, 3, '3 contested (#1,#3,#4)');
assert.strictEqual(s.cWins, 1, '1 contested win');
assert.strictEqual(s.cLoss, 2, '2 contested losses');
assert.strictEqual(s.gWins, 1, '1 guaranteed win');
assert.strictEqual(s.pickupTotal, 2, 'featured = contested wins + guaranteed wins');
assert.ok(Math.abs(s.win5050Rate - 1 / 3) < 1e-9, '50/50 win rate = 1/3');
assert.strictEqual(s.currentGuaranteed, true, 'ends on loss -> next guaranteed');
assert.deepStrictEqual(s.fives.map(f => f.result), ['loss', 'guaranteed', 'win', 'loss']);
assert.deepStrictEqual(s.fives.map(f => f.isPickup), [false, true, true, false]);
assert.strictEqual(s.unknown5, 0, 'all ids in LIMITED or STANDARD');
```

미확인(unidentified) 테스트 추가(50/50 블록 뒤):

```js
// ---- 미확인 5★: LIMITED·STANDARD 어디에도 없으면 contested loss + unidentified ----
id = 5500n;
const u = analyzeBanner([r5(9999)], BANNERS['11']);
assert.strictEqual(u.fives[0].result, 'loss', 'unknown contested -> loss');
assert.strictEqual(u.fives[0].isPickup, false);
assert.strictEqual(u.fives[0].unidentified, true);
assert.strictEqual(u.unknown5, 1);
const std = analyzeBanner([r5(1003)], BANNERS['11']);
assert.strictEqual(std.fives[0].unidentified, false, 'standard id is identified');
assert.strictEqual(std.unknown5, 0);
```

라이트콘 블록 교체:

```js
// ---- light cone pool (banner 12): standard 23002 -> loss, limited 23001 -> guaranteed ----
const r5lc = (iid) => ({ id: String(id++), rank_type: '5', item_id: String(iid), name: 'z', item_type: 'L', time: '2025-03-01 00:00:00', gacha_type: '12' });
const banner12 = [r5lc(23002) /*standard -> loss*/, r5lc(23001) /*limited -> guaranteed*/];
const sl = analyzeBanner(banner12, BANNERS['12']);
assert.deepStrictEqual(sl.fives.map(f => f.result), ['loss', 'guaranteed'], 'LC: loss then guaranteed');
assert.strictEqual(sl.unknown5, 0);
```

luck 블록 교체(soft/early 어설션 제거):

```js
// ---- luck (소프트천장/early 제거 확인) ----
id = 6000n;
const lk = analyzeBanner([r5(1005)], BANNERS['11']); // Kafka pity 1 -> 픽승, 매우 행운
assert.ok(lk.luckPct > 90, 'pity 1 is ~98% luckier than 62.5 avg');
assert.strictEqual(lk.fives[0].result, 'win');
assert.ok(!('earlyCount' in lk), 'soft-pity earlyCount removed');
assert.ok(!('earlyRate' in lk), 'soft-pity earlyRate removed');
```

통합 블록 교체(9001→1005, unknown5 어설션 추가):

```js
// ---- analyze() integration ----
id = 7000n;
const data = { info: { uid: '1' }, list: [r5(1003), r5(1005), r34(3), { ...r5lc(23002) }] };
const A = analyze(data);
assert.ok(A.banners.length >= 1);
assert.strictEqual(A.count5, 3);
assert.strictEqual(A.unknown5, 0, 'account-wide unknown5 exposed');
assert.ok(A.luck.charBanner, 'char banner luck present');
assert.ok(A.all5[0].time >= A.all5[A.all5.length - 1].time, 'all5 newest first');
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `node web/analyze.test.js`
Expected: FAIL — `s.cWins`/`result` 불일치 또는 `unknown5`/`unidentified` undefined (아직 로직 미구현)

- [ ] **Step 3: web/analyze.js 구현 — LIMITED 추가, BANNERS에서 soft 제거**

상단 헤더 주석을 교체:

```js
// Shared warp-analysis logic. Single source (served at /analyze.js, embedded in exe).
// Unit-tested via web/analyze.test.js. 50/50: a featured banner 5* is a WIN(픽승) if its
// item_id is in LIMITED(한정 픽업 목록), else LOSS(픽뚫). A 5* in neither LIMITED nor
// STANDARD is flagged unidentified (LIMITED may be stale — add new featured units).
// LIMITED derived from StarRailRes index_min/en (all 5* minus standard 7). See SOURCES.
```

`STANDARD` 정의 바로 아래에 `LIMITED` 추가:

```js
  const LIMITED = {
    // 한정(픽업) 5★. StarRailRes index_min/en에서 '전체 5★ − 상시 7종'으로 도출(2026-06).
    // 개척자(8xxx)·BP/무료 광추(24xxx) 제외. 신규 한정은 여기 추가(누락 시 '미확인 5★' 경고).
    char: ['1005','1006','1014','1015','1102','1112','1203','1204','1205','1208','1212','1213','1217','1218','1220','1221','1222','1225','1302','1303','1304','1305','1306','1307','1308','1309','1310','1313','1314','1315','1317','1321','1401','1402','1403','1404','1405','1406','1407','1408','1409','1410','1412','1413','1414','1415','1501','1502','1504','1505','1506','1507'],
    lc:   ['23001','23006','23007','23008','23009','23010','23011','23014','23015','23016','23017','23018','23019','23020','23021','23022','23023','23024','23025','23026','23027','23028','23029','23030','23031','23032','23033','23034','23035','23036','23037','23038','23039','23040','23041','23042','23043','23044','23045','23046','23047','23048','23049','23050','23051','23052','23053','23054','23056','23057','23058','23059'],
  };
```

`BANNERS`에서 `soft` 키 4개 모두 제거:

```js
  const BANNERS = {
    '11': { name: '캐릭터 이벤트', short: '캐릭터', color: '#a474ff', cap: 90, kind: 'limited', pool: 'char', rateUp: 0.5,  expAvg: 62.5 },
    '12': { name: '광추 이벤트',   short: '광추',   color: '#5aa9ff', cap: 80, kind: 'limited', pool: 'lc',   rateUp: 0.75, expAvg: 53.5 },
    '1':  { name: '스텔라(일반)',  short: '일반',   color: '#52d39a', cap: 90, kind: 'standard', pool: null, rateUp: null, expAvg: 62.5 },
    '2':  { name: '출발 워프',     short: '출발',   color: '#ff9e45', cap: 50, kind: 'beginner', pool: null, rateUp: null, expAvg: null },
  };
```

- [ ] **Step 4: web/analyze.js 구현 — analyzeBanner 판정 변경**

`analyzeBanner` 함수를 아래로 교체:

```js
  function analyzeBanner(records, meta) {
    const list = records.slice().sort(byId);
    const limited = meta.pool ? LIMITED[meta.pool] : null;
    const standard = meta.pool ? STANDARD[meta.pool] : null;
    let p5 = 0, p4 = 0, c5 = 0, c4 = 0, c3 = 0;
    let guaranteed = false, contested = 0, cWins = 0, cLoss = 0, gWins = 0, unknown5 = 0;
    const fives = [];
    for (const r of list) {
      p5++; p4++;
      const rank = String(r.rank_type);
      if (rank === '5') {
        const id = String(r.item_id);
        const f = { name: r.name, item_id: id, item_type: r.item_type, time: r.time, pity: p5, result: null, isPickup: null, fromGuarantee: false, unidentified: false };
        if (meta.kind === 'limited') {
          f.isPickup = limited.includes(id);                       // 한정 픽업 대상이면 픽승
          f.unidentified = !f.isPickup && !standard.includes(id);  // LIMITED·STANDARD 모두에 없음
          if (f.unidentified) unknown5++;
          if (guaranteed) { f.result = 'guaranteed'; f.fromGuarantee = true; gWins++; guaranteed = false; }
          else { contested++; if (f.isPickup) { f.result = 'win'; cWins++; } else { f.result = 'loss'; cLoss++; guaranteed = true; } }
        }
        fives.push(f); c5++; p5 = 0; p4 = 0;
      } else if (rank === '4') { c4++; p4 = 0; }
      else { c3++; }
    }
    const pities = fives.map(f => f.pity);
    return {
      total: list.length, jade: list.length * 160, count5: c5, count4: c4, count3: c3,
      currentPity5: p5, currentPity4: p4,
      avgPity5: mean(pities), bestPity: pities.length ? Math.min(...pities) : null, worstPity: pities.length ? Math.max(...pities) : null,
      // luck vs theoretical average (lower pity = luckier); positive % = lucky
      luckPct: (meta.expAvg && pities.length) ? (meta.expAvg - mean(pities)) / meta.expAvg * 100 : null,
      // 50/50
      contested, cWins, cLoss, gWins, unknown5,
      win5050Rate: contested ? cWins / contested : null,
      pickupTotal: cWins + gWins, currentGuaranteed: guaranteed,
      fives,
    };
  }
```

- [ ] **Step 5: web/analyze.js 구현 — analyze()에 unknown5 노출 + api에 LIMITED 추가**

`analyze()` return 객체에서 `count3:` 줄 다음에 한 줄 추가:

```js
      unknown5: banners.reduce((s, b) => s + (b.stats.unknown5 || 0), 0),
```

파일 하단 api 객체에 `LIMITED` 추가:

```js
  const api = { analyze, analyzeBanner, monthly, BANNERS, ORDER, STANDARD, LIMITED };
```

하단 SOURCES 주석에 한 줄 추가:

```js
//  limited 5* derivation     : StarRailRes index_min/en (all 5* − standard 7); 8xxx/24xxx 제외
```

- [ ] **Step 6: 테스트 실행 → 통과 확인**

Run: `node web/analyze.test.js`
Expected: PASS — "OK  all analyze tests passed"

- [ ] **Step 7: Commit**

```bash
git add web/analyze.js web/analyze.test.js
git commit -m "feat: 픽승/픽뚫 판정을 한정 목록 기반으로 정정, 소프트천장 제거, 미확인 5★ 플래그"
```

---

## Task 3: dashboard.html 표시 갱신

**Files:**
- Modify: `web/dashboard.html`

(자동 테스트 없음 — 수정 후 빌드+육안 확인. 각 편집은 정확한 문자열 교체.)

- [ ] **Step 1: resText 라벨 정정 (line 105)**

```js
const resText={win:'픽승',loss:'픽뚫',guaranteed:'확정',null:'-'};
```

(`resClass`는 그대로: win=금색, loss=빨강, guaranteed=초록)

- [ ] **Step 2: 푸터 50/50 캡션 정정 (line 95)**

```html
    50/50 판정: 한정 배너 5★가 픽업(한정) 대상이면 '픽승', 아니면 '픽뚫'. 표준/미확인은 픽뚫로 집계되며, 미확인 5★는 목록 갱신 안내가 표시됩니다.
```

- [ ] **Step 3: 미확인 경고 + 평균 천장 카드 (render 내부)**

`let h=\`<section class="hero">` (line 172)로 시작하는 부분을, 미확인 경고를 앞에 붙이도록 변경:

```js
  let h='';
  if(A.unknown5>0) h+=`<div style="margin:0 0 16px;padding:10px 14px;border-radius:10px;background:rgba(255,158,69,.12);color:var(--orange);font-size:13px">⚠ 미확인 5★ ${A.unknown5}개 — 신규 한정이 LIMITED 목록에 없을 수 있어요. analyze.js의 LIMITED를 갱신하세요.</div>`;
  h+=`<section class="hero">
```

그리고 세 번째 hero 카드(소프트천장, line 185-189)를 평균 천장 카드로 교체:

```js
    <div class="card">
      <div class="lbl">평균 천장 · 캐릭터</div>
      <div class="big">${cb&&cb.avgPity5?cb.avgPity5.toFixed(1):'-'}<small style="font-size:16px;color:var(--muted)"> 회</small></div>
      <div class="desc">캐릭터 5★ ${cb?cb.count5:0}개${cb&&cb.bestPity?` · 최고 운 <b style="color:var(--green)">${cb.bestPity}회</b> · 최악 <b style="color:var(--red)">${cb.worstPity}회</b>`:''}</div>
    </div>
```

- [ ] **Step 4: 픽승률 라벨 + 픽뚫 badge (line 180, 183)**

line 180:
```html
      <div class="lbl">픽승률 · 캐릭터 50/50</div>
```

line 183:
```js
      ${cb&&cb.currentGuaranteed?'<span class="badge g">다음 5★ 확정 (픽뚫 상태)</span>':(cb?'<span class="badge ok">다음 5★ 50/50</span>':'')}
```

- [ ] **Step 5: 배너 카드 행 라벨 (line 211)**

```js
      ${b.meta.kind==='limited'?`<div class="row"><span>픽승 / 픽뚫 / 확정</span><b>${s.cWins} / ${s.cLoss} / ${s.gWins}</b></div>`:''}
```

- [ ] **Step 6: 50/50 차트 라벨 (line 269-270)**

```js
      {label:'픽승',data:lim.map(b=>b.stats.cWins),backgroundColor:'#f5c542'},
      {label:'픽뚫',data:lim.map(b=>b.stats.cLoss),backgroundColor:'#ff6b6b'},
```

- [ ] **Step 7: 빌드 + 육안 확인**

Run: `npm run build`
Expected: `hsr-warp.exe` 생성 성공(오류 없음). 실행 시 hero에 "평균 천장" 카드, "픽승률" 라벨, 배너 카드 "픽승 / 픽뚫 / 확정", 차트 범례 "픽승/픽뚫/확정" 표시. (실데이터 있으면 미확인 경고 동작)

- [ ] **Step 8: Commit**

```bash
git add web/dashboard.html
git commit -m "feat: 대시보드 라벨/카드 갱신 (평균 천장, 픽승·픽뚫, 미확인 경고)"
```

---

## Task 4: docs/superpowers·tools 추적 해제

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: .gitignore에 추가**

`.gitignore` 끝에 추가:

```
# 로컬 기획 산출물(superpowers) · 개발 도구 — 추적 안 함
docs/superpowers/
tools/
```

- [ ] **Step 2: 인덱스에서 제거(디스크 보존)**

```bash
git rm -r --cached docs/superpowers tools
```

- [ ] **Step 3: 상태 확인**

Run: `git status --short`
Expected: `D docs/superpowers/...`, `D tools/genicon/main.go`, `M .gitignore` 표시. 디스크 파일은 유지(`ls tools/genicon` 존재).

- [ ] **Step 4: Commit**

```bash
git add .gitignore
git commit -m "chore: docs/superpowers·tools 추적 해제(gitignore)"
```

---

## Task 5: 문서 갱신 (CLAUDE.md + README.md)

**Files:**
- Modify: `CLAUDE.md`, `README.md`

- [ ] **Step 1: 판정 규칙 문단 갱신**

"중심 도메인 규칙 — 50/50 픽뚫 판정" 문단을 새 판정으로 교체:

```
**중심 도메인 규칙 — 50/50 픽승/픽뚫 판정** (`analyze.js`의 `analyzeBanner`): 한정 배너 5★의 `item_id`가 `LIMITED` 풀(한정 픽업 목록)에 있으면 픽승(win), 없으면 픽뚫(loss). 픽뚫은 `guaranteed=true`로 다음 5★를 확정으로 만든다. `LIMITED`·`STANDARD` 어디에도 없으면 `unidentified`로 표시(목록 갱신 신호). 신규 한정 출시 시 **`analyze.js` 상단의 `LIMITED` 배열에 item_id 추가**(StarRailRes에서 '전체 5★ − 상시 7종'으로 도출, 8xxx/24xxx 제외). `gacha_type`: `11`=캐릭터, `12`=광추, `1`=일반(스텔라), `2`=출발.
```

- [ ] **Step 2: 단일 소스 문단 갱신**

"`analyze.js` 는 두 곳에 동일하게 존재한다." 문단을 교체:

```
**`analyze.js` 는 단일 소스다.** `web/analyze.js`가 유일 소스이며 서버가 `/analyze.js`로 서빙하고 exe에 `go:embed`로 내장된다. 단위 테스트는 `web/analyze.test.js`(`node web/analyze.test.js`)가 `require('./analyze.js')`로 같은 디렉터리 파일을 검증한다. UMD IIFE로 브라우저=`window.WarpAnalyze`, Node=`module.exports`. 의존성 없이 양쪽에서 동작해야 한다.
```

- [ ] **Step 3: Commands 섹션 테스트 명령 갱신**

`node analyze.test.js` 를 `node web/analyze.test.js` 로 변경.

- [ ] **Step 4: README.md 갱신**

`README.md`의 낡은 참조를 갱신:

- line 92: `npm run build    # web/analyze.js 동기화 → 정적 단일 exe 빌드(-s -w)` → `npm run build    # 정적 단일 exe 빌드(-s -w)`
- line 94: `npm test         # go test ./...  +  node analyze.test.js` → `npm test         # go test ./...  +  node web/analyze.test.js`
- line 103: `node analyze.test.js` → `node web/analyze.test.js`
- line 106 bullet 교체:
  ```
  - 분석 로직은 `web/analyze.js` 단일 소스이며, 단위 테스트는 `web/analyze.test.js`(`node web/analyze.test.js`)가 같은 디렉터리에서 검증합니다.
  ```
- line 108 교체(STANDARD → LIMITED 유지보수 지점):
  ```
  - 신규 한정 캐릭터/광추 출시 시 `web/analyze.js`의 `LIMITED` 배열에 item_id를 추가하세요(StarRailRes 기준). HoYo가 표준 풀을 바꾸면 `STANDARD` 배열을 수정합니다.
  ```

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "docs: 단일 소스·픽승/픽뚫 판정으로 문서 갱신 (CLAUDE.md, README.md)"
```

---

## Task 6: 전체 검증

- [ ] **Step 1: 전체 테스트**

Run: `node scripts/run-go.mjs test ./... && node web/analyze.test.js`
Expected: Go 테스트 그린 + "OK  all analyze tests passed"

- [ ] **Step 2: 빌드**

Run: `npm run build`
Expected: `hsr-warp.exe` 생성 성공

---

## Self-Review Notes

- **스펙 커버리지:** Task1=소프트천장 제거(T2 step3/4 + T3 step3), Task2=픽승/픽뚫+미확인(T2), Task3=analyze.js 단일화(T1), Task4=추적 해제(T4). 모두 매핑됨. CLAUDE.md/문서(T5)·검증(T6) 포함.
- **placeholder 없음:** 모든 코드/명령/LIMITED 배열 실값 포함.
- **타입 일관성:** `unknown5`(배너·계정), `unidentified`(5★ 객체), `isPickup`, `LIMITED.char/lc`, `STANDARD.char/lc` 명칭이 테스트·구현·대시보드(`A.unknown5`)에서 일치.
