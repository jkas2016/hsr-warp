// 가이드 페이지 — 자산 무결성 + 카피 정합성 가드.
// drift 재발 방지: 디자인 킷의 구버전 카피가 다시 들어오면 실패한다.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');

// ---- 자산 무결성: 로컬 href/src 가 모두 실재하는지 ----
const refs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map(m => m[1]);
const local = refs.filter(r => !/^(https?:|#|mailto:|data:)/.test(r));
for (const r of local) {
  const p = path.resolve(dir, r);
  assert.ok(fs.existsSync(p), `missing local asset: ${r} -> ${p}`);
}

// ---- 카피 정합성: 구버전(stale) 문자열은 없어야 한다 ----
for (const bad of ['dashboard.html', '같은 폴더', '설치 불필요', '실행파일 하나가 전부', '실행파일 하나만 받으면']) {
  assert.ok(!html.includes(bad), `stale copy present: "${bad}"`);
}

// ---- 카피 정합성: 현재 사실 문자열은 있어야 한다 ----
for (const need of ['%LOCALAPPDATA%\\HSR Warp', '/ui_kits/dashboard/', '설치 마법사', 'hsr-warp-setup-', 'schedule.json']) {
  assert.ok(html.includes(need), `required copy missing: "${need}"`);
}

console.log('guide.test.js OK');
