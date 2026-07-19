# 한정 배너 합산 지표 · 배너별 지표 · 버전 테이블 DESC 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 개요 탭 운 지표·픽승률·평균 뽑기 수를 캐릭터+광추 합산으로 통일하고, 배너별 탭에 운 지표·픽승률을 추가하고, 버전 비교 테이블을 최신 버전 우선으로 정렬한다.

**Architecture:** 합산 산식은 `web/analyze.js`에 `combineLimited` 헬퍼로 추가(단일 소스 원칙). `data.js`는 어댑트만, 뷰(JSX)는 표시만. 스펙: `docs/superpowers/specs/2026-07-20-combined-limited-metrics-design.md`.

**Tech Stack:** 브라우저 React(JSX, Babel in-browser), Node 테스트(assert), Go 임베드 서빙.

## Global Constraints

- 분석 로직은 `web/analyze.js` 단일 소스 — 킷에서 재구현 금지 (CLAUDE.md).
- i18n 키는 ko/en/zh/ja 4개 파일 패리티 필수 (`i18n.test.js` 강제).
- 테스트는 `npm test` 체인의 plain node 스크립트.
- 합산 대상은 캐릭터(11)+광추(12)만. 일반(1)·출발(2) 제외.

---

### Task 1: analyze.js `combineLimited` + `luck.limited`

**Files:**
- Modify: `web/analyze.js` (aggregateFives 아래 헬퍼 추가, analyze()·filterAnalysis()의 luck, api export)
- Test: `web/analyze.test.js` (파일 끝에 추가)

**Interfaces:**
- Produces: `combineLimited(charStats|null, lcStats|null)` → `{ count5, avgPity5, base, luckPct, cWins, cLoss, gWins, contested, win5050Rate, bestPity, worstPity }`. `analyze()`/`filterAnalysis()` 반환의 `luck.limited`에 동일 객체.

- [ ] **Step 1: 실패하는 테스트 작성** — `web/analyze.test.js` 끝(마지막 `console.log` 위)에:

```js
// ---- combineLimited: 캐릭터+광추 합산(5★ 개수 가중) ----
const { combineLimited } = require('./analyze.js');
const cc = { count5: 2, avgPity5: 70, cWins: 1, cLoss: 1, gWins: 0, bestPity: 60, worstPity: 80 };
const ll = { count5: 1, avgPity5: 50, cWins: 1, cLoss: 0, gWins: 0, bestPity: 50, worstPity: 50 };
const comb = combineLimited(cc, ll);
assert.ok(Math.abs(comb.avgPity5 - (70 * 2 + 50) / 3) < 1e-9, '개수 가중 평균');
assert.ok(Math.abs(comb.base - (62.5 * 2 + 53.5) / 3) < 1e-9, '기준선 62.5·53.5 가중');
assert.ok(Math.abs(comb.luckPct - (comb.base - comb.avgPity5) / comb.base * 100) < 1e-9, 'luckPct 정의');
assert.strictEqual(comb.cWins, 2); assert.strictEqual(comb.cLoss, 1); assert.strictEqual(comb.contested, 3);
assert.ok(Math.abs(comb.win5050Rate - 2 / 3) < 1e-9, '픽승률 2/3');
assert.strictEqual(comb.bestPity, 50); assert.strictEqual(comb.worstPity, 80);
assert.strictEqual(comb.count5, 3);

// 한쪽 없음(null): 있는 쪽 값 그대로
const only = combineLimited(cc, null);
assert.strictEqual(only.avgPity5, 70); assert.strictEqual(only.base, 62.5);

// 둘 다 5★ 0: 판정 불가 필드는 null, base 는 캐릭터 기준 폴백
const zero = combineLimited({ count5: 0, cWins: 0, cLoss: 0, gWins: 0 }, null);
assert.strictEqual(zero.luckPct, null); assert.strictEqual(zero.win5050Rate, null);
assert.strictEqual(zero.base, 62.5); assert.strictEqual(zero.bestPity, null);

// analyze()·filterAnalysis() 가 luck.limited 를 노출한다 (위 Task2 full 재사용)
assert.ok(full.luck.limited, 'analyze luck.limited');
assert.strictEqual(full.luck.limited.count5, full.luck.charBanner.count5, '광추 기록 없음 → 캐릭터와 동일');
assert.ok(whole.luck.limited, 'filterAnalysis luck.limited');
```

- [ ] **Step 2: 실패 확인** — Run: `node web/analyze.test.js` / Expected: FAIL `combineLimited is not a function`

- [ ] **Step 3: 구현** — `web/analyze.js`의 `aggregateFives` 함수 아래에 추가:

```js
  // 캐릭터(11)+광추(12) 합산 지표 — 평균·기준선은 5★ 개수 가중(버전 비교 'all'과 동일 산식),
  // 승/패/확정은 단순 합. 입력은 aggregateFives 산출물(없으면 null 허용).
  function combineLimited(charStats, lcStats) {
    const c = charStats || {}, l = lcStats || {};
    const n1 = c.count5 || 0, n2 = l.count5 || 0, tot = n1 + n2;
    const avg = tot ? ((c.avgPity5 || 0) * n1 + (l.avgPity5 || 0) * n2) / tot : 0;
    const base = tot ? (BANNERS['11'].expAvg * n1 + BANNERS['12'].expAvg * n2) / tot : BANNERS['11'].expAvg;
    const cWins = (c.cWins || 0) + (l.cWins || 0), cLoss = (c.cLoss || 0) + (l.cLoss || 0);
    const gWins = (c.gWins || 0) + (l.gWins || 0), contested = cWins + cLoss;
    const bests = [c.bestPity, l.bestPity].filter(v => v != null);
    const worsts = [c.worstPity, l.worstPity].filter(v => v != null);
    return {
      count5: tot, avgPity5: avg, base,
      luckPct: tot ? (base - avg) / base * 100 : null,
      cWins, cLoss, gWins, contested,
      win5050Rate: contested ? cWins / contested : null,
      bestPity: bests.length ? Math.min(...bests) : null,
      worstPity: worsts.length ? Math.max(...worsts) : null,
    };
  }
```

`analyze()`의 luck(`charBanner: lim ? lim.stats : null,` 라인 근처)과 `filterAnalysis()`의 luck에 각각 추가:

```js
        limited: combineLimited(lim ? lim.stats : null, lc ? lc.stats : null),
```

api export에 `combineLimited` 추가:

```js
  const api = { analyze, analyzeBanner, aggregateFives, combineLimited, filterAnalysis, versionWindows, analyzeVersions, monthly, BANNERS, ORDER };
```

- [ ] **Step 4: 통과 확인** — Run: `node web/analyze.test.js` / Expected: `OK  all analyze tests passed`
- [ ] **Step 5: Commit** — `git add web/analyze.js web/analyze.test.js && git commit -m "feat(analyze): combineLimited — 캐릭터+광추 합산 지표(개수 가중) + luck.limited"`

---

### Task 2: i18n 키 4개 언어 (변경 6 + 추가 5)

**Files:**
- Modify: `web/ui_kits/dashboard/i18n/ko.js`, `en.js`, `zh.js`, `ja.js` (각 hero.* 66~84행 부근, banners.* 90행 부근)

**Interfaces:**
- Produces: 뷰가 쓰는 키 — `hero.luckLabel`·`hero.winrateLabel`·`hero.avgLabel`(문구 변경), `hero.scaleAvg`(`{avg}` 파라미터화), `hero.avgChip`, `hero.nextBadge`(`{name}`,`{odds}`), `hero.nextBadgeGuar`(`{name}`), `banners.luck`, `banners.winrate`, `banners.wl`(`{w}`,`{l}`).

- [ ] **Step 1: 4개 파일 수정** — 기존 키는 값만 교체, 신규 키는 hero/banners 블록에 삽입.

ko.js:
```js
  'hero.luckLabel': '운 지표 · 한정 배너',
  'hero.scaleAvg': '평균 {avg}',
  'hero.winrateLabel': '픽승률 · 한정 배너',
  'hero.avgLabel': '평균 뽑기 수 · 한정 배너',
  'hero.avgChip': '평균 {avg}회',
  'hero.nextBadge': '{name} · 다음 5★ {odds}',
  'hero.nextBadgeGuar': '{name} · 다음 5★ 확정',
  'banners.luck': '운 지표',
  'banners.winrate': '픽승률',
  'banners.wl': '{w}승 {l}패',
```

en.js:
```js
  'hero.luckLabel': 'Luck · Limited banners',
  'hero.scaleAvg': 'avg {avg}',
  'hero.winrateLabel': 'Win rate · Limited banners',
  'hero.avgLabel': 'Average pulls · Limited',
  'hero.avgChip': 'avg {avg} pulls',
  'hero.nextBadge': '{name} · next 5★ {odds}',
  'hero.nextBadgeGuar': '{name} · next 5★ guaranteed',
  'banners.luck': 'Luck',
  'banners.winrate': 'Win rate',
  'banners.wl': '{w}W {l}L',
```

zh.js:
```js
  'hero.luckLabel': '运气指标 · 限定跃迁',
  'hero.scaleAvg': '平均 {avg}',
  'hero.winrateLabel': '没歪率 · 限定跃迁',
  'hero.avgLabel': '平均抽数 · 限定',
  'hero.avgChip': '平均 {avg}抽',
  'hero.nextBadge': '{name} · 下次5★ {odds}',
  'hero.nextBadgeGuar': '{name} · 下次5★ 大保底',
  'banners.luck': '运气指标',
  'banners.winrate': '没歪率',
  'banners.wl': '{w}胜 {l}歪',
```

ja.js:
```js
  'hero.luckLabel': '運指標 · 限定ワープ',
  'hero.scaleAvg': '平均 {avg}',
  'hero.winrateLabel': 'すり抜けなし率 · 限定ワープ',
  'hero.avgLabel': '平均回数 · 限定',
  'hero.avgChip': '平均 {avg}回',
  'hero.nextBadge': '{name} · 次の5★ {odds}',
  'hero.nextBadgeGuar': '{name} · 次の5★ 確定',
  'banners.luck': '運指標',
  'banners.winrate': 'すり抜けなし率',
  'banners.wl': '{w}勝 {l}敗',
```

- [ ] **Step 2: 패리티 확인** — Run: `node web/ui_kits/dashboard/i18n.test.js` / Expected: `i18n.test.js OK`
- [ ] **Step 3: Commit** — `git add web/ui_kits/dashboard/i18n/*.js && git commit -m "feat(i18n): 한정 배너 합산·배너별 지표 라벨 4개 언어"`

---

### Task 3: data.js 어댑트 — banners 지표·`limited`·markerPct

**Files:**
- Modify: `web/ui_kits/dashboard/data.js` (adapt())

**Interfaces:**
- Consumes: Task 1의 `full.luck.limited`, `window.WarpAnalyze.BANNERS[type].rateUp`.
- Produces: `WARP_DATA.banners[]`에 `luckPct`(number|null)·`winRate`(number|null) 추가. `WARP_DATA.limited = { ...combineLimited 결과, charGuaranteed, lcGuaranteed, charOdds, lcOdds }` (`charOdds`는 `'50/50'`, `lcOdds`는 `'75/25'` — rateUp에서 유도). `luck.markerPct`는 합산 기준.

- [ ] **Step 1: banners 맵에 두 필드 추가** — `adapt()`의 `banners = visible.map(...)` 객체에:

```js
      luckPct: b.stats.luckPct == null ? null : b.stats.luckPct,
      winRate: b.stats.win5050Rate == null ? null : b.stats.win5050Rate,
```

- [ ] **Step 2: limited 어댑트 + markerPct 교체** — `const cb = full.luck.charBanner || {};` 아래에:

```js
    const lim = full.luck.limited || {};
    const lcBnrA = full.banners.find((b) => b.type === '12');
    // rateUp(0.5/0.75) → '50/50'/'75/25' 배지 문구(단일 소스 상수에서 유도).
    const oddsOf = (type) => {
      const r = window.WarpAnalyze.BANNERS[type].rateUp;
      return Math.round(r * 100) + '/' + Math.round(100 - r * 100);
    };
```

`markerPct` 계산(기존 `full.luck.charAvgPity ? ... : 50`)을 합산 기준으로 교체:

```js
    // 게이지: 이론 기준선(base)이 중앙 50%에 오도록 avg/(2*base). 기존 125=2*62.5 의 일반화.
    const markerPct = lim.count5
      ? Math.max(2, Math.min(98, (lim.avgPity5 / (2 * lim.base)) * 100)) : 50;
```

return 객체에 `limited` 추가(`charBanner:` 위):

```js
      limited: {
        ...lim,
        charGuaranteed: !!(charBnr && charBnr.stats.currentGuaranteed),
        lcGuaranteed: !!(lcBnrA && lcBnrA.stats.currentGuaranteed),
        charOdds: oddsOf('11'), lcOdds: oddsOf('12'),
      },
```

(`charBnr`은 기존 선언 재사용. `luck.charAvgPity`·`charLuckPct` 필드는 삭제하지 않는다 — 타 소비처 방어.)

- [ ] **Step 3: Commit** — `git add web/ui_kits/dashboard/data.js && git commit -m "feat(dashboard): WARP_DATA.limited·배너별 luckPct/winRate 어댑트"`

---

### Task 4: HeroSummary — 합산 지표 + % 강조 + 배지 2개

**Files:**
- Modify: `web/ui_kits/dashboard/HeroSummary.jsx`

**Interfaces:**
- Consumes: `D.limited`(Task 3), i18n 키(Task 2), `window.I18N.bannerLabel`.

- [ ] **Step 1: 지표 소스 교체** — 함수 상단을:

```jsx
  const t = window.I18N.t, bl = window.I18N.bannerLabel;
  const lim = D.limited;

  const lp = lim.luckPct;                  // +면 행운(적게 씀), -면 불운(많이 씀), null=5★ 없음
  const lucky = (lp ?? 0) >= 0;
  const luckColor = lucky ? 'var(--green)' : 'var(--red)';

  const luck = useCountUp(lp ?? 0, { decimals: 1 });
  const win = useCountUp(Math.round((lim.win5050Rate ?? 0) * 100));
  const avg = useCountUp(lim.avgPity5 || 0, { decimals: 1 });
```

(`const cb = D.charBanner;` 줄은 삭제.)

- [ ] **Step 2: 운 지표 카드** — 큰 숫자를 %로, 칩을 평균 뽑기 수로 교체:

```jsx
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 64, fontWeight: 700, lineHeight: 1, letterSpacing: '-1.5px', color: luckColor, fontVariantNumeric: 'tabular-nums' }}>
              {lucky ? '+' : ''}{luck}<small style={{ fontFamily: 'var(--font-sans)', fontSize: 19, color: 'var(--muted)', fontWeight: 500, marginLeft: 4 }}>%</small>
            </div>
            <span style={{ background: lucky ? 'var(--green-fill)' : 'var(--red-fill)', color: luckColor, border: `1px solid ${lucky ? 'var(--green-line)' : 'var(--red-line)'}`, borderRadius: 'var(--r-pill)', padding: '5px 12px', fontSize: 13, fontWeight: 700 }}>
              {t('hero.avgChip', { avg: (lim.avgPity5 || 0).toFixed(1) })} · {lucky ? t('hero.lucky') : t('hero.unlucky')}
            </span>
```

설명·게이지 라벨은 base 파라미터로:

```jsx
            {lucky ? t('hero.luckDescLucky', { avg: lim.base.toFixed(1), n: lim.count5 }) : t('hero.luckDescUnlucky', { avg: lim.base.toFixed(1), n: lim.count5 })}
```
```jsx
              <span>{t('hero.scaleLuckyLess')}</span><span>{t('hero.scaleAvg', { avg: lim.base.toFixed(1) })}</span><span>{t('hero.scaleMoreUnlucky')}</span>
```

- [ ] **Step 3: 픽승률 카드** — 설명과 배지를 합산·2개로:

```jsx
            {t('hero.winrateDesc', { c: lim.contested, w: lim.cWins, l: lim.cLoss, g: lim.gWins })}
```
```jsx
          <div style={{ marginTop: 'auto', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
            {scoped
              ? <Badge variant="neutral">{t('hero.rangeStats')}</Badge>
              : <>
                  <Badge variant={lim.charGuaranteed ? 'red' : 'green'}>
                    {lim.charGuaranteed ? t('hero.nextBadgeGuar', { name: bl('캐릭터') }) : t('hero.nextBadge', { name: bl('캐릭터'), odds: lim.charOdds })}
                  </Badge>
                  <Badge variant={lim.lcGuaranteed ? 'red' : 'green'}>
                    {lim.lcGuaranteed ? t('hero.nextBadgeGuar', { name: bl('광추') }) : t('hero.nextBadge', { name: bl('광추'), odds: lim.lcOdds })}
                  </Badge>
                </>}
          </div>
```

- [ ] **Step 4: 평균 뽑기 수 카드** — best/worst 를 합산으로:

```jsx
            {t('hero.bestWorst', { best: lim.bestPity ?? 0, worst: lim.worstPity ?? 0 })}
```

- [ ] **Step 5: Commit** — `git add web/ui_kits/dashboard/HeroSummary.jsx && git commit -m "feat(dashboard): 히어로 지표를 한정 배너 합산으로 — % 강조·배지 2개"`

---

### Task 5: BannersView — 스탯 그리드 3×2 (운 지표·픽승률 추가)

**Files:**
- Modify: `web/ui_kits/dashboard/BannersView.jsx` (Mini 그리드, Mini 컴포넌트)

**Interfaces:**
- Consumes: `b.luckPct`·`b.winRate`·`b.cWins`·`b.cLoss`(Task 3), i18n 키(Task 2).

- [ ] **Step 1: Mini 에 색 옵션 추가**:

```jsx
function Mini({ k, v, color }) {
  return (
    <div style={{ background: 'var(--panel-2)', borderRadius: 'var(--r-md)', padding: '10px 12px' }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', fontWeight: 600 }}>{k}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, marginTop: 3, fontVariantNumeric: 'tabular-nums', color }}>{v}</div>
    </div>
  );
}
```

- [ ] **Step 2: 그리드 3열 + 2개 Mini 추가** — `gridTemplateColumns: '1fr 1fr'` → `'repeat(3, 1fr)'`, 기존 4개 Mini 뒤(성옥 앞)에:

```jsx
            <Mini k={t('banners.luck')} color={b.luckPct == null ? undefined : b.luckPct >= 0 ? 'var(--green)' : 'var(--red)'}
              v={b.luckPct == null ? '-' : (b.luckPct >= 0 ? '+' : '') + b.luckPct.toFixed(1) + '%'} />
            <Mini k={t('banners.winrate')}
              v={b.winRate == null ? '-' : <>{Math.round(b.winRate * 100)}% <small style={{ fontSize: 11, color: 'var(--muted)' }}>{t('banners.wl', { w: b.cWins, l: b.cLoss })}</small></>} />
```

- [ ] **Step 3: Commit** — `git add web/ui_kits/dashboard/BannersView.jsx && git commit -m "feat(dashboard): 배너별 탭에 운 지표·픽승률 추가(3×2 그리드)"`

---

### Task 6: VersionsView — 테이블만 버전 DESC

**Files:**
- Modify: `web/ui_kits/dashboard/VersionsView.jsx` (tbody map)

- [ ] **Step 1: 렌더 순서 반전** — `<tbody>` 의 `{rows.map((v) => {` 를:

```jsx
            {[...rows].reverse().map((v) => {
```

(차트 `VersionPityChart rows={rows}` 는 시간순 유지 — 변경 없음.)

- [ ] **Step 2: Commit** — `git add web/ui_kits/dashboard/VersionsView.jsx && git commit -m "feat(dashboard): 버전 비교 테이블 최신 버전 우선(DESC)"`

---

### Task 7: 전체 검증 + push

- [ ] **Step 1: 전체 테스트** — Run: `npm test` / Expected: 전 항목 OK (nohardcode·lang-reactivity 포함)
- [ ] **Step 2: 빌드·재기동** — 실행 중 exe 종료 후 `npm run build`, preview 재시작
- [ ] **Step 3: 브라우저 검증** — (a) 개요: 운 지표 %-강조·평균 칩·기준선 59.1·배지 2개, (b) 배너별: 캐릭터(운·픽승률 값)·일반(픽승률 '-'), (c) 버전 비교: 테이블 4.4가 맨 위·차트는 3.4→4.4 순, (d) 4.3·1.0 스코프 무크래시, (e) 언어 en 전환 라벨 확인, 콘솔 에러 0
- [ ] **Step 4: push** — `git push` (PR #45 갱신)
