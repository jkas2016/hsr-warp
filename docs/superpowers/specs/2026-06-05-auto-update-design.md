# 사용자 자동 업데이트 설계 (이슈 #3)

> 출처 이슈: https://github.com/jkas2016/hsr-warp/issues/3
> 작성일: 2026-06-05

## 목표

버전이 올라갈 때 사용자가 쉽게 최신 상태를 유지하게 한다. 단, 이 도구에서 **실제로 자주 바뀌는 것은 배너 픽업 데이터(`SCHEDULE`) 몇 줄**이고, 코드(수집·저장·분석 로직)는 드물게 바뀐다는 관찰을 설계의 출발점으로 삼는다.

따라서 "버전 숫자 크기(major/minor/patch)"가 아니라 **무엇이 바뀌었는가(데이터냐 코드냐)**로 업데이트를 두 채널로 가른다.

## 결정 요약

- **데이터 채널**(잦음): 배너 `SCHEDULE` 변경 → 시작 시 `main`의 raw 파일에서 자동 갱신, **재설치 없음**.
- **코드 채널**(드묾): exe 코드 변경 → **설치본(Inno Setup) 재설치**, 앱은 알림만(셀프 업데이트 아님).
- **확인 시점**: 대시보드 로드 시 1회 자동, **버튼 없음**, 베스트에포트(실패 시 조용히 무시).
- **외부 통신은 Go 백엔드에서만** 일어난다(브라우저 CORS 회피 + "외부 통신은 한 곳" 보장). 시작 시 raw 파일 1회 + GitHub API 1회 외에는 없음 → "완전 로컬" 원칙 유지.
- 작업 단위: **이슈 #3 = 한 PR**(데이터 채널 + 코드 채널 + 리팩터 일괄).

## 아키텍처 개요

```
대시보드 로드
  └─ GET /api/updates  (백엔드가 lazy + 캐시)
        ├─ 데이터 체크: raw main/web/schedule.json ─ 검증 ─ 신규면 data/schedule.json 원자적 기록
        └─ 코드 체크:   GitHub releases/latest ─ semver 비교(main.version)
      ↩ { schedule:{updated,version}, code:{newer,version,url} }
  └─ GET /schedule.json (data/ override > 내장본)
  └─ GET /api/data
  └─ render: analyze(data, schedule) + 업데이트 배너
```

`/api/updates`는 **첫 호출 시 두 체크를 수행하고 프로세스 수명 동안 결과를 캐시**한다(짧은 타임아웃). 대시보드는 브라우저 자동 오픈 직후 로드되므로 이 호출이 사실상 "시작 시 자동 확인"이다. 별도 startup goroutine을 두지 않아 race가 없다.

**로드 순서**: 대시보드는 `/api/updates`를 먼저 호출(데이터 갱신이 `data/schedule.json`에 반영됨) → 그다음 `/schedule.json`·`/api/data`를 받아 렌더. 순서를 지켜 갱신본이 즉시 반영되게 한다.

## 데이터 채널 — 배너 SCHEDULE

### D1. 데이터/로직 분리 리팩터 (핵심 변경)

현재 `web/analyze.js`는 `SCHEDULE` 배열을 모듈 안에 하드코딩하고 `analyze(data)`가 데이터만 받는다(`web/analyze.js:11`, `:149`). 이를 분리한다.

- 신규 **`web/schedule.json`** — 형식:
  ```json
  {
    "version": 1,
    "schedule": [
      { "s": "2023-04-26", "e": "2023-05-17", "c": ["1102"], "l": ["23001"] }
    ]
  }
  ```
  `version`은 단조 증가 정수(데이터 갱신마다 +1). `schedule` 항목 형식은 기존 `{s,e,c,l}` 그대로(`c`/`l`은 **문자열 item_id 배열**, `s`/`e`는 `YYYY-MM-DD`).
- `web/analyze.js`는 **로직만** 남긴다. 시그니처를 `analyze(data, schedule)`로 바꿔 schedule을 주입받는 순수 함수로 만든다. `SCHEDULE`/`SCHED_END`/`wasPickup`은 주입된 schedule을 참조한다. (현재 export 목록의 `SCHEDULE`은 제거한다.)
- Go는 `web/schedule.json`을 `go:embed`에 추가하고, 서버가 `/schedule.json`으로 서빙한다.
- `web/dashboard.html`은 `/schedule.json`을 fetch해 `analyze(data, schedule)`에 넘긴다.

### D2. 서빙 — data/ override > 내장본

`/schedule.json` 핸들러는 **유효 데이터**를 고른다:

- `data/schedule.json`이 존재하고 그 `version`이 내장본 `version`보다 **크면** 그걸 서빙.
- 아니면 내장본을 서빙.

이로써 원격 갱신본(`data/schedule.json`)이 항상 우선하되, 없거나 더 낮으면 내장 기본값으로 폴백한다.

### D3. 갱신 흐름 (`/api/updates`의 데이터 부분)

1. `https://raw.githubusercontent.com/jkas2016/hsr-warp/main/web/schedule.json` 조회(타임아웃 ~5s).
2. **스키마 검증**: 최상위 `version`(정수)·`schedule`(배열) 존재, 각 항목의 `s`/`e`가 파싱 가능한 날짜, `c`/`l`이 배열. 하나라도 깨지면 **버린다**(내장/기존 유지).
3. `remote.version > 현재 유효 version`이면 `data/schedule.json`에 **원자적 기록**(`.tmp`→`rename`, 기존 store 패턴과 동일).
4. 데이터는 안전하므로 **조용히 자동 적용**. 응답에 `schedule:{updated:true, version:N}`을 실어 대시보드가 작은 안내만 표시("배너 데이터 vN으로 갱신됨").

### D4. 불변식 보존

- **내장 기본값 = 완전 로컬 보장**: 오프라인·최초 실행에도 내장 `schedule.json`으로 정상 동작. 원격 갱신은 *향상*일 뿐 의존이 아니다.
- **스키마는 append-only**(항목 추가만, 키 변경 없음) → 구 바이너리도 신규 데이터를 안전히 소비 → "main에서 자동 적용"이 안전한 근거.
- `ARCHITECTURE.md`의 "analyze.js 단일 소스" 규칙을 **"로직=`analyze.js`, 데이터=`schedule.json`"**으로 갱신한다.

## 코드 채널 — 설치본 재설치

### C1. 감지

- `https://api.github.com/repos/jkas2016/hsr-warp/releases/latest` 조회. 이 엔드포인트는 정의상 **"most recent non-prerelease, non-draft release"**를 반환하므로(아래 출처), 이슈가 요구한 **프리릴리스 제외 정책이 자연히 해결**된다.
- 응답 `tag_name`(예 `v1.4.0`)과 `main.version`(goreleaser가 `-X main.version`으로 주입, 예 `1.4.0`)을 **semver 비교**한다. 앞의 `v`를 정규화하고 `X.Y.Z`를 정수 3개로 파싱해 비교한다. **외부 의존성 없이** 구현한다(프로젝트의 무의존성 원칙 유지).
- `main.version == "dev"`(직접 빌드)면 코드 체크를 **건너뛴다**(개발 빌드는 알림 안 띄움).
- 다운로드 URL: 릴리스 자산 중 setup 패턴(`*setup*.exe`)의 `browser_download_url`을 우선, 없으면 릴리스 `html_url`을 반환.

### C2. 알림 UI

- 대시보드 상단에 **닫기 가능한 배너**: "새 버전 vX.Y.Z가 나왔습니다 — [설치본 다운로드]". 링크는 C1의 URL.
- **셀프 업데이트(자동 다운로드·교체·재시작)는 범위 밖.** 사용자가 설치본을 직접 실행해 재설치한다(결정대로).

### C3. 빌드/CI (Inno Setup)

goreleaser 무료판은 Windows 설치본을 만들지 못한다(MSI·NSIS는 Pro 전용 — 아래 출처). 따라서 **Inno Setup**(`iscc`)을 릴리스 워크플로우에 별도 단계로 추가한다.

- goreleaser로 `hsr-warp.exe` 빌드(기존 그대로) → Inno Setup 스크립트(`.iss`)로 `setup.exe` 생성 → 해당 릴리스에 자산으로 첨부.
- `.iss`는 설치 경로 선택·바로가기·제거를 자동 생성. 버전은 태그에서 주입.
- **설치 위치 제약**: 앱은 `baseDir()`(=exe 디렉터리)에 `data/`·`config.json`·`logs/`를 쓴다(`main.go:108-115`). 따라서 설치본은 **per-user, 쓰기 가능 위치(`{localappdata}\HSR Warp`)에 설치**한다(`PrivilegesRequired=lowest`, 관리자 불필요) — 앱의 데이터 경로 로직을 바꾸지 않기 위해. `Program Files` 설치는 쓰기 실패를 유발하므로 피한다.
- GitHub Actions에서 Inno Setup 설치(`choco install innosetup`) 후 `ISCC.exe`로 컴파일. 릴리스 워크플로우는 `ubuntu`(goreleaser) + `windows`(설치본) 2-job 구조가 되며, 설치본 job은 goreleaser job 이후 `gh release upload`로 자산을 첨부한다.

## 백엔드 변경 요약

- 신규 모듈 **`internal/updater`**: `CheckSchedule(dataDir, embedded) (Result, error)`, `CheckRelease(currentVersion) (Result, error)`, semver 파서/비교, 결과 캐시.
- 신규 라우트:
  - `/api/updates` — lazy + 캐시. 두 체크 수행, JSON 상태 반환.
  - `/schedule.json` — D2의 유효 데이터 서빙.
- `main.go`는 별도 변경 최소(라우트는 `server.Handler()`에 등록, 임베드 FS에 `schedule.json` 추가).
- **로깅**: 네트워크 실패는 *예상된 동작*이므로 `slog.Warn`/`Info`로 기록한다(`Error` 아님 — Error는 스택 첨부 + 버그 함의). 민감정보 없음(URL·버전만).

## 프론트 변경 요약

- `web/analyze.js`: `SCHEDULE` 제거, `analyze(data, schedule)` 시그니처. `api`에서 `SCHEDULE` export 제거.
- `web/dashboard.html`: 로드 순서대로 `/api/updates` → `/schedule.json` → `/api/data` fetch. `analyze(data, schedule)` 호출. 코드 업데이트 배너 + 데이터 갱신 안내 렌더(인라인 onclick 미사용, `addEventListener` — 기존 스타일).

## 에러 처리·프라이버시

- 두 체크 모두 타임아웃 + 베스트에포트. 실패해도 앱·대시보드는 정상 동작(배너만 안 뜸).
- 외부 통신: raw 파일 1회 + GitHub API 1회. 그 외 없음.

## 테스트 / 검증 계획 (테스트 먼저)

테스트 계획을 먼저 정하고 구현한다.

### Go (`go test ./...`)

1. `CheckSchedule`:
   - 원격 version > 유효 → `data/schedule.json` 기록 + `updated:true`.
   - 원격 version <= 유효 → 미기록 + `updated:false`.
   - 깨진 JSON / 스키마 위반 → 버림(기존 유지), 에러 아님(베스트에포트).
   - 네트워크 실패(httptest 닫힌 서버/타임아웃) → 베스트에포트로 무시.
2. `CheckRelease`:
   - `tag_name`이 현재보다 높음 → `newer:true`, URL 채움.
   - 같거나 낮음 → `newer:false`.
   - `main.version=="dev"` → 스킵.
   - semver 파서: `v1.4.0`/`1.4.0` 정규화, `1.10.0 > 1.9.0`(숫자 비교) 검증.
   - setup 자산 있으면 그 URL, 없으면 `html_url`.
3. 라우트:
   - `/schedule.json`이 `data/` override → embedded fallback 순으로 동작.
   - `/api/updates` 응답 형태(JSON 키) 검증.

### JS (`node web/analyze.test.js`)

4. `analyze(data, schedule)`가 **주입된 schedule**로 동작하도록 기존 테스트를 fixture-schedule 주입형으로 이전(기존 50/50 케이스 동일 결과 유지).
5. schedule 누락/빈 배열 방어(미확인 처리로 떨어지되 throw 없음).

### 렌더 검증 (chrome-devtools-mcp)

6. 빌드한 exe(또는 로컬 서버)로 대시보드를 띄워 확인:
   - 새 코드 버전이 있을 때 배너 표시 + 다운로드 링크, 닫기 동작.
   - 데이터 갱신 시 안내 표시, 콘솔 에러 없음.

### 회귀

7. `TestWriteAffectedMonths_PreservesUntouchedMonths` 등 기존 불변식 테스트 통과 유지(이 작업과 무관).

## 범위 밖 (YAGNI)

- 셀프 업데이트(자동 교체·재시작·롤백 UI).
- 수동 "업데이트 확인" 버튼, 주기적 폴링.
- Windows 외 플랫폼 설치본.

## 변경 파일 목록

- 신규: `web/schedule.json`, `internal/updater/updater.go` (+ `_test.go`), `installer/hsr-warp.iss`(또는 동등), GitHub Actions 릴리스 워크플로우에 Inno Setup 단계.
- 수정: `web/analyze.js`(SCHEDULE 분리), `web/analyze.test.js`(주입형), `web/dashboard.html`(fetch·렌더), `internal/server/server.go`(라우트), `main.go`(embed에 schedule.json), `docs/ARCHITECTURE.md`(단일 소스 규칙 갱신).

## 출처 (외부 명세)

- GitHub "Get the latest release"는 non-prerelease·non-draft 최신 릴리스 반환: https://docs.github.com/en/rest/releases/releases?apiVersion=2022-11-28
- goreleaser MSI는 Pro 전용: https://goreleaser.com/customization/package/msi/
- goreleaser NSIS는 Pro 전용: https://goreleaser.com/customization/nsis/
- Inno Setup: https://jrsoftware.org/isinfo.php
- 기존 도메인 규칙·픽업 출처는 `docs/ARCHITECTURE.md` 및 `README` 준수.
