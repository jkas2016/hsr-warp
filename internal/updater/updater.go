// Package updater 는 시작 시 두 업데이트를 베스트에포트로 확인한다:
// (1) 배너 데이터(schedule.json) — main raw 파일에서 받아 신규면 data/ 에 기록(인앱 갱신).
// (2) 코드 버전 — GitHub releases/latest 와 main.version 을 semver 비교(설치본 재설치 안내).
// 외부 통신은 전부 이 패키지에서만 일어난다. 실패는 예상된 동작이라 호출부에서 Warn 으로 남긴다.
package updater

import (
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
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
	// Banners/Order 는 신 스키마(배너 코드 테이블)에서만 온다. 구 스키마(HSR 구버전)엔
	// 아예 없으므로 nil 이 정상 — 그땐 아래 일치 검증을 건너뛴다.
	Banners map[string]json.RawMessage `json:"banners"`
	Order   []string                   `json:"order"`
}

// ScheduleVersion 은 schedule.json 바이트를 검증하고 version 을 돌려준다.
// 구조가 깨졌거나 version<1 이거나 항목이 없거나 s/e 가 YYYY-MM-DD 로 파싱 불가면 ok=false.
// banners/order 블록이 있으면(신 스키마) order 의 모든 코드가 banners 에 존재해야 한다 —
// 어긋나면 web/analyze.js 의 codesByRole 이 해당 채널을 통째로 못 찾아 대시보드가 깨진다.
// banners/order 가 아예 없는 구 스키마는 이 검증을 건너뛰고 그대로 유효하다.
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
	for _, code := range f.Order {
		if _, ok := f.Banners[code]; !ok {
			return 0, false
		}
	}
	return f.Version, true
}

// CompareVersions 는 semver 두 개를 비교한다(-1/0/1). 앞의 'v' 무시, X.Y.Z 정수 비교, 빠진 자리는 0,
// '-'/'+' 이후(프리릴리스·빌드메타)는 무시. 외부 의존성 없이 처리한다.
func CompareVersions(a, b string) int {
	pa, pb := parseVer(a), parseVer(b)
	for i := 0; i < 3; i++ {
		if pa[i] < pb[i] {
			return -1
		}
		if pa[i] > pb[i] {
			return 1
		}
	}
	return 0
}

// parseVer 는 "v1.2.3-beta" 형태를 [3]int{1,2,3} 으로 파싱한다. 'v' 접두와
// '-'/'+' 이후(프리릴리스·빌드 메타데이터)는 제거한다. 정책: 비숫자 세그먼트는
// 0 으로 관대하게 처리한다(GitHub 릴리스 태그는 정상 semver 라 실무 영향 없음).
// 파싱 실패는 진단을 위해 Debug 로 남긴다.
func parseVer(s string) [3]int {
	s = strings.TrimPrefix(strings.TrimSpace(s), "v")
	if i := strings.IndexAny(s, "-+"); i >= 0 {
		s = s[:i]
	}
	var out [3]int
	for i, part := range strings.SplitN(s, ".", 3) {
		n, err := strconv.Atoi(part)
		if err != nil {
			slog.Debug("버전 세그먼트 파싱 실패, 0으로 처리", "version", s, "segment", part)
		}
		out[i] = n
	}
	return out
}

// CodeStatus 는 코드 채널 결과다.
type CodeStatus struct {
	Newer   bool   `json:"newer"`
	Version string `json:"version"`
	URL     string `json:"url"`
}

type release struct {
	TagName string `json:"tag_name"`
	HTMLURL string `json:"html_url"`
	Assets  []struct {
		Name string `json:"name"`
		URL  string `json:"browser_download_url"`
	} `json:"assets"`
}

// CheckRelease 는 releases/latest(프리릴리스·드래프트 제외) 와 current 를 semver 비교한다.
// current 가 "" 또는 "dev" 면 외부 호출 없이 스킵. setup 자산이 있으면 그 URL, 없으면 릴리스 페이지.
func CheckRelease(client *http.Client, apiURL, current string) (CodeStatus, error) {
	if current == "" || current == "dev" {
		return CodeStatus{}, nil
	}
	b, err := fetch(client, apiURL)
	if err != nil {
		return CodeStatus{}, err
	}
	var rel release
	if err := json.Unmarshal(b, &rel); err != nil {
		return CodeStatus{}, err
	}
	if rel.TagName == "" || CompareVersions(rel.TagName, current) <= 0 {
		return CodeStatus{}, nil
	}
	url := rel.HTMLURL
	for _, a := range rel.Assets {
		n := strings.ToLower(a.Name)
		if strings.Contains(n, "setup") && strings.HasSuffix(n, ".exe") {
			url = a.URL
			break
		}
	}
	if !strings.HasPrefix(url, "https://") {
		// 다운로드 URL 이 없거나 https 가 아니면 알림 보류(href 에 javascript: 등 주입 방지).
		return CodeStatus{}, nil
	}
	return CodeStatus{Newer: true, Version: strings.TrimPrefix(rel.TagName, "v"), URL: url}, nil
}

// ScheduleStatus 는 데이터 채널 결과다.
type ScheduleStatus struct {
	Updated bool `json:"updated"`
	Version int  `json:"version"`
}

// scheduleFileName 은 게임의 override 파일명을 반환한다. HSR 은 구버전 exe 가
// 계속 쓰는 schedule.json 을 그대로 유지한다.
func scheduleFileName(gameID string) string {
	if gameID == "hsr" {
		return "schedule.json"
	}
	return gameID + "-schedule.json"
}

// CheckSchedule 은 rawURL 에서 schedule.json 을 받아 검증하고, 현재 유효 version 보다 높으면
// data/ 의 게임별 override 파일에 원자적으로 기록한다(인앱 갱신). 깨진 응답·동일/구버전은 무시(에러 아님).
func CheckSchedule(client *http.Client, rawURL, dataDir string, embedded []byte, gameID string) (ScheduleStatus, error) {
	cur, _ := ScheduleVersion(EffectiveSchedule(dataDir, embedded, gameID))
	b, err := fetch(client, rawURL)
	if err != nil {
		return ScheduleStatus{Version: cur}, err
	}
	v, ok := ScheduleVersion(b)
	if !ok || v <= cur {
		return ScheduleStatus{Version: cur}, nil
	}
	if err := writeAtomic(filepath.Join(dataDir, scheduleFileName(gameID)), b); err != nil {
		return ScheduleStatus{Version: cur}, err
	}
	return ScheduleStatus{Updated: true, Version: v}, nil
}

func writeAtomic(path string, b []byte) error {
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
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

func fetch(client *http.Client, url string) ([]byte, error) {
	resp, err := client.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status %d", resp.StatusCode)
	}
	return io.ReadAll(io.LimitReader(resp.Body, 1<<20)) // 1MB 상한
}

// Updates 는 /api/updates 응답 본문이다.
type Updates struct {
	Schedule ScheduleStatus `json:"schedule"`
	Code     CodeStatus     `json:"code"`
}

// EffectiveSchedule 는 서빙할 schedule.json 바이트를 고른다:
// data/ 의 게임별 override 가 유효하고 version 이 내장본보다 크면 그걸, 아니면 내장본.
// 내장본이 깨졌더라도 내장본을 그대로 돌려준다(베스트에포트 — 빌드 시 내장본 무결성은 호출부 책임).
func EffectiveSchedule(dataDir string, embedded []byte, gameID string) []byte {
	b, err := os.ReadFile(filepath.Join(dataDir, scheduleFileName(gameID)))
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
