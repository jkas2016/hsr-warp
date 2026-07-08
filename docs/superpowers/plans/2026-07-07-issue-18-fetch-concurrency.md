# 이슈 #18 — 동시 /api/fetch 수집 경합 방지 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 동시 `/api/fetch` 수집이 겹쳐도 사용자 가챠 기록이 유실되거나 월 파일이 손상되지 않도록, (1) 원자적 저장을 유니크 임시파일·fsync로 하드닝하고, (2) 겹치는 수집을 거절하며, (3) SSE 연결 종료 시 진행 중 수집을 취소한다.

**Architecture:** 세 계층을 각각 손본다 — `store.writeSRGFAtomic`(유니크 temp + Sync + 실패 정리 + 베스트에포트 부모-dir fsync), `collector.FetchIncremental`(`context.Context` 전파 + 요청별 취소), `server.handleFetch`(`atomic.Bool` 거절 가드 + 저장 전 ctx 확인). 거절 정책은 외부 HoYo API 레이트리밋(-110) 중복 호출을 막기 위함이다.

**Tech Stack:** Go 1.26, `context`, `sync/atomic`, `os.CreateTemp`/`File.Sync`, `net/http/httptest` 테스트.

## Global Constraints

- **저장은 비파괴**: `TestWriteAffectedMonths_PreservesUntouchedMonths`·`TestWriteAffectedMonths_MergesAndDedupsWithinMonth` 통과 유지(핵심 불변식).
- **ID는 거대 정수**: 비교는 `math/big`(`idLess`/`idLessEq`). `Number`/float 금지.
- **동시 fetch 정책 = 거절**: 이미 수집 중이면 두 번째 요청을 즉시 SSE `error` 이벤트로 거절(큐잉 아님). 외부 API 호출을 2배로 늘리지 않는다.
- **부모 디렉터리 fsync는 베스트에포트**: Windows(주 타깃)는 디렉터리 핸들 `Sync`를 지원하지 않을 수 있으므로 실패해도 rename은 유효로 간주하고 `slog.Debug`만 남긴다. rename 자체 실패는 에러로 전파.
- **새 에러/진단 로그는 `slog`**: store.go에 slog 도입 시 이 규칙 준수(ERROR에 스택 자동 첨부).
- **포맷·정적검사 권위**: `gofmt -w .`, `go vet ./...`. 경합 검증은 `go test -race ./internal/...`.
- **Windows 빌드 회귀 없음**: `GOOS=windows go build ./...` 통과.

---

## 파일 구조

| 파일 | 변경 | 책임 |
|---|---|---|
| `internal/store/store.go` | Modify | `writeSRGFAtomic` 하드닝, `syncDirBestEffort` 헬퍼 추가, `slog` import |
| `internal/store/store_test.go` | Modify | temp 정리·동시 기록 무손상 테스트 |
| `internal/collector/fetch.go` | Modify | `FetchIncremental`에 `context.Context` 인자, `http.NewRequestWithContext`, ctx 확인 |
| `internal/collector/fetch_test.go` | Modify | 기존 4개 호출부에 `context.Background()`, 취소 테스트 추가 |
| `internal/server/server.go` | Modify | `Server.fetching atomic.Bool` 거절 가드, `r.Context()` 전파, 저장 전 ctx 확인, 취소/에러 구분 |
| `internal/server/fetch_handler_test.go` | Modify | busy 거절 화이트박스 테스트 |

---

### Task 1: writeSRGFAtomic 하드닝 — 유니크 temp + Sync + 실패 정리 + 베스트에포트 부모-dir fsync

**Files:**
- Modify: `internal/store/store.go` (`writeSRGFAtomic` 교체, `syncDirBestEffort` 추가, import에 `log/slog` 추가)
- Modify: `internal/store/store_test.go` (테스트 2개 추가; import에 `sync`·`strconv` 필요 시 추가)

**Interfaces:**
- Produces: `writeSRGFAtomic(path string, s SRGF) error` — 시그니처 불변. 내부만 하드닝. 동시 호출 시 임시파일명 미충돌·rename 원자성 보장, 실패 경로에서 `.tmp` 잔여 없음.

- [ ] **Step 1: 실패 정리 테스트 작성 (RED)**

`internal/store/store_test.go`에 추가(파일 상단 import에 `"path/filepath"`, `"os"`가 없으면 추가):
```go
// rename 실패 시 임시 파일이 남지 않아야 한다(고정 temp명 시절 누수 방지).
func TestWriteSRGFAtomic_CleansTempOnFailure(t *testing.T) {
	dir := t.TempDir()
	// target 을 디렉터리로 만들어 os.Rename(tmp, target) 을 실패시킨다.
	target := filepath.Join(dir, "warp_202606.json")
	if err := os.Mkdir(target, 0o755); err != nil {
		t.Fatal(err)
	}
	err := writeSRGFAtomic(target, SRGF{List: []Record{{ID: "1", Time: "2026-06-01 00:00:00"}}})
	if err == nil {
		t.Fatal("target 이 디렉터리이므로 rename 실패를 기대")
	}
	leftovers, _ := filepath.Glob(filepath.Join(dir, "*.tmp"))
	if len(leftovers) != 0 {
		t.Fatalf("임시 파일이 정리되지 않음: %v", leftovers)
	}
}
```

- [ ] **Step 2: 테스트 실행 → 실패 확인 (RED)**

Run: `go test ./internal/store/ -run TestWriteSRGFAtomic_CleansTempOnFailure -v`
Expected: FAIL — 현재 코드는 `tmp := path + ".tmp"`를 남긴 채 rename 실패 → `*.tmp` 1개 잔존 → "임시 파일이 정리되지 않음".

- [ ] **Step 3: writeSRGFAtomic 하드닝 구현**

`store.go` import 블록에 `"log/slog"` 추가. 기존 `writeSRGFAtomic`(현재 57~68행)을 아래로 교체하고 `syncDirBestEffort` 헬퍼를 그 아래에 추가:
```go
// writeSRGFAtomic 는 같은 디렉터리의 유니크 임시 파일에 쓰고 fsync 한 뒤 rename 으로
// 원자적 교체한다. 유니크 임시명이라 같은 월을 동시에 기록해도 서로의 임시 파일을
// 덮어쓰지 않고, rename 전 Sync 로 크래시/정전에도 온전한 내용이 남는다.
func writeSRGFAtomic(path string, s SRGF) error {
	b, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return err
	}
	dir := filepath.Dir(path)
	tmp, err := os.CreateTemp(dir, filepath.Base(path)+".*.tmp")
	if err != nil {
		return err
	}
	tmpName := tmp.Name()
	// 실패 경로에서 임시 파일이 남지 않도록 정리(성공 시 이미 rename 되어 no-op).
	defer os.Remove(tmpName)
	if _, err := tmp.Write(b); err != nil {
		tmp.Close()
		return err
	}
	// os.CreateTemp 는 0600 으로 만든다 — 기존 0644 동작을 보존.
	if err := tmp.Chmod(0o644); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Sync(); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	if err := os.Rename(tmpName, path); err != nil {
		return err
	}
	syncDirBestEffort(dir)
	return nil
}

// syncDirBestEffort 는 부모 디렉터리 엔트리(생성/rename)를 디스크에 내려 rename 의
// 내구성을 완성한다. Windows 등 일부 플랫폼은 디렉터리 핸들 Sync 를 지원하지 않으므로
// 베스트에포트다(실패해도 rename 은 유효 — Debug 로만 남긴다).
func syncDirBestEffort(dir string) {
	d, err := os.Open(dir)
	if err != nil {
		slog.Debug("부모 디렉터리 열기 실패(내구성 fsync 생략)", "dir", dir, "err", err)
		return
	}
	defer d.Close()
	if err := d.Sync(); err != nil {
		slog.Debug("부모 디렉터리 fsync 미지원/실패(무시)", "dir", dir, "err", err)
	}
}
```

- [ ] **Step 4: 테스트 실행 → 통과 확인 (GREEN)**

Run: `go test ./internal/store/ -run TestWriteSRGFAtomic_CleansTempOnFailure -v`
Expected: PASS

- [ ] **Step 5: 동시 기록 무손상 테스트 추가**

`store_test.go`에 추가(import에 `"sync"`, `"strconv"` 필요):
```go
// 같은 월을 여러 goroutine 이 동시에 기록해도 파일이 손상(파싱 불가)되거나
// .tmp 잔여물이 남지 않아야 한다. (store 계층은 무손상만 보장 — 병합/유실 방지는
// server 의 거절 가드 담당이라 최종 레코드 수는 검증하지 않는다.)
func TestWriteAffectedMonths_ConcurrentNoCorruption(t *testing.T) {
	dir := t.TempDir()
	info := Info{UID: "1"}
	var wg sync.WaitGroup
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			rec := Record{ID: strconv.Itoa(1000 + i), GachaType: "11", Time: "2026-06-01 00:00:00"}
			_, _ = WriteAffectedMonths(dir, info, []Record{rec})
		}(i)
	}
	wg.Wait()
	s, err := readSRGF(filepath.Join(dir, "warp_202606.json"))
	if err != nil {
		t.Fatalf("동시 기록 후 파일 손상: %v", err)
	}
	if len(s.List) == 0 {
		t.Fatal("최소 한 레코드는 남아야 함")
	}
	if leftovers, _ := filepath.Glob(filepath.Join(dir, "*.tmp")); len(leftovers) != 0 {
		t.Fatalf("temp 잔여물: %v", leftovers)
	}
}
```

- [ ] **Step 6: 동시성 테스트 + 기존 저장 불변식 회귀 확인 (-race)**

Run: `go test -race ./internal/store/ -v`
Expected: 전부 PASS — 특히 `TestWriteAffectedMonths_PreservesUntouchedMonths`, `TestWriteAffectedMonths_MergesAndDedupsWithinMonth`, 신규 2개. race 경고 없음.

- [ ] **Step 7: gofmt + commit**

```bash
gofmt -w internal/store/
git add internal/store/store.go internal/store/store_test.go
git commit -m "fix(store): writeSRGFAtomic 유니크 temp·fsync·실패정리로 동시기록 무손상 (#18)

os.CreateTemp 유니크 임시명으로 같은 월 동시 기록 시 파일 손상 방지, rename 전
File.Sync 로 내구성 확보, 실패 경로 .tmp 정리. 부모 디렉터리 fsync 는 Windows
디렉터리 핸들 Sync 미지원을 고려해 베스트에포트.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: FetchIncremental 에 context.Context 전파 (요청별 취소)

**Files:**
- Modify: `internal/collector/fetch.go` (`FetchIncremental` 시그니처·요청 생성·ctx 확인, import에 `"context"`)
- Modify: `internal/collector/fetch_test.go` (기존 4개 호출부 `context.Background()`, 취소 테스트 추가, import에 `"context"`)
- Modify: `internal/server/server.go` (호출부 `r.Context()` 전달 — 이 태스크는 인자 전달만, 거절 가드는 Task 3)

**Interfaces:**
- Produces: `FetchIncremental(ctx context.Context, ac *AuthContext, lastID map[string]string, delay time.Duration, onProgress func(banner string, added int)) ([]store.Record, string, error)` — 첫 인자로 `ctx` 추가. ctx 취소 시 조기 반환(수집분 + `ctx.Err()`).
- Consumes(Task 3에서): `server.handleFetch`가 `r.Context()`를 넘김.

- [ ] **Step 1: 취소 테스트 작성 (RED)**

`internal/collector/fetch_test.go`에 추가:
```go
// SSE 클라이언트가 끊기면(ctx 취소) 진행 중 수집이 즉시 중단되고 ctx 에러를 반환해야 한다.
func TestFetchIncremental_ContextCancellation(t *testing.T) {
	started := make(chan struct{})
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		close(started)
		<-r.Context().Done() // 클라이언트 취소까지 응답을 보류
	}))
	defer srv.Close()

	ac := &AuthContext{APIBase: srv.URL, BaseQuery: "authkey=X"}
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() {
		_, _, err := FetchIncremental(ctx, ac, map[string]string{"1": "0", "2": "0", "11": "0", "12": "0"}, 0, func(string, int) {})
		done <- err
	}()
	<-started
	cancel()
	select {
	case err := <-done:
		if err == nil {
			t.Fatal("취소 시 에러를 기대")
		}
	case <-time.After(2 * time.Second):
		t.Fatal("취소 후에도 FetchIncremental 이 반환하지 않음(context 미전파)")
	}
}
```
파일 상단 import 블록에 `"context"` 추가.

- [ ] **Step 2: 테스트 실행 → 실패 확인 (RED = 컴파일 에러)**

Run: `go test ./internal/collector/ -run TestFetchIncremental_ContextCancellation -v`
Expected: FAIL(빌드 실패) — `FetchIncremental` 이 아직 `ctx` 인자를 받지 않아 `too many arguments`. (구현 후 GREEN 에서 실제 취소 동작을 검증한다.)

- [ ] **Step 3: FetchIncremental 시그니처·요청·ctx 확인 구현**

`fetch.go` import에 `"context"` 추가. 시그니처를 변경(68행):
```go
func FetchIncremental(ctx context.Context, ac *AuthContext, lastID map[string]string, delay time.Duration, onProgress func(banner string, added int)) ([]store.Record, string, error) {
```
내부 페이지 루프(현재 `for !stop {` 직후)에 ctx 확인 추가:
```go
		for !stop {
			if err := ctx.Err(); err != nil {
				return out, uid, err
			}
			u := fmt.Sprintf(...)
```
요청 생성을 컨텍스트 버전으로 교체(현재 79행 `http.NewRequest`):
```go
			req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
```
(나머지 로직 불변.)

- [ ] **Step 4: 기존 collector 테스트 호출부 갱신**

`fetch_test.go`의 기존 4개 `FetchIncremental(...)` 호출에 첫 인자 `context.Background()` 추가:
- 59행: `recs, uid, err := FetchIncremental(context.Background(), ac, lastID, 0, func(string, int) {})`
- 88행: `if _, _, err := FetchIncremental(context.Background(), ac, map[string]string{"1": "0", "2": "0", "11": "0", "12": "0"}, 0, func(string, int) {}); err != nil {`
- 105행: `_, _, err := FetchIncremental(context.Background(), ac, map[string]string{"1": "0", "2": "0", "11": "0", "12": "0"}, 0, func(string, int) {})`
- 117행: `_, _, err := FetchIncremental(context.Background(), ac, map[string]string{"1": "0", "2": "0", "11": "0", "12": "0"}, 0, func(string, int) {})`

- [ ] **Step 5: server.go 호출부 갱신 (인자 전달만)**

`server.go` 177행의 호출을 `r.Context()` 전달로 변경:
```go
	newRecs, uid, err := collector.FetchIncremental(r.Context(), ac, lastID, 400*time.Millisecond,
		func(banner string, added int) {
			send("progress", map[string]any{"banner": banner, "added": added})
		})
```
(취소/에러 구분·거절 가드·저장 전 확인은 Task 3에서 추가. 이 태스크는 컴파일 유지를 위한 인자 전달까지만.)

- [ ] **Step 6: 테스트 실행 → 통과 확인 (GREEN)**

Run: `go test ./internal/collector/ ./internal/server/ -v`
Expected: 전부 PASS — 신규 `TestFetchIncremental_ContextCancellation`가 2초 내 취소로 반환, 기존 fetch/server 테스트 회귀 없음.

- [ ] **Step 7: gofmt + commit**

```bash
gofmt -w internal/collector/ internal/server/
git add internal/collector/fetch.go internal/collector/fetch_test.go internal/server/server.go
git commit -m "feat(collector): FetchIncremental context 전파로 취소 지원 (#18)

http.NewRequestWithContext + 루프 진입 시 ctx.Err() 확인으로 SSE 연결 종료 시
진행 중 수집을 즉시 중단. handleFetch 는 r.Context() 를 전달.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Server 거절 가드 + 저장 전 ctx 확인 + 취소/에러 구분

**Files:**
- Modify: `internal/server/server.go` (`Server.fetching atomic.Bool`, `handleFetch` 가드·취소 처리·저장 전 확인, import에 `"context"`·`"errors"`·`"sync/atomic"`)
- Modify: `internal/server/fetch_handler_test.go` (busy 거절 테스트, 필요한 import 추가)

**Interfaces:**
- Consumes: `FetchIncremental(ctx, ...)` (Task 2), `store.WriteAffectedMonths` (불변).
- Produces: `Server.fetching atomic.Bool` — 수집 진행 중 플래그. `handleFetch`는 `CompareAndSwap(false,true)` 실패 시 SSE `error`("이미 수집") 후 반환.

- [ ] **Step 1: busy 거절 테스트 작성 (RED)**

`internal/server/fetch_handler_test.go`에 추가(import에 `"net/http"`, `"net/http/httptest"`, `"strings"`, `"path/filepath"`가 없으면 추가):
```go
// 이미 수집 중이면 두 번째 /api/fetch 는 즉시 거절되어야 한다(외부 API 중복 호출 방지).
func TestHandleFetch_RejectsWhenBusy(t *testing.T) {
	s := New(Paths{DataDir: t.TempDir(), ConfigFile: filepath.Join(t.TempDir(), "config.json")})
	s.fetching.Store(true) // 수집 진행 중 상태 시뮬레이션
	req := httptest.NewRequest(http.MethodGet, "/api/fetch?path=C:\\fake", nil)
	rec := httptest.NewRecorder()
	s.handleFetch(rec, req)
	if body := rec.Body.String(); !strings.Contains(body, "이미 수집") {
		t.Fatalf("busy 상태에서 거절 이벤트가 없음: %q", body)
	}
}
```

- [ ] **Step 2: 테스트 실행 → 실패 확인 (RED = 컴파일 에러)**

Run: `go test ./internal/server/ -run TestHandleFetch_RejectsWhenBusy -v`
Expected: FAIL(빌드 실패) — `Server` 에 `fetching` 필드가 없어 `s.fetching undefined`.

- [ ] **Step 3: Server 구조체에 가드 필드 추가**

`server.go` import 블록에 `"context"`, `"errors"`, `"sync/atomic"` 추가. `Server` 구조체(현재 29~38행)에 필드 추가:
```go
type Server struct {
	paths       Paths
	assets      fs.FS
	version     string
	scheduleURL string
	releaseURL  string
	client      *http.Client
	once        sync.Once
	cached      updater.Updates
	fetching    atomic.Bool // 수집 진행 중이면 true — 겹치는 /api/fetch 를 거절
}
```

- [ ] **Step 4: handleFetch 거절 가드 삽입**

`handleFetch`에서 gamePath 빈값 확인(현재 149~152행) 직후, `slog.Info("조회 시작"...)` 앞에 삽입:
```go
	if gamePath == "" {
		fail("게임 경로가 비어 있습니다.")
		return
	}
	if !s.fetching.CompareAndSwap(false, true) {
		fail("이미 수집이 진행 중입니다. 완료 후 다시 시도하세요.")
		return
	}
	defer s.fetching.Store(false)
	slog.Info("조회 시작", "path", gamePath)
```

- [ ] **Step 5: 취소/에러 구분 + 저장 전 ctx 확인 삽입**

FetchIncremental 반환 처리(현재 181~184행)를 취소 구분으로 교체:
```go
	newRecs, uid, err := collector.FetchIncremental(r.Context(), ac, lastID, 400*time.Millisecond,
		func(banner string, added int) {
			send("progress", map[string]any{"banner": banner, "added": added})
		})
	if err != nil {
		if errors.Is(err, context.Canceled) || r.Context().Err() != nil {
			slog.Info("클라이언트 연결 종료로 수집 중단")
			return
		}
		fail(err.Error())
		return
	}
```
그리고 `WriteAffectedMonths` 호출(현재 196행) 직전에 저장 전 확인 삽입:
```go
	if err := r.Context().Err(); err != nil {
		slog.Info("클라이언트 연결 종료로 저장 생략")
		return
	}
	updatedMonths, err := store.WriteAffectedMonths(s.paths.DataDir, info, newRecs)
```

- [ ] **Step 6: 테스트 실행 → 통과 확인 (GREEN)**

Run: `go test ./internal/server/ -run TestHandleFetch_RejectsWhenBusy -v`
Expected: PASS — busy 상태에서 `handleFetch` 가 "이미 수집" 이벤트를 보내고 `FindAuthContext` 로 진행하지 않음.

- [ ] **Step 7: server 패키지 전체 회귀 확인 (-race)**

Run: `go test -race ./internal/server/ -v`
Expected: 전부 PASS(`TestHandleFetch_MissingPath`, `TestHandleFetch_BadGamePathEmitsError`, 신규 포함), race 경고 없음.

- [ ] **Step 8: gofmt + commit**

```bash
gofmt -w internal/server/
git add internal/server/server.go internal/server/fetch_handler_test.go
git commit -m "fix(server): 동시 /api/fetch 거절 가드 + 취소 시 저장 생략 (#18)

atomic.Bool CompareAndSwap 로 겹치는 수집을 즉시 거절(외부 API 중복·레이트리밋
방지). SSE 연결 종료 시 수집 중단을 감지해 저장을 생략하고, context.Canceled 를
일반 에러와 구분해 조용히 반환.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: 전체 검증 게이트 (-race + npm test)

**Files:** (없음 — 검증만)

- [ ] **Step 1: 전체 Go 경합 검증**

Run: `go test -race ./...`
Expected: 모든 패키지 PASS, race 경고 없음.

- [ ] **Step 2: 양 플랫폼 빌드 확인**

Run: `GOOS=darwin go build ./... && GOOS=windows go build ./... && echo OK`
Expected: `OK` (store.go 부모-dir fsync 베스트에포트가 Windows 빌드/동작을 깨지 않음).

- [ ] **Step 3: 전체 npm test**

Run: `npm test`
Expected: go(전 패키지)·analyze·대시보드·사이트 copy 전부 PASS.

- [ ] **Step 4: 이슈 #18 완료 기준 대조 확인**
- 동시 `/api/fetch` 겹침 → 거절(Task 3 `TestHandleFetch_RejectsWhenBusy`), 저장 무손상(Task 1 동시 기록 테스트 + `-race`)
- `TestWriteAffectedMonths_PreservesUntouchedMonths` 등 기존 저장 불변식 통과(Task 1 Step 6, Task 4 Step 1)
- SSE 연결 종료 시 진행 중 수집 취소(Task 2 `TestFetchIncremental_ContextCancellation`, Task 3 취소 처리)

---

## Self-Review

**1. Spec coverage (이슈 #18 작업 항목 대조):**
- ✅ `Server`에 동기화 추가, 수집→저장 직렬화(겹치면 거절) → Task 3 `atomic.Bool` 가드(핸들러 전체가 임계구역; Server당 DataDir 1개라 per-dir 락과 동치)
- ✅ `writeSRGFAtomic` 유니크 임시명 + 실패 시 정리 → Task 1
- ✅ temp `Sync()` 후 `Rename`(+ 선택적 부모-dir fsync) → Task 1(부모-dir는 베스트에포트)
- ✅ `FetchIncremental`에 `context.Context`, `ctx.Done()` 중단 + 저장 전 `r.Context().Err()` 확인 → Task 2 + Task 3
- ✅ 완료 기준: 겹침 무손상(Task 1/3), 기존 불변식 통과(Task 1 Step 6), 연결 종료 시 취소(Task 2/3)

**2. Placeholder scan:** 모든 코드/명령/기대출력 실제 내용 포함. TBD 없음.

**3. Type consistency:** `FetchIncremental(ctx, ...)` 시그니처가 fetch.go 정의·fetch_test.go 4개 호출·server.go 호출에서 일치. `Server.fetching atomic.Bool`가 정의·테스트·`CompareAndSwap`/`Store` 사용처 일치. `writeSRGFAtomic`/`syncDirBestEffort` 시그니처 일치.

**검증 리스크(구현 시 확인):**
- **부모-dir fsync Windows 회귀**: `syncDirBestEffort`가 에러를 삼키므로 Windows에서 `d.Sync()` 실패해도 rename은 성립. Task 4 Step 2의 `GOOS=windows go build`는 컴파일만 보증하니, 리뷰 시 "실패를 전파하지 않는지" 코드로 확인.
- **동시 기록 테스트 결정성**: `TestWriteAffectedMonths_ConcurrentNoCorruption`은 파싱 가능·잔여물 없음만 단언(최종 레코드 수 아님). 손상은 파일시스템 레벨이라 `-race`가 직접 잡지 못할 수 있음 — 무손상의 실질 보장은 유니크 temp명 + 저장 전 server 거절 가드 조합. 이 한계를 테스트 주석에 명시.
- **저장 전 ctx 확인 중복성**: FetchIncremental이 ctx 취소 시 에러를 반환하므로 대개 그 전에 걸러짐. 저장 전 `r.Context().Err()`는 (FetchIncremental 반환 후~쓰기 전 취소된) 좁은 창을 위한 방어. 의도된 belt-and-suspenders.
