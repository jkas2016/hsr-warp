import { renderToString } from 'react-dom/server';
import { App } from './App.jsx';
import { LANGS, DICTS } from './i18n/index.js';

// prerender.mjs 가 서버 번들에서 LANGS/META 를 읽어 head 치환에 사용한다.
export { LANGS };
export const META = Object.fromEntries(LANGS.map((l) => [l.code, DICTS[l.code].meta]));

// 빌드타임 렌더. prerender.mjs 가 언어별로 호출해 클라이언트 템플릿에 주입한다.
export function render(lang = 'ko') {
  return renderToString(<App lang={lang} />);
}
