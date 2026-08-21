/**
 * 데이터 로드 후 보이는 접힌 새로고침 컨트롤. 마지막 갱신 시각 + 새로고침 버튼의 작은 칩이며,
 * 경로 버튼을 누르면 경로 입력이 인라인으로 펼쳐진다. 새로고침은 실제 증분 조회를 돌린다.
 * 조회가 오래 걸릴 수 있으므로 최초 조회와 같은 FetchProgress 로 진행 상황을 보인다 —
 * 버튼 라벨만 바뀌면 사용자에게는 멈춘 것처럼 보인다.
 * @param {Object} props
 * @param {function(string, function(string, number): void): Promise<Object>} props.runFetch 증분 조회 실행 함수.
 * @param {function(Object): void} [props.onLoaded] 조회 성공 시 받은 데이터 콜백.
 * @param {string} [props.lastUpdated] 마지막 갱신 시각 표시 문자열.
 * @param {function(): void} props.onShare 공유 버튼을 눌렀을 때 공유 모달을 여는 콜백.
 * @returns {JSX.Element}
 */
function RefreshBar({ runFetch, onLoaded, lastUpdated, onShare }) {
  const { Input, Button } = window.HSRWarpDesignSystem_4a0d44;
  const t = window.I18N.t;
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [prog, setProg] = React.useState(null);
  const [path, setPath] = React.useState('');
  const [err, setErr] = React.useState('');

  React.useEffect(() => { window.WarpData.configPath().then((p) => { if (p) setPath(p); }); }, []);

  /**
   * 새로고침 조회를 실행한다. 경로가 비어 있으면 경로 입력을 펼치고 에러를 띄운다.
   * @returns {Promise<void>}
   */
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
        <Button variant="ghost" size="sm" onClick={onShare}>{t('share.button')}</Button>
        <Button variant="ghost" size="sm" onClick={() => setOpen((o) => !o)}>{open ? t('refresh.closePath') : t('refresh.path')}</Button>
        <Button size="sm" onClick={run} disabled={busy}>{busy ? t('refresh.running') : t('refresh.refresh')}</Button>
      </div>
      <FetchProgress prog={prog} busy={busy} popover />
    </div>
  );
}
window.RefreshBar = RefreshBar;
