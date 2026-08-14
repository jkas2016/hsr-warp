// Hero bento + summary stat row. The luck card is "featured" (gradient
// accent + glow + big animated number); 50/50 and avg-pity sit beside it.
// Luck sign (행운/불운) and the next-5★ guarantee state come from live data.
function HeroSummary({ D, scoped }) {
  const { Card, LuckBar, StatCard, Badge } = window.HSRWarpDesignSystem_4a0d44;
  const { num, useCountUp } = window.WarpUtil;
  const t = window.I18N.t, bl = window.I18N.bannerLabel;
  const lim = D.limited;
  // 한정 배너 이름은 게임마다 다르다 — 코드가 아니라 역할로 현재 게임의 short 를 얻는다.
  const charShort = window.WarpData.roleShort('limited-char');
  const lcShort = window.WarpData.roleShort('limited-weapon');

  // 운 지표 = 5★당 평균 뽑기 수의 기준선 대비 차이(회). 기준보다 빨리 뽑았으면 행운.
  const diff = lim.count5 ? lim.avgPity5 - lim.base : 0;
  const lucky = diff <= 0;
  const luckColor = lucky ? 'var(--green)' : 'var(--red)';

  const luck = useCountUp(Math.abs(diff), { decimals: 1 });
  const win = useCountUp(Math.round((lim.win5050Rate ?? 0) * 100));
  const avg = useCountUp(lim.avgPity5 || 0, { decimals: 1 });
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
              {t('hero.avgChip', { avg: (lim.avgPity5 || 0).toFixed(1) })} · {lucky ? t('hero.lucky') : t('hero.unlucky')}
            </span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 10, whiteSpace: 'pre-line' }}>
            {lucky
              ? t('hero.luckDescLucky', { avg: lim.base.toFixed(1), diff: Math.abs(diff).toFixed(1), n: lim.count5, c: lim.charCount5, l: lim.lcCount5 })
              : t('hero.luckDescUnlucky', { avg: lim.base.toFixed(1), diff: Math.abs(diff).toFixed(1), n: lim.count5, c: lim.charCount5, l: lim.lcCount5 })}
          </div>
          <div style={{ marginTop: 'auto', paddingTop: 22 }}>
            <LuckBar markerPct={showBar ? D.luck.markerPct : 50} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginTop: 8, fontFamily: 'var(--font-mono)' }}>
              <span>{t('hero.scaleLuckyLess')}</span><span>{t('hero.scaleAvg', { avg: lim.base.toFixed(1) })}</span><span>{t('hero.scaleMoreUnlucky')}</span>
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
            {t('hero.winrateDesc', { c: lim.contested, w: lim.cWins, l: lim.cLoss, g: lim.gWins })}
          </div>
          <div style={{ marginTop: 'auto', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
            {scoped
              ? <Badge variant="neutral">{t('hero.rangeStats')}</Badge>
              : <>
                  <Badge variant={lim.charGuaranteed ? 'red' : 'green'}>
                    {lim.charGuaranteed ? t('hero.nextBadgeGuar', { name: bl(charShort) }) : t('hero.nextBadge', { name: bl(charShort), odds: lim.charOdds })}
                  </Badge>
                  <Badge variant={lim.lcGuaranteed ? 'red' : 'green'}>
                    {lim.lcGuaranteed ? t('hero.nextBadgeGuar', { name: bl(lcShort) }) : t('hero.nextBadge', { name: bl(lcShort), odds: lim.lcOdds })}
                  </Badge>
                </>}
          </div>
        </Card>

        {/* avg pity */}
        <Card interactive accent="var(--purple)" padding={22} style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="lbl">{t('hero.avgLabel')}</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 46, fontWeight: 700, lineHeight: 1, letterSpacing: '-1px', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
            {avg}<small style={{ fontFamily: 'var(--font-sans)', fontSize: 16, color: 'var(--muted)', fontWeight: 500, marginLeft: 3 }}>{t('common.times')}</small>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 8 }}>
            {t('hero.bestWorst', { best: lim.bestPity ?? 0, worst: lim.worstPity ?? 0 })}
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
