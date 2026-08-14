# 젠레스 존 제로(ZZZ) 지원 — 단일 exe 멀티게임화 설계

날짜: 2026-08-14 · 상태: 승인됨(브레인스토밍 확정) · 이슈: #51

## 배경

현재 앱은 HSR 전용이다. 같은 호요버스 계열인 **젠레스 존 제로(ZZZ)** 를 같은 exe에서 지원한다.
사전 조사 결과 두 게임의 수집 계층은 거의 동일하고, 분석 규칙도 **구조적으로 동형**이다.

### 검증된 사실

아래는 모두 실측·공식 원문·표준 문서로 확인한 것이다(추론 없음).

| 항목 | HSR (현행) | ZZZ | 확인 방법 |
|---|---|---|---|
| 캐시 경로 | `StarRail_Data/webCaches/<ver>/Cache/Cache_Data/data_2` | `ZenlessZoneZero_Data/webCaches/<ver>/…` | 로컬 설치본 실측(`D:\Game\HoYoPlay\games\ZenlessZoneZero Game`, 캐시 버전 2.45~2.51 존재) |
| API 경로 | `/common/gacha_record/api/getGachaLog` | **동일** | [earthjasonlin/zzz-signal-search-export](https://github.com/earthjasonlin/zzz-signal-search-export) `src/main/getData.js` |
| 호스트 | `public-operation-hkrpg[-sg]` | `public-operation-nap.mihoyo.com` / `public-operation-nap-sg.hoyoverse.com` | 위 동일 |
| 배너 쿼리 파라미터 | `gacha_type` | **`real_gacha_type`** | 위 동일 (`getData.js:202`) |
| 저장 규격 | SRGF v1.0 | UIGF v4.0 `nap` 블록 | [UIGF v4.0 표준](https://uigf.org/en/standards/uigf.html) |
| 레코드 필드 | `gacha_id·gacha_type·item_id·count·time·name·item_type·rank_type·id` | **동일**(일부 optional) | UIGF v4.0 스키마 |

**호스트·경로를 하드코딩할 필요가 없다.** 현행 `parseAuthURL`은 캐시에서 발견한 URL의 실제 host+path를 그대로 쓴다(`cache.go:97-99`). ZZZ도 URL 필터 문자열이 `getGachaLog`으로 같으므로 이 로직은 **한 줄도 바뀌지 않는다**.

### 검증된 ZZZ 도메인 규칙

게임 내 공식 배너 안내문 원문 기준(`FuriaPaladins/Hoyoverse-Data` `banners/zzz/<gacha_id>.json`의 `content` 필드 = 인게임 확률 공시).

| 채널 | `real_gacha_type` | S급 기본확률 | 하드천장 | 픽업 확률 | 픽뚫 → 다음 확정 | HSR 대응 |
|---|---|---|---|---|---|---|
| 독점(에이전트) | `2` | 0.600% | 90 | 50% | O | `11` 캐릭터(90 / 50%) |
| 음의 엔진 | `3` | 1.000% | 80 | 75% | O | `12` 광추(80 / 75%) |
| 상시 | `1` | 0.600% | 90 | — | — | `1` 스텔라 |
| 본디 | `5` | 1.000% | 80 | 선택 확정(50/50 개념 없음) | — | 대응 없음 |

- 천장 카운트는 채널 종류별로 독립 누적된다(공시 원문: "cumulative across all Exclusive Channels but is independent of … other types of Channels"). 현행 `analyzeBanner`가 `gacha_type`별로 독립 계산하므로 그대로 성립한다.
- 독점 채널은 **동시에 2개 운영**되는 시기가 있다(배너 데이터의 `2001`+`2011` 병행). `schedule.json`의 `c` 가 배열이라 현행 스키마로 표현 가능하다.
- 출발 워프(HSR `2`)에 해당하는 채널이 ZZZ에는 없다.

### 배너 일정 데이터 원본

[FuriaPaladins/Hoyoverse-Data](https://github.com/FuriaPaladins/Hoyoverse-Data) — GitHub Actions로 매일 자동 수집(`.github/workflows/update-banners.yml`, cron `0 3 * * *`).

- `banners/zzz_formatted.json` (37KB): 배너별 `banner_type`, `start_time`/`end_time`, `uprate_5`(**item_id + 이름 + rank + item_type**), `uprate_4`. 2024-07-04 출시분부터 현재까지 전 구간.
- `banners/zzz/<gacha_id>.json`: 인게임 공시 원문(위 확률표의 출처).

`schedule.json`의 `{s,e,c,l}` 로 **스크립트 변환 가능**하다. 추론으로 손으로 만들지 않는다.

## 결정 사항 (사용자 확정)

1. **단일 exe 멀티게임.** 현행 repo에 게임 어댑터 계층을 도입하고 `hsr-warp.exe` 하나가 HSR·ZZZ를 모두 지원한다. 별도 repo 포크나 게임별 exe 분리는 하지 않는다.
2. **저장은 현행 월별 구조 유지, `info` 블록만 게임별.** 전량 UIGF v4.0 마이그레이션은 하지 않는다.
3. **1단계에서 HSR과 동등한 기능까지 간다** — 50/50 픽승/픽뚫 판정 포함.

## 구현 설계

### 1. 게임 어댑터 — `internal/game` (신규)

게임 간 차이를 **값 테이블 하나**로 격리한다. 분기(`if game == "zzz"`)를 코드에 흩뿌리지 않는다.

```go
package game

type Banner struct {
    Code string // API gacha_type / real_gacha_type 값
    Role string // "limited-char" | "limited-weapon" | "standard" | "beginner" | "bangboo"
}

type Game struct {
    ID          string   // "hsr" | "zzz"
    DataDirName string   // "StarRail_Data" | "ZenlessZoneZero_Data"
    BannerParam string   // "gacha_type" | "real_gacha_type"
    Banners     []Banner // 조회 순서 = 슬라이스 순서
    InfoFormat  string   // "srgf-v1.0" | "uigf-v4.0"
    Candidates  []string // 설치 경로 자동탐지 후보
}

func ByID(id string) (Game, bool)
func All() []Game
```

배너 **표시 이름·천장·픽업 확률은 여기 두지 않는다** — 분석 계층(`schedule.json`)의 단일 소스에 둔다(§3). Go 쪽은 수집에 필요한 코드 목록과 순서만 안다.

### 2. 백엔드 변경

**`internal/collector`** — 시그니처에 `game.Game` 추가.
- `FindAuthContext(gamePath string, g game.Game)`: `filepath.Join(gamePath, g.DataDirName, "webCaches")`. 나머지(버전 디렉터리 선택, `readShared`, `parseAuthURL`, timestamp 최신 선택)는 **무변경**.
- `FetchIncremental(..., g game.Game, ...)`: 쿼리 조립을 `g.BannerParam`으로, 순회를 `g.Banners`로. `pageKeys`에 `real_gacha_type` 추가(페이지네이션 시 우리가 직접 지정하므로 베이스 쿼리에서 제거해야 함). retcode `-101`/`-110` 처리, `end_id` 진전 없음 백스톱, `maxPagesPerBanner`는 **무변경**.
- 배너 표시명(`bannerName` 맵)은 로그·SSE progress 용도이므로 `g.Banners`의 `Role`을 기준으로 만든다.

**`internal/store`** — 구조 변경 없음. `LoadAll`/`WriteAffectedMonths`가 이미 `dir`을 인자로 받으므로 `data/hsr`·`data/zzz`를 넘기면 끝이다. **비파괴 부분 재작성 불변식과 `TestWriteAffectedMonths_PreservesUntouchedMonths`는 그대로 유효하다.**
- `Info`만 게임별로 갈라진다. ZZZ는 `srgf_version` 대신 UIGF v4.0의 `version: "v4.0"`. `Info` 구조체에 `UIGFVersion *string`을 추가하고 두 필드 모두 `omitempty`로 두어 한 구조체가 양쪽을 표현한다.

**`internal/server`** — 라우트에 `?game=` 스코프.
- `/api/data`, `/api/fetch`, `/api/detect` 에 `game` 쿼리 파라미터. 없으면 `hsr`(기존 동작 보존).
- 알 수 없는 `game` 값은 400.
- `/schedule.json`(HSR)은 **경로 그대로 유지**한다. ZZZ는 `/zzz/schedule.json`. 구버전 exe가 기존 경로를 계속 쓰기 때문.

**`Config`** — 게임별 경로.
```json
{ "games": { "hsr": { "game_path": "…" }, "zzz": { "game_path": "…" } }, "active_game": "hsr" }
```
`LoadConfig`가 구 스키마(`{"game_path": "…"}`)를 만나면 `games.hsr.game_path`로 승격한다(1회, 다음 저장 시 새 스키마로 기록).

**데이터 마이그레이션** — 시작 시 `data/warp_*.json` 이 있으면 `data/hsr/` 로 rename 한다. 멱등(이미 `data/hsr/`가 있으면 무동작), 원자적, 실패 시 경고 로그 후 계속. 새 이슈 사용자에겐 아무 일도 일어나지 않는다.

**`internal/updater`** — 스케줄 채널을 게임별로 확장. HSR은 현행 `web/schedule.json` → `data/schedule.json` 경로를 **그대로 두고**(구버전 호환), ZZZ는 `web/zzz/schedule.json` → `data/zzz-schedule.json` 을 추가한다. `EffectiveSchedule(gameID)` 로 일반화. 릴리스 채널은 무변경.

**`main.go`** — `go:embed all:web` 그대로(하위 `web/zzz/` 자동 포함).

### 3. 분석 — `web/analyze.js`

**로직 단일 소스 원칙을 유지한다.** 킷에서 재구현하지 않는다.

현재 `BANNERS` 상수 테이블(`analyze.js:9-14`)이 이미 `cap`/`rateUp`/`expAvg`/`kind`/`pool` 형태라 **파라미터화가 자연스럽다**. 이 테이블을 `schedule.json`의 게임별 `banners` 블록에서 주입받게 바꾼다.

- `analyze(data, schedule)` 는 `schedule.banners` 가 있으면 그것을, 없으면 현행 내장 HSR 테이블을 쓴다(구 `data/schedule.json` override 호환).
- **50/50 판정 함수는 바뀌지 않는다.** `wasPickup`(획득 시각이 그 item의 픽업 기간 ±60일 내인지)과 `guaranteed` 전이는 ZZZ에도 그대로 성립한다 — 공식 원문상 픽뚫 후 다음 S급 확정 규칙이 동일하기 때문.
- `'11'`/`'12'`/`'1'` 리터럴이 박힌 곳(`analyze.js` 기준 대략 6개소: `combineLimited` 대상 선정 53–68, `charFives` 220–223, `ORDER` 14, `analyzeVersions` 198–199 등)을 **역할(role) 조회**로 바꾼다.
  - 합산 한정 지표 = `limited-char` + `limited-weapon`
  - 계정 운 지표 = `limited-char` + `standard`
  - 표시 제외 = `beginner`(HSR 출발 워프)
  - **`bangboo` 는 `rateUp: null`** 이라 50/50 집계에서 자연히 빠진다(현행 `contested` 계산이 이미 `rateUp` 유무를 본다). 천장·평균 뽑기·등급 분포는 정상 집계된다.
- `expAvg`(이론 기준선)는 ZZZ 값을 별도 산출해 `schedule.json`에 넣는다. HSR과 같은 방식(기본확률+소프트피티 모델)으로 계산하되, **수치는 스크립트로 산출하고 근거를 주석에 남긴다.**

`schedule.json` 확장 스키마(추가분만):
```json
{
  "version": 1,
  "banners": {
    "2": { "role": "limited-char",   "cap": 90, "rateUp": 0.5,  "expAvg": "<산출>" },
    "3": { "role": "limited-weapon", "cap": 80, "rateUp": 0.75, "expAvg": "<산출>" },
    "1": { "role": "standard",       "cap": 90, "rateUp": null, "expAvg": "<산출>" },
    "5": { "role": "bangboo",        "cap": 80, "rateUp": null, "expAvg": "<산출>" }
  },
  "schedule": [ { "s": "…", "e": "…", "c": ["…"], "l": ["…"] } ],
  "versions": [ { "v": "1.0", "s": "2024-07-04" } ]
}
```
HSR `web/schedule.json` 에도 같은 `banners` 블록을 추가한다(값은 현행 내장 테이블과 동일). 이후 확률 공시가 바뀌면 릴리스 없이 데이터 채널로 반영할 수 있게 된다.

### 4. 데이터 추출 — `scripts/extract-zzz-schedule.mjs` (신규)

`banners/zzz_formatted.json` → `web/zzz/schedule.json` 의 `schedule`·`versions`.

- `banner_type` `2`(독점) → `c`, `3`(음의 엔진) → `l`. 같은 `start_time` 구간끼리 병합해 한 항목으로 만든다.
- `uprate_5[].id` 를 그대로 `item_id` 로 쓴다.
- **타임존 정규화**: 소스의 `start_time.time` 은 `+08:00`/`+01:00` 이 섞여 있고 `is_server_time` 플래그가 따로 있다. 이를 UTC로 정규화한 뒤 날짜(`YYYY-MM-DD`)만 취한다. `wasPickup` 이 ±60일 여유를 두므로 하루 오차는 판정에 영향 없다.
- `versions` 는 소스에 없으므로 별도 상수 테이블로 관리한다(HSR과 동일하게 신규 패치마다 수동 1줄 추가).
- `npm run schedule:status` 를 두 게임 모두 보고하도록 확장한다.

**아이템 이름** — 1단계는 `zzz_formatted.json` 의 영문 `name` + API 응답의 `name` 필드 폴백으로 간다. 다국어(ko/ja/zh)는 §7 미해결 항목.

### 5. 대시보드

- 헤더에 **게임 스위처**(HSR / ZZZ). 선택은 `localStorage('hsrwarp-game')` + `config.json`의 `active_game`.
- `data.js` 어댑터가 게임별 용어를 i18n 키로 매핑한다: 워프→신호 검색, 광추→음의 엔진, 캐릭터→에이전트, 5★→S급. **분석 로직은 여전히 `analyze.js` 단일 소스.**
- 뷰 컴포넌트(`OverviewView`/`BannersView`/`HistoryView`/`VersionsView`)는 재사용한다. 본디 채널 카드가 하나 늘고, 픽승률 관련 UI는 `rateUp: null` 배너에서 `-` 로 표시(현행 일반 배너와 동일 처리).

## 테스트 계획 (구현 전에 작성한다)

**Go**
- `game`: `ByID` 왕복, 모든 게임이 유효한 `Role` 만 쓰는지 검증.
- `collector`: ZZZ `Game`으로 `FindAuthContext` 가 `ZenlessZoneZero_Data` 를 본다(임시 디렉터리 픽스처). `FetchIncremental` 이 `real_gacha_type=2` 쿼리를 발행한다(`httptest` 서버로 요청 URL 검증) — HSR은 `gacha_type=11` 그대로.
- `store`: `data/hsr`·`data/zzz` 동시 기록 시 상호 격리. **기존 `TestWriteAffectedMonths_PreservesUntouchedMonths` 는 무변경 통과해야 한다.**
- 마이그레이션: `data/warp_*.json` → `data/hsr/` 이동이 멱등이고, 이미 `data/hsr/` 가 있으면 무동작.
- `server`: `?game=zzz` 라우팅, 미지정 시 `hsr` 폴백, 알 수 없는 값 400.
- `updater`: `EffectiveSchedule("zzz")` 가 `data/zzz-schedule.json` override 를 내장본보다 우선한다.
- `config`: 구 스키마(`{"game_path":…}`) → 신 스키마 승격.

**JS (`web/analyze.test.js`)**
- ZZZ 픽스처: 독점 채널 90천장 + 50/50 픽승/픽뚫/확정 전이.
- 음의 엔진 80천장 + 75/25.
- 본디 채널: 천장·평균은 집계되되 `win5050Rate === null`.
- 상시 채널: 픽업 판정 없음(`isPickup === null`).
- `banners` 블록이 없는 구 `schedule.json` 이 들어와도 HSR 결과가 현행과 동일(회귀 방지).
- BigInt id 비교 불변식 유지.

**스크립트**
- `extract-zzz-schedule.mjs`: 고정 입력 픽스처 → 기대 출력 스냅샷. 타임존 혼재 케이스 포함.

## 미해결 위험

1. **ZZZ 아이템명 다국어 소스 미확정.** `zzz_formatted.json` 은 영문만 제공한다. HSR의 StarRailRes(`scripts/extract-item-names.mjs`)에 해당하는 ko/ja/zh 원본이 필요한데, `ZZZure/ZenlessRes` 는 에이전트(`agents.json`)만 있고 음의 엔진이 없다. 1단계는 영문 + API `name` 폴백으로 출하하고, 다국어는 별도 후속 이슈로 뺀다.
2. **소스 repo 의존.** `FuriaPaladins/Hoyoverse-Data` 는 소규모 repo다. 다만 산출물(`web/zzz/schedule.json`)을 우리 repo에 벤더링하므로 **런타임 의존은 없다** — 소스가 죽어도 기존 사용자 앱은 정상 동작하고, 신규 패치 반영 경로만 막힌다. 그때는 인게임 공시 원문을 직접 긁는 대체 경로로 전환한다.
3. **E2E 검증 전제조건.** 현재 로컬 ZZZ 캐시(`2.45.1.0`~`2.51.0.0`)에는 `getGachaLog` URL이 없다 — 게임에서 신호 검색 기록 화면을 아직 연 적이 없기 때문(HoYoLAB·이벤트 authkey만 존재). 실제 수집 검증 전에 **게임 내에서 [신호 검색] → [기록] 화면을 한 번 열어야 한다.** HSR과 동일한 ~24시간 제약.
4. **`real_gacha_type` 4자리 코드 확인 필요.** 요청 파라미터는 `1/2/3/5`지만 배너 메타데이터에는 `2001`/`2011` 같은 4자리 코드가 등장한다. 응답 레코드의 `gacha_type` 필드가 어느 쪽 값인지는 실제 응답으로 확인해야 한다(UIGF v4.0 스키마는 `"1","2","3","5"`로 명시하나, 구현 시 실측으로 확정한다). 이 확인은 위 3번 전제조건이 충족된 뒤 첫 작업으로 한다.

## 범위 밖 (후속 이슈)

- ZZZ 아이템명 다국어(ko/ja/zh)
- UIGF v4.0 내보내기/가져오기 기능
- 원신(hk4e) 지원 — 어댑터 계층이 생기면 추가는 쉬워지지만 이번 범위가 아니다
