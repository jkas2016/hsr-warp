package server

import (
	"os"
	"path/filepath"
	"testing"
)

func TestConfigRoundTrip(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "config.json")
	if got := LoadConfig(path).GamePath; got != "" {
		t.Fatalf("expected empty GamePath on missing file, got %q", got)
	}
	if err := SaveConfig(path, Config{GamePath: `D:\Game\Star Rail Games`}); err != nil {
		t.Fatal(err)
	}
	if got := LoadConfig(path).GamePath; got != `D:\Game\Star Rail Games` {
		t.Fatalf("round-trip mismatch: %q", got)
	}
}

func TestDetectGamePath_PicksExisting(t *testing.T) {
	dir := t.TempDir()
	good := filepath.Join(dir, "good", "StarRail_Data", "webCaches")
	mustMkdir(t, good)
	candidates := []string{filepath.Join(dir, "nope"), filepath.Join(dir, "good")}
	if got := detectGamePath(candidates); got != filepath.Join(dir, "good") {
		t.Fatalf("expected good path, got %q", got)
	}
}

func mustMkdir(t *testing.T, p string) {
	t.Helper()
	if err := os.MkdirAll(p, 0755); err != nil {
		t.Fatal(err)
	}
}

// SaveConfig 는 rename 실패 시 .tmp 를 남기지 않아야 한다.
func TestSaveConfig_CleansTempOnRenameFailure(t *testing.T) {
	dir := t.TempDir()
	// target 을 디렉터리로 만들어 rename 을 실패시킨다.
	target := filepath.Join(dir, "config.json")
	if err := os.Mkdir(target, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := SaveConfig(target, Config{GamePath: "X"}); err == nil {
		t.Fatal("target 이 디렉터리이므로 rename 실패를 기대")
	}
	if leftovers, _ := filepath.Glob(filepath.Join(dir, "*.tmp")); len(leftovers) != 0 {
		t.Fatalf("임시 파일이 정리되지 않음: %v", leftovers)
	}
}

// LoadConfig 는 깨진 JSON 이면 zero 값 Config 를 반환해야 한다(진단은 로그로).
func TestLoadConfig_BrokenJSONReturnsZero(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "config.json")
	if err := os.WriteFile(path, []byte("{not json"), 0o644); err != nil {
		t.Fatal(err)
	}
	if c := LoadConfig(path); c.GamePath != "" {
		t.Fatalf("깨진 JSON 은 zero 값이어야 함, got %+v", c)
	}
}

// detectGamePath 는 어떤 후보도 존재하지 않으면 "" 를 반환해야 한다.
func TestDetectGamePath_EmptyWhenNoneExist(t *testing.T) {
	if got := detectGamePath([]string{filepath.Join(t.TempDir(), "nope")}); got != "" {
		t.Fatalf("존재하지 않는 후보는 \"\" 여야 함, got %q", got)
	}
}
