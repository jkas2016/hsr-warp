package server

import (
	"encoding/json"
	"os"
	"path/filepath"
)

// Config 는 사용자별 영속 설정이다(사용자 머신 로컬 파일에만 기록).
type Config struct {
	GamePath string `json:"game_path"`
}

// LoadConfig 는 config 파일을 읽는다. 없거나 깨졌으면 zero 값 Config 반환.
func LoadConfig(path string) Config {
	var c Config
	b, err := os.ReadFile(path)
	if err != nil {
		return c
	}
	_ = json.Unmarshal(b, &c)
	return c
}

// SaveConfig 는 config 를 원자적으로 저장한다.
func SaveConfig(path string, c Config) error {
	b, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return err
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, b, 0644); err != nil {
		return err
	}
	return os.Rename(tmp, path)
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
