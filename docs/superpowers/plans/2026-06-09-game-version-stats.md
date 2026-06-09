# 게임 버전별 통계 화면 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 대시보드에 게임 버전(3.0, 3.1 …)별로 천장·운·픽승/픽뚫 통계를 끊어 보는 드롭다운 필터와 버전별 비교표를 추가한다.

**Architecture:** 전체 기록을 1회 분석(`analyze`)해 각 5★의 천장·50/50 결과를 확정한 뒤, 그 결과를 **획득 시각** 기준 버전 윈도우로 버킷한다(경계를 넘는 천장·확정 상태 보존). 버전→기간 매핑은 `schedule.json`의 신규 `versions` 배열에서 주입한다. 순수 함수는 `web/analyze.js`, 렌더는 `web/dashboard.html`.

**Tech Stack:** 의존성 0 JS(UMD IIFE, 브라우저+Node 양립), Node `assert` 단위 테스트(`node web/analyze.test.js`), Chart.js 4.x(CDN), Go embed/서빙(변경 없음).

**관련 스펙:** `docs/superpowers/specs/2026-06-09-game-version-stats-design.md`

---

## File Structure

| 파일 | 책임 | 변경 |
|------|------|------|
| `web/analyze.js` | 순수 분석 로직. `aggregateFives`(5★ 요약 재집계), `filterAnalysis`(윈도우 필터→analyze 모양), `analyzeVersions`(비교표 행) 추가. `analyzeBanner`에서 요약부를 `aggregateFives`로 추출(동작 불변) | 수정 |
| `web/schedule.json` | 데이터 단일 소스. top-level `versions` 배열 추가(`schedule` 배열 불변) | 수정 |
| `web/dashboard.html` | 버전 드롭다운 + 필터 재렌더, 「버전별 비교」 섹션 | 수정 |
| `web/analyze.test.js` | 위 함수들의 단위 테스트 | 수정 |

**불변 규칙(깨면 안 됨):** ID 비교는 `BigInt`(`byId`), 천장·`result`·`isPickup`는 분류 시 1회만 계산하고 윈도우 집계에서 **재계산 금지**(그대로 합산), `schedule` 배열은 50/50 단일 소스라 건드리지 않음.

---

## Task 1: `analyzeBanner`에서 `aggregateFives` 추출 (동작 불변 리팩터)

이미 분류된 5★ 배열에서 요약 통계를 재계산하는 순수 함수를 분리한다. `analyzeBanner`는 이를 호출하도록 바꾸되 외부 반환 모양은 그대로다. 이후 윈도우 집계가 이 함수를 재사용한다.

**Files:**
- Modify: `web/analyze.js` (`analyzeBanner` 본문, `api` export)
- Test: `web/analyze.test.js`

- [ ] **Step 1: 실패 테스트 작성**

`web/analyze.test.js`의 `console.log('OK ...')` 직전에 추가:

```js
// ---- aggregateFives: 분류된 fives에서 요약치 재계산 ----
const { aggregateFives } = require('./analyze.js');
const sampleFives = [
  { pity: 70, result: 'guaranteed', fromGuarantee: true, unidentified: false },
  { pity: 50, result: 'win',  fromGuarantee: false, unidentified: false },
  { pity: 80, result: 'loss', fromGuarantee: false, unidentified: false },
  { pity: 10, result: null, fromGuarantee: false, unidentified: true },
];
const agg = aggregateFives(sampleFives, BANNERS['11']);
assert.strictEqual(agg.count5, 4);
assert.strictEqual(agg.contested, 2, 'win+loss=contested');
assert.strictEqual(agg.cWins, 1);
assert.strictEqual(agg.cLoss, 1);
assert.strictEqual(agg.gWins, 1);
assert.strictEqual(agg.unknown5, 1);
assert.strictEqual(agg.pickupTotal, 2, 'cWins+gWins');
assert.ok(Math.abs(agg.win5050Rate - 0.5) < 1e-9, '1승/2contested');
assert.strictEqual(agg.bestPity, 10);
assert.strictEqual(agg.worstPity, 80);
assert.ok(Math.abs(agg.avgPity5 - 52.5) < 1e-9, '(70+50+80+10)/4');
```

- [ ] **Step 2: 실패 확인**

Run: `node web/analyze.test.js`
Expected: FAIL — `TypeError: aggregateFives is not a function` (또는 `undefined`).

- [ ] **Step 3: 최소 구현**

`web/analyze.js`에서 `analyzeBanner` **위에** `aggregateFives`를 추가한다:

```js
  // 이미 분류된 5★ 배열에서 요약치를 재계산한다(천장·result·isPickup은 입력값 그대로 사용 — 재분류 금지).
  function aggregateFives(fives, meta) {
    const pities = fives.map(f => f.pity);
    const cWins = fives.filter(f => f.result === 'win').length;
    const cLoss = fives.filter(f => f.result === 'loss').length;
    const gWins = fives.filter(f => f.result === 'guaranteed').length;
    const contested = cWins + cLoss;
    const unknown5 = fives.filter(f => f.unidentified).length;
    return {
      count5: fives.length,
      avgPity5: mean(pities),
      bestPity: pities.length ? Math.min(...pities) : null,
      worstPity: pities.length ? Math.max(...pities) : null,
      luckPct: (meta.expAvg && pities.length) ? (meta.expAvg - mean(pities)) / meta.expAvg * 100 : null,
      contested, cWins, cLoss, gWins, unknown5,
      win5050Rate: contested ? cWins / contested : null,
      pickupTotal: cWins + gWins,
    };
  }
```

그리고 `analyzeBanner`의 `return { ... }`를 아래로 교체한다(루프/`p5`/`p4`/`guaranteed`/`c3`/`c4`/`fives`는 그대로 유지). 기존 요약 필드(count5·avgPity5·bestPity·worstPity·luckPct·contested·cWins·cLoss·gWins·unknown5·win5050Rate·pickupTotal)를 spread로 대체:

```js
    return {
      total: list.length, jade: list.length * 160, count4: c4, count3: c3,
      currentPity5: p5, currentPity4: p4,
      ...aggregateFives(fives, meta),
      currentGuaranteed: guaranteed,
      fives,
    };
```

> 주의: 기존 `count5: c5` 는 `aggregateFives`의 `count5: fives.length`(= c5)로 대체된다. 루프 내 `c5++`는 더 이상 반환에 쓰이지 않지만 `p5`/`p4` 리셋 로직과 무관하므로 `c5` 변수 선언·증가는 남겨둬도 되고 제거해도 된다 — **제거하면** `let c4 = 0, c3 = 0;`로 줄이고 `fives.push(f); c5++;`에서 `c5++` 삭제. DRY를 위해 제거 권장.

- [ ] **Step 4: 통과 확인**

Run: `node web/analyze.test.js`
Expected: PASS — `OK  all analyze tests passed` (기존 테스트 전부 + 신규 aggregateFives 테스트).

- [ ] **Step 5: `api` export에 추가**

`web/analyze.js`의 `const api = { analyze, analyzeBanner, monthly, BANNERS, ORDER };`를:

```js
  const api = { analyze, analyzeBanner, aggregateFives, monthly, BANNERS, ORDER };
```

- [ ] **Step 6: 재실행 + 커밋**

Run: `node web/analyze.test.js && node scripts/run-go.mjs vet ./...`
Expected: 테스트 PASS, vet 무출력.

```bash
git add web/analyze.js web/analyze.test.js
git commit -m "refactor: analyzeBanner 요약부를 aggregateFives로 추출 (#2)"
```

---

## Task 2: `versionWindows` + `filterAnalysis` (윈도우 필터)

버전 배열을 정렬된 `{v,s,e}` 윈도우로 변환하고, 전체 분석 결과를 한 버전 윈도우로 필터해 `analyze()`와 동일한 모양을 반환하는 함수. **분류된 fives는 시각으로 필터만 하고 재집계**, 뽑기 횟수는 원본 레코드를 시각 버킷.

**Files:**
- Modify: `web/analyze.js`
- Test: `web/analyze.test.js`

- [ ] **Step 1: 실패 테스트 작성**

`web/analyze.test.js` 끝의 `console.log` 직전에 추가. 두 버전에 걸친 픽뚫→확정 시나리오로 경계 보존을 검증한다:

```js
// ---- filterAnalysis: 버전 경계를 넘는 5★의 천장·결과 보존 ----
const { filterAnalysis, versionWindows } = require('./analyze.js');
const VERS = [{ v: '3.6', s: '2025-09-23' }, { v: '3.7', s: '2025-11-04' }, { v: '3.8', s: '2025-12-16' }];

// 윈도우: 3.7 = [2025-11-04, 2025-12-16)
const w = versionWindows(VERS);
assert.strictEqual(w.length, 3);
assert.strictEqual(w[1].v, '3.7');
assert.strictEqual(w[2].e, Infinity, '마지막 버전 끝은 무한');

// 시나리오: 3.6에서 픽뚫(loss→확정) 적립, 3.7에서 70천장 확정 5★.
id = 9000n;
const r5t = (iid, t) => ({ id: String(id++), rank_type: '5', item_id: String(iid), name: 'n', item_type: 'C', time: t, gacha_type: '11' });
const r3t = (t) => ({ id: String(id++), rank_type: '3', item_id: '0', name: 'y', item_type: 'C', time: t, gacha_type: '11' });
const recs = [];
recs.push(r5t(1102, '2025-10-01 00:00:00'));           // 3.6: Seele 비픽업 → loss → 확정
for (let i = 0; i < 69; i++) recs.push(r3t(i < 40 ? '2025-11-01 00:00:00' : '2025-11-10 00:00:00')); // 천장 적립(3.6→3.7 경계 넘음)
recs.push(r5t(1415, '2025-11-10 12:00:00'));           // 3.7: 확정 획득(70천장)

const data = { info: {}, list: recs };
const full = analyze(data, schedule);
const v37 = filterAnalysis(full, data, w[1]); // 3.7 윈도우

const b11 = v37.banners.find(b => b.type === '11');
const five = b11.stats.fives.find(f => f.item_id === '1415');
assert.ok(five, '3.7 윈도우에 1415 포함');
assert.strictEqual(five.pity, 70, '천장은 경계 넘어 적립된 70 그대로(잘리지 않음)');
assert.strictEqual(five.result, 'guaranteed', '3.6 픽뚫의 확정 상태 보존');
assert.strictEqual(b11.stats.gWins, 1, '확정 획득 1');
assert.strictEqual(b11.stats.contested, 0, '3.7엔 contested 없음(확정만)');

// 뽑기 횟수는 시각 윈도우로 버킷: 3.7창엔 r3t 29개(2025-11-10) + 5★ 1개 = 30
assert.strictEqual(b11.stats.count5, 1, '3.7창 5★ 1개');
assert.strictEqual(b11.stats.total, 30, '3.7창 뽑기 30(11-10 29건 + 5★)');
assert.strictEqual(b11.stats.jade, 4800, '30*160');
assert.strictEqual(b11.stats.currentPity5, null, '과거 윈도우는 현재천장 의미없음 → null');

// 3.6 윈도우엔 loss 5★ + 3성 40개
const v36 = filterAnalysis(full, data, w[0]);
const b11_36 = v36.banners.find(b => b.type === '11');
assert.strictEqual(b11_36.stats.cLoss, 1, '3.6 픽뚫 1');
assert.strictEqual(b11_36.stats.total, 41, '3.6창 뽑기 41(loss 5★ + 3성 40)');

// 불변식: 전체 윈도우 필터 == analyze 핵심 수치
const wholeWin = { v: 'all', s: 0, e: Infinity };
const whole = filterAnalysis(full, data, wholeWin);
assert.strictEqual(whole.count5, full.count5, '전체창 5★ 수 일치');
assert.strictEqual(whole.total, full.total, '전체창 총뽑기 일치');
```

- [ ] **Step 2: 실패 확인**

Run: `node web/analyze.test.js`
Expected: FAIL — `versionWindows is not a function`.

- [ ] **Step 3: 최소 구현**

`web/analyze.js`의 `monthly` 함수 **아래**(`analyze` 위)에 추가:

```js
  const dms = t => Date.parse(String(t).slice(0, 10)); // 'YYYY-MM-DD ...' → ms (date 단위 버킷)

  // versions [{v,s}] → s 오름차순 정렬된 윈도우 [{v, s(ms), e(ms)}]. 마지막 e=Infinity.
  function versionWindows(versions) {
    const vs = (versions || []).filter(x => x && x.v && x.s)
      .map(x => ({ v: x.v, s: Date.parse(x.s) }))
      .filter(x => !isNaN(x.s))
      .sort((a, b) => a.s - b.s);
    return vs.map((x, i) => ({ v: x.v, s: x.s, e: i + 1 < vs.length ? vs[i + 1].s : Infinity }));
  }

  // 전체 분석 결과(full)를 한 윈도우 {s,e}(ms)로 필터해 analyze()와 같은 모양으로 반환.
  // 분류된 fives는 시각 필터만(천장·result 재계산 금지), 뽑기 횟수는 원본 레코드를 시각 버킷.
  function filterAnalysis(full, data, window) {
    const inWin = t => { const ms = dms(t); return ms >= window.s && ms < window.e; };
    const list = (Array.isArray(data.list) ? data.list : []).filter(r => inWin(r.time));

    // gacha_type별 원본 카운트(천장 무관, 시각 버킷)
    const cnt = {}; for (const k of ORDER) cnt[k] = { total: 0, c4: 0, c3: 0 };
    for (const r of list) {
      const t = String(r.gacha_type); if (!cnt[t]) continue;
      cnt[t].total++;
      const rk = String(r.rank_type);
      if (rk === '4') cnt[t].c4++; else if (rk !== '5') cnt[t].c3++;
    }

    const banners = full.banners.map(b => {
      const fives = b.stats.fives.filter(f => inWin(f.time));
      const c = cnt[b.type] || { total: 0, c4: 0, c3: 0 };
      return {
        type: b.type, meta: b.meta,
        stats: {
          total: c.total, jade: c.total * 160, count4: c.c4, count3: c.c3,
          currentPity5: null, currentPity4: null, currentGuaranteed: false,
          ...aggregateFives(fives, b.meta),
          fives,
        },
      };
    }).filter(b => b.stats.total > 0);

    const all5 = banners.flatMap(b => b.stats.fives.map(f => ({ ...f, banner: b.meta.short, gacha_type: b.type })));
    all5.sort((a, b) => (a.time < b.time ? 1 : a.time > b.time ? -1 : 0));
    const charFives = banners.filter(b => b.type === '11' || b.type === '1').flatMap(b => b.stats.fives.map(f => f.pity));
    const lim = banners.find(b => b.type === '11'), lc = banners.find(b => b.type === '12');
    return {
      info: full.info || {},
      total: banners.reduce((s, b) => s + b.stats.total, 0),
      jade: banners.reduce((s, b) => s + b.stats.jade, 0),
      count5: banners.reduce((s, b) => s + b.stats.count5, 0),
      count4: banners.reduce((s, b) => s + b.stats.count4, 0),
      count3: banners.reduce((s, b) => s + b.stats.count3, 0),
      unknown5: banners.reduce((s, b) => s + (b.stats.unknown5 || 0), 0),
      banners, all5, monthly: monthly(list),
      luck: {
        charAvgPity: mean(charFives),
        charLuckPct: charFives.length ? (62.5 - mean(charFives)) / 62.5 * 100 : null,
        charBanner: lim ? lim.stats : null,
        lcBanner: lc ? lc.stats : null,
      },
    };
  }
```

- [ ] **Step 4: 통과 확인**

Run: `node web/analyze.test.js`
Expected: PASS — `OK  all analyze tests passed`.

- [ ] **Step 5: export 추가**

```js
  const api = { analyze, analyzeBanner, aggregateFives, filterAnalysis, versionWindows, monthly, BANNERS, ORDER };
```

- [ ] **Step 6: 커밋**

Run: `node web/analyze.test.js`
Expected: PASS.

```bash
git add web/analyze.js web/analyze.test.js
git commit -m "feat: 버전 윈도우 필터 filterAnalysis/versionWindows (#2)"
```

---

## Task 3: `analyzeVersions` (비교표 행)

각 버전 윈도우에 Task 2 집계를 적용해 비교표용 행 배열을 만든다. 뽑기 0인 버전 제외. 캐릭터(11) 배너 기준 평균천장·픽승/픽뚫.

**Files:**
- Modify: `web/analyze.js`
- Test: `web/analyze.test.js`

- [ ] **Step 1: 실패 테스트 작성**

```js
// ---- analyzeVersions: 버전별 비교 행 ----
const { analyzeVersions } = require('./analyze.js');
// 위 Task2의 full/data 재사용(3.6 loss + 3.7 guaranteed). VERS=3.6,3.7,3.8
const rows = analyzeVersions(full, data, VERS);
assert.strictEqual(rows.length, 2, '뽑기 있는 3.6·3.7만(3.8 제외)');
const row37 = rows.find(r => r.v === '3.7');
assert.strictEqual(row37.count5, 1);
assert.strictEqual(row37.charCWins + row37.charCLoss, 0, '3.7은 확정뿐(contested 0)');
assert.strictEqual(row37.total, 30);
const row36 = rows.find(r => r.v === '3.6');
assert.strictEqual(row36.charCLoss, 1, '3.6 픽뚫 1');
assert.ok(row36.s && row36.e, '기간 문자열 존재');
// 방어: versions 없으면 빈 배열
assert.deepStrictEqual(analyzeVersions(full, data, []), [], '빈 versions → []');
assert.deepStrictEqual(analyzeVersions(full, data, undefined), [], 'undefined → []');
```

- [ ] **Step 2: 실패 확인**

Run: `node web/analyze.test.js`
Expected: FAIL — `analyzeVersions is not a function`.

- [ ] **Step 3: 최소 구현**

`web/analyze.js`의 `filterAnalysis` 아래에 추가:

```js
  // 각 버전 윈도우의 요약을 비교표 행으로. 뽑기 0 버전 제외. 캐릭(11) 기준 천장·50/50.
  function analyzeVersions(full, data, versions) {
    const fmt = ms => ms === Infinity ? '' : new Date(ms).toISOString().slice(0, 10);
    return versionWindows(versions).map(w => {
      const a = filterAnalysis(full, data, w);
      if (!a.total) return null;
      const cb = a.banners.find(b => b.type === '11');
      return {
        v: w.v, s: fmt(w.s), e: fmt(w.e),
        total: a.total, jade: a.jade, count5: a.count5,
        charAvgPity: cb ? cb.stats.avgPity5 : null,
        charCWins: cb ? cb.stats.cWins : 0,
        charCLoss: cb ? cb.stats.cLoss : 0,
      };
    }).filter(Boolean);
  }
```

- [ ] **Step 4: 통과 확인**

Run: `node web/analyze.test.js`
Expected: PASS.

- [ ] **Step 5: export + 커밋**

```js
  const api = { analyze, analyzeBanner, aggregateFives, filterAnalysis, versionWindows, analyzeVersions, monthly, BANNERS, ORDER };
```

Run: `node web/analyze.test.js`
Expected: PASS.

```bash
git add web/analyze.js web/analyze.test.js
git commit -m "feat: 버전별 비교 행 analyzeVersions (#2)"
```

---

## Task 4: `schedule.json`에 `versions` 데이터 추가

버전→시작일 매핑을 데이터로 주입한다. `schedule` 배열은 건드리지 않고, top-level `versions`만 추가하며 `version`(정수)을 +1 한다.

> **데이터 출처/검증:** 1.0–3.8 시작일은 in-repo `schedule` 배열의 각 버전 첫 페이즈 `s`에서 도출(페이즈 2개씩 묶기 — 4개 앵커 1.0/3.0/3.4/3.7이 정확히 일치해 검증됨; 3.8은 3.7 이후 마지막 3.x로 연장 운영). 4.0–4.3은 실제 패치일(HoYoverse). 경계는 배너 cadence 근사로, 기존 50/50 일정의 ±오차 허용 철학과 동일(경계 ±수일 드리프트 허용). 더 정밀한 날짜가 필요하면 Fandom Version 위키로 보정 가능.

**Files:**
- Modify: `web/schedule.json`
- Test: `web/analyze.test.js`, `internal/updater` (기존 검증 회귀)

- [ ] **Step 1: 실패 테스트 작성**

`web/analyze.test.js` 상단의 `const { schedule } = require('./schedule.json');` 줄을 `const { schedule, versions } = require('./schedule.json');`로 바꾸고, 끝에 추가:

```js
// ---- schedule.json versions 데이터 검증 ----
assert.ok(Array.isArray(versions) && versions.length >= 28, 'versions 28개 이상');
const W = versionWindows(versions);
// 정렬·연속 보장
for (let i = 1; i < W.length; i++) assert.ok(W[i].s >= W[i - 1].s, 'versions 시각 오름차순');
// 핵심 앵커
const find = v => versions.find(x => x.v === v);
assert.strictEqual(find('3.7').s, '2025-11-04', '3.7 앵커(analyze.test의 3.7 p1과 일치)');
assert.strictEqual(find('1.0').s, '2023-04-26', '1.0 = 글로벌 출시');
assert.strictEqual(find('4.0').s, '2026-02-12', '4.0 실제 패치일');
assert.ok(find('3.8'), '3.8 존재(마지막 3.x)');
assert.ok(!versions.find(x => x.v === '3.9'), '3.9 없음');
```

- [ ] **Step 2: 실패 확인**

Run: `node web/analyze.test.js`
Expected: FAIL — `versions` undefined → `versions.length` 에러.

- [ ] **Step 3: 데이터 추가**

`web/schedule.json`에서 top-level `version` 값을 현재보다 +1 하고(예: 기존이 N이면 N+1), 닫는 `]}` 직전(= `schedule` 배열 닫힘 `]` 뒤)에 `,"versions":[...]`를 추가한다. 정확한 배열:

```json
"versions":[
{"v":"1.0","s":"2023-04-26"},{"v":"1.1","s":"2023-06-07"},{"v":"1.2","s":"2023-07-19"},{"v":"1.3","s":"2023-08-30"},{"v":"1.4","s":"2023-10-11"},{"v":"1.5","s":"2023-11-22"},{"v":"1.6","s":"2024-01-03"},
{"v":"2.0","s":"2024-02-14"},{"v":"2.1","s":"2024-03-27"},{"v":"2.2","s":"2024-05-08"},{"v":"2.3","s":"2024-06-19"},{"v":"2.4","s":"2024-07-31"},{"v":"2.5","s":"2024-09-11"},{"v":"2.6","s":"2024-10-23"},{"v":"2.7","s":"2024-12-04"},
{"v":"3.0","s":"2025-01-14"},{"v":"3.1","s":"2025-02-25"},{"v":"3.2","s":"2025-04-08"},{"v":"3.3","s":"2025-05-20"},{"v":"3.4","s":"2025-07-01"},{"v":"3.5","s":"2025-08-12"},{"v":"3.6","s":"2025-09-23"},{"v":"3.7","s":"2025-11-04"},{"v":"3.8","s":"2025-12-16"},
{"v":"4.0","s":"2026-02-12"},{"v":"4.1","s":"2026-03-24"},{"v":"4.2","s":"2026-04-21"},{"v":"4.3","s":"2026-06-01"}
]
```

> 형식 일관성: 기존 `schedule`이 한 줄이면 `versions`도 압축해 한 줄로 둬도 무방. `gofmt`/JSON 포맷터는 적용 안 함(이 파일은 데이터). 추가 후 `node -e "JSON.parse(require('fs').readFileSync('web/schedule.json','utf8'))"` 로 파싱 확인.

- [ ] **Step 4: 통과 확인 (JS + Go 회귀)**

Run: `node web/analyze.test.js && node scripts/run-go.mjs test ./internal/updater/...`
Expected: JS PASS, Go `ok` — `ScheduleVersion`이 미지 필드 `versions`를 무시하고 그대로 검증 통과(스키마 안 깨짐).

- [ ] **Step 5: 커밋**

```bash
git add web/schedule.json web/analyze.test.js
git commit -m "feat: schedule.json에 버전 타임라인 versions 추가 (#2)"
```

---

## Task 5: 대시보드 버전 드롭다운 + 필터 재렌더

상단에 버전 드롭다운(기본 `전체`)을 두고, 변경 시 `filterAnalysis`로 전체 대시보드를 재렌더. 과거 버전 필터 시 현재천장 의존 표시(천장 진행바·"다음 확정" 배지)는 숨긴다.

**Files:**
- Modify: `web/dashboard.html`
- 검증: 수동(브라우저) + `node web/analyze.test.js` 회귀

- [ ] **Step 1: 전역 상태 + 드롭다운 마크업**

`web/dashboard.html`에서 `<div id="app"></div>` **위에** 버전 선택 바를 추가한다(패널 카드 아래):

```html
  <div id="versionBar" style="display:none;margin-top:18px;align-items:center;gap:10px;flex-wrap:wrap">
    <label for="versionSel" style="color:var(--muted);font-size:13px">버전 구간</label>
    <select id="versionSel" style="padding:8px 12px;border-radius:8px;border:1px solid var(--line);background:var(--panel2);color:var(--txt);font-size:14px;cursor:pointer">
      <option value="__all__">전체</option>
    </select>
  </div>
```

`<script>` 상단의 기존 `let scheduleData=[];`(dashboard.html ~104행) **바로 아래에** 상태 3줄을 추가한다(기존 줄은 그대로 둠 — 재선언 금지):

```js
let versionsData=[];   // schedule.json versions
let lastFull=null;     // 가장 최근 analyze() 전체 결과(필터의 원본)
let lastList=[];       // 가장 최근 원본 레코드(필터가 시각 버킷에 사용)
```

- [ ] **Step 2: schedule.json 로드 시 versions 수신**

`loadStored()`의 `scheduleData=(j&&j.schedule)||[];` 줄을 다음으로 교체:

```js
    fetch('/schedule.json').then(r=>r.json()).then(j=>{scheduleData=(j&&j.schedule)||[];versionsData=(j&&j.versions)||[];}).catch(()=>{}).finally(()=>{
```

- [ ] **Step 3: render() 진입 시 full 저장 + 드롭다운 채우기**

`function render(A){` 바로 다음 줄들 위쪽(차트 destroy 전후 무관)에 추가한다. **단, 필터 결과로 재렌더할 때는 드롭다운을 다시 만들지 않도록** 분기한다. `render`를 다음과 같이 감싸는 헬퍼를 추가(기존 `render`는 유지):

`render` 함수 정의 **위에** 추가:

```js
function renderFull(A){           // analyze() 전체 결과 진입점
  lastFull=A;
  buildVersionDropdown(A);
  const sel=$('#versionSel');
  applyVersionFilter(sel?sel.value:'__all__');
}
function buildVersionDropdown(A){
  const bar=$('#versionBar'),sel=$('#versionSel');
  if(!bar||!sel||!WarpAnalyze.analyzeVersions)return;
  const rows=WarpAnalyze.analyzeVersions(A,{list:lastList},versionsData); // lastList: Step1 상태 + Step4 호출부에서 세팅
  if(!rows.length){bar.style.display='none';return;}
  bar.style.display='flex';
  const cur=sel.value||'__all__';
  sel.innerHTML='<option value="__all__">전체</option>'+
    rows.slice().reverse().map(r=>`<option value="${r.v}">${r.v} (${r.s} ~ ${r.e||'현재'})</option>`).join('');
  sel.value=[...sel.options].some(o=>o.value===cur)?cur:'__all__';
}
function applyVersionFilter(v){
  if(!lastFull)return;
  if(v==='__all__'){render(lastFull,true);return;}
  const w=WarpAnalyze.versionWindows(versionsData).find(x=>x.v===v);
  if(!w){render(lastFull,true);return;}
  render(WarpAnalyze.filterAnalysis(lastFull,{list:lastList},w),false);
}
```

- [ ] **Step 4: 원본 레코드 보관 + 호출부 교체**

필터는 원본 `data.list`가 필요하다(`lastList`는 Step 1에서 이미 선언). **현재 `render(WarpAnalyze.analyze(...))`를 호출하는 2곳 + change 이벤트**를 아래처럼 바꾼다.

`loadStored` 내부:
```js
      if(d&&Array.isArray(d.list)&&d.list.length){lastList=d.list;renderFull(WarpAnalyze.analyze(d,scheduleData));}
```
`runFetch`의 `done` 핸들러 내부:
```js
    if(d.data&&Array.isArray(d.data.list)){lastList=d.data.list;renderFull(WarpAnalyze.analyze(d.data,scheduleData));}
```
드롭다운 change 이벤트 등록(`goBtn.addEventListener` 부근):
```js
$('#versionSel').addEventListener('change',e=>applyVersionFilter(e.target.value));
```

- [ ] **Step 5: render에 isFull 인자 + 현재천장 의존 표시 가드**

`function render(A){`를 `function render(A,isFull){`로 바꾸고, 현재천장/확정 의존 UI를 `isFull`일 때만 노출한다.

배너 카드의 천장 진행바·"다음 확정" 배지(`s.currentPity5`, `s.currentGuaranteed` 사용부)를 가드. 배너 카드 생성 루프에서:
```js
  for(const b of A.banners){const s=b.stats,cap=b.meta.cap,pct=Math.min(100,(s.currentPity5||0)/cap*100);
    h+=`<div class="card banner">
      <h3><span class="dot" style="background:${b.meta.color}"></span>${b.meta.short} 워프</h3>
      ${isFull?`<div style="margin-top:12px"><span class="pity-num" style="color:${pityColor(s.currentPity5)}">${s.currentPity5}</span> <small>/ ${cap} 천장</small></div>
      <div class="bar"><i style="width:${pct}%;background:${pityColor(s.currentPity5)}"></i></div>`:''}
      <div class="row"><span>총 뽑기</span><b>${num(s.total)}</b></div>
      <div class="row"><span>5★ 획득</span><b>${s.count5}</b></div>
      <div class="row"><span>평균 천장</span><b>${s.avgPity5?s.avgPity5.toFixed(1):'-'}</b></div>
      ${b.meta.kind==='limited'?`<div class="row"><span>픽승 / 픽뚫 / 확정</span><b>${s.cWins} / ${s.cLoss} / ${s.gWins}</b></div>`:''}
      ${isFull&&b.meta.kind==='limited'&&s.currentGuaranteed?'<span class="badge g">다음 확정</span>':''}
    </div>`;}
```

hero의 "다음 5★ 확정/50/50" 배지도 `isFull`일 때만:
```js
      ${isFull?(cb&&cb.currentGuaranteed?'<span class="badge g">다음 5★ 확정 (픽뚫 상태)</span>':(cb?'<span class="badge ok">다음 5★ 50/50</span>':'')):''}
```

- [ ] **Step 6: JS 회귀 + 수동 검증**

Run: `node web/analyze.test.js`
Expected: PASS (analyze.js 변경 없음 — 회귀 확인용).

수동: `node scripts/run-go.mjs build -ldflags="-s -w" -o hsr-warp.exe .` 후 실행 → 대시보드에서 (1) 버전 드롭다운이 데이터 있는 버전만 최신순으로 표시, (2) 버전 선택 시 hero·카드·차트·표가 그 구간으로 바뀌고 천장 진행바가 사라짐, (3) `전체` 복귀 시 원상복구 확인.

- [ ] **Step 7: 커밋**

```bash
git add web/dashboard.html
git commit -m "feat: 대시보드 버전 드롭다운 필터 (#2)"
```

---

## Task 6: 「버전별 비교」 섹션 + 행 클릭 선택

요약 카드 아래에 전 버전 비교표를 그린다. 항상 전 버전 표시(드롭다운과 무관), 선택 버전 행 강조, 행 클릭 시 드롭다운 선택.

**Files:**
- Modify: `web/dashboard.html`
- 검증: 수동 + `node web/analyze.test.js` 회귀

- [ ] **Step 1: 비교표 렌더 함수 추가**

`render` 함수 **위에** 추가:

```js
function renderVersionTable(selV){
  if(!lastFull||!WarpAnalyze.analyzeVersions)return '';
  const rows=WarpAnalyze.analyzeVersions(lastFull,{list:lastList},versionsData);
  if(!rows.length)return '';
  const body=rows.slice().reverse().map(r=>{
    const sel=r.v===selV?' style="background:var(--panel2)"':'';
    const wl=r.charCWins+r.charCLoss;
    return `<tr class="vrow" data-v="${r.v}"${sel} style="cursor:pointer">
      <td><b>${r.v}</b></td>
      <td class="muted">${r.s} ~ ${r.e||'현재'}</td>
      <td>${num(r.total)}</td>
      <td>${r.count5?`<span class="pill" style="background:var(--gold)">${r.count5}</span>`:'<span class="muted">0</span>'}</td>
      <td>${r.charAvgPity?r.charAvgPity.toFixed(1):'-'}</td>
      <td>${wl?`<span style="color:var(--gold)">${r.charCWins}</span> / <span style="color:var(--red)">${r.charCLoss}</span>`:'<span class="muted">-</span>'}</td>
    </tr>`;}).join('');
  return `<section><h2>버전별 비교 <span class="note">(행 클릭 = 해당 버전 보기)</span></h2>
    <table><thead><tr><th>버전</th><th>기간</th><th>뽑기</th><th>5★</th><th>캐릭 평균천장</th><th>캐릭 픽승/픽뚫</th></tr></thead>
    <tbody>${body}</tbody></table></section>`;
}
```

- [ ] **Step 2: render에서 요약 카드 뒤에 삽입**

`render(A,isFull)` 안, 요약 카드 섹션(`statCard(...)` 묶음) 직후에 비교표를 끼운다. 요약 `</section>` 다음 줄에:

```js
  h+=renderVersionTable(isFull?'__none__':(($('#versionSel')||{}).value||'__none__'));
```

- [ ] **Step 3: 행 클릭 → 드롭다운 선택 (이벤트 위임)**

`app.innerHTML=h;` **다음** 줄에 추가(매 렌더 후 재바인딩):

```js
  app.querySelectorAll('.vrow').forEach(tr=>tr.addEventListener('click',()=>{
    const sel=$('#versionSel'); if(!sel)return;
    sel.value=tr.dataset.v; applyVersionFilter(tr.dataset.v);
  }));
```

- [ ] **Step 4: JS 회귀 + 수동 검증**

Run: `node web/analyze.test.js`
Expected: PASS.

수동: 재빌드·실행 → (1) 요약 아래 「버전별 비교」 표가 전 버전 1행씩, (2) 행 클릭 시 그 버전으로 필터되고 드롭다운도 동기화, (3) 선택 버전 행이 강조됨.

- [ ] **Step 5: 커밋**

```bash
git add web/dashboard.html
git commit -m "feat: 버전별 비교표 + 행 클릭 선택 (#2)"
```

---

## Task 7: 전체 검증

**Files:** 없음(검증만)

- [ ] **Step 1: 전체 테스트**

Run: `node scripts/run-go.mjs test ./... && node web/analyze.test.js`
Expected: Go 전부 `ok`, JS `OK  all analyze tests passed`.

- [ ] **Step 2: 정적검사**

Run: `node scripts/run-go.mjs vet ./...`
Expected: 무출력.

- [ ] **Step 3: 릴리스 빌드 + 수동 스모크**

Run: `node scripts/run-go.mjs build -ldflags="-s -w" -o hsr-warp.exe .`
Expected: 빌드 성공. 실행 후 브라우저에서 드롭다운 필터·비교표·`전체` 복귀를 1회씩 확인(데이터 없으면 versionBar 숨김 확인).

- [ ] **Step 4: 이슈 완료 기준 대조**

스펙·이슈 #2 완료 기준 3개 충족 확인:
- [x] 버전 선택 UI(드롭다운) — Task 5
- [x] 선택 버전 구간으로 필터된 통계 렌더 — Task 5
- [x] `analyze.test.js`에 버전 구간 분할 단위 테스트 — Task 2·3·4

---

## 참고 / 출처

- 버전 출시일 검증: HoYoverse 공식([4.1 newsroom](https://www.hoyoverse.com/en-us/news/163260)), 보도([4.0=2026-02-12](https://gamerant.com/honkai-star-rail-version-4-1-update-release-date-features/), [4.2=2026-04-21](https://gamerant.com/honkai-star-rail-hsr-43-when-release-date-time-countdown-update-maintenance-ends-come-out/), [4.3=2026-06-01](https://rpgamer.com/2026/05/honkai-star-rail-version-4-3-launching-june-1/), [3.8=2025-12-16·마지막 3.x](https://game8.co/games/Honkai-Star-Rail/archives/559664)), 3.7 앵커는 in-repo `web/analyze.test.js` 주석.
- 1.0–3.8 시작일: in-repo `web/schedule.json`의 버전 첫 페이즈 `s`(페이즈 2개씩, 앵커 4개 검증).
- 기존 로직: `web/analyze.js`(`analyzeBanner:32`, `analyze:88`, `monthly:74`), 자동 갱신 검증 `internal/updater/updater.go:31`.
