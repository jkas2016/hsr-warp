package main

import (
	"strings"
	"testing"
	"time"
)

// 로그 파일은 logs/ 아래에 날짜별로 분리되어야 한다(하루 한 파일).
func TestLogPath(t *testing.T) {
	got := logPath(`C:\app`, time.Date(2026, 6, 3, 19, 0, 0, 0, time.Local))
	if !strings.HasSuffix(got, "hsr-warp-2026-06-03.log") {
		t.Fatalf("expected dated log filename, got %s", got)
	}
	if !strings.Contains(got, "logs") {
		t.Fatalf("log must live under logs/, got %s", got)
	}
}
