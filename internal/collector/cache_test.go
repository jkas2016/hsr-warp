package collector

import (
	"os"
	"path/filepath"
	"syscall"
	"testing"
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

func contains(s, sub string) bool {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}

// TestReadShared_SucceedsWhenOsReadFileBlocked 는 게임이 webCache data_2 를
// DELETE 권한으로 쥔 상황을 재현한다. 표준 os.ReadFile 은 FILE_SHARE_DELETE 가
// 없어 ERROR_SHARING_VIOLATION 으로 실패하고, readShared 는 성공해야 한다.
func TestReadShared_SucceedsWhenOsReadFileBlocked(t *testing.T) {
	const want = "authkey-blob-내용"
	path := filepath.Join(t.TempDir(), "data_2")
	if err := os.WriteFile(path, []byte(want), 0o644); err != nil {
		t.Fatal(err)
	}

	// 게임 흉내: DELETE 접근 + 풀 공유로 선점한 채 핸들 유지.
	p, err := syscall.UTF16PtrFromString(path)
	if err != nil {
		t.Fatal(err)
	}
	const deleteAccess = 0x00010000 // 표준 액세스 권리 DELETE (syscall 미노출)
	h, err := syscall.CreateFile(p, deleteAccess,
		syscall.FILE_SHARE_READ|syscall.FILE_SHARE_WRITE|syscall.FILE_SHARE_DELETE,
		nil, syscall.OPEN_EXISTING, syscall.FILE_ATTRIBUTE_NORMAL, 0)
	if err != nil {
		t.Fatalf("선점 open 실패: %v", err)
	}
	defer syscall.CloseHandle(h)

	// 기준선: 표준 os.ReadFile 은 공유 위반으로 실패해야 한다(이 fix 의 동기).
	if _, err := os.ReadFile(path); err == nil {
		t.Fatal("os.ReadFile 가 성공함 — 점유 시나리오가 재현되지 않음")
	}

	got, err := readShared(path)
	if err != nil {
		t.Fatalf("readShared 실패: %v", err)
	}
	if string(got) != want {
		t.Fatalf("내용 불일치: got %q want %q", string(got), want)
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
