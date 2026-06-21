# 게임 버전별 통계 화면 — 설계

> 대상 이슈: [#2 feat: 게임 버전별 통계 화면 추가](https://github.com/jkas2016/hsr-warp/issues/2)
> 작성일: 2026-06-09

## 배경 / 목표

대시보드는 현재 **전체 기간** 통계만 보여준다. 스타레일 게임 버전(패치)별로 천장·운·픽승/픽뚫을 끊어서 보고 싶다.

SRGF 레코드엔 워프 시각(`time`)만 있고 게임 버전 필드가 없다. 따라서 **시각 → 버전** 매핑이 필요하다.

## 핵심 결정 (브레인스토밍 합의)

| # | 결정 | 선택 | 근거 |
|---|------|------|------|
| 1 | 구간 단위 | **버전 단위**(3.0, 3.1 …) | 이슈 명시. 페이즈(3주)는 5★ 0~1개라 구간 통계가 무의미. 버전(~6주, 5★ 2~4개)이면 의미 있음 |
| 2 | 버전→기간 매핑 위치 | **`schedule.json`에 `versions` 배열 추가** | 50/50용 `schedule` 배열 불변. 기존 자동 갱신 채널 그대로 타 신규 버전도 릴리스 없이 반영. `analyze.js`에 상수로 두면 앱 릴리스 필요 |
| 3 | 경계 넘는 5★ 계산 | **전체 1회 분석 후 획득 시점 버전에 귀속** | 천장·50/50 상태는 버전 경계를 넘어 연속. 구간 슬라이스 후 재분석은 경계 5★의 천장을 잘라먹고 확정 상태를 잃어 50/50 오판. 정확하고 코드도 더 적음 |
| 4 | UI | **버전 드롭다운 필터 + 「버전별 비교」 표 (둘 다)** | 필터로 버전별 깊은 드릴다운(기존 차트·기록표 재사용) + 비교표로 버전 간 추세 한눈에 |

## 1. 데이터 — `web/schedule.json`

기존 파일에 top-level `versions` 배열을 추가한다. `schedule` 배열은 **건드리지 않는다**(50/50 단일 소스).

```json
{
  "version": 30,
  "schedule": [ /* 기존 {s,e,c,l} 항목 그대로 */ ],
  "versions": [
    {"v": "1.0", "s": "2023-04-26"},
    {"v": "1.1", "s": "2023-06-07"},
    "...",
    {"v": "3.7", "s": "2025-11-04"}
  ]
}
```

- **윈도우 규칙**: 버전 N의 구간 = `[s_N, s_{N+1})`, 마지막 버전 = `[s_last, ∞)`. `analyze.js`가 `s` 기준 오름차순 정렬 후 사용한다.
- **Go 호환**: `internal/updater/updater.go`의 `ScheduleVersion`은 `json.Unmarshal`로 `version`·`schedule[].s/e`만 검증하고 미지 필드는 무시한다(`DisallowUnknownFields` 미사용 — 확인됨). 따라서 `versions` 추가는 자동 갱신 검증을 깨지 않는다.
- **백필**: 1.0~현재 약 28줄. 버전 출시일은 공개 정보. 앵커 예시: 3.7 = 2025-11-04(`analyze.test.js` 주석 기준).
- **유지보수**: 신규 게임 버전 시작 시 `versions`에 1줄 추가 + top-level `version` +1. 기존 패치 추가 절차(`schedule`에 `{s,e,c,l}` 추가)에 한 줄 더하는 수준.

## 2. 로직 — `web/analyze.js`

순수 함수, 의존성 0, UMD(브라우저=`window.WarpAnalyze`, Node=`module.exports`) 유지. 기존 `analyze(data, schedule)`/`analyzeBanner`는 **시그니처·반환 모양 그대로** 둔다(하위호환).

추가/리팩터:

### 2.1 `aggregateFives(fives, meta)` (신규, 내부 추출)
이미 분류된 5★ 배열에서 요약치를 재계산해 반환한다:
`count5, avgPity5, bestPity, worstPity, luckPct, contested, cWins, cLoss, gWins, unknown5, win5050Rate, pickupTotal`.

- **천장(`pity`)·결과(`result`)·`isPickup`는 절대 재계산하지 않고 입력 fives 값을 그대로 집계** → 결정 #3 보장.
- `analyzeBanner`가 fives를 분류(classification)한 뒤 이 함수를 호출하도록 리팩터해 중복 로직을 제거한다. `analyzeBanner`의 외부 반환 모양은 불변.

### 2.2 `filterAnalysis(full, data, window)` (신규)
`analyze()`와 **동일한 모양**의 결과 객체를 시각 윈도우 `{s, e}`로 필터해 반환한다.

- 분류된 5★: `full.banners[].stats.fives`를 `time ∈ [s, e)`로 필터 후 `aggregateFives`로 재집계.
- 뽑기 횟수/성옥/3·4★ 카운트: `data.list`를 `gacha_type`별로 돌며 `time ∈ [s, e)`만 카운트(시각 버킷).
- `monthly`, `all5`도 윈도우로 필터.
- 결과를 기존 `analyze()` 모양으로 조립 → 대시보드 `render()`를 그대로 재사용.

### 2.3 `analyzeVersions(full, data, versions)` (신규)
각 버전 윈도우에 2.2 집계를 적용해 **비교표용 행 배열**을 반환한다. 뽑기 0인 버전은 제외. 각 행:
`{ v, s, e, total, jade, count5, charAvgPity, charCWins, charCLoss }`.

### 2.4 `currentPity5` / `currentGuaranteed`
"지금 시점" 끝상태라 **'전체'에서만** 의미. 과거 버전 필터 뷰에선 천장 진행바를 숨긴다(렌더 레이어 처리).

## 3. UI — `web/dashboard.html`

- **버전 드롭다운**: 상단(패널 영역). 기본값 `전체`. 옵션은 뽑기가 있는 버전만 최신순. 변경 시 `전체`면 `full`, 아니면 `filterAnalysis(full, data, window)` 결과로 hero·요약 카드·배너 카드·차트·월별·5★ 기록표 전부 재렌더.
- **「버전별 비교」 섹션**: 요약 카드 바로 아래 신설. 컬럼: 버전 / 기간 / 뽑기 / 5★ / 캐릭 평균천장 / 캐릭 픽승-픽뚫. `analyzeVersions` 결과를 렌더. **드롭다운 선택과 무관하게 항상 전 버전 표시**, 현재 선택 버전 행 강조.
- **행 클릭 = 그 버전으로 드롭다운 선택** → 필터 뷰 갱신(A·C 연결, 추가 비용 최소).
- 필터 뷰에서 `currentPity5`/`currentGuaranteed` 의존 표시(천장 진행바, "다음 확정" 배지)는 `전체`일 때만 노출.

## 4. 테스트 — `web/analyze.test.js`

프로덕션 코드 전에 작성한다(TDD).

1. **경계 넘는 5★**: 3.0 후반 픽뚫 → 천장 적립 중 3.1에서 확정 5★. `filterAnalysis`로 3.1 윈도우 집계 시 그 5★의 천장(예: 70)·결과(`guaranteed`)가 잘리지 않고 그대로 귀속됨을 확인.
2. **뽑기 버킷팅**: 서로 다른 버전 창의 레코드가 `total`/`jade`/`count3·4·5`로 시각 기준 정확히 분리됨.
3. **불변식**: `filterAnalysis(full, data, {전체 범위})`의 핵심 수치가 `analyze()` 결과와 일치.
4. **`analyzeVersions`**: 뽑기 0인 버전은 행에서 제외. 행 수·컬럼 값 검증.
5. **방어**: `versions` 누락/빈 배열 → throw 없이 비교표 빈 배열, 필터는 `전체`만 동작.

## 범위 밖 (YAGNI)

- 페이즈 단위 드릴다운.
- 버전 간 추세 차트(비교는 표로 충분; 필요 시 후속 이슈).
- 버전별 데이터 export.

## 변경 파일

- `web/schedule.json` — `versions` 배열 추가 + 백필.
- `web/analyze.js` — `aggregateFives`/`filterAnalysis`/`analyzeVersions` 추가, `analyzeBanner` 리팩터.
- `web/dashboard.html` — 드롭다운, 비교표 섹션, 필터 재렌더.
- `web/analyze.test.js` — 위 단위 테스트.

## 참고

- 기존 50/50 판정 로직: `web/analyze.js:22` `wasPickup`, `web/analyze.js:32` `analyzeBanner`.
- 자동 갱신 검증: `internal/updater/updater.go:31` `ScheduleVersion`.
- 배너 일정 서빙(data/ override > 내장본): `internal/server/server.go:231` `handleSchedule`.
- 도메인 규칙: `docs/ARCHITECTURE.md`.
