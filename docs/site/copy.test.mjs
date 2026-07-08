// 가이드 카피 + copy 불변식 가드(소스레벨, 빌드 불필요). drift·false-pass 재발 방지(이슈 #24).
// 문자열 등장 여부가 아니라 실제 불변식을 검증한다:
//   (1) copy 소스(docs/architecture.html) 존재
//   (2) prerender copy 단계(architecture.html → dist/static) wiring
//   (3) GuidePage 가 참조하는 public 에셋의 실제 파일 존재
//   (4) 아키텍처 링크는 주석 제거 후 구조 앵커(href 속성)로 검사
import assert from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(dir, 'src/pages/GuidePage.jsx'), 'utf8');
// 블록/JSX 주석 {/* ... */} 제거 — 주석 속 마커가 통과하지 않도록. URL 의 '//' 는 건드리지 않는다.
const code = src.replace(/\/\*[\s\S]*?\*\//g, '');

// --- 가이드 본문 카피(내용 drift 가드) ---
for (const need of ['설치 마법사', 'hsr-warp-setup-', '/ui_kits/dashboard/', '%LOCALAPPDATA%', 'schedule.json']) {
  assert.ok(code.includes(need), `required copy missing: "${need}"`);
}
for (const bad of ['dashboard.html', '같은 폴더', '설치 불필요', '실행파일 하나가 전부', '실행파일 하나만 받으면']) {
  assert.ok(!code.includes(bad), `stale copy present: "${bad}"`);
}

// --- (4) 아키텍처 문서 링크: 구조 앵커(주석 제거 후 href 속성). 단순 문자열 등장 아님 ---
assert.ok(/href=["']architecture\.html["']/.test(code), 'GuidePage 에 architecture.html 링크(href) 없음');

// --- (1) copy 소스 존재: docs/architecture.html (삭제/이름변경 시 실패) ---
const copySrc = join(dir, '../architecture.html');
assert.ok(existsSync(copySrc), `copy 소스 없음: ${copySrc} (삭제/이름변경?)`);

// --- (2) prerender copy 단계 wiring: architecture.html → dist/static (copy 단계 제거 시 실패) ---
const pre = readFileSync(join(dir, 'prerender.mjs'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
assert.ok(/copyFileSync\(/.test(pre), 'prerender.mjs 에 copyFileSync 없음');
assert.ok(/['"][^'"]*architecture\.html['"]/.test(pre), 'prerender.mjs 에 architecture.html copy 소스 참조 없음');
assert.ok(/dist\/static\/architecture\.html/.test(pre), 'prerender.mjs 가 architecture.html 을 dist/static 로 복사하지 않음');

// --- (3) 참조된 public 에셋의 실제 파일 존재(문자열 등장이 아니라 파일 자체) ---
const refs = new Set();
for (const m of code.matchAll(/asset\(\s*['"]([^'"]+)['"]\s*\)/g)) refs.add(m[1]);      // asset('smartscreen1.png') 등
for (const m of code.matchAll(/BASE_URL\s*\+\s*['"]([^'"]+)['"]/g)) refs.add(m[1]);     // logo(BASE_URL + 'logo-train.svg')
assert.ok(refs.size >= 4, `참조 에셋 추출 실패(logo+png 최소 4) — 추출 ${refs.size}개`);
for (const f of refs) {
  assert.ok(existsSync(join(dir, 'public', f)), `참조된 public 에셋 파일 없음: public/${f}`);
}

console.log('copy.test.mjs OK');
