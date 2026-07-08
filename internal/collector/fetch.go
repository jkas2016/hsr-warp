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

	"hsr-warp/internal/store"
)

// bannerOrder 는 조회 순서다(기존 PS 동일).
var bannerOrder = []string{"1", "2", "11", "12"}
var bannerName = map[string]string{"1": "일반", "2": "출발", "11": "캐릭터", "12": "광추"}

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

// expiredMessage 는 authkey 만료(-101) 시 사용자에게 보일 메시지를 만든다.
// 핵심: 게임을 "켜는 것"만으로는 authkey 가 갱신되지 않는다 — 게임 안에서 전언
// 기록 화면을 실제로 열어야 캐시에 새 authkey 가 기록된다. issuedAt(캐시의 authkey
// 생성 시각)을 알면 경과 일수를 함께 보여 "방금 켰는데 왜 만료냐"는 혼란을 푼다.
func expiredMessage(issuedAt, now time.Time) string {
	const guide = "게임을 켜는 것만으로는 authkey 가 갱신되지 않습니다. " +
		"게임 안에서 [전언] → [기록] 화면을 직접 연 뒤(목록이 보이게) 다시 조회하세요."
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

// FetchIncremental 은 배너별로 lastID 보다 최신인 기록만 수집한다.
// onProgress(배너이름, 누적신규건수) 는 페이지마다 호출된다. uid 도 반환한다.
func FetchIncremental(ctx context.Context, ac *AuthContext, lastID map[string]string, delay time.Duration, onProgress func(banner string, added int)) ([]store.Record, string, error) {
	client := &http.Client{Timeout: 20 * time.Second}
	var out []store.Record
	uid := ""
	for _, gt := range bannerOrder {
		endID := "0"
		page := 1
		added := 0
		stop := false
		for !stop {
			if err := ctx.Err(); err != nil {
				return out, uid, err
			}
			if page > maxPagesPerBanner {
				slog.Warn("배너 최대 페이지 초과 — 루프 중단", "banner", bannerName[gt], "max", maxPagesPerBanner)
				break
			}
			u := fmt.Sprintf("%s?%s&size=20&gacha_type=%s&page=%d&end_id=%s", ac.APIBase, ac.BaseQuery, gt, page, endID)
			req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
			if err != nil {
				return out, uid, fmt.Errorf("요청 생성 실패: %w", err)
			}
			req.Header.Set("User-Agent", "Mozilla/5.0")
			resp, err := client.Do(req)
			if err != nil {
				return out, uid, fmt.Errorf("API 호출 실패: %w", err)
			}
			body, readErr := io.ReadAll(resp.Body)
			resp.Body.Close()
			if readErr != nil {
				return out, uid, fmt.Errorf("응답 읽기 실패: %w", readErr)
			}
			if resp.StatusCode < 200 || resp.StatusCode >= 300 {
				return out, uid, fmt.Errorf("API HTTP 오류 (HTTP %d, 응답: %q)", resp.StatusCode, bodySnippet(body))
			}
			var ar apiResp
			if err := json.Unmarshal(body, &ar); err != nil {
				return out, uid, fmt.Errorf("응답 파싱 실패: %w (HTTP %d, 응답: %q)", err, resp.StatusCode, bodySnippet(body))
			}
			if ar.Retcode != 0 {
				switch ar.Retcode {
				case -101: // authkey timeout
					return out, uid, errors.New(expiredMessage(ac.IssuedAt, time.Now()))
				case -110: // visit too frequently (레이트 리밋)
					return out, uid, errors.New("조회가 너무 잦습니다(서버 호출 제한). 1~2분 기다린 뒤 다시 시도하세요.")
				}
				return out, uid, fmt.Errorf("API 오류 (retcode=%d): %s", ar.Retcode, ar.Message)
			}
			if len(ar.Data.List) == 0 {
				break
			}
			for _, it := range ar.Data.List {
				le, ok := idLessEq(it.ID, lastID[gt])
				if !ok {
					slog.Warn("ID 비교 실패(비숫자) — 신규로 간주해 계속",
						"id", it.ID, "last_id", lastID[gt], "banner", bannerName[gt])
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
			slog.Debug("페이지 수집", "banner", bannerName[gt], "gacha_type", gt,
				"page", page, "received", len(ar.Data.List), "added", added)
			newEndID := ar.Data.List[len(ar.Data.List)-1].ID
			if newEndID == endID {
				slog.Warn("페이지 진전 없음(end_id 불변) — 루프 중단", "banner", bannerName[gt], "end_id", endID)
				break
			}
			endID = newEndID
			page++
			onProgress(bannerName[gt], added)
			if delay > 0 {
				time.Sleep(delay)
			}
		}
		slog.Debug("배너 수집 완료", "banner", bannerName[gt], "gacha_type", gt, "added", added)
	}
	return out, uid, nil
}
