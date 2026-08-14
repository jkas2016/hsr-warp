// Shared warp-analysis logic. Single source (served at /analyze.js, embedded in exe).
// Unit-tested via web/analyze.test.js. 50/50 판정은 픽업 일정(schedule) 기반이다: 5★ 획득 시각의
// 픽업(rate-up) 5★이면 픽승(win), 아니면 픽뚫(loss). '그 시점 픽업이었나'로 판정하므로
// 상시풀 편입·Celestial Invitation·콜라보·리런을 모두 올바르게 처리한다(풀 소속 방식은 구조적으로 불가).
// 일정에 없는 시각의 5★는 unidentified(미확인)로 표시. 일정은 /schedule.json 에서 주입된다.
(function (root) {
  // ---- config (verified constants) ----
  // HSR 기본 배너 테이블. 구 schedule.json(banners 블록이 없는)과의 호환을 위해
  // 내장 폴백으로 남는다. expAvg = 1 / 공식 종합확률(보증 포함).
  const BANNERS = {
    '11': { role: 'limited-char',   name: '캐릭터 이벤트', short: '캐릭터', color: '#a474ff', cap: 90, kind: 'limited',  pool: 'char', rateUp: 0.5,  expAvg: 62.5 },
    '12': { role: 'limited-weapon', name: '광추 이벤트',   short: '광추',   color: '#5aa9ff', cap: 80, kind: 'limited',  pool: 'lc',   rateUp: 0.75, expAvg: 53.5 },
    '1':  { role: 'standard',       name: '스텔라(일반)',  short: '일반',   color: '#52d39a', cap: 90, kind: 'standard', pool: null,   rateUp: null, expAvg: 62.5 },
    '2':  { role: 'beginner',       name: '출발 워프',     short: '출발',   color: '#ff9e45', cap: 50, kind: 'beginner', pool: null,   rateUp: null, expAvg: null },
  };
  const ORDER = ['11', '12', '1', '2'];
  const DEFAULT_RANKS = { top: '5', mid: '4' };

  // 역할 → 분석 동작 매핑. 게임마다 채널 코드는 달라도 역할은 공통이다.
  //   kind  : 'limited' 만 50/50 판정을 받는다.
  //   pool  : schedule 항목의 픽업 키('c' 캐릭터 / 'l' 무기). null 이면 판정 없음.
  const ROLE_SPEC = {
    'limited-char':   { kind: 'limited',  pool: 'char' },
    'limited-weapon': { kind: 'limited',  pool: 'lc' },
    'standard':       { kind: 'standard', pool: null },
    'beginner':       { kind: 'beginner', pool: null },
    'bangboo':        { kind: 'standard', pool: null },
  };

  // resolveConfig 는 analyze() 의 schedule 인자를 정규화한다.
  // 배열이면 구 스키마(픽업 일정만)로 보고 HSR 기본 테이블을 쓴다.
  function resolveConfig(schedule) {
    if (Array.isArray(schedule) || !schedule) {
      return { list: schedule || [], ranks: DEFAULT_RANKS, banners: BANNERS, order: ORDER };
    }
    const banners = {};
    const src = schedule.banners || BANNERS;
    for (const [code, b] of Object.entries(src)) {
      const spec = ROLE_SPEC[b.role] || ROLE_SPEC.standard;
      banners[code] = Object.assign({}, b, { kind: spec.kind, pool: spec.pool });
    }
    return {
      list: schedule.schedule || [],
      ranks: Object.assign({}, DEFAULT_RANKS, schedule.ranks),
      banners,
      order: Object.keys(banners),
    };
  }

  // 역할로 배너 코드를 찾는다. 하드코딩된 '11'/'12' 를 대체한다.
  function codesByRole(cfg, ...roles) {
    return cfg.order.filter((c) => roles.includes(cfg.banners[c].role));
  }

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

  // 캐릭터(11)+광추(12) 합산 지표 — 평균·기준선은 5★ 개수 가중(버전 비교 'all'과 동일 산식),
  // 승/패/확정은 단순 합. 입력은 aggregateFives 산출물(없으면 null 허용).
  // cfg 는 선택 — 생략하면 HSR 기본 테이블로 폴백(하위 호환).
  function combineLimited(charStats, lcStats, cfg) {
    cfg = cfg || resolveConfig(null);
    const charCode = codesByRole(cfg, 'limited-char')[0];
    const lcCode = codesByRole(cfg, 'limited-weapon')[0];
    const charExp = cfg.banners[charCode].expAvg, lcExp = cfg.banners[lcCode].expAvg;
    const c = charStats || {}, l = lcStats || {};
    const n1 = c.count5 || 0, n2 = l.count5 || 0, tot = n1 + n2;
    const avg = tot ? ((c.avgPity5 || 0) * n1 + (l.avgPity5 || 0) * n2) / tot : 0;
    const base = tot ? (charExp * n1 + lcExp * n2) / tot : charExp;
    const cWins = (c.cWins || 0) + (l.cWins || 0), cLoss = (c.cLoss || 0) + (l.cLoss || 0);
    const gWins = (c.gWins || 0) + (l.gWins || 0), contested = cWins + cLoss;
    const bests = [c.bestPity, l.bestPity].filter(v => v != null);
    const worsts = [c.worstPity, l.worstPity].filter(v => v != null);
    return {
      count5: tot, avgPity5: avg, base,
      luckPct: tot ? (base - avg) / base * 100 : null,
      cWins, cLoss, gWins, contested,
      win5050Rate: contested ? cWins / contested : null,
      bestPity: bests.length ? Math.min(...bests) : null,
      worstPity: worsts.length ? Math.max(...worsts) : null,
    };
  }

  function analyzeBanner(records, meta, schedule, ranks) {
    schedule = schedule || [];
    ranks = ranks || DEFAULT_RANKS;
    const schedEnd = schedule.length ? Date.parse(schedule[schedule.length - 1].e) : 0;
    const list = records.slice().sort(byId);
    const poolKey = { char: 'c', lc: 'l' }[meta.pool] || null; // schedule 픽업 키
    let p5 = 0, p4 = 0, c4 = 0, c3 = 0;
    let guaranteed = false;
    const fives = [];
    for (const r of list) {
      p5++; p4++;
      const rank = String(r.rank_type);
      if (rank === ranks.top) {
        const id = String(r.item_id);
        const f = { id: String(r.id), name: r.name, item_id: id, item_type: r.item_type, time: r.time, pity: p5, result: null, isPickup: null, fromGuarantee: false, unidentified: false };
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
      } else if (rank === ranks.mid) { c4++; p4 = 0; }
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

  function monthly(list, ranks) {
    ranks = ranks || DEFAULT_RANKS;
    const m = {};
    for (const r of list) {
      const key = String(r.time || '').slice(0, 7).replace('-', ''); // YYYYMM
      if (!/^\d{6}$/.test(key)) continue;
      const b = m[key] || (m[key] = { month: key, total: 0, jade: 0, c5: 0, c4: 0, c3: 0, fives: [] });
      b.total++; b.jade += 160;
      const rank = String(r.rank_type);
      if (rank === ranks.top) { b.c5++; b.fives.push({ name: r.name, item_id: String(r.item_id), gacha_type: String(r.gacha_type), time: r.time }); }
      else if (rank === ranks.mid) b.c4++; else b.c3++;
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
  function filterAnalysis(full, data, win, cfg) {
    cfg = cfg || resolveConfig(null);
    const inWin = t => { const ms = dms(t); return ms >= win.s && ms < win.e; };
    const list = (Array.isArray(data.list) ? data.list : []).filter(r => inWin(r.time));

    // gacha_type별 원본 카운트(천장 무관, 시각 버킷)
    const cnt = {}; for (const k of cfg.order) cnt[k] = { total: 0, c4: 0, c3: 0 };
    for (const r of list) {
      const t = String(r.gacha_type); if (!cnt[t]) continue;
      cnt[t].total++;
      const rk = String(r.rank_type);
      if (rk === cfg.ranks.mid) cnt[t].c4++; else if (rk !== cfg.ranks.top) cnt[t].c3++;
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
    }); // 뽑기 0 배너도 유지(0 통계) — 무뽑기 버전을 스코프해도 뷰가 0으로 표시해야 한다.

    const all5 = banners.flatMap(b => b.stats.fives.map(f => ({ ...f, banner: b.meta.short, gacha_type: b.type })));
    all5.sort((a, b) => (a.time < b.time ? 1 : a.time > b.time ? -1 : 0));
    const charCode = codesByRole(cfg, 'limited-char')[0];
    const charFives = banners.filter(b => codesByRole(cfg, 'limited-char', 'standard').includes(b.type)).flatMap(b => b.stats.fives.map(f => f.pity));
    const lim = banners.find(b => b.meta.role === 'limited-char'), lc = banners.find(b => b.meta.role === 'limited-weapon');
    const charExp = cfg.banners[charCode] ? cfg.banners[charCode].expAvg : null;
    return {
      info: full.info || {},
      total: list.length,
      jade: list.length * 160,
      count5: banners.reduce((s, b) => s + b.stats.count5, 0),
      count4: banners.reduce((s, b) => s + b.stats.count4, 0),
      count3: banners.reduce((s, b) => s + b.stats.count3, 0),
      unknown5: banners.reduce((s, b) => s + (b.stats.unknown5 || 0), 0),
      banners, all5, monthly: monthly(list, cfg.ranks),
      luck: {
        charAvgPity: mean(charFives),
        charLuckPct: charFives.length ? (charExp - mean(charFives)) / charExp * 100 : null,
        charBanner: lim ? lim.stats : null,
        lcBanner: lc ? lc.stats : null,
        limited: combineLimited(lim ? lim.stats : null, lc ? lc.stats : null, cfg),
      },
    };
  }

  // 각 버전 윈도우의 요약을 비교표 행으로. 뽑기 0 버전 제외.
  // 캐릭(11)·광추(12)를 각각, 그리고 all=둘 합산(픽승/픽뚫 합, 평균뽑기·기준선은 5★ 개수 가중)으로.
  function analyzeVersions(full, data, versions, cfg) {
    cfg = cfg || resolveConfig(null);
    const charCode = codesByRole(cfg, 'limited-char')[0];
    const lcCode = codesByRole(cfg, 'limited-weapon')[0];
    const fmt = ms => ms === Infinity ? '' : new Date(ms).toISOString().slice(0, 10);
    const metric = (b, base) => ({
      avgPity: b ? b.stats.avgPity5 : null, cWins: b ? b.stats.cWins : 0,
      cLoss: b ? b.stats.cLoss : 0, count5: b ? b.stats.count5 : 0, base,
    });
    return versionWindows(versions).map(w => {
      const a = filterAnalysis(full, data, w, cfg);
      if (!a.total) return null;
      const charBanner = a.banners.find(b => b.type === charCode);
      const lcBanner = a.banners.find(b => b.type === lcCode);
      const char = metric(charBanner, cfg.banners[charCode].expAvg);
      const lc = metric(lcBanner, cfg.banners[lcCode].expAvg);
      const combined = combineLimited(charBanner ? charBanner.stats : null, lcBanner ? lcBanner.stats : null, cfg);
      const all = {
        avgPity: combined.avgPity5, cWins: combined.cWins, cLoss: combined.cLoss,
        count5: combined.count5, base: combined.base,
      };
      return { v: w.v, s: fmt(w.s), e: fmt(w.e), total: a.total, jade: a.jade, count5: a.count5, char, lc, all };
    }).filter(Boolean);
  }

  function analyze(data, schedule) {
    const cfg = resolveConfig(schedule);
    const list = Array.isArray(data.list) ? data.list : [];
    const groups = {}; for (const k of cfg.order) groups[k] = [];
    for (const r of list) { const t = String(r.gacha_type); if (groups[t]) groups[t].push(r); }
    const banners = cfg.order.filter(k => groups[k].length).map(k => ({ type: k, meta: cfg.banners[k], stats: analyzeBanner(groups[k], cfg.banners[k], cfg.list, cfg.ranks) }));

    const all5 = banners.flatMap(b => b.stats.fives.map(f => ({ ...f, banner: b.meta.short, gacha_type: b.type })));
    all5.sort((a, b) => (a.time < b.time ? 1 : a.time > b.time ? -1 : 0)); // newest first

    // account-wide luck on character-path banners (limited-char + standard)
    const charCode = codesByRole(cfg, 'limited-char')[0];
    const charFives = banners.filter(b => codesByRole(cfg, 'limited-char', 'standard').includes(b.type)).flatMap(b => b.stats.fives.map(f => f.pity));
    const lim = banners.find(b => b.meta.role === 'limited-char');
    const lc = banners.find(b => b.meta.role === 'limited-weapon');
    const charExp = cfg.banners[charCode] ? cfg.banners[charCode].expAvg : null;
    return {
      info: data.info || {},
      total: list.length, jade: list.length * 160,
      count5: banners.reduce((s, b) => s + b.stats.count5, 0),
      count4: banners.reduce((s, b) => s + b.stats.count4, 0),
      count3: banners.reduce((s, b) => s + b.stats.count3, 0),
      unknown5: banners.reduce((s, b) => s + (b.stats.unknown5 || 0), 0),
      banners, all5,
      monthly: monthly(list, cfg.ranks),
      luck: {
        charAvgPity: mean(charFives),
        charLuckPct: charFives.length ? (charExp - mean(charFives)) / charExp * 100 : null,
        charBanner: lim ? lim.stats : null,
        lcBanner: lc ? lc.stats : null,
        limited: combineLimited(lim ? lim.stats : null, lc ? lc.stats : null, cfg),
      },
    };
  }

  const api = { analyze, analyzeBanner, aggregateFives, combineLimited, filterAnalysis, versionWindows, analyzeVersions, monthly, resolveConfig, ROLE_SPEC, BANNERS, ORDER };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WarpAnalyze = api;
})(typeof window !== 'undefined' ? window : globalThis);

// SOURCES:
//  banner pickup schedule (web/schedule.json) : https://github.com/Mantan21/HSR-Warp-Simulator
//      (banners/lists.json: bannerID→featured slug; characters.json·light-cones.json: slug→itemID)
//  item_id verification              : https://github.com/Mar-7th/StarRailRes (index_min/en)
//  probabilities / 50:50             : https://www.prydwen.gg/star-rail/guides/gacha-system/
//  gacha_type codes                  : https://uigf.org/en/standards/srgf.html
