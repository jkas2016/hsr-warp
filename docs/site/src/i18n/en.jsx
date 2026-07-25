// English dictionary. Key structure must mirror ko.jsx exactly (enforced by i18n.test.mjs).
export default {
  meta: {
    title: 'HSR Warp Dashboard — Your Warp Records, on Your PC',
    description: 'A small local app that imports your Honkai: Star Rail Warp records and shows pity, luck, 50/50 results and monthly stats. Easy installer, fully local, no account login.',
    ogTitle: 'HSR Warp Dashboard — Your Warp Records, on Your PC',
    ogDescription: 'Analyze your Honkai: Star Rail Warp records on your own PC — pity, luck, 50/50 results, monthly stats. Fully local, no login.',
  },
  nav: {
    brand: 'HSR Warp', logoAlt: 'HSR Warp logo',
    start: 'Quick Start', metrics: 'Metrics', files: 'Files', trouble: 'Troubleshooting', faq: 'FAQ',
    github: 'GitHub repository', theme: 'Toggle theme', lang: 'Select language', download: 'Download',
  },
  hero: {
    eyebrow: 'Honkai: Star Rail · Warp history analytics',
    title: <>Your Warp records,<br /><span className="accent">on your PC.</span></>,
    lead: <>A small program that imports your Honkai: Star Rail Warp records and shows <b style={{ color: 'var(--txt)' }}>pity · luck · 50/50 results · monthly stats</b> at a glance. Install it, run it, and the dashboard opens in your browser automatically.</>,
    ctaDownload: 'Download latest version',
    ctaStart: 'See Quick Start',
    chips: ['Easy setup (installer)', 'Fully local · No login', 'MIT open source'],
  },
  mock: {
    heading: <>Honkai: Star Rail <span className="g">Warp Dashboard</span></>,
    totalPulls: 'Total pulls', totalUnit: '', fiveStar: '5★', fiveUnit: '',
    winRate: 'Win rate', winUnit: ' %', luckLabel: 'Luck · Avg character pity', luckUnit: ' pulls',
  },
  features: [
    { title: 'Easy install', body: 'One installer and you are done (no admin rights needed). It creates Start Menu and desktop shortcuts, and tells you at launch when a new version is available.' },
    { title: 'Fully local', body: 'Everything runs on your PC only — your records are never sent anywhere. No account login required.' },
    { title: 'Safe accumulation', body: 'Fetching again preserves your past records and only appends new ones. Data is stored in the standard SRGF v1.0 format.' },
  ],
  quick: {
    eyebrow: 'Quick Start',
    title: 'Four steps are all it takes',
    lead: 'Open the records screen in the game once, install and run, then fetch. The first step is the one that matters most.',
    step1: {
      title: <>Open your Warp records in the game <span className="badge warn">Most important</span></>,
      body: <>Just <b>launching the game is not enough.</b> You must open the <b>[Warp] → [Records]</b> screen in the game so <b>the pull list is visible on screen</b>. That is when the game writes an auth token (authkey) to the PC cache, which this program reads to fetch your records.</>,
      callout: <>This auth token expires after a while. Open the Warp records screen <b>right before fetching</b>.</>,
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
      body: <>The <b>game path</b> is filled in automatically (last used path → auto-detect otherwise). If it is empty or wrong, enter your game folder <code>…\Star Rail Games</code> directly. Press <b>Fetch</b> and only new records are pulled in real time while the charts refresh. Previously saved records are shown immediately without fetching.</>,
    },
    step4: {
      title: 'Quit',
      body: <>While running, a <b>black console window</b> stays open alongside (the dashboard lives in your browser). When you are done, <b>close that window</b> or press <span className="kbd">Ctrl + C</span> in it to quit the program.</>,
      shot: { alt: 'The HSR Warp console window that opens alongside the app', caption: 'Closing this window quits the program.' },
    },
  },
  metricsSec: {
    eyebrow: 'Metrics',
    title: 'What the dashboard shows',
    lead: 'All numbers are computed against the standard official rates. Lower pity means better luck.',
    luck: { title: 'Luck', big: '62.5', bigUnit: ' pull baseline', body: <>Compares your average 5★ pity against the theoretical average of <b style={{ color: 'var(--txt)' }}>62.5 pulls</b> (1.6% consolidated rate). Lower than that means you have been lucky.</> },
    avg: { title: 'Average pity', body: 'How many pulls your character 5★s took on average, along with your luckiest and unluckiest pity counts.' },
    win: { title: 'Win rate (50/50)', body: <>The share of 50/50 contests on limited banners where <b style={{ color: 'var(--txt)' }}>you pulled the rate-up</b>. Guaranteed pulls after losing a 50/50 are counted separately.</> },
    monthly: { title: 'Monthly summary', body: 'Pulls, Stellar Jade spent and 5★s obtained per month at a glance — see which patch you spent the most on.' },
    criteria: {
      title: 'How results are judged',
      items: [
        { tag: 'Won / Lost', body: <>A 5★ counts as <b>won</b> if it was a <b>rate-up target of the banner at the moment it was obtained</b>, otherwise <b>lost</b>. Being time-based, this correctly handles standard-pool additions, reruns, collabs and Celestial Invitation (rate-up schedule in <code>web/schedule.json</code>).</> },
        { tag: 'Unknown', body: <>5★s obtained at a time not yet covered by the rate-up schedule (usually a brand-new patch) show as <b>unknown</b> — refreshing the schedule resolves them automatically.</> },
        { tag: 'Official rates', body: <>Character 0.6% (1.6% consolidated) · hard pity <b>90</b> / Light Cone 0.8% · hard pity <b>80</b>.</> },
      ],
    },
  },
  filesSec: {
    eyebrow: 'Storage',
    title: 'Files it creates',
    lead: <>Created automatically under the install folder <code>%LOCALAPPDATA%\HSR Warp</code>. They are all plain files you can open yourself.</>,
    thName: 'Folder / file', thDesc: 'Contents',
    rows: [
      <>Warp records (monthly <code>warp_YYYYMM.json</code>). Standard SRGF v1.0 format, so other tools can import them too.</>,
      <>The game path you used last</>,
      <>Run logs (daily <code>hsr-warp-YYYY-MM-DD.log</code>). Useful for finding the cause when something goes wrong.</>,
    ],
    note: <>To move to another PC or back up, just copy the whole <code>data\</code> folder.</>,
  },
  troubleSec: {
    eyebrow: 'Troubleshooting',
    title: 'Troubleshooting',
    lead: 'Most issues are auth token (authkey) problems. When stuck, redoing step 1 almost always fixes it.',
    cards: [
      { tag: 'authkey expired', body: <>Just starting the game does not refresh it. Open the <b>[Warp] → [Records]</b> screen in the game again (until the list is visible), then fetch. If the <b>issued time</b> in the message is old, the screen was not opened.</> },
      { tag: 'Fetching too often (server rate limit)', body: <>Fetching many times in a short period gets briefly blocked by the server. <b>Wait 1–2 minutes</b> and fetch again.</> },
      { tag: 'Game path not found / no webCaches', body: <>Enter your game install folder <code>…\Star Rail Games</code> directly into the path field.</> },
      { tag: 'Other errors', body: <>Open the newest log file in the <code>logs\</code> folder to see which step failed. For more detail, run with <code>HSRWARP_LOG=debug</code> (errors include stack traces).</> },
    ],
  },
  faqSec: {
    eyebrow: 'FAQ',
    title: 'Frequently asked',
    items: [
      { q: 'Is my account at risk?', a: <>This program reads the query-only auth token the game leaves on your PC and calls the <b>read-only</b> unofficial records API. It never touches passwords or account credentials, and changes nothing in the game.</> },
      { q: 'Where is my data sent?', a: <>Nowhere. The only traffic is between your PC and the HoYoverse records server, and results are stored on your PC only.</> },
      { q: 'Can I use multiple accounts?', a: <>Currently, records are stored per the account you fetched last.</> },
      { q: 'Are new patches and versions applied automatically?', a: <>Two things update automatically. The <b>rate-up schedule data</b> (<code>schedule.json</code>) is fetched fresh at app launch, so "unknown" 5★s from a brand-new patch resolve without a release. The <b>app itself</b> notifies you at launch when a new version is out, and updates via the installer.</> },
      { q: 'Can I build from source?', a: <>You need both <code>go</code> and <code>node</code> installed — only <code>node</code> has to be on your PATH, since the build script finds <code>go</code> automatically. Build a static single exe with <code>npm run build</code> and run it with <code>npm start</code>. See the repository README for details.</> },
    ],
  },
  cta: {
    title: 'Check your luck now',
    lead: 'One installer to get started. No login, no data leaves your PC.',
    github: 'View on GitHub',
  },
  footer: {
    brand: 'HSR Warp Dashboard',
    disc: <>An unofficial open-source tool that analyzes Honkai: Star Rail Warp records locally. <b style={{ color: 'var(--txt)' }}>Not affiliated with HoYoverse</b>; it changes nothing in the game. Data format: SRGF v1.0.</>,
    repo: 'GitHub repository', releases: 'Download (Releases)', srgf: 'SRGF format standard',
    gacha: 'Rates · 50/50 guide', arch: 'Architecture docs',
    license: 'MIT License · © 2026 hsr-warp',
    mono: 'SRGF v1.0 · hard pity 90 Character / 80 Light Cone',
  },
};
