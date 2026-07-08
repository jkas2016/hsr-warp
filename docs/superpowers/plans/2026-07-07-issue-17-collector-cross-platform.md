# 이슈 #17 — collector 크로스플랫폼 빌드 제약 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `internal/collector` 패키지가 darwin·windows 양쪽에서 빌드·vet·test 되도록 Windows 전용 코드를 플랫폼별 파일로 분리하고, `url.QueryUnescape` 에러 폐기를 폴백으로 고친다.

**Architecture:** `cache.go`에 섞여 있는 Windows 전용 `readShared`(syscall)를 `cache_windows.go`(`//go:build windows`)와 `cache_other.go`(`//go:build !windows`, `os.ReadFile` 폴백)로 분리한다. 크로스플랫폼 순수 함수(`parseAuthURL` 등)는 `cache.go`에 남겨 darwin에서도 컴파일·테스트되게 한다. Windows 전용 테스트도 동일하게 분리한다.

**Tech Stack:** Go 1.x, `//go:build` 제약, `math/big`/`net/url` 표준 라이브러리, `testing`.

## Global Constraints

- **크로스플랫폼 컴파일 필수**: `GOOS=darwin go build ./...` 와 `GOOS=windows go build ./...` 둘 다 통과해야 한다.
- **darwin에서 collector 테스트가 실제로 실행**되어야 한다(스킵/컴파일 실패 아님) — 이슈 완료 기준.
- **Windows 동작 회귀 없음**: `readShared`의 FILE_SHARE_DELETE 열기(게임 실행 중 data_2 읽기) 로직은 Windows에서 그대로 유지.
- **포맷·정적검사 권위**: `gofmt -w .`, `go vet ./...`.
- **에러를 조용히 폐기하지 않는다**: `QueryUnescape` 실패는 raw 값 폴백(빈 문자열 소실 방지).
- **run-go.mjs는 손대지 않는다**: 이슈의 "GOOS=windows 강제" 대안은 채택하지 않고 스텁 분리 방식으로 해소(택일). 근거를 커밋 메시지에 남긴다.

---

## 파일 구조

| 파일 | 빌드 태그 | 책임 |
|---|---|---|
| `internal/collector/cache.go` | (없음, 크로스플랫폼) | `AuthContext`, `parseAuthURL`, `timestampOf`, `verLess`, `latestVersion`, `FindAuthContext`, `unescapeOr`. syscall 미사용. |
| `internal/collector/cache_windows.go` | `//go:build windows` | `readShared`(syscall FILE_SHARE_DELETE 열기) |
| `internal/collector/cache_other.go` | `//go:build !windows` | `readShared`(os.ReadFile 폴백) |
| `internal/collector/cache_test.go` | (없음, 크로스플랫폼) | `TestParseAuthURL*`, `TestLatestVersion`, `TestParseAuthURL_MalformedEscapeFallsBackToRaw`, `contains` 헬퍼 |
| `internal/collector/cache_windows_test.go` | `//go:build windows` | `TestReadShared_SucceedsWhenOsReadFileBlocked`(syscall 선점 재현) |
| `internal/collector/cache_other_test.go` | `//go:build !windows` | `TestReadShared_FallsBackToOsReadFile` |

`FindAuthContext`는 `readShared`를 호출하지만 두 플랫폼 모두 `readShared`를 제공하므로 `cache.go`(크로스플랫폼)에 남는다.

---

### Task 1: readShared 플랫폼 분리 — 패키지가 darwin·windows 양쪽 빌드·vet 통과

**Files:**
- Create: `internal/collector/cache_windows.go`
- Create: `internal/collector/cache_other.go`
- Create: `internal/collector/cache_windows_test.go`
- Modify: `internal/collector/cache.go` (readShared 함수·doc 제거, `io`·`syscall` import 제거)
- Modify: `internal/collector/cache_test.go` (`TestReadShared_SucceedsWhenOsReadFileBlocked` 제거, `os`·`path/filepath`·`syscall` import 제거)

**Interfaces:**
- Produces: `readShared(path string) ([]byte, error)` — 두 플랫폼 파일 모두 동일 시그니처. Windows는 FILE_SHARE_DELETE 열기, 그 외는 `os.ReadFile`.

- [ ] **Step 1: 현재 실패 재현 (baseline)**

Run: `GOOS=darwin go build ./internal/collector/`
Expected: FAIL — `undefined: syscall.CreateFile` 등 8건 (cache.go:163~169)

- [ ] **Step 2: `cache_windows.go` 생성 (readShared Windows판)**

`internal/collector/cache_windows.go`:
```go
//go:build windows

package collector

import (
	"io"
	"os"
	"syscall"
)

// readShared 는 FILE_SHARE_DELETE 까지 포함해 열어 게임 실행 중에도 읽는다.
// os.ReadFile 은 FILE_SHARE_READ|WRITE 만 써서(stdlib syscall_windows.go),
// DELETE 권한으로 매핑된 webCache data_2 를 ERROR_SHARING_VIOLATION(32) 으로 못 읽는다.
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

- [ ] **Step 3: `cache_other.go` 생성 (readShared 비-Windows 폴백)**

`internal/collector/cache_other.go`:
```go
//go:build !windows

package collector

import "os"

// readShared 는 비-Windows 에서 표준 파일 읽기로 폴백한다.
// FILE_SHARE_DELETE 공유 위반은 Windows 전용 문제라 다른 OS 에선 일반 읽기로 충분하다.
// (게임은 Windows 전용이므로 이 경로는 주로 크로스플랫폼 컴파일·개발기 테스트를 위한 것이다.)
func readShared(path string) ([]byte, error) {
	return os.ReadFile(path)
}
```

- [ ] **Step 4: `cache.go`에서 readShared 함수·doc 제거 + import 정리**

`cache.go`의 `readShared` 함수 전체(현재 159~176행, `// readShared 는 FILE_SHARE_DELETE …` 주석부터 닫는 `}`까지)를 삭제한다. import 블록에서 `"io"` 와 `"syscall"` 두 줄을 제거한다(둘 다 readShared 전용이었음). `"os"`·`"path/filepath"` 등 나머지는 `FindAuthContext`가 계속 쓰므로 유지.

삭제 후 cache.go import 블록은 다음이어야 한다:
```go
import (
	"errors"
	"log/slog"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
)
```

- [ ] **Step 5: Windows 전용 테스트를 `cache_windows_test.go`로 이동**

`internal/collector/cache_windows_test.go`:
```go
//go:build windows

package collector

import (
	"os"
	"path/filepath"
	"syscall"
	"testing"
)

// TestReadShared_SucceedsWhenOsReadFileBlocked 는 게임이 webCache data_2 를
// DELETE 권한으로 쥔 상황을 재현한다. 표준 os.ReadFile 은 FILE_SHARE_DELETE 가
// 없어 ERROR_SHARING_VIOLATION 으로 실패하고, readShared 는 성공해야 한다.
func TestReadShared_SucceedsWhenOsReadFileBlocked(t *testing.T) {
	const want = "authkey-blob-내용"
	path := filepath.Join(t.TempDir(), "data_2")
	if err := os.WriteFile(path, []byte(want), 0o644); err != nil {
		t.Fatal(err)
	}

	// 게임 흉내: DELETE 접근 + 풀 공유로 선점한 채 핸들 유지.
	p, err := syscall.UTF16PtrFromString(path)
	if err != nil {
		t.Fatal(err)
	}
	const deleteAccess = 0x00010000 // 표준 액세스 권리 DELETE (syscall 미노출)
	h, err := syscall.CreateFile(p, deleteAccess,
		syscall.FILE_SHARE_READ|syscall.FILE_SHARE_WRITE|syscall.FILE_SHARE_DELETE,
		nil, syscall.OPEN_EXISTING, syscall.FILE_ATTRIBUTE_NORMAL, 0)
	if err != nil {
		t.Fatalf("선점 open 실패: %v", err)
	}
	defer syscall.CloseHandle(h)

	// 기준선: 표준 os.ReadFile 은 공유 위반으로 실패해야 한다(이 fix 의 동기).
	if _, err := os.ReadFile(path); err == nil {
		t.Fatal("os.ReadFile 가 성공함 — 점유 시나리오가 재현되지 않음")
	}

	got, err := readShared(path)
	if err != nil {
		t.Fatalf("readShared 실패: %v", err)
	}
	if string(got) != want {
		t.Fatalf("내용 불일치: got %q want %q", string(got), want)
	}
}
```

- [ ] **Step 6: `cache_test.go`에서 이동된 테스트·불필요 import 제거**

`cache_test.go`에서 `TestReadShared_SucceedsWhenOsReadFileBlocked` 함수 전체(현재 123~159행, doc 주석 포함)를 삭제한다. import 블록을 `"testing"`만 남기고 `"os"`·`"path/filepath"`·`"syscall"`을 제거한다(이들은 삭제한 테스트 전용이었고, 남는 테스트는 `parseAuthURL`/`latestVersion`/`contains`만 사용). 결과:
```go
import (
	"testing"
)
```
`contains` 헬퍼(114~121행)는 `TestParseAuthURL`이 계속 쓰므로 유지.

- [ ] **Step 7: darwin 빌드·vet 통과 확인**

Run: `GOOS=darwin go build ./... && GOOS=darwin go vet ./internal/collector/`
Expected: PASS (출력 없음, exit 0)

- [ ] **Step 8: windows 크로스컴파일·vet 통과 확인 (회귀 방지)**

Run: `GOOS=windows go build ./... && GOOS=windows go vet ./internal/collector/`
Expected: PASS (출력 없음, exit 0). windows 테스트 파일(`cache_windows_test.go`)도 vet이 컴파일하므로 통과해야 함.

- [ ] **Step 9: darwin에서 collector 테스트가 실제로 실행되는지 확인**

Run: `go test ./internal/collector/ -v -run 'TestParseAuthURL|TestLatestVersion'`
Expected: PASS — `TestParseAuthURL`, `TestParseAuthURL_NoURL`, `TestParseAuthURL_PicksGachaLogNotLast`, `TestParseAuthURL_PreservesActualHostAndPath`, `TestParseAuthURL_NoGachaLogURL`, `TestParseAuthURL_IssuedAtFromTimestamp`, `TestParseAuthURL_PicksFreshestGachaLogByTimestamp`, `TestLatestVersion`이 각각 `--- PASS`로 실행됨(스킵·컴파일 실패 아님).

- [ ] **Step 10: gofmt + commit**

```bash
gofmt -w internal/collector/
git add internal/collector/cache.go internal/collector/cache_windows.go internal/collector/cache_other.go internal/collector/cache_test.go internal/collector/cache_windows_test.go
git commit -m "fix(collector): Windows 전용 readShared 플랫폼 분리로 크로스플랫폼 빌드 (#17)

cache.go의 syscall 기반 readShared를 cache_windows.go(//go:build windows)와
cache_other.go(!windows, os.ReadFile 폴백)로 분리. 순수 함수는 cache.go에 남겨
darwin에서도 컴파일·테스트. Windows 전용 테스트도 cache_windows_test.go로 이동.
run-go.mjs GOOS=windows 강제 대안 대신 스텁 분리 방식 채택.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: 비-Windows readShared 폴백 테스트 (darwin 커버리지)

**Files:**
- Create: `internal/collector/cache_other_test.go`

**Interfaces:**
- Consumes: `readShared(path string) ([]byte, error)` (Task 1, cache_other.go의 os.ReadFile 폴백)

- [ ] **Step 1: 실패 테스트 작성**

`internal/collector/cache_other_test.go`:
```go
//go:build !windows

package collector

import (
	"os"
	"path/filepath"
	"testing"
)

// 비-Windows 에서 readShared 는 표준 파일 읽기로 폴백해 내용을 그대로 반환해야 한다.
func TestReadShared_FallsBackToOsReadFile(t *testing.T) {
	const want = "authkey-blob-내용"
	path := filepath.Join(t.TempDir(), "data_2")
	if err := os.WriteFile(path, []byte(want), 0o644); err != nil {
		t.Fatal(err)
	}
	got, err := readShared(path)
	if err != nil {
		t.Fatalf("readShared 실패: %v", err)
	}
	if string(got) != want {
		t.Fatalf("내용 불일치: got %q want %q", string(got), want)
	}
}
```

- [ ] **Step 2: 테스트 실행 → 통과 확인**

Run: `go test ./internal/collector/ -v -run TestReadShared_FallsBackToOsReadFile`
Expected: PASS (`--- PASS: TestReadShared_FallsBackToOsReadFile`)

- [ ] **Step 3: commit**

```bash
git add internal/collector/cache_other_test.go
git commit -m "test(collector): 비-Windows readShared os.ReadFile 폴백 테스트 (#17)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: QueryUnescape 에러 폐기 → raw 값 폴백 (TDD)

**Files:**
- Modify: `internal/collector/cache.go` (`parseAuthURL`의 region/lang unescape, `unescapeOr` 헬퍼 추가)
- Modify: `internal/collector/cache_test.go` (폴백 테스트 추가)

**Interfaces:**
- Produces: `unescapeOr(s string) string` — `url.QueryUnescape` 성공 시 디코딩값, 실패 시 raw `s`.

- [ ] **Step 1: 실패 테스트 작성**

`cache_test.go`에 추가:
```go
// region/lang 값에 잘못된 % 이스케이프가 있어도 조용히 빈 문자열이 되면 안 되고
// raw 값으로 폴백해야 한다(QueryUnescape 에러 폐기 방지).
func TestParseAuthURL_MalformedEscapeFallsBackToRaw(t *testing.T) {
	blob := []byte("\x00https://host/common/gacha_record/api/getGachaLog?authkey=X&lang=ko-kr&region=prod%zz\x00")
	ac, err := parseAuthURL(blob)
	if err != nil {
		t.Fatal(err)
	}
	if ac.Region != "prod%zz" {
		t.Fatalf("malformed escape 는 raw 로 폴백해야 함, got %q", ac.Region)
	}
	if ac.Lang != "ko-kr" {
		t.Fatalf("정상 lang 은 그대로 디코딩돼야 함, got %q", ac.Lang)
	}
}
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `go test ./internal/collector/ -v -run TestParseAuthURL_MalformedEscapeFallsBackToRaw`
Expected: FAIL — 현재 `region, _ = url.QueryUnescape(val)`가 에러 시 빈 문자열을 남겨 `ac.Region == ""` (`got ""`).

- [ ] **Step 3: `unescapeOr` 헬퍼 추가 + region/lang 적용**

`cache.go`의 `timestampOf` 함수 위(또는 아래)에 헬퍼 추가:
```go
// unescapeOr 는 QueryUnescape 실패 시 raw 값으로 폴백한다.
// 실패를 조용히 빈 문자열로 흘리면 region/lang 이 소실돼 이후 조회가 깨진다.
func unescapeOr(s string) string {
	if v, err := url.QueryUnescape(s); err == nil {
		return v
	}
	return s
}
```

`parseAuthURL`의 switch를 수정:
```go
		switch key {
		case "region":
			region = unescapeOr(val)
		case "lang":
			lang = unescapeOr(val)
		}
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `go test ./internal/collector/ -v -run TestParseAuthURL_MalformedEscapeFallsBackToRaw`
Expected: PASS

- [ ] **Step 5: 전체 collector 테스트 회귀 확인**

Run: `go test ./internal/collector/ -v`
Expected: 모든 테스트 PASS (기존 `TestParseAuthURL`가 정상 region/lang 디코딩 유지 확인 포함)

- [ ] **Step 6: gofmt + commit**

```bash
gofmt -w internal/collector/cache.go
git add internal/collector/cache.go internal/collector/cache_test.go
git commit -m "fix(collector): QueryUnescape 실패 시 raw 폴백 — region/lang 소실 방지 (#17)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: 전체 테스트 스위트 확인 (완료 게이트)

**Files:** (없음 — 검증만)

- [ ] **Step 1: 전체 npm test 통과 확인**

Run: `npm test`
Expected: go 테스트(collector 포함)·analyze·대시보드·사이트 copy 전부 PASS. collector 테스트가 darwin에서 스킵 없이 실행됨.

- [ ] **Step 2: 양 플랫폼 빌드 최종 확인**

Run: `GOOS=darwin go build ./... && GOOS=windows go build ./... && echo OK`
Expected: `OK`

- [ ] **Step 3: (선택) 이슈 코멘트/체크박스 반영은 사용자 요청 시에만**

이슈 #17의 완료 기준 3종이 모두 충족됨을 확인:
- `GOOS=darwin go build ./...`·`go vet ./...` 통과 (Task 1 Step 7)
- darwin에서 collector 테스트 실제 실행 (Task 1 Step 9, Task 4 Step 1)
- Windows 빌드/동작 회귀 없음 (Task 1 Step 8, readShared 로직 보존)

---

## Self-Review

**1. Spec coverage (이슈 #17 작업 항목 대조):**
- ✅ `cache.go`에 `//go:build windows` 제약 추가 → 더 나은 방식(파일 분리)으로 해소: Windows 코드만 `cache_windows.go`로 격리 (Task 1)
- ✅ 비-Windows 스텁 제공 → `cache_other.go` os.ReadFile 폴백 (Task 1)
- ✅ run-go.mjs GOOS=windows 강제 여부 결정 → 스텁 분리 채택, run-go.mjs 무변경 (Global Constraints + Task 1 커밋 메시지)
- ✅ cache.go:87 QueryUnescape 실패 raw 폴백 (Task 3)
- ✅ 완료 기준: darwin build/vet (Task 1 Step 7), darwin 테스트 실행 (Step 9), Windows 회귀 없음 (Step 8)

**2. Placeholder scan:** 모든 코드 블록에 실제 내용 포함, TBD/TODO 없음.

**3. Type consistency:** `readShared(path string) ([]byte, error)` 시그니처가 cache_windows.go·cache_other.go·모든 테스트에서 일치. `unescapeOr(s string) string`가 정의·사용처 일치.

**한 가지 검증 리스크:** Task 3의 `region=prod%zz` 테스트는 `url.Parse`가 RawQuery의 `%zz`를 파싱 시점에 에러내지 않는다는 전제(Go는 RawQuery를 지연 디코딩)에 의존한다. Step 2에서 실패 방식(빈 문자열 vs parse 에러)을 실제 관찰해 전제를 확인한다 — 만약 `parseAuthURL`이 `url.Parse` 단계에서 에러를 반환하면, 테스트 blob의 잘못된 이스케이프를 `region=prod%2` 같은 다른 형태로 조정한다.
