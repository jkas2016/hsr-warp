// Shared warp-analysis logic. Single source (served at /analyze.js, embedded in exe).
// Unit-tested via web/analyze.test.js. 50/50 판정은 픽업 일정(SCHEDULE) 기반이다: 5★ 획득 시각의
// 픽업(rate-up) 5★이면 픽승(win), 아니면 픽뚫(loss). '그 시점 픽업이었나'로 판정하므로
// 상시풀 편입·Celestial Invitation·콜라보·리런을 모두 올바르게 처리한다(풀 소속 방식은 구조적으로 불가).
// 일정에 없는 시각의 5★는 unidentified(미확인)로 표시 — 신규 패치 미반영 신호. SCHEDULE 출처는 하단 SOURCES.
(function (root) {
  // ---- config (verified constants) ----
  // HSR 배너 픽업 일정. 각 항목 [s,e) 기간의 픽업(rate-up) 5★ item_id: c=캐릭터(gacha_type 11), l=광추(12).
  // 픽업 5★ 출처: Mantan21/HSR-Warp-Simulator(lists+characters+light-cones). 날짜: 3.0+ 는 3.1=2025-02-25
  // 앵커 42일 cadence(실 gacha_id 시간창으로 검증), 3.0 미만은 1.0=2023-04-26 앵커 근사. 신규 패치 출시 시 항목 추가.
  const SCHEDULE = [
    {s:'2023-04-26',e:'2023-05-17',c:['1102'],l:['23001']}, // 1.0 p1
    {s:'2023-05-17',e:'2023-06-07',c:['1204'],l:['23010']}, // 1.0 p2
    {s:'2023-06-07',e:'2023-06-28',c:['1006'],l:['23007']}, // 1.1 p1
    {s:'2023-06-28',e:'2023-07-19',c:['1203'],l:['23008']}, // 1.1 p2
    {s:'2023-07-19',e:'2023-08-09',c:['1205'],l:['23009']}, // 1.2 p1
    {s:'2023-08-09',e:'2023-08-30',c:['1005'],l:['23006']}, // 1.2 p2
    {s:'2023-08-30',e:'2023-09-20',c:['1213'],l:['23015']}, // 1.3 p1
    {s:'2023-09-20',e:'2023-10-11',c:['1208'],l:['23011']}, // 1.3 p2
    {s:'2023-10-11',e:'2023-11-01',c:['1212'],l:['23014']}, // 1.4 p1
    {s:'2023-11-01',e:'2023-11-22',c:['1112','1102'],l:['23016','23001']}, // 1.4 p2
    {s:'2023-11-22',e:'2023-12-13',c:['1217'],l:['23017']}, // 1.5 p1
    {s:'2023-12-13',e:'2024-01-03',c:['1302','1006'],l:['23018','23007']}, // 1.5 p2
    {s:'2024-01-03',e:'2024-01-24',c:['1303','1205'],l:['23019','23009']}, // 1.6 p1
    {s:'2024-01-24',e:'2024-02-14',c:['1305','1005'],l:['23020','23006']}, // 1.6 p2
    {s:'2024-02-14',e:'2024-03-06',c:['1307','1213'],l:['23022','23015']}, // 2.0 p1
    {s:'2024-03-06',e:'2024-03-27',c:['1306','1204'],l:['23021','23010']}, // 2.0 p2
    {s:'2024-03-27',e:'2024-04-17',c:['1308','1203'],l:['23024','23008']}, // 2.1 p1
    {s:'2024-04-17',e:'2024-05-08',c:['1304','1212'],l:['23023','23014']}, // 2.1 p2
    {s:'2024-05-08',e:'2024-05-29',c:['1309','1112'],l:['23026','23016']}, // 2.2 p1
    {s:'2024-05-29',e:'2024-06-19',c:['1315','1208'],l:['23027','23011']}, // 2.2 p2
    {s:'2024-06-19',e:'2024-07-10',c:['1310','1303'],l:['23025','23019']}, // 2.3 p1
    {s:'2024-07-10',e:'2024-07-31',c:['1314','1302'],l:['23028','23018']}, // 2.3 p2
    {s:'2024-07-31',e:'2024-08-21',c:['1221','1217'],l:['23030','23017']}, // 2.4 p1
    {s:'2024-08-21',e:'2024-09-11',c:['1218','1306'],l:['23029','23021']}, // 2.4 p2
    {s:'2024-09-11',e:'2024-10-02',c:['1220','1005','1307','1309'],l:['23031','23006','23022','23026']}, // 2.5 p1
    {s:'2024-10-02',e:'2024-10-23',c:['1222','1112'],l:['23032','23016']}, // 2.5 p2
    {s:'2024-10-23',e:'2024-11-13',c:['1317','1213'],l:['23033','23015']}, // 2.6 p1
    {s:'2024-11-13',e:'2024-12-04',c:['1308','1304'],l:['23024','23023']}, // 2.6 p2
    {s:'2024-12-04',e:'2024-12-25',c:['1313','1204'],l:['23034','23010']}, // 2.7 p1
    {s:'2024-12-25',e:'2025-01-14',c:['1225','1310'],l:['23035','23025']}, // 2.7 p2
    {s:'2025-01-14',e:'2025-02-04',c:['1401','1222','1220','1314'],l:['23037','23032','23031','23028']}, // 3.0 p1
    {s:'2025-02-04',e:'2025-02-25',c:['1402','1315','1309','1006'],l:['23036','23027','23026','23007']}, // 3.0 p2
    {s:'2025-02-25',e:'2025-03-18',c:['1403','1221'],l:['23038','23030']}, // 3.1 p1
    {s:'2025-03-18',e:'2025-04-08',c:['1404','1217'],l:['23039','23017']}, // 3.1 p2
    {s:'2025-04-08',e:'2025-04-29',c:['1407','1225','1218','1308'],l:['23040','23035','23029','23024']}, // 3.2 p1
    {s:'2025-04-29',e:'2025-05-20',c:['1405','1305'],l:['23041','23020']}, // 3.2 p2
    {s:'2025-05-20',e:'2025-06-10',c:['1409','1401'],l:['23042','23037']}, // 3.3 p1
    {s:'2025-06-10',e:'2025-07-01',c:['1406','1402'],l:['23043','23036']}, // 3.3 p2
    {s:'2025-07-01',e:'2025-07-22',c:['1408','1403','1313','1306','1014','1015'],l:['23044','23038','23034','23021','23045','23046']}, // 3.4 p1
    {s:'2025-07-22',e:'2025-08-12',c:['1310','1212','1205','1014','1015'],l:['23025','23014','23009','23045','23046']}, // 3.4 p2
    {s:'2025-08-12',e:'2025-09-02',c:['1410','1005','1014','1015'],l:['23047','23006','23045','23046']}, // 3.5 p1
    {s:'2025-09-02',e:'2025-09-23',c:['1412','1006','1014','1015'],l:['23048','23007','23045','23046']}, // 3.5 p2
    {s:'2025-09-23',e:'2025-10-14',c:['1413','1401','1014','1015'],l:['23049','23037','23045','23046']}, // 3.6 p1
    {s:'2025-10-14',e:'2025-11-04',c:['1414','1405','1014','1015'],l:['23051','23041','23045','23046']}, // 3.6 p2
    {s:'2025-11-04',e:'2025-11-25',c:['1415','1409','1407','1403','1014','1015'],l:['23052','23042','23040','23038']}, // 3.7 p1
    {s:'2025-11-25',e:'2025-12-16',c:['1415','1408','1406','1404','1014','1015'],l:['23052','23044','23043','23039']}, // 3.7 p2
    {s:'2025-12-16',e:'2025-12-30',c:['1321','1310','1014','1015'],l:['23050','23025']}, // 3.8 p1
    {s:'2025-12-30',e:'2026-01-13',c:['1225','1222','1014','1015'],l:['23035','23032']}, // 3.8 p2
    {s:'2026-01-13',e:'2026-01-27',c:['1402','1313','1014','1015'],l:['23036','23034']}, // 3.8 p3
    {s:'2026-01-27',e:'2026-02-17',c:['1502','1413','1410','1307'],l:['23054','23049','23047','23022']}, // 4.0 p1
    {s:'2026-02-17',e:'2026-03-10',c:['1501','1412','1317','1306'],l:['23053','23048','23033','23021']}, // 4.0 p2
    {s:'2026-03-10',e:'2026-03-31',c:['1504','1409'],l:['23056','23042']}, // 4.1 p1
    {s:'2026-03-31',e:'2026-04-21',c:['1504','1315'],l:['23056','23027']}, // 4.1 p2
    {s:'2026-04-21',e:'2026-05-12',c:['1506','1321','1407','1310'],l:['23057','23050','23040','23025']}, // 4.2 p1 (23057=Welcome to the Cosmic City; Mantan은 23057↔23058을 뒤바꿔 저장 → 게임 id로 교정)
    {s:'2026-05-12',e:'2026-06-02',c:['1505','1403','1313','1220'],l:['23058','23038','23034','23031']}, // 4.2 p2 (23058=Until the Flowers Bloom Again)
    {s:'2026-06-02',e:'2026-06-23',c:['1507','1502'],l:['23059','23054']}, // 4.3 p1
    {s:'2026-06-23',e:'2026-07-14',c:['1415','1408'],l:['23052','23044']}, // 4.3 p2
  ];
  const BANNERS = {
    '11': { name: '캐릭터 이벤트', short: '캐릭터', color: '#a474ff', cap: 90, kind: 'limited', pool: 'char', rateUp: 0.5,  expAvg: 62.5 },
    '12': { name: '광추 이벤트',   short: '광추',   color: '#5aa9ff', cap: 80, kind: 'limited', pool: 'lc',   rateUp: 0.75, expAvg: 53.5 },
    '1':  { name: '스텔라(일반)',  short: '일반',   color: '#52d39a', cap: 90, kind: 'standard', pool: null, rateUp: null, expAvg: 62.5 },
    '2':  { name: '출발 워프',     short: '출발',   color: '#ff9e45', cap: 50, kind: 'beginner', pool: null, rateUp: null, expAvg: null },
  };
  const ORDER = ['11', '12', '1', '2'];
  const byId = (a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : BigInt(a.id) > BigInt(b.id) ? 1 : 0);
  const mean = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  const DAY = 86400000, MATCH_TOL = 60 * DAY;                 // SCHEDULE 날짜는 근사(cadence) — 픽업 기간과 ±60일까지 같은 배너로 인정
  const SCHED_END = SCHEDULE.length ? Date.parse(SCHEDULE[SCHEDULE.length - 1].e) : 0;
  // 5★(item_id)가 시각 t의 픽업이었는지: t가 그 item을 픽업한 기간의 ±MATCH_TOL 안이면 픽승.
  // (게임상 캐릭터는 자기 배너 때만 뽑히므로 가까운 픽업 기간=실제 뽑은 배너. 상시풀 편입분은
  //  픽업 기간이 수개월 전이라 허용오차 밖 → 픽뚫. 허용오차가 cadence 날짜 오차는 흡수하고
  //  리런/표준편입 간격(수개월)보다는 작아 오판하지 않는다.)
  function wasPickup(id, t, poolKey) {
    for (const p of SCHEDULE) {
      if (!p[poolKey].includes(id)) continue;
      const s = Date.parse(p.s), e = Date.parse(p.e);
      const d = (t >= s && t < e) ? 0 : Math.min(Math.abs(t - s), Math.abs(t - e));
      if (d <= MATCH_TOL) return true;
    }
    return false;
  }

  function analyzeBanner(records, meta) {
    const list = records.slice().sort(byId);
    const poolKey = meta.pool === 'char' ? 'c' : meta.pool === 'lc' ? 'l' : null; // SCHEDULE 픽업 키
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
          const t = Date.parse(String(r.time).slice(0, 10));
          if (!(t < SCHED_END)) { f.unidentified = true; unknown5++; }  // 일정 범위 밖(신규 패치 미반영) — 판정 보류
          else {
            f.isPickup = wasPickup(id, t, poolKey);          // 그 시점 픽업이면 픽승, 아니면 픽뚫
            if (guaranteed) { f.result = 'guaranteed'; f.fromGuarantee = true; gWins++; guaranteed = false; }
            else { contested++; if (f.isPickup) { f.result = 'win'; cWins++; } else { f.result = 'loss'; cLoss++; guaranteed = true; } }
          }
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

  const api = { analyze, analyzeBanner, monthly, BANNERS, ORDER, SCHEDULE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WarpAnalyze = api;
})(typeof window !== 'undefined' ? window : globalThis);

// SOURCES:
//  banner pickup schedule (SCHEDULE) : https://github.com/Mantan21/HSR-Warp-Simulator
//      (banners/lists.json: bannerID→featured slug; characters.json·light-cones.json: slug→itemID)
//  item_id verification              : https://github.com/Mar-7th/StarRailRes (index_min/en)
//  probabilities / 50:50             : https://www.prydwen.gg/star-rail/guides/gacha-system/
//  gacha_type codes                  : https://uigf.org/en/standards/srgf.html
