package collector

import (
	"bytes"
	"encoding/binary"
	"sort"
	"strings"
	"time"
)

// Chromium 블록파일 캐시(data_0..data_3)의 최소 파서.
//
// 왜 필요한가: authkey URL 의 timestamp 쿼리는 게임이 가챠 웹뷰 URL 을 만들 때
// 박아 넣은 값이라, 새 세션에서 새 authkey 를 발급받아도 갱신되지 않는다
// (ZZZ 2.51 실측 — 8/14·8/18·8/20 세션의 authkey 는 전부 다른데 timestamp 는
// 7/29 값 그대로). 그래서 timestamp 로 "최신"을 고르면 살아있는 authkey 를
// 캐시에 두고 며칠 전 죽은 authkey 를 집는다. 엔트리의 생성 시각만이 그
// authkey 가 실제로 언제 쓰였는지를 말해준다.
//
// 포맷을 못 알아보면(웹뷰 엔진 교체 등) 빈 목록을 주고 호출자가 regex 스캔으로
// 폴백한다 — 추측한 값을 후보로 올리지 않는다.

const (
	blockHeaderSize      = 8192                  // 블록파일 헤더(kBlockHeaderSize)
	entryBlockSize       = 256                   // data_1 = 엔트리 저장용 256B 블록
	entryKeyOffset       = 100                   // 엔트리 헤더에서 인라인 키가 시작하는 오프셋(실측)
	maxEntryKeyLen       = 64 * 1024             // 키 길이 상한(깨진 값 방어)
	winEpochOffsetMicros = 11644473600 * 1000000 // 1601-01-01 → 1970-01-01
)

// CacheAddr 상위 비트가 가리키는 블록파일 종류.
const (
	blockFile256 = 2
	blockFile1K  = 3
	blockFile4K  = 4
)

// cacheEntry 는 캐시에 기록된 요청 하나다.
type cacheEntry struct {
	url      string
	cachedAt time.Time
}

// parseCacheEntries 는 캐시에서 getGachaLog 요청을 캐시 기록 시각 내림차순으로 뽑는다.
func parseCacheEntries(files map[int][]byte) []cacheEntry {
	b := files[1] // 엔트리 헤더는 항상 data_1(256B 블록 파일)에 있다.
	if len(b) <= blockHeaderSize {
		return nil
	}
	var out []cacheEntry
	for e := blockHeaderSize; e+entryBlockSize <= len(b); e += entryBlockSize {
		at, ok := entryTime(binary.LittleEndian.Uint64(b[e+24:]))
		if !ok {
			continue
		}
		keyLen := int(int32(binary.LittleEndian.Uint32(b[e+32:])))
		if keyLen <= 0 || keyLen > maxEntryKeyLen {
			continue
		}
		u := gachaLogURLIn(entryKey(files, b, e, keyLen))
		if u == "" {
			continue
		}
		out = append(out, cacheEntry{url: u, cachedAt: at})
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].cachedAt.After(out[j].cachedAt) })
	return out
}

// entryTime 은 엔트리의 생성 시각(1601 기준 마이크로초)을 해석한다.
// 엔트리가 아닌 블록에서 읽은 쓰레기 값을 걸러내려 상식적인 범위를 요구한다.
func entryTime(raw uint64) (time.Time, bool) {
	us := int64(raw) - winEpochOffsetMicros
	t := time.UnixMicro(us)
	if t.Year() < 2015 || t.Year() > 2100 {
		return time.Time{}, false
	}
	return t, true
}

// entryKey 는 엔트리의 키(요청 URL)를 읽는다. 짧은 키는 헤더에 인라인으로,
// 긴 키(authkey URL 은 1.5KB 안팎)는 별도 블록에 저장된다.
func entryKey(files map[int][]byte, b []byte, e, keyLen int) []byte {
	if addr := binary.LittleEndian.Uint32(b[e+36:]); addr != 0 {
		return blockData(files, addr, keyLen)
	}
	start := e + entryKeyOffset
	end := start + keyLen
	if end > len(b) {
		end = len(b)
	}
	if start >= end {
		return nil
	}
	return b[start:end]
}

// blockData 는 CacheAddr 이 가리키는 블록 구간을 돌려준다.
// 외부 파일(f_xxxxxx)·rankings 주소는 키 저장에 쓰이지 않으므로 다루지 않는다.
func blockData(files map[int][]byte, addr uint32, n int) []byte {
	if addr&0x80000000 == 0 {
		return nil
	}
	var size int
	switch (addr >> 28) & 7 {
	case blockFile256:
		size = 256
	case blockFile1K:
		size = 1024
	case blockFile4K:
		size = 4096
	default:
		return nil
	}
	f, ok := files[int((addr>>16)&0xff)]
	if !ok {
		return nil
	}
	off := blockHeaderSize + int(addr&0xffff)*size
	if off >= len(f) {
		return nil
	}
	end := off + n
	if end > len(f) {
		end = len(f)
	}
	return f[off:end]
}

// gachaLogURLIn 은 캐시 키에서 getGachaLog URL 을 꺼낸다.
// 키에는 파티션 접두사("1/0/")가 붙으므로 URL 부분만 잘라낸다.
func gachaLogURLIn(key []byte) string {
	if i := bytes.IndexByte(key, 0); i >= 0 {
		key = key[:i]
	}
	m := authURLRe.Find(key)
	if m == nil {
		return ""
	}
	s := string(m)
	if !strings.Contains(s, "getGachaLog") {
		return ""
	}
	return s
}
