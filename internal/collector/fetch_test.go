package collector

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

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

	recs, uid, err := FetchIncremental(ac, lastID, 0, func(string, int) {})
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

func TestFetchIncremental_AuthkeyExpired(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{"retcode": -101, "message": "authkey timeout"})
	}))
	defer srv.Close()
	ac := &AuthContext{APIBase: srv.URL, BaseQuery: "lang=ko-kr"}
	_, _, err := FetchIncremental(ac, map[string]string{"1": "0", "2": "0", "11": "0", "12": "0"}, 0, func(string, int) {})
	if err == nil || !contains(err.Error(), "authkey") {
		t.Fatalf("expected authkey error, got %v", err)
	}
	_ = time.Second
}
