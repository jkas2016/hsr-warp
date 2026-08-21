// Package collector 는 게임 캐시에서 authkey 를 추출하고 getGachaLog 를 증분 조회한다.
package collector

import (
	"errors"
	"fmt"
	"log/slog"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"hsr-warp/internal/game"
)

// AuthContext 는 getGachaLog 호출에 필요한 베이스 정보다.
type AuthContext struct {
	APIBase   string // https://host/common/gacha_record/api/getGachaLog
	BaseQuery string // 페이지 관련 제외한 쿼리(원본 인코딩 유지), '&' 결합
	Region    string
	Lang      string
	// IssuedAt 은 이 authkey 가 캐시에 기록된 시각(= 게임에서 기록 화면을 연 시각)이다.
	// 캐시 엔트리에서 얻지 못하면 URL 의 timestamp 쿼리로 폴백하고, 그마저 없으면 zero.
	// 만료 진단에 쓴다.
	IssuedAt time.Time
}

// maxAuthCandidates 는 유효성 검증을 시도할 authkey 후보 수 상한이다.
// 캐시에는 같은 세션의 요청이 수십 건 쌓이므로(배너 4개 × 페이지) 전부 두드리면
// 서버 호출 제한(-110)에 걸린다. 중복 제거 후 최신 몇 개면 충분하다.
const maxAuthCandidates = 5

var authURLRe = regexp.MustCompile(`https://[^\x00-\x1f"\\]+?authkey=[^\x00-\x1f"\\]+`)

// 페이지네이션 시 우리가 직접 지정하므로 베이스 쿼리에서 제거할 키.
// real_gacha_type(ZZZ)은 authkey URL 에 이미 들어 있어, 제거하지 않으면 조립 시
// 중복되고 서버가 앞의 값을 채택해 모든 채널이 같은 데이터를 반환한다(실측).
var pageKeys = map[string]bool{
	"page": true, "size": true, "gacha_type": true, "real_gacha_type": true,
	"end_id": true, "begin_id": true, "default_gacha_type": true, "gacha_id": true,
}

// parseAuthURL 은 캐시 바이트에서 최신 authkey URL 을 찾아 AuthContext 로 만든다.
func parseAuthURL(blob []byte) (*AuthContext, error) {
	cands := candidatesFrom(map[int][]byte{2: blob})
	if len(cands) == 0 {
		return nil, noGachaURLError(game.Default())
	}
	return cands[0], nil
}

// noGachaURLError 는 캐시에 authkey 가 없을 때의 안내다. 진입 경로는 게임마다 다르다.
func noGachaURLError(g game.Game) error {
	return errors.New("캐시에서 기록 API URL을 찾지 못했습니다. 게임 내에서 " +
		g.RecordPath + " 화면을 한 번 연 뒤 다시 시도하세요")
}

// candidatesFrom 은 캐시 파일들에서 authkey 후보를 최신 추정 순으로 만든다.
// 1순위는 캐시 엔트리의 기록 시각, 파싱이 안 되면 URL 의 timestamp 쿼리다
// (timestamp 는 게임이 재사용하는 값이라 순서가 어긋날 수 있다 — chromecache.go 참고).
func candidatesFrom(files map[int][]byte) []*AuthContext {
	entries := parseCacheEntries(files)
	if len(entries) == 0 {
		entries = scanAuthURLs(files)
	}
	seen := map[string]bool{}
	var out []*AuthContext
	for _, e := range entries {
		ac, err := contextFromURL(e.url, e.cachedAt)
		if err != nil {
			slog.Debug("authkey URL 파싱 실패 — 건너뜀", "err", err)
			continue
		}
		key := authkeyOf(ac.BaseQuery)
		if key == "" || seen[key] {
			continue
		}
		seen[key] = true
		out = append(out, ac)
		if len(out) == maxAuthCandidates {
			break
		}
	}
	return out
}

// scanAuthURLs 는 캐시 엔트리 구조를 못 읽을 때 쓰는 폴백이다. 바이트 전체에서
// getGachaLog URL 을 긁어 timestamp 내림차순으로 준다(기록 시각은 알 수 없음).
func scanAuthURLs(files map[int][]byte) []cacheEntry {
	var out []cacheEntry
	for _, blob := range files {
		for _, m := range authURLRe.FindAll(blob, -1) {
			s := string(m)
			if !strings.Contains(s, "getGachaLog") {
				continue
			}
			out = append(out, cacheEntry{url: s})
		}
	}
	sort.SliceStable(out, func(i, j int) bool { return timestampOf(out[i].url) > timestampOf(out[j].url) })
	return out
}

// authkeyOf 는 쿼리에서 authkey 값을 꺼낸다(중복 후보 제거용).
func authkeyOf(query string) string {
	for _, pair := range strings.Split(query, "&") {
		if v, ok := strings.CutPrefix(pair, "authkey="); ok {
			return v
		}
	}
	return ""
}

// contextFromURL 은 authkey URL 하나를 AuthContext 로 만든다.
// cachedAt 이 zero 면 URL 의 timestamp 쿼리로 발급 시각을 폴백한다.
func contextFromURL(raw string, cachedAt time.Time) (*AuthContext, error) {
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
			region = unescapeOr(val)
		case "lang":
			lang = unescapeOr(val)
		}
		if !pageKeys[key] {
			kept = append(kept, pair)
		}
	}
	issued := cachedAt
	if issued.IsZero() {
		if ts := timestampOf(raw); ts >= 0 {
			issued = time.Unix(ts, 0)
		}
	}
	// authkey 는 자격증명이라 절대 로그에 남기지 않는다 — 호스트·경로·지역·언어·발급시각만.
	slog.Debug("authkey 컨텍스트 추출", "api_host", u.Host, "api_path", u.Path,
		"region", region, "lang", lang, "issued", issued)
	return &AuthContext{
		// 경로를 하드코딩하지 않고 캐시의 실제 호스트·경로를 그대로 쓴다.
		// (HoYo가 /common/gacha_record → /common/hkrpg_gacha_record 처럼 바꿔도 견딘다.)
		APIBase:   u.Scheme + "://" + u.Host + u.Path,
		BaseQuery: strings.Join(kept, "&"),
		Region:    region,
		Lang:      lang,
		IssuedAt:  issued,
	}, nil
}

// unescapeOr 는 QueryUnescape 실패 시 raw 값으로 폴백한다.
// 실패를 조용히 빈 문자열로 흘리면 region/lang 이 소실돼 이후 조회가 깨진다.
func unescapeOr(s string) string {
	if v, err := url.QueryUnescape(s); err == nil {
		return v
	}
	return s
}

// timestampOf 는 URL 쿼리의 timestamp 값을 정수로 반환한다(없으면 -1).
func timestampOf(rawURL string) int64 {
	q := rawURL
	if i := strings.IndexByte(q, '?'); i >= 0 {
		q = q[i+1:]
	}
	for _, pair := range strings.Split(q, "&") {
		if v, ok := strings.CutPrefix(pair, "timestamp="); ok {
			if n, err := strconv.ParseInt(v, 10, 64); err == nil {
				return n
			}
		}
	}
	return -1
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

// FindAuthContexts 는 gamePath 의 최신 webCaches 캐시를 읽어 authkey 후보를
// 최신 추정 순으로 만든다. 캐시에는 여러 세션의 authkey 가 쌓여 있고 어느 것이
// 살아 있는지는 호출해 봐야 알 수 있어(SelectValidAuthContext), 하나만 집지 않는다.
func FindAuthContexts(gamePath string, g game.Game) ([]*AuthContext, error) {
	webCaches := filepath.Join(gamePath, g.DataDirName, "webCaches")
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
		return nil, errors.New("캐시 데이터(data_2)가 없습니다. 게임에서 " + g.RecordPath + " 화면을 한 번 열었나요?")
	}
	chosen := latestVersion(verDirs)
	dir := filepath.Join(webCaches, chosen, "Cache", "Cache_Data")
	// 엔트리 헤더는 data_1, 긴 키는 data_2/data_3 에 나뉘어 있어 함께 읽는다.
	// readShared 로 FILE_SHARE_DELETE 포함 열기 — 게임 실행 중에도 읽는다.
	files := map[int][]byte{}
	for i := 0; i < 4; i++ {
		b, err := readShared(filepath.Join(dir, fmt.Sprintf("data_%d", i)))
		if err != nil {
			continue // data_0 등은 없거나 못 읽을 수 있다 — 있는 것만 쓴다.
		}
		files[i] = b
	}
	if len(files) == 0 {
		return nil, errors.New("캐시 데이터를 읽지 못했습니다: " + dir)
	}
	cands := candidatesFrom(files)
	if len(cands) == 0 {
		return nil, noGachaURLError(g)
	}
	slog.Debug("authkey 후보 추출", "cache_version", chosen, "candidates", len(cands))
	return cands, nil
}

// FindAuthContext 는 후보 중 가장 최신으로 추정되는 하나를 반환한다.
func FindAuthContext(gamePath string, g game.Game) (*AuthContext, error) {
	cands, err := FindAuthContexts(gamePath, g)
	if err != nil {
		return nil, err
	}
	return cands[0], nil
}
