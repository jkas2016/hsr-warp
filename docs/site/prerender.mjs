import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// SSG: 앱을 언어별로 렌더해 4개 HTML(/, /en/, /zh/, /ja/)을 생성한다.
// (Vite SSG 가이드 https://vite.dev/guide/ssr.html#pre-rendering-ssg)
const here = path.dirname(fileURLToPath(import.meta.url));
/**
 * 이 스크립트 위치 기준 상대 경로를 절대 경로로.
 * @param {string} p 상대 경로.
 * @returns {string} 절대 경로.
 */
const abs = (p) => path.resolve(here, p);
const PLACEHOLDER = '<!--app-html-->';
const HEAD_I18N = '<!--head-i18n-->';
const ORIGIN = 'https://jkas2016.github.io';
const BASE = '/hsr-warp/';

/**
 * 필수 빌드 산출물을 읽되, 부재 시 어느 빌드 단계가 빠졌는지 문맥을 붙여 던진다(raw ENOENT 금지).
 * @param {string} rel 이 스크립트 기준 상대 경로.
 * @param {string} step 이 파일을 만드는 빌드 단계 이름(오류 메시지에 넣는다).
 * @returns {string} 파일 내용(utf-8).
 * @throws {Error} 파일이 없으면 단계 안내를 붙인 오류, 그 외 오류는 그대로.
 */
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
if (!template.includes(HEAD_I18N)) throw new Error(`템플릿에 ${HEAD_I18N} 플레이스홀더가 없습니다 — index.html 을 확인하세요.`);
if (!fs.existsSync(abs('dist/server/entry-server.js'))) throw new Error(`빌드 산출물 없음: dist/server/entry-server.js — 'vite build --ssr' 를 먼저 실행했는지 확인하세요.`);
const { render, LANGS, META } = await import(pathToFileURL(abs('dist/server/entry-server.js')).href);

// 모든 페이지가 4개 언어 전부 + x-default 를 상호 참조해야 hreflang 이 유효하다.
const alternates = LANGS
  .map((l) => `<link rel="alternate" hreflang="${l.html}" href="${ORIGIN}${BASE}${l.path}">`)
  .concat(`<link rel="alternate" hreflang="x-default" href="${ORIGIN}${BASE}">`)
  .join('\n');

for (const l of LANGS) {
  const meta = META[l.code];
  const url = ORIGIN + BASE + l.path;
  // 리플레이서를 함수로 — render() 결과의 $&/$1/$$ 가 치환 특수패턴으로 오해되지 않도록(리터럴 주입).
  let html = template.replace(PLACEHOLDER, () => render(l.code));
  html = html.replace('<html lang="ko"', `<html lang="${l.html}"`);
  html = html.replace(/<title>[^<]*<\/title>/, () => `<title>${meta.title}</title>`);
  html = html.replace(/(<meta name="description" content=")[^"]*(">)/, (_, a, b) => a + meta.description + b);
  html = html.replace(HEAD_I18N, () => [
    `<meta property="og:type" content="website">`,
    `<meta property="og:title" content="${meta.ogTitle}">`,
    `<meta property="og:description" content="${meta.ogDescription}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:locale" content="${l.ogLocale}">`,
    `<link rel="canonical" href="${url}">`,
    alternates,
  ].join('\n'));

  // head 치환은 정규식/문자열 매칭이라 no-match 시 조용히 no-op 된다 — index.html 의 head 구조가
  // 바뀌면(속성 순서, 따옴표 종류 등) 감지 없이 한국어 head 가 그대로 배포될 수 있어 사후조건으로 막는다.
  /**
   * head 치환 사후조건. 어긋나면 즉시 빌드를 중단한다.
   * @param {boolean} cond 통과 조건.
   * @param {string} what 검사 대상 이름(오류 메시지용).
   * @returns {void}
   * @throws {Error} 조건이 거짓이면.
   */
  const must = (cond, what) => { if (!cond) throw new Error(`head 치환 실패(${l.code}): ${what} — index.html 의 head 를 확인하세요.`); };
  must(html.includes(`<html lang="${l.html}"`), '<html lang>');
  must(html.includes(`<title>${meta.title}</title>`), '<title>');
  must(html.includes(`content="${meta.description}"`), 'description');
  must((html.match(/hreflang=/g) || []).length === LANGS.length + 1, `hreflang ${LANGS.length + 1}개`);
  must(!html.includes(HEAD_I18N) && !html.includes(PLACEHOLDER), '플레이스홀더 잔존');

  const out = abs('dist/static/' + l.path + 'index.html');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);
  console.log(`prerendered dist/static/${l.path}index.html`);
}

// 개발자 문서(문서 허브): 단일 소스 docs/architecture.html 을 게시 산출물로 복사 — repo 복제 없음.
fs.copyFileSync(abs('../architecture.html'), abs('dist/static/architecture.html'));

// 서버 번들은 빌드 산출물일 뿐 — 업로드 폴더를 깨끗하게.
fs.rmSync(abs('dist/server'), { recursive: true, force: true });
