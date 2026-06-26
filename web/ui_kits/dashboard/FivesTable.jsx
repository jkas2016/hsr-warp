// 5★ acquisition history table. Rows are passed in (filtered by the parent).
// Clicking a row calls onRowClick(f) — used to open the detail modal.
// pageSize: 주면 그 개수만 보이고 '더보기'로 늘린다(미지정 시 전체 표시 — 예: 최근 5★).
// 부모가 필터를 바꾸면 key 로 리마운트해 페이지를 초기화한다(아래 HistoryView/BannersView).
function FivesTable({ rows, onRowClick, pageSize }) {
  const { Tag, PityPill, Card, Button } = window.HSRWarpDesignSystem_4a0d44;
  const { RESULT } = window.WarpUtil;
  const [shown, setShown] = React.useState(pageSize || 0);
  const view = pageSize ? rows.slice(0, shown) : rows;
  const rest = rows.length - view.length;

  return (
    <Card padding={6}>
      <table className="tbl">
        <thead><tr><th>이름</th><th>배너</th><th>천장</th><th>결과</th><th>버전</th><th>획득 시각</th></tr></thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={6} style={{ color: 'var(--muted)', textAlign: 'center', padding: '22px 0' }}>해당 조건의 5★ 기록이 없습니다.</td></tr>
          )}
          {view.map((f, i) => {
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
      {pageSize && rest > 0 && (
        <div style={{ padding: '12px 12px 4px' }}>
          <Button variant="ghost" size="sm" onClick={() => setShown((s) => s + pageSize)}>더보기 ({rest}개 남음)</Button>
        </div>
      )}
    </Card>
  );
}
window.FivesTable = FivesTable;
