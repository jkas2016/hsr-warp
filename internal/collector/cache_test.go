package collector

import "testing"

func TestParseAuthURL(t *testing.T) {
	// 캐시 바이너리에 섞여 있을 법한 형태: 널바이트로 둘러싸인 URL.
	blob := []byte("\x00\x00garbagehttps://public-operation-hkrpg.hoyoverse.com/common/gacha_record/api/getGachaLog?" +
		"authkey=ABC%2Bdef&lang=ko-kr&region=prod_official_asia&game_biz=hkrpg_global&size=5&gacha_type=11&page=2&end_id=999\x00\x00")
	ac, err := parseAuthURL(blob)
	if err != nil {
		t.Fatal(err)
	}
	if ac.APIBase != "https://public-operation-hkrpg.hoyoverse.com/common/gacha_record/api/getGachaLog" {
		t.Fatalf("bad APIBase: %s", ac.APIBase)
	}
	if ac.Region != "prod_official_asia" || ac.Lang != "ko-kr" {
		t.Fatalf("bad region/lang: %s / %s", ac.Region, ac.Lang)
	}
	for _, banned := range []string{"page=", "size=", "gacha_type=", "end_id="} {
		if contains(ac.BaseQuery, banned) {
			t.Fatalf("BaseQuery must not contain %q: %s", banned, ac.BaseQuery)
		}
	}
	if !contains(ac.BaseQuery, "authkey=ABC%2Bdef") {
		t.Fatalf("authkey lost or re-encoded: %s", ac.BaseQuery)
	}
}

func TestParseAuthURL_NoURL(t *testing.T) {
	if _, err := parseAuthURL([]byte("no url here")); err == nil {
		t.Fatal("expected error when no authkey url present")
	}
}

// 실제 캐시에는 getGachaLog 외에도 HoYoLAB/이벤트용 authkey URL이 다수 섞여 있고,
// 게임 내 전언기록 URL이 마지막이 아닐 수 있다. getGachaLog URL을 골라야 한다.
func TestParseAuthURL_PicksGachaLogNotLast(t *testing.T) {
	blob := []byte(
		"\x00https://public-operation-hkrpg-sg.hoyoverse.com/common/hkrpg_gacha_record/api/getGachaLog?authkey=GOOD&lang=ko-kr&game_biz=hkrpg_global\x00" +
			"\x00https://sg-act-public-api.hoyolab.com/common/badge/v1/login/authKey?authkey=BAD&game_biz=hkrpg_global\x00")
	ac, err := parseAuthURL(blob)
	if err != nil {
		t.Fatal(err)
	}
	if !contains(ac.APIBase, "getGachaLog") {
		t.Fatalf("APIBase must be the getGachaLog endpoint, got: %s", ac.APIBase)
	}
	if contains(ac.APIBase, "hoyolab") {
		t.Fatalf("must not pick the HoYoLAB badge URL: %s", ac.APIBase)
	}
	if !contains(ac.BaseQuery, "authkey=GOOD") {
		t.Fatalf("must keep authkey from the getGachaLog URL: %s", ac.BaseQuery)
	}
}

// 경로를 하드코딩하지 말고 캐시의 실제 경로(hkrpg_gacha_record 등)를 보존해야 한다.
func TestParseAuthURL_PreservesActualHostAndPath(t *testing.T) {
	blob := []byte("\x00https://public-operation-hkrpg-sg.hoyoverse.com/common/hkrpg_gacha_record/api/getGachaLog?authkey=X&lang=ko-kr\x00")
	ac, err := parseAuthURL(blob)
	if err != nil {
		t.Fatal(err)
	}
	want := "https://public-operation-hkrpg-sg.hoyoverse.com/common/hkrpg_gacha_record/api/getGachaLog"
	if ac.APIBase != want {
		t.Fatalf("APIBase should preserve actual host+path.\n want: %s\n got:  %s", want, ac.APIBase)
	}
}

// getGachaLog URL이 전혀 없으면(다른 authkey URL만 있으면) 명확히 실패해야 한다.
func TestParseAuthURL_NoGachaLogURL(t *testing.T) {
	blob := []byte("\x00https://sg-act-public-api.hoyolab.com/common/badge/v1/login/authKey?authkey=BAD&game_biz=hkrpg_global\x00")
	if _, err := parseAuthURL(blob); err == nil {
		t.Fatal("expected error when no getGachaLog URL is present")
	}
}

func contains(s, sub string) bool {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}

func TestLatestVersion(t *testing.T) {
	got := latestVersion([]string{"2.9.0.0", "2.10.0.0", "2.3.5.1"})
	if got != "2.10.0.0" {
		t.Fatalf("expected 2.10.0.0, got %s", got)
	}
	if latestVersion(nil) != "" {
		t.Fatalf("expected empty for nil input")
	}
}
