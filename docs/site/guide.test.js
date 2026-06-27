// 가이드 페이지 — 자산 무결성 + 카피 정합성 가드.
// drift 재발 방지: 디자인 킷의 구버전 카피가 다시 들어오면 실패한다.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');

// ---- 자산 무결성(동봉 파일): 가이드와 함께 사는 guide.css·guide.js 존재 ----
// styles.css·tokens·assets·architecture.html 은 web/·docs/ 에서 빌드 시 _site 루트로
// 모이는 산출물이라 이 소스 디렉터리엔 없다 — 조립 후 링크 무결성은 build-pages.test.mjs 가 검증.
for (const sib of ['guide.css', 'guide.js']) {
  assert.ok(fs.existsSync(path.join(dir, sib)), `missing sibling asset: ${sib}`);
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
