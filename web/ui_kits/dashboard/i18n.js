// 경량 i18n 런타임(무빌드). 사전은 window.I18N_DICTS.{ko,en,zh,ja}.
// t()가 현재 I18N.lang을 읽으므로, 최상위 lang state 변경으로 트리를 재렌더하면
// 모든 t() 호출이 새 언어로 재평가된다(Context/prop drilling 불필요).
(function () {
  var DICTS = window.I18N_DICTS || (window.I18N_DICTS = {});
  var SUPPORTED = ['ko', 'en', 'zh', 'ja'];

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

  var BANNER_CODE = { '캐릭터': 'char', '광추': 'lc', '일반': 'std', '출발': 'departure' };

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
  };
  window.I18N = I18N;
})();
