// 가이드 카피 정합성 가드(소스레벨, 빌드 불필요). drift 재발 방지.
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(dir, 'src/pages/GuidePage.jsx'), 'utf8');

for (const need of ['설치 마법사', 'hsr-warp-setup-', '/ui_kits/dashboard/', '%LOCALAPPDATA%', 'schedule.json', 'architecture.html']) {
  assert.ok(src.includes(need), `required copy missing: "${need}"`);
}
for (const bad of ['dashboard.html', '같은 폴더', '설치 불필요', '실행파일 하나가 전부', '실행파일 하나만 받으면']) {
  assert.ok(!src.includes(bad), `stale copy present: "${bad}"`);
}
console.log('copy.test.mjs OK');
