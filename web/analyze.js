// Shared warp-analysis logic. Single source (served at /analyze.js, embedded in exe).
// Unit-tested via web/analyze.test.js. 50/50 판정은 픽업 일정(schedule) 기반이다: 5★ 획득 시각의
// 픽업(rate-up) 5★이면 픽승(win), 아니면 픽뚫(loss). '그 시점 픽업이었나'로 판정하므로
// 상시풀 편입·Celestial Invitation·콜라보·리런을 모두 올바르게 처리한다(풀 소속 방식은 구조적으로 불가).
// 일정에 없는 시각의 5★는 unidentified(미확인)로 표시. 일정은 /schedule.json 에서 주입된다.
(function (root) {
  // ---- config (verified constants) ----
  const BANNERS = {
    '11': { name: '캐릭터 이벤트', short: '캐릭터', color: '#a474ff', cap: 90, kind: 'limited', pool: 'char', rateUp: 0.5,  expAvg: 62.5 },
    '12': { name: '광추 이벤트',   short: '광추',   color: '#5aa9ff', cap: 80, kind: 'limited', pool: 'lc',   rateUp: 0.75, expAvg: 53.5 },
    '1':  { name: '스텔라(일반)',  short: '일반',   color: '#52d39a', cap: 90, kind: 'standard', pool: null, rateUp: null, expAvg: 62.5 },
    '2':  { name: '출발 워프',     short: '출발',   color: '#ff9e45', cap: 50, kind: 'beginner', pool: null, rateUp: null, expAvg: null },
  };
  const ORDER = ['11', '12', '1', '2'];
  const byId = (a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : BigInt(a.id) > BigInt(b.id) ? 1 : 0);
  const mean = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  const DAY = 86400000, MATCH_TOL = 60 * DAY;                 // schedule 날짜는 근사(cadence) — 픽업 기간과 ±60일까지 같은 배너로 인정
  // 5★(item_id)가 시각 t의 픽업이었는지: t가 그 item을 픽업한 기간의 ±MATCH_TOL 안이면 픽승.
  // (게임상 캐릭터는 자기 배너 때만 뽑히므로 가까운 픽업 기간=실제 뽑은 배너. 상시풀 편입분은
  //  픽업 기간이 수개월 전이라 허용오차 밖 → 픽뚫. 허용오차가 cadence 날짜 오차는 흡수하고
  //  리런/표준편입 간격(수개월)보다는 작아 오판하지 않는다.)
  function wasPickup(id, t, poolKey, schedule) {
    for (const p of schedule) {
      if (!p[poolKey].includes(id)) continue;
      const s = Date.parse(p.s), e = Date.parse(p.e);
      const d = (t >= s && t < e) ? 0 : Math.min(Math.abs(t - s), Math.abs(t - e));
      if (d <= MATCH_TOL) return true;
    }
    return false;
  }

  // 이미 분류된 5★ 배열에서 요약치를 재계산한다(천장·result·isPickup은 입력값 그대로 사용 — 재분류 금지).
  function aggregateFives(fives, meta) {
    const pities = fives.map(f => f.pity);
    const cWins = fives.filter(f => f.result === 'win').length;
    const cLoss = fives.filter(f => f.result === 'loss').length;
    const gWins = fives.filter(f => f.result === 'guaranteed').length;
    const contested = cWins + cLoss;
    const unknown5 = fives.filter(f => f.unidentified).length;
    const avg = mean(pities);
    return {
      count5: fives.length,
      avgPity5: avg,
      bestPity: pities.length ? Math.min(...pities) : null,
      worstPity: pities.length ? Math.max(...pities) : null,
      luckPct: (meta.expAvg && pities.length) ? (meta.expAvg - avg) / meta.expAvg * 100 : null,
      contested, cWins, cLoss, gWins, unknown5,
      win5050Rate: contested ? cWins / contested : null,
      pickupTotal: cWins + gWins,
    };
  }

  function analyzeBanner(records, meta, schedule) {
    schedule = schedule || [];
    const schedEnd = schedule.length ? Date.parse(schedule[schedule.length - 1].e) : 0;
    const list = records.slice().sort(byId);
    const poolKey = meta.pool === 'char' ? 'c' : meta.pool === 'lc' ? 'l' : null; // schedule 픽업 키
    let p5 = 0, p4 = 0, c4 = 0, c3 = 0;
    let guaranteed = false;
    const fives = [];
    for (const r of list) {
      p5++; p4++;
      const rank = String(r.rank_type);
      if (rank === '5') {
        const id = String(r.item_id);
        const f = { name: r.name, item_id: id, item_type: r.item_type, time: r.time, pity: p5, result: null, isPickup: null, fromGuarantee: false, unidentified: false };
        if (meta.kind === 'limited') {
          const t = Date.parse(String(r.time).slice(0, 10));
          if (!(t < schedEnd)) { f.unidentified = true; }              // 일정 범위 밖(신규 패치 미반영) — 판정 보류
          else {
            f.isPickup = wasPickup(id, t, poolKey, schedule);          // 그 시점 픽업이면 픽승, 아니면 픽뚫
            if (guaranteed) { f.result = 'guaranteed'; f.fromGuarantee = true; guaranteed = false; }
            else { if (f.isPickup) { f.result = 'win'; } else { f.result = 'loss'; guaranteed = true; } }
          }
        }
        fives.push(f); p5 = 0; p4 = 0;
      } else if (rank === '4') { c4++; p4 = 0; }
      else { c3++; }
    }
    return {
      total: list.length, jade: list.length * 160, count4: c4, count3: c3,
      currentPity5: p5, currentPity4: p4,
      ...aggregateFives(fives, meta),
      currentGuaranteed: guaranteed,
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

  const dms = t => Date.parse(String(t).slice(0, 10)); // 'YYYY-MM-DD ...' → ms (date 단위 버킷)

  // versions [{v,s}] → s 오름차순 정렬된 윈도우 [{v, s(ms), e(ms)}]. 마지막 e=Infinity.
  function versionWindows(versions) {
    const vs = (versions || []).filter(x => x && x.v && x.s)
      .map(x => ({ v: x.v, s: Date.parse(x.s) }))
      .filter(x => !isNaN(x.s))
      .sort((a, b) => a.s - b.s);
    return vs.map((x, i) => ({ v: x.v, s: x.s, e: i + 1 < vs.length ? vs[i + 1].s : Infinity }));
  }

  // 전체 분석 결과(full)를 한 윈도우 {s,e}(ms)로 필터해 analyze()와 같은 모양으로 반환.
  // 분류된 fives는 시각 필터만(천장·result 재계산 금지), 뽑기 횟수는 원본 레코드를 시각 버킷.
  function filterAnalysis(full, data, win) {
    const inWin = t => { const ms = dms(t); return ms >= win.s && ms < win.e; };
    const list = (Array.isArray(data.list) ? data.list : []).filter(r => inWin(r.time));

    // gacha_type별 원본 카운트(천장 무관, 시각 버킷)
    const cnt = {}; for (const k of ORDER) cnt[k] = { total: 0, c4: 0, c3: 0 };
    for (const r of list) {
      const t = String(r.gacha_type); if (!cnt[t]) continue;
      cnt[t].total++;
      const rk = String(r.rank_type);
      if (rk === '4') cnt[t].c4++; else if (rk !== '5') cnt[t].c3++;
    }

    const banners = full.banners.map(b => {
      const fives = b.stats.fives.filter(f => inWin(f.time));
      const c = cnt[b.type] || { total: 0, c4: 0, c3: 0 };
      return {
        type: b.type, meta: b.meta,
        stats: {
          total: c.total, jade: c.total * 160, count4: c.c4, count3: c.c3,
          currentPity5: null, currentPity4: null, currentGuaranteed: false,
          ...aggregateFives(fives, b.meta),
          fives,
        },
      };
    }).filter(b => b.stats.total > 0);

    const all5 = banners.flatMap(b => b.stats.fives.map(f => ({ ...f, banner: b.meta.short, gacha_type: b.type })));
    all5.sort((a, b) => (a.time < b.time ? 1 : a.time > b.time ? -1 : 0));
    const charFives = banners.filter(b => b.type === '11' || b.type === '1').flatMap(b => b.stats.fives.map(f => f.pity));
    const lim = banners.find(b => b.type === '11'), lc = banners.find(b => b.type === '12');
    return {
      info: full.info || {},
      total: list.length,
      jade: list.length * 160,
      count5: banners.reduce((s, b) => s + b.stats.count5, 0),
      count4: banners.reduce((s, b) => s + b.stats.count4, 0),
      count3: banners.reduce((s, b) => s + b.stats.count3, 0),
      unknown5: banners.reduce((s, b) => s + (b.stats.unknown5 || 0), 0),
      banners, all5, monthly: monthly(list),
      luck: {
        charAvgPity: mean(charFives),
        charLuckPct: charFives.length ? (62.5 - mean(charFives)) / 62.5 * 100 : null,
        charBanner: lim ? lim.stats : null,
        lcBanner: lc ? lc.stats : null,
      },
    };
  }

  function analyze(data, schedule) {
    const list = Array.isArray(data.list) ? data.list : [];
    const groups = {}; for (const k of ORDER) groups[k] = [];
    for (const r of list) { const t = String(r.gacha_type); if (groups[t]) groups[t].push(r); }
    const banners = ORDER.filter(k => groups[k].length).map(k => ({ type: k, meta: BANNERS[k], stats: analyzeBanner(groups[k], BANNERS[k], schedule) }));

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

  const api = { analyze, analyzeBanner, aggregateFives, filterAnalysis, versionWindows, monthly, BANNERS, ORDER };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WarpAnalyze = api;
})(typeof window !== 'undefined' ? window : globalThis);

// SOURCES:
//  banner pickup schedule (web/schedule.json) : https://github.com/Mantan21/HSR-Warp-Simulator
//      (banners/lists.json: bannerID→featured slug; characters.json·light-cones.json: slug→itemID)
//  item_id verification              : https://github.com/Mar-7th/StarRailRes (index_min/en)
//  probabilities / 50:50             : https://www.prydwen.gg/star-rail/guides/gacha-system/
//  gacha_type codes                  : https://uigf.org/en/standards/srgf.html
