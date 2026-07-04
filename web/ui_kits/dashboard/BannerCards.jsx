// Per-banner status cards: colored dot + big pity number + ProgressBar,
// then total / 5★ / avg-pity / 50/50 rows. Hover-lifting glass cards with a
// banner-colored top accent.
function BannerCards({ D, scoped }) {
  const t = window.I18N.t;
  const bl = window.I18N.bannerLabel;
  const { Card, ProgressBar, Badge } = window.HSRWarpDesignSystem_4a0d44;
  const { num, pityColor } = window.WarpUtil;
  const glowFor = (c) => `0 0 26px ${c}55`;

  return (
    <section style={{ marginTop: 26 }}>
      <h2 className="h2">{t('bannercards.title')}</h2>
      <div className="banner-row">
        {D.banners.map((b) => (
          <Card key={b.type} interactive accent={b.color} glow={glowFor(b.color)} padding={20}>
            <h3 style={{ fontSize: 15, display: 'flex', alignItems: 'center', gap: 8, margin: 0, fontFamily: 'var(--font-display)', fontWeight: 600 }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: b.color, boxShadow: `0 0 10px ${b.color}` }} />
              {bl(b.short)}{t('bannercards.warpSuffix')}
            </h3>
            {!scoped && (
              <>
                <div style={{ marginTop: 14, display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 38, fontWeight: 700, lineHeight: 1, color: pityColor(b.currentPity), fontVariantNumeric: 'tabular-nums' }}>{b.currentPity}</span>
                  <small style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 500 }}>{t('bannercards.cap', { cap: b.cap })}</small>
                </div>
                <ProgressBar value={b.currentPity} max={b.cap} style={{ margin: '11px 0 14px' }} />
              </>
            )}
            <div style={{ marginTop: scoped ? 14 : 0 }}>
              <Row k={t('bannercards.total')} v={num(b.total)} />
              <Row k={t('bannercards.got5')} v={b.count5} />
              <Row k={t('bannercards.avgPulls')} v={b.avgPity5 ? b.avgPity5.toFixed(1) : '-'} />
              {b.kind === 'limited' && <Row k={t('bannercards.wlg')} v={`${b.cWins} / ${b.cLoss} / ${b.gWins}`} />}
            </div>
            {!scoped && b.kind === 'limited' && b.guaranteed &&
              <div style={{ marginTop: 10 }}><Badge variant="red">{t('bannercards.nextGuaranteed')}</Badge></div>}
          </Card>
        ))}
      </div>
    </section>
  );
}
function Row({ k, v }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', color: 'var(--muted)', borderTop: '1px solid var(--line)' }}>
      <span>{k}</span><b style={{ color: 'var(--txt)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{v}</b>
    </div>
  );
}
window.BannerCards = BannerCards;
