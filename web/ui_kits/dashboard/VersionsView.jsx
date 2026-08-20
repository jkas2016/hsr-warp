/**
 * Versions 탭 — 패치별 비교. 범위 Select 로 표시할 버전을 거르고, 행을 누르면 강조되며,
 * 막대 차트가 평균 뽑기를 이론 기준선과 비교한다(짧을수록 운이 좋다).
 * @param {Object} props
 * @param {{versions: Object[]}} props.D WARP_DATA.
 * @param {string} props.theme 현재 테마(차트 재빌드 dep).
 * @param {string} props.lang 현재 언어(차트 라벨 재빌드 dep).
 * @returns {JSX.Element}
 */
function VersionsView({ D, theme, lang }) {
  const { Card, Select } = window.HSRWarpDesignSystem_4a0d44;
  const { num } = window.WarpUtil;
  const t = window.I18N.t, bl = window.I18N.bannerLabel;
  const [range, setRange] = React.useState('전체');
  const [banner, setBanner] = React.useState('all'); // 'all'|'char'|'lc' — 비교할 배너
  const [sel, setSel] = React.useState(null);

  const all = D.versions;
  const majorOf = (v) => String(v).split('.')[0];
  // 비교 범위 선택지는 데이터의 메이저 버전에서 유도한다(게임마다 버전대가 다르다).
  const majors = [...new Set(all.map((v) => majorOf(v.v)))].sort((a, b) => Number(b) - Number(a));
  // rows 는 시간순(ASC) — 차트가 그대로 쓴다. 하단 테이블만 렌더 시 reverse 해 최신 버전 우선(DESC).
  const rows = all.filter((v) => (range === '전체' ? true : majorOf(v.v) === range));

  // 선택 배너의 지표(평균뽑기·픽승/픽뚫·기준선). 없으면 all 로 폴백(구 데이터 방어).
  const mOf = (v) => v[banner] || v.all;
  // 기준선: 표시된 버전 중 5★가 있는 것들의 base 평균(캐릭/광추는 상수, 전체는 개수가중 평균).
  const withData = rows.map(mOf).filter((m) => m && m.count5 > 0);
  const baseLine = withData.length ? withData.reduce((s, m) => s + m.base, 0) / withData.length
    : (rows[0] ? mOf(rows[0]).base : 62.5);
  // 배너 이름은 게임마다 다르다 — 역할로 현재 게임의 short 를 얻어 라벨링한다.
  const charShort = window.WarpData.roleShort('limited-char');
  const lcShort = window.WarpData.roleShort('limited-weapon');
  const bannerName = banner === 'all' ? t('scope.all') : bl(banner === 'char' ? charShort : lcShort);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>{t('table.banner')}</span>
        <Select value={banner} onChange={(e) => setBanner(e.target.value)}>
          <option value="all">{t('scope.all')}</option>
          <option value="char">{bl(charShort)}</option>
          <option value="lc">{bl(lcShort)}</option>
        </Select>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>{t('versions.compareRange')}</span>
        <Select value={range} onChange={(e) => setRange(e.target.value)}>
          <option value="전체">{t('scope.all')}</option>
          {majors.map((m) => <option key={m} value={m}>{m + '.x'}</option>)}
        </Select>
        <span style={{ fontSize: 12.5, color: 'var(--muted)', marginLeft: 'auto' }}>{t('versions.clickRow')}</span>
      </div>

      <Card padding={18} style={{ marginBottom: 16 }}>
        <div className="lbl" style={{ marginBottom: 12 }}>{t('versions.avgCompare', { name: bannerName })} <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>{t('versions.avgCompareNote', { base: baseLine.toFixed(1) })}</span></div>
        <VersionPityChart rows={rows} banner={banner} baseLine={baseLine} sel={sel} theme={theme} lang={lang} />
      </Card>

      <Card padding={6}>
        <table className="tbl">
          <thead><tr><th>{t('versions.colVersion')}</th><th>{t('versions.colPeriod')}</th><th>{t('versions.colPulls')}</th><th>{t('versions.col5')}</th><th>{t('versions.colAvg')}</th><th>{t('versions.colWl')}</th></tr></thead>
          <tbody>
            {[...rows].reverse().map((v) => {
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

/**
 * 버전별 평균 뽑기 막대 차트. 기준선보다 짧으면 초록, 길면 빨강이고,
 * 선택된 버전이 있으면 나머지는 반투명해진다. y축엔 기준선 눈금을 강제로 추가한다.
 * @param {Object} props
 * @param {Object[]} props.rows 버전 비교 행 목록.
 * @param {'char'|'lc'|'all'} props.banner 표시할 지표 축(없으면 all 로 폴백).
 * @param {number} props.baseLine 이론 기준선(평균 뽑기).
 * @param {string} props.sel 강조할 버전 라벨. 빈 값이면 전부 불투명.
 * @param {string} props.theme 현재 테마(재빌드 dep).
 * @param {string} props.lang 현재 언어(툴팁 단위 재평가 dep).
 * @returns {JSX.Element}
 */
function VersionPityChart({ rows, banner, baseLine, sel, theme, lang }) {
  const ref = React.useRef();
  React.useEffect(() => {
    if (!window.Chart) return;
    const t = window.I18N.t;
    const mOf = (v) => v[banner] || v.all;
    const cs = getComputedStyle(document.documentElement);
    const muted = cs.getPropertyValue('--muted').trim(), grid = cs.getPropertyValue('--line').trim();
    // 게임 팔레트(tokens/game.css)를 따른다 — 폴백은 colors.css 기본값.
    const green = cs.getPropertyValue('--green').trim() || '#52d39a', red = cs.getPropertyValue('--red').trim() || '#ff6b6b';
    const colors = rows.map((v) => {
      const avg = mOf(v).avgPity;
      const base = (avg != null && avg < baseLine) ? green : red;
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
  }, [rows, banner, baseLine, sel, theme, lang]);
  return <div style={{ position: 'relative', height: 210 }}><canvas ref={ref} /></div>;
}
window.VersionsView = VersionsView;
