// Versions tab — per-patch comparison (item 4). A range Select filters which
// versions show; a row click highlights it; a bar chart compares average pity
// against the 62.5 theoretical line (shorter = luckier).
function VersionsView({ D, theme }) {
  const { Card, Select } = window.HSRWarpDesignSystem_4a0d44;
  const { num } = window.WarpUtil;
  const t = window.I18N.t, bl = window.I18N.bannerLabel;
  const [range, setRange] = React.useState('전체');
  const [banner, setBanner] = React.useState('all'); // 'all'|'char'|'lc' — 비교할 배너
  const [sel, setSel] = React.useState(null);

  const all = D.versions;
  const rows = all.filter((v) =>
    range === '전체' ? true : range === '4.x' ? v.v.startsWith('4') : v.v.startsWith('3'));

  // 선택 배너의 지표(평균뽑기·픽승/픽뚫·기준선). 없으면 all 로 폴백(구 데이터 방어).
  const mOf = (v) => v[banner] || v.all;
  // 기준선: 표시된 버전 중 5★가 있는 것들의 base 평균(캐릭/광추는 상수, 전체는 개수가중 평균).
  const withData = rows.map(mOf).filter((m) => m && m.count5 > 0);
  const baseLine = withData.length ? withData.reduce((s, m) => s + m.base, 0) / withData.length
    : (rows[0] ? mOf(rows[0]).base : 62.5);
  const bannerName = banner === 'all' ? t('scope.all') : bl(banner === 'char' ? '캐릭터' : '광추');

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>{t('table.banner')}</span>
        <Select value={banner} onChange={(e) => setBanner(e.target.value)}>
          <option value="all">{t('scope.all')}</option>
          <option value="char">{bl('캐릭터')}</option>
          <option value="lc">{bl('광추')}</option>
        </Select>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>{t('versions.compareRange')}</span>
        <Select value={range} onChange={(e) => setRange(e.target.value)}>
          <option value="전체">{t('scope.all')}</option>
          <option value="4.x">4.x</option>
          <option value="3.x">3.x</option>
        </Select>
        <span style={{ fontSize: 12.5, color: 'var(--muted)', marginLeft: 'auto' }}>{t('versions.clickRow')}</span>
      </div>

      <Card padding={18} style={{ marginBottom: 16 }}>
        <div className="lbl" style={{ marginBottom: 12 }}>{t('versions.avgCompare', { name: bannerName })} <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>{t('versions.avgCompareNote', { base: baseLine.toFixed(1) })}</span></div>
        <VersionPityChart rows={rows} banner={banner} baseLine={baseLine} sel={sel} theme={theme} />
      </Card>

      <Card padding={6}>
        <table className="tbl">
          <thead><tr><th>{t('versions.colVersion')}</th><th>{t('versions.colPeriod')}</th><th>{t('versions.colPulls')}</th><th>{t('versions.col5')}</th><th>{t('versions.colAvg')}</th><th>{t('versions.colWl')}</th></tr></thead>
          <tbody>
            {rows.map((v) => {
              const m = mOf(v);
              const on = sel === v.v;
              const has = m.avgPity != null;
              const lucky = has && m.avgPity < baseLine;
              return (
                <tr key={v.v} onClick={() => setSel(on ? null : v.v)}
                  style={{ cursor: 'pointer', background: on ? 'var(--gold-fill)' : 'transparent' }}>
                  <td><b style={{ fontFamily: 'var(--font-display)', color: on ? 'var(--gold-ink)' : 'var(--txt)' }}>{v.v}</b></td>
                  <td style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{v.period}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{num(v.total)}</td>
                  <td><span style={{ display: 'inline-block', minWidth: 28, textAlign: 'center', fontWeight: 700, fontSize: 12, padding: '3px 8px', borderRadius: 'var(--r-pill)', background: 'var(--gold)', color: 'var(--on-accent)' }}>{v.count5}</span></td>
                  <td>{has
                    ? <span style={{ color: lucky ? 'var(--green)' : 'var(--red)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{m.avgPity.toFixed(1)}</span>
                    : <span style={{ color: 'var(--muted)' }}>-</span>}</td>
                  <td><span style={{ color: 'var(--gold-ink)', fontWeight: 600 }}>{m.cWins}</span> <span style={{ color: 'var(--muted)' }}>/</span> <span style={{ color: 'var(--red)', fontWeight: 600 }}>{m.cLoss}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function VersionPityChart({ rows, banner, baseLine, sel, theme }) {
  const ref = React.useRef();
  React.useEffect(() => {
    if (!window.Chart) return;
    const t = window.I18N.t;
    const mOf = (v) => v[banner] || v.all;
    const cs = getComputedStyle(document.documentElement);
    const muted = cs.getPropertyValue('--muted').trim(), grid = cs.getPropertyValue('--line').trim();
    const colors = rows.map((v) => {
      const avg = mOf(v).avgPity;
      const base = (avg != null && avg < baseLine) ? '#52d39a' : '#ff6b6b';
      return sel && sel !== v.v ? base + '66' : base;
    });
    const c = new Chart(ref.current, {
      type: 'bar',
      data: { labels: rows.map((v) => v.v), datasets: [{ data: rows.map((v) => mOf(v).avgPity), backgroundColor: colors, borderRadius: 6 }] },
      options: {
        responsive: true, maintainAspectRatio: false, animation: { duration: 600 },
        plugins: { legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => `${ctx.parsed.y.toFixed(1)}${t('common.times')}` } } },
        scales: {
          y: { grid: { color: grid }, ticks: { color: muted }, suggestedMax: 90,
            afterBuildTicks: (a) => { if (!a.ticks.some((tk) => tk.value === baseLine)) a.ticks.push({ value: baseLine }); } },
          x: { grid: { display: false }, ticks: { color: muted, font: { family: 'Space Grotesk' } } },
        },
      },
    });
    return () => c.destroy();
  }, [rows, banner, baseLine, sel, theme, window.I18N.lang]);
  return <div style={{ position: 'relative', height: 210 }}><canvas ref={ref} /></div>;
}
window.VersionsView = VersionsView;
