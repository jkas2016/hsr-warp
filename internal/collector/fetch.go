package collector

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"math/big"
	"net/http"
	"strings"
	"time"

	"hsr-warp/internal/game"
	"hsr-warp/internal/store"
)

// 배너 표시명은 로그·SSE progress 용이다. 게임마다 채널 코드가 다르므로
// 코드가 아니라 역할에서 유도한다.
var roleName = map[string]string{
	game.RoleLimitedChar:   "캐릭터",
	game.RoleLimitedWeapon: "무기",
	game.RoleStandard:      "일반",
	game.RoleBeginner:      "출발",
	game.RoleBangboo:       "본디",
}

// BannerLabel 은 배너 코드의 사람이 읽는 이름을 반환한다.
// 알 수 없는 코드는 코드 자체로 폴백해 로그가 비지 않게 한다.
func BannerLabel(g game.Game, code string) string {
	if n, ok := roleName[g.RoleOf(code)]; ok {
		return n
	}
	return code
}

// maxPagesPerBanner 는 배너당 페이지 백스톱이다. 정상 조회는 수십 페이지 이내라
// 이 상한에 닿을 일이 없고, 서버가 end_id 를 무시해 진전이 없을 때의 안전장치다.
const maxPagesPerBanner = 1000

type apiRecord struct {
	UID       string `json:"uid"`
	GachaID   string `json:"gacha_id"`
	GachaType string `json:"gacha_type"`
	ItemID    string `json:"item_id"`
	Count     string `json:"count"`
	Time      string `json:"time"`
	Name      string `json:"name"`
	ItemType  string `json:"item_type"`
	RankType  string `json:"rank_type"`
	ID        string `json:"id"`
}

type apiResp struct {
	Retcode int    `json:"retcode"`
	Message string `json:"message"`
	Data    struct {
		List []apiRecord `json:"list"`
	} `json:"data"`
}

// isAuthkeyExpired 는 응답이 authkey 만료인지 판정한다.
// 만료 코드는 엔드포인트마다 다르다 — HSR(public-operation-hkrpg)은 retcode=-101,
// ZZZ(public-operation-common)는 retcode=-1 + message "auth key time out"(2026-08-20 실측).
// 코드 값에 기대면 게임이 늘 때마다 만료 안내를 놓치므로 메시지도 함께 본다.
func isAuthkeyExpired(retcode int, message string) bool {
	if retcode == -101 {
		return true
	}
	norm := strings.ToLower(strings.ReplaceAll(message, " ", ""))
	return strings.Contains(norm, "authkeytimeout")
}

// expiredMessage 는 authkey 만료 시 사용자에게 보일 메시지를 만든다.
// 핵심: 게임을 "켜는 것"만으로는 authkey 가 갱신되지 않는다 — 게임 안에서 기록
// 화면을 실제로 열어야 캐시에 새 authkey 가 기록된다. issuedAt(캐시에 그 authkey 가
// 기록된 시각)을 알면 경과 일수를 함께 보여 "방금 켰는데 왜 만료냐"는 혼란을 푼다.
// 진입 경로는 게임마다 다르므로 값 테이블에서 가져온다(HSR 용어를 ZZZ 사용자에게
// 들이밀면 없는 메뉴를 찾게 된다).
func expiredMessage(g game.Game, issuedAt, now time.Time) string {
	guide := "게임을 켜는 것만으로는 authkey 가 갱신되지 않습니다. " +
		"게임 안에서 " + g.RecordPath + " 화면을 직접 연 뒤(목록이 보이게) 다시 조회하세요."
	if issuedAt.IsZero() {
		return "authkey 만료. " + guide
	}
	days := int(now.Sub(issuedAt).Hours() / 24)
	if days < 0 {
		days = 0
	}
	return fmt.Sprintf("authkey 만료 — 캐시의 authkey 는 %s 에 발급된 것으로 %d일 지났습니다. %s",
		issuedAt.Format("2006-01-02 15:04"), days, guide)
}

// idLessEq 는 a <= b 를 big.Int 로 비교한다(ID 는 거대 정수 불변식 — 사전식 금지).
// 두 번째 반환값 ok 는 파싱 성공 여부 — 비숫자면 (false, false) 를 주고 호출자가 진단·판단한다.
func idLessEq(a, b string) (le bool, ok bool) {
	ai, okA := new(big.Int).SetString(a, 10)
	bi, okB := new(big.Int).SetString(b, 10)
	if !okA || !okB {
		return false, false
	}
	return ai.Cmp(bi) <= 0, true
}

// bodySnippet 은 응답 본문을 로그·에러용 최대 200자 스니펫으로 줄인다.
func bodySnippet(b []byte) string {
	s := strings.TrimSpace(string(b))
	if len(s) > 200 {
		return s[:200] + "…"
	}
	return s
}

// callGachaLog 는 getGachaLog 를 한 번 호출해 응답을 파싱한다.
func callGachaLog(ctx context.Context, client *http.Client, url string) (*apiResp, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("요청 생성 실패: %w", err)
	}
	req.Header.Set("User-Agent", "Mozilla/5.0")
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("API 호출 실패: %w", err)
	}
	body, readErr := io.ReadAll(resp.Body)
	resp.Body.Close()
	if readErr != nil {
		return nil, fmt.Errorf("응답 읽기 실패: %w", readErr)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("API HTTP 오류 (HTTP %d, 응답: %q)", resp.StatusCode, bodySnippet(body))
	}
	var ar apiResp
	if err := json.Unmarshal(body, &ar); err != nil {
		return nil, fmt.Errorf("응답 파싱 실패: %w (HTTP %d, 응답: %q)", err, resp.StatusCode, bodySnippet(body))
	}
	return &ar, nil
}

// apiError 는 retcode != 0 응답을 사용자용 에러로 바꾼다.
func apiError(g game.Game, ac *AuthContext, ar *apiResp) error {
	if isAuthkeyExpired(ar.Retcode, ar.Message) {
		return errors.New(expiredMessage(g, ac.IssuedAt, time.Now()))
	}
	if ar.Retcode == -110 { // visit too frequently (레이트 리밋)
		return errors.New("조회가 너무 잦습니다(서버 호출 제한). 1~2분 기다린 뒤 다시 시도하세요.")
	}
	return fmt.Errorf("API 오류 (retcode=%d): %s", ar.Retcode, ar.Message)
}

// SelectValidAuthContext 는 후보를 순서대로 가볍게 두드려 만료되지 않은 첫 authkey 를
// 고른다. 캐시에는 여러 세션의 authkey 가 쌓여 있고, 순서 추정(캐시 기록 시각)이
// 틀릴 수 있는 이상 실제 호출만이 유효성의 근거다. 만료가 아닌 오류는 다음 후보로
// 넘기지 않고 즉시 표면화한다 — 레이트 리밋을 더 깊게 만들 뿐이다.
func SelectValidAuthContext(ctx context.Context, cands []*AuthContext, g game.Game) (*AuthContext, error) {
	if len(cands) == 0 {
		return nil, errors.New("authkey 후보가 없습니다")
	}
	if len(cands) == 1 {
		return cands[0], nil // 대안이 없으면 검증은 헛호출일 뿐이다.
	}
	client := &http.Client{Timeout: 20 * time.Second}
	for i, ac := range cands {
		u := fmt.Sprintf("%s?%s&size=1&%s=%s&page=1&end_id=0",
			ac.APIBase, ac.BaseQuery, g.BannerParam, g.Codes()[0])
		ar, err := callGachaLog(ctx, client, u)
		if err != nil {
			return nil, err
		}
		if ar.Retcode == 0 {
			if i > 0 {
				slog.Info("만료된 authkey 후보를 건너뜀", "skipped", i, "candidates", len(cands))
			}
			return ac, nil
		}
		if !isAuthkeyExpired(ar.Retcode, ar.Message) {
			return nil, apiError(g, ac, ar)
		}
		slog.Debug("authkey 후보 만료", "index", i, "issued", ac.IssuedAt)
	}
	// 전부 만료 — 경과 일수는 가장 최신 후보 기준으로 알린다.
	return nil, errors.New(expiredMessage(g, cands[0].IssuedAt, time.Now()))
}

// FetchIncremental 은 배너별로 lastID 보다 최신인 기록만 수집한다.
// onProgress(배너이름, 누적신규건수) 는 페이지마다 호출된다. uid 도 반환한다.
func FetchIncremental(ctx context.Context, ac *AuthContext, g game.Game, lastID map[string]string, delay time.Duration, onProgress func(banner string, added int)) ([]store.Record, string, error) {
	client := &http.Client{Timeout: 20 * time.Second}
	var out []store.Record
	uid := ""
	for _, gt := range g.Codes() {
		endID := "0"
		page := 1
		added := 0
		stop := false
		for !stop {
			if err := ctx.Err(); err != nil {
				return out, uid, err
			}
			if page > maxPagesPerBanner {
				slog.Warn("배너 최대 페이지 초과 — 루프 중단", "banner", BannerLabel(g, gt), "max", maxPagesPerBanner)
				break
			}
			u := fmt.Sprintf("%s?%s&size=20&%s=%s&page=%d&end_id=%s",
				ac.APIBase, ac.BaseQuery, g.BannerParam, gt, page, endID)
			ar, err := callGachaLog(ctx, client, u)
			if err != nil {
				return out, uid, err
			}
			if ar.Retcode != 0 {
				return out, uid, apiError(g, ac, ar)
			}
			if len(ar.Data.List) == 0 {
				break
			}
			for _, it := range ar.Data.List {
				le, ok := idLessEq(it.ID, lastID[gt])
				if !ok {
					slog.Warn("ID 비교 실패(비숫자) — 신규로 간주해 계속",
						"id", it.ID, "last_id", lastID[gt], "banner", BannerLabel(g, gt))
				} else if le {
					stop = true
					break
				}
				if uid == "" {
					uid = it.UID
				}
				out = append(out, store.Record{
					GachaID: it.GachaID, GachaType: it.GachaType, ItemID: it.ItemID,
					Count: it.Count, Time: it.Time, Name: it.Name,
					ItemType: it.ItemType, RankType: it.RankType, ID: it.ID,
				})
				added++
			}
			slog.Debug("페이지 수집", "banner", BannerLabel(g, gt), "gacha_type", gt,
				"page", page, "received", len(ar.Data.List), "added", added)
			newEndID := ar.Data.List[len(ar.Data.List)-1].ID
			if newEndID == endID {
				slog.Warn("페이지 진전 없음(end_id 불변) — 루프 중단", "banner", BannerLabel(g, gt), "end_id", endID)
				break
			}
			endID = newEndID
			page++
			onProgress(BannerLabel(g, gt), added)
			if delay > 0 {
				time.Sleep(delay)
			}
		}
		slog.Debug("배너 수집 완료", "banner", BannerLabel(g, gt), "gacha_type", gt, "added", added)
	}
	return out, uid, nil
}
