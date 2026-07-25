# 가이드 사이트(docs/site) 다국어(i18n) 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 가이드 사이트를 ko/en/zh/ja 4개 언어로 제공 — 언어별 프리렌더 HTML 4페이지(`/`, `/en/`, `/zh/`, `/ja/`) + 루트 자동 이동 + 지구본 전환 UI.

**Architecture:** `GuidePage.jsx`의 하드코딩 문구를 언어별 JSX 사전 모듈(`src/i18n/{ko,en,zh,ja}.jsx`)로 분리하고, `prerender.mjs`가 4개 언어를 루프 돌며 각 HTML에 `<html lang>`·title·description·og·hreflang을 박는다. 루트(/)만 인라인 스크립트로 `?lang → localStorage → navigator → ko` 자동 이동.

**Tech Stack:** React 19 + Vite 8 SSG(기존), rolldown(테스트에서 JSX 사전 로드 — Vite 8의 번들러로 `docs/site/node_modules`에 이미 존재), assert 기반 테스트(기존 컨벤션).

**Spec:** [docs/superpowers/specs/2026-07-25-guide-site-i18n-design.md](../specs/2026-07-25-guide-site-i18n-design.md)

## Global Constraints

- 언어 코드는 `ko`(기본)·`en`·`zh`·`ja`. 경로는 ko=`''`, 그 외 `<code>/`. html lang은 ko/en/`zh-Hans`/ja. og:locale은 ko_KR/en_US/zh_CN/ja_JP.
- localStorage 키는 대시보드와 동일한 `'hsrwarp-lang'`. 결정 순서 `?lang=` → localStorage → navigator → ko.
- base는 `'/hsr-warp/'`(vite.config.mjs) — 자산·링크는 절대 경로라 `/en/` 깊이에서도 동작. 사이트 URL은 `https://jkas2016.github.io/hsr-warp/`.
- `dict.meta`의 값(문자열)에 큰따옴표(`"`) 금지 — HTML 속성 주입 시 이스케이프를 피하기 위한 규약. 테스트로 강제.
- 사전 4개는 **키 구조(중첩·배열 길이) 완전 일치** — i18n.test.mjs가 강제. 값은 문자열 또는 JSX 조각.
- 게임 용어는 아래 용어 표(대시보드 사전 `web/ui_kits/dashboard/i18n/*.js` 대조 완료) 준수.
- 테스트는 빌드 없이 node 단독 실행 가능해야 한다(기존 copy.test.mjs 원칙). 정규식 소스 파싱으로 사전 구조를 검사하지 말 것 — rolldown 로드 후 실제 객체 비교(#24 false-pass 교훈).
- **번들러 사실 확인(검증 완료)**: `docs/site`에 esbuild는 **없다**. Vite 8.1.0은 rolldown(+oxc)을 쓴다(`node_modules/rolldown` 존재, vite deps에 `rolldown: ~1.1.2`). JSX transform 옵션은 `transform: { jsx: 'react-jsx' }` (`'automatic'`은 무효). 번들 출력은 **`docs/site` 하위 파일로 써서 file URL로 import**해야 한다 — `data:` URL은 `react/jsx-runtime` 같은 bare specifier를 해석하지 못한다.
- 커밋 메시지는 기존 스타일: `feat(site): …`, `test(site): …`, `docs(changelog): …` + `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- `architecture.html`·스크린샷 png·대시보드 i18n 구조는 건드리지 않는다(Non-goal).

## 게임 용어 표 (번역 시 준수)

| ko | en | zh | ja |
|---|---|---|---|
| 붕괴: 스타레일 | Honkai: Star Rail | 崩坏：星穹铁道 | 崩壊：スターレイル |
| 전언(워프) | Warp | 跃迁 | 跳躍（ワープ） |
| 전언 기록 (게임 메뉴) | [Warp] → [Records] | 「跃迁」→「记录」 | 「跳躍」→「履歴」 |
| 천장 | pity | 保底 | 天井 |
| 하드천장 90/80 | hard pity 90/80 | 90/80抽硬保底 | 天井90/80回 |
| 픽승 / 픽뚫 | won / lost the 50/50 | 没歪 / 歪了 | すり抜けなし / すり抜け |
| 확정 획득 | guaranteed | 大保底 | PU確定 |
| 광추 | Light Cone | 光锥 | 光円錐 |
| 성옥 | Stellar Jade | 星琼 | 星玉 |
| 한정 배너 | limited banner | 限定卡池 | 限定バナー |
| 픽업(rate-up) | rate-up | UP角色/光锥 | ピックアップ |

## File Structure

```
docs/site/src/i18n/index.js     ← 신규: LANGS 메타 + DICTS 맵 (Task 1, 이후 태스크마다 사전 추가)
docs/site/src/i18n/ko.jsx       ← 신규: 한국어 사전 (Task 1, GuidePage에서 추출)
docs/site/src/i18n/en.jsx       ← 신규 (Task 2)
docs/site/src/i18n/zh.jsx       ← 신규 (Task 3)
docs/site/src/i18n/ja.jsx       ← 신규 (Task 4)
docs/site/src/pages/GuidePage.jsx    ← 수정: dict prop 소비 (Task 1)
docs/site/src/App.jsx                ← 수정: lang prop → dict 선택 (Task 1, 5)
docs/site/src/entry-server.jsx       ← 수정: render(lang) + LANGS/META export (Task 5)
docs/site/src/entry-client.jsx       ← 수정: 경로에서 언어 감지 (Task 5)
docs/site/index.html                 ← 수정: og 자리·head-i18n 플레이스홀더·리다이렉트 스크립트 (Task 6)
docs/site/prerender.mjs              ← 수정: 4언어 루프 + head 치환 + hreflang (Task 7)
docs/site/src/pages/LangSwitcher.jsx ← 신규: 지구본 드롭다운 (Task 8)
docs/site/src/pages/guide.css        ← 수정: 드롭다운 스타일 (Task 8)
docs/site/copy.test.mjs              ← 수정: 사전 파일 대응 (Task 1, 7)
docs/site/i18n.test.mjs              ← 신규: 사전 구조·불변식·리다이렉트 스크립트 테스트 (Task 2, 6)
package.json (루트)                   ← 수정: test 체인에 i18n.test.mjs 추가 (Task 9)
CHANGELOG.md                          ← 수정: 변경 내역 (Task 9)
```

---

### Task 1: ko 사전 추출 + GuidePage 사전 소비 리팩터 (동작 불변)

**Files:**
- Create: `docs/site/src/i18n/index.js`
- Create: `docs/site/src/i18n/ko.jsx`
- Modify: `docs/site/src/pages/GuidePage.jsx` (전체 재작성)
- Modify: `docs/site/src/App.jsx`
- Modify: `docs/site/copy.test.mjs`

**Interfaces:**
- Produces: `i18n/index.js`가 `LANGS`(4개 메타 배열: `{code, path, html, ogLocale, label}`)와 `DICTS`(이 시점엔 `{ko}`) export. `GuidePage({ dict, lang })` — dict는 사전 객체. `App({ lang = 'ko' })`.
- 사전 키 스키마(모든 언어 공통, 이후 태스크가 이 구조를 복제):
  `meta{title,description,ogTitle,ogDescription}` / `nav{brand,logoAlt,start,metrics,files,trouble,faq,github,theme,lang,download}` / `hero{eyebrow,title,lead,ctaDownload,ctaStart,chips[3]}` / `mock{heading,totalPulls,totalUnit,fiveStar,fiveUnit,winRate,winUnit,luckLabel,luckUnit}` / `features[3]{title,body}` / `quick{eyebrow,title,lead,step1{title,body,callout},step2{title,body,callout,shot1{alt,caption},shot2{alt,caption}},step3{title,body},step4{title,body,shot{alt,caption}}}` / `metricsSec{eyebrow,title,lead,luck{title,big,bigUnit,body},avg{title,body},win{title,body},monthly{title,body},criteria{title,items[3]{tag,body}}}` / `filesSec{eyebrow,title,lead,thName,thDesc,rows[3],note}` / `troubleSec{eyebrow,title,lead,cards[4]{tag,body}}` / `faqSec{eyebrow,title,items[5]{q,a}}` / `cta{title,lead,github}` / `footer{brand,disc,repo,releases,srgf,gacha,arch,license,mono}`

- [ ] **Step 1: copy.test.mjs를 사전 구조에 맞춰 갱신 (failing test)**

기존 검사 대상을 GuidePage.jsx 단독에서 `GuidePage.jsx + src/i18n/*.jsx 연결 소스`로 확장한다. `docs/site/copy.test.mjs`에서 소스 로드 부분(13~15행)과 카피 가드(17~23행)를 다음으로 교체:

```js
import { readFileSync, existsSync, readdirSync } from 'node:fs';
// …기존 import 유지…

const dir = dirname(fileURLToPath(import.meta.url));
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');
const src = readFileSync(join(dir, 'src/pages/GuidePage.jsx'), 'utf8');
const code = stripComments(src);
// 사전 소스: 번역 문구가 옮겨간 곳. ko.jsx 는 필수(원문 카피 가드 대상).
const koDict = stripComments(readFileSync(join(dir, 'src/i18n/ko.jsx'), 'utf8'));
const dictFiles = readdirSync(join(dir, 'src/i18n')).filter((f) => f.endsWith('.jsx'));
const allDicts = dictFiles.map((f) => stripComments(readFileSync(join(dir, 'src/i18n', f), 'utf8'))).join('\n');

// --- 가이드 본문 카피(내용 drift 가드): 원문 문구는 ko 사전에 있어야 한다 ---
for (const need of ['설치 마법사', 'hsr-warp-setup-', '/ui_kits/dashboard/', '%LOCALAPPDATA%', 'schedule.json']) {
  assert.ok(koDict.includes(need), `required copy missing in ko dict: "${need}"`);
}
for (const bad of ['dashboard.html', '같은 폴더', '설치 불필요', '실행파일 하나가 전부', '실행파일 하나만 받으면']) {
  assert.ok(!code.includes(bad) && !allDicts.includes(bad), `stale copy present: "${bad}"`);
}
```

이후 검사(architecture href, prerender wiring, 에셋 존재)는 그대로 두되, 에셋 추출은 기존처럼 `code`(GuidePage)만 대상 — `asset()` 호출은 GuidePage에 남는다.

- [ ] **Step 2: 실패 확인**

Run: `node docs/site/copy.test.mjs`
Expected: FAIL — `ENOENT ... src/i18n/ko.jsx` (사전 디렉터리가 아직 없음)

- [ ] **Step 3: `src/i18n/ko.jsx` 작성 — GuidePage 문구 전체 추출**

현재 GuidePage.jsx(334줄)의 한국어 문구를 **한 글자도 바꾸지 않고** 아래 구조로 옮긴다. 값이 마크업을 포함하면 JSX 조각으로.

```jsx
// 한국어(기본) 사전. 키 구조는 4개 언어 공통 — i18n.test.mjs 가 구조 일치를 강제한다.
// meta 값에는 큰따옴표(") 금지(HTML 속성 주입 규약).
export default {
  meta: {
    title: 'HSR 워프 대시보드 — 내 전언 기록을, 내 PC에서',
    description: '붕괴: 스타레일 전언(워프) 기록을 내 PC로 가져와 천장·운·픽뚫(50/50)·월별 통계를 보여주는 작은 로컬 프로그램. 간편 설치, 완전 로컬, 계정 로그인 불필요.',
    ogTitle: 'HSR 워프 대시보드 — 내 전언 기록을, 내 PC에서',
    ogDescription: '붕괴: 스타레일 전언(워프) 기록을 내 PC에서 분석 — 천장·운·픽뚫(50/50)·월별 통계. 완전 로컬, 로그인 없음.',
  },
  nav: {
    brand: 'HSR 워프', logoAlt: 'HSR 워프 로고',
    start: '빠른 시작', metrics: '지표', files: '저장 파일', trouble: '문제 해결', faq: 'FAQ',
    github: 'GitHub 저장소', theme: '테마 전환', lang: '언어 선택', download: '다운로드',
  },
  hero: {
    eyebrow: 'Honkai: Star Rail · 워프 기록 분석',
    title: <>내 전언 기록을,<br /><span className="accent">내 PC에서.</span></>,
    lead: <>붕괴: 스타레일의 전언(워프) 기록을 가져와 <b style={{ color: 'var(--txt)' }}>천장 · 운 · 픽뚫(50/50) · 월별 통계</b>를 한눈에 보여주는 작은 프로그램입니다. 설치하고 실행하면 브라우저에 대시보드가 자동으로 열립니다.</>,
    ctaDownload: '최신 버전 다운로드',
    ctaStart: '빠른 시작 보기',
    chips: ['간편 설치 (마법사)', '완전 로컬 · 로그인 없음', 'MIT 오픈소스'],
  },
  mock: {
    heading: <>Honkai: Star Rail <span className="g">워프 대시보드</span></>,
    totalPulls: '총 뽑기', totalUnit: ' 회', fiveStar: '5★', fiveUnit: ' 개',
    winRate: '픽승률', winUnit: ' %', luckLabel: '운 지표 · 캐릭터 평균 천장', luckUnit: ' 회',
  },
  features: [
    { title: '간편 설치', body: '설치 마법사 하나로 끝납니다(관리자 권한 불필요). 시작 메뉴·바탕화면 바로가기가 생기고, 새 버전이 나오면 실행할 때 알려줍니다.' },
    { title: '완전 로컬', body: '모든 처리는 내 PC에서만 일어나고 기록이 외부로 전송되지 않습니다. 계정 로그인도 필요 없습니다.' },
    { title: '안전하게 누적', body: '다시 조회해도 과거 기록은 그대로 보존되고 새 기록만 더해집니다. 표준 SRGF v1.0 형식으로 저장돼요.' },
  ],
  quick: {
    eyebrow: 'Quick Start',
    title: '네 단계면 충분합니다',
    lead: '게임에서 기록 화면을 한 번 열고, 설치·실행하고, 조회하면 끝. 가장 중요한 건 첫 단계입니다.',
    step1: {
      title: <>게임에서 전언 기록을 엽니다 <span className="badge warn">가장 중요</span></>,
      body: <>게임을 <b>실행만 하는 것으로는 안 됩니다.</b> 게임 안에서 직접 <b>[전언] → [기록]</b> 화면을 열어 <b>뽑기 목록이 화면에 보이게</b> 해야 합니다. 이때 게임이 인증 정보(authkey)를 PC 캐시에 기록하고, 이 프로그램은 그걸 읽어 조회합니다.</>,
      callout: <>이 인증 정보는 시간이 지나면 만료됩니다. <b>조회 직전에</b> 전언 기록 화면을 한 번 열어두세요.</>,
    },
    step2: {
      title: '설치하고 실행합니다',
      body: <><a href="https://github.com/jkas2016/hsr-warp/releases/latest" target="_blank" rel="noopener">Releases</a>에서 <code>hsr-warp-setup-X.X.X.exe</code> 를 받아 실행하면 설치 마법사가 뜹니다(관리자 권한 불필요, 내 계정 폴더에 설치). 설치가 끝나면 시작 메뉴나 바탕화면 바로가기로 실행하세요. 검은 콘솔 창이 뜨고 기본 브라우저에 대시보드가 자동으로 열립니다 (예: <code>http://127.0.0.1:8787/ui_kits/dashboard/</code>).</>,
      callout: <>서명되지 않은 프로그램이라 <b>설치·실행 시 Windows가 경고</b>할 수 있습니다(아래 화면). 직접 받은 파일이 맞다면 <b>추가 정보 → 실행</b> 순서로 누르면 됩니다.</>,
      shot1: { alt: "Windows SmartScreen 경고 첫 화면 — '추가 정보' 링크", caption: <><b>추가 정보</b> 클릭</> },
      shot2: { alt: "'추가 정보' 클릭 후 나타난 '실행' 버튼", caption: <><b>실행</b> 클릭</> },
    },
    step3: {
      title: '조회합니다',
      body: <><b>게임 경로</b>는 자동으로 채워집니다(이전 사용 경로 → 없으면 자동 탐지). 비어 있거나 틀리면 게임 폴더 <code>…\Star Rail Games</code> 를 직접 입력하세요. <b>조회</b> 버튼을 누르면 새 기록만 실시간으로 가져오고 차트가 갱신됩니다. 기존에 저장된 기록은 조회 없이도 바로 표시됩니다.</>,
    },
    step4: {
      title: '종료',
      body: <>실행하면 아래처럼 <b>검은 콘솔 창</b>이 함께 떠 있습니다(대시보드는 브라우저에서 열립니다). 다 봤으면 <b>이 창을 닫거나</b> 창에서 <span className="kbd">Ctrl + C</span> 를 누르면 프로그램이 종료됩니다.</>,
      shot: { alt: '실행 시 함께 뜨는 HSR Warp 콘솔 창', caption: '이 창을 닫으면 프로그램이 종료됩니다.' },
    },
  },
  metricsSec: {
    eyebrow: 'Metrics',
    title: '대시보드에서 보는 지표',
    lead: '모든 수치는 표준 공식 확률을 기준으로 계산됩니다. 낮은 천장일수록 행운이에요.',
    luck: { title: '운 지표', big: '62.5', bigUnit: ' 회 기준', body: <>5★ 평균 천장을 이론 평균 <b style={{ color: 'var(--txt)' }}>62.5회</b>(종합 확률 1.6%)와 비교합니다. 이 값보다 낮을수록 운이 좋다는 뜻이에요.</> },
    avg: { title: '평균 천장', body: '캐릭터 5★를 뽑기까지 평균 몇 회가 걸렸는지, 그리고 가장 운 좋았던/나빴던 천장까지 함께 보여줍니다.' },
    win: { title: '픽승률 (50/50)', body: <>한정 배너에서 50/50 승부 중 <b style={{ color: 'var(--txt)' }}>픽업을 뽑은 비율</b>입니다. 픽뚫 후의 확정 획득은 별도로 집계됩니다.</> },
    monthly: { title: '월별 집계', body: '월별 뽑기 수 · 소비 성옥 · 획득 5★를 한눈에. 어느 패치에 가장 많이 썼는지 추세가 보입니다.' },
    criteria: {
      title: '판정 기준',
      items: [
        { tag: '픽승 / 픽뚫', body: <>5★ 획득 <b>시점의 배너 픽업(rate-up)</b> 대상이면 <b>픽승</b>, 아니면 <b>픽뚫</b>으로 봅니다. 시점 기반이라 상시풀 편입·리런·콜라보·Celestial Invitation을 정확히 처리합니다(픽업 일정은 <code>web/schedule.json</code>).</> },
        { tag: '미확인', body: <>픽업 일정에 아직 없는 시점(주로 갓 나온 신규 패치)의 5★는 <b>미확인</b>으로 표시됩니다 — 일정을 갱신하면 자동으로 해소됩니다.</> },
        { tag: '공식 확률', body: <>캐릭터 0.6%(종합 1.6%) · 하드천장 <b>90</b> / 광추 0.8% · 하드천장 <b>80</b>.</> },
      ],
    },
  },
  filesSec: {
    eyebrow: 'Storage',
    title: '저장되는 파일',
    lead: <>설치 폴더 <code>%LOCALAPPDATA%\HSR Warp</code> 에 자동으로 만들어집니다. 모두 평범한 파일이라 직접 열어볼 수 있어요.</>,
    thName: '폴더 / 파일', thDesc: '내용',
    rows: [
      <>워프 기록(월별 <code>warp_YYYYMM.json</code>). 표준 SRGF v1.0 형식이라 다른 도구로도 가져갈 수 있습니다.</>,
      <>마지막에 쓴 게임 경로</>,
      <>실행 기록(날짜별 <code>hsr-warp-YYYY-MM-DD.log</code>). 문제가 생겼을 때 원인 확인에 씁니다.</>,
    ],
    note: <>다른 PC로 옮기거나 백업하려면 <code>data\</code> 폴더를 통째로 복사하면 됩니다.</>,
  },
  troubleSec: {
    eyebrow: 'Troubleshooting',
    title: '문제 해결',
    lead: '대부분은 인증 정보(authkey) 문제예요. 막히면 거의 항상 1번 단계를 다시 하면 풀립니다.',
    cards: [
      { tag: 'authkey 만료', body: <>게임을 켜는 것만으로는 갱신되지 않습니다. 게임 안에서 <b>[전언] → [기록]</b> 화면을 다시 직접 연 뒤(목록이 보이게) 조회하세요. 메시지에 표시된 <b>발급 시각</b>이 오래됐다면 화면을 안 연 것입니다.</> },
      { tag: '조회가 너무 잦습니다 (서버 호출 제한)', body: <>짧은 간격으로 여러 번 조회하면 서버가 잠시 막습니다. <b>1~2분 기다렸다가</b> 다시 조회하세요.</> },
      { tag: '게임 경로를 못 찾음 / webCaches 없음', body: <>경로 입력란에 게임 설치 폴더 <code>…\Star Rail Games</code> 를 직접 입력하세요.</> },
      { tag: '그 밖의 오류', body: <><code>logs\</code> 폴더의 최신 로그 파일을 열어보면 어느 단계에서 멈췄는지 알 수 있습니다. 더 자세한 기록이 필요하면 <code>HSRWARP_LOG=debug</code> 를 설정하고 실행하세요(에러엔 스택트레이스가 함께 남습니다).</> },
    ],
  },
  faqSec: {
    eyebrow: 'FAQ',
    title: '자주 묻는 것',
    items: [
      { q: '계정이 위험하지 않나요?', a: <>이 프로그램은 게임이 PC에 남긴 조회용 인증 정보를 읽어 <b>읽기 전용</b> 비공식 기록 API만 호출합니다. 비밀번호나 계정 정보는 다루지 않고, 게임에 어떤 변경도 하지 않습니다.</> },
      { q: '데이터가 어디로 전송되나요?', a: <>어디로도 보내지 않습니다. 호요버스 조회 서버와 내 PC 사이의 통신만 있고, 결과는 내 PC에만 저장됩니다.</> },
      { q: '여러 계정을 쓸 수 있나요?', a: <>현재는 마지막으로 조회한 계정 기준으로 저장됩니다.</> },
      { q: '새 패치·새 버전은 자동으로 반영되나요?', a: <>두 가지가 자동으로 갱신됩니다. <b>픽업 일정 데이터</b>는 앱을 켤 때 최신본(<code>schedule.json</code>)을 자동으로 받아 반영해, 갓 나온 신규 패치 5★의 "미확인" 표시가 릴리스 없이 해소됩니다. <b>앱 자체</b>는 새 버전이 나오면 실행할 때 알려주며, 설치 마법사로 갱신합니다.</> },
      { q: '소스로 직접 빌드할 수 있나요?', a: <><code>node</code> 만 있으면 됩니다 — <code>go</code> 는 빌드 스크립트가 자동으로 찾습니다. <code>npm run build</code> 로 정적 단일 exe를 빌드하고 <code>npm start</code> 로 실행합니다. 자세한 내용은 저장소의 README를 참고하세요.</> },
    ],
  },
  cta: {
    title: '지금 내 운을 확인해 보세요',
    lead: '설치 마법사 하나로 시작합니다. 로그인도, 데이터 전송도 없습니다.',
    github: 'GitHub에서 보기',
  },
  footer: {
    brand: 'HSR 워프 대시보드',
    disc: <>붕괴: 스타레일 전언 기록을 로컬에서 분석하는 비공식 오픈소스 도구입니다. <b style={{ color: 'var(--txt)' }}>HoYoverse와 무관</b>하며, 게임 내 어떤 데이터도 변경하지 않습니다. 데이터 형식은 SRGF v1.0.</>,
    repo: 'GitHub 저장소', releases: '다운로드 (Releases)', srgf: 'SRGF 형식 표준',
    gacha: '확률 · 50/50 가이드', arch: '아키텍처 문서',
    license: 'MIT License · © 2026 hsr-warp',
    mono: 'SRGF v1.0 · 캐릭터 90 / 광추 80 하드천장',
  },
};
```

- [ ] **Step 4: `src/i18n/index.js` 작성**

```js
// 언어 메타(단일 소스) + 사전 맵. LANGS 는 4개 확정, DICTS 는 사전 태스크가 진행되며 채워진다.
import ko from './ko.jsx';

export const LANGS = [
  { code: 'ko', path: '',    html: 'ko',      ogLocale: 'ko_KR', label: '한국어' },
  { code: 'en', path: 'en/', html: 'en',      ogLocale: 'en_US', label: 'English' },
  { code: 'zh', path: 'zh/', html: 'zh-Hans', ogLocale: 'zh_CN', label: '简体中文' },
  { code: 'ja', path: 'ja/', html: 'ja',      ogLocale: 'ja_JP', label: '日本語' },
];
export const DICTS = { ko };
```

(`ko.jsx`가 JSX를 포함하므로 `index.js`에서 import해도 vite/esbuild가 처리 — plain node 직접 import는 불가, 테스트는 esbuild 경유.)

- [ ] **Step 5: GuidePage.jsx를 dict 소비로 재작성**

시그니처를 `export function GuidePage({ dict, lang = 'ko' })`로 바꾸고 `const t = dict;` 후 모든 하드코딩 문구를 `t.*`로 치환한다. **마크업 구조(섹션·글래스 카드·SVG·이미지·테이블·href)는 그대로 GuidePage에 남긴다.** 치환 대응표:

| 위치 | 치환 |
|---|---|
| nav 브랜드/링크/aria-label/다운로드 | `t.nav.*` (`aria-label={t.nav.github}` 등) |
| hero eyebrow/h1/lead/CTA/chips | `t.hero.*`, chips는 `t.hero.chips.map((c, i) => <span className="chip" key={i}><span className="dot"></span> {c}</span>)` |
| mock 라벨 | `t.mock.*` (예: `<div className="k">{t.mock.totalPulls}</div><div className="v">2,184<small>{t.mock.totalUnit}</small></div>`) — 숫자 값(2,184·41·62·58.2)은 구조로 유지 |
| features 3카드 | `t.features.map((f, i) => …)` — SVG 아이콘 3개는 GuidePage 안 배열 `featIcons[i]`로 유지 |
| quick step1~4 | `t.quick.step1.title` / `.body` / `.callout`(callout div의 ⚠ 구조는 유지, 문구만) / step2 `shots` figure 2개는 `t.quick.step2.shot1.alt`·`.caption` 등 |
| metrics 4카드+판정 기준 | `t.metricsSec.luck.*` 등. criteria는 `t.metricsSec.criteria.items.map((it, i) => …)` + tagchip 클래스는 GuidePage 배열 `['win','unk','win'][i]` |
| files 테이블 | th 2개 `t.filesSec.thName/thDesc`, 행 이름 셀(`data\`, `config.json`, `logs\`)은 구조 유지, 설명 셀만 `t.filesSec.rows[i]` |
| trouble 4카드 | `t.troubleSec.cards.map((c, i) => …)` + tagchip 클래스 `['loss','unk','unk','unk'][i]` |
| faq 5개 | `t.faqSec.items.map((f, i) => <details className="glass reveal" open={i === 0} key={i}><summary>{f.q} <span className="pm">+</span></summary><p>{f.a}</p></details>)` |
| cta | `t.cta.*`, 다운로드 버튼 라벨은 `t.hero.ctaDownload` 재사용 |
| footer | `t.footer.*` — 링크 href 5개는 구조 유지(architecture.html 포함), 라벨만 치환 |

- [ ] **Step 6: App.jsx에 lang prop 추가**

```jsx
import { DICTS } from './i18n/index.js';
// …
export function App({ lang = 'ko' }) {
  const dict = DICTS[lang] || DICTS.ko;
  // …기존 useEffect 그대로…
  return <GuidePage dict={dict} lang={lang} />;
}
```

- [ ] **Step 7: 테스트·빌드로 동작 불변 확인**

Run: `node docs/site/copy.test.mjs`
Expected: `copy.test.mjs OK`

Run: `cd docs/site && npm run build`
Expected: 성공, `prerendered dist/static/index.html`

Run: `grep -c "설치 마법사" docs/site/dist/static/index.html`
Expected: 1 이상 (ko 문구가 프리렌더에 그대로 존재)

- [ ] **Step 8: Commit**

```bash
git add docs/site/src/i18n/ docs/site/src/pages/GuidePage.jsx docs/site/src/App.jsx docs/site/copy.test.mjs
git commit -m "refactor(site): GuidePage 문구를 ko 사전 모듈로 추출 — 동작 불변 (#46)"
```

---

### Task 2: i18n 구조 테스트 인프라 + en 사전

**Files:**
- Create: `docs/site/i18n.test.mjs`
- Create: `docs/site/src/i18n/en.jsx`
- Modify: `docs/site/src/i18n/index.js` (en 추가)

**Interfaces:**
- Consumes: Task 1의 사전 키 스키마와 `LANGS`/`DICTS`.
- Produces: `i18n.test.mjs` — rolldown으로 `src/i18n/index.js`를 번들해 실제 `DICTS`를 로드, (1) 각 사전의 키 구조가 ko와 완전 일치, (2) 로케일 불변 문자열이 모든 언어에 존재, (3) meta 값에 큰따옴표 금지 검증. 이후 태스크는 사전 파일 추가 + `index.js` 한 줄이면 자동 커버.

- [ ] **Step 1: i18n.test.mjs 작성 (failing test)**

아래 로드 방식은 실측 검증됨(rolldown 1.1.x + react 19, `transform.jsx='react-jsx'`, 산출물을 `docs/site` 하위 파일로 써서 file URL import). `data:` URL import·esbuild·`jsx:'automatic'`은 이 환경에서 동작하지 않으므로 바꾸지 말 것.

```js
// 사전 구조·불변식 테스트(실행 기반). JSX 모듈은 rolldown(Vite 8 의 번들러)으로 번들해 로드한다
// — 정규식 소스 파싱 금지(#24 false-pass 교훈).
import assert from 'node:assert';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const dir = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(dir, 'package.json'));
const { rolldown } = require('rolldown');

// 번들 산출물은 docs/site 하위에 써야 한다 — data: URL 은 react/jsx-runtime 같은
// bare specifier 를 해석하지 못한다(ERR_UNSUPPORTED_RESOLVE_REQUEST).
const bundle = await rolldown({
  input: join(dir, 'src/i18n/index.js'),
  cwd: dir, platform: 'node', logLevel: 'silent',
  transform: { jsx: 'react-jsx' },
});
const { output } = await bundle.generate({ format: 'esm' });
const tmp = join(dir, 'node_modules/.i18n-test-bundle.mjs');
writeFileSync(tmp, output[0].code);
let mod;
try {
  mod = await import(pathToFileURL(tmp).href);
} finally {
  rmSync(tmp, { force: true });
}
const { LANGS, DICTS } = mod;

// React 엘리먼트는 리프로 취급($$typeof 심벌 존재).
const isElement = (v) => typeof v === 'object' && v !== null && !!v.$$typeof;

// 값 트리 → 구조 서술자. 리프(문자열/숫자/JSX)는 'leaf', 배열은 원소별, 객체는 키별(정렬).
function shape(v) {
  if (typeof v === 'string' || typeof v === 'number' || isElement(v)) return 'leaf';
  if (Array.isArray(v)) return v.map(shape);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, shape(v[k])]));
  throw new Error('사전에 허용되지 않는 값: ' + String(v));
}

// JSX 트리에서 텍스트만 수집(로케일 불변 문자열 검사용).
function textOf(v, out = []) {
  if (v == null) return out;
  if (typeof v === 'string' || typeof v === 'number') { out.push(String(v)); return out; }
  if (Array.isArray(v)) { for (const c of v) textOf(c, out); return out; }
  if (isElement(v)) { textOf(v.props.children, out); return out; }
  if (typeof v === 'object') { for (const c of Object.values(v)) textOf(c, out); return out; }
  return out;
}

assert.ok(DICTS.ko, 'ko 사전 없음');
assert.ok(DICTS.en, 'en 사전 없음');

const koShape = shape(DICTS.ko);
const INVARIANT = ['hsr-warp-setup-', '/ui_kits/dashboard/', '%LOCALAPPDATA%', 'schedule.json', 'SRGF'];
for (const [code, dict] of Object.entries(DICTS)) {
  assert.deepStrictEqual(shape(dict), koShape, `${code} 사전의 키 구조가 ko와 다름`);
  const text = textOf(dict).join('\n');
  for (const need of INVARIANT) {
    assert.ok(text.includes(need), `${code} 사전에 로케일 불변 문자열 누락: "${need}"`);
  }
  for (const [k, v] of Object.entries(dict.meta)) {
    assert.ok(typeof v === 'string' && !v.includes('"'), `${code} meta.${k} 에 큰따옴표 금지(HTML 속성 주입 규약)`);
  }
}
// LANGS 메타 자체 검증
assert.deepStrictEqual(LANGS.map((l) => l.code), ['ko', 'en', 'zh', 'ja'], 'LANGS 코드 불일치');
assert.ok(LANGS.every((l) => l.path === '' || l.path.endsWith('/')), 'LANGS path 는 빈 문자열 또는 슬래시 종결');

console.log('i18n.test.mjs OK');
```

- [ ] **Step 2: 실패 확인**

Run: `node docs/site/i18n.test.mjs`
Expected: FAIL — `en 사전 없음`

- [ ] **Step 3: `src/i18n/en.jsx` 작성 — ko와 동일 키 구조의 완역**

용어 표 준수(Warp/pity/Stellar Jade/won·lost the 50/50/Light Cone/hard pity). 전문:

```jsx
// English dictionary. Key structure must mirror ko.jsx exactly (enforced by i18n.test.mjs).
export default {
  meta: {
    title: 'HSR Warp Dashboard — Your Warp Records, on Your PC',
    description: 'A small local app that imports your Honkai: Star Rail Warp records and shows pity, luck, 50/50 results and monthly stats. Easy installer, fully local, no account login.',
    ogTitle: 'HSR Warp Dashboard — Your Warp Records, on Your PC',
    ogDescription: 'Analyze your Honkai: Star Rail Warp records on your own PC — pity, luck, 50/50 results, monthly stats. Fully local, no login.',
  },
  nav: {
    brand: 'HSR Warp', logoAlt: 'HSR Warp logo',
    start: 'Quick Start', metrics: 'Metrics', files: 'Files', trouble: 'Troubleshooting', faq: 'FAQ',
    github: 'GitHub repository', theme: 'Toggle theme', lang: 'Select language', download: 'Download',
  },
  hero: {
    eyebrow: 'Honkai: Star Rail · Warp history analytics',
    title: <>Your Warp records,<br /><span className="accent">on your PC.</span></>,
    lead: <>A small program that imports your Honkai: Star Rail Warp records and shows <b style={{ color: 'var(--txt)' }}>pity · luck · 50/50 results · monthly stats</b> at a glance. Install it, run it, and the dashboard opens in your browser automatically.</>,
    ctaDownload: 'Download latest version',
    ctaStart: 'See Quick Start',
    chips: ['Easy setup (installer)', 'Fully local · No login', 'MIT open source'],
  },
  mock: {
    heading: <>Honkai: Star Rail <span className="g">Warp Dashboard</span></>,
    totalPulls: 'Total pulls', totalUnit: '', fiveStar: '5★', fiveUnit: '',
    winRate: 'Win rate', winUnit: ' %', luckLabel: 'Luck · Avg character pity', luckUnit: ' pulls',
  },
  features: [
    { title: 'Easy install', body: 'One installer and you are done (no admin rights needed). It creates Start Menu and desktop shortcuts, and tells you at launch when a new version is available.' },
    { title: 'Fully local', body: 'Everything runs on your PC only — your records are never sent anywhere. No account login required.' },
    { title: 'Safe accumulation', body: 'Fetching again preserves your past records and only appends new ones. Data is stored in the standard SRGF v1.0 format.' },
  ],
  quick: {
    eyebrow: 'Quick Start',
    title: 'Four steps are all it takes',
    lead: 'Open the records screen in the game once, install and run, then fetch. The first step is the one that matters most.',
    step1: {
      title: <>Open your Warp records in the game <span className="badge warn">Most important</span></>,
      body: <>Just <b>launching the game is not enough.</b> You must open the <b>[Warp] → [Records]</b> screen in the game so <b>the pull list is visible on screen</b>. That is when the game writes an auth token (authkey) to the PC cache, which this program reads to fetch your records.</>,
      callout: <>This auth token expires after a while. Open the Warp records screen <b>right before fetching</b>.</>,
    },
    step2: {
      title: 'Install and run',
      body: <>Download <code>hsr-warp-setup-X.X.X.exe</code> from <a href="https://github.com/jkas2016/hsr-warp/releases/latest" target="_blank" rel="noopener">Releases</a> and run it to launch the setup wizard (no admin rights, installs into your user folder). When it finishes, start the app from the Start Menu or desktop shortcut. A black console window appears and the dashboard opens in your default browser (e.g. <code>http://127.0.0.1:8787/ui_kits/dashboard/</code>).</>,
      callout: <>The program is unsigned, so <b>Windows may warn you during install or launch</b> (screens below). If it is the file you downloaded yourself, click <b>More info → Run anyway</b>.</>,
      shot1: { alt: 'First Windows SmartScreen warning — the More info link', caption: <>Click <b>More info</b></> },
      shot2: { alt: 'The Run anyway button shown after clicking More info', caption: <>Click <b>Run anyway</b></> },
    },
    step3: {
      title: 'Fetch',
      body: <>The <b>game path</b> is filled in automatically (last used path → auto-detect otherwise). If it is empty or wrong, enter your game folder <code>…\Star Rail Games</code> directly. Press <b>Fetch</b> and only new records are pulled in real time while the charts refresh. Previously saved records are shown immediately without fetching.</>,
    },
    step4: {
      title: 'Quit',
      body: <>While running, a <b>black console window</b> stays open alongside (the dashboard lives in your browser). When you are done, <b>close that window</b> or press <span className="kbd">Ctrl + C</span> in it to quit the program.</>,
      shot: { alt: 'The HSR Warp console window that opens alongside the app', caption: 'Closing this window quits the program.' },
    },
  },
  metricsSec: {
    eyebrow: 'Metrics',
    title: 'What the dashboard shows',
    lead: 'All numbers are computed against the standard official rates. Lower pity means better luck.',
    luck: { title: 'Luck', big: '62.5', bigUnit: ' pull baseline', body: <>Compares your average 5★ pity against the theoretical average of <b style={{ color: 'var(--txt)' }}>62.5 pulls</b> (1.6% consolidated rate). Lower than that means you have been lucky.</> },
    avg: { title: 'Average pity', body: 'How many pulls your character 5★s took on average, along with your luckiest and unluckiest pity counts.' },
    win: { title: 'Win rate (50/50)', body: <>The share of 50/50 contests on limited banners where <b style={{ color: 'var(--txt)' }}>you pulled the rate-up</b>. Guaranteed pulls after losing a 50/50 are counted separately.</> },
    monthly: { title: 'Monthly summary', body: 'Pulls, Stellar Jade spent and 5★s obtained per month at a glance — see which patch you spent the most on.' },
    criteria: {
      title: 'How results are judged',
      items: [
        { tag: 'Won / Lost', body: <>A 5★ counts as <b>won</b> if it was a <b>rate-up target of the banner at the moment it was obtained</b>, otherwise <b>lost</b>. Being time-based, this correctly handles standard-pool additions, reruns, collabs and Celestial Invitation (rate-up schedule in <code>web/schedule.json</code>).</> },
        { tag: 'Unknown', body: <>5★s obtained at a time not yet covered by the rate-up schedule (usually a brand-new patch) show as <b>unknown</b> — refreshing the schedule resolves them automatically.</> },
        { tag: 'Official rates', body: <>Character 0.6% (1.6% consolidated) · hard pity <b>90</b> / Light Cone 0.8% · hard pity <b>80</b>.</> },
      ],
    },
  },
  filesSec: {
    eyebrow: 'Storage',
    title: 'Files it creates',
    lead: <>Created automatically under the install folder <code>%LOCALAPPDATA%\HSR Warp</code>. They are all plain files you can open yourself.</>,
    thName: 'Folder / file', thDesc: 'Contents',
    rows: [
      <>Warp records (monthly <code>warp_YYYYMM.json</code>). Standard SRGF v1.0 format, so other tools can import them too.</>,
      <>The game path you used last</>,
      <>Run logs (daily <code>hsr-warp-YYYY-MM-DD.log</code>). Useful for finding the cause when something goes wrong.</>,
    ],
    note: <>To move to another PC or back up, just copy the whole <code>data\</code> folder.</>,
  },
  troubleSec: {
    eyebrow: 'Troubleshooting',
    title: 'Troubleshooting',
    lead: 'Most issues are auth token (authkey) problems. When stuck, redoing step 1 almost always fixes it.',
    cards: [
      { tag: 'authkey expired', body: <>Just starting the game does not refresh it. Open the <b>[Warp] → [Records]</b> screen in the game again (until the list is visible), then fetch. If the <b>issued time</b> in the message is old, the screen was not opened.</> },
      { tag: 'Fetching too often (server rate limit)', body: <>Fetching many times in a short period gets briefly blocked by the server. <b>Wait 1–2 minutes</b> and fetch again.</> },
      { tag: 'Game path not found / no webCaches', body: <>Enter your game install folder <code>…\Star Rail Games</code> directly into the path field.</> },
      { tag: 'Other errors', body: <>Open the newest log file in the <code>logs\</code> folder to see which step failed. For more detail, run with <code>HSRWARP_LOG=debug</code> (errors include stack traces).</> },
    ],
  },
  faqSec: {
    eyebrow: 'FAQ',
    title: 'Frequently asked',
    items: [
      { q: 'Is my account at risk?', a: <>This program reads the query-only auth token the game leaves on your PC and calls the <b>read-only</b> unofficial records API. It never touches passwords or account credentials, and changes nothing in the game.</> },
      { q: 'Where is my data sent?', a: <>Nowhere. The only traffic is between your PC and the HoYoverse records server, and results are stored on your PC only.</> },
      { q: 'Can I use multiple accounts?', a: <>Currently, records are stored per the account you fetched last.</> },
      { q: 'Are new patches and versions applied automatically?', a: <>Two things update automatically. The <b>rate-up schedule data</b> (<code>schedule.json</code>) is fetched fresh at app launch, so "unknown" 5★s from a brand-new patch resolve without a release. The <b>app itself</b> notifies you at launch when a new version is out, and updates via the installer.</> },
      { q: 'Can I build from source?', a: <>All you need is <code>node</code> — the build script finds <code>go</code> automatically. Build a static single exe with <code>npm run build</code> and run it with <code>npm start</code>. See the repository README for details.</> },
    ],
  },
  cta: {
    title: 'Check your luck now',
    lead: 'One installer to get started. No login, no data leaves your PC.',
    github: 'View on GitHub',
  },
  footer: {
    brand: 'HSR Warp Dashboard',
    disc: <>An unofficial open-source tool that analyzes Honkai: Star Rail Warp records locally. <b style={{ color: 'var(--txt)' }}>Not affiliated with HoYoverse</b>; it changes nothing in the game. Data format: SRGF v1.0.</>,
    repo: 'GitHub repository', releases: 'Download (Releases)', srgf: 'SRGF format standard',
    gacha: 'Rates · 50/50 guide', arch: 'Architecture docs',
    license: 'MIT License · © 2026 hsr-warp',
    mono: 'SRGF v1.0 · hard pity 90 (char) / 80 (LC)',
  },
};
```

- [ ] **Step 4: index.js에 en 등록**

```js
import ko from './ko.jsx';
import en from './en.jsx';
// … LANGS 동일 …
export const DICTS = { ko, en };
```

- [ ] **Step 5: 통과 확인**

Run: `node docs/site/i18n.test.mjs && node docs/site/copy.test.mjs`
Expected: `i18n.test.mjs OK` / `copy.test.mjs OK`

- [ ] **Step 6: Commit**

```bash
git add docs/site/i18n.test.mjs docs/site/src/i18n/en.jsx docs/site/src/i18n/index.js
git commit -m "feat(site): en 사전 + i18n 구조 테스트(esbuild 로드·키 동등성·불변식) (#46)"
```

---

### Task 3: zh(간체) 사전

**Files:**
- Create: `docs/site/src/i18n/zh.jsx`
- Modify: `docs/site/src/i18n/index.js` (zh 추가)

**Interfaces:**
- Consumes: Task 1 키 스키마, Task 2 테스트(등록 즉시 자동 커버).
- Produces: `DICTS.zh`.

- [ ] **Step 1: index.js에 zh 등록 (failing test)**

```js
import zh from './zh.jsx';
export const DICTS = { ko, en, zh };
```

Run: `node docs/site/i18n.test.mjs`
Expected: FAIL — `zh.jsx` 없음(esbuild resolve 에러)

- [ ] **Step 2: `src/i18n/zh.jsx` 작성 — 완역**

용어 표 준수(跃迁/保底/星琼/没歪·歪了·大保底/光锥). 전문:

```jsx
// 简体中文词典。键结构必须与 ko.jsx 完全一致（由 i18n.test.mjs 强制）。
export default {
  meta: {
    title: 'HSR跃迁仪表盘 — 我的跃迁记录，在我自己的电脑上',
    description: '一个小型本地程序：导入崩坏：星穹铁道的跃迁记录，展示保底·运气·歪了(50/50)·月度统计。安装简单，完全本地，无需登录账号。',
    ogTitle: 'HSR跃迁仪表盘 — 我的跃迁记录，在我自己的电脑上',
    ogDescription: '在自己的电脑上分析崩坏：星穹铁道跃迁记录 — 保底·运气·歪了(50/50)·月度统计。完全本地，无需登录。',
  },
  nav: {
    brand: 'HSR跃迁', logoAlt: 'HSR跃迁 logo',
    start: '快速开始', metrics: '指标', files: '保存文件', trouble: '问题排查', faq: 'FAQ',
    github: 'GitHub 仓库', theme: '切换主题', lang: '选择语言', download: '下载',
  },
  hero: {
    eyebrow: 'Honkai: Star Rail · 跃迁记录分析',
    title: <>我的跃迁记录，<br /><span className="accent">在我自己的电脑上。</span></>,
    lead: <>导入崩坏：星穹铁道的跃迁记录，一眼看清<b style={{ color: 'var(--txt)' }}>保底 · 运气 · 歪了(50/50) · 月度统计</b>的小程序。安装并运行后，浏览器会自动打开仪表盘。</>,
    ctaDownload: '下载最新版本',
    ctaStart: '查看快速开始',
    chips: ['安装简单（向导）', '完全本地 · 无需登录', 'MIT 开源'],
  },
  mock: {
    heading: <>Honkai: Star Rail <span className="g">跃迁仪表盘</span></>,
    totalPulls: '总抽数', totalUnit: ' 抽', fiveStar: '5★', fiveUnit: ' 个',
    winRate: '不歪率', winUnit: ' %', luckLabel: '运气指标 · 角色平均保底', luckUnit: ' 抽',
  },
  features: [
    { title: '安装简单', body: '一个安装向导即可完成（无需管理员权限）。自动创建开始菜单和桌面快捷方式，出新版本时启动会提醒你。' },
    { title: '完全本地', body: '所有处理只在你的电脑上进行，记录不会被发送到任何地方。也不需要登录账号。' },
    { title: '安全累积', body: '再次查询时过去的记录原样保留，只追加新记录。以标准 SRGF v1.0 格式保存。' },
  ],
  quick: {
    eyebrow: 'Quick Start',
    title: '四步即可完成',
    lead: '在游戏里打开一次记录界面，安装并运行，然后查询即可。最重要的是第一步。',
    step1: {
      title: <>在游戏中打开跃迁记录 <span className="badge warn">最重要</span></>,
      body: <>只<b>启动游戏是不够的。</b>必须在游戏内亲自打开<b>「跃迁」→「记录」</b>界面，让<b>抽卡列表显示在屏幕上</b>。此时游戏会把鉴权信息（authkey）写入电脑缓存，本程序读取它来查询记录。</>,
      callout: <>该鉴权信息会随时间过期。请在<b>查询之前</b>先打开一次跃迁记录界面。</>,
    },
    step2: {
      title: '安装并运行',
      body: <>从 <a href="https://github.com/jkas2016/hsr-warp/releases/latest" target="_blank" rel="noopener">Releases</a> 下载 <code>hsr-warp-setup-X.X.X.exe</code> 并运行，会出现安装向导（无需管理员权限，安装到用户文件夹）。安装完成后，从开始菜单或桌面快捷方式启动。会弹出黑色控制台窗口，默认浏览器自动打开仪表盘（如 <code>http://127.0.0.1:8787/ui_kits/dashboard/</code>）。</>,
      callout: <>程序未签名，<b>安装或运行时 Windows 可能发出警告</b>（见下图）。如果确认是你自己下载的文件，依次点击<b>更多信息 → 仍要运行</b>即可。</>,
      shot1: { alt: 'Windows SmartScreen 警告首屏 — 「更多信息」链接', caption: <>点击<b>更多信息</b></> },
      shot2: { alt: '点击「更多信息」后出现的「仍要运行」按钮', caption: <>点击<b>仍要运行</b></> },
    },
    step3: {
      title: '查询',
      body: <><b>游戏路径</b>会自动填充（上次使用的路径 → 否则自动检测）。为空或不对时，请直接输入游戏文件夹 <code>…\Star Rail Games</code>。点击<b>查询</b>按钮，只实时拉取新记录并刷新图表。已保存的记录无需查询即可直接显示。</>,
    },
    step4: {
      title: '退出',
      body: <>运行时会同时出现如下<b>黑色控制台窗口</b>（仪表盘在浏览器中打开）。看完后<b>关闭该窗口</b>，或在窗口中按 <span className="kbd">Ctrl + C</span> 即可退出程序。</>,
      shot: { alt: '与程序一同弹出的 HSR Warp 控制台窗口', caption: '关闭此窗口即退出程序。' },
    },
  },
  metricsSec: {
    eyebrow: 'Metrics',
    title: '仪表盘展示的指标',
    lead: '所有数值均按标准官方概率计算。保底越低，运气越好。',
    luck: { title: '运气指标', big: '62.5', bigUnit: ' 抽基准', body: <>将你的 5★ 平均保底与理论平均 <b style={{ color: 'var(--txt)' }}>62.5 抽</b>（综合概率 1.6%）对比。低于该值说明运气不错。</> },
    avg: { title: '平均保底', body: '展示抽出角色 5★ 平均花了多少抽，以及最幸运/最不幸的保底数。' },
    win: { title: '不歪率 (50/50)', body: <>限定卡池 50/50 对决中<b style={{ color: 'var(--txt)' }}>抽中 UP 的比例</b>。歪了之后的大保底另行统计。</> },
    monthly: { title: '月度汇总', body: '每月抽数 · 消耗星琼 · 获得 5★ 一目了然，哪个版本花得最多一看便知。' },
    criteria: {
      title: '判定标准',
      items: [
        { tag: '没歪 / 歪了', body: <>5★ 在<b>获得时点是当期卡池 UP（rate-up）</b>对象则判为<b>没歪</b>，否则为<b>歪了</b>。基于时点判定，可准确处理常驻池收编、复刻、联动与 Celestial Invitation（UP 日程见 <code>web/schedule.json</code>）。</> },
        { tag: '未确认', body: <>UP 日程尚未覆盖的时点（多为刚上线的新版本）的 5★ 显示为<b>未确认</b> — 更新日程后会自动解决。</> },
        { tag: '官方概率', body: <>角色 0.6%（综合 1.6%）· 硬保底 <b>90</b> / 光锥 0.8% · 硬保底 <b>80</b>。</> },
      ],
    },
  },
  filesSec: {
    eyebrow: 'Storage',
    title: '保存的文件',
    lead: <>自动创建于安装文件夹 <code>%LOCALAPPDATA%\HSR Warp</code>。全是普通文件，可以直接打开查看。</>,
    thName: '文件夹 / 文件', thDesc: '内容',
    rows: [
      <>跃迁记录（按月 <code>warp_YYYYMM.json</code>）。标准 SRGF v1.0 格式，其他工具也能导入。</>,
      <>上次使用的游戏路径</>,
      <>运行日志（按日 <code>hsr-warp-YYYY-MM-DD.log</code>）。出问题时用来定位原因。</>,
    ],
    note: <>要迁移到其他电脑或备份，整个复制 <code>data\</code> 文件夹即可。</>,
  },
  troubleSec: {
    eyebrow: 'Troubleshooting',
    title: '问题排查',
    lead: '大多是鉴权信息（authkey）的问题。卡住时，重做第 1 步几乎总能解决。',
    cards: [
      { tag: 'authkey 已过期', body: <>仅启动游戏不会刷新。请在游戏内重新亲自打开<b>「跃迁」→「记录」</b>界面（直到列表可见）后再查询。若消息中显示的<b>签发时间</b>很旧，说明没有打开该界面。</> },
      { tag: '查询过于频繁（服务器限流）', body: <>短时间内多次查询会被服务器暂时拦截。<b>等待 1~2 分钟</b>后再查询。</> },
      { tag: '找不到游戏路径 / 没有 webCaches', body: <>请在路径输入框中直接输入游戏安装文件夹 <code>…\Star Rail Games</code>。</> },
      { tag: '其他错误', body: <>打开 <code>logs\</code> 文件夹中最新的日志文件，即可看到卡在哪一步。需要更详细的记录时，设置 <code>HSRWARP_LOG=debug</code> 后运行（错误会附带堆栈跟踪）。</> },
    ],
  },
  faqSec: {
    eyebrow: 'FAQ',
    title: '常见问题',
    items: [
      { q: '我的账号会有风险吗？', a: <>本程序读取游戏留在电脑上的仅供查询的鉴权信息，只调用<b>只读</b>的非官方记录 API。不接触密码或账号信息，也不对游戏做任何修改。</> },
      { q: '数据会被发送到哪里？', a: <>不会发送到任何地方。只存在你的电脑与米哈游查询服务器之间的通信，结果只保存在你的电脑上。</> },
      { q: '可以使用多个账号吗？', a: <>目前按最后一次查询的账号保存。</> },
      { q: '新版本·新卡池会自动生效吗？', a: <>有两样东西自动更新。<b>UP 日程数据</b>（<code>schedule.json</code>）在启动时自动拉取最新版，刚上线新版本 5★ 的"未确认"标记无需发版即可解决。<b>程序本身</b>出新版本时启动会提醒，并通过安装向导更新。</> },
      { q: '可以从源码自己构建吗？', a: <>只需要 <code>node</code> — 构建脚本会自动寻找 <code>go</code>。用 <code>npm run build</code> 构建静态单文件 exe，用 <code>npm start</code> 运行。详见仓库 README。</> },
    ],
  },
  cta: {
    title: '现在就来看看你的运气',
    lead: '一个安装向导即可开始。无需登录，数据不外传。',
    github: '在 GitHub 上查看',
  },
  footer: {
    brand: 'HSR跃迁仪表盘',
    disc: <>在本地分析崩坏：星穹铁道跃迁记录的非官方开源工具。<b style={{ color: 'var(--txt)' }}>与 HoYoverse 无关</b>，不会修改游戏内任何数据。数据格式为 SRGF v1.0。</>,
    repo: 'GitHub 仓库', releases: '下载 (Releases)', srgf: 'SRGF 格式标准',
    gacha: '概率 · 50/50 指南', arch: '架构文档',
    license: 'MIT License · © 2026 hsr-warp',
    mono: 'SRGF v1.0 · 硬保底 角色90 / 光锥80',
  },
};
```

- [ ] **Step 3: 통과 확인**

Run: `node docs/site/i18n.test.mjs && node docs/site/copy.test.mjs`
Expected: 둘 다 OK. (zh FAQ의 "未确认" 따옴표가 meta가 아닌 본문이므로 규약 위반 아님 확인.)

- [ ] **Step 4: Commit**

```bash
git add docs/site/src/i18n/zh.jsx docs/site/src/i18n/index.js
git commit -m "feat(site): zh(간체) 사전 (#46)"
```

---

### Task 4: ja 사전 + DICTS 완결 검증

**Files:**
- Create: `docs/site/src/i18n/ja.jsx`
- Modify: `docs/site/src/i18n/index.js` (ja 추가)
- Modify: `docs/site/i18n.test.mjs` (완결 assert 추가)

**Interfaces:**
- Consumes: Task 1 키 스키마.
- Produces: `DICTS` 4개 언어 완결. 이후 태스크는 `DICTS`/`LANGS`가 완전하다고 가정한다.

- [ ] **Step 1: i18n.test.mjs에 완결 assert 추가 (failing test)**

`console.log` 직전에 추가:

```js
// 사전 완결성: LANGS 에 선언된 모든 언어의 사전이 존재해야 한다.
assert.deepStrictEqual(Object.keys(DICTS).sort(), LANGS.map((l) => l.code).sort(), 'DICTS 가 LANGS 를 모두 커버하지 않음');
```

Run: `node docs/site/i18n.test.mjs`
Expected: FAIL — ja 누락

- [ ] **Step 2: `src/i18n/ja.jsx` 작성 — 완역**

용어 표 준수(跳躍〔ゲームメニュー〕/天井/星玉/すり抜け·PU確定/光円錐). 전문:

```jsx
// 日本語辞書。キー構造は ko.jsx と完全一致すること（i18n.test.mjs が強制）。
export default {
  meta: {
    title: 'HSRワープダッシュボード — 自分の跳躍履歴を、自分のPCで',
    description: '崩壊：スターレイルの跳躍（ワープ）履歴をPCに取り込み、天井・運・すり抜け(50/50)・月別統計を表示する小さなローカルアプリ。簡単インストール、完全ローカル、ログイン不要。',
    ogTitle: 'HSRワープダッシュボード — 自分の跳躍履歴を、自分のPCで',
    ogDescription: '崩壊：スターレイルの跳躍履歴を自分のPCで分析 — 天井・運・すり抜け(50/50)・月別統計。完全ローカル、ログイン不要。',
  },
  nav: {
    brand: 'HSRワープ', logoAlt: 'HSRワープ ロゴ',
    start: 'クイックスタート', metrics: '指標', files: '保存ファイル', trouble: 'トラブル対処', faq: 'FAQ',
    github: 'GitHub リポジトリ', theme: 'テーマ切替', lang: '言語を選択', download: 'ダウンロード',
  },
  hero: {
    eyebrow: 'Honkai: Star Rail · 跳躍履歴分析',
    title: <>自分の跳躍履歴を、<br /><span className="accent">自分のPCで。</span></>,
    lead: <>崩壊：スターレイルの跳躍（ワープ）履歴を取り込み、<b style={{ color: 'var(--txt)' }}>天井 · 運 · すり抜け(50/50) · 月別統計</b>を一目で見せる小さなプログラムです。インストールして実行すると、ブラウザにダッシュボードが自動で開きます。</>,
    ctaDownload: '最新版をダウンロード',
    ctaStart: 'クイックスタートを見る',
    chips: ['簡単インストール（ウィザード）', '完全ローカル · ログイン不要', 'MIT オープンソース'],
  },
  mock: {
    heading: <>Honkai: Star Rail <span className="g">ワープダッシュボード</span></>,
    totalPulls: '総回数', totalUnit: ' 回', fiveStar: '5★', fiveUnit: ' 個',
    winRate: 'すり抜けなし率', winUnit: ' %', luckLabel: '運指標 · キャラ平均天井', luckUnit: ' 回',
  },
  features: [
    { title: '簡単インストール', body: 'インストールウィザード一つで完了します（管理者権限不要）。スタートメニュー・デスクトップショートカットが作られ、新バージョンが出ると起動時に知らせます。' },
    { title: '完全ローカル', body: 'すべての処理は自分のPC内だけで行われ、履歴が外部に送信されることはありません。アカウントログインも不要です。' },
    { title: '安全に蓄積', body: '再取得しても過去の記録はそのまま保持され、新しい記録だけが追加されます。標準 SRGF v1.0 形式で保存されます。' },
  ],
  quick: {
    eyebrow: 'Quick Start',
    title: '4ステップで完了',
    lead: 'ゲームで履歴画面を一度開き、インストールして実行し、取得すれば終わり。いちばん大事なのは最初のステップです。',
    step1: {
      title: <>ゲームで跳躍履歴を開く <span className="badge warn">最重要</span></>,
      body: <>ゲームを<b>起動するだけでは足りません。</b>ゲーム内で直接<b>「跳躍」→「履歴」</b>画面を開き、<b>ガチャ一覧が画面に表示される</b>状態にしてください。このときゲームが認証情報（authkey）をPCキャッシュに書き込み、本プログラムはそれを読んで取得します。</>,
      callout: <>この認証情報は時間が経つと期限切れになります。<b>取得の直前に</b>跳躍履歴画面を一度開いておいてください。</>,
    },
    step2: {
      title: 'インストールして実行',
      body: <><a href="https://github.com/jkas2016/hsr-warp/releases/latest" target="_blank" rel="noopener">Releases</a> から <code>hsr-warp-setup-X.X.X.exe</code> をダウンロードして実行すると、インストールウィザードが開きます（管理者権限不要、ユーザーフォルダにインストール）。完了後はスタートメニューかデスクトップショートカットから起動してください。黒いコンソールウィンドウが開き、既定のブラウザにダッシュボードが自動で開きます（例：<code>http://127.0.0.1:8787/ui_kits/dashboard/</code>）。</>,
      callout: <>未署名のプログラムのため、<b>インストール・実行時に Windows が警告</b>することがあります（下の画面）。自分でダウンロードしたファイルであれば、<b>詳細情報 → 実行</b>の順にクリックすれば大丈夫です。</>,
      shot1: { alt: 'Windows SmartScreen 警告の最初の画面 — 「詳細情報」リンク', caption: <><b>詳細情報</b>をクリック</> },
      shot2: { alt: '「詳細情報」クリック後に現れる「実行」ボタン', caption: <><b>実行</b>をクリック</> },
    },
    step3: {
      title: '取得する',
      body: <><b>ゲームパス</b>は自動で入力されます（前回使用パス → なければ自動検出）。空欄または誤りの場合は、ゲームフォルダ <code>…\Star Rail Games</code> を直接入力してください。<b>取得</b>ボタンを押すと新しい記録だけがリアルタイムで取り込まれ、チャートが更新されます。保存済みの記録は取得しなくてもすぐ表示されます。</>,
    },
    step4: {
      title: '終了',
      body: <>実行中は下のような<b>黒いコンソールウィンドウ</b>が一緒に開いています（ダッシュボードはブラウザで開きます）。見終わったら<b>このウィンドウを閉じる</b>か、ウィンドウで <span className="kbd">Ctrl + C</span> を押すとプログラムが終了します。</>,
      shot: { alt: '実行時に一緒に開く HSR Warp コンソールウィンドウ', caption: 'このウィンドウを閉じるとプログラムが終了します。' },
    },
  },
  metricsSec: {
    eyebrow: 'Metrics',
    title: 'ダッシュボードで見る指標',
    lead: 'すべての数値は標準の公式確率を基準に計算されます。天井が低いほど幸運です。',
    luck: { title: '運指標', big: '62.5', bigUnit: ' 回基準', body: <>5★ 平均天井を理論平均 <b style={{ color: 'var(--txt)' }}>62.5回</b>（総合確率 1.6%）と比較します。この値より低いほど運が良いという意味です。</> },
    avg: { title: '平均天井', body: 'キャラクター5★を引くまで平均何回かかったか、そして最も幸運/不運だった天井も併せて表示します。' },
    win: { title: 'すり抜けなし率 (50/50)', body: <>限定バナーの 50/50 勝負のうち<b style={{ color: 'var(--txt)' }}>ピックアップを引けた割合</b>です。すり抜け後の PU確定は別途集計されます。</> },
    monthly: { title: '月別集計', body: '月ごとの回数 · 消費星玉 · 獲得5★を一目で。どのパッチで最も使ったか傾向が見えます。' },
    criteria: {
      title: '判定基準',
      items: [
        { tag: 'すり抜けなし / すり抜け', body: <>5★ 獲得<b>時点のバナーのピックアップ（rate-up）</b>対象なら<b>すり抜けなし</b>、そうでなければ<b>すり抜け</b>と判定します。時点ベースのため恒常入り・復刻・コラボ・Celestial Invitation も正確に処理します（ピックアップ日程は <code>web/schedule.json</code>）。</> },
        { tag: '未確認', body: <>ピックアップ日程にまだない時点（主に出たばかりの新パッチ）の 5★ は<b>未確認</b>と表示されます — 日程を更新すれば自動的に解消します。</> },
        { tag: '公式確率', body: <>キャラクター 0.6%（総合 1.6%）· 天井 <b>90</b> / 光円錐 0.8% · 天井 <b>80</b>。</> },
      ],
    },
  },
  filesSec: {
    eyebrow: 'Storage',
    title: '保存されるファイル',
    lead: <>インストールフォルダ <code>%LOCALAPPDATA%\HSR Warp</code> に自動で作られます。すべて普通のファイルなので直接開いて確認できます。</>,
    thName: 'フォルダ / ファイル', thDesc: '内容',
    rows: [
      <>跳躍履歴（月別 <code>warp_YYYYMM.json</code>）。標準 SRGF v1.0 形式なので他のツールにも取り込めます。</>,
      <>最後に使ったゲームパス</>,
      <>実行ログ（日別 <code>hsr-warp-YYYY-MM-DD.log</code>）。問題が起きたときの原因確認に使います。</>,
    ],
    note: <>別のPCへ移行やバックアップは <code>data\</code> フォルダを丸ごとコピーするだけです。</>,
  },
  troubleSec: {
    eyebrow: 'Troubleshooting',
    title: 'トラブル対処',
    lead: 'ほとんどは認証情報（authkey）の問題です。詰まったら、ほぼ必ずステップ1をやり直せば解決します。',
    cards: [
      { tag: 'authkey 期限切れ', body: <>ゲームを起動するだけでは更新されません。ゲーム内で<b>「跳躍」→「履歴」</b>画面をもう一度直接開いて（一覧が見える状態で）から取得してください。メッセージに表示される<b>発行時刻</b>が古い場合は、画面を開いていない証拠です。</> },
      { tag: '取得が頻繁すぎる（サーバー呼び出し制限）', body: <>短い間隔で何度も取得するとサーバーが一時的にブロックします。<b>1〜2分待ってから</b>再取得してください。</> },
      { tag: 'ゲームパスが見つからない / webCaches がない', body: <>パス入力欄にゲームのインストールフォルダ <code>…\Star Rail Games</code> を直接入力してください。</> },
      { tag: 'その他のエラー', body: <><code>logs\</code> フォルダの最新ログファイルを開くと、どの段階で止まったか分かります。より詳しい記録が必要なら <code>HSRWARP_LOG=debug</code> を設定して実行してください（エラーにはスタックトレースが付きます）。</> },
    ],
  },
  faqSec: {
    eyebrow: 'FAQ',
    title: 'よくある質問',
    items: [
      { q: 'アカウントは危険ではありませんか？', a: <>本プログラムはゲームがPCに残した照会用の認証情報を読み、<b>読み取り専用</b>の非公式履歴APIだけを呼び出します。パスワードやアカウント情報には触れず、ゲームに一切変更を加えません。</> },
      { q: 'データはどこに送信されますか？', a: <>どこにも送信しません。HoYoverse の照会サーバーと自分のPCの間の通信だけがあり、結果は自分のPCにのみ保存されます。</> },
      { q: '複数アカウントは使えますか？', a: <>現在は最後に取得したアカウント基準で保存されます。</> },
      { q: '新パッチ・新バージョンは自動で反映されますか？', a: <>2つが自動で更新されます。<b>ピックアップ日程データ</b>はアプリ起動時に最新版（<code>schedule.json</code>）を自動取得して反映し、出たばかりの新パッチ5★の「未確認」表示はリリースなしで解消します。<b>アプリ本体</b>は新バージョンが出ると起動時に知らせ、インストールウィザードで更新します。</> },
      { q: 'ソースから自分でビルドできますか？', a: <><code>node</code> さえあれば大丈夫です — <code>go</code> はビルドスクリプトが自動で見つけます。<code>npm run build</code> で静的シングル exe をビルドし、<code>npm start</code> で実行します。詳しくはリポジトリの README をご覧ください。</> },
    ],
  },
  cta: {
    title: '今すぐ自分の運を確かめよう',
    lead: 'インストールウィザード一つで始められます。ログインもデータ送信もありません。',
    github: 'GitHub で見る',
  },
  footer: {
    brand: 'HSRワープダッシュボード',
    disc: <>崩壊：スターレイルの跳躍履歴をローカルで分析する非公式オープンソースツールです。<b style={{ color: 'var(--txt)' }}>HoYoverse とは無関係</b>で、ゲーム内のいかなるデータも変更しません。データ形式は SRGF v1.0。</>,
    repo: 'GitHub リポジトリ', releases: 'ダウンロード (Releases)', srgf: 'SRGF 形式標準',
    gacha: '確率 · 50/50 ガイド', arch: 'アーキテクチャ文書',
    license: 'MIT License · © 2026 hsr-warp',
    mono: 'SRGF v1.0 · 天井 キャラ90 / 光円錐80',
  },
};
```

- [ ] **Step 3: index.js에 ja 등록**

```js
import ja from './ja.jsx';
export const DICTS = { ko, en, zh, ja };
```

- [ ] **Step 4: 통과 확인**

Run: `node docs/site/i18n.test.mjs && node docs/site/copy.test.mjs`
Expected: 둘 다 OK

- [ ] **Step 5: Commit**

```bash
git add docs/site/src/i18n/ja.jsx docs/site/src/i18n/index.js docs/site/i18n.test.mjs
git commit -m "feat(site): ja 사전 + 사전 완결성 검증 (#46)"
```

---

### Task 5: render(lang)·META export + 클라이언트 언어 감지

**Files:**
- Modify: `docs/site/src/entry-server.jsx`
- Modify: `docs/site/src/entry-client.jsx`

**Interfaces:**
- Consumes: `LANGS`/`DICTS` (Task 1~4).
- Produces: 서버 번들이 `render(lang: string): string`, `LANGS`, `META`(코드→`dict.meta`) export — Task 7의 prerender가 소비. 클라이언트는 경로 세그먼트로 언어를 감지해 같은 언어로 하이드레이션.

- [ ] **Step 1: entry-server.jsx 수정**

```jsx
import { renderToString } from 'react-dom/server';
import { App } from './App.jsx';
import { LANGS, DICTS } from './i18n/index.js';

// prerender.mjs 가 서버 번들에서 LANGS/META 를 읽어 head 치환에 사용한다.
export { LANGS };
export const META = Object.fromEntries(LANGS.map((l) => [l.code, DICTS[l.code].meta]));

// 빌드타임 렌더. prerender.mjs 가 언어별로 호출해 클라이언트 템플릿에 주입한다.
export function render(lang = 'ko') {
  return renderToString(<App lang={lang} />);
}
```

- [ ] **Step 2: entry-client.jsx 수정**

```jsx
import { hydrateRoot } from 'react-dom/client';
import './ds/styles.css';
import './pages/guide.css';
import { App } from './App.jsx';
import { LANGS } from './i18n/index.js';

// 언어는 URL 경로 세그먼트가 단일 소스(/en/ 등). 프리렌더 HTML과 같은 언어로
// 하이드레이션해 SSR/CSR 불일치를 없앤다. dev 서버에는 언어 경로가 없으므로 ?lang= 허용.
function pageLang() {
  const codes = LANGS.map((l) => l.code);
  const seg = location.pathname.slice(import.meta.env.BASE_URL.length).split('/')[0];
  if (codes.includes(seg)) return seg;
  if (import.meta.env.DEV) {
    const q = new URLSearchParams(location.search).get('lang');
    if (q && codes.includes(q)) return q;
  }
  return 'ko';
}

hydrateRoot(document.getElementById('root'), <App lang={pageLang()} />);
```

- [ ] **Step 3: 빌드·수동 확인**

Run: `cd docs/site && npm run build`
Expected: 성공 (prerender.mjs는 아직 `render()` 인자 없이 호출 — 기본값 'ko'로 동작 불변)

Run: `cd docs/site && npm run dev` 후 브라우저에서 `http://localhost:5173/hsr-warp/?lang=en` 확인 (Browser pane preview 사용)
Expected: 영어로 렌더. `?lang=ja` → 일본어. 무파라미터 → 한국어. 확인 후 dev 서버 종료.

- [ ] **Step 4: Commit**

```bash
git add docs/site/src/entry-server.jsx docs/site/src/entry-client.jsx
git commit -m "feat(site): render(lang)·META export + 경로 기반 클라이언트 언어 감지 (#46)"
```

---

### Task 6: index.html 리다이렉트 스크립트 + og 자리 + 스크립트 동작 테스트

**Files:**
- Modify: `docs/site/index.html`
- Modify: `docs/site/i18n.test.mjs` (리다이렉트 동작 테스트 추가)

**Interfaces:**
- Produces: `index.html`에 (1) `<!--head-i18n-->` 플레이스홀더(Task 7의 prerender가 og·hreflang·canonical 주입 지점), (2) `/*lang-redirect*/` 마커가 붙은 인라인 스크립트. 스크립트는 `document.documentElement`의 `lang` 속성으로 페이지 언어를 판별한다(프리렌더가 언어별로 박아줌).
- 동작 규약: ko 페이지(=루트)는 `?lang → localStorage('hsrwarp-lang') → navigator.language → ko` 전체 체인, 그 외 언어 페이지는 `?lang`만. 대상 언어 ≠ 페이지 언어일 때만 `location.replace(base + path + hash)`.

- [ ] **Step 1: i18n.test.mjs에 리다이렉트 동작 테스트 추가 (failing test)**

`console.log('i18n.test.mjs OK')` 직전에 추가(`readFileSync`는 Task 2에서 이미 import됨):

```js
// --- 루트 자동 이동 인라인 스크립트: 소스에서 추출해 셤과 함께 실제 실행 ---
const htmlSrc = readFileSync(join(dir, 'index.html'), 'utf8');
const m = htmlSrc.match(/<script>\/\*lang-redirect\*\/([\s\S]*?)<\/script>/);
assert.ok(m, 'index.html 에 lang-redirect 인라인 스크립트 없음');
const scriptSrc = m[1].replace(/%BASE_URL%/g, '/hsr-warp/');

// 셤 주입 실행기: 리다이렉트가 일어나면 그 URL, 아니면 null 반환.
function runRedirect({ pageLang, search = '', saved = null, nav = '', hash = '', savedThrows = false }) {
  let redirected = null;
  const doc = { documentElement: { getAttribute: (a) => (a === 'lang' ? pageLang : null) } };
  const loc = { search, hash, replace: (u) => { redirected = u; } };
  const ls = { getItem: () => { if (savedThrows) throw new Error('denied'); return saved; } };
  const navi = { language: nav };
  new Function('document', 'location', 'localStorage', 'navigator', scriptSrc)(doc, loc, ls, navi);
  return redirected;
}

// 루트(ko): ?lang 최우선, 그다음 saved, 그다음 navigator, 전부 없으면 이동 없음
assert.strictEqual(runRedirect({ pageLang: 'ko', search: '?lang=en', hash: '#faq' }), '/hsr-warp/en/#faq');
assert.strictEqual(runRedirect({ pageLang: 'ko', search: '?lang=en', saved: 'ja' }), '/hsr-warp/en/');
assert.strictEqual(runRedirect({ pageLang: 'ko', saved: 'ja' }), '/hsr-warp/ja/');
assert.strictEqual(runRedirect({ pageLang: 'ko', nav: 'en-US' }), '/hsr-warp/en/');
assert.strictEqual(runRedirect({ pageLang: 'ko', nav: 'zh-CN' }), '/hsr-warp/zh/');
assert.strictEqual(runRedirect({ pageLang: 'ko', nav: 'fr' }), null);            // 미지원 → ko 폴백(이동 없음)
assert.strictEqual(runRedirect({ pageLang: 'ko', nav: 'ko-KR' }), null);
assert.strictEqual(runRedirect({ pageLang: 'ko', search: '?lang=ko', saved: 'en' }), null); // ?lang=ko 명시 → 유지
assert.strictEqual(runRedirect({ pageLang: 'ko', savedThrows: true, nav: 'ja' }), '/hsr-warp/ja/'); // localStorage 예외 무시
// 언어 페이지: 명시적 진입 존중 — saved/navigator 로는 이동하지 않음, ?lang 만 동작
assert.strictEqual(runRedirect({ pageLang: 'en', saved: 'ja', nav: 'ja' }), null);
assert.strictEqual(runRedirect({ pageLang: 'en', search: '?lang=ja' }), '/hsr-warp/ja/');
assert.strictEqual(runRedirect({ pageLang: 'zh-Hans', search: '?lang=zh' }), null); // zh-Hans 페이지 == zh 대상
```

Run: `node docs/site/i18n.test.mjs`
Expected: FAIL — `lang-redirect 인라인 스크립트 없음`

- [ ] **Step 2: index.html 수정**

`<head>` 안 `<link rel="icon">` 아래에 추가 (기존 title/description/lang="ko"는 유지 — ko 기본값이자 dev 표시값):

```html
<!--head-i18n-->
<script>/*lang-redirect*/(function () { try {
  var norm = function (s) { s = String(s || '').toLowerCase(); return s.indexOf('zh') === 0 ? 'zh' : s.indexOf('ja') === 0 ? 'ja' : s.indexOf('en') === 0 ? 'en' : s.indexOf('ko') === 0 ? 'ko' : ''; };
  var PATHS = { ko: '', en: 'en/', zh: 'zh/', ja: 'ja/' };
  var page = norm(document.documentElement.getAttribute('lang')) || 'ko';
  var target = norm(new URLSearchParams(location.search).get('lang'));
  if (!target && page === 'ko') { // 루트(ko)에서만 저장값·브라우저 언어로 자동 이동
    var saved = ''; try { saved = localStorage.getItem('hsrwarp-lang') || ''; } catch (e) {}
    target = norm(saved) || norm(navigator.language) || 'ko';
  }
  if (target && target !== page) location.replace('%BASE_URL%' + PATHS[target] + location.hash);
} catch (e) {} })()</script>
```

`%BASE_URL%`는 Vite의 HTML Env 치환으로 빌드·dev 서빙 시 `/hsr-warp/`로 바뀐다 — **설치된 vite 8.1.0 소스에서 확인됨**: `htmlEnvHook`이 `/%(\S+?)%/g`를 `config.env`로 치환하고(`node_modules/vite/dist/node/chunks/node.js:23845`), `config.env`에 `BASE_URL`이 포함된다(같은 파일 `:35337`). (Vite 공식 문서: https://vite.dev/guide/env-and-mode#html-constant-replacement)

- [ ] **Step 3: 통과 확인 + BASE_URL 치환 검증**

Run: `node docs/site/i18n.test.mjs`
Expected: `i18n.test.mjs OK`

Run: `cd docs/site && npm run build && grep -c "'/hsr-warp/'" dist/static/index.html`
Expected: 1 이상 — `%BASE_URL%`가 실제 치환됐는지 확인(소스 확인 완료지만 산출물로 재확인).

- [ ] **Step 4: Commit**

```bash
git add docs/site/index.html docs/site/i18n.test.mjs
git commit -m "feat(site): 루트 언어 자동 이동 인라인 스크립트 + 동작 테스트 (#46)"
```

---

### Task 7: prerender 4페이지 + head 치환 + hreflang

**Files:**
- Modify: `docs/site/prerender.mjs`
- Modify: `docs/site/copy.test.mjs` (wiring 불변식 확장)

**Interfaces:**
- Consumes: 서버 번들의 `render(lang)`/`LANGS`/`META`(Task 5), `<!--head-i18n-->` 플레이스홀더(Task 6).
- Produces: `dist/static/{,en/,zh/,ja/}index.html` — 각각 해당 언어 본문 + `<html lang>`·title·description·og·canonical·hreflang.

- [ ] **Step 1: copy.test.mjs에 prerender 불변식 추가 (failing test)**

기존 prerender wiring 검사 블록에 추가:

```js
assert.ok(/hreflang/.test(pre), 'prerender.mjs 에 hreflang 생성 없음');
assert.ok(/x-default/.test(pre), 'prerender.mjs 에 x-default hreflang 없음');
assert.ok(/og:locale/.test(pre), 'prerender.mjs 에 og:locale 주입 없음');
assert.ok(/LANGS/.test(pre), 'prerender.mjs 가 LANGS 를 순회하지 않음');
const idxSrc = readFileSync(join(dir, 'index.html'), 'utf8');
assert.ok(idxSrc.includes('<!--head-i18n-->'), 'index.html 에 head-i18n 플레이스홀더 없음');
```

Run: `node docs/site/copy.test.mjs`
Expected: FAIL — `hreflang 생성 없음`

- [ ] **Step 2: prerender.mjs 재작성**

```js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// SSG: 앱을 언어별로 렌더해 4개 HTML(/, /en/, /zh/, /ja/)을 생성한다.
// (Vite SSG 가이드 https://vite.dev/guide/ssr.html#pre-rendering-ssg)
const here = path.dirname(fileURLToPath(import.meta.url));
const abs = (p) => path.resolve(here, p);
const PLACEHOLDER = '<!--app-html-->';
const HEAD_I18N = '<!--head-i18n-->';
const ORIGIN = 'https://jkas2016.github.io';
const BASE = '/hsr-warp/';

// 필수 빌드 산출물을 읽되, 부재 시 어느 빌드 단계가 빠졌는지 문맥을 붙여 던진다(raw ENOENT 금지).
function readBuilt(rel, step) {
  try {
    return fs.readFileSync(abs(rel), 'utf-8');
  } catch (e) {
    if (e.code === 'ENOENT') throw new Error(`빌드 산출물 없음: ${rel} — '${step}' 를 먼저 실행했는지 확인하세요.`);
    throw e;
  }
}

const template = readBuilt('dist/static/index.html', 'vite build (client)');
if (!template.includes(PLACEHOLDER)) throw new Error(`템플릿에 ${PLACEHOLDER} 플레이스홀더가 없습니다 — index.html 을 확인하세요.`);
if (!template.includes(HEAD_I18N)) throw new Error(`템플릿에 ${HEAD_I18N} 플레이스홀더가 없습니다 — index.html 을 확인하세요.`);
if (!fs.existsSync(abs('dist/server/entry-server.js'))) throw new Error(`빌드 산출물 없음: dist/server/entry-server.js — 'vite build --ssr' 를 먼저 실행했는지 확인하세요.`);
const { render, LANGS, META } = await import(pathToFileURL(abs('dist/server/entry-server.js')).href);

// 모든 페이지가 4개 언어 전부 + x-default 를 상호 참조해야 hreflang 이 유효하다.
const alternates = LANGS
  .map((l) => `<link rel="alternate" hreflang="${l.html}" href="${ORIGIN}${BASE}${l.path}">`)
  .concat(`<link rel="alternate" hreflang="x-default" href="${ORIGIN}${BASE}">`)
  .join('\n');

for (const l of LANGS) {
  const meta = META[l.code];
  const url = ORIGIN + BASE + l.path;
  // 리플레이서를 함수로 — render() 결과의 $&/$1/$$ 가 치환 특수패턴으로 오해되지 않도록(리터럴 주입).
  let html = template.replace(PLACEHOLDER, () => render(l.code));
  html = html.replace('<html lang="ko"', `<html lang="${l.html}"`);
  html = html.replace(/<title>[^<]*<\/title>/, () => `<title>${meta.title}</title>`);
  html = html.replace(/(<meta name="description" content=")[^"]*(">)/, (_, a, b) => a + meta.description + b);
  html = html.replace(HEAD_I18N, () => [
    `<meta property="og:type" content="website">`,
    `<meta property="og:title" content="${meta.ogTitle}">`,
    `<meta property="og:description" content="${meta.ogDescription}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:locale" content="${l.ogLocale}">`,
    `<link rel="canonical" href="${url}">`,
    alternates,
  ].join('\n'));
  const out = abs('dist/static/' + l.path + 'index.html');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);
  console.log(`prerendered dist/static/${l.path}index.html`);
}

// 개발자 문서(문서 허브): 단일 소스 docs/architecture.html 을 게시 산출물로 복사 — repo 복제 없음.
fs.copyFileSync(abs('../architecture.html'), abs('dist/static/architecture.html'));

// 서버 번들은 빌드 산출물일 뿐 — 업로드 폴더를 깨끗하게.
fs.rmSync(abs('dist/server'), { recursive: true, force: true });
```

(템플릿은 루프 전에 메모리로 읽었으므로 ko가 `dist/static/index.html`을 덮어써도 안전.)

- [ ] **Step 3: 테스트·빌드·산출물 검증**

Run: `node docs/site/copy.test.mjs && node docs/site/i18n.test.mjs`
Expected: 둘 다 OK

Run: `cd docs/site && npm run build`
Expected: `prerendered dist/static/index.html` ~ `dist/static/ja/index.html` 4줄

Run (산출물 스팟체크):
```bash
grep -c 'hreflang' docs/site/dist/static/en/index.html        # 5 (4언어 + x-default)
grep '<html lang="zh-Hans"' docs/site/dist/static/zh/index.html
grep 'og:locale" content="ja_JP"' docs/site/dist/static/ja/index.html
grep -c 'Warp records' docs/site/dist/static/en/index.html    # 1 이상 (영어 본문)
grep '설치 마법사' docs/site/dist/static/index.html            # ko 본문 유지
```
Expected: 전부 매치

- [ ] **Step 4: Commit**

```bash
git add docs/site/prerender.mjs docs/site/copy.test.mjs
git commit -m "feat(site): 언어별 4페이지 프리렌더 + og·canonical·hreflang 주입 (#46)"
```

---

### Task 8: 지구본 드롭다운 전환 UI

**Files:**
- Create: `docs/site/src/pages/LangSwitcher.jsx`
- Modify: `docs/site/src/pages/GuidePage.jsx` (nav에 배치)
- Modify: `docs/site/src/pages/guide.css`

**Interfaces:**
- Consumes: `LANGS`(라벨·경로), `t.nav.lang`(aria-label), GuidePage의 `lang` prop.
- Produces: `LangSwitcher({ lang, label })` — details/summary 기반이라 JS 없이도 열리고 항목은 실제 `<a>`로 이동. 클릭 시 `localStorage('hsrwarp-lang')` 저장.

- [ ] **Step 1: LangSwitcher.jsx 작성**

```jsx
import { LANGS } from '../i18n/index.js';

// 지구본 드롭다운. details/summary 라 JS 없이도 동작하고, 항목은 실제 링크(언어 경로)다.
// 클릭 시 저장된 언어를 갱신해 루트(/) 재방문 시 자동 이동에 반영한다.
export function LangSwitcher({ lang, label }) {
  const base = import.meta.env.BASE_URL;
  const save = (code) => { try { localStorage.setItem('hsrwarp-lang', code); } catch (e) {} };
  return (
    <details className="lang-menu">
      <summary className="icon-btn" aria-label={label}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3a15.3 15.3 0 0 1 0 18M12 3a15.3 15.3 0 0 0 0 18" />
        </svg>
      </summary>
      <ul>
        {LANGS.map((l) => (
          <li key={l.code}>
            <a href={base + l.path} lang={l.html} aria-current={l.code === lang ? 'true' : undefined} onClick={() => save(l.code)}>
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}
```

- [ ] **Step 2: GuidePage nav에 배치**

`nav-right`에서 테마 토글 버튼 앞에 삽입:

```jsx
import { LangSwitcher } from './LangSwitcher.jsx';
// … nav-right 안 …
<LangSwitcher lang={lang} label={t.nav.lang} />
<button className="icon-btn theme-toggle" aria-label={t.nav.theme}>…</button>
```

- [ ] **Step 3: guide.css에 드롭다운 스타일 추가**

`.icon-btn` 블록(67~72행 부근) 아래에 추가. **토큰은 guide.css·`src/ds/styles.css`에 실재하는 것만 사용** — 아래 코드의 `--panel-2`·`--line`·`--line-2`·`--txt`·`--muted`·`--gold`·`--r-md`는 기존 사용처가 있고, 배경용 `--panel`은 styles.css에 없으면 `--panel-2`로 대체한다:

```css
/* 언어 드롭다운 */
.lang-menu{position:relative}
.lang-menu summary{list-style:none}
.lang-menu summary::-webkit-details-marker{display:none}
.lang-menu[open] summary{color:var(--txt);border-color:var(--line-2)}
.lang-menu ul{
  position:absolute;right:0;top:calc(100% + 8px);margin:0;padding:6px;list-style:none;z-index:60;
  min-width:132px;background:var(--panel-2);border:1px solid var(--line);border-radius:var(--r-md);
  box-shadow:0 12px 30px rgba(0,0,0,.28);
}
.lang-menu a{display:block;padding:8px 12px;border-radius:8px;font-size:13.5px;font-weight:600;color:var(--muted)}
.lang-menu a:hover{color:var(--txt)}
.lang-menu a[aria-current="true"]{color:var(--gold)}
```

- [ ] **Step 4: 테스트 + 브라우저 검증**

Run: `node docs/site/copy.test.mjs && node docs/site/i18n.test.mjs`
Expected: 둘 다 OK

Run: `cd docs/site && npm run build` 후 `npm run preview` (Browser pane preview 사용, `http://localhost:4173/hsr-warp/`)
- 지구본 클릭 → 드롭다운 4항목 표시, 現在 언어 골드 표시
- `日本語` 클릭 → `/hsr-warp/ja/` 이동, 전체 일본어 렌더
- 루트 `/hsr-warp/` 재접속 → 저장된 ja로 자동 이동 (localStorage 반영 확인)
- 라이트 테마 토글 후 드롭다운 대비 확인
Expected: 전부 정상. 스크린샷 캡처해 사용자에게 공유.

- [ ] **Step 5: Commit**

```bash
git add docs/site/src/pages/LangSwitcher.jsx docs/site/src/pages/GuidePage.jsx docs/site/src/pages/guide.css
git commit -m "feat(site): 지구본 언어 드롭다운 — 경로 이동 + localStorage 저장 (#46)"
```

---

### Task 9: 루트 테스트 배선 + 전체 검증 + CHANGELOG

**Files:**
- Modify: `package.json` (루트, test 체인)
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: 전체 태스크 산출물.
- Produces: `npm test` 원커맨드로 i18n 테스트까지 커버. 릴리스 노트 항목.

- [ ] **Step 1: 루트 package.json test 체인에 추가**

`"test"` 스크립트 끝의 `&& node docs/site/copy.test.mjs` 뒤에 `&& node docs/site/i18n.test.mjs` 추가.

- [ ] **Step 2: 전체 테스트**

Run: `npm test`
Expected: go + analyze + 대시보드 + copy + i18n 전부 통과

- [ ] **Step 3: CHANGELOG.md 갱신**

`## [Unreleased]` (없으면 신설) 아래에:

```markdown
### Added
- 가이드 사이트 다국어(en/zh/ja) 지원 — 언어별 프리렌더 4페이지(`/`, `/en/`, `/zh/`, `/ja/`), 루트 자동 언어 이동(?lang → localStorage → navigator → ko), 지구본 언어 전환 UI, 언어별 SEO 메타(og·hreflang) (#46)
```

- [ ] **Step 4: 최종 산출물 검증 (GitHub Pages 배포 대비)**

Run: `cd docs/site && npm run build && ls dist/static dist/static/en dist/static/zh dist/static/ja`
Expected: 4개 index.html + assets + architecture.html + png/svg. `dist/server` 없음.

- [ ] **Step 5: Commit**

```bash
git add package.json CHANGELOG.md
git commit -m "test(site)+docs(changelog): i18n 테스트 배선 + #46 변경 내역 (#46)"
```

---

## Self-Review 결과 반영 메모

- **배포 워크플로 무수정 확인**: `.github/workflows/pages.yml`은 `docs/site/dist/static` 디렉터리 전체를 업로드 — `/en/`·`/zh/`·`/ja/` 하위 index.html이 자동 포함되므로 CI 변경 불필요.

- 스펙 5.1의 "미지원 ?lang 무시"·"localStorage 예외 조용히 무시"는 Task 6 테스트 케이스(`nav:'fr'` → null, `savedThrows`)로 커버.
- 스펙 6-2 "ko 전용 마커는 ko만, 로케일 불변 문자열은 4개 언어 전부"는 Task 1(copy.test, ko)·Task 2(i18n.test, 전 언어 INVARIANT)로 분담.
- 스펙의 zh html lang은 `zh-Hans` — Task 6 리다이렉트 스크립트의 `norm()`이 `zh-hans`를 `zh`로 정규화하므로 zh 페이지에서 `?lang=zh`는 이동하지 않음(테스트 케이스 존재).
- 대시보드 `?lang=` 링크에서 가이드로 넘어오는 경로는 현재 없음 — 가이드 단독 규약으로 충분.
