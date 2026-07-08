// 5★ acquisition history table. Rows are passed in (filtered by the parent).
// Clicking a row calls onRowClick(f) — used to open the detail modal.
// pageSize: 주면 그 개수만 보이고 '더보기'로 늘린다(미지정 시 전체 표시 — 예: 최근 5★).
// 부모가 필터를 바꾸면 key 로 리마운트해 페이지를 초기화한다(아래 HistoryView/BannersView).
function FivesTable({ rows, onRowClick, pageSize }) {
  const t = window.I18N.t;
  const bl = window.I18N.bannerLabel;
  const { Tag, PityPill, Card, Button } = window.HSRWarpDesignSystem_4a0d44;
  const [shown, setShown] = React.useState(pageSize || 0);
  const view = pageSize ? rows.slice(0, shown) : rows;
  const rest = rows.length - view.length;

  return (
    <Card padding={6}>
      <table className="tbl">
        <thead><tr><th>{t('table.name')}</th><th>{t('table.banner')}</th><th>{t('table.pity')}</th><th>{t('table.result')}</th><th>{t('table.version')}</th><th>{t('table.time')}</th></tr></thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={6} style={{ color: 'var(--muted)', textAlign: 'center', padding: '22px 0' }}>{t('table.empty5')}</td></tr>
          )}
          {view.map((f) => {
            const r = f.result ? window.WarpUtil.resultMeta(f.result) : null;
            // 안정적 per-row key: 고유 record id(BigInt 문자열). 부재 시 item_id+time 복합 — 인덱스 금지(재정렬/재필터 시 stale 렌더·오클릭 방지).
            const rowKey = f.id != null ? String(f.id) : f.item_id + '|' + f.time;
            return (
              <tr key={rowKey} onClick={() => onRowClick && onRowClick(f)}
                style={{ cursor: onRowClick ? 'pointer' : 'default' }}>
                <td style={{ fontWeight: 600, color: f.isPickup === false ? 'var(--muted)' : 'var(--gold-ink)' }}>{window.I18N.itemName(f.item_id, f.name)}</td>
                <td><Tag>{bl(f.banner)}</Tag></td>
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
          <Button variant="ghost" size="sm" onClick={() => setShown((s) => s + pageSize)}>{t('table.more', { n: rest })}</Button>
        </div>
      )}
    </Card>
  );
}
window.FivesTable = FivesTable;
