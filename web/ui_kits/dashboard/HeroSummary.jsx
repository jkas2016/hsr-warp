// Hero bento + summary stat row. The luck card is "featured" (gradient
// accent + glow + big animated number); 50/50 and avg-pity sit beside it.
// Luck sign (행운/불운) and the next-5★ guarantee state come from live data.
function HeroSummary({ D, scoped }) {
  const { Card, LuckBar, StatCard, Badge } = window.HSRWarpDesignSystem_4a0d44;
  const { num, useCountUp } = window.WarpUtil;
  const t = window.I18N.t;
  const cb = D.charBanner;

  const lp = D.luck.charLuckPct;          // +면 행운(적게 씀), -면 불운(많이 씀)
  const lucky = lp >= 0;
  const luckColor = lucky ? 'var(--green)' : 'var(--red)';

  const luck = useCountUp(D.luck.charAvgPity, { decimals: 1 });
  const win = useCountUp(cb.win5050);
  const avg = useCountUp(cb.avgPity5, { decimals: 1 });
  const [showBar, setShowBar] = React.useState(false);
  React.useEffect(() => { const timer = setTimeout(() => setShowBar(true), 350); return () => clearTimeout(timer); }, []);

  return (
    <div>
      <section className="hero-bento">
        {/* Featured luck card */}
        <Card interactive glow="var(--glow-gold)" accent="var(--gold)" padding={22}
          style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column' }}>
          <div className="lbl">{t('hero.luckLabel')}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap', marginTop: 2 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 64, fontWeight: 700, lineHeight: 1, letterSpacing: '-1.5px', color: luckColor, fontVariantNumeric: 'tabular-nums' }}>
              {luck}<small style={{ fontFamily: 'var(--font-sans)', fontSize: 19, color: 'var(--muted)', fontWeight: 500, marginLeft: 4 }}>{t('common.times')}</small>
            </div>
            <span style={{ background: lucky ? 'var(--green-fill)' : 'var(--red-fill)', color: luckColor, border: `1px solid ${lucky ? 'var(--green-line)' : 'var(--red-line)'}`, borderRadius: 'var(--r-pill)', padding: '5px 12px', fontSize: 13, fontWeight: 700 }}>
              {lucky ? '+' : ''}{lp}% {lucky ? t('hero.lucky') : t('hero.unlucky')}
            </span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 10 }}>
            {lucky ? t('hero.luckDescLucky', { avg: cb.expAvg, n: cb.count5 }) : t('hero.luckDescUnlucky', { avg: cb.expAvg, n: cb.count5 })}
          </div>
          <div style={{ marginTop: 'auto', paddingTop: 22 }}>
            <LuckBar markerPct={showBar ? D.luck.markerPct : 50} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginTop: 8, fontFamily: 'var(--font-mono)' }}>
              <span>{t('hero.scaleLuckyLess')}</span><span>{t('hero.scaleAvg')}</span><span>{t('hero.scaleMoreUnlucky')}</span>
            </div>
          </div>
        </Card>

        {/* 50/50 win rate */}
        <Card interactive accent="var(--gold)" padding={22} style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="lbl">{t('hero.winrateLabel')}</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 46, fontWeight: 700, lineHeight: 1, letterSpacing: '-1px', color: 'var(--gold-ink)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
            {win}<small style={{ fontFamily: 'var(--font-sans)', fontSize: 16, color: 'var(--muted)', fontWeight: 500, marginLeft: 3 }}>%</small>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 8 }}>
            {t('hero.winrateDesc', { c: cb.contested, w: cb.cWins, l: cb.cLoss, g: cb.gWins })}
          </div>
          <div style={{ marginTop: 'auto', paddingTop: 16 }}>
            {scoped
              ? <Badge variant="neutral">{t('hero.rangeStats')}</Badge>
              : cb.currentGuaranteed
                ? <Badge variant="red">{t('hero.nextGuaranteedLoss')}</Badge>
                : <Badge variant="green">{t('hero.next5050')}</Badge>}
          </div>
        </Card>

        {/* avg pity */}
        <Card interactive accent="var(--purple)" padding={22} style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="lbl">{t('hero.avgLabel')}</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 46, fontWeight: 700, lineHeight: 1, letterSpacing: '-1px', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
            {avg}<small style={{ fontFamily: 'var(--font-sans)', fontSize: 16, color: 'var(--muted)', fontWeight: 500, marginLeft: 3 }}>{t('common.times')}</small>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 8 }}>
            {t('hero.bestWorst', { best: cb.bestPity, worst: cb.worstPity })}
          </div>
          <div style={{ marginTop: 'auto', paddingTop: 16, display: 'flex', gap: 6 }}>
            <span style={{ flex: 1, height: 5, borderRadius: 3, background: 'var(--green)' }} />
            <span style={{ flex: 1, height: 5, borderRadius: 3, background: 'var(--orange)' }} />
            <span style={{ flex: 1, height: 5, borderRadius: 3, background: 'var(--red)', opacity: .5 }} />
          </div>
        </Card>
      </section>

      <section style={{ marginTop: 14 }}>
        <div className="stat-row">
          <StatCard label={t('hero.totalPulls')} value={num(useCountUp(D.total))} unit={t('common.times')} />
          <StatCard label={t('hero.jade')} value={num(useCountUp(D.jade))} unit={t('hero.jadeUnit', { n: num(D.jade / 160) })} />
          <StatCard label="5★" value={useCountUp(D.count5)} unit={t('common.count')} accent="var(--gold)" valueColor="var(--gold-ink)" />
          <StatCard label="4★" value={useCountUp(D.count4)} unit={t('common.count')} accent="var(--purple)" valueColor="var(--purple)" />
          <StatCard label={t('hero.rate5')} value={useCountUp(D.rate5, { decimals: 2 })} unit="%" />
        </div>
      </section>
    </div>
  );
}
window.HeroSummary = HeroSummary;
