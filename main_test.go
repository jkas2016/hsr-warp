package main

import (
	"bytes"
	"log/slog"
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

// 레벨 문자열은 대소문자 무시하고 매핑되며, 빈 값·미지정 값은 INFO 로 떨어진다.
func TestParseLevel(t *testing.T) {
	cases := map[string]slog.Level{
		"debug": slog.LevelDebug,
		"info":  slog.LevelInfo,
		"warn":  slog.LevelWarn,
		"error": slog.LevelError,
		"WARN":  slog.LevelWarn,
		"":      slog.LevelInfo,
		"xyz":   slog.LevelInfo,
	}
	for in, want := range cases {
		if got := parseLevel(in); got != want {
			t.Errorf("parseLevel(%q) = %v, want %v", in, got, want)
		}
	}
}

// 레벨은 런타임 환경변수(우선) → 빌드 시 박힌 기본값 → info 순으로 정해진다.
func TestResolveLevel_EnvOverridesBaked(t *testing.T) {
	if got := resolveLevel("debug", "info"); got != slog.LevelDebug {
		t.Fatalf("env 가 빌드 기본값을 덮어써야 한다: %v", got)
	}
	if got := resolveLevel("", "debug"); got != slog.LevelDebug {
		t.Fatalf("env 비면 빌드 시 박힌 기본값을 써야 한다: %v", got)
	}
	if got := resolveLevel("", ""); got != slog.LevelInfo {
		t.Fatalf("둘 다 비면 info: %v", got)
	}
}

// ERROR 로그는 항상 무조건 스택트레이스를 포함해야 한다(핵심 요구).
func TestNewLogger_ErrorIncludesStack(t *testing.T) {
	var buf bytes.Buffer
	newLogger(&buf, slog.LevelInfo).Error("조회 실패", "err", "API 오류")
	out := buf.String()
	if !strings.Contains(out, `"level":"ERROR"`) {
		t.Fatalf("ERROR 레벨이 찍혀야 한다: %s", out)
	}
	if !strings.Contains(out, `"stack"`) {
		t.Fatalf("ERROR 로그엔 스택트레이스가 무조건 포함돼야 한다: %s", out)
	}
	if !strings.Contains(out, "TestNewLogger_ErrorIncludesStack") {
		t.Fatalf("스택은 호출 경로를 담아야 한다: %s", out)
	}
}

// INFO 이하 로그엔 스택을 붙이지 않는다(노이즈 방지).
func TestNewLogger_InfoHasNoStack(t *testing.T) {
	var buf bytes.Buffer
	newLogger(&buf, slog.LevelInfo).Info("조회 시작", "path", "D:/x")
	out := buf.String()
	if !strings.Contains(out, `"level":"INFO"`) {
		t.Fatalf("INFO 레벨이 찍혀야 한다: %s", out)
	}
	if strings.Contains(out, "stack") {
		t.Fatalf("INFO 로그엔 스택이 없어야 한다: %s", out)
	}
}

// 핸들러 레벨보다 낮은 로그는 출력되지 않아야 한다(HSRWARP_LOG 제어).
func TestNewLogger_LevelFiltering(t *testing.T) {
	var buf bytes.Buffer
	newLogger(&buf, slog.LevelInfo).Debug("verbose")
	if buf.Len() != 0 {
		t.Fatalf("INFO 레벨에선 DEBUG 가 필터돼야 한다: %s", buf.String())
	}
}
