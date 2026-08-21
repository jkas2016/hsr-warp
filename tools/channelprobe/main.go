// channelprobe 는 ZZZ/HSR 의 채널 코드(real_gacha_type/gacha_type)를 실측한다.
// 신규 특별 채널이 열리면 game.go 의 Banners 목록에 없는 코드로 배포되므로,
// 후보 코드를 직접 두드려 어떤 코드가 레코드를 돌려주는지 확인한다.
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"hsr-warp/internal/collector"
	"hsr-warp/internal/game"
)

// main 은 <gameID> <gamePath> 두 인자를 받아 후보 채널 코드를 차례로 두드리고,
// 레코드를 돌려준 코드만 출력한다.
func main() {
	gid, path := os.Args[1], os.Args[2]
	g, _ := game.ByID(gid)
	cands, err := collector.FindAuthContexts(path, g)
	if err != nil {
		fmt.Println("authkey 탐색 실패:", err)
		return
	}
	ctx := context.Background()
	ac, err := collector.SelectValidAuthContext(ctx, cands, g)
	if err != nil {
		fmt.Println("유효 authkey 없음:", err)
		return
	}
	client := &http.Client{Timeout: 20 * time.Second}
	for _, code := range os.Args[3:] {
		u := fmt.Sprintf("%s?%s&size=20&%s=%s&page=1&end_id=0", ac.APIBase, ac.BaseQuery, g.BannerParam, code)
		resp, err := client.Get(u)
		if err != nil {
			fmt.Printf("code=%-3s ERR %v\n", code, err)
			continue
		}
		b, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		var ar struct {
			Retcode int    `json:"retcode"`
			Message string `json:"message"`
			Data    struct {
				List []struct {
					GachaID   string `json:"gacha_id"`
					GachaType string `json:"gacha_type"`
					ItemID    string `json:"item_id"`
					Name      string `json:"name"`
					RankType  string `json:"rank_type"`
					Time      string `json:"time"`
					ID        string `json:"id"`
				} `json:"list"`
			} `json:"data"`
		}
		// 파싱 실패를 삼키면 retcode=0 n=0 으로 찍혀 "이 코드엔 기록이 없다" 로
		// 오독된다 — 진단 도구에서 가장 위험한 실패 모드라 명시적으로 드러낸다.
		if err := json.Unmarshal(b, &ar); err != nil {
			fmt.Printf("code=%-3s 응답 파싱 실패: %v\n", code, err)
			continue
		}
		fmt.Printf("code=%-3s retcode=%-5d n=%-3d msg=%s\n", code, ar.Retcode, len(ar.Data.List), ar.Message)
		for i, r := range ar.Data.List {
			if i >= 8 {
				break
			}
			fmt.Printf("        %s gacha_type=%s item=%s rank=%s %s\n", r.Time, r.GachaType, r.ItemID, r.RankType, r.Name)
		}
		time.Sleep(400 * time.Millisecond)
	}
}
