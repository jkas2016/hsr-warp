// ZZZ 분석 회귀 테스트. HSR 과 구조적으로 동형이므로 50/50 판정 함수는
// 그대로 두고, 배너 코드·랭크 코드만 주입으로 갈리는지 확인한다.
const assert = require('assert');
const { analyze, resolveConfig, filterAnalysis, analyzeVersions } = require('./analyze.js');

// 공시 원문 기준 ZZZ 설정. expAvg = 1 / 종합확률.
// order: HSR과 달리 숫자 오름차순(1,2,3,5)이 아니라 독점(2)이 먼저 오는 표시 순서를
// 명시적으로 검증하기 위해 일부러 Object.keys() 재정렬 결과와 다르게 둔다.
const ZZZ = {
  ranks: { top: '4', mid: '3' },
  order: ['2', '3', '1', '5'],
  banners: {
    '2': { role: 'limited-char', short: '독점', cap: 90, rateUp: 0.5, expAvg: 62.5 },
    '3': { role: 'limited-weapon', short: 'W-엔진', cap: 80, rateUp: 0.75, expAvg: 50.0 },
    '1': { role: 'standard', short: '상시', cap: 90, rateUp: null, expAvg: 62.5 },
    '5': { role: 'bangboo', short: '방부', cap: 80, rateUp: null, expAvg: 50.0 },
  },
  schedule: [{ s: '2026-07-29', e: '2026-08-19', c: ['1501'], l: ['14158'] }],
  versions: [{ v: '2.5', s: '2026-07-29' }],
};

let id = 1000n;
const T = '2026-08-01 12:00:00';
// ZZZ 는 S급이 rank_type 4, A급이 3, B급이 2다(실측).
/**
 * ZZZ S급(rank_type 4) 기록 한 건.
 * @param {string|number} item_id
 * @param {string} [gacha_type='2'] 채널 코드.
 * @param {string} [time=T] 뽑은 시각.
 * @returns {Object}
 */
const s4 = (item_id, gacha_type = '2', time = T) => ({
  id: String(id++), rank_type: '4', item_id: String(item_id),
  name: 'x', item_type: '에이전트', time, gacha_type,
});
/**
 * ZZZ A/B급 기록 한 건.
 * @param {string|number} rank 희귀도(3=A, 2=B).
 * @param {string} [gacha_type='2'] 채널 코드.
 * @param {string} [time=T] 뽑은 시각.
 * @returns {Object}
 */
const low = (rank, gacha_type = '2', time = T) => ({
  id: String(id++), rank_type: String(rank), item_id: '0',
  name: 'y', item_type: 'W-엔진', time, gacha_type,
});

// ---- 설정 주입 ----
{
  const cfg = resolveConfig(ZZZ);
  assert.strictEqual(cfg.ranks.top, '4', 'ZZZ 최고등급 코드');
  assert.strictEqual(cfg.ranks.mid, '3', 'ZZZ 중간등급 코드');
  assert.strictEqual(cfg.banners['3'].expAvg, 50.0, '음의 엔진 기준선');
  assert.deepStrictEqual(cfg.list, ZZZ.schedule, '픽업 일정 통과');
}

// ---- order: Object.keys() 정수 유사 키 재정렬 방지 (schedule.order 우선) ----
// JS는 '11'/'2' 같은 배열 인덱스 유사 문자열 키를 오름차순 숫자로 재정렬해 반환하므로,
// schedule.order 를 명시하지 않으면 배너 표시 순서가 조용히 뒤집힌다.
{
  const fullSchedule = require('./schedule.json'); // 이제 order 필드를 담는다(객체 형태로 통째 전달)
  const hsrCfg = resolveConfig(fullSchedule);
  assert.deepStrictEqual(hsrCfg.order, ['11', '12', '1', '2'], 'HSR 배너 표시 순서(캐릭터·광추·일반·출발)');

  const zzzCfg = resolveConfig(ZZZ);
  assert.deepStrictEqual(zzzCfg.order, ['2', '3', '1', '5'], 'ZZZ 배너 표시 순서(독점·W-엔진·상시·방부)');
}

// ---- 구 스키마 호환: 배열이 들어오면 HSR 기본값 ----
{
  const cfg = resolveConfig([{ s: '2023-04-26', e: '2023-05-17', c: ['1102'], l: ['23001'] }]);
  assert.strictEqual(cfg.ranks.top, '5', '구 스키마는 HSR 랭크로 폴백');
  assert.strictEqual(cfg.ranks.mid, '4');
  assert.strictEqual(cfg.banners['11'].expAvg, 62.5, '구 스키마는 HSR 배너로 폴백');
}

// ---- ZZZ 랭크 코드로 집계 ----
{
  id = 2000n;
  const list = [...Array(5)].map(() => low(2)).concat(low(3), s4(1501));
  const out = analyze({ info: {}, list }, ZZZ);
  assert.strictEqual(out.count5, 1, 'rank_type 4 를 최고등급으로 셌다');
  assert.strictEqual(out.count4, 1, 'rank_type 3 을 중간등급으로 셌다');
  assert.strictEqual(out.count3, 5, 'rank_type 2 를 그 외로 셌다');
}

// ---- 독점 채널 50/50 전이 (HSR 과 동일 규칙) ----
{
  id = 3000n;
  // 1501 은 픽업, 9999 는 비픽업 → 픽뚫 후 다음 S급은 확정.
  const list = [s4(9999), s4(1501)];
  const out = analyze({ info: {}, list }, ZZZ);
  const b = out.banners.find((x) => x.type === '2');
  assert.strictEqual(b.stats.fives[0].result, 'loss', '비픽업은 픽뚫');
  assert.strictEqual(b.stats.fives[1].result, 'guaranteed', '픽뚫 다음은 확정');
  assert.strictEqual(b.stats.fives[1].fromGuarantee, true);
}

// ---- 음의 엔진 채널 75/25 ----
{
  id = 4000n;
  const out = analyze({ info: {}, list: [s4(14158, '3')] }, ZZZ);
  const b = out.banners.find((x) => x.type === '3');
  assert.strictEqual(b.meta.rateUp, 0.75, '음의 엔진 픽업 확률');
  assert.strictEqual(b.meta.cap, 80, '음의 엔진 하드천장');
  assert.strictEqual(b.stats.fives[0].result, 'win', '픽업 S급은 픽승');
}

// ---- 본디 채널: 천장·평균은 집계되되 50/50 판정 없음 ----
{
  id = 5000n;
  const list = [...Array(9)].map(() => low(2, '5')).concat(s4(53001, '5'));
  const out = analyze({ info: {}, list }, ZZZ);
  const b = out.banners.find((x) => x.type === '5');
  assert.strictEqual(b.stats.count5, 1, '본디 S급 집계');
  assert.strictEqual(b.stats.avgPity5, 10, '본디 평균 뽑기 집계');
  assert.strictEqual(b.stats.fives[0].result, null, '본디는 50/50 판정 없음');
  assert.strictEqual(b.meta.rateUp, null);
}

// ---- 상시 채널: 픽업 판정 없음 ----
{
  id = 6000n;
  const out = analyze({ info: {}, list: [s4(1501, '1')] }, ZZZ);
  const b = out.banners.find((x) => x.type === '1');
  assert.strictEqual(b.stats.fives[0].result, null, '상시는 픽업 판정 없음');
  assert.strictEqual(b.stats.fives[0].isPickup, null);
}

// ---- 합산 한정 지표는 role 로 고른다 ----
{
  id = 7000n;
  const list = [s4(1501, '2'), s4(14158, '3')];
  const out = analyze({ info: {}, list }, ZZZ);
  assert.strictEqual(out.luck.limited.count5, 2, '독점+음의엔진이 합산됐다');
  // 기준선은 5★ 개수 가중 평균: (62.5*1 + 50.0*1) / 2
  assert.strictEqual(out.luck.limited.base, 56.25, '가중 기준선');
}

// ---- BigInt id 정렬 불변식 ----
{
  id = 8000n;
  const big = { ...s4(1501), id: '1785859200000027932' };
  const small = { ...s4(1501), id: '999999999999999999' };
  const out = analyze({ info: {}, list: [big, small] }, ZZZ);
  assert.strictEqual(out.total, 2);
  const b = out.banners.find((x) => x.type === '2');
  assert.ok(b.stats.fives.length === 2, '거대 정수 id 가 정렬돼 처리됐다');
}

// ---- cfg 폴백 체인 (filterAnalysis): cfg 인자 없이 analyze() 결과를 재사용해도
// HSR 기본값으로 조용히 틀리게 계산되지 않는다(analyze() 가 실은 _cfg 로 복원) ----
// 주의: filtered.total(원본 리스트 시각 필터 길이)과 banner.stats.count5(analyze() 가
// 이미 분류해 둔 fives 를 그대로 복사한 값)는 cfg 에 의존하지 않으므로 이 회귀를 못 잡는다.
// cfg 에 실제로 의존하는 건 배너별 stats.total(cnt 맵 — cfg.order 로 초기화)과
// luck.charAvgPity/limited(codesByRole 로 역할별 코드를 찾는 경로)다.
// gacha_type '3'(W-엔진)·'5'(본디)는 HSR ORDER(['11','12','1','2'])에 없는 코드라,
// cfg 가 HSR 로 잘못 폴백되면 cnt 맵에 키가 없어 해당 배너의 stats.total 이 0으로 버려진다.
{
  id = 9000n;
  const list = [
    ...[...Array(3)].map(() => low(2, '3')), s4(14158, '3'), // W-엔진: 3성 3건 + 5★ 1건 = 4건
    ...[...Array(2)].map(() => low(2, '5')), s4(53001, '5'), // 본디  : 3성 2건 + 5★ 1건 = 3건
  ];
  const full = analyze({ info: {}, list }, ZZZ);
  assert.ok(full._cfg, 'analyze() 결과가 사용한 cfg 를 실어 보낸다');

  // cfg 인자 없이 호출 — data.js 의 기존 두 호출부와 동일한 형태(3번째 인자까지만 전달).
  const win = { v: 'all', s: 0, e: Infinity };
  const filtered = filterAnalysis(full, { list }, win);
  const b3 = filtered.banners.find((x) => x.type === '3');
  const b5 = filtered.banners.find((x) => x.type === '5');
  assert.ok(b3, 'W-엔진 배너가 cfg 없이도 인식됐다');
  assert.strictEqual(b3.stats.total, 4, 'W-엔진 stats.total — HSR cfg 로 폴백되면 cnt 맵에 키가 없어 0');
  assert.ok(b5, '본디 배너가 cfg 없이도 인식됐다');
  assert.strictEqual(b5.stats.total, 3, '본디 stats.total — HSR cfg 로 폴백되면 cnt 맵에 키가 없어 0');
  // luck 경로도 cfg 에 의존한다: codesByRole(cfg,'limited-char')[0] 이 ZZZ면 '2', HSR 폴백이면 '11'.
  assert.ok(filtered.luck.limited, 'luck.limited 계산됨');
  assert.strictEqual(filtered.luck.limited.count5, 1, '한정(독점+W-엔진) 5★ 집계 — HSR 코드로 폴백되면 배너를 못 찾아 0');
}

// ---- cfg 폴백 체인 (analyzeVersions): cfg 인자 없이도 버전별 한정 배너 집계가 맞는다 ----
// char/lc 는 charCode=codesByRole(cfg,'limited-char')[0] 로 a.banners 를 찾는 경로라
// cfg 가 HSR 로 잘못 폴백되면 charCode='11'이 되어 ZZZ 배너('2')를 못 찾고 count5=0 이 된다.
{
  id = 9050n;
  const VERS_Z = [{ v: '2.5', s: '2026-07-29' }];
  const list = [s4(1501, '2')]; // 독점(limited-char) 픽업 1건
  const full = analyze({ info: {}, list }, ZZZ);
  const rows = analyzeVersions(full, { list }, VERS_Z); // cfg 인자 없음
  const row = rows.find((r) => r.v === '2.5');
  assert.ok(row, '2.5 윈도우 집계됨');
  assert.strictEqual(row.char.count5, 1, '독점 배너 5★ 집계 — HSR cfg 로 폴백되면 배너 코드 불일치로 0');
  assert.strictEqual(row.all.count5, 1, '한정 합산도 동일 경로 — 폴백되면 0');
}

// ---- charLuckPct 는 하드코딩 62.5 가 아니라 cfg 의 limited-char expAvg 를 쓴다 ----
// (위 ZZZ 픽스처는 하필 62.5 라 회귀를 못 잡는다 — 다른 기준선으로 별도 검증.)
{
  id = 9100n;
  const CUSTOM = {
    ranks: { top: '4', mid: '3' },
    order: ['2', '1'],
    banners: {
      '2': { role: 'limited-char', short: '독점', cap: 90, rateUp: 0.5, expAvg: 40 },
      '1': { role: 'standard', short: '상시', cap: 90, rateUp: null, expAvg: 40 },
    },
    schedule: [{ s: '2026-07-29', e: '2026-08-19', c: ['1501'], l: [] }],
    versions: [{ v: '2.5', s: '2026-07-29' }],
  };
  // pity 20 에 픽업 획득 → luckPct = (40-20)/40*100 = 50. 62.5 기준이면 (62.5-20)/62.5*100 = 68 로 달라진다.
  const list = [...Array(19)].map(() => low(2, '2')).concat(s4(1501, '2'));
  const out = analyze({ info: {}, list }, CUSTOM);
  assert.strictEqual(out.luck.charAvgPity, 20, '캐릭 평균 뽑기 20');
  assert.ok(Math.abs(out.luck.charLuckPct - 50) < 1e-9, 'charLuckPct 는 cfg 의 expAvg(40) 기준, 62.5 하드코딩이면 어긋난다');
}

// ---- codesByRole 가드: order 에 banners 없는 코드가 섞여도 TypeError로 죽지 않는다 ----
// (원격 schedule.json 오배포로 order/banners 가 어긋나는 상황을 재현. F3)
{
  const BROKEN = {
    ranks: { top: '4', mid: '3' },
    order: ['2', '99'], // '99' 는 banners 에 없음
    banners: {
      '2': { role: 'limited-char', short: '독점', cap: 90, rateUp: 0.5, expAvg: 62.5 },
    },
    schedule: [],
    versions: [{ v: '2.5', s: '2026-07-29' }],
  };
  id = 9200n;
  assert.doesNotThrow(() => {
    const out = analyze({ info: {}, list: [s4(1501, '2')] }, BROKEN);
    assert.strictEqual(out.luck.limited.count5, 1, '유효한 코드만으로도 정상 집계됨');
  }, 'order 의 미등록 코드가 codesByRole 에서 TypeError를 던지면 안 된다');
}

console.log('OK  analyze.zzz tests passed');
