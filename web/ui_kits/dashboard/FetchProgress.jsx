/**
 * 조회 진행 표시 — 최초 조회(QueryPanel)와 새로고침(RefreshBar)이 공유한다.
 * 증분 조회는 남은 페이지 수를 미리 알 수 없어 퍼센트가 나오지 않는다. 그래서
 * 정직하게 (a) 배너별 누적 신규 건수, (b) 무한 진행 애니메이션, (c) 경과 시간
 * 세 가지로 "살아 있음"을 보인다 — 오래 걸릴 때 멈춘 것처럼 보이던 문제(#1)의 해법.
 * @param {Object} props
 * @param {Object<string, number>|null} props.prog 서버 progress 키 → 누적 건수. null 이면 아무것도 렌더하지 않는다.
 * @param {boolean} props.busy 조회 중 여부(진행 애니메이션·경과 시간 표시를 결정).
 * @param {boolean} [props.popover] 헤더의 새로고침 칩에 매달아 띄우는 모드. 켜면 흐름에서
 *   빠져(absolute) 칩 아래에 겹쳐 뜬다 — 문서 흐름에 끼면 헤더가 늘어나며 본문 전체를
 *   아래로 밀어내기 때문이다. 부모가 position:relative 여야 한다.
 * @returns {JSX.Element|null}
 */
function FetchProgress({ prog, busy, popover }) {
  const t = window.I18N.t, bl = window.I18N.bannerLabel;
  const [elapsed, setElapsed] = React.useState(0);

  // 경과 시간은 busy 가 켜질 때 0 부터 다시 센다. 타이머는 busy 동안만 돈다.
  React.useEffect(() => {
    if (!busy) return undefined;
    setElapsed(0);
    const started = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(id);
  }, [busy]);

  if (!prog) return null;

  // 서버 progress 키는 배너 short 가 아니라 역할 이름이라(게임 공통) 역할로 되돌려 붙인다.
  const addedByRole = {};
  for (const k of Object.keys(prog)) {
    const role = window.WarpData.roleOfProgress(k);
    if (role) addedByRole[role] = prog[k];
  }
  // 초보자 채널은 신규가 잡힐 때만 표시(대부분 계정에서 늘 0이라 자리만 차지한다).
  const shown = window.WarpData.banners().filter((b) => b.role !== 'beginner' || addedByRole.beginner !== undefined);
  if (shown.length === 0) return null;

  // 팝오버는 칩 아래 오른쪽 정렬로 겹쳐 띄우고, 인라인은 카드 흐름에 그대로 놓는다.
  const style = popover
    ? {
      position: 'absolute', top: 'calc(100% + 9px)', right: 0, zIndex: 30,
      display: 'grid', gap: 8, minWidth: 300, padding: '13px 15px',
      background: 'var(--card-bg)', border: '1px solid var(--card-border)',
      borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-pop)',
    }
    : { marginTop: 14, display: 'grid', gap: 9, width: '100%' };

  return (
    <div style={style}>
      {shown.map((b) => {
        const added = addedByRole[b.role] || 0;
        return (
          <div key={b.code} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 52, fontSize: 12.5, color: 'var(--muted)' }}>{bl(b.short)}</span>
            <div style={{ flex: 1, height: 7, borderRadius: 'var(--r-pill)', background: 'var(--panel-2)', overflow: 'hidden' }}>
              <div className={busy ? 'indet' : ''} style={{ height: '100%', borderRadius: 'var(--r-pill)', background: 'var(--grad-gold)', width: busy ? '42%' : '100%' }} />
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: busy ? 'var(--gold-ink)' : 'var(--green)', width: 54, textAlign: 'right' }}>
              {busy ? `+${added}…` : `+${added} ✓`}
            </span>
          </div>
        );
      })}
      {busy && (
        <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>
          {t('progress.elapsed')} {elapsed}s
        </div>
      )}
    </div>
  );
}
window.FetchProgress = FetchProgress;
