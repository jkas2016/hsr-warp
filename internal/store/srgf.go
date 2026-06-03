// Package store 는 SRGF v1.0 워프 기록의 로드·병합·월별 저장을 담당한다.
package store

import "math/big"

// Info 는 SRGF 메타데이터다.
type Info struct {
	UID              string `json:"uid"`
	Lang             string `json:"lang"`
	Region           string `json:"region"`
	RegionTimeZone   int    `json:"region_time_zone"`
	ExportTimestamp  int64  `json:"export_timestamp"`
	ExportApp        string `json:"export_app"`
	ExportAppVersion string `json:"export_app_version"`
	SRGFVersion      string `json:"srgf_version"`
}

// Record 는 단일 워프 기록이다. 모든 필드는 SRGF 규약상 문자열이다.
type Record struct {
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

// SRGF 는 파일 한 개의 루트 구조다.
type SRGF struct {
	Info Info     `json:"info"`
	List []Record `json:"list"`
}

// idLess 는 a < b 를 큰 정수 정밀도로 비교한다. 파싱 실패 시 문자열 비교로 폴백한다.
func idLess(a, b string) bool {
	ai, okA := new(big.Int).SetString(a, 10)
	bi, okB := new(big.Int).SetString(b, 10)
	if !okA || !okB {
		return a < b
	}
	return ai.Cmp(bi) < 0
}
