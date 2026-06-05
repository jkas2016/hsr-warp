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

func TestEffectiveSchedule(t *testing.T) {
	embedded := []byte(`{"version":3,"schedule":[{"s":"2023-04-26","e":"2023-05-17","c":["1102"],"l":["23001"]}]}`)
	dir := t.TempDir()
	// data/ 없음 → 내장본.
	if got := EffectiveSchedule(dir, embedded); string(got) != string(embedded) {
		t.Fatal("missing data/ should fall back to embedded")
	}
	// data/ 가 더 높은 version → data/.
	higher := []byte(`{"version":5,"schedule":[{"s":"2023-04-26","e":"2023-05-17","c":["1102"],"l":["23001"]}]}`)
	if err := os.WriteFile(filepath.Join(dir, "schedule.json"), higher, 0644); err != nil {
		t.Fatal(err)
	}
	if got := EffectiveSchedule(dir, embedded); string(got) != string(higher) {
		t.Fatal("higher data/ should win")
	}
	// data/ 가 같거나 낮으면 내장본.
	lower := []byte(`{"version":3,"schedule":[{"s":"2023-04-26","e":"2023-05-17","c":["1102"],"l":["23001"]}]}`)
	_ = os.WriteFile(filepath.Join(dir, "schedule.json"), lower, 0644)
	if got := EffectiveSchedule(dir, embedded); string(got) != string(embedded) {
		t.Fatal("equal/lower data/ should fall back to embedded")
	}
	// data/ 가 깨졌으면 내장본.
	_ = os.WriteFile(filepath.Join(dir, "schedule.json"), []byte("corrupt"), 0644)
	if got := EffectiveSchedule(dir, embedded); string(got) != string(embedded) {
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

func TestCheckSchedule(t *testing.T) {
	embedded := []byte(`{"version":3,"schedule":[{"s":"2023-04-26","e":"2023-05-17","c":["1102"],"l":["23001"]}]}`)
	remote := `{"version":7,"schedule":[{"s":"2023-04-26","e":"2023-05-17","c":["1102"],"l":["23001"]}]}`
	srv := releaseServer(t, remote)
	defer srv.Close()
	dir := t.TempDir()

	// 원격이 더 높음 → data/ 기록 + Updated.
	got, err := CheckSchedule(srv.Client(), srv.URL, dir, embedded)
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
	if got, _ := CheckSchedule(srv.Client(), srv.URL, dir, embedded); got.Updated {
		t.Fatalf("second call should not update: %+v", got)
	}
}

func TestCheckSchedule_InvalidRemoteIgnored(t *testing.T) {
	embedded := []byte(`{"version":3,"schedule":[{"s":"2023-04-26","e":"2023-05-17","c":["1102"],"l":["23001"]}]}`)
	srv := releaseServer(t, `garbage`)
	defer srv.Close()
	dir := t.TempDir()
	got, err := CheckSchedule(srv.Client(), srv.URL, dir, embedded)
	if err != nil || got.Updated {
		t.Fatalf("invalid remote should be ignored: got %+v err %v", got, err)
	}
	if _, err := os.Stat(filepath.Join(dir, "schedule.json")); err == nil {
		t.Fatal("should not write data/schedule.json for invalid remote")
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
