// JS/JSX/MJS 함수에 JSDoc 이 붙어 있는지 강제한다.
//
// 왜 ESLint 가 아닌가: 루트 package.json 은 의존성이 0개고, 대시보드는 빌드 없이
// 브라우저 Babel 로 도는 구조라 파서·전역 설정을 따로 맞춰야 한다. 반면 이 저장소엔
// 이미 소스를 문자열로 읽어 규칙을 강제하는 가드가 여럿 있다(nohardcode·lang-reactivity
// ·progress-map·cdn-sri). 이 파일은 그 관례를 따른다.
//
// 무엇을 못 잡는가(정직한 한계 — 여기는 파서가 아니라 스캐너다):
//   - @param 이름이 실제 인자와 맞는지 같은 '내용 정합성'. 누락만 본다.
//   - 여러 줄에 걸쳐 선언된 화살표 함수(`const f = (\n  a,\n) => {`).
//   - 익명 콜백, 클래스 메서드(이 저장소엔 클래스가 없다).
// 이 검사가 답답해지는 날이 오면 그때 eslint-plugin-jsdoc 으로 갈아타면 된다.
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// 검사 대상 확장자.
const EXT = new Set(['.js', '.jsx', '.mjs']);

// 순회에서 통째로 빼는 디렉터리.
//   node_modules/dist : 남의 코드·빌드 산출물.
//   .claude/worktrees : 이 저장소의 워크트리 사본(같은 파일이 두 번 잡힌다).
//   .git              : 순회 비용만 든다.
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'worktrees']);

// 개별 제외 파일. _ds_bundle.js 는 디자인 시스템 벤더 번들이라 우리가 손대지 않는다.
const SKIP_FILES = new Set(['_ds_bundle.js']);

// 함수 선언. 들여쓰기·export·async 를 허용한다.
const DECL = /^\s*(?:export\s+)?(?:async\s+)?function\s+[A-Za-z0-9_$]+/;
// 화살표 함수를 담은 const. `const f = (a) =>`, `const f = a =>`, `const f = async (a) =>`.
// 인자 목록에 '=>' 가 없어야 하므로 괄호 안은 ')' 가 아닌 문자만 받는다 —
// `const xs = arr.map((x) => x)` 같은 '함수가 아닌 선언'을 걸러내기 위함이다.
const ARROW = /^\s*(?:export\s+)?const\s+[A-Za-z0-9_$]+\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z0-9_$]+)\s*=>/;
// 객체 리터럴의 함수 프로퍼티. `foo: function (a) {`, `'foo': async function () {`.
const PROP = /^\s*['"]?[A-Za-z0-9_$.]+['"]?\s*:\s*(?:async\s+)?function\b/;

/**
 * 소스에서 JSDoc 이 없는 함수 선언을 찾는다.
 * 바로 윗줄이 블록 주석 종료로 끝나면 JSDoc 이 붙은 것으로 본다. 한 줄짜리 JSDoc 도
 * 같은 규칙으로 통과하므로 짧은 헬퍼에 여러 줄 주석을 강요하지 않는다.
 * @param {string} src 소스 전문.
 * @returns {Array<{line: number, text: string}>} 누락 위치(1-based)와 그 줄 내용.
 */
export function findMissing(src) {
  const lines = src.split(/\r?\n/);
  const out = [];
  lines.forEach((line, i) => {
    if (!DECL.test(line) && !ARROW.test(line) && !PROP.test(line)) return;
    if ((lines[i - 1] || '').trim().endsWith('*/')) return;
    out.push({ line: i + 1, text: line.trim() });
  });
  return out;
}

/**
 * 디렉터리를 재귀 순회해 검사 대상 파일 경로를 모은다.
 * @param {string} dir 순회 시작 디렉터리(절대 경로).
 * @param {string[]} [out=[]] 누적 배열(재귀용).
 * @returns {string[]} 검사 대상 파일의 절대 경로 목록.
 */
function collect(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      collect(path.join(dir, e.name), out);
    } else if (EXT.has(path.extname(e.name)) && !SKIP_FILES.has(e.name)) {
      out.push(path.join(dir, e.name));
    }
  }
  return out;
}

// ---- 1) 스캐너 자기검증 ----
// 가드가 "아무것도 못 잡는" 상태로 조용히 고장나는 것을 막는다. 아래 픽스처가
// 깨지면 저장소 스캔이 0건을 내도 그 0건은 믿을 수 없다.
{
  const missing = findMissing([
    'function bare() {}',                       // 1: 주석 없음 → 잡혀야 한다
    '// 한 줄 주석은 JSDoc 이 아니다',
    'function lineCommented() {}',              // 3: 잡혀야 한다
    '/** 문서. @returns {void} */',
    'function documented() {}',                 // 통과
    '/**',
    ' * 여러 줄 문서.',
    ' * @returns {void}',
    ' */',
    'function multiline() {}',                  // 통과
    'const arrowBare = (a) => a;',              // 11: 잡혀야 한다
    '/** @param {number} a @returns {number} */',
    'const arrowDoc = (a) => a;',               // 통과
    'const single = a => a;',                   // 14: 괄호 없는 인자도 잡혀야 한다
    '  const nested = async (a) => a;',         // 15: 들여쓰기·async 도 잡혀야 한다
    'export function exported() {}',            // 16: export 도 잡혀야 한다
    '  foo: function (a) { return a; },',       // 17: 객체 프로퍼티도 잡혀야 한다
    'const notAFunction = arr.map((x) => x);',  // 통과 — 함수 선언이 아니다
    'const plain = 42;',                        // 통과
  ].join('\n'));

  assert.deepStrictEqual(missing.map((m) => m.line), [1, 3, 11, 14, 15, 16, 17],
    '스캐너가 잡아야 할 줄을 못 잡거나, 함수가 아닌 선언을 오탐하고 있다');
}

// ---- 2) 저장소 전체 스캔 ----
const files = collect(ROOT);
assert.ok(files.length > 20, `검사 대상이 너무 적다(${files.length}개) — 순회가 깨졌다`);

const bad = [];
for (const f of files) {
  for (const m of findMissing(fs.readFileSync(f, 'utf8'))) {
    bad.push(`${path.relative(ROOT, f).replace(/\\/g, '/')}:${m.line}: ${m.text}`);
  }
}
assert.strictEqual(bad.length, 0,
  `JSDoc 이 없는 함수 ${bad.length}개:\n` + bad.join('\n')
  + '\n\n각 함수 위에 /** ... */ 블록으로 설명과 @param/@returns 를 적어라.');

console.log(`jsdoc.test.mjs OK (${files.length}개 파일 검사)`);
