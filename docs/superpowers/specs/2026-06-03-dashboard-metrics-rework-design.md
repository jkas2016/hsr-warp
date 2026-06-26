# 대시보드 지표 재설계 — 천장/픽승·픽뚫/analyze.js 단일화

날짜: 2026-06-03
대상 브랜치: feat/single-exe-rewrite

## 목적

대시보드가 보여주는 가챠 지표 3가지를 정정한다.

1. **소프트천장 개념 제거** — 천장(캐릭터 90 / 광추 80) 기준으로만 표시한다.
2. **픽승/픽뚫 판정 정정** — 5★가 한정 배너 대상(픽업) 캐릭터/광추이면 **픽승**, 아니면(상시풀에 없어도) **픽뚫**으로 판정한다.
3. **`analyze.js` 중복 제거** — 루트와 `web/`에 동일 파일이 이중 유지되던 것을 단일 소스로 통일한다.
4. **`docs/superpowers/`·`tools/` 추적 해제** — 로컬 기획 산출물·개발 도구를 gitignore하고 git에서 제거한다.

## 비목표 (YAGNI)

- 픽업 기간(gacha_id)별 정밀 판정 도입 — 본 작업에서 하지 않음.
- 색 구간(`pityColor`) 개편 — 소프트천장과 무관한 단순 색띠이므로 유지.
- 무관한 리팩터링.

## Task 1 — 소프트천장 제거, 천장 기준 표시

### 변경

- `web/analyze.js`
  - `BANNERS[].soft` 필드 삭제.
  - `analyzeBanner`에서 `early`/`earlyCount`/`earlyRate` 계산·반환 제거.
- `web/dashboard.html`
  - "소프트천장 이전 획득률" 카드(현재 `earlyRate`, "74회 이전 획득") → **"평균 천장"** 카드로 교체.
    - 큰 숫자 = `avgPity5`(소수 1자리).
    - 보조 설명 = `최고 운 {bestPity}회 · 최악 {worstPity}회`.
  - 진행바·`pityColor`(green<60 / orange≤80 / red>80)는 천장(90/80) 대비 색띠이므로 그대로 둔다.

### 영향

`meta.soft`를 참조하던 코드가 사라진다. 천장 대비 위치(진행바·평균/최고/최악)만 남는다.

## Task 2 — 픽승/픽뚫 (한정 픽업 목록 명시 + 미확인 플래그)

### 데이터

- `web/analyze.js`에 `LIMITED = { char: [item_id...], lc: [item_id...] }` 추가.
- 도출: StarRailRes(`index_min/en`, CLAUDE.md에 명시된 item_id 검증 출처)의 **전체 5★ 캐릭터/광추에서 상시 7종을 제외**한 집합. 2026-06 기준 최신까지 포함.
- 기존 `STANDARD`(상시 7종)는 **미확인 플래그 판별용으로 유지**.

### 판정 (`analyzeBanner`, `meta.kind==='limited'`)

5★ 한 개에 대해:

- 확정 상태(`guaranteed===true`)에서의 5★ → `result='guaranteed'`(**확정**), 확정 소진. (게임 규칙상 픽업 보장)
- 그 외(contested):
  - `item_id ∈ LIMITED[pool]` → `result='win'`(**픽승**)
  - `item_id ∉ LIMITED[pool]`(상시·미상 포함) → `result='loss'`(**픽뚫**) → 다음 5★ 확정(`guaranteed=true`)
- **미확인 플래그**: `item_id`가 `LIMITED[pool]`·`STANDARD[pool]` 어디에도 없으면 해당 5★에 `unidentified=true` 표시하고 배너 통계에 `unknown5` 카운트 누적.

### 표시 (`web/dashboard.html`)

- `resText` = `{win:'픽승', loss:'픽뚫', guaranteed:'확정'}` (현재 win→'픽뚫', loss→'픽패'에서 정정).
- `resClass`는 색 매핑이므로 의미 유지(win=금색, loss=빨강, guaranteed=초록).
- "픽뚫률 · 캐릭터 50/50" → "**픽승률** · 캐릭터 50/50".
- "다음 5★ 확정 (픽패 상태)" → "다음 5★ 확정 (**픽뚫** 상태)".
- "픽뚫 / 픽패 / 확정" 행 → "**픽승 / 픽뚫 / 확정**".
- 차트 라벨: `cWins`='**픽승**', `cLoss`='**픽뚫**'.
- 50/50 판정 캡션(line 95): 새 판정 방식·라벨로 갱신.
- **미확인 경고**: `unknown5 > 0`이면 작은 경고 표시("미확인 5★ {n}개 — 목록 갱신 필요"). 목록 staleness를 즉시 알림.

### 트레이드오프 (확인 완료)

목록 기반 양성 판정은 **목록에 아직 없는 신규 한정을 픽뚫로 오표시**하므로 매 패치 갱신이 필요하다. 미확인 플래그가 이 staleness를 가시화해 부담을 완화한다.

## Task 3 — analyze.js 단일화

- 루트 `analyze.js` 삭제.
- `analyze.test.js` → `web/analyze.test.js`로 이동, `require('./analyze.js')`(동일 디렉터리).
- `package.json`:
  - `sync-analyze`, `prebuild` 스크립트 삭제(이중 복사 메커니즘 제거).
  - `test`: `... && node web/analyze.test.js`.
  - `test:analyze`: `node web/analyze.test.js`.
- `main.go`(`//go:embed web/analyze.js ...`)·서버 FileServer(`web/` 서빙)은 변경 없음.
- `CLAUDE.md`의 "analyze.js 두 곳 동기화" 문단을 단일 소스로 갱신, "소프트천장"/"상시풀 유무" 판정 설명을 새 판정으로 갱신.

## Task 4 — docs/superpowers·tools 추적 해제

현재 추적 중: `docs/superpowers/plans/*`, `docs/superpowers/specs/*`, `tools/genicon/main.go`.

- `.gitignore`에 추가:
  ```
  # 로컬 기획 산출물(superpowers) · 개발 도구 — 추적 안 함
  docs/superpowers/
  tools/
  ```
- `git rm -r --cached docs/superpowers tools` — 작업 트리(디스크)는 보존, 인덱스에서만 제거.
- 영향: 이 설계 문서를 포함한 `docs/superpowers/` 산출물은 로컬 참조용으로만 남고 커밋되지 않는다. `tools/genicon`은 루트만 빌드하는 `go build -o hsr-warp.exe .`에 영향 없음(개발 시 디스크에 존재).

## 테스트 계획 (TDD — 프로덕션 전에 작성)

`web/analyze.test.js`(이동 후):

- **픽승**: contested 5★ item_id ∈ LIMITED → `result='win'`, `cWins++`.
- **픽뚫**: contested 5★ item_id ∉ LIMITED(상시 id) → `result='loss'`, `guaranteed=true`.
- **픽뚫(미확인)**: LIMITED·STANDARD 어디에도 없는 id → `result='loss'` **그리고** `unidentified=true`, 배너 `unknown5`++.
- **확정**: 픽뚫 다음 5★ → `result='guaranteed'`, 픽업이면 정상.
- **천장**: `pity`가 당첨 풀을 포함해 카운트, 5★ 후 리셋(기존 유지).
- **soft 제거**: 결과 객체에 `earlyCount`/`earlyRate` 없음(또는 참조 안 함).
- 기존 monthly/analyze 통합 테스트 유지.

Go 테스트(`internal/...`)는 본 변경과 무관하므로 회귀만 확인.

## 검증

- `node web/analyze.test.js` → "OK ..." exit 0.
- `node scripts/run-go.mjs test ./...` 그린.
- `npm run build` 성공, 실행 시 대시보드에서 천장/픽승·픽뚫/미확인 경고 표시 확인.

## 출처

- 상시 풀·확률·50/50: Prydwen (gacha-system).
- item_id(5★ 캐릭터/광추 전체): StarRailRes `index_min/en`.
- gacha_type 코드·SRGF: uigf.org.
