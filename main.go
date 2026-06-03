package main

import (
	"embed"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"time"

	"hsr-warp/internal/server"
)

// 아이콘 리소스(resource_windows_amd64.syso)는 아래 generate 로 만든다(icon.ico 변경 시 재실행):
//
//go:generate go run ./tools/genicon
//go:generate goversioninfo -64 -o resource_windows_amd64.syso

//go:embed web/dashboard.html web/analyze.js web/favicon.ico web/favicon.svg
var webFiles embed.FS

// version 은 릴리스 빌드 시 goreleaser 가 ldflags(-X main.version)로 주입한다.
// 직접 빌드 시에는 기본값 "dev" 가 쓰인다. (.goreleaser.yaml 참고)
var version = "dev"

// logPath 는 logs/ 아래 날짜별 로그 파일 경로를 만든다(하루 한 파일).
func logPath(base string, t time.Time) string {
	return filepath.Join(base, "logs", "hsr-warp-"+t.Format("2006-01-02")+".log")
}

// setupLogging 은 표준 log 출력을 콘솔과 날짜별 파일에 동시에 보낸다.
// 파일을 못 열면 콘솔만 쓰고 계속 진행한다(로깅 실패로 앱이 죽지 않게).
func setupLogging(base string) {
	log.SetFlags(log.LstdFlags)
	p := logPath(base, time.Now())
	if err := os.MkdirAll(filepath.Dir(p), 0755); err != nil {
		log.Printf("로그 폴더 생성 실패(콘솔만 기록): %v", err)
		return
	}
	f, err := os.OpenFile(p, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		log.Printf("로그 파일 열기 실패(콘솔만 기록): %v", err)
		return
	}
	log.SetOutput(io.MultiWriter(os.Stdout, f))
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

func openBrowser(url string) {
	// Windows: rundll32 로 기본 브라우저 오픈(따옴표 이슈 없음).
	_ = exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()
}

func main() {
	base := baseDir()
	setupLogging(base)
	paths := server.Paths{
		DataDir:    filepath.Join(base, "data"),
		ConfigFile: filepath.Join(base, "config.json"),
	}
	assets, err := fs.Sub(webFiles, "web")
	if err != nil {
		log.Fatalln("자산 로드 실패:", err)
	}
	srv := server.NewWithAssets(paths, assets)

	ln, port, err := freeListener(8787)
	if err != nil {
		log.Fatalln(err)
	}
	url := fmt.Sprintf("http://127.0.0.1:%d/dashboard.html", port)
	log.Printf("HSR 워프 대시보드 %s 시작: %s", version, url)
	fmt.Printf("HSR 워프 대시보드 %s: %s\n(종료하려면 이 창에서 Ctrl+C)\n", version, url)
	openBrowser(url)
	if err := http.Serve(ln, srv.Handler()); err != nil {
		log.Println("서버 종료:", err)
	}
}
