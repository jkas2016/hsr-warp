/**
 * 최상위 앱. 헤더(로고 + RefreshBar + ThemeToggle), 탭 내비게이션, 크로스페이드되는 현재 뷰.
 * 실데이터(window.WarpData 로 로컬 서버에서 로드), 테마, 현재 뷰, 선택된 5★, 시작 시
 * 업데이트 확인을 모두 이 컴포넌트가 소유한다. window.WARP_DATA 는 현재 데이터셋을 미러링해
 * FiveDetail 이 배너별 메타를 조회할 수 있게 한다.
 * @returns {JSX.Element}
 */
function Dashboard() {
  const { ThemeToggle, Tabs, Select } = window.HSRWarpDesignSystem_4a0d44;
  const t = window.I18N.t;
  const [data, setData] = React.useState(null);       // 전체(account-wide) 어댑트 데이터
  const [scopeVer, setScopeVer] = React.useState('전체'); // 버전 구간 필터(전 화면 적용)
  const [view, setView] = React.useState('overview');
  const [five, setFive] = React.useState(null);
  const [share, setShare] = React.useState(false);
  const [updates, setUpdates] = React.useState(null);
  const [theme, setTheme] = React.useState(() => {
    try { return localStorage.getItem('hsrwarp-theme') || 'dark'; } catch (e) { return 'dark'; }
  });

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('hsrwarp-theme', theme); } catch (e) {}
  }, [theme]);

  const [lang, setLangState] = React.useState(() => window.I18N.lang);
  // 언어 변경은 핸들러에서 싱글턴을 먼저 동기화한 뒤 상태를 갱신한다 — 재렌더 시점엔
  // I18N.lang 이 이미 새 값이라 이 트리의 모든 t()가 새 언어로 평가된다(render-purity 유지).
  // 마운트 시엔 lang 초기값이 window.I18N.lang 과 동일하므로 별도 동기화 불필요.
  /** @param {string} l 새 언어 코드. @returns {void} */
  const changeLang = (l) => { window.I18N.setLang(l); setLangState(l); };
  React.useEffect(() => {
    document.documentElement.setAttribute('lang', lang);
    try { localStorage.setItem('hsrwarp-lang', lang); } catch (e) {}
    try {
      const u = new URL(window.location.href);
      u.searchParams.set('lang', lang);
      window.history.replaceState(null, '', u);
    } catch (e) {}
  }, [lang]);

  // FiveDetail reads window.WARP_DATA.banners for banner meta (cap/expAvg) —
  // 전체 데이터로 둔다(스코프와 무관하게 모든 배너 meta 조회 가능).
  React.useEffect(() => { window.WARP_DATA = data; }, [data]);
  // 데이터가 새로 로드/조회되면 버전 구간을 전체로 초기화.
  React.useEffect(() => { setScopeVer('전체'); }, [data]);

  // 현재 게임. WarpData 싱글턴이 localStorage 로 유지하고, 여기선 prop/렌더용 상태로만 둔다.
  const [gameID, setGameID] = React.useState(() => window.WarpData.game());
  /**
   * 저장된 기록을 다시 읽어 화면을 갱신한다.
   * 새 게임에 기록이 없을 수 있어 결과가 없으면 빈 화면(QueryPanel)으로 돌아간다.
   * 연속 전환 시 늦게 도착한 이전 게임의 응답이 화면을 덮지 않도록 도착 시점 게임을 확인한다.
   * @param {string} id 재로드를 요청한 시점의 게임 id.
   * @returns {void}
   */
  const reload = (id) => {
    setData(null);
    window.WarpData.loadStored().then((d) => { if (window.WarpData.game() === id) setData(d || null); });
  };
  /**
   * 게임을 전환한다. setGame 이 일정·분석 캐시를 비우므로 곧바로 다시 읽는다.
   * @param {string} id 새 게임 id.
   * @returns {void}
   */
  const changeGame = (id) => { window.WarpData.setGame(id); setGameID(id); reload(id); };

  // 게임 팔레트 전환(tokens/game.css). 첫 페인트 전엔 index.html 의 인라인 스크립트가
  // 같은 값을 심어 두므로 여기선 전환만 반영한다.
  React.useEffect(() => {
    document.documentElement.setAttribute('data-game', gameID);
  }, [gameID]);

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

  /**
   * QueryPanel/RefreshBar 공용: 실 조회. 데이터 세팅은 호출부(onLoaded)가 한다.
   * @param {string} path 게임 설치 경로.
   * @param {function(string, number): void} onProgress 배너별 진행 콜백.
   * @returns {Promise<Object>} 어댑트된 WARP_DATA(+summary).
   */
  function runFetch(path, onProgress) { return window.WarpData.runFetch(path, onProgress); }

  const tabs = loaded ? [
    { id: 'overview', label: t('tabs.overview') },
    { id: 'banners', label: t('tabs.banners') },
    { id: 'history', label: t('tabs.history'), badge: D.fives.length },
    { id: 'versions', label: t('tabs.versions') },
  ] : [];

  const ts = loaded && D.info && D.info.export_timestamp ? new Date(D.info.export_timestamp * 1000) : null;
  const LOCALE = { ko: 'ko-KR', en: 'en-US', zh: 'zh-CN', ja: 'ja-JP' };
  const lastUpdated = ts ? ts.toLocaleTimeString(LOCALE[lang] || 'ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }) : '';
  const uid = loaded && D.info && D.info.uid ? D.info.uid : null;

  return (
    <div className="page">
      <header data-share-header style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <img src={window.WarpData.logo(gameID)} alt="" width="46" height="46" style={{ borderRadius: 12, boxShadow: 'var(--glow-gold)' }} />
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: '-.4px' }}>
            {t('game.' + gameID)} <span style={{ color: 'var(--gold-ink)' }}>{t('header.title2')}</span>
          </h1>
          <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 3 }}>
            {loaded ? t('header.subtitleLoaded', { uid: uid ? 'UID ' + uid + ' · ' : '' })
                    : t('header.subtitleEmpty')}
          </div>
        </div>
        <div data-share-omit style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {/* 게임 전환. key 로 RefreshBar/QueryPanel 을 다시 마운트해 경로 자동 채움을 새 게임 기준으로 돌린다. */}
          <GameSwitcher game={gameID} onChange={changeGame} />
          {loaded && <RefreshBar key={gameID} runFetch={runFetch} onLoaded={setData} lastUpdated={lastUpdated} onShare={() => setShare(true)} />}
          <Select value={lang} onChange={(e) => changeLang(e.target.value)} aria-label="Language">
            <option value="ko">한국어</option>
            <option value="en">English</option>
            <option value="zh">中文</option>
            <option value="ja">日本語</option>
          </Select>
          <ThemeToggle value={theme} onChange={setTheme} />
        </div>
      </header>

      {updates && <UpdateBar updates={updates} onClose={() => setUpdates(null)} />}

      {!loaded ? (
        <>
          <QueryPanel key={gameID} runFetch={runFetch} onLoaded={setData} />
          <div className="empty">
            <div className="empty-glyph"><img src={window.WarpData.logo(gameID)} alt="" width="64" height="64" style={{ borderRadius: 16 }} /></div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 600, marginTop: 18 }}>{t('empty.noData')}</div>
            <div style={{ color: 'var(--muted)', fontSize: 13.5, marginTop: 6, maxWidth: 380, lineHeight: 1.6 }}>
              {(() => {
                const hint = t('empty.hint');
                const [h1, rest] = hint.split('{a}');
                const [h2, h3] = (rest || '').split('{b}');
                return <>{h1}<b style={{ color: 'var(--txt)' }}>{t('empty.recordScreen')}</b>{h2}<b style={{ color: 'var(--gold-ink)' }}>{t('empty.queryBtn')}</b>{h3}</>;
              })()}
            </div>
          </div>
        </>
      ) : (
        <>
          {D.unknown5 > 0 && (
            <div style={{ margin: '18px 0 0', padding: '10px 14px', borderRadius: 'var(--r-md)', background: 'var(--orange-fill)', color: 'var(--orange)', fontSize: 13, lineHeight: 1.6 }}>
              {t('warn.unknown5', { n: D.unknown5 })}
            </div>
          )}
          <div style={{ marginTop: 22, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <Tabs tabs={tabs} value={view} onChange={setView} />
            </div>
            {(data.versionOptions || []).length > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{t('scope.label')}</span>
                <Select value={scopeVer} onChange={(e) => setScopeVer(e.target.value)}>
                  <option value="전체">{t('scope.allPeriod')}</option>
                  {/* 대응된 모든 버전(최신 우선) — 뽑기 0 버전도 선택하면 0으로 표시된다. */}
                  {[...data.versionOptions].reverse().map((v) => <option key={v} value={v}>{v}</option>)}
                </Select>
              </span>
            )}
          </div>
          {/* key 에 게임을 섞어 전환 시 뷰 내부 필터 상태(배너 칩 등)를 초기화한다. */}
          <div key={view + gameID} className="view" style={{ marginTop: 22 }}>
            {view === 'overview' && <OverviewView D={D} theme={theme} lang={lang} scoped={scoped} onSeeAll={() => setView('history')} onFiveClick={setFive} />}
            {view === 'banners' && <BannersView D={D} theme={theme} scoped={scoped} onFiveClick={setFive} />}
            {view === 'history' && <HistoryView D={D} onFiveClick={setFive} />}
            {view === 'versions' && <VersionsView D={D} theme={theme} lang={lang} />}
          </div>
          <div className="foot">
            {t(gameID === 'zzz' ? 'foot.line1Zzz' : 'foot.line1Hsr')}<br />
            {t('foot.line2')}
          </div>
        </>
      )}

      <FiveDetail five={five} onClose={() => setFive(null)} />
      <ShareModal open={share} onClose={() => setShare(false)} uid={uid} lang={lang} />
    </div>
  );
}

/**
 * 게임 전환 세그먼티드 컨트롤 — 로고 + 짧은 게임명. 선택된 쪽만 카드 표면으로 떠오른다.
 * @param {Object} props
 * @param {string} props.game 현재 게임 id.
 * @param {function(string): void} props.onChange 게임 선택 핸들러.
 * @returns {JSX.Element}
 */
function GameSwitcher({ game, onChange }) {
  const t = window.I18N.t;
  return (
    <div role="group" aria-label="Game"
      style={{ display: 'inline-flex', gap: 4, padding: 4, borderRadius: 'var(--r-pill)', background: 'var(--panel-2)', border: '1px solid var(--line)' }}>
      {window.WarpData.games().map((id) => {
        const on = id === game;
        return (
          <button key={id} onClick={() => onChange(id)} aria-pressed={on} style={{
            appearance: 'none', border: 'none', cursor: 'pointer', borderRadius: 'var(--r-pill)',
            padding: '6px 14px 6px 8px', fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 600,
            display: 'inline-flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap',
            background: on ? 'var(--card-bg)' : 'transparent', boxShadow: on ? 'var(--shadow-card)' : 'none',
            color: on ? 'var(--txt)' : 'var(--muted)', transition: 'all .18s ease',
          }}>
            <img src={window.WarpData.logo(id)} alt="" width="20" height="20" style={{ borderRadius: 6, opacity: on ? 1 : .55 }} />
            {t('game.' + id + '.short')}
          </button>
        );
      })}
    </div>
  );
}

/**
 * 시작 시 업데이트 확인 결과 배너(코드 새 버전 / 배너 데이터 갱신).
 * 알릴 것이 없으면 아무것도 렌더하지 않는다.
 * @param {Object} props
 * @param {Object|null} props.updates /api/updates 응답.
 * @param {function(): void} props.onClose 닫기 핸들러.
 * @returns {JSX.Element|null}
 */
function UpdateBar({ updates, onClose }) {
  const t = window.I18N.t;
  const u = updates || {};
  const code = u.code && u.code.newer ? u.code : null;
  const sched = u.schedule && u.schedule.updated ? u.schedule : null;
  if (!code && !sched) return null;
  return (
    <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
      {code && (
        <div style={{ padding: '10px 14px', borderRadius: 'var(--r-md)', background: 'var(--purple-fill)', color: 'var(--txt)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>{t('update.newVersion', { v: 'v' + code.version })} <a href={code.url} target="_blank" rel="noopener" style={{ color: 'var(--gold-ink)', fontWeight: 700 }}>{t('update.download')}</a></span>
          <span onClick={onClose} style={{ marginLeft: 'auto', cursor: 'pointer', color: 'var(--muted)' }}>✕</span>
        </div>
      )}
      {sched && (
        <div style={{ padding: '8px 14px', borderRadius: 'var(--r-md)', background: 'var(--green-fill)', color: 'var(--green)', fontSize: 12.5 }}>
          {t('update.schedule', { v: 'v' + sched.version })}
        </div>
      )}
    </div>
  );
}
window.Dashboard = Dashboard;
