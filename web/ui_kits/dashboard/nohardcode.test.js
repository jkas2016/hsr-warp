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

// 주석(// ..., /* ... */)을 제거한 뒤 한글이 남아있으면 미추출.
// JSDoc 도 블록 주석이므로 여러 줄에 걸친 /* */ 를 상태로 추적해 지운다.
// 줄 번호를 보존해야 하므로 파일 전체를 한 번에 지우지 않고 줄 배열을 그대로 매핑한다.
function stripComments(lines) {
  let inBlock = false;
  return lines.map((line) => {
    let out = '', i = 0;
    while (i < line.length) {
      if (inBlock) {
        const end = line.indexOf('*/', i);
        if (end < 0) break;          // 줄 끝까지 블록 주석
        inBlock = false; i = end + 2; continue;
      }
      const b = line.indexOf('/*', i), l = line.indexOf('//', i);
      if (l >= 0 && (b < 0 || l < b)) { out += line.slice(i, l); break; }
      if (b < 0) { out += line.slice(i); break; }
      out += line.slice(i, b); i = b + 2; inBlock = true;
    }
    return out;
  });
}
const HANGUL = /[가-힣]/;
// 허용: 정규 키로 유지되는 배너 short/스코프/결과 한국어 리터럴(로직 값).
// 이들은 표시 시 bannerLabel()/t()로 감싸므로 "비교/키" 맥락에서만 등장해야 한다.
// ZZZ 배너 short(독점/W-엔진/상시/본디)와 SSE progress 의 역할 이름('무기')도 로직 값이다.
const ALLOW = /['"](캐릭터|광추|일반|출발|전체|독점|W-엔진|상시|본디|무기)['"]/g;

let bad = [];
for (const f of FILES) {
  const p = path.join(__dirname, f);
  const lines = fs.readFileSync(p, 'utf8').split('\n');
  stripComments(lines).forEach((code, i) => {
    if (HANGUL.test(code.replace(ALLOW, ''))) bad.push(`${f}:${i + 1}: ${lines[i].trim()}`);
  });
}
assert.strictEqual(bad.length, 0, '미추출 한글 표시문자열:\n' + bad.join('\n'));
console.log('nohardcode.test.js OK');
