/**
 * Chart.js 분석 그리드 — 희귀도 도넛, 캐릭터 배너 천장 히스토그램, 50/50 누적 막대, 월별 뽑기.
 * 색은 CSS 변수에서 읽고, 테마가 바뀌면 차트를 다시 만든다.
 * @param {Object} props
 * @param {Object} props.D WARP_DATA.
 * @param {string} props.theme 현재 테마('dark'|'light') — 바뀌면 재빌드 dep.
 * @param {string} props.lang 현재 언어 — 라벨 재평가용 재빌드 dep.
 * @returns {JSX.Element}
 */
function ChartsGrid({ D, theme, lang }) {
  const t = window.I18N.t;
  const { Card } = window.HSRWarpDesignSystem_4a0d44;
  const refs = { rarity: React.useRef(), pity: React.useRef(), ff: React.useRef(), month: React.useRef() };

  React.useEffect(() => {
    if (!window.Chart) return;
    const cs = getComputedStyle(document.documentElement);
    const v = (n) => cs.getPropertyValue(n).trim();
    const muted = v('--muted'), grid = v('--line'), panel = v('--panel');
    // 게임 팔레트(tokens/game.css)를 따라야 하므로 하드코딩 대신 CSS 변수에서 읽는다.
    // 폴백은 colors.css 의 기본값 — 변수 조회가 빈 문자열이면 Chart.js 가 검게 그린다.
    const GOLD = v('--gold') || '#f5c542', PURPLE = v('--purple') || '#a474ff', BLUE = v('--blue') || '#5aa9ff',
      GREEN = v('--green') || '#52d39a', RED = v('--red') || '#ff6b6b', ORANGE = v('--orange') || '#ff9e45';

    Chart.defaults.color = muted;
    Chart.defaults.font.family = 'Space Grotesk, Noto Sans KR, sans-serif';
    const base = { responsive: true, maintainAspectRatio: false, animation: { duration: 700 } };
    const noLeg = { plugins: { legend: { display: false } } };
    const made = [];
    // 천장 분포는 한정 캐릭터 배너 기준. short 는 게임마다 다르므로 역할로 얻는다.
    const pityBins = window.WarpUtil.pityBins(D.fives, window.WarpData.roleShort('limited-char'));

    made.push(new Chart(refs.rarity.current, { type: 'doughnut',
      data: { labels: [t('rank.r5'), t('rank.r4'), t('rank.r3')], datasets: [{ data: [D.rarity.c5, D.rarity.c4, D.rarity.c3],
        backgroundColor: [GOLD, PURPLE, BLUE], borderColor: panel, borderWidth: 4, hoverOffset: 6 }] },
      options: { ...base, plugins: { legend: { position: 'bottom' } }, cutout: '64%' } }));

    made.push(new Chart(refs.pity.current, { type: 'bar',
      data: { labels: ['1-10', '11-20', '21-30', '31-40', '41-50', '51-60', '61-70', '71-80', '81-90'],
        datasets: [{ data: pityBins, backgroundColor: pityBins.map((_, i) => (i < 7 ? GREEN : ORANGE)), borderRadius: 6 }] },
      options: { ...base, ...noLeg, scales: { y: { grid: { color: grid }, ticks: { precision: 0 } }, x: { grid: { display: false } } } } }));

    const lim = Object.keys(D.fiveFiveBins);
    made.push(new Chart(refs.ff.current, { type: 'bar',
      data: { labels: lim.map((k) => window.I18N.bannerLabel(k)), datasets: [
        { label: t('result.win'), data: lim.map((k) => D.fiveFiveBins[k].win), backgroundColor: GOLD, borderRadius: 4 },
        { label: t('result.loss'), data: lim.map((k) => D.fiveFiveBins[k].loss), backgroundColor: RED, borderRadius: 4 },
        { label: t('result.guaranteed'), data: lim.map((k) => D.fiveFiveBins[k].guar), backgroundColor: GREEN, borderRadius: 4 }] },
      options: { ...base, indexAxis: 'y', plugins: { legend: { position: 'bottom' } },
        scales: { x: { stacked: true, grid: { color: grid }, ticks: { precision: 0 } }, y: { stacked: true, grid: { display: false } } } } }));

    const M = D.monthly;
    made.push(new Chart(refs.month.current, { type: 'bar',
      data: { labels: M.map((m) => m.month.slice(2)), datasets: [
        { label: t('rank.r3'), data: M.map((m) => m.c3), backgroundColor: BLUE, borderRadius: 4 },
        { label: t('rank.r4'), data: M.map((m) => m.c4), backgroundColor: PURPLE, borderRadius: 4 },
        { label: t('rank.r5'), data: M.map((m) => m.c5), backgroundColor: GOLD, borderRadius: 4 }] },
      options: { ...base, plugins: { legend: { position: 'bottom' } },
        scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, grid: { color: grid } } } } }));

    return () => made.forEach((c) => c.destroy());
    // D: 게임 데이터 도착·버전 구간 변경 시 재빌드(게임 팔레트가 data-game 으로 바뀐 뒤 시점).
  }, [theme, lang, D]);

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
