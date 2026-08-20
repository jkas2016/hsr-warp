// Shared helpers for the dashboard kit.
window.WarpUtil = (function () {
  /**
   * 숫자를 반올림해 천 단위 구분 문자열로.
   * @param {number} n
   * @returns {string} 예: 12345 → '12,345'.
   */
  const num = (n) => Math.round(n).toLocaleString('ko-KR');
  /**
   * 천장 수치에 대응하는 CSS 색 변수(안전/주의/위험).
   * @param {number} p 현재 천장 카운트.
   * @returns {string} CSS var() 문자열.
   */
  const pityColor = (p) => (p < 60 ? 'var(--green)' : p <= 80 ? 'var(--orange)' : 'var(--red)');

  /**
   * 50/50 판정 코드의 표시 라벨과 색.
   * 결과 라벨은 호출 시점의 언어로 평가되어야 하므로 함수로 노출한다.
   * @param {'win'|'loss'|'guaranteed'} code 판정 코드.
   * @returns {{label: string, color: string|undefined}} 현재 언어 라벨과 색.
   */
  function resultMeta(code) {
    const C = { win: 'var(--gold-ink)', loss: 'var(--red)', guaranteed: 'var(--green)' };
    return { label: window.I18N.t('result.' + code), color: C[code] };
  }

  /**
   * short 키로 배너를 고른다.
   * 버전 스코프 필터는 구간 내 뽑기 0인 배너를 제거하므로, 선택 short 가 없으면 첫 배너로 폴백한다.
   * @param {Array<{short: string}>} banners 표시 중인 배너 목록.
   * @param {string} short 선택된 배너 정규 키.
   * @returns {Object|null} 찾은 배너, 없으면 첫 배너, 목록이 비면 null.
   */
  const pickBanner = (banners, short) => banners.find((b) => b.short === short) || banners[0] || null;

  /**
   * 한 배너의 5★ 목록을 9개 천장 구간(1-10 … 81-90)으로 집계한다.
   * @param {Array<{banner: string, pity: number}>} fives 전체 5★ 목록.
   * @param {string} banner 대상 배너 short.
   * @returns {number[]} 길이 9의 구간별 건수.
   */
  function pityBins(fives, banner) {
    const bins = Array(9).fill(0);
    fives.filter((f) => f.banner === banner).forEach((f) => {
      bins[Math.min(8, Math.floor((f.pity - 1) / 10))]++;
    });
    return bins;
  }

  /**
   * Animated count-up 훅. 현재 표시할 숫자를 반환하며 ease-out 으로 증가한다.
   * rAF 가 스로틀돼도(탭이 백그라운드로 가는 등) 타임아웃 안전망이 최종값 도달을 보장한다.
   * @param {number} target 최종값.
   * @param {Object} [options]
   * @param {number} [options.duration=900] 애니메이션 길이(ms).
   * @param {number} [options.decimals=0] 소수 자릿수. 0 이면 정수 반올림.
   * @param {boolean} [options.start=true] false 면 애니메이션 없이 target 을 즉시 표시.
   * @returns {number|string} decimals>0 이면 고정 소수 문자열, 아니면 정수.
   */
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

  /**
   * 마운트 시 나타나는 래퍼 스타일(fade + rise). 인덱스만큼 순차 지연된다.
   * @param {number} [i=0] 스태거 인덱스(70ms 씩 지연).
   * @param {boolean} [on=true] 표시 상태. false 면 숨김 상태 스타일.
   * @returns {Object} React 인라인 스타일 객체.
   */
  function reveal(i = 0, on = true) {
    return {
      opacity: on ? 1 : 0,
      transform: on ? 'none' : 'translateY(14px)',
      transition: `opacity .5s ease ${i * 70}ms, transform .55s cubic-bezier(.2,.7,.3,1) ${i * 70}ms`,
    };
  }

  return { num, pityColor, resultMeta, pickBanner, pityBins, useCountUp, reveal };
})();
