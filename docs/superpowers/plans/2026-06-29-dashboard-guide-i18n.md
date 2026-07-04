# 대시보드 + 가이드 사이트 다국어(i18n) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 대시보드와 가이드 사이트를 ko/en/zh/ja 4개 언어로 제공하고, 화면 셀렉터·URL로 언어를 선택/공유할 수 있게 한다.

**Architecture:** 두 서브시스템을 분리한다. (A) 대시보드는 무빌드 환경에 맞춰 전역 `window.I18N.t()` + 최상위 `lang` state 재렌더로 클라이언트 번역, `?lang=` 쿼리로 영속/공유. (B) 가이드 사이트는 Vite SSG라 언어별 정적 페이지를 프리렌더(`/`, `/en/`, `/zh/`, `/ja/`). 분석 로직(`analyze.js`)과 배너/결과/스코프의 **정규 키 값**은 불변, 표시 문자열만 번역 계층에서 처리.

**Tech Stack:** Vanilla JS(무빌드, Babel standalone) + React 18(대시보드), React 19 + Vite SSG(사이트), Node `assert` 테스트.

## Global Constraints

- 언어 코드는 ISO 639-1: `ko`(기본) / `en` / `zh` / `ja`. 한국어는 `kr` 금지.
- **분석 단일 소스**: `web/analyze.js`의 분석 로직·`BANNERS` 데이터를 수정/재구현하지 않는다. 배너명은 표시 계층에서 키 매핑으로 번역.
- **정규 키 불변**: 배너 short(`캐릭터`/`광추`/`일반`/`출발`), 스코프 sentinel(`전체`), 결과 코드(`win`/`loss`/`guaranteed`)는 내부 비교/객체키/서버 progress 이벤트 키로 쓰인다. 내부 값은 그대로 두고 **표시 라벨만** 번역.
- **`go:embed all:web`**: 신규 `web/ui_kits/dashboard/i18n/*.js`는 `web/` 하위라 자동 포함(언더스코어 시작 아님). 추가 조치 불필요.
- localStorage 키: `hsrwarp-lang`. URL 파라미터: `?lang=`.
- 용어는 스펙 §7 대응표가 단일 출처(`docs/superpowers/specs/2026-06-29-dashboard-guide-i18n-design.md`). zh/ja 직역 금지(예: ja 워프=跳躍).
- 기존 전체 테스트 통과 유지: `npm test` = `go test ./... && node web/analyze.test.js && node docs/site/copy.test.mjs`.
- 새 JS 테스트는 프레임워크 없이 node `assert`(기존 `analyze.test.js`/`copy.test.mjs` 패턴) 사용.

## 용어 대응표 (단일 출처 — 사전 작성 시 그대로 사용)

| 키 후보 | ko | en | zh | ja |
|---|----|----|----|----|
| banner.char | 캐릭터 | Character | 角色 | キャラクター |
| banner.lc | 광추 | Light Cone | 光锥 | 光円錐 |
| banner.std | 일반 | Standard | 群星 | 群星 |
| banner.departure | 출발 | Departure | 始发 | 始発 |
| warp | 워프 | Warp | 跃迁 | 跳躍 |
| result.win | 픽승 | Won 50-50 | 没歪 | すり抜けなし |
| result.loss | 픽뚫 | Lost 50-50 | 歪了 | すり抜け |
| result.guaranteed | 확정 | Guaranteed | 大保底 | PU確定 |
| avgPulls | 평균 뽑기 수 | Average pulls | 平均抽数 | 平均回数 |
| hardPity | 천장 | Hard pity | 硬保底 | 天井 |
| rateUp | 픽업 | Rate-up | 概率UP | ピックアップ |
| stellarJade | 성옥 | Stellar Jade | 星琼 | 星玉 |
| lightCone | 광추 | Light Cone | 光锥 | 光円錐 |

> en/zh/ja의 긴 문장·산문은 위 용어를 기반으로 각 태스크에서 번역해 채운다. 단일 정식어 없는 항목(ja 50/50·픽승)은 서술형으로 처리.

---

## File Structure

**Part A — 대시보드 (`web/ui_kits/dashboard/`)**

- Create `i18n/ko.js`, `i18n/en.js`, `i18n/zh.js`, `i18n/ja.js` — 평면 키-값 사전. 각자 `window.I18N_DICTS = window.I18N_DICTS||{}; window.I18N_DICTS.<lang> = {...}` 등록.
- Create `i18n.js` — `window.I18N = { lang, t, setLang }` + `langOf()` + `BANNER_CODE` + `bannerLabel()`.
- Create `i18n.test.js` — t()/폴백/보간/lang결정/키정합성/배너코드 커버리지 단위 테스트.
- Create `nohardcode.test.js` — 컴포넌트·util.js·data.js에 한글 표시문자열 잔존 0 검증(추출 완료 가드).
- Modify `index.html` — i18n 스크립트 로드 + 초기 `<html lang>` 인라인 결정.
- Modify `Dashboard.jsx` — lang state·셀렉터·URL·html lang·날짜 로케일.
- Modify 12개 컴포넌트 + `util.js` + `data.js` — 한글 표시문자열 → `t()`/`bannerLabel()`.

**Part B — 가이드 사이트 (`docs/site/`)**

- Create `src/i18n/ko.js`, `en.js`, `zh.js`, `ja.js` — 산문 키-값(ESM `export default`).
- Create `src/i18n/index.js` — `LANGS`, `dictOf(lang)`, `langFromPath()`.
- Create `src/i18n/parity.test.mjs` — 4개 사전 키 정합성.
- Modify `src/pages/GuidePage.jsx` — `t` 인자 기반 렌더 + 언어 셀렉터(링크).
- Modify `src/App.jsx`, `src/entry-server.jsx`, `src/entry-client.jsx` — lang 전파/하이드레이션.
- Modify `prerender.mjs` — 4개 언어 루프 + 서브경로 출력 + hreflang.
- Modify `copy.test.mjs` — 검사 대상을 `src/i18n/ko.js`로 이전 + prerender 4언어 가드.

---

# PART A — 대시보드

## Task A1: i18n 코어 + 사전 스캐폴드 + 단위 테스트

**Files:**
- Create: `web/ui_kits/dashboard/i18n.js`
- Create: `web/ui_kits/dashboard/i18n/ko.js`, `en.js`, `zh.js`, `ja.js`
- Test: `web/ui_kits/dashboard/i18n.test.js`

**Interfaces:**
- Produces:
  - `window.I18N.lang` (string)
  - `window.I18N.t(key, vars?)` → string. `vars`는 `{name: value}`; 본문 `{name}` 치환. 누락 키는 ko 폴백, ko에도 없으면 key 반환.
  - `window.I18N.setLang(lang)` → 유효 lang으로 정규화해 `I18N.lang` 갱신.
  - `window.I18N.langOf(str)` → `'ko'|'en'|'zh'|'ja'` (브라우저/쿼리 문자열 매핑; 미지원 → `'ko'`).
  - `window.I18N.BANNER_CODE` = `{ '캐릭터':'char', '광추':'lc', '일반':'std', '출발':'departure' }`.
  - `window.I18N.bannerLabel(short)` → `t('banner.'+BANNER_CODE[short])` (미매핑 short는 원문 반환).
  - `window.I18N_DICTS.{ko,en,zh,ja}` (평면 객체).

- [ ] **Step 1: Write the failing test** — `web/ui_kits/dashboard/i18n.test.js`

```js
const assert = require('assert');

// 브라우저 전역을 흉내내는 최소 환경.
global.window = global;
global.navigator = { language: 'en-US' };
global.localStorage = { _v: {}, getItem(k){ return this._v[k] ?? null; }, setItem(k,v){ this._v[k]=String(v); } };
global.location = { search: '' };

require('./i18n/ko.js');
require('./i18n/en.js');
require('./i18n/zh.js');
require('./i18n/ja.js');
require('./i18n.js');

const I = window.I18N;
const DICTS = window.I18N_DICTS;

// 1) 4개 사전 키 정합성 (누락/잉여 0)
const langs = ['ko', 'en', 'zh', 'ja'];
const koKeys = Object.keys(DICTS.ko).sort();
for (const l of langs) {
  const k = Object.keys(DICTS[l]).sort();
  assert.deepStrictEqual(k, koKeys, `${l} 사전 키가 ko와 불일치`);
}

// 2) 보간
I.setLang('ko');
DICTS.ko['_test.greet'] = '안녕 {name}'; DICTS.en['_test.greet'] = 'hi {name}';
DICTS.zh['_test.greet'] = 'hi {name}'; DICTS.ja['_test.greet'] = 'hi {name}';
assert.strictEqual(I.t('_test.greet', { name: '준규' }), '안녕 준규');

// 3) 누락 키 → ko 폴백 → key 반환
I.setLang('en');
DICTS.ko['_test.onlyko'] = '한국어만'; // en/zh/ja 없음
assert.strictEqual(I.t('_test.onlyko'), '한국어만', 'ko 폴백');
assert.strictEqual(I.t('_test.missing.everywhere'), '_test.missing.everywhere', '완전 누락은 key 반환');

// 4) lang 결정/정규화
assert.strictEqual(I.langOf('zh-CN'), 'zh');
assert.strictEqual(I.langOf('ja'), 'ja');
assert.strictEqual(I.langOf('en-GB'), 'en');
assert.strictEqual(I.langOf('ko-KR'), 'ko');
assert.strictEqual(I.langOf('fr'), 'ko', '미지원 → ko');

// 5) 배너 코드 커버리지 + bannerLabel
for (const short of ['캐릭터', '광추', '일반', '출발']) {
  assert.ok(I.BANNER_CODE[short], `BANNER_CODE에 ${short} 누락`);
  assert.ok(DICTS.ko['banner.' + I.BANNER_CODE[short]], `ko에 banner.${I.BANNER_CODE[short]} 누락`);
}
I.setLang('ko');
assert.strictEqual(I.bannerLabel('캐릭터'), '캐릭터');

console.log('i18n.test.js OK');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node web/ui_kits/dashboard/i18n.test.js`
Expected: FAIL — `Cannot find module './i18n/ko.js'`.

- [ ] **Step 3: Create the four dictionaries (minimal seed keys)**

각 파일은 동일 키 집합이어야 한다. 우선 아래 **공유 라벨 키**만 시드로 넣고, Task A3~A4에서 화면 키를 추가한다(추가 시 4개 파일 동시 갱신 — A1 테스트가 정합성 강제).

`web/ui_kits/dashboard/i18n/ko.js`:

```js
window.I18N_DICTS = window.I18N_DICTS || {};
window.I18N_DICTS.ko = {
  'banner.char': '캐릭터',
  'banner.lc': '광추',
  'banner.std': '일반',
  'banner.departure': '출발',
  'result.win': '픽승',
  'result.loss': '픽뚫',
  'result.guaranteed': '확정',
  'scope.all': '전체',
};
```

`en.js` (동일 키, 값만 교체):

```js
window.I18N_DICTS = window.I18N_DICTS || {};
window.I18N_DICTS.en = {
  'banner.char': 'Character',
  'banner.lc': 'Light Cone',
  'banner.std': 'Standard',
  'banner.departure': 'Departure',
  'result.win': 'Won',
  'result.loss': 'Lost',
  'result.guaranteed': 'Guaranteed',
  'scope.all': 'All',
};
```

`zh.js`:

```js
window.I18N_DICTS = window.I18N_DICTS || {};
window.I18N_DICTS.zh = {
  'banner.char': '角色',
  'banner.lc': '光锥',
  'banner.std': '群星',
  'banner.departure': '始发',
  'result.win': '没歪',
  'result.loss': '歪了',
  'result.guaranteed': '大保底',
  'scope.all': '全部',
};
```

`ja.js`:

```js
window.I18N_DICTS = window.I18N_DICTS || {};
window.I18N_DICTS.ja = {
  'banner.char': 'キャラクター',
  'banner.lc': '光円錐',
  'banner.std': '群星',
  'banner.departure': '始発',
  'result.win': 'すり抜けなし',
  'result.loss': 'すり抜け',
  'result.guaranteed': 'PU確定',
  'scope.all': '全体',
};
```

- [ ] **Step 4: Create `web/ui_kits/dashboard/i18n.js`**

```js
// 경량 i18n 런타임(무빌드). 사전은 window.I18N_DICTS.{ko,en,zh,ja}.
// t()가 현재 I18N.lang을 읽으므로, 최상위 lang state 변경으로 트리를 재렌더하면
// 모든 t() 호출이 새 언어로 재평가된다(Context/prop drilling 불필요).
(function () {
  var DICTS = window.I18N_DICTS || (window.I18N_DICTS = {});
  var SUPPORTED = ['ko', 'en', 'zh', 'ja'];

  function langOf(str) {
    var s = String(str || '').toLowerCase();
    if (s.indexOf('zh') === 0) return 'zh';
    if (s.indexOf('ja') === 0) return 'ja';
    if (s.indexOf('en') === 0) return 'en';
    if (s.indexOf('ko') === 0) return 'ko';
    return 'ko';
  }

  // 결정 순서: ?lang= → localStorage → navigator → ko
  function initialLang() {
    try {
      var q = new URLSearchParams(location.search).get('lang');
      if (q && SUPPORTED.indexOf(langOf(q)) >= 0) return langOf(q);
      var saved = localStorage.getItem('hsrwarp-lang');
      if (saved && SUPPORTED.indexOf(saved) >= 0) return saved;
    } catch (e) {}
    return langOf((navigator && navigator.language) || 'ko');
  }

  function interpolate(s, vars) {
    if (!vars) return s;
    return s.replace(/\{(\w+)\}/g, function (m, k) {
      return vars[k] != null ? vars[k] : m;
    });
  }

  var BANNER_CODE = { '캐릭터': 'char', '광추': 'lc', '일반': 'std', '출발': 'departure' };

  var I18N = {
    lang: initialLang(),
    langOf: langOf,
    BANNER_CODE: BANNER_CODE,
    setLang: function (l) {
      var n = langOf(l);
      if (SUPPORTED.indexOf(n) < 0) n = 'ko';
      I18N.lang = n;
      return n;
    },
    t: function (key, vars) {
      var d = DICTS[I18N.lang] || {};
      var v = d[key];
      if (v == null) v = (DICTS.ko || {})[key];     // ko 폴백
      if (v == null) return key;                     // 완전 누락 → key
      return interpolate(v, vars);
    },
    bannerLabel: function (short) {
      var code = BANNER_CODE[short];
      return code ? I18N.t('banner.' + code) : short;
    },
  };
  window.I18N = I18N;
})();
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node web/ui_kits/dashboard/i18n.test.js`
Expected: PASS — `i18n.test.js OK`.

- [ ] **Step 6: Commit**

```bash
git add web/ui_kits/dashboard/i18n.js web/ui_kits/dashboard/i18n/ web/ui_kits/dashboard/i18n.test.js
git commit -m "feat(dashboard): i18n 코어 + ko/en/zh/ja 사전 스캐폴드 (#12)"
```

---

## Task A2: index.html 로드 + Dashboard.jsx lang state/셀렉터/URL

**Files:**
- Modify: `web/ui_kits/dashboard/index.html:81-99`
- Modify: `web/ui_kits/dashboard/Dashboard.jsx`

**Interfaces:**
- Consumes: `window.I18N` (A1).
- Produces: 헤더 언어 셀렉터, `lang` state, `?lang=` URL 동기화, `<html lang>` 갱신. 컴포넌트는 이후 `window.I18N.t()`만 호출하면 lang 변경 시 자동 재렌더된다.

- [ ] **Step 1: index.html — i18n 스크립트 로드 + 초기 lang 인라인**

`<script src="data.js"></script>`(85행) 앞에 사전+런타임을 로드하고, 테마 선반영 스크립트(82-84행) 옆에 `<html lang>`을 선반영한다.

`index.html`의 `<body>` 초입 인라인 스크립트(82-84행)를 다음으로 교체:

```html
<script>
  // apply persisted theme + lang before paint to avoid a flash
  try { document.documentElement.setAttribute('data-theme', localStorage.getItem('hsrwarp-theme') || 'dark'); } catch (e) {}
</script>
<script src="i18n/ko.js"></script>
<script src="i18n/en.js"></script>
<script src="i18n/zh.js"></script>
<script src="i18n/ja.js"></script>
<script src="i18n.js"></script>
<script>
  try { document.documentElement.setAttribute('lang', window.I18N.lang); } catch (e) {}
</script>
<script src="data.js"></script>
```

- [ ] **Step 2: Dashboard.jsx — lang state + 효과 + 셀렉터**

`const { ThemeToggle, Tabs, Select } = window.HSRWarpDesignSystem_4a0d44;`(7행) 아래에 `const t = window.I18N.t;` 추가.

`theme` state 블록(13-20행) 아래에 lang state와 동기화 효과 추가:

```jsx
  const [lang, setLangState] = React.useState(() => window.I18N.lang);
  React.useEffect(() => {
    window.I18N.setLang(lang);
    document.documentElement.setAttribute('lang', lang);
    try { localStorage.setItem('hsrwarp-lang', lang); } catch (e) {}
    try {
      const u = new URL(window.location.href);
      u.searchParams.set('lang', lang);
      window.history.replaceState(null, '', u);
    } catch (e) {}
  }, [lang]);
```

헤더 우측 영역(75-78행)의 `ThemeToggle` 앞에 언어 셀렉터 추가:

```jsx
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          {loaded && <RefreshBar runFetch={runFetch} onLoaded={setData} lastUpdated={lastUpdated} />}
          <Select value={lang} onChange={(e) => setLangState(e.target.value)} aria-label="Language">
            <option value="ko">한국어</option>
            <option value="en">English</option>
            <option value="zh">中文</option>
            <option value="ja">日本語</option>
          </Select>
          <ThemeToggle value={theme} onChange={setTheme} />
        </div>
```

- [ ] **Step 3: Dashboard.jsx — 날짜 로케일**

`lastUpdated`(59행)의 `'ko-KR'`을 현재 lang 로케일로:

```jsx
  const LOCALE = { ko: 'ko-KR', en: 'en-US', zh: 'zh-CN', ja: 'ja-JP' };
  const lastUpdated = ts ? ts.toLocaleTimeString(LOCALE[lang] || 'ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }) : '';
```

- [ ] **Step 4: 수동 검증 — 셀렉터 동작**

Run: `go build -ldflags="-s -w" -o hsr-warp.exe . && ./hsr-warp.exe` (PATH에 go 없으면 `$env:Path = 'C:\Program Files\Go\bin;' + $env:Path`)
Expected: 대시보드가 열리고 헤더에 언어 셀렉터 노출. 언어 변경 시 URL에 `?lang=` 반영, 새로고침 후 유지, 콘솔 오류 없음(이 시점엔 본문 라벨은 아직 한국어 — A3/A4에서 치환).

- [ ] **Step 5: Commit**

```bash
git add web/ui_kits/dashboard/index.html web/ui_kits/dashboard/Dashboard.jsx
git commit -m "feat(dashboard): 언어 셀렉터 + lang state/URL/html lang 동기화 (#12)"
```

---

## Task A3: 추출 완료 가드 테스트 (한글 잔존 0) — 실패 상태로 추가

**Files:**
- Create: `web/ui_kits/dashboard/nohardcode.test.js`

**Interfaces:**
- Consumes: 없음(소스 grep).
- Produces: `npm test`에서 컴포넌트·util.js·data.js의 **주석 외** 한글 표시문자열 잔존을 0으로 강제. A4/A5 추출 완료의 객관적 종료 조건.

- [ ] **Step 1: Write the failing test** — `web/ui_kits/dashboard/nohardcode.test.js`

```js
const assert = require('assert');
const fs = require('fs');
const path = require('path');

// 검사 대상: 화면에 렌더되는 소스. (사전 i18n/*.js, Dashboard.jsx의 <option> 표기 제외)
const FILES = [
  'QueryPanel.jsx', 'RefreshBar.jsx', 'HeroSummary.jsx', 'BannerCards.jsx',
  'ChartsGrid.jsx', 'FivesTable.jsx', 'MonthlyTable.jsx', 'FiveDetail.jsx',
  'OverviewView.jsx', 'BannersView.jsx', 'HistoryView.jsx', 'VersionsView.jsx',
  'util.js', 'data.js',
];

// 줄 단위로 주석(// ...)을 제거한 뒤 한글이 남아있으면 미추출.
function stripLineComment(line) {
  const i = line.indexOf('//');
  return i >= 0 ? line.slice(0, i) : line;
}
const HANGUL = /[가-힣]/;
// 허용: 정규 키로 유지되는 배너 short/스코프/결과 한국어 리터럴(로직 값).
// 이들은 표시 시 bannerLabel()/t()로 감싸므로 "비교/키" 맥락에서만 등장해야 한다.
const ALLOW = /['"](캐릭터|광추|일반|출발|전체)['"]/g;

let bad = [];
for (const f of FILES) {
  const p = path.join(__dirname, f);
  const lines = fs.readFileSync(p, 'utf8').split('\n');
  lines.forEach((ln, i) => {
    let code = stripLineComment(ln).replace(ALLOW, '');
    if (HANGUL.test(code)) bad.push(`${f}:${i + 1}: ${ln.trim()}`);
  });
}
assert.strictEqual(bad.length, 0, '미추출 한글 표시문자열:\n' + bad.join('\n'));
console.log('nohardcode.test.js OK');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node web/ui_kits/dashboard/nohardcode.test.js`
Expected: FAIL — 12개 컴포넌트+util.js+data.js의 한글 라벨이 대량 출력됨(아직 미추출).

- [ ] **Step 3: Commit (red 가드)**

```bash
git add web/ui_kits/dashboard/nohardcode.test.js
git commit -m "test(dashboard): 한글 표시문자열 잔존 0 가드(추출 완료 조건) (#12)"
```

> 이 테스트는 A4/A5 완료 시 green이 된다. 그 전까지는 의도된 실패.

---

## Task A4: util.js / data.js / 단순 라벨 컴포넌트 추출

대상: `util.js`, `data.js`, `OverviewView.jsx`, `FivesTable.jsx`, `MonthlyTable.jsx`, `ChartsGrid.jsx`, `BannerCards.jsx`. 각 한글 표시문자열을 사전 키로 옮기고 `t()`/`bannerLabel()`로 치환한다. **새 키는 4개 사전(ko/en/zh/ja)에 동시 추가**(A1 정합성 테스트가 강제).

**Files:**
- Modify: `web/ui_kits/dashboard/util.js:7-9`
- Modify: `web/ui_kits/dashboard/data.js:58,134-135,145`
- Modify: `web/ui_kits/dashboard/OverviewView.jsx`, `FivesTable.jsx`, `MonthlyTable.jsx`, `ChartsGrid.jsx`, `BannerCards.jsx`
- Modify: `web/ui_kits/dashboard/i18n/{ko,en,zh,ja}.js`

**Interfaces:**
- Consumes: `window.I18N.t`, `window.I18N.bannerLabel` (A1).
- Produces: 아래 신규 키들(ko 값 기준; en/zh/ja는 §용어표 + 번역으로 채움):

```
common.times='회'  common.count='개'  common.now='현재'
err.connect='서버 연결 실패'  err.fetch='조회 실패'  err.fetchPrefix='조회 실패: '  err.parse='응답 처리에 실패했습니다.'
overview.recent5='최근 5★'  overview.seeAll='전체 기록 보기 →'
table.name='이름' table.banner='배너' table.pity='천장' table.result='결과' table.version='버전' table.time='획득 시각'
table.empty5='해당 조건의 5★ 기록이 없습니다.'  table.more='더보기 ({n}개 남음)'
monthly.title='월별 집계' monthly.month='월' monthly.pulls='뽑기' monthly.jade='성옥' monthly.five='5★' monthly.got5='획득 5★'
monthly.empty='월별 기록이 없습니다.' monthly.more='더보기 ({n}개월 남음)'
charts.title='분석 차트' charts.rarity='희귀도 분포' charts.pityDist='캐릭터 배너 5★ 천장 분포'
charts.ff='50/50 결과 (한정 배너)' charts.monthly='월별 뽑기'
bannercards.title='배너별 현황' bannercards.warpSuffix=' 워프' bannercards.cap='/ {cap} 천장'
bannercards.total='총 뽑기' bannercards.got5='5★ 획득' bannercards.avgPulls='평균 뽑기 수'
bannercards.wlg='픽승 / 픽뚫 / 확정' bannercards.nextGuaranteed='다음 5★ 확정'
```

- [ ] **Step 1: 4개 사전에 위 키 추가**

각 `i18n/{lang}.js`에 동일 키 추가. ko는 위 값 그대로. en 예시(요지):

```js
  'common.times': '', 'common.count': '', 'common.now': 'now',
  'err.connect': 'Server connection failed', 'err.fetch': 'Fetch failed',
  'err.fetchPrefix': 'Fetch failed: ', 'err.parse': 'Failed to process response.',
  'overview.recent5': 'Recent 5★', 'overview.seeAll': 'View all history →',
  'table.name': 'Name', 'table.banner': 'Banner', 'table.pity': 'Pity',
  'table.result': 'Result', 'table.version': 'Version', 'table.time': 'Obtained',
  'table.empty5': 'No 5★ records match.', 'table.more': 'Show more ({n} left)',
  'monthly.title': 'Monthly', 'monthly.month': 'Month', 'monthly.pulls': 'Pulls',
  'monthly.jade': 'Jade', 'monthly.five': '5★', 'monthly.got5': '5★ obtained',
  'monthly.empty': 'No monthly records.', 'monthly.more': 'Show more ({n} months left)',
  'charts.title': 'Charts', 'charts.rarity': 'Rarity', 'charts.pityDist': 'Char banner 5★ pity',
  'charts.ff': '50/50 results (limited)', 'charts.monthly': 'Pulls by month',
  'bannercards.title': 'Banners', 'bannercards.warpSuffix': ' Warp', 'bannercards.cap': '/ {cap} pity',
  'bannercards.total': 'Total pulls', 'bannercards.got5': '5★ obtained', 'bannercards.avgPulls': 'Average pulls',
  'bannercards.wlg': 'Won / Lost / Guaranteed', 'bannercards.nextGuaranteed': 'Next 5★ guaranteed',
```

> zh/ja도 §용어표 기반으로 동일 키 채움(워프=跃迁/跳躍, 천장=硬保底/天井, 평균 뽑기 수=平均抽数/平均回数 등). 영어 단위(`common.times`/`count`)는 보통 빈 문자열 또는 단어; ko는 `회`/`개`.

- [ ] **Step 2: util.js — 결과 라벨을 t()로**

`util.js:6-10` 교체. 색은 유지, label만 `t()`. (RESULT는 호출 시점 평가되도록 getter나 함수로)

```js
  // 결과 라벨은 호출 시점의 언어로 평가되어야 하므로 함수로 노출.
  function resultMeta(code) {
    var C = { win: 'var(--gold-ink)', loss: 'var(--red)', guaranteed: 'var(--green)' };
    return { label: window.I18N.t('result.' + code), color: C[code] };
  }
```

이 파일에서 `RESULT[code]`를 쓰던 곳을 `resultMeta(code)`로 바꾸고, export 객체에 `resultMeta`를 추가한다(파일 끝 `window.WarpUtil = {...}`에 포함). 기존 `RESULT` 상수 제거.

- [ ] **Step 3: data.js — '현재'/에러 메시지 t()로**

`data.js:58` `'현재'` → `window.I18N.t('common.now')`:

```js
      v: r.v, period: `${r.s} ~ ${r.e || window.I18N.t('common.now')}`, total: r.total, count5: r.count5,
```

`data.js:134-135, 145` 에러 메시지 치환:

```js
        let msg = window.I18N.t('err.connect');
        if (e && e.data) { try { msg = window.I18N.t('err.fetchPrefix') + JSON.parse(e.data).message; } catch (x) { msg = window.I18N.t('err.fetch'); } }
```

```js
        } catch (x) { reject(new Error(window.I18N.t('err.parse'))); }
```

- [ ] **Step 4: 컴포넌트 치환**

각 파일 상단 함수 본문 첫 줄에 `const t = window.I18N.t;`(및 필요 시 `const bl = window.I18N.bannerLabel;`)를 추가하고 한글 리터럴을 키로 교체. 핵심 매핑:

- `OverviewView.jsx:14-15`: `최근 5★`→`t('overview.recent5')`, `전체 기록 보기 →`→`t('overview.seeAll')`.
- `FivesTable.jsx:15`: 표 헤더 6개 → `t('table.name')`…`t('table.time')`. `:18` 빈 메시지 → `t('table.empty5')`. `:40` `더보기 ({rest}개 남음)` → `t('table.more', { n: rest })`. **배너 칸**에서 `f.banner` 표시는 `bl(f.banner)`로(값은 정규 short 유지). **결과 칸**은 `window.WarpUtil.resultMeta(f.result).label`.
- `MonthlyTable.jsx:20,23,26,41`: `월별 집계`→`t('monthly.title')`, 헤더 5개→`t('monthly.month')`…`t('monthly.got5')`, 빈→`t('monthly.empty')`, 더보기→`t('monthly.more',{n:rest})`.
- `ChartsGrid.jsx:20`: `pityBins(D.fives, '캐릭터')`의 `'캐릭터'`는 **정규 short(로직 키)라 유지**. `:35-37,44-46` 차트 dataset `label`: `픽승/픽뚫/확정`→`t('result.win'/'loss'/'guaranteed')`, `3★/4★/5★`는 별표 라벨이라 유지. `:57-62` 제목 5개→`t('charts.*')`.
- `BannerCards.jsx:11,17,23,29-35`: `배너별 현황`→`t('bannercards.title')`; `{b.short} 워프`→`{bl(b.short)}{t('bannercards.warpSuffix')}` 또는 `t('bannercards.warpName',{name:bl(b.short)})`(키 추가 시 정합성 갱신); `/ {b.cap} 천장`→`t('bannercards.cap',{cap:b.cap})`; Row 라벨들→`t('bannercards.total'/'got5'/'avgPulls'/'wlg')`; `다음 5★ 확정`→`t('bannercards.nextGuaranteed')`.

> ⚠ `b.short`/`f.banner`/`'캐릭터'`(pityBins 인자)는 정규 키이므로 **값 자체는 절대 번역하지 말 것**. 표시할 때만 `bl()`로 감싼다. A3 테스트의 `ALLOW`가 이 리터럴을 허용하지만, 표시 위치에 그대로 두면 화면에 한국어가 남는다 → 표시부는 반드시 `bl()` 적용.

- [ ] **Step 5: Run tests**

Run: `node web/ui_kits/dashboard/i18n.test.js && node web/ui_kits/dashboard/nohardcode.test.js`
Expected: i18n PASS. nohardcode는 아직 FAIL(미추출: QueryPanel/RefreshBar/HeroSummary/BannersView/HistoryView/VersionsView/FiveDetail — A5에서 처리). 단, 본 태스크 대상 7파일은 출력에서 사라져야 한다.

- [ ] **Step 6: Commit**

```bash
git add web/ui_kits/dashboard/util.js web/ui_kits/dashboard/data.js web/ui_kits/dashboard/OverviewView.jsx web/ui_kits/dashboard/FivesTable.jsx web/ui_kits/dashboard/MonthlyTable.jsx web/ui_kits/dashboard/ChartsGrid.jsx web/ui_kits/dashboard/BannerCards.jsx web/ui_kits/dashboard/i18n/
git commit -m "feat(dashboard): util/data + 단순 라벨 컴포넌트 i18n 추출 (#12)"
```

---

## Task A5: 인터랙션 컴포넌트 추출 (필터·셀렉터의 정규키 분리)

대상: `QueryPanel.jsx`, `RefreshBar.jsx`, `HeroSummary.jsx`, `BannersView.jsx`, `HistoryView.jsx`, `VersionsView.jsx`, `FiveDetail.jsx`, `Dashboard.jsx`(잔여 라벨). **여기서 핵심은 HistoryView/BannersView의 필터·선택 state를 정규 코드로 바꾸고 라벨만 번역**하는 것.

**Files:**
- Modify: 위 8개 파일 + `web/ui_kits/dashboard/i18n/{ko,en,zh,ja}.js`

**Interfaces:**
- Consumes: `window.I18N.t`, `bannerLabel`, `window.WarpUtil.resultMeta` (A1/A4).
- Produces: 추가 키(ko 기준):

```
query.needPath='게임 경로를 입력하세요.' query.failed='조회에 실패했습니다.'
query.placeholder='게임 경로 (…\Star Rail Games)' query.running='조회 중…' query.run='조회'
query.hint1a='게임에서 ' query.hint1b=' 화면을 최근 24시간 내 한 번 연 뒤 조회하세요.' query.recordScreen='전언 기록'
query.hint2='기존 데이터는 안전하게 보존되며 신규만 추가됩니다.'
refresh.needPath='경로 필요' refresh.fetchFailed='조회 실패' refresh.lastUpdated='마지막 갱신'
refresh.pathPlaceholder='게임 경로' refresh.closePath='경로 닫기' refresh.path='경로' refresh.running='갱신 중…' refresh.refresh='↻ 새로고침'
hero.luckLabel='운 지표 · 캐릭터 평균 뽑기 수' hero.lucky='행운' hero.unlucky='불운'
hero.luckDescLucky='이론 평균 {avg}회 대비 적게 쓰고 뽑았습니다 — 5★ {n}개 기준.'
hero.luckDescUnlucky='이론 평균 {avg}회 대비 더 많이 썼습니다 — 5★ {n}개 기준.'
hero.scaleLuckyLess='행운 ◂ 적게' hero.scaleAvg='평균 62.5' hero.scaleMoreUnlucky='많이 ▸ 불운'
hero.winrateLabel='픽승률 · 캐릭터 50/50'
hero.winrateDesc='승부 {c}회 중 {w}승 · {l}패 · 확정 {g}회'
hero.rangeStats='구간 통계' hero.nextGuaranteedLoss='다음 5★ 확정 (픽뚫 상태)' hero.next5050='다음 5★ 50/50'
hero.avgLabel='평균 뽑기 수 · 캐릭터' hero.bestWorst='최고 운 {best}회 · 최악 {worst}회'
hero.totalPulls='총 뽑기' hero.jade='소비 성옥' hero.jadeUnit='≈ {n}연차' hero.rate5='5★ 확률'
banners.rangeStats='구간 통계 · {name} 워프' banners.currentPity='현재 천장 · {name} 워프'
banners.cap='/ {cap} 천장' banners.nextGuaranteedLoss='다음 5★ 확정 (픽뚫 상태)' banners.next5050='다음 5★ 50/50'
banners.total='총 뽑기' banners.got5='5★ 획득' banners.avgPulls='평균 뽑기 수' banners.jade='소비 성옥'
banners.pityDist='5★ 천장 분포' banners.fiveList='{name} 워프 5★ 기록' banners.count='({n}개)'
history.filterBanner='배너' history.filterResult='결과'
history.summary='총 {n}개 · 행을 클릭하면 상세가 열립니다.'
versions.compareRange='비교 범위' versions.clickRow='행을 클릭해 해당 패치를 강조하세요.'
versions.avgCompare='캐릭터 평균 뽑기 수 비교' versions.avgCompareNote='· 짧을수록 행운 (기준 62.5)'
versions.colVersion='버전' versions.colPeriod='기간' versions.colPulls='뽑기' versions.col5='5★'
versions.colAvg='캐릭 평균뽑기' versions.colWl='픽승 / 픽뚫'
detail.title='{name} · 5★ 상세' detail.warpSuffix=' 워프' detail.standardLoss='상시 / 픽뚫'
detail.pity='천장' detail.capUnit='/ {cap}회' detail.version='버전' detail.time='획득 시각' detail.pityProgress='천장 진행'
detail.descBody='이 5★는 {pity}회에 떴습니다 — 이 배너의 이론 평균 {avg}회 대비 ' detail.descLess='{n}회 적게' detail.descMore='{n}회 많이' detail.descTail=' 썼습니다.'
detail.loss50='50/50에서 픽업이 아닌 5★가 나와 다음 한정은 확정입니다.' detail.win50='50/50 승부에서 픽업을 뽑았습니다.' detail.guaranteed50='직전 픽뚫로 인한 확정 획득입니다.'
detail.standardOnly='상시(스텔라) 워프 획득으로 50/50 판정 대상이 아닙니다.'
empty.noData='아직 불러온 기록이 없습니다' empty.hint='게임에서 {a} 화면을 연 뒤 위의 {b} 버튼을 누르면 천장 · 운 · 픽뚫 통계가 여기에 나타납니다.'
empty.recordScreen='전언 → 기록' empty.queryBtn='조회'
header.subtitleLoaded='{uid}모든 분석은 로컬에서만 처리됩니다.' header.subtitleEmpty='완전 로컬 · 매달 자동 갱신 · 기록은 외부로 전송되지 않습니다.'
header.title2='워프 대시보드'
tabs.overview='개요' tabs.banners='배너별' tabs.history='기록' tabs.versions='버전 비교'
scope.label='버전 구간' scope.allPeriod='전체 기간'
foot.line1='뽑기 1회 = 성옥 160 기준 · 비공식 도구이며 호요버스와 무관 · 데이터 형식 SRGF v1.0'
foot.line2='50/50 판정: 5★ 획득 시점의 배너 픽업(rate-up) 대상이면 ‘픽승’, 아니면 ‘픽뚫’.'
warn.unknown5='⚠ 미확인 5★ {n}개 — 획득 시점이 픽업 일정에 없어요(신규 패치 미반영). 최신 배너는 시작 시 자동 반영됩니다(미반영 시 잠시 후 재실행).'
update.newVersion='새 버전 {v}가 나왔습니다 —' update.download='설치본 다운로드' update.schedule='배너 데이터 {v}로 갱신되었습니다.'
```

- [ ] **Step 1: 4개 사전에 위 키 추가(en/zh/ja 번역)**

ko는 위 값 그대로. en/zh/ja는 §용어표 기반 번역. 보간 변수명(`{name}{avg}{n}{cap}{pity}{w}{l}{g}{c}{best}{worst}{uid}{v}{a}{b}`)은 4개 언어 모두 동일하게 유지.

- [ ] **Step 2: HistoryView.jsx — 필터 state를 정규 코드로**

`:4-8` 필터 정의를 코드 기반으로 바꾼다(라벨은 표시 시 번역):

```jsx
  const [banner, setBanner] = React.useState('전체');   // 정규 short or '전체'
  const [result, setResult] = React.useState('전체');   // 'win'|'loss'|'guaranteed'|'전체'
  const t = window.I18N.t, bl = window.I18N.bannerLabel;

  const bannerCodes = ['전체', '캐릭터', '광추', '일반'];               // 값=정규
  const bannerLabels = bannerCodes.map((c) => (c === '전체' ? t('scope.all') : bl(c)));
  const resultCodes = ['전체', 'win', 'loss', 'guaranteed'];           // 값=정규
  const resultLabels = resultCodes.map((c) => (c === '전체' ? t('scope.all') : t('result.' + c)));
```

`:11-12` 필터링은 코드로 비교(라벨 매핑 불필요):

```jsx
    (banner === '전체' || f.banner === banner) &&
    (result === '전체' || f.result === result));
```

`:17-18` ChipGroup은 라벨을 보여주되 선택은 코드로 처리. ChipGroup이 라벨 배열을 받는 구조라면 인덱스 매핑이 필요하므로, 라벨↔코드 변환 핸들러를 둔다:

```jsx
        <ChipGroup label={t('history.filterBanner')} options={bannerLabels}
          value={bannerLabels[bannerCodes.indexOf(banner)]}
          onChange={(lbl) => setBanner(bannerCodes[bannerLabels.indexOf(lbl)])} />
        <ChipGroup label={t('history.filterResult')} options={resultLabels}
          value={resultLabels[resultCodes.indexOf(result)]}
          onChange={(lbl) => setResult(resultCodes[resultLabels.indexOf(lbl)])} />
```

`:21` 요약 → `t('history.summary', { n: rows.length })`(굵게 표시가 필요하면 JSX 분해는 유지하되 텍스트만 키로).

- [ ] **Step 3: BannersView.jsx — 선택 state 유지(정규) + 라벨 번역**

`:7` `useState('캐릭터')`는 정규 short라 **유지**. 세그먼트 컨트롤 라벨만 `bl()`로. `:35,40,44-52,58,62-64,71`의 한글을 키로:
- `구간 통계 · ${b.short} 워프`→`t('banners.rangeStats',{name:bl(b.short)})`, `현재 천장 · ...`→`t('banners.currentPity',{name:bl(b.short)})`.
- `/ {b.cap} 천장`→`t('banners.cap',{cap:b.cap})`.
- 배지: `다음 5★ 확정 (픽뚫 상태)`→`t('banners.nextGuaranteedLoss')`, `다음 5★ 50/50`→`t('banners.next5050')`.
- Mini 라벨 4개→`t('banners.total'/'got5'/'avgPulls'/'jade')`(단위 `개`/`회`는 `common.count`/`common.times` 결합 또는 키 본문에 포함).
- Split 라벨 `픽승/픽뚫/확정`→`t('result.win'/'loss'/'guaranteed')`.
- `5★ 천장 분포`→`t('banners.pityDist')`; 제목→`t('banners.fiveList',{name:bl(b.short)})` + `t('banners.count',{n:fives.length})`.
- 세그먼트 컨트롤이 `['캐릭터','광추','일반']` 옵션을 쓰면 HistoryView와 동일 라벨↔코드 매핑 적용(선택값 정규 유지).

- [ ] **Step 4: VersionsView.jsx**

`:7` `useState('전체')` 유지. `:12` 비교(`v.v.startsWith`)는 그대로. `:17-19` `비교 범위`→`t('versions.compareRange')`, `<option value="전체">전체</option>`의 표시는 `t('scope.all')`(value는 `전체` 유지), `4.x`/`3.x`는 버전 리터럴이라 유지. `:23` →`t('versions.clickRow')`. `:27` →`t('versions.avgCompare')` + `t('versions.avgCompareNote')`. `:33` 헤더 6개→`t('versions.col*')`. `:74` 툴팁 `${...}회`→`${...}${t('common.times')}`.

- [ ] **Step 5: HeroSummary.jsx / FiveDetail.jsx / QueryPanel.jsx / RefreshBar.jsx**

각 파일 첫 줄 `const t = window.I18N.t;` 추가 후 §Interfaces 키로 치환:
- HeroSummary: `:25,28,31,35,40,47,52,56,58-59,65,67,70,82-86`의 한글/`회`/`행운`/`불운`/라벨/설명/배지/StatCard label·unit을 대응 키로. 행운/불운 분기는 `lucky ? t('hero.luckDescLucky',{avg:62.5,n:cb.count5}) : t('hero.luckDescUnlucky',{...})`.
- FiveDetail: `:23,25,27,31-33,36,46-51`의 제목/태그/배지/Stat/설명 문장을 키로. 설명은 `detail.descBody`+(`descLess`|`descMore`)+`descTail` 조합, 결과 문장은 `detail.loss50`/`win50`/`guaranteed50`/`standardOnly`. `f.banner`는 `bl(f.banner)`.
- QueryPanel: `:17,25,30(주석 아님? 30행 order는 정규 배열 유지),37,38,42-43,58`. `order=['캐릭터','광추','일반']`와 `prog['출발']`은 **정규 키라 유지**(서버 progress 이벤트 키). 진행 표시에서 배너명을 보여줄 때만 `bl()`. placeholder/버튼/힌트는 키로.
- RefreshBar: `:16,24,36,40,43,44`의 라벨/버튼/placeholder를 키로.

- [ ] **Step 6: Dashboard.jsx — 잔여 라벨**

`:51-56` tabs label→`t('tabs.*')`; `:68` `워프 대시보드`→`t('header.title2')`; `:71-72` 부제→`t('header.subtitleLoaded',{uid:uid?'UID '+uid+' · ':''})`/`t('header.subtitleEmpty')`; `:88-91` 빈 상태→`t('empty.noData')`/`t('empty.hint',{a:...,b:...})`(굵은 부분은 JSX 분해 유지); `:99` 경고→`t('warn.unknown5',{n:D.unknown5})`; `:108,110` `버전 구간`→`t('scope.label')`, `전체 기간`→`t('scope.allPeriod')`(option value `전체` 유지); `:123-124` 푸터→`t('foot.line1')`/`t('foot.line2')`; UpdateBar `:144,149` →`t('update.*')`.

- [ ] **Step 7: Run all dashboard tests**

Run: `node web/ui_kits/dashboard/i18n.test.js && node web/ui_kits/dashboard/nohardcode.test.js`
Expected: 둘 다 PASS (`nohardcode.test.js OK`).

- [ ] **Step 8: 수동 4언어 검증**

Run: `go build -ldflags="-s -w" -o hsr-warp.exe . && ./hsr-warp.exe`
Expected: ko/en/zh/ja 전환 시 전 화면 라벨/배너명/필터/차트 라벨/모달 번역, 필터·버전구간 동작 정상, 콘솔 오류 없음. `?lang=ja`로 직접 접속 시 일본어 시작.

- [ ] **Step 9: Commit**

```bash
git add web/ui_kits/dashboard/
git commit -m "feat(dashboard): 인터랙션 컴포넌트 i18n 추출 + 필터 정규키 분리 (#12)"
```

---

# PART B — 가이드 사이트

## Task B1: 산문 사전 분리 + 키 정합성 테스트

**Files:**
- Create: `docs/site/src/i18n/ko.js`, `en.js`, `zh.js`, `ja.js`, `index.js`
- Test: `docs/site/src/i18n/parity.test.mjs`

**Interfaces:**
- Produces:
  - `src/i18n/ko.js` 등: `export default { ... }` 평면 키-값(GuidePage 산문 전체).
  - `src/i18n/index.js`: `export const LANGS = ['ko','en','zh','ja'];`, `export function dictOf(lang)`(미지원→ko), `export function langFromPath(pathname)`(`/en/`→`en` … 그 외 `ko`).
  - `parity.test.mjs`: 4개 사전 키 정합성.

- [ ] **Step 1: ko 사전 추출** — `docs/site/src/i18n/ko.js`

`GuidePage.jsx`의 모든 한국어 텍스트(nav 링크, hero, features, quick start, metrics, files, troubleshoot, faq, cta, footer)를 키-값으로. **`평균 천장`→`평균 뽑기 수`로 교정**(line 71, 171 — #11 정정·스펙 §7 일치). 예(요지, 전체 추출):

```js
export default {
  'nav.start': '빠른 시작', 'nav.metrics': '지표', 'nav.files': '저장 파일',
  'nav.trouble': '문제 해결', 'nav.faq': 'FAQ', 'nav.download': '다운로드', 'nav.repo': 'GitHub 저장소',
  'hero.eyebrow': 'Honkai: Star Rail · 워프 기록 분석',
  'hero.h1a': '내 전언 기록을,', 'hero.h1b': '내 PC에서.',
  'hero.lead': '붕괴: 스타레일의 전언(워프) 기록을 가져와 천장 · 운 · 픽뚫(50/50) · 월별 통계를 한눈에 보여주는 작은 프로그램입니다. 설치하고 실행하면 브라우저에 대시보드가 자동으로 열립니다.',
  // ... (GuidePage의 나머지 모든 한국어 문자열을 빠짐없이) ...
  'mock.luckLabel': '운 지표 · 캐릭터 평균 뽑기 수',          // 교정됨
  'metric.avgPityTitle': '평균 뽑기 수',                      // 교정됨(구 '평균 천장')
  'foot.bottomMono': 'SRGF v1.0 · 캐릭터 90 / 광추 80 하드천장',
};
```

> 추출 누락 방지: B3의 `copy.test.mjs` 업데이트가 필수 카피 존재/구 카피 부재를 강제한다.

- [ ] **Step 2: en/zh/ja 사전** — 동일 키, 번역값

`src/i18n/{en,zh,ja}.js`에 ko와 **동일 키**로 번역 채움. §용어표 준수(워프=Warp/跃迁/跳躍, 천장=hard pity/硬保底/天井, 평균 뽑기 수=Average pulls/平均抽数/平均回数, 픽승·픽뚫=§result). 고유명(Honkai: Star Rail, SRGF, MIT, URL)은 유지.

- [ ] **Step 3: index.js**

```js
import ko from './ko.js';
import en from './en.js';
import zh from './zh.js';
import ja from './ja.js';

export const LANGS = ['ko', 'en', 'zh', 'ja'];
const DICTS = { ko, en, zh, ja };
export function dictOf(lang) { return DICTS[lang] || ko; }
export function langFromPath(pathname) {
  const m = /^\/(en|zh|ja)(\/|$)/.exec(pathname || '/');
  return m ? m[1] : 'ko';
}
```

- [ ] **Step 4: Write the parity test** — `docs/site/src/i18n/parity.test.mjs`

```js
import assert from 'node:assert';
import ko from './ko.js';
import en from './en.js';
import zh from './zh.js';
import ja from './ja.js';

const koKeys = Object.keys(ko).sort();
for (const [name, d] of [['en', en], ['zh', zh], ['ja', ja]]) {
  assert.deepStrictEqual(Object.keys(d).sort(), koKeys, `${name} 사전 키가 ko와 불일치`);
}
console.log('site i18n parity OK');
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node docs/site/src/i18n/parity.test.mjs`
Expected: PASS — `site i18n parity OK` (불일치 시 FAIL → 누락 키 보강).

- [ ] **Step 6: Commit**

```bash
git add docs/site/src/i18n/
git commit -m "feat(site): 가이드 산문 ko/en/zh/ja 사전 분리 + 키 정합성 테스트 (#12)"
```

---

## Task B2: GuidePage lang 렌더 + 셀렉터 + 프리렌더 다언어

**Files:**
- Modify: `docs/site/src/pages/GuidePage.jsx`
- Modify: `docs/site/src/App.jsx`
- Modify: `docs/site/src/entry-server.jsx`, `docs/site/src/entry-client.jsx`
- Modify: `docs/site/prerender.mjs`

**Interfaces:**
- Consumes: `dictOf`, `LANGS`, `langFromPath` (B1).
- Produces: `render(lang)` (entry-server), 언어별 `dist/static/{en,zh,ja}/index.html` + 루트 ko.

- [ ] **Step 1: GuidePage.jsx — t 인자 + 셀렉터**

`export function GuidePage({ lang = 'ko' })` 시그니처로 바꾸고 본문 시작에 사전·헬퍼:

```jsx
import { dictOf } from '../i18n/index.js';
export function GuidePage({ lang = 'ko' }) {
  const d = dictOf(lang);
  const t = (k) => d[k] ?? k;
  const logo = import.meta.env.BASE_URL + 'logo-train.svg';
  // 언어별 홈 경로: ko='/', 그 외 '/{lang}/'. BASE_URL 접두.
  const base = import.meta.env.BASE_URL;
  const langHref = (l) => (l === 'ko' ? base : base + l + '/');
```

모든 한국어 텍스트를 `t('key')`로 치환. nav `.nav-right`에 언어 셀렉터 추가(실제 링크):

```jsx
            <div className="lang-switch">
              <a href={langHref('ko')} className={lang === 'ko' ? 'on' : ''}>KO</a>
              <a href={langHref('en')} className={lang === 'en' ? 'on' : ''}>EN</a>
              <a href={langHref('zh')} className={lang === 'zh' ? 'on' : ''}>ZH</a>
              <a href={langHref('ja')} className={lang === 'ja' ? 'on' : ''}>JA</a>
            </div>
```

(스타일은 `src/pages/guide.css`에 `.lang-switch{display:flex;gap:6px}` 등 최소 추가.)

- [ ] **Step 2: App.jsx — lang 전파 + 셀렉터 클릭 시 localStorage 저장**

`App`이 `lang`을 받아 `GuidePage`에 넘기고, 언어 링크 클릭 시 `hsrwarp-lang` 저장:

```jsx
export function App({ lang = 'ko' }) {
  useEffect(() => {
    // ... 기존 테마/리빌 로직 ...
    const onLangClick = (e) => {
      const a = e.target.closest('.lang-switch a');
      if (a) { try { localStorage.setItem('hsrwarp-lang', a.textContent.trim().toLowerCase()); } catch (x) {} }
    };
    document.addEventListener('click', onLangClick);
    return () => { /* 기존 cleanup */ document.removeEventListener('click', onLangClick); };
  }, []);
  return <GuidePage lang={lang} />;
}
```

- [ ] **Step 3: entry-server.jsx — render(lang)**

```jsx
import { renderToString } from 'react-dom/server';
import { App } from './App.jsx';
export function render(lang = 'ko') {
  return renderToString(<App lang={lang} />);
}
```

- [ ] **Step 4: entry-client.jsx — 경로에서 lang 판별 + 루트 리다이렉트**

```jsx
import { hydrateRoot } from 'react-dom/client';
import './ds/styles.css';
import './pages/guide.css';
import { App } from './App.jsx';
import { langFromPath } from './i18n/index.js';

const lang = langFromPath(window.location.pathname);
// 루트(ko)에서 저장 언어가 있고 ko가 아니면 1회 리다이렉트(정적 canonical 보존).
if (lang === 'ko') {
  try {
    const saved = localStorage.getItem('hsrwarp-lang');
    if (saved && saved !== 'ko' && ['en', 'zh', 'ja'].includes(saved)) {
      const base = import.meta.env.BASE_URL;
      window.location.replace(base + saved + '/');
    }
  } catch (e) {}
}
hydrateRoot(document.getElementById('root'), <App lang={lang} />);
```

- [ ] **Step 5: prerender.mjs — 4언어 루프 + hreflang**

기존 단일 렌더를 언어 루프로 교체:

```js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const abs = (p) => path.resolve(here, p);
const LANGS = ['ko', 'en', 'zh', 'ja'];
const TITLE = {
  ko: 'HSR 워프 대시보드 — 내 전언 기록을, 내 PC에서',
  en: 'HSR Warp Dashboard — Your warp history, on your PC',
  zh: 'HSR 跃迁仪表盘 — 你的跃迁记录，本地分析',
  ja: 'HSR 跳躍ダッシュボード — あなたの跳躍履歴をPCで',
};
const DESC = { /* ko/en/zh/ja meta description (스펙 §7 용어) */ };

const template = fs.readFileSync(abs('dist/static/index.html'), 'utf-8');
const { render } = await import(pathToFileURL(abs('dist/server/entry-server.js')).href);

const hreflang = LANGS.map((l) =>
  `<link rel="alternate" hreflang="${l}" href="/${l === 'ko' ? '' : l + '/'}">`
).join('\n') + '\n<link rel="alternate" hreflang="x-default" href="/">';

for (const lang of LANGS) {
  let html = template
    .replace('<!--app-html-->', render(lang))
    .replace('<html lang="ko"', `<html lang="${lang}"`)
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${TITLE[lang]}</title>`)
    .replace('</head>', hreflang + '\n</head>');
  if (DESC[lang]) html = html.replace(/(<meta name="description" content=")[\s\S]*?(">)/, `$1${DESC[lang]}$2`);
  const outDir = lang === 'ko' ? abs('dist/static') : abs(`dist/static/${lang}`);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'index.html'), html);
}

fs.copyFileSync(abs('../architecture.html'), abs('dist/static/architecture.html'));
fs.rmSync(abs('dist/server'), { recursive: true, force: true });
console.log('prerendered ' + LANGS.join(', '));
```

- [ ] **Step 6: 빌드 검증**

Run: `cd docs/site && npm run build`
Expected: `dist/static/index.html`(ko) + `dist/static/{en,zh,ja}/index.html` 생성, 각 `<html lang>` 일치, 콘솔 오류 없음. `npm run preview` 후 `/`, `/en/`, `/zh/`, `/ja/` 접속 시 해당 언어로 표시, 자산(logo/css) 정상 로드.

- [ ] **Step 7: Commit**

```bash
git add docs/site/src docs/site/prerender.mjs
git commit -m "feat(site): 언어별 프리렌더(/, /en/, /zh/, /ja/) + 셀렉터·리다이렉트 (#12)"
```

---

## Task B3: copy.test.mjs 이전 + prerender 가드

**Files:**
- Modify: `docs/site/copy.test.mjs`

**Interfaces:**
- Consumes: `src/i18n/ko.js`, `prerender.mjs` (B1/B2).
- Produces: 검사 대상을 ko 사전으로 이전(산문이 GuidePage.jsx 밖으로 이동했으므로) + prerender 4언어 가드.

- [ ] **Step 1: copy.test.mjs 업데이트**

```js
// 가이드 카피 정합성 가드(소스레벨, 빌드 불필요). drift 재발 방지.
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const koSrc = readFileSync(join(dir, 'src/i18n/ko.js'), 'utf8');
const guide = readFileSync(join(dir, 'src/pages/GuidePage.jsx'), 'utf8');
const prerender = readFileSync(join(dir, 'prerender.mjs'), 'utf8');

// 필수 카피는 ko 사전에 존재해야 한다(산문 이전 후).
for (const need of ['설치 마법사', 'hsr-warp-setup-', '/ui_kits/dashboard/', '%LOCALAPPDATA%', 'schedule.json']) {
  assert.ok(koSrc.includes(need), `required copy missing in ko dict: "${need}"`);
}
// architecture.html 링크는 GuidePage 마크업(번역 불필요 URL)에 유지.
assert.ok(guide.includes('architecture.html'), 'architecture.html 링크 누락');

// 구 카피 재유입 방지 + #11 용어 교정 유지.
for (const bad of ['dashboard.html', '같은 폴더', '설치 불필요', '실행파일 하나가 전부', '실행파일 하나만 받으면', '평균 천장']) {
  assert.ok(!koSrc.includes(bad), `stale copy present in ko dict: "${bad}"`);
}

// prerender가 4개 언어를 모두 출력하는지(소스 가드).
for (const l of ['ko', 'en', 'zh', 'ja']) {
  assert.ok(prerender.includes(`'${l}'`), `prerender missing lang: ${l}`);
}
console.log('copy.test.mjs OK');
```

- [ ] **Step 2: Run test**

Run: `node docs/site/copy.test.mjs`
Expected: PASS — `copy.test.mjs OK`. (`평균 천장`이 ko 사전에 남아있으면 FAIL → `평균 뽑기 수`로 교정 확인.)

- [ ] **Step 3: Commit**

```bash
git add docs/site/copy.test.mjs
git commit -m "test(site): copy 가드를 ko 사전으로 이전 + prerender 4언어 가드 (#12)"
```

---

## Task C1: 전체 회귀 + 최종 검증

**Files:** 없음(검증만).

- [ ] **Step 1: 전체 자동 테스트**

Run: `node web/ui_kits/dashboard/i18n.test.js && node web/ui_kits/dashboard/nohardcode.test.js && node docs/site/src/i18n/parity.test.mjs && npm test`
Expected: 모두 PASS (`npm test`의 go + analyze + copy 포함).

- [ ] **Step 2: 포맷·정적검사**

Run: `gofmt -l . ; go vet ./...`
Expected: gofmt 출력 없음(본 작업은 Go 미수정이라 변화 없어야 함), vet 통과.

- [ ] **Step 3: 대시보드 4언어 수동 검증**

Run: `go build -ldflags="-s -w" -o hsr-warp.exe . && ./hsr-warp.exe`
Expected: ko/en/zh/ja 전 화면 전환, 새로고침·`?lang=` 공유 유지, 배너명/필터/모달/차트 라벨 번역, 콘솔 오류 0.

- [ ] **Step 4: 사이트 4언어 수동 검증**

Run: `cd docs/site && npm run build && npm run preview`
Expected: `/`(ko)·`/en/`·`/zh/`·`/ja/` 정상, 셀렉터 링크 이동, 저장 언어 루트 리다이렉트 동작, hreflang 존재.

- [ ] **Step 5: 최종 커밋(있다면)**

```bash
git add -A && git commit -m "chore(i18n): 전체 회귀 검증 정리 (#12)"
```

---

## Self-Review 결과 (작성자 점검)

- **스펙 커버리지**: §5 대시보드(A1~A5), §6 사이트(B1~B3), §7 용어표(상단+각 태스크 참조), §8 테스트(i18n.test/nohardcode/parity/copy 갱신/C1), §2 비범위(architecture.html·Go 로그 미수정) 모두 태스크로 매핑됨.
- **정규키 일관성**: 배너 short·`전체`·결과 코드를 전 태스크에서 "값 유지·표시만 번역"으로 통일. `bannerLabel`/`resultMeta`/`scope.all` 명칭이 A1·A4·A5에서 동일.
- **플레이스홀더**: 사전의 en/zh/ja 산문 번역값은 "용어표 기반으로 채움"으로 명시 — 이는 로직 공백이 아니라 콘텐츠 산출이며, 키 정합성 테스트가 완성도를 강제한다. ko 값과 키 스키마는 전부 명시.
- **알려진 트레이드오프**: 사이트 프리렌더 산출물(실제 4파일 생성)은 빌드 의존이라 자동 테스트가 아닌 B2 Step6/C1 Step4 수동 검증 + copy.test.mjs 소스 가드로 커버.
