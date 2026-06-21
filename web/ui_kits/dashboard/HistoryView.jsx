// History tab — full 5★ list with banner + result filter chips. Rows click
// through to the detail modal (item 6).
function HistoryView({ D, onFiveClick }) {
  const [banner, setBanner] = React.useState('전체');
  const [result, setResult] = React.useState('전체');

  const banners = ['전체', '캐릭터', '광추', '일반'];
  const results = [['전체', null], ['픽승', 'win'], ['픽뚫', 'loss'], ['확정', 'guaranteed']];

  const rows = D.fives.filter((f) =>
    (banner === '전체' || f.banner === banner) &&
    (result === '전체' || f.result === results.find((r) => r[0] === result)[1]));

  return (
    <div>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: 16 }}>
        <ChipGroup label="배너" options={banners} value={banner} onChange={setBanner} />
        <ChipGroup label="결과" options={results.map((r) => r[0])} value={result} onChange={setResult} />
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 12 }}>
        총 <b style={{ color: 'var(--txt)' }}>{rows.length}</b>개 · 행을 클릭하면 상세가 열립니다.
      </div>
      <FivesTable key={banner + '|' + result} rows={rows} onRowClick={onFiveClick} pageSize={20} />
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
