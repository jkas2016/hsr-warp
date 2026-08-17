package collector

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"hsr-warp/internal/game"
)

// 만료 메시지는 사용자의 혼란("방금 게임 켰는데 왜 만료냐")을 직접 풀어줘야 한다:
// authkey 생성 시각과 경과 일수를 보여주고, 게임 실행만으로는 갱신 안 됨을 명시한다.
func TestExpiredMessage_ShowsAgeAndGuidance(t *testing.T) {
	issued := time.Date(2026, 4, 21, 8, 57, 0, 0, time.Local)
	now := time.Date(2026, 6, 3, 19, 0, 0, 0, time.Local)
	msg := expiredMessage(issued, now)
	if !contains(msg, "43일") {
		t.Fatalf("message should state the 43-day age, got: %s", msg)
	}
	if !contains(msg, "2026-04-21") {
		t.Fatalf("message should state the issue date, got: %s", msg)
	}
	if !contains(msg, "전언") || !contains(msg, "기록") {
		t.Fatalf("message should tell user to open the warp records screen, got: %s", msg)
	}
}

// 생성 시각을 모를 때(timestamp 없는 캐시)는 경과 표기 없이 안내만 한다.
func TestExpiredMessage_UnknownIssuedAt(t *testing.T) {
	msg := expiredMessage(time.Time{}, time.Now())
	if !contains(msg, "전언") || !contains(msg, "기록") {
		t.Fatalf("message should still guide the user, got: %s", msg)
	}
}

func TestFetchIncremental_StopsAtStoredID(t *testing.T) {
	// 배너 11 은 id 30,20,10 보유. lastID=20 이면 30만 신규.
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gt := r.URL.Query().Get("gacha_type")
		endID := r.URL.Query().Get("end_id")
		var list []map[string]string
		if gt == "11" && endID == "0" {
			list = []map[string]string{
				{"id": "30", "gacha_type": "11", "rank_type": "5", "time": "2026-06-03 10:00:00", "name": "A", "item_id": "1", "uid": "777"},
				{"id": "20", "gacha_type": "11", "rank_type": "4", "time": "2026-06-02 10:00:00", "name": "B", "item_id": "2", "uid": "777"},
				{"id": "10", "gacha_type": "11", "rank_type": "3", "time": "2026-06-01 10:00:00", "name": "C", "item_id": "3", "uid": "777"},
			}
		}
		resp := map[string]any{"retcode": 0, "message": "ok", "data": map[string]any{"list": list, "region": "asia"}}
		_ = json.NewEncoder(w).Encode(resp)
	}))
	defer srv.Close()

	ac := &AuthContext{APIBase: srv.URL, BaseQuery: "lang=ko-kr", Region: "asia"}
	lastID := map[string]string{"1": "0", "2": "0", "11": "20", "12": "0"}

	recs, uid, err := FetchIncremental(context.Background(), ac, game.Default(), lastID, 0, func(string, int) {})
	if err != nil {
		t.Fatal(err)
	}
	if uid != "777" {
		t.Fatalf("expected uid 777, got %s", uid)
	}
	if len(recs) != 1 || recs[0].ID != "30" {
		t.Fatalf("expected only new record id 30, got %+v", recs)
	}
}

// 디버그 빌드에서 페이지네이션을 진단할 수 있게, 배너별 페이지마다 DEBUG 추적을 남긴다.
func TestFetchIncremental_EmitsPerPageDebug(t *testing.T) {
	var buf bytes.Buffer
	old := slog.Default()
	slog.SetDefault(slog.New(slog.NewJSONHandler(&buf, &slog.HandlerOptions{Level: slog.LevelDebug})))
	t.Cleanup(func() { slog.SetDefault(old) })

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var list []map[string]string
		if r.URL.Query().Get("gacha_type") == "11" && r.URL.Query().Get("end_id") == "0" {
			list = []map[string]string{{"id": "30", "gacha_type": "11", "rank_type": "5", "time": "2026-06-03 10:00:00", "name": "A", "item_id": "1", "uid": "777"}}
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"retcode": 0, "message": "ok", "data": map[string]any{"list": list}})
	}))
	defer srv.Close()

	ac := &AuthContext{APIBase: srv.URL, BaseQuery: "lang=ko-kr"}
	if _, _, err := FetchIncremental(context.Background(), ac, game.Default(), map[string]string{"1": "0", "2": "0", "11": "0", "12": "0"}, 0, func(string, int) {}); err != nil {
		t.Fatal(err)
	}
	out := buf.String()
	if !contains(out, `"msg":"페이지 수집"`) || !contains(out, `"received":1`) {
		t.Fatalf("페이지별 DEBUG 추적이 있어야 한다: %s", out)
	}
}

// -110(visit too frequently)은 레이트 리밋이다. raw retcode 대신 잠시 기다리라는
// 안내를 줘야 한다(짧은 간격으로 반복 조회 시 흔히 발생).
func TestFetchIncremental_RateLimited(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{"retcode": -110, "message": "visit too frequently"})
	}))
	defer srv.Close()
	ac := &AuthContext{APIBase: srv.URL, BaseQuery: "lang=ko-kr"}
	_, _, err := FetchIncremental(context.Background(), ac, game.Default(), map[string]string{"1": "0", "2": "0", "11": "0", "12": "0"}, 0, func(string, int) {})
	if err == nil || !contains(err.Error(), "기다") {
		t.Fatalf("expected a rate-limit wait message, got %v", err)
	}
}

// SSE 클라이언트가 끊기면(ctx 취소) 진행 중 수집이 즉시 중단되고 ctx 에러를 반환해야 한다.
func TestFetchIncremental_ContextCancellation(t *testing.T) {
	started := make(chan struct{})
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		close(started)
		<-r.Context().Done() // 클라이언트 취소까지 응답을 보류
	}))
	defer srv.Close()

	ac := &AuthContext{APIBase: srv.URL, BaseQuery: "authkey=X"}
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() {
		_, _, err := FetchIncremental(ctx, ac, game.Default(), map[string]string{"1": "0", "2": "0", "11": "0", "12": "0"}, 0, func(string, int) {})
		done <- err
	}()
	<-started
	cancel()
	select {
	case err := <-done:
		if err == nil {
			t.Fatal("취소 시 에러를 기대")
		}
	case <-time.After(2 * time.Second):
		t.Fatal("취소 후에도 FetchIncremental 이 반환하지 않음(context 미전파)")
	}
}

func TestFetchIncremental_AuthkeyExpired(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{"retcode": -101, "message": "authkey timeout"})
	}))
	defer srv.Close()
	ac := &AuthContext{APIBase: srv.URL, BaseQuery: "lang=ko-kr"}
	_, _, err := FetchIncremental(context.Background(), ac, game.Default(), map[string]string{"1": "0", "2": "0", "11": "0", "12": "0"}, 0, func(string, int) {})
	if err == nil || !contains(err.Error(), "authkey") {
		t.Fatalf("expected authkey error, got %v", err)
	}
}

// non-2xx HTTP 응답은 파싱 가능한 JSON 이어도 "신규 없음"으로 오인하지 말고 에러로 표면화해야 한다.
func TestFetchIncremental_Non2xxStatusIsError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadGateway)
		_, _ = w.Write([]byte(`{"retcode":0,"data":{"list":[]}}`)) // 파싱 가능하지만 502
	}))
	defer srv.Close()
	ac := &AuthContext{APIBase: srv.URL, BaseQuery: "lang=ko-kr"}
	_, _, err := FetchIncremental(context.Background(), ac, game.Default(), map[string]string{"1": "0", "2": "0", "11": "0", "12": "0"}, 0, func(string, int) {})
	if err == nil || !contains(err.Error(), "502") {
		t.Fatalf("non-2xx 는 HTTP 상태 에러여야 함, got %v", err)
	}
}

// 서버가 end_id 를 무시하고 같은 페이지를 반복해도 루프가 종료되어야 한다(무한 루프 방지).
func TestFetchIncremental_TerminatesOnNoPageProgress(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var list []map[string]string
		if r.URL.Query().Get("gacha_type") == "11" {
			// end_id 무시하고 항상 같은 3건(서버 오작동 시뮬레이션).
			list = []map[string]string{
				{"id": "30", "gacha_type": "11", "rank_type": "5", "time": "2026-06-03 10:00:00", "name": "A", "item_id": "1", "uid": "777"},
				{"id": "20", "gacha_type": "11", "rank_type": "4", "time": "2026-06-02 10:00:00", "name": "B", "item_id": "2", "uid": "777"},
				{"id": "10", "gacha_type": "11", "rank_type": "3", "time": "2026-06-01 10:00:00", "name": "C", "item_id": "3", "uid": "777"},
			}
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"retcode": 0, "message": "ok", "data": map[string]any{"list": list}})
	}))
	defer srv.Close()
	ac := &AuthContext{APIBase: srv.URL, BaseQuery: "lang=ko-kr"}

	done := make(chan struct{})
	var count int
	var ferr error
	go func() {
		r, _, e := FetchIncremental(context.Background(), ac, game.Default(), map[string]string{"1": "0", "2": "0", "11": "0", "12": "0"}, 0, func(string, int) {})
		count, ferr = len(r), e
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(3 * time.Second):
		t.Fatal("end_id 불변 응답에서 FetchIncremental 이 종료되지 않음(무한 루프)")
	}
	if ferr != nil {
		t.Fatal(ferr)
	}
	// page1 3건 수집 → page2 3건 수집 후 진전 없음(end_id 불변) 감지로 종료 → 6건.
	if count != 6 {
		t.Fatalf("진전 없는 페이지에서 2페이지 후 종료해 6건이어야 함, got %d", count)
	}
}

// idLessEq 는 big.Int 로 비교해야 한다 — 사전식이면 "9" > "10" 로 오판한다.
func TestIDLessEq_BigIntNotLexicographic(t *testing.T) {
	cases := []struct {
		a, b       string
		wantLe, ok bool
	}{
		{"9", "10", true, true},  // 9 <= 10 (사전식이면 false 로 오판)
		{"10", "9", false, true}, // 10 <= 9 아님
		{"5", "5", true, true},   // 동일 ID
		{"100", "99", false, true},
		{"abc", "10", false, false}, // 비숫자 → ok=false
		{"10", "xyz", false, false},
	}
	for _, c := range cases {
		le, ok := idLessEq(c.a, c.b)
		if le != c.wantLe || ok != c.ok {
			t.Fatalf("idLessEq(%q,%q) = (%v,%v), want (%v,%v)", c.a, c.b, le, ok, c.wantLe, c.ok)
		}
	}
}

// 미래 issuedAt(시계 오차)에서 경과 일수가 음수가 되면 안 된다("-1일" 방지).
func TestExpiredMessage_FutureIssuedAtClampsToZero(t *testing.T) {
	now := time.Date(2026, 6, 3, 12, 0, 0, 0, time.Local)
	future := now.Add(48 * time.Hour)
	msg := expiredMessage(future, now)
	// clamp 없이는 -2일(48h/24h)이 노출된다 — 날짜 표기(2026-06-05)의 하이픈과
	// 헷갈리지 않도록 "-<숫자>일" 패턴으로만 검사한다.
	if contains(msg, "-2일") {
		t.Fatalf("음수 일수가 노출되면 안 됨: %s", msg)
	}
	if !contains(msg, "0일") {
		t.Fatalf("미래 issuedAt 은 0일로 clamp 되어야 함: %s", msg)
	}
}

// ZZZ 는 real_gacha_type 으로 채널을 지정한다. 조립된 요청 URL 에 이 파라미터가
// 정확히 한 번만, 우리가 지정한 값으로 나타나야 한다. 중복되면 서버가 앞의 값을
// 채택해 모든 채널이 같은 데이터를 반환하는 조용한 버그가 된다.
func TestFetchIncremental_ZZZUsesRealGachaTypeExactlyOnce(t *testing.T) {
	var got []string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got = append(got, r.URL.RawQuery)
		_, _ = w.Write([]byte(`{"retcode":0,"message":"OK","data":{"list":[]}}`))
	}))
	defer srv.Close()

	zzz, _ := game.ByID("zzz")
	ac := &AuthContext{
		APIBase:   srv.URL,
		BaseQuery: "authkey=AAA&lang=ko", // pageKeys 가 real_gacha_type 을 이미 제거한 상태
		Region:    "prod_gf_jp",
		Lang:      "ko",
	}
	if _, _, err := FetchIncremental(context.Background(), ac, zzz, nil, 0, nil); err != nil {
		t.Fatal(err)
	}

	if len(got) != len(zzz.Banners) {
		t.Fatalf("요청 수 = %d, want %d", len(got), len(zzz.Banners))
	}
	wantCodes := zzz.Codes()
	for i, q := range got {
		if strings.Count(q, "real_gacha_type=") != 1 {
			t.Errorf("요청 %d: real_gacha_type 이 %d번 나타났다: %q", i, strings.Count(q, "real_gacha_type="), q)
		}
		if strings.Contains(q, "gacha_type=") && !strings.Contains(q, "real_gacha_type=") {
			t.Errorf("요청 %d: ZZZ 인데 gacha_type 을 썼다: %q", i, q)
		}
		if !strings.Contains(q, "real_gacha_type="+wantCodes[i]) {
			t.Errorf("요청 %d: 채널 %q 를 기대했으나 %q", i, wantCodes[i], q)
		}
	}
}

// HSR 은 기존대로 gacha_type 을 쓰고 채널 순서도 그대로여야 한다(회귀 방지).
func TestFetchIncremental_HSRKeepsGachaType(t *testing.T) {
	var got []string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got = append(got, r.URL.RawQuery)
		_, _ = w.Write([]byte(`{"retcode":0,"message":"OK","data":{"list":[]}}`))
	}))
	defer srv.Close()

	hsr, _ := game.ByID("hsr")
	ac := &AuthContext{APIBase: srv.URL, BaseQuery: "authkey=AAA", Region: "asia", Lang: "ko"}
	if _, _, err := FetchIncremental(context.Background(), ac, hsr, nil, 0, nil); err != nil {
		t.Fatal(err)
	}

	want := []string{"11", "12", "1", "2"}
	if len(got) != len(want) {
		t.Fatalf("요청 수 = %d, want %d", len(got), len(want))
	}
	for i, q := range got {
		if strings.Contains(q, "real_gacha_type=") {
			t.Errorf("요청 %d: HSR 인데 real_gacha_type 을 썼다: %q", i, q)
		}
		if !strings.Contains(q, "gacha_type="+want[i]) {
			t.Errorf("요청 %d: gacha_type=%s 를 기대했으나 %q", i, want[i], q)
		}
	}
}

// 배너 표시명은 역할에서 유도한다. 게임마다 코드가 달라도 진행 로그가 읽혀야 한다.
func TestBannerLabel_DerivesFromRole(t *testing.T) {
	zzz, _ := game.ByID("zzz")
	if got := BannerLabel(zzz, "2"); got == "" || got == "2" {
		t.Errorf("ZZZ 코드 2 의 표시명이 유도되지 않았다: %q", got)
	}
	hsr, _ := game.ByID("hsr")
	if got := BannerLabel(hsr, "11"); got == "" || got == "11" {
		t.Errorf("HSR 코드 11 의 표시명이 유도되지 않았다: %q", got)
	}
	// 모르는 코드는 코드 자체로 폴백한다(로그가 비지 않게).
	if got := BannerLabel(hsr, "99"); got != "99" {
		t.Errorf("알 수 없는 코드 폴백 = %q, want 99", got)
	}
}
