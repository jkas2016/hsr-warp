const assert = require('assert');

// pickBanner 가드(4.3 스코프 크래시 회귀 방지) — 버전 스코프 필터(filterAnalysis)는
// 구간 내 뽑기가 0인 배너를 제거하므로, 선택된 배너가 사라지면 첫 배너로 폴백해야 한다.
// (BannersView 가 기본 선택 '캐릭터'를 undefined 로 렌더하며 b.color 에서 크래시하던 버그.)
global.window = global;
require('./util.js');
const { pickBanner } = window.WarpUtil;

const banners = [
  { type: '12', short: '광추' },
  { type: '1', short: '일반' },
];

// 1) 선택한 short 가 있으면 그 배너.
assert.strictEqual(pickBanner(banners, '일반'), banners[1]);

// 2) 선택한 배너가 스코프에서 빠졌으면 첫 배너로 폴백.
assert.strictEqual(pickBanner(banners, '캐릭터'), banners[0]);

// 3) 배너가 하나도 없으면 null (뷰는 렌더 생략).
assert.strictEqual(pickBanner([], '캐릭터'), null);

console.log('util.test.js OK');
