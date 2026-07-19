// Shared helpers for the dashboard kit.
window.WarpUtil = (function () {
  const num = (n) => Math.round(n).toLocaleString('ko-KR');
  const pityColor = (p) => (p < 60 ? 'var(--green)' : p <= 80 ? 'var(--orange)' : 'var(--red)');

  // 결과 라벨은 호출 시점의 언어로 평가되어야 하므로 함수로 노출.
  function resultMeta(code) {
    const C = { win: 'var(--gold-ink)', loss: 'var(--red)', guaranteed: 'var(--green)' };
    return { label: window.I18N.t('result.' + code), color: C[code] };
  }

  // 버전 스코프 필터는 구간 내 뽑기 0인 배너를 제거하므로, 선택 short 가 없으면 첫 배너로 폴백.
  const pickBanner = (banners, short) => banners.find((b) => b.short === short) || banners[0] || null;

  // 9 pity buckets (1-10 … 81-90) for a banner's 5★ list.
  function pityBins(fives, banner) {
    const bins = Array(9).fill(0);
    fives.filter((f) => f.banner === banner).forEach((f) => {
      bins[Math.min(8, Math.floor((f.pity - 1) / 10))]++;
    });
    return bins;
  }

  // Animated count-up. Returns the current displayed number; eases out.
  // A timeout safety-net guarantees the final value lands even if rAF is
  // throttled (e.g. the tab/preview is backgrounded mid-animation).
  function useCountUp(target, { duration = 900, decimals = 0, start = true } = {}) {
    const [val, setVal] = React.useState(start ? 0 : target);
    React.useEffect(() => {
      if (!start) { setVal(target); return; }
      let raf, done = false, t0;
      const finish = () => { if (!done) { done = true; setVal(target); } };
      const ease = (x) => 1 - Math.pow(1 - x, 3);
      const tick = (t) => {
        if (done) return;
        if (t0 == null) t0 = t;
        const p = Math.min(1, (t - t0) / duration);
        setVal(target * ease(p));
        if (p < 1) raf = requestAnimationFrame(tick);
        else finish();
      };
      raf = requestAnimationFrame(tick);
      const safety = setTimeout(finish, duration + 400);
      return () => { cancelAnimationFrame(raf); clearTimeout(safety); };
    }, [target, duration, start]);
    return decimals ? Number(val).toFixed(decimals) : Math.round(val);
  }

  // Reveal-on-mount wrapper styles (fade + rise), staggered by index.
  function reveal(i = 0, on = true) {
    return {
      opacity: on ? 1 : 0,
      transform: on ? 'none' : 'translateY(14px)',
      transition: `opacity .5s ease ${i * 70}ms, transform .55s cubic-bezier(.2,.7,.3,1) ${i * 70}ms`,
    };
  }

  return { num, pityColor, resultMeta, pickBanner, pityBins, useCountUp, reveal };
})();
