# ZZZ 픽업 데이터 반영

## 파일

`web/zzz/schedule.json` — **`scripts/extract-zzz-schedule.mjs`가 생성하는 산출물이다.** 직접 편집하면 다음 재생성 때 사라지므로 반드시 스크립트를 고친다.

```bash
node scripts/extract-zzz-schedule.mjs        # 소스에서 재생성
node scripts/extract-zzz-schedule.test.mjs   # 픽스처 기반 회귀 테스트
```

## 데이터 소스

[FuriaPaladins/Hoyoverse-Data](https://github.com/FuriaPaladins/Hoyoverse-Data) — GitHub Actions로 매일 자동 수집.

- `banners/zzz_formatted.json` — 배너별 `banner_type`, `start_time`/`end_time`, `uprate_5`(item_id + 이름), `uprate_4`
- `banners/zzz/<gacha_id>.json` — 인게임 공시 원문. `items_up_star_5`와 구조화된 확률 필드(`base_prob_star5`, `general_prob_star5`, `up_prob`)를 담는다

산출물을 repo에 벤더링하므로 런타임 의존은 없다. 소스가 죽어도 기존 사용자 앱은 정상 동작하고 신규 패치 반영 경로만 막힌다.

## 소스가 픽업 id를 비우는 경우

**이것이 이 게임에서 가장 자주 겪는 문제다.** 소스가 신규 배너의 이름과 기간은 담으면서 `uprate_5`를 빈 객체(`[{}]`)로 두는 일이 있다. 그동안 그 기간의 S급은 픽업 목록에 없으므로 전부 픽뚫로 오판된다.

`scripts/extract-zzz-schedule.mjs`의 `UPRATE_FALLBACK` 테이블이 이를 보완한다. **배너 이름**을 키로 픽업 id를 넣어 두면, 소스의 `uprate_5`가 비었을 때만 이 값이 쓰인다. 소스에 id가 들어오면 소스가 이기므로 갱신 시 자동으로 무효가 된다.

```js
const UPRATE_FALLBACK = {
  // ZZZ 3.1 (2026-07-29 ~ 09-08). 근거: 공식 3.1 배너 안내(레미엘 독점 채널
  // "Paradise Regained", 시그니처 W-엔진 "Ode of Resurrected Wings")와
  // 실제 수집 데이터에서 확인한 item_id — 레미엘 1581, 돌아온 날개의 시 14158.
  'Paradise Regained': ['1581'],
  'Ode of Resurrected Wings': ['14158'],
};
```

**항목마다 근거를 주석으로 남긴다.** 소스가 나중에 채우면 이 항목은 무의미해지는데, 근거가 없으면 지워도 되는지 판단할 수 없다.

배너 이름은 소스의 `name` 필드와 **정확히** 일치해야 한다. 웹 검색으로 찾은 영문 배너명이 소스와 다를 수 있으므로, 넣기 전에 소스에서 확인한다.

```bash
node -e "
const d=require('./zzz_formatted.json');   // 소스를 받아 둔 경로
const all=[]; for(const v of Object.values(d)) if(Array.isArray(v)) all.push(...v);
for(const b of all.filter(b=>(b.start_time?.time||'')>='2026-07'))
  console.log(b.name,'|',b.banner_type,'|',(b.uprate_5||[]).map(u=>u?.id??'(빈)').join(','));
"
```

한정 캐릭터에는 전용 W-엔진 배너가 함께 열린다. **두 항목을 짝으로 넣는다.**

## 소스 데이터의 함정

추출 스크립트가 이미 방어하고 있지만, 손댈 때 깨뜨리지 않도록 알아 둔다.

| 함정 | 실태 | 방어 |
|---|---|---|
| top-level 키 불일치 | 키 `"3"` 배열에 `banner_type: 2`가 섞여 있다 | `banner_type` 필드를 권위로 삼는다 |
| `banner_type` 오표기 | 음의 엔진 배너가 `2`로 표기된 사례 | id 자릿수(4=에이전트/5=W-엔진)로 pool 교정 |
| 필드명 혼재 | 초기 항목 `rank`, 최신 항목 `rarity` | `uprate_5`는 이미 5성 전용이라 등급 필드를 안 읽는다 |
| id 타입 혼재 | string과 number가 섞임 | `String()` 정규화 |
| 타임존 혼재 | `+08:00`/`+01:00` + `is_server_time` 플래그 | 원문 문자열의 `YYYY-MM-DD` 앞부분을 그대로 취한다 |
| 특별 채널 | `banner_type` 12/13 | 각각 독점·음의 엔진과 확률이 같아 `c`/`l`로 매핑 |

**타임존을 UTC로 완전 변환하면 안 된다.** `+08:00`의 `02:00`이 UTC로 가면 전날이 되어 배너 시작일이 하루 밀린다. `analyze.js`의 `wasPickup`은 레코드의 게임 로컬 시각과 비교하므로 일정도 게임 로컬 날짜여야 일관된다. `wasPickup`이 ±60일 여유를 두므로 하루 오차는 판정에 영향이 없다.

## 채널 코드

| `real_gacha_type` | 역할 | 천장 | 픽업 확률 | 종합확률 | `expAvg` |
|---|---|---|---|---|---|
| `2` | 독점 / 에이전트 (`limited-char`) | 90 | 50% | 1.600% | 62.5 |
| `3` | 음의 엔진 / W-엔진 (`limited-weapon`) | 80 | 75% | 2.000% | 50.0 |
| `1` | 상시 (`standard`) | 90 | — | 1.600% | 62.5 |
| `5` | 본디 (`bangboo`) | 80 | — | 2.000% | 50.0 |

`expAvg = 1 / 종합확률`이며 종합확률은 인게임 공시의 `general_prob_star5`다. 추정이 아니다.

**`rank_type`이 HSR과 다르다** — B급=`2`, A급=`3`, **S급=`4`**. `schedule.json`의 `ranks` 블록(`{top:"4", mid:"3"}`)이 이를 주입한다.

대시보드는 `limited-char`와 `limited-weapon` 두 축만 표시한다(`data.js`의 `HIDDEN_ROLES`).

## 반영 후 확인

```bash
node scripts/extract-zzz-schedule.test.mjs
node scripts/extract-zzz-schedule.mjs
node .claude/skills/banner-pickup-lookup/scripts/diagnose-pickups.mjs zzz
npm test
```

재생성 로그의 **건너뜀 건수가 0인지** 확인한다. 0이 아니면 아직 픽업 id가 없는 배너가 남아 있다는 뜻이다.

```
web/zzz/schedule.json 기록 — 일정 36건, 건너뜀 0건, 교정 3건
```

`web/zzz/schedule.json`은 생성물이지만 **repo에 커밋한다** — 사용자 앱에 임베드되기 때문이다.

## 게임 버전 목록

`VERSIONS` 상수에 확인된 `{v:'1.0', s:'2024-07-04'}` 하나만 들어 있다. 나머지 버전 경계는 소스에 없어 확인이 필요하다.

**추측으로 채우지 않는다.** 일부만 넣으면 빠진 구간이 앞 버전에 흡수되어 오히려 더 틀린다. 비어 있으면 버전 비교 탭만 비고 다른 지표는 전부 정상이다.

## 알려진 한계

소스가 신규 배너를 늦게 수집하면 `UPRATE_FALLBACK`에 손으로 추가하기 전까지 같은 오판이 반복된다. 근본 해결(픽업 정보가 없는 구간의 5성을 `unidentified`로 처리)은 이슈 #52에 있다.
