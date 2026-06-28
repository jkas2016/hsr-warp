# HSR 워프 대시보드

붕괴: 스타레일의 **전언(워프) 기록**을 내 PC로 가져와 **천장·운·픽뚫(50/50)·월별 통계**를 보여주는 작은 프로그램입니다. 설치 마법사로 설치하고 실행하면 브라우저에 대시보드가 자동으로 열립니다.

- **간편 설치** — 관리자 권한 없이 설치 마법사 하나로 끝. 새 버전이 나오면 실행할 때 알려줍니다.
- **완전 로컬** — 모든 처리는 내 PC에서만. 기록이 외부로 전송되지 않고, 계정 로그인도 필요 없습니다.
- **안전하게 누적** — 다시 조회해도 과거 기록은 보존되고 새 기록만 더해집니다.

## 빠른 시작

1. **게임에서 전언 기록을 엽니다** ⚠️ (가장 중요) — 게임 안에서 직접 **[전언] → [기록]** 화면을 열어 뽑기 목록이 화면에 보이게 합니다. 인증 정보(authkey)가 이때 PC 캐시에 갱신되고, 조회 직전에 한 번 열어둬야 유효합니다.
2. **설치하고 실행합니다** — [Releases](https://github.com/jkas2016/hsr-warp/releases/latest)에서 `hsr-warp-setup-X.X.X.exe` 를 받아 실행하면 설치 마법사가 뜹니다(관리자 권한 불필요). 설치 후 시작 메뉴·바탕화면 바로가기로 실행하면 대시보드가 자동으로 열립니다.
3. **조회합니다** — 게임 경로는 자동으로 채워집니다(틀리면 `…\Star Rail Games` 직접 입력). **조회** 버튼을 누르면 새 기록만 가져와 차트가 갱신됩니다.

📖 **전체 가이드** — 설치·authkey 발급·지표 해설·50/50 판정·문제 해결·FAQ는 공식 가이드 사이트에 있습니다: **<https://jkas2016.github.io/hsr-warp/>**

---

<details>
<summary>개발자용 (소스 빌드)</summary>

`go` 와 `node` 가 모두 설치돼 있어야 합니다 — `node` 만 PATH 에 있으면 되고, `go` 의 위치는 빌드 스크립트(`scripts/run-go.mjs`)가 PATH·알려진 경로·레지스트리에서 자동으로 찾습니다.

```powershell
npm run build    # 정적 단일 exe 빌드(-s -w)
npm start        # 빌드 후 실행
npm test         # go test ./...  +  node web/analyze.test.js  +  node docs/site/copy.test.mjs
npm run vet      # go vet ./...
```

도구를 직접 쓸 경우:

```powershell
go build -ldflags="-s -w" -o hsr-warp.exe .
go test ./...
node web/analyze.test.js
```

- 분석 로직은 `web/analyze.js`, 배너 픽업 일정 데이터는 `web/schedule.json` 단일 소스이며, 단위 테스트는 `web/analyze.test.js`(`node web/analyze.test.js`)가 같은 디렉터리에서 검증합니다.
- 아이콘 변경: `go run ./tools/genicon` → `goversioninfo -64 -o resource_windows_amd64.syso` 로 재생성.
- 신규 패치 출시 시 `web/schedule.json`의 `schedule` 배열에 새 페이즈 `{s,e,c,l}`를 추가하고 최상위 `version`을 +1 하세요(c=캐릭터·l=광추 픽업 item_id; 픽업=Mantan21/HSR-Warp-Simulator, item_id=StarRailRes). `main`에 push 하면 사용자 앱이 시작 시 자동으로 받아 반영합니다(릴리스 불필요). 누락 시 그 시점 5★가 '미확인'으로 표시됩니다.

**출처** — SRGF 형식: <https://uigf.org/en/standards/srgf.html> · 확률·50/50: <https://www.prydwen.gg/star-rail/guides/gacha-system/> · item_id: <https://github.com/Mar-7th/StarRailRes> · 추출 원리: <https://github.com/biuuu/star-rail-warp-export>

</details>

## License

MIT
