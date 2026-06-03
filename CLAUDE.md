# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

자가 호스팅 호요버스 스타레일(HSR) 워프(가챠) 기록 추적기. 단일 Go 실행파일(`hsr-warp.exe`)이 게임 캐시에서 authkey를 추출해 비공식 `getGachaLog` API를 증분 호출하고, 데이터를 SRGF v1.0 형식으로 월별 저장한 뒤, 내장(`go:embed`) 대시보드를 로컬 HTTP로 서빙하고 SSE로 진행을 스트리밍한다. 분석은 브라우저의 `analyze.js`가 담당한다. 모든 처리는 로컬에서만 일어난다.

## Commands

```powershell
# 빌드 (정적 단일 exe, 런타임 의존 없음). go 는 PATH 에 없을 수 있음 — 그 경우:
#   $env:Path = 'C:\Program Files\Go\bin;' + $env:Path
go build -ldflags="-s -w" -o hsr-warp.exe .

# 실행 (빈 포트 8787~ 선택 → 브라우저 자동 오픈 → 조회는 UI에서)
.\hsr-warp.exe

# 테스트
go test ./...          # Go 단위 테스트 (internal/collector, internal/store, internal/server)
node web/analyze.test.js   # 브라우저 분석 로직(web/analyze.js) 단위 테스트, 통과 시 "OK ..." 후 exit 0
```

## Architecture

Go 모듈 `hsr-warp`. 백엔드는 수집·저장·서빙만 하고, 분석(천장·운·50/50·월별)은 브라우저 `analyze.js`가 한다.

- **`internal/store`** — SRGF 타입(`Info`/`Record`/`SRGF`)과 저장 로직. `LoadAll`(월별 파일 병합·중복제거·정렬), `MaxIDByBanner`(증분 기준), `WriteAffectedMonths`(아래 핵심), `TZForRegion`. ID 비교는 `idLess`(math/big) — `Number`/float 금지.
- **`internal/collector`** — `FindAuthContext`(캐시 `StarRail_Data\webCaches\<버전>\Cache\Cache_Data\data_2` 읽어 정규식으로 authkey URL 추출; 버전 디렉터리는 숫자 기반 `latestVersion`으로 최신 선택), `FetchIncremental`(배너 `1`/`2`/`11`/`12` 페이지네이션, 저장분보다 최신 id만 수집, retcode -101 → authkey 만료 에러).
- **`internal/server`** — 라우팅과 핸들러. `/api/data`, `/api/config`, `/api/detect`, `/api/fetch`(SSE: progress/error/done). 자산은 main에서 `go:embed`한 `web/`를 `fs.Sub`로 주입.
- **`main.go`** — `os.Executable()` 기준 baseDir, `data/`·`config.json` 경로, 빈 포트 선택, `go:embed web/dashboard.html web/analyze.js`, 브라우저 자동 오픈.

**중심 도메인 규칙 — 50/50 픽승/픽뚫 판정** (`web/analyze.js`의 `analyzeBanner`): 5★ **획득 시각**이 속한 배너 기간(`SCHEDULE`의 `[s,e)`)의 픽업(rate-up) item_id이면 픽승(win), 아니면 픽뚫(loss). 픽뚫은 `guaranteed=true`로 다음 5★를 확정으로 만든다. **'그 시점 픽업이었나'로 판정**하므로 상시풀 편입·Celestial Invitation·콜라보·리런을 모두 올바르게 처리한다(풀 소속 방식은 구조적으로 불가 — 패배 풀이 시변적·플레이어별이라). 일정에 없는 시각의 5★는 `unidentified`(대시보드 '미확인 5★' 경고). 신규 패치 출시 시 **`SCHEDULE` 배열에 `{s,e,c,l}` 항목 추가**(c=캐릭터 픽업, l=광추 픽업 item_id; 픽업=Mantan21/HSR-Warp-Simulator, item_id=StarRailRes). `gacha_type`: `11`=캐릭터, `12`=광추, `1`=일반(스텔라), `2`=출발.

**저장은 비파괴 부분 재작성이다.** `WriteAffectedMonths`는 이번 조회로 **신규가 생긴 월 파일만** 로드·병합·중복제거·정렬 후 원자적으로 재작성하고, 손대지 않은 월은 보존한다. authkey가 최근 기록만 줄 때 과거 월이 통째로 사라지는 것을 막는 핵심 보장이며, 테스트 `TestWriteAffectedMonths_PreservesUntouchedMonths`가 이를 강제한다. (구 PowerShell의 "전량 삭제 후 재작성"은 폐기됨.)

**`analyze.js` 는 단일 소스다.** `web/analyze.js`가 유일 소스이며 서버가 `/analyze.js`로 서빙하고 exe에 `go:embed`로 내장된다. 단위 테스트는 `web/analyze.test.js`(`node web/analyze.test.js`)가 `require('./analyze.js')`로 같은 디렉터리 파일을 검증한다. UMD IIFE로 브라우저=`window.WarpAnalyze`, Node=`module.exports` 노출. 의존성 없이 양쪽에서 동작해야 한다.

**ID는 매우 큰 정수다.** 비교 시 Go는 `math/big.Int`(`idLess`/`idLessEq`), JS는 `BigInt`로 다룬다 — `Number`로 비교하면 정밀도가 깨진다.

## Gotchas

- authkey는 게임에서 **전언 기록 화면을 최근 ~24시간 내 한 번 열어야** 유효하다. 유효 authkey가 없으면 조회는 SSE error 이벤트로 실패를 알린다(설계된 동작).
- 데이터 형식·`gacha_type` 코드·표준 풀·확률은 외부 명세에 묶여 있다: SRGF v1.0(uigf.org), Prydwen(50/50·확률), StarRailRes(item_id 검증). 상수 변경 시 README의 출처를 따른다.
- `hsr-warp.exe`, `data/`, `config.json`, `*.tmp`, 구 생성물 `HSR_Warp_Dashboard.html`은 gitignore 대상이다.
- Go가 설치돼 있어도 PATH에 없을 수 있다(설치 후 셸 미갱신). 그 경우 `$env:Path` 에 `C:\Program Files\Go\bin` 을 prepend 한다.
