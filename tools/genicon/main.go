// genicon 은 대시보드 테마(짙은 라운드 사각 배경 + 골드 5각 별)의 아이콘을
// 표준 라이브러리만으로 생성한다. 결과물: 루트 icon.ico(exe 리소스용)와
// web/favicon.ico(웹 favicon용). 외부 의존성 없음.
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
func render(size int) *image.RGBA {
	const ss = 4
	hi := size * ss
	big := image.NewRGBA(image.Rect(0, 0, hi, hi))
	bg := color.RGBA{0x12, 0x16, 0x22, 0xff}   // 짙은 패널색
	gold := color.RGBA{0xf5, 0xc5, 0x42, 0xff} // HSR 골드(별)
	radius := float64(hi) * 0.20               // 라운드 코너 반경

	// 5각 별 꼭짓점(위쪽 시작, 외/내 반경 교차)
	cx, cy := float64(hi)/2, float64(hi)/2
	outer, inner := float64(hi)*0.37, float64(hi)*0.37*0.40
	pts := make([][2]float64, 10)
	for i := 0; i < 10; i++ {
		ang := -math.Pi/2 + float64(i)*math.Pi/5
		r := outer
		if i%2 == 1 {
			r = inner
		}
		pts[i] = [2]float64{cx + r*math.Cos(ang), cy + r*math.Sin(ang)}
	}

	for y := 0; y < hi; y++ {
		for x := 0; x < hi; x++ {
			fx, fy := float64(x), float64(y)
			if !insideRoundRect(fx, fy, float64(hi), radius) {
				continue // 바깥은 투명
			}
			if pointInPoly(fx+0.5, fy+0.5, pts) {
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

// pointInPoly 는 짝/홀(even-odd) 광선 투사로 다각형 내부 여부를 판정한다.
func pointInPoly(px, py float64, poly [][2]float64) bool {
	in := false
	n := len(poly)
	j := n - 1
	for i := 0; i < n; i++ {
		xi, yi := poly[i][0], poly[i][1]
		xj, yj := poly[j][0], poly[j][1]
		if (yi > py) != (yj > py) {
			xint := (xj-xi)*(py-yi)/(yj-yi) + xi
			if px < xint {
				in = !in
			}
		}
		j = i
	}
	return in
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
