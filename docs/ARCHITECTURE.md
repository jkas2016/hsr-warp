# 아키텍처 & 도메인 레퍼런스

CLAUDE.md 의 상세 보충. 코드를 읽으면 알 수 있는 구조는 줄이고, **코드만 봐선 모르는 규칙·불변식·외부 명세 의존**을 적는다.

## 무엇인가

자가 호스팅 호요버스 스타레일(HSR) 워프(가챠) 기록 추적기. 단일 Go 실행파일(`hsr-warp.exe`)이 게임 캐시에서 authkey를 추출해 비공식 `getGachaLog` API를 증분 호출하고, 데이터를 SRGF v1.0 형식으로 월별 저장한 뒤, 내장(`go:embed`) React 대시보드(디자인 시스템 킷)를 로컬 HTTP로 서빙하고 SSE로 진행을 스트리밍한다. 분석은 브라우저의 `analyze.js`가 담당한다. 가챠 수집·CDN 자산엔 인터넷이 필요하지만 사용자 기록은 외부로 나가지 않는다 — 수집·분석·저장이 모두 로컬에서 일어난다(개인정보 보안 목적이며, 오프라인 전용 동작이 목표는 아니다).

## 패키지 구조

Go 모듈 `hsr-warp`. 백엔드는 수집·저장·서빙만 하고, 분석(천장·운·50/50·월별)은 브라우저 `analyze.js`가 한다.

- **`internal/store`** — SRGF 타입(`Info`/`Record`/`SRGF`)과 저장 로직. `LoadAll`(월별 파일 병합·중복제거·정렬), `MaxIDByBanner`(증분 기준), `WriteAffectedMonths`(아래 핵심), `TZForRegion`. ID 비교는 `idLess`(math/big) — `Number`/float 금지.
- **`internal/collector`** — `FindAuthContext`(캐시 `StarRail_Data\webCaches\<버전>\Cache\Cache_Data\data_2` 읽어 정규식으로 authkey URL 추출(readShared 로 FILE_SHARE_DELETE 포함 공유 열기 — 게임 실행 중에도 읽음); 버전 디렉터리는 숫자 기반 `latestVersion`으로 최신 선택), `FetchIncremental`(배너 `1`/`2`/`11`/`12` 페이지네이션, 저장분보다 최신 id만 수집, retcode -101 → authkey 만료 에러).
- **`internal/server`** — 라우팅과 핸들러. `/api/data`, `/api/config`, `/api/detect`, `/api/fetch`(SSE: progress/error/done). 자산은 main에서 `go:embed`한 `web/`를 `fs.Sub`로 주입. `Handler()`는 mux를 `recoverMiddleware`로 감싼다.
- **`main.go`** — `os.Executable()` 기준 baseDir, `data/`·`config.json` 경로, 빈 포트 선택, `go:embed all:web`(킷 전체를 임베드; `_ds_bundle.js`처럼 `_`로 시작하는 파일을 포함하려면 `all:` 프리픽스가 필요), `/ui_kits/dashboard/`로 브라우저 자동 오픈, 로깅 셋업.
- **`internal/updater`** — 시작 시 업데이트 2채널 확인(외부 통신 단일 지점). `CheckSchedule`(raw `schedule.json` → 신규면 `data/`에 기록), `CheckRelease`(`releases/latest` semver 비교), `EffectiveSchedule`(data/ override > 내장본), `CompareVersions`.

## 대시보드 프런트엔드 (디자인 시스템 UI 킷)

대시보드는 [claude.ai 디자인 시스템](https://claude.ai/design/p/4a0d441c-4f52-4c0c-810f-1c942c2a9124) 프로젝트에서 가져온 React 멀티파일 킷이다. 진입점은 `web/ui_kits/dashboard/index.html`, 서빙 URL은 `/ui_kits/dashboard/`(Go `FileServer`가 `index.html` → 디렉터리로 301).

- **로드 방식** — React/ReactDOM/Babel(브라우저 내 JSX 컴파일)·Chart.js는 CDN, 디자인 시스템 컴포넌트는 `web/_ds_bundle.js`(전역 `window.HSRWarpDesignSystem_4a0d44`), 토큰은 `web/styles.css`(`tokens/*.css` 4개 `@import`). 테마는 `<html data-theme>`(dark 기본/light) + `localStorage('hsrwarp-theme')`.
- **뷰 구성** — `Dashboard.jsx`(헤더·테마·탭·업데이트 배너·미확인 5★ 경고) → 4탭: `OverviewView`(히어로·배너카드·차트·최근 5★) / `BannersView`(배너 선택 심화) / `HistoryView`(필터칩 + 전체 5★) / `VersionsView`(버전 비교표·차트). 공용: `FivesTable`, `FiveDetail`(모달), `HeroSummary`, `BannerCards`, `ChartsGrid`, `QueryPanel`/`RefreshBar`(SSE 조회).
- **데이터 어댑터 — `data.js`의 `window.WarpData`** — 분석을 재구현하지 않는다. `/api/data`+`/schedule.json`을 받아 `WarpAnalyze.analyze()`(+`analyzeVersions`/`versionWindows`)를 돌리고, 그 출력을 킷 컴포넌트가 읽는 `WARP_DATA` 형태(배너 평탄화·`monthly` `YYYY.MM`·5★별 `version` 라벨·`charBanner` 요약 등)로 **변환만** 한다. `loadStored()`(저장분 표시), `runFetch()`(SSE 증분 조회 → 어댑트), `configPath()`(경로 자동채움), `checkUpdates()`. 도메인 로직의 단일 소스는 여전히 `analyze.js`다.
- **불변식 유지** — 50/50·천장·BigInt 비교는 `analyze.js` 그대로. 출발 워프(`gacha_type` 2) 카드는 표시에서 제외(어댑터에서 필터).

## 중심 도메인 규칙 — 50/50 픽승/픽뚫 판정

`web/analyze.js`의 `analyzeBanner`: 5★ **획득 시각**의 픽업(rate-up) item_id이면 픽승(win), 아니면 픽뚫(loss). 판정은 `wasPickup`(획득 시각이 그 item을 픽업한 `SCHEDULE` 기간의 ±60일 안인지 — `SCHEDULE` 날짜가 cadence 근사라 오차 흡수; 상시풀 편입분은 픽업 기간이 수개월 전이라 자연히 제외). 픽뚫은 `guaranteed=true`로 다음 5★를 확정으로 만든다. **'그 시점 픽업이었나'로 판정**하므로 상시풀 편입·Celestial Invitation·콜라보·리런을 모두 올바르게 처리한다(풀 소속 방식은 구조적으로 불가 — 패배 풀이 시변적·플레이어별이라). 일정에 없는 시각의 5★는 `unidentified`(대시보드 '미확인 5★' 경고).

신규 패치 출시 시 **`web/schedule.json`의 `schedule` 배열에 `{s,e,c,l}` 항목 추가 + 최상위 `version` +1**(c=캐릭터 픽업, l=광추 픽업 item_id; 픽업=Mantan21/HSR-Warp-Simulator, item_id=StarRailRes). `main` 에 push 하면 사용자 앱이 시작 시 자동으로 받아 반영한다(릴리스 불필요). `gacha_type`: `11`=캐릭터, `12`=광추, `1`=일반(스텔라), `2`=출발. **게임 버전 경계(예: 3.x→4.x)에는 최상위 `versions` 배열에도 `{"v":"X.Y","s":"YYYY-MM-DD"}` 항목 추가** — 버전 시작일(대시보드 버전별 통계의 단일 소스).

## 불변식

**저장은 비파괴 부분 재작성이다.** `WriteAffectedMonths`는 이번 조회로 **신규가 생긴 월 파일만** 로드·병합·중복제거·정렬 후 원자적으로 재작성하고, 손대지 않은 월은 보존한다. authkey가 최근 기록만 줄 때 과거 월이 통째로 사라지는 것을 막는 핵심 보장이며, 테스트 `TestWriteAffectedMonths_PreservesUntouchedMonths`가 이를 강제한다. (구 PowerShell의 "전량 삭제 후 재작성"은 폐기됨.)

**로직은 `analyze.js`, 데이터는 `schedule.json` 단일 소스다.** 50/50 판정 로직은 `web/analyze.js`(순수 함수 `analyze(data, schedule)`/`analyzeBanner(records, meta, schedule)` — 일정을 인자로 주입받는다), 배너 일정 데이터는 `web/schedule.json`이 유일 소스다. 서버가 `/analyze.js`·`/schedule.json`(data/ override > 내장본)로 서빙하고 exe에 `go:embed`로 내장된다. 단위 테스트는 `web/analyze.test.js`(`node web/analyze.test.js`)가 `require('./analyze.js')`로 같은 디렉터리 파일을 검증한다. UMD IIFE로 브라우저=`window.WarpAnalyze`, Node=`module.exports` 노출. 의존성 없이 양쪽에서 동작해야 한다.

**ID는 매우 큰 정수다.** 비교 시 Go는 `math/big.Int`(`idLess`/`idLessEq`), JS는 `BigInt`로 다룬다 — `Number`로 비교하면 정밀도가 깨진다.

## 로깅

표준 라이브러리 `log/slog`(JSON, 외부 의존성 0)를 쓴다. `main.go` 의 `setupLogging` 이 콘솔+날짜별 파일(`logs/hsr-warp-<날짜>.log`)에 동시 출력하고 `slog.SetDefault` 한다.

- **레벨** — `HSRWARP_LOG`(런타임) > 빌드 시 박힌 `main.logLevel` > 기본 `info` 순(`resolveLevel`). 빌드타임 주입은 `version`과 같은 ldflags `-X` 메커니즘: release 빌드는 `info`, `npm run build:debug`는 `-X main.logLevel=debug`로 박아 `hsr-warp-debug.exe`(별도 파일명)를 낸다. 끝까지 동작하는지는 `setupLogging`이 시작 시 찍는 `로깅 초기화` DEBUG 줄로 확인 가능(release에선 필터돼 안 보임).
- **에러엔 항상 스택트레이스** — `stackHandler` 가 ERROR 이상 레코드에 전체 고루틴 스택을 자동 첨부한다. 호출부에서 깜빡할 여지가 없다. 새 로그는 표준 `log` 말고 `slog` 를 쓴다.
- **전역 패닉 핸들러** — Go엔 try/catch식 전역 예외 핸들러가 없으므로, `recoverMiddleware`가 HTTP 핸들러 전체를 감싸 panic을 500 + ERROR 로그(스택 포함)로 복구한다. main 종료 에러도 `slog.Error`.
- 치명 에러 종료는 `fatal()`(slog ERROR + `os.Exit(1)`; slog엔 Fatal이 없다).
- **DEBUG 추적** — `collector`가 배너별 페이지 수집(`페이지 수집`/`배너 수집 완료`)과 authkey 컨텍스트 추출·캐시 버전 선택을 DEBUG로 남긴다(페이지네이션·`visit too frequently` 진단용). **authkey 등 자격증명은 절대 로그에 넣지 않는다** — host/path/region/lang/발급시각/개수만.

## 업데이트 (자동, 콘텐츠 타입 2채널)

시작 시 대시보드가 `/api/updates`를 1회 호출하면 백엔드가 두 체크를 베스트에포트로 수행·캐시한다(`internal/updater`). 외부 통신은 이때뿐(raw 1회 + GitHub API 1회) — "완전 로컬" 원칙 유지.

- **데이터 채널**: `main`의 `web/schedule.json`을 받아 스키마 검증 후 version 이 높으면 `data/schedule.json`에 원자적 기록(인앱 자동 갱신, 재설치 불필요). 내장본은 오프라인·최초 실행 fallback.
- **코드 채널**: `releases/latest`(프리릴리스·드래프트 자동 제외)의 `tag_name`을 `main.version`과 semver 비교. 새 버전이면 대시보드가 설치본 다운로드 배너만 표시(셀프 업데이트 없음). `version=="dev"`면 스킵.
- 설치본은 **per-user `{localappdata}` 설치**(Inno Setup) — 앱이 exe 옆에 쓰기 때문에 쓰기 가능 위치여야 한다.

## 외부 명세 의존 (상수 변경 시 출처 준수)

데이터 형식·`gacha_type` 코드·표준 풀·확률은 외부 명세에 묶여 있다: SRGF v1.0(uigf.org), Prydwen(50/50·확률), StarRailRes(item_id 검증). 출처는 README 를 따른다.

## Gotchas

- authkey는 게임에서 **전언 기록 화면을 최근 ~24시간 내 한 번 열어야** 유효하다. 유효 authkey가 없으면 조회는 SSE error 이벤트로 실패를 알린다(설계된 동작).
- `hsr-warp.exe`, `data/`, `config.json`, `*.tmp`, 구 생성물 `HSR_Warp_Dashboard.html`은 gitignore 대상이다.
- Go가 설치돼 있어도 PATH에 없을 수 있다(설치 후 셸 미갱신). 그 경우 `$env:Path` 에 `C:\Program Files\Go\bin` 을 prepend 한다.
