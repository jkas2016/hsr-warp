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
require('./i18n/game.js');
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

// 9) itemName: HSR/ZZZ id 공간 충돌 — ZZZ 게임 상태에서는 HSR 전용 ITEM_NAMES 사전을
// 참조하면 안 되고 raw(API가 이미 현지화한 이름)가 이겨야 한다. 리뷰에서 실증된
// 충돌 id(1221→운리 등)로 검증한다.
window.ITEM_NAMES = {
  '1221': { ko: '운리', en: 'Yunli', zh: '云璃', ja: 'ユンリー' }, // HSR 캐릭터
};
I.setLang('ko');
window.WarpData = { game: () => 'hsr' };
assert.strictEqual(I.itemName('1221', '운리'), '운리', 'hsr: 사전이 이긴다');
window.WarpData = { game: () => 'zzz' };
assert.strictEqual(I.itemName('1221', '청작'), '청작', 'zzz: raw(API 현지화 이름)가 이긴다 — HSR 사전 충돌 무시');
delete window.WarpData;
assert.strictEqual(I.itemName('1221', '운리'), '운리', 'WarpData 없으면 hsr로 가정(기존 단일 게임 동작 보존)');

// 10) 게임별 용어 오버레이(i18n/game.js).
{
  const OVR = window.I18N_GAME_DICTS;
  assert.ok(OVR && OVR.zzz, 'I18N_GAME_DICTS.zzz 가 없다');

  // 10-1) 오버레이 키는 전부 기본 사전에 존재해야 한다 — 오타난 키는 조용히 무시되므로
  //       화면엔 HSR 어휘가 그대로 남는다. 여기서 잡지 않으면 발견이 불가능하다.
  // 10-2) 오버레이 언어들끼리 키 집합이 같아야 한다(한 언어만 번역돼 절반만 바뀌는 것 방지).
  for (const [gameID, byLang] of Object.entries(OVR)) {
    const langKeys = Object.keys(byLang).map((l) => Object.keys(byLang[l]).sort());
    for (const l of Object.keys(byLang)) {
      assert.ok(DICTS[l], `${gameID} 오버레이가 미지원 언어 ${l} 를 담고 있다`);
      for (const k of Object.keys(byLang[l])) {
        assert.ok(k in DICTS.ko, `${gameID}/${l} 오버레이 키가 기본 사전에 없다: ${k}`);
      }
    }
    for (const ks of langKeys) {
      assert.deepStrictEqual(ks, langKeys[0], `${gameID} 오버레이 언어별 키 집합 불일치`);
    }
  }

  // 10-3) 조회 우선순위: 오버레이[lang] → 오버레이.en → 기본 사전.
  window.WarpData = { game: () => 'zzz' };
  I.setLang('ko');
  assert.strictEqual(I.t('rank.r5'), 'S급', 'zzz/ko 오버레이');
  assert.strictEqual(I.t('result.win'), '픽승', '오버레이에 없는 키는 기본 사전');
  I.setLang('en');
  assert.strictEqual(I.t('rank.r5'), 'S-Rank', 'zzz/en 오버레이');
  I.setLang('ja');
  assert.strictEqual(I.t('rank.r5'), 'S-Rank', 'ja 번역 부재 → en 폴백');
  assert.strictEqual(I.t('result.win'), DICTS.ja['result.win'], '오버레이 미대상 키는 ja 그대로');

  // 10-4) 보간은 오버레이 값에도 적용된다.
  I.setLang('ko');
  assert.strictEqual(I.t('bannercards.nextOdds', { odds: '50/50' }), '다음 S급 50/50');

  // 10-5) HSR 은 오버레이가 없으므로 기본 사전이 그대로 보인다.
  window.WarpData = { game: () => 'hsr' };
  assert.strictEqual(I.t('rank.r5'), '5★', 'hsr 은 기본 사전');
  assert.strictEqual(I.t('header.title2'), DICTS.ko['header.title2']);
  delete window.WarpData;
}

console.log('i18n.test.js OK');
