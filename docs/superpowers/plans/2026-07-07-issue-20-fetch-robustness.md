# 이슈 #20 — collector fetch 견고성 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `FetchIncremental` 증분 조회 루프의 견고성 갭 4종을 고쳐 조용한 오판(수집 실패를 "신규 없음"으로 처리)·무한 루프·잘못된 ID 비교·음수 일수 메시지를 제거한다.

**Architecture:** `internal/collector/fetch.go` 단일 파일 — (1) HTTP 상태코드 검증, (2) 페이지 진전 없음 감지 + 배너당 max-page 상한, (3) `idLessEq`를 big.Int 전용으로 엄격화(파싱 실패는 `(false,false)` + 호출자 `slog.Warn`), (4) `expiredMessage` 음수 일수 clamp. 각 수정은 httptest·단위 테스트로 강제.

**Tech Stack:** Go 1.26, `math/big`, `net/http/httptest`, `log/slog`, `testing`.

## Global Constraints

- **ID는 거대 정수**: `idLessEq`는 `math/big` 전용. 사전식 문자열 폴백 제거(`"9" vs "10"` 오판 방지). `Number`/float 금지.
- **조용한 오판 금지**: non-2xx HTTP 응답은 명시적 에러로 표면화. 파싱 실패한 ID 비교는 `slog.Warn` 진단.
- **무한 루프 방지**: 서버가 `end_id`를 무시해도 루프가 반드시 종료(진전 없음 감지 + max-page 상한).
- **데이터 유실 방지**: ID 파싱 실패 시 "신규로 간주"(중단하지 않음) — dedup 은 store 계층이 처리.
- **새 로그는 `slog`**: fetch.go 는 이미 slog import 함.
- **동작 회귀 없음**: 기존 `TestFetchIncremental_*`·`TestExpiredMessage_*` 통과.
- **포맷·정적검사 권위**: `gofmt -w .`, `go vet ./...`.

---

## 파일 구조

| 파일 | 변경 | 책임 |
|---|---|---|
| `internal/collector/fetch.go` | Modify | `idLessEq` 엄격화·`expiredMessage` clamp·HTTP 상태 검증·페이지 진전 가드·`bodySnippet` 헬퍼·`maxPagesPerBanner` 상수 |
| `internal/collector/fetch_test.go` | Modify | idLessEq 경계·미래 issuedAt·HTTP 상태·페이지 진전 없음 테스트 |

---

### Task 1: idLessEq big.Int 엄격화 + expiredMessage 음수 일수 clamp (TDD)

**Files:**
- Modify: `internal/collector/fetch.go` (`idLessEq` 시그니처·본문, 호출부, `expiredMessage`)
- Modify: `internal/collector/fetch_test.go` (테스트 2개 추가)

**Interfaces:**
- `idLessEq(a, b string) (le bool, ok bool)` — big.Int 로 `a <= b`. 비숫자면 `(false, false)`. **시그니처 변경**(기존 `bool` → `(bool, bool)`).
- `expiredMessage(issuedAt, now time.Time) string` — 시그니처 불변. 음수 일수는 0 으로 clamp.

- [ ] **Step 1: 경계 테스트 작성 (RED)**

`internal/collector/fetch_test.go`에 추가:
```go
// idLessEq 는 big.Int 로 비교해야 한다 — 사전식이면 "9" > "10" 로 오판한다.
func TestIDLessEq_BigIntNotLexicographic(t *testing.T) {
	cases := []struct {
		a, b       string
		wantLe, ok bool
	}{
		{"9", "10", true, true},   // 9 <= 10 (사전식이면 false 로 오판)
		{"10", "9", false, true},  // 10 <= 9 아님
		{"5", "5", true, true},    // 동일 ID
		{"100", "99", false, true},
		{"abc", "10", false, false}, // 비숫자 → ok=false
		{"10", "xyz", false, false},
	}
	for _, c := range cases {
		le, ok := idLessEq(c.a, c.b)
		if le != c.wantLe || ok != c.ok {
			t.Fatalf("idLessEq(%q,%q) = (%v,%v), want (%v,%v)", c.a, c.b, le, ok, c.wantLe, c.ok)
		}
	}
}

// 미래 issuedAt(시계 오차)에서 경과 일수가 음수가 되면 안 된다("-1일" 방지).
func TestExpiredMessage_FutureIssuedAtClampsToZero(t *testing.T) {
	now := time.Date(2026, 6, 3, 12, 0, 0, 0, time.Local)
	future := now.Add(48 * time.Hour)
	msg := expiredMessage(future, now)
	if contains(msg, "-") {
		t.Fatalf("음수 일수가 노출되면 안 됨: %s", msg)
	}
	if !contains(msg, "0일") {
		t.Fatalf("미래 issuedAt 은 0일로 clamp 되어야 함: %s", msg)
	}
}
```

- [ ] **Step 2: 테스트 실행 → 실패 확인 (RED)**

Run: `go test ./internal/collector/ -run 'TestIDLessEq_BigIntNotLexicographic|TestExpiredMessage_FutureIssuedAtClampsToZero' -v`
Expected: FAIL(빌드 실패) — `idLessEq` 가 현재 단일 `bool` 반환이라 `le, ok := idLessEq(...)`가 컴파일 안 됨. (구현 후 GREEN 에서 big.Int 정확성·clamp 검증.)

- [ ] **Step 3: idLessEq 엄격화 + expiredMessage clamp 구현**

`fetch.go`의 `idLessEq`(현재 58~65행)를 교체:
```go
// idLessEq 는 a <= b 를 big.Int 로 비교한다(ID 는 거대 정수 불변식 — 사전식 금지).
// 두 번째 반환값 ok 는 파싱 성공 여부 — 비숫자면 (false, false) 를 주고 호출자가 진단·판단한다.
func idLessEq(a, b string) (le bool, ok bool) {
	ai, okA := new(big.Int).SetString(a, 10)
	bi, okB := new(big.Int).SetString(b, 10)
	if !okA || !okB {
		return false, false
	}
	return ai.Cmp(bi) <= 0, true
}
```
`expiredMessage`의 days 계산(현재 53행)에 clamp 추가:
```go
	days := int(now.Sub(issuedAt).Hours() / 24)
	if days < 0 {
		days = 0
	}
```
`FetchIncremental` 내부 수집 루프의 호출부(현재 117~121행)를 교체:
```go
			for _, it := range ar.Data.List {
				le, ok := idLessEq(it.ID, lastID[gt])
				if !ok {
					slog.Warn("ID 비교 실패(비숫자) — 신규로 간주해 계속",
						"id", it.ID, "last_id", lastID[gt], "banner", bannerName[gt])
				} else if le {
					stop = true
					break
				}
				if uid == "" {
					uid = it.UID
				}
				out = append(out, store.Record{
					GachaID: it.GachaID, GachaType: it.GachaType, ItemID: it.ItemID,
					Count: it.Count, Time: it.Time, Name: it.Name,
					ItemType: it.ItemType, RankType: it.RankType, ID: it.ID,
				})
				added++
			}
```

- [ ] **Step 4: 테스트 실행 → 통과 확인 (GREEN)**

Run: `go test ./internal/collector/ -run 'TestIDLessEq_BigIntNotLexicographic|TestExpiredMessage_FutureIssuedAtClampsToZero' -v`
Expected: PASS.

- [ ] **Step 5: collector 패키지 회귀 확인**

Run: `go test ./internal/collector/ -v`
Expected: 전부 PASS(`TestFetchIncremental_StopsAtStoredID`(lastID=20 에서 id 30 만 신규)·`TestExpiredMessage_ShowsAgeAndGuidance` 등 회귀 없음).

- [ ] **Step 6: gofmt + commit**

```bash
gofmt -w internal/collector/
git add internal/collector/fetch.go internal/collector/fetch_test.go
git commit -m "fix(collector): idLessEq big.Int 엄격화 + 음수 일수 clamp (#20)

idLessEq 를 (bool,bool) 로 바꿔 사전식 폴백 제거(9 vs 10 오판 방지), 비숫자 ID 는
slog.Warn 후 신규로 간주(데이터 유실 방지). expiredMessage 는 미래 issuedAt 의
음수 일수를 0 으로 clamp. 경계 테스트 추가.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: HTTP 상태 검증 + 페이지 진전 가드 (TDD)

**Files:**
- Modify: `internal/collector/fetch.go` (`bodySnippet` 헬퍼, `maxPagesPerBanner` 상수, 상태 검증, 진전 가드)
- Modify: `internal/collector/fetch_test.go` (테스트 2개 추가)

**Interfaces:**
- `bodySnippet(b []byte) string` — 응답 본문을 최대 200자 스니펫으로(신규 헬퍼, 상태 에러·파싱 에러 공용).
- `maxPagesPerBanner` (const int) — 배너당 최대 페이지 백스톱.

- [ ] **Step 1: 테스트 작성 (RED)**

`internal/collector/fetch_test.go`에 추가:
```go
// non-2xx HTTP 응답은 파싱 가능한 JSON 이어도 "신규 없음"으로 오인하지 말고 에러로 표면화해야 한다.
func TestFetchIncremental_Non2xxStatusIsError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadGateway)
		_, _ = w.Write([]byte(`{"retcode":0,"data":{"list":[]}}`)) // 파싱 가능하지만 502
	}))
	defer srv.Close()
	ac := &AuthContext{APIBase: srv.URL, BaseQuery: "lang=ko-kr"}
	_, _, err := FetchIncremental(context.Background(), ac, map[string]string{"1": "0", "2": "0", "11": "0", "12": "0"}, 0, func(string, int) {})
	if err == nil || !contains(err.Error(), "502") {
		t.Fatalf("non-2xx 는 HTTP 상태 에러여야 함, got %v", err)
	}
}

// 서버가 end_id 를 무시하고 같은 페이지를 반복해도 루프가 종료되어야 한다(무한 루프 방지).
func TestFetchIncremental_TerminatesOnNoPageProgress(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var list []map[string]string
		if r.URL.Query().Get("gacha_type") == "11" {
			// end_id 무시하고 항상 같은 3건(서버 오작동 시뮬레이션).
			list = []map[string]string{
				{"id": "30", "gacha_type": "11", "rank_type": "5", "time": "2026-06-03 10:00:00", "name": "A", "item_id": "1", "uid": "777"},
				{"id": "20", "gacha_type": "11", "rank_type": "4", "time": "2026-06-02 10:00:00", "name": "B", "item_id": "2", "uid": "777"},
				{"id": "10", "gacha_type": "11", "rank_type": "3", "time": "2026-06-01 10:00:00", "name": "C", "item_id": "3", "uid": "777"},
			}
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"retcode": 0, "message": "ok", "data": map[string]any{"list": list}})
	}))
	defer srv.Close()
	ac := &AuthContext{APIBase: srv.URL, BaseQuery: "lang=ko-kr"}

	done := make(chan struct{})
	var count int
	var ferr error
	go func() {
		r, _, e := FetchIncremental(context.Background(), ac, map[string]string{"1": "0", "2": "0", "11": "0", "12": "0"}, 0, func(string, int) {})
		count, ferr = len(r), e
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(3 * time.Second):
		t.Fatal("end_id 불변 응답에서 FetchIncremental 이 종료되지 않음(무한 루프)")
	}
	if ferr != nil {
		t.Fatal(ferr)
	}
	// page1 3건 수집 → page2 3건 수집 후 진전 없음(end_id 불변) 감지로 종료 → 6건.
	if count != 6 {
		t.Fatalf("진전 없는 페이지에서 2페이지 후 종료해 6건이어야 함, got %d", count)
	}
}
```

- [ ] **Step 2: 테스트 실행 → 실패 확인 (RED)**

Run: `go test ./internal/collector/ -run 'TestFetchIncremental_Non2xxStatusIsError|TestFetchIncremental_TerminatesOnNoPageProgress' -timeout 30s -v`
Expected: `TestFetchIncremental_Non2xxStatusIsError` FAIL(현재 502 본문이 `retcode:0`·빈 list 라 에러 없이 "신규 없음"). `TestFetchIncremental_TerminatesOnNoPageProgress` FAIL(현재 진전 가드 없어 3초 타임아웃 — 무한 루프).

- [ ] **Step 3: bodySnippet 헬퍼 + maxPagesPerBanner 상수 추가**

`fetch.go`의 `bannerName` 선언 아래(20행 근처)에 상수 추가:
```go
// maxPagesPerBanner 는 배너당 페이지 백스톱이다. 정상 조회는 수십 페이지 이내라
// 이 상한에 닿을 일이 없고, 서버가 end_id 를 무시해 진전이 없을 때의 안전장치다.
const maxPagesPerBanner = 1000
```
`idLessEq` 근처(파일 하단 헬퍼 영역)에 스니펫 헬퍼 추가:
```go
// bodySnippet 은 응답 본문을 로그·에러용 최대 200자 스니펫으로 줄인다.
func bodySnippet(b []byte) string {
	s := strings.TrimSpace(string(b))
	if len(s) > 200 {
		return s[:200] + "…"
	}
	return s
}
```

- [ ] **Step 4: HTTP 상태 검증 + 진전 가드 구현**

`fetch.go`의 응답 읽기 직후(현재 `resp.Body.Close()`·readErr 확인 뒤, `json.Unmarshal` 앞)에 상태 검증 추가:
```go
			body, readErr := io.ReadAll(resp.Body)
			resp.Body.Close()
			if readErr != nil {
				return out, uid, fmt.Errorf("응답 읽기 실패: %w", readErr)
			}
			if resp.StatusCode < 200 || resp.StatusCode >= 300 {
				return out, uid, fmt.Errorf("API HTTP 오류 (HTTP %d, 응답: %q)", resp.StatusCode, bodySnippet(body))
			}
```
기존 `json.Unmarshal` 실패 에러의 스니펫 코드(현재 99~103행)를 헬퍼로 정리:
```go
			var ar apiResp
			if err := json.Unmarshal(body, &ar); err != nil {
				return out, uid, fmt.Errorf("응답 파싱 실패: %w (HTTP %d, 응답: %q)", err, resp.StatusCode, bodySnippet(body))
			}
```
페이지 진전 가드 — 루프 상단 ctx 확인 직후에 max-page 백스톱 추가:
```go
			for !stop {
				if err := ctx.Err(); err != nil {
					return out, uid, err
				}
				if page > maxPagesPerBanner {
					slog.Warn("배너 최대 페이지 초과 — 루프 중단", "banner", bannerName[gt], "max", maxPagesPerBanner)
					break
				}
```
그리고 endID 갱신부(현재 134행 `endID = ar.Data.List[len(ar.Data.List)-1].ID`)를 진전 없음 감지로 교체:
```go
			newEndID := ar.Data.List[len(ar.Data.List)-1].ID
			if newEndID == endID {
				slog.Warn("페이지 진전 없음(end_id 불변) — 루프 중단", "banner", bannerName[gt], "end_id", endID)
				break
			}
			endID = newEndID
			page++
			onProgress(bannerName[gt], added)
```

- [ ] **Step 5: 테스트 실행 → 통과 확인 (GREEN)**

Run: `go test ./internal/collector/ -run 'TestFetchIncremental_Non2xxStatusIsError|TestFetchIncremental_TerminatesOnNoPageProgress' -timeout 30s -v`
Expected: 2개 모두 PASS.

- [ ] **Step 6: collector 패키지 전체 회귀 확인**

Run: `go test ./internal/collector/ -v`
Expected: 전부 PASS(`TestFetchIncremental_StopsAtStoredID`·`TestFetchIncremental_EmitsPerPageDebug`·`TestFetchIncremental_RateLimited`·`TestFetchIncremental_AuthkeyExpired`·`TestFetchIncremental_ContextCancellation` 등 회귀 없음).

- [ ] **Step 7: gofmt + commit**

```bash
gofmt -w internal/collector/
git add internal/collector/fetch.go internal/collector/fetch_test.go
git commit -m "fix(collector): HTTP 상태 검증 + 페이지 진전 가드 (#20)

non-2xx 응답을 파싱 가능 JSON 이어도 명시적 에러로 표면화(조회 실패를 '신규 없음'
오인 방지). end_id 불변 응답에서 루프 종료 + 배너당 max-page 백스톱으로 무한 루프
방지. bodySnippet 헬퍼로 스니펫 로직 정리.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: 전체 검증 게이트

**Files:** (없음 — 검증만)

- [ ] **Step 1: 전체 Go 경합 검증**

Run: `go test -race ./... -timeout 60s`
Expected: 모든 패키지 PASS, race 경고 없음.

- [ ] **Step 2: 양 플랫폼 빌드**

Run: `GOOS=darwin go build ./... && GOOS=windows go build ./... && echo OK`
Expected: `OK`.

- [ ] **Step 3: 전체 npm test**

Run: `npm test`
Expected: 전부 PASS.

- [ ] **Step 4: 이슈 #20 완료 기준 대조**
- non-2xx 응답이 명시적 에러로 표면화(Task 2 `TestFetchIncremental_Non2xxStatusIsError`)
- 진전 없는 페이지 응답에서 루프 종료(Task 2 `TestFetchIncremental_TerminatesOnNoPageProgress`)
- `idLessEq` 경계 케이스 테스트 통과(Task 1 `TestIDLessEq_BigIntNotLexicographic`)
- (겸) 음수 일수 clamp(Task 1 `TestExpiredMessage_FutureIssuedAtClampsToZero`)

---

## Self-Review

**1. Spec coverage (이슈 #20 findings 대조):**
- ✅ fetch.go:88 HTTP 상태 미검증 → 상태 검증 에러 (Task 2)
- ✅ fetch.go:130 페이지 무한 루프 → 진전 없음 감지 + max-page (Task 2)
- ✅ fetch.go:57 idLessEq 사전식 폴백 → big.Int 엄격화 + slog.Warn + 단위테스트 (Task 1)
- ✅ fetch.go:52 음수 일수 → clamp (Task 1)
- ✅ 완료 기준: non-2xx 에러(Task 2), 진전 없음 종료(Task 2), idLessEq 경계(Task 1)

**2. Placeholder scan:** 모든 코드/명령/기대출력 실제 내용. TBD 없음.

**3. Type consistency:** `idLessEq(a,b string) (bool,bool)` 시그니처 변경이 정의·유일 호출부(수집 루프)에서 일치. `bodySnippet`·`maxPagesPerBanner`·`expiredMessage`·`FetchIncremental` 시그니처 정합.

**검증 리스크:**
- **idLessEq 파싱 실패 정책**: "신규로 간주(중단 안 함)"는 데이터 유실을 피하는 보수적 선택(dedup 은 store 계층). 대안(전체 조회 중단)은 단일 불량 레코드에 과민하므로 채택 안 함.
- **진전 없음 감지 vs 정상 페이지네이션**: 정상은 매 페이지 newEndID < endID(더 오래된 레코드)라 `newEndID == endID`는 서버가 진전을 안 준 경우에만 참. 초기 endID="0"은 실제 ID 와 겹치지 않아 오탐 없음.
- **max-page 상한 값**: 1000 은 정상 조회(수십 페이지)를 훨씬 초과하는 백스톱이라 정당한 수집을 자르지 않음. 닿으면 `slog.Warn` 으로 가시화.
- **RED 무한 루프 안전**: 진전 가드 RED 는 goroutine + 3초 타임아웃으로 관측(테스트 프로세스 무한 정지 방지). GREEN 은 6건으로 종료 확인.
