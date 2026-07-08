package server

import (
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
)

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

func TestHandleFetch_MissingPath(t *testing.T) {
	dir := t.TempDir()
	s := New(Paths{DataDir: dir, ConfigFile: filepath.Join(dir, "config.json")})
	rr := httptest.NewRecorder()
	s.Handler().ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/api/fetch", nil))
	if !strings.Contains(rr.Body.String(), "event: error") {
		t.Fatalf("expected SSE error event, got: %s", rr.Body.String())
	}
}

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
	// 거절 경로는 진행 중 플래그를 건드리면 안 된다(승자의 가드를 해제하지 않음).
	if !s.fetching.Load() {
		t.Fatal("거절 후에도 fetching 플래그는 true 여야 함")
	}
}

func TestHandleFetch_BadGamePathEmitsError(t *testing.T) {
	dir := t.TempDir()
	s := New(Paths{DataDir: dir, ConfigFile: filepath.Join(dir, "config.json")})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/fetch?path="+filepath.Join(dir, "nonexistent"), nil)
	s.Handler().ServeHTTP(rr, req)
	body := rr.Body.String()
	if !strings.Contains(body, "event: error") {
		t.Fatalf("expected error event for bad path, got: %s", body)
	}
	if rr.Header().Get("Content-Type") != "text/event-stream" {
		t.Fatalf("expected SSE content-type, got %q", rr.Header().Get("Content-Type"))
	}
}
