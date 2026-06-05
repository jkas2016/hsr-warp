// Package updater 는 시작 시 두 업데이트를 베스트에포트로 확인한다:
// (1) 배너 데이터(schedule.json) — main raw 파일에서 받아 신규면 data/ 에 기록(인앱 갱신).
// (2) 코드 버전 — GitHub releases/latest 와 main.version 을 semver 비교(설치본 재설치 안내).
// 외부 통신은 전부 이 패키지에서만 일어난다. 실패는 예상된 동작이라 호출부에서 Warn 으로 남긴다.
package updater

import (
	"encoding/json"
	"os"
	"path/filepath"
	"time"
)

type scheduleFile struct {
	Version  int `json:"version"`
	Schedule []struct {
		S string   `json:"s"`
		E string   `json:"e"`
		C []string `json:"c"`
		L []string `json:"l"`
	} `json:"schedule"`
}

// ScheduleVersion 은 schedule.json 바이트를 검증하고 version 을 돌려준다.
// 구조가 깨졌거나 version<1 이거나 항목이 없거나 s/e 가 YYYY-MM-DD 로 파싱 불가면 ok=false.
func ScheduleVersion(b []byte) (int, bool) {
	var f scheduleFile
	if err := json.Unmarshal(b, &f); err != nil {
		return 0, false
	}
	if f.Version < 1 || len(f.Schedule) == 0 {
		return 0, false
	}
	for _, e := range f.Schedule {
		if _, err := time.Parse("2006-01-02", e.S); err != nil {
			return 0, false
		}
		if _, err := time.Parse("2006-01-02", e.E); err != nil {
			return 0, false
		}
	}
	return f.Version, true
}

// EffectiveSchedule 는 서빙할 schedule.json 바이트를 고른다:
// data/schedule.json 이 유효하고 version 이 내장본보다 크면 그걸, 아니면 내장본.
// 내장본이 깨졌더라도 내장본을 그대로 돌려준다(베스트에포트 — 빌드 시 내장본 무결성은 호출부 책임).
func EffectiveSchedule(dataDir string, embedded []byte) []byte {
	b, err := os.ReadFile(filepath.Join(dataDir, "schedule.json"))
	if err != nil {
		return embedded
	}
	rv, rok := ScheduleVersion(b)
	ev, _ := ScheduleVersion(embedded)
	if rok && rv > ev {
		return b
	}
	return embedded
}
