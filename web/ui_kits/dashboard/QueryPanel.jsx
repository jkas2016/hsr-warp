/**
 * 첫 실행 조회 카드 — 게임 경로 입력 + 조회 버튼.
 * Dashboard가 소유하는 게임별 조회 상태로 배너별 누적 건수를 표시한다.
 * @param {Object} props
 * @param {function(string): Promise<void>} props.runFetch 증분 조회 실행 함수.
 * @param {Object} props.fetchState 게임별로 유지되는 조회 진행 상태.
 * @returns {JSX.Element}
 */
function QueryPanel({ runFetch, fetchState = {} }) {
  const { Input, Button, Card } = window.HSRWarpDesignSystem_4a0d44;
  const t = window.I18N.t;
  const [path, setPath] = React.useState('');
  const [pathErr, setErr] = React.useState('');
  const { busy = false, prog = null, startedAt } = fetchState;
  const err = pathErr || fetchState.err || '';

  // 경로 자동 채움: 저장된 config 우선, 없으면 자동 탐지.
  React.useEffect(() => { window.WarpData.configPath().then((p) => { if (p) setPath(p); }); }, []);

  /**
   * 입력된 경로로 조회를 실행한다. 이미 실행 중이면 무시하고, 경로가 비면 에러만 띄운다.
   * @returns {Promise<void>}
   */
  async function run() {
    if (busy) return;
    const p = (path || '').trim();
    if (!p) { setErr(t('query.needPath')); return; }
    setErr('');
    await runFetch(p);
  }

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
      <FetchProgress prog={prog} busy={busy} startedAt={startedAt} />
    </Card>
  );
}
window.QueryPanel = QueryPanel;
