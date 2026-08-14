package store

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"testing"

	"hsr-warp/internal/game"
)

// readSRGF 는 미존재 파일에 대해 os.IsNotExist 로 구분 가능한 에러를 반환해야 한다(계약).
func TestReadSRGF_MissingFileIsNotExist(t *testing.T) {
	_, err := readSRGF(filepath.Join(t.TempDir(), "warp_209901.json"))
	if !os.IsNotExist(err) {
		t.Fatalf("미존재 파일은 os.IsNotExist 에러여야 함, got %v", err)
	}
}

func TestIDLess_BigIntPrecision(t *testing.T) {
	// 16자리 이상 — float64로는 구분 불가한 인접 값
	a := "1700000000000000001"
	b := "1700000000000000002"
	if !idLess(a, b) {
		t.Fatalf("expected %s < %s", a, b)
	}
	if idLess(b, a) {
		t.Fatalf("expected NOT %s < %s", b, a)
	}
	if idLess(a, a) {
		t.Fatalf("equal must not be less")
	}
}

func rec(id, gt, tm, rank string) Record {
	return Record{ID: id, GachaType: gt, Time: tm, RankType: rank, Name: "X", ItemID: "1001"}
}

func TestWriteAffectedMonths_PreservesUntouchedMonths(t *testing.T) {
	dir := t.TempDir()
	info := Info{UID: "100", SRGFVersion: "v1.0"}

	may := []Record{rec("10", "11", "2026-05-10 12:00:00", "3")}
	if _, err := WriteAffectedMonths(dir, info, may); err != nil {
		t.Fatal(err)
	}
	mayPath := filepath.Join(dir, "warp_202605.json")
	mayBefore, err := os.ReadFile(mayPath)
	if err != nil {
		t.Fatalf("reading may file: %v", err)
	}

	jun := []Record{rec("20", "11", "2026-06-01 09:00:00", "5")}
	updated, err := WriteAffectedMonths(dir, info, jun)
	if err != nil {
		t.Fatal(err)
	}
	if len(updated) != 1 || updated[0] != "202606" {
		t.Fatalf("expected only 202606 updated, got %v", updated)
	}
	mayAfter, _ := os.ReadFile(mayPath)
	if string(mayBefore) != string(mayAfter) {
		t.Fatalf("untouched month 202605 was modified")
	}
	if _, err := os.Stat(filepath.Join(dir, "warp_202606.json")); err != nil {
		t.Fatalf("202606 not written: %v", err)
	}
}

func TestWriteAffectedMonths_MergesAndDedupsWithinMonth(t *testing.T) {
	dir := t.TempDir()
	info := Info{UID: "100"}
	first := []Record{rec("10", "11", "2026-06-01 09:00:00", "3")}
	if _, err := WriteAffectedMonths(dir, info, first); err != nil {
		t.Fatal(err)
	}
	more := []Record{rec("10", "11", "2026-06-01 09:00:00", "3"), rec("11", "11", "2026-06-02 09:00:00", "5")}
	if _, err := WriteAffectedMonths(dir, info, more); err != nil {
		t.Fatal(err)
	}
	all, _, err := LoadAll(dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(all) != 2 {
		t.Fatalf("expected 2 deduped records, got %d", len(all))
	}
	if all[0].ID != "10" || all[1].ID != "11" {
		t.Fatalf("expected id-sorted [10,11], got [%s,%s]", all[0].ID, all[1].ID)
	}
}

// 같은 ID 를 정정된 값으로 재조회하면 신규 레코드가 기존을 덮어써야 한다(신규 우선).
// 현재는 기존 우선이라 정정된 이름/등급이 조용히 버려진다.
func TestWriteAffectedMonths_NewRecordWinsOnIDCollision(t *testing.T) {
	dir := t.TempDir()
	info := Info{UID: "1"}
	old := Record{ID: "10", GachaType: "11", Time: "2026-06-01 09:00:00", RankType: "3", Name: "구명칭", ItemID: "1001"}
	if _, err := WriteAffectedMonths(dir, info, []Record{old}); err != nil {
		t.Fatal(err)
	}
	// 같은 ID 를 정정된 이름/등급으로 재조회.
	corrected := Record{ID: "10", GachaType: "11", Time: "2026-06-01 09:00:00", RankType: "5", Name: "정정명칭", ItemID: "1001"}
	if _, err := WriteAffectedMonths(dir, info, []Record{corrected}); err != nil {
		t.Fatal(err)
	}
	s, err := readSRGF(filepath.Join(dir, "warp_202606.json"))
	if err != nil {
		t.Fatal(err)
	}
	var got []Record
	for _, r := range s.List {
		if r.ID == "10" {
			got = append(got, r)
		}
	}
	if len(got) != 1 {
		t.Fatalf("ID 10 은 dedup 되어 1개여야 함, got %d", len(got))
	}
	if got[0].Name != "정정명칭" || got[0].RankType != "5" {
		t.Fatalf("신규 우선이어야 함: got Name=%q Rank=%q", got[0].Name, got[0].RankType)
	}
}

// rename 실패 시 임시 파일이 남지 않아야 한다(고정 temp명 시절 누수 방지).
func TestWriteSRGFAtomic_CleansTempOnFailure(t *testing.T) {
	dir := t.TempDir()
	// target 을 디렉터리로 만들어 os.Rename(tmp, target) 을 실패시킨다.
	target := filepath.Join(dir, "warp_202606.json")
	if err := os.Mkdir(target, 0o755); err != nil {
		t.Fatal(err)
	}
	err := writeSRGFAtomic(target, SRGF{List: []Record{{ID: "1", Time: "2026-06-01 00:00:00"}}})
	if err == nil {
		t.Fatal("target 이 디렉터리이므로 rename 실패를 기대")
	}
	leftovers, _ := filepath.Glob(filepath.Join(dir, "*.tmp"))
	if len(leftovers) != 0 {
		t.Fatalf("임시 파일이 정리되지 않음: %v", leftovers)
	}
}

// 같은 월을 여러 goroutine 이 동시에 기록해도 파일이 손상(파싱 불가)되거나
// .tmp 잔여물이 남지 않아야 한다. (store 계층은 무손상만 보장 — 병합/유실 방지는
// server 의 거절 가드 담당이라 최종 레코드 수는 검증하지 않는다.)
func TestWriteAffectedMonths_ConcurrentNoCorruption(t *testing.T) {
	dir := t.TempDir()
	info := Info{UID: "1"}
	var wg sync.WaitGroup
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			rec := Record{ID: strconv.Itoa(1000 + i), GachaType: "11", Time: "2026-06-01 00:00:00"}
			_, _ = WriteAffectedMonths(dir, info, []Record{rec})
		}(i)
	}
	wg.Wait()
	s, err := readSRGF(filepath.Join(dir, "warp_202606.json"))
	if err != nil {
		t.Fatalf("동시 기록 후 파일 손상: %v", err)
	}
	if len(s.List) == 0 {
		t.Fatal("최소 한 레코드는 남아야 함")
	}
	if leftovers, _ := filepath.Glob(filepath.Join(dir, "*.tmp")); len(leftovers) != 0 {
		t.Fatalf("temp 잔여물: %v", leftovers)
	}
}

func TestMaxIDByBanner(t *testing.T) {
	hsr, _ := game.ByID("hsr")
	recs := []Record{rec("5", "11", "t", "3"), rec("9", "11", "t", "3"), rec("3", "12", "t", "3")}
	m := MaxIDByBanner(recs, hsr)
	if m["11"] != "9" {
		t.Fatalf("expected max 9 for banner 11, got %s", m["11"])
	}
	if m["12"] != "3" {
		t.Fatalf("expected max 3 for banner 12, got %s", m["12"])
	}
	if m["1"] != "0" {
		t.Fatalf("expected baseline 0 for banner 1, got %s", m["1"])
	}
}

// 게임별 디렉터리는 서로를 침범하지 않아야 한다. 구조는 그대로고 dir 만
// 다르므로, 같은 월 파일명이 양쪽에 생겨도 내용이 섞이면 안 된다.
func TestWriteAffectedMonths_IsolatesGames(t *testing.T) {
	root := t.TempDir()
	hsrDir := filepath.Join(root, "hsr")
	zzzDir := filepath.Join(root, "zzz")

	hsrRec := []Record{{ID: "100", GachaType: "11", Time: "2026-08-01 10:00:00", ItemID: "1102", RankType: "5"}}
	zzzRec := []Record{{ID: "200", GachaType: "2", Time: "2026-08-01 10:00:00", ItemID: "1191", RankType: "4"}}

	if _, err := WriteAffectedMonths(hsrDir, Info{UID: "1"}, hsrRec); err != nil {
		t.Fatal(err)
	}
	if _, err := WriteAffectedMonths(zzzDir, Info{UID: "2"}, zzzRec); err != nil {
		t.Fatal(err)
	}

	h, hi, err := LoadAll(hsrDir)
	if err != nil {
		t.Fatal(err)
	}
	z, zi, err := LoadAll(zzzDir)
	if err != nil {
		t.Fatal(err)
	}
	if len(h) != 1 || h[0].ID != "100" {
		t.Errorf("hsr 레코드 = %+v, want ID 100 하나", h)
	}
	if len(z) != 1 || z[0].ID != "200" {
		t.Errorf("zzz 레코드 = %+v, want ID 200 하나", z)
	}
	if hi == nil || hi.UID != "1" || zi == nil || zi.UID != "2" {
		t.Error("info 가 게임 간에 섞였다")
	}
}

// 증분 조회의 시작점은 게임의 배너 코드마다 있어야 한다. HSR 코드가 ZZZ 조회에
// 쓰이면 모든 채널이 처음부터 다시 긁힌다.
func TestMaxIDByBanner_UsesGameCodes(t *testing.T) {
	zzz, _ := game.ByID("zzz")
	got := MaxIDByBanner(nil, zzz)
	for _, c := range zzz.Codes() {
		if got[c] != "0" {
			t.Errorf("zzz 코드 %q 기본값 = %q, want 0", c, got[c])
		}
	}
	if _, ok := got["11"]; ok {
		t.Error("zzz 결과에 HSR 코드 11 이 들어 있다")
	}

	hsr, _ := game.ByID("hsr")
	recs := []Record{
		{ID: "500", GachaType: "11"},
		{ID: "400", GachaType: "11"},
		{ID: "700", GachaType: "12"},
	}
	h := MaxIDByBanner(recs, hsr)
	if h["11"] != "500" {
		t.Errorf("hsr 11 최대 ID = %q, want 500", h["11"])
	}
	if h["12"] != "700" {
		t.Errorf("hsr 12 최대 ID = %q, want 700", h["12"])
	}
	if h["1"] != "0" || h["2"] != "0" {
		t.Errorf("레코드 없는 채널 기본값이 0 이 아니다: %+v", h)
	}
}

// 한 Info 구조체가 두 규격을 표현한다. 쓰지 않는 버전 필드는 JSON 에서
// 빠져야 규격 검증기가 통과한다.
func TestInfo_VersionFieldsAreExclusive(t *testing.T) {
	srgf, err := json.Marshal(Info{UID: "1", SRGFVersion: "v1.0"})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(srgf), `"srgf_version":"v1.0"`) {
		t.Errorf("srgf_version 이 빠졌다: %s", srgf)
	}
	if strings.Contains(string(srgf), "uigf_version") {
		t.Errorf("HSR info 에 uigf_version 이 들어갔다: %s", srgf)
	}

	uigf, err := json.Marshal(Info{UID: "2", UIGFVersion: "v4.0"})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(uigf), `"uigf_version":"v4.0"`) {
		t.Errorf("uigf_version 이 빠졌다: %s", uigf)
	}
	if strings.Contains(string(uigf), "srgf_version") {
		t.Errorf("ZZZ info 에 srgf_version 이 들어갔다: %s", uigf)
	}
}
