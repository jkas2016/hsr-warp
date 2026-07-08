//go:build !windows

package collector

import (
	"os"
	"path/filepath"
	"testing"
)

// 비-Windows 에서 readShared 는 표준 파일 읽기로 폴백해 내용을 그대로 반환해야 한다.
func TestReadShared_FallsBackToOsReadFile(t *testing.T) {
	const want = "authkey-blob-내용"
	path := filepath.Join(t.TempDir(), "data_2")
	if err := os.WriteFile(path, []byte(want), 0o644); err != nil {
		t.Fatal(err)
	}
	got, err := readShared(path)
	if err != nil {
		t.Fatalf("readShared 실패: %v", err)
	}
	if string(got) != want {
		t.Fatalf("내용 불일치: got %q want %q", string(got), want)
	}
}
