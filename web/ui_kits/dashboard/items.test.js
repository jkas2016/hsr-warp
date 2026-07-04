const assert = require('assert');

// 생성물(scripts/extract-item-names.mjs 산출) 무결성 가드 — 부분 생성/빈 파일 회귀 차단.
global.window = global;
require('./i18n/items.js');
const N = window.ITEM_NAMES;
const LANGS = ['ko', 'en', 'zh', 'ja'];

const ids = Object.keys(N);
assert.ok(ids.length >= 200, `아이템 수 비정상: ${ids.length}`);
assert.ok(ids.some((k) => k.length === 4), '캐릭터(4자리 id) 없음');
assert.ok(ids.some((k) => k.length === 5), '광추(5자리 id) 없음');

// 저장된 값은 절대 빈 문자열이 아니다(빈 이름은 추출 시 제외 → 표시 때 raw 폴백).
for (const id of ids) {
  for (const l of Object.keys(N[id])) {
    assert.ok(typeof N[id][l] === 'string' && N[id][l].length, `${id} ${l} 빈 이름 저장됨`);
  }
}

// 오래된(완전 번역된) 샘플은 4언어를 모두 갖는다.
const sample = N['1003']; // 히메코
assert.deepStrictEqual(Object.keys(sample).sort(), LANGS.slice().sort(), '샘플 언어 집합 불일치');

console.log('items.test.js OK');
