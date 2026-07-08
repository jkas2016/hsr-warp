//go:build windows

package collector

import (
	"os"
	"path/filepath"
	"syscall"
	"testing"
)

// TestReadShared_SucceedsWhenOsReadFileBlocked 는 게임이 webCache data_2 를
// DELETE 권한으로 쥔 상황을 재현한다. 표준 os.ReadFile 은 FILE_SHARE_DELETE 가
// 없어 ERROR_SHARING_VIOLATION 으로 실패하고, readShared 는 성공해야 한다.
func TestReadShared_SucceedsWhenOsReadFileBlocked(t *testing.T) {
	const want = "authkey-blob-내용"
	path := filepath.Join(t.TempDir(), "data_2")
	if err := os.WriteFile(path, []byte(want), 0o644); err != nil {
		t.Fatal(err)
	}

	// 게임 흉내: DELETE 접근 + 풀 공유로 선점한 채 핸들 유지.
	p, err := syscall.UTF16PtrFromString(path)
	if err != nil {
		t.Fatal(err)
	}
	const deleteAccess = 0x00010000 // 표준 액세스 권리 DELETE (syscall 미노출)
	h, err := syscall.CreateFile(p, deleteAccess,
		syscall.FILE_SHARE_READ|syscall.FILE_SHARE_WRITE|syscall.FILE_SHARE_DELETE,
		nil, syscall.OPEN_EXISTING, syscall.FILE_ATTRIBUTE_NORMAL, 0)
	if err != nil {
		t.Fatalf("선점 open 실패: %v", err)
	}
	defer syscall.CloseHandle(h)

	// 기준선: 표준 os.ReadFile 은 공유 위반으로 실패해야 한다(이 fix 의 동기).
	if _, err := os.ReadFile(path); err == nil {
		t.Fatal("os.ReadFile 가 성공함 — 점유 시나리오가 재현되지 않음")
	}

	got, err := readShared(path)
	if err != nil {
		t.Fatalf("readShared 실패: %v", err)
	}
	if string(got) != want {
		t.Fatalf("내용 불일치: got %q want %q", string(got), want)
	}
}
