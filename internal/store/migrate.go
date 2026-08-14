package store

import (
	"log/slog"
	"os"
	"path/filepath"
)

// MigrateLegacyLayout 은 구버전 레이아웃(data/warp_*.json)을 게임별
// 디렉터리(data/hsr/)로 옮긴다. 멱등하며, 이미 옮겨진 상태나 새 설치에서는
// 아무 일도 하지 않는다. 대상 이름이 이미 있으면 덮어쓰지 않고 건너뛴다 —
// 신규 레이아웃 쪽이 최신이기 때문이다.
func MigrateLegacyLayout(dataDir string) (int, error) {
	old, err := filepath.Glob(filepath.Join(dataDir, "warp_*.json"))
	if err != nil {
		return 0, err
	}
	if len(old) == 0 {
		return 0, nil
	}
	dst := filepath.Join(dataDir, "hsr")
	if err := os.MkdirAll(dst, 0755); err != nil {
		return 0, err
	}
	moved := 0
	for _, src := range old {
		target := filepath.Join(dst, filepath.Base(src))
		if _, err := os.Stat(target); err == nil {
			slog.Warn("마이그레이션 건너뜀 — 대상이 이미 있다", "src", src, "dst", target)
			continue
		}
		if err := os.Rename(src, target); err != nil {
			return moved, err
		}
		moved++
	}
	if moved > 0 {
		slog.Info("구버전 데이터 레이아웃 마이그레이션", "moved", moved, "dst", dst)
	}
	return moved, nil
}
