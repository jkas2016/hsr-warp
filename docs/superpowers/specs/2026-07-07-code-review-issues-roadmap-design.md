# 심층 코드 리뷰 이슈 공략 로드맵

작성일: 2026-07-07
대상: [jkas2016/hsr-warp](https://github.com/jkas2016/hsr-warp) 열린 이슈 #17–#29 (심층 코드 리뷰 결과 13건)

## 목적

전체 저장소 심층 코드 리뷰에서 나온 13개 이슈를 **어떤 순서·묶음(PR 단위)으로 처리할지** 확정한다.
실제 수정은 이 문서를 근거로 이후 세션에서 진행한다. 이 문서는 구현 설계가 아니라 **작업 순서·의존성·파일 충돌 회피**를 정하는 로드맵이다.
각 이슈의 상세 스코프·작업·완료 기준은 GitHub 이슈 본문이 단일 소스다 — 여기서 중복하지 않는다.

## 진행 상황 (2026-07-08 갱신)

**Track A (Go 백엔드) 5개 전부 완료·머지됨** ✅ — main 에 이슈당 1개 스쿼시 커밋으로 선형 통합.

| 이슈 | 상태 | PR | main 커밋 |
|---|---|---|---|
| #17 | ✅ 완료·머지 | #30 | `16990a5` |
| #18 | ✅ 완료·머지 | #35 (구 #31)¹ | `9aff6c7` |
| #19 | ✅ 완료·머지 | #32 | `98df59b` |
| #25 | ✅ 완료·머지 | #33 | `d88203d` |
| #20 | ✅ 완료·머지 | #34 | `d16b142` |
| #21·#22·#23·#24·#26·#27·#28·#29 | ⬜ 미착수 | — | — |

**실제 실행 순서**(권장 순서와 다름): Track A 를 스택형 PR 로 한 번에 처리 — `#17 → #18 → #19 → #25 → #20`. 각 PR 은 이전 PR 브랜치 위에 스택했고, 머지 시 스쿼시 + 부모 위로 rebase 로 선형화.

¹ **스택형 PR 스쿼시 머지 교훈**: 부모 브랜치를 `--delete-branch` 로 지우면 그 브랜치를 base 로 하던 자식 PR 이 GitHub 에서 자동 CLOSED 된다(#18 의 PR#31 이 이렇게 닫혀 PR#35 로 대체). **부모 머지 전에 자식 PR 을 미리 base=main 으로 재타깃**한 뒤 진행하면 안전하다.

## 대상 이슈 요약

| # | 제목 | 우선순위 | 종류 | 상태 |
|---|---|---|---|---|
| #17 | collector Windows 빌드 제약 누락 — darwin 테스트 스킵 | high | bug | ✅ |
| #18 | 동시 `/api/fetch` 수집 경합 — 레코드 유실·파일 손상 | high | bug | ✅ |
| #19 | 병합 dedup 우선순위 — 재조회 레코드 유실 | medium | bug | ✅ |
| #20 | collector fetch 견고성 (HTTP 상태·페이지 상한·ID 폴백·음수 일수) | medium | bug | ✅ |
| #21 | 대시보드 언어 전환 반응성 — useEffect 전역 deps·render 부수효과 | medium | bug | ⬜ |
| #22 | FivesTable 리스트 key=index → 잘못된 상세 모달 | medium | bug | ⬜ |
| #23 | CDN 스크립트 SRI 누락 + 프로덕션 빌드 (보안) | medium | bug | ⬜ |
| #24 | copy.test.mjs false-pass — 실제 copy 불변식 미검증 | medium | bug | ⬜ |
| #25 | Go 백엔드 견고성 정리 — slog·.tmp 정리·flusher·parseVer | low | task | ✅ |
| #26 | main.go·빌드·프리렌더 스크립트 견고성 | low | task | ⬜ |
| #27 | 대시보드 React 관례 정리 — 중첩삼항·내부컴포넌트·하드코딩 | low | task | ⬜ |
| #28 | i18n items.js ko 로케일 갭 재생성 | low | docs | ⬜ |
| #29 | vite crossorigin iOS Safari — 실기기 검증 필요 | low | question | ⬜ |

## 배치 원칙

**원칙 A — 1 이슈 = 1 PR (더 쪼개지 않는다).**
이 13개는 심층 리뷰에서 의도적으로 묶인 클러스터다(각 이슈 "참고"에 "통합"·"묶음" 명시). 예: #18은 server.go/store.go 동시성을 한 덩어리로, #25는 Go 견고성 minor들을 한 덩어리로 묶었다. 더 쪼개면 "한 작업은 한 PR" 원칙에 어긋나고 리뷰만 어려워진다. **이슈가 곧 PR 경계.** 로드맵의 일은 쪼개기가 아니라 **순서 정하기 + 파일 충돌 회피**다.

**원칙 B — 파일이 서로소인 3개 트랙은 병렬 가능.**
이슈들이 건드리는 파일로 나누면 서로소인 3트랙이 나온다. 다른 세션/에이전트로 병렬 진행해도 머지 충돌이 없다. 순서 제약은 트랙 **안**에서 같은 파일을 건드리는 이슈끼리만 발생한다.

| 트랙 | 도메인 | 이슈 |
|---|---|---|
| **A. Go 백엔드** | `internal/collector`, `internal/store`, `internal/server` | #17, #18, #19, #20, #25 |
| **B. 대시보드 React** | `web/ui_kits/dashboard/` | #21, #22, #27 |
| **C. 보안·빌드·문서** | `index.html`, `architecture.html`, `docs/site/`, `main.go`, `scripts/` | #23, #24, #26, #28, #29 |

## 트랙별 상세 순서 & 의존성

### 트랙 A — Go 백엔드 ✅ 완료

```
#17 ✅ ──► #18 ✅ ──► #19 ✅ ──► #25 ✅ ──► #20 ✅   (실제: 전부 스택형 직렬로 처리)
```

> 계획 당시엔 #20 을 #18 과 병렬 가능이라 봤으나, **#18 도 `fetch.go`(FetchIncremental 에 ctx 추가)를 수정**해 실제론 겹쳤다. 그래서 #20 을 스택 맨 위(#25 뒤)에 얹어 직렬 처리했다.

- **#17 먼저 (foundation).** priority:high이자 **언블록커**. 현재 collector 패키지가 darwin에서 빌드 실패라 `go test ./internal/collector/`가 통째로 스킵된다. #17을 먼저 해야 #20이 추가하는 fetch.go 테스트를 dev기(darwin)에서 실제로 돌려 검증할 수 있다.
- **#18 → #19 → #25는 직렬.** 셋 다 `store.go`를 건드린다. #18이 원자적 write·`WriteAffectedMonths` 경로를 재구조화 → #19(dedup 순서 반전, 소규모)가 그 위에 얹힘 → #25(readSRGF 계약 명시 등 견고성)가 정리. 순서를 어기면 store.go에서 리베이스 충돌.
- **#20은 #17만 끝나면 #18과 병렬** 가능 (fetch.go는 store.go와 무관).

### 트랙 B — 대시보드 React

```
#22   (FivesTable.jsx 단독 → 트랙 내 독립, 언제든)
#21 ──► #27   (effect deps·data.js 겹침 → 직렬)
```

- **#22는 완전 독립** (FivesTable.jsx만). 작고 medium — quick win.
- **#21 → #27 직렬.** #21이 언어를 React 상태로 끌어올리며 `Dashboard/ChartsGrid/VersionsView`의 effect·부수효과를 고침 → #27은 그 위에서 `BannersView` effect deps·`HeroSummary`·`data.js` 관례 정리. 둘 다 effect deps와 `data.js`를 건드려 겹침 → 행동 수정(#21) 먼저, 클린업(#27) 나중.

### 트랙 C — 보안·빌드·문서

```
#23   (index.html / architecture.html 단독)
#24   (copy.test.mjs 단독)
#26 ──► #28   (extract-item-names.mjs 겹침)
#29   (실기기 검증 선행 — 코드 PR 아닐 수 있음)
```

- **#23, #24는 각자 독립** 단독 PR. #23(SRI/prod build)은 보안이라 medium — quick win.
- **#26 → #28 순서.** #26이 `extract-item-names.mjs`에 타임아웃·재시도 추가 → #28은 견고해진 스크립트로 `items.js` 재생성. **#28은 외부 의존**(StarRailRes 상위 소스에 ko명이 채워졌는지)이라, 안 채워졌으면 재생성해도 갭이 남아 defer될 수 있다.
- **#29는 코드 PR이 아니라 검증 태스크.** iOS Safari 실기기(또는 동등 환경)에서 흰 화면 재현부터. 재현되면 3줄짜리 vite `transformIndexHtml` 플러그인 PR, 안 되면 "재현 불가"로 close. memory에 관련 패턴 노트 존재 → 재현 시 수정은 자명.

## 권장 실행 순서 (단일 개발자 기준)

우선순위 + 언블록 + 리스크(데이터 무결성 우선)로 정렬:

| 순번 | 이슈 | 근거 | 상태 |
|---|---|---|---|
| 1 | **#17** | high, collector 테스트 언블록 (foundation) | ✅ |
| 2 | **#18** | high, 비파괴 저장 불변식 — 최고 리스크 | ✅ |
| 3 | **#19** | store.go, #18 위에 얹힘 | ✅ |
| 4 | **#20** | collector, #17 필요 | ✅ |
| 5 | **#22** | medium, 작고 독립 — quick win | ⬜ |
| 6 | **#23** | medium, 보안 quick win | ⬜ |
| 7 | **#24** | medium, 테스트 무결성 | ⬜ |
| 8 | **#21** | medium, 대시보드 행동 | ⬜ |
| 9 | **#25** | low, store.go 안정된 뒤 | ✅ |
| 10 | **#26** | low, 빌드 스크립트 | ⬜ |
| 11 | **#27** | low, #21 뒤 프론트 클린업 | ⬜ |
| 12 | **#28** | low, #26 뒤 (외부 소스 gated) | ⬜ |
| 13 | **#29** | low, 검증 선행 (close 가능) | ⬜ |

병렬로 진행할 경우 A/B/C 세 트랙을 각자 위 순서대로 돌린다.

**남은 작업(9건): 트랙 B(#21·#22·#27) · 트랙 C(#23·#24·#26·#28·#29).** 둘 다 Go 백엔드(트랙 A) 밖이라 완료된 스택과 파일이 서로소 — `main` 에서 독립 브랜치로 시작하면 된다(더는 스택 불필요).

## 트랙 간 불변식 (모든 PR 공통)

- **ID는 거대 정수**: Go `math/big`, JS `BigInt`. `Number`/float 금지.
- **저장은 비파괴**: `TestWriteAffectedMonths_PreservesUntouchedMonths` 통과 유지 — 특히 #18·#19·#25.
- **50/50·분석 로직은 `web/analyze.js` 단일 소스**: 킷에서 재구현 금지 — 특히 #21·#27.
- **새 에러 로그는 `slog`**: ERROR 스택 자동 첨부 — 특히 #25·#26.
- **테스트 권위**: `gofmt -w .`, `go vet ./...`, `npm test`.

## 다음 단계

이 로드맵은 13개 이슈를 **개별 spec → plan → 구현 사이클로 분해**한 것이다. 각 이슈는 착수 시점에 자체 브레인스토밍/플랜을 거친다(대부분 이슈 본문이 이미 완료 기준을 명시해 곧바로 플랜 가능). 이 문서는 그 순서·의존성의 단일 참조점이다.
