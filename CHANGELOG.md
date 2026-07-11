# 변경 내역

이 프로젝트의 주요 변경 사항을 기록합니다. 형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/)를,
버전 체계는 [유의적 버전(SemVer)](https://semver.org/lang/ko/)을 따릅니다.

릴리스별 상세 산출물(zip·설치 파일·체크섬)은 [GitHub Releases](https://github.com/jkas2016/hsr-warp/releases)에 있습니다.

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

[0.4.1]: https://github.com/jkas2016/hsr-warp/releases/tag/v0.4.1
[0.4.0]: https://github.com/jkas2016/hsr-warp/releases/tag/v0.4.0
[0.3.0]: https://github.com/jkas2016/hsr-warp/releases/tag/v0.3.0
[0.2.0]: https://github.com/jkas2016/hsr-warp/releases/tag/v0.2.0
[0.1.0]: https://github.com/jkas2016/hsr-warp/releases/tag/v0.1.0
[0.1.0-pre]: https://github.com/jkas2016/hsr-warp/releases/tag/v0.1.0-pre
