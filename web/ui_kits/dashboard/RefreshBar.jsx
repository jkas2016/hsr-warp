// Collapsed refresh control shown after data is loaded. A compact chip with
// last-updated time + ↻ 새로고침; clicking 경로 expands the path input inline.
// 새로고침 runs the real incremental fetch (runFetch prop) and re-loads data.
function RefreshBar({ runFetch, onLoaded, lastUpdated }) {
  const { Input, Button } = window.HSRWarpDesignSystem_4a0d44;
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [path, setPath] = React.useState('');
  const [err, setErr] = React.useState('');

  React.useEffect(() => { window.WarpData.configPath().then((p) => { if (p) setPath(p); }); }, []);

  async function run() {
    if (busy) return;
    const p = (path || '').trim();
    if (!p) { setErr('경로 필요'); setOpen(true); return; }
    setBusy(true); setErr('');
    try {
      const data = await runFetch(p, () => {});
      setBusy(false); setOpen(false);
      if (onLoaded) onLoaded(data);
    } catch (e) {
      setBusy(false); setOpen(true);
      setErr(e.message || '조회 실패');
    }
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      background: 'var(--card-bg)', border: '1px solid var(--card-border)',
      borderRadius: 'var(--r-pill)', padding: '7px 8px 7px 16px', boxShadow: 'var(--shadow-card)',
    }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: err ? 'var(--red)' : 'var(--green)', boxShadow: `0 0 8px ${err ? 'var(--red)' : 'var(--green)'}`, flex: 'none' }} />
      <span style={{ fontSize: 12.5, color: err ? 'var(--red)' : 'var(--muted)' }}>
        {err ? err : <>마지막 갱신 <b style={{ color: 'var(--txt)', fontFamily: 'var(--font-mono)' }}>{lastUpdated || '-'}</b></>}
      </span>
      {open && (
        <Input value={path} onChange={(e) => setPath(e.target.value)}
          placeholder="게임 경로" style={{ flex: 1, minWidth: 200, padding: '7px 11px' }} />
      )}
      <div style={{ marginLeft: open ? 0 : 'auto', display: 'flex', gap: 8 }}>
        <Button variant="ghost" size="sm" onClick={() => setOpen((o) => !o)}>{open ? '경로 닫기' : '경로'}</Button>
        <Button size="sm" onClick={run} disabled={busy}>{busy ? '갱신 중…' : '↻ 새로고침'}</Button>
      </div>
    </div>
  );
}
window.RefreshBar = RefreshBar;
