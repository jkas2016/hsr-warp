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
	// handleData 는 게임별 디렉터리(data/hsr/)를 읽는다(?game= 미지정은 hsr 폴백).
	if _, err := store.WriteAffectedMonths(filepath.Join(dir, "hsr"), store.Info{UID: "555"},
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
	// 구 스키마({"game_path":...})는 LoadConfig 가 games.hsr 로 승격하고 최상위
	// GamePath 는 비운다(config.go 참고) — PathFor 로 조회한다.
	if c.PathFor("hsr") != `D:\Game\Star Rail Games` {
		t.Fatalf("config not persisted: %q", c.PathFor("hsr"))
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

func TestHandleUpdates_ReturnsBothChannels(t *testing.T) {
	dir := t.TempDir()
	embedded := []byte(`{"version":1,"schedule":[{"s":"2023-04-26","e":"2023-05-17","c":["1102"],"l":["23001"]}]}`)
	assets := fstest.MapFS{"schedule.json": {Data: embedded}}
	s := NewWithAssets(Paths{DataDir: dir, ConfigFile: filepath.Join(dir, "config.json")}, assets, "1.0.0")

	// 외부 소스를 httptest 로 주입(같은 패키지라 필드 직접 설정).
	sched := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"version":5,"schedule":[{"s":"2023-04-26","e":"2023-05-17","c":["1102"],"l":["23001"]}]}`))
	}))
	defer sched.Close()
	rel := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"tag_name":"v1.2.0","html_url":"https://example/r","assets":[]}`))
	}))
	defer rel.Close()
	s.scheduleURL, s.releaseURL, s.client = sched.URL, rel.URL, sched.Client()

	rr := httptest.NewRecorder()
	s.Handler().ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/api/updates", nil))
	if rr.Code != 200 {
		t.Fatalf("status %d", rr.Code)
	}
	var got struct {
		Schedule struct {
			Updated bool `json:"updated"`
			Version int  `json:"version"`
		} `json:"schedule"`
		Code struct {
			Newer   bool   `json:"newer"`
			Version string `json:"version"`
		} `json:"code"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if !got.Schedule.Updated || got.Schedule.Version != 5 {
		t.Fatalf("schedule: %+v", got.Schedule)
	}
	if !got.Code.Newer || got.Code.Version != "1.2.0" {
		t.Fatalf("code: %+v", got.Code)
	}
}

// ?game= 미지정은 hsr 로 폴백한다(기존 클라이언트 동작 보존).
func TestGameOf_DefaultsToHSR(t *testing.T) {
	s := New(Paths{})
	g, ok := s.gameOf(httptest.NewRequest("GET", "/api/data", nil))
	if !ok || g.ID != "hsr" {
		t.Errorf("gameOf = %q ok=%v, want hsr true", g.ID, ok)
	}
}

// 알 수 없는 game 값은 조용히 폴백하지 않고 거절돼야 한다 — 오타가 엉뚱한
// 게임의 데이터를 보여주면 사용자가 알아채기 어렵다.
func TestHandleData_RejectsUnknownGame(t *testing.T) {
	s := New(Paths{DataDir: t.TempDir()})
	w := httptest.NewRecorder()
	s.Handler().ServeHTTP(w, httptest.NewRequest("GET", "/api/data?game=genshin", nil))
	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400", w.Code)
	}
}

// 게임별 데이터가 격리돼 서빙돼야 한다.
func TestHandleData_ScopesByGame(t *testing.T) {
	root := t.TempDir()
	s := New(Paths{DataDir: root})
	hsrRec := []store.Record{{ID: "100", GachaType: "11", Time: "2026-08-01 10:00:00"}}
	zzzRec := []store.Record{{ID: "200", GachaType: "2", Time: "2026-08-01 10:00:00"}}
	if _, err := store.WriteAffectedMonths(filepath.Join(root, "hsr"), store.Info{UID: "1"}, hsrRec); err != nil {
		t.Fatal(err)
	}
	if _, err := store.WriteAffectedMonths(filepath.Join(root, "zzz"), store.Info{UID: "2"}, zzzRec); err != nil {
		t.Fatal(err)
	}

	for q, wantID := range map[string]string{"": "100", "?game=hsr": "100", "?game=zzz": "200"} {
		w := httptest.NewRecorder()
		s.Handler().ServeHTTP(w, httptest.NewRequest("GET", "/api/data"+q, nil))
		if w.Code != http.StatusOK {
			t.Errorf("%q: status = %d, want 200", q, w.Code)
			continue
		}
		var out store.SRGF
		if err := json.Unmarshal(w.Body.Bytes(), &out); err != nil {
			t.Errorf("%q: %v", q, err)
			continue
		}
		if len(out.List) != 1 || out.List[0].ID != wantID {
			t.Errorf("%q: 레코드 = %+v, want ID %s", q, out.List, wantID)
		}
	}
}

// ZZZ 스케줄은 별도 경로로 서빙된다. HSR 경로는 구버전 호환을 위해 그대로다.
func TestHandleSchedule_ServesPerGamePaths(t *testing.T) {
	hsrBody := `{"version":1,"schedule":[{"s":"2024-01-01","e":"2024-02-01","c":[],"l":[]}]}`
	zzzBody := `{"version":1,"schedule":[{"s":"2025-01-01","e":"2025-02-01","c":[],"l":[]}]}`
	s := NewWithAssets(Paths{DataDir: t.TempDir()}, fstest.MapFS{
		"schedule.json":     {Data: []byte(hsrBody)},
		"zzz/schedule.json": {Data: []byte(zzzBody)},
	}, "test")

	for path, want := range map[string]string{"/schedule.json": hsrBody, "/zzz/schedule.json": zzzBody} {
		w := httptest.NewRecorder()
		s.Handler().ServeHTTP(w, httptest.NewRequest("GET", path, nil))
		if w.Body.String() != want {
			t.Errorf("%s = %s, want %s", path, w.Body.String(), want)
		}
	}
}

// 자동탐지도 게임별이어야 한다.
func TestHandleDetect_ScopesByGame(t *testing.T) {
	s := New(Paths{})
	w := httptest.NewRecorder()
	s.Handler().ServeHTTP(w, httptest.NewRequest("GET", "/api/detect?game=zzz", nil))
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}
	var out map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &out); err != nil {
		t.Fatal(err)
	}
	if _, ok := out["path"]; !ok {
		t.Errorf("path 키가 없다: %v", out)
	}

	w = httptest.NewRecorder()
	s.Handler().ServeHTTP(w, httptest.NewRequest("GET", "/api/detect?game=nope", nil))
	if w.Code != http.StatusBadRequest {
		t.Errorf("알 수 없는 게임 status = %d, want 400", w.Code)
	}
}
