import { renderToString } from 'react-dom/server';
import { App } from './App.jsx';

// 빌드타임 렌더. prerender.mjs 가 결과를 클라이언트 템플릿에 주입한다.
export function render() {
  return renderToString(<App />);
}
