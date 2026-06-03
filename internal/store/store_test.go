package store

import (
	"os"
	"path/filepath"
	"testing"
)

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

func TestMaxIDByBanner(t *testing.T) {
	recs := []Record{rec("5", "11", "t", "3"), rec("9", "11", "t", "3"), rec("3", "12", "t", "3")}
	m := MaxIDByBanner(recs)
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
