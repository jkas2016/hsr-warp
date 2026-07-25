import { LANGS } from '../i18n/index.js';

// 지구본 드롭다운. details/summary 라 JS 없이도 동작하고, 항목은 실제 링크(언어 경로)다.
// 클릭 시 저장된 언어를 갱신해 루트(/) 재방문 시 자동 이동에 반영한다.
export function LangSwitcher({ lang, label }) {
  const base = import.meta.env.BASE_URL;
  const save = (code) => { try { localStorage.setItem('hsrwarp-lang', code); } catch (e) {} };
  return (
    <details className="lang-menu">
      <summary className="icon-btn" aria-label={label}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3a15.3 15.3 0 0 1 0 18M12 3a15.3 15.3 0 0 0 0 18" />
        </svg>
      </summary>
      <ul>
        {LANGS.map((l) => (
          <li key={l.code}>
            <a href={base + l.path} lang={l.html} aria-current={l.code === lang ? 'true' : undefined} onClick={() => save(l.code)}>
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}
