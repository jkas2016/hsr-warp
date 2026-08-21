// Shared warp-analysis logic. Single source (served at /analyze.js, embedded in exe).
// Unit-tested via web/analyze.test.js. 50/50 판정은 픽업 일정(schedule) 기반이다: 5★ 획득 시각의
// 픽업(rate-up) 5★이면 픽승(win), 아니면 픽뚫(loss). '그 시점 픽업이었나'로 판정하므로
// 상시풀 편입·Celestial Invitation·콜라보·리런을 모두 올바르게 처리한다(풀 소속 방식은 구조적으로 불가).
// 판정을 확신할 수 없는 5★는 unidentified(미확인)로 표시한다 — 일정 범위 밖(신규 패치 미반영),
// 픽업 목록을 아직 모르는 구간(일정 항목의 p), 그리고 그 이후(확정 체인 상태를 알 수 없다).
// 일정은 /schedule.json 에서 주입된다.
(function (root) {
  /**
   * SRGF v1.0 워프 기록 한 건.
   * @typedef {Object} WarpRecord
   * @property {string} id 거대 정수 문자열(비교는 BigInt — Number 금지).
   * @property {string} item_id 아이템 ID.
   * @property {string} name 아이템 이름.
   * @property {string} [item_type] 아이템 종류(캐릭터/광추 등).
   * @property {string} rank_type 희귀도('5'/'4'/'3' — 게임별 ranks 로 해석).
   * @property {string} gacha_type 배너 코드.
   * @property {string} time 'YYYY-MM-DD HH:mm:ss' 형식의 뽑은 시각.
   */

  /**
   * 배너 한 종류의 메타(표시명·색·천장·기대 평균).
   * @typedef {Object} BannerMeta
   * @property {string} role 역할 키(ROLE_SPEC 참조).
   * @property {string} name 배너 전체 이름.
   * @property {string} short 짧은 표시명.
   * @property {string} color 배너 대표 색(hex).
   * @property {number} cap 천장(하드 파이티).
   * @property {'limited'|'standard'|'beginner'} kind 분석 동작 종류 — 'limited' 만 50/50 판정.
   * @property {'char'|'lc'|null} pool 픽업 풀 키. null 이면 판정 없음.
   * @property {number|null} rateUp 픽업 확률.
   * @property {number|null} expAvg 5★ 기대 평균 뽑기 수(1 / 공식 종합확률).
   */

  /**
   * 픽업 일정 한 구간.
   * @typedef {Object} SchedulePeriod
   * @property {string} s 시작일('YYYY-MM-DD').
   * @property {string} e 종료일('YYYY-MM-DD').
   * @property {string[]} c 픽업 캐릭터 item_id 목록.
   * @property {string[]} l 픽업 광추/W-엔진 item_id 목록.
   * @property {string[]} [p] 픽업 목록을 모르는 pool 키 목록('c'/'l'). 일정 소스가 신규
   *   배너의 픽업을 아직 안 채운 구간에 붙는다. 해당 pool 의 판정은 보류한다(구 스키마엔 없음).
   */

  /**
   * resolveConfig 가 정규화한 게임별 분석 설정.
   * @typedef {Object} AnalyzeConfig
   * @property {SchedulePeriod[]} list 픽업 일정.
   * @property {{top: string, mid: string}} ranks 최고/중간 희귀도 코드.
   * @property {Object<string, BannerMeta>} banners 배너 코드 → 메타.
   * @property {string[]} order 배너 표시 순서(코드 배열).
   */

  /**
   * 5★ 한 건의 판정 결과.
   * @typedef {Object} FiveStar
   * @property {string} id 기록 ID.
   * @property {string} name 아이템 이름.
   * @property {string} item_id 아이템 ID.
   * @property {string} [item_type] 아이템 종류.
   * @property {string} time 뽑은 시각.
   * @property {number} pity 직전 5★ 이후 소모한 뽑기 수.
   * @property {'win'|'loss'|'guaranteed'|null} result 픽승/픽뚫/확정. limited 아닌 배너는 null.
   * @property {boolean|null} isPickup 그 시점 픽업 대상이었는지.
   * @property {boolean} fromGuarantee 확정(천장 보증)으로 나왔는지.
   * @property {boolean} unidentified 판정 보류인지(일정 범위 밖 / 픽업 목록 미상 구간 / 그 이후).
   */

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
    // ZZZ 특별 픽업 채널(예: 3인 동시 픽업). 독점·W-엔진과 별개 코드로 오지만
    // 픽업 판정 규칙은 같아 같은 pool 을 본다.
    'special-char':   { kind: 'limited',  pool: 'char' },
    'special-weapon': { kind: 'limited',  pool: 'lc' },
  };

  /**
   * analyze() 의 schedule 인자를 게임별 분석 설정으로 정규화한다.
   * 배열이면 구 스키마(픽업 일정만)로 보고 HSR 기본 테이블을 쓴다.
   * @param {SchedulePeriod[]|Object|null|undefined} schedule schedule.json 전체 객체, 구 스키마 배열, 또는 없음.
   * @returns {AnalyzeConfig} 정규화된 설정.
   */
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
      // Object.keys() 는 정수 유사 문자열 키를 오름차순 숫자로 재정렬한다(예: '11'이 '2' 앞으로 안 감).
      // 이는 배너 표시 순서를 조용히 뒤집으므로, schedule.order 가 있으면 반드시 그걸 쓴다.
      order: schedule.order || Object.keys(banners),
    };
  }

  /**
   * 역할로 배너 코드를 찾는다. 하드코딩된 '11'/'12' 를 대체한다.
   * @param {AnalyzeConfig} cfg 분석 설정.
   * @param {...string} roles 찾을 역할 키(예: 'limited-char').
   * @returns {string[]} order 순서를 유지한 배너 코드 목록.
   */
  function codesByRole(cfg, ...roles) {
    // order 에 banners 없는 코드가 섞이면(예: 원격 schedule.json 오배포) 여기서 TypeError로
    // 대시보드 전체가 백지가 된다 — data.js 의 동일 조회(banners()/roleOf 등)와 방어 수준을 맞춘다.
    return cfg.order.filter((c) => cfg.banners[c] && roles.includes(cfg.banners[c].role));
  }

  /**
   * 대표 캐릭터·무기 배너 외의 한정 채널을 combineLimited 의 extras 형태로 뽑는다.
   * ZZZ 특별 픽업(102/103)처럼 픽업 규칙은 같은데 코드가 더 있는 채널을 계정
   * 전체 지표에서 빠뜨리지 않기 위한 것이다.
   * @param {Array<Object>} banners analyze() 가 만든 배너 목록.
   * @param {Object|undefined} lim 대표 limited-char 배너.
   * @param {Object|undefined} lc 대표 limited-weapon 배너.
   * @returns {Array<{stats: Object, expAvg: number|null}>} 나머지 한정 채널.
   */
  function extraLimited(banners, lim, lc) {
    return banners
      .filter(b => b.meta && b.meta.kind === 'limited' && b !== lim && b !== lc)
      .map(b => ({ stats: b.stats, expAvg: b.meta.expAvg }));
  }

  /**
   * 기록 ID 오름차순 비교자. ID는 거대 정수라 BigInt 로 비교한다(Number 금지).
   * @param {WarpRecord} a
   * @param {WarpRecord} b
   * @returns {number} -1 | 0 | 1
   */
  const byId = (a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : BigInt(a.id) > BigInt(b.id) ? 1 : 0);
  /**
   * 산술 평균. 빈 배열은 0.
   * @param {number[]} a
   * @returns {number}
   */
  const mean = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  const DAY = 86400000, MATCH_TOL = 60 * DAY;                 // schedule 날짜는 근사(cadence) — 픽업 기간과 ±60일까지 같은 배너로 인정
  /**
   * 5★(item_id)가 시각 t의 픽업이었는지: t가 그 item을 픽업한 기간의 ±MATCH_TOL 안이면 픽승.
   * (게임상 캐릭터는 자기 배너 때만 뽑히므로 가까운 픽업 기간=실제 뽑은 배너. 상시풀 편입분은
   *  픽업 기간이 수개월 전이라 허용오차 밖 → 픽뚫. 허용오차가 cadence 날짜 오차는 흡수하고
   *  리런/표준편입 간격(수개월)보다는 작아 오판하지 않는다.)
   * @param {string} id 5★ item_id.
   * @param {number} t 뽑은 시각(ms, 날짜 단위).
   * @param {'c'|'l'} poolKey 일정 항목에서 볼 픽업 키(캐릭터/무기).
   * @param {SchedulePeriod[]} schedule 픽업 일정.
   * @returns {boolean} 픽업이었으면 true(픽승).
   */
  function wasPickup(id, t, poolKey, schedule) {
    for (const p of schedule) {
      if (!p[poolKey].includes(id)) continue;
      const s = Date.parse(p.s), e = Date.parse(p.e);
      const d = (t >= s && t < e) ? 0 : Math.min(Math.abs(t - s), Math.abs(t - e));
      if (d <= MATCH_TOL) return true;
    }
    return false;
  }

  /**
   * 시각 t 가 '그 pool 의 픽업 목록을 모르는' 구간 안인지.
   * wasPickup 과 달리 MATCH_TOL 을 쓰지 않는다 — 허용오차(60일)를 여기 적용하면
   * 미상 배너 하나가 앞뒤 4개월을 통째로 판정 불가로 만든다.
   * @param {number} t 뽑은 시각(ms, 날짜 단위).
   * @param {'c'|'l'|null} poolKey 볼 픽업 키.
   * @param {SchedulePeriod[]} schedule 픽업 일정.
   * @returns {boolean} 미상 구간 안이면 true.
   */
  function inPartial(t, poolKey, schedule) {
    for (const p of schedule) {
      if (!p.p || !p.p.includes(poolKey)) continue;
      if (t >= Date.parse(p.s) && t < Date.parse(p.e)) return true;
    }
    return false;
  }

  /**
   * 이미 분류된 5★ 배열에서 요약치를 재계산한다(천장·result·isPickup은 입력값 그대로 사용 — 재분류 금지).
   * @param {FiveStar[]} fives 분류가 끝난 5★ 목록.
   * @param {BannerMeta} meta 해당 배너 메타(기준선 expAvg 사용).
   * @returns {Object} count5·avgPity5·bestPity·worstPity·luckPct·승패 집계·win5050Rate·pickupTotal.
   */
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

  /**
   * limited-char + limited-weapon 역할 배너 합산 지표 — 평균·기준선은 5★ 개수 가중(버전 비교 'all'과 동일 산식),
   * 승/패/확정은 단순 합.
   * @param {Object|null} charStats 캐릭터 이벤트 배너의 aggregateFives 산출물.
   * @param {Object|null} lcStats 광추/W-엔진 이벤트 배너의 aggregateFives 산출물.
   * @param {AnalyzeConfig} [cfg] 분석 설정. 생략하면 HSR 기본 테이블로 폴백(하위 호환).
   * @param {Array<{stats: Object|null, expAvg: number|null}>} [extras] 추가로 합산할 한정 채널(ZZZ 특별 픽업 등).
   * @returns {Object} 합산된 count5·avgPity5·base·luckPct·승패·win5050Rate·bestPity·worstPity.
   */
  function combineLimited(charStats, lcStats, cfg, extras) {
    cfg = cfg || resolveConfig(null);
    const charCode = codesByRole(cfg, 'limited-char')[0];
    const lcCode = codesByRole(cfg, 'limited-weapon')[0];
    const charExp = charCode ? cfg.banners[charCode].expAvg : null;
    const lcExp = lcCode ? cfg.banners[lcCode].expAvg : null;
    // [통계, 기준선] 쌍의 목록으로 접는다. extras 는 특별 픽업처럼 코드가 더 있는
    // 한정 채널용이며, 없으면 기존 두 채널 합산과 완전히 같은 값이 나온다.
    const parts = [{ st: charStats || {}, exp: charExp }, { st: lcStats || {}, exp: lcExp }]
      .concat((extras || []).map(e => ({ st: e.stats || {}, exp: e.expAvg })));
    /** @param {function(Object): number|undefined} f 통계에서 값을 꺼내는 함수. @returns {number} 전 채널 합. */
    const sum = (f) => parts.reduce((s, p) => s + (f(p.st) || 0), 0);
    const tot = sum(st => st.count5);
    const avg = tot ? parts.reduce((s, p) => s + (p.st.avgPity5 || 0) * (p.st.count5 || 0), 0) / tot : 0;
    const base = tot ? parts.reduce((s, p) => s + p.exp * (p.st.count5 || 0), 0) / tot : charExp;
    const cWins = sum(st => st.cWins), cLoss = sum(st => st.cLoss);
    const gWins = sum(st => st.gWins), contested = cWins + cLoss;
    const bests = parts.map(p => p.st.bestPity).filter(v => v != null);
    const worsts = parts.map(p => p.st.worstPity).filter(v => v != null);
    return {
      count5: tot, avgPity5: avg, base,
      luckPct: tot ? (base - avg) / base * 100 : null,
      cWins, cLoss, gWins, contested,
      win5050Rate: contested ? cWins / contested : null,
      bestPity: bests.length ? Math.min(...bests) : null,
      worstPity: worsts.length ? Math.max(...worsts) : null,
    };
  }

  /**
   * 배너 하나의 기록을 ID 순으로 훑어 천장·50/50을 판정하고 통계를 낸다.
   * @param {WarpRecord[]} records 그 배너의 기록(정렬 여부 무관 — 내부에서 ID 오름차순 정렬).
   * @param {BannerMeta} meta 배너 메타.
   * @param {SchedulePeriod[]} [schedule] 픽업 일정. 없으면 판정 없이 카운트만.
   * @param {{top: string, mid: string}} [ranks] 희귀도 코드. 생략 시 HSR 기본값.
   * @returns {Object} 총 뽑기·성옥·등급별 카운트·현재 천장·확정 여부·aggregateFives 요약·fives 목록.
   */
  function analyzeBanner(records, meta, schedule, ranks) {
    schedule = schedule || [];
    ranks = ranks || DEFAULT_RANKS;
    // 항목은 시작일 오름차순이라 마지막 항목이 가장 늦게 끝난다는 보장이 없다
    // (늦게 시작해 먼저 끝나는 짧은 병행 배너). 최대 종료일을 커버 경계로 쓴다.
    const schedEnd = schedule.reduce((m, p) => Math.max(m, Date.parse(p.e)), 0);
    const list = records.slice().sort(byId);
    const poolKey = { char: 'c', lc: 'l' }[meta.pool] || null; // schedule 픽업 키
    let p5 = 0, p4 = 0, c4 = 0, c3 = 0;
    let guaranteed = false;
    let held = false;   // 판정 보류가 한 번 나오면 이후 확정 체인 상태를 알 수 없다
    const fives = [];
    for (const r of list) {
      p5++; p4++;
      const rank = String(r.rank_type);
      if (rank === ranks.top) {
        const id = String(r.item_id);
        const f = { id: String(r.id), name: r.name, item_id: id, item_type: r.item_type, time: r.time, pity: p5, result: null, isPickup: null, fromGuarantee: false, unidentified: false };
        if (meta.kind === 'limited') {
          const t = Date.parse(String(r.time).slice(0, 10));
          const hit = (held || !(t < schedEnd)) ? null : wasPickup(id, t, poolKey, schedule);
          // 판정 보류 3종: 이미 보류된 뒤 / 일정 범위 밖(신규 패치 미반영) /
          // 픽업 목록이 비어 픽뚫이라 단정할 수 없는 구간. 보류가 한 번 나오면
          // 확정(천장 보증) 소비 여부를 알 수 없으므로 이후 5★도 함께 보류한다.
          if (hit === null || (!hit && inPartial(t, poolKey, schedule))) { f.unidentified = true; held = true; }
          else {
            f.isPickup = hit;                                         // 그 시점 픽업이면 픽승, 아니면 픽뚫
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

  /**
   * 기록을 월(YYYYMM) 버킷으로 집계한다. 시각을 파싱할 수 없는 기록은 건너뛴다.
   * @param {WarpRecord[]} list 전체 기록.
   * @param {{top: string, mid: string}} [ranks] 희귀도 코드. 생략 시 HSR 기본값.
   * @returns {Array<{month: string, total: number, jade: number, c5: number, c4: number, c3: number, fives: Object[]}>} 월 오름차순 버킷.
   */
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

  /**
   * 'YYYY-MM-DD ...' → ms (date 단위 버킷).
   * @param {string} t 기록 시각 문자열.
   * @returns {number} epoch ms. 파싱 실패 시 NaN.
   */
  const dms = t => Date.parse(String(t).slice(0, 10));

  /**
   * versions [{v,s}] → s 오름차순 정렬된 윈도우. 마지막 윈도우의 끝은 Infinity.
   * 값이 비었거나 날짜를 파싱할 수 없는 항목은 버린다.
   * @param {Array<{v: string, s: string}>} versions 버전 시작일 목록.
   * @returns {Array<{v: string, s: number, e: number}>} 버전 윈도우(ms).
   */
  function versionWindows(versions) {
    const vs = (versions || []).filter(x => x && x.v && x.s)
      .map(x => ({ v: x.v, s: Date.parse(x.s) }))
      .filter(x => !isNaN(x.s))
      .sort((a, b) => a.s - b.s);
    return vs.map((x, i) => ({ v: x.v, s: x.s, e: i + 1 < vs.length ? vs[i + 1].s : Infinity }));
  }

  /**
   * 전체 분석 결과(full)를 한 윈도우로 필터해 analyze()와 같은 모양으로 반환한다.
   * 분류된 fives는 시각 필터만(천장·result 재계산 금지), 뽑기 횟수는 원본 레코드를 시각 버킷.
   * 뽑기 0인 배너도 0 통계로 유지한다 — 무뽑기 버전을 스코프해도 뷰가 0으로 표시해야 하기 때문.
   * @param {Object} full analyze() 산출물.
   * @param {{list: WarpRecord[]}} data 원본 기록.
   * @param {{s: number, e: number}} win 필터할 시간 윈도우(ms, 끝은 배타적).
   * @param {AnalyzeConfig} [cfg] 분석 설정. 생략 시 full._cfg → HSR 기본값 순으로 폴백한다.
   *   이렇게 해야 analyze() 결과를 그대로 재사용하는 호출부가 cfg 를 깜빡해도
   *   조용히 다른 게임 테이블로 계산되는 사고를 막을 수 있다.
   * @returns {Object} analyze()와 동일한 모양의 윈도우 한정 분석 결과.
   */
  function filterAnalysis(full, data, win, cfg) {
    cfg = cfg || (full && full._cfg) || resolveConfig(null);
    /** @param {string} t 기록 시각. @returns {boolean} 윈도우 [s,e) 안이면 true. */
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
        limited: combineLimited(lim ? lim.stats : null, lc ? lc.stats : null, cfg, extraLimited(banners, lim, lc)),
      },
    };
  }

  /**
   * 각 버전 윈도우의 요약을 비교표 행으로 만든다. 뽑기 0 버전은 제외.
   * limited-char·limited-weapon 역할 배너를 각각, 그리고 all=둘 합산(픽승/픽뚫 합, 평균뽑기·기준선은 5★ 개수 가중)으로 담는다.
   * @param {Object} full analyze() 산출물.
   * @param {{list: WarpRecord[]}} data 원본 기록.
   * @param {Array<{v: string, s: string}>} versions 버전 시작일 목록.
   * @param {AnalyzeConfig} [cfg] 분석 설정. 생략 시 full._cfg → HSR 기본값 순으로 폴백한다.
   * @returns {Array<Object>} 버전별 비교 행 {v, s, e, total, jade, count5, char, lc, all}.
   */
  function analyzeVersions(full, data, versions, cfg) {
    cfg = cfg || (full && full._cfg) || resolveConfig(null);
    const charCode = codesByRole(cfg, 'limited-char')[0];
    const lcCode = codesByRole(cfg, 'limited-weapon')[0];
    /** @param {number} ms epoch ms. @returns {string} 'YYYY-MM-DD'. 열린 끝(Infinity)은 빈 문자열. */
    const fmt = ms => ms === Infinity ? '' : new Date(ms).toISOString().slice(0, 10);
    /** @param {Object|undefined} b 배너 분석 결과. @param {number|null} base 기준선. @returns {Object} 비교표 셀. */
    const metric = (b, base) => ({
      avgPity: b ? b.stats.avgPity5 : null, cWins: b ? b.stats.cWins : 0,
      cLoss: b ? b.stats.cLoss : 0, count5: b ? b.stats.count5 : 0, base,
    });
    return versionWindows(versions).map(w => {
      const a = filterAnalysis(full, data, w, cfg);
      if (!a.total) return null;
      const charBanner = a.banners.find(b => b.type === charCode);
      const lcBanner = a.banners.find(b => b.type === lcCode);
      const char = metric(charBanner, charCode ? cfg.banners[charCode].expAvg : null);
      const lc = metric(lcBanner, lcCode ? cfg.banners[lcCode].expAvg : null);
      const combined = combineLimited(charBanner ? charBanner.stats : null, lcBanner ? lcBanner.stats : null, cfg);
      const all = {
        avgPity: combined.avgPity5, cWins: combined.cWins, cLoss: combined.cLoss,
        count5: combined.count5, base: combined.base,
      };
      return { v: w.v, s: fmt(w.s), e: fmt(w.e), total: a.total, jade: a.jade, count5: a.count5, char, lc, all };
    }).filter(Boolean);
  }

  /**
   * 워프 기록 전체를 배너별로 나눠 분석한다. 이 모듈의 진입점.
   * @param {{list: WarpRecord[], info?: Object}} data 수집된 SRGF 기록.
   * @param {SchedulePeriod[]|Object|null} [schedule] schedule.json 전체 객체 또는 구 스키마 배열.
   * @returns {Object} info·총계·배너별 통계·all5·monthly·luck, 그리고 재사용용 _cfg.
   */
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
        limited: combineLimited(lim ? lim.stats : null, lc ? lc.stats : null, cfg, extraLimited(banners, lim, lc)),
      },
      // filterAnalysis/analyzeVersions 가 cfg 인자 없이 이 결과를 재사용할 때 쓰는 폴백.
      // 열거는 되지만(테스트 편의) 대시보드 렌더 로직은 이 필드를 소비하지 않는다.
      _cfg: cfg,
    };
  }

  const api = { analyze, analyzeBanner, aggregateFives, combineLimited, extraLimited, filterAnalysis, versionWindows, analyzeVersions, monthly, resolveConfig, ROLE_SPEC, BANNERS, ORDER };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WarpAnalyze = api;
})(typeof window !== 'undefined' ? window : globalThis);

// SOURCES:
//  banner pickup schedule (web/schedule.json) : https://github.com/Mantan21/HSR-Warp-Simulator
//      (banners/lists.json: bannerID→featured slug; characters.json·light-cones.json: slug→itemID)
//  item_id verification              : https://github.com/Mar-7th/StarRailRes (index_min/en)
//  probabilities / 50:50             : https://www.prydwen.gg/star-rail/guides/gacha-system/
//  gacha_type codes                  : https://uigf.org/en/standards/srgf.html
