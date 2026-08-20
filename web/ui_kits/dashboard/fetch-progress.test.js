const assert = require('assert');
const fs = require('fs');
const path = require('path');

// 조회 진행 표시 가드. RefreshBar 가 runFetch 의 onProgress 를 빈 함수로 버려서,
// '갱신 중…' 버튼 라벨 말고는 아무 반응이 없던 회귀를 막는다(오래 걸리는 조회에서
// 사용자에게는 앱이 멈춘 것으로 보였다). 최초 조회(QueryPanel)와 새로고침(RefreshBar)은
// 같은 SSE progress 를 받으므로 같은 표시 컴포넌트(FetchProgress)를 써야 한다.
const dir = __dirname;
const read = (f) => fs.readFileSync(path.join(dir, f), 'utf8');

// 1) 진행 표시는 한 컴포넌트에 모여 있다 — 양쪽이 각자 그리면 한쪽만 고쳐지고 갈라진다.
assert.ok(fs.existsSync(path.join(dir, 'FetchProgress.jsx')), 'FetchProgress.jsx 가 없다');
const fp = read('FetchProgress.jsx');
assert.ok(/window\.FetchProgress = FetchProgress/.test(fp), 'FetchProgress 를 전역에 노출해야 한다');

// 2) 두 패널 모두 onProgress 를 실제 상태 갱신에 연결한다 — no-op 콜백 금지.
for (const f of ['QueryPanel.jsx', 'RefreshBar.jsx']) {
  const src = read(f);
  const call = src.match(/runFetch\(([^)]*\)?[^;]*?)\)\s*;?\s*$/m) || src.match(/runFetch\([\s\S]*?\n/);
  assert.ok(call, `${f}: runFetch 호출을 못 찾았다`);
  assert.ok(
    !/runFetch\(\s*\w+\s*,\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)/.test(src),
    `${f}: runFetch 의 onProgress 가 빈 함수다 — 진행 상황이 사용자에게 전달되지 않는다`,
  );
  assert.ok(/setProg\(/.test(src), `${f}: progress 이벤트를 상태(setProg)로 반영해야 한다`);
  assert.ok(/<FetchProgress/.test(src), `${f}: FetchProgress 로 진행 상황을 그려야 한다`);
}

// 3) 조회는 총량을 알 수 없어 퍼센트가 불가능하다. 멈춘 것처럼 보이지 않으려면
//    최소한 (a) 무한 진행 애니메이션과 (b) 경과 시간이 있어야 한다.
assert.ok(/indet/.test(fp), 'FetchProgress 에 무한 진행 애니메이션(indet)이 없다');
assert.ok(/elapsed/i.test(fp), 'FetchProgress 에 경과 시간 표시가 없다');

// 4) 새 컴포넌트가 index.html 에 등록되지 않으면 런타임에서 조용히 undefined 가 된다.
const html = read('index.html');
assert.ok(html.includes('src="FetchProgress.jsx"'), 'index.html 에 FetchProgress.jsx 가 없다');
assert.ok(
  html.indexOf('FetchProgress.jsx') < html.indexOf('QueryPanel.jsx'),
  'FetchProgress.jsx 는 이를 쓰는 패널보다 먼저 로드돼야 한다',
);

// 5) 경과 시간 문구는 하드코딩이 아니라 i18n 키여야 한다(nohardcode 규칙과 같은 이유).
for (const lang of ['ko', 'en', 'ja', 'zh']) {
  const src = read(path.join('i18n', `${lang}.js`));
  assert.ok(src.includes("'progress.elapsed'"), `i18n/${lang}.js 에 progress.elapsed 가 없다`);
}

console.log('fetch-progress.test.js OK');
