# 이슈 #25 — Go 백엔드 견고성 정리 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Go 백엔드 전반에 흩어진 minor 견고성 갭(조용한 오류 폐기·`.tmp` 누수·flusher 함정·미명시 계약·parseVer 침묵)을 정리해 진단성과 내구성을 높인다. 동작 회귀 없음.

**Architecture:** 파일별 독립 수정 — `config.go`(slog.Warn·rename 실패 정리), `updater.go`(writeAtomic 정리·parseVer 정책 명시/로깅), `server.go`(flusher 미지원 시 500)·`store.go`(readSRGF 계약 doc). 각 수정은 좁은 경계 테스트로 강제한다.

**Tech Stack:** Go 1.26, `log/slog`, `testing`, `net/http/httptest`.

## Global Constraints

- **새 로그는 `slog`**: `log` 금지. ERROR 레벨은 `stackHandler`가 스택 자동 첨부.
- **오류 경로에서 `.tmp` 잔여물 없음**: rename 실패 시 임시 파일 정리.
- **동작 회귀 없음**: 기존 테스트 전부 통과. 특히 `TestConfigRoundTrip`, `TestCheckRelease*`, `TestCompareVersions`, `TestHandleFetch_*`, 저장 불변식.
- **parseVer 정책 = 관대(비숫자 세그먼트 → 0)**: GitHub 릴리스 태그는 정상 semver 라 사용자 영향 없음. 정책을 doc 로 명시하고 진단 로그(`slog.Debug`)만 추가(동작 불변).
- **포맷·정적검사 권위**: `gofmt -w .`, `go vet ./...`.

---

## 파일 구조

| 파일 | 변경 | 책임 |
|---|---|---|
| `internal/server/config.go` | Modify | `LoadConfig` 파싱 실패 `slog.Warn`, `SaveConfig` rename 실패 시 `.tmp` 정리 |
| `internal/server/config_test.go` | Modify | 깨진 JSON·detect 빈 결과 테스트 |
| `internal/updater/updater.go` | Modify | `writeAtomic` rename 실패 정리, `parseVer` 정책 doc + `slog.Debug` |
| `internal/updater/updater_test.go` | Modify | parseVer 비숫자·writeAtomic 정리 테스트 |
| `internal/server/server.go` | Modify | `handleFetch` flusher 미지원 시 `slog.Error`+500 |
| `internal/server/fetch_handler_test.go` | Modify | flusher 없는 writer 로 500 테스트 |
| `internal/store/store.go` | Modify | `readSRGF` 계약 doc 코멘트 |
| `internal/store/store_test.go` | Modify | readSRGF 미존재 파일 계약 테스트 |

---

### Task 1: config.go 견고성 — slog.Warn + rename 실패 정리 (TDD)

**Files:**
- Modify: `internal/server/config.go` (`LoadConfig`·`SaveConfig`, import `log/slog`)
- Modify: `internal/server/config_test.go` (테스트 2개; import 필요 시 추가)

**Interfaces:**
- `LoadConfig(path string) Config` — 시그니처 불변. 파싱 실패 시 `slog.Warn` 후 zero 값 반환.
- `SaveConfig(path string, c Config) error` — 시그니처 불변. rename 실패 시 `.tmp` 정리 후 에러 반환.

- [ ] **Step 1: 실패 정리 테스트 작성 (RED)**

`internal/server/config_test.go`에 추가(import에 `"os"`, `"path/filepath"`, `"strings"` 필요 시 추가):
```go
// SaveConfig 는 rename 실패 시 .tmp 를 남기지 않아야 한다.
func TestSaveConfig_CleansTempOnRenameFailure(t *testing.T) {
	dir := t.TempDir()
	// target 을 디렉터리로 만들어 rename 을 실패시킨다.
	target := filepath.Join(dir, "config.json")
	if err := os.Mkdir(target, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := SaveConfig(target, Config{GamePath: "X"}); err == nil {
		t.Fatal("target 이 디렉터리이므로 rename 실패를 기대")
	}
	if leftovers, _ := filepath.Glob(filepath.Join(dir, "*.tmp")); len(leftovers) != 0 {
		t.Fatalf("임시 파일이 정리되지 않음: %v", leftovers)
	}
}

// LoadConfig 는 깨진 JSON 이면 zero 값 Config 를 반환해야 한다(진단은 로그로).
func TestLoadConfig_BrokenJSONReturnsZero(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "config.json")
	if err := os.WriteFile(path, []byte("{not json"), 0o644); err != nil {
		t.Fatal(err)
	}
	if c := LoadConfig(path); c.GamePath != "" {
		t.Fatalf("깨진 JSON 은 zero 값이어야 함, got %+v", c)
	}
}

// detectGamePath 는 어떤 후보도 존재하지 않으면 "" 를 반환해야 한다.
func TestDetectGamePath_EmptyWhenNoneExist(t *testing.T) {
	if got := detectGamePath([]string{filepath.Join(t.TempDir(), "nope")}); got != "" {
		t.Fatalf("존재하지 않는 후보는 \"\" 여야 함, got %q", got)
	}
}
```

- [ ] **Step 2: 테스트 실행 → 실패 확인 (RED)**

Run: `go test ./internal/server/ -run 'TestSaveConfig_CleansTempOnRenameFailure|TestLoadConfig_BrokenJSONReturnsZero|TestDetectGamePath_EmptyWhenNoneExist' -v`
Expected: `TestSaveConfig_CleansTempOnRenameFailure` FAIL(현재 rename 실패 후 `config.json.tmp` 잔존). 나머지 둘은 현재도 통과할 수 있음(회귀 가드로 추가) — RED 는 정리 테스트가 실패함을 확인하는 것.

- [ ] **Step 3: config.go 구현**

`config.go` import에 `"log/slog"` 추가. `LoadConfig`·`SaveConfig` 교체:
```go
// LoadConfig 는 config 파일을 읽는다. 없으면 zero 값, 깨졌으면 경고 후 zero 값 반환.
func LoadConfig(path string) Config {
	var c Config
	b, err := os.ReadFile(path)
	if err != nil {
		return c
	}
	if err := json.Unmarshal(b, &c); err != nil {
		slog.Warn("config 파싱 실패, zero 값으로 대체", "path", path, "err", err)
		return Config{}
	}
	return c
}

// SaveConfig 는 config 를 원자적으로 저장한다. rename 실패 시 임시 파일을 정리한다.
func SaveConfig(path string, c Config) error {
	b, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return err
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, b, 0644); err != nil {
		return err
	}
	if err := os.Rename(tmp, path); err != nil {
		os.Remove(tmp)
		return err
	}
	return nil
}
```

- [ ] **Step 4: 테스트 실행 → 통과 확인 (GREEN)**

Run: `go test ./internal/server/ -run 'TestSaveConfig_CleansTempOnRenameFailure|TestLoadConfig_BrokenJSONReturnsZero|TestDetectGamePath_EmptyWhenNoneExist' -v`
Expected: 3개 모두 PASS.

- [ ] **Step 5: server 패키지 회귀 확인**

Run: `go test ./internal/server/ -v`
Expected: 전부 PASS(`TestConfigRoundTrip` 등 회귀 없음).

- [ ] **Step 6: gofmt + commit**

```bash
gofmt -w internal/server/
git add internal/server/config.go internal/server/config_test.go
git commit -m "fix(server): config 파싱 실패 slog.Warn + SaveConfig .tmp 정리 (#25)

LoadConfig 가 깨진 JSON 을 조용히 zero 강등하던 것을 slog.Warn 으로 진단,
SaveConfig 는 rename 실패 시 임시 파일을 정리. 깨진 JSON·detect 빈 결과 테스트 추가.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: updater.go 견고성 — writeAtomic 정리 + parseVer 정책 (TDD)

**Files:**
- Modify: `internal/updater/updater.go` (`writeAtomic`·`parseVer`, import `log/slog`)
- Modify: `internal/updater/updater_test.go` (테스트 2개; import 필요 시 추가)

**Interfaces:**
- `writeAtomic(path string, b []byte) error` — 시그니처 불변. rename 실패 시 `.tmp` 정리.
- `parseVer(s string) [3]int` — 시그니처·동작 불변(비숫자 세그먼트 → 0). 진단 `slog.Debug` 추가.

- [ ] **Step 1: 테스트 작성 (RED)**

`internal/updater/updater_test.go`에 추가(import에 `"os"`, `"path/filepath"` 필요 시 추가):
```go
// writeAtomic 은 rename 실패 시 .tmp 를 남기지 않아야 한다.
func TestWriteAtomic_CleansTempOnRenameFailure(t *testing.T) {
	dir := t.TempDir()
	target := filepath.Join(dir, "schedule.json")
	if err := os.Mkdir(target, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := writeAtomic(target, []byte(`{"version":1}`)); err == nil {
		t.Fatal("target 이 디렉터리이므로 rename 실패를 기대")
	}
	if leftovers, _ := filepath.Glob(filepath.Join(dir, "*.tmp")); len(leftovers) != 0 {
		t.Fatalf("임시 파일이 정리되지 않음: %v", leftovers)
	}
}

// parseVer 는 비숫자 세그먼트를 0 으로 처리한다(관대 정책 — 회귀 방지로 고정).
func TestParseVer_NonNumericSegmentTreatedAsZero(t *testing.T) {
	if got := parseVer("1.beta.3"); got != [3]int{1, 0, 3} {
		t.Fatalf("비숫자 세그먼트는 0 이어야 함, got %v", got)
	}
	if got := parseVer("v2.1.0"); got != [3]int{2, 1, 0} {
		t.Fatalf("v 접두·정상 파싱, got %v", got)
	}
}
```

- [ ] **Step 2: 테스트 실행 → 실패 확인 (RED)**

Run: `go test ./internal/updater/ -run 'TestWriteAtomic_CleansTempOnRenameFailure|TestParseVer_NonNumericSegmentTreatedAsZero' -v`
Expected: `TestWriteAtomic_CleansTempOnRenameFailure` FAIL(현재 `schedule.json.tmp` 잔존). `TestParseVer_*`는 현재도 통과 가능(정책 고정 가드).

- [ ] **Step 3: updater.go 구현**

`updater.go` import에 `"log/slog"` 추가. `writeAtomic` 교체:
```go
func writeAtomic(path string, b []byte) error {
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, b, 0644); err != nil {
		return err
	}
	if err := os.Rename(tmp, path); err != nil {
		os.Remove(tmp)
		return err
	}
	return nil
}
```
`parseVer` 교체(동작 동일, 정책 doc + 진단 로그):
```go
// parseVer 는 "v1.2.3-beta" 형태를 [3]int{1,2,3} 으로 파싱한다. 'v' 접두와
// '-'/'+' 이후(프리릴리스·빌드 메타데이터)는 제거한다. 정책: 비숫자 세그먼트는
// 0 으로 관대하게 처리한다(GitHub 릴리스 태그는 정상 semver 라 실무 영향 없음).
// 파싱 실패는 진단을 위해 Debug 로 남긴다.
func parseVer(s string) [3]int {
	s = strings.TrimPrefix(strings.TrimSpace(s), "v")
	if i := strings.IndexAny(s, "-+"); i >= 0 {
		s = s[:i]
	}
	var out [3]int
	for i, part := range strings.SplitN(s, ".", 3) {
		n, err := strconv.Atoi(part)
		if err != nil {
			slog.Debug("버전 세그먼트 파싱 실패, 0으로 처리", "version", s, "segment", part)
		}
		out[i] = n
	}
	return out
}
```

- [ ] **Step 4: 테스트 실행 → 통과 확인 (GREEN)**

Run: `go test ./internal/updater/ -run 'TestWriteAtomic_CleansTempOnRenameFailure|TestParseVer_NonNumericSegmentTreatedAsZero' -v`
Expected: 2개 모두 PASS.

- [ ] **Step 5: updater 패키지 회귀 확인**

Run: `go test ./internal/updater/ -v`
Expected: 전부 PASS(`TestCompareVersions`·`TestCheckSchedule*` 등 회귀 없음).

- [ ] **Step 6: gofmt + commit**

```bash
gofmt -w internal/updater/
git add internal/updater/updater.go internal/updater/updater_test.go
git commit -m "fix(updater): writeAtomic .tmp 정리 + parseVer 정책 명시·진단 (#25)

writeAtomic 이 rename 실패 시 임시 파일을 정리. parseVer 의 '비숫자 세그먼트→0'
관대 정책을 doc 로 명시하고 파싱 실패 시 slog.Debug 로 진단. 경계 테스트 추가.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: server flusher 500 가드 + store readSRGF 계약 문서화 (TDD)

**Files:**
- Modify: `internal/server/server.go` (`handleFetch` flusher 미지원 시 500)
- Modify: `internal/server/fetch_handler_test.go` (flusher 없는 writer 500 테스트; import에 `"net/http"` 등 필요 시 추가)
- Modify: `internal/store/store.go` (`readSRGF` 계약 doc 코멘트)
- Modify: `internal/store/store_test.go` (readSRGF 미존재 계약 테스트)

**Interfaces:**
- `handleFetch` — flusher 미지원 시 SSE 를 시작하지 않고 500 반환. 지원 시 `send` 는 항상 flush(nil 체크 제거).
- `readSRGF(path string) (SRGF, error)` — 계약: 미존재 파일은 `os.IsNotExist(err)` 참인 에러를 반환(동작 불변, doc 만 명시).

- [ ] **Step 1: flusher 500 테스트 작성 (RED)**

`internal/server/fetch_handler_test.go`에 추가(파일 상단 import에 `"net/http"` 존재; 없으면 추가):
```go
// http.Flusher 를 구현하지 않는 ResponseWriter — SSE 스트리밍 불가 상황 재현.
type noFlushWriter struct {
	header http.Header
	status int
}

func (w *noFlushWriter) Header() http.Header {
	if w.header == nil {
		w.header = http.Header{}
	}
	return w.header
}
func (w *noFlushWriter) Write(b []byte) (int, error) { return len(b), nil }
func (w *noFlushWriter) WriteHeader(code int)        { w.status = code }

// handleFetch 는 flusher 미지원 writer 에 대해 조용히 버퍼링하지 않고 500 을 반환해야 한다.
func TestHandleFetch_NoFlusherReturns500(t *testing.T) {
	s := New(Paths{DataDir: t.TempDir(), ConfigFile: filepath.Join(t.TempDir(), "config.json")})
	w := &noFlushWriter{}
	req := httptest.NewRequest(http.MethodGet, "/api/fetch?path=C:\\fake", nil)
	s.handleFetch(w, req)
	if w.status != http.StatusInternalServerError {
		t.Fatalf("flusher 미지원 시 500 을 기대, got %d", w.status)
	}
}
```

- [ ] **Step 2: 테스트 실행 → 실패 확인 (RED)**

Run: `go test ./internal/server/ -run TestHandleFetch_NoFlusherReturns500 -v`
Expected: FAIL — 현재는 `flusher, _ := w.(http.Flusher)`가 nil 이어도 진행해 SSE 를 버퍼링(500 아님). `w.status` 는 0 또는 SSE 관련 값.

- [ ] **Step 3: server.go handleFetch flusher 가드 구현**

`handleFetch` 상단(현재 `w.Header().Set("Content-Type", "text/event-stream")` ~ `flusher, _ := w.(http.Flusher)` 블록)을 교체 — flusher 확인을 헤더 설정보다 먼저:
```go
func (s *Server) handleFetch(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		slog.Error("SSE 스트리밍 미지원(http.Flusher 없음)")
		http.Error(w, "streaming unsupported", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	send := func(event string, payload any) {
		b, _ := json.Marshal(payload)
		fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event, b)
		flusher.Flush()
	}
```
(이후 `fail` 등 나머지 로직은 불변. `send` 의 `if flusher != nil` 체크는 제거됨.)

- [ ] **Step 4: readSRGF 계약 doc 작성**

`store.go`의 `readSRGF` doc 코멘트(현재 "선행 UTF-8 BOM …")를 계약 명시로 확장:
```go
// readSRGF 는 SRGF 파일을 읽는다. 선행 UTF-8 BOM(구 PowerShell 출력)을 제거한다.
// 계약: 파일이 없으면 os.ReadFile 의 원본 에러(fs.ErrNotExist 래핑)를 그대로 반환하므로
// 호출자는 os.IsNotExist(err) 로 "없음"을 구분할 수 있다(WriteAffectedMonths 가 이에 의존).
// 빈/공백 파일은 zero SRGF·nil 에러, JSON 파싱 실패는 해당 에러를 반환한다.
func readSRGF(path string) (SRGF, error) {
```

- [ ] **Step 5: readSRGF 계약 테스트 작성**

`internal/store/store_test.go`에 추가:
```go
// readSRGF 는 미존재 파일에 대해 os.IsNotExist 로 구분 가능한 에러를 반환해야 한다(계약).
func TestReadSRGF_MissingFileIsNotExist(t *testing.T) {
	_, err := readSRGF(filepath.Join(t.TempDir(), "warp_209901.json"))
	if !os.IsNotExist(err) {
		t.Fatalf("미존재 파일은 os.IsNotExist 에러여야 함, got %v", err)
	}
}
```

- [ ] **Step 6: 테스트 실행 → 통과 확인 (GREEN)**

Run: `go test ./internal/server/ ./internal/store/ -run 'TestHandleFetch_NoFlusherReturns500|TestReadSRGF_MissingFileIsNotExist' -v`
Expected: 2개 모두 PASS.

- [ ] **Step 7: server·store 패키지 회귀 확인 (-race)**

Run: `go test -race ./internal/server/ ./internal/store/`
Expected: 전부 PASS(`TestHandleFetch_MissingPath`·`TestHandleFetch_RejectsWhenBusy`·저장 불변식 등 회귀 없음), race 경고 없음.

- [ ] **Step 8: gofmt + commit**

```bash
gofmt -w internal/server/ internal/store/
git add internal/server/server.go internal/server/fetch_handler_test.go internal/store/store.go internal/store/store_test.go
git commit -m "fix(server,store): flusher 미지원 시 500 + readSRGF 계약 명시 (#25)

handleFetch 가 http.Flusher 미지원 writer 에 조용히 버퍼링하던 것을 SSE 시작 전
slog.Error+500 으로 처리. readSRGF 계약(미존재 파일은 os.IsNotExist 로 구분 가능)을
doc 코멘트로 명시하고 계약 테스트 추가.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: 전체 검증 게이트

**Files:** (없음 — 검증만)

- [ ] **Step 1: 전체 Go 경합 검증**

Run: `go test -race ./...`
Expected: 모든 패키지 PASS, race 경고 없음.

- [ ] **Step 2: 양 플랫폼 빌드**

Run: `GOOS=darwin go build ./... && GOOS=windows go build ./... && echo OK`
Expected: `OK`.

- [ ] **Step 3: 전체 npm test**

Run: `npm test`
Expected: 전부 PASS.

- [ ] **Step 4: 이슈 #25 완료 기준 대조**
- 오류 경로에서 `.tmp` 잔여물 없음(Task 1·2·3 정리 테스트)
- 새 로그는 `slog`(config.Warn, updater.Debug, server.Error)
- 추가 경계 테스트 통과(깨진 JSON·detect 빈·parseVer·flusher·readSRGF)

---

## Self-Review

**1. Spec coverage (이슈 #25 findings 대조):**
- ✅ config.go:21 unmarshal 조용한 폐기 → `slog.Warn` (Task 1)
- ✅ config.go:35 rename 실패 `.tmp` 미정리 → `os.Remove` (Task 1)
- ✅ config.go 깨진 JSON·detect 빈 결과 미테스트 → 테스트 추가 (Task 1)
- ✅ server.go:134 flusher 조용한 버퍼링 → `slog.Error`+500 (Task 3)
- ✅ store.go:122 readSRGF 계약 미명시 → doc + 테스트 (Task 3)
- ✅ updater.go:158 writeAtomic rename 실패 `.tmp` 고아 → `os.Remove` (Task 2)
- ✅ updater.go:72 parseVer Atoi 폐기 → 정책 doc + `slog.Debug` + 테스트 (Task 2)
- ✅ 완료 기준: `.tmp` 무잔여(Task 1·2·3), slog(Task 1·2·3), 경계 테스트(전 태스크)

**2. Placeholder scan:** 모든 코드/명령/기대출력 실제 내용. TBD 없음.

**3. Type consistency:** `LoadConfig`/`SaveConfig`/`writeAtomic`/`parseVer`/`readSRGF`/`handleFetch` 시그니처 전부 불변(내부 로직·doc·로깅만 변경). `noFlushWriter`가 `http.ResponseWriter` 3메서드(Header/Write/WriteHeader) 구현, `http.Flusher` 미구현.

**검증 리스크:**
- **flusher 가드 위치**: `http.Error`는 `w.Header().Set` 이후여도 `WriteHeader` 전이면 500 을 쓸 수 있으나, 안전하게 헤더 설정 **전**에 flusher 확인을 배치해 SSE 헤더 오염 없이 500 반환. 실서버 `http.ResponseWriter`는 Flusher 를 구현하므로 이 경로는 방어적(테스트는 `noFlushWriter`로만 트리거).
- **parseVer 동작 불변**: 로직은 그대로(비숫자→0), `slog.Debug` 추가만. 기존 `TestCompareVersions` 회귀 없어야 함.
- **config/updater writeAtomic 유니크 temp 미도입**: 이슈 #25 스코프는 "정리"만 명시(동시성은 #18 store 한정). config/updater 는 단일 writer 경로라 고정 temp명 유지 + 정리로 충분.
