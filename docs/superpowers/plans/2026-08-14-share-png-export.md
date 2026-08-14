# 공유하기 PNG 내보내기 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 대시보드에서 원하는 섹션만 골라 브라우저 로컬에서 PNG 한 장으로 내보내는 공유 기능을 만든다.

**Architecture:** 현재 활성 탭의 DOM에서 `data-share` 마커가 붙은 섹션을 클론해 오프스크린 720px 고정 폭 컨테이너에 세로로 쌓고, `modern-screenshot`으로 한 번에 PNG blob을 만든다. 검증 가능한 순수 로직은 `share.js`(`window.WarpShare`)에 모으고, UI는 `ShareModal.jsx`가 담당한다. 원본 DOM은 절대 변형하지 않는다 — 마스킹·컨트롤 제거는 전부 클론 트리에서만 일어난다.

**Tech Stack:** 무빌드 React 18 UMD + `@babel/standalone` 런타임 트랜스파일, Chart.js 4 UMD, `modern-screenshot@4.7.0` UMD, 테스트는 `node` + `assert` (테스트 러너·jsdom 없음).

**Spec:** `docs/superpowers/specs/2026-08-14-share-png-export-design.md`

## Global Constraints

- **테스트 러너 없음.** 테스트는 `node <파일>` + `assert`로 직접 실행한다. `node:test`, vitest, jsdom을 도입하지 않는다.
- **`.jsx`는 `require` 불가.** 브라우저 `@babel/standalone` 전용이다. `.jsx`를 테스트하려면 `fs.readFileSync` + 정규식 정적 검사만 가능하다.
- **모듈 시스템 없음.** 모든 파일은 마지막 줄에서 `window.X = X`로 전역 등록한다.
- **CDN 규약** (`cdn-sri.test.js`): `<script>` 한 줄에 `https://` src + 정확한 3자리 semver + `integrity="sha384-..."` + `crossorigin=`. `.development.js` 금지.
- **하드코딩 금지** (`nohardcode.test.js`): FILES 목록의 파일에는 따옴표 밖 한글이 없어야 한다. 한글 주석은 **`//` 라인 주석만** — 블록 주석 `/* */`은 제거되지 않아 실패한다. 예외 허용은 `'캐릭터'|'광추'|'일반'|'출발'|'전체'` 5개 로직 키뿐.
- **i18n 키 정합** (`i18n.test.js`): ko/en/zh/ja 4개 파일의 키 집합이 `deepStrictEqual`로 완전히 같아야 한다.
- **lang 반응성** (`lang-reactivity.test.js`): `.jsx`에서 `window.I18N.lang` 직접 참조 금지(예외: `useState(() => window.I18N.lang)` 단일 패턴). `lang`은 prop으로 받는다. `window.I18N.setLang(`은 같은 줄에 `=>`가 있는 핸들러 안에서만.
- **캡처 라이브러리 고정값**: `https://cdn.jsdelivr.net/npm/modern-screenshot@4.7.0/dist/index.js`, SRI `sha384-5Ua3TI0kiMYH8QdNy+vc5IWS3MTa2DzQEm/uKFDQ+/biJctek9hiSP6moIm2PVog`, 전역 `window.modernScreenshot`, 사용 함수 `domToBlob`.
- **고정 폭 720px**, PNG 파일명 `hsr-warp-<YYYYMMDD>-<HHmm>.png`.
- **원본 DOM 불변**: 마스킹·컨트롤 제거는 클론 트리에만 적용한다.

---

### Task 1: `share.js` 순수 로직 + 테스트 하네스

`share.js`의 검증 가능한 부분(레지스트리, 섹션 선택, 마스킹 문자열, 파일명)을 먼저 만든다. DOM 함수는 Task 5에서 같은 파일에 추가한다.

**Files:**
- Create: `web/ui_kits/dashboard/share.js`
- Create: `web/ui_kits/dashboard/share.test.js`
- Modify: `package.json:13` (test 체인)

**Interfaces:**
- Consumes: 없음 (첫 태스크)
- Produces: `window.WarpShare` 에 다음을 노출한다. 이후 태스크가 이 이름들에 의존한다.
  - `SECTIONS: Array<{id: string, labelKey: string}>` — 고정 11개 항목
  - `selectSections(present: string[], checked: string[]) => string[]`
  - `maskUid(text: string, uid: string) => string`
  - `shareFileName(date: Date) => string`

- [ ] **Step 1: 실패하는 테스트를 작성한다**

`web/ui_kits/dashboard/share.test.js` 를 새로 만든다. 기존 `util.test.js` 관례를 따른다 — `global.window = global` 후 `require`, 마지막에 `console.log('<파일명> OK')`.

```js
const assert = require('assert');

// 공유 PNG 내보내기의 순수 로직 가드. DOM 합성/캡처 함수는 jsdom 이 없어 여기서 검증하지 않는다
// (실기기·브라우저 육안 검증에 의존한다 — 설계 문서 8장).
global.window = global;
require('./share.js');
const { SECTIONS, selectSections, maskUid, shareFileName } = window.WarpShare;

// --- SECTIONS 레지스트리 ---

// 1) id 중복이 없어야 한다. DOM 마커와 1:1 대응이 깨지면 섹션이 조용히 사라진다.
const ids = SECTIONS.map((s) => s.id);
assert.strictEqual(new Set(ids).size, ids.length, 'SECTIONS 에 중복 id 가 있다');

// 2) 모든 항목이 id 와 labelKey 를 가진다.
for (const s of SECTIONS) {
  assert.ok(s.id && typeof s.id === 'string', 'SECTIONS 항목에 id 가 없다');
  assert.ok(/^share\.section\./.test(s.labelKey), 'labelKey 는 share.section.* 형식이어야 한다: ' + s.id);
}

// --- selectSections: 화면에 실재하는 섹션 ∩ 체크된 섹션, DOM 순서 보존 ---

// 3) DOM 순서를 따른다(체크 순서가 아니라).
assert.deepStrictEqual(
  selectSections(['hero', 'banners', 'charts'], ['charts', 'hero']),
  ['hero', 'charts'],
);

// 4) 화면에 없는 섹션은 체크돼 있어도 빠진다(탭을 옮긴 뒤의 잔여 선택).
assert.deepStrictEqual(selectSections(['hero'], ['hero', 'versions']), ['hero']);

// 5) 레지스트리에 없는 id 는 무시한다.
assert.deepStrictEqual(selectSections(['hero', 'bogus'], ['hero', 'bogus']), ['hero']);

// 6) 아무것도 체크하지 않으면 빈 배열 — 내보내기 버튼 비활성화의 근거다.
assert.deepStrictEqual(selectSections(['hero', 'charts'], []), []);

// --- maskUid: 순수 문자열 치환 ---

// 7) uid 를 같은 길이의 • 로 바꾼다.
assert.strictEqual(maskUid('UID 800123456 · 전체 기록', '800123456'), 'UID ••••••••• · 전체 기록');

// 8) 한 문자열에 여러 번 나와도 전부 바꾼다.
assert.strictEqual(maskUid('800123456 / 800123456', '800123456'), '••••••••• / •••••••••');

// 9) uid 가 없으면(빈 문자열·null) 원본 그대로 — 마스킹 OFF 및 UID 미노출 계정 방어.
assert.strictEqual(maskUid('UID 없음', ''), 'UID 없음');
assert.strictEqual(maskUid('UID 없음', null), 'UID 없음');

// 10) uid 가 포함되지 않은 문자열은 건드리지 않는다.
assert.strictEqual(maskUid('평균 뽑기 62.5', '800123456'), '평균 뽑기 62.5');

// --- shareFileName ---

// 11) 로컬 시각 기준 hsr-warp-YYYYMMDD-HHmm.png (월은 0-based 이므로 7 = 8월).
assert.strictEqual(shareFileName(new Date(2026, 7, 14, 15, 30)), 'hsr-warp-20260814-1530.png');

// 12) 한 자리 월·일·시·분은 0 으로 채운다.
assert.strictEqual(shareFileName(new Date(2026, 0, 5, 9, 7)), 'hsr-warp-20260105-0907.png');

console.log('share.test.js OK');
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `node web/ui_kits/dashboard/share.test.js`
Expected: FAIL — `Cannot find module './share.js'`

- [ ] **Step 3: `share.js` 를 구현한다**

`web/ui_kits/dashboard/share.js` 를 새로 만든다.

```js
// 공유 PNG 내보내기 — 순수 로직(레지스트리·선택·마스킹·파일명).
// DOM 합성과 캡처는 같은 파일 아래쪽에 있다. 원본 DOM 은 절대 변형하지 않는다.
(function () {
  // 섹션 레지스트리 — id 는 각 .jsx 의 data-share 마커와 1:1 대응한다.
  // 존재 여부와 순서는 DOM 이 진실이다. 여기에는 라벨 매핑만 둔다.
  const SECTIONS = [
    // overview 탭
    { id: 'hero', labelKey: 'share.section.hero' },
    { id: 'banners', labelKey: 'share.section.banners' },
    { id: 'charts', labelKey: 'share.section.charts' },
    { id: 'monthly', labelKey: 'share.section.monthly' },
    { id: 'recent', labelKey: 'share.section.recent' },
    // banners 탭
    { id: 'banner-status', labelKey: 'share.section.bannerStatus' },
    { id: 'banner-pity', labelKey: 'share.section.bannerPity' },
    { id: 'banner-fives', labelKey: 'share.section.bannerFives' },
    // history 탭
    { id: 'history', labelKey: 'share.section.history' },
    // versions 탭
    { id: 'versions', labelKey: 'share.section.versions' },
    { id: 'version-pity', labelKey: 'share.section.versionPity' },
  ];

  const KNOWN = new Set(SECTIONS.map((s) => s.id));

  // 화면에 실재하는 섹션(present, DOM 순서) 중 체크된 것만 추린다.
  // 순서는 present 를 따른다 — 사용자가 체크한 순서가 아니라 화면 순서로 쌓아야
  // 결과물이 화면과 같은 흐름으로 읽힌다.
  function selectSections(present, checked) {
    const on = new Set(checked || []);
    return (present || []).filter((id) => KNOWN.has(id) && on.has(id));
  }

  // 문자열에서 uid 를 같은 길이의 • 로 치환한다. uid 가 비면 원본 그대로.
  function maskUid(text, uid) {
    if (!uid) return text;
    return String(text).split(uid).join('•'.repeat(uid.length));
  }

  const p2 = (n) => String(n).padStart(2, '0');

  // hsr-warp-YYYYMMDD-HHmm.png (로컬 시각)
  function shareFileName(date) {
    const d = date || new Date();
    const ymd = String(d.getFullYear()) + p2(d.getMonth() + 1) + p2(d.getDate());
    const hm = p2(d.getHours()) + p2(d.getMinutes());
    return 'hsr-warp-' + ymd + '-' + hm + '.png';
  }

  window.WarpShare = { SECTIONS, selectSections, maskUid, shareFileName };
})();
```

- [ ] **Step 4: 테스트를 돌려 통과를 확인한다**

Run: `node web/ui_kits/dashboard/share.test.js`
Expected: PASS — `share.test.js OK`

- [ ] **Step 5: `package.json` test 체인에 등록한다**

`package.json:13` 의 `test` 스크립트에서 `node web/ui_kits/dashboard/util.test.js &&` 바로 뒤에 `node web/ui_kits/dashboard/share.test.js &&` 를 끼워 넣는다.

변경 후 해당 구간이 이렇게 되어야 한다:

```
node web/analyze.test.js && node web/ui_kits/dashboard/util.test.js && node web/ui_kits/dashboard/share.test.js && node web/ui_kits/dashboard/i18n.test.js && ...
```

- [ ] **Step 6: 전체 테스트를 돌린다**

Run: `npm test`
Expected: PASS — `share.test.js OK` 가 출력에 포함되고 기존 테스트 전부 통과.

- [ ] **Step 7: 커밋**

```bash
git add web/ui_kits/dashboard/share.js web/ui_kits/dashboard/share.test.js package.json
git commit -m "feat(dashboard): 공유 PNG 순수 로직 — 섹션 레지스트리·선택·마스킹·파일명"
```

---

### Task 2: `data-share` 마커 부여

각 섹션 래퍼에 `data-share` 를, 캡처에서 빼야 할 컨트롤에 `data-share-omit` 을 붙인다. 마커와 레지스트리가 어긋나면 섹션이 조용히 사라지므로 **정적 검사 테스트로 강제**한다.

**Files:**
- Modify: `web/ui_kits/dashboard/HeroSummary.jsx:22`, `BannerCards.jsx:12`, `ChartsGrid.jsx:57`, `MonthlyTable.jsx:20`, `OverviewView.jsx:13,16`, `FivesTable.jsx:42`, `BannersView.jsx:18,38,70,83`, `HistoryView.jsx:19,30`, `VersionsView.jsx:27,43,48`, `Dashboard.jsx:81,92`
- Modify: `web/ui_kits/dashboard/share.test.js` (정적 검사 추가)

**Interfaces:**
- Consumes: Task 1 의 `window.WarpShare.SECTIONS`
- Produces: DOM 마커 규약 — `[data-share="<id>"]` 섹션 래퍼, `[data-share-omit]` 제외 대상, `[data-share-header]` 헤더

- [ ] **Step 1: 실패하는 정적 검사 테스트를 추가한다**

`share.test.js` 의 `console.log('share.test.js OK');` **바로 위**에 다음을 추가한다.

```js
// --- 마커 정합: SECTIONS 의 모든 id 가 실제 .jsx 에 data-share 로 존재하는가 ---
// (.jsx 는 브라우저 babel 전용이라 require 할 수 없다 — 소스를 읽어 정적 검사한다.)
const fs = require('fs');
const path = require('path');

const JSX_FILES = [
  'HeroSummary.jsx', 'BannerCards.jsx', 'ChartsGrid.jsx', 'MonthlyTable.jsx',
  'OverviewView.jsx', 'BannersView.jsx', 'HistoryView.jsx', 'VersionsView.jsx',
  'Dashboard.jsx',
];
const src = JSX_FILES
  .map((f) => fs.readFileSync(path.join(__dirname, f), 'utf8'))
  .join('\n');

// 13) 레지스트리의 모든 섹션 id 에 대응하는 data-share 마커가 있어야 한다.
for (const s of SECTIONS) {
  assert.ok(
    src.includes('data-share="' + s.id + '"'),
    'data-share="' + s.id + '" 마커가 .jsx 어디에도 없다 — 이 섹션은 공유 목록에 절대 나타나지 않는다',
  );
}

// 14) 반대로, 소스에 있는 data-share 값은 전부 레지스트리에 있어야 한다(오타 방어).
const marked = [...src.matchAll(/data-share="([^"]+)"/g)].map((m) => m[1]);
for (const id of marked) {
  assert.ok(ids.includes(id), 'data-share="' + id + '" 가 SECTIONS 레지스트리에 없다');
}

// 15) 헤더 마커는 정확히 하나여야 한다(합성 시 querySelector 로 잡는다).
assert.strictEqual(
  (src.match(/data-share-header/g) || []).length, 1,
  'data-share-header 는 Dashboard.jsx 의 <header> 에 정확히 하나 있어야 한다',
);
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `node web/ui_kits/dashboard/share.test.js`
Expected: FAIL — `data-share="hero" 마커가 .jsx 어디에도 없다`

- [ ] **Step 3: overview 탭 섹션에 마커를 붙인다**

`HeroSummary.jsx:22` — `<div>` → `<div data-share="hero">`

`BannerCards.jsx:12` — `<section style={{ marginTop: 26 }}>` → `<section data-share="banners" style={{ marginTop: 26 }}>`

`ChartsGrid.jsx:57` — `<section style={{ marginTop: 26 }}>` → `<section data-share="charts" style={{ marginTop: 26 }}>`

`MonthlyTable.jsx:20` — `<section style={{ marginTop: 26 }}>` → `<section data-share="monthly" style={{ marginTop: 26 }}>`

`OverviewView.jsx:13` — `<section style={{ marginTop: 26 }}>` → `<section data-share="recent" style={{ marginTop: 26 }}>`

`OverviewView.jsx:16` — "전체 보기" 링크 버튼은 캡처에서 뺀다:

```jsx
<button className="linkbtn" data-share-omit onClick={onSeeAll}>{t('overview.seeAll')}</button>
```

`FivesTable.jsx:42` — "더보기" 버튼 래퍼도 캡처에서 뺀다. 이 표는 `recent`·`banner-fives`·`history` 세 섹션에 모두 쓰이므로 여기 한 곳만 고치면 전부 반영된다:

```jsx
        <div data-share-omit style={{ padding: '12px 12px 4px' }}>
```

- [ ] **Step 4: banners 탭 섹션에 마커를 붙인다**

`BannersView.jsx:18` — 세그먼트 피커 div 에 `data-share-omit` 추가:

```jsx
<div data-share-omit style={{ display: 'inline-flex', gap: 4, padding: 4, borderRadius: 'var(--r-pill)', background: 'var(--panel-2)', border: '1px solid var(--line)' }}>
```

`BannersView.jsx:38` — `<Card accent={b.color} padding={22}>` → `<Card accent={b.color} padding={22} data-share="banner-status">`

`BannersView.jsx:70` — `<Card padding={18}>` → `<Card padding={18} data-share="banner-pity">`

`BannersView.jsx:83` — `<section style={{ marginTop: 22 }}>` → `<section data-share="banner-fives" style={{ marginTop: 22 }}>`

> **주의:** DS `Card` 가 `data-*` 를 DOM 으로 통과시키는지 확인해야 한다. Step 6에서 검증한다.

- [ ] **Step 5: history / versions 탭과 헤더에 마커를 붙인다**

`HistoryView.jsx:19` — 필터 칩 행에 `data-share-omit`:

```jsx
<div data-share-omit style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: 16 }}>
```

`HistoryView.jsx:30` — `FivesTable` 을 마커 붙은 래퍼로 감싼다:

```jsx
      <div data-share="history">
        <FivesTable key={banner + '|' + result} rows={rows} onRowClick={onFiveClick} pageSize={20} />
      </div>
```

`VersionsView.jsx:27` — 필터 행에 `data-share-omit`:

```jsx
<div data-share-omit style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
```

`VersionsView.jsx:43` — `<Card padding={18} style={{ marginBottom: 16 }}>` → `<Card padding={18} style={{ marginBottom: 16 }} data-share="version-pity">`

`VersionsView.jsx:48` — `<Card padding={6}>` → `<Card padding={6} data-share="versions">`

`Dashboard.jsx:81` — 헤더에 마커:

```jsx
      <header data-share-header style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
```

`Dashboard.jsx:92` — 헤더 우측 컨트롤 그룹(새로고침·언어·테마)은 캡처에서 뺀다:

```jsx
        <div data-share-omit style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
```

- [ ] **Step 6: 테스트를 돌려 통과를 확인하고, DS `Card` 의 속성 통과 여부를 검증한다**

Run: `node web/ui_kits/dashboard/share.test.js`
Expected: PASS — `share.test.js OK`

이어서 DS `Card` 가 `data-share` 를 실제 DOM 으로 내보내는지 확인한다:

Run: `grep -n "function Card" -A 25 web/_ds_bundle.js | head -40`

`...rest` / `...props` 를 루트 엘리먼트에 spread 하면 통과된다. **spread 하지 않는다면** `Card` 에 붙인 3곳(`BannersView.jsx:38,70`, `VersionsView.jsx:43,48`)을 `Card` 를 감싸는 `<div data-share="...">` 래퍼로 바꾼다 — `HistoryView.jsx:30` 과 같은 방식이다. 이 경우 Step 1의 정적 검사는 그대로 통과한다.

- [ ] **Step 7: 브라우저에서 마커가 실제로 DOM 에 있는지 확인한다**

Run: `npm run build:debug` 후 `./hsr-warp-debug.exe` 실행 → 대시보드를 열고 DevTools 콘솔에서:

```js
[...document.querySelectorAll('[data-share]')].map(e => e.dataset.share)
```

Expected: overview 탭에서 `['hero','banners','charts','monthly','recent']` 가 이 순서로 나온다. 탭을 banners 로 바꾸면 `['banner-status','banner-pity','banner-fives']`.

- [ ] **Step 8: 커밋**

```bash
git add web/ui_kits/dashboard/
git commit -m "feat(dashboard): 공유 대상 섹션에 data-share 마커 부여"
```

---

### Task 3: CDN + SRI 로 `modern-screenshot` 추가

**Files:**
- Modify: `web/ui_kits/dashboard/index.html:76` 부근(CDN 블록), `:112` 부근(로컬 스크립트 블록)

**Interfaces:**
- Consumes: 없음
- Produces: 전역 `window.modernScreenshot` (`domToBlob` 사용), `share.js` 가 브라우저에 로드됨

- [ ] **Step 1: SRI 해시를 직접 검증한다**

추측하지 말고 실제 파일에서 산출해 아래 상수와 일치하는지 확인한다.

Run:
```bash
curl -sL "https://cdn.jsdelivr.net/npm/modern-screenshot@4.7.0/dist/index.js" -o ms.js
openssl dgst -sha384 -binary ms.js | openssl base64 -A
rm ms.js
```
Expected: `5Ua3TI0kiMYH8QdNy+vc5IWS3MTa2DzQEm/uKFDQ+/biJctek9hiSP6moIm2PVog`

값이 다르면 **출력된 값을 쓴다**(패키지가 재배포됐다는 뜻). 다음 스텝의 상수를 실제 값으로 교체한다.

- [ ] **Step 2: CDN 스크립트 태그를 추가한다**

`index.html` 의 `@babel/standalone` 줄(`:76`) **바로 다음 줄**에 한 줄로 추가한다. 규약상 `<script ...>` 가 한 줄이어야 정규식에 매칭된다.

```html
<script src="https://cdn.jsdelivr.net/npm/modern-screenshot@4.7.0/dist/index.js" integrity="sha384-5Ua3TI0kiMYH8QdNy+vc5IWS3MTa2DzQEm/uKFDQ+/biJctek9hiSP6moIm2PVog" crossorigin="anonymous"></script>
```

- [ ] **Step 3: `share.js` 를 로컬 스크립트 블록에 추가한다**

`index.html` 의 `<script src="util.js"></script>` 바로 다음 줄에 추가한다. `share.js` 는 plain JS 이므로 `type="text/babel"` 을 붙이지 않는다.

```html
<script src="share.js"></script>
```

- [ ] **Step 4: CDN 규약 테스트를 돌린다**

Run: `node web/ui_kits/dashboard/cdn-sri.test.js`
Expected: PASS — `cdn-sri.test.js OK`

- [ ] **Step 5: 브라우저에서 전역이 실제로 뜨는지 확인한다**

대시보드를 열고 DevTools 콘솔에서:

```js
typeof window.modernScreenshot.domToBlob
```

Expected: `'function'`

SRI 불일치면 콘솔에 integrity 오류가 뜨고 전역이 `undefined` 다 — 그 경우 Step 1로 돌아간다.

- [ ] **Step 6: 커밋**

```bash
git add web/ui_kits/dashboard/index.html
git commit -m "chore(dashboard): modern-screenshot@4.7.0 CDN+SRI 추가"
```

---

### Task 4: i18n 문구 ko/en/zh/ja

**Files:**
- Modify: `web/ui_kits/dashboard/i18n/ko.js`, `en.js`, `zh.js`, `ja.js`

**Interfaces:**
- Consumes: Task 1 의 `SECTIONS[].labelKey`
- Produces: `share.*` i18n 키 18개 — Task 6의 `ShareModal.jsx` 가 `t()` 로 소비한다

- [ ] **Step 1: 실패하는 정합성 테스트를 추가한다**

`share.test.js` 의 `console.log('share.test.js OK');` **바로 위**에 추가한다.

```js
// --- i18n 정합: 레지스트리의 labelKey 가 4개 로케일에 전부 있는가 ---
require('./i18n/ko.js');
require('./i18n/en.js');
require('./i18n/zh.js');
require('./i18n/ja.js');

// 16) 모든 섹션 labelKey 가 4개 로케일에 존재해야 한다.
//     (i18n.test.js 가 키 집합 일치를 따로 강제하지만, 여기서는 '레지스트리 ↔ 사전' 연결을 본다.)
for (const loc of ['ko', 'en', 'zh', 'ja']) {
  const dict = window.I18N_DICTS[loc];
  for (const s of SECTIONS) {
    assert.ok(dict[s.labelKey], loc + ' 사전에 ' + s.labelKey + ' 가 없다');
  }
  // 17) 모달 자체 문구도 4개 로케일에 있어야 한다.
  for (const k of ['share.button', 'share.title', 'share.sections', 'share.maskUid',
                   'share.export', 'share.exporting', 'share.failed', 'share.saveHint']) {
    assert.ok(dict[k], loc + ' 사전에 ' + k + ' 가 없다');
  }
}
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `node web/ui_kits/dashboard/share.test.js`
Expected: FAIL — `ko 사전에 share.section.hero 가 없다`

- [ ] **Step 3: `i18n/ko.js` 에 키를 추가한다**

파일 끝의 닫는 `};` 앞에 추가한다. 기존 파일의 들여쓰기·따옴표 스타일(작은따옴표, 2칸)을 그대로 따른다.

```js
  'share.button': '공유',
  'share.title': '공유 이미지 만들기',
  'share.sections': '포함할 섹션',
  'share.maskUid': 'UID 가리기',
  'share.export': 'PNG 내보내기',
  'share.exporting': '만드는 중…',
  'share.failed': '이미지를 만들지 못했습니다',
  'share.saveHint': '이미지를 길게 눌러 저장하세요',
  'share.section.hero': '요약',
  'share.section.banners': '배너 카드',
  'share.section.charts': '차트',
  'share.section.monthly': '월별 집계',
  'share.section.recent': '최근 5★',
  'share.section.bannerStatus': '배너 현황',
  'share.section.bannerPity': '천장 분포',
  'share.section.bannerFives': '배너 5★ 목록',
  'share.section.history': '전체 5★ 목록',
  'share.section.versions': '버전별 비교',
  'share.section.versionPity': '버전 평균 뽑기',
```

- [ ] **Step 4: `i18n/en.js` 에 같은 키를 추가한다**

```js
  'share.button': 'Share',
  'share.title': 'Create share image',
  'share.sections': 'Sections to include',
  'share.maskUid': 'Hide UID',
  'share.export': 'Export PNG',
  'share.exporting': 'Creating…',
  'share.failed': 'Could not create the image',
  'share.saveHint': 'Press and hold the image to save it',
  'share.section.hero': 'Summary',
  'share.section.banners': 'Banner cards',
  'share.section.charts': 'Charts',
  'share.section.monthly': 'Monthly',
  'share.section.recent': 'Recent 5★',
  'share.section.bannerStatus': 'Banner status',
  'share.section.bannerPity': 'Pity distribution',
  'share.section.bannerFives': 'Banner 5★ list',
  'share.section.history': 'Full 5★ list',
  'share.section.versions': 'Version comparison',
  'share.section.versionPity': 'Average pulls by version',
```

- [ ] **Step 5: `i18n/zh.js` 에 같은 키를 추가한다**

```js
  'share.button': '分享',
  'share.title': '生成分享图片',
  'share.sections': '包含的板块',
  'share.maskUid': '隐藏 UID',
  'share.export': '导出 PNG',
  'share.exporting': '生成中…',
  'share.failed': '无法生成图片',
  'share.saveHint': '长按图片即可保存',
  'share.section.hero': '总览',
  'share.section.banners': '卡池卡片',
  'share.section.charts': '图表',
  'share.section.monthly': '每月统计',
  'share.section.recent': '最近 5★',
  'share.section.bannerStatus': '卡池状态',
  'share.section.bannerPity': '保底分布',
  'share.section.bannerFives': '该卡池 5★ 列表',
  'share.section.history': '全部 5★ 列表',
  'share.section.versions': '版本对比',
  'share.section.versionPity': '各版本平均抽数',
```

- [ ] **Step 6: `i18n/ja.js` 에 같은 키를 추가한다**

```js
  'share.button': '共有',
  'share.title': '共有画像を作成',
  'share.sections': '含めるセクション',
  'share.maskUid': 'UID を隠す',
  'share.export': 'PNG を書き出す',
  'share.exporting': '作成中…',
  'share.failed': '画像を作成できませんでした',
  'share.saveHint': '画像を長押しして保存してください',
  'share.section.hero': 'サマリー',
  'share.section.banners': 'バナーカード',
  'share.section.charts': 'グラフ',
  'share.section.monthly': '月別集計',
  'share.section.recent': '最近の 5★',
  'share.section.bannerStatus': 'バナー状況',
  'share.section.bannerPity': '天井分布',
  'share.section.bannerFives': 'バナー 5★ 一覧',
  'share.section.history': '全 5★ 一覧',
  'share.section.versions': 'バージョン比較',
  'share.section.versionPity': 'バージョン別平均引き数',
```

- [ ] **Step 7: 테스트를 돌려 통과를 확인한다**

Run: `node web/ui_kits/dashboard/share.test.js && node web/ui_kits/dashboard/i18n.test.js`
Expected: PASS 둘 다 — `i18n.test.js` 가 4개 로케일 키 집합 일치를 `deepStrictEqual` 로 검증한다. 실패하면 어느 파일에 키가 빠졌다는 뜻이다.

- [ ] **Step 8: 커밋**

```bash
git add web/ui_kits/dashboard/i18n/ web/ui_kits/dashboard/share.test.js
git commit -m "feat(dashboard): 공유 기능 i18n 문구 ko/en/zh/ja"
```

---

### Task 5: 오프스크린 합성 · 캡처 · 저장

`share.js` 에 DOM 함수를 추가한다. jsdom 이 없어 유닛 테스트를 걸 수 없으므로 **브라우저 콘솔 검증이 이 태스크의 테스트**다.

**Files:**
- Modify: `web/ui_kits/dashboard/share.js`

**Interfaces:**
- Consumes: Task 1 의 `maskUid`, `shareFileName`; Task 2 의 DOM 마커; Task 3 의 `window.modernScreenshot`
- Produces: `window.WarpShare` 에 추가되는 함수 — Task 6의 `ShareModal.jsx` 가 소비한다
  - `presentSections() => string[]` — 현재 DOM 의 `[data-share]` id 를 DOM 순서로
  - `exportPng(opts: {ids: string[], uid: string|null, mask: boolean}) => Promise<Blob>`
  - `saveBlob(blob: Blob, filename: string) => boolean` — 다운로드 성공 시 `true`, 폴백이 필요하면 `false`

- [ ] **Step 1: 합성·캡처 함수를 구현한다**

`share.js` 의 `window.WarpShare = { ... };` **바로 위**에 추가하고, 마지막 노출 객체에 새 함수 3개를 더한다.

```js
  const SHARE_WIDTH = 720;

  // 현재 화면에 실재하는 섹션 id 를 DOM 순서로. 탭이 바뀌면 결과도 바뀐다.
  function presentSections() {
    return [...document.querySelectorAll('[data-share]')].map((el) => el.dataset.share);
  }

  // 클론 트리의 텍스트 노드만 순회하며 uid 를 가린다. 원본 DOM 은 건드리지 않는다.
  function maskUidIn(root, uid) {
    if (!uid) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      if (n.nodeValue && n.nodeValue.includes(uid)) n.nodeValue = maskUid(n.nodeValue, uid);
    }
  }

  // Chart.js 는 <canvas> 라 DOM 클론만으로는 빈 영역이 된다.
  // 원본 canvas 에서 인스턴스를 역참조해 PNG 로 굽고, 클론 쪽을 <img> 로 바꾼다.
  function swapCanvases(srcRoot, cloneRoot) {
    const srcs = srcRoot.querySelectorAll('canvas');
    const dsts = cloneRoot.querySelectorAll('canvas');
    for (let i = 0; i < srcs.length && i < dsts.length; i++) {
      const chart = window.Chart && window.Chart.getChart ? window.Chart.getChart(srcs[i]) : null;
      if (!chart) continue;
      const img = document.createElement('img');
      img.src = chart.toBase64Image();
      img.width = srcs[i].clientWidth;
      img.height = srcs[i].clientHeight;
      img.style.width = '100%';
      img.style.height = 'auto';
      dsts[i].parentNode.replaceChild(img, dsts[i]);
    }
  }

  // 선택 섹션을 오프스크린 고정 폭 컨테이너에 쌓아 PNG blob 을 만든다.
  // 화면 폭·스크롤 위치와 무관한 결과물이 나온다.
  async function exportPng(opts) {
    const ids = (opts && opts.ids) || [];
    const uid = opts && opts.uid;
    const mask = !!(opts && opts.mask);

    const box = document.createElement('div');
    box.className = 'page';
    box.style.cssText = 'position:fixed;left:-99999px;top:0;width:' + SHARE_WIDTH + 'px;padding:24px;';
    document.body.appendChild(box);

    try {
      // 헤더를 항상 맨 위에. UID 가 여기에만 있어서 마스킹의 대상이기도 하다.
      const header = document.querySelector('[data-share-header]');
      const srcs = [];
      if (header) srcs.push(header);
      for (const id of ids) {
        const el = document.querySelector('[data-share="' + id + '"]');
        if (el) srcs.push(el);
      }

      for (const src of srcs) {
        const clone = src.cloneNode(true);
        clone.style.marginTop = '18px';
        box.appendChild(clone);
        // 인터랙티브 컨트롤은 공유 이미지에 있을 자리가 없다.
        clone.querySelectorAll('[data-share-omit]').forEach((e) => e.remove());
        swapCanvases(src, clone);
      }

      if (mask && uid) maskUidIn(box, uid);

      // 웹폰트가 로드되기 전에 캡처하면 폰트가 폴백으로 굳는다.
      if (document.fonts && document.fonts.ready) await document.fonts.ready;

      // foreignObject 캡처는 배경이 투명하게 남으므로 실제 바탕색을 명시한다.
      const bg = getComputedStyle(document.body).backgroundColor;
      return await window.modernScreenshot.domToBlob(box, {
        width: SHARE_WIDTH,
        scale: 2,
        backgroundColor: bg,
      });
    } finally {
      box.remove();
    }
  }

  // blob 저장. 다운로드가 막힌 환경(iOS Safari 등)이면 false 를 돌려주고
  // 호출부가 미리보기 폴백으로 넘어간다.
  function saveBlob(blob, filename) {
    const a = document.createElement('a');
    if (typeof a.download === 'undefined') return false;
    const url = URL.createObjectURL(blob);
    try {
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      return true;
    } catch (e) {
      return false;
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }
  }
```

노출 객체를 다음으로 교체한다:

```js
  window.WarpShare = {
    SECTIONS, selectSections, maskUid, shareFileName,
    presentSections, exportPng, saveBlob,
  };
```

- [ ] **Step 2: 순수 로직 테스트가 여전히 통과하는지 확인한다**

Run: `node web/ui_kits/dashboard/share.test.js`
Expected: PASS

`share.js` 는 `node` 로도 로드되므로, 최상위에서 `document` 를 만지면 여기서 깨진다. 새 함수들은 전부 **호출될 때만** DOM 을 만지므로 통과해야 한다. 실패한다면 최상위 DOM 접근이 섞인 것이다.

- [ ] **Step 3: 브라우저에서 실제 캡처를 검증한다**

`npm run build:debug` 후 `./hsr-warp-debug.exe` 로 대시보드를 열고 데이터를 로드한 뒤, overview 탭에서 DevTools 콘솔:

```js
const ids = WarpShare.presentSections();
console.log(ids);
const blob = await WarpShare.exportPng({ ids, uid: '800123456', mask: true });
console.log(blob.type, blob.size);
WarpShare.saveBlob(blob, WarpShare.shareFileName(new Date()));
```

Expected:
- `ids` 가 `['hero','banners','charts','monthly','recent']`
- `blob.type` 이 `'image/png'`, `blob.size` 가 0보다 크게 (수백 KB 이상)
- 파일이 다운로드되고, **열어서 눈으로 확인**한다:
  - 차트가 빈 영역이 아니라 실제로 그려져 있다
  - 헤더의 새로고침·언어·테마 컨트롤이 **없다**
  - 폭이 1440px(720 × scale 2)이고 레이아웃이 화면과 같다
  - 배경이 투명이 아니라 테마 바탕색이다

- [ ] **Step 4: 마스킹과 원본 불변을 검증한다**

콘솔에서 실제 UID 로 마스킹 ON/OFF 를 각각 내보낸 뒤:

```js
document.querySelector('[data-share-header]').textContent
```

Expected: 마스킹 ON 으로 내보낸 **직후에도** 화면 헤더에 UID 가 원래대로 남아 있다. PNG 안에서는 `•••••••••` 로 보인다.

- [ ] **Step 5: 다크/라이트 양쪽에서 확인한다**

테마를 전환하고 Step 3을 반복한다.
Expected: 두 테마 모두 배경·글자색이 화면과 같게 나온다(CSS 변수가 살아 있다).

- [ ] **Step 6: 커밋**

```bash
git add web/ui_kits/dashboard/share.js
git commit -m "feat(dashboard): 오프스크린 고정폭 합성·PNG 캡처·저장 구현"
```

---

### Task 6: `ShareModal.jsx`

**Files:**
- Create: `web/ui_kits/dashboard/ShareModal.jsx`
- Modify: `web/ui_kits/dashboard/nohardcode.test.js:6-11` (FILES 목록)
- Modify: `web/ui_kits/dashboard/index.html` (스크립트 로드)

**Interfaces:**
- Consumes: Task 1·5 의 `window.WarpShare` 전부, Task 4 의 `share.*` i18n 키, DS `Dialog`·`Button`
- Produces: `window.ShareModal` — props `{ open: boolean, onClose: () => void, uid: string|null, lang: string }`

- [ ] **Step 1: `nohardcode.test.js` FILES 에 등록한다 (실패 유도)**

`nohardcode.test.js:6-11` 의 `FILES` 배열에서 `'OverviewView.jsx', 'BannersView.jsx', 'HistoryView.jsx', 'VersionsView.jsx',` 줄 뒤에 `'ShareModal.jsx',` 를 추가한다.

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `node web/ui_kits/dashboard/nohardcode.test.js`
Expected: FAIL — `ShareModal.jsx` 파일이 없어 `ENOENT` 로 죽는다. 이것이 다음 스텝을 강제한다.

- [ ] **Step 3: `ShareModal.jsx` 를 구현한다**

`web/ui_kits/dashboard/ShareModal.jsx` 를 새로 만든다. 한글 주석은 `//` 라인 주석만 쓰고, 표시 문구는 전부 `t()` 로 뺀다. `lang` 은 prop 으로 받는다.

```jsx
// 공유 모달 — 현재 탭에 실재하는 섹션을 체크해 PNG 한 장으로 내보낸다.
// 합성·캡처·저장은 전부 브라우저 로컬(window.WarpShare)에서 처리하고 서버로 올라가는 것은 없다.
function ShareModal({ open, onClose, uid, lang }) {
  const { Dialog, Button } = window.HSRWarpDesignSystem_4a0d44;
  const S = window.WarpShare;
  const t = window.I18N.t;

  const [present, setPresent] = React.useState([]);
  const [checked, setChecked] = React.useState([]);
  const [mask, setMask] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');
  const [preview, setPreview] = React.useState('');

  const labelOf = React.useMemo(() => {
    const m = {};
    // lang 이 바뀌면 라벨을 다시 만든다.
    for (const s of S.SECTIONS) m[s.id] = t(s.labelKey);
    return m;
  }, [lang]);

  // 모달을 열 때마다 현재 탭의 섹션을 다시 읽는다. 기본은 전체 선택.
  React.useEffect(() => {
    if (!open) return;
    const ids = S.presentSections();
    setPresent(ids);
    setChecked(ids);
    setErr('');
    setPreview('');
  }, [open]);

  // 미리보기 objectURL 은 모달이 닫히거나 새 이미지가 생기면 해제한다.
  React.useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function toggle(id) {
    setChecked((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  }

  async function run() {
    const ids = S.selectSections(present, checked);
    if (!ids.length || busy) return;
    setBusy(true); setErr(''); setPreview('');
    try {
      const blob = await S.exportPng({ ids, uid, mask });
      const ok = S.saveBlob(blob, S.shareFileName(new Date()));
      // 다운로드가 막힌 환경(iOS Safari 등)이면 모달 안에 이미지를 띄우고 길게 눌러 저장하게 한다.
      if (!ok) setPreview(URL.createObjectURL(blob));
    } catch (e) {
      setErr(e.message || t('share.failed'));
    }
    setBusy(false);
  }

  const picked = S.selectSections(present, checked);

  return (
    <Dialog open={!!open} onClose={onClose} title={t('share.title')} width={420}>
      <div className="lbl" style={{ marginBottom: 8 }}>{t('share.sections')}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {present.map((id) => (
          <label key={id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 2px', cursor: 'pointer', fontSize: 13.5 }}>
            <input type="checkbox" checked={checked.includes(id)} onChange={() => toggle(id)} />
            {labelOf[id] || id}
          </label>
        ))}
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)', cursor: 'pointer', fontSize: 13.5 }}>
        <input type="checkbox" checked={mask} onChange={(e) => setMask(e.target.checked)} />
        {t('share.maskUid')}
      </label>

      {err && <div style={{ marginTop: 12, color: 'var(--red)', fontSize: 12.5 }}>{err}</div>}

      {preview && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 8 }}>{t('share.saveHint')}</div>
          <img src={preview} alt="" style={{ width: '100%', borderRadius: 'var(--r-md)', border: '1px solid var(--line)' }} />
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
        <Button onClick={run} disabled={busy || !picked.length}>
          {busy ? t('share.exporting') : t('share.export')}
        </Button>
      </div>
    </Dialog>
  );
}
window.ShareModal = ShareModal;
```

- [ ] **Step 4: `index.html` 에 스크립트를 추가한다**

`<script type="text/babel" src="FiveDetail.jsx"></script>` 다음 줄에 추가한다(`Dashboard.jsx` 로드보다 **앞**이어야 한다).

```html
<script type="text/babel" src="ShareModal.jsx"></script>
```

정확한 위치는 다음으로 확인한다: `grep -n "text/babel" web/ui_kits/dashboard/index.html`

- [ ] **Step 5: 가드 테스트를 돌린다**

Run: `node web/ui_kits/dashboard/nohardcode.test.js && node web/ui_kits/dashboard/lang-reactivity.test.js`
Expected: PASS 둘 다.

`nohardcode` 가 실패하면 따옴표 밖에 한글이 남았거나 블록 주석을 쓴 것이다. `lang-reactivity` 가 실패하면 `window.I18N.lang` 을 직접 참조한 것이다 — `lang` prop 을 쓴다.

- [ ] **Step 6: 커밋**

```bash
git add web/ui_kits/dashboard/ShareModal.jsx web/ui_kits/dashboard/nohardcode.test.js web/ui_kits/dashboard/index.html
git commit -m "feat(dashboard): ShareModal — 섹션 선택·마스킹 토글·내보내기"
```

---

### Task 7: 공유 버튼 연결과 전체 검증

**Files:**
- Modify: `web/ui_kits/dashboard/RefreshBar.jsx:4,43-46`
- Modify: `web/ui_kits/dashboard/Dashboard.jsx:93,157`

**Interfaces:**
- Consumes: Task 6 의 `window.ShareModal`
- Produces: 동작하는 공유 기능 (이슈 #50 완료)

- [ ] **Step 1: `RefreshBar` 에 공유 버튼을 추가한다**

시그니처(`RefreshBar.jsx:4`)에 `onShare` prop 을 더한다:

```jsx
function RefreshBar({ runFetch, onLoaded, lastUpdated, onShare }) {
```

버튼 그룹(`RefreshBar.jsx:43-46`)의 경로 버튼 **앞**에 공유 버튼을 넣는다:

```jsx
      <div style={{ marginLeft: open ? 0 : 'auto', display: 'flex', gap: 8 }}>
        <Button variant="ghost" size="sm" onClick={onShare}>{t('share.button')}</Button>
        <Button variant="ghost" size="sm" onClick={() => setOpen((o) => !o)}>{open ? t('refresh.closePath') : t('refresh.path')}</Button>
        <Button size="sm" onClick={run} disabled={busy}>{busy ? t('refresh.running') : t('refresh.refresh')}</Button>
      </div>
```

- [ ] **Step 2: `Dashboard` 에 모달 상태를 연결한다**

`Dashboard.jsx` 의 다른 `React.useState` 선언들 옆(`:50` 부근, `const [five, setFive] = ...` 근처)에 추가한다:

```jsx
  const [share, setShare] = React.useState(false);
```

`Dashboard.jsx:93` 의 `RefreshBar` 에 핸들러를 넘긴다:

```jsx
          {loaded && <RefreshBar runFetch={runFetch} onLoaded={setData} lastUpdated={lastUpdated} onShare={() => setShare(true)} />}
```

`Dashboard.jsx:157` 의 `FiveDetail` 바로 다음 줄에 모달을 상시 마운트한다(`FiveDetail` 과 같은 패턴):

```jsx
      <ShareModal open={share} onClose={() => setShare(false)} uid={uid} lang={lang} />
```

- [ ] **Step 3: 전체 테스트를 돌린다**

Run: `npm test`
Expected: PASS 전부 — Go 5개 패키지 + JS 테스트 10종(`share.test.js` 포함).

- [ ] **Step 4: 수용 기준을 브라우저에서 하나씩 확인한다**

`npm run build:debug` 후 `./hsr-warp-debug.exe` 로 대시보드를 열고 데이터를 로드한 뒤 확인한다. **각 항목을 실제로 눈으로 보고 체크한다.**

- [ ] 헤더에 공유 버튼이 보이고, 누르면 모달이 열린다
- [ ] 모달에 현재 탭의 섹션이 체크박스로 나오고 기본 전체 선택이다
- [ ] 섹션 2개 이상 체크 → 내보내면 선택한 섹션만 순서대로 담긴 PNG 1장이 저장된다
- [ ] 전부 체크 해제하면 내보내기 버튼이 비활성화된다
- [ ] 마스킹 ON 의 PNG 에 UID 가 안 보이고, 화면의 UID 는 그대로다
- [ ] 차트 섹션을 포함한 PNG 에 차트가 실제로 그려져 있다
- [ ] banners 탭으로 옮겨 모달을 다시 열면 섹션 목록이 그 탭 것으로 바뀐다
- [ ] 언어를 en 으로 바꾸면 모달 문구와 섹션 라벨이 영어로 바뀐다
- [ ] 다크/라이트 양쪽에서 결과물 색이 화면과 같다
- [ ] DevTools 디바이스 툴바로 폭 390px 로 줄여도 PNG 가 720px 고정 레이아웃으로 나온다

- [ ] **Step 5: 커밋**

```bash
git add web/ui_kits/dashboard/RefreshBar.jsx web/ui_kits/dashboard/Dashboard.jsx
git commit -m "feat(dashboard): 헤더 공유 버튼 연결 — 이슈 #50"
```

- [ ] **Step 6: 사용자에게 실기기 검증을 요청한다**

구현자가 닫을 수 없는 이슈 AC 가 남아 있다. 작업 완료를 보고할 때 **명시적으로 알린다**:

> iOS Safari·Android Chrome 실기기 저장은 확인하지 못했습니다. 폴백(모달 내 미리보기 + 길게 눌러 저장)은 코드에 들어가 있으니, 실기기에서 확인해보시고 폴백이 뜨는지 / 저장이 되는지 알려주세요.

절대 "모든 수용 기준 충족"이라고 보고하지 않는다 — 실기기 2개 항목은 미검증 상태다.

---

## 남은 작업 (이 플랜 밖)

- `CHANGELOG.md` 갱신 — 릴리스 준비 시 별도 커밋.
- 이슈 #50 의 체크박스 갱신 및 PR 생성 — 사용자가 명시적으로 요청할 때만.
