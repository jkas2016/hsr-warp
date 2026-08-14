const assert = require('assert');

// 공유 PNG 내보내기의 순수 로직 가드. DOM 합성/캡처 함수는 jsdom 이 없어 여기서 검증하지 않는다
// (실기기·브라우저 육안 검증에 의존한다 — 설계 문서 8장).
global.window = global;
require('./share.js');
const { SECTIONS, selectSections, maskUid, shareFileName } = window.WarpShare;

// --- 공개 API 표면 ---

// 0) 7개 키가 전부 있어야 한다. DOM 함수 3개(presentSections/exportPng/saveBlob)는
//    jsdom 이 없어 호출은 못 하지만, 이름이 바뀌면 ShareModal.jsx 가 런타임에 터진다.
//    이 단언이 없으면 오타 rename 을 npm test 가 통째로 놓친다.
for (const k of ['SECTIONS', 'selectSections', 'maskUid', 'shareFileName',
                 'presentSections', 'exportPng', 'saveBlob']) {
  assert.ok(window.WarpShare[k], 'window.WarpShare.' + k + ' 가 없다 — ShareModal.jsx 가 이 이름으로 호출한다');
}

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
  'FivesTable.jsx', 'Dashboard.jsx',
];
const byFile = {};
for (const f of JSX_FILES) byFile[f] = fs.readFileSync(path.join(__dirname, f), 'utf8');
const src = JSX_FILES.map((f) => byFile[f]).join('\n');

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

// --- data-share-omit 마커: 인터랙티브 컨트롤이 공유 이미지에 찍히지 않는가 ---
// exportPng 은 클론에서 [data-share-omit] 을 지운다. 마커가 사라지면 조회 실패가 아니라
// "컨트롤이 그대로 찍힌 PNG" 라는 조용한 품질 저하로 나타나므로 정적으로 개수를 지킨다.

// 18) 최소 6곳에 있어야 한다(현재: BannersView 배너 피커, Dashboard 헤더 컨트롤,
//     FivesTable 페이지네이션, HistoryView 필터, OverviewView 전체보기, VersionsView 필터).
const omitCount = (src.match(/data-share-omit/g) || []).length;
assert.ok(
  omitCount >= 6,
  'data-share-omit 마커가 ' + omitCount + '개뿐이다(최소 6). 마커를 지운 컨트롤이 공유 PNG 에 그대로 찍힌다',
);

// 19) 헤더 컨트롤 그룹은 특히 중요하다 — 여기가 빠지면 새로고침·언어·테마 버튼과
//     공유 버튼 자신이 모든 공유 이미지 맨 위에 찍힌다.
assert.ok(
  byFile['Dashboard.jsx'].includes('data-share-omit'),
  'Dashboard.jsx 헤더 컨트롤 그룹에 data-share-omit 이 없다 — 공유 버튼 자신이 PNG 에 찍힌다',
);

// --- i18n 정합: 레지스트리의 labelKey 가 4개 로케일에 전부 있는가 ---
require('./i18n/ko.js');
require('./i18n/en.js');
require('./i18n/zh.js');
require('./i18n/ja.js');

// 16) 모든 섹션 labelKey 가 4개 로케일에 존재해야 한다.
//     (i18n.test.js 가 키 집합 일치를 따로 강제하지만, 여기서는 '레지스트리 ↔ 사전' 연결을 본다.)
for (const loc of ['ko', 'en', 'zh', 'ja']) {
  const dict = window.I18N_DICTS[loc];
  for (const s of SECTIONS) {
    assert.ok(dict[s.labelKey], loc + ' 사전에 ' + s.labelKey + ' 가 없다');
  }
  // 17) 모달 자체 문구도 4개 로케일에 있어야 한다.
  for (const k of ['share.button', 'share.title', 'share.sections', 'share.maskUid',
                   'share.export', 'share.exporting', 'share.failed', 'share.saveHint']) {
    assert.ok(dict[k], loc + ' 사전에 ' + k + ' 가 없다');
  }
}

// --- 720px 박스 그리드: 어떤 폭 미디어 쿼리를 박스 안에 적용할지 ---
// narrowGridCss 는 document.styleSheets 를 읽으므로 node 에서 직접 못 부른다.
// 판정 술어만 share.js 원문에서 떼어내 실행한다(로직을 여기에 복제하지 않는다).
const shareSrc = fs.readFileSync(path.join(__dirname, 'share.js'), 'utf8');
const predSrc = shareSrc.match(/function widthCondMatches\(cond\) \{[\s\S]*?\n {2}\}/);
assert.ok(predSrc, 'share.js 에서 widthCondMatches 를 찾지 못했다 — 이름이 바뀌면 이 가드가 죽는다');
const widthCondMatches = new Function('SHARE_WIDTH', predSrc[0] + '\nreturn widthCondMatches;')(720);

// 20) 720px 박스에서 성립하는 폭 조건만 골라야 한다.
//     (max-width:920px 는 720 에 적용됨 → 좁은 그리드가 박스 안에 항상 걸린다)
assert.strictEqual(widthCondMatches('(max-width: 920px)'), true, '720px 박스는 max-width:920px 블록에 해당한다');
assert.strictEqual(widthCondMatches('(max-width:920px)'), true, '공백 없는 표기도 같게 처리해야 한다');
assert.strictEqual(widthCondMatches('(max-width: 700px)'), false, '720px 박스는 max-width:700px 블록에 해당하지 않는다');
assert.strictEqual(widthCondMatches('(min-width: 900px)'), false, '720px 박스는 min-width:900px 블록에 해당하지 않는다');
assert.strictEqual(widthCondMatches('(min-width: 600px)'), true, '720px 박스는 min-width:600px 블록에 해당한다');

// 21) 폭 조건이 아닌 미디어 쿼리는 절대 대상이 아니다(애니메이션 정책까지 덮어쓰면 안 된다).
assert.strictEqual(widthCondMatches('(prefers-reduced-motion: reduce)'), false, '폭 조건이 없으면 대상 아님');
assert.strictEqual(widthCondMatches('print'), false, '폭 조건이 없으면 대상 아님');

// 22) 데스크톱 그리드를 720px 박스에 강제하지 않는다(옛 widthMediaOverrideCss 회귀 방어).
//     강제하면 4~5열 칸이 화면의 1/3 이하로 좁아져 카드 내용이 슬롯을 넘치고 잘린다.
assert.ok(
  !/widthMediaOverrideCss/.test(shareSrc),
  'share.js 가 다시 데스크톱 그리드를 720px 박스에 강제하고 있다 — 카드 내용 잘림이 재발한다',
);

console.log('share.test.js OK');
