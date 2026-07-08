//go:build !windows

package collector

import "os"

// readShared 는 비-Windows 에서 표준 파일 읽기로 폴백한다.
// FILE_SHARE_DELETE 공유 위반은 Windows 전용 문제라 다른 OS 에선 일반 읽기로 충분하다.
// (게임은 Windows 전용이므로 이 경로는 주로 크로스플랫폼 컴파일·개발기 테스트를 위한 것이다.)
func readShared(path string) ([]byte, error) {
	return os.ReadFile(path)
}
