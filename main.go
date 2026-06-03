package main

import (
	"embed"
	"fmt"
	"io/fs"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"

	"hsr-warp/internal/server"
)

// 아이콘 리소스(resource_windows_amd64.syso)는 아래 generate 로 만든다(icon.ico 변경 시 재실행):
//
//go:generate go run ./tools/genicon
//go:generate goversioninfo -64 -o resource_windows_amd64.syso

//go:embed web/dashboard.html web/analyze.js web/favicon.ico
var webFiles embed.FS

// version 은 릴리스 빌드 시 goreleaser 가 ldflags(-X main.version)로 주입한다.
// 직접 빌드 시에는 기본값 "dev" 가 쓰인다. (.goreleaser.yaml 참고)
var version = "dev"

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
	paths := server.Paths{
		DataDir:    filepath.Join(base, "data"),
		ConfigFile: filepath.Join(base, "config.json"),
	}
	assets, err := fs.Sub(webFiles, "web")
	if err != nil {
		fmt.Println("자산 로드 실패:", err)
		os.Exit(1)
	}
	srv := server.NewWithAssets(paths, assets)

	ln, port, err := freeListener(8787)
	if err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
	url := fmt.Sprintf("http://127.0.0.1:%d/dashboard.html", port)
	fmt.Printf("HSR 워프 대시보드 %s: %s\n(종료하려면 이 창에서 Ctrl+C)\n", version, url)
	openBrowser(url)
	if err := http.Serve(ln, srv.Handler()); err != nil {
		fmt.Println("서버 종료:", err)
	}
}
