package server

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"hsr-warp/internal/game"
)

func TestConfigRoundTrip(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "config.json")
	if got := LoadConfig(path).PathFor("hsr"); got != "" {
		t.Fatalf("expected empty path on missing file, got %q", got)
	}
	var c Config
	c.SetPath("hsr", `D:\Game\Star Rail Games`)
	if err := SaveConfig(path, c); err != nil {
		t.Fatal(err)
	}
	if got := LoadConfig(path).PathFor("hsr"); got != `D:\Game\Star Rail Games` {
		t.Fatalf("round-trip mismatch: %q", got)
	}
}

func TestDetectGamePath_PicksExisting(t *testing.T) {
	dir := t.TempDir()
	good := filepath.Join(dir, "good", "StarRail_Data", "webCaches")
	mustMkdir(t, good)
	hsr, _ := game.ByID("hsr")
	hsr.Candidates = []string{filepath.Join(dir, "nope"), filepath.Join(dir, "good")}
	if got := detectGamePath(hsr); got != filepath.Join(dir, "good") {
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
	hsr, _ := game.ByID("hsr")
	hsr.Candidates = []string{filepath.Join(t.TempDir(), "nope")}
	if got := detectGamePath(hsr); got != "" {
		t.Fatalf("존재하지 않는 후보는 \"\" 여야 함, got %q", got)
	}
}

// 구 스키마({"game_path": "..."})는 games.hsr.game_path 로 승격돼야 한다.
// 승격에 실패하면 기존 사용자가 게임 경로를 다시 지정해야 한다.
func TestLoadConfig_PromotesLegacySchema(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "config.json")
	if err := os.WriteFile(p, []byte(`{"game_path":"D:\\Game\\Star Rail Games"}`), 0644); err != nil {
		t.Fatal(err)
	}
	c := LoadConfig(p)
	if got := c.PathFor("hsr"); got != `D:\Game\Star Rail Games` {
		t.Errorf("PathFor(hsr) = %q, want D:\\Game\\Star Rail Games", got)
	}
	if c.PathFor("zzz") != "" {
		t.Errorf("zzz 경로가 생겼다: %q", c.PathFor("zzz"))
	}
	// 승격 후 구 필드는 비워져 다음 저장 때 새 스키마로만 기록된다.
	if c.GamePath != "" {
		t.Errorf("승격 후 구 필드가 남았다: %q", c.GamePath)
	}
}

// 신 스키마는 그대로 읽힌다.
func TestLoadConfig_ReadsNewSchema(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "config.json")
	body := `{"games":{"hsr":{"game_path":"A"},"zzz":{"game_path":"B"}},"active_game":"zzz"}`
	if err := os.WriteFile(p, []byte(body), 0644); err != nil {
		t.Fatal(err)
	}
	c := LoadConfig(p)
	if c.PathFor("hsr") != "A" || c.PathFor("zzz") != "B" {
		t.Errorf("경로가 잘못 읽혔다: hsr=%q zzz=%q", c.PathFor("hsr"), c.PathFor("zzz"))
	}
	if c.ActiveGame != "zzz" {
		t.Errorf("ActiveGame = %q, want zzz", c.ActiveGame)
	}
}

// 저장→로드 왕복에서 게임별 경로가 보존돼야 한다.
func TestSaveConfig_RoundTripsGames(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "config.json")
	var c Config
	c.SetPath("hsr", "A")
	c.SetPath("zzz", "B")
	c.ActiveGame = "zzz"
	if err := SaveConfig(p, c); err != nil {
		t.Fatal(err)
	}
	got := LoadConfig(p)
	if got.PathFor("hsr") != "A" || got.PathFor("zzz") != "B" || got.ActiveGame != "zzz" {
		t.Errorf("왕복 실패: %+v", got)
	}
	// 새 스키마로 기록됐는지 — 구 필드가 파일에 남으면 다음 로드에서 승격이 또 돈다.
	raw, err := os.ReadFile(p)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(raw), `"game_path"`) && !strings.Contains(string(raw), `"games"`) {
		t.Errorf("구 스키마로 기록됐다: %s", raw)
	}
}

// SetPath 는 nil 맵에서도 동작해야 한다(zero value Config).
func TestSetPath_InitializesMap(t *testing.T) {
	var c Config
	c.SetPath("hsr", "X")
	if c.PathFor("hsr") != "X" {
		t.Errorf("PathFor(hsr) = %q, want X", c.PathFor("hsr"))
	}
}

// 자동탐지는 게임의 캐시 루트 디렉터리가 실제로 있는 후보만 고른다.
func TestDetectGamePath_MatchesGameDataDir(t *testing.T) {
	root := t.TempDir()
	mustMkdir(t, filepath.Join(root, "ZenlessZoneZero_Data", "webCaches"))

	zzz, _ := game.ByID("zzz")
	zzz.Candidates = []string{filepath.Join(root, "nope"), root}
	if got := detectGamePath(zzz); got != root {
		t.Errorf("detectGamePath = %q, want %q", got, root)
	}

	// HSR 로 보면 StarRail_Data 가 없으므로 빈 문자열이다.
	hsr, _ := game.ByID("hsr")
	hsr.Candidates = []string{root}
	if got := detectGamePath(hsr); got != "" {
		t.Errorf("HSR 탐지 = %q, want 빈 문자열", got)
	}
}
