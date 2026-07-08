const assert = require('assert');
const fs = require('fs');
const path = require('path');

// 공급망 가드: 서빙되는 HTML 이 로드하는 CDN 스크립트는 정확 버전 + SRI 를 가져야 한다.
// 변조된 CDN 스크립트가 페이지 전체 권한으로 실행되는 것을 막는다(이슈 #23).
// - <script src="https://..."> : 정확 버전(semver 3자리) + integrity="sha384-..." 필수
// - ESM import 'https://...'    : integrity 불가 → 정확 버전 고정만 강제
// - React 는 개발 빌드(.development.js) 금지(프로덕션 min 빌드만 서빙)

const ROOT = path.join(__dirname, '..', '..', '..');
const FILES = [
  path.join(__dirname, 'index.html'),
  path.join(ROOT, 'docs', 'architecture.html'),
];

const SEMVER = /\d+\.\d+\.\d+/;                 // 정확 버전(floating @4 / @11 은 실패)
const bad = [];

for (const file of FILES) {
  const src = fs.readFileSync(file, 'utf8');
  const rel = path.relative(ROOT, file);

  // 1) <script ... src="https://..."> 태그
  const scriptRe = /<script\b([^>]*?)\bsrc=["'](https?:\/\/[^"']+)["']([^>]*)>/gi;
  let m;
  while ((m = scriptRe.exec(src)) !== null) {
    const attrs = m[1] + m[3];
    const url = m[2];
    if (!SEMVER.test(url)) bad.push(`${rel}: floating 버전(정확 버전 아님): ${url}`);
    if (/\.development\.js/.test(url)) bad.push(`${rel}: 개발 빌드 서빙 금지: ${url}`);
    if (!/integrity=["']sha384-/.test(attrs)) bad.push(`${rel}: SRI(integrity) 누락: ${url}`);
    if (!/crossorigin=/.test(attrs)) bad.push(`${rel}: crossorigin 누락(SRI 검증 조건): ${url}`);
  }

  // 2) ESM import ... from 'https://...'  (integrity 불가 → 버전 고정만)
  const importRe = /from\s+["'](https?:\/\/[^"']+)["']/gi;
  while ((m = importRe.exec(src)) !== null) {
    const url = m[1];
    if (!SEMVER.test(url)) bad.push(`${rel}: ESM import floating 버전(정확 버전 아님): ${url}`);
  }
}

assert.strictEqual(bad.length, 0, 'CDN 무결성 위반:\n' + bad.join('\n'));
console.log('cdn-sri.test.js OK');
