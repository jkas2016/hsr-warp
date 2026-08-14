const assert = require('assert');

// 브라우저 전역을 흉내내는 최소 환경.
global.window = global;
global.navigator = { language: 'en-US' };
global.localStorage = { _v: {}, getItem(k){ return this._v[k] ?? null; }, setItem(k,v){ this._v[k]=String(v); } };
global.location = { search: '' };

require('./i18n/ko.js');
require('./i18n/en.js');
require('./i18n/zh.js');
require('./i18n/ja.js');
require('./i18n.js');

const I = window.I18N;
const DICTS = window.I18N_DICTS;

// 1) 4개 사전 키 정합성 (누락/잉여 0)
const langs = ['ko', 'en', 'zh', 'ja'];
const koKeys = Object.keys(DICTS.ko).sort();
for (const l of langs) {
  const k = Object.keys(DICTS[l]).sort();
  assert.deepStrictEqual(k, koKeys, `${l} 사전 키가 ko와 불일치`);
}

// 2) 보간
I.setLang('ko');
DICTS.ko['_test.greet'] = '안녕 {name}'; DICTS.en['_test.greet'] = 'hi {name}';
DICTS.zh['_test.greet'] = 'hi {name}'; DICTS.ja['_test.greet'] = 'hi {name}';
assert.strictEqual(I.t('_test.greet', { name: '준규' }), '안녕 준규');

// 3) 누락 키 → ko 폴백 → key 반환
I.setLang('en');
DICTS.ko['_test.onlyko'] = '한국어만'; // en/zh/ja 없음
assert.strictEqual(I.t('_test.onlyko'), '한국어만', 'ko 폴백');
assert.strictEqual(I.t('_test.missing.everywhere'), '_test.missing.everywhere', '완전 누락은 key 반환');

// 4) lang 결정/정규화
assert.strictEqual(I.langOf('zh-CN'), 'zh');
assert.strictEqual(I.langOf('ja'), 'ja');
assert.strictEqual(I.langOf('en-GB'), 'en');
assert.strictEqual(I.langOf('ko-KR'), 'ko');
assert.strictEqual(I.langOf('fr'), 'ko', '미지원 → ko');

// 5) 배너 코드 커버리지 + bannerLabel
for (const short of ['캐릭터', '광추', '일반', '출발']) {
  assert.ok(I.BANNER_CODE[short], `BANNER_CODE에 ${short} 누락`);
  assert.ok(DICTS.ko['banner.' + I.BANNER_CODE[short]], `ko에 banner.${I.BANNER_CODE[short]} 누락`);
}
I.setLang('ko');
assert.strictEqual(I.bannerLabel('캐릭터'), '캐릭터');

// 6) itemName: item_id → 현재 언어 이름, 없으면 raw 폴백
window.ITEM_NAMES = {
  '1009': { ko: '은랑', en: 'Silver Wolf', zh: '银狼', ja: '銀狼' },
  '21000': { ko: '태양이 없는 나날들', en: 'On the Fall of an Aeon' }, // zh/ja 누락
};
I.setLang('ko');
assert.strictEqual(I.itemName('1009', '은랑'), '은랑', 'ko 이름');
I.setLang('en');
assert.strictEqual(I.itemName('1009', '은랑'), 'Silver Wolf', 'en 이름으로 전환');
assert.strictEqual(I.itemName(1009, '은랑'), 'Silver Wolf', '숫자 id도 문자열로 조회');
I.setLang('zh');
assert.strictEqual(I.itemName('1009', '은랑'), '银狼', 'zh 이름');
assert.strictEqual(I.itemName('21000', '태양이 없는 나날들'), '태양이 없는 나날들', '언어값 누락 → raw 폴백');
assert.strictEqual(I.itemName('9999', '신규광추'), '신규광추', '사전에 없는 id → raw 폴백');
assert.strictEqual(I.itemName('9999', undefined), undefined, 'raw 없으면 raw 그대로 반환');

// 7) 게임별 용어 키 — 게임 스위처가 두 게임의 제목·배너 라벨을 모두 번역해야 한다.
// 키가 한 언어에만 있으면 (1)의 키 일치 검사가 이미 잡는다. 여기서는 필요한 키가
// 네 사전에서 통째로 빠지지 않았는지 본다.
{
  const required = [
    'game.hsr', 'game.zzz',
    'banner.exclusive', 'banner.wengine', 'banner.standard', 'banner.bangboo',
  ];
  for (const lang of langs) {
    for (const k of required) {
      assert.ok(DICTS[lang][k], `${lang} 사전에 ${k} 가 없다`);
    }
  }
}

// 8) 배너 short → i18n 코드 매핑이 두 게임을 모두 덮어야 한다.
{
  for (const short of ['캐릭터', '광추', '일반', '출발', '독점', 'W-엔진', '상시', '본디']) {
    assert.ok(I.BANNER_CODE[short], `BANNER_CODE 에 ${short} 가 없다`);
    assert.ok(DICTS.ko['banner.' + I.BANNER_CODE[short]], `ko 에 banner.${I.BANNER_CODE[short]} 누락`);
  }
}

console.log('i18n.test.js OK');
