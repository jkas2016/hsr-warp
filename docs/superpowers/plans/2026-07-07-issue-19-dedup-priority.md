# 이슈 #19 — 병합 dedup 우선순위(신규 우선) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 같은 ID 레코드가 기존 저장본과 새 조회 양쪽에 있을 때 **신규(재조회) 레코드가 이기도록** `WriteAffectedMonths`의 병합 순서를 반전해, 정정된 이름·등급·시각이 반영되게 한다.

**Architecture:** `dedupByID`의 "먼저 본 레코드 유지" 계약은 그대로 두고, `WriteAffectedMonths`의 병합 입력을 `recs`(신규)가 앞서도록 재구성한다(`append(existing.List, recs...)` → 신규 먼저). 단일 파일·단일 라인 로직 변경 + 정책 강제 테스트 + doc 코멘트.

**Tech Stack:** Go 1.26, `testing`.

## Global Constraints

- **정책 = 신규 우선**: ID 충돌 시 재조회 레코드가 기존을 덮어쓴다(사용자 승인).
- **저장은 비파괴**: `TestWriteAffectedMonths_PreservesUntouchedMonths`·`TestWriteAffectedMonths_MergesAndDedupsWithinMonth`·`TestWriteAffectedMonths_ConcurrentNoCorruption` 통과 유지.
- **ID는 거대 정수**: `dedupByID`/`sortByID`의 `idLess` 로직 불변.
- **비-앨리어싱**: 병합 입력 재구성 시 `existing.List` 백킹 배열을 변이하지 않도록 새 슬라이스로 시작.
- **포맷·정적검사 권위**: `gofmt -w .`, `go vet ./...`.

---

## 파일 구조

| 파일 | 변경 | 책임 |
|---|---|---|
| `internal/store/store.go` | Modify | `WriteAffectedMonths` 병합 순서 반전(신규 우선) + doc 코멘트에 정책 명시 |
| `internal/store/store_test.go` | Modify | ID 충돌 시 신규 우선 강제 테스트 추가 |

---

### Task 1: 병합 순서 반전 — 신규 우선 (TDD)

**Files:**
- Modify: `internal/store/store.go` (`WriteAffectedMonths` 병합 라인 + doc 코멘트)
- Modify: `internal/store/store_test.go` (테스트 1개 추가)

**Interfaces:**
- Produces: `WriteAffectedMonths(dir string, info Info, newRecords []Record) ([]string, error)` — 시그니처 불변. ID 충돌 시 `newRecords`의 값이 기존 파일 값을 이긴다.

- [ ] **Step 1: 신규 우선 강제 테스트 작성 (RED)**

`internal/store/store_test.go`에 추가(파일 상단 import에 `"path/filepath"`가 이미 있음 — 없으면 추가):
```go
// 같은 ID 를 정정된 값으로 재조회하면 신규 레코드가 기존을 덮어써야 한다(신규 우선).
// 현재는 기존 우선이라 정정된 이름/등급이 조용히 버려진다.
func TestWriteAffectedMonths_NewRecordWinsOnIDCollision(t *testing.T) {
	dir := t.TempDir()
	info := Info{UID: "1"}
	old := Record{ID: "10", GachaType: "11", Time: "2026-06-01 09:00:00", RankType: "3", Name: "구명칭", ItemID: "1001"}
	if _, err := WriteAffectedMonths(dir, info, []Record{old}); err != nil {
		t.Fatal(err)
	}
	// 같은 ID 를 정정된 이름/등급으로 재조회.
	corrected := Record{ID: "10", GachaType: "11", Time: "2026-06-01 09:00:00", RankType: "5", Name: "정정명칭", ItemID: "1001"}
	if _, err := WriteAffectedMonths(dir, info, []Record{corrected}); err != nil {
		t.Fatal(err)
	}
	s, err := readSRGF(filepath.Join(dir, "warp_202606.json"))
	if err != nil {
		t.Fatal(err)
	}
	var got []Record
	for _, r := range s.List {
		if r.ID == "10" {
			got = append(got, r)
		}
	}
	if len(got) != 1 {
		t.Fatalf("ID 10 은 dedup 되어 1개여야 함, got %d", len(got))
	}
	if got[0].Name != "정정명칭" || got[0].RankType != "5" {
		t.Fatalf("신규 우선이어야 함: got Name=%q Rank=%q", got[0].Name, got[0].RankType)
	}
}
```

- [ ] **Step 2: 테스트 실행 → 실패 확인 (RED)**

Run: `go test ./internal/store/ -run TestWriteAffectedMonths_NewRecordWinsOnIDCollision -v`
Expected: FAIL — 현재 `dedupByID(append(existing.List, recs...))`는 기존("구명칭")을 먼저 보고 유지 → `got[0].Name == "구명칭"` → "신규 우선이어야 함: got Name=\"구명칭\"".

- [ ] **Step 3: 병합 순서 반전 구현**

`store.go`의 `WriteAffectedMonths` 병합 라인(현재 168행)을 신규 먼저로 교체:
```go
		// ID 충돌 시 신규(재조회) 레코드가 이기도록 recs 를 앞에 둔다 — dedupByID 는
		// 먼저 본 레코드를 유지하므로, 정정된 이름/등급/시각이 기존 저장본을 덮어쓴다.
		// (existing.List 백킹 배열을 변이하지 않도록 새 슬라이스로 시작.)
		merged := dedupByID(append(append([]Record{}, recs...), existing.List...))
```

- [ ] **Step 4: 테스트 실행 → 통과 확인 (GREEN)**

Run: `go test ./internal/store/ -run TestWriteAffectedMonths_NewRecordWinsOnIDCollision -v`
Expected: PASS

- [ ] **Step 5: WriteAffectedMonths doc 코멘트에 정책 명시**

`WriteAffectedMonths` 함수 위 doc 코멘트(현재 "newRecords 를 월별로 그룹핑해…")에 신규 우선 정책 한 줄 추가. 예:
```go
// WriteAffectedMonths 는 newRecords 를 월별로 그룹핑해, 신규가 생긴 월 파일만
// 기존 내용과 병합(중복제거·정렬)해 재작성한다. 손대지 않은 월 파일은 보존된다.
// 같은 ID 가 기존·신규 양쪽에 있으면 신규(재조회) 레코드가 이긴다(정정 반영).
// 갱신된 월 코드 목록(정렬됨)을 반환한다.
```

- [ ] **Step 6: store 패키지 전체 회귀 확인 (-race)**

Run: `go test -race ./internal/store/ -v`
Expected: 전부 PASS — 기존 불변식 3종 + 신규 테스트. race 경고 없음.

- [ ] **Step 7: gofmt + commit**

```bash
gofmt -w internal/store/
git add internal/store/store.go internal/store/store_test.go
git commit -m "fix(store): 병합 dedup 신규 우선 — 재조회 정정 레코드 반영 (#19)

WriteAffectedMonths 병합 입력을 recs(신규) 먼저로 반전해, ID 충돌 시 재조회된
정정 레코드가 기존 저장본을 덮어쓰도록 함. dedupByID 계약(먼저 본 것 유지)은
불변. 신규 우선을 강제하는 테스트 추가, doc 코멘트에 정책 명시.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: 전체 검증 게이트

**Files:** (없음 — 검증만)

- [ ] **Step 1: 전체 npm test**

Run: `npm test`
Expected: go(전 패키지)·analyze·대시보드·사이트 copy 전부 PASS.

- [ ] **Step 2: 이슈 #19 완료 기준 대조**
- 같은 ID 정정 레코드 병합 시 신규 우선 결과(Task 1 `TestWriteAffectedMonths_NewRecordWinsOnIDCollision`)
- 기존 저장 불변식 회귀 없음(Task 1 Step 6, Task 2 Step 1)

---

## Self-Review

**1. Spec coverage (이슈 #19 작업 항목 대조):**
- ✅ 정책 결정: 신규 우선 확정(사용자 승인)
- ✅ 신규 우선이면 순서 반전 → Task 1 Step 3(`append(append([]Record{}, recs...), existing.List...)`)
- ✅ 선택한 우선순위 강제 테스트 → Task 1 Step 1
- ✅ (겸) doc 코멘트에 정책 명시 → Task 1 Step 5
- ✅ 완료 기준: 신규 우선 검증(Task 1), 불변식 회귀 없음(Task 1 Step 6)

**2. Placeholder scan:** 모든 코드/명령/기대출력 실제 내용. TBD 없음.

**3. Type consistency:** `WriteAffectedMonths` 시그니처 불변. `dedupByID`/`readSRGF`/`Record` 필드(`ID`,`Name`,`RankType`) 사용 일치.

**검증 리스크:**
- **앨리어싱**: `append(existing.List, recs...)`는 `existing.List` 백킹 배열을 변이할 수 있었으나, 새 형식 `append([]Record{}, recs...)`는 빈 슬라이스로 시작해 안전. `existing`은 매 월 `readSRGF`로 새로 읽으므로 재사용 위험도 낮음.
- **LoadAll 영향 없음**: `LoadAll`의 `dedupByID(all)`는 월 파일 간 dedup으로, 같은 ID가 서로 다른 월에 걸치지 않아 이 변경의 영향권 밖.
