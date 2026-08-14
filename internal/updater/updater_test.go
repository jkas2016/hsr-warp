package updater

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

const goodSchedule = `{"version":3,"schedule":[{"s":"2023-04-26","e":"2023-05-17","c":["1102"],"l":["23001"]}]}`

func TestScheduleVersion(t *testing.T) {
	if v, ok := ScheduleVersion([]byte(goodSchedule)); !ok || v != 3 {
		t.Fatalf("good: got (%d,%v), want (3,true)", v, ok)
	}
	bad := []string{
		`not json`,
		`{"version":0,"schedule":[]}`, // version<1
		`{"version":2,"schedule":[]}`, // 빈 배열
		`{"version":2,"schedule":[{"s":"nope","e":"2023-05-17"}]}`, // 날짜 파싱 불가
	}
	for _, b := range bad {
		if _, ok := ScheduleVersion([]byte(b)); ok {
			t.Fatalf("expected invalid: %s", b)
		}
	}
}

// order 가 banners 에 없는 코드를 참조하면 web/analyze.js 의 codesByRole 이 TypeError로
// 죽어 대시보드가 백지가 된다(F3). schedule.json 은 원격에서 받아 그대로 기록하는 파일이라
// 이 검증이 없으면 오배포가 그대로 사용자 앱까지 전파된다. banners/order 가 아예 없는
// 구 스키마(HSR 구버전 호환)는 이 검증을 건너뛰고 여전히 유효해야 한다.
func TestScheduleVersion_BannersOrderConsistency(t *testing.T) {
	mismatched := `{"version":3,"schedule":[{"s":"2023-04-26","e":"2023-05-17","c":["1102"],"l":["23001"]}],
		"banners":{"2":{"role":"limited-char"}},
		"order":["2","99"]}`
	if _, ok := ScheduleVersion([]byte(mismatched)); ok {
		t.Fatal("order 의 코드가 banners 에 없으면 무효여야 한다")
	}

	matched := `{"version":3,"schedule":[{"s":"2023-04-26","e":"2023-05-17","c":["1102"],"l":["23001"]}],
		"banners":{"2":{"role":"limited-char"},"3":{"role":"limited-weapon"}},
		"order":["2","3"]}`
	if v, ok := ScheduleVersion([]byte(matched)); !ok || v != 3 {
		t.Fatalf("일치하는 banners/order 는 유효해야 한다: got (%d,%v)", v, ok)
	}

	// 구 스키마(banners/order 없음) — goodSchedule 은 이미 위 TestScheduleVersion 에서
	// 통과를 확인했지만, 여기선 그 동작이 이 검증 추가로 깨지지 않았음을 재확인한다.
	if _, ok := ScheduleVersion([]byte(goodSchedule)); !ok {
		t.Fatal("banners/order 없는 구 스키마는 여전히 유효해야 한다")
	}
}

func TestEffectiveSchedule(t *testing.T) {
	embedded := []byte(`{"version":3,"schedule":[{"s":"2023-04-26","e":"2023-05-17","c":["1102"],"l":["23001"]}]}`)
	dir := t.TempDir()
	// data/ 없음 → 내장본.
	if got := EffectiveSchedule(dir, embedded, "hsr"); string(got) != string(embedded) {
		t.Fatal("missing data/ should fall back to embedded")
	}
	// data/ 가 더 높은 version → data/.
	higher := []byte(`{"version":5,"schedule":[{"s":"2023-04-26","e":"2023-05-17","c":["1102"],"l":["23001"]}]}`)
	if err := os.WriteFile(filepath.Join(dir, "schedule.json"), higher, 0644); err != nil {
		t.Fatal(err)
	}
	if got := EffectiveSchedule(dir, embedded, "hsr"); string(got) != string(higher) {
		t.Fatal("higher data/ should win")
	}
	// data/ 가 같거나 낮으면 내장본.
	lower := []byte(`{"version":3,"schedule":[{"s":"2023-04-26","e":"2023-05-17","c":["1102"],"l":["23001"]}]}`)
	_ = os.WriteFile(filepath.Join(dir, "schedule.json"), lower, 0644)
	if got := EffectiveSchedule(dir, embedded, "hsr"); string(got) != string(embedded) {
		t.Fatal("equal/lower data/ should fall back to embedded")
	}
	// data/ 가 깨졌으면 내장본.
	_ = os.WriteFile(filepath.Join(dir, "schedule.json"), []byte("corrupt"), 0644)
	if got := EffectiveSchedule(dir, embedded, "hsr"); string(got) != string(embedded) {
		t.Fatal("corrupt data/ should fall back to embedded")
	}
}

func releaseServer(t *testing.T, body string) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(body))
	}))
}

func TestCheckRelease(t *testing.T) {
	body := `{"tag_name":"v1.5.0","html_url":"https://example/releases/v1.5.0","assets":[{"name":"hsr-warp-setup-1.5.0.exe","browser_download_url":"https://example/setup.exe"},{"name":"hsr-warp_1.5.0_windows_amd64.zip","browser_download_url":"https://example/zip"}]}`
	srv := releaseServer(t, body)
	defer srv.Close()
	client := srv.Client()

	// 더 높은 버전 → newer, setup 자산 URL.
	got, err := CheckRelease(client, srv.URL, "1.4.0")
	if err != nil {
		t.Fatal(err)
	}
	if !got.Newer || got.Version != "1.5.0" || got.URL != "https://example/setup.exe" {
		t.Fatalf("got %+v", got)
	}

	// 같은 버전 → not newer.
	if got, _ := CheckRelease(client, srv.URL, "1.5.0"); got.Newer {
		t.Fatalf("equal should not be newer: %+v", got)
	}

	// dev → 스킵(외부 호출 없이 빈 결과).
	if got, _ := CheckRelease(client, srv.URL, "dev"); got.Newer {
		t.Fatalf("dev should skip: %+v", got)
	}
}

func TestCheckRelease_NoSetupAssetFallsBackToHTMLURL(t *testing.T) {
	body := `{"tag_name":"v2.0.0","html_url":"https://example/releases/v2.0.0","assets":[{"name":"hsr-warp_2.0.0_windows_amd64.zip","browser_download_url":"https://example/zip"}]}`
	srv := releaseServer(t, body)
	defer srv.Close()
	got, _ := CheckRelease(srv.Client(), srv.URL, "1.0.0")
	if !got.Newer || got.URL != "https://example/releases/v2.0.0" {
		t.Fatalf("expected html_url fallback, got %+v", got)
	}
}

func TestCheckRelease_NoUsableURLSuppressed(t *testing.T) {
	// 신버전이지만 html_url 도 setup 자산도 없음 → 깨진 링크 대신 알림 보류(Newer=false).
	body := `{"tag_name":"v2.0.0","assets":[]}`
	srv := releaseServer(t, body)
	defer srv.Close()
	if got, _ := CheckRelease(srv.Client(), srv.URL, "1.0.0"); got.Newer {
		t.Fatalf("no usable URL should suppress notification, got %+v", got)
	}
}

func TestCheckRelease_NonHTTPSURLSuppressed(t *testing.T) {
	// https 아닌 URL(예: javascript:)은 알림 보류 — href 주입 방지.
	body := `{"tag_name":"v2.0.0","html_url":"javascript:alert(1)","assets":[]}`
	srv := releaseServer(t, body)
	defer srv.Close()
	if got, _ := CheckRelease(srv.Client(), srv.URL, "1.0.0"); got.Newer {
		t.Fatalf("non-https URL should suppress notification, got %+v", got)
	}
}

func TestCheckSchedule(t *testing.T) {
	embedded := []byte(`{"version":3,"schedule":[{"s":"2023-04-26","e":"2023-05-17","c":["1102"],"l":["23001"]}]}`)
	remote := `{"version":7,"schedule":[{"s":"2023-04-26","e":"2023-05-17","c":["1102"],"l":["23001"]}]}`
	srv := releaseServer(t, remote)
	defer srv.Close()
	dir := t.TempDir()

	// 원격이 더 높음 → data/ 기록 + Updated.
	got, err := CheckSchedule(srv.Client(), srv.URL, dir, embedded, "hsr")
	if err != nil {
		t.Fatal(err)
	}
	if !got.Updated || got.Version != 7 {
		t.Fatalf("got %+v", got)
	}
	wrote, _ := os.ReadFile(filepath.Join(dir, "schedule.json"))
	if v, _ := ScheduleVersion(wrote); v != 7 {
		t.Fatalf("data/schedule.json version=%d, want 7", v)
	}

	// 다시 호출 → 같은 version 이라 미갱신.
	if got, _ := CheckSchedule(srv.Client(), srv.URL, dir, embedded, "hsr"); got.Updated {
		t.Fatalf("second call should not update: %+v", got)
	}
}

func TestCheckSchedule_InvalidRemoteIgnored(t *testing.T) {
	embedded := []byte(`{"version":3,"schedule":[{"s":"2023-04-26","e":"2023-05-17","c":["1102"],"l":["23001"]}]}`)
	srv := releaseServer(t, `garbage`)
	defer srv.Close()
	dir := t.TempDir()
	got, err := CheckSchedule(srv.Client(), srv.URL, dir, embedded, "hsr")
	if err != nil || got.Updated {
		t.Fatalf("invalid remote should be ignored: got %+v err %v", got, err)
	}
	if _, err := os.Stat(filepath.Join(dir, "schedule.json")); err == nil {
		t.Fatal("should not write data/schedule.json for invalid remote")
	}
}

// writeAtomic 은 rename 실패 시 .tmp 를 남기지 않아야 한다.
func TestWriteAtomic_CleansTempOnRenameFailure(t *testing.T) {
	dir := t.TempDir()
	target := filepath.Join(dir, "schedule.json")
	if err := os.Mkdir(target, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := writeAtomic(target, []byte(`{"version":1}`)); err == nil {
		t.Fatal("target 이 디렉터리이므로 rename 실패를 기대")
	}
	if leftovers, _ := filepath.Glob(filepath.Join(dir, "*.tmp")); len(leftovers) != 0 {
		t.Fatalf("임시 파일이 정리되지 않음: %v", leftovers)
	}
}

// 게임별 override 파일은 서로를 침범하지 않아야 한다. ZZZ override 가 HSR
// 스케줄로 서빙되면 50/50 판정이 통째로 어긋난다.
func TestEffectiveSchedule_IsPerGame(t *testing.T) {
	dir := t.TempDir()
	emb := []byte(`{"version":1,"schedule":[{"s":"2024-01-01","e":"2024-02-01","c":[],"l":[]}]}`)
	zzzOverride := []byte(`{"version":9,"schedule":[{"s":"2025-01-01","e":"2025-02-01","c":[],"l":[]}]}`)
	if err := os.WriteFile(filepath.Join(dir, "zzz-schedule.json"), zzzOverride, 0644); err != nil {
		t.Fatal(err)
	}

	if got := EffectiveSchedule(dir, emb, "zzz"); string(got) != string(zzzOverride) {
		t.Errorf("zzz override 가 적용되지 않았다: %s", got)
	}
	// HSR 은 자기 override 파일(data/schedule.json)이 없으므로 내장본이다.
	if got := EffectiveSchedule(dir, emb, "hsr"); string(got) != string(emb) {
		t.Errorf("hsr 이 zzz override 에 오염됐다: %s", got)
	}
}

// HSR override 경로는 data/schedule.json 그대로여야 한다 — 구버전 exe 가
// 계속 이 파일을 쓰기 때문이다.
func TestEffectiveSchedule_HSRKeepsLegacyPath(t *testing.T) {
	dir := t.TempDir()
	emb := []byte(`{"version":1,"schedule":[{"s":"2024-01-01","e":"2024-02-01","c":[],"l":[]}]}`)
	override := []byte(`{"version":5,"schedule":[{"s":"2025-01-01","e":"2025-02-01","c":[],"l":[]}]}`)
	if err := os.WriteFile(filepath.Join(dir, "schedule.json"), override, 0644); err != nil {
		t.Fatal(err)
	}
	if got := EffectiveSchedule(dir, emb, "hsr"); string(got) != string(override) {
		t.Errorf("hsr override 가 적용되지 않았다: %s", got)
	}
}

// parseVer 는 비숫자 세그먼트를 0 으로 처리한다(관대 정책 — 회귀 방지로 고정).
func TestParseVer_NonNumericSegmentTreatedAsZero(t *testing.T) {
	if got := parseVer("1.beta.3"); got != [3]int{1, 0, 3} {
		t.Fatalf("비숫자 세그먼트는 0 이어야 함, got %v", got)
	}
	if got := parseVer("v2.1.0"); got != [3]int{2, 1, 0} {
		t.Fatalf("v 접두·정상 파싱, got %v", got)
	}
}

func TestCompareVersions(t *testing.T) {
	cases := []struct {
		a, b string
		want int
	}{
		{"v1.4.0", "1.4.0", 0},
		{"1.4.1", "1.4.0", 1},
		{"1.4.0", "1.5.0", -1},
		{"1.10.0", "1.9.0", 1}, // 숫자 비교(문자열 아님)
		{"2.0.0", "1.99.99", 1},
		{"v1.2.3-snapshot", "1.2.3", 0}, // 프리릴리스 꼬리표 무시
		{"1.2", "1.2.0", 0},             // 빠진 자리는 0
	}
	for _, c := range cases {
		if got := CompareVersions(c.a, c.b); got != c.want {
			t.Fatalf("CompareVersions(%q,%q)=%d, want %d", c.a, c.b, got, c.want)
		}
	}
}
