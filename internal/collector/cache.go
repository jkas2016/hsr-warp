// Package collector 는 게임 캐시에서 authkey 를 추출하고 getGachaLog 를 증분 조회한다.
package collector

import (
	"errors"
	"log/slog"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
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
	// IssuedAt 은 채택한 authkey URL 의 timestamp 쿼리값(= 게임에서 전언 기록을
	// 마지막으로 연 시각). 만료 진단에 쓴다. timestamp 가 없으면 zero.
	IssuedAt time.Time
}

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
	matches := authURLRe.FindAll(blob, -1)
	var raw string
	var issued time.Time
	bestTS := int64(-1)
	for _, m := range matches {
		s := string(m)
		// 캐시에는 HoYoLAB·이벤트용 authkey URL이 다수 섞여 있다. 게임 내 전언 기록
		// 엔드포인트(getGachaLog)만 채택한다. 같은 캐시에 (전언 기록을 여러 번 열어)
		// getGachaLog URL이 여럿 누적될 수 있으므로, 바이트 순서가 아니라 timestamp
		// 쿼리값이 가장 큰(=가장 최근에 발급된) authkey 를 고른다.
		if !strings.Contains(s, "getGachaLog") {
			continue
		}
		ts := timestampOf(s)
		// timestamp 가 더 크거나(최신), 아직 후보가 없을 때 채택.
		// timestamp 없는(-? ts<0) URL 도 최소 한 번은 후보가 되도록 한다.
		if raw == "" || ts > bestTS {
			raw = s
			bestTS = ts
			if ts >= 0 {
				issued = time.Unix(ts, 0)
			} else {
				issued = time.Time{}
			}
		}
	}
	if raw == "" {
		return nil, errors.New("캐시에서 전언 기록 API URL을 찾지 못했습니다. 게임 내에서 전언 기록 화면을 한 번 연 뒤 다시 시도하세요")
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
			region = unescapeOr(val)
		case "lang":
			lang = unescapeOr(val)
		}
		if !pageKeys[key] {
			kept = append(kept, pair)
		}
	}
	// authkey 는 자격증명이라 절대 로그에 남기지 않는다 — 호스트·경로·지역·언어·발급시각만.
	slog.Debug("authkey 컨텍스트 추출", "api_host", u.Host, "api_path", u.Path,
		"region", region, "lang", lang, "issued", issued, "authkey_urls", len(matches))
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

// FindAuthContext 는 gamePath 의 최신 webCaches data_2 를 읽어 AuthContext 를 만든다.
func FindAuthContext(gamePath string, g game.Game) (*AuthContext, error) {
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
		return nil, errors.New("캐시 데이터(data_2)가 없습니다. 게임에서 전언 기록을 한 번 열었나요?")
	}
	chosen := latestVersion(verDirs)
	slog.Debug("캐시 버전 선택", "candidates", len(verDirs), "chosen", chosen)
	dataFile := filepath.Join(webCaches, chosen, "Cache", "Cache_Data", "data_2")
	// readShared 로 FILE_SHARE_DELETE 포함 열기 — 게임 실행 중에도 읽는다.
	blob, err := readShared(dataFile)
	if err != nil {
		return nil, err
	}
	return parseAuthURL(blob)
}
