// Overview tab — hero bento, summary stats, banner cards, charts, recent 5★.
// Entrance is handled by the parent .view CSS animation (base state visible,
// so content never gets stuck hidden if a timer is throttled).
function OverviewView({ D, theme, onSeeAll, onFiveClick }) {
  const recent = D.fives.slice(0, 5);
  return (
    <div>
      <HeroSummary D={D} />
      <BannerCards D={D} />
      <ChartsGrid D={D} theme={theme} />
      <section style={{ marginTop: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 className="h2" style={{ margin: 0 }}>최근 5★</h2>
          <button className="linkbtn" onClick={onSeeAll}>전체 기록 보기 →</button>
        </div>
        <div style={{ marginTop: 14 }}>
          <FivesTable rows={recent} onRowClick={onFiveClick} />
        </div>
      </section>
    </div>
  );
}
window.OverviewView = OverviewView;
