// Live data layer for the dashboard kit. Replaces the demo window.WARP_DATA:
// loads real warp records from the local server, runs the shared WarpAnalyze
// logic (the single source of truth for 천장·운·50/50), and adapts the result
// into the shape the kit's view components consume. No analysis is reimplemented
// here — adapt() only reshapes WarpAnalyze output (analyze.js) into WARP_DATA.
window.WarpData = (function () {
  let schedule = [];     // /schedule.json -> schedule[] (픽업 일정, 50/50 판정용)
  let versions = [];     // /schedule.json -> versions[] (버전 시작일, 비교/버전라벨용)
  let inited = false;

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
    }));

    const fiveFiveBins = {};
    visible.filter((b) => b.meta.kind === 'limited').forEach((b) => {
      fiveFiveBins[b.meta.short] = { win: b.stats.cWins, loss: b.stats.cLoss, guar: b.stats.gWins };
    });

    const monthly = full.monthly.map((m) => ({
      month: m.month.slice(0, 4) + '.' + m.month.slice(4), // '202601' -> '2026.01'
      c3: m.c3, c4: m.c4, c5: m.c5, total: m.total, jade: m.jade,
    }));

    const versionRows = (window.WarpAnalyze.analyzeVersions(full, { list }, versions) || []).map((r) => ({
      v: r.v, period: `${r.s} ~ ${r.e || '현재'}`, total: r.total, count5: r.count5,
      charAvgPity: r.charAvgPity || 0, cWins: r.charCWins, cLoss: r.charCLoss,
    }));

    const fives = full.all5.map((f) => ({
      name: f.name, banner: f.banner, pity: f.pity, result: f.result,
      isPickup: f.isPickup, time: f.time, version: verOf(f.time),
    }));

    const luckPct = full.luck.charLuckPct;
    const markerPct = full.luck.charAvgPity
      ? Math.max(2, Math.min(98, (full.luck.charAvgPity / 125) * 100)) : 50;

    return {
      info: full.info || {},
      total: full.total, jade: full.jade, count5: full.count5, count4: full.count4, count3: full.count3,
      rate5: full.total ? (full.count5 / full.total) * 100 : 0,
      unknown5: full.unknown5 || 0,
      luck: {
        charAvgPity: full.luck.charAvgPity || 0,
        charLuckPct: luckPct == null ? 0 : Math.round(luckPct),
        markerPct,
      },
      charBanner: {
        win5050: cb.win5050Rate != null ? Math.round(cb.win5050Rate * 100) : 0,
        contested: cb.contested || 0, cWins: cb.cWins || 0, cLoss: cb.cLoss || 0, gWins: cb.gWins || 0,
        count5: cb.count5 || 0, avgPity5: cb.avgPity5 || 0,
        bestPity: cb.bestPity || 0, worstPity: cb.worstPity || 0,
        currentGuaranteed: !!cb.currentGuaranteed, currentPity: cb.currentPity5 || 0,
      },
      rarity: { c5: full.count5, c4: full.count4, c3: full.count3 },
      banners, fiveFiveBins, monthly, versions: versionRows, fives,
    };
  }

  function analyzeAndAdapt(raw) {
    const full = window.WarpAnalyze.analyze(raw, schedule);
    return adapt(full, (raw && raw.list) || []);
  }

  // 저장된 기록을 분석해 반환(게임 조회 없음). 기록이 없으면 null.
  async function loadStored() {
    await init();
    try {
      const d = await fetch('/api/data').then((r) => r.json());
      if (d && Array.isArray(d.list) && d.list.length) return analyzeAndAdapt(d);
    } catch (e) { /* 최초 실행 등: 데이터 없음 */ }
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
        let msg = '서버 연결 실패';
        if (e && e.data) { try { msg = '조회 실패: ' + JSON.parse(e.data).message; } catch (x) { msg = '조회 실패'; } }
        reject(new Error(msg));
      });
      es.addEventListener('done', (e) => {
        es.close();
        try {
          const d = JSON.parse(e.data);
          const adapted = analyzeAndAdapt(d.data);
          adapted.summary = d.summary;
          resolve(adapted);
        } catch (x) { reject(new Error('응답 처리에 실패했습니다.')); }
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

  return { loadStored, runFetch, configPath, checkUpdates };
})();
