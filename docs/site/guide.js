// HSR Warp guide page — theme toggle + scroll reveal. No framework.
(function () {
  var root = document.documentElement;
  root.classList.add('js');

  // ---- theme (persisted; defaults to dark) ----
  var KEY = 'hsrwarp-theme';
  try {
    var saved = localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') root.setAttribute('data-theme', saved);
  } catch (e) {}

  function bindToggle() {
    var btn = document.querySelector('.theme-toggle');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem(KEY, next); } catch (e) {}
    });
  }

  // ---- scroll reveal (resilient: a safety net reveals everything after
  // 1.4s even if IntersectionObserver never fires, e.g. in a throttled frame) ----
  function bindReveal() {
    var items = [].slice.call(document.querySelectorAll('.reveal'));
    var revealAll = function () { items.forEach(function (el) { el.classList.add('in'); }); };
    if (!('IntersectionObserver' in window)) { revealAll(); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    items.forEach(function (el) { io.observe(el); });
    setTimeout(revealAll, 1400);
  }

  function init() { bindToggle(); bindReveal(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
