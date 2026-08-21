package server

import (
	"encoding/json"
	"log/slog"
	"os"
	"path/filepath"

	"hsr-warp/internal/game"
)

// GameConfig 는 게임 하나의 사용자 설정이다.
type GameConfig struct {
	GamePath string `json:"game_path"`
}

// Config 는 앱 설정이다. GamePath 는 구 스키마 호환용 잔재로, LoadConfig 가
// games.hsr 로 승격한 뒤 비운다 — 다음 저장부터 새 스키마로만 기록된다.
type Config struct {
	Games      map[string]GameConfig `json:"games,omitempty"`
	ActiveGame string                `json:"active_game,omitempty"`
	GamePath   string                `json:"game_path,omitempty"`
}

// PathFor 는 게임의 설치 경로를 반환한다(미설정이면 빈 문자열).
func (c Config) PathFor(gameID string) string {
	return c.Games[gameID].GamePath
}

// SetPath 는 게임의 설치 경로를 기록한다.
func (c *Config) SetPath(gameID, path string) {
	if c.Games == nil {
		c.Games = map[string]GameConfig{}
	}
	c.Games[gameID] = GameConfig{GamePath: path}
}

// LoadConfig 는 config 파일을 읽는다. 없으면 zero 값, 깨졌으면 경고 후 zero 값 반환.
func LoadConfig(path string) Config {
	var c Config
	b, err := os.ReadFile(path)
	if err != nil {
		return c
	}
	if err := json.Unmarshal(b, &c); err != nil {
		slog.Warn("config 파싱 실패, zero 값으로 대체", "path", path, "err", err)
		return Config{}
	}

	// 구 스키마 승격: {"game_path": "..."} → games.hsr.game_path.
	// 이미 games 가 있으면 신 스키마이므로 건드리지 않는다.
	if c.GamePath != "" && c.Games[game.Default().ID].GamePath == "" {
		c.SetPath(game.Default().ID, c.GamePath)
	}
	c.GamePath = ""

	return c
}

// SaveConfig 는 config 를 원자적으로 저장한다. rename 실패 시 임시 파일을 정리한다.
func SaveConfig(path string, c Config) error {
	b, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return err
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, b, 0644); err != nil {
		return err
	}
	if err := os.Rename(tmp, path); err != nil {
		os.Remove(tmp)
		return err
	}
	return nil
}

// detectGamePath 는 게임의 설치 경로 후보 중 캐시 루트가 실제로 있는 첫 번째를
// 반환한다. 없으면 빈 문자열.
func detectGamePath(g game.Game) string {
	for _, c := range g.Candidates {
		if _, err := os.Stat(filepath.Join(c, g.DataDirName, "webCaches")); err == nil {
			return c
		}
	}
	return ""
}
