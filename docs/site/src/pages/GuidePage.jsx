import { LangSwitcher } from './LangSwitcher.jsx';

export function GuidePage({ dict, lang = 'ko' }) {
  const t = dict;
  const logo = import.meta.env.BASE_URL + 'logo-train.svg';
  const asset = (f) => import.meta.env.BASE_URL + f;

  // features 카드 아이콘(문구는 t.features에서, 아이콘은 구조라 여기 유지)
  const featIcons = [
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12M7 11l5 5 5-5"/><path d="M5 21h14"/></svg>,
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>,
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-3.4-7"/><path d="M21 5v4h-4"/></svg>,
  ];
  // 판정 기준 tagchip 클래스(문구는 t.metricsSec.criteria.items에서)
  const criteriaTags = ['win', 'unk', 'win'];
  // 문제 해결 카드 tagchip 클래스(문구는 t.troubleSec.cards에서)
  const troubleTags = ['loss', 'unk', 'unk', 'unk'];
  // 저장 파일 테이블 이름 셀(구조 유지, 설명만 t.filesSec.rows에서)
  const fileNames = ['data\\', 'config.json', 'logs\\'];

  return (
    <>
      {/* ============================ NAV ============================ */}
      <nav className="nav">
        <div className="wrap nav-in">
          <a className="brand" href="#top">
            <img src={logo} alt={t.nav.logoAlt} />
            {t.nav.brand}
          </a>
          <div className="nav-links">
            <a href="#start">{t.nav.start}</a>
            <a href="#metrics">{t.nav.metrics}</a>
            <a href="#files">{t.nav.files}</a>
            <a href="#trouble">{t.nav.trouble}</a>
            <a href="#faq">{t.nav.faq}</a>
          </div>
          <div className="nav-right">
            <a className="icon-btn" href="https://github.com/jkas2016/hsr-warp" target="_blank" rel="noopener" aria-label={t.nav.github}>
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49 0-.24-.01-.88-.01-1.73-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.36-2.22-.26-4.55-1.14-4.55-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.27 2.75 1.05A9.4 9.4 0 0 1 12 6.85c.85 0 1.71.12 2.51.34 1.91-1.32 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.81-4.57 5.06.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.81 0 .27.18.6.69.49A10.26 10.26 0 0 0 22 12.25C22 6.58 17.52 2 12 2Z"/></svg>
            </a>
            <LangSwitcher lang={lang} label={t.nav.lang} />
            <button className="icon-btn theme-toggle" aria-label={t.nav.theme}>
              <svg className="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8 6 18M18 6l1.8-1.8"/></svg>
              <svg className="moon" viewBox="0 0 24 24" fill="currentColor"><path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.6 6.6 0 0 0 9.8 9.8Z"/></svg>
            </button>
            <a className="btn btn-gold" href="https://github.com/jkas2016/hsr-warp/releases" target="_blank" rel="noopener">{t.nav.download}</a>
          </div>
        </div>
      </nav>

      {/* ============================ HERO ============================ */}
      <header className="hero" id="top">
        <div className="wrap hero-grid">
          <div>
            <div className="eyebrow">{t.hero.eyebrow}</div>
            <h1>{t.hero.title}</h1>
            <p className="lead">{t.hero.lead}</p>
            <div className="hero-cta">
              <a className="btn btn-gold" href="https://github.com/jkas2016/hsr-warp/releases" target="_blank" rel="noopener">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12M7 11l5 5 5-5M5 21h14"/></svg>
                {t.hero.ctaDownload}
              </a>
              <a className="btn btn-ghost" href="#start">{t.hero.ctaStart}</a>
            </div>
            <div className="hero-meta">
              {t.hero.chips.map((c, i) => <span className="chip" key={i}><span className="dot"></span> {c}</span>)}
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
                <b>{t.mock.heading}</b>
              </div>
              <div className="mock-stats">
                <div className="mstat"><div className="k">{t.mock.totalPulls}</div><div className="v">2,184<small>{t.mock.totalUnit}</small></div></div>
                <div className="mstat"><div className="k">{t.mock.fiveStar}</div><div className="v">41<small>{t.mock.fiveUnit}</small></div></div>
                <div className="mstat"><div className="k">{t.mock.winRate}</div><div className="v">62<small>{t.mock.winUnit}</small></div></div>
              </div>
              <div className="mluck">
                <div className="row">
                  <span className="k">{t.mock.luckLabel}</span>
                </div>
                <div className="v" style={{ marginTop: '4px' }}>58.2<small>{t.mock.luckUnit}</small></div>
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
            {t.features.map((f, i) => (
              <div className="glass feat reveal" key={i}>
                <div className="ic">{featIcons[i]}</div>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================ QUICK START ============================ */}
      <section className="section" id="start" style={{ paddingTop: '24px' }}>
        <div className="wrap">
          <div className="section-head reveal">
            <div className="eyebrow">{t.quick.eyebrow}</div>
            <h2>{t.quick.title}</h2>
            <p>{t.quick.lead}</p>
          </div>
          <div className="steps">
            <div className="glass step key reveal">
              <div className="step-n">1</div>
              <div>
                <h3>{t.quick.step1.title}</h3>
                <p>{t.quick.step1.body}</p>
                <div className="callout">
                  <span className="warn">⚠</span>
                  <span>{t.quick.step1.callout}</span>
                </div>
              </div>
            </div>

            <div className="glass step reveal">
              <div className="step-n">2</div>
              <div>
                <h3>{t.quick.step2.title}</h3>
                <p>{t.quick.step2.body}</p>
                <div className="callout">
                  <span className="warn">⚠</span>
                  <span>{t.quick.step2.callout}</span>
                </div>
                <div className="shots">
                  <figure className="shot">
                    <img src={asset('smartscreen1.png')} alt={t.quick.step2.shot1.alt} loading="lazy" />
                    <figcaption><span className="sn">1</span> {t.quick.step2.shot1.caption}</figcaption>
                  </figure>
                  <figure className="shot">
                    <img src={asset('smartscreen2.png')} alt={t.quick.step2.shot2.alt} loading="lazy" />
                    <figcaption><span className="sn">2</span> {t.quick.step2.shot2.caption}</figcaption>
                  </figure>
                </div>
              </div>
            </div>

            <div className="glass step reveal">
              <div className="step-n">3</div>
              <div>
                <h3>{t.quick.step3.title}</h3>
                <p>{t.quick.step3.body}</p>
              </div>
            </div>

            <div className="glass step reveal">
              <div className="step-n">4</div>
              <div>
                <h3>{t.quick.step4.title}</h3>
                <p>{t.quick.step4.body}</p>
                <figure className="shot shot-wide">
                  <img src={asset('windowterminal.png')} alt={t.quick.step4.shot.alt} loading="lazy" />
                  <figcaption>{t.quick.step4.shot.caption}</figcaption>
                </figure>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================ METRICS ============================ */}
      <section className="section" id="metrics" style={{ paddingTop: '24px' }}>
        <div className="wrap">
          <div className="section-head reveal">
            <div className="eyebrow">{t.metricsSec.eyebrow}</div>
            <h2>{t.metricsSec.title}</h2>
            <p>{t.metricsSec.lead}</p>
          </div>
          <div className="metric-grid">
            <div className="glass metric reveal" style={{ '--accent-bar': 'var(--grad-luck)' }}>
              <h3><span className="dot" style={{ background: 'var(--green)' }}></span>{t.metricsSec.luck.title}</h3>
              <div className="big gold">{t.metricsSec.luck.big}<small style={{ fontSize: '14px', color: 'var(--muted)', fontWeight: '500' }}>{t.metricsSec.luck.bigUnit}</small></div>
              <p>{t.metricsSec.luck.body}</p>
            </div>
            <div className="glass metric reveal" style={{ '--accent-bar': 'linear-gradient(90deg,var(--purple),var(--blue))' }}>
              <h3><span className="dot" style={{ background: 'var(--purple)' }}></span>{t.metricsSec.avg.title}</h3>
              <p>{t.metricsSec.avg.body}</p>
            </div>
            <div className="glass metric reveal" style={{ '--accent-bar': 'var(--grad-gold)' }}>
              <h3><span className="dot" style={{ background: 'var(--gold)' }}></span>{t.metricsSec.win.title}</h3>
              <p>{t.metricsSec.win.body}</p>
            </div>
            <div className="glass metric reveal" style={{ '--accent-bar': 'linear-gradient(90deg,var(--blue),var(--green))' }}>
              <h3><span className="dot" style={{ background: 'var(--blue)' }}></span>{t.metricsSec.monthly.title}</h3>
              <p>{t.metricsSec.monthly.body}</p>
            </div>
          </div>

          <div className="glass criteria reveal">
            <h3>{t.metricsSec.criteria.title}</h3>
            <ul>
              {t.metricsSec.criteria.items.map((it, i) => (
                <li key={i}><span className={`tagchip ${criteriaTags[i]}`}>{it.tag}</span><span>{it.body}</span></li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ============================ SAVED FILES ============================ */}
      <section className="section" id="files" style={{ paddingTop: '24px' }}>
        <div className="wrap">
          <div className="section-head reveal">
            <div className="eyebrow">{t.filesSec.eyebrow}</div>
            <h2>{t.filesSec.title}</h2>
            <p>{t.filesSec.lead}</p>
          </div>
          <div className="glass reveal" style={{ overflow: 'hidden' }}>
            <table className="tbl">
              <thead><tr><th>{t.filesSec.thName}</th><th>{t.filesSec.thDesc}</th></tr></thead>
              <tbody>
                {t.filesSec.rows.map((desc, i) => (
                  <tr key={i}><td>{fileNames[i]}</td><td className="k">{desc}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="note reveal"><span className="gold" style={{ fontWeight: '800' }}>↳</span> {t.filesSec.note}</div>
        </div>
      </section>

      {/* ============================ TROUBLESHOOT ============================ */}
      <section className="section" id="trouble" style={{ paddingTop: '24px' }}>
        <div className="wrap">
          <div className="section-head reveal">
            <div className="eyebrow">{t.troubleSec.eyebrow}</div>
            <h2>{t.troubleSec.title}</h2>
            <p>{t.troubleSec.lead}</p>
          </div>
          <div className="trouble">
            {t.troubleSec.cards.map((c, i) => (
              <div className="glass reveal" key={i}>
                <h3><span className={`tagchip ${troubleTags[i]}`}>{c.tag}</span></h3>
                <p>{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================ FAQ ============================ */}
      <section className="section" id="faq" style={{ paddingTop: '24px' }}>
        <div className="wrap">
          <div className="section-head reveal">
            <div className="eyebrow">{t.faqSec.eyebrow}</div>
            <h2>{t.faqSec.title}</h2>
          </div>
          <div className="faq">
            {t.faqSec.items.map((f, i) => (
              <details className="glass reveal" open={i === 0} key={i}>
                <summary>{f.q} <span className="pm">+</span></summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ============================ CTA ============================ */}
      <section className="cta">
        <div className="wrap">
          <div className="glass cta-card reveal">
            <h2>{t.cta.title}</h2>
            <p>{t.cta.lead}</p>
            <div className="hero-cta">
              <a className="btn btn-gold" href="https://github.com/jkas2016/hsr-warp/releases" target="_blank" rel="noopener">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12M7 11l5 5 5-5M5 21h14"/></svg>
                {t.hero.ctaDownload}
              </a>
              <a className="btn btn-ghost" href="https://github.com/jkas2016/hsr-warp" target="_blank" rel="noopener">{t.cta.github}</a>
            </div>
          </div>
        </div>
      </section>

      {/* ============================ FOOTER ============================ */}
      <footer className="foot">
        <div className="wrap">
          <div className="foot-grid">
            <div>
              <div className="brand"><img src={logo} alt="" style={{ width: '30px', height: '30px', borderRadius: '8px' }} /> {t.footer.brand}</div>
              <p className="disc">{t.footer.disc}</p>
            </div>
            <div className="links">
              <a href="https://github.com/jkas2016/hsr-warp" target="_blank" rel="noopener">{t.footer.repo}</a>
              <a href="https://github.com/jkas2016/hsr-warp/releases" target="_blank" rel="noopener">{t.footer.releases}</a>
              <a href="https://uigf.org/en/standards/srgf.html" target="_blank" rel="noopener">{t.footer.srgf}</a>
              <a href="https://www.prydwen.gg/star-rail/guides/gacha-system/" target="_blank" rel="noopener">{t.footer.gacha}</a>
              <a href="architecture.html">{t.footer.arch}</a>
            </div>
          </div>
          <div className="foot-bottom">
            <span>{t.footer.license}</span>
            <span className="mono">{t.footer.mono}</span>
          </div>
        </div>
      </footer>
    </>
  );
}
