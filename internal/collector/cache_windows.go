//go:build windows

package collector

import (
	"io"
	"os"
	"syscall"
)

// readShared 는 FILE_SHARE_DELETE 까지 포함해 열어 게임 실행 중에도 읽는다.
// os.ReadFile 은 FILE_SHARE_READ|WRITE 만 써서(stdlib syscall_windows.go),
// DELETE 권한으로 매핑된 webCache data_2 를 ERROR_SHARING_VIOLATION(32) 으로 못 읽는다.
func readShared(path string) ([]byte, error) {
	p, err := syscall.UTF16PtrFromString(path)
	if err != nil {
		return nil, err
	}
	h, err := syscall.CreateFile(p, syscall.GENERIC_READ,
		syscall.FILE_SHARE_READ|syscall.FILE_SHARE_WRITE|syscall.FILE_SHARE_DELETE,
		nil, syscall.OPEN_EXISTING, syscall.FILE_ATTRIBUTE_NORMAL, 0)
	if err != nil {
		return nil, err
	}
	f := os.NewFile(uintptr(h), path)
	defer f.Close()
	return io.ReadAll(f)
}
