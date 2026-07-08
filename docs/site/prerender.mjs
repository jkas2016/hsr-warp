import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// SSG: 앱을 HTML로 렌더해 클라이언트 템플릿의 <!--app-html--> 자리에 주입한다.
// (Vite SSG 가이드 https://vite.dev/guide/ssr.html#pre-rendering-ssg)
const here = path.dirname(fileURLToPath(import.meta.url));
const abs = (p) => path.resolve(here, p);
const PLACEHOLDER = '<!--app-html-->';

// 필수 빌드 산출물을 읽되, 부재 시 어느 빌드 단계가 빠졌는지 문맥을 붙여 던진다(raw ENOENT 금지).
function readBuilt(rel, step) {
  try {
    return fs.readFileSync(abs(rel), 'utf-8');
  } catch (e) {
    if (e.code === 'ENOENT') throw new Error(`빌드 산출물 없음: ${rel} — '${step}' 를 먼저 실행했는지 확인하세요.`);
    throw e;
  }
}

const template = readBuilt('dist/static/index.html', 'vite build (client)');
if (!template.includes(PLACEHOLDER)) throw new Error(`템플릿에 ${PLACEHOLDER} 플레이스홀더가 없습니다 — index.html 을 확인하세요.`);
if (!fs.existsSync(abs('dist/server/entry-server.js'))) throw new Error(`빌드 산출물 없음: dist/server/entry-server.js — 'vite build --ssr' 를 먼저 실행했는지 확인하세요.`);
const { render } = await import(pathToFileURL(abs('dist/server/entry-server.js')).href);
// 리플레이서를 함수로 — render() 결과의 $&/$1/$$ 가 치환 특수패턴으로 오해되지 않도록(리터럴 주입).
fs.writeFileSync(abs('dist/static/index.html'), template.replace(PLACEHOLDER, () => render()));

// 개발자 문서(문서 허브): 단일 소스 docs/architecture.html 을 게시 산출물로 복사 — repo 복제 없음.
fs.copyFileSync(abs('../architecture.html'), abs('dist/static/architecture.html'));

// 서버 번들은 빌드 산출물일 뿐 — 업로드 폴더를 깨끗하게.
fs.rmSync(abs('dist/server'), { recursive: true, force: true });

console.log('prerendered dist/static/index.html');
