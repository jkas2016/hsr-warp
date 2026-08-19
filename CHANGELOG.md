# 변경 내역

이 프로젝트의 주요 변경 사항을 기록합니다. 형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/)를,
버전 체계는 [유의적 버전(SemVer)](https://semver.org/lang/ko/)을 따릅니다.

릴리스별 상세 산출물(zip·설치 파일·체크섬)은 [GitHub Releases](https://github.com/jkas2016/hsr-warp/releases)에 있습니다.

## [Unreleased]

### 수정됨
- ZZZ 조회가 항상 `auth key time out` 으로 실패하던 문제 — 캐시에 살아있는 authkey 가 있는데도 며칠 전 죽은 authkey 를 골라 보내고 있었다. 원인은 최신 판정 기준이던 URL 의 `timestamp` 쿼리로, 이 값은 게임이 가챠 웹뷰 URL 을 만들 때 박은 것이라 새 세션에서 새 authkey 를 받아도 갱신되지 않는다(ZZZ 2.51 실측 — 8/14·8/18·8/20 세션의 authkey 는 전부 다른데 timestamp 는 7/29 값 그대로). 이제 Chromium 캐시 엔트리의 기록 시각으로 후보를 정렬하고, 조회 전에 후보를 실제로 두드려 살아있는 authkey 를 고른다. 캐시 포맷을 못 읽으면 기존 방식으로 폴백한다. HSR 에도 같은 함정이 있었다
- ZZZ 조회 시 authkey 가 만료돼도 만료 안내 대신 `API 오류 (retcode=-1): auth key time out` 원문이 그대로 뜨던 문제 — 만료를 retcode `-101` 로만 판정했는데, ZZZ 엔드포인트(`public-operation-common`)는 `retcode=-1` + `message: "auth key time out"` 으로 알린다. 이제 메시지도 함께 보고 판정해, 발급 시각·경과 일수와 "게임 안에서 기록 화면을 직접 열라"는 안내가 정상적으로 표시된다

## [1.0.1] - 2026-08-19

1.0.0 의 남은 자국을 지우는 릴리스. 설치 마법사 체크박스 잘림을 근본 원인까지 잡았고, 스타레일에만 묶여 있던 아이콘을 두 게임 공용으로 바꿨다.

### 추가됨
- 조회 가능 기간 안내 — 두 README와 가이드 사이트 FAQ(ko/en/zh/ja)에 "얼마나 예전 기록까지 가져오나요?" 항목 추가. ZZZ는 게임 서버가 최근 약 6개월치만 반환하는 반면 HSR은 실측상 그보다 오래된 기록도 반환된다는 차이를 명시한다 (#55)

### 변경됨
- 앱 아이콘을 '워프 티켓'(양옆이 파인 티켓 + 4점 별 음각)으로 교체 — 기존 아이콘은 스타레일의 개척 열차를 형상화한 것이라 ZZZ까지 지원하는 지금은 한쪽 게임에만 묶였다. exe 아이콘·웹 파비콘(`icon.ico`·`web/favicon.ico`·`web/favicon.svg`)이 모두 바뀐다 (#56)

### 수정됨
- 설치 마법사 체크박스가 고DPI에서 좌우로 잘리던 문제 — 1.0.0 의 `WizardStyle=modern windows11` 회피는 불완전했고, 선택·해제 어느 상태든 200% 스케일에서 테두리가 깎였다. 원인은 Inno Setup 의 `TNewCheckListBox` 가 `GetThemePartSize` 로 얻은 사각형을 `DrawThemeBackground` 의 클립으로 그대로 넘기는 것. 작업 목록·실행 목록을 숨기고 네이티브 `TNewCheckBox` 로 대체했다 (#56)

## [1.0.0] - 2026-08-18

단일 exe가 두 게임을 추적하게 된 첫 안정 릴리스. HSR 전용 도구에서 벗어나 게임 어댑터 구조를 갖췄고, 안내 문서·설치 마법사까지 멀티게임 기준으로 정리했다.

### 추가됨
- 젠레스 존 제로(ZZZ) 지원 — 단일 exe로 HSR·ZZZ 모두 추적. 헤더 게임 스위처, 게임별 데이터 저장(`data/hsr/`·`data/zzz/`), 게임별 배너 일정 채널(`/zzz/schedule.json`), 게임별 팔레트·용어 i18n(변조·채널·S급·에이전트·W-엔진 등, ko/en/zh/ja 모두 각 언어 클라이언트 표기 기준). 기존 사용자의 데이터(`data/warp_*.json`)는 앱 시작 시 `data/hsr/`로 자동 이동(1회, 비파괴) (#51)
- ZZZ 배너 일정 데이터 — `scripts/extract-zzz-schedule.mjs`가 [FuriaPaladins/Hoyoverse-Data](https://github.com/FuriaPaladins/Hoyoverse-Data)에서 추출해 repo에 벤더링, `npm run schedule:status`가 두 게임 모두 보고 (#51)
- 가이드 사이트 다국어(en/zh/ja) 지원 — 언어별 프리렌더 4페이지(`/`, `/en/`, `/zh/`, `/ja/`), 루트 자동 언어 이동(?lang → localStorage → navigator → ko), 지구본 언어 전환 UI, 언어별 SEO 메타(og·hreflang) (#46)
- 중국어·일본어 웹폰트(`Noto Sans SC`/`JP`) — 기존 `Noto Sans KR` 이 못 덮는 간체 한자·신자체가 OS 폴백으로 떨어지던 문제 해소 (#46)
- README 영어 주 전환 + `README.ko.md` 분리, 저장소 description·topics 설정 (#46)
- 설치 마법사 한국어·영어 지원 — 작업·아이콘·실행 문구를 Inno Setup 표준 메시지 상수로 전환해 선택한 언어를 따른다. 프로그램 목록 아이콘(`UninstallDisplayIcon`)도 표시된다 (#51)

### 변경됨
- README·가이드 사이트를 멀티게임 안내로 전환 — 두 README와 사이트 사전 4벌(ko/en/zh/ja)에서 게임별로 갈리는 것만 병기한다(기록 화면 진입 경로, 게임 폴더, 저장 위치 `data\hsr\`·`data\zzz\`, 저장 형식 SRGF v1.0 / UIGF v4.0). 사이트 로고는 두 게임을 겹쳐 표시 (#51)

### 수정됨
- ZZZ 기록 화면 진입 경로 안내가 화면 이름만 담고 있던 문제 — ZZZ는 변조 화면과 기록 사이에 「상세」가 한 단계 더 있어 이 안내만으로는 기록 화면에 닿지 못했다. 네 언어 모두 3단계 경로로 교정(변조 → 상세 → 변조 기록) (#51)
- 설치 마법사가 고DPI에서 작업 목록 체크박스 왼쪽이 잘리던 문제 — `WizardStyle=modern windows11` 로 회피(Inno Setup 6.7.3 현재 기본 테마 경로의 버그) (#51)
- 가이드 아키텍처 문서 링크가 하위 경로 페이지(`/en/`·`/zh/`·`/ja/`)에서 404 나던 문제 — base 절대 경로로 수정 (#46)
- 가이드 FAQ 의 소스 빌드 요구사항 정정 — `go` 도 설치돼 있어야 하며 PATH 에는 `node` 만 필요 (4개 언어) (#46)

## [0.5.0] - 2026-07-20

### 추가됨
- 4.4 배너 데이터 적용 — 픽업 일정 3건(1페이즈·Fate 콜라보 2탄·2페이즈 발표분) + 신규 캐릭터/광추 4개 국어 이름, 데이터 version 3→4로 설치본 자동 배포 (#45)
- `npm run schedule:status` — 배너 데이터가 몇 버전까지 대응됐는지 루트에서 즉시 확인 (#45)
- 배너별 탭에 운 지표·픽승률 추가(배너별 산출, 3×2 스탯 그리드) (#45)

### 변경됨
- 개요 운 지표·픽승률·평균 뽑기 수를 캐릭터+광추 합산으로 통일(5★ 개수 가중 `combineLimited`). 운 지표는 % 대신 기준선 대비 회수 차이("{n}회 더 많이/더 빨리") + 표본 구성 표기 (#45)
- 일반(스텔라)·출발(초심자) 워프를 대시보드 집계 전체에서 제외 — 모든 집계가 한정 배너 기준. 수집·저장(SRGF)은 그대로 (#45)
- 버전 콤보박스가 대응된 전 버전(1.0~4.4)을 노출 — 무뽑기 버전 선택 시 0 통계 표시 (#45)
- 버전 비교 하단 테이블 최신 버전 우선(DESC), 배너별 현황 카드 2열 + 내부 가로형 재배치 (#45)

### 수정됨
- 버전 스코프 + 배너별 탭에서 스코프에 없는 배너 선택 시 크래시(`b.color` undefined) — `pickBanner` 폴백 (#45)

## [0.4.1] - 2026-07-11

전체 저장소 심층 코드 리뷰에서 나온 데이터 무결성·견고성 수정을 모은 패치 릴리스. 신규 기능은 없다.

### 수정됨
- 동시 `/api/fetch` 수집 경합 방지 — 조회가 겹칠 때 레코드 유실·저장 파일 손상 위험 제거(거절 가드·원자적 저장·취소) (#18)
- 병합 dedup 우선순위 정정 — 재조회로 갱신된 정정 레코드가 기존 레코드보다 우선 반영 (#19)
- collector fetch 견고성 — HTTP 상태 확인·페이지 무한루프 방지·ID 폴백·음수 일수 처리 (#20)
- collector 크로스플랫폼 빌드 — Windows 전용 빌드 제약 분리로 비-Windows에서 테스트가 통째 스킵되던 문제 해소 (#17)
- Go 백엔드 견고성 — `slog` 전환·`.tmp` 잔여 정리·flusher·`parseVer` 계약 명시 (#25)
- CDN 스크립트 무결성(SRI) + 프로덕션 빌드 + 버전 고정 (#23)
- 대시보드 5★ 표 안정 per-row key — 정렬·필터 시 잘못된 상세 모달이 열리던 문제 수정 (#22)
- 대시보드 언어 전환 반응성 — `lang`을 React prop으로 끌어올려 렌더 순수성 회복 (#21)

### 정리됨
- 대시보드 React 관례 정리 — 내부 컴포넌트·중첩 삼항·하드코딩 제거 (#27)
- `main.go`·빌드·프리렌더 스크립트 견고성 — 조용한 실패·진단성 갭 정리 (#26)
- `copy.test.mjs` 실제 불변식 검증으로 false-pass 제거 (#24)

## [0.4.0] - 2026-07-05

### 추가됨
- 대시보드 다국어(i18n) — 한국어(기본)·영어·중국어·일본어 4개 언어. 언어 셀렉터 + 선택 영속화(URL·localStorage). 가챠 용어는 각 언어권 통용 표현으로 매핑, 캐릭터·광추 이름도 로컬라이즈(Mar-7th/StarRailRes 기반) (#12)
- 공식 가이드 사이트(GitHub Pages) + 문서 확장 (#9, #14)
- 버전 비교 화면에 광추 배너 비교 추가 (#12)

### 변경됨
- '천장' 용어 정정 — 5★ 획득까지의 뽑기 수 분포 차트 라벨을 '천장 분포' → '획득 뽑기 수 분포'로 정정 (#12)

## [0.3.0] - 2026-06-27

### 추가됨
- 대시보드를 디자인 시스템 React 킷으로 개편 (#10)
- MIT 라이센스 추가

### 변경됨
- 버전 구간 드롭다운을 내림차순(최신 위)으로 정렬, '전체 기간'은 맨 위 고정 (#11)
- '평균 천장' 문구를 '평균 뽑기 수'로 정정 — '천장'은 hard pity(90) 용어라 평균값에 부적절 (#11)

### 수정됨
- 게임 실행 중 캐시 파일(`data_2`) 점유로 조회가 실패하던 문제 해결 — `os.ReadFile`의 `FILE_SHARE_DELETE` 누락이 원인이라 stdlib `syscall.CreateFile`로 공유 열기 (#11)

## [0.2.0] - 2026-06-21

### 추가됨
- 게임 버전별 통계 화면 (#7)
- 버전 타임라인에 4.4 추가 (2026-07-15)

### 변경됨
- 대시보드 UI 개선 — 5★/월별 더보기 페이징, 출발 워프 카드 숨김 (#5)

## [0.1.0] - 2026-06-06

### 추가됨
- 사용자 자동 업데이트 — 콘텐츠 타입 2채널 (#6)

## [0.1.0-pre] - 2026-06-04

### 추가됨
- 단일 실행파일화: 게임 캐시에서 authkey 추출 → 로컬 서버 + 라이브 증분 조회 (#1)

[1.0.1]: https://github.com/jkas2016/hsr-warp/releases/tag/v1.0.1
[1.0.0]: https://github.com/jkas2016/hsr-warp/releases/tag/v1.0.0
[0.5.0]: https://github.com/jkas2016/hsr-warp/releases/tag/v0.5.0
[0.4.1]: https://github.com/jkas2016/hsr-warp/releases/tag/v0.4.1
[0.4.0]: https://github.com/jkas2016/hsr-warp/releases/tag/v0.4.0
[0.3.0]: https://github.com/jkas2016/hsr-warp/releases/tag/v0.3.0
[0.2.0]: https://github.com/jkas2016/hsr-warp/releases/tag/v0.2.0
[0.1.0]: https://github.com/jkas2016/hsr-warp/releases/tag/v0.1.0
[0.1.0-pre]: https://github.com/jkas2016/hsr-warp/releases/tag/v0.1.0-pre
