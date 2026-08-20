// 게임별 팔레트·자산 계약 가드.
// 팔레트는 tokens/colors.css 의 토큰만 덮어써야 한다 — 오타난 변수는 아무것도 바꾸지
// 않고 조용히 통과하므로(참조하는 쪽이 없다) 여기서 잡는다.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const WEB = path.join(__dirname, '..', '..');
/** @param {string} p web/ 기준 상대 경로. @returns {string} 파일 내용. */
const read = (p) => fs.readFileSync(path.join(WEB, p), 'utf8');

const colors = read('tokens/colors.css');
const gameCss = read('tokens/game.css');
const styles = read('styles.css');
const dataJs = read('ui_kits/dashboard/data.js');

// 1) styles.css 가 game.css 를 colors.css 뒤에 import 한다(뒤여야 덮어쓴다).
const iColors = styles.indexOf("tokens/colors.css");
const iGame = styles.indexOf("tokens/game.css");
assert.ok(iColors >= 0, 'styles.css 가 tokens/colors.css 를 import 하지 않음');
assert.ok(iGame >= 0, 'styles.css 가 tokens/game.css 를 import 하지 않음');
assert.ok(iGame > iColors, 'game.css 는 colors.css 뒤에 import 돼야 한다');

// 2) 지원 게임 전부에 [data-game="<id>"] 블록과 로고 자산이 있다.
const GAMES = JSON.parse(
  dataJs.match(/const GAMES = (\[[^\]]*\]);/)[1].replace(/'/g, '"'),
);
assert.ok(GAMES.length >= 2, 'GAMES 파싱 실패');
for (const g of GAMES) {
  assert.ok(gameCss.includes(`[data-game="${g}"]`), `game.css 에 ${g} 팔레트 없음`);
  const logo = dataJs.match(new RegExp(`${g}: '([^']+)'`));
  assert.ok(logo, `data.js LOGOS 에 ${g} 없음`);
  const rel = logo[1].replace(/^\.\.\/\.\.\//, '');
  assert.ok(fs.existsSync(path.join(WEB, rel)), `로고 자산 없음: ${rel}`);
}

// 3) game.css 가 재정의하는 모든 커스텀 프로퍼티는 기본 계약(colors.css)에 존재해야 한다.
const declared = new Set([...colors.matchAll(/^\s*(--[\w-]+):/gm)].map((m) => m[1]));
const overridden = new Set([...gameCss.matchAll(/(--[\w-]+):/g)].map((m) => m[1]));
const orphan = [...overridden].filter((v) => !declared.has(v));
assert.deepStrictEqual(orphan, [], '기본 계약에 없는 토큰을 덮어씀: ' + orphan.join(', '));

// 4) 첫 페인트 전에 data-game 이 심어져야 팔레트가 번쩍이지 않는다.
const html = read('ui_kits/dashboard/index.html');
assert.ok(/setAttribute\('data-game'/.test(html), 'index.html 이 data-game 을 선반영하지 않음');
assert.ok(/setAttribute\('data-texture'/.test(html), 'index.html 이 data-texture 를 선반영하지 않음');

console.log('game-palette.test.js OK');
