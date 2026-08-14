# 공유하기 — 대시보드 섹션 선택 PNG 내보내기

> 이슈: [#50](https://github.com/jkas2016/hsr-warp/issues/50) — [Feature] 공유하기 — 대시보드 섹션 선택 PNG 내보내기
> 작성일: 2026-08-14
> 관련: #47 (운 공유·글로벌 랭킹 — 서버 경유 데이터 공유, 본 이슈와 별건)

## 1. 목표

대시보드에서 보고 있는 워프 전적을 **원하는 섹션만 골라 PNG 한 장**으로 내보낸다. 렌더링·합성·저장은 전부 브라우저 로컬에서 처리하며 **서버로 올라가는 것은 없다** — 프로젝트의 "기록을 외부로 전송하지 않는다" 원칙 그대로다.

**완료 기준 (이슈 AC)**

- 섹션 2개 이상을 체크하고 내보내면 선택한 섹션만 순서대로 담긴 PNG 1장이 저장된다.
- 아무 섹션도 선택하지 않으면 내보내기 버튼이 비활성화된다.
- 마스킹 ON 상태의 PNG에 UID가 보이지 않고, 원본 화면의 UID는 그대로 남아 있다.
- 차트 섹션을 포함해 내보낸 PNG에서 차트가 빈 영역이 아니라 실제로 그려져 있다.
- 모바일 브라우저(폭 400px 이하)에서 내보낸 PNG가 데스크톱과 동일한 고정 폭 레이아웃으로 나온다.
- iOS Safari·Android Chrome 실기기에서 파일 저장이 성공한다 (실패 시 §7 폴백).
- `npm test` 전체 통과 (`cdn-sri` / `nohardcode` / `i18n` / `lang-reactivity` 포함).

## 2. 범위

**범위**

- 헤더 `RefreshBar` 버튼 그룹에 **공유** 버튼 → `ShareModal` 오픈.
- 모달: 섹션 체크박스 다중 선택 + UID 마스킹 토글(기본 ON) + 내보내기.
- 오프스크린 고정 폭(720px) 합성 → PNG blob → 다운로드.
- Chart.js `<canvas>` → `toBase64Image()` `<img>` 치환.
- `modern-screenshot` CDN + SRI 추가.
- i18n 문구 ko/en/zh/ja.
- 유닛 테스트 + 기존 가드 테스트 통과.

**비범위 (이슈 Non-goal 그대로)**

- 클립보드 복사, `navigator.share(files)` 네이티브 공유 시트 — 후속 이슈.
- 서버 업로드·공유 링크·글로벌 랭킹 — #47.
- 전용 공유 카드 디자인(프리셋 레이아웃) — 기존 섹션 외형을 그대로 캡처한다.
- PDF·SVG 등 PNG 외 포맷.

## 3. 이슈 본문에 없던 설계 결정 4가지

조사 과정에서 이슈 본문의 전제와 실제 코드가 어긋나는 지점이 나왔다. 다음 4개는 본 문서에서 확정한다.

### 3.1 공유 범위 = 현재 탭 섹션만

대시보드는 탭 구조(`overview`/`banners`/`history`/`versions`)이고 `Dashboard.jsx:144-149`가 **활성 탭 하나만 DOM에 렌더**한다. 따라서 "선택 섹션의 DOM을 클론한다"는 전제는 현재 탭 밖 섹션에 성립하지 않는다.

**결정: 모달을 연 시점의 활성 탭에 실재하는 섹션만 체크박스로 노출한다.** 다른 탭 내용을 원하면 탭을 옮겨 다시 공유한다.

비활성 탭을 오프스크린에 임시 마운트하는 대안은 기각했다 — Chart.js 인스턴스 재생성, 렌더 완료 타이밍, `ChartsGrid.jsx:52`의 `[theme, lang]` deps 문제가 겹쳐 실패 위험이 크고 얻는 값이 작다.

### 3.2 캡처 라이브러리 = `modern-screenshot@4.7.0`

| 후보 | UMD 크기 | 판정 |
|---|---|---|
| `modern-screenshot@4.7.0` | 29 KB | **채택** |
| `html-to-image@1.11.13` | 20 KB | 기각 — 유지보수 정체, iOS Safari 첫 캡처 빈 이미지·폰트 누락 이슈 |
| `html2canvas@1.4.1` | 194 KB | 기각 — CSS를 자체 재구현하므로 CSS 변수 기반 DS 킷과 상성이 나쁘고 6배 무겁다 |

`modern-screenshot`은 `html-to-image`의 유지보수 포크로 동일한 SVG `foreignObject` 방식이라 **CSS 변수·`data-theme`가 그대로 살아남는다**. CDN UMD(`dist/index.js`)가 있어 SRI 적용이 가능하다.

> 주의: jsDelivr가 자동 생성하는 `.min.js`는 동적 생성 파일이라 SRI에 부적합하다(jsDelivr 자체 경고). npm 원본 `dist/index.js`를 참조한다.

### 3.3 PNG 상단에 헤더를 붙인다

UID는 `Dashboard.jsx:88`의 헤더 서브타이틀에만 렌더된다. 섹션만 캡처하면 UID가 애초에 결과물에 없어 **마스킹 토글이 무의미해지고 이슈 AC 하나가 검증 불가능**해진다.

**결정: 대시보드 헤더(로고 + 타이틀 + `UID xxx` 서브타이틀)를 항상 결과물 맨 위에 클론해 쌓는다.** 마스킹 ON이면 클론 트리에서만 UID를 치환한다. 공유받는 쪽도 무슨 화면인지 알 수 있다.

### 3.4 라이브러리는 정적 로드 (지연 로드 안 함)

이슈 리스크 표의 "공유 모달 열 때 지연 로드" 안은 채택하지 않는다. 29KB는 무시할 만하고, 동적 로드는 `cdn-sri.test.js`가 `index.html` 정적 태그만 검사하므로 **공급망 가드를 우회**하게 된다. 규약 준수를 우선한다.

## 4. 아키텍처

### 4.1 파일 구성 — 로직/렌더 분리

테스트 환경이 jsdom 없이 `node` + `assert`뿐이고 `.jsx`는 브라우저 `@babel/standalone` 전용이라 **require가 불가능**하다(`nohardcode.test.js`·`lang-reactivity.test.js`도 `.jsx`를 정규식 정적 검사만 한다). 따라서 검증 가능한 로직은 전부 plain `.js`로 뺀다 — 기존 `util.js` 패턴 그대로.

| 파일 | 성격 | 내용 |
|---|---|---|
| `web/ui_kits/dashboard/share.js` | 신규, `window.WarpShare` | 섹션 레지스트리, `maskUidIn`, `shareFileName`, `selectSections`, 합성·캡처 DOM 함수 |
| `web/ui_kits/dashboard/ShareModal.jsx` | 신규, DS `Dialog` | 체크박스 목록 + 마스킹 토글 + 내보내기 + 폴백 미리보기 |
| `web/ui_kits/dashboard/share.test.js` | 신규 | 순수 로직 검증 (`node` + `assert`) |
| `web/ui_kits/dashboard/index.html` | 수정 | `modern-screenshot` CDN+SRI, `share.js`·`ShareModal.jsx` 로드 |
| `web/ui_kits/dashboard/Dashboard.jsx` | 수정 | `share` 모달 상태, `<ShareModal>` 상시 마운트 |
| `web/ui_kits/dashboard/RefreshBar.jsx` | 수정 | 공유 버튼 (`RefreshBar.jsx:43-46` 버튼 그룹) |
| 각 섹션 `.jsx` | 수정 | `data-share="<id>"` 마커 부여 |
| `web/ui_kits/dashboard/i18n/{ko,en,zh,ja}.js` | 수정 | `share.*` 키 |
| `web/ui_kits/dashboard/nohardcode.test.js` | 수정 | FILES에 `ShareModal.jsx` 추가 |
| `package.json` | 수정 | test 체인에 `share.test.js` 추가 |

DOM을 만지는 함수도 `share.js`에 두지만, jsdom이 없으므로 **테스트는 순수 로직에만 건다**. DOM 경로의 검증은 §7의 수동 검증에 의존한다 — 이 한계를 숨기지 않는다.

### 4.2 섹션 식별 — `data-share` 속성

현재 대시보드 DOM에는 **id도 `data-*`도 없다**(유일한 예외는 `document.documentElement`의 `data-theme`). 클래스나 `<section>` 순서에 의존하면 리팩터링에 쉽게 깨지므로, 각 섹션 래퍼에 명시적 마커를 붙인다.

```jsx
<section data-share="hero"> ... </section>
```

`share.js`의 레지스트리는 **id → 라벨 키 매핑만** 담는다:

```js
const SECTIONS = [
  // overview 탭
  { id: 'hero',      labelKey: 'share.section.hero' },
  { id: 'banners',   labelKey: 'share.section.banners' },
  { id: 'charts',    labelKey: 'share.section.charts' },
  { id: 'monthly',   labelKey: 'share.section.monthly' },
  { id: 'recent',    labelKey: 'share.section.recent' },
  // banners 탭
  { id: 'banner-status', labelKey: 'share.section.bannerStatus' },
  { id: 'banner-pity',   labelKey: 'share.section.bannerPity' },
  { id: 'banner-fives',  labelKey: 'share.section.bannerFives' },
  // history 탭
  { id: 'history',   labelKey: 'share.section.history' },
  // versions 탭
  { id: 'versions',      labelKey: 'share.section.versions' },
  { id: 'version-pity',  labelKey: 'share.section.versionPity' },
];
```

이 목록이 전부다. 각 id는 해당 `.jsx`의 섹션 래퍼에 `data-share`로 1:1 대응한다.

**존재 여부와 순서는 DOM이 진실이다.** 모달은 `document.querySelectorAll('[data-share]')`로 지금 화면에 실재하는 섹션만 DOM 순서대로 노출한다. 탭이 바뀌면 목록도 자연히 따라간다. 레지스트리에 있으나 DOM에 없는 섹션은 조용히 빠진다.

### 4.3 합성 파이프라인

```
[내보내기 클릭]
  1. 오프스크린 컨테이너 생성
     position:fixed; left:-99999px; top:0; width:720px; className="page"
     → document.body에 append (:root CSS 변수·data-theme 그대로 상속)
  2. 헤더 클론 → append
  3. 선택 섹션을 DOM 순서대로 클론 → append
  4. canvas 치환: 원본 canvas마다 Chart.getChart(el).toBase64Image()
                  → 클론 쪽 대응 canvas를 같은 w/h의 <img>로 교체
  5. 마스킹 ON이면 클론 트리 텍스트 노드에서 UID 치환 (원본 DOM 무손상)
  6. await document.fonts.ready
  7. modernScreenshot.domToBlob(container, { width:720, scale:2, backgroundColor:<--bg 실측값> })
  8. finally: 컨테이너 제거
  9. 저장 (§7)
```

**고정 폭 720px**이 "모바일에서도 데스크톱과 동일한 결과물" AC를 담보한다. 화면 폭·스크롤 위치와 무관하다.

**Chart 인스턴스 접근:** `ChartsGrid.jsx:22`는 차트 인스턴스를 `useEffect` 로컬 배열에만 담고 외부에 노출하지 않는다. 그러나 Chart.js 4의 정적 메서드 **`Chart.getChart(canvasEl)`**로 DOM canvas에서 인스턴스를 역참조할 수 있고 `window.Chart`는 UMD로 이미 전역에 있다(`index.html:73`). 따라서 **`ChartsGrid`·`BannerPityChart`·`VersionPityChart`를 전혀 수정하지 않고** 캡처가 가능하다. 전역 차트 레지스트리를 새로 만드는 안은 불필요하므로 기각.

**배경색:** `foreignObject` 캡처는 투명 배경을 그대로 남기므로 `getComputedStyle(document.body).backgroundColor`를 읽어 명시적으로 넘긴다. 다크/라이트 모두 올바른 바탕을 얻는다.

### 4.4 마스킹

순수 문자열 함수와 DOM 래퍼를 분리한다 — 앞의 것만 jsdom 없이 테스트할 수 있기 때문이다.

```js
// share.js
function maskUid(text, uid) { ... }     // 순수: 문자열에서 uid → '•'.repeat(uid.length). 테스트 대상
function maskUidIn(root, uid) { ... }   // DOM 래퍼: TreeWalker로 텍스트 노드를 순회하며 maskUid 적용
```

**원본 DOM은 절대 건드리지 않는다** — 클론 트리에만 적용하므로 "원본 화면의 UID는 그대로 남아 있다" AC가 구조적으로 보장된다. `TreeWalker`로 텍스트 노드만 순회한다.

### 4.5 i18n

`share.*` 키를 ko/en/zh/ja **4개 파일에 동일 세트**로 추가한다(`i18n.test.js`가 ko 기준 `deepStrictEqual`로 강제).

`ShareModal.jsx`는 `lang`을 **prop으로** 받는다 — `lang-reactivity.test.js`가 `.jsx`에서 `window.I18N.lang` 직접 참조를 금지하기 때문이다(예외는 `useState(() => window.I18N.lang)` 단 하나). 문구는 `const t = window.I18N.t;` 로컬 별칭으로 꺼낸다(`RefreshBar.jsx:6` 관례).

키 목록(초안):

```
share.button          공유
share.title           공유 이미지 만들기
share.sections        포함할 섹션
share.maskUid         UID 가리기
share.export          PNG 내보내기
share.exporting       만드는 중…
share.failed          이미지를 만들지 못했습니다
share.saveHint        이미지를 길게 눌러 저장하세요
share.section.*       §4.2 레지스트리의 11개 섹션 라벨
```

섹션 라벨 키는 §4.2 `SECTIONS`의 `labelKey`와 정확히 같은 집합이어야 한다.

### 4.6 CDN + SRI

`index.html`의 기존 형식(한 줄 `<script>`, `sha384-`, `crossorigin`, 정확 3자리 semver)을 그대로 따른다:

```html
<script src="https://cdn.jsdelivr.net/npm/modern-screenshot@4.7.0/dist/index.js" integrity="sha384-..." crossorigin="anonymous"></script>
```

SRI 해시는 구현 시 실제 파일에서 산출한다(추측 금지). 전역 이름은 UMD가 노출하는 `window.modernScreenshot`.

## 5. 파일명

```
hsr-warp-<YYYYMMDD>-<HHmm>.png     예: hsr-warp-20260814-1530.png
```

로컬 시각 기준. `shareFileName(date)`로 순수 함수화해 테스트한다.

## 6. 테스트 계획

**먼저 `share.test.js`를 작성한 뒤 `share.js`를 구현한다.**

`share.test.js` (`node` + `assert`, 기존 `util.test.js` 관례 — `global.window = global` 후 `require('./share.js')` → `window.WarpShare`):

1. **`selectSections`** — 화면에 실재하는 섹션 목록 + 체크 집합 → 합성 대상 산출. DOM 순서 보존, 레지스트리에 없는 id 무시, 미선택 시 빈 배열.
2. **`maskUid`** (순수 문자열) — `'UID 800123456 · '` → `'UID ••••••••• · '`, uid가 빈 값/`null`이면 원본 그대로 반환. `maskUidIn`(DOM 래퍼)은 jsdom이 없어 테스트하지 않는다.
3. **`shareFileName`** — `new Date(2026, 7, 14, 15, 30)` → `'hsr-warp-20260814-1530.png'`. 한 자리 월·일·시·분 zero-pad.

**기존 가드 테스트가 자동으로 신규 코드를 검사한다:**

- `nohardcode.test.js` — FILES에 `ShareModal.jsx`를 추가한다. 한글 문구는 전부 `t()`로 빼야 하고, 한글 주석은 `//` 라인 주석만 쓴다(블록 주석은 제거되지 않아 실패).
- `cdn-sri.test.js` — 신규 CDN 태그의 semver·SRI·crossorigin 검사.
- `i18n.test.js` — en/zh/ja 키 세트가 ko와 완전 일치하는지.
- `lang-reactivity.test.js` — `ShareModal.jsx`의 lang 반응성 규약.

`package.json`의 `test` 체인에 `node web/ui_kits/dashboard/share.test.js`를 끼워 넣는다.

## 7. 저장과 폴백

```
blob 생성
  → <a download> + URL.createObjectURL 시도
  → 다운로드 미지원(iOS Safari 등)으로 판별되면
     모달 안에 결과 이미지를 그대로 표시 + t('share.saveHint') 안내
```

새 탭 팝업이 아니라 **모달 내부에 표시**한다 — 팝업 차단에 걸리지 않고, 사용자가 이미지를 길게 눌러 저장할 수 있다.

판별은 `typeof document.createElement('a').download === 'undefined'` 같은 기능 감지 + 예외 캐치로 하며, 사용자 에이전트 문자열 스니핑에 의존하지 않는다.

## 8. 리스크와 남는 검증

| 리스크 | 완화 | 상태 |
|---|---|---|
| iOS Safari가 blob 다운로드를 막음 | §7 폴백을 **처음부터** 내장 | 코드로 대응, 실기기 확인 필요 |
| Chart canvas가 빈 영역으로 캡처됨 | `Chart.getChart()` → `toBase64Image()` `<img>` 치환 경로가 기본 | 로컬 Chrome 육안 확인 |
| 웹폰트 미로드로 폰트 깨짐 | `document.fonts.ready` 대기. `fonts.gstatic.com`은 `Access-Control-Allow-Origin: *`라 임베드 가능하고, 스택이 `"Noto Sans KR", "Segoe UI", "Malgun Gothic", system-ui`라 실패해도 시스템 폰트로 자연 폴백 | 낮음 |
| 오프스크린 컨테이너에서 테마 변수·미디어 쿼리가 다르게 잡힘 | `className="page"` + `document.body` 하위 유지로 `:root` 변수 상속, 폭은 720px 고정 | 로컬 Chrome 육안 확인 |

**구현자가 닫을 수 없는 항목 — 사용자 수동 검증 필요:**

- iOS Safari·Android Chrome 실기기 저장 (AC 6)
- 모바일 폭 400px 이하에서의 결과물 동일성 (AC 5) — 데스크톱 Chrome 디바이스 에뮬레이션으로 근사 확인은 가능하나 실기기가 최종 근거다.

## 9. 구현 순서

1. `share.test.js` 작성 (실패 확인)
2. `share.js` 순수 로직 구현 → 테스트 통과
3. 섹션 `.jsx`에 `data-share` 마커 부여
4. `index.html` CDN+SRI 추가 (실제 해시 산출) → `cdn-sri.test.js` 통과
5. i18n 4개 로케일 키 추가 → `i18n.test.js` 통과
6. `share.js`의 합성·캡처 DOM 함수 구현
7. `ShareModal.jsx` 구현 + `nohardcode.test.js` FILES 등록
8. `RefreshBar.jsx` 공유 버튼 + `Dashboard.jsx` 모달 마운트
9. `package.json` test 체인 등록 → `npm test` 전체 통과
10. 로컬 Chrome 육안 검증 (라이트/다크 × 차트 포함/미포함 × 마스킹 ON/OFF)
