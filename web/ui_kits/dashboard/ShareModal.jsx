// 공유 모달 — 현재 탭에 실재하는 섹션을 체크해 PNG 한 장으로 내보낸다.
// 합성·캡처·저장은 전부 브라우저 로컬(window.WarpShare)에서 처리하고 서버로 올라가는 것은 없다.
function ShareModal({ open, onClose, uid, lang }) {
  const { Dialog, Button } = window.HSRWarpDesignSystem_4a0d44;
  const S = window.WarpShare;
  const t = window.I18N.t;

  const [present, setPresent] = React.useState([]);
  const [checked, setChecked] = React.useState([]);
  const [mask, setMask] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');
  const [preview, setPreview] = React.useState('');

  const labelOf = React.useMemo(() => {
    const m = {};
    // lang 이 바뀌면 라벨을 다시 만든다.
    for (const s of S.SECTIONS) m[s.id] = t(s.labelKey);
    return m;
  }, [lang]);

  // 모달을 열 때마다 현재 탭의 섹션을 다시 읽는다. 기본은 전체 선택.
  React.useEffect(() => {
    if (!open) return;
    const ids = S.presentSections();
    setPresent(ids);
    setChecked(ids);
    setErr('');
    setPreview('');
  }, [open]);

  // 미리보기 objectURL 은 모달이 닫히거나 새 이미지가 생기면 해제한다.
  React.useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function toggle(id) {
    setChecked((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  }

  async function run() {
    const ids = S.selectSections(present, checked);
    if (!ids.length || busy) return;
    setBusy(true); setErr(''); setPreview('');
    try {
      const blob = await S.exportPng({ ids, uid, mask });
      const ok = S.saveBlob(blob, S.shareFileName(new Date()));
      // 다운로드가 막힌 환경(iOS Safari 등)이면 모달 안에 이미지를 띄우고 길게 눌러 저장하게 한다.
      if (!ok) setPreview(URL.createObjectURL(blob));
    } catch (e) {
      // 사용자에게는 번역된 문구만 — e.message 를 그대로 쓰면 CDN 차단·SRI 불일치 때
      // "Cannot read properties of undefined (reading 'domToBlob')" 같은 영문 기술 문자열이 노출되고,
      // 거의 모든 Error 가 message 를 가지므로 t('share.failed') 는 영영 렌더되지 않는다.
      // 원인은 개발자 콘솔에만 남긴다.
      console.error('[share] PNG 내보내기 실패', e);
      setErr(t('share.failed'));
    }
    setBusy(false);
  }

  const picked = S.selectSections(present, checked);

  return (
    <Dialog open={!!open} onClose={onClose} title={t('share.title')} width={420}>
      <div className="lbl" style={{ marginBottom: 8 }}>{t('share.sections')}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {present.map((id) => (
          <label key={id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 2px', cursor: 'pointer', fontSize: 13.5 }}>
            <input type="checkbox" checked={checked.includes(id)} onChange={() => toggle(id)} />
            {labelOf[id] || id}
          </label>
        ))}
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)', cursor: 'pointer', fontSize: 13.5 }}>
        <input type="checkbox" checked={mask} onChange={(e) => setMask(e.target.checked)} />
        {t('share.maskUid')}
      </label>

      {err && <div style={{ marginTop: 12, color: 'var(--red)', fontSize: 12.5 }}>{err}</div>}

      {preview && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 8 }}>{t('share.saveHint')}</div>
          <img src={preview} alt="" style={{ width: '100%', borderRadius: 'var(--r-md)', border: '1px solid var(--line)' }} />
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
        <Button onClick={run} disabled={busy || !picked.length}>
          {busy ? t('share.exporting') : t('share.export')}
        </Button>
      </div>
    </Dialog>
  );
}
window.ShareModal = ShareModal;
