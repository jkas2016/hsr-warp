// build-pages.mjs 조립 산출물 검증.
import assert from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
execFileSync('node', [join(root, 'scripts/build-pages.mjs')], { stdio: 'inherit' });

const out = join(root, '_site');
for (const f of [
  'index.html',      // 가이드 본문 = Pages 루트 진입점
  'guide.css',
  'guide.js',
  'styles.css',
  'tokens/colors.css',
  'assets/logo-train.svg',
  'architecture.html',
]) {
  assert.ok(existsSync(join(out, f)), `missing in _site: ${f}`);
}

// 루트 index.html 은 가이드 본문 자체여야 한다(redirect 아님)
const idx = readFileSync(join(out, 'index.html'), 'utf8');
assert.ok(!idx.includes('http-equiv="refresh"'), 'root index must be the guide itself, not a redirect');

// 테스트 파일은 게시되지 않는다
assert.ok(!existsSync(join(out, 'guide.test.js')), 'test file must not be published');

// 문서 허브: 가이드 푸터가 architecture.html 을 링크해야 한다(스펙 요구, 회귀 방지)
assert.ok(idx.includes('architecture.html'), 'guide footer must link architecture.html');

// 조립 후 링크 무결성: 가이드의 모든 로컬 href/src 가 _site 안에 실재해야 한다(404 방지)
const refs = [...idx.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]);
const localRefs = refs.filter((r) => !/^(https?:|#|mailto:|data:)/.test(r));
for (const r of localRefs) {
  assert.ok(existsSync(join(out, r)), `broken local link in built guide: ${r}`);
}

console.log('build-pages.test.mjs OK');
