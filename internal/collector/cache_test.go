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
