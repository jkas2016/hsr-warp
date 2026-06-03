package server

import (
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
)

func TestHandleFetch_MissingPath(t *testing.T) {
	dir := t.TempDir()
	s := New(Paths{DataDir: dir, ConfigFile: filepath.Join(dir, "config.json")})
	rr := httptest.NewRecorder()
	s.Handler().ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/api/fetch", nil))
	if !strings.Contains(rr.Body.String(), "event: error") {
		t.Fatalf("expected SSE error event, got: %s", rr.Body.String())
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
