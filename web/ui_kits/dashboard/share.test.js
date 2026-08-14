const assert = require('assert');

// 공유 PNG 내보내기의 순수 로직 가드. DOM 합성/캡처 함수는 jsdom 이 없어 여기서 검증하지 않는다
// (실기기·브라우저 육안 검증에 의존한다 — 설계 문서 8장).
global.window = global;
require('./share.js');
const { SECTIONS, selectSections, maskUid, shareFileName } = window.WarpShare;

// --- SECTIONS 레지스트리 ---

// 1) id 중복이 없어야 한다. DOM 마커와 1:1 대응이 깨지면 섹션이 조용히 사라진다.
const ids = SECTIONS.map((s) => s.id);
assert.strictEqual(new Set(ids).size, ids.length, 'SECTIONS 에 중복 id 가 있다');

// 2) 모든 항목이 id 와 labelKey 를 가진다.
for (const s of SECTIONS) {
  assert.ok(s.id && typeof s.id === 'string', 'SECTIONS 항목에 id 가 없다');
  assert.ok(/^share\.section\./.test(s.labelKey), 'labelKey 는 share.section.* 형식이어야 한다: ' + s.id);
}

// --- selectSections: 화면에 실재하는 섹션 ∩ 체크된 섹션, DOM 순서 보존 ---

// 3) DOM 순서를 따른다(체크 순서가 아니라).
assert.deepStrictEqual(
  selectSections(['hero', 'banners', 'charts'], ['charts', 'hero']),
  ['hero', 'charts'],
);

// 4) 화면에 없는 섹션은 체크돼 있어도 빠진다(탭을 옮긴 뒤의 잔여 선택).
assert.deepStrictEqual(selectSections(['hero'], ['hero', 'versions']), ['hero']);

// 5) 레지스트리에 없는 id 는 무시한다.
assert.deepStrictEqual(selectSections(['hero', 'bogus'], ['hero', 'bogus']), ['hero']);

// 6) 아무것도 체크하지 않으면 빈 배열 — 내보내기 버튼 비활성화의 근거다.
assert.deepStrictEqual(selectSections(['hero', 'charts'], []), []);

// --- maskUid: 순수 문자열 치환 ---

// 7) uid 를 같은 길이의 • 로 바꾼다.
assert.strictEqual(maskUid('UID 800123456 · 전체 기록', '800123456'), 'UID ••••••••• · 전체 기록');

// 8) 한 문자열에 여러 번 나와도 전부 바꾼다.
assert.strictEqual(maskUid('800123456 / 800123456', '800123456'), '••••••••• / •••••••••');

// 9) uid 가 없으면(빈 문자열·null) 원본 그대로 — 마스킹 OFF 및 UID 미노출 계정 방어.
assert.strictEqual(maskUid('UID 없음', ''), 'UID 없음');
assert.strictEqual(maskUid('UID 없음', null), 'UID 없음');

// 10) uid 가 포함되지 않은 문자열은 건드리지 않는다.
assert.strictEqual(maskUid('평균 뽑기 62.5', '800123456'), '평균 뽑기 62.5');

// --- shareFileName ---

// 11) 로컬 시각 기준 hsr-warp-YYYYMMDD-HHmm.png (월은 0-based 이므로 7 = 8월).
assert.strictEqual(shareFileName(new Date(2026, 7, 14, 15, 30)), 'hsr-warp-20260814-1530.png');

// 12) 한 자리 월·일·시·분은 0 으로 채운다.
assert.strictEqual(shareFileName(new Date(2026, 0, 5, 9, 7)), 'hsr-warp-20260105-0907.png');

// --- 마커 정합: SECTIONS 의 모든 id 가 실제 .jsx 에 data-share 로 존재하는가 ---
// (.jsx 는 브라우저 babel 전용이라 require 할 수 없다 — 소스를 읽어 정적 검사한다.)
const fs = require('fs');
const path = require('path');

const JSX_FILES = [
  'HeroSummary.jsx', 'BannerCards.jsx', 'ChartsGrid.jsx', 'MonthlyTable.jsx',
  'OverviewView.jsx', 'BannersView.jsx', 'HistoryView.jsx', 'VersionsView.jsx',
  'Dashboard.jsx',
];
const src = JSX_FILES
  .map((f) => fs.readFileSync(path.join(__dirname, f), 'utf8'))
  .join('\n');

// 13) 레지스트리의 모든 섹션 id 에 대응하는 data-share 마커가 있어야 한다.
for (const s of SECTIONS) {
  assert.ok(
    src.includes('data-share="' + s.id + '"'),
    'data-share="' + s.id + '" 마커가 .jsx 어디에도 없다 — 이 섹션은 공유 목록에 절대 나타나지 않는다',
  );
}

// 14) 반대로, 소스에 있는 data-share 값은 전부 레지스트리에 있어야 한다(오타 방어).
const marked = [...src.matchAll(/data-share="([^"]+)"/g)].map((m) => m[1]);
for (const id of marked) {
  assert.ok(ids.includes(id), 'data-share="' + id + '" 가 SECTIONS 레지스트리에 없다');
}

// 15) 헤더 마커는 정확히 하나여야 한다(합성 시 querySelector 로 잡는다).
assert.strictEqual(
  (src.match(/data-share-header/g) || []).length, 1,
  'data-share-header 는 Dashboard.jsx 의 <header> 에 정확히 하나 있어야 한다',
);

console.log('share.test.js OK');
