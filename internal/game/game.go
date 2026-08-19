// Package game 은 지원 게임 간의 차이를 값 테이블 하나로 격리한다.
// 수집 계층이 필요로 하는 것(캐시 디렉터리명, 배너 쿼리 파라미터, 채널 코드와
// 순서, 진단 메시지에 쓸 인게임 화면 경로)만 담는다. 사용자에게 보이는 다국어
// 문구는 대시보드 i18n(web/ui_kits/dashboard/i18n/game.js)이 소유하고, 여기 값은
// 서버 로그·SSE 에러의 한국어 안내에만 쓴다. 천장·픽업 확률·표시 이름 같은
// 분석용 값은 여기 두지 않고 web/schedule.json 의 banners 블록에 둔다
// (분석 로직 단일 소스 원칙).
package game

// 배너 역할. 게임마다 채널 코드는 다르지만 역할은 공통이라, 분석·표시 계층은
// 코드가 아니라 역할로 분기한다.
const (
	RoleLimitedChar   = "limited-char"   // 한정 캐릭터/에이전트
	RoleLimitedWeapon = "limited-weapon" // 한정 광추/음의 엔진
	RoleStandard      = "standard"       // 상시
	RoleBeginner      = "beginner"       // 초보자 전용(HSR 출발 워프)
	RoleBangboo       = "bangboo"        // ZZZ 본디
)

// Banner 는 한 게임의 가챠 채널 하나다.
type Banner struct {
	Code string // API 가 쓰는 채널 코드(HSR gacha_type / ZZZ real_gacha_type)
	Role string // 위 Role* 상수 중 하나
}

// Game 은 게임 하나의 수집 파라미터다.
type Game struct {
	ID          string   // "hsr" | "zzz"
	RecordPath  string   // 인게임 기록 화면 진입 경로(진단 메시지용, 한국어)
	DataDirName string   // 게임 설치 폴더 아래 캐시 루트 디렉터리명
	BannerParam string   // 채널을 지정하는 쿼리 파라미터 이름
	InfoFormat  string   // 저장 파일 info 블록 규격
	Banners     []Banner // 조회 순서 = 슬라이스 순서
	Candidates  []string // 설치 경로 자동탐지 후보
}

// Codes 는 배너 코드를 정의 순서대로 반환한다.
func (g Game) Codes() []string {
	out := make([]string, len(g.Banners))
	for i, b := range g.Banners {
		out[i] = b.Code
	}
	return out
}

// RoleOf 는 배너 코드의 역할을 반환한다(없으면 빈 문자열).
func (g Game) RoleOf(code string) string {
	for _, b := range g.Banners {
		if b.Code == code {
			return b.Role
		}
	}
	return ""
}

var games = []Game{
	{
		ID:          "hsr",
		RecordPath:  "[전언] → [기록]",
		DataDirName: "StarRail_Data",
		BannerParam: "gacha_type",
		InfoFormat:  "srgf-v1.0",
		Banners: []Banner{
			{Code: "11", Role: RoleLimitedChar},
			{Code: "12", Role: RoleLimitedWeapon},
			{Code: "1", Role: RoleStandard},
			{Code: "2", Role: RoleBeginner},
		},
		Candidates: []string{
			`D:\Game\HoYoPlay\games\Star Rail Games`,
			`C:\Program Files\HoYoPlay\games\Star Rail Games`,
			`D:\Program Files\HoYoPlay\games\Star Rail Games`,
			`C:\Games\HoYoPlay\games\Star Rail Games`,
			`C:\Program Files\Star Rail\Games`,
		},
	},
	{
		ID:          "zzz",
		RecordPath:  "[변조] → [상세] → [변조 기록]",
		DataDirName: "ZenlessZoneZero_Data",
		BannerParam: "real_gacha_type",
		InfoFormat:  "uigf-v4.0",
		// 실측으로 확정한 채널 코드. 응답 레코드의 gacha_type 도 같은 1자리 값이다.
		Banners: []Banner{
			{Code: "2", Role: RoleLimitedChar},   // 독점(에이전트)
			{Code: "3", Role: RoleLimitedWeapon}, // 음의 엔진
			{Code: "1", Role: RoleStandard},      // 상시
			{Code: "5", Role: RoleBangboo},       // 본디
		},
		Candidates: []string{
			`D:\Game\HoYoPlay\games\ZenlessZoneZero Game`,
			`C:\Program Files\HoYoPlay\games\ZenlessZoneZero Game`,
			`D:\Program Files\HoYoPlay\games\ZenlessZoneZero Game`,
			`C:\Games\HoYoPlay\games\ZenlessZoneZero Game`,
		},
	},
}

// ByID 는 게임 ID 로 값 테이블을 찾는다. 알 수 없는 ID 는 폴백하지 않고
// ok=false 를 준다 — 서버가 400 으로 오타를 즉시 드러내기 위함이다.
func ByID(id string) (Game, bool) {
	for _, g := range games {
		if g.ID == id {
			return g, true
		}
	}
	return Game{}, false
}

// Default 는 게임 미지정 시 쓰는 게임이다. 기존 사용자 동작을 보존한다.
func Default() Game {
	g, _ := ByID("hsr")
	return g
}

// All 은 지원 게임 목록의 복사본을 반환한다.
func All() []Game {
	out := make([]Game, len(games))
	copy(out, games)
	return out
}
