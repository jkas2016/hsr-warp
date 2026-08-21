package store

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"hsr-warp/internal/game"
)

// monthOf 는 "2026-06-03 12:00:00" → "202606" 으로 변환한다. 형식 불일치 시 "".
func monthOf(t string) string {
	if len(t) < 7 {
		return ""
	}
	ym := t[:7] // "2026-06"
	if ym[4] != '-' {
		return ""
	}
	return ym[:4] + ym[5:7]
}

// sortByID 는 recs 를 id 오름차순으로 제자리 정렬한다. id 는 거대 정수라
// 문자열 비교가 아닌 idLess(math/big) 로 비교한다.
func sortByID(recs []Record) {
	sort.SliceStable(recs, func(i, j int) bool { return idLess(recs[i].ID, recs[j].ID) })
}

// dedupByID 는 id 기준 중복을 제거하고 id 오름차순으로 정렬한 새 슬라이스를 반환한다.
func dedupByID(recs []Record) []Record {
	seen := make(map[string]bool, len(recs))
	out := make([]Record, 0, len(recs))
	for _, r := range recs {
		if !seen[r.ID] {
			seen[r.ID] = true
			out = append(out, r)
		}
	}
	sortByID(out)
	return out
}

// readSRGF 는 SRGF 파일을 읽는다. 선행 UTF-8 BOM(구 PowerShell 출력)을 제거한다.
// 계약: 파일이 없으면 os.ReadFile 의 원본 에러(fs.ErrNotExist 래핑)를 그대로 반환하므로
// 호출자는 os.IsNotExist(err) 로 "없음"을 구분할 수 있다(WriteAffectedMonths 가 이에 의존).
// 빈/공백 파일은 zero SRGF·nil 에러, JSON 파싱 실패는 해당 에러를 반환한다.
func readSRGF(path string) (SRGF, error) {
	var s SRGF
	b, err := os.ReadFile(path)
	if err != nil {
		return s, err
	}
	b = bytes.TrimPrefix(b, []byte{0xEF, 0xBB, 0xBF})
	if len(bytes.TrimSpace(b)) == 0 {
		return s, nil
	}
	err = json.Unmarshal(b, &s)
	return s, err
}

// writeSRGFAtomic 는 같은 디렉터리의 유니크 임시 파일에 쓰고 fsync 한 뒤 rename 으로
// 원자적 교체한다. 유니크 임시명이라 같은 월을 동시에 기록해도 서로의 임시 파일을
// 덮어쓰지 않고, rename 전 Sync 로 크래시/정전에도 온전한 내용이 남는다.
func writeSRGFAtomic(path string, s SRGF) error {
	b, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return err
	}
	dir := filepath.Dir(path)
	tmp, err := os.CreateTemp(dir, filepath.Base(path)+".*.tmp")
	if err != nil {
		return err
	}
	tmpName := tmp.Name()
	// 실패 경로에서 임시 파일이 남지 않도록 정리(성공 시 이미 rename 되어 no-op).
	defer os.Remove(tmpName)
	if _, err := tmp.Write(b); err != nil {
		tmp.Close()
		return err
	}
	// os.CreateTemp 는 0600 으로 만든다 — 명시적으로 0644 로 설정(umask 무관).
	if err := tmp.Chmod(0o644); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Sync(); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	if err := os.Rename(tmpName, path); err != nil {
		return err
	}
	syncDirBestEffort(dir)
	return nil
}

// syncDirBestEffort 는 부모 디렉터리 엔트리(생성/rename)를 디스크에 내려 rename 의
// 내구성을 완성한다. Windows 등 일부 플랫폼은 디렉터리 핸들 Sync 를 지원하지 않으므로
// 베스트에포트다(실패해도 rename 은 유효 — Debug 로만 남긴다).
func syncDirBestEffort(dir string) {
	d, err := os.Open(dir)
	if err != nil {
		slog.Debug("부모 디렉터리 열기 실패(내구성 fsync 생략)", "dir", dir, "err", err)
		return
	}
	defer d.Close()
	if err := d.Sync(); err != nil {
		slog.Debug("부모 디렉터리 fsync 미지원/실패(무시)", "dir", dir, "err", err)
	}
}

// LoadAll 은 dir 의 모든 warp_*.json 을 읽어 id 중복제거·정렬한 전체 기록과 마지막 Info 를 반환한다.
func LoadAll(dir string) ([]Record, *Info, error) {
	files, err := filepath.Glob(filepath.Join(dir, "warp_*.json"))
	if err != nil {
		return nil, nil, err
	}
	var all []Record
	var info *Info
	for _, f := range files {
		s, err := readSRGF(f)
		if err != nil {
			return nil, nil, err
		}
		all = append(all, s.List...)
		if s.Info.UID != "" {
			cp := s.Info
			info = &cp
		}
	}
	return dedupByID(all), info, nil
}

// MaxIDByBanner 는 배너별로 이미 저장된 최대 ID 를 반환한다. 증분 조회의
// 시작점이므로 게임의 모든 배너 코드가 키로 존재해야 한다.
func MaxIDByBanner(recs []Record, g game.Game) map[string]string {
	out := map[string]string{}
	for _, c := range g.Codes() {
		out[c] = "0"
	}
	for _, r := range recs {
		cur, ok := out[r.GachaType]
		if ok && idLess(cur, r.ID) {
			out[r.GachaType] = r.ID
		}
	}
	return out
}

// WriteAffectedMonths 는 newRecords 를 월별로 그룹핑해, 신규가 생긴 월 파일만
// 기존 내용과 병합(중복제거·정렬)해 재작성한다. 손대지 않은 월 파일은 보존된다.
// 같은 ID 가 기존·신규 양쪽에 있으면 신규(재조회) 레코드가 이긴다(정정 반영).
// 갱신된 월 코드 목록(정렬됨)을 반환한다.
func WriteAffectedMonths(dir string, info Info, newRecords []Record) ([]string, error) {
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, err
	}
	byMonth := map[string][]Record{}
	for _, r := range newRecords {
		m := monthOf(r.Time)
		if m == "" {
			continue
		}
		byMonth[m] = append(byMonth[m], r)
	}
	var updated []string
	for m, recs := range byMonth {
		path := filepath.Join(dir, "warp_"+m+".json")
		existing, err := readSRGF(path) // 없으면 zero 값(빈 List)
		if err != nil && !os.IsNotExist(err) {
			return nil, err
		}
		// ID 충돌 시 신규(재조회) 레코드가 이기도록 recs 를 앞에 둔다 — dedupByID 는
		// 먼저 본 레코드를 유지하므로, 정정된 이름/등급/시각이 기존 저장본을 덮어쓴다.
		// (existing.List 백킹 배열을 변이하지 않도록 새 슬라이스로 시작.)
		merged := dedupByID(append(append([]Record{}, recs...), existing.List...))
		if err := writeSRGFAtomic(path, SRGF{Info: info, List: merged}); err != nil {
			return nil, err
		}
		updated = append(updated, m)
	}
	sort.Strings(updated)
	return updated, nil
}

// TZForRegion 은 region 문자열로 SRGF region_time_zone 을 정한다(기존 PS 로직 동일).
func TZForRegion(region string) int {
	r := strings.ToLower(region)
	switch {
	case strings.Contains(r, "asia"):
		return 8
	case strings.Contains(r, "usa"):
		return -5
	case strings.Contains(r, "euro"):
		return 1
	case strings.Contains(r, "cht"):
		return 8
	default:
		return 8
	}
}
