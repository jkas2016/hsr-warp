// Banners tab — pick a banner (segmented control) and see a deep dive:
// big pity status, a pity-distribution histogram, 50/50 split, and that
// banner's full 5★ list (click → detail).
function BannersView({ D, theme, scoped, onFiveClick }) {
  const { Card, ProgressBar, Badge, StatCard } = window.HSRWarpDesignSystem_4a0d44;
  const { num, pityColor, pityBins } = window.WarpUtil;
  const [sel, setSel] = React.useState('캐릭터');
  const b = D.banners.find((x) => x.short === sel);
  const fives = D.fives.filter((f) => f.banner === sel);

  return (
    <div>
      {/* segmented banner picker */}
      <div style={{ display: 'inline-flex', gap: 4, padding: 4, borderRadius: 'var(--r-pill)', background: 'var(--panel-2)', border: '1px solid var(--line)' }}>
        {D.banners.map((x) => {
          const on = x.short === sel;
          return (
            <button key={x.type} onClick={() => setSel(x.short)} style={{
              appearance: 'none', border: 'none', cursor: 'pointer', borderRadius: 'var(--r-pill)',
              padding: '8px 16px', fontFamily: 'var(--font-display)', fontSize: 13.5, fontWeight: 600,
              display: 'inline-flex', alignItems: 'center', gap: 7,
              background: on ? 'var(--card-bg)' : 'transparent', boxShadow: on ? 'var(--shadow-card)' : 'none',
              color: on ? 'var(--txt)' : 'var(--muted)', transition: 'all .18s ease',
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: x.color, boxShadow: on ? `0 0 8px ${x.color}` : 'none' }} />
              {x.short}
            </button>
          );
        })}
      </div>

      <div className="banner-detail" style={{ marginTop: 16 }}>
        {/* status */}
        <Card accent={b.color} padding={22}>
          <div className="lbl">{scoped ? `구간 통계 · ${b.short} 워프` : `현재 천장 · ${b.short} 워프`}</div>
          {!scoped && (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 2 }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 56, fontWeight: 700, lineHeight: 1, color: pityColor(b.currentPity), fontVariantNumeric: 'tabular-nums' }}>{b.currentPity}</span>
                <small style={{ fontSize: 15, color: 'var(--muted)' }}>/ {b.cap} 천장</small>
              </div>
              <ProgressBar value={b.currentPity} max={b.cap} style={{ margin: '14px 0 6px' }} />
              {b.kind === 'limited' && b.guaranteed
                ? <div style={{ marginTop: 10 }}><Badge variant="red">다음 5★ 확정 (픽뚫 상태)</Badge></div>
                : b.kind === 'limited' ? <div style={{ marginTop: 10 }}><Badge variant="green">다음 5★ 50/50</Badge></div> : null}
            </>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 18 }}>
            <Mini k="총 뽑기" v={num(b.total)} />
            <Mini k="5★ 획득" v={`${b.count5}개`} />
            <Mini k="평균 천장" v={`${b.avgPity5.toFixed(1)}회`} />
            <Mini k="소비 성옥" v={num(b.total * 160)} />
          </div>
        </Card>

        {/* pity histogram */}
        <Card padding={18}>
          <div className="lbl" style={{ marginBottom: 12 }}>5★ 천장 분포</div>
          <BannerPityChart bins={pityBins(D.fives, sel)} cap={b.cap} theme={theme} sel={sel} />
          {b.kind === 'limited' && (
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <Split label="픽승" v={b.cWins} color="var(--gold)" total={b.cWins + b.cLoss + b.gWins} />
              <Split label="픽뚫" v={b.cLoss} color="var(--red)" total={b.cWins + b.cLoss + b.gWins} />
              <Split label="확정" v={b.gWins} color="var(--green)" total={b.cWins + b.cLoss + b.gWins} />
            </div>
          )}
        </Card>
      </div>

      <section style={{ marginTop: 22 }}>
        <h2 className="h2">{b.short} 워프 5★ 기록 <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 400 }}>({fives.length}개)</span></h2>
        <FivesTable key={sel} rows={fives} onRowClick={onFiveClick} pageSize={20} />
      </section>
    </div>
  );
}

function Mini({ k, v }) {
  return (
    <div style={{ background: 'var(--panel-2)', borderRadius: 'var(--r-md)', padding: '10px 12px' }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', fontWeight: 600 }}>{k}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{v}</div>
    </div>
  );
}
function Split({ label, v, color, total }) {
  const pct = total ? Math.round((v / total) * 100) : 0;
  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
        <span style={{ color: 'var(--muted)' }}>{label}</span><b style={{ color }}>{v}</b>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: 'var(--panel-2)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3 }} />
      </div>
    </div>
  );
}
function BannerPityChart({ bins, cap, theme, sel }) {
  const ref = React.useRef();
  React.useEffect(() => {
    if (!window.Chart) return;
    const cs = getComputedStyle(document.documentElement);
    const muted = cs.getPropertyValue('--muted').trim(), grid = cs.getPropertyValue('--line').trim();
    const n = Math.ceil(cap / 10);
    const labels = Array.from({ length: n }, (_, i) => `${i * 10 + 1}-${(i + 1) * 10}`);
    const data = bins.slice(0, n);
    const soft = cap === 80 ? 6 : 7;
    const c = new Chart(ref.current, {
      type: 'bar',
      data: { labels, datasets: [{ data, backgroundColor: data.map((_, i) => (i < soft ? '#52d39a' : '#ff9e45')), borderRadius: 6 }] },
      options: { responsive: true, maintainAspectRatio: false, animation: { duration: 600 },
        plugins: { legend: { display: false } },
        scales: { y: { grid: { color: grid }, ticks: { precision: 0, color: muted } }, x: { grid: { display: false }, ticks: { color: muted } } } },
    });
    return () => c.destroy();
  }, [theme, sel, cap]);
  return <div style={{ position: 'relative', height: 200 }}><canvas ref={ref} /></div>;
}
window.BannersView = BannersView;
