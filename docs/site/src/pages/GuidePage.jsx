export function GuidePage() {
  const logo = import.meta.env.BASE_URL + 'logo-train.svg';
  return (
    <>
      {/* ============================ NAV ============================ */}
      <nav className="nav">
        <div className="wrap nav-in">
          <a className="brand" href="#top">
            <img src={logo} alt="HSR 워프 로고" />
            HSR 워프
          </a>
          <div className="nav-links">
            <a href="#start">빠른 시작</a>
            <a href="#metrics">지표</a>
            <a href="#files">저장 파일</a>
            <a href="#trouble">문제 해결</a>
            <a href="#faq">FAQ</a>
          </div>
          <div className="nav-right">
            <a className="icon-btn" href="https://github.com/jkas2016/hsr-warp" target="_blank" rel="noopener" aria-label="GitHub 저장소">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49 0-.24-.01-.88-.01-1.73-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.36-2.22-.26-4.55-1.14-4.55-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.27 2.75 1.05A9.4 9.4 0 0 1 12 6.85c.85 0 1.71.12 2.51.34 1.91-1.32 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.81-4.57 5.06.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.81 0 .27.18.6.69.49A10.26 10.26 0 0 0 22 12.25C22 6.58 17.52 2 12 2Z"/></svg>
            </a>
            <button className="icon-btn theme-toggle" aria-label="테마 전환">
              <svg className="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8 6 18M18 6l1.8-1.8"/></svg>
              <svg className="moon" viewBox="0 0 24 24" fill="currentColor"><path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.6 6.6 0 0 0 9.8 9.8Z"/></svg>
            </button>
            <a className="btn btn-gold" href="https://github.com/jkas2016/hsr-warp/releases" target="_blank" rel="noopener">다운로드</a>
          </div>
        </div>
      </nav>

      {/* ============================ HERO ============================ */}
      <header className="hero" id="top">
        <div className="wrap hero-grid">
          <div>
            <div className="eyebrow">Honkai: Star Rail · 워프 기록 분석</div>
            <h1>내 전언 기록을,<br /><span className="accent">내 PC에서.</span></h1>
            <p className="lead">붕괴: 스타레일의 전언(워프) 기록을 가져와 <b style={{ color: 'var(--txt)' }}>천장 · 운 · 픽뚫(50/50) · 월별 통계</b>를 한눈에 보여주는 작은 프로그램입니다. 설치하고 실행하면 브라우저에 대시보드가 자동으로 열립니다.</p>
            <div className="hero-cta">
              <a className="btn btn-gold" href="https://github.com/jkas2016/hsr-warp/releases" target="_blank" rel="noopener">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12M7 11l5 5 5-5M5 21h14"/></svg>
                최신 버전 다운로드
              </a>
              <a className="btn btn-ghost" href="#start">빠른 시작 보기</a>
            </div>
            <div className="hero-meta">
              <span className="chip"><span className="dot"></span> 간편 설치 (마법사)</span>
              <span className="chip"><span className="dot"></span> 완전 로컬 · 로그인 없음</span>
              <span className="chip"><span className="dot"></span> MIT 오픈소스</span>
            </div>
          </div>

          {/* app-window mockup */}
          <div className="glass mock" aria-hidden="true">
            <div className="mock-bar">
              <span className="tl"><i style={{ background: '#ff6b6b' }}></i><i style={{ background: '#ff9e45' }}></i><i style={{ background: '#52d39a' }}></i></span>
              <span className="url">127.0.0.1:8787/ui_kits/dashboard/</span>
            </div>
            <div className="mock-body">
              <div className="mock-h">
                <img src={logo} alt="" />
                <b>Honkai: Star Rail <span className="g">워프 대시보드</span></b>
              </div>
              <div className="mock-stats">
                <div className="mstat"><div className="k">총 뽑기</div><div className="v">2,184<small> 회</small></div></div>
                <div className="mstat"><div className="k">5★</div><div className="v">41<small> 개</small></div></div>
                <div className="mstat"><div className="k">픽승률</div><div className="v">62<small> %</small></div></div>
              </div>
              <div className="mluck">
                <div className="row">
                  <span className="k">운 지표 · 캐릭터 평균 천장</span>
                </div>
                <div className="v" style={{ marginTop: '4px' }}>58.2<small> 회</small></div>
                <div className="mbar"><span className="mid"></span><span className="mk"></span></div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ============================ FEATURES ============================ */}
      <section className="section" style={{ paddingTop: '40px' }}>
        <div className="wrap">
          <div className="feat-grid">
            <div className="glass feat reveal">
              <div className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12M7 11l5 5 5-5"/><path d="M5 21h14"/></svg></div>
              <h3>간편 설치</h3>
              <p>설치 마법사 하나로 끝납니다(관리자 권한 불필요). 시작 메뉴·바탕화면 바로가기가 생기고, 새 버전이 나오면 실행할 때 알려줍니다.</p>
            </div>
            <div className="glass feat reveal">
              <div className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg></div>
              <h3>완전 로컬</h3>
              <p>모든 처리는 내 PC에서만 일어나고 기록이 외부로 전송되지 않습니다. 계정 로그인도 필요 없습니다.</p>
            </div>
            <div className="glass feat reveal">
              <div className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-3.4-7"/><path d="M21 5v4h-4"/></svg></div>
              <h3>안전하게 누적</h3>
              <p>다시 조회해도 과거 기록은 그대로 보존되고 새 기록만 더해집니다. 표준 SRGF v1.0 형식으로 저장돼요.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ============================ QUICK START ============================ */}
      <section className="section" id="start" style={{ paddingTop: '24px' }}>
        <div className="wrap">
          <div className="section-head reveal">
            <div className="eyebrow">Quick Start</div>
            <h2>네 단계면 충분합니다</h2>
            <p>게임에서 기록 화면을 한 번 열고, 설치·실행하고, 조회하면 끝. 가장 중요한 건 첫 단계입니다.</p>
          </div>
          <div className="steps">
            <div className="glass step key reveal">
              <div className="step-n">1</div>
              <div>
                <h3>게임에서 전언 기록을 엽니다 <span className="badge warn">가장 중요</span></h3>
                <p>게임을 <b>실행만 하는 것으로는 안 됩니다.</b> 게임 안에서 직접 <b>[전언] → [기록]</b> 화면을 열어 <b>뽑기 목록이 화면에 보이게</b> 해야 합니다. 이때 게임이 인증 정보(authkey)를 PC 캐시에 기록하고, 이 프로그램은 그걸 읽어 조회합니다.</p>
                <div className="callout">
                  <span className="warn">⚠</span>
                  <span>이 인증 정보는 시간이 지나면 만료됩니다. <b>조회 직전에</b> 전언 기록 화면을 한 번 열어두세요.</span>
                </div>
              </div>
            </div>

            <div className="glass step reveal">
              <div className="step-n">2</div>
              <div>
                <h3>설치하고 실행합니다</h3>
                <p><a href="https://github.com/jkas2016/hsr-warp/releases/latest" target="_blank" rel="noopener">Releases</a>에서 <code>hsr-warp-setup-X.X.X.exe</code> 를 받아 실행하면 설치 마법사가 뜹니다(관리자 권한 불필요, 내 계정 폴더에 설치). 설치가 끝나면 시작 메뉴나 바탕화면 바로가기로 실행하세요. 검은 콘솔 창이 뜨고 기본 브라우저에 대시보드가 자동으로 열립니다 (예: <code>http://127.0.0.1:8787/ui_kits/dashboard/</code>).</p>
                <div className="callout">
                  <span className="warn">⚠</span>
                  <span>서명되지 않은 프로그램이라 <b>설치·실행 시 Windows가 경고</b>할 수 있습니다. 직접 받은 파일이 맞다면 <b>추가 정보 → 실행</b>을 누르면 됩니다.</span>
                </div>
              </div>
            </div>

            <div className="glass step reveal">
              <div className="step-n">3</div>
              <div>
                <h3>조회합니다</h3>
                <p><b>게임 경로</b>는 자동으로 채워집니다(이전 사용 경로 → 없으면 자동 탐지). 비어 있거나 틀리면 게임 폴더 <code>…\Star Rail Games</code> 를 직접 입력하세요. <b>조회</b> 버튼을 누르면 새 기록만 실시간으로 가져오고 차트가 갱신됩니다. 기존에 저장된 기록은 조회 없이도 바로 표시됩니다.</p>
              </div>
            </div>

            <div className="glass step reveal">
              <div className="step-n">4</div>
              <div>
                <h3>종료</h3>
                <p>콘솔 창을 닫거나 콘솔에서 <span className="kbd">Ctrl + C</span> 를 누릅니다.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================ METRICS ============================ */}
      <section className="section" id="metrics" style={{ paddingTop: '24px' }}>
        <div className="wrap">
          <div className="section-head reveal">
            <div className="eyebrow">Metrics</div>
            <h2>대시보드에서 보는 지표</h2>
            <p>모든 수치는 표준 공식 확률을 기준으로 계산됩니다. 낮은 천장일수록 행운이에요.</p>
          </div>
          <div className="metric-grid">
            <div className="glass metric reveal" style={{ '--accent-bar': 'var(--grad-luck)' }}>
              <h3><span className="dot" style={{ background: 'var(--green)' }}></span>운 지표</h3>
              <div className="big gold">62.5<small style={{ fontSize: '14px', color: 'var(--muted)', fontWeight: '500' }}> 회 기준</small></div>
              <p>5★ 평균 천장을 이론 평균 <b style={{ color: 'var(--txt)' }}>62.5회</b>(종합 확률 1.6%)와 비교합니다. 이 값보다 낮을수록 운이 좋다는 뜻이에요.</p>
            </div>
            <div className="glass metric reveal" style={{ '--accent-bar': 'linear-gradient(90deg,var(--purple),var(--blue))' }}>
              <h3><span className="dot" style={{ background: 'var(--purple)' }}></span>평균 천장</h3>
              <p>캐릭터 5★를 뽑기까지 평균 몇 회가 걸렸는지, 그리고 가장 운 좋았던/나빴던 천장까지 함께 보여줍니다.</p>
            </div>
            <div className="glass metric reveal" style={{ '--accent-bar': 'var(--grad-gold)' }}>
              <h3><span className="dot" style={{ background: 'var(--gold)' }}></span>픽승률 (50/50)</h3>
              <p>한정 배너에서 50/50 승부 중 <b style={{ color: 'var(--txt)' }}>픽업을 뽑은 비율</b>입니다. 픽뚫 후의 확정 획득은 별도로 집계됩니다.</p>
            </div>
            <div className="glass metric reveal" style={{ '--accent-bar': 'linear-gradient(90deg,var(--blue),var(--green))' }}>
              <h3><span className="dot" style={{ background: 'var(--blue)' }}></span>월별 집계</h3>
              <p>월별 뽑기 수 · 소비 성옥 · 획득 5★를 한눈에. 어느 패치에 가장 많이 썼는지 추세가 보입니다.</p>
            </div>
          </div>

          <div className="glass criteria reveal">
            <h3>판정 기준</h3>
            <ul>
              <li><span className="tagchip win">픽승 / 픽뚫</span><span>5★ 획득 <b>시점의 배너 픽업(rate-up)</b> 대상이면 <b>픽승</b>, 아니면 <b>픽뚫</b>으로 봅니다. 시점 기반이라 상시풀 편입·리런·콜라보·Celestial Invitation을 정확히 처리합니다(픽업 일정은 <code>web/schedule.json</code>).</span></li>
              <li><span className="tagchip unk">미확인</span><span>픽업 일정에 아직 없는 시점(주로 갓 나온 신규 패치)의 5★는 <b>미확인</b>으로 표시됩니다 — 일정을 갱신하면 자동으로 해소됩니다.</span></li>
              <li><span className="tagchip win">공식 확률</span><span>캐릭터 0.6%(종합 1.6%) · 하드천장 <b>90</b> / 광추 0.8% · 하드천장 <b>80</b>.</span></li>
            </ul>
          </div>
        </div>
      </section>

      {/* ============================ SAVED FILES ============================ */}
      <section className="section" id="files" style={{ paddingTop: '24px' }}>
        <div className="wrap">
          <div className="section-head reveal">
            <div className="eyebrow">Storage</div>
            <h2>저장되는 파일</h2>
            <p>설치 폴더 <code>%LOCALAPPDATA%\HSR Warp</code> 에 자동으로 만들어집니다. 모두 평범한 파일이라 직접 열어볼 수 있어요.</p>
          </div>
          <div className="glass reveal" style={{ overflow: 'hidden' }}>
            <table className="tbl">
              <thead><tr><th>폴더 / 파일</th><th>내용</th></tr></thead>
              <tbody>
                <tr><td>data\</td><td className="k">워프 기록(월별 <code>warp_YYYYMM.json</code>). 표준 SRGF v1.0 형식이라 다른 도구로도 가져갈 수 있습니다.</td></tr>
                <tr><td>config.json</td><td className="k">마지막에 쓴 게임 경로</td></tr>
                <tr><td>logs\</td><td className="k">실행 기록(날짜별 <code>hsr-warp-YYYY-MM-DD.log</code>). 문제가 생겼을 때 원인 확인에 씁니다.</td></tr>
              </tbody>
            </table>
          </div>
          <div className="note reveal"><span className="gold" style={{ fontWeight: '800' }}>↳</span> 다른 PC로 옮기거나 백업하려면 <code>data\</code> 폴더를 통째로 복사하면 됩니다.</div>
        </div>
      </section>

      {/* ============================ TROUBLESHOOT ============================ */}
      <section className="section" id="trouble" style={{ paddingTop: '24px' }}>
        <div className="wrap">
          <div className="section-head reveal">
            <div className="eyebrow">Troubleshooting</div>
            <h2>문제 해결</h2>
            <p>대부분은 인증 정보(authkey) 문제예요. 막히면 거의 항상 1번 단계를 다시 하면 풀립니다.</p>
          </div>
          <div className="trouble">
            <div className="glass reveal">
              <h3><span className="tagchip loss">authkey 만료</span></h3>
              <p>게임을 켜는 것만으로는 갱신되지 않습니다. 게임 안에서 <b>[전언] → [기록]</b> 화면을 다시 직접 연 뒤(목록이 보이게) 조회하세요. 메시지에 표시된 <b>발급 시각</b>이 오래됐다면 화면을 안 연 것입니다.</p>
            </div>
            <div className="glass reveal">
              <h3><span className="tagchip unk">조회가 너무 잦습니다 (서버 호출 제한)</span></h3>
              <p>짧은 간격으로 여러 번 조회하면 서버가 잠시 막습니다. <b>1~2분 기다렸다가</b> 다시 조회하세요.</p>
            </div>
            <div className="glass reveal">
              <h3><span className="tagchip unk">게임 경로를 못 찾음 / webCaches 없음</span></h3>
              <p>경로 입력란에 게임 설치 폴더 <code>…\Star Rail Games</code> 를 직접 입력하세요.</p>
            </div>
            <div className="glass reveal">
              <h3><span className="tagchip unk">그 밖의 오류</span></h3>
              <p><code>logs\</code> 폴더의 최신 로그 파일을 열어보면 어느 단계에서 멈췄는지 알 수 있습니다. 더 자세한 기록이 필요하면 <code>HSRWARP_LOG=debug</code> 를 설정하고 실행하세요(에러엔 스택트레이스가 함께 남습니다).</p>
            </div>
          </div>
        </div>
      </section>

      {/* ============================ FAQ ============================ */}
      <section className="section" id="faq" style={{ paddingTop: '24px' }}>
        <div className="wrap">
          <div className="section-head reveal">
            <div className="eyebrow">FAQ</div>
            <h2>자주 묻는 것</h2>
          </div>
          <div className="faq">
            <details className="glass reveal" open>
              <summary>계정이 위험하지 않나요? <span className="pm">+</span></summary>
              <p>이 프로그램은 게임이 PC에 남긴 조회용 인증 정보를 읽어 <b>읽기 전용</b> 비공식 기록 API만 호출합니다. 비밀번호나 계정 정보는 다루지 않고, 게임에 어떤 변경도 하지 않습니다.</p>
            </details>
            <details className="glass reveal">
              <summary>데이터가 어디로 전송되나요? <span className="pm">+</span></summary>
              <p>어디로도 보내지 않습니다. 호요버스 조회 서버와 내 PC 사이의 통신만 있고, 결과는 내 PC에만 저장됩니다.</p>
            </details>
            <details className="glass reveal">
              <summary>여러 계정을 쓸 수 있나요? <span className="pm">+</span></summary>
              <p>현재는 마지막으로 조회한 계정 기준으로 저장됩니다.</p>
            </details>
            <details className="glass reveal">
              <summary>새 패치·새 버전은 자동으로 반영되나요? <span className="pm">+</span></summary>
              <p>두 가지가 자동으로 갱신됩니다. <b>픽업 일정 데이터</b>는 앱을 켤 때 최신본(<code>schedule.json</code>)을 자동으로 받아 반영해, 갓 나온 신규 패치 5★의 "미확인" 표시가 릴리스 없이 해소됩니다. <b>앱 자체</b>는 새 버전이 나오면 실행할 때 알려주며, 설치 마법사로 갱신합니다.</p>
            </details>
            <details className="glass reveal">
              <summary>소스로 직접 빌드할 수 있나요? <span className="pm">+</span></summary>
              <p><code>node</code> 만 있으면 됩니다 — <code>go</code> 는 빌드 스크립트가 자동으로 찾습니다. <code>npm run build</code> 로 정적 단일 exe를 빌드하고 <code>npm start</code> 로 실행합니다. 자세한 내용은 저장소의 README를 참고하세요.</p>
            </details>
          </div>
        </div>
      </section>

      {/* ============================ CTA ============================ */}
      <section className="cta">
        <div className="wrap">
          <div className="glass cta-card reveal">
            <h2>지금 내 운을 확인해 보세요</h2>
            <p>설치 마법사 하나로 시작합니다. 로그인도, 데이터 전송도 없습니다.</p>
            <div className="hero-cta">
              <a className="btn btn-gold" href="https://github.com/jkas2016/hsr-warp/releases" target="_blank" rel="noopener">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12M7 11l5 5 5-5M5 21h14"/></svg>
                최신 버전 다운로드
              </a>
              <a className="btn btn-ghost" href="https://github.com/jkas2016/hsr-warp" target="_blank" rel="noopener">GitHub에서 보기</a>
            </div>
          </div>
        </div>
      </section>

      {/* ============================ FOOTER ============================ */}
      <footer className="foot">
        <div className="wrap">
          <div className="foot-grid">
            <div>
              <div className="brand"><img src={logo} alt="" style={{ width: '30px', height: '30px', borderRadius: '8px' }} /> HSR 워프 대시보드</div>
              <p className="disc">붕괴: 스타레일 전언 기록을 로컬에서 분석하는 비공식 오픈소스 도구입니다. <b style={{ color: 'var(--txt)' }}>HoYoverse와 무관</b>하며, 게임 내 어떤 데이터도 변경하지 않습니다. 데이터 형식은 SRGF v1.0.</p>
            </div>
            <div className="links">
              <div className="col-h">링크</div>
              <a href="https://github.com/jkas2016/hsr-warp" target="_blank" rel="noopener">GitHub 저장소</a>
              <a href="https://github.com/jkas2016/hsr-warp/releases" target="_blank" rel="noopener">다운로드 (Releases)</a>
              <a href="https://uigf.org/en/standards/srgf.html" target="_blank" rel="noopener">SRGF 형식 표준</a>
              <a href="https://www.prydwen.gg/star-rail/guides/gacha-system/" target="_blank" rel="noopener">확률 · 50/50 가이드</a>
              <a href="architecture.html">아키텍처 문서</a>
            </div>
          </div>
          <div className="foot-bottom">
            <span>MIT License · © 2026 hsr-warp</span>
            <span className="mono">SRGF v1.0 · 캐릭터 90 / 광추 80 하드천장</span>
          </div>
        </div>
      </footer>
    </>
  );
}
