package server

import (
	"encoding/json"
	"fmt"
	"io/fs"
	"net/http"
	"time"

	"hsr-warp/internal/collector"
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

// handleFetch 는 증분 조회를 SSE 로 스트리밍한다.
// 이벤트: progress {banner,added} / error {message} / done {summary,data}.
func (s *Server) handleFetch(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	flusher, _ := w.(http.Flusher)

	send := func(event string, payload any) {
		b, _ := json.Marshal(payload)
		fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event, b)
		if flusher != nil {
			flusher.Flush()
		}
	}
	fail := func(msg string) { send("error", map[string]string{"message": msg}) }

	gamePath := r.URL.Query().Get("path")
	if gamePath == "" {
		fail("게임 경로가 비어 있습니다.")
		return
	}

	ac, err := collector.FindAuthContext(gamePath)
	if err != nil {
		fail(err.Error())
		return
	}
	// config 에 경로 저장(다음 실행 자동 채움).
	_ = SaveConfig(s.paths.ConfigFile, Config{GamePath: gamePath})

	existing, prevInfo, err := store.LoadAll(s.paths.DataDir)
	if err != nil {
		fail(err.Error())
		return
	}
	lastID := store.MaxIDByBanner(existing)

	newRecs, uid, err := collector.FetchIncremental(ac, lastID, 400*time.Millisecond,
		func(banner string, added int) {
			send("progress", map[string]any{"banner": banner, "added": added})
		})
	if err != nil {
		fail(err.Error())
		return
	}

	if uid == "" && prevInfo != nil {
		uid = prevInfo.UID
	}
	info := store.Info{
		UID: uid, Lang: ac.Lang, Region: ac.Region,
		RegionTimeZone:  store.TZForRegion(ac.Region),
		ExportTimestamp: time.Now().Unix(),
		ExportApp:       "DIY-HSR-Warp", ExportAppVersion: "0.1.0", SRGFVersion: "v1.0",
	}

	updatedMonths, err := store.WriteAffectedMonths(s.paths.DataDir, info, newRecs)
	if err != nil {
		fail(err.Error())
		return
	}

	// 갱신 후 전체 합본 재구성.
	all, finalInfo, err := store.LoadAll(s.paths.DataDir)
	if err != nil {
		fail(err.Error())
		return
	}
	out := store.SRGF{List: all}
	if finalInfo != nil {
		out.Info = *finalInfo
	} else {
		out.Info = info
	}

	// 배너별 신규 건수 요약.
	perBanner := map[string]int{}
	for _, rec := range newRecs {
		perBanner[rec.GachaType]++
	}
	send("done", map[string]any{
		"summary": map[string]any{
			"newTotal":      len(newRecs),
			"perBanner":     perBanner,
			"updatedMonths": updatedMonths,
		},
		"data": out,
	})
}
