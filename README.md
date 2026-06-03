# HSR 워프 대시보드 (자가 호스팅)

스타레일 전언(워프) 기록을 **증분 조회**해서 월별로 저장하고, **운·픽뚫 분석 대시보드**(데이터 내장 HTML)를 자동 생성합니다. 모든 처리는 내 PC에서만 일어나며 데이터는 외부로 전송되지 않습니다.

## 구성 파일

| 파일 | 역할 |
|---|---|
| `Update-HSRDashboard.ps1` | **메인.** 캐시에서 authkey 추출 → 신규 기록만 조회 → `data\warp_YYYYMM.json` 저장 → `HSR_Warp_Dashboard.html` 생성 |
| `dashboard.template.html` | 대시보드 템플릿 (생성 입력, 직접 안 엶) |
| `analyze.js` | 분석 로직 단일 소스 (천장·운·50/50·월별). 표준 풀이 바뀌면 상단 `STANDARD`만 수정 |
| `Register-Schedule.ps1` | 매달 자동 실행 등록/해제 |
| `HSR_Warp_Dashboard.html` | 생성 결과물 (지금 든 건 샘플 데이터). **이 파일을 더블클릭** |
| `data\` | 월별 기록 저장 폴더 (자동 생성) |

위 5개 파일을 같은 폴더에 두세요.

## 사용법

**1. 첫 실행 (전체 기록)**
1. 게임에서 **전언 기록** 화면을 한 번 엽니다. (캐시에 인증 URL 기록 → authkey 확보)
2. PowerShell에서:
   ```
   powershell -ExecutionPolicy Bypass -File .\Update-HSRDashboard.ps1
   ```
   게임 경로가 다르면 `-GamePath "D:\경로\Star Rail Games"` 추가.
3. 생성된 `HSR_Warp_Dashboard.html` 을 엽니다.

**2. 매달 자동 갱신**
```
powershell -ExecutionPolicy Bypass -File .\Register-Schedule.ps1
```
매달 1일 09:00 자동 실행. 두 번째 실행부터는 **저장 안 된 최신 기록만** 조회합니다.
해제: `-Remove` / 주기 변경: `-Day 15 -Time 21:00`

> 자동 실행 시점에 유효한 authkey(최근 24시간 내 전언 기록 열람)가 없으면 조회는 그냥 실패합니다. 그땐 게임을 켠 뒤 수동 실행하세요.

## 측정 지표

- **운 지표** — 캐릭터/일반 배너 평균 천장을 이론 평균 **62.5회**(종합 확률 1.6%)와 비교. 평균이 낮을수록 행운.
- **소프트천장 이전 획득률** — 5★를 74회(광추 65회) 전에 뽑은 비율.
- **픽뚫률(50/50)** — 한정 배너에서 50/50 승부 중 픽업을 뽑은 비율. 확정 획득은 별도 집계.
- **월별 집계** — 월별 뽑기 수·성옥·획득 5★.

### 판정 가정과 한계
- **50/50 판정**: 한정 배너 5★의 `item_id`가 표준 풀이면 **픽패**, 아니면 **픽뚫**.
  - 표준 캐릭터(7): 히메코·벨트·브로냐·게파드·클라라·연경·백로
  - 표준 광추(7): 23000·23002·23003·23004·23005·23012·23013
- 신규 "커스텀 50/50 풀"(구 한정 캐릭터를 풀에 넣는 기능)이나 콜라보 배너는 표준 풀 방식으로는 정확히 못 가립니다(픽뚫로 잡힐 수 있음). HoYo가 표준 풀을 바꾸면 `analyze.js`의 `STANDARD` 배열을 수정하세요.
- 공식 확률/천장: 캐릭터 0.6%/종합 1.6%/하드천장 90, 광추 0.8%/하드천장 80(75:25).

## 출처
- 가차 데이터 형식·gacha_type 코드: https://uigf.org/en/standards/srgf.html
- 표준 풀·확률·50/50 규칙: https://www.prydwen.gg/star-rail/guides/gacha-system/
- item_id 검증: https://github.com/Mar-7th/StarRailRes
- 추출 원리(캐시→authkey→API): https://github.com/biuuu/star-rail-warp-export
