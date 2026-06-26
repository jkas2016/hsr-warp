// 월별 집계 표 — 월 / 뽑기 / 성옥 / 5★ / 획득 5★ 이름. 최신월 우선,
// '더보기'로 PAGE 개월씩 펼친다(구 대시보드의 월별 표 + 페이징 복원).
function MonthlyTable({ D }) {
  const { Card, Button } = window.HSRWarpDesignSystem_4a0d44;
  const { num } = window.WarpUtil;
  const PAGE = 12;
  const [shown, setShown] = React.useState(PAGE);

  const months = D.monthly.slice().reverse(); // 최신월 먼저
  const view = months.slice(0, shown);
  const rest = months.length - view.length;

  const pill = {
    display: 'inline-block', minWidth: 28, textAlign: 'center', fontWeight: 700, fontSize: 12,
    padding: '3px 8px', borderRadius: 'var(--r-pill)', background: 'var(--gold)', color: 'var(--on-accent)',
  };

  return (
    <section style={{ marginTop: 26 }}>
      <h2 className="h2">월별 집계</h2>
      <Card padding={6}>
        <table className="tbl">
          <thead><tr><th>월</th><th>뽑기</th><th>성옥</th><th>5★</th><th>획득 5★</th></tr></thead>
          <tbody>
            {view.length === 0 && (
              <tr><td colSpan={5} style={{ color: 'var(--muted)', textAlign: 'center', padding: '22px 0' }}>월별 기록이 없습니다.</td></tr>
            )}
            {view.map((m) => (
              <tr key={m.month}>
                <td><b style={{ fontFamily: 'var(--font-display)', fontVariantNumeric: 'tabular-nums' }}>{m.month}</b></td>
                <td style={{ fontVariantNumeric: 'tabular-nums' }}>{m.total}</td>
                <td style={{ color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{num(m.jade)}</td>
                <td>{m.c5 ? <span style={pill}>{m.c5}</span> : <span style={{ color: 'var(--muted)' }}>0</span>}</td>
                <td style={{ color: 'var(--muted)', fontSize: 12.5 }}>{(m.fives || []).map((f) => f.name).join(', ') || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rest > 0 && (
          <div style={{ padding: '12px 12px 4px' }}>
            <Button variant="ghost" size="sm" onClick={() => setShown((s) => s + PAGE)}>더보기 ({rest}개월 남음)</Button>
          </div>
        )}
      </Card>
    </section>
  );
}
window.MonthlyTable = MonthlyTable;
