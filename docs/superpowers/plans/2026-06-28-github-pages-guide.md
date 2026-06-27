# GitHub Pages 가이드 사이트 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **변경 노트(구현 후, 2026-06-28)**: 가이드 소스 위치를 `web/ui_kits/guide/` → **`docs/site/`** 로 이동(GitHub Pages 관례). 가이드를 **Pages 루트로 승격**(redirect 제거, `_site/index.html`=가이드), DS 자산은 여전히 `web/` 단일 소스에서 빌드 시 `_site` 루트로 복사, `index.html` 경로는 루트 상대, 자산 무결성은 조립 후 `_site` 기준 검사로 이전. 아래 본문의 `web/ui_kits/guide/`·redirect 서술은 이 노트로 갱신된 것으로 본다(테스트 명령: `node docs/site/guide.test.js`).

**Goal:** Claude Design 킷 `ui_kits/guide/`를 현재 제품 사실에 맞춘 카피로 `web/`에 구현하고, GitHub Actions로 GitHub Pages에 자동 배포한다.

**Architecture:** 가이드 페이지를 `web/ui_kits/guide/`에 두어 기존 디자인 시스템 토큰(`web/styles.css`+`web/tokens/`)을 상대경로로 재사용한다. `scripts/build-pages.mjs`가 `web/`에서 필요한 파일만 `_site/`로 조립하고 GitHub Actions 워크플로가 이를 배포한다 — repo에 중복 산출물을 커밋하지 않는다(`web/`가 유일 소스). README는 사이트로 이관 후 슬림화한다.

**Tech Stack:** 정적 HTML/CSS + 바닐라 JS(번들·프레임워크 없음), node ESM 빌드 스크립트, GitHub Actions(Pages).

## Global Constraints

- 테스트는 무프레임워크 `node` + `assert` 스타일(통과 시 exit 0, 실패 시 throw). 실행: `node <file>`. 기존 `web/analyze.test.js`와 동일.
- 가이드 페이지의 CSS/JS/마크업 구조는 디자인 킷 그대로 유지하고 **텍스트(카피)만** 현재 사실에 맞춘다.
- 거대 정수 비교는 Go `math/big`/JS `BigInt` (본 작업 무관하나 코드 손대면 준수).
- 새 에러 로그는 `slog` (본 작업 무관).
- 분석 로직은 `web/analyze.js` 단일 소스 — 가이드에서 재구현 금지.
- GitHub Actions 액션 버전(공식 스타터 검증, 2026-06-28): `actions/checkout@v4`, `actions/setup-node@v4`, `actions/configure-pages@v5`, `actions/upload-pages-artifact@v3`, `actions/deploy-pages@v5`.
- Pages URL: `https://jkas2016.github.io/hsr-warp/`. 저장소: `jkas2016/hsr-warp`.
- 작업 브랜치: `feat/issue-9-pages-guide` (이미 생성됨).

## File Structure

- `web/ui_kits/guide/index.html` — 가이드 페이지(카피 정정본). DS를 `../../styles.css`·`../../assets/logo-train.svg`로 참조.
- `web/ui_kits/guide/guide.css` — 페이지 레이아웃(디자인 킷 verbatim).
- `web/ui_kits/guide/guide.js` — 테마 토글 + 스크롤 리빌(디자인 킷 verbatim).
- `web/ui_kits/guide/guide.test.js` — 자산 무결성 + 카피 정합성 가드.
- `scripts/build-pages.mjs` — `web/`에서 `_site/` 조립(루트 redirect 포함).
- `scripts/build-pages.test.mjs` — 조립 산출물 검증.
- `.github/workflows/pages.yml` — Pages 배포 워크플로.
- `.gitignore` — `_site/` 추가.
- `README.md` — 슬림화.
- `package.json` — test 스크립트에 guide 테스트 추가.

---

## Task 1: 가이드 페이지 (파일 + 카피 정정 + 테스트)

**Files:**
- Create: `web/ui_kits/guide/guide.css`
- Create: `web/ui_kits/guide/guide.js`
- Create: `web/ui_kits/guide/index.html`
- Create/Test: `web/ui_kits/guide/guide.test.js`

**Interfaces:**
- Consumes: 기존 `web/styles.css`, `web/tokens/*.css`, `web/assets/logo-train.svg` (변경 없음).
- Produces: `web/ui_kits/guide/index.html`(루트 `index.html` 없는 가이드 본문), `guide.css`, `guide.js` — Task 2의 `build-pages.mjs`가 복사 대상으로 참조.

- [ ] **Step 1: 실패하는 테스트 작성**

`web/ui_kits/guide/guide.test.js` 생성:

```js
// 가이드 페이지 — 자산 무결성 + 카피 정합성 가드.
// drift 재발 방지: 디자인 킷의 구버전 카피가 다시 들어오면 실패한다.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');

// ---- 자산 무결성: 로컬 href/src 가 모두 실재하는지 ----
const refs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map(m => m[1]);
const local = refs.filter(r => !/^(https?:|#|mailto:|data:)/.test(r));
for (const r of local) {
  const p = path.resolve(dir, r);
  assert.ok(fs.existsSync(p), `missing local asset: ${r} -> ${p}`);
}

// ---- 카피 정합성: 구버전(stale) 문자열은 없어야 한다 ----
for (const bad of ['dashboard.html', '같은 폴더', '설치 불필요', '실행파일 하나가 전부']) {
  assert.ok(!html.includes(bad), `stale copy present: "${bad}"`);
}

// ---- 카피 정합성: 현재 사실 문자열은 있어야 한다 ----
for (const need of ['%LOCALAPPDATA%\\HSR Warp', '/ui_kits/dashboard/', '설치 마법사', 'hsr-warp-setup-', 'schedule.json']) {
  assert.ok(html.includes(need), `required copy missing: "${need}"`);
}

console.log('guide.test.js OK');
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node web/ui_kits/guide/guide.test.js`
Expected: FAIL — `ENOENT ... index.html` (파일 미존재).

- [ ] **Step 3: `guide.css` 작성 (디자인 킷 verbatim)**

DesignSync로 원본을 받아 `web/ui_kits/guide/guide.css`에 **그대로** 기록한다(변경 없음):

```
DesignSync(method="get_file", projectId="4a0d441c-4f52-4c0c-810f-1c942c2a9124", path="ui_kits/guide/guide.css")
```

받은 `content`를 그대로 파일에 쓴다. 검증: 첫 줄은 `/* ===...` 주석 헤더, 마지막 블록은 `@media(max-width:560px){...}`. (DesignSync 미가용 시 ToolSearch `select:DesignSync`로 로드.)

- [ ] **Step 4: `guide.js` 작성 (디자인 킷 verbatim)**

DesignSync로 원본을 받아 `web/ui_kits/guide/guide.js`에 **그대로** 기록한다(변경 없음):

```
DesignSync(method="get_file", projectId="4a0d441c-4f52-4c0c-810f-1c942c2a9124", path="ui_kits/guide/guide.js")
```

검증: IIFE 형태, `root.classList.add('js')` → 테마 토글(localStorage 키 `hsrwarp-theme`) → 스크롤 리빌(IntersectionObserver + 1.4s 안전망).

- [ ] **Step 5: `index.html` 작성 (디자인 킷 기반 + 카피 정정)**

먼저 DesignSync로 원본을 받는다:

```
DesignSync(method="get_file", projectId="4a0d441c-4f52-4c0c-810f-1c942c2a9124", path="ui_kits/guide/index.html")
```

받은 `content`를 기준으로 작성하되, 맨 앞 두 줄의 `<!-- @dsCard ... -->`·`<!-- @startingPoint ... -->` 주석은 **제거**(디자인 카탈로그 전용 마커)하고, 아래 7개 카피를 **정확히** 교체한다. 그 외 마크업·클래스·SVG·구조는 그대로.

**C1 — hero 메타 chip** (변경 전 → 후):
```
<span class="chip"><span class="dot"></span> 설치 불필요</span>
```
→
```
<span class="chip"><span class="dot"></span> 간편 설치 (마법사)</span>
```

**C2 — hero lead 문장 끝부분**:
```
<code class="kbd">hsr-warp.exe</code> 하나만 실행하면 브라우저에 대시보드가 자동으로 열립니다.
```
→
```
설치하고 실행하면 브라우저에 대시보드가 자동으로 열립니다.
```

**C3 — hero 목업 URL**:
```
<span class="url">127.0.0.1:8787/dashboard.html</span>
```
→
```
<span class="url">127.0.0.1:8787/ui_kits/dashboard/</span>
```

**C4 — Features 1번 카드 (`설치 불필요`)**:
```
        <h3>설치 불필요</h3>
        <p>실행파일 하나가 전부입니다. 설치 마법사도, 런타임도 없습니다 — 받아서 바로 실행하면 끝.</p>
```
→
```
        <h3>간편 설치</h3>
        <p>설치 마법사 하나로 끝납니다(관리자 권한 불필요). 시작 메뉴·바탕화면 바로가기가 생기고, 새 버전이 나오면 실행할 때 알려줍니다.</p>
```

**C5 — Quick Start 2단계 블록** (`<div class="glass step reveal">` 두 번째, step-n `2`):
```
        <div>
          <h3><code>hsr-warp.exe</code> 를 실행합니다</h3>
          <p>검은 콘솔 창이 뜨고, 기본 브라우저에 대시보드가 자동으로 열립니다 (예: <code>http://127.0.0.1:8787/dashboard.html</code>).</p>
          <div class="callout">
            <span class="warn">⚠</span>
            <span>다운로드한 프로그램이라 <b>처음 실행 시 Windows가 경고</b>할 수 있습니다(서명되지 않은 프로그램). 직접 받은 파일이 맞다면 <b>추가 정보 → 실행</b>을 누르면 됩니다.</span>
          </div>
        </div>
```
→
```
        <div>
          <h3>설치하고 실행합니다</h3>
          <p><a href="https://github.com/jkas2016/hsr-warp/releases/latest" target="_blank" rel="noopener">Releases</a>에서 <code>hsr-warp-setup-X.X.X.exe</code> 를 받아 실행하면 설치 마법사가 뜹니다(관리자 권한 불필요, 내 계정 폴더에 설치). 설치가 끝나면 시작 메뉴나 바탕화면 바로가기로 실행하세요. 검은 콘솔 창이 뜨고 기본 브라우저에 대시보드가 자동으로 열립니다 (예: <code>http://127.0.0.1:8787/ui_kits/dashboard/</code>).</p>
          <div class="callout">
            <span class="warn">⚠</span>
            <span>서명되지 않은 프로그램이라 <b>설치·실행 시 Windows가 경고</b>할 수 있습니다. 직접 받은 파일이 맞다면 <b>추가 정보 → 실행</b>을 누르면 됩니다.</span>
          </div>
        </div>
```

**C6 — 저장 파일 섹션 도입부**:
```
<p><code>hsr-warp.exe</code> 와 <b>같은 폴더</b>에 자동으로 만들어집니다. 모두 평범한 파일이라 직접 열어볼 수 있어요.</p>
```
→
```
<p>설치 폴더 <code>%LOCALAPPDATA%\HSR Warp</code> 에 자동으로 만들어집니다. 모두 평범한 파일이라 직접 열어볼 수 있어요.</p>
```

**C7 — FAQ 자동 갱신 항목 추가** (FAQ의 "여러 계정을 쓸 수 있나요?" `</details>` 바로 다음에 삽입):
```
      <details class="glass reveal">
        <summary>새 패치·새 버전은 자동으로 반영되나요? <span class="pm">+</span></summary>
        <p>두 가지가 자동으로 갱신됩니다. <b>픽업 일정 데이터</b>는 앱을 켤 때 최신본(<code>schedule.json</code>)을 자동으로 받아 반영해, 갓 나온 신규 패치 5★의 "미확인" 표시가 릴리스 없이 해소됩니다. <b>앱 자체</b>는 새 버전이 나오면 실행할 때 알려주며, 설치 마법사로 갱신합니다.</p>
      </details>
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `node web/ui_kits/guide/guide.test.js`
Expected: PASS — `guide.test.js OK`.

- [ ] **Step 7: 로컬 렌더 육안 확인 (수동)**

`web/`를 정적 서빙(예: `npx --yes serve web -l 8099` 또는 앱 실행 후 `/ui_kits/guide/`)하고 브라우저로 `http://localhost:8099/ui_kits/guide/` 접속. 확인: 페이지 렌더, 우상단 테마 토글(다크↔라이트), 스크롤 시 카드 리빌, DevTools 콘솔 에러 없음, 로고·폰트 로드. 문제 없으면 다음 단계.

- [ ] **Step 8: 커밋**

```bash
git add web/ui_kits/guide/
git commit -m "feat: 가이드 페이지(GitHub Pages 킷) 추가 — 카피 현행화 #9"
```

---

## Task 2: Pages 조립 스크립트 + GitHub Actions 워크플로

**Files:**
- Create: `scripts/build-pages.mjs`
- Create/Test: `scripts/build-pages.test.mjs`
- Create: `.github/workflows/pages.yml`
- Modify: `.gitignore` (없으면 생성)

**Interfaces:**
- Consumes: Task 1의 `web/ui_kits/guide/{index.html,guide.css,guide.js}`, 기존 `web/styles.css`·`web/tokens/`·`web/assets/logo-train.svg`, `docs/architecture.html`.
- Produces: `_site/` 디렉터리(루트 `index.html` redirect + DS 자산 + `ui_kits/guide/` + `architecture.html`). 워크플로가 `_site`를 Pages 아티팩트로 업로드.

- [ ] **Step 1: 실패하는 테스트 작성**

`scripts/build-pages.test.mjs` 생성:

```js
// build-pages.mjs 조립 산출물 검증.
import assert from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
execFileSync('node', [join(root, 'scripts/build-pages.mjs')], { stdio: 'inherit' });

const out = join(root, '_site');
for (const f of [
  'index.html',
  'styles.css',
  'tokens/colors.css',
  'assets/logo-train.svg',
  'ui_kits/guide/index.html',
  'ui_kits/guide/guide.css',
  'ui_kits/guide/guide.js',
  'architecture.html',
]) {
  assert.ok(existsSync(join(out, f)), `missing in _site: ${f}`);
}

// 루트 진입점은 가이드로 보낸다
const idx = readFileSync(join(out, 'index.html'), 'utf8');
assert.ok(idx.includes('url=ui_kits/guide/'), 'root index must redirect to guide');

// 테스트 파일은 게시되지 않는다
assert.ok(!existsSync(join(out, 'ui_kits/guide/guide.test.js')), 'test file must not be published');

console.log('build-pages.test.mjs OK');
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node scripts/build-pages.test.mjs`
Expected: FAIL — `Cannot find module .../scripts/build-pages.mjs` (스크립트 미존재).

- [ ] **Step 3: 조립 스크립트 작성**

`scripts/build-pages.mjs` 생성:

```js
// web/ 에서 GitHub Pages 사이트(_site/)를 조립한다. web/ 가 유일 소스.
import { rmSync, mkdirSync, cpSync, copyFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, '_site');

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

// DS 의존(가이드의 ../../ 상대경로 보존)
copyFileSync(join(root, 'web/styles.css'), join(out, 'styles.css'));
cpSync(join(root, 'web/tokens'), join(out, 'tokens'), { recursive: true });
mkdirSync(join(out, 'assets'), { recursive: true });
copyFileSync(join(root, 'web/assets/logo-train.svg'), join(out, 'assets/logo-train.svg'));

// 가이드 본문(테스트 파일 제외하고 명시 복사)
mkdirSync(join(out, 'ui_kits/guide'), { recursive: true });
for (const f of ['index.html', 'guide.css', 'guide.js']) {
  copyFileSync(join(root, 'web/ui_kits/guide', f), join(out, 'ui_kits/guide', f));
}

// 문서 허브: 개발자 아키텍처 문서
copyFileSync(join(root, 'docs/architecture.html'), join(out, 'architecture.html'));

// 루트 진입점 → 가이드
writeFileSync(join(out, 'index.html'),
`<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<meta http-equiv="refresh" content="0; url=ui_kits/guide/">
<link rel="canonical" href="ui_kits/guide/">
<title>HSR 워프 대시보드</title></head>
<body><a href="ui_kits/guide/">가이드로 이동</a></body></html>
`);

console.log('built _site/');
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node scripts/build-pages.test.mjs`
Expected: PASS — `built _site/` 후 `build-pages.test.mjs OK`.

- [ ] **Step 5: `.gitignore`에 `_site/` 추가**

`.gitignore`가 있으면 끝에 한 줄 추가, 없으면 생성:

```
_site/
```

확인: `git status` 에 `_site/`가 추적 대상으로 나오지 않아야 한다.

- [ ] **Step 6: 워크플로 작성**

`.github/workflows/pages.yml` 생성:

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
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: node scripts/build-pages.mjs
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: _site

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

- [ ] **Step 7: 워크플로 YAML 문법 확인**

Run: `node -e "const c=require('fs').readFileSync('.github/workflows/pages.yml','utf8'); if(!c.includes('actions/deploy-pages@v5')||!c.includes('node scripts/build-pages.mjs')) throw new Error('workflow content check failed'); console.log('workflow OK')"`
Expected: `workflow OK`. (런타임 검증은 main push 후 Actions 탭에서 확인 — 아래 Task 4 안내.)

- [ ] **Step 8: 커밋**

```bash
git add scripts/build-pages.mjs scripts/build-pages.test.mjs .github/workflows/pages.yml .gitignore
git commit -m "build: GitHub Pages 조립 스크립트 + 배포 워크플로 #9"
```

---

## Task 3: 테스트 명령 통합

**Files:**
- Modify: `package.json:13` (test 스크립트)

**Interfaces:**
- Consumes: Task 1 `web/ui_kits/guide/guide.test.js`, Task 2 `scripts/build-pages.test.mjs`.
- Produces: `npm test`가 두 신규 테스트를 포함.

- [ ] **Step 1: `package.json` test 스크립트 수정**

변경 전:
```json
    "test": "node scripts/run-go.mjs test ./... && node web/analyze.test.js",
```
변경 후:
```json
    "test": "node scripts/run-go.mjs test ./... && node web/analyze.test.js && node web/ui_kits/guide/guide.test.js && node scripts/build-pages.test.mjs",
```

- [ ] **Step 2: 전체 테스트 실행 확인**

Run: `node web/analyze.test.js && node web/ui_kits/guide/guide.test.js && node scripts/build-pages.test.mjs`
Expected: 세 줄 모두 OK 출력(`... OK`), exit 0. (go 미설치 환경이면 go 부분은 생략하고 node 테스트만 확인.)

- [ ] **Step 3: 커밋**

```bash
git add package.json
git commit -m "test: 가이드·Pages 조립 테스트를 npm test 에 통합 #9"
```

---

## Task 4: README 슬림화

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: 없음.
- Produces: 사이트로 링크하는 슬림 README. 사용자 상세 문서는 사이트가 단일 소스.

- [ ] **Step 1: README 상단(1~82행, License 위까지) 교체**

`README.md`의 제목부터 "## 자주 묻는 것" 블록 끝(개발자 `<details>` 직전, 현재 1~82행)을 아래로 교체한다. 개발자 `<details>` 블록(현재 84~110행)과 `## License`는 **그대로 둔다**.

```markdown
# HSR 워프 대시보드

붕괴: 스타레일의 **전언(워프) 기록**을 내 PC로 가져와 **천장·운·픽뚫(50/50)·월별 통계**를 보여주는 작은 프로그램입니다. 설치 마법사로 설치하고 실행하면 브라우저에 대시보드가 자동으로 열립니다.

- **간편 설치** — 관리자 권한 없이 설치 마법사 하나로 끝. 새 버전이 나오면 실행할 때 알려줍니다.
- **완전 로컬** — 모든 처리는 내 PC에서만. 기록이 외부로 전송되지 않고, 계정 로그인도 필요 없습니다.
- **안전하게 누적** — 다시 조회해도 과거 기록은 보존되고 새 기록만 더해집니다.

## 빠른 시작

1. **게임에서 전언 기록을 엽니다** ⚠️ (가장 중요) — 게임 안에서 직접 **[전언] → [기록]** 화면을 열어 뽑기 목록이 화면에 보이게 합니다. 인증 정보(authkey)가 이때 PC 캐시에 갱신되고, 조회 직전에 한 번 열어둬야 유효합니다.
2. **설치하고 실행합니다** — [Releases](https://github.com/jkas2016/hsr-warp/releases/latest)에서 `hsr-warp-setup-X.X.X.exe` 를 받아 실행하면 설치 마법사가 뜹니다(관리자 권한 불필요). 설치 후 시작 메뉴·바탕화면 바로가기로 실행하면 대시보드가 자동으로 열립니다.
3. **조회합니다** — 게임 경로는 자동으로 채워집니다(틀리면 `…\Star Rail Games` 직접 입력). **조회** 버튼을 누르면 새 기록만 가져와 차트가 갱신됩니다.

📖 **전체 가이드** — 설치·authkey 발급·지표 해설·50/50 판정·문제 해결·FAQ는 공식 가이드 사이트에 있습니다: **<https://jkas2016.github.io/hsr-warp/>**

---
```

- [ ] **Step 2: 결과 확인**

Run: `node -e "const c=require('fs').readFileSync('README.md','utf8'); for(const n of ['jkas2016.github.io/hsr-warp','개발자용 (소스 빌드)','## License']) if(!c.includes(n)) throw new Error('missing: '+n); for(const b of ['## 문제 해결','## 대시보드에서 보는 지표']) if(c.includes(b)) throw new Error('should be moved to site: '+b); console.log('README OK')"`
Expected: `README OK` (사이트 링크·개발자 섹션·License 유지, 이관된 섹션은 제거됨).

- [ ] **Step 3: 커밋**

```bash
git add README.md
git commit -m "docs: README 슬림화 — 상세 가이드는 Pages 사이트로 이관 #9"
```

---

## Task 5: 마무리 — Pages 활성화 안내 (수동, 코드 아님)

**Files:** 없음 (사용자 액션 안내).

- [ ] **Step 1: 사용자에게 Pages 활성화 안내**

브랜치를 `main`에 머지/푸시한 뒤, GitHub repo **Settings → Pages → Build and deployment → Source = "GitHub Actions"** 로 1회 설정해야 워크플로가 배포된다(코드로 강제 불가). 설정 후 `main` push 또는 Actions 탭에서 *Deploy Pages* 수동 실행(`workflow_dispatch`)하면 `https://jkas2016.github.io/hsr-warp/` 에 게시된다.

- [ ] **Step 2: 배포 검증 (머지·활성화 후)**

Actions 탭에서 *Deploy Pages* 워크플로가 녹색인지 확인하고, `https://jkas2016.github.io/hsr-warp/` 가 가이드로 리다이렉트되어 정상 렌더되는지(테마 토글·링크·푸터의 architecture 링크) 확인한다.

---

## Self-Review

**Spec coverage:**
- GitHub Pages 설정 → Task 2(워크플로) + Task 5(활성화 안내). ✓
- 사용 가이드(설치·authkey·조회) → Task 1 가이드 페이지(C4/C5 정정 포함). ✓
- 50/50 판정 사용자 설명 → 디자인 킷 "판정 기준" 섹션 유지(이미 정확). ✓
- FAQ·트러블슈팅 → 가이드 페이지 해당 섹션 유지 + C7 자동 갱신 항목 추가. ✓
- ARCHITECTURE 연계/확장 → Task 2가 `architecture.html`을 `_site`에 포함, 가이드 푸터에서 링크. ✓
- 자동 갱신(데이터/코드 2채널) 문서화 → Task 1 C7. ✓
- 내용 단일 소스(drift 방지) → Task 1 카피 정합성 테스트 + Task 4 README 슬림화 + Task 2 무복제 조립. ✓

**Placeholder scan:** guide.css/guide.js는 "디자인 킷 verbatim"으로 지정 — 본 세션에서 DesignSync로 전문을 이미 수신했으므로 실제 콘텐츠가 결정적으로 확보됨(추측 아님). index.html은 7개 정정을 old→new 전문으로 명시. 그 외 코드 블록은 모두 전문 포함. ✓

**Type consistency:** localStorage 키 `hsrwarp-theme`(guide.js)·테스트 문자열·`url=ui_kits/guide/` redirect·`_site/` 경로가 Task 간 일관. 액션 버전은 Global Constraints에 고정. ✓
