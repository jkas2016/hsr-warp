// Package server 는 대시보드 자산과 로컬 JSON/SSE API 를 제공하는 HTTP 계층이다.
// 분석은 하지 않는다 — 저장된 기록을 그대로 내려주고 계산은 브라우저가 맡는다.
package server

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"log/slog"
	"net/http"
	"path/filepath"
	"sync"
	"sync/atomic"
	"time"

	"hsr-warp/internal/collector"
	"hsr-warp/internal/game"
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
	assets      fs.FS // web/ (대시보드 UI 킷, analyze.js, schedule.json). nil 이면 자산 라우트 비활성(테스트용).
	version     string
	scheduleURL string
	releaseURL  string
	client      *http.Client
	once        sync.Once
	cached      updater.Updates
	fetching    atomic.Bool // 수집 진행 중이면 true — 겹치는 /api/fetch 를 거절
}

// New 는 자산 없이 Server 를 만든다(API 테스트용).
func New(p Paths) *Server { return newServer(p, nil, "") }

// NewWithAssets 는 임베드 자산과 빌드 버전을 주입한다(실제 실행용).
func NewWithAssets(p Paths, assets fs.FS, version string) *Server {
	return newServer(p, assets, version)
}

// newServer 는 New/NewWithAssets 의 공통 생성자다. 갱신 확인 URL 과
// HTTP 클라이언트 타임아웃 같은 기본값은 여기 한 곳에서만 정한다.
func newServer(p Paths, assets fs.FS, version string) *Server {
	return &Server{
		paths: p, assets: assets, version: version,
		scheduleURL: defaultScheduleURL, releaseURL: defaultReleaseURL,
		client: &http.Client{Timeout: 5 * time.Second},
	}
}

// writeJSON 은 v 를 UTF-8 JSON 본문으로 쓴다. 인코딩 실패는 이미 헤더를
// 내보낸 뒤라 상태 코드를 바꿀 수 없으므로 무시한다.
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
	mux.HandleFunc("/schedule.json", s.scheduleHandler(game.Default()))
	for _, g := range game.All() {
		if g.ID == game.Default().ID {
			continue
		}
		gg := g
		mux.HandleFunc("/"+gg.ID+"/schedule.json", s.scheduleHandler(gg))
	}
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

// gameOf 는 ?game= 쿼리로 게임을 고른다. 미지정이면 hsr 로 폴백해 기존
// 클라이언트 동작을 보존하고, 알 수 없는 값은 ok=false 로 400 을 유도한다.
func (s *Server) gameOf(r *http.Request) (game.Game, bool) {
	id := r.URL.Query().Get("game")
	if id == "" {
		return game.Default(), true
	}
	return game.ByID(id)
}

// dataDirFor 는 게임의 저장 디렉터리다.
func (s *Server) dataDirFor(g game.Game) string {
	return filepath.Join(s.paths.DataDir, g.ID)
}

// handleData 는 GET /api/data — 해당 게임의 저장된 전체 기록을 SRGF 로 반환한다.
// 기록이 없으면 null 이 아니라 빈 리스트를 준다(대시보드가 순회하므로).
func (s *Server) handleData(w http.ResponseWriter, r *http.Request) {
	g, ok := s.gameOf(r)
	if !ok {
		http.Error(w, "알 수 없는 게임입니다", http.StatusBadRequest)
		return
	}
	recs, info, err := store.LoadAll(s.dataDirFor(g))
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

// handleConfig 는 /api/config — POST 면 설정을 저장하고 {"ok":true}, 그 외에는
// 현재 설정을 반환한다. 설정 파일이 없으면 LoadConfig 가 기본값을 준다.
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

// handleDetect 는 GET /api/detect — 게임 설치 경로 자동 탐지 결과를 반환한다.
// 찾지 못하면 path 는 빈 문자열이다(에러가 아니다).
func (s *Server) handleDetect(w http.ResponseWriter, r *http.Request) {
	g, ok := s.gameOf(r)
	if !ok {
		http.Error(w, "알 수 없는 게임입니다", http.StatusBadRequest)
		return
	}
	writeJSON(w, map[string]string{"path": detectGamePath(g)})
}

// handleFetch 는 증분 조회를 SSE 로 스트리밍한다.
// 이벤트: progress {banner,added} / error {message} / done {summary,data}.
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
	fail := func(msg string) {
		slog.Error("조회 실패", "err", msg)
		send("error", map[string]string{"message": msg})
	}

	g, ok := s.gameOf(r)
	if !ok {
		fail("알 수 없는 게임입니다")
		return
	}

	gamePath := r.URL.Query().Get("path")
	if gamePath == "" {
		fail("게임 경로가 비어 있습니다.")
		return
	}
	if !s.fetching.CompareAndSwap(false, true) {
		fail("이미 수집이 진행 중입니다. 완료 후 다시 시도하세요.")
		return
	}
	defer s.fetching.Store(false)
	slog.Info("조회 시작", "path", gamePath, "game", g.ID)

	// 캐시에는 여러 세션의 authkey 가 쌓여 있고 순서 추정이 어긋날 수 있어,
	// 후보를 모아 살아있는 것을 골라 쓴다(ZZZ 는 URL 의 timestamp 가 재사용된다).
	cands, err := collector.FindAuthContexts(gamePath, g)
	if err != nil {
		fail(err.Error())
		return
	}
	ac, err := collector.SelectValidAuthContext(r.Context(), cands, g)
	if err != nil {
		fail(err.Error())
		return
	}
	if ac.IssuedAt.IsZero() {
		slog.Warn("authkey 기록 시각 알 수 없음", "reason", "캐시 엔트리·timestamp 모두 없음")
	} else {
		slog.Info("authkey 채택",
			"issued", ac.IssuedAt.Format("2006-01-02 15:04"),
			"hours_ago", int(time.Since(ac.IssuedAt).Hours()),
			"candidates", len(cands))
	}
	// config 에 경로 저장(다음 실행 자동 채움). 게임별로 병합해 다른 게임 경로를 지우지 않는다.
	cfg := LoadConfig(s.paths.ConfigFile)
	cfg.SetPath(g.ID, gamePath)
	_ = SaveConfig(s.paths.ConfigFile, cfg)

	dataDir := s.dataDirFor(g)
	existing, prevInfo, err := store.LoadAll(dataDir)
	if err != nil {
		fail(err.Error())
		return
	}
	lastID := store.MaxIDByBanner(existing, g)

	newRecs, uid, err := collector.FetchIncremental(r.Context(), ac, g, lastID, 400*time.Millisecond,
		func(banner string, added int) {
			send("progress", map[string]any{"banner": banner, "added": added})
		})
	if err != nil {
		if errors.Is(err, context.Canceled) || r.Context().Err() != nil {
			slog.Info("클라이언트 연결 종료로 수집 중단")
			return
		}
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
		ExportApp:       "DIY-HSR-Warp", ExportAppVersion: "0.1.0",
	}
	if g.InfoFormat == "uigf-v4.0" {
		info.UIGFVersion = "v4.0"
	} else {
		info.SRGFVersion = "v1.0"
	}

	if err := r.Context().Err(); err != nil {
		slog.Info("클라이언트 연결 종료로 저장 생략")
		return
	}
	updatedMonths, err := store.WriteAffectedMonths(dataDir, info, newRecs)
	if err != nil {
		fail(err.Error())
		return
	}

	// 갱신 후 전체 합본 재구성.
	all, finalInfo, err := store.LoadAll(dataDir)
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

// scheduleHandler 는 게임의 스케줄을 서빙한다. 내장본과 data 디렉터리의
// override 중 버전이 높은 쪽이 나간다.
func (s *Server) scheduleHandler(g game.Game) http.HandlerFunc {
	name := "schedule.json"
	if g.ID != game.Default().ID {
		name = g.ID + "/schedule.json"
	}
	return func(w http.ResponseWriter, r *http.Request) {
		var emb []byte
		if s.assets != nil {
			emb, _ = fs.ReadFile(s.assets, name)
		}
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_, _ = w.Write(updater.EffectiveSchedule(s.paths.DataDir, emb, g.ID))
	}
}

// handleUpdates 는 첫 호출 시 두 업데이트 체크를 베스트에포트로 수행하고 프로세스 수명 동안 캐시한다.
// 대시보드가 시작 직후 1회 호출 → "시작 시 자동 확인". 실패는 예상된 동작이라 Warn 으로만 남긴다.
func (s *Server) handleUpdates(w http.ResponseWriter, r *http.Request) {
	s.once.Do(func() {
		var emb []byte
		if s.assets != nil {
			emb, _ = fs.ReadFile(s.assets, "schedule.json")
		}
		sch, err := updater.CheckSchedule(s.client, s.scheduleURL, s.paths.DataDir, emb, game.Default().ID)
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
