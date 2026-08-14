package collector

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"hsr-warp/internal/game"
)

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

// authkey URL 의 timestamp 쿼리값으로 생성 시각(IssuedAt)을 알 수 있어야 한다.
// 게임을 켜기만 하면 data_2 mtime 은 갱신돼도 새 authkey 는 안 써진다 —
// 사용자가 "왜 만료냐"고 헷갈리는 핵심이라, 생성 시각을 노출해 진단에 쓴다.
func TestParseAuthURL_IssuedAtFromTimestamp(t *testing.T) {
	blob := []byte("\x00https://host/common/gacha_record/api/getGachaLog?authkey=X&lang=ko-kr&timestamp=1776815846\x00")
	ac, err := parseAuthURL(blob)
	if err != nil {
		t.Fatal(err)
	}
	if ac.IssuedAt.Unix() != 1776815846 {
		t.Fatalf("expected IssuedAt unix 1776815846, got %d", ac.IssuedAt.Unix())
	}
}

// getGachaLog URL 이 여러 개면(전언기록을 여러 번 열어 캐시에 누적) 바이트 순서상
// 마지막이 아니라 timestamp 가 가장 큰(최신) authkey 를 골라야 한다.
func TestParseAuthURL_PicksFreshestGachaLogByTimestamp(t *testing.T) {
	blob := []byte(
		"\x00https://host/common/gacha_record/api/getGachaLog?authkey=NEW&lang=ko-kr&timestamp=2000\x00" +
			"\x00https://host/common/gacha_record/api/getGachaLog?authkey=OLD&lang=ko-kr&timestamp=1000\x00")
	ac, err := parseAuthURL(blob)
	if err != nil {
		t.Fatal(err)
	}
	if !contains(ac.BaseQuery, "authkey=NEW") {
		t.Fatalf("must pick freshest authkey by timestamp, got: %s", ac.BaseQuery)
	}
	if ac.IssuedAt.Unix() != 2000 {
		t.Fatalf("IssuedAt should be the freshest timestamp 2000, got %d", ac.IssuedAt.Unix())
	}
}

// region/lang 값에 잘못된 % 이스케이프가 있어도 조용히 빈 문자열이 되면 안 되고
// raw 값으로 폴백해야 한다(QueryUnescape 에러 폐기 방지).
func TestParseAuthURL_MalformedEscapeFallsBackToRaw(t *testing.T) {
	blob := []byte("\x00https://host/common/gacha_record/api/getGachaLog?authkey=X&lang=ko-kr&region=prod%zz\x00")
	ac, err := parseAuthURL(blob)
	if err != nil {
		t.Fatal(err)
	}
	if ac.Region != "prod%zz" {
		t.Fatalf("malformed escape 는 raw 로 폴백해야 함, got %q", ac.Region)
	}
	if ac.Lang != "ko-kr" {
		t.Fatalf("정상 lang 은 그대로 디코딩돼야 함, got %q", ac.Lang)
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

// ZZZ 는 캐시 루트 디렉터리 이름이 다르다. 게임 값 테이블의 DataDirName 을
// 실제로 쓰는지 확인한다 — 하드코딩된 StarRail_Data 가 남아 있으면 실패한다.
func TestFindAuthContext_UsesGameDataDirName(t *testing.T) {
	root := t.TempDir()
	// ZZZ 캐시 구조만 만들고 HSR 구조는 만들지 않는다.
	dir := filepath.Join(root, "ZenlessZoneZero_Data", "webCaches", "2.51.0.0", "Cache", "Cache_Data")
	if err := os.MkdirAll(dir, 0755); err != nil {
		t.Fatal(err)
	}
	raw := "https://public-operation-common-sg.hoyoverse.com/common/gacha_record/api/getGachaLog" +
		"?authkey=AAA&region=prod_gf_jp&lang=ko&real_gacha_type=2&timestamp=1700000000"
	if err := os.WriteFile(filepath.Join(dir, "data_2"), []byte(raw), 0644); err != nil {
		t.Fatal(err)
	}

	zzz, _ := game.ByID("zzz")
	ac, err := FindAuthContext(root, zzz)
	if err != nil {
		t.Fatalf("ZZZ 캐시를 찾지 못했다: %v", err)
	}
	if ac.Region != "prod_gf_jp" || ac.Lang != "ko" {
		t.Errorf("region/lang = %q/%q, want prod_gf_jp/ko", ac.Region, ac.Lang)
	}

	// 같은 루트를 HSR 로 보면 StarRail_Data 가 없으므로 실패해야 한다.
	hsr, _ := game.ByID("hsr")
	if _, err := FindAuthContext(root, hsr); err == nil {
		t.Error("HSR 캐시가 없는데 성공했다")
	}
}

// 실측: authkey URL 의 베이스 쿼리에 real_gacha_type 이 이미 들어 있다.
// pageKeys 로 제거하지 않으면 페이지 조립 시 파라미터가 중복되고 서버가 앞의
// 값을 채택해 4개 채널이 전부 같은 데이터를 반환한다.
func TestParseAuthURL_StripsRealGachaType(t *testing.T) {
	raw := "https://h/common/gacha_record/api/getGachaLog" +
		"?authkey=AAA&region=prod_gf_jp&lang=ko&real_gacha_type=2&size=20&timestamp=1700000000"
	ac, err := parseAuthURL([]byte(raw))
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(ac.BaseQuery, "real_gacha_type") {
		t.Errorf("BaseQuery 에 real_gacha_type 이 남았다: %q", ac.BaseQuery)
	}
	// 다른 파라미터는 보존돼야 한다.
	if !strings.Contains(ac.BaseQuery, "authkey=AAA") || !strings.Contains(ac.BaseQuery, "lang=ko") {
		t.Errorf("필요한 쿼리가 사라졌다: %q", ac.BaseQuery)
	}
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
