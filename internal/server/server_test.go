package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"hsr-warp/internal/store"
)

func stringReader(s string) *strings.Reader { return strings.NewReader(s) }

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
