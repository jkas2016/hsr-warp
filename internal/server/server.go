package server

import (
	"encoding/json"
	"fmt"
	"io/fs"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"hsr-warp/internal/collector"
	"hsr-warp/internal/store"
	"hsr-warp/internal/updater"
)

// Paths 는 서버가 사용할 파일 경로 모음이다.
type Paths struct {
	DataDir    string
	ConfigFile string
}

const (
	defaultScheduleURL = "https://raw.githubusercontent.com/jkas2016/hsr-warp/main/web/schedule.json"
	defaultReleaseURL  = "https://api.github.com/repos/jkas2016/hsr-warp/releases/latest"
)

// Server 는 대시보드와 API 를 제공한다.
type Server struct {
	paths       Paths
	assets      fs.FS // web/ (dashboard.html, analyze.js, schedule.json). nil 이면 자산 라우트 비활성(테스트용).
	version     string
	scheduleURL string
	releaseURL  string
	client      *http.Client
	once        sync.Once
	cached      updater.Updates
}

// New 는 자산 없이 Server 를 만든다(API 테스트용).
func New(p Paths) *Server { return newServer(p, nil, "") }

// NewWithAssets 는 임베드 자산과 빌드 버전을 주입한다(실제 실행용).
func NewWithAssets(p Paths, assets fs.FS, version string) *Server {
	return newServer(p, assets, version)
}

func newServer(p Paths, assets fs.FS, version string) *Server {
	return &Server{
		paths: p, assets: assets, version: version,
		scheduleURL: defaultScheduleURL, releaseURL: defaultReleaseURL,
		client: &http.Client{Timeout: 5 * time.Second},
	}
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(v)
}

// Handler 는 라우팅된 http.Handler 를 반환한다(전역 패닉 복구로 감쌈).
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/data", s.handleData)
	mux.HandleFunc("/api/config", s.handleConfig)
	mux.HandleFunc("/api/detect", s.handleDetect)
	mux.HandleFunc("/api/fetch", s.handleFetch)
	mux.HandleFunc("/schedule.json", s.handleSchedule)
	mux.HandleFunc("/api/updates", s.handleUpdates)
	if s.assets != nil {
		mux.Handle("/", http.FileServer(http.FS(s.assets)))
	}
	return recoverMiddleware(mux)
}

// recoverMiddleware 는 어떤 핸들러가 panic 해도 500 으로 복구하고 ERROR 로 기록한다.
// Go 엔 전역 예외 핸들러가 없어, mux 전체를 감싸는 미들웨어가 그 역할을 한다.
// ERROR 레벨이라 stackHandler 가 패닉 시점 스택트레이스를 자동 첨부한다.
func recoverMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				slog.Error("핸들러 panic 복구", "panic", rec, "method", r.Method, "path", r.URL.Path)
				http.Error(w, "internal server error", http.StatusInternalServerError)
			}
		}()
		next.ServeHTTP(w, r)
	})
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
	fail := func(msg string) {
		slog.Error("조회 실패", "err", msg)
		send("error", map[string]string{"message": msg})
	}

	gamePath := r.URL.Query().Get("path")
	if gamePath == "" {
		fail("게임 경로가 비어 있습니다.")
		return
	}
	slog.Info("조회 시작", "path", gamePath)

	ac, err := collector.FindAuthContext(gamePath)
	if err != nil {
		fail(err.Error())
		return
	}
	if ac.IssuedAt.IsZero() {
		slog.Warn("authkey 발급 시각 알 수 없음", "reason", "캐시에 timestamp 없음")
	} else {
		slog.Info("authkey 발급 시각",
			"issued", ac.IssuedAt.Format("2006-01-02 15:04"),
			"hours_ago", int(time.Since(ac.IssuedAt).Hours()))
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
	slog.Info("조회 완료", "new", len(newRecs), "updated_months", updatedMonths, "uid", uid)
	send("done", map[string]any{
		"summary": map[string]any{
			"newTotal":      len(newRecs),
			"perBanner":     perBanner,
			"updatedMonths": updatedMonths,
		},
		"data": out,
	})
}

// handleSchedule 은 배너 일정 데이터를 서빙한다. data/schedule.json 이 유효하고 내장본보다
// version 이 높으면 그걸, 아니면 내장본을 준다(updater.EffectiveSchedule).
func (s *Server) handleSchedule(w http.ResponseWriter, r *http.Request) {
	var emb []byte
	if s.assets != nil {
		emb, _ = fs.ReadFile(s.assets, "schedule.json")
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_, _ = w.Write(updater.EffectiveSchedule(s.paths.DataDir, emb))
}

// handleUpdates 는 첫 호출 시 두 업데이트 체크를 베스트에포트로 수행하고 프로세스 수명 동안 캐시한다.
// 대시보드가 시작 직후 1회 호출 → "시작 시 자동 확인". 실패는 예상된 동작이라 Warn 으로만 남긴다.
func (s *Server) handleUpdates(w http.ResponseWriter, r *http.Request) {
	s.once.Do(func() {
		var emb []byte
		if s.assets != nil {
			emb, _ = fs.ReadFile(s.assets, "schedule.json")
		}
		sch, err := updater.CheckSchedule(s.client, s.scheduleURL, s.paths.DataDir, emb)
		if err != nil {
			slog.Warn("배너 데이터 업데이트 확인 실패", "err", err)
		}
		code, err := updater.CheckRelease(s.client, s.releaseURL, s.version)
		if err != nil {
			slog.Warn("릴리스 업데이트 확인 실패", "err", err)
		}
		s.cached = updater.Updates{Schedule: sch, Code: code}
	})
	writeJSON(w, s.cached)
}
