// Banners tab — pick a banner (segmented control) and see a deep dive:
// big pity status, a pity-distribution histogram, 50/50 split, and that
// banner's full 5★ list (click → detail).
function BannersView({ D, theme, scoped, onFiveClick }) {
  const { Card, ProgressBar, Badge, StatCard } = window.HSRWarpDesignSystem_4a0d44;
  const { num, pityColor, pityBins, pickBanner } = window.WarpUtil;
  const t = window.I18N.t, bl = window.I18N.bannerLabel;
  const [sel, setSel] = React.useState('캐릭터');
  // 버전 스코프에서 선택 배너가 빠질 수 있다(구간 내 뽑기 0) — 첫 배너로 폴백.
  const b = pickBanner(D.banners, sel);
  if (!b) return null;
  const cur = b.short;
  const fives = D.fives.filter((f) => f.banner === cur);

  return (
    <div>
      {/* segmented banner picker */}
      <div data-share-omit style={{ display: 'inline-flex', gap: 4, padding: 4, borderRadius: 'var(--r-pill)', background: 'var(--panel-2)', border: '1px solid var(--line)' }}>
        {D.banners.map((x) => {
          const on = x.short === cur;
          return (
            <button key={x.type} onClick={() => setSel(x.short)} style={{
              appearance: 'none', border: 'none', cursor: 'pointer', borderRadius: 'var(--r-pill)',
              padding: '8px 16px', fontFamily: 'var(--font-display)', fontSize: 13.5, fontWeight: 600,
              display: 'inline-flex', alignItems: 'center', gap: 7,
              background: on ? 'var(--card-bg)' : 'transparent', boxShadow: on ? 'var(--shadow-card)' : 'none',
              color: on ? 'var(--txt)' : 'var(--muted)', transition: 'all .18s ease',
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: x.color, boxShadow: on ? `0 0 8px ${x.color}` : 'none' }} />
              {bl(x.short)}
            </button>
          );
        })}
      </div>

      <div className="banner-detail" style={{ marginTop: 16 }}>
        {/* status */}
        <Card accent={b.color} padding={22} data-share="banner-status">
          <div className="lbl">{scoped ? t('banners.rangeStats', { name: bl(b.short) }) : t('banners.currentPity', { name: bl(b.short) })}</div>
          {!scoped && (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 2 }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 56, fontWeight: 700, lineHeight: 1, color: pityColor(b.currentPity), fontVariantNumeric: 'tabular-nums' }}>{b.currentPity}</span>
                <small style={{ fontSize: 15, color: 'var(--muted)' }}>{t('banners.cap', { cap: b.cap })}</small>
              </div>
              <ProgressBar value={b.currentPity} max={b.cap} style={{ margin: '14px 0 6px' }} />
              {(() => {
                if (b.kind !== 'limited') return null;           // 한정 배너만 다음 5★ 상태 표시
                const variant = b.guaranteed ? 'red' : 'green';
                const label = b.guaranteed ? t('banners.nextGuaranteedLoss') : t('banners.next5050');
                return <div style={{ marginTop: 10 }}><Badge variant={variant}>{label}</Badge></div>;
              })()}
            </>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 18 }}>
            <Mini k={t('banners.total')} v={num(b.total)} />
            <Mini k={t('banners.got5')} v={b.count5 + t('common.count')} />
            <Mini k={t('banners.avgPulls')} v={b.avgPity5.toFixed(1) + t('common.times')} />
            <Mini k={t('banners.luck')} color={!b.count5 ? undefined : b.avgPity5 <= b.expAvg ? 'var(--green)' : 'var(--red)'}
              v={!b.count5 ? '-' : b.avgPity5 <= b.expAvg
                ? t('banners.luckFast', { n: (b.expAvg - b.avgPity5).toFixed(1) })
                : t('banners.luckSlow', { n: (b.avgPity5 - b.expAvg).toFixed(1) })} />
            <Mini k={t('banners.winrate')}
              v={b.winRate == null ? '-' : <>{Math.round(b.winRate * 100)}% <small style={{ fontSize: 11, color: 'var(--muted)' }}>{t('banners.wl', { w: b.cWins, l: b.cLoss })}</small></>} />
            <Mini k={t('banners.jade')} v={num(b.total * 160)} />
          </div>
        </Card>

        {/* pity histogram */}
        <Card padding={18} data-share="banner-pity">
          <div className="lbl" style={{ marginBottom: 12 }}>{t('banners.pityDist')}</div>
          <BannerPityChart bins={pityBins(D.fives, cur)} cap={b.cap} theme={theme} sel={cur} />
          {b.kind === 'limited' && (
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <Split label={t('result.win')} v={b.cWins} color="var(--gold)" total={b.cWins + b.cLoss + b.gWins} />
              <Split label={t('result.loss')} v={b.cLoss} color="var(--red)" total={b.cWins + b.cLoss + b.gWins} />
              <Split label={t('result.guaranteed')} v={b.gWins} color="var(--green)" total={b.cWins + b.cLoss + b.gWins} />
            </div>
          )}
        </Card>
      </div>

      <section data-share="banner-fives" style={{ marginTop: 22 }}>
        <h2 className="h2">{t('banners.fiveList', { name: bl(b.short) })} <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 400 }}>{t('banners.count', { n: fives.length })}</span></h2>
        <FivesTable key={cur} rows={fives} onRowClick={onFiveClick} pageSize={20} />
      </section>
    </div>
  );
}

function Mini({ k, v, color }) {
  return (
    <div style={{ background: 'var(--panel-2)', borderRadius: 'var(--r-md)', padding: '10px 12px' }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', fontWeight: 600 }}>{k}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, marginTop: 3, fontVariantNumeric: 'tabular-nums', color }}>{v}</div>
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
    // bins.join: 배열은 매 렌더 새 참조 → 값 기반 dep 로 D.fives 갱신 시에만 재빌드(매 렌더 재빌드 방지).
  }, [theme, sel, cap, bins.join(',')]);
  return <div style={{ position: 'relative', height: 200 }}><canvas ref={ref} /></div>;
}
window.BannersView = BannersView;
