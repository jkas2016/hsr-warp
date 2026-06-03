// Package collector 는 게임 캐시에서 authkey 를 추출하고 getGachaLog 를 증분 조회한다.
package collector

import (
	"errors"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
)

// AuthContext 는 getGachaLog 호출에 필요한 베이스 정보다.
type AuthContext struct {
	APIBase   string // https://host/common/gacha_record/api/getGachaLog
	BaseQuery string // 페이지 관련 제외한 쿼리(원본 인코딩 유지), '&' 결합
	Region    string
	Lang      string
}

var authURLRe = regexp.MustCompile(`https://[^\x00-\x1f"\\]+?authkey=[^\x00-\x1f"\\]+`)

// 페이지네이션 시 우리가 직접 지정하므로 베이스 쿼리에서 제거할 키.
var pageKeys = map[string]bool{
	"page": true, "size": true, "gacha_type": true, "end_id": true,
	"begin_id": true, "default_gacha_type": true, "gacha_id": true,
}

// parseAuthURL 은 캐시 바이트에서 최신 authkey URL 을 찾아 AuthContext 로 만든다.
func parseAuthURL(blob []byte) (*AuthContext, error) {
	matches := authURLRe.FindAll(blob, -1)
	var raw string
	for _, m := range matches {
		s := string(m)
		if strings.Contains(s, "hkrpg") {
			raw = s // 가장 최근(마지막) 항목 채택
		}
	}
	if raw == "" {
		return nil, errors.New("캐시에서 authkey URL을 찾지 못했습니다. 게임에서 전언 기록 화면을 한 번 연 뒤 다시 시도하세요")
	}
	u, err := url.Parse(raw)
	if err != nil {
		return nil, err
	}
	// 쿼리 문자열을 원본 인코딩 보존하며 직접 파싱(authkey의 %2B 등 보존).
	var kept []string
	region, lang := "", ""
	for _, pair := range strings.Split(u.RawQuery, "&") {
		if pair == "" {
			continue
		}
		kv := strings.SplitN(pair, "=", 2)
		key := kv[0]
		val := ""
		if len(kv) == 2 {
			val = kv[1]
		}
		switch key {
		case "region":
			region, _ = url.QueryUnescape(val)
		case "lang":
			lang, _ = url.QueryUnescape(val)
		}
		if !pageKeys[key] {
			kept = append(kept, pair)
		}
	}
	return &AuthContext{
		APIBase:   u.Scheme + "://" + u.Host + "/common/gacha_record/api/getGachaLog",
		BaseQuery: strings.Join(kept, "&"),
		Region:    region,
		Lang:      lang,
	}, nil
}

// verLess 는 점으로 구분된 버전 문자열을 컴포넌트별 정수로 비교한다(비숫자는 0).
func verLess(a, b string) bool {
	as := strings.Split(a, ".")
	bs := strings.Split(b, ".")
	n := len(as)
	if len(bs) > n {
		n = len(bs)
	}
	for i := 0; i < n; i++ {
		ai, bi := 0, 0
		if i < len(as) {
			ai, _ = strconv.Atoi(as[i])
		}
		if i < len(bs) {
			bi, _ = strconv.Atoi(bs[i])
		}
		if ai != bi {
			return ai < bi
		}
	}
	return false
}

// latestVersion 은 숫자 기반으로 가장 높은 버전 이름을 반환한다(없으면 "").
func latestVersion(names []string) string {
	best := ""
	for _, n := range names {
		if best == "" || verLess(best, n) {
			best = n
		}
	}
	return best
}

// FindAuthContext 는 gamePath 의 최신 webCaches data_2 를 읽어 AuthContext 를 만든다.
func FindAuthContext(gamePath string) (*AuthContext, error) {
	webCaches := filepath.Join(gamePath, "StarRail_Data", "webCaches")
	entries, err := os.ReadDir(webCaches)
	if err != nil {
		return nil, errors.New("webCaches 폴더를 찾을 수 없습니다: " + webCaches)
	}
	// data_2 를 가진 버전 디렉터리 중 이름 기준 최신 선택.
	var verDirs []string
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		p := filepath.Join(webCaches, e.Name(), "Cache", "Cache_Data", "data_2")
		if _, err := os.Stat(p); err == nil {
			verDirs = append(verDirs, e.Name())
		}
	}
	if len(verDirs) == 0 {
		return nil, errors.New("캐시 데이터(data_2)가 없습니다. 게임에서 전언 기록을 한 번 열었나요?")
	}
	dataFile := filepath.Join(webCaches, latestVersion(verDirs), "Cache", "Cache_Data", "data_2")
	// Go 는 Windows 에서 공유 모드로 파일을 열어 게임 실행 중에도 읽기 가능.
	blob, err := os.ReadFile(dataFile)
	if err != nil {
		return nil, err
	}
	return parseAuthURL(blob)
}
