# 대시보드 + 가이드 사이트 다국어(i18n) — ko/en/zh/ja

> 이슈: [#12](https://github.com/jkas2016/hsr-warp/issues/12) — [Feature] 대시보드 다국어(i18n) 지원 — en/zh/ja 추가
> 작성일: 2026-06-29

## 1. 목표

대시보드 UI와 가이드 사이트(`docs/site`)를 **한국어(ko, 기본) · 영어(en) · 중국어 간체(zh) · 일본어(ja)** 4개 언어로 제공한다. 사용자는 화면 셀렉터로 언어를 바꾸고, URL로 특정 언어를 공유할 수 있다.

**완료 기준**

- 4개 언어 전환으로 대시보드 전 화면 라벨/지표/배너명 + 가이드 본문 전체가 번역된다.
- 새로고침 후에도, URL 공유로 접속해도 선택 언어가 유지된다.
- 콘솔 JS 오류 없음.
- 기존 전체 테스트(`go test ./... && node web/analyze.test.js && node docs/site/copy.test.mjs`) + 신규 i18n 테스트 통과.

## 2. 범위

**1차 범위**

- 대시보드 13개 JSX 컴포넌트의 하드코딩 한국어 라벨 전부.
- 사용자에게 노출되지만 JSX 밖에 있는 표시 문자열: `analyze.js` 배너명, `data.js`의 `'현재'`·클라이언트 에러 메시지. (표시 계층에서 번역 — 분석 로직/데이터 원본은 불변)
- 가이드 사이트 `GuidePage.jsx`의 한국어 산문 전체(319줄).
- 양 사이트의 언어 셀렉터 UI + 선택 영속화.

**비범위(1차)**

- 서버 측 로그/Go 에러 메시지.
- `docs/architecture.html`(개발자 문서) — 한국어 유지.
- README/기타 문서 번역.

## 3. 깨면 안 되는 제약 (CLAUDE.md)

- **분석 단일 소스**: `analyze.js`의 분석 로직·데이터를 킷에서 재구현하지 않는다. 배너명 등 표시 문자열은 **표시 계층(컴포넌트)에서** 키 매핑으로 번역하고 `analyze.js` 자체는 건드리지 않는다.
- **`'전체'` sentinel**: `Dashboard.jsx` state와 `data.js` `scopeTo`의 `'전체'`는 **로직 비교값**이다. 내부 값은 그대로 유지하고 **표시 라벨만** 번역한다.
- **`go:embed all:web`**: 신규 `i18n/` 파일은 `web/` 하위라 자동 포함. 언더스코어 시작 파일이 아니므로 추가 조치 불필요.
- **ID 거대정수 규칙·비파괴 저장**: 본 작업은 표시 계층만 다루므로 영향 없음(회귀 없도록 분석/저장 코드 미수정).

## 4. 아키텍처 개요 — 두 서브시스템

두 사이트는 빌드 시스템이 다르므로 메커니즘을 분리하되, **게임 용어 대응표(§7)** 를 공유해 용어를 일치시킨다.

| | 대시보드 (`web/ui_kits/dashboard`) | 가이드 사이트 (`docs/site`) |
|---|---|---|
| 빌드 | 무빌드, Babel standalone, Go 런타임 서빙 | Vite SSG 프리렌더 → GitHub Pages |
| 콘텐츠 | UI 라벨·지표·배너명 | 산문 본문 |
| 언어 선택 | 헤더 셀렉터 + `?lang=` 쿼리 | 헤더 셀렉터(링크) + 경로 `/en/` `/zh/` `/ja/` |
| 반응성 | 클라이언트 `t()` + 최상위 재렌더 | 언어별 정적 페이지 프리렌더 |

언어 코드는 표준 ISO 639-1 사용: `ko` / `en` / `zh` / `ja` (한국어는 `kr`이 아닌 `ko`).

## 5. 대시보드 설계 (접근 A — 전역 `t()` + 최상위 lang 상태)

### 5.1 신규 파일

- `web/ui_kits/dashboard/i18n/ko.js`, `en.js`, `zh.js`, `ja.js` — 키-값 사전. 각 파일이 `window.I18N_DICTS = window.I18N_DICTS || {}; window.I18N_DICTS.ko = { ... }` 형태로 전역 등록(무빌드 유지).
- `web/ui_kits/dashboard/i18n.js` — `window.I18N = { lang, t(key, vars), setLang(l) }` 정의.
  - `t(key, vars)`: `dicts[lang][key]` 조회, `{name}` 형태 보간. 누락 키는 `ko` 폴백 후 키 문자열 반환.
  - 언어 결정 순서: `?lang=` 쿼리 → localStorage `hsrwarp-lang` → `navigator.language` 매핑(`zh-*`→`zh`, `ja`→`ja`, `en-*`→`en`, 그 외 `ko`) → `ko`.

### 5.2 `index.html`

- `<script>` 추가: `i18n/ko.js` … `i18n/ja.js`, `i18n.js`를 `data.js`/`util.js` 뒤·컴포넌트 `*.jsx` 앞에 로드.
- 초기 `<html lang>`은 인라인 스크립트(테마 선반영과 같은 위치)에서 결정 언어로 설정해 플래시 방지.

### 5.3 `Dashboard.jsx`

- `lang` state 추가(초기값 = `window.I18N.lang`).
- 언어 변경 시: `window.I18N.setLang(l)` → `?lang=` URL 반영(`history.replaceState`) → localStorage 저장 → `<html lang>` 갱신 → `setLang` state로 트리 전체 재렌더(모든 `t()` 재평가).
- 헤더 `ThemeToggle` 옆에 **언어 셀렉터** 추가(DS `Select` 재사용, ko/en/zh/ja).
- 날짜/시간: `toLocaleTimeString('ko-KR', …)` → 현재 lang에 맞는 로케일(`ko-KR`/`en-US`/`zh-CN`/`ja-JP`)로.

### 5.4 컴포넌트 13개

하드코딩 한국어 → `t('key')` 치환. prop drilling/Context 없음(전역 `t` + 최상위 재렌더).

- 표시 계층 배너명: 컴포넌트에서 배너 `type`/`kind`/`pool` 키 기반 `t('banner.char')` 등으로 매핑. `analyze.js`는 미수정 — `name` 필드는 데이터로 남되 표시에는 더 이상 사용하지 않는다(컴포넌트가 키 매핑으로 직접 번역).
- `data.js`: `period`의 `'현재'`, 클라이언트 에러 메시지(`'서버 연결 실패'`, `'조회 실패'`, `'응답 처리에 실패했습니다.'`)를 `t()`로. (data.js는 표시 계층이므로 수정 허용)

## 6. 가이드 사이트 설계 (언어별 프리렌더)

### 6.1 콘텐츠 분리

- `docs/site/src/i18n/{ko,en,zh,ja}.js` — `GuidePage.jsx`의 산문을 키-값(또는 구조화 객체)으로 분리. ESM `export default { ... }`.
- `GuidePage`는 `t`(또는 해당 lang 사전)를 prop/인자로 받아 렌더. SSG라 런타임 전역 불가 → lang을 렌더 인자로 주입.

### 6.2 빌드/프리렌더

- `entry-server.jsx`: `render(lang)` 시그니처. `App`/`GuidePage`에 lang 전달.
- `prerender.mjs`: `['ko','en','zh','ja']` 루프 →
  - `ko` → `dist/static/index.html`(루트)
  - `en`/`zh`/`ja` → `dist/static/{lang}/index.html`
  - 각 페이지: `<html lang>` 설정, 언어별 `<title>`·`<meta description>`, `<link rel="alternate" hreflang>` 4종 + `x-default`.
- `entry-client.jsx`: 하이드레이션 시 `location.pathname`에서 lang 판별(`/en/`→en …, 그 외 ko) 후 동일 lang으로 하이드레이트(마크업 불일치 방지).
- Vite `base`/상대경로 자산이 `/en/` 하위에서도 정상 로드되는지 확인(필요 시 `base` 조정).

### 6.3 언어 셀렉터 + 리다이렉트

- 헤더에 KO/EN/ZH/JA 실제 `<a href>` 링크(`/`, `/en/`, `/zh/`, `/ja/`).
- 선택 시 localStorage `hsrwarp-lang` 저장.
- **루트 클라이언트 리다이렉트**: 루트(`/`) 방문 시 localStorage에 저장 언어가 있고 ko가 아니면 해당 경로로 1회 `location.replace`. 저장값 없으면 ko 유지(정적 canonical 보존). 무한 리다이렉트 방지 가드 포함.

## 7. 게임 용어 대응표 (단일 진실)

양 사이트 사전은 아래 표를 출처로 작성한다. en은 이슈 매핑, zh/ja는 웹 조사(인게임 공식 표기·통용 위키 교차 확인).

| ko | en | zh (간체) | ja |
|----|----|-----------|-----|
| 워프 | Warp | 跃迁 | 跳躍 |
| 픽업/확률업 | rate-up | 概率UP / 限定 | ピックアップ (PU) |
| 천장(90뽑 확정) | hard pity | 硬保底 | 天井 (UI: 獲得確定) |
| 50/50(반천장) | 50-50 | 小保底 | 50/50（確率50%） |
| 픽뚫(짐) | lose 50-50 | 歪了 | すり抜け |
| 픽승(이김) | win 50-50 | 没歪 / 直接出 | すり抜けなし |
| 확정(픽뚫 다음) | guaranteed | 大保底 | PU確定 |
| 광추 | Light Cone | 光锥 | 光円錐 |
| 캐릭터 이벤트 워프 | Character Event Warp | 角色活动跃迁 | イベント跳躍・キャラクター |
| 광추 이벤트 워프 | Light Cone Event Warp | 光锥活动跃迁 | イベント跳躍・光円錐 |
| 스텔라/상시 워프 | Stellar Warp | 群星跃迁 | 群星跳躍 |
| 출발 워프(초보자) | Departure Warp | 始发跃迁 | 始発跳躍 |
| 성옥 | Stellar Jade | 星琼 | 星玉 |
| 평균 뽑기 수 | average pulls | 平均抽数 | 平均回数 |

**주의 — 단일 정식어 없는 항목(서술형 채택)**: 일본어 50/50·픽승은 굳어진 명사가 없어 서술형(`確率50%`, `すり抜けなし`)으로 처리. 중국어 천장은 硬保底(90확정)/小保底(50-50)/大保底(픽뚫 후 확정) 3단계 구분 준수.

**출처**

- zh: [biligame 跃迁](https://wiki.biligame.com/sr/%E8%B7%83%E8%BF%81), [萌娘百科 跃迁](https://zh.moegirl.org.cn/崩坏：星穹铁道/跃迁)
- ja: [wikiwiki 跳躍](https://wikiwiki.jp/star-rail/%E8%B7%B3%E8%BA%8D), [game8.jp 천장 해설](https://game8.jp/houkaistarrail/654379), [rpgneo すり抜け](https://rpgneo.com/starrail-pickup/)

## 8. 테스트 (TDD — 테스트 먼저)

- **대시보드 키 정합성 테스트**(신규): ko/en/zh/ja 4개 사전이 동일 키 집합인지 검증(누락/잉여 탐지).
- **대시보드 `t()` 단위 테스트**(신규): 보간(`{var}`)·누락 키 폴백·lang 결정 순서(`?lang` > localStorage > navigator > ko).
- **사이트 키 정합성 테스트**(신규): `src/i18n/*` 4개 사전 동일 키 집합.
- **`docs/site/copy.test.mjs` 확장**: 프리렌더가 `dist/static/{en,zh,ja}/index.html`을 실제 생성하는지 + 각 `<html lang>`이 올바른지.
- 기존 전체 테스트 회귀 없음.

테스트 러너: 대시보드 JS 테스트는 기존 `web/analyze.test.js`와 같은 node 기반, 사이트는 `docs/site/*.test.mjs` 패턴 따름.

## 9. 작업 단위

단일 작업 → 단일 PR(이슈 #12). 단계별 분할하지 않는다. 구현 순서(플랜에서 상세화):

1. 게임 용어 대응표 확정(본 스펙 §7).
2. 대시보드 i18n 인프라(`i18n.js` + 사전 + 테스트) → 컴포넌트 치환 → 셀렉터/URL/날짜.
3. 사이트 i18n(콘텐츠 분리 + 사전 + 프리렌더 확장 + 셀렉터/리다이렉트 + 테스트).
4. 전체 테스트 통과 + 수동 4언어 검증.
