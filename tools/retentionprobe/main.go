// retentionprobe 는 "왜 특정 시점 이전 기록이 조회되지 않는가"를 가르는 일회성 진단 도구다.
//
// 저장된 가장 오래된 레코드의 id 를 end_id 로 주고 그보다 더 과거를 API 에 직접 요청한다.
//   - 빈 목록이 오면  → 서버가 그 이전을 보관하지 않는다(수집기 정상, 복구 불가)
//   - 레코드가 오면   → 수집기가 조기 중단한 것(우리 버그, 복구 가능)
//
// 앱과 같은 코드 경로(collector.FindAuthContext)로 authkey 를 얻는다. authkey 는
// 절대 출력하지 않는다.
package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"time"

	"hsr-warp/internal/collector"
	"hsr-warp/internal/game"
)

type cfg struct {
	Games map[string]struct {
		GamePath string `json:"game_path"`
	} `json:"games"`
}

type rec struct {
	ID        string `json:"id"`
	Time      string `json:"time"`
	Name      string `json:"name"`
	GachaType string `json:"gacha_type"`
}

type resp struct {
	Retcode int    `json:"retcode"`
	Message string `json:"message"`
	Data    struct {
		List []rec `json:"list"`
	} `json:"data"`
}

// probe 는 end_id 보다 과거를 한 페이지 요청해 받은 건수를 돌려준다.
func probe(client *http.Client, ac *collector.AuthContext, g game.Game, code, endID string) (int, error) {
	u := fmt.Sprintf("%s?%s&size=20&%s=%s&page=1&end_id=%s",
		ac.APIBase, ac.BaseQuery, g.BannerParam, code, endID)
	req, _ := http.NewRequest(http.MethodGet, u, nil)
	req.Header.Set("User-Agent", "Mozilla/5.0")
	res, err := client.Do(req)
	if err != nil {
		return 0, err
	}
	body, _ := io.ReadAll(res.Body)
	res.Body.Close()
	var ar resp
	if err := json.Unmarshal(body, &ar); err != nil {
		return 0, err
	}
	if ar.Retcode != 0 {
		return 0, fmt.Errorf("retcode=%d msg=%s", ar.Retcode, ar.Message)
	}
	return len(ar.Data.List), nil
}

// main 은 인자로 받은 게임(기본 zzz)의 가장 오래된 저장 id 보다 과거를 API 에
// 요청해, 그 결과로 서버 보관 한계인지 수집기 조기 중단인지를 가른다.
func main() {
	gameID := "zzz"
	if len(os.Args) > 1 {
		gameID = os.Args[1]
	}
	g, ok := game.ByID(gameID)
	if !ok {
		fmt.Println("알 수 없는 게임:", gameID)
		os.Exit(1)
	}

	var c cfg
	raw, err := os.ReadFile("config.json")
	if err != nil {
		fmt.Println("config.json 읽기 실패:", err)
		os.Exit(1)
	}
	if err := json.Unmarshal(raw, &c); err != nil {
		fmt.Println("config.json 파싱 실패:", err)
		os.Exit(1)
	}
	gamePath := c.Games[gameID].GamePath
	if gamePath == "" {
		fmt.Println("게임 경로 미설정:", gameID)
		os.Exit(1)
	}

	ac, err := collector.FindAuthContext(gamePath, g)
	if err != nil {
		fmt.Println("authkey 추출 실패:", err)
		os.Exit(1)
	}
	fmt.Printf("authkey 발급 시각: %s (경과 %.1f시간)\n\n",
		ac.IssuedAt.Format("2006-01-02 15:04"), time.Since(ac.IssuedAt).Hours())

	// 저장된 채널별 최고(oldest) 경계 = 가장 작은 id.
	// control 은 양성 대조용 — 채널별 전체 레코드를 시간순으로 모아 중간 지점 id 를 쓴다.
	// 그 id 를 end_id 로 주면 반드시 더 과거가 있어야 한다. 여기서 빈 목록이 오면
	// 요청 형태가 잘못된 것이므로 "빈 목록 = 보관 안 함" 결론을 신뢰할 수 없다.
	all := map[string][]rec{}
	oldest := map[string]rec{}
	dir := filepath.Join("data", gameID)
	files, _ := os.ReadDir(dir)
	for _, f := range files {
		b, err := os.ReadFile(filepath.Join(dir, f.Name()))
		if err != nil {
			continue
		}
		var doc struct {
			List []rec `json:"list"`
		}
		if json.Unmarshal(b, &doc) != nil {
			continue
		}
		for _, r := range doc.List {
			all[r.GachaType] = append(all[r.GachaType], r)
			cur, seen := oldest[r.GachaType]
			if !seen || r.Time < cur.Time {
				oldest[r.GachaType] = r
			}
		}
	}

	client := &http.Client{Timeout: 20 * time.Second}
	codes := g.Codes()
	sort.Strings(codes)
	for _, code := range codes {
		o, seen := oldest[code]
		label := collector.BannerLabel(g, code)
		if !seen {
			fmt.Printf("[%s] 저장된 레코드 없음 — 건너뜀\n", label)
			continue
		}
		fmt.Printf("[%s] 저장된 최초: %s (id %s)\n", label, o.Time, o.ID)

		// 양성 대조: 중간 지점 id 로 물으면 반드시 더 과거가 와야 한다.
		rs := all[code]
		sort.Slice(rs, func(i, j int) bool { return rs[i].Time < rs[j].Time })
		if len(rs) >= 4 {
			mid := rs[len(rs)/2]
			n, err := probe(client, ac, g, code, mid.ID)
			switch {
			case err != nil:
				fmt.Printf("   [대조] 호출 실패: %v — 이 채널 결과 신뢰 불가\n", err)
			case n == 0:
				fmt.Printf("   [대조] 중간 id(%s)로도 빈 목록 — 요청 형태 문제. 결론 보류.\n\n", mid.Time)
				continue
			default:
				fmt.Printf("   [대조] 중간 id(%s) → %d건 반환 (요청 형태 정상)\n", mid.Time, n)
			}
			time.Sleep(500 * time.Millisecond)
		}

		// 그 id 를 end_id 로 = "이보다 더 과거를 달라".
		u := fmt.Sprintf("%s?%s&size=20&%s=%s&page=1&end_id=%s",
			ac.APIBase, ac.BaseQuery, g.BannerParam, code, o.ID)
		req, _ := http.NewRequest(http.MethodGet, u, nil)
		req.Header.Set("User-Agent", "Mozilla/5.0")
		res, err := client.Do(req)
		if err != nil {
			fmt.Println("   호출 실패:", err)
			continue
		}
		body, _ := io.ReadAll(res.Body)
		res.Body.Close()
		var ar resp
		if err := json.Unmarshal(body, &ar); err != nil {
			fmt.Println("   파싱 실패:", err)
			continue
		}
		if ar.Retcode != 0 {
			fmt.Printf("   API 오류 retcode=%d msg=%s\n", ar.Retcode, ar.Message)
			continue
		}
		if len(ar.Data.List) == 0 {
			fmt.Printf("   → 더 과거 없음(빈 목록). 서버가 이 이전을 보관하지 않는다.\n\n")
			continue
		}
		fmt.Printf("   → 더 과거 %d건 반환! 수집기가 놓친 것이다:\n", len(ar.Data.List))
		for _, r := range ar.Data.List {
			fmt.Printf("      %s  %s  (id %s)\n", r.Time, r.Name, r.ID)
		}
		fmt.Println()
		time.Sleep(500 * time.Millisecond)
	}
}
