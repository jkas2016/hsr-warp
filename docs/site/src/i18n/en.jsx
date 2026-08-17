// English dictionary. Key structure must mirror ko.jsx exactly (enforced by i18n.test.mjs).
export default {
  meta: {
    title: 'Gacha Records Dashboard — Your Pulls, on Your PC',
    description: 'A small local app that imports your Honkai: Star Rail Warp and Zenless Zone Zero Signal Search records and shows pity, luck, 50/50 results and monthly stats. Easy installer, fully local, no account login.',
    ogTitle: 'Gacha Records Dashboard — Your Pulls, on Your PC',
    ogDescription: 'Analyze your Honkai: Star Rail Warp and Zenless Zone Zero Signal Search records on your own PC — pity, luck, 50/50 results, monthly stats. Fully local, no login.',
  },
  nav: {
    brand: 'Gacha Records', logoAlt: 'Honkai: Star Rail logo', logoAltZzz: 'Zenless Zone Zero logo',
    start: 'Quick Start', metrics: 'Metrics', files: 'Files', trouble: 'Troubleshooting', faq: 'FAQ',
    github: 'GitHub repository', theme: 'Toggle theme', lang: 'Select language', download: 'Download',
  },
  hero: {
    eyebrow: 'Honkai: Star Rail · Zenless Zone Zero · Pull history analytics',
    title: <>Your pull records,<br /><span className="accent">on your PC.</span></>,
    lead: <>A small program that imports your Honkai: Star Rail <b style={{ color: 'var(--txt)' }}>Warp</b> and Zenless Zone Zero <b style={{ color: 'var(--txt)' }}>Signal Search</b> records and shows <b style={{ color: 'var(--txt)' }}>pity · luck · 50/50 results · monthly stats</b> at a glance. Install it, run it, and the dashboard opens in your browser automatically — switch between the two games from the top.</>,
    ctaDownload: 'Download latest version',
    ctaStart: 'See Quick Start',
    chips: ['Two games supported', 'Easy setup (installer)', 'Fully local · No login', 'MIT open source'],
  },
  mock: {
    heading: <>Warp · Signal Search <span className="g">Gacha Dashboard</span></>,
    totalPulls: 'Total pulls', totalUnit: '', fiveStar: '5★ / S', fiveUnit: '',
    winRate: 'Win rate', winUnit: ' %', luckLabel: 'Luck · Avg character pity', luckUnit: ' pulls',
  },
  features: [
    { title: 'Easy install', body: 'One installer and you are done (no admin rights needed). It creates Start Menu and desktop shortcuts, and tells you at launch when a new version is available.' },
    { title: 'Fully local', body: 'Everything runs on your PC only — your records are never sent anywhere. No account login required.' },
    { title: 'Safe accumulation', body: 'Fetching again preserves your past records and only appends new ones. Records are kept per game in a standard format (SRGF v1.0 for HSR, UIGF v4.0 for ZZZ).' },
  ],
  quick: {
    eyebrow: 'Quick Start',
    title: 'Four steps are all it takes',
    lead: 'Open the records screen in the game once, install and run, then fetch. The first step is the one that matters most.',
    step1: {
      title: <>Open your pull records in the game <span className="badge warn">Most important</span></>,
      body: <>Just <b>launching the game is not enough.</b> You must open the records screen in the game so <b>the pull list is visible on screen</b> — in Star Rail that is <b>[Warp] → [Records]</b>, in Zenless Zone Zero <b>[Signal Search] → [Details] → [Signal Search History]</b>. That is when the game writes an auth token (authkey) to the PC cache, which this program reads to fetch your records.</>,
      callout: <>This auth token expires after a while. Open the records screen <b>right before fetching</b>. Each game has its own token, so open it in whichever game you want to fetch.</>,
    },
    step2: {
      title: 'Install and run',
      body: <>Download <code>hsr-warp-setup-X.X.X.exe</code> from <a href="https://github.com/jkas2016/hsr-warp/releases/latest" target="_blank" rel="noopener">Releases</a> and run it to launch the setup wizard (no admin rights, installs into your user folder). When it finishes, start the app from the Start Menu or desktop shortcut. A black console window appears and the dashboard opens in your default browser (e.g. <code>http://127.0.0.1:8787/ui_kits/dashboard/</code>).</>,
      callout: <>The program is unsigned, so <b>Windows may warn you during install or launch</b> (screens below). If it is the file you downloaded yourself, click <b>More info → Run anyway</b>.</>,
      shot1: { alt: 'First Windows SmartScreen warning — the More info link', caption: <>Click <b>More info</b></> },
      shot2: { alt: 'The Run anyway button shown after clicking More info', caption: <>Click <b>Run anyway</b></> },
    },
    step3: {
      title: 'Fetch',
      body: <>First pick the game from the <b>game switcher</b> at the top. The <b>game path</b> is filled in automatically (last used path → auto-detect otherwise). If it is empty or wrong, enter your game folder directly — <code>…\Star Rail Games</code> for Star Rail, <code>…\ZenlessZoneZero Game</code> for Zenless Zone Zero. Press <b>Fetch</b> and only new records are pulled in real time while the charts refresh. Previously saved records are shown immediately without fetching.</>,
    },
    step4: {
      title: 'Quit',
      body: <>While running, a <b>black console window</b> stays open alongside (the dashboard lives in your browser). When you are done, <b>close that window</b> or press <span className="kbd">Ctrl + C</span> in it to quit the program.</>,
      shot: { alt: 'The console window that opens alongside the app', caption: 'Closing this window quits the program.' },
    },
  },
  metricsSec: {
    eyebrow: 'Metrics',
    title: 'What the dashboard shows',
    lead: 'All numbers are computed against the standard official rates. Lower pity means better luck.',
    luck: { title: 'Luck', big: '62.5', bigUnit: ' pull baseline', body: <>Compares your average top-rarity pity (5★ · S-Rank) against the theoretical average of <b style={{ color: 'var(--txt)' }}>62.5 pulls</b> (1.6% consolidated rate). Lower than that means you have been lucky. Both games use the same baseline on character banners.</> },
    avg: { title: 'Average pity', body: 'How many pulls your top-rarity characters took on average, along with your luckiest and unluckiest pity counts.' },
    win: { title: 'Win rate (50/50)', body: <>The share of 50/50 contests on limited banners (Star Rail Character Event · Zenless Zone Zero Exclusive Channel) where <b style={{ color: 'var(--txt)' }}>you pulled the rate-up</b>. Guaranteed pulls after losing a 50/50 are counted separately.</> },
    monthly: { title: 'Monthly summary', body: 'Pulls, currency spent (Stellar Jade · Polychrome) and top-rarity units obtained per month at a glance — see which patch you spent the most on.' },
    criteria: {
      title: 'How results are judged',
      items: [
        { tag: 'Won / Lost', body: <>A top-rarity unit counts as <b>won</b> if it was a <b>rate-up target of the banner at the moment it was obtained</b>, otherwise <b>lost</b>. Being time-based, this correctly handles standard-pool additions, reruns, collabs and Celestial Invitation (per-game rate-up schedule in <code>schedule.json</code>).</> },
        { tag: 'Unknown', body: <>Top-rarity units obtained at a time not yet covered by the rate-up schedule (usually a brand-new patch) show as <b>unknown</b> — refreshing the schedule resolves them automatically.</> },
        { tag: 'Official rates', body: <>Both games share the same skeleton — character hard pity <b>90</b> (50/50) · weapon (Light Cone · W-Engine) hard pity <b>80</b> (75/25). Only the expected weapon pull count differs (53.5 vs 50).</> },
      ],
    },
  },
  filesSec: {
    eyebrow: 'Storage',
    title: 'Files it creates',
    lead: <>Created automatically under the install folder <code>%LOCALAPPDATA%\HSR Warp</code>. They are all plain files you can open yourself.</>,
    thName: 'Folder / file', thDesc: 'Contents',
    rows: [
      <>Pull records, split per game into <code>data\hsr\</code> and <code>data\zzz\</code> and saved monthly (<code>warp_YYYYMM.json</code>). Standard formats (SRGF v1.0 for Star Rail, UIGF v4.0 for Zenless Zone Zero), so other tools can import them too.</>,
      <>The game path you used last, per game</>,
      <>Run logs (daily <code>hsr-warp-YYYY-MM-DD.log</code>). Useful for finding the cause when something goes wrong.</>,
    ],
    note: <>To move to another PC or back up, just copy the whole <code>data\</code> folder.</>,
  },
  troubleSec: {
    eyebrow: 'Troubleshooting',
    title: 'Troubleshooting',
    lead: 'Most issues are auth token (authkey) problems. When stuck, redoing step 1 almost always fixes it.',
    cards: [
      { tag: 'authkey expired', body: <>Just starting the game does not refresh it. Open the records screen again (until the list is visible), then fetch — <b>[Warp] → [Records]</b> in Star Rail, <b>[Signal Search] → [Details] → [Signal Search History]</b> in Zenless Zone Zero. If the <b>issued time</b> in the message is old, the screen was not opened.</> },
      { tag: 'Fetching too often (server rate limit)', body: <>Fetching many times in a short period gets briefly blocked by the server. <b>Wait 1–2 minutes</b> and fetch again.</> },
      { tag: 'Game path not found / no webCaches', body: <>Enter your game install folder directly into the path field — <code>…\Star Rail Games</code> for Star Rail, <code>…\ZenlessZoneZero Game</code> for Zenless Zone Zero.</> },
      { tag: 'Other errors', body: <>Open the newest log file in the <code>logs\</code> folder to see which step failed. For more detail, run with <code>HSRWARP_LOG=debug</code> (errors include stack traces).</> },
    ],
  },
  faqSec: {
    eyebrow: 'FAQ',
    title: 'Frequently asked',
    items: [
      { q: 'Is my account at risk?', a: <>This program reads the query-only auth token the game leaves on your PC and calls the <b>read-only</b> unofficial records API. It never touches passwords or account credentials, and changes nothing in the game.</> },
      { q: 'Where is my data sent?', a: <>Nowhere. The only traffic is between your PC and the HoYoverse records server, and results are stored on your PC only.</> },
      { q: 'Can I use multiple accounts?', a: <>Currently, records are stored per game for the account you fetched last. The two games are kept in separate folders and never mix.</> },
      { q: 'Are new patches and versions applied automatically?', a: <>Two things update automatically. The <b>rate-up schedule data</b> (<code>schedule.json</code>) is fetched fresh at app launch, so "unknown" top-rarity units from a brand-new patch resolve without a release. The <b>app itself</b> notifies you at launch when a new version is out, and updates via the installer.</> },
      { q: 'Can I build from source?', a: <>You need both <code>go</code> and <code>node</code> installed — only <code>node</code> has to be on your PATH, since the build script finds <code>go</code> automatically. Build a static single exe with <code>npm run build</code> and run it with <code>npm start</code>. See the repository README for details.</> },
    ],
  },
  cta: {
    title: 'Check your luck now',
    lead: 'One installer to get started. No login, no data leaves your PC.',
    github: 'View on GitHub',
  },
  footer: {
    brand: 'Gacha Records Dashboard',
    disc: <>An unofficial open-source tool that analyzes Honkai: Star Rail Warp and Zenless Zone Zero Signal Search records locally. <b style={{ color: 'var(--txt)' }}>Not affiliated with HoYoverse</b>; it changes nothing in the game. Data formats: SRGF v1.0 (HSR) · UIGF v4.0 (ZZZ).</>,
    repo: 'GitHub repository', releases: 'Download (Releases)', srgf: 'SRGF format standard',
    gacha: 'Rates · 50/50 guide', arch: 'Architecture docs',
    license: 'MIT License · © 2026 hsr-warp',
    mono: 'SRGF v1.0 · UIGF v4.0 · hard pity 90 character / 80 weapon',
  },
};
