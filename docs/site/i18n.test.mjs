// 사전 구조·불변식 테스트(실행 기반). JSX 모듈은 rolldown(Vite 8 의 번들러)으로 번들해 로드한다
// — 정규식 소스 파싱 금지(#24 false-pass 교훈).
import assert from 'node:assert';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const dir = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(dir, 'package.json'));
// raw MODULE_NOT_FOUND 금지(prerender.mjs 의 readBuilt 관례와 동일) — docs/site 의존성이
// 설치되지 않은 채 루트 npm test 를 돌리면 원인을 바로 알 수 있게 문맥을 붙여 던진다.
let rolldown;
try {
  ({ rolldown } = require('rolldown'));
} catch (e) {
  if (e.code === 'MODULE_NOT_FOUND') {
    throw new Error(`rolldown 모듈 없음 — 'npm ci --prefix docs/site' 를 먼저 실행했는지 확인하세요.`);
  }
  throw e;
}

// 번들 산출물은 docs/site 하위에 써야 한다 — data: URL 은 react/jsx-runtime 같은
// bare specifier 를 해석하지 못한다(ERR_UNSUPPORTED_RESOLVE_REQUEST).
const bundle = await rolldown({
  input: join(dir, 'src/i18n/index.js'),
  cwd: dir, platform: 'node', logLevel: 'silent',
  transform: { jsx: 'react-jsx' },
});
const { output } = await bundle.generate({ format: 'esm' });
const tmp = join(dir, 'node_modules/.i18n-test-bundle.mjs');
writeFileSync(tmp, output[0].code);
let mod;
try {
  mod = await import(pathToFileURL(tmp).href);
} finally {
  rmSync(tmp, { force: true });
}
const { LANGS, DICTS } = mod;

// React 엘리먼트는 리프로 취급($$typeof 심벌 존재).
const isElement = (v) => typeof v === 'object' && v !== null && !!v.$$typeof;

// 값 트리 → 구조 서술자. 리프(문자열/숫자/JSX)는 'leaf', 배열은 원소별, 객체는 키별(정렬).
function shape(v) {
  if (typeof v === 'string' || typeof v === 'number' || isElement(v)) return 'leaf';
  if (Array.isArray(v)) return v.map(shape);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, shape(v[k])]));
  throw new Error('사전에 허용되지 않는 값: ' + String(v));
}

// JSX 트리에서 텍스트만 수집(로케일 불변 문자열 검사용).
function textOf(v, out = []) {
  if (v == null) return out;
  if (typeof v === 'string' || typeof v === 'number') { out.push(String(v)); return out; }
  if (Array.isArray(v)) { for (const c of v) textOf(c, out); return out; }
  if (isElement(v)) { textOf(v.props.children, out); return out; }
  if (typeof v === 'object') { for (const c of Object.values(v)) textOf(c, out); return out; }
  return out;
}

assert.ok(DICTS.ko, 'ko 사전 없음');
assert.ok(DICTS.en, 'en 사전 없음');

const koShape = shape(DICTS.ko);
// 로케일 불변 문자열 — 번역해서는 안 되는 파일명·경로·규격명. 한 언어만 갱신이
// 빠지는 사고를 잡는다. UIGF/ZenlessZoneZero 는 ZZZ 안내가 네 언어 모두에
// 실제로 들어갔는지를 강제한다(SRGF/Star Rail 은 HSR 쪽 대응).
const INVARIANT = [
  'hsr-warp-setup-', '/ui_kits/dashboard/', '%LOCALAPPDATA%', 'schedule.json',
  'SRGF', 'UIGF', 'Star Rail Games', 'ZenlessZoneZero',
];
for (const [code, dict] of Object.entries(DICTS)) {
  assert.deepStrictEqual(shape(dict), koShape, `${code} 사전의 키 구조가 ko와 다름`);
  const text = textOf(dict).join('\n');
  for (const need of INVARIANT) {
    assert.ok(text.includes(need), `${code} 사전에 로케일 불변 문자열 누락: "${need}"`);
  }
  for (const [k, v] of Object.entries(dict.meta)) {
    assert.ok(typeof v === 'string' && !v.includes('"'), `${code} meta.${k} 에 큰따옴표 금지(HTML 속성 주입 규약)`);
  }
}
// LANGS 메타 자체 검증
assert.deepStrictEqual(LANGS.map((l) => l.code), ['ko', 'en', 'zh', 'ja'], 'LANGS 코드 불일치');
assert.ok(LANGS.every((l) => l.path === '' || l.path.endsWith('/')), 'LANGS path 는 빈 문자열 또는 슬래시 종결');

// 사전 완결성: LANGS 에 선언된 모든 언어의 사전이 존재해야 한다.
assert.deepStrictEqual(Object.keys(DICTS).sort(), LANGS.map((l) => l.code).sort(), 'DICTS 가 LANGS 를 모두 커버하지 않음');

// --- 루트 자동 이동 인라인 스크립트: 소스에서 추출해 셤과 함께 실제 실행 ---
const htmlSrc = readFileSync(join(dir, 'index.html'), 'utf8');
const m = htmlSrc.match(/<script>\/\*lang-redirect\*\/([\s\S]*?)<\/script>/);
assert.ok(m, 'index.html 에 lang-redirect 인라인 스크립트 없음');
const scriptSrc = m[1].replace(/%BASE_URL%/g, '/hsr-warp/');

// 셤 주입 실행기: 리다이렉트가 일어나면 그 URL, 아니면 null 반환.
// 페이지 언어는 pathname 세그먼트로 표현(entry-client.jsx 와 동일한 단일 소스) —
// <html lang> 셤은 더 이상 스크립트가 읽지 않으므로 제공하지 않는다.
function runRedirect({ pathname, search = '', saved = null, nav = '', hash = '', savedThrows = false }) {
  let redirected = null;
  const loc = { pathname, search, hash, replace: (u) => { redirected = u; } };
  const ls = { getItem: () => { if (savedThrows) throw new Error('denied'); return saved; } };
  const navi = { language: nav };
  new Function('location', 'localStorage', 'navigator', scriptSrc)(loc, ls, navi);
  return redirected;
}

// 루트(ko): ?lang 최우선, 그다음 saved, 그다음 navigator, 전부 없으면 이동 없음
assert.strictEqual(runRedirect({ pathname: '/hsr-warp/', search: '?lang=en', hash: '#faq' }), '/hsr-warp/en/#faq');
assert.strictEqual(runRedirect({ pathname: '/hsr-warp/', search: '?lang=en', saved: 'ja' }), '/hsr-warp/en/');
assert.strictEqual(runRedirect({ pathname: '/hsr-warp/', saved: 'ja' }), '/hsr-warp/ja/');
assert.strictEqual(runRedirect({ pathname: '/hsr-warp/', nav: 'en-US' }), '/hsr-warp/en/');
assert.strictEqual(runRedirect({ pathname: '/hsr-warp/', nav: 'zh-CN' }), '/hsr-warp/zh/');
assert.strictEqual(runRedirect({ pathname: '/hsr-warp/', nav: 'fr' }), null);            // 미지원 → ko 폴백(이동 없음)
assert.strictEqual(runRedirect({ pathname: '/hsr-warp/', nav: 'ko-KR' }), null);
assert.strictEqual(runRedirect({ pathname: '/hsr-warp/', search: '?lang=ko', saved: 'en' }), null); // ?lang=ko 명시 → 유지
assert.strictEqual(runRedirect({ pathname: '/hsr-warp/', savedThrows: true, nav: 'ja' }), '/hsr-warp/ja/'); // localStorage 예외 무시
// 언어 페이지: 명시적 진입 존중 — saved/navigator 로는 이동하지 않음, ?lang 만 동작
assert.strictEqual(runRedirect({ pathname: '/hsr-warp/en/', saved: 'ja', nav: 'ja' }), null);
assert.strictEqual(runRedirect({ pathname: '/hsr-warp/en/', search: '?lang=ja' }), '/hsr-warp/ja/');
assert.strictEqual(runRedirect({ pathname: '/hsr-warp/zh/', search: '?lang=zh' }), null); // 대상이 현재 페이지와 같음 → 이동 없음
// 회귀 가드(dev 서버 무한 루프, #46 리뷰): page 를 <html lang> 이 아니라 pathname 으로 판정하므로
// /ja/ 를 방문하면 target 도 항상 'ja' 로 일치해 자기 자신으로는 절대 리다이렉트하지 않는다.
// (이전 구현은 dev 서버가 항상 lang="ko" 를 서빙해 page='ko' 로 오판 → target='ja' 로 무한 루프됐다.)
assert.strictEqual(runRedirect({ pathname: '/hsr-warp/ja/', search: '?lang=ja' }), null);

console.log('i18n.test.mjs OK');
