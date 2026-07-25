import { hydrateRoot } from 'react-dom/client';
import './ds/styles.css';
import './pages/guide.css';
import { App } from './App.jsx';
import { LANGS } from './i18n/index.js';

// 언어는 URL 경로 세그먼트가 단일 소스(/en/ 등). 프리렌더 HTML과 같은 언어로
// 하이드레이션해 SSR/CSR 불일치를 없앤다. dev 서버에는 언어 경로가 없으므로 ?lang= 허용.
function pageLang() {
  const codes = LANGS.map((l) => l.code);
  const seg = location.pathname.slice(import.meta.env.BASE_URL.length).split('/')[0];
  if (codes.includes(seg)) return seg;
  if (import.meta.env.DEV) {
    const q = new URLSearchParams(location.search).get('lang');
    if (q && codes.includes(q)) return q;
  }
  return 'ko';
}

hydrateRoot(document.getElementById('root'), <App lang={pageLang()} />);
