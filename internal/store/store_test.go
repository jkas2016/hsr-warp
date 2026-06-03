package store

import "testing"

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
