/**
 * Overview 탭 — hero bento, 요약 통계, 배너 카드, 차트, 최근 5★.
 * 등장 애니메이션은 부모의 .view CSS 가 담당한다(기본 상태가 보임이라
 * 타이머가 스로틀돼도 콘텐츠가 숨은 채로 멈추지 않는다).
 * @param {Object} props
 * @param {Object} props.D WARP_DATA(전체 또는 버전 스코프).
 * @param {string} props.theme 현재 테마(차트 색상에 전달).
 * @param {string} props.lang 현재 언어(재렌더 트리거 겸 차트 로케일).
 * @param {boolean} props.scoped 버전 스코프 상태인지(현재 천장 표시 여부가 갈린다).
 * @param {function(): void} props.onSeeAll '전체 보기' 클릭 핸들러.
 * @param {function(Object): void} props.onFiveClick 5★ 행 클릭 핸들러(상세 모달).
 * @returns {JSX.Element}
 */
function OverviewView({ D, theme, lang, scoped, onSeeAll, onFiveClick }) {
  const t = window.I18N.t;
  const recent = D.fives.slice(0, 5);
  return (
    <div>
      <HeroSummary D={D} scoped={scoped} />
      <BannerCards D={D} scoped={scoped} />
      <ChartsGrid D={D} theme={theme} lang={lang} />
      <MonthlyTable D={D} />
      <section data-share="recent" style={{ marginTop: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 className="h2" style={{ margin: 0 }}>{t('overview.recent5')}</h2>
          <button className="linkbtn" data-share-omit onClick={onSeeAll}>{t('overview.seeAll')}</button>
        </div>
        <div style={{ marginTop: 14 }}>
          <FivesTable rows={recent} onRowClick={onFiveClick} />
        </div>
      </section>
    </div>
  );
}
window.OverviewView = OverviewView;
