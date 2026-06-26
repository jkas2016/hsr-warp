# 대시보드 소소한 수정 묶음 — 설계 (이슈 #11)

대시보드 사용성 수정 3건 + 관련 문서 최신화를 한 PR로 묶는다. 코드 위치는 이슈에서 조사 완료, 본 설계에서 실제 코드 확인·일부 정정.

## 배경 정정 (조사 결과)

- 대시보드는 빌드 스텝 없이 Babel standalone 으로 `.jsx` 를 브라우저에서 직접 트랜스파일한다(`web/ui_kits/dashboard/index.html`). `web/_ds_bundle.js`(디자인 시스템 킷)에는 '평균' 문구가 없으므로 **DS 번들은 수정 대상이 아니다** — `.jsx` 만 고친다.
- Item 2 라벨은 실제로 **4파일 6곳**이다(이슈의 "6파일 7곳"은 부정확). `VersionsView.jsx:33` 은 '평균천장'(붙여쓰기)이라 공백 포함 검색에서 누락됐다.
- `avgPity5 = mean(전체 5성 pity)` (`web/analyze.js:40,43`) — 픽업 한정이 아니라 **모든 5성 기준** 평균 뽑기 수다. 따라서 '평균 픽업 뽑기'류 표현은 부정확.
- Item 3 의 진짜 원인: Go 1.26 `os.ReadFile` 은 내부적으로 `FILE_SHARE_READ | FILE_SHARE_WRITE` 로만 파일을 연다(stdlib `syscall_windows.go:395` 확인). **`FILE_SHARE_DELETE` 가 빠져 있다.** 게임의 webCache(`data_2`)는 Chromium 식 캐시라 DELETE 권한을 쥔 채 매핑되어, 우리 쪽 공유 모드에 DELETE 가 없으면 `ERROR_SHARING_VIOLATION(32)` 으로 실패한다. → 이슈가 추천한 "임시 파일 복사 후 읽기"는 복사도 결국 원본을 read-open 하므로 **동일하게 실패**한다. 근본 해결은 `FILE_SHARE_DELETE` 를 포함해 직접 여는 것뿐이며, `syscall.CreateFile` + `syscall.FILE_SHARE_DELETE`(둘 다 stdlib 노출) 로 **새 의존성 없이** 가능하다. 이 도구는 Windows 전용이라 플랫폼 제약도 없다.

## Item 1 · 버전 구간 드롭다운 내림차순 (enhancement)

탭 줄 우측 버전 구간 Select 를 오름차순(옛 버전 위) → **내림차순(최신 위)** 으로. '전체 기간'은 맨 위 고정 유지.

- **파일**: `web/ui_kits/dashboard/Dashboard.jsx:111`
- **변경**: `{data.versions.map((v) => ...)}` → `{[...data.versions].reverse().map((v) => ...)}`
- '전체 기간'은 그 앞 정적 `<option value="전체">` 이라 자동으로 맨 위 유지.
- 얕은 복사(`[...data.versions]`)로 원본 비파괴 — `data.versions` 는 VersionsView 등에서도 쓰이므로 in-place `reverse()` 금지.
- **`web/analyze.js` 의 `versionWindows` 정렬(`a.s-b.s` 오름차순)은 손대지 않는다** — 버전 윈도우 계산(`e` = 다음 버전 시작)에 의존하므로 거기서 뒤집으면 분석이 깨진다. 표시용 정렬만 렌더 시점에서 뒤집는다.

## Item 2 · '평균 천장' → '평균 뽑기 수' 통일 (enhancement / 용어 정확성)

'천장'은 hard pity(90뽑 = 무조건 5성)를 가리키는데 `avgPity5` 는 "5성 1명까지 평균 뽑기 수"라 의미가 다르다. 기준 용어를 **'평균 뽑기 수'** 로 통일한다(라벨 맥락 따라 수식어 유지).

| 위치 | 현재 | 변경 |
|---|---|---|
| `BannerCards.jsx:31` | `평균 천장` | `평균 뽑기 수` |
| `BannersView.jsx:51` | `평균 천장` | `평균 뽑기 수` |
| `HeroSummary.jsx:25` | `운 지표 · 캐릭터 평균 천장` | `운 지표 · 캐릭터 평균 뽑기 수` |
| `HeroSummary.jsx:65` | `평균 천장 · 캐릭터` | `평균 뽑기 수 · 캐릭터` |
| `VersionsView.jsx:27` | `캐릭터 평균 천장 비교` | `캐릭터 평균 뽑기 수 비교` |
| `VersionsView.jsx:33` (th) | `캐릭 평균천장` | `캐릭 평균뽑기` (헤더 폭 제약상 축약) |

- **유지(정당한 '천장' 용법, 변경 금지)**: cap 표기 `/ {b.cap} 천장`(BannerCards:23, BannersView:40), 분포 `5★ 천장 분포`(BannersView:58, ChartsGrid:60), 개별 pity `현재 천장`(BannersView:35)·`천장` 컬럼(FivesTable:15)·`천장`/`천장 진행`(FiveDetail:31,36), 빈 상태 카피(Dashboard:91).
- `VersionsView.jsx:27` 의 `· 짧을수록 행운 (기준 62.5)` 보조 문구는 기대 평균 뽑기 수와 일관되므로 그대로 둔다.

## Item 3 · 게임 실행 중 파일 점유 에러 (bug)

게임이 켜진 상태로 새로고침 시 `data_2` 점유로 조회 실패. `FILE_SHARE_DELETE` 누락이 원인.

- **파일**: `internal/collector/cache.go`
- 헬퍼 추가(stdlib `syscall`, 새 의존성 없음):

```go
// readShared 는 FILE_SHARE_DELETE 까지 포함해 열어 게임 실행 중에도 읽는다.
// os.ReadFile 은 FILE_SHARE_READ|WRITE 만 써서, DELETE 권한으로 매핑된
// webCache data_2 를 ERROR_SHARING_VIOLATION(32) 으로 못 읽는다.
func readShared(path string) ([]byte, error) {
	p, err := syscall.UTF16PtrFromString(path)
	if err != nil {
		return nil, err
	}
	h, err := syscall.CreateFile(p, syscall.GENERIC_READ,
		syscall.FILE_SHARE_READ|syscall.FILE_SHARE_WRITE|syscall.FILE_SHARE_DELETE,
		nil, syscall.OPEN_EXISTING, syscall.FILE_ATTRIBUTE_NORMAL, 0)
	if err != nil {
		return nil, err
	}
	f := os.NewFile(uintptr(h), path)
	defer f.Close()
	return io.ReadAll(f)
}
```

- `cache.go:182` `blob, err := os.ReadFile(dataFile)` → `blob, err := readShared(dataFile)`.
- `cache.go:181` 의 "공유 모드로 게임 실행 중에도 읽기 가능" 주석을 실제 동작에 맞게 갱신.
- import 에 `io`, `syscall` 추가.

## Item 4 · 문서 최신화

코드 변경(용어·파일 점유 동작)이 닿는 문서만 정정한다. 일반 '천장' 카테고리 표기와 하드천장(cap) 표기는 정당하므로 유지한다.

| 파일·위치 | 현재 | 변경 | 사유 |
|---|---|---|---|
| `README.md:64` | `5★ 평균 천장을 이론 평균 62.5회...` | `5★ 평균 뽑기 수를 이론 평균 62.5회...` | 평균 지표(`avgPity5`) 지칭 |
| `README.md:65` | `**평균 천장** — 캐릭터 5★ 평균 천장(+ 최고/최악 운).` | `**평균 뽑기 수** — 캐릭터 5★ 평균 뽑기 수(+ 최고/최악 운).` | 평균 지표 지칭 |
| `docs/architecture.html:335` | 주제 `게임 실행 중 캐시 파일 읽기 (공유 모드)` / 근거 `... (Windows 공유 모드로 열어 게임 실행 중에도 읽기 가능)` | 주제 `게임 실행 중 캐시 파일 읽기 (FILE_SHARE_DELETE)` / 근거 `internal/collector/cache.go의 readShared — os.ReadFile은 FILE_SHARE_DELETE 누락으로 게임 점유 시 실패. syscall.CreateFile로 READ\|WRITE\|DELETE 공유 열기` + [Win32 CreateFileW 공식 문서](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-createfilew) 링크 | 기존 서술이 실제 동작과 반대(점유 시 실패가 진짜) |
| `docs/ARCHITECTURE.md:14` | `FindAuthContext`(... `data_2` 읽어 ... ) | 같은 문장에 "`readShared`로 `FILE_SHARE_DELETE` 포함 공유 열기 — 게임 실행 중에도 읽음" 한 절 추가 | 수집 동작 정확화 |

**유지(변경 금지)**: `README.md:3,72`(일반 '천장' 카테고리·하드천장), `architecture.html:79,155,230,238`(일반 분석 카테고리·BANNERS cap 컬럼), `ARCHITECTURE.md:11,26`(일반 불변식 표기).

**Item 1(드롭다운 순서)**: README·ARCHITECTURE 어디에도 정렬 방향이 문서화돼 있지 않으므로 문서 변경 없음.

## 테스트 계획 (테스트 먼저, 구현 나중)

### Item 3 — 자동 (Windows 결정적)
`internal/collector/cache_test.go` 에 신규:

- `TestReadShared_SucceedsWhenOsReadFileBlocked`:
  1. 임시 파일에 알려진 내용을 쓴다.
  2. 그 파일을 `syscall.CreateFile` 로 **`GENERIC_READ|DELETE` 접근 + 풀 공유 모드**로 선점(게임이 DELETE 권한으로 쥔 상태 재현). 핸들은 테스트 종료까지 연 채 유지.
  3. `os.ReadFile(path)` 가 **실패**함을 단언(sharing violation 재현 — fix 전 기준선).
  4. `readShared(path)` 가 **성공하고 내용이 일치**함을 단언.
  - 선점 핸들은 `defer syscall.CloseHandle` 로 정리.

### Item 1·2 — 수동 (JSX 테스트 하네스 없음)
JSX 렌더용 자동 테스트 하네스가 없으므로 자동 테스트를 추가하지 않는다. 대신:

- `hsr-warp.exe` 실행 → 대시보드에서 버전 구간 드롭다운이 **내림차순(최신 위), '전체 기간' 맨 위**인지 육안 확인.
- 6곳 라벨이 모두 '평균 뽑기 수' 계열로 바뀌었는지 육안 확인.
- `analyze.js` 무변경이므로 `node web/analyze.test.js` 가 **여전히 통과**해야 함(회귀 가드).
- `go test ./...` 전체 통과(Item 3 신규 테스트 포함).

### Item 4(문서) — 수동
- 변경 후 `README.md`·`docs/ARCHITECTURE.md`·`docs/architecture.html` 에 '평균 천장'(평균 지표 지칭) 잔여 0건, 추가한 Win32 링크 정상 동작 육안 확인.

## 비범위 (YAGNI)

- 다른 '천장' 용법의 일괄 재검토(개별 pity·cap·분포)는 하지 않는다 — 평균 지표만 부정확했으므로.
- Item 3 의 read-deny(공유 자체를 막는) 시나리오용 폴백(재시도·볼륨 섀도카피)은 추가하지 않는다 — 현 원인은 DELETE 공유 누락이며, 그 경우 본 fix 로 해결된다.
