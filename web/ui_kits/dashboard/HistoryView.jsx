// History tab — full 5★ list with banner + result filter chips. Rows click
// through to the detail modal (item 6).
function HistoryView({ D, onFiveClick }) {
  const [banner, setBanner] = React.useState('전체');   // 정규 short or '전체'
  const [result, setResult] = React.useState('전체');   // 'win'|'loss'|'guaranteed'|'전체'
  const t = window.I18N.t, bl = window.I18N.bannerLabel;

  const bannerCodes = ['전체', '캐릭터', '광추'];                       // 값=정규(일반은 집계 제외)
  const bannerLabels = bannerCodes.map((c) => (c === '전체' ? t('scope.all') : bl(c)));
  const resultCodes = ['전체', 'win', 'loss', 'guaranteed'];           // 값=정규
  const resultLabels = resultCodes.map((c) => (c === '전체' ? t('scope.all') : t('result.' + c)));

  const rows = D.fives.filter((f) =>
    (banner === '전체' || f.banner === banner) &&
    (result === '전체' || f.result === result));

  return (
    <div>
      <div data-share-omit style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: 16 }}>
        <ChipGroup label={t('history.filterBanner')} options={bannerLabels}
          value={bannerLabels[bannerCodes.indexOf(banner)]}
          onChange={(lbl) => setBanner(bannerCodes[bannerLabels.indexOf(lbl)])} />
        <ChipGroup label={t('history.filterResult')} options={resultLabels}
          value={resultLabels[resultCodes.indexOf(result)]}
          onChange={(lbl) => setResult(resultCodes[resultLabels.indexOf(lbl)])} />
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 12 }}>
        {t('history.summary', { n: rows.length })}
      </div>
      <div data-share="history">
        <FivesTable key={banner + '|' + result} rows={rows} onRowClick={onFiveClick} pageSize={20} />
      </div>
    </div>
  );
}

function ChipGroup({ label, options, value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--muted)', fontWeight: 600 }}>{label}</span>
      {options.map((o) => {
        const on = o === value;
        return (
          <button key={o} onClick={() => onChange(o)} style={{
            appearance: 'none', cursor: 'pointer', borderRadius: 'var(--r-pill)', padding: '6px 13px',
            fontFamily: 'var(--font-sans)', fontSize: 12.5, fontWeight: 600,
            border: `1px solid ${on ? 'var(--gold-line)' : 'var(--line)'}`,
            background: on ? 'var(--gold-fill)' : 'transparent',
            color: on ? 'var(--gold-ink)' : 'var(--muted)', transition: 'all .15s ease',
          }}>{o}</button>
        );
      })}
    </div>
  );
}
window.HistoryView = HistoryView;
