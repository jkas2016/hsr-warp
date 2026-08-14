# 젠레스 존 제로(ZZZ) 지원 — 단일 exe 멀티게임화 설계

날짜: 2026-08-14 (2026-08-15 E2E 실측 반영) · 상태: 승인됨(브레인스토밍 확정) · 이슈: #51

## 배경

현재 앱은 HSR 전용이다. 같은 호요버스 계열인 **젠레스 존 제로(ZZZ)** 를 같은 exe에서 지원한다.
사전 조사 결과 두 게임의 수집 계층은 거의 동일하고, 분석 규칙도 **구조적으로 동형**이다.

### 검증된 사실

아래는 모두 실측·공식 원문·표준 문서로 확인한 것이다(추론 없음).

| 항목 | HSR (현행) | ZZZ | 확인 방법 |
|---|---|---|---|
| 캐시 경로 | `StarRail_Data/webCaches/<ver>/Cache/Cache_Data/data_2` | `ZenlessZoneZero_Data/webCaches/<ver>/…` | 로컬 설치본 실측(`D:\Game\HoYoPlay\games\ZenlessZoneZero Game`, 캐시 버전 2.45~2.51 존재) |
| API 경로 | `/common/gacha_record/api/getGachaLog` | **동일** | E2E 실측(아래) |
| 호스트 | `public-operation-hkrpg[-sg]` | `public-operation-common-sg.hoyoverse.com` | E2E 실측 — 사전 조사에서 예상한 `public-operation-nap-sg` 가 **아니었다**. 하드코딩하지 않으므로 무해 |
| 배너 쿼리 파라미터 | `gacha_type` | **`real_gacha_type`** | E2E 실측 |
| 저장 규격 | SRGF v1.0 | UIGF v4.0 `nap` 블록 | [UIGF v4.0 표준](https://uigf.org/en/standards/uigf.html) |
| 레코드 필드 | `gacha_id·gacha_type·item_id·count·time·name·item_type·rank_type·id` | **동일**(일부 optional) | E2E 실측 |

**호스트·경로를 하드코딩할 필요가 없다.** 현행 `parseAuthURL`은 캐시에서 발견한 URL의 실제 host+path를 그대로 쓴다(`cache.go:97-99`). ZZZ도 URL 필터 문자열이 `getGachaLog`으로 같으므로 이 로직은 **한 줄도 바뀌지 않는다**.

### E2E 실측 결과 (2026-08-15, 캐시 `2.51.0.0`)

실제 게임 캐시에서 authkey 를 뽑아 4개 채널을 모두 조회했다. 앱 자체 코드 경로(`readShared` → `parseAuthURL`)를 그대로 사용했다.
컨텍스트: `api_base=https://public-operation-common-sg.hoyoverse.com/common/gacha_record/api/getGachaLog`, `region=prod_gf_jp`, `lang=ko`.

1. **응답 `gacha_type` 은 요청 `real_gacha_type` 과 같은 1자리 코드다** — `1`/`2`/`3`/`5`. `2001`/`2011` 같은 4자리 코드는 응답에 등장하지 않는다(§미해결 위험 4 해소). UIGF v4.0 스키마와 일치하므로 **코드 정규화 로직은 불필요**하다.
2. **`real_gacha_type` 이 authkey URL 의 베이스 쿼리에 이미 들어 있다.** `pageKeys` 에 추가하지 않으면 페이지 조립 시 파라미터가 중복되고 **서버가 앞의 값을 채택**해 4개 채널이 전부 같은 결과를 반환한다(1차 프로브에서 실제로 재현됨). 따라서 `pageKeys` 추가는 선택이 아니라 **필수**다.
3. **`rank_type` 이 HSR 과 다른 2/3/4 체계다.** ZZZ 는 B급=`2`, A급=`3`, S급=`4`. 실측 샘플: 파이퍼(A급 에이전트)=`3`, 「루나」-초승달(B급 W-엔진)=`2`, 돌아온 날개의 시(S급 W-엔진)=`4`. → §3 참조.
4. **`gacha_id` 가 전 레코드 `"0"` 이다.** 배너 인스턴스 식별에 쓸 수 없다. 현행 `wasPickup` 이 시각 기반이라 설계에 영향은 없다.
5. **API 응답의 `name`·`item_type` 이 authkey 의 `lang` 을 따라 현지화되어 온다.** `lang=ko` 에서 `item_type="에이전트"` / `"W-엔진"`, `name="파이퍼"`. → §미해결 위험 1(다국어) 이 크게 완화된다.
6. 게임 내 표기는 "음의 엔진"이 아니라 **"W-엔진"** 이다(§5 i18n 용어표 정정).

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
- **랭크 코드 주입 (실측 3 대응).** `analyze.js` 에 `rank_type` 리터럴이 3개소 박혀 있다(`:85` 최고등급 판정, `:118` 최고등급 카운트·목록, `:147` 중간등급/그 외 분류). HSR 은 최고=`'5'`·중간=`'4'`, ZZZ 는 최고=`'4'`·중간=`'3'` 이므로 그대로 두면 ZZZ 집계가 **전부 오작동**한다. `banners` 와 같은 패턴으로 `schedule.json` 의 `ranks` 블록에서 주입한다. 없으면 HSR 기본값(`{top:"5", mid:"4"}`)으로 폴백해 구 `schedule.json` 호환을 유지한다.
- `expAvg`(이론 기준선)는 ZZZ 값을 별도 산출해 `schedule.json`에 넣는다. HSR과 같은 방식(기본확률+소프트피티 모델)으로 계산하되, **수치는 스크립트로 산출하고 근거를 주석에 남긴다.**

`schedule.json` 확장 스키마(추가분만):
```json
{
  "version": 1,
  "ranks": { "top": "4", "mid": "3" },
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
HSR `web/schedule.json` 에도 같은 `ranks`·`banners` 블록을 추가한다(값은 현행 내장 테이블과 동일). 이후 확률 공시가 바뀌면 릴리스 없이 데이터 채널로 반영할 수 있게 된다.

### 4. 데이터 추출 — `scripts/extract-zzz-schedule.mjs` (신규)

`banners/zzz_formatted.json` → `web/zzz/schedule.json` 의 `schedule`·`versions`.

- `banner_type` `2`(독점) → `c`, `3`(음의 엔진) → `l`. 같은 `start_time` 구간끼리 병합해 한 항목으로 만든다.
- `uprate_5[].id` 를 그대로 `item_id` 로 쓴다.
- **타임존 정규화**: 소스의 `start_time.time` 은 `+08:00`/`+01:00` 이 섞여 있고 `is_server_time` 플래그가 따로 있다. 이를 UTC로 정규화한 뒤 날짜(`YYYY-MM-DD`)만 취한다. `wasPickup` 이 ±60일 여유를 두므로 하루 오차는 판정에 영향 없다.
- `versions` 는 소스에 없으므로 별도 상수 테이블로 관리한다(HSR과 동일하게 신규 패치마다 수동 1줄 추가).
- `npm run schedule:status` 를 두 게임 모두 보고하도록 확장한다.

**아이템 이름** — 실측 5 에 따라 **API 응답의 `name` 이 authkey `lang` 을 따라 현지화되어 오므로 이것이 주 소스**다. `zzz_formatted.json` 의 영문 `name` 은 픽업 배너 표시용 폴백으로만 쓴다.

### 5. 대시보드

- 헤더에 **게임 스위처**(HSR / ZZZ). 선택은 `localStorage('hsrwarp-game')` + `config.json`의 `active_game`.
- `data.js` 어댑터가 게임별 용어를 i18n 키로 매핑한다: 워프→신호 검색, 광추→**W-엔진**, 캐릭터→에이전트, 5★→S급(실측 6 기준 인게임 표기). **분석 로직은 여전히 `analyze.js` 단일 소스.**
- 뷰 컴포넌트(`OverviewView`/`BannersView`/`HistoryView`/`VersionsView`)는 재사용한다. 본디 채널 카드가 하나 늘고, 픽승률 관련 UI는 `rateUp: null` 배너에서 `-` 로 표시(현행 일반 배너와 동일 처리).

## 테스트 계획 (구현 전에 작성한다)

**Go**
- `game`: `ByID` 왕복, 모든 게임이 유효한 `Role` 만 쓰는지 검증.
- `collector`: ZZZ `Game`으로 `FindAuthContext` 가 `ZenlessZoneZero_Data` 를 본다(임시 디렉터리 픽스처). `FetchIncremental` 이 `real_gacha_type=2` 쿼리를 발행한다(`httptest` 서버로 요청 URL 검증) — HSR은 `gacha_type=11` 그대로.
- `collector`: **베이스 쿼리에 `real_gacha_type` 이 이미 들어 있는 authkey URL**(실측 2 의 실제 형태)을 픽스처로 넣고, 조립된 요청 URL에 `real_gacha_type` 이 **정확히 한 번만** 나타나며 그 값이 우리가 지정한 채널 코드인지 검증한다. 이 테스트가 없으면 4채널이 조용히 같은 데이터를 반환하는 회귀를 못 잡는다.
- `store`: `data/hsr`·`data/zzz` 동시 기록 시 상호 격리. **기존 `TestWriteAffectedMonths_PreservesUntouchedMonths` 는 무변경 통과해야 한다.**
- 마이그레이션: `data/warp_*.json` → `data/hsr/` 이동이 멱등이고, 이미 `data/hsr/` 가 있으면 무동작.
- `server`: `?game=zzz` 라우팅, 미지정 시 `hsr` 폴백, 알 수 없는 값 400.
- `updater`: `EffectiveSchedule("zzz")` 가 `data/zzz-schedule.json` override 를 내장본보다 우선한다.
- `config`: 구 스키마(`{"game_path":…}`) → 신 스키마 승격.

**JS (`web/analyze.test.js`)**
- **랭크 매핑**: `ranks:{top:"4",mid:"3"}` 인 ZZZ 픽스처에서 `rank_type:"4"` 가 최고등급으로, `"3"` 이 중간등급으로, `"2"` 가 그 외로 집계된다. `ranks` 가 없는 구 `schedule.json` 은 HSR 기본값(`5`/`4`)으로 폴백한다.
- ZZZ 픽스처: 독점 채널 90천장 + 50/50 픽승/픽뚫/확정 전이.
- 음의 엔진 80천장 + 75/25.
- 본디 채널: 천장·평균은 집계되되 `win5050Rate === null`.
- 상시 채널: 픽업 판정 없음(`isPickup === null`).
- `banners` 블록이 없는 구 `schedule.json` 이 들어와도 HSR 결과가 현행과 동일(회귀 방지).
- BigInt id 비교 불변식 유지.

**스크립트**
- `extract-zzz-schedule.mjs`: 고정 입력 픽스처 → 기대 출력 스냅샷. 타임존 혼재 케이스 포함.

## 미해결 위험

1. ~~**ZZZ 아이템명 다국어 소스 미확정.**~~ **완화됨(실측 5).** API 응답의 `name`·`item_type` 이 authkey 의 `lang` 을 따라 현지화되어 온다(`lang=ko` 에서 한국어 확인). 사용자 기록 표시에는 별도 다국어 원본이 필요 없다. **남는 한계**는 픽업 배너 목록(`schedule.json` 의 `c`/`l` 은 `item_id` 만 담으므로 표시용 이름이 필요) 뿐이며, 이는 영문 폴백으로 간다. 전면 다국어는 후속 이슈.
2. **소스 repo 의존.** `FuriaPaladins/Hoyoverse-Data` 는 소규모 repo다. 다만 산출물(`web/zzz/schedule.json`)을 우리 repo에 벤더링하므로 **런타임 의존은 없다** — 소스가 죽어도 기존 사용자 앱은 정상 동작하고, 신규 패치 반영 경로만 막힌다. 그때는 인게임 공시 원문을 직접 긁는 대체 경로로 전환한다.
3. ~~**E2E 검증 전제조건.**~~ **해소됨(2026-08-15).** 게임 내 [신호 검색] → [기록] 화면을 연 뒤 캐시 `2.51.0.0` 에서 authkey 추출·4채널 조회에 성공했다. 이후 재검증 시에는 authkey ~24시간 제약이 동일하게 적용된다.
4. ~~**`real_gacha_type` 4자리 코드 확인 필요.**~~ **해소됨(실측 1).** 응답 `gacha_type` 은 `1`/`2`/`3`/`5` 1자리 코드다. 정규화 로직 불필요.
5. **본디 채널 실데이터 미확보.** 실측 시 `real_gacha_type=5` 조회는 성공했으나(`retcode=0`) 반환된 레코드가 상시 채널과 같은 초기 뽑기라 본디 고유 아이템(`item_type`) 표기를 확인하지 못했다. 본디 카드 UI 문구는 구현 중 실데이터로 재확인한다.

## 범위 밖 (후속 이슈)

- ZZZ 아이템명 다국어(ko/ja/zh)
- UIGF v4.0 내보내기/가져오기 기능
- 원신(hk4e) 지원 — 어댑터 계층이 생기면 추가는 쉬워지지만 이번 범위가 아니다
