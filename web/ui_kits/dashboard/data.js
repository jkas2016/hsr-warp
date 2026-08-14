// Live data layer for the dashboard kit. Replaces the demo window.WARP_DATA:
// loads real warp records from the local server, runs the shared WarpAnalyze
// logic (the single source of truth for 천장·운·50/50), and adapts the result
// into the shape the kit's view components consume. No analysis is reimplemented
// here — adapt() only reshapes WarpAnalyze output (analyze.js) into WARP_DATA.
window.WarpData = (function () {
  // 지원 게임 목록(표시 순서). 서버 internal/game 의 목록과 같아야 한다 — 알 수 없는 id 는
  // /api/* 가 400 을 주므로 여기서 걸러 저장된 값이 오염돼도 hsr 로 되돌아간다.
  const GAMES = ['hsr', 'zzz'];
  // 현재 게임. localStorage 에 저장해 새로고침에도 유지한다.
  let gameID = 'hsr';
  try { const s = localStorage.getItem('hsrwarp-game'); if (GAMES.includes(s)) gameID = s; } catch (e) {}
  let sched = null;      // schedule.json 응답 전체 — analyze() 에 그대로 넘겨야 게임별 ranks/banners 가 적용된다
  let cfg = null;        // resolveConfig 결과 {list,ranks,banners,order} — 역할 조회에 쓴다
  let versions = [];     // schedule.json -> versions[] (버전 시작일, 비교/버전라벨용)
  let inited = false;
  // 마지막 전체 분석 결과(버전 구간 스코프용 — 재조회 없이 filterAnalysis 재계산).
  let _full = null, _list = [], _fullData = null;

  // HSR 은 구버전 호환을 위해 경로를 유지하고, 나머지 게임은 하위 경로에 둔다.
  function scheduleURL() { return gameID === 'hsr' ? '/schedule.json' : `/${gameID}/schedule.json`; }
  function q(extra) { return `game=${encodeURIComponent(gameID)}${extra ? '&' + extra : ''}`; }

  // 스케줄 로드 전에도 배너 메타를 물어볼 수 있어야 한다(첫 렌더). 그땐 HSR 기본 테이블.
  function conf() { return cfg || window.WarpAnalyze.resolveConfig(null); }

  function setGame(id) {
    if (id === gameID || !GAMES.includes(id)) return;
    gameID = id;
    try { localStorage.setItem('hsrwarp-game', id); } catch (e) {}
    // 캐시 무효화 — 다음 loadStored()가 새 게임의 일정과 기록을 다시 읽는다.
    inited = false;
    sched = cfg = _full = _fullData = null;
    versions = []; _list = [];
  }
  function game() { return gameID; }
  function games() { return GAMES.slice(); }

  // 역할 → 배너 코드. 게임마다 코드가 다르므로 '11'/'12' 같은 리터럴을 쓰지 않는다.
  function byRole(role) {
    const c = conf();
    return c.order.find((code) => c.banners[code] && c.banners[code].role === role) || null;
  }
  // 역할 → 배너 short(= i18n 정규 키). 표시할 땐 I18N.bannerLabel() 로 감싼다.
  function roleShort(role) {
    const code = byRole(role);
    return code ? conf().banners[code].short : '';
  }
  // 현재 게임의 배너 목록(표시 순서). QueryPanel 진행 표시가 쓴다.
  function banners() {
    const c = conf();
    return c.order.filter((code) => c.banners[code]).map((code) => ({ code, role: c.banners[code].role, short: c.banners[code].short }));
  }

  // SSE progress 의 banner 키는 서버가 역할에서 유도한 이름이다(internal/collector/fetch.go
  // roleName). 게임 공통이라 배너 short 와 다를 수 있어(HSR 광추 ↔ '무기') 역할로 되돌려 맞춘다.
  const PROGRESS_ROLE = {
    '캐릭터': 'limited-char', '무기': 'limited-weapon',
    '일반': 'standard', '출발': 'beginner', '본디': 'bangboo',
  };
  function roleOfProgress(label) { return PROGRESS_ROLE[label] || null; }

  async function init() {
    if (inited) return;
    try {
      sched = await fetch(scheduleURL()).then((r) => r.json());
    } catch (e) { sched = null; }
    cfg = window.WarpAnalyze.resolveConfig(sched);
    versions = (sched && sched.versions) || [];
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
    const visible = full.banners.filter((b) => b.meta.role !== 'beginner'); // 초보자 채널은 킷 표시 대상 아님
    // rateUp(0.5/0.75) → '50/50'/'75/25' 배지 문구(게임별 배너 테이블에서 유도).
    const oddsOf = (type) => {
      const b = type && conf().banners[type];
      if (!b || b.rateUp == null) return null;
      return Math.round(b.rateUp * 100) + '/' + Math.round(100 - b.rateUp * 100);
    };

    const banners = visible.map((b) => ({
      type: b.type, short: b.meta.short, color: b.meta.color, cap: b.meta.cap, kind: b.meta.kind,
      currentPity: b.stats.currentPity5 || 0, total: b.stats.total, count5: b.stats.count5,
      avgPity5: b.stats.avgPity5 || 0, cWins: b.stats.cWins, cLoss: b.stats.cLoss, gWins: b.stats.gWins,
      guaranteed: !!b.stats.currentGuaranteed, expAvg: b.meta.expAvg,
      winRate: b.stats.win5050Rate == null ? null : b.stats.win5050Rate,
      odds: oddsOf(b.type),
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
    const charCode = byRole('limited-char'), lcCode = byRole('limited-weapon');
    const charBnr = full.banners.find((b) => b.type === charCode);
    const lcBnr = full.banners.find((b) => b.type === lcCode);
    const charExpAvg = charBnr ? charBnr.meta.expAvg : (conf().banners[charCode] || {}).expAvg;

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
        charCount5: charBnr ? charBnr.stats.count5 : 0,
        lcCount5: lcBnr ? lcBnr.stats.count5 : 0,
        charGuaranteed: !!(charBnr && charBnr.stats.currentGuaranteed),
        lcGuaranteed: !!(lcBnr && lcBnr.stats.currentGuaranteed),
        charOdds: oddsOf(charCode), lcOdds: oddsOf(lcCode),
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

  // 대시보드 집계에서 뺄 채널의 역할: 상시·초보자. 성옥 소비도 아니고 픽업 개념도 없어
  // 통계를 오염시킨다. 본디(bangboo)는 천장·평균 뽑기가 의미 있으므로 남긴다.
  // 채널 코드는 게임마다 다르므로 반드시 역할로 거른다(ZZZ 의 '2' 는 독점 채널이다).
  // 수집·저장(SRGF/UIGF)은 전부 그대로다.
  const HIDDEN_ROLES = ['standard', 'beginner'];

  function analyzeAndAdapt(raw) {
    const c = conf();
    const list = ((raw && raw.list) || []).filter((r) => {
      const b = c.banners[String(r.gacha_type)];
      return !b || !HIDDEN_ROLES.includes(b.role);
    });
    const full = window.WarpAnalyze.analyze({ ...raw, list }, sched);
    _full = full;
    _list = list;
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
      const d = await fetch(`/api/data?${q()}`).then((r) => r.json());
      if (d && Array.isArray(d.list) && d.list.length) return analyzeAndAdapt(d);
    } catch (e) {} // first run or no data yet
    return null;
  }

  // 게임에서 증분 조회(SSE). onProgress(배너이름, 누적신규건수).
  // 성공 시 adapt 된 데이터(+summary)로 resolve, 실패 시 Error 로 reject.
  function runFetch(path, onProgress) {
    return new Promise((resolve, reject) => {
      const es = new EventSource(`/api/fetch?${q('path=' + encodeURIComponent(path))}`);
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

  // 경로 자동 채움: 저장된 config 우선, 없으면 자동 탐지. 경로는 게임별로 따로 저장된다
  // (/api/config 는 전역 설정이라 게임 파라미터를 받지 않는다 — 응답에서 현재 게임만 꺼낸다).
  async function configPath() {
    try {
      const c = await fetch('/api/config').then((r) => r.json());
      const g = c && c.games && c.games[gameID];
      if (g && g.game_path) return g.game_path;
    } catch (e) {}
    try {
      const d = await fetch(`/api/detect?${q()}`).then((r) => r.json());
      if (d && d.path) return d.path;
    } catch (e) {}
    return '';
  }

  // 시작 시 1회 업데이트 확인(코드/배너데이터 2채널, 베스트에포트).
  async function checkUpdates() {
    try { return await fetch('/api/updates').then((r) => r.json()); } catch (e) { return null; }
  }

  return { loadStored, runFetch, configPath, checkUpdates, scopeTo, setGame, game, games, roleShort, banners, roleOfProgress };
})();
