package server

import (
	"encoding/json"
	"io/fs"
	"net/http"

	"hsr-warp/internal/store"
)

// Paths 는 서버가 사용할 파일 경로 모음이다.
type Paths struct {
	DataDir    string
	ConfigFile string
}

// Server 는 대시보드와 API 를 제공한다.
type Server struct {
	paths  Paths
	assets fs.FS // web/ (dashboard.html, analyze.js). nil 이면 자산 라우트 비활성(테스트용).
}

// New 는 자산 없이 Server 를 만든다(API 테스트용).
func New(p Paths) *Server { return &Server{paths: p} }

// NewWithAssets 는 임베드 자산을 주입한다(실제 실행용).
func NewWithAssets(p Paths, assets fs.FS) *Server { return &Server{paths: p, assets: assets} }

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(v)
}

// Handler 는 라우팅된 http.Handler 를 반환한다.
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/data", s.handleData)
	mux.HandleFunc("/api/config", s.handleConfig)
	mux.HandleFunc("/api/detect", s.handleDetect)
	mux.HandleFunc("/api/fetch", s.handleFetch)
	if s.assets != nil {
		mux.Handle("/", http.FileServer(http.FS(s.assets)))
	}
	return mux
}

func (s *Server) handleData(w http.ResponseWriter, r *http.Request) {
	recs, info, err := store.LoadAll(s.paths.DataDir)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if recs == nil {
		recs = []store.Record{}
	}
	out := store.SRGF{List: recs}
	if info != nil {
		out.Info = *info
	}
	writeJSON(w, out)
}

func (s *Server) handleConfig(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodPost {
		var c Config
		if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if err := SaveConfig(s.paths.ConfigFile, c); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		writeJSON(w, map[string]bool{"ok": true})
		return
	}
	writeJSON(w, LoadConfig(s.paths.ConfigFile))
}

func (s *Server) handleDetect(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, map[string]string{"path": detectGamePath(defaultCandidates())})
}

// handleFetch 는 Task 7 에서 SSE 로 교체된다(현재는 스텁).
func (s *Server) handleFetch(w http.ResponseWriter, r *http.Request) {
	http.Error(w, "not implemented", http.StatusNotImplemented)
}
