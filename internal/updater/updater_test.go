package updater

import (
	"os"
	"path/filepath"
	"testing"
)

const goodSchedule = `{"version":3,"schedule":[{"s":"2023-04-26","e":"2023-05-17","c":["1102"],"l":["23001"]}]}`

func TestScheduleVersion(t *testing.T) {
	if v, ok := ScheduleVersion([]byte(goodSchedule)); !ok || v != 3 {
		t.Fatalf("good: got (%d,%v), want (3,true)", v, ok)
	}
	bad := []string{
		`not json`,
		`{"version":0,"schedule":[]}`, // version<1
		`{"version":2,"schedule":[]}`, // 빈 배열
		`{"version":2,"schedule":[{"s":"nope","e":"2023-05-17"}]}`, // 날짜 파싱 불가
	}
	for _, b := range bad {
		if _, ok := ScheduleVersion([]byte(b)); ok {
			t.Fatalf("expected invalid: %s", b)
		}
	}
}

func TestEffectiveSchedule(t *testing.T) {
	embedded := []byte(`{"version":3,"schedule":[{"s":"2023-04-26","e":"2023-05-17","c":["1102"],"l":["23001"]}]}`)
	dir := t.TempDir()
	// data/ 없음 → 내장본.
	if got := EffectiveSchedule(dir, embedded); string(got) != string(embedded) {
		t.Fatal("missing data/ should fall back to embedded")
	}
	// data/ 가 더 높은 version → data/.
	higher := []byte(`{"version":5,"schedule":[{"s":"2023-04-26","e":"2023-05-17","c":["1102"],"l":["23001"]}]}`)
	if err := os.WriteFile(filepath.Join(dir, "schedule.json"), higher, 0644); err != nil {
		t.Fatal(err)
	}
	if got := EffectiveSchedule(dir, embedded); string(got) != string(higher) {
		t.Fatal("higher data/ should win")
	}
	// data/ 가 같거나 낮으면 내장본.
	lower := []byte(`{"version":3,"schedule":[{"s":"2023-04-26","e":"2023-05-17","c":["1102"],"l":["23001"]}]}`)
	_ = os.WriteFile(filepath.Join(dir, "schedule.json"), lower, 0644)
	if got := EffectiveSchedule(dir, embedded); string(got) != string(embedded) {
		t.Fatal("equal/lower data/ should fall back to embedded")
	}
	// data/ 가 깨졌으면 내장본.
	_ = os.WriteFile(filepath.Join(dir, "schedule.json"), []byte("corrupt"), 0644)
	if got := EffectiveSchedule(dir, embedded); string(got) != string(embedded) {
		t.Fatal("corrupt data/ should fall back to embedded")
	}
}
