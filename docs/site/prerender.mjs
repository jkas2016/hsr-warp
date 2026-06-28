import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// SSG: 앱을 HTML로 렌더해 클라이언트 템플릿의 <!--app-html--> 자리에 주입한다.
// (Vite SSG 가이드 https://vite.dev/guide/ssr.html#pre-rendering-ssg)
const here = path.dirname(fileURLToPath(import.meta.url));
const abs = (p) => path.resolve(here, p);

const template = fs.readFileSync(abs('dist/static/index.html'), 'utf-8');
const { render } = await import(pathToFileURL(abs('dist/server/entry-server.js')).href);
fs.writeFileSync(abs('dist/static/index.html'), template.replace('<!--app-html-->', render()));

// 개발자 문서(문서 허브): 단일 소스 docs/architecture.html 을 게시 산출물로 복사 — repo 복제 없음.
fs.copyFileSync(abs('../architecture.html'), abs('dist/static/architecture.html'));

// 서버 번들은 빌드 산출물일 뿐 — 업로드 폴더를 깨끗하게.
fs.rmSync(abs('dist/server'), { recursive: true, force: true });

console.log('prerendered dist/static/index.html');
