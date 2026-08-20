/**
 * History 탭 — 배너·결과 필터 칩이 붙은 전체 5★ 목록. 행을 누르면 상세 모달로 이어진다.
 * @param {Object} props
 * @param {{fives: Object[], banners: Object[]}} props.D WARP_DATA.
 * @param {function(Object): void} props.onFiveClick 5★ 행 클릭 핸들러.
 * @returns {JSX.Element}
 */
function HistoryView({ D, onFiveClick }) {
  const [banner, setBanner] = React.useState('전체');   // 정규 short or '전체'
  const [result, setResult] = React.useState('전체');   // 'win'|'loss'|'guaranteed'|'전체'
  const t = window.I18N.t, bl = window.I18N.bannerLabel;

  // 값=정규 short. 게임마다 배너가 다르므로 현재 데이터의 배너에서 유도한다
  // (상시·초보자는 집계 단계에서 이미 빠져 있어 여기 나타나지 않는다).
  const bannerCodes = ['전체'].concat(D.banners.map((b) => b.short));
  const bannerLabels = bannerCodes.map((c) => (c === '전체' ? t('scope.all') : bl(c)));
  const resultCodes = ['전체', 'win', 'loss', 'guaranteed'];           // 값=정규
  const resultLabels = resultCodes.map((c) => (c === '전체' ? t('scope.all') : t('result.' + c)));

  const rows = D.fives.filter((f) =>
    (banner === '전체' || f.banner === banner) &&
    (result === '전체' || f.result === result));

  return (
    <div>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: 16 }}>
        <ChipGroup label={t('history.filterBanner')} options={bannerLabels}
          value={bannerLabels[bannerCodes.indexOf(banner)]}
          onChange={(lbl) => setBanner(bannerCodes[bannerLabels.indexOf(lbl)])} />
        <ChipGroup label={t('history.filterResult')} options={resultLabels}
          value={resultLabels[resultCodes.indexOf(result)]}
          onChange={(lbl) => setResult(resultCodes[resultLabels.indexOf(lbl)])} />
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 12 }}>
        {t('history.summary', { n: rows.length })}
      </div>
      <FivesTable key={banner + '|' + result} rows={rows} onRowClick={onFiveClick} pageSize={20} />
    </div>
  );
}

/**
 * 라벨 + 단일 선택 칩 묶음. 값은 표시 라벨 문자열로 주고받는다(호출부가 정규 키로 되돌린다).
 * @param {Object} props
 * @param {string} props.label 칩 묶음 제목.
 * @param {string[]} props.options 표시할 라벨 목록.
 * @param {string} props.value 현재 선택된 라벨.
 * @param {function(string): void} props.onChange 선택 변경 핸들러.
 * @returns {JSX.Element}
 */
function ChipGroup({ label, options, value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--muted)', fontWeight: 600 }}>{label}</span>
      {options.map((o) => {
        const on = o === value;
        return (
          <button key={o} onClick={() => onChange(o)} style={{
            appearance: 'none', cursor: 'pointer', borderRadius: 'var(--r-pill)', padding: '6px 13px',
            fontFamily: 'var(--font-sans)', fontSize: 12.5, fontWeight: 600,
            border: `1px solid ${on ? 'var(--gold-line)' : 'var(--line)'}`,
            background: on ? 'var(--gold-fill)' : 'transparent',
            color: on ? 'var(--gold-ink)' : 'var(--muted)', transition: 'all .15s ease',
          }}>{o}</button>
        );
      })}
    </div>
  );
}
window.HistoryView = HistoryView;
