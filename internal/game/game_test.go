package game

import "testing"

// 게임 ID 로 조회한 결과가 값 테이블과 일치해야 한다. 수집 계층이 이 값에
// 전적으로 의존하므로 오타 하나가 조용히 잘못된 캐시 경로/쿼리를 만든다.
func TestByID_ReturnsExpectedTable(t *testing.T) {
	hsr, ok := ByID("hsr")
	if !ok {
		t.Fatal("hsr 를 찾지 못했다")
	}
	if hsr.DataDirName != "StarRail_Data" {
		t.Errorf("hsr DataDirName = %q, want StarRail_Data", hsr.DataDirName)
	}
	if hsr.BannerParam != "gacha_type" {
		t.Errorf("hsr BannerParam = %q, want gacha_type", hsr.BannerParam)
	}
	if hsr.InfoFormat != "srgf-v1.0" {
		t.Errorf("hsr InfoFormat = %q, want srgf-v1.0", hsr.InfoFormat)
	}

	zzz, ok := ByID("zzz")
	if !ok {
		t.Fatal("zzz 를 찾지 못했다")
	}
	if zzz.DataDirName != "ZenlessZoneZero_Data" {
		t.Errorf("zzz DataDirName = %q, want ZenlessZoneZero_Data", zzz.DataDirName)
	}
	// 실측: ZZZ 는 gacha_type 이 아니라 real_gacha_type 으로 채널을 지정한다.
	if zzz.BannerParam != "real_gacha_type" {
		t.Errorf("zzz BannerParam = %q, want real_gacha_type", zzz.BannerParam)
	}
	if zzz.InfoFormat != "uigf-v4.0" {
		t.Errorf("zzz InfoFormat = %q, want uigf-v4.0", zzz.InfoFormat)
	}
}

// 알 수 없는 게임 ID 는 조용히 폴백하지 않고 ok=false 여야 한다.
// 서버가 이 값으로 400 을 내려 오타를 즉시 드러낸다.
func TestByID_UnknownIsNotOK(t *testing.T) {
	if _, ok := ByID("genshin"); ok {
		t.Error("genshin 은 아직 지원하지 않는데 ok=true 였다")
	}
	if _, ok := ByID(""); ok {
		t.Error("빈 ID 가 ok=true 였다")
	}
}

// 미지정 시 폴백은 hsr 이다(기존 사용자 동작 보존).
func TestDefault_IsHSR(t *testing.T) {
	if Default().ID != "hsr" {
		t.Errorf("Default().ID = %q, want hsr", Default().ID)
	}
}

// 모든 게임의 배너가 정의된 역할만 쓰고, 코드가 게임 안에서 유일해야 한다.
// 중복 코드는 수집 루프가 같은 채널을 두 번 도는 버그가 된다.
func TestAll_BannersUseKnownRolesAndUniqueCodes(t *testing.T) {
	known := map[string]bool{
		RoleLimitedChar: true, RoleLimitedWeapon: true,
		RoleStandard: true, RoleBeginner: true, RoleBangboo: true,
		RoleSpecialChar: true, RoleSpecialWeapon: true,
	}
	for _, g := range All() {
		if len(g.Banners) == 0 {
			t.Errorf("%s: 배너가 비었다", g.ID)
		}
		seen := map[string]bool{}
		for _, b := range g.Banners {
			if !known[b.Role] {
				t.Errorf("%s: 알 수 없는 역할 %q (code=%s)", g.ID, b.Role, b.Code)
			}
			if seen[b.Code] {
				t.Errorf("%s: 배너 코드 %q 가 중복됐다", g.ID, b.Code)
			}
			seen[b.Code] = true
		}
	}
}

// 배너 코드 목록과 순서는 수집 순서이자 저장 키다. 실측으로 확정한 값에서
// 벗어나면 API 가 빈 응답을 주거나 채널이 뒤섞인다.
func TestCodes_MatchesVerifiedValues(t *testing.T) {
	want := map[string][]string{
		"hsr": {"11", "12", "1", "2"},
		"zzz": {"2", "3", "102", "103"},
	}
	for id, exp := range want {
		g, ok := ByID(id)
		if !ok {
			t.Fatalf("%s 를 찾지 못했다", id)
		}
		got := g.Codes()
		if len(got) != len(exp) {
			t.Errorf("%s: Codes() = %v, want %v", id, got, exp)
			continue
		}
		for i := range exp {
			if got[i] != exp[i] {
				t.Errorf("%s: Codes()[%d] = %q, want %q", id, i, got[i], exp[i])
			}
		}
	}
}

// 자동탐지 후보가 비어 있으면 사용자가 매번 경로를 손으로 넣어야 한다.
func TestAll_HaveCandidates(t *testing.T) {
	for _, g := range All() {
		if len(g.Candidates) == 0 {
			t.Errorf("%s: 설치 경로 후보가 비었다", g.ID)
		}
	}
}

// All() 이 내부 슬라이스를 그대로 노출하면 호출자가 값 테이블을 오염시킬 수 있다.
func TestAll_ReturnsCopy(t *testing.T) {
	a := All()
	if len(a) == 0 {
		t.Fatal("All() 이 비었다")
	}
	a[0].ID = "tampered"
	if All()[0].ID == "tampered" {
		t.Error("All() 이 내부 상태를 노출한다")
	}
}

// ZZZ 3.1 하반기 "3인 동시 특별 픽업"(다이아린·유즈하·하루마사) 배너는 API 상
// 독점(2)·W-엔진(3)과 별개인 real_gacha_type=102/103 으로 배포된다. 실측:
// 102 는 에이전트, 103 은 W-엔진 레코드를 돌려준다(tools/channelprobe).
// 이 두 코드가 목록에 없으면 해당 배너 기록은 조회 자체가 되지 않아 대시보드에
// 통째로 누락된다 — 실제로 그렇게 누락됐다.
func TestZZZ_IncludesSpecialPickupChannels(t *testing.T) {
	g, ok := ByID("zzz")
	if !ok {
		t.Fatal("zzz 를 찾지 못했다")
	}
	want := map[string]string{"102": RoleSpecialChar, "103": RoleSpecialWeapon}
	got := map[string]string{}
	for _, b := range g.Banners {
		got[b.Code] = b.Role
	}
	for code, role := range want {
		if got[code] != role {
			t.Errorf("zzz: 코드 %s 의 역할 = %q, want %q", code, got[code], role)
		}
	}
}
