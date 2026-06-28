# 가이드 사이트를 Vite + React SSG로 재구성 — 설계

> 이슈: [#9](https://github.com/jkas2016/hsr-warp/issues/9) · 작성일 2026-06-28 · PR #14 후속

## 배경

이슈 #9의 GitHub Pages 가이드 사이트를 1차로 `docs/site/`에 **손으로 쓴 정적 HTML**(index.html + guide.css + guide.js)로 구현했으나, 사용자가 표준 구조가 아니라고 반려했다. 같은 소유자의 [`jkas2016/hostdoc`](https://github.com/jkas2016/hostdoc/tree/main/docs/site)이 채택한 **Vite + React 19 SSG(프리렌더)** 구조를 정본으로 삼아 `docs/site/`를 재구성한다.

시각 디자인은 **이미 승인된 hsr-warp 코스모 다크 랜딩**을 그대로 유지한다(빌드 구조만 교체). 디자인 원천은 Claude Design 프로젝트 `4a0d441c-4f52-4c0c-810f-1c942c2a9124`이며, DS 토큰·스타일·로고·가이드 마크업을 여기서 가져온다.

### hostdoc 참조 구조 (검증 완료, gh API로 확인)

```
docs/site/
  package.json        # react/react-dom ^19 + vite ^8 + @vitejs/plugin-react ^6, type:module
  vite.config.mjs     # base: '/<repo>/', plugins:[react()]
  prerender.mjs       # dist/static/index.html 의 <!--app-html--> 를 renderToString 결과로 치환, dist/server 삭제
  .gitignore          # node_modules, dist
  index.html          # <div id="root"><!--app-html--></div> + <script src="/src/entry-client.jsx">
  public/             # 정적 자산(favicon 등)
  src/entry-client.jsx  # import ds css; hydrateRoot
  src/entry-server.jsx  # export render = () => renderToString(<App/>)
  src/App.jsx
  src/ds/             # 디자인 시스템(tokens + styles.css + components)
  src/pages/          # 페이지 본문
```

빌드 스크립트: `vite build --outDir dist/static && vite build --ssr src/entry-server.jsx --outDir dist/server && node prerender.mjs`.

## 결정사항 (브레인스토밍)

- 구조: **Vite + React 19 SSG**, hostdoc 패턴 미러. `docs/site/`는 루트와 분리된 자체 npm 프로젝트.
- 시각: **기존 hsr-warp 코스모 다크 랜딩 유지**(hostdoc의 docs-shell 레이아웃 채택 안 함).
- DS 라이브러리: 이 랜딩엔 React 컴포넌트 라이브러리 불필요 — **토큰 + `guide.css` 재사용**으로 시각 100% 보존(YAGNI).
- 카피: 디자인 프로젝트의 가이드 마크업은 **구버전 카피**를 담고 있으므로, 시각/구조만 가져오고 **정정된 현재 사실 카피는 유지**.
- 배포: GitHub Actions가 `docs/site`를 빌드해 `dist/static`을 Pages 아티팩트로 업로드.

## 목표 / 비목표

**목표**
- `docs/site/`를 Vite React SSG로 재구성(hostdoc 구조 미러), base `/hsr-warp/`.
- 기존 코스모 다크 랜딩(전 섹션·정정 카피·테마 토글·스크롤 리빌) 시각 동일 재현.
- Pages 워크플로를 Vite 빌드 → `dist/static` 업로드로 교체.
- 잘못된 정적 접근 산출물(`build-pages.mjs`/`build-pages.test.mjs`/구 `guide.test.js`/루트 redirect) 제거.

**비목표**
- `web/`(앱 대시보드) 변경 없음.
- hostdoc의 사이드바 docs-shell 레이아웃 채택 안 함.
- 다국어(영문) — 한국어 유지.
- DS React 컴포넌트 라이브러리 도입(랜딩에 불필요).

## 아키텍처

### 파일 구조

```
docs/site/
  package.json
  vite.config.mjs            # base: '/hsr-warp/'
  prerender.mjs
  .gitignore                 # node_modules, dist
  index.html                 # 템플릿: <div id="root"><!--app-html--></div>, 한국어 lang, meta description
  public/
    logo-train.svg           # ← 디자인 프로젝트 assets/logo-train.svg
  src/
    entry-client.jsx         # import './ds/styles.css'; import './pages/guide.css'; hydrateRoot
    entry-server.jsx         # export function render(){ return renderToString(<App/>) }
    App.jsx                  # 테마 초기화 + 토글 + 스크롤 리빌 + <GuidePage/>
    ds/
      styles.css             # ← 디자인 프로젝트 styles.css (@import tokens/*)
      tokens/
        colors.css fonts.css typography.css spacing.css   # ← 디자인 프로젝트 tokens/*
    pages/
      GuidePage.jsx          # ← ui_kits/guide/index.html <body> 를 JSX로(정정 카피 유지)
      guide.css              # ← ui_kits/guide/guide.css 그대로
```

### 디자인 프로젝트 → 산출물 매핑 (DesignSync, projectId `4a0d441c-…`)

| 산출물 | 원천 path | 변환 |
|---|---|---|
| `src/ds/styles.css` | `styles.css` | 그대로 |
| `src/ds/tokens/*.css` | `tokens/*.css` | 그대로 |
| `public/logo-train.svg` | `assets/logo-train.svg` | 그대로 |
| `src/pages/guide.css` | `ui_kits/guide/guide.css` | 그대로 |
| `src/pages/GuidePage.jsx` | `ui_kits/guide/index.html` `<body>` | HTML→JSX(`class`→`className`, `for`→`htmlFor`, 자기닫힘 태그, `style="..."`→객체, 주석→`{/* */}`) + **정정 카피 적용** |

> 토큰·스타일은 로컬 `web/`에도 동일 사본이 있으나(대시보드용 동기화본), 본 사이트의 DS는 디자인 프로젝트를 원천으로 DesignSync로 가져온다(원천 일관).

### React 변환 세부

- **마크업**: `index.html`의 `<body>` 내부(nav·hero·features·steps·metrics·files·troubleshooting·faq·cta·footer)를 `GuidePage.jsx` 한 컴포넌트로. 인라인 `style="..."` 속성은 React style 객체로 변환. `<details open>` 등 네이티브 요소 유지.
- **로고**: `public/logo-train.svg`에 둔다. 파비콘은 `index.html`의 `<link href="/logo-train.svg">`(Vite가 base 주입). React `<img>`는 `import.meta.env.BASE_URL + 'logo-train.svg'`로 참조(절대경로 하드코딩·public import 안티패턴 회피).
- **테마**: `App.jsx`에서 마운트 전/초기 `data-theme` 설정(localStorage 키 `hsrwarp-theme`, 기본 dark) + 토글 버튼 핸들러. SSR 시 기본 dark로 렌더, 클라이언트 하이드레이션에서 저장값 반영.
- **스크롤 리빌**: `useEffect`에서 IntersectionObserver + 1.4s 안전망(기존 `guide.js` 로직 이식). `prefers-reduced-motion` 존중(guide.css가 처리).
- **카피 보존**: 정정 문자열 유지 — `설치 마법사`, `hsr-warp-setup-`, `/ui_kits/dashboard/`, `%LOCALAPPDATA%\HSR Warp`, 자동갱신 FAQ(`schedule.json`), 푸터 `architecture.html` 링크. stale 부재 — `설치 불필요`, `실행파일 하나가 전부`, `실행파일 하나만 받으면`, `dashboard.html`, `같은 폴더`.

### 문서 허브(architecture) 처리

개발자 문서 `docs/architecture.html`은 **단일 소스 유지**를 위해 repo에 복제하지 않고, `prerender.mjs`가 빌드 후 `../architecture.html`(repo의 `docs/architecture.html`)을 `dist/static/architecture.html`로 복사한다(`build-pages`가 하던 방식과 동일). 푸터 링크는 `architecture.html`(루트 상대) — base `/hsr-warp/` 하위에서 `/hsr-warp/architecture.html`로 해소.

## 배포 — `.github/workflows/pages.yml` 교체

```yaml
name: Deploy Pages
on:
  push: { branches: [main] }
  workflow_dispatch:
permissions: { contents: read, pages: write, id-token: write }
concurrency: { group: "pages", cancel-in-progress: false }
jobs:
  build:
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: docs/site } }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm, cache-dependency-path: docs/site/package-lock.json }
      - run: npm ci
      - run: npm run build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with: { path: docs/site/dist/static }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: { name: github-pages, url: "${{ steps.deployment.outputs.page_url }}" }
    steps:
      - id: deployment
        uses: actions/deploy-pages@v5
```

액션 버전은 공식 스타터 검증치 고정(checkout@v4, setup-node@v4, configure-pages@v5, upload-pages-artifact@v3, deploy-pages@v5). `package-lock.json`은 커밋(npm ci 필요).

> 수동 1회: Settings → Pages → Source = "GitHub Actions" (코드로 강제 불가).

## 제거 / 정리

- 삭제: `scripts/build-pages.mjs`, `scripts/build-pages.test.mjs`, `docs/site/guide.test.js`(구), `docs/site/guide.js`, `docs/site/index.html`(구 정적), `docs/site/guide.css`(구 위치 — `src/pages/guide.css`로 이동).
- 루트 `package.json` test: `build-pages.test.mjs`·구 `guide.test.js` 호출 제거, 새 소스레벨 카피가드로 교체.
- 루트 `.gitignore`: `_site/` 항목 제거(더 이상 없음). `docs/site/`는 자체 `.gitignore`로 `node_modules`·`dist` 무시.
- `web/`는 손대지 않음.

## 테스트 계획 (구현 전 작성)

프로젝트 drift-test 문화 유지.

1. **카피 가드(소스레벨, 빌드·Vite 불필요)** — `docs/site/copy.test.mjs`(node):
   `src/pages/GuidePage.jsx` 텍스트에서 필수 문자열 존재 / stale 문자열 부재 검사. 루트 `npm test`에 포함(빠름, 사이트 deps 설치 불필요).
   - 필수: `설치 마법사`, `hsr-warp-setup-`, `/ui_kits/dashboard/`, `%LOCALAPPDATA%`, `schedule.json`, `architecture.html`.
   - stale: `dashboard.html`, `같은 폴더`, `설치 불필요`, `실행파일 하나가 전부`, `실행파일 하나만 받으면`.
2. **빌드/프리렌더 스모크(사이트 deps 필요)** — `docs/site` 빌드 후 `dist/static/index.html`이 (a) `<!--app-html-->`를 더 이상 포함하지 않고 (b) 실제 콘텐츠(예: `설치 마법사`)를 담고 (c) `dist/static/logo-train.svg`·`dist/static/architecture.html`이 존재하는지. 워크플로 CI에서 빌드가 통과하는 것으로 1차 보증, 로컬은 선택.
3. **수동 1회 검증**: `npm --prefix docs/site run dev` 또는 `preview`로 열어 렌더·다크/라이트 토글·스크롤 리빌·콘솔 무에러·푸터 architecture 링크 확인.

**실행 통합**: 루트 `package.json` test = `go test ./... && node web/analyze.test.js && node docs/site/copy.test.mjs`.

## 위험 / 완화

- **SSR 하이드레이션 불일치**: 테마 초기값을 SSR/클라이언트 모두 dark로 두고, 저장된 light는 하이드레이션 후 적용(초기 마크업 일치). 깜빡임은 허용 가능(또는 inline 부트 스크립트로 사전 적용 — 후순위).
- **base 경로 자산 깨짐**: 모든 자산을 `public/` + Vite import로 처리해 `/hsr-warp/` 프리픽스 자동화. 하드코딩 절대경로 금지.
- **카피 재-drift**: 디자인 프로젝트가 stale 카피를 보유 → 향후 재동기화 시 재발 위험. 카피 가드 테스트가 방어.
- **Pages 활성화 수동**: 완료 보고에 명시.

## 산출물 요약

- 신규: `docs/site/{package.json,package-lock.json,vite.config.mjs,prerender.mjs,.gitignore,index.html}`, `docs/site/public/logo-train.svg`, `docs/site/src/{entry-client.jsx,entry-server.jsx,App.jsx}`, `docs/site/src/ds/{styles.css,tokens/*}`, `docs/site/src/pages/{GuidePage.jsx,guide.css}`, `docs/site/copy.test.mjs`. (`prerender.mjs`가 `docs/architecture.html`을 `dist/static/`로 복사 — 복제 커밋 없음.)
- 교체: `.github/workflows/pages.yml`, 루트 `package.json`(test), 루트 `.gitignore`.
- 삭제: `scripts/build-pages.mjs`, `scripts/build-pages.test.mjs`, 구 `docs/site/{index.html,guide.css,guide.js,guide.test.js}`.
- (사용자) Settings → Pages Source = GitHub Actions.
