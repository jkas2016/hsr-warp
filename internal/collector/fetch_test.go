package collector

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
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

	recs, uid, err := FetchIncremental(context.Background(), ac, lastID, 0, func(string, int) {})
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
	if _, _, err := FetchIncremental(context.Background(), ac, map[string]string{"1": "0", "2": "0", "11": "0", "12": "0"}, 0, func(string, int) {}); err != nil {
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
	_, _, err := FetchIncremental(context.Background(), ac, map[string]string{"1": "0", "2": "0", "11": "0", "12": "0"}, 0, func(string, int) {})
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
		_, _, err := FetchIncremental(ctx, ac, map[string]string{"1": "0", "2": "0", "11": "0", "12": "0"}, 0, func(string, int) {})
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
	_, _, err := FetchIncremental(context.Background(), ac, map[string]string{"1": "0", "2": "0", "11": "0", "12": "0"}, 0, func(string, int) {})
	if err == nil || !contains(err.Error(), "authkey") {
		t.Fatalf("expected authkey error, got %v", err)
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
