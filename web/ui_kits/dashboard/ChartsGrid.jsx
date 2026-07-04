// Chart.js analysis grid — rarity doughnut, char-banner pity histogram,
// 50/50 stacked bars, monthly pulls. Reads themed colors from CSS vars and
// rebuilds when the theme flips.
function ChartsGrid({ D, theme }) {
  const t = window.I18N.t;
  const { Card } = window.HSRWarpDesignSystem_4a0d44;
  const refs = { rarity: React.useRef(), pity: React.useRef(), ff: React.useRef(), month: React.useRef() };

  React.useEffect(() => {
    if (!window.Chart) return;
    const cs = getComputedStyle(document.documentElement);
    const v = (n) => cs.getPropertyValue(n).trim();
    const muted = v('--muted'), grid = v('--line'), panel = v('--panel');
    const GOLD = '#f5c542', PURPLE = '#a474ff', BLUE = '#5aa9ff', GREEN = '#52d39a', RED = '#ff6b6b', ORANGE = '#ff9e45';

    Chart.defaults.color = muted;
    Chart.defaults.font.family = 'Space Grotesk, Noto Sans KR, sans-serif';
    const base = { responsive: true, maintainAspectRatio: false, animation: { duration: 700 } };
    const noLeg = { plugins: { legend: { display: false } } };
    const made = [];
    const pityBins = window.WarpUtil.pityBins(D.fives, '캐릭터');

    made.push(new Chart(refs.rarity.current, { type: 'doughnut',
      data: { labels: ['5★', '4★', '3★'], datasets: [{ data: [D.rarity.c5, D.rarity.c4, D.rarity.c3],
        backgroundColor: [GOLD, PURPLE, BLUE], borderColor: panel, borderWidth: 4, hoverOffset: 6 }] },
      options: { ...base, plugins: { legend: { position: 'bottom' } }, cutout: '64%' } }));

    made.push(new Chart(refs.pity.current, { type: 'bar',
      data: { labels: ['1-10', '11-20', '21-30', '31-40', '41-50', '51-60', '61-70', '71-80', '81-90'],
        datasets: [{ data: pityBins, backgroundColor: pityBins.map((_, i) => (i < 7 ? GREEN : ORANGE)), borderRadius: 6 }] },
      options: { ...base, ...noLeg, scales: { y: { grid: { color: grid }, ticks: { precision: 0 } }, x: { grid: { display: false } } } } }));

    const lim = Object.keys(D.fiveFiveBins);
    made.push(new Chart(refs.ff.current, { type: 'bar',
      data: { labels: lim, datasets: [
        { label: t('result.win'), data: lim.map((k) => D.fiveFiveBins[k].win), backgroundColor: GOLD, borderRadius: 4 },
        { label: t('result.loss'), data: lim.map((k) => D.fiveFiveBins[k].loss), backgroundColor: RED, borderRadius: 4 },
        { label: t('result.guaranteed'), data: lim.map((k) => D.fiveFiveBins[k].guar), backgroundColor: GREEN, borderRadius: 4 }] },
      options: { ...base, indexAxis: 'y', plugins: { legend: { position: 'bottom' } },
        scales: { x: { stacked: true, grid: { color: grid }, ticks: { precision: 0 } }, y: { stacked: true, grid: { display: false } } } } }));

    const M = D.monthly;
    made.push(new Chart(refs.month.current, { type: 'bar',
      data: { labels: M.map((m) => m.month.slice(2)), datasets: [
        { label: '3★', data: M.map((m) => m.c3), backgroundColor: BLUE, borderRadius: 4 },
        { label: '4★', data: M.map((m) => m.c4), backgroundColor: PURPLE, borderRadius: 4 },
        { label: '5★', data: M.map((m) => m.c5), backgroundColor: GOLD, borderRadius: 4 }] },
      options: { ...base, plugins: { legend: { position: 'bottom' } },
        scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, grid: { color: grid } } } } }));

    return () => made.forEach((c) => c.destroy());
  }, [theme, window.I18N.lang]);

  const wrap = { position: 'relative', height: 230 };
  const h3 = { fontSize: 13, marginBottom: 12, color: 'var(--muted)', fontWeight: 600, marginTop: 0, fontFamily: 'var(--font-display)' };
  return (
    <section style={{ marginTop: 26 }}>
      <h2 className="h2">{t('charts.title')}</h2>
      <div className="charts-row">
        <Card padding={18}><h3 style={h3}>{t('charts.rarity')}</h3><div style={wrap}><canvas ref={refs.rarity} /></div></Card>
        <Card padding={18}><h3 style={h3}>{t('charts.pityDist')}</h3><div style={wrap}><canvas ref={refs.pity} /></div></Card>
        <Card padding={18}><h3 style={h3}>{t('charts.ff')}</h3><div style={wrap}><canvas ref={refs.ff} /></div></Card>
        <Card padding={18}><h3 style={h3}>{t('charts.monthly')}</h3><div style={wrap}><canvas ref={refs.month} /></div></Card>
      </div>
    </section>
  );
}
window.ChartsGrid = ChartsGrid;
