package collector

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"time"

	"hsr-warp/internal/store"
)

// bannerOrder 는 조회 순서다(기존 PS 동일).
var bannerOrder = []string{"1", "2", "11", "12"}
var bannerName = map[string]string{"1": "일반", "2": "출발", "11": "캐릭터", "12": "광추"}

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

func idLessEq(a, b string) bool {
	ai, okA := new(big.Int).SetString(a, 10)
	bi, okB := new(big.Int).SetString(b, 10)
	if !okA || !okB {
		return a <= b
	}
	return ai.Cmp(bi) <= 0
}

// FetchIncremental 은 배너별로 lastID 보다 최신인 기록만 수집한다.
// onProgress(배너이름, 누적신규건수) 는 페이지마다 호출된다. uid 도 반환한다.
func FetchIncremental(ac *AuthContext, lastID map[string]string, delay time.Duration, onProgress func(banner string, added int)) ([]store.Record, string, error) {
	client := &http.Client{Timeout: 20 * time.Second}
	var out []store.Record
	uid := ""
	for _, gt := range bannerOrder {
		endID := "0"
		page := 1
		added := 0
		stop := false
		for !stop {
			u := fmt.Sprintf("%s?%s&size=20&gacha_type=%s&page=%d&end_id=%s", ac.APIBase, ac.BaseQuery, gt, page, endID)
			req, _ := http.NewRequest(http.MethodGet, u, nil)
			req.Header.Set("User-Agent", "Mozilla/5.0")
			resp, err := client.Do(req)
			if err != nil {
				return out, uid, fmt.Errorf("API 호출 실패: %w", err)
			}
			body, _ := io.ReadAll(resp.Body)
			resp.Body.Close()
			var ar apiResp
			if err := json.Unmarshal(body, &ar); err != nil {
				return out, uid, fmt.Errorf("응답 파싱 실패: %w", err)
			}
			if ar.Retcode != 0 {
				if ar.Retcode == -101 {
					return out, uid, errors.New("authkey 만료. 게임에서 전언 기록을 다시 열고 재시도하세요")
				}
				return out, uid, fmt.Errorf("API 오류 (retcode=%d): %s", ar.Retcode, ar.Message)
			}
			if len(ar.Data.List) == 0 {
				break
			}
			for _, it := range ar.Data.List {
				if idLessEq(it.ID, lastID[gt]) {
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
			endID = ar.Data.List[len(ar.Data.List)-1].ID
			page++
			onProgress(bannerName[gt], added)
			if delay > 0 {
				time.Sleep(delay)
			}
		}
	}
	return out, uid, nil
}
