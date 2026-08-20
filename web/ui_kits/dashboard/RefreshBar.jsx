// Collapsed refresh control shown after data is loaded. A compact chip with
// last-updated time + ↻ refresh; clicking path expands the path input inline.
// Refresh runs the real incremental fetch (runFetch prop) and re-loads data.
// 조회가 오래 걸릴 수 있으므로 최초 조회와 같은 FetchProgress 로 진행 상황을 보인다 —
// 버튼 라벨만 바뀌면 사용자에게는 멈춘 것처럼 보인다.
function RefreshBar({ runFetch, onLoaded, lastUpdated }) {
  const { Input, Button } = window.HSRWarpDesignSystem_4a0d44;
  const t = window.I18N.t;
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [prog, setProg] = React.useState(null);
  const [path, setPath] = React.useState('');
  const [err, setErr] = React.useState('');

  React.useEffect(() => { window.WarpData.configPath().then((p) => { if (p) setPath(p); }); }, []);

  async function run() {
    if (busy) return;
    const p = (path || '').trim();
    if (!p) { setErr(t('refresh.needPath')); setOpen(true); return; }
    setBusy(true); setErr(''); setProg({});
    try {
      const data = await runFetch(p, (banner, added) => setProg((cur) => ({ ...(cur || {}), [banner]: added })));
      setBusy(false); setOpen(false); setProg(null);
      if (onLoaded) onLoaded(data);
    } catch (e) {
      setBusy(false); setOpen(true); setProg(null);
      setErr(e.message || t('refresh.fetchFailed'));
    }
  }

  return (
    // relative 는 진행 팝오버의 기준점이다. 칩 자체 크기·모양은 조회 중에도 그대로 둔다 —
    // 헤더 안이라 조금만 커져도 본문 전체가 아래로 밀린다.
    <div style={{
      position: 'relative',
      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      background: 'var(--card-bg)', border: '1px solid var(--card-border)',
      borderRadius: 'var(--r-pill)', padding: '7px 8px 7px 16px', boxShadow: 'var(--shadow-card)',
    }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: err ? 'var(--red)' : 'var(--green)', boxShadow: `0 0 8px ${err ? 'var(--red)' : 'var(--green)'}`, flex: 'none' }} />
      <span style={{ fontSize: 12.5, color: err ? 'var(--red)' : 'var(--muted)' }}>
        {err ? err : <>{t('refresh.lastUpdated')} <b style={{ color: 'var(--txt)', fontFamily: 'var(--font-mono)' }}>{lastUpdated || '-'}</b></>}
      </span>
      {open && (
        <Input value={path} onChange={(e) => setPath(e.target.value)}
          placeholder={t('refresh.pathPlaceholder')} style={{ flex: 1, minWidth: 200, padding: '7px 11px' }} />
      )}
      <div style={{ marginLeft: open ? 0 : 'auto', display: 'flex', gap: 8 }}>
        <Button variant="ghost" size="sm" onClick={() => setOpen((o) => !o)}>{open ? t('refresh.closePath') : t('refresh.path')}</Button>
        <Button size="sm" onClick={run} disabled={busy}>{busy ? t('refresh.running') : t('refresh.refresh')}</Button>
      </div>
      <FetchProgress prog={prog} busy={busy} popover />
    </div>
  );
}
window.RefreshBar = RefreshBar;
