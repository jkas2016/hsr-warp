const assert = require('assert');
const fs = require('fs');
const path = require('path');

// internal/game 의 Banners[].Code 집합(수집·저장이 실제로 쓰는 채널 코드)과
// web/<game>/schedule.json 의 banners 키·order 배열은 손으로 맞춰야 하는데 강제 장치가
// 없었다. 어긋나면 Go 는 그 채널을 수집·저장하는데 analyze.js 의 analyze() 는
// cfg.order 로만 그룹핑하므로 그 채널 레코드가 통계에서 통째로(에러도 경고도 없이) 사라진다.
// progress-map.test.js 와 같은 방식으로 Go 소스를 텍스트로 읽어 게임별 배너 코드를 뽑고,
// 각 게임의 schedule.json 의 banners 키 집합·order 배열과 일치하는지 단언한다.
const ROOT = path.join(__dirname, '..', '..', '..');

// Go: 게임 struct 블록 하나씩에서 ID 와 Banners[].Code 목록을 뽑는다.
// var games = []Game{ { ID: "hsr", ..., Banners: []Banner{ {Code: "11", ...}, ... }, Candidates: ... }, ... }
const goSrc = fs.readFileSync(path.join(ROOT, 'internal', 'game', 'game.go'), 'utf8');
const gameRe = /ID:\s*"(\w+)",[\s\S]*?Banners: \[\]Banner\{([\s\S]*?)\n\t\t\},/g;
const goGames = {};
let m;
while ((m = gameRe.exec(goSrc))) {
  const codes = [...m[2].matchAll(/Code:\s*"([^"]+)"/g)].map((x) => x[1]);
  assert.ok(codes.length, `${m[1]} 의 Banners 블록에서 Code 를 하나도 못 뽑았다 — 정규식이 game.go 구조 변화를 못 따라간다`);
  goGames[m[1]] = codes;
}
assert.deepStrictEqual(
  Object.keys(goGames).sort(), ['hsr', 'zzz'],
  'internal/game/game.go 에서 hsr/zzz 두 게임 블록을 모두 못 찾았다 — 정규식을 game.go 최신 구조에 맞춰라',
);

const SCHEDULE_PATH = { hsr: 'web/schedule.json', zzz: 'web/zzz/schedule.json' };

for (const gameID of Object.keys(goGames)) {
  const scheduleFile = path.join(ROOT, SCHEDULE_PATH[gameID]);
  const schedule = JSON.parse(fs.readFileSync(scheduleFile, 'utf8'));
  const bannerKeys = Object.keys(schedule.banners || {});
  assert.ok(bannerKeys.length, `${SCHEDULE_PATH[gameID]} 에 banners 블록이 비어있다`);
  assert.ok(Array.isArray(schedule.order) && schedule.order.length, `${SCHEDULE_PATH[gameID]} 에 order 배열이 비어있다`);

  const goCodes = goGames[gameID];
  assert.deepStrictEqual(
    [...bannerKeys].sort(), [...goCodes].sort(),
    `${gameID}: internal/game/game.go 의 Banners[].Code 집합과 ${SCHEDULE_PATH[gameID]} 의 banners 키 집합이 다르다 —\n` +
    '  Go 는 수집·저장하는데 analyze.js 는 그 채널을 못 찾아 통계에서 조용히 사라진다. 양쪽을 맞춰라.',
  );
  assert.deepStrictEqual(
    [...schedule.order].sort(), [...goCodes].sort(),
    `${gameID}: internal/game/game.go 의 Banners[].Code 집합과 ${SCHEDULE_PATH[gameID]} 의 order 배열이 다르다.`,
  );
}

console.log('banner-schedule.test.js OK');
