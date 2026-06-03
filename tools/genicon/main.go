// genicon 은 대시보드 테마(짙은 라운드 사각 배경 + 골드 열차)의 아이콘을
// 표준 라이브러리만으로 생성한다. 모티프는 '별의 개척 열차'의 측면 기관차다.
// 결과물: 루트 icon.ico(exe 리소스용)와 web/favicon.ico(웹 favicon용).
// 외부 의존성 없음. 동일 디자인의 벡터본은 web/favicon.svg 에 있다(수정 시 함께 맞출 것).
//
//	go run ./tools/genicon
package main

import (
	"bytes"
	"encoding/binary"
	"image"
	"image/color"
	"image/png"
	"math"
	"os"
)

func main() {
	sizes := []int{256, 48, 32, 16}
	pngs := make([][]byte, len(sizes))
	for i, s := range sizes {
		var buf bytes.Buffer
		if err := png.Encode(&buf, render(s)); err != nil {
			panic(err)
		}
		pngs[i] = buf.Bytes()
	}
	ico := buildICO(sizes, pngs)
	must(os.WriteFile("icon.ico", ico, 0644))
	must(os.WriteFile("web/favicon.ico", ico, 0644))
}

func must(err error) {
	if err != nil {
		panic(err)
	}
}

// render 는 4배 슈퍼샘플링 후 박스 다운스케일로 부드러운 size×size 아이콘을 만든다.
// 짙은 라운드 패널 위에 골드 측면 기관차(차체+캡 지붕+창문 음각+바퀴+레일)를 그린다.
// 좌표는 모두 hi(=고해상도 변) 대비 비율로 정의해 크기에 무관하게 동일 비례를 유지한다.
func render(size int) *image.RGBA {
	const ss = 4
	hi := size * ss
	H := float64(hi)
	big := image.NewRGBA(image.Rect(0, 0, hi, hi))
	bg := color.RGBA{0x12, 0x16, 0x22, 0xff}   // 짙은 패널색
	gold := color.RGBA{0xf5, 0xc5, 0x42, 0xff} // HSR 골드
	radius := H * 0.20                          // 패널 라운드 반경

	// 각 비율을 픽셀로.
	p := func(f float64) float64 { return f * H }

	// goldAt 은 (fx,fy)가 열차(골드)에 속하면 true.
	goldAt := func(fx, fy float64) bool {
		// 차체(둥근 사각형) + 앞쪽 캡 지붕(둥근 사각형).
		body := inRoundRect(fx, fy, p(0.15), p(0.34), p(0.85), p(0.60), p(0.05))
		cab := inRoundRect(fx, fy, p(0.55), p(0.26), p(0.85), p(0.36), p(0.04))
		// 바퀴(원반) 3개.
		wheel := inDisc(fx, fy, p(0.28), p(0.62), p(0.055)) ||
			inDisc(fx, fy, p(0.50), p(0.62), p(0.055)) ||
			inDisc(fx, fy, p(0.72), p(0.62), p(0.055))
		// 레일(가는 가로 막대).
		rail := inRect(fx, fy, p(0.10), p(0.70), p(0.90), p(0.735))
		return body || cab || wheel || rail
	}

	// holeAt 은 음각(배경색으로 비울 영역): 창문들·바퀴 허브.
	holeAt := func(fx, fy float64) bool {
		windshield := inRoundRect(fx, fy, p(0.63), p(0.39), p(0.81), p(0.49), p(0.015))
		w1 := inRect(fx, fy, p(0.21), p(0.40), p(0.29), p(0.49))
		w2 := inRect(fx, fy, p(0.32), p(0.40), p(0.40), p(0.49))
		w3 := inRect(fx, fy, p(0.43), p(0.40), p(0.51), p(0.49))
		hub := inDisc(fx, fy, p(0.28), p(0.62), p(0.02)) ||
			inDisc(fx, fy, p(0.50), p(0.62), p(0.02)) ||
			inDisc(fx, fy, p(0.72), p(0.62), p(0.02))
		return windshield || w1 || w2 || w3 || hub
	}

	for y := 0; y < hi; y++ {
		for x := 0; x < hi; x++ {
			fx, fy := float64(x)+0.5, float64(y)+0.5
			if !insideRoundRect(fx, fy, H, radius) {
				continue // 바깥은 투명
			}
			if goldAt(fx, fy) && !holeAt(fx, fy) {
				big.SetRGBA(x, y, gold)
			} else {
				big.SetRGBA(x, y, bg)
			}
		}
	}
	return downscale(big, size)
}

// insideRoundRect 는 [0,side]² 라운드 사각형 내부 여부를 반환한다.
func insideRoundRect(x, y, side, r float64) bool {
	cxn := math.Min(math.Max(x, r), side-r)
	cyn := math.Min(math.Max(y, r), side-r)
	dx, dy := x-cxn, y-cyn
	return dx*dx+dy*dy <= r*r
}

// inRect 는 [x0,x1]×[y0,y1] 직사각형 내부 여부.
func inRect(px, py, x0, y0, x1, y1 float64) bool {
	return px >= x0 && px <= x1 && py >= y0 && py <= y1
}

// inDisc 는 중심 (cx,cy) 반경 r 원반 내부 여부.
func inDisc(px, py, cx, cy, r float64) bool {
	dx, dy := px-cx, py-cy
	return dx*dx+dy*dy <= r*r
}

// inRoundRect 는 임의 위치의 라운드 사각형 [x0,x1]×[y0,y1](모서리 반경 r) 내부 여부.
func inRoundRect(px, py, x0, y0, x1, y1, r float64) bool {
	if !inRect(px, py, x0, y0, x1, y1) {
		return false
	}
	cxn := math.Min(math.Max(px, x0+r), x1-r)
	cyn := math.Min(math.Max(py, y0+r), y1-r)
	dx, dy := px-cxn, py-cyn
	return dx*dx+dy*dy <= r*r
}

// downscale 은 ss×ss 박스 평균으로 축소한다.
func downscale(src *image.RGBA, size int) *image.RGBA {
	ss := src.Bounds().Dx() / size
	dst := image.NewRGBA(image.Rect(0, 0, size, size))
	for y := 0; y < size; y++ {
		for x := 0; x < size; x++ {
			var r, g, b, a int
			for dy := 0; dy < ss; dy++ {
				for dx := 0; dx < ss; dx++ {
					c := src.RGBAAt(x*ss+dx, y*ss+dy)
					r += int(c.R)
					g += int(c.G)
					b += int(c.B)
					a += int(c.A)
				}
			}
			n := ss * ss
			dst.SetRGBA(x, y, color.RGBA{uint8(r / n), uint8(g / n), uint8(b / n), uint8(a / n)})
		}
	}
	return dst
}

// buildICO 는 PNG 압축 이미지를 담는 .ico 바이트열을 만든다(Vista+ 형식).
func buildICO(sizes []int, pngs [][]byte) []byte {
	var buf bytes.Buffer
	w16 := func(v uint16) { binary.Write(&buf, binary.LittleEndian, v) }
	w32 := func(v uint32) { binary.Write(&buf, binary.LittleEndian, v) }
	w16(0) // reserved
	w16(1) // type: icon
	w16(uint16(len(sizes)))
	offset := 6 + 16*len(sizes)
	for i, s := range sizes {
		dim := byte(s)
		if s >= 256 {
			dim = 0 // 256 은 0 으로 표기
		}
		buf.WriteByte(dim) // width
		buf.WriteByte(dim) // height
		buf.WriteByte(0)   // palette
		buf.WriteByte(0)   // reserved
		w16(1)             // color planes
		w16(32)            // bits per pixel
		w32(uint32(len(pngs[i])))
		w32(uint32(offset))
		offset += len(pngs[i])
	}
	for _, p := range pngs {
		buf.Write(p)
	}
	return buf.Bytes()
}
