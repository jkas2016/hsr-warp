const assert = require('assert');
const fs = require('fs');
const path = require('path');

// 조회 진행 표시 가드. RefreshBar 가 runFetch 의 onProgress 를 빈 함수로 버려서,
// '갱신 중…' 버튼 라벨 말고는 아무 반응이 없던 회귀를 막는다(오래 걸리는 조회에서
// 사용자에게는 앱이 멈춘 것으로 보였다). 최초 조회(QueryPanel)와 새로고침(RefreshBar)은
// 같은 SSE progress 를 받으므로 같은 표시 컴포넌트(FetchProgress)를 써야 한다.
const dir = __dirname;
/** @param {string} f 이 디렉터리 기준 파일명. @returns {string} 파일 내용. */
const read = (f) => fs.readFileSync(path.join(dir, f), 'utf8');

// 1) 진행 표시는 한 컴포넌트에 모여 있다 — 양쪽이 각자 그리면 한쪽만 고쳐지고 갈라진다.
assert.ok(fs.existsSync(path.join(dir, 'FetchProgress.jsx')), 'FetchProgress.jsx 가 없다');
const fp = read('FetchProgress.jsx');
assert.ok(/window\.FetchProgress = FetchProgress/.test(fp), 'FetchProgress 를 전역에 노출해야 한다');

// 2) 조회 상태는 패널 언마운트와 무관하게 Dashboard에서 게임별로 소유한다.
const dashboard = read('Dashboard.jsx');
assert.ok(/setFetches/.test(dashboard) && /\[id\]: state/.test(dashboard));
for (const f of ['QueryPanel.jsx', 'RefreshBar.jsx']) {
  const src = read(f);
  assert.ok(/await runFetch\(p\)/.test(src));
  assert.ok(/fetchState/.test(src) && !/\[busy, setBusy\]/.test(src));
  assert.ok(/<FetchProgress[^>]*startedAt=/.test(src));
}

// 3) 새로고침 칩은 헤더 안에 있어, 진행 표시가 흐름에 끼어들면 헤더가 늘어나며
//    본문 전체를 아래로 밀어낸다. 그래서 칩 쪽 표시는 흐름에서 빠진 팝오버여야 한다.
assert.ok(/popover/.test(fp), 'FetchProgress 에 팝오버 모드가 없다');
assert.ok(/position:\s*'absolute'/.test(fp), '팝오버가 absolute 로 흐름에서 빠지지 않는다');
{
  const rb = read('RefreshBar.jsx');
  assert.ok(/<FetchProgress[^>]*popover/.test(rb), 'RefreshBar 는 진행 표시를 팝오버로 띄워야 한다');
  assert.ok(/position:\s*'relative'/.test(rb), 'RefreshBar 에 팝오버 기준이 될 relative 가 없다');
  // 칩 자체가 조회 중에 모양을 바꾸면 그것만으로도 레이아웃이 흔들린다.
  assert.ok(!/borderRadius:\s*busy\s*\?/.test(rb), '조회 중 칩 모서리를 바꾸면 헤더가 흔들린다');
}

// 4) 조회는 총량을 알 수 없어 퍼센트가 불가능하다. 멈춘 것처럼 보이지 않으려면
//    최소한 (a) 무한 진행 애니메이션과 (b) 경과 시간이 있어야 한다.
assert.ok(/indet/.test(fp), 'FetchProgress 에 무한 진행 애니메이션(indet)이 없다');
assert.ok(/elapsed/i.test(fp), 'FetchProgress 에 경과 시간 표시가 없다');

// 5) 새 컴포넌트가 index.html 에 등록되지 않으면 런타임에서 조용히 undefined 가 된다.
const html = read('index.html');
assert.ok(html.includes('src="FetchProgress.jsx"'), 'index.html 에 FetchProgress.jsx 가 없다');
assert.ok(
  html.indexOf('FetchProgress.jsx') < html.indexOf('QueryPanel.jsx'),
  'FetchProgress.jsx 는 이를 쓰는 패널보다 먼저 로드돼야 한다',
);

// 6) 경과 시간 문구는 하드코딩이 아니라 i18n 키여야 한다(nohardcode 규칙과 같은 이유).
for (const lang of ['ko', 'en', 'ja', 'zh']) {
  const src = read(path.join('i18n', `${lang}.js`));
  assert.ok(src.includes("'progress.elapsed'"), `i18n/${lang}.js 에 progress.elapsed 가 없다`);
}

console.log('fetch-progress.test.js OK');

// 실제 SSE 콜백을 실행해 백그라운드 완료가 현재 게임 분석을 건드리지 않는지 확인한다.
(async () => {
  const vm = require('vm');
  const streams = [];
  const context = { window: { I18N: { t: (key) => key } }, localStorage: { getItem: () => null, setItem: () => {} },
    EventSource: class {
      constructor(url) { this.url = url; this.handlers = {}; streams.push(this); }
      addEventListener(name, callback) { this.handlers[name] = callback; }
      close() { this.closed = true; }
    },
  };
  vm.runInNewContext(read('data.js'), context);
  const api = context.window.WarpData;
  const progress = [];
  const pending = api.runFetch('test-path', (banner, added) => progress.push([banner, added]));
  assert.ok(streams[0].url.includes('game=hsr'));
  api.setGame('zzz');
  streams[0].handlers.progress({ data: JSON.stringify({ banner: '캐릭터', added: 12 }) });
  assert.deepStrictEqual(progress, [['캐릭터', 12]]);
  await streams[0].handlers.done({ data: JSON.stringify({ data: { list: [] }, summary: {} }) });
  assert.strictEqual(await pending, null, '다른 게임의 설정으로 분석하지 않아야 한다');
  assert.ok(streams[0].closed);
  const failed = api.runFetch('zzz-path');
  api.setGame('hsr');
  streams[1].handlers.error({ data: JSON.stringify({ message: 'expired' }) });
  await assert.rejects(failed, /expired/);
  assert.strictEqual(api.game(), 'hsr');
  // Dashboard의 실제 조회 핸들러: 게임 전환 후 진행 업데이트, 동시 조회, 오류를 분리한다.
  const jobs = {};
  const states = {};
  const displayed = [];
  const running = { current: new Set() };
  const handler = dashboard.match(/async function runFetch\(path\) \{[\s\S]*?\n  \}/)[0];
  const run = vm.runInNewContext('(' + handler + ')', {
    window: { WarpData: {
      game: () => api.game(),
      runFetch: (path, progress) => new Promise((resolve, reject) => { jobs[api.game()] = { progress, resolve, reject }; }),
    } }, running, Date, t: (key) => key,
    setFetchState: (id, state) => { states[id] = state; },
    setData: (data) => displayed.push(data),
  });
  const hsrJob = run('hsr-path');
  const start = states.hsr.startedAt;
  api.setGame('zzz');
  jobs.hsr.progress('캐릭터', 25);
  assert.strictEqual(states.hsr.prog['캐릭터'], 25);
  assert.strictEqual(states.hsr.startedAt, start);
  assert.strictEqual(states.zzz, undefined);
  const zzzJob = run('zzz-path');
  api.setGame('hsr');
  assert.strictEqual(states.hsr.busy, true, '복귀해도 조회 중 상태를 유지해야 한다');
  await run('duplicate');
  assert.strictEqual(running.current.size, 2, '게임별 중복 조회를 막아야 한다');
  jobs.zzz.resolve({ game: 'zzz' });
  await zzzJob;
  assert.strictEqual(displayed.length, 0, '백그라운드 결과가 현재 화면을 덮으면 안 된다');
  jobs.hsr.reject(new Error('expired'));
  await hsrJob;
  assert.strictEqual(states.hsr.err, 'expired');
  assert.strictEqual(running.current.size, 0);
  // 전환 전 일정 응답이 늦게 와도 새 게임의 설정을 덮지 않는다.
  const requests = [];
  const raceContext = { window: { WarpAnalyze: { resolveConfig: (value) => value } },
    localStorage: { getItem: () => null, setItem: () => {} },
    fetch: (url) => new Promise((resolve) => requests.push({ url, resolve })),
  };
  vm.runInNewContext(read('data.js'), raceContext);
  const raceApi = raceContext.window.WarpData;
  const oldLoad = raceApi.loadStored();
  raceApi.setGame('zzz');
  const newLoad = raceApi.loadStored();
  requests[1].resolve({ json: async () => ({ order: ['2'], banners: { '2': { role: 'limited-char', short: 'ZZZ' } } }) });
  await new Promise((resolve) => setImmediate(resolve));
  assert.strictEqual(requests[2].url, '/api/data?game=zzz');
  requests[2].resolve({ json: async () => ({ list: [] }) });
  await newLoad;
  requests[0].resolve({ json: async () => ({ order: ['11'], banners: { '11': { short: 'HSR' } } }) });
  await oldLoad;
  assert.strictEqual(raceApi.banners()[0].short, 'ZZZ');
  assert.strictEqual(requests.length, 3, '전환 전 요청이 새 게임 데이터를 추가 요청하면 안 된다');
  console.log('background fetch isolation, game-switch progress and schedule races OK');
})().catch((error) => { console.error(error); process.exitCode = 1; });
