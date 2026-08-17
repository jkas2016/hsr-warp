package main

import (
	"context"
	"embed"
	"fmt"
	"io"
	"io/fs"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"runtime/debug"
	"strings"
	"time"

	"hsr-warp/internal/server"
	"hsr-warp/internal/store"
)

// 아이콘 리소스(resource_windows_amd64.syso)는 아래 generate 로 만든다(icon.ico 변경 시 재실행):
//
//go:generate go run ./tools/genicon
//go:generate goversioninfo -64 -o resource_windows_amd64.syso

// all: 프리픽스로 web/ 전체를 임베드한다 — 대시보드 UI 킷이 언더스코어로 시작하는
// 파일(_ds_bundle.js)을 포함하기 때문(기본 embed 는 `_`/`.` 시작 파일을 제외한다).
//
//go:embed all:web
var webFiles embed.FS

// version 은 릴리스 빌드 시 goreleaser 가 ldflags(-X main.version)로 주입한다.
// 직접 빌드 시에는 기본값 "dev" 가 쓰인다. (.goreleaser.yaml 참고)
var version = "dev"

// logLevel 은 빌드 시 ldflags 로 주입하는 기본 로그 레벨이다(릴리스=info).
// 디버그 빌드는 -X main.logLevel=debug 로 박는다(npm run build:debug → hsr-warp-debug.exe).
// 런타임에 HSRWARP_LOG 가 설정되면 그쪽이 이 값을 덮어쓴다.
var logLevel = "info"

// logPath 는 logs/ 아래 날짜별 로그 파일 경로를 만든다(하루 한 파일).
func logPath(base string, t time.Time) string {
	return filepath.Join(base, "logs", "hsr-warp-"+t.Format("2006-01-02")+".log")
}

// parseLevel 은 레벨 문자열을 slog 레벨로 변환한다(대소문자 무시, 기본 info).
func parseLevel(s string) slog.Level {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "debug":
		return slog.LevelDebug
	case "warn", "warning":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}

// resolveLevel 은 런타임 환경변수(우선) → 빌드 시 박힌 기본값 순으로 레벨을 정한다.
func resolveLevel(env, baked string) slog.Level {
	if strings.TrimSpace(env) != "" {
		return parseLevel(env)
	}
	return parseLevel(baked)
}

// stackHandler 는 ERROR 이상 레코드에 전체 고루틴 스택트레이스를 자동 첨부한다.
// 코드 어디서 slog.Error 를 부르든 호출부에서 깜빡할 여지 없이 에러 로그엔 항상
// 스택이 남는다 — Go 엔 전역 예외 핸들러가 없으므로 이것이 로깅 계층의 전역 보장이다.
type stackHandler struct{ slog.Handler }

func (h stackHandler) Handle(ctx context.Context, r slog.Record) error {
	if r.Level >= slog.LevelError {
		r.AddAttrs(slog.String("stack", string(debug.Stack())))
	}
	return h.Handler.Handle(ctx, r)
}

// newLogger 는 JSON 핸들러(레벨·소스 위치 포함)를 stackHandler 로 감싼 로거를 만든다.
func newLogger(w io.Writer, level slog.Level) *slog.Logger {
	base := slog.NewJSONHandler(w, &slog.HandlerOptions{Level: level, AddSource: true})
	return slog.New(stackHandler{base})
}

// setupLogging 은 slog 기본 로거를 콘솔+날짜별 파일(JSON·레벨·소스·스택)로 설정한다.
// 레벨은 HSRWARP_LOG(런타임) > 빌드 시 박힌 logLevel > 기본 info 순.
// 파일을 못 열면 콘솔만 쓰고 계속 진행한다(로깅 실패로 앱이 죽지 않게).
func setupLogging(base string) {
	level := resolveLevel(os.Getenv("HSRWARP_LOG"), logLevel)
	var w io.Writer = os.Stdout
	p := logPath(base, time.Now())
	if err := os.MkdirAll(filepath.Dir(p), 0755); err != nil {
		slog.Warn("로그 폴더 생성 실패(콘솔만 기록)", "err", err)
	} else if f, err := os.OpenFile(p, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644); err != nil {
		slog.Warn("로그 파일 열기 실패(콘솔만 기록)", "err", err)
	} else {
		w = io.MultiWriter(os.Stdout, f)
	}
	slog.SetDefault(newLogger(w, level))
	slog.Debug("로깅 초기화", "effective_level", level.String(), "baked", logLevel)
}

// fatal 은 ERROR(스택 포함) 로그를 남기고 종료한다. slog 엔 Fatal 이 없어 직접 만든다.
func fatal(msg string, args ...any) {
	slog.Error(msg, args...)
	os.Exit(1)
}

func baseDir() string {
	exe, err := os.Executable()
	if err != nil {
		wd, _ := os.Getwd()
		return wd
	}
	return filepath.Dir(exe)
}

// freeListener 는 start 부터 빈 포트를 찾아 리스너를 연다.
func freeListener(start int) (net.Listener, int, error) {
	for p := start; p < start+50; p++ {
		ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", p))
		if err == nil {
			return ln, p, nil
		}
	}
	return nil, 0, fmt.Errorf("빈 포트를 찾지 못했습니다(%d~%d)", start, start+49)
}

// openBrowser 는 Windows 에서만 기본 브라우저로 URL 을 연다(rundll32, 따옴표 이슈 없음).
// 다른 OS 에선 무동작 — 사용자가 콘솔에 출력된 URL 을 직접 연다.
func openBrowser(url string) {
	if runtime.GOOS != "windows" {
		return
	}
	if err := exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start(); err != nil {
		slog.Debug("브라우저 자동 열기 실패", "err", err)
	}
}

func main() {
	base := baseDir()
	setupLogging(base)
	paths := server.Paths{
		DataDir:    filepath.Join(base, "data"),
		ConfigFile: filepath.Join(base, "config.json"),
	}
	// 구버전 레이아웃을 게임별 디렉터리로 옮긴다. 실패해도 앱은 계속 뜬다 —
	// 최악의 경우 기존 기록이 안 보일 뿐이고, 재수집으로 복구된다.
	if _, err := store.MigrateLegacyLayout(paths.DataDir); err != nil {
		slog.Error("데이터 마이그레이션 실패", "err", err)
	}
	assets, err := fs.Sub(webFiles, "web")
	if err != nil {
		fatal("자산 로드 실패", "err", err)
	}
	srv := server.NewWithAssets(paths, assets, version)

	ln, port, err := freeListener(8787)
	if err != nil {
		fatal("포트 열기 실패", "err", err)
	}
	url := fmt.Sprintf("http://127.0.0.1:%d/ui_kits/dashboard/", port)
	slog.Info("대시보드 시작", "version", version, "url", url)
	fmt.Printf("가챠 기록 대시보드 %s: %s\n(종료하려면 이 창에서 Ctrl+C)\n", version, url)
	openBrowser(url)
	// ReadHeaderTimeout: 로컬 slowloris 스톨 방지(헤더 읽기 단계만 제한 — SSE 장수명 응답엔 무영향).
	httpSrv := &http.Server{Handler: srv.Handler(), ReadHeaderTimeout: 10 * time.Second}
	if err := httpSrv.Serve(ln); err != nil {
		fatal("서버 종료", "err", err) // 감독자용 non-zero 종료(exit 0 로 조용히 빠지지 않도록)
	}
}
