// Live data layer for the dashboard kit. Replaces the demo window.WARP_DATA:
// loads real warp records from the local server, runs the shared WarpAnalyze
// logic (the single source of truth for 천장·운·50/50), and adapts the result
// into the shape the kit's view components consume. No analysis is reimplemented
// here — adapt() only reshapes WarpAnalyze output (analyze.js) into WARP_DATA.
window.WarpData = (function () {
  let schedule = [];     // /schedule.json -> schedule[] (픽업 일정, 50/50 판정용)
  let versions = [];     // /schedule.json -> versions[] (버전 시작일, 비교/버전라벨용)
  let inited = false;
  // 마지막 전체 분석 결과(버전 구간 스코프용 — 재조회 없이 filterAnalysis 재계산).
  let _full = null, _list = [], _fullData = null;

  async function init() {
    if (inited) return;
    try {
      const j = await fetch('/schedule.json').then((r) => r.json());
      schedule = (j && j.schedule) || [];
      versions = (j && j.versions) || [];
    } catch (e) { schedule = []; versions = []; }
    inited = true;
  }

  // 시각 -> 버전 라벨. versionWindows 로 [s,e) 구간을 만들어 찾는다.
  function verLookup() {
    const wins = window.WarpAnalyze.versionWindows(versions);
    return (time) => {
      const ms = Date.parse(String(time).slice(0, 10));
      const w = wins.find((x) => ms >= x.s && ms < x.e);
      return w ? w.v : '';
    };
  }

  // analyze() 전체 결과(full) + 원본 list -> 킷 WARP_DATA 형태.
  function adapt(full, list) {
    const verOf = verLookup();
    const cb = full.luck.charBanner || {};
    const visible = full.banners.filter((b) => b.type !== '2'); // 출발 워프는 킷 표시 대상 아님

    const banners = visible.map((b) => ({
      type: b.type, short: b.meta.short, color: b.meta.color, cap: b.meta.cap, kind: b.meta.kind,
      currentPity: b.stats.currentPity5 || 0, total: b.stats.total, count5: b.stats.count5,
      avgPity5: b.stats.avgPity5 || 0, cWins: b.stats.cWins, cLoss: b.stats.cLoss, gWins: b.stats.gWins,
      guaranteed: !!b.stats.currentGuaranteed, expAvg: b.meta.expAvg,
      luckPct: b.stats.luckPct == null ? null : b.stats.luckPct,
      winRate: b.stats.win5050Rate == null ? null : b.stats.win5050Rate,
    }));

    const fiveFiveBins = {};
    visible.filter((b) => b.meta.kind === 'limited').forEach((b) => {
      fiveFiveBins[b.meta.short] = { win: b.stats.cWins, loss: b.stats.cLoss, guar: b.stats.gWins };
    });

    const monthly = full.monthly.map((m) => ({
      month: m.month.slice(0, 4) + '.' + m.month.slice(4), // '202601' -> '2026.01'
      c3: m.c3, c4: m.c4, c5: m.c5, total: m.total, jade: m.jade,
      fives: m.fives || [], // 월별 표의 '획득 5★' 이름 목록
    }));

    // 스코프 콤보박스용 전체 버전 라벨(오름차순) — 뽑기 0 버전도 선택 가능해야 한다.
    const versionOptions = window.WarpAnalyze.versionWindows(versions).map((w) => w.v);

    const versionRows = (window.WarpAnalyze.analyzeVersions(full, { list }, versions) || []).map((r) => ({
      v: r.v, period: `${r.s} ~ ${r.e || window.I18N.t('common.now')}`, total: r.total, count5: r.count5,
      char: r.char, lc: r.lc, all: r.all, // 배너별 지표(평균뽑기·픽승/픽뚫·기준선) — 뷰가 셀렉터로 선택
    }));

    const fives = full.all5.map((f) => ({
      id: f.id, name: f.name, item_id: f.item_id, banner: f.banner, pity: f.pity, result: f.result,
      isPickup: f.isPickup, time: f.time, version: verOf(f.time),
    }));

    const luckPct = full.luck.charLuckPct;
    const lim = full.luck.limited || {};
    // 게이지: 이론 기준선(base)이 중앙 50%에 오도록 avg/(2*base). 기존 125=2*62.5 의 일반화.
    const markerPct = lim.count5
      ? Math.max(2, Math.min(98, (lim.avgPity5 / (2 * lim.base)) * 100)) : 50;
    // 캐릭터 배너 이론 평균 뽑기 수(단일 소스 analyze.js expAvg). 하드코딩 없이 HeroSummary 로 전달.
    const charBnr = full.banners.find((b) => b.type === '11');
    const lcBnr = full.banners.find((b) => b.type === '12');
    const charExpAvg = charBnr ? charBnr.meta.expAvg : window.WarpAnalyze.BANNERS['11'].expAvg;
    // rateUp(0.5/0.75) → '50/50'/'75/25' 배지 문구(단일 소스 상수에서 유도).
    const oddsOf = (type) => {
      const r = window.WarpAnalyze.BANNERS[type].rateUp;
      return Math.round(r * 100) + '/' + Math.round(100 - r * 100);
    };

    return {
      info: full.info || {},
      total: full.total, jade: full.jade, count5: full.count5, count4: full.count4, count3: full.count3,
      rate5: full.total ? (full.count5 / full.total) * 100 : 0,
      unknown5: full.unknown5 || 0,
      luck: {
        charAvgPity: full.luck.charAvgPity || 0,
        charLuckPct: Math.round(luckPct ?? 0),
        markerPct,
      },
      limited: {
        ...lim,
        charGuaranteed: !!(charBnr && charBnr.stats.currentGuaranteed),
        lcGuaranteed: !!(lcBnr && lcBnr.stats.currentGuaranteed),
        charOdds: oddsOf('11'), lcOdds: oddsOf('12'),
      },
      charBanner: {
        win5050: Math.round((cb.win5050Rate ?? 0) * 100),
        expAvg: charExpAvg,
        contested: cb.contested || 0, cWins: cb.cWins || 0, cLoss: cb.cLoss || 0, gWins: cb.gWins || 0,
        count5: cb.count5 || 0, avgPity5: cb.avgPity5 || 0,
        bestPity: cb.bestPity || 0, worstPity: cb.worstPity || 0,
        currentGuaranteed: !!cb.currentGuaranteed, currentPity: cb.currentPity5 || 0,
      },
      rarity: { c5: full.count5, c4: full.count4, c3: full.count3 },
      banners, fiveFiveBins, monthly, versions: versionRows, versionOptions, fives,
    };
  }

  function analyzeAndAdapt(raw) {
    const full = window.WarpAnalyze.analyze(raw, schedule);
    _full = full;
    _list = (raw && raw.list) || [];
    _fullData = adapt(full, _list);
    return _fullData;
  }

  // 전체 데이터를 한 버전 패치 구간으로 좁혀 어댑트한다(전 화면 적용용).
  // version 이 '전체'/없거나 일정에 없으면 전체 데이터를 그대로 돌려준다.
  // 버전 비교 표(versions)는 항상 전체 기준을 유지한다(비교는 본질적으로 교차 버전).
  function scopeTo(version) {
    if (!version || version === '전체' || !_full) return _fullData;
    const w = window.WarpAnalyze.versionWindows(versions).find((x) => x.v === version);
    if (!w) return _fullData;
    const scoped = adapt(window.WarpAnalyze.filterAnalysis(_full, { list: _list }, w), _list);
    scoped.versions = _fullData.versions;
    scoped.scopedVersion = version;
    return scoped;
  }

  // 저장된 기록을 분석해 반환(게임 조회 없음). 기록이 없으면 null.
  async function loadStored() {
    await init();
    try {
      const d = await fetch('/api/data').then((r) => r.json());
      if (d && Array.isArray(d.list) && d.list.length) return analyzeAndAdapt(d);
    } catch (e) {} // first run or no data yet
    return null;
  }

  // 게임에서 증분 조회(SSE). onProgress(배너이름, 누적신규건수).
  // 성공 시 adapt 된 데이터(+summary)로 resolve, 실패 시 Error 로 reject.
  function runFetch(path, onProgress) {
    return new Promise((resolve, reject) => {
      const es = new EventSource('/api/fetch?path=' + encodeURIComponent(path));
      es.addEventListener('progress', (e) => {
        try { const d = JSON.parse(e.data); if (onProgress) onProgress(d.banner, d.added); } catch (x) {}
      });
      es.addEventListener('error', (e) => {
        es.close();
        let msg = window.I18N.t('err.connect');
        if (e && e.data) { try { msg = window.I18N.t('err.fetchPrefix') + JSON.parse(e.data).message; } catch (x) { msg = window.I18N.t('err.fetch'); } }
        reject(new Error(msg));
      });
      es.addEventListener('done', (e) => {
        es.close();
        try {
          const d = JSON.parse(e.data);
          const adapted = analyzeAndAdapt(d.data);
          adapted.summary = d.summary;
          resolve(adapted);
        } catch (x) { reject(new Error(window.I18N.t('err.parse'))); }
      });
    });
  }

  // 경로 자동 채움: 저장된 config 우선, 없으면 자동 탐지.
  async function configPath() {
    try {
      const c = await fetch('/api/config').then((r) => r.json());
      if (c && c.game_path) return c.game_path;
    } catch (e) {}
    try {
      const d = await fetch('/api/detect').then((r) => r.json());
      if (d && d.path) return d.path;
    } catch (e) {}
    return '';
  }

  // 시작 시 1회 업데이트 확인(코드/배너데이터 2채널, 베스트에포트).
  async function checkUpdates() {
    try { return await fetch('/api/updates').then((r) => r.json()); } catch (e) { return null; }
  }

  return { loadStored, runFetch, configPath, checkUpdates, scopeTo };
})();
