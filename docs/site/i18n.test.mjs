// 사전 구조·불변식 테스트(실행 기반). JSX 모듈은 rolldown(Vite 8 의 번들러)으로 번들해 로드한다
// — 정규식 소스 파싱 금지(#24 false-pass 교훈).
import assert from 'node:assert';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const dir = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(dir, 'package.json'));
const { rolldown } = require('rolldown');

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
const INVARIANT = ['hsr-warp-setup-', '/ui_kits/dashboard/', '%LOCALAPPDATA%', 'schedule.json', 'SRGF'];
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

console.log('i18n.test.mjs OK');
