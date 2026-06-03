# HSR 워프 대시보드 (자가 호스팅, 단일 실행파일)

스타레일 전언(워프) 기록을 **증분 조회**해서 월별로 저장하고, **운·픽뚫 분석 대시보드**를 로컬 웹 UI로 보여줍니다. 단일 실행파일(`hsr-warp.exe`) 하나만 실행하면 로컬 서버가 떠서 브라우저가 자동으로 열립니다. 모든 처리는 내 PC에서만 일어나며 데이터는 외부로 전송되지 않습니다.

## 사용법

1. 게임에서 **전언 기록** 화면을 한 번 엽니다. (캐시에 인증 URL 기록 → authkey 확보, 최근 ~24시간 내)
2. `hsr-warp.exe` 를 실행합니다. 콘솔에 주소가 뜨고 기본 브라우저가 `http://127.0.0.1:8787/dashboard.html` 로 자동 열립니다.
3. 경로 입력란은 자동으로 채워집니다(마지막 사용 경로 → 없으면 자동탐지). 비어 있거나 다르면 게임 경로(`…\Star Rail Games`)를 입력합니다.
4. **조회** 를 누르면 신규 기록만 실시간(SSE)으로 가져와 차트가 갱신됩니다.
5. 종료는 콘솔 창에서 `Ctrl+C`.

기존 데이터는 진입 시 바로 표시되므로, 조회하지 않아도 과거 기록을 볼 수 있습니다.

## 동작 방식

- **백엔드(Go 정적 바이너리)** — 게임 캐시 `StarRail_Data\webCaches\<버전>\Cache\Cache_Data\data_2` 에서 정규식으로 authkey URL을 추출해 비공식 `getGachaLog` API를 **배너별 증분**(저장분보다 최신 id만) 호출합니다.
- **저장** — SRGF v1.0 형식, 월별 분리(`data\warp_YYYYMM.json`). **이번 조회로 신규가 생긴 월 파일만** 병합·재작성하고(원자적 교체) 나머지 월은 보존합니다. authkey가 최근 기록만 줘도 과거 데이터가 사라지지 않습니다.
- **프런트엔드** — `analyze.js`(분석 로직)와 `dashboard.html`은 exe에 `go:embed`로 내장돼 로컬 서버가 서빙합니다. 분석(천장·운·50/50·월별)은 전부 브라우저에서 실행됩니다.

| 경로 | 역할 |
|---|---|
| `GET /dashboard.html` | 대시보드(내장 자산) |
| `GET /analyze.js` | 분석 로직(내장 자산) |
| `GET /api/data` | 저장된 전체 SRGF JSON |
| `GET/POST /api/config` | 마지막 게임 경로 읽기/저장 |
| `GET /api/detect` | 게임 경로 자동탐지 |
| `GET /api/fetch?path=…` | 증분 조회 SSE 스트림(progress/error/done) |

## 빌드 / 개발

`package.json` 에 편의 스크립트가 있습니다. **`node` 만 있으면 되고, `go` 는 스크립트(`scripts/run-go.mjs`)가 자동으로 찾습니다** — Go 설치 후 터미널을 아직 재시작 안 해 PATH에 `go` 가 없어도 그냥 동작합니다:

```powershell
npm run build    # web/analyze.js 동기화(prebuild) → 정적 단일 exe 빌드(-s -w)
npm start        # 빌드 후 hsr-warp.exe 실행
npm test         # go test ./...  +  node analyze.test.js
npm run vet      # go vet ./...
```

원하면 도구를 직접 호출해도 됩니다:

```powershell
go build -ldflags="-s -w" -o hsr-warp.exe .
go test ./...          # Go 단위 테스트 (collector / store / server)
node analyze.test.js   # 브라우저 분석 로직(analyze.js) 단위 테스트
```

> `analyze.js` 는 루트(테스트용)와 `web\analyze.js`(서빙용) 두 곳에 있고 **내용이 동일해야** 합니다. `npm run build` 의 `prebuild` 가 매 빌드마다 루트 → `web\` 로 자동 복사해 동기화하므로 수동 복사는 필요 없습니다. (도구를 직접 쓸 땐 `npm run sync-analyze` 로 동기화하세요.)

## 측정 지표

- **운 지표** — 캐릭터/일반 배너 평균 천장을 이론 평균 **62.5회**(종합 확률 1.6%)와 비교. 평균이 낮을수록 행운.
- **소프트천장 이전 획득률** — 5★를 74회(광추 65회) 전에 뽑은 비율.
- **픽뚫률(50/50)** — 한정 배너에서 50/50 승부 중 픽업을 뽑은 비율. 확정 획득은 별도 집계.
- **월별 집계** — 월별 뽑기 수·성옥·획득 5★.

### 판정 가정과 한계
- **50/50 판정**: 한정 배너 5★의 `item_id`가 표준 풀이면 **픽패**, 아니면 **픽뚫**.
  - 표준 캐릭터(7): 히메코·벨트·브로냐·게파드·클라라·연경·백로
  - 표준 광추(7): 23000·23002·23003·23004·23005·23012·23013
- 신규 "커스텀 50/50 풀"이나 콜라보 배너는 표준 풀 방식으로는 정확히 못 가립니다(픽뚫로 잡힐 수 있음). HoYo가 표준 풀을 바꾸면 `analyze.js`(및 `web\analyze.js`)의 `STANDARD` 배열을 수정하세요.
- 공식 확률/천장: 캐릭터 0.6%/종합 1.6%/하드천장 90, 광추 0.8%/하드천장 80(75:25).

## 출처
- 가차 데이터 형식·gacha_type 코드: https://uigf.org/en/standards/srgf.html
- 표준 풀·확률·50/50 규칙: https://www.prydwen.gg/star-rail/guides/gacha-system/
- item_id 검증: https://github.com/Mar-7th/StarRailRes
- 추출 원리(캐시→authkey→API): https://github.com/biuuu/star-rail-warp-export
