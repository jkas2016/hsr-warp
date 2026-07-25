import { hydrateRoot } from 'react-dom/client';
import './ds/styles.css';
import './pages/guide.css';
import { App } from './App.jsx';
import { LANGS } from './i18n/index.js';

// 언어는 URL 경로 세그먼트가 단일 소스(/en/ 등, dev/prod 동일). 프리렌더 HTML과
// 같은 언어로 하이드레이션해 SSR/CSR 불일치를 없앤다. index.html 의 lang-redirect
// 스크립트가 하이드레이션 전에 ?lang= 을 경로 이동으로 소비하므로 여기서는 불필요.
function pageLang() {
  const codes = LANGS.map((l) => l.code);
  const seg = location.pathname.slice(import.meta.env.BASE_URL.length).split('/')[0];
  return codes.includes(seg) ? seg : 'ko';
}

hydrateRoot(document.getElementById('root'), <App lang={pageLang()} />);
