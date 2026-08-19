package collector

import (
	"encoding/binary"
	"strings"
	"testing"
	"time"
)

// Chromium 블록파일 캐시 픽스처 빌더.
// data_1(256B 블록)에 엔트리 헤더를, 긴 키는 data_2(1KB 블록)에 둔다 —
// 실제 ZZZ/HSR 캐시의 authkey URL(1.5KB 안팎)이 놓이는 자리와 같다.
type cacheFixture struct {
	data1 []byte
	data2 []byte
	nextE int // 다음 엔트리 블록 번호
	nextK int // 다음 키 블록 번호
}

func newCacheFixture() *cacheFixture {
	return &cacheFixture{
		data1: make([]byte, blockHeaderSize+256*64),
		data2: make([]byte, blockHeaderSize+1024*64),
	}
}

// addEntry 는 키(URL)를 data_2 에, 엔트리 헤더를 data_1 에 쓴다.
func (f *cacheFixture) addEntry(created time.Time, key string) {
	kb := f.nextK
	f.nextK++
	copy(f.data2[blockHeaderSize+kb*1024:], key)
	addr := uint32(0x80000000) | uint32(blockFile1K)<<28 | 2<<16 | uint32(kb)
	f.writeHeader(created, len(key), addr, "")
}

// addInlineEntry 는 키를 엔트리 헤더 안에 직접 둔다(짧은 URL 경로).
func (f *cacheFixture) addInlineEntry(created time.Time, key string) {
	f.writeHeader(created, len(key), 0, key)
}

func (f *cacheFixture) writeHeader(created time.Time, keyLen int, keyAddr uint32, inlineKey string) {
	e := blockHeaderSize + f.nextE*256
	f.nextE++
	binary.LittleEndian.PutUint64(f.data1[e+24:], uint64(created.UnixMicro()+winEpochOffsetMicros))
	binary.LittleEndian.PutUint32(f.data1[e+32:], uint32(keyLen))
	binary.LittleEndian.PutUint32(f.data1[e+36:], keyAddr)
	if inlineKey != "" {
		copy(f.data1[e+entryKeyOffset:], inlineKey)
	}
}

func (f *cacheFixture) files() map[int][]byte {
	return map[int][]byte{1: f.data1, 2: f.data2}
}

const gachaURL = "https://public-operation-common-sg.hoyoverse.com/common/gacha_record/api/getGachaLog"

// 핵심 회귀: ZZZ 는 authkey 를 세션마다 새로 발급하면서도 URL 의 timestamp 쿼리는
// 옛 값을 재사용한다(2026-08-20 실측). timestamp 로 최신을 고르면 오늘 발급된
// 살아있는 authkey 를 두고 며칠 전 죽은 authkey 를 집는다 — 캐시 엔트리의
// 생성 시각이 진짜 "마지막으로 기록 화면을 연 시각"이다.
func TestParseCacheEntries_OrdersByCacheTimeNotURLTimestamp(t *testing.T) {
	f := newCacheFixture()
	old := time.Date(2026, 8, 18, 2, 43, 0, 0, time.Local)
	fresh := time.Date(2026, 8, 20, 0, 32, 0, 0, time.Local)
	// 캐시에 먼저 놓인 쪽이 timestamp 는 더 크다(= 함정).
	f.addEntry(old, "1/0/"+gachaURL+"?authkey=OLD&lang=ko&timestamp=1785284008")
	f.addEntry(fresh, "1/0/"+gachaURL+"?authkey=FRESH&lang=ko&timestamp=1785283910")

	got := parseCacheEntries(f.files())
	if len(got) != 2 {
		t.Fatalf("엔트리 2개를 기대, got %d", len(got))
	}
	if !strings.Contains(got[0].url, "authkey=FRESH") {
		t.Fatalf("캐시 생성 시각이 최신인 authkey 가 먼저여야 함, got %q", got[0].url)
	}
	if !got[0].cachedAt.Equal(fresh) {
		t.Fatalf("cachedAt = %v, want %v", got[0].cachedAt, fresh)
	}
	// 캐시 키의 파티션 접두사(1/0/)는 URL 에서 떨어져야 한다.
	if !strings.HasPrefix(got[0].url, "https://") {
		t.Fatalf("URL 은 https 로 시작해야 함(키 접두사 제거), got %q", got[0].url)
	}
}

// 짧은 URL 은 엔트리 헤더 안에 키가 인라인으로 들어간다.
func TestParseCacheEntries_InlineKey(t *testing.T) {
	f := newCacheFixture()
	at := time.Date(2026, 8, 20, 0, 30, 0, 0, time.Local)
	f.addInlineEntry(at, "https://h/common/gacha_record/api/getGachaLog?authkey=INLINE")

	got := parseCacheEntries(f.files())
	if len(got) != 1 || !strings.Contains(got[0].url, "authkey=INLINE") {
		t.Fatalf("인라인 키를 읽지 못했다: %+v", got)
	}
}

// getGachaLog 가 아닌 엔트리(이벤트 페이지·SDK 등)는 후보가 아니다.
func TestParseCacheEntries_SkipsNonGachaLog(t *testing.T) {
	f := newCacheFixture()
	at := time.Now()
	f.addEntry(at, "https://sdk.hoyoverse.com/sw.js?bundle_id=nap_global")
	f.addEntry(at, "1/0/"+gachaURL+"?authkey=X")

	got := parseCacheEntries(f.files())
	if len(got) != 1 {
		t.Fatalf("getGachaLog 엔트리만 남아야 함, got %d", len(got))
	}
}

// 캐시 포맷이 우리가 아는 구조가 아니면(게임 웹뷰 엔진 교체 등) 조용히 빈 목록을
// 주고 호출자가 regex 폴백을 쓰게 한다 — 쓰레기 값을 후보로 올리면 안 된다.
func TestParseCacheEntries_UnknownFormatYieldsNothing(t *testing.T) {
	files := map[int][]byte{1: []byte(strings.Repeat("\xde\xad\xbe\xef", 4096))}
	if got := parseCacheEntries(files); len(got) != 0 {
		t.Fatalf("알 수 없는 포맷은 빈 목록이어야 함, got %d", len(got))
	}
}
