// Versions tab — per-patch comparison (item 4). A range Select filters which
// versions show; a row click highlights it; a bar chart compares average pity
// against the 62.5 theoretical line (shorter = luckier).
function VersionsView({ D, theme }) {
  const { Card, Select } = window.HSRWarpDesignSystem_4a0d44;
  const { num } = window.WarpUtil;
  const [range, setRange] = React.useState('전체');
  const [sel, setSel] = React.useState(null);

  const all = D.versions;
  const rows = all.filter((v) =>
    range === '전체' ? true : range === '4.x' ? v.v.startsWith('4') : v.v.startsWith('3'));

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>비교 범위</span>
        <Select value={range} onChange={(e) => setRange(e.target.value)}>
          <option value="전체">전체</option>
          <option value="4.x">4.x</option>
          <option value="3.x">3.x</option>
        </Select>
        <span style={{ fontSize: 12.5, color: 'var(--muted)', marginLeft: 'auto' }}>행을 클릭해 해당 패치를 강조하세요.</span>
      </div>

      <Card padding={18} style={{ marginBottom: 16 }}>
        <div className="lbl" style={{ marginBottom: 12 }}>캐릭터 평균 천장 비교 <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>· 짧을수록 행운 (기준 62.5)</span></div>
        <VersionPityChart rows={rows} sel={sel} theme={theme} />
      </Card>

      <Card padding={6}>
        <table className="tbl">
          <thead><tr><th>버전</th><th>기간</th><th>뽑기</th><th>5★</th><th>캐릭 평균천장</th><th>픽승 / 픽뚫</th></tr></thead>
          <tbody>
            {rows.map((v) => {
              const on = sel === v.v;
              const lucky = v.charAvgPity < 62.5;
              return (
                <tr key={v.v} onClick={() => setSel(on ? null : v.v)}
                  style={{ cursor: 'pointer', background: on ? 'var(--gold-fill)' : 'transparent' }}>
                  <td><b style={{ fontFamily: 'var(--font-display)', color: on ? 'var(--gold-ink)' : 'var(--txt)' }}>{v.v}</b></td>
                  <td style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{v.period}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{num(v.total)}</td>
                  <td><span style={{ display: 'inline-block', minWidth: 28, textAlign: 'center', fontWeight: 700, fontSize: 12, padding: '3px 8px', borderRadius: 'var(--r-pill)', background: 'var(--gold)', color: 'var(--on-accent)' }}>{v.count5}</span></td>
                  <td><span style={{ color: lucky ? 'var(--green)' : 'var(--red)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{v.charAvgPity.toFixed(1)}</span></td>
                  <td><span style={{ color: 'var(--gold-ink)', fontWeight: 600 }}>{v.cWins}</span> <span style={{ color: 'var(--muted)' }}>/</span> <span style={{ color: 'var(--red)', fontWeight: 600 }}>{v.cLoss}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function VersionPityChart({ rows, sel, theme }) {
  const ref = React.useRef();
  React.useEffect(() => {
    if (!window.Chart) return;
    const cs = getComputedStyle(document.documentElement);
    const muted = cs.getPropertyValue('--muted').trim(), grid = cs.getPropertyValue('--line').trim();
    const colors = rows.map((v) => {
      const lucky = v.charAvgPity < 62.5;
      const base = lucky ? '#52d39a' : '#ff6b6b';
      return sel && sel !== v.v ? base + '66' : base;
    });
    const c = new Chart(ref.current, {
      type: 'bar',
      data: { labels: rows.map((v) => v.v), datasets: [{ data: rows.map((v) => v.charAvgPity), backgroundColor: colors, borderRadius: 6 }] },
      options: {
        responsive: true, maintainAspectRatio: false, animation: { duration: 600 },
        plugins: { legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => `${ctx.parsed.y.toFixed(1)}회` } } },
        scales: {
          y: { grid: { color: grid }, ticks: { color: muted }, suggestedMax: 90,
            afterBuildTicks: (a) => { if (!a.ticks.some((t) => t.value === 62.5)) a.ticks.push({ value: 62.5 }); } },
          x: { grid: { display: false }, ticks: { color: muted, font: { family: 'Space Grotesk' } } },
        },
      },
    });
    return () => c.destroy();
  }, [rows, sel, theme]);
  return <div style={{ position: 'relative', height: 210 }}><canvas ref={ref} /></div>;
}
window.VersionsView = VersionsView;
