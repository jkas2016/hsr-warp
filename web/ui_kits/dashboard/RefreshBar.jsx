// Collapsed refresh control shown after data is loaded. A compact chip with
// last-updated time + ↻ refresh; clicking path expands the path input inline.
// Refresh runs the real incremental fetch (runFetch prop) and re-loads data.
function RefreshBar({ runFetch, onLoaded, lastUpdated, onShare }) {
  const { Input, Button } = window.HSRWarpDesignSystem_4a0d44;
  const t = window.I18N.t;
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [path, setPath] = React.useState('');
  const [err, setErr] = React.useState('');

  React.useEffect(() => { window.WarpData.configPath().then((p) => { if (p) setPath(p); }); }, []);

  async function run() {
    if (busy) return;
    const p = (path || '').trim();
    if (!p) { setErr(t('refresh.needPath')); setOpen(true); return; }
    setBusy(true); setErr('');
    try {
      const data = await runFetch(p, () => {});
      setBusy(false); setOpen(false);
      if (onLoaded) onLoaded(data);
    } catch (e) {
      setBusy(false); setOpen(true);
      setErr(e.message || t('refresh.fetchFailed'));
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
        {err ? err : <>{t('refresh.lastUpdated')} <b style={{ color: 'var(--txt)', fontFamily: 'var(--font-mono)' }}>{lastUpdated || '-'}</b></>}
      </span>
      {open && (
        <Input value={path} onChange={(e) => setPath(e.target.value)}
          placeholder={t('refresh.pathPlaceholder')} style={{ flex: 1, minWidth: 200, padding: '7px 11px' }} />
      )}
      <div style={{ marginLeft: open ? 0 : 'auto', display: 'flex', gap: 8 }}>
        <Button variant="ghost" size="sm" onClick={onShare}>{t('share.button')}</Button>
        <Button variant="ghost" size="sm" onClick={() => setOpen((o) => !o)}>{open ? t('refresh.closePath') : t('refresh.path')}</Button>
        <Button size="sm" onClick={run} disabled={busy}>{busy ? t('refresh.running') : t('refresh.refresh')}</Button>
      </div>
    </div>
  );
}
window.RefreshBar = RefreshBar;
