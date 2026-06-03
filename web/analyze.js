// Shared warp-analysis logic. Inlined into the dashboard; unit-tested via analyze.test.js.
// Win/Loss(50:50) uses the standard-pool method: a featured banner 5* is a LOSS if its
// item_id is in the permanent standard pool, otherwise a WIN. Pools verified against
// Prydwen + StarRailRes (see SOURCES at bottom). Edit STANDARD if HoYo changes the pool.
(function (root) {
  // ---- config (verified constants) ----
  const STANDARD = {
    char: ['1003','1004','1101','1104','1107','1209','1211'],          // Himeko, Welt, Bronya, Gepard, Clara, Yanqing, Bailu
    lc:   ['23000','23002','23003','23004','23005','23012','23013'],   // standard 5* light cones
  };
  const BANNERS = {
    '11': { name: '캐릭터 이벤트', short: '캐릭터', color: '#a474ff', cap: 90, soft: 74, kind: 'limited', pool: 'char', rateUp: 0.5,  expAvg: 62.5 },
    '12': { name: '광추 이벤트',   short: '광추',   color: '#5aa9ff', cap: 80, soft: 65, kind: 'limited', pool: 'lc',   rateUp: 0.75, expAvg: 53.5 },
    '1':  { name: '스텔라(일반)',  short: '일반',   color: '#52d39a', cap: 90, soft: 74, kind: 'standard', pool: null, rateUp: null, expAvg: 62.5 },
    '2':  { name: '출발 워프',     short: '출발',   color: '#ff9e45', cap: 50, soft: null, kind: 'beginner', pool: null, rateUp: null, expAvg: null },
  };
  const ORDER = ['11', '12', '1', '2'];
  const byId = (a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : BigInt(a.id) > BigInt(b.id) ? 1 : 0);
  const mean = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

  function analyzeBanner(records, meta) {
    const list = records.slice().sort(byId);
    const pool = meta.pool ? STANDARD[meta.pool] : null;
    let p5 = 0, p4 = 0, c5 = 0, c4 = 0, c3 = 0;
    let guaranteed = false, contested = 0, cWins = 0, cLoss = 0, gWins = 0;
    const fives = [];
    for (const r of list) {
      p5++; p4++;
      const rank = String(r.rank_type);
      if (rank === '5') {
        const f = { name: r.name, item_id: String(r.item_id), item_type: r.item_type, time: r.time, pity: p5, result: null, isPickup: null, fromGuarantee: false };
        if (meta.kind === 'limited') {
          f.isPickup = !pool.includes(String(r.item_id));
          if (guaranteed) { f.result = 'guaranteed'; f.fromGuarantee = true; gWins++; guaranteed = false; }
          else { contested++; if (f.isPickup) { f.result = 'win'; cWins++; } else { f.result = 'loss'; cLoss++; guaranteed = true; } }
        }
        fives.push(f); c5++; p5 = 0; p4 = 0;
      } else if (rank === '4') { c4++; p4 = 0; }
      else { c3++; }
    }
    const pities = fives.map(f => f.pity);
    const early = meta.soft ? fives.filter(f => f.pity < meta.soft).length : 0;
    return {
      total: list.length, jade: list.length * 160, count5: c5, count4: c4, count3: c3,
      currentPity5: p5, currentPity4: p4,
      avgPity5: mean(pities), bestPity: pities.length ? Math.min(...pities) : null, worstPity: pities.length ? Math.max(...pities) : null,
      earlyCount: early, earlyRate: c5 ? early / c5 : null,
      // luck vs theoretical average (lower pity = luckier); positive % = lucky
      luckPct: (meta.expAvg && pities.length) ? (meta.expAvg - mean(pities)) / meta.expAvg * 100 : null,
      // 50/50
      contested, cWins, cLoss, gWins,
      win5050Rate: contested ? cWins / contested : null,
      pickupTotal: cWins + gWins, currentGuaranteed: guaranteed,
      fives,
    };
  }

  function monthly(list) {
    const m = {};
    for (const r of list) {
      const key = String(r.time || '').slice(0, 7).replace('-', ''); // YYYYMM
      if (!/^\d{6}$/.test(key)) continue;
      const b = m[key] || (m[key] = { month: key, total: 0, jade: 0, c5: 0, c4: 0, c3: 0, fives: [] });
      b.total++; b.jade += 160;
      const rank = String(r.rank_type);
      if (rank === '5') { b.c5++; b.fives.push({ name: r.name, gacha_type: String(r.gacha_type), time: r.time }); }
      else if (rank === '4') b.c4++; else b.c3++;
    }
    return Object.values(m).sort((a, b) => a.month.localeCompare(b.month));
  }

  function analyze(data) {
    const list = Array.isArray(data.list) ? data.list : [];
    const groups = {}; for (const k of ORDER) groups[k] = [];
    for (const r of list) { const t = String(r.gacha_type); if (groups[t]) groups[t].push(r); }
    const banners = ORDER.filter(k => groups[k].length).map(k => ({ type: k, meta: BANNERS[k], stats: analyzeBanner(groups[k], BANNERS[k]) }));

    const all5 = banners.flatMap(b => b.stats.fives.map(f => ({ ...f, banner: b.meta.short, gacha_type: b.type })));
    all5.sort((a, b) => (a.time < b.time ? 1 : a.time > b.time ? -1 : 0)); // newest first

    // account-wide luck on character-path banners (11 + 1)
    const charFives = banners.filter(b => b.type === '11' || b.type === '1').flatMap(b => b.stats.fives.map(f => f.pity));
    const lim = banners.find(b => b.type === '11');
    const lc = banners.find(b => b.type === '12');
    return {
      info: data.info || {},
      total: list.length, jade: list.length * 160,
      count5: banners.reduce((s, b) => s + b.stats.count5, 0),
      count4: banners.reduce((s, b) => s + b.stats.count4, 0),
      count3: banners.reduce((s, b) => s + b.stats.count3, 0),
      banners, all5,
      monthly: monthly(list),
      luck: {
        charAvgPity: mean(charFives),
        charLuckPct: charFives.length ? (62.5 - mean(charFives)) / 62.5 * 100 : null,
        charBanner: lim ? lim.stats : null,
        lcBanner: lc ? lc.stats : null,
      },
    };
  }

  const api = { analyze, analyzeBanner, monthly, BANNERS, ORDER, STANDARD };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WarpAnalyze = api;
})(typeof window !== 'undefined' ? window : globalThis);

// SOURCES:
//  Standard char pool + rates : https://www.prydwen.gg/star-rail/guides/gacha-system/
//  item_id verification        : https://github.com/Mar-7th/StarRailRes (index_min/en)
//  gacha_type codes            : https://uigf.org/en/standards/srgf.html
