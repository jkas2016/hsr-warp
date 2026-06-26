// Hero bento + summary stat row. The luck card is "featured" (gradient
// accent + glow + big animated number); 50/50 and avg-pity sit beside it.
// Luck sign (행운/불운) and the next-5★ guarantee state come from live data.
function HeroSummary({ D, scoped }) {
  const { Card, LuckBar, StatCard, Badge } = window.HSRWarpDesignSystem_4a0d44;
  const { num, useCountUp } = window.WarpUtil;
  const cb = D.charBanner;

  const lp = D.luck.charLuckPct;          // +면 행운(적게 씀), -면 불운(많이 씀)
  const lucky = lp >= 0;
  const luckColor = lucky ? 'var(--green)' : 'var(--red)';

  const luck = useCountUp(D.luck.charAvgPity, { decimals: 1 });
  const win = useCountUp(cb.win5050);
  const avg = useCountUp(cb.avgPity5, { decimals: 1 });
  const [showBar, setShowBar] = React.useState(false);
  React.useEffect(() => { const t = setTimeout(() => setShowBar(true), 350); return () => clearTimeout(t); }, []);

  return (
    <div>
      <section className="hero-bento">
        {/* Featured luck card */}
        <Card interactive glow="var(--glow-gold)" accent="var(--gold)" padding={22}
          style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column' }}>
          <div className="lbl">운 지표 · 캐릭터 평균 뽑기 수</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap', marginTop: 2 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 64, fontWeight: 700, lineHeight: 1, letterSpacing: '-1.5px', color: luckColor, fontVariantNumeric: 'tabular-nums' }}>
              {luck}<small style={{ fontFamily: 'var(--font-sans)', fontSize: 19, color: 'var(--muted)', fontWeight: 500, marginLeft: 4 }}>회</small>
            </div>
            <span style={{ background: lucky ? 'var(--green-fill)' : 'var(--red-fill)', color: luckColor, border: `1px solid ${lucky ? 'var(--green-line)' : 'var(--red-line)'}`, borderRadius: 'var(--r-pill)', padding: '5px 12px', fontSize: 13, fontWeight: 700 }}>
              {lucky ? '+' : ''}{lp}% {lucky ? '행운' : '불운'}
            </span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 10 }}>
            이론 평균 <b style={{ color: 'var(--txt)' }}>62.5회</b> 대비 {lucky ? '적게 쓰고 뽑았습니다' : '더 많이 썼습니다'} — 5★ {cb.count5}개 기준.
          </div>
          <div style={{ marginTop: 'auto', paddingTop: 22 }}>
            <LuckBar markerPct={showBar ? D.luck.markerPct : 50} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginTop: 8, fontFamily: 'var(--font-mono)' }}>
              <span>행운 ◂ 적게</span><span>평균 62.5</span><span>많이 ▸ 불운</span>
            </div>
          </div>
        </Card>

        {/* 50/50 win rate */}
        <Card interactive accent="var(--gold)" padding={22} style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="lbl">픽승률 · 캐릭터 50/50</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 46, fontWeight: 700, lineHeight: 1, letterSpacing: '-1px', color: 'var(--gold-ink)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
            {win}<small style={{ fontFamily: 'var(--font-sans)', fontSize: 16, color: 'var(--muted)', fontWeight: 500, marginLeft: 3 }}>%</small>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 8 }}>
            승부 {cb.contested}회 중 <b style={{ color: 'var(--gold-ink)' }}>{cb.cWins}승</b> · {cb.cLoss}패 · 확정 {cb.gWins}회
          </div>
          <div style={{ marginTop: 'auto', paddingTop: 16 }}>
            {scoped
              ? <Badge variant="neutral">구간 통계</Badge>
              : cb.currentGuaranteed
                ? <Badge variant="red">다음 5★ 확정 (픽뚫 상태)</Badge>
                : <Badge variant="green">다음 5★ 50/50</Badge>}
          </div>
        </Card>

        {/* avg pity */}
        <Card interactive accent="var(--purple)" padding={22} style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="lbl">평균 뽑기 수 · 캐릭터</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 46, fontWeight: 700, lineHeight: 1, letterSpacing: '-1px', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
            {avg}<small style={{ fontFamily: 'var(--font-sans)', fontSize: 16, color: 'var(--muted)', fontWeight: 500, marginLeft: 3 }}>회</small>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 8 }}>
            최고 운 <b style={{ color: 'var(--green)' }}>{cb.bestPity}회</b> · 최악 <b style={{ color: 'var(--red)' }}>{cb.worstPity}회</b>
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
          <StatCard label="총 뽑기" value={num(useCountUp(D.total))} unit="회" />
          <StatCard label="소비 성옥" value={num(useCountUp(D.jade))} unit={'≈ ' + num(D.jade / 160) + '연차'} />
          <StatCard label="5★" value={useCountUp(D.count5)} unit="개" accent="var(--gold)" valueColor="var(--gold-ink)" />
          <StatCard label="4★" value={useCountUp(D.count4)} unit="개" accent="var(--purple)" valueColor="var(--purple)" />
          <StatCard label="5★ 확률" value={useCountUp(D.rate5, { decimals: 2 })} unit="%" />
        </div>
      </section>
    </div>
  );
}
window.HeroSummary = HeroSummary;
