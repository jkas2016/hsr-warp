// Shared warp-analysis logic. Single source (served at /analyze.js, embedded in exe).
// Unit-tested via web/analyze.test.js. 50/50: a featured banner 5* is a WIN(픽승) if its
// item_id is in LIMITED(한정 픽업 목록), else LOSS(픽뚫). A 5* in neither LIMITED nor
// STANDARD is flagged unidentified (LIMITED may be stale — add new featured units).
// LIMITED derived from StarRailRes index_min/en (all 5* minus standard 7). See SOURCES.
(function (root) {
  // ---- config (verified constants) ----
  const STANDARD = {
    char: ['1003','1004','1101','1104','1107','1209','1211'],          // Himeko, Welt, Bronya, Gepard, Clara, Yanqing, Bailu
    lc:   ['23000','23002','23003','23004','23005','23012','23013'],   // standard 5* light cones
  };
  const LIMITED = {
    // 한정(픽업) 5★. StarRailRes index_min/en에서 '전체 5★ − 상시 7종'으로 도출(2026-06).
    // 개척자(8xxx)·BP/무료 광추(24xxx) 제외. 신규 한정은 여기 추가(누락 시 '미확인 5★' 경고).
    char: ['1005','1006','1014','1015','1102','1112','1203','1204','1205','1208','1212','1213','1217','1218','1220','1221','1222','1225','1302','1303','1304','1305','1306','1307','1308','1309','1310','1313','1314','1315','1317','1321','1401','1402','1403','1404','1405','1406','1407','1408','1409','1410','1412','1413','1414','1415','1501','1502','1504','1505','1506','1507'],
    lc:   ['23001','23006','23007','23008','23009','23010','23011','23014','23015','23016','23017','23018','23019','23020','23021','23022','23023','23024','23025','23026','23027','23028','23029','23030','23031','23032','23033','23034','23035','23036','23037','23038','23039','23040','23041','23042','23043','23044','23045','23046','23047','23048','23049','23050','23051','23052','23053','23054','23056','23057','23058','23059'],
  };
  const BANNERS = {
    '11': { name: '캐릭터 이벤트', short: '캐릭터', color: '#a474ff', cap: 90, kind: 'limited', pool: 'char', rateUp: 0.5,  expAvg: 62.5 },
    '12': { name: '광추 이벤트',   short: '광추',   color: '#5aa9ff', cap: 80, kind: 'limited', pool: 'lc',   rateUp: 0.75, expAvg: 53.5 },
    '1':  { name: '스텔라(일반)',  short: '일반',   color: '#52d39a', cap: 90, kind: 'standard', pool: null, rateUp: null, expAvg: 62.5 },
    '2':  { name: '출발 워프',     short: '출발',   color: '#ff9e45', cap: 50, kind: 'beginner', pool: null, rateUp: null, expAvg: null },
  };
  const ORDER = ['11', '12', '1', '2'];
  const byId = (a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : BigInt(a.id) > BigInt(b.id) ? 1 : 0);
  const mean = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

  function analyzeBanner(records, meta) {
    const list = records.slice().sort(byId);
    const limited = meta.pool ? LIMITED[meta.pool] : null;
    const standard = meta.pool ? STANDARD[meta.pool] : null;
    let p5 = 0, p4 = 0, c5 = 0, c4 = 0, c3 = 0;
    let guaranteed = false, contested = 0, cWins = 0, cLoss = 0, gWins = 0, unknown5 = 0;
    const fives = [];
    for (const r of list) {
      p5++; p4++;
      const rank = String(r.rank_type);
      if (rank === '5') {
        const id = String(r.item_id);
        const f = { name: r.name, item_id: id, item_type: r.item_type, time: r.time, pity: p5, result: null, isPickup: null, fromGuarantee: false, unidentified: false };
        if (meta.kind === 'limited') {
          f.isPickup = limited.includes(id);                       // 한정 픽업 대상이면 픽승
          f.unidentified = !f.isPickup && !standard.includes(id);  // LIMITED·STANDARD 모두에 없음
          if (f.unidentified) unknown5++;
          if (guaranteed) { f.result = 'guaranteed'; f.fromGuarantee = true; gWins++; guaranteed = false; }
          else { contested++; if (f.isPickup) { f.result = 'win'; cWins++; } else { f.result = 'loss'; cLoss++; guaranteed = true; } }
        }
        fives.push(f); c5++; p5 = 0; p4 = 0;
      } else if (rank === '4') { c4++; p4 = 0; }
      else { c3++; }
    }
    const pities = fives.map(f => f.pity);
    return {
      total: list.length, jade: list.length * 160, count5: c5, count4: c4, count3: c3,
      currentPity5: p5, currentPity4: p4,
      avgPity5: mean(pities), bestPity: pities.length ? Math.min(...pities) : null, worstPity: pities.length ? Math.max(...pities) : null,
      // luck vs theoretical average (lower pity = luckier); positive % = lucky
      luckPct: (meta.expAvg && pities.length) ? (meta.expAvg - mean(pities)) / meta.expAvg * 100 : null,
      // 50/50
      contested, cWins, cLoss, gWins, unknown5,
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
      unknown5: banners.reduce((s, b) => s + (b.stats.unknown5 || 0), 0),
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

  const api = { analyze, analyzeBanner, monthly, BANNERS, ORDER, STANDARD, LIMITED };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WarpAnalyze = api;
})(typeof window !== 'undefined' ? window : globalThis);

// SOURCES:
//  Standard char pool + rates : https://www.prydwen.gg/star-rail/guides/gacha-system/
//  item_id verification        : https://github.com/Mar-7th/StarRailRes (index_min/en)
//  gacha_type codes            : https://uigf.org/en/standards/srgf.html
//  limited 5* derivation       : StarRailRes index_min/en (all 5* − standard 7); 8xxx/24xxx 제외
