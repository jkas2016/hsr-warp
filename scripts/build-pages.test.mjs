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
  'index.html',
  'styles.css',
  'tokens/colors.css',
  'assets/logo-train.svg',
  'ui_kits/guide/index.html',
  'ui_kits/guide/guide.css',
  'ui_kits/guide/guide.js',
  'architecture.html',
]) {
  assert.ok(existsSync(join(out, f)), `missing in _site: ${f}`);
}

// 루트 진입점은 가이드로 보낸다
const idx = readFileSync(join(out, 'index.html'), 'utf8');
assert.ok(idx.includes('url=ui_kits/guide/'), 'root index must redirect to guide');

// 테스트 파일은 게시되지 않는다
assert.ok(!existsSync(join(out, 'ui_kits/guide/guide.test.js')), 'test file must not be published');

console.log('build-pages.test.mjs OK');
