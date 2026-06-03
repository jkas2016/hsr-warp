# CLAUDE.md

자가 호스팅 HSR 워프(가챠) 기록 추적기. 단일 Go exe가 게임 캐시에서 authkey를 뽑아 `getGachaLog` API를 증분 호출 → SRGF v1.0로 월별 저장 → 내장 대시보드를 로컬 HTTP+SSE로 서빙. 분석은 브라우저 `web/analyze.js`. 전부 로컬.

> 상세 구조·도메인 규칙·로깅은 **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**. 아래는 명령어와 깨지기 쉬운 핵심만.

## Commands

```powershell
# go 가 PATH 에 없으면: $env:Path = 'C:\Program Files\Go\bin;' + $env:Path
go build -ldflags="-s -w" -o hsr-warp.exe .   # 정적 단일 exe (release, 로그 info)
npm run build:debug                             # 개발용: 로그 debug 박은 hsr-warp-debug.exe
.\hsr-warp.exe                                  # 실행 (런타임 HSRWARP_LOG=debug 로도 override)
go test ./... && node web/analyze.test.js       # 전체 테스트
```

포맷·정적검사는 `gofmt -w .` 와 `go vet ./...` 가 권위 — 컨벤션을 글로 적지 않는다.

## 깨면 안 되는 것

- **ID는 거대 정수**: 비교는 Go `math/big`(`idLess`), JS `BigInt`. `Number`/float 금지.
- **저장은 비파괴**: `WriteAffectedMonths`는 신규 생긴 월만 재작성, 나머지 보존. `TestWriteAffectedMonths_PreservesUntouchedMonths`가 강제.
- **50/50 판정은 `web/analyze.js` 단일 소스**: 신규 패치마다 `SCHEDULE`에 `{s,e,c,l}` 추가 (상세는 ARCHITECTURE.md).
- **에러 로그엔 항상 스택**: 새 로그는 `log` 말고 `slog` 사용 (`stackHandler`가 ERROR에 스택 자동 첨부).
- **authkey는 게임 전언 기록 화면을 ~24h 내 열어야 유효**. 없으면 조회는 SSE error(설계된 동작).
