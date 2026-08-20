/**
 * 배너별 상태 카드: 색 점 + 큰 천장 숫자 + ProgressBar, 그 아래 총 뽑기 / 5★ /
 * 평균 뽑기 / 50/50 행. 배너 색 상단 액센트가 붙은 hover 부상 글래스 카드다.
 * @param {Object} props
 * @param {{banners: Object[]}} props.D WARP_DATA.
 * @param {boolean} props.scoped 버전 스코프 상태. true 면 '현재 천장'은 의미가 없어 통계 행만 보인다.
 * @returns {JSX.Element}
 */
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
            {(() => {
              const rows = (
                <div>
                  <Row k={t('bannercards.total')} v={num(b.total)} />
                  <Row k={t('bannercards.got5')} v={b.count5} />
                  <Row k={t('bannercards.avgPulls')} v={b.avgPity5 ? b.avgPity5.toFixed(1) : '-'} />
                  {b.kind === 'limited' && <Row k={t('bannercards.wlg')} v={`${b.cWins} / ${b.cLoss} / ${b.gWins}`} />}
                </div>
              );
              if (scoped) return <div style={{ marginTop: 14 }}>{rows}</div>;
              return (
                <div className="banner-split" style={{ marginTop: 14 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: 38, fontWeight: 700, lineHeight: 1, color: pityColor(b.currentPity), fontVariantNumeric: 'tabular-nums' }}>{b.currentPity}</span>
                      <small style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 500 }}>{t('bannercards.cap', { cap: b.cap })}</small>
                    </div>
                    <ProgressBar value={b.currentPity} max={b.cap} style={{ margin: '11px 0 0' }} />
                    {b.kind === 'limited' && (
                      <div style={{ marginTop: 10 }}>
                        {b.guaranteed
                          ? <Badge variant="red">{t('bannercards.nextGuaranteed')}</Badge>
                          : b.odds && <span style={{ fontSize: 12, color: 'var(--muted)' }}>{t('bannercards.nextOdds', { odds: b.odds })}</span>}
                      </div>
                    )}
                  </div>
                  {rows}
                </div>
              );
            })()}
          </Card>
        ))}
      </div>
    </section>
  );
}
/**
 * 카드 안의 라벨 ↔ 값 한 줄.
 * @param {Object} props
 * @param {string} props.k 라벨.
 * @param {React.ReactNode} props.v 값.
 * @returns {JSX.Element}
 */
function Row({ k, v }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', color: 'var(--muted)', borderTop: '1px solid var(--line)' }}>
      <span>{k}</span><b style={{ color: 'var(--txt)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{v}</b>
    </div>
  );
}
window.BannerCards = BannerCards;
