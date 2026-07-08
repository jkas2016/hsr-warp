// First-run query card — game-path input + gold 조회 button. Runs the real
// incremental fetch over SSE (window.WarpData.runFetch via the runFetch prop),
// showing per-banner live counts as progress events arrive, then onLoaded(data).
function QueryPanel({ runFetch, onLoaded }) {
  const { Input, Button, Card } = window.HSRWarpDesignSystem_4a0d44;
  const t = window.I18N.t, bl = window.I18N.bannerLabel;
  const [path, setPath] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [prog, setProg] = React.useState(null); // { banner_code: accumulated_new_count } | null
  const [err, setErr] = React.useState('');

  // 경로 자동 채움: 저장된 config 우선, 없으면 자동 탐지.
  React.useEffect(() => { window.WarpData.configPath().then((p) => { if (p) setPath(p); }); }, []);

  async function run() {
    if (busy) return;
    const p = (path || '').trim();
    if (!p) { setErr(t('query.needPath')); return; }
    setBusy(true); setErr(''); setProg({});
    try {
      const data = await runFetch(p, (banner, added) => setProg((cur) => ({ ...(cur || {}), [banner]: added })));
      setBusy(false);
      onLoaded(data);
    } catch (e) {
      setBusy(false);
      setErr(e.message || t('query.failed'));
    }
  }

  // 배너 short 는 분석 계층(analyze.js BANNERS) 단일 소스에서 — 서버 progress 키와 동일.
  // 표준 3배너는 항상, 출발은 신규가 잡힐 때만 표시.
  const B = window.WarpAnalyze.BANNERS;
  const order = ['11', '12', '1'].map((k) => B[k].short);
  const departure = B['2'].short;
  const shown = prog ? order.concat(prog[departure] !== undefined ? [departure] : []) : [];

  return (
    <Card padding={18} style={{ marginTop: 20 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <Input value={path} onChange={(e) => setPath(e.target.value)}
          placeholder={t('query.placeholder')} style={{ flex: 1, minWidth: 280 }} />
        <Button onClick={run} disabled={busy}>{busy ? t('query.running') : t('query.run')}</Button>
      </div>
      {!busy && !prog && !err && (
        <div style={{ color: 'var(--muted)', fontSize: 12.5, marginTop: 9 }}>
          {t('query.hint1a')}<b style={{ color: 'var(--txt)' }}>{t('query.recordScreen')}</b>{t('query.hint1b')}
          {' '}{t('query.hint2')}
        </div>
      )}
      {err && <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 10 }}>{err}</div>}
      {prog && shown.length > 0 && (
        <div style={{ marginTop: 14, display: 'grid', gap: 9 }}>
          {shown.map((k) => {
            const added = prog[k] || 0;
            return (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 52, fontSize: 12.5, color: 'var(--muted)' }}>{bl(k)}</span>
                <div style={{ flex: 1, height: 7, borderRadius: 'var(--r-pill)', background: 'var(--panel-2)', overflow: 'hidden' }}>
                  <div className={busy ? 'indet' : ''} style={{ height: '100%', borderRadius: 'var(--r-pill)', background: 'var(--grad-gold)', width: busy ? '42%' : '100%' }} />
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: busy ? 'var(--gold-ink)' : 'var(--green)', width: 54, textAlign: 'right' }}>
                  {busy ? `+${added}…` : `+${added} ✓`}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
window.QueryPanel = QueryPanel;
