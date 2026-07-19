# 개요 지표 합산(캐릭터+광추) · 배너별 지표 추가 · 버전 테이블 DESC — 설계

날짜: 2026-07-20 · 상태: 승인됨 (목업 + 선택지 확정) · PR: #45에 포함

## 배경

- 개요 탭 히어로의 세 지표가 배너 기준이 제각각이다: 운 지표=캐릭터 이벤트+일반(11+1), 픽승률·평균 뽑기 수=캐릭터 이벤트(11)만.
- 배너별 탭에는 운 지표·픽승률이 없다(평균 뽑기 수만 있음).
- 버전 비교 하단 테이블이 버전 오름차순(3.4가 맨 위)이라 최신 버전을 보려면 스크롤해야 한다.

## 결정 사항 (사용자 확정)

1. 개요 탭 운 지표·픽승률·평균 뽑기 수는 **캐릭터(11)+광추(12) 합산**으로 통일한다. 일반(1)은 제외.
2. 합산 산식은 버전 비교 탭 'all' 지표와 동일한 **5★ 개수 가중**: 평균 뽑기 `Σ(avg×n)/Σn`, 이론 기준선 `Σ(expAvg×n)/Σn`(62.5·53.5 가중), 승/패/확정은 단순 합.
3. 운 지표 카드는 **%를 큰 숫자로**(예: -9.4% 불운), 합산 평균 뽑기 수(64.6회)는 보조 텍스트로 강등 — 평균 뽑기 수 카드와의 완전 중복 방지.
4. 픽승률 카드 라벨은 **'픽승률 · 한정 배너'**, 하단에 캐릭터·광추 **각각의 다음 5★(50/50·75/25/확정) 소형 배지 2개**.
5. 배너별 탭은 **기존 스탯 그리드를 2×2 → 3×2로 확장**해 운 지표(%)·픽승률(%) 추가. 일반 배너 픽승률은 '-'(픽업 개념 없음).
6. 버전 비교 **하단 테이블만 버전 DESC**(최신이 위). 상단 막대 차트는 시간순(ASC) 유지.

## 구현 설계

분석 로직은 `web/analyze.js` 단일 소스 원칙을 유지한다(CLAUDE.md). 킷은 어댑트·표시만.

### analyze.js

- 새 헬퍼 `combineLimited(charStats, lcStats)` (export): 두 배너 stats(aggregateFives 산출물)를 받아
  `{ count5, avgPity5, base, luckPct, cWins, cLoss, gWins, contested, win5050Rate, bestPity, worstPity }` 반환.
  - `avgPity5`·`base`는 5★ 개수 가중(한쪽 0개면 다른 쪽 값, 둘 다 0이면 avg=0·base=BANNERS['11'].expAvg).
  - `luckPct = (base − avg)/base×100` (5★ 0개면 null), `win5050Rate = (cWins)/(contested)` (contested 0이면 null).
  - 입력이 null(해당 배너 기록 없음)이어도 동작한다.
- `analyze()`·`filterAnalysis()`의 `luck`에 `limited: combineLimited(lim?.stats, lc?.stats)` 추가. 기존 `charAvgPity` 등 기존 필드는 다른 소비처가 있어 유지.
- 배너별 운 지표·픽승률은 기존 `aggregateFives`의 `luckPct`·`win5050Rate`를 그대로 쓴다(신규 계산 없음).

### data.js (어댑트만)

- `banners[]`에 `luckPct`(= stats.luckPct), `winRate`(= stats.win5050Rate), `contested` 추가.
- `WARP_DATA.limited` 추가: `combineLimited` 결과 + 히어로 배지용 `charGuaranteed`·`lcGuaranteed`(각 배너 currentGuaranteed).
- `luck.markerPct`는 합산 기준으로: `avg/(2×base)×100` (기존 125 = 2×62.5의 일반화, 기준선이 게이지 중앙 50%).

### HeroSummary.jsx

- 운 지표 카드: 큰 숫자 = luckPct%(행운 +green/불운 −red), 보조 텍스트에 합산 평균 뽑기·기준선·5★ 개수. 게이지 유지(markerPct).
- 픽승률 카드: `D.limited.win5050Rate` 기준, 설명은 합산 승부/승/패/확정. 하단 배지: scoped면 기존 '구간 통계' 1개, 아니면 캐릭터·광추 각각 `다음 5★ 50/50(75/25)` 또는 `확정` 2개.
- 평균 뽑기 수 카드: `D.limited.avgPity5`·best/worst.

### BannersView.jsx

- Mini 그리드 3×2: 기존 4개 + 운 지표(부호·색: luckPct≥0 green/미만 red, null '-') + 픽승률(`win%` + `n승 n패`, null '-').

### VersionsView.jsx

- 테이블 렌더만 `[...rows].reverse()`. 차트는 기존 rows(ASC) 그대로.

### i18n (ko/en/zh/ja 4개 파일, 키 패리티 테스트 강제)

- 변경: `hero.luckLabel`(운 지표 · 한정 배너), `hero.winrateLabel`(픽승률 · 한정 배너), `hero.avgLabel`(평균 뽑기 수 · 한정 배너), `hero.luckDescLucky/Unlucky`(합산 문구).
- 추가: `hero.nextBadgeChar`·`hero.nextBadgeLc`(배너명 포함 다음 5★ 배지 2종 — 확정 변형 포함), `banners.luck`, `banners.winrate`, `banners.wl`(n승 n패) 등 필요 최소.

## 테스트 계획 (구현 전 작성)

1. `analyze.test.js` — `combineLimited`: 가중 평균·기준선(26×69.54 + 16×56.63 검증), 승/패/확정 합, 한쪽 0개, 둘 다 0개(null 처리), null 입력.
2. `analyze.test.js` — `analyze()`·`filterAnalysis()` 결과에 `luck.limited` 존재·일관성(전체창 필터 == analyze).
3. i18n 키 패리티는 기존 `i18n.test.js`가 강제.
4. 브라우저 검증: 개요(전체/스코프), 배너별(캐릭터·일반), 버전 테이블 DESC·차트 ASC, 4개 언어 라벨.

## 제외(YAGNI)

- 일반 배너를 운 지표 합산에 포함하는 옵션, 히어로 카드 레이아웃 개편(카드 수 변경), 버전 차트 정렬 토글.
