import { hydrateRoot } from 'react-dom/client';
import './ds/styles.css';
import './pages/guide.css';
import { App } from './App.jsx';

// 빌드 시 정적 HTML로 프리렌더된 마크업을 하이드레이트해 상호작용(테마 토글·리빌)을 살린다.
hydrateRoot(document.getElementById('root'), <App />);
