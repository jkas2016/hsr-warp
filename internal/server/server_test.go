package server

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"testing/fstest"

	"hsr-warp/internal/store"
)

func stringReader(s string) *strings.Reader { return strings.NewReader(s) }

// 핸들러가 panic 해도 서버가 죽지 않고 500 + ERROR 로그로 복구해야 한다(전역 패닉 핸들러).
func TestRecoverMiddleware_PanicYields500AndLogs(t *testing.T) {
	var buf bytes.Buffer
	old := slog.Default()
	slog.SetDefault(slog.New(slog.NewJSONHandler(&buf, nil)))
	t.Cleanup(func() { slog.SetDefault(old) })

	panicker := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		panic("boom")
	})
	rr := httptest.NewRecorder()
	recoverMiddleware(panicker).ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/x", nil))

	if rr.Code != http.StatusInternalServerError {
		t.Fatalf("panic 은 500 을 반환해야 한다, got %d", rr.Code)
	}
	if !strings.Contains(buf.String(), `"level":"ERROR"`) {
		t.Fatalf("panic 은 ERROR 로 기록돼야 한다: %s", buf.String())
	}
}

func TestHandleData_ReturnsStored(t *testing.T) {
	dir := t.TempDir()
	if _, err := store.WriteAffectedMonths(dir, store.Info{UID: "555"},
		[]store.Record{{ID: "1", GachaType: "11", Time: "2026-06-01 00:00:00", RankType: "5", Name: "Z"}}); err != nil {
		t.Fatal(err)
	}
	s := New(Paths{DataDir: dir, ConfigFile: filepath.Join(dir, "config.json")})
	rr := httptest.NewRecorder()
	s.Handler().ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/api/data", nil))
	if rr.Code != 200 {
		t.Fatalf("status %d", rr.Code)
	}
	var got store.SRGF
	if err := json.Unmarshal(rr.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if len(got.List) != 1 || got.List[0].ID != "1" {
		t.Fatalf("unexpected data: %+v", got)
	}
}

func TestHandleConfig_PostThenGet(t *testing.T) {
	dir := t.TempDir()
	s := New(Paths{DataDir: dir, ConfigFile: filepath.Join(dir, "config.json")})
	h := s.Handler()

	rr := httptest.NewRecorder()
	body := `{"game_path":"D:\\Game\\Star Rail Games"}`
	h.ServeHTTP(rr, httptest.NewRequest(http.MethodPost, "/api/config", stringReader(body)))
	if rr.Code != 200 {
		t.Fatalf("post status %d", rr.Code)
	}

	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/api/config", nil))
	var c Config
	_ = json.Unmarshal(rr.Body.Bytes(), &c)
	if c.GamePath != `D:\Game\Star Rail Games` {
		t.Fatalf("config not persisted: %q", c.GamePath)
	}
}

func TestHandleData_EmptyDirReturnsEmptyList(t *testing.T) {
	dir := t.TempDir()
	s := New(Paths{DataDir: dir, ConfigFile: filepath.Join(dir, "config.json")})
	rr := httptest.NewRecorder()
	s.Handler().ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/api/data", nil))
	if rr.Code != 200 {
		t.Fatalf("status %d", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), `"list": []`) && !strings.Contains(rr.Body.String(), `"list":[]`) {
		t.Fatalf("expected empty list [], got: %s", rr.Body.String())
	}
}

func TestHandleSchedule_DataOverridesEmbedded(t *testing.T) {
	embedded := []byte(`{"version":1,"schedule":[{"s":"2023-04-26","e":"2023-05-17","c":["1102"],"l":["23001"]}]}`)
	assets := fstest.MapFS{"schedule.json": {Data: embedded}}
	dir := t.TempDir()
	s := NewWithAssets(Paths{DataDir: dir, ConfigFile: filepath.Join(dir, "config.json")}, assets, "dev")

	// data/ 없음 → 내장본.
	rr := httptest.NewRecorder()
	s.Handler().ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/schedule.json", nil))
	if !strings.Contains(rr.Body.String(), `"version":1`) {
		t.Fatalf("expected embedded v1, got %s", rr.Body.String())
	}

	// 더 높은 data/ → data/.
	higher := []byte(`{"version":9,"schedule":[{"s":"2023-04-26","e":"2023-05-17","c":["1102"],"l":["23001"]}]}`)
	if err := os.WriteFile(filepath.Join(dir, "schedule.json"), higher, 0644); err != nil {
		t.Fatal(err)
	}
	rr = httptest.NewRecorder()
	s.Handler().ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/schedule.json", nil))
	if !strings.Contains(rr.Body.String(), `"version":9`) {
		t.Fatalf("expected data/ v9, got %s", rr.Body.String())
	}
}
