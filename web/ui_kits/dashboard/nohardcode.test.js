const assert = require('assert');
const fs = require('fs');
const path = require('path');

// 검사 대상: 화면에 렌더되는 소스. (사전 i18n/*.js, Dashboard.jsx의 <option> 표기 제외)
const FILES = [
  'QueryPanel.jsx', 'RefreshBar.jsx', 'HeroSummary.jsx', 'BannerCards.jsx',
  'ChartsGrid.jsx', 'FivesTable.jsx', 'MonthlyTable.jsx', 'FiveDetail.jsx',
  'OverviewView.jsx', 'BannersView.jsx', 'HistoryView.jsx', 'VersionsView.jsx',
  'util.js', 'data.js',
];

// 줄 단위로 주석(// ...)을 제거한 뒤 한글이 남아있으면 미추출.
function stripLineComment(line) {
  const i = line.indexOf('//');
  return i >= 0 ? line.slice(0, i) : line;
}
const HANGUL = /[가-힣]/;
// 허용: 정규 키로 유지되는 배너 short/스코프/결과 한국어 리터럴(로직 값).
// 이들은 표시 시 bannerLabel()/t()로 감싸므로 "비교/키" 맥락에서만 등장해야 한다.
const ALLOW = /['"](캐릭터|광추|일반|출발|전체)['"]/g;

let bad = [];
for (const f of FILES) {
  const p = path.join(__dirname, f);
  const lines = fs.readFileSync(p, 'utf8').split('\n');
  lines.forEach((ln, i) => {
    let code = stripLineComment(ln).replace(ALLOW, '');
    if (HANGUL.test(code)) bad.push(`${f}:${i + 1}: ${ln.trim()}`);
  });
}
assert.strictEqual(bad.length, 0, '미추출 한글 표시문자열:\n' + bad.join('\n'));
console.log('nohardcode.test.js OK');
