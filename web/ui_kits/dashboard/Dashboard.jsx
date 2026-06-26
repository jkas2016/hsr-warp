// Top-level app. Header (logo + RefreshBar + ThemeToggle), tab nav, and the
// active view with a cross-fade. Owns live data (loaded from the local server
// via window.WarpData), theme, current view, the selected 5★, and the
// start-up update check. window.WARP_DATA mirrors the current dataset so
// FiveDetail can look up per-banner meta.
function Dashboard() {
  const { ThemeToggle, Tabs, Select } = window.HSRWarpDesignSystem_4a0d44;
  const [data, setData] = React.useState(null);       // 전체(account-wide) 어댑트 데이터
  const [scopeVer, setScopeVer] = React.useState('전체'); // 버전 구간 필터(전 화면 적용)
  const [view, setView] = React.useState('overview');
  const [five, setFive] = React.useState(null);
  const [updates, setUpdates] = React.useState(null);
  const [theme, setTheme] = React.useState(() => {
    try { return localStorage.getItem('hsrwarp-theme') || 'dark'; } catch (e) { return 'dark'; }
  });

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('hsrwarp-theme', theme); } catch (e) {}
  }, [theme]);

  // FiveDetail reads window.WARP_DATA.banners for banner meta (cap/expAvg) —
  // 전체 데이터로 둔다(스코프와 무관하게 모든 배너 meta 조회 가능).
  React.useEffect(() => { window.WARP_DATA = data; }, [data]);
  // 데이터가 새로 로드/조회되면 버전 구간을 전체로 초기화.
  React.useEffect(() => { setScopeVer('전체'); }, [data]);

  // 시작 시: 저장된 기록 표시 + 업데이트 확인(베스트에포트).
  React.useEffect(() => {
    window.WarpData.loadStored().then((d) => { if (d) setData(d); });
    window.WarpData.checkUpdates().then((u) => {
      setUpdates(u);
      // 배너 데이터가 갱신됐으면 새 일정으로 다시 분석.
      if (u && u.schedule && u.schedule.updated) {
        window.WarpData.loadStored().then((d) => { if (d) setData(d); });
      }
    });
  }, []);

  const loaded = !!data;
  const scoped = loaded && scopeVer !== '전체';
  // 선택한 버전 구간으로 좁힌 데이터(전체면 그대로). 재조회 없이 filterAnalysis 재계산.
  const D = React.useMemo(
    () => (!data ? null : scopeVer === '전체' ? data : window.WarpData.scopeTo(scopeVer)),
    [data, scopeVer],
  );

  // QueryPanel/RefreshBar 공용: 실 조회. 데이터 세팅은 호출부(onLoaded)가 한다.
  function runFetch(path, onProgress) { return window.WarpData.runFetch(path, onProgress); }

  const tabs = loaded ? [
    { id: 'overview', label: '개요' },
    { id: 'banners', label: '배너별' },
    { id: 'history', label: '기록', badge: D.fives.length },
    { id: 'versions', label: '버전 비교' },
  ] : [];

  const ts = loaded && D.info && D.info.export_timestamp ? new Date(D.info.export_timestamp * 1000) : null;
  const lastUpdated = ts ? ts.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }) : '';
  const uid = loaded && D.info && D.info.uid ? D.info.uid : null;

  return (
    <div className="page">
      <header style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <img src="../../assets/logo-train.svg" alt="" width="46" height="46" style={{ borderRadius: 12, boxShadow: 'var(--glow-gold)' }} />
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: '-.4px' }}>
            Honkai: Star Rail <span style={{ color: 'var(--gold-ink)' }}>워프 대시보드</span>
          </h1>
          <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 3 }}>
            {loaded ? `${uid ? 'UID ' + uid + ' · ' : ''}모든 분석은 로컬에서만 처리됩니다.`
                    : '완전 로컬 · 매달 자동 갱신 · 기록은 외부로 전송되지 않습니다.'}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          {loaded && <RefreshBar runFetch={runFetch} onLoaded={setData} lastUpdated={lastUpdated} />}
          <ThemeToggle value={theme} onChange={setTheme} />
        </div>
      </header>

      {updates && <UpdateBar updates={updates} onClose={() => setUpdates(null)} />}

      {!loaded ? (
        <>
          <QueryPanel runFetch={runFetch} onLoaded={setData} />
          <div className="empty">
            <div className="empty-glyph"><img src="../../assets/logo-train.svg" alt="" width="64" height="64" style={{ borderRadius: 16 }} /></div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 600, marginTop: 18 }}>아직 불러온 기록이 없습니다</div>
            <div style={{ color: 'var(--muted)', fontSize: 13.5, marginTop: 6, maxWidth: 380, lineHeight: 1.6 }}>
              게임에서 <b style={{ color: 'var(--txt)' }}>전언 → 기록</b> 화면을 연 뒤 위의 <b style={{ color: 'var(--gold-ink)' }}>조회</b> 버튼을 누르면
              천장 · 운 · 픽뚫 통계가 여기에 나타납니다.
            </div>
          </div>
        </>
      ) : (
        <>
          {D.unknown5 > 0 && (
            <div style={{ margin: '18px 0 0', padding: '10px 14px', borderRadius: 'var(--r-md)', background: 'var(--orange-fill)', color: 'var(--orange)', fontSize: 13, lineHeight: 1.6 }}>
              ⚠ 미확인 5★ {D.unknown5}개 — 획득 시점이 픽업 일정에 없어요(신규 패치 미반영). 최신 배너는 시작 시 자동 반영됩니다(미반영 시 잠시 후 재실행).
            </div>
          )}
          <div style={{ marginTop: 22, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <Tabs tabs={tabs} value={view} onChange={setView} />
            </div>
            {data.versions.length > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>버전 구간</span>
                <Select value={scopeVer} onChange={(e) => setScopeVer(e.target.value)}>
                  <option value="전체">전체 기간</option>
                  {[...data.versions].reverse().map((v) => <option key={v.v} value={v.v}>{v.v}</option>)}
                </Select>
              </span>
            )}
          </div>
          <div key={view} className="view" style={{ marginTop: 22 }}>
            {view === 'overview' && <OverviewView D={D} theme={theme} scoped={scoped} onSeeAll={() => setView('history')} onFiveClick={setFive} />}
            {view === 'banners' && <BannersView D={D} theme={theme} scoped={scoped} onFiveClick={setFive} />}
            {view === 'history' && <HistoryView D={D} onFiveClick={setFive} />}
            {view === 'versions' && <VersionsView D={D} theme={theme} />}
          </div>
          <div className="foot">
            뽑기 1회 = 성옥 160 기준 · 비공식 도구이며 호요버스와 무관 · 데이터 형식 SRGF v1.0<br />
            50/50 판정: 5★ 획득 시점의 배너 픽업(rate-up) 대상이면 ‘픽승’, 아니면 ‘픽뚫’.
          </div>
        </>
      )}

      <FiveDetail five={five} onClose={() => setFive(null)} />
    </div>
  );
}

// 시작 시 업데이트 확인 결과 배너(코드 새 버전 / 배너 데이터 갱신).
function UpdateBar({ updates, onClose }) {
  const u = updates || {};
  const code = u.code && u.code.newer ? u.code : null;
  const sched = u.schedule && u.schedule.updated ? u.schedule : null;
  if (!code && !sched) return null;
  return (
    <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
      {code && (
        <div style={{ padding: '10px 14px', borderRadius: 'var(--r-md)', background: 'var(--purple-fill)', color: 'var(--txt)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>새 버전 <b>v{code.version}</b>가 나왔습니다 — <a href={code.url} target="_blank" rel="noopener" style={{ color: 'var(--gold-ink)', fontWeight: 700 }}>설치본 다운로드</a></span>
          <span onClick={onClose} style={{ marginLeft: 'auto', cursor: 'pointer', color: 'var(--muted)' }}>✕</span>
        </div>
      )}
      {sched && (
        <div style={{ padding: '8px 14px', borderRadius: 'var(--r-md)', background: 'var(--green-fill)', color: 'var(--green)', fontSize: 12.5 }}>
          배너 데이터 v{sched.version}로 갱신되었습니다.
        </div>
      )}
    </div>
  );
}
window.Dashboard = Dashboard;
