/**
 * 5★ 상세 모달 — 이력의 행을 누르면 열린다. 그 워프의 맥락(배너, 이론 평균 대비 천장,
 * 50/50 결과, 버전, 시각)을 보여준다.
 * @param {Object} props
 * @param {Object|null} props.five 선택된 5★. null 이면 닫힌 Dialog 를 렌더한다.
 * @param {function(): void} props.onClose 닫기 핸들러.
 * @returns {JSX.Element}
 */
function FiveDetail({ five, onClose }) {
  const { Dialog, PityPill, Tag, ProgressBar, Badge } = window.HSRWarpDesignSystem_4a0d44;
  const { resultMeta } = window.WarpUtil;
  const t = window.I18N.t, bl = window.I18N.bannerLabel;
  const f = five;
  if (!f) return <Dialog open={false} onClose={onClose} />;

  const meta = window.WARP_DATA.banners.find((b) => b.short === f.banner) || { cap: 90, expAvg: 62.5 };
  const r = f.result ? resultMeta(f.result) : null;
  const diff = meta.expAvg ? Math.round(meta.expAvg - f.pity) : null;
  const lucky = diff != null && diff > 0;

  return (
    <Dialog open={!!f} onClose={onClose} width={480}
      title={t('detail.title', { name: window.I18N.itemName(f.item_id, f.name) })}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        <Tag>{bl(f.banner)}{t('detail.warpSuffix')}</Tag>
        {r && <Badge variant={f.result === 'loss' ? 'red' : f.result === 'win' ? 'gold' : 'green'} solid={f.result === 'win'}>{r.label}</Badge>}
        {f.isPickup === false && <Badge variant="neutral">{t('detail.standardLoss')}</Badge>}
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
        <Stat k={t('detail.pity')}><PityPill value={f.pity} /> <span style={{ color: 'var(--muted)', fontWeight: 500 }}>{t('detail.capUnit', { cap: meta.cap })}</span></Stat>
        <Stat k={t('detail.version')}><span style={{ fontFamily: 'var(--font-mono)' }}>{f.version}</span></Stat>
        <Stat k={t('detail.time')}><span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>{f.time}</span></Stat>
      </div>

      <div style={{ marginBottom: 8, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--muted)', fontWeight: 600 }}>{t('detail.pityProgress')}</div>
      <ProgressBar value={f.pity} max={meta.cap} />

      <div style={{
        marginTop: 18, padding: '12px 14px', borderRadius: 'var(--r-md)',
        background: lucky ? 'var(--green-fill)' : diff != null ? 'var(--red-fill)' : 'var(--panel-2)',
        border: `1px solid ${lucky ? 'var(--green-line)' : diff != null ? 'var(--red-line)' : 'var(--line)'}`,
        fontSize: 13, color: 'var(--txt)', lineHeight: 1.6,
      }}>
        {diff != null ? (
          <>{t('detail.descBody', { pity: f.pity, avg: meta.expAvg })}
          <b style={{ color: lucky ? 'var(--green)' : 'var(--red)' }}>{lucky ? t('detail.descLess', { n: diff }) : t('detail.descMore', { n: -diff })}</b>
          {t('detail.descTail')}
          {r && f.result === 'loss' && t('detail.loss50')}
          {r && f.result === 'win' && t('detail.win50')}
          {r && f.result === 'guaranteed' && t('detail.guaranteed50')}</>
        ) : t('detail.standardOnly')}
      </div>
    </Dialog>
  );
}

/**
 * 상세 모달의 라벨+값 셀. 모듈 스코프에 둔다(매 렌더 remount 방지).
 * @param {Object} props
 * @param {string} props.k 라벨.
 * @param {React.ReactNode} props.children 값 영역.
 * @returns {JSX.Element}
 */
function Stat({ k, children }) {
  return (
    <div style={{ flex: 1, minWidth: 120 }}>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--muted)', fontWeight: 600, marginBottom: 6 }}>{k}</div>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{children}</div>
    </div>
  );
}
window.FiveDetail = FiveDetail;
