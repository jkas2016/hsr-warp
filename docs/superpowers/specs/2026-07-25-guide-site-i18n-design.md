# 가이드 사이트(docs/site) 다국어(i18n) — 언어별 4페이지 SSG

> 이슈: [#46](https://github.com/jkas2016/hsr-warp/issues/46) — [Feature] 가이드 페이지(docs/site) 다국어(i18n) 지원 — en/zh/ja 추가
> 작성일: 2026-07-25
> 선행: [2026-06-29 대시보드+가이드 i18n 설계](2026-06-29-dashboard-guide-i18n-design.md) — 대시보드 부분(#12)만 구현·머지됨. 본 문서는 가이드 사이트 부분을 SSG(4페이지 프리렌더) 방식으로 재설계해 대체한다.

## 1. 목표

가이드 사이트(GitHub Pages, `https://jkas2016.github.io/hsr-warp/`)를 **ko(기본)·en·zh(간체)·ja** 4개 언어로 제공한다. 크롤러(구글 검색·SNS 미리보기)는 JS를 실행하지 않으므로, **언어별 프리렌더 HTML**을 빌드 산출물로 생성해 SEO·og 미리보기까지 언어별로 동작하게 한다.

**완료 기준 (이슈 AC + 본 설계)**

- `/`, `/en/`, `/zh/`, `/ja/` 각 경로에서 전체 페이지가 해당 언어로 렌더된다(프리렌더 HTML 자체가 번역됨).
- `?lang=en|zh|ja|ko` 접속 시 해당 언어 경로로 이동해 렌더된다.
- 언어 전환 후 재방문(루트 접속) 시 localStorage로 선택 언어 유지.
- 미지원/미지정 언어는 navigator → ko 폴백 (루트에서만 자동 이동).
- 각 산출물에 `<html lang>`·`title`·`description`·`og:*`·`hreflang` alternate가 해당 언어로 반영된다.
- `npm test`(docs/site copy 테스트 포함) 통과, GitHub Pages 배포 산출물에서 정상 동작.

## 2. 범위

**범위**

- `GuidePage.jsx` 하드코딩 문구 전부 → 언어별 JSX 사전 모듈로 분리.
- en/zh/ja 번역 작성 (용어는 공식 HoYoverse 로컬라이제이션 + 대시보드 `web/ui_kits/dashboard/i18n/{en,zh,ja}.js` 기준으로 통일 — 예: 전언/Warp/跃迁/跳躍, 광추/Light Cone).
- 언어별 4페이지 프리렌더(`prerender.mjs` 확장) + head 메타 언어별 반영.
- 루트 자동 이동 인라인 스크립트 + 지구본 드롭다운 전환 UI.
- `copy.test.mjs` 다국어 대응(기존 불변식 유지 + 신규 불변식).

**비범위 (이슈 Non-goal 그대로)**

- 대시보드 i18n 구조 변경 (가이드는 사전 포맷만 자체 정의, 결정 순서 규약만 공유).
- 스크린샷 자산(`public/*.png`) 언어별 재촬영 — 한국어 화면 재사용, 캡션·alt만 번역.
- 4개 언어 외 추가 언어.
- `architecture.html`(개발자 문서) — ko 단일 유지.

## 3. 아키텍처: 언어별 4페이지 프리렌더

### 3.1 산출물 구조

```
dist/static/index.html      ← ko (루트, 기존 위치 유지)
dist/static/en/index.html
dist/static/zh/index.html
dist/static/ja/index.html
dist/static/architecture.html  ← 기존대로 ko 단일 복사
dist/static/assets/…           ← 공유 (base '/hsr-warp/' 절대 경로라 하위 경로에서도 동작)
```

- `vite.config.mjs`의 `base: '/hsr-warp/'` 덕에 자산·에셋 참조는 절대 경로 — `/en/` 깊이에서도 추가 조치 없이 해석된다.
- GitHub Pages는 디렉터리 `index.html`을 그대로 서빙하므로 라우팅 설정 불필요.

### 3.2 빌드 흐름 (`prerender.mjs` 확장)

1. `dist/static/index.html`(vite client 빌드 산출물, ko 기본값 포함)을 템플릿으로 읽는다.
2. 언어 4개를 루프:
   - `render(lang)` (entry-server 확장) 결과를 `<!--app-html-->`에 주입.
   - `<html lang>` 값을 언어별로 치환 (ko/en/`zh-Hans`/ja).
   - `<title>`·`<meta name="description">`을 사전의 `meta` 섹션 값으로 치환.
   - `og:title`·`og:description`·`og:type`·`og:url`·`og:locale`(ko_KR/en_US/zh_CN/ja_JP) 주입.
   - 4개 언어 상호 `<link rel="alternate" hreflang>` + `x-default`(ko) 주입.
   - 인라인 리다이렉트 스크립트에 페이지 언어 상수를 스탬프.
   - `lang === 'ko'`면 `dist/static/index.html`에 덮어쓰고, 아니면 `dist/static/<lang>/index.html`로 기록.
3. `architecture.html` 복사·`dist/server` 정리는 기존대로.
4. 에러 처리는 기존 패턴 유지 — 산출물 부재 시 어느 빌드 단계가 빠졌는지 문맥 포함 throw.

head 치환은 템플릿의 ko 기본값을 마커(정규식 또는 주석 플레이스홀더)로 찾아 바꾼다. vite 빌드가 index.html을 변환(해시 자산 주입)한 뒤의 산출물을 템플릿으로 쓰므로 충돌 없음.

## 4. 번역 사전 — 언어별 JSX 모듈

```
docs/site/src/i18n/
  ko.jsx  en.jsx  zh.jsx  ja.jsx  ← 동일 키 구조 객체 export (문자열 + JSX 조각)
  index.js                        ← LANGS 메타(코드, 자국어 표기, html lang, og:locale, 경로), DICTS 맵
```

- 값은 문자열 또는 JSX 조각 — `<b>`·`<code>`·링크 섞인 리치 텍스트를 그대로 표현, `dangerouslySetInnerHTML` 불필요.
- `GuidePage.jsx`는 `dict` prop을 받아 문구만 소비 — 마크업 구조(섹션·글래스 카드·SVG)는 GuidePage 단일 소스 유지. features/steps/metrics/trouble/faq처럼 반복 블록은 사전에서 배열로 표현하고 GuidePage가 map.
- head용 `meta` 섹션(title, description, ogTitle, ogDescription)도 사전에 포함 — `entry-server.jsx`가 `render(lang)`과 함께 `META`(언어→meta 맵)를 export하고, prerender는 서버 번들(`dist/server/entry-server.js`)에서 이를 import해 head 치환에 사용한다.
- 스크린샷 캡션·`alt`도 사전 키로 — 이미지 파일 자체는 공유.

## 5. 언어 결정·전환 동작

### 5.1 결정 순서 (대시보드 규약과 일치)

`?lang=` → `localStorage('hsrwarp-lang')` → `navigator.language` → ko.

- **루트(/)**: head 인라인 스크립트(페인트 전, ~15줄, 전체 try/catch)가 위 순서로 판정, 결과가 ko가 아니면 해당 언어 경로로 `location.replace` (해시 보존). 크롤러는 JS 미실행이라 ko HTML + hreflang을 그대로 본다.
- **언어 경로(/en/ 등)**: 명시적 진입 존중 — localStorage/navigator로는 자동 이동하지 않는다. 단 `?lang=`이 붙어 있고 페이지 언어와 다르면 그 언어 경로로 이동(앱 링크 호환).
- 미지원 `?lang=` 값·localStorage 예외는 조용히 무시(현재 페이지 유지).
- localStorage 저장은 **전환 UI 클릭 시에만** — `?lang=` 링크나 경로 직접 진입은 사용자 선호를 덮어쓰지 않는다.

### 5.2 전환 UI

- 네비 테마 토글 옆 **지구본 아이콘 버튼 + 드롭다운**(한국어 / English / 简体中文 / 日本語).
- 항목은 실제 `<a href>`(BASE_URL 기준 언어 경로) — JS 없이도 이동 동작. 클릭 시 localStorage 저장.
- 현재 언어 항목은 시각적으로 표시. 기존 `icon-btn` 디자인 언어와 통일.

### 5.3 하이드레이션·dev 모드

- `entry-client.jsx`: URL 경로(BASE_URL 이후 첫 세그먼트)에서 언어를 읽어 같은 언어 dict로 하이드레이션 — SSR/CSR 불일치 없음.
- vite dev(언어 경로 없음): 프리렌더가 없어 전부 클라이언트 렌더 — `?lang=`으로 언어 확인 가능.

## 6. 테스트 — `copy.test.mjs` 확장 (소스레벨, 빌드 불필요 원칙 유지)

1. **키 구조 동등성**: 4개 사전의 키 집합(중첩·배열 길이 포함)이 완전히 일치 — 번역 누락·drift를 차단. JSX 모듈은 plain node로 import할 수 없으므로 **esbuild(`docs/site`의 vite 의존으로 이미 존재)로 transform 후 로드**해 실제 객체 구조를 비교한다 — 정규식 소스 파싱 금지(false-pass 위험, #24 교훈).
2. **카피 불변식**: 로케일 불변 기술 문자열(`설치 마법사`류는 ko만, `hsr-warp-setup-`·`/ui_kits/dashboard/`·`%LOCALAPPDATA%`·`schedule.json`은 **4개 언어 전부**) 존재, stale 마커 부재는 기존대로.
3. **에셋·링크**: `asset()`/`BASE_URL` 참조 파일 존재 검사를 GuidePage + 사전 파일로 확대. `architecture.html` href 불변식 유지.
4. **prerender 정합**: 4개 언어 출력 wiring(en/zh/ja 경로 기록), hreflang 생성 코드, architecture.html 복사 단계 존재.
5. **인라인 리다이렉트 스크립트**: 스크립트 소스를 `new Function`으로 location/localStorage/navigator 셤(shim)과 함께 실행해 결정 순서(?lang → saved → navigator → ko)·루트 한정 자동 이동·해시 보존을 실제 실행으로 검증.

루트 `package.json`의 `test`는 이미 `docs/site/copy.test.mjs`를 포함 — 테스트 파일을 분리 신설하면 그 파일만 체인에 추가.

## 7. 리스크·주의

- **`go:embed` 무관**: `docs/site`는 exe에 임베드되지 않음(가이드는 Pages 전용) — Go 빌드 영향 없음.
- **hreflang 규약**: 상호 참조 필수(모든 페이지가 4개 전부 + x-default 나열). 누락 시 구글이 무시하므로 테스트 4번으로 가드.
- **번역 품질**: 게임 용어는 대시보드 사전·공식 로컬라이제이션 대조. 그 외 산문은 구현 PR 리뷰에서 확인.
- **루트 자동 이동과 SEO**: 구글은 Accept-Language 자동 리다이렉트를 권장하지 않으나, 본 설계는 JS 리다이렉트(크롤러 미실행) + hreflang 병행이라 크롤러에는 영향 없음.
