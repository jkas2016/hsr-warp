# 아키텍처 & 도메인 레퍼런스

CLAUDE.md 의 상세 보충. 코드를 읽으면 알 수 있는 구조는 줄이고, **코드만 봐선 모르는 규칙·불변식·외부 명세 의존**을 적는다.

## 무엇인가

자가 호스팅 호요버스 가챠 기록 추적기 — 호요버스 스타레일(HSR)과 젠레스 존 제로(ZZZ)를 단일 exe로 지원한다. 단일 Go 실행파일(`hsr-warp.exe`)이 게임 캐시에서 authkey를 추출해 비공식 `getGachaLog` API를 증분 호출하고, 데이터를 게임별 월별 파일로 저장한 뒤, 내장(`go:embed`) React 대시보드(디자인 시스템 킷)를 로컬 HTTP로 서빙하고 SSE로 진행을 스트리밍한다. 분석은 브라우저의 `analyze.js`가 담당한다. 가챠 수집·CDN 자산엔 인터넷이 필요하지만 사용자 기록은 외부로 나가지 않는다 — 수집·분석·저장이 모두 로컬에서 일어난다(개인정보 보안 목적이며, 오프라인 전용 동작이 목표는 아니다).

## 패키지 구조

Go 모듈 `hsr-warp`. 백엔드는 수집·저장·서빙만 하고, 분석(천장·운·50/50·월별)은 브라우저 `analyze.js`가 한다.

- **`internal/game`** — 게임 어댑터. HSR·ZZZ 간 차이를 `Game{ID, DataDirName, BannerParam, InfoFormat, Banners, Candidates}` 값 테이블 하나로 격리해, 코드에 `if game == "zzz"` 분기가 흩뿌려지지 않게 한다. `Banner{Code, Role}`의 `Role`은 `RoleLimitedChar`/`RoleLimitedWeapon`/`RoleStandard`/`RoleBeginner`/`RoleBangboo` 상수 중 하나 — 채널 코드는 게임마다 달라도(HSR `gacha_type` vs ZZZ `real_gacha_type`) 역할은 공통이라, 수집·분석·표시 계층이 코드가 아니라 역할로 분기한다. `ByID`(400 유도용 — 미매치 시 폴백하지 않음), `Default()`(`hsr`, 게임 미지정 요청 보존용), `All()`. **배너의 천장·픽업확률·표시 이름은 여기 두지 않는다** — `schedule.json`의 `banners` 블록이 단일 소스다(§중심 도메인 규칙).
- **`internal/store`** — SRGF/UIGF 타입(`Info`/`Record`/`SRGF`)과 저장 로직. `LoadAll`(월별 파일 병합·중복제거·정렬), `MaxIDByBanner(recs, g game.Game)`(증분 기준), `WriteAffectedMonths`(아래 핵심), `TZForRegion`. ID 비교는 `idLess`(math/big) — `Number`/float 금지. `MigrateLegacyLayout(dataDir)`는 구버전 레이아웃(`data/warp_*.json`)을 `data/hsr/`로 1회 이동한다(멱등 — 대상이 이미 있으면 건너뛰고 경고만, 실패해도 앱은 계속 뜬다). `main.go`가 시작 시 1회 호출.
- **`internal/collector`** — `FindAuthContext(gamePath, g game.Game)`(`g.DataDirName`으로 캐시 루트 결정 — HSR `StarRail_Data`/ZZZ `ZenlessZoneZero_Data`; `webCaches\<버전>\Cache\Cache_Data\data_2`를 정규식으로 authkey URL 추출(readShared 로 FILE_SHARE_DELETE 포함 공유 열기 — 게임 실행 중에도 읽음); 버전 디렉터리는 숫자 기반 `latestVersion`으로 최신 선택), `FetchIncremental(..., g game.Game, ...)`(쿼리 파라미터는 `g.BannerParam`, 순회는 `g.Banners` 순서, retcode -101 → authkey 만료 에러, retcode -110 → 레이트 리밋 에러). 배너 표시명(`BannerLabel`)은 `roleName` 맵을 통해 코드가 아니라 역할에서 유도 — 이 맵은 대시보드 `data.js`의 `PROGRESS_ROLE`과 SSE progress 키로 결합돼 있다(아래 Gotchas 참조).
- **`internal/server`** — 라우팅과 핸들러. `/api/data`, `/api/config`, `/api/detect`, `/api/fetch`(SSE: progress/error/done)가 `?game=` 쿼리로 스코프된다(`gameOf` — 미지정은 `game.Default()`인 `hsr`로 폴백해 구버전 클라이언트 동작 보존, 알 수 없는 값은 `ok=false`로 400). `/schedule.json`(HSR, 경로 고정)과 지원 게임마다(HSR 제외) `/<gameID>/schedule.json`을 `scheduleHandler(g)`로 등록 — `updater.EffectiveSchedule(dataDir, embedded, g.ID)`가 내장본/갱신본 중 선택. `/api/updates`(`handleUpdates` — 업데이트 2채널 확인, HSR 스케줄만 확인). 자산은 main에서 `go:embed`한 `web/`를 `fs.Sub`로 주입. `Handler()`는 mux를 `recoverMiddleware`로 감싼다. `Config`(`internal/server/config.go`)는 `{"games": {"hsr": {"game_path": "…"}, "zzz": {...}}, "active_game": "…"}` 스키마 — `LoadConfig`가 구 스키마(`{"game_path": "…"}`)를 만나면 `games.hsr.game_path`로 1회 승격한다(다음 저장부터 신 스키마만 기록).
- **`main.go`** — `os.Executable()` 기준 baseDir, `data/`·`config.json` 경로, 빈 포트 선택, `go:embed all:web`(킷 전체를 임베드; `_ds_bundle.js`처럼 `_`로 시작하는 파일이나 `web/zzz/`처럼 게임별 서브디렉터리를 포함하려면 `all:` 프리픽스가 필요), `/ui_kits/dashboard/`로 브라우저 자동 오픈, 로깅 셋업, 시작 시 `store.MigrateLegacyLayout` 1회 호출.
- **`internal/updater`** — 시작 시 업데이트 2채널 확인(외부 통신 단일 지점). `CheckSchedule(..., gameID)`(raw `schedule.json` → 신규면 `data/`의 게임별 override 파일에 기록), `CheckRelease`(`releases/latest` semver 비교, 게임 무관), `EffectiveSchedule(dataDir, embedded, gameID)`(data/ override > 내장본), `CompareVersions`. 게임별 override 파일명은 `scheduleFileName(gameID)` — HSR은 구버전 exe 호환을 위해 `schedule.json` 그대로, 그 외는 `<gameID>-schedule.json`(예: `zzz-schedule.json`).

## 대시보드 프런트엔드 (디자인 시스템 UI 킷)

대시보드는 [claude.ai 디자인 시스템](https://claude.ai/design/p/4a0d441c-4f52-4c0c-810f-1c942c2a9124) 프로젝트에서 가져온 React 멀티파일 킷이다. 진입점은 `web/ui_kits/dashboard/index.html`, 서빙 URL은 `/ui_kits/dashboard/`(Go `FileServer`가 `index.html` → 디렉터리로 301).

- **로드 방식** — React/ReactDOM/Babel(브라우저 내 JSX 컴파일)·Chart.js는 CDN, 디자인 시스템 컴포넌트는 `web/_ds_bundle.js`(전역 `window.HSRWarpDesignSystem_4a0d44`), 토큰은 `web/styles.css`(`tokens/*.css` 4개 `@import`). 테마는 `<html data-theme>`(dark 기본/light) + `localStorage('hsrwarp-theme')`.
- **뷰 구성** — `Dashboard.jsx`(헤더·게임 스위처·테마·탭·업데이트 배너·미확인 5★ 경고) → 4탭: `OverviewView`(히어로·배너카드·차트·최근 5★) / `BannersView`(배너 선택 심화) / `HistoryView`(필터칩 + 전체 5★) / `VersionsView`(버전 비교표·차트). 공용: `FivesTable`, `FiveDetail`(모달), `HeroSummary`, `BannerCards`, `ChartsGrid`, `QueryPanel`/`RefreshBar`(SSE 조회).
- **게임 스위처** — 헤더 Select(HSR/ZZZ). 선택은 `localStorage('hsrwarp-game')` + `config.json`의 `active_game`으로 유지된다. `data.js`가 `/api/*` 호출에 `?game=`을 부착하고 `analyze()`에 게임의 `schedule.json` 전체(banners/ranks 포함)를 그대로 넘긴다. 뷰 컴포넌트 자체는 재사용 — HSR `gacha_type` 코드(`'11'`/`'12'`/`'1'`/`'2'`) 리터럴을 역할 조회로 바꿔 ZZZ의 독점/W-엔진/상시/본디 채널이 올바르게 잡히게 했다. 용어(워프→신호 검색, 광추→W-엔진, 캐릭터→에이전트 등)는 `i18n/*.js`의 `game.*`/`banner.*` 키로 게임별 매핑.
- **데이터 어댑터 — `data.js`의 `window.WarpData`** — 분석을 재구현하지 않는다. `/api/data`+`/<game>/schedule.json`을 받아 `WarpAnalyze.analyze()`(+`analyzeVersions`/`versionWindows`)를 돌리고, 그 출력을 킷 컴포넌트가 읽는 `WARP_DATA` 형태(배너 평탄화·`monthly` `YYYY.MM`·5★별 `version` 라벨·`charBanner` 요약 등)로 **변환만** 한다. `loadStored()`(저장분 표시), `runFetch()`(SSE 증분 조회 → 어댑트), `configPath()`(경로 자동채움), `checkUpdates()`, `scopeTo(version)`(버전 구간으로 재계산, 재조회 없음). 도메인 로직의 단일 소스는 여전히 `analyze.js`다.
- **불변식 유지** — 50/50·천장·BigInt 비교는 `analyze.js` 그대로. 표시 제외 대상(HSR 출발 워프 등)은 `beginner` 역할 기반으로 어댑터에서 필터 — 코드 리터럴이 아니다.

## 중심 도메인 규칙 — 50/50 픽승/픽뚫 판정

`web/analyze.js`의 `analyzeBanner`: 5★(ZZZ는 S급, `ranks.top`) **획득 시각**의 픽업(rate-up) item_id이면 픽승(win), 아니면 픽뚫(loss). 판정은 `wasPickup`(획득 시각이 그 item을 픽업한 `schedule` 기간의 ±60일 안인지 — 날짜가 cadence 근사라 오차 흡수; 상시풀 편입분은 픽업 기간이 수개월 전이라 자연히 제외). 픽뚫은 `guaranteed=true`로 다음 5★를 확정으로 만든다. **'그 시점 픽업이었나'로 판정**하므로 상시풀 편입·Celestial Invitation·콜라보·리런을 모두 올바르게 처리한다(풀 소속 방식은 구조적으로 불가 — 패배 풀이 시변적·플레이어별이라). 일정에 없는 시각의 5★는 `unidentified`(대시보드 '미확인 5★' 경고).

**`schedule.json`이 분석 파라미터 전체의 단일 소스다.** `resolveConfig`(analyze.js)가 `ranks`(최고/중간 등급의 `rank_type` 코드)·`banners`(코드별 `role`/`cap`/`rateUp`/`expAvg`)·`order`(표시 순서)·`schedule`(픽업 일정)를 한 파일에서 주입받는다. `banners`가 없는 구 스키마(배열)가 들어오면 HSR 내장 기본 테이블(`BANNERS`/`DEFAULT_RANKS`/`ORDER`)로 폴백해 구버전 `data/schedule.json` override와 호환한다.
- **`order`가 필수인 이유**: 생략하면 `Object.keys(banners)`가 정수 유사 문자열 키를 숫자 오름차순으로 재정렬해(`'2'`가 `'11'` 앞으로) 배너 표시 순서가 조용히 뒤집힌다. 스크립트가 낸 산출물은 항상 `order`를 명시한다.
- **`expAvg`는 인게임 공시 종합확률(보증 포함)의 역수다** — 추정이 아니라 공시 원문 값. HSR 캐릭터 `1/0.016 = 62.5`, 광추 `1/0.0187 ≈ 53.5`. ZZZ 독점(에이전트)·상시 `62.5`(1.600%), W-엔진·본디 `50.0`(2.000%).
- HSR 채널: `gacha_type` `11`=캐릭터(`limited-char`), `12`=광추(`limited-weapon`), `1`=일반/스텔라(`standard`), `2`=출발(`beginner`, `rank_type` 최고=`5`/중간=`4`). ZZZ 채널: `real_gacha_type` `2`=독점/에이전트(`limited-char`), `3`=W-엔진(`limited-weapon`), `1`=상시(`standard`), `5`=본디(`bangboo`, `rank_type` 최고=`4`/중간=`3` — HSR의 3/4/5 체계와 다르다). `bangboo`는 `rateUp: null`이라 50/50 집계에서 자연히 빠지고 천장·평균 뽑기·등급 분포만 집계된다.

**HSR**: 신규 패치 출시 시 **`web/schedule.json`의 `schedule` 배열에 `{s,e,c,l}` 항목 추가 + 최상위 `version` +1**(c=캐릭터 픽업, l=광추 픽업 item_id; 픽업=Mantan21/HSR-Warp-Simulator, item_id=StarRailRes). `main` 에 push 하면 사용자 앱이 시작 시 자동으로 받아 반영한다(릴리스 불필요). **게임 버전 경계(예: 3.x→4.x)에는 최상위 `versions` 배열에도 `{"v":"X.Y","s":"YYYY-MM-DD"}` 항목 추가** — 버전 시작일(대시보드 버전별 통계의 단일 소스).

**ZZZ**: `web/zzz/schedule.json`은 손으로 만들지 않고 `node scripts/extract-zzz-schedule.mjs`가 [FuriaPaladins/Hoyoverse-Data](https://github.com/FuriaPaladins/Hoyoverse-Data)의 `banners/zzz_formatted.json`(GitHub Actions 매일 자동 갱신)에서 생성한다. 산출물을 repo에 벤더링해 런타임 의존은 없다 — 소스가 죽어도 기존 사용자 앱은 정상 동작하고 신규 패치 반영 경로만 막힌다. 소스의 `banner_type` 오표기(실측 1건: W-엔진 배너가 `2`로 오표기)를 **id 자릿수(에이전트 4자리 / W-엔진 5자리)로 교정**하며(`poolFor`), 교정·건너뜀 사실은 스크립트 실행 시 `warnings`/`skipped`로 콘솔에 표면화된다(조용히 삼키지 않음). `versions`는 소스에 없어 스크립트 내 상수 테이블로 별도 관리하며, 현재 확인된 `{"v":"1.0","s":"2024-07-04"}` 하나만 들어 있다 — 나머지 버전 경계는 공식 출처(패치 노트)로 확인 후 추가해야 하며, 추론으로 채우면 버전별 통계가 왜곡된다.

`npm run schedule:status`가 두 게임(`web/schedule.json`·`web/zzz/schedule.json`) 모두의 배너 데이터 version·최신 대응 게임 버전·픽업 일정 커버 범위를 보고한다.

## 불변식

**저장은 게임별로 격리되고, 비파괴 부분 재작성이다.** 저장 디렉터리가 `data/hsr/`·`data/zzz/`로 갈리며(월별 SRGF 파일 구조 자체는 게임 간 동일), `WriteAffectedMonths`는 이번 조회로 **신규가 생긴 월 파일만** 로드·병합·중복제거·정렬 후 원자적으로 재작성하고, 손대지 않은 월은 보존한다. authkey가 최근 기록만 줄 때 과거 월이 통째로 사라지는 것을 막는 핵심 보장이며, 테스트 `TestWriteAffectedMonths_PreservesUntouchedMonths`가 이를 강제한다. (구 PowerShell의 "전량 삭제 후 재작성"은 폐기됨.) 기존 사용자의 `data/warp_*.json`(구 레이아웃)은 `store.MigrateLegacyLayout`이 앱 시작 시 `data/hsr/`로 1회 이동한다.

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
- **`real_gacha_type`이 `internal/collector/cache.go`의 `pageKeys`에 반드시 있어야 한다.** ZZZ의 authkey URL 베이스 쿼리에 이 파라미터가 이미 들어 있어, 페이지 조립 시 제거하지 않으면 중복되고 **서버가 앞의(원본) 값을 채택해 4개 채널이 전부 같은 데이터를 반환한다** — 실제로 재현된 버그다.
- **ZZZ의 `rank_type`은 2/3/4 체계다**(B급=`2`, A급=`3`, S급=`4`) — HSR의 3/4/5와 다르다. `schedule.json`의 `ranks` 블록(`web/zzz/schedule.json`은 `{"top":"4","mid":"3"}`)이 이를 주입하며, `analyze.js`가 이 값 없이 하드코딩된 `'5'`/`'4'`로 ZZZ 레코드를 분류하면 집계가 전부 오작동한다.
- **SSE progress의 배너 라벨이 Go와 프런트엔드 양쪽에 문자열로 결합돼 있다.** `internal/collector/fetch.go`의 `roleName` 맵(역할→한글 이름)과 `web/ui_kits/dashboard/data.js`의 `PROGRESS_ROLE`(그 반대 방향 매핑)이 같은 문자열 집합을 유지해야 한다 — 실제로 한 번 조용히 끊어져 조회 진행률이 0에서 굳은 적이 있다. `web/ui_kits/dashboard/progress-map.test.js`가 두 파일의 값 집합 일치를 강제한다(`npm test`에 포함). **한쪽을 바꾸면 반드시 다른 쪽도 바꿔라.**
- ZZZ 응답의 `gacha_id`는 전 레코드 `"0"`이라 배너 인스턴스 식별에 쓸 수 없다(`wasPickup`이 시각 기반이라 영향 없음).
