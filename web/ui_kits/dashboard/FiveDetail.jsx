// 5★ detail modal — opens when a history row is clicked. Shows the warp's
// context: banner, pity vs theoretical average, 50/50 outcome, version, time.
function FiveDetail({ five, onClose }) {
  const { Dialog, PityPill, Tag, ProgressBar, Badge } = window.HSRWarpDesignSystem_4a0d44;
  const { RESULT } = window.WarpUtil;
  const f = five;
  if (!f) return <Dialog open={false} onClose={onClose} />;

  const meta = window.WARP_DATA.banners.find((b) => b.short === f.banner) || { cap: 90, expAvg: 62.5 };
  const r = f.result ? RESULT[f.result] : null;
  const diff = meta.expAvg ? Math.round(meta.expAvg - f.pity) : null;
  const lucky = diff != null && diff > 0;

  const Stat = ({ k, children }) => (
    <div style={{ flex: 1, minWidth: 120 }}>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--muted)', fontWeight: 600, marginBottom: 6 }}>{k}</div>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{children}</div>
    </div>
  );

  return (
    <Dialog open={!!f} onClose={onClose} width={480}
      title={<span><span style={{ color: f.isPickup === false ? 'var(--muted)' : 'var(--gold-ink)' }}>{f.name}</span> · 5★ 상세</span>}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        <Tag>{f.banner} 워프</Tag>
        {r && <Badge variant={f.result === 'loss' ? 'red' : f.result === 'win' ? 'gold' : 'green'} solid={f.result === 'win'}>{r.label}</Badge>}
        {f.isPickup === false && <Badge variant="neutral">상시 / 픽뚫</Badge>}
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
        <Stat k="천장"><PityPill value={f.pity} /> <span style={{ color: 'var(--muted)', fontWeight: 500 }}>/ {meta.cap}회</span></Stat>
        <Stat k="버전"><span style={{ fontFamily: 'var(--font-mono)' }}>{f.version}</span></Stat>
        <Stat k="획득 시각"><span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>{f.time}</span></Stat>
      </div>

      <div style={{ marginBottom: 8, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--muted)', fontWeight: 600 }}>천장 진행</div>
      <ProgressBar value={f.pity} max={meta.cap} />

      <div style={{
        marginTop: 18, padding: '12px 14px', borderRadius: 'var(--r-md)',
        background: lucky ? 'var(--green-fill)' : diff != null ? 'var(--red-fill)' : 'var(--panel-2)',
        border: `1px solid ${lucky ? 'var(--green-line)' : diff != null ? 'var(--red-line)' : 'var(--line)'}`,
        fontSize: 13, color: 'var(--txt)', lineHeight: 1.6,
      }}>
        {diff != null ? (
          <>이 5★는 <b>{f.pity}회</b>에 떴습니다 — 이 배너의 이론 평균 <b>{meta.expAvg}회</b> 대비{' '}
          <b style={{ color: lucky ? 'var(--green)' : 'var(--red)' }}>{lucky ? `${diff}회 적게` : `${-diff}회 많이`}</b> 썼습니다.
          {r && f.result === 'loss' && ' 50/50에서 픽업이 아닌 5★가 나와 다음 한정은 확정입니다.'}
          {r && f.result === 'win' && ' 50/50 승부에서 픽업을 뽑았습니다.'}
          {r && f.result === 'guaranteed' && ' 직전 픽뚫로 인한 확정 획득입니다.'}</>
        ) : '상시(스텔라) 워프 획득으로 50/50 판정 대상이 아닙니다.'}
      </div>
    </Dialog>
  );
}
window.FiveDetail = FiveDetail;
