# 가이드 사이트 Vite + React SSG 재구성 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `docs/site/`를 hostdoc 패턴의 Vite + React 19 SSG(프리렌더) 프로젝트로 재구성하고, 이미 승인된 hsr-warp 코스모 다크 랜딩(정정 카피 유지)을 React로 재현해 GitHub Pages에 배포한다.

**Architecture:** `docs/site/`는 루트 Go 프로젝트와 분리된 자체 npm 프로젝트. Vite로 클라이언트+SSR 두 번 빌드 후 `prerender.mjs`가 `<!--app-html-->`를 `renderToString` 결과로 치환해 정적 HTML을 만든다(`dist/static`). 디자인 시스템 토큰/스타일/로고는 로컬 `web/`(디자인 프로젝트 동기화본)에서 가져오고, 가이드 마크업은 현재 `docs/site/index.html`(정정 카피 보유)을 JSX로 변환한다.

**Tech Stack:** Vite 8, React 19, @vitejs/plugin-react 6, node ESM, GitHub Actions(Pages).

## Global Constraints

- 패키지 버전(hostdoc 검증치 고정): `react`/`react-dom` `^19.2.7`, `vite` `^8.1.0`, `@vitejs/plugin-react` `^6.0.3`. `package.json`에 `"type":"module"`.
- Vite `base: '/hsr-warp/'` (Pages URL `https://jkas2016.github.io/hsr-warp/`).
- 빌드 스크립트: `vite build --outDir dist/static && vite build --ssr src/entry-server.jsx --outDir dist/server && node prerender.mjs`.
- **CSS는 `entry-client.jsx`에서만 import**(SSR 번들이 CSS를 끌어들이면 깨짐). 컴포넌트(.jsx)는 CSS를 import하지 않는다.
- 시각은 기존 코스모 다크 랜딩 그대로 — `guide.css`·토큰 재사용, 마크업 구조/클래스 보존.
- **정정 카피 유지**(필수 존재): `설치 마법사`, `hsr-warp-setup-`, `/ui_kits/dashboard/`, `%LOCALAPPDATA%`, `schedule.json`, `architecture.html`. **stale 금지**: `dashboard.html`, `같은 폴더`, `설치 불필요`, `실행파일 하나가 전부`, `실행파일 하나만 받으면`.
- GitHub Actions 액션 버전(공식 스타터 검증): `actions/checkout@v4`, `actions/setup-node@v4`, `actions/configure-pages@v5`, `actions/upload-pages-artifact@v3`, `actions/deploy-pages@v5`.
- 테스트는 무프레임워크 `node` + `assert`(통과 시 `... OK`, exit 0). 작업 브랜치: `feat/issue-9-pages-guide`.
- `web/`(앱 대시보드)는 수정 금지.

## File Structure

```
docs/site/
  package.json            # deps + build scripts
  package-lock.json       # npm install 산출, 커밋(npm ci 용)
  vite.config.mjs         # base:'/hsr-warp/'
  prerender.mjs           # SSG + architecture.html 복사
  .gitignore              # node_modules, dist
  index.html              # Vite 템플릿: <div id="root"><!--app-html--></div>
  public/logo-train.svg   # ← web/assets/logo-train.svg
  src/
    entry-client.jsx      # ds/styles.css + pages/guide.css import, hydrateRoot
    entry-server.jsx      # render()=renderToString(<App/>)
    App.jsx               # 테마 토글 + 스크롤 리빌 + <GuidePage/>
    ds/styles.css         # ← web/styles.css
    ds/tokens/*.css       # ← web/tokens/*
    pages/GuidePage.jsx   # ← 현재 index.html <body> 를 JSX로(정정 카피 유지)
    pages/guide.css       # ← 현재 docs/site/guide.css (git mv)
  copy.test.mjs           # 소스레벨 카피 가드
```

삭제: `scripts/build-pages.mjs`, `scripts/build-pages.test.mjs`, 구 `docs/site/{guide.js,guide.test.js}`, 임시 `docs/site/_guide-source.html`.

---

## Task 1: Vite SSG 스캐폴드 + DS 자산 (빌드·프리렌더 동작)

**Files:**
- Rename: `docs/site/index.html` → `docs/site/_guide-source.html` (가이드 마크업 보존; Task 2 변환 소스)
- Rename: `docs/site/guide.css` → `docs/site/src/pages/guide.css`
- Create: `docs/site/package.json`, `vite.config.mjs`, `prerender.mjs`, `.gitignore`, `index.html`
- Create: `docs/site/src/entry-client.jsx`, `src/entry-server.jsx`, `src/App.jsx`, `src/pages/GuidePage.jsx`(임시)
- Copy: `web/styles.css`→`docs/site/src/ds/styles.css`, `web/tokens/*`→`docs/site/src/ds/tokens/`, `web/assets/logo-train.svg`→`docs/site/public/logo-train.svg`

**Interfaces:**
- Produces: 빌드 가능한 Vite SSG 골격. `src/App.jsx`가 `<GuidePage/>` 렌더, `src/pages/GuidePage.jsx`는 임시 본문. `npm run build` → `dist/static/index.html`(프리렌더됨) + `dist/static/architecture.html`.

- [ ] **Step 1: 가이드 마크업 보존 + guide.css 이동**

```bash
cd docs/site
git mv index.html _guide-source.html
mkdir -p src/pages src/ds/tokens public
git mv guide.css src/pages/guide.css
```

- [ ] **Step 2: DS 자산 복사**

```bash
cd docs/site
cp ../../web/styles.css src/ds/styles.css
cp ../../web/tokens/colors.css ../../web/tokens/fonts.css ../../web/tokens/typography.css ../../web/tokens/spacing.css src/ds/tokens/
cp ../../web/assets/logo-train.svg public/logo-train.svg
```
확인: `ls src/ds/tokens` → `colors.css fonts.css typography.css spacing.css`.

- [ ] **Step 3: 빌드 설정 파일 작성**

`docs/site/package.json`:
```json
{
  "name": "hsr-warp-site",
  "private": true,
  "type": "module",
  "description": "HSR 워프 가이드 사이트 — 디자인 시스템 기반. npm 미배포.",
  "scripts": {
    "dev": "vite",
    "build": "vite build --outDir dist/static && vite build --ssr src/entry-server.jsx --outDir dist/server && node prerender.mjs",
    "preview": "vite preview --outDir dist/static"
  },
  "dependencies": {
    "react": "^19.2.7",
    "react-dom": "^19.2.7"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^6.0.3",
    "vite": "^8.1.0"
  }
}
```

`docs/site/vite.config.mjs`:
```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// HSR 워프 가이드 사이트. GitHub Pages https://jkas2016.github.io/hsr-warp/ 에 배포되어
// 자산이 /hsr-warp/ 하위에서 서빙된다.
export default defineConfig({
  base: '/hsr-warp/',
  plugins: [react()],
});
```

`docs/site/prerender.mjs`:
```js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// SSG: 앱을 HTML로 렌더해 클라이언트 템플릿의 <!--app-html--> 자리에 주입한다.
// (Vite SSG 가이드 https://vite.dev/guide/ssr.html#pre-rendering-ssg)
const here = path.dirname(fileURLToPath(import.meta.url));
const abs = (p) => path.resolve(here, p);

const template = fs.readFileSync(abs('dist/static/index.html'), 'utf-8');
const { render } = await import(pathToFileURL(abs('dist/server/entry-server.js')).href);
fs.writeFileSync(abs('dist/static/index.html'), template.replace('<!--app-html-->', render()));

// 개발자 문서(문서 허브): 단일 소스 docs/architecture.html 을 게시 산출물로 복사 — repo 복제 없음.
fs.copyFileSync(abs('../architecture.html'), abs('dist/static/architecture.html'));

// 서버 번들은 빌드 산출물일 뿐 — 업로드 폴더를 깨끗하게.
fs.rmSync(abs('dist/server'), { recursive: true, force: true });

console.log('prerendered dist/static/index.html');
```

`docs/site/.gitignore`:
```
node_modules
dist
```

`docs/site/index.html`:
```html
<!doctype html>
<html lang="ko" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>HSR 워프 대시보드 — 내 전언 기록을, 내 PC에서</title>
<meta name="description" content="붕괴: 스타레일 전언(워프) 기록을 내 PC로 가져와 천장·운·픽뚫(50/50)·월별 통계를 보여주는 작은 로컬 프로그램. 간편 설치, 완전 로컬, 계정 로그인 불필요.">
<link rel="icon" type="image/svg+xml" href="/logo-train.svg">
</head>
<body>
<div id="root"><!--app-html--></div>
<script type="module" src="/src/entry-client.jsx"></script>
</body>
</html>
```

- [ ] **Step 4: React 엔트리 + 임시 App/GuidePage 작성**

`docs/site/src/entry-client.jsx`:
```jsx
import { hydrateRoot } from 'react-dom/client';
import './ds/styles.css';
import './pages/guide.css';
import { App } from './App.jsx';

// 빌드 시 정적 HTML로 프리렌더된 마크업을 하이드레이트해 상호작용(테마 토글·리빌)을 살린다.
hydrateRoot(document.getElementById('root'), <App />);
```

`docs/site/src/entry-server.jsx`:
```jsx
import { renderToString } from 'react-dom/server';
import { App } from './App.jsx';

// 빌드타임 렌더. prerender.mjs 가 결과를 클라이언트 템플릿에 주입한다.
export function render() {
  return renderToString(<App />);
}
```

`docs/site/src/App.jsx` (임시 — Task 3에서 상호작용 추가):
```jsx
import { GuidePage } from './pages/GuidePage.jsx';

export function App() {
  return <GuidePage />;
}
```

`docs/site/src/pages/GuidePage.jsx` (임시 본문 — Task 2에서 실제 변환):
```jsx
export function GuidePage() {
  return (
    <main className="wrap">
      <h1>HSR 워프 가이드</h1>
    </main>
  );
}
```

- [ ] **Step 5: 의존성 설치 + 빌드(RED→GREEN)**

```bash
cd docs/site
npm install        # package-lock.json 생성
npm run build
```
Expected: 최초 `npm install` 전엔 빌드 불가(RED). 설치 후 `npm run build`가 `prerendered dist/static/index.html` 출력(GREEN).

- [ ] **Step 6: 빌드 산출물 검증**

```bash
cd docs/site
node -e "const c=require('fs').readFileSync('dist/static/index.html','utf8'); if(c.includes('<!--app-html-->')) throw new Error('not prerendered'); if(!c.includes('HSR 워프 가이드')) throw new Error('app content missing'); if(!require('fs').existsSync('dist/static/architecture.html')) throw new Error('architecture.html not copied'); console.log('build smoke OK')"
```
Expected: `build smoke OK`.

- [ ] **Step 7: 커밋**

```bash
git add docs/site/package.json docs/site/package-lock.json docs/site/vite.config.mjs docs/site/prerender.mjs docs/site/.gitignore docs/site/index.html docs/site/src docs/site/public docs/site/_guide-source.html
git commit -m "build: docs/site Vite+React SSG 스캐폴드 + DS 자산 #9"
```
(주의: `dist/`·`node_modules`는 루트/로컬 .gitignore로 제외됨 — 커밋되지 않아야 함. `git status`로 확인.)

---

## Task 2: 가이드 본문을 GuidePage.jsx 로 변환 (정정 카피 유지)

**Files:**
- Modify: `docs/site/src/pages/GuidePage.jsx` (임시 → 실제 변환본)
- Create/Test: `docs/site/copy.test.mjs`
- Delete: `docs/site/_guide-source.html` (변환 후), `docs/site/guide.js`, `docs/site/guide.test.js`

**Interfaces:**
- Consumes: `docs/site/_guide-source.html`(Task 1이 보존한 정정 가이드 HTML), `import.meta.env.BASE_URL`.
- Produces: `src/pages/GuidePage.jsx` — `export function GuidePage()` 가 nav·hero·features·steps·metrics·files·troubleshooting·faq·cta·footer 전체를 렌더. 테마 토글 버튼(`.theme-toggle`)과 `.reveal` 클래스는 마크업에 그대로 둔다(App이 Task 3에서 동작 부여).

- [ ] **Step 1: 카피 가드 테스트 작성(실패 확인)**

`docs/site/copy.test.mjs`:
```js
// 가이드 카피 정합성 가드(소스레벨, 빌드 불필요). drift 재발 방지.
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(dir, 'src/pages/GuidePage.jsx'), 'utf8');

for (const need of ['설치 마법사', 'hsr-warp-setup-', '/ui_kits/dashboard/', '%LOCALAPPDATA%', 'schedule.json', 'architecture.html']) {
  assert.ok(src.includes(need), `required copy missing: "${need}"`);
}
for (const bad of ['dashboard.html', '같은 폴더', '설치 불필요', '실행파일 하나가 전부', '실행파일 하나만 받으면']) {
  assert.ok(!src.includes(bad), `stale copy present: "${bad}"`);
}
console.log('copy.test.mjs OK');
```
Run: `node docs/site/copy.test.mjs`
Expected: FAIL — 임시 GuidePage엔 필수 문자열이 없어 `required copy missing: "설치 마법사"`.

- [ ] **Step 2: `_guide-source.html` 의 `<body>` 를 GuidePage.jsx 로 변환**

`docs/site/_guide-source.html`을 읽고, `<body>` 내부(주석 `<!-- NAV -->`부터 `</footer>`까지)를 `src/pages/GuidePage.jsx` 한 컴포넌트로 옮긴다. `<head>`·`<script src="guide.js">`·`<link>`는 **옮기지 않는다**(템플릿/entry-client가 처리).

형태:
```jsx
export function GuidePage() {
  const logo = import.meta.env.BASE_URL + 'logo-train.svg';
  return (
    <>
      {/* nav ~ footer 전체 */}
    </>
  );
}
```

**변환 규칙(정확히 적용):**
1. `class=` → `className=`. `for=` → `htmlFor=`(해당 시).
2. 자기 닫힘: `<img ...>` → `<img ... />`, `<br>` → `<br />`, `<meta>`/`<link>`는 head라 제외.
3. 인라인 `style="a:b;c:d"` → `style={{ a: 'b', c: 'd' }}`. CSS 속성은 camelCase(`padding-top`→`paddingTop`), 값은 문자열. 예: `style="padding-top:40px"` → `style={{ paddingTop: '40px' }}`. CSS 변수는 그대로 키로: `style="--accent-bar:var(--grad-gold)"` → `style={{ '--accent-bar': 'var(--grad-gold)' }}`. (소스에 `style="..."`가 24곳 있다 — 전부 변환.)
4. HTML 주석 `<!-- X -->` → JSX 주석 `{/* X */}` (또는 제거).
5. 로고 `<img>`의 `src="assets/logo-train.svg"`(4곳, 파비콘 제외) → `src={logo}`.
6. 푸터 아키텍처 링크 `<a href="architecture.html">아키텍처 문서</a>` → **그대로 유지**(상대경로, base 하위에서 정상 해소).
7. `<details open>` → `<details open>`(React에서 `open` 불리언 속성 그대로 OK), 내부 `<summary>` 유지.
8. SVG 요소: 속성 `stroke-width`→`strokeWidth`, `stroke-linecap`→`strokeLinecap`, `stroke-linejoin`→`strokeLinejoin`, `fill-rule`→`fillRule`, `clip-rule`→`clipRule`, `viewBox`는 그대로. `<path .../>` 자기 닫힘.
9. 테마 토글 버튼(`<button class="icon-btn theme-toggle" ...>`)과 모든 `class="... reveal"`는 **마크업 그대로**(동작은 App이 부여).
10. 정정 카피는 소스에 이미 반영됨 — 텍스트를 바꾸지 말고 그대로 옮긴다.

- [ ] **Step 3: 카피 가드 통과 확인**

Run: `node docs/site/copy.test.mjs`
Expected: PASS — `copy.test.mjs OK`.

- [ ] **Step 4: 변환 소스/구 파일 삭제**

```bash
cd docs/site
git rm _guide-source.html guide.js guide.test.js
```

- [ ] **Step 5: 빌드 스모크 재확인(콘텐츠 반영)**

```bash
cd docs/site
npm run build
node -e "const c=require('fs').readFileSync('dist/static/index.html','utf8'); if(c.includes('<!--app-html-->')) throw new Error('not prerendered'); for(const s of ['설치 마법사','%LOCALAPPDATA%','architecture.html']) if(!c.includes(s)) throw new Error('missing '+s); console.log('build smoke OK')"
```
Expected: `build smoke OK` (프리렌더된 HTML에 가이드 실제 콘텐츠 포함). SSR 렌더 중 에러 없어야 함.

- [ ] **Step 6: 커밋**

```bash
git add docs/site/src/pages/GuidePage.jsx docs/site/copy.test.mjs
git commit -m "feat: 가이드 본문을 React(GuidePage)로 변환 — 정정 카피 유지 #9"
```

---

## Task 3: 테마 토글 + 스크롤 리빌 (App 상호작용)

**Files:**
- Modify: `docs/site/src/App.jsx`

**Interfaces:**
- Consumes: `GuidePage`가 렌더한 DOM의 `.theme-toggle` 버튼·`.reveal` 요소·`<html>`의 `data-theme`.
- Produces: 클라이언트 하이드레이션 후 테마 토글(localStorage `hsrwarp-theme`)·스크롤 리빌 동작.

- [ ] **Step 1: App.jsx 에 상호작용 추가**

`docs/site/src/App.jsx` 전체를 아래로 교체:
```jsx
import { useEffect } from 'react';
import { GuidePage } from './pages/GuidePage.jsx';

// 페이지는 빌드 시 정적 프리렌더됨. 하이드레이션 후 테마 토글 + 스크롤 리빌을 부여한다.
// (기존 guide.js 로직 이식: 테마는 localStorage 'hsrwarp-theme', 기본 dark.)
export function App() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('js');

    const KEY = 'hsrwarp-theme';
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === 'light' || saved === 'dark') root.setAttribute('data-theme', saved);
    } catch (e) {}

    const btn = document.querySelector('.theme-toggle');
    const onToggle = () => {
      const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem(KEY, next); } catch (e) {}
    };
    if (btn) btn.addEventListener('click', onToggle);

    const items = [].slice.call(document.querySelectorAll('.reveal'));
    const revealAll = () => items.forEach((el) => el.classList.add('in'));
    let io;
    let timer;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
      items.forEach((el) => io.observe(el));
      timer = setTimeout(revealAll, 1400); // 안전망: 옵저버가 안 돌아도 1.4s 뒤 전부 표시
    } else {
      revealAll();
    }

    return () => {
      if (btn) btn.removeEventListener('click', onToggle);
      if (io) io.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, []);

  return <GuidePage />;
}
```

- [ ] **Step 2: 빌드 + 정적 검증**

```bash
cd docs/site
npm run build
node -e "const c=require('fs').readFileSync('src/App.jsx','utf8'); for(const s of ['hsrwarp-theme','IntersectionObserver',\"classList.add('js')\"]) if(!c.includes(s)) throw new Error('missing '+s); console.log('App OK'); require('fs').readFileSync('dist/static/index.html','utf8')"
```
Expected: `App OK` 및 빌드 성공(에러 없음). 상호작용은 정적 단언으로 1차 보증.

- [ ] **Step 3: 로컬 렌더 육안 확인 (수동)**

```bash
cd docs/site
npm run preview   # http://localhost:4173/hsr-warp/
```
브라우저로 접속해 확인: 페이지 렌더, 우상단 테마 토글(다크↔라이트, 새로고침 후 유지), 스크롤 시 카드 리빌, DevTools 콘솔 에러 없음, 푸터 "아키텍처 문서" 링크 동작(`/hsr-warp/architecture.html`). 문제 없으면 다음.

- [ ] **Step 4: 커밋**

```bash
git add docs/site/src/App.jsx
git commit -m "feat: 가이드 테마 토글·스크롤 리빌(React 하이드레이션) #9"
```

---

## Task 4: 배포 워크플로 교체 + 루트 정리

**Files:**
- Modify: `.github/workflows/pages.yml`
- Modify: `package.json` (루트 test 스크립트)
- Modify: `.gitignore` (루트 — `_site/` 제거)
- Delete: `scripts/build-pages.mjs`, `scripts/build-pages.test.mjs`

**Interfaces:**
- Consumes: `docs/site` Vite 빌드 산출물 `dist/static`.
- Produces: main push 시 사이트 빌드·배포. 루트 `npm test`가 `docs/site/copy.test.mjs` 포함.

- [ ] **Step 1: 워크플로 교체**

`.github/workflows/pages.yml` 전체를 아래로 교체:
```yaml
name: Deploy Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: docs/site
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: docs/site/package-lock.json
      - run: npm ci
      - run: npm run build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: docs/site/dist/static

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v5
```

- [ ] **Step 2: 구 빌드 스크립트 삭제**

```bash
git rm scripts/build-pages.mjs scripts/build-pages.test.mjs
```

- [ ] **Step 3: 루트 `package.json` test 스크립트 수정**

변경 전:
```json
    "test": "node scripts/run-go.mjs test ./... && node web/analyze.test.js && node docs/site/guide.test.js && node scripts/build-pages.test.mjs",
```
변경 후:
```json
    "test": "node scripts/run-go.mjs test ./... && node web/analyze.test.js && node docs/site/copy.test.mjs",
```

- [ ] **Step 4: 루트 `.gitignore`에서 `_site/` 제거**

`.gitignore`에서 다음 두 줄(주석 + 패턴)을 삭제:
```
# GitHub Pages 빌드 산출물 (scripts/build-pages.mjs 생성)
_site/
```

- [ ] **Step 5: 검증**

```bash
node web/analyze.test.js && node docs/site/copy.test.mjs
node -e "const c=require('fs').readFileSync('.github/workflows/pages.yml','utf8'); if(!c.includes('working-directory: docs/site')||!c.includes('docs/site/dist/static')||!c.includes('actions/deploy-pages@v5')||c.includes('build-pages')) throw new Error('workflow check failed'); console.log('workflow OK')"
node -e "if(require('fs').readFileSync('.gitignore','utf8').includes('_site/')) throw new Error('_site/ still in gitignore'); if(require('fs').existsSync('scripts/build-pages.mjs')) throw new Error('build-pages.mjs not deleted'); console.log('cleanup OK')"
```
Expected: `OK all analyze tests passed`, `copy.test.mjs OK`, `workflow OK`, `cleanup OK`.

- [ ] **Step 6: 커밋**

```bash
git add .github/workflows/pages.yml package.json .gitignore
git commit -m "build: Pages 워크플로를 Vite 빌드로 교체 + 구 조립 스크립트 제거 #9"
```

---

## Task 5: 마무리 — Pages 활성화 안내 (수동, 코드 아님)

**Files:** 없음.

- [ ] **Step 1: 사용자 안내**

`main` 머지 후 GitHub repo **Settings → Pages → Build and deployment → Source = "GitHub Actions"** 로 1회 설정(코드로 강제 불가). 설정 후 `main` push 또는 Actions 탭 *Deploy Pages* 수동 실행 → `https://jkas2016.github.io/hsr-warp/` 게시.

- [ ] **Step 2: 배포 검증 (활성화 후)**

Actions *Deploy Pages* 녹색 확인 + `https://jkas2016.github.io/hsr-warp/` 렌더·테마 토글·스크롤 리빌·푸터 아키텍처 링크 확인.

---

## Self-Review

**Spec coverage:**
- Vite React SSG 재구성(hostdoc 미러) → Task 1. ✓
- 기존 코스모 다크 랜딩 재현(정정 카피·테마·리빌) → Task 2(마크업/카피) + Task 3(상호작용). ✓
- base `/hsr-warp/` → Task 1 vite.config. ✓
- architecture.html 단일 소스 복사 + 푸터 링크 → Task 1 prerender.mjs + Task 2 규칙6 + copy.test 'architecture.html'. ✓
- 워크플로 Vite 빌드 → dist/static 업로드 → Task 4. ✓
- 구 산출물 제거(build-pages.*, 구 guide.*, 루트 _site/) → Task 2(guide.*) + Task 4(build-pages.*, _site/). ✓
- 테스트(소스 카피가드 + 빌드 스모크) → Task 2 copy.test.mjs + Task 1/2 빌드 스모크 + Task 4 root test 통합. ✓
- CSS는 entry-client에서만 import → Task 1 Step 4(entry-client) + Global Constraints. ✓

**Placeholder scan:** GuidePage.jsx 본문은 "변환"이라 전문을 싣지 않았으나, 소스(`_guide-source.html`)가 결정적이고 변환 규칙 10종 + 카피가드 + 빌드 스모크 + 수동 렌더가 게이트. 그 외 모든 설정/엔트리/App/테스트/워크플로 코드는 전문 포함. ✓

**Type consistency:** `render()`(entry-server) ↔ prerender import, `GuidePage`/`App` export 일관, localStorage 키 `hsrwarp-theme`·`.theme-toggle`·`.reveal` 클래스가 guide.css/App/마크업 간 일치, `dist/static`·`dist/server` 경로 일관, 액션 버전 Global Constraints 고정. ✓
