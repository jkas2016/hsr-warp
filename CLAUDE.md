# CLAUDE.md

자가 호스팅 HSR 워프(가챠) 기록 추적기. 단일 Go exe가 게임 캐시에서 authkey를 뽑아 `getGachaLog` API를 증분 호출 → SRGF v1.0로 월별 저장 → 내장 React 대시보드(디자인 시스템 킷, `web/ui_kits/dashboard/`)를 로컬 HTTP+SSE로 서빙. 분석은 브라우저 `web/analyze.js`. 가챠 데이터 수집·자산(폰트·라이브러리 CDN)엔 인터넷이 필요하지만 **사용자 기록은 외부로 전송하지 않는다** — 수집·분석·저장 전부 로컬 처리(개인정보 보안이 핵심, 오프라인 동작이 목표가 아님).

> 상세 구조·도메인 규칙·로깅은 **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**. 아래는 명령어와 깨지기 쉬운 핵심만.

## Commands

```powershell
# go 가 PATH 에 없으면: $env:Path = 'C:\Program Files\Go\bin;' + $env:Path
go build -ldflags="-s -w" -o hsr-warp.exe .   # 정적 단일 exe (release, 로그 info)
npm run build:debug                             # 개발용: 로그 debug 박은 hsr-warp-debug.exe
.\hsr-warp.exe                                  # 실행 (런타임 HSRWARP_LOG=debug 로도 override)
npm test   # 전체 테스트(go + analyze + 대시보드 util/i18n/items/nohardcode + 사이트 copy)
npm run schedule:status   # 배너 데이터가 몇 버전(패치)까지 대응됐는지 즉시 확인
```

포맷·정적검사는 `gofmt -w .` 와 `go vet ./...` 가 권위 — 컨벤션을 글로 적지 않는다.

## 깨면 안 되는 것

- **ID는 거대 정수**: 비교는 Go `math/big`(`idLess`), JS `BigInt`. `Number`/float 금지.
- **저장은 비파괴**: `WriteAffectedMonths`는 신규 생긴 월만 재작성, 나머지 보존. `TestWriteAffectedMonths_PreservesUntouchedMonths`가 강제.
- **50/50 판정은 `web/analyze.js` 단일 소스**: 신규 패치마다 `web/schedule.json`의 `schedule`에 `{s,e,c,l}`·`versions`에 `{v,s}` 추가하고 `version`(정수)을 올린다(업데이터가 version 비교로 배포). 신규 캐릭터/광추 이름은 `node scripts/extract-item-names.mjs`로 재추출. 현황은 `npm run schedule:status` (상세는 ARCHITECTURE.md).
- **대시보드는 React DS 킷**: `web/ui_kits/dashboard/`(진입 `index.html`, 서빙 URL `/ui_kits/dashboard/`). `data.js`가 `analyze.js` 출력을 킷 컴포넌트용 `WARP_DATA` 형태로 어댑트할 뿐 — 분석 로직은 `analyze.js` 단일 소스를 유지하고 킷에서 재구현하지 않는다. `main.go`의 `go:embed`는 `all:web`(언더스코어로 시작하는 `_ds_bundle.js`를 포함하려면 `all:` 필요).
- **에러 로그엔 항상 스택**: 새 로그는 `log` 말고 `slog` 사용 (`stackHandler`가 ERROR에 스택 자동 첨부).
- **authkey는 게임 전언 기록 화면을 ~24h 내 열어야 유효**. 없으면 조회는 SSE error(설계된 동작).
