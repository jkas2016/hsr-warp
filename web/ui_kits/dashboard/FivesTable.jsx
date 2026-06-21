// 5★ acquisition history table. Rows are passed in (filtered by the parent).
// Clicking a row calls onRowClick(f) — used to open the detail modal.
function FivesTable({ rows, onRowClick }) {
  const { Tag, PityPill, Card } = window.HSRWarpDesignSystem_4a0d44;
  const { RESULT } = window.WarpUtil;

  return (
    <Card padding={6}>
      <table className="tbl">
        <thead><tr><th>이름</th><th>배너</th><th>천장</th><th>결과</th><th>버전</th><th>획득 시각</th></tr></thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={6} style={{ color: 'var(--muted)', textAlign: 'center', padding: '22px 0' }}>해당 조건의 5★ 기록이 없습니다.</td></tr>
          )}
          {rows.map((f, i) => {
            const r = f.result ? RESULT[f.result] : null;
            return (
              <tr key={i} onClick={() => onRowClick && onRowClick(f)}
                style={{ cursor: onRowClick ? 'pointer' : 'default' }}>
                <td style={{ fontWeight: 600, color: f.isPickup === false ? 'var(--muted)' : 'var(--gold-ink)' }}>{f.name}</td>
                <td><Tag>{f.banner}</Tag></td>
                <td><PityPill value={f.pity} /></td>
                <td>{r
                  ? <span style={{ fontWeight: 700, fontSize: 12, color: r.color }}>{r.label}</span>
                  : <span style={{ color: 'var(--muted)' }}>-</span>}</td>
                <td style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>{f.version}</td>
                <td style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>{f.time}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
window.FivesTable = FivesTable;
