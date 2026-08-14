package store

import (
	"os"
	"path/filepath"
	"testing"
)

// 구버전 레이아웃(data/warp_*.json)은 data/hsr/ 로 옮겨져야 한다.
// 내용은 그대로여야 하고 원본은 남지 않아야 한다.
func TestMigrateLegacyLayout_MovesFiles(t *testing.T) {
	dir := t.TempDir()
	body := []byte(`{"info":{"uid":"1"},"list":[]}`)
	if err := os.WriteFile(filepath.Join(dir, "warp_202607.json"), body, 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "warp_202608.json"), body, 0644); err != nil {
		t.Fatal(err)
	}

	n, err := MigrateLegacyLayout(dir)
	if err != nil {
		t.Fatal(err)
	}
	if n != 2 {
		t.Errorf("이동 수 = %d, want 2", n)
	}
	got, err := os.ReadFile(filepath.Join(dir, "hsr", "warp_202607.json"))
	if err != nil {
		t.Fatalf("옮겨진 파일을 읽지 못했다: %v", err)
	}
	if string(got) != string(body) {
		t.Errorf("내용이 바뀌었다: %s", got)
	}
	if _, err := os.Stat(filepath.Join(dir, "warp_202607.json")); !os.IsNotExist(err) {
		t.Error("원본이 남아 있다")
	}
}

// 두 번 돌려도 결과가 같아야 한다. 매 실행마다 호출되므로 멱등이 아니면
// 이미 옮긴 파일을 덮어쓰거나 에러로 앱을 멈플 수 있다.
func TestMigrateLegacyLayout_IsIdempotent(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "warp_202607.json"), []byte(`{}`), 0644); err != nil {
		t.Fatal(err)
	}
	if _, err := MigrateLegacyLayout(dir); err != nil {
		t.Fatal(err)
	}
	n, err := MigrateLegacyLayout(dir)
	if err != nil {
		t.Fatalf("두 번째 실행이 실패했다: %v", err)
	}
	if n != 0 {
		t.Errorf("두 번째 실행 이동 수 = %d, want 0", n)
	}
}

// 이미 data/hsr/ 에 같은 이름이 있으면 덮어쓰지 않는다. 신규 레이아웃 쪽이
// 최신이므로 구파일로 덮으면 데이터가 사라진다.
func TestMigrateLegacyLayout_DoesNotOverwrite(t *testing.T) {
	dir := t.TempDir()
	if err := os.MkdirAll(filepath.Join(dir, "hsr"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "hsr", "warp_202607.json"), []byte(`NEW`), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "warp_202607.json"), []byte(`OLD`), 0644); err != nil {
		t.Fatal(err)
	}

	if _, err := MigrateLegacyLayout(dir); err != nil {
		t.Fatal(err)
	}
	got, err := os.ReadFile(filepath.Join(dir, "hsr", "warp_202607.json"))
	if err != nil {
		t.Fatal(err)
	}
	if string(got) != "NEW" {
		t.Errorf("신규 파일이 덮어써졌다: %s", got)
	}
}

// 새로 설치한 사용자에겐 아무 일도 일어나지 않아야 한다.
func TestMigrateLegacyLayout_NoopOnFreshInstall(t *testing.T) {
	dir := t.TempDir()
	n, err := MigrateLegacyLayout(dir)
	if err != nil {
		t.Fatalf("빈 디렉터리에서 실패했다: %v", err)
	}
	if n != 0 {
		t.Errorf("이동 수 = %d, want 0", n)
	}
	// 옮길 게 없으면 hsr 디렉터리를 만들지 않는다.
	if _, err := os.Stat(filepath.Join(dir, "hsr")); !os.IsNotExist(err) {
		t.Error("옮길 파일이 없는데 hsr 디렉터리를 만들었다")
	}
}

// data 디렉터리 자체가 없어도 에러가 아니다(첫 실행).
func TestMigrateLegacyLayout_MissingDirIsNotError(t *testing.T) {
	n, err := MigrateLegacyLayout(filepath.Join(t.TempDir(), "nope"))
	if err != nil {
		t.Errorf("없는 디렉터리에서 에러가 났다: %v", err)
	}
	if n != 0 {
		t.Errorf("이동 수 = %d, want 0", n)
	}
}

// schedule.json 같은 비-기록 파일은 건드리지 않는다. updater 가 data 루트에
// 이 파일을 쓰기 때문에 옮기면 override 가 사라진다.
func TestMigrateLegacyLayout_LeavesNonRecordFiles(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "schedule.json"), []byte(`{}`), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "warp_202607.json"), []byte(`{}`), 0644); err != nil {
		t.Fatal(err)
	}
	if _, err := MigrateLegacyLayout(dir); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(dir, "schedule.json")); err != nil {
		t.Error("schedule.json 이 옮겨졌다")
	}
}
