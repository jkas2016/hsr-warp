package server

import (
	"encoding/json"
	"log/slog"
	"os"
	"path/filepath"
)

// Config 는 사용자별 영속 설정이다(사용자 머신 로컬 파일에만 기록).
type Config struct {
	GamePath string `json:"game_path"`
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

// defaultCandidates 는 흔한 HoYoPlay 설치 경로 후보다.
func defaultCandidates() []string {
	return []string{
		`D:\Game\HoYoPlay\games\Star Rail Games`,
		`C:\Program Files\HoYoPlay\games\Star Rail Games`,
		`D:\Program Files\HoYoPlay\games\Star Rail Games`,
		`C:\Games\HoYoPlay\games\Star Rail Games`,
		`C:\Program Files\Star Rail\Games`,
	}
}

// detectGamePath 는 webCaches 가 존재하는 첫 후보 경로를 반환한다(없으면 "").
func detectGamePath(candidates []string) string {
	for _, c := range candidates {
		if _, err := os.Stat(filepath.Join(c, "StarRail_Data", "webCaches")); err == nil {
			return c
		}
	}
	return ""
}
