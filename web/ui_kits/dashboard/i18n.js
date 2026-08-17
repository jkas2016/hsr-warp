// 경량 i18n 런타임(무빌드). 사전은 window.I18N_DICTS.{ko,en,zh,ja}.
// t()가 현재 I18N.lang을 읽으므로, 최상위 lang state 변경으로 트리를 재렌더하면
// 모든 t() 호출이 새 언어로 재평가된다(Context/prop drilling 불필요).
(function () {
  var DICTS = window.I18N_DICTS || (window.I18N_DICTS = {});
  var SUPPORTED = ['ko', 'en', 'zh', 'ja'];

  // 현재 게임. data.js 보다 먼저 로드될 수 있어 호출 시점에 평가한다(itemName 과 같은 이유).
  function curGame() {
    return (window.WarpData && window.WarpData.game()) || 'hsr';
  }
  // 게임별 용어 오버레이(i18n/game.js). 해당 언어에 없으면 en 으로, 그것도 없으면
  // 기본 사전으로 넘긴다 — 오버레이는 "다른 어휘를 쓰는 키"만 담는 얇은 층이다.
  function overlay(key) {
    var g = (window.I18N_GAME_DICTS || {})[curGame()];
    if (!g) return null;
    var v = (g[I18N.lang] || {})[key];
    if (v == null && I18N.lang !== 'en') v = (g.en || {})[key];
    return v == null ? null : v;
  }

  function langOf(str) {
    var s = String(str || '').toLowerCase();
    if (s.indexOf('zh') === 0) return 'zh';
    if (s.indexOf('ja') === 0) return 'ja';
    if (s.indexOf('en') === 0) return 'en';
    if (s.indexOf('ko') === 0) return 'ko';
    return 'ko';
  }

  // 결정 순서: ?lang= → localStorage → navigator → ko
  function initialLang() {
    try {
      var q = new URLSearchParams(location.search).get('lang');
      if (q && SUPPORTED.indexOf(langOf(q)) >= 0) return langOf(q);
      var saved = localStorage.getItem('hsrwarp-lang');
      if (saved && SUPPORTED.indexOf(saved) >= 0) return saved;
    } catch (e) {}
    return langOf((navigator && navigator.language) || 'ko');
  }

  function interpolate(s, vars) {
    if (!vars) return s;
    return s.replace(/\{(\w+)\}/g, function (m, k) {
      return vars[k] != null ? vars[k] : m;
    });
  }

  // 배너 short 는 표시 문자열이 아니라 정규 키다(schedule.json banners[].short).
  // 표시할 땐 반드시 bannerLabel() 로 감싼다. 앞 4개는 HSR, 뒤 4개는 ZZZ.
  var BANNER_CODE = {
    '캐릭터': 'char', '광추': 'lc', '일반': 'std', '출발': 'departure',
    '독점': 'exclusive', 'W-엔진': 'wengine', '상시': 'standard', '본디': 'bangboo',
  };

  var I18N = {
    lang: initialLang(),
    langOf: langOf,
    BANNER_CODE: BANNER_CODE,
    setLang: function (l) {
      var n = langOf(l);
      if (SUPPORTED.indexOf(n) < 0) n = 'ko';
      I18N.lang = n;
      return n;
    },
    t: function (key, vars) {
      var o = overlay(key);
      if (o != null) return interpolate(o, vars);
      var d = DICTS[I18N.lang] || {};
      var v = d[key];
      if (v == null) v = (DICTS.ko || {})[key];     // ko 폴백
      if (v == null) return key;                     // 완전 누락 → key
      return interpolate(v, vars);
    },
    bannerLabel: function (short) {
      var code = BANNER_CODE[short];
      return code ? I18N.t('banner.' + code) : short;
    },
    // 캐릭터/광추 item_id → 현재 언어 이름. 사전(window.ITEM_NAMES)에 없거나
    // 해당 언어값이 비면 raw(SRGF/UIGF 원본 name)로 폴백 — 신규 패치 미반영 안전망.
    //
    // ITEM_NAMES 는 StarRailRes 에서 뽑은 HSR 전용 사전이다. ZZZ 에이전트/W-엔진은
    // HSR 캐릭터/광추와 같은 4·5자리 id 공간을 공유하므로, 게임 구분 없이 조회하면
    // ZZZ id 가 HSR 이름과 충돌한다(예: 1221→HSR 사전엔 없지만 실제 충돌 다수 확인됨).
    // ZZZ는 getGachaLog API가 이미 lang에 맞춰 현지화된 name을 주므로 raw 그대로가 정답.
    // i18n.js는 data.js보다 먼저 로드될 수 있어 window.WarpData 참조를 top-level에
    // 캐시하지 않고 호출 시점에 평가한다. WarpData가 아직 없는 경우(예: 이 파일 단독
    // 로드되는 테스트) 사전을 쓰던 기존 HSR 단일 게임 시절 동작을 보존하도록 'hsr'로
    // 가정한다 — 실제 앱에서는 itemName이 렌더 시점에만 호출되고 그때는 data.js가
    // 이미 로드돼 있어 이 폴백이 실사용 경로에 영향을 주지 않는다.
    itemName: function (id, raw) {
      var game = (window.WarpData && window.WarpData.game()) || 'hsr';
      if (game !== 'hsr') return raw;
      var m = (window.ITEM_NAMES || {})[String(id)];
      var v = m && m[I18N.lang];
      return v ? v : raw; // 빈/누락값은 raw 폴백
    },
  };
  window.I18N = I18N;
})();
