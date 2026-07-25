# HSR Warp Dashboard

[한국어](README.ko.md) | **English**

A small program that imports your **Honkai: Star Rail Warp records** onto your PC and shows **pity, luck, 50/50 results, and monthly stats**. Install it with the wizard, run it, and the dashboard opens in your browser automatically. The app and guide are available in **Korean, English, Simplified Chinese, and Japanese**.

- **Easy install** — One installer, no admin rights needed. It tells you at launch when a new version is available.
- **Fully local** — Everything runs on your PC only. Records are never sent anywhere, and no account login is required.
- **Safe accumulation** — Fetching again preserves your past records and only appends new ones.

## Quick start

1. **Open your Warp records in the game** ⚠️ (most important) — In the game, open **[Warp] → [Records]** yourself so the pull list is visible on screen. That is when an auth token (authkey) is written to the PC cache, and it must be refreshed this way right before you fetch.
2. **Install and run** — Download `hsr-warp-setup-X.X.X.exe` from [Releases](https://github.com/jkas2016/hsr-warp/releases/latest) and run it to launch the setup wizard (no admin rights needed). After installing, launch it from the Start Menu or desktop shortcut and the dashboard opens automatically.
3. **Fetch** — The game path is filled in automatically (if it's wrong, enter `…\Star Rail Games` directly). Press **Fetch** and only new records are pulled in, refreshing the charts.

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

- The analysis logic lives in `web/analyze.js`, and banner pickup schedule data in `web/schedule.json` — both are the single source of truth. Unit tests (`node web/analyze.test.js`) verify `analyze.js` from the same directory.
- To change the icon: `go run ./tools/genicon`, then regenerate with `goversioninfo -64 -o resource_windows_amd64.syso`.
- When a new game patch ships, add a phase entry to the `schedule` array in `web/schedule.json` (`{s,e,c,l}`) and bump the top-level `version` by 1 (`c` = character, `l` = light cone pickup item IDs; pickups from Mantan21/HSR-Warp-Simulator, item IDs from StarRailRes). Push to `main` and the app fetches it automatically at launch (no release needed). `npm run schedule:status` reports how far the current data covers. Without an update, 5★s obtained after the last known phase show as "unknown".

**Sources** — SRGF format: <https://uigf.org/en/standards/srgf.html> · rates & 50/50: <https://www.prydwen.gg/star-rail/guides/gacha-system/> · item IDs: <https://github.com/Mar-7th/StarRailRes> · extraction technique: <https://github.com/biuuu/star-rail-warp-export>

</details>

## License

MIT
