# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

자가 호스팅 호요버스 스타레일(HSR) 워프(가챠) 기록 추적기. 게임 캐시에서 authkey를 추출해 비공식 `getGachaLog` API를 호출하고, 데이터를 SRGF v1.0 형식으로 저장한 뒤 데이터 내장형 단일 HTML 대시보드를 생성한다. 모든 처리는 로컬에서만 일어난다. 빌드 시스템·패키지 매니저 없음 — PowerShell 5.1+ 와 Node.js(프레임워크 없는 내장 `assert`)만 쓴다.

## Commands

```powershell
# 테스트 (둘 다 평범한 node 스크립트, 통과 시 "OK ..." 출력 후 exit 0)
node analyze.test.js        # analyze.js 단위 테스트
node sim_incremental.js     # 증분 조회/병합/월별 분류 로직 검증

# 합성 데이터 생성 → warp_data.sample.json (대시보드/분석 수동 확인용)
node gen_sample.js

# 메인 파이프라인: 증분 조회 → data\warp_YYYYMM.json → HSR_Warp_Dashboard.html
powershell -ExecutionPolicy Bypass -File .\Update-HSRDashboard.ps1
powershell -ExecutionPolicy Bypass -File .\Update-HSRDashboard.ps1 -GamePath "D:\경로\Star Rail Games"

# 일회성 전체 덤프 → warp_data.json
powershell -ExecutionPolicy Bypass -File .\Get-HSRWarp.ps1

# 매달 자동 실행 등록/해제 (Windows 작업 스케줄러)
powershell -ExecutionPolicy Bypass -File .\Register-Schedule.ps1
powershell -ExecutionPolicy Bypass -File .\Register-Schedule.ps1 -Remove -Day 15 -Time 21:00
```

테스트 러너가 없으므로 개별 테스트만 돌리려면 해당 `node <file>.js`를 실행한다. 두 테스트 파일 모두 평탄한 단언 스크립트로, 첫 실패에서 throw 후 종료한다.

## Architecture

**`analyze.js` 가 분석 로직의 단일 소스이자 등시성(isomorphic) 핵심이다.** UMD 형태 IIFE로, 브라우저에서는 `window.WarpAnalyze`, Node에서는 `module.exports`를 노출한다. 이 파일은 두 곳에서 동시에 쓰인다: (1) `analyze.test.js` 가 `require`로 직접 테스트, (2) `Update-HSRDashboard.ps1` 이 파일 텍스트를 통째로 대시보드 HTML에 주입. **따라서 의존성이 없어야 하고 Node 전용/브라우저 전용 API를 써서는 안 된다.**

**중심 도메인 규칙 — 50/50 픽뚫 판정** (`analyzeBanner`): 한정 배너 5★의 `item_id`가 `STANDARD` 풀에 있으면 픽패(loss), 없으면 픽뚫(win). 픽패는 `guaranteed=true`를 세팅해 다음 5★를 확정 획득으로 만든다. HoYo가 표준 풀을 바꾸면 **`analyze.js` 상단의 `STANDARD` 배열만 수정**하면 된다 — 이것이 문서화된 유지보수 지점이다. `gacha_type` 코드: `11`=캐릭터, `12`=광추, `1`=일반(스텔라), `2`=출발.

**두 PowerShell 수집기는 동일한 authkey 추출 로직을 중복 구현한다.** 둘 다 게임 캐시의 `StarRail_Data\webCaches\<버전>\Cache\Cache_Data\data_2` 바이너리를 복사해 ASCII로 읽고 정규식으로 `authkey=` URL을 뽑아 API 파라미터를 구성한다.
- `Get-HSRWarp.ps1` — 일회성 전체 덤프. `warp_data.json` 하나를 쓰고 끝(대시보드에 끌어다 놓는 용도).
- `Update-HSRDashboard.ps1` — 메인 파이프라인. 배너별 최신 `id`를 추적해 **저장된 것보다 최신 기록만** 조회하고(증분), 전체를 월별 파일 `data\warp_YYYYMM.json`로 재작성한 뒤, `dashboard.template.html`의 마커 `/*__ANALYZE_JS__*/` 와 `/*__DATA__*/ null` 를 각각 analyze.js 텍스트·JSON 데이터로 치환해 자체포함 대시보드를 생성한다.

**`sim_incremental.js` 는 PowerShell 증분 로직의 JS 포팅이다.** PS 파이프라인 자체는 단위 테스트가 어렵기 때문에, 증분 조회(newer-than-stored)·병합·월별 분류 알고리즘을 JS로 충실히 옮겨 모의 서버로 검증한다. **PS 쪽 로직을 바꾸면 이 포팅도 손으로 동기화해야 한다** — 둘 사이에 공유 코드는 없다.

**ID는 매우 큰 정수다.** 실제 경로에서 비교 시 `[decimal]`(PS) / `BigInt`(JS)로 다룬다 — `Number`로 비교하면 정밀도가 깨진다.

## Gotchas

- authkey는 게임에서 **전언 기록 화면을 최근 ~24시간 내 한 번 열어야** 유효하다. 스케줄 실행 시 유효 authkey가 없으면 조회는 그냥 실패하고 멈춘다(설계된 동작).
- 데이터 형식·`gacha_type` 코드·표준 풀·확률은 외부 명세에 묶여 있다: SRGF v1.0(uigf.org), Prydwen(50/50 규칙·확률), StarRailRes(item_id 검증). 상수 변경 시 README의 출처를 따른다.
- 월별 파일은 매 실행마다 전량 삭제 후 재작성된다(append 아님).
