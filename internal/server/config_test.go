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
