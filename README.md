# Gacha Records Dashboard

[한국어](README.ko.md) | **English**

A small program that imports your **Honkai: Star Rail Warp** and **Zenless Zone Zero Signal Search** records onto your PC and shows **pity, luck, 50/50 results, and monthly stats**. Install it with the wizard, run it, and the dashboard opens in your browser automatically — switch between the two games from the top. The app and guide are available in **Korean, English, Simplified Chinese, and Japanese**.

- **Easy install** — One installer, no admin rights needed. It tells you at launch when a new version is available.
- **Fully local** — Everything runs on your PC only. Records are never sent anywhere, and no account login is required.
- **Safe accumulation** — Fetching again preserves your past records and only appends new ones. Records are kept per game in a standard format (SRGF v1.0 for HSR, UIGF v4.0 for ZZZ).

> ⚠️ **How far back you can fetch** — Only as far back as the game server returns. **Zenless Zone Zero returns roughly the last 6 months only**, so Signal Search records older than that are already out of reach the first time you fetch. Honkai: Star Rail, in our testing, returned Warp records older than 6 months as well (this is a server-side policy HoYoverse can change at any time). Once fetched, records are kept here forever — the earlier you start, the longer your history.

## Quick start

1. **Open your pull records in the game** ⚠️ (most important) — In the game, open the records screen yourself so the pull list is visible on screen: **[Warp] → [Records]** in Star Rail, **[Signal Search] → [Details] → [Signal Search History]** in Zenless Zone Zero. That is when an auth token (authkey) is written to the PC cache, and it must be refreshed this way right before you fetch. Each game has its own token.
2. **Install and run** — Download `hsr-warp-setup-X.X.X.exe` from [Releases](https://github.com/jkas2016/hsr-warp/releases/latest) and run it to launch the setup wizard (no admin rights needed). After installing, launch it from the Start Menu or desktop shortcut and the dashboard opens automatically.
3. **Fetch** — Pick the game from the switcher at the top and the game path is filled in automatically (if it's wrong, enter it directly — `…\Star Rail Games` for Star Rail, `…\ZenlessZoneZero Game` for Zenless Zone Zero). Press **Fetch** and only new records are pulled in, refreshing the charts.

📖 **Full guide** — Installation, getting an authkey, what each metric means, 50/50 rules, troubleshooting and FAQ live on the guide site: **<https://jkas2016.github.io/hsr-warp/>** (auto-routes to your browser's language).

---

<details>
<summary>For developers (building from source)</summary>

You need both `go` and `node` installed — only `node` has to be on your `PATH`; the build script (`scripts/run-go.mjs`) locates `go` automatically from `PATH`, common install locations, or the registry.

```powershell
npm run build    # build a static single exe (-s -w)
npm start        # build, then run
npm test         # Go tests + the browser-side analyze, dashboard, and site test suites
npm run vet      # go vet ./...
```

Using the tools directly:

```powershell
go build -ldflags="-s -w" -o hsr-warp.exe .
go test ./...
node web/analyze.test.js
```

- The analysis logic lives in `web/analyze.js` as the single source of truth; per-game differences are expressed only through the `ranks`/`banners`/`order` blocks injected from the schedule data (`web/schedule.json` · `web/zzz/schedule.json`). Unit tests (`web/analyze.test.js`, `web/analyze.zzz.test.js`) verify it from the same directory.
- To change the icon: `go run ./tools/genicon`, then regenerate with `goversioninfo -64 -o resource_windows_amd64.syso`.
- When a new game patch ships, add a phase entry to the `schedule` array in that game's `schedule.json` (`{s,e,c,l}`) and bump the top-level `version` by 1 (`c` = character, `l` = weapon pickup item IDs; HSR pickups from Mantan21/HSR-Warp-Simulator, item IDs from StarRailRes). Push to `main` and the app fetches it automatically at launch (no release needed). `npm run schedule:status` reports how far each game's data covers. Without an update, top-rarity units obtained after the last known phase show as "unknown".

**Sources** — SRGF format: <https://uigf.org/en/standards/srgf.html> · UIGF format: <https://uigf.org/en/standards/uigf.html> · rates & 50/50: <https://www.prydwen.gg/star-rail/guides/gacha-system/> · item IDs: <https://github.com/Mar-7th/StarRailRes> · extraction technique: <https://github.com/biuuu/star-rail-warp-export>

</details>

## License

MIT
