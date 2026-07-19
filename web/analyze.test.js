const assert = require('assert');
const { analyzeBanner, analyze, monthly, BANNERS, aggregateFives } = require('./analyze.js');
const { schedule, versions } = require('./schedule.json'); // 배너 일정은 데이터 파일에서 주입

let id = 1000n;
// 3.7 phase 1 (2025-11-04..11-25): featured char includes 1415,1409 ; featured lc includes 23052.
const T = '2025-11-10 12:00:00';
const r5 = (item_id, time = T) => ({ id: String(id++), rank_type: '5', item_id: String(item_id), name: 'x', item_type: 'C', time, gacha_type: '11' });
const r34 = (rank, time = T) => ({ id: String(id++), rank_type: String(rank), item_id: '0', name: 'y', item_type: 'C', time, gacha_type: '11' });

// ---- pity ----
const seq = ['3', '3', '3', '4', '3'].map(r => r34(r)).concat([r5(1415)]); // 6 pulls, 5* at pity 6
const b = analyzeBanner(seq, BANNERS['11'], schedule);
assert.strictEqual(b.total, 6);
assert.strictEqual(b.count5, 1);
assert.strictEqual(b.fives[0].pity, 6, 'pity counts the winning pull');
assert.strictEqual(b.currentPity5, 0, 'reset after 5*');

// ---- 50/50 (schedule-based, all within 3.7 p1): loss -> guaranteed win -> contested win -> loss ----
id = 5000n;
const banner11 = [
  r5(1102),  // Seele NOT featured in 3.7 -> contested LOSS -> guaranteed
  r5(1415),  // featured -> guaranteed WIN
  r5(1409),  // featured -> contested WIN
  r5(1102),  // not featured -> contested LOSS -> guaranteed
];
const s = analyzeBanner(banner11, BANNERS['11'], schedule);
assert.strictEqual(s.contested, 3, '3 contested (#1,#3,#4)');
assert.strictEqual(s.cWins, 1, '1 contested win');
assert.strictEqual(s.cLoss, 2, '2 contested losses');
assert.strictEqual(s.gWins, 1, '1 guaranteed win');
assert.strictEqual(s.pickupTotal, 2, 'featured obtained = contested wins + guaranteed wins');
assert.ok(Math.abs(s.win5050Rate - 1 / 3) < 1e-9, '50/50 win rate = 1/3');
assert.strictEqual(s.currentGuaranteed, true, 'ends on loss -> next guaranteed');
assert.deepStrictEqual(s.fives.map(f => f.result), ['loss', 'guaranteed', 'win', 'loss']);
assert.deepStrictEqual(s.fives.map(f => f.isPickup), [false, true, true, false]);
assert.strictEqual(s.unknown5, 0, 'all ids covered by schedule');

// ---- core fix: win/loss depends on TIME, not pool membership ----
id = 5200n;
const win10 = analyzeBanner([r5(1102, '2023-05-01 00:00:00')], BANNERS['11'], schedule); // 1.0 p1: Seele featured
assert.strictEqual(win10.fives[0].result, 'win', 'Seele during 1.0 p1 = 픽승');
const loss37 = analyzeBanner([r5(1102, '2025-11-10 00:00:00')], BANNERS['11'], schedule); // 3.7 p1: not featured
assert.strictEqual(loss37.fives[0].result, 'loss', 'Seele during 3.7 p1 = 픽뚫');

// ---- unidentified: time outside the known schedule ----
id = 5500n;
const u = analyzeBanner([r5(1415, '2030-01-01 00:00:00')], BANNERS['11'], schedule);
assert.strictEqual(u.fives[0].unidentified, true, 'no period -> unidentified');
assert.strictEqual(u.fives[0].result, null, 'unidentified not classified');
assert.strictEqual(u.fives[0].isPickup, null);
assert.strictEqual(u.unknown5, 1);
assert.strictEqual(u.contested, 0, 'unidentified excluded from 50/50');

// ---- light cone (banner 12), 3.7 p1: 23052 featured, 23000 standard ----
const r5lc = (iid, time = T) => ({ id: String(id++), rank_type: '5', item_id: String(iid), name: 'z', item_type: 'L', time, gacha_type: '12' });
const banner12 = [r5lc(23000) /*standard -> loss*/, r5lc(23052) /*featured -> guaranteed*/];
const sl = analyzeBanner(banner12, BANNERS['12'], schedule);
assert.deepStrictEqual(sl.fives.map(f => f.result), ['loss', 'guaranteed'], 'LC: loss then guaranteed');
assert.strictEqual(sl.unknown5, 0);

// ---- luck (소프트천장/early 제거 확인) ----
id = 6000n;
const lk = analyzeBanner([r5(1415)], BANNERS['11'], schedule); // pity 1, featured -> 픽승, 매우 행운
assert.ok(lk.luckPct > 90, 'pity 1 is ~98% luckier than 62.5 avg');
assert.strictEqual(lk.fives[0].result, 'win');
assert.ok(!('earlyCount' in lk), 'soft-pity earlyCount removed');
assert.ok(!('earlyRate' in lk), 'soft-pity earlyRate removed');

// ---- monthly bucketing ----
const mlist = [
  { rank_type: '5', gacha_type: '11', name: 'a', item_id: '1009', time: '2025-01-15 10:00:00' },
  { rank_type: '3', gacha_type: '11', name: 'b', item_id: '0', time: '2025-01-20 10:00:00' },
  { rank_type: '4', gacha_type: '12', name: 'c', item_id: '0', time: '2025-02-02 10:00:00' },
];
const mo = monthly(mlist);
assert.strictEqual(mo.length, 2, 'two months');
assert.strictEqual(mo[0].month, '202501');
assert.strictEqual(mo[0].total, 2);
assert.strictEqual(mo[0].c5, 1);
assert.strictEqual(mo[0].jade, 320);
assert.strictEqual(mo[1].month, '202502');
// 5★ 월별 목록은 이름 로컬라이즈용 item_id 를 실어 나른다(표시는 대시보드 렌더 지점).
assert.strictEqual(mo[0].fives[0].item_id, '1009', 'monthly 5★ carries item_id');

// ---- analyze() integration ----
id = 7000n;
const data = { info: { uid: '1' }, list: [r5(1102), r5(1415), r34(3), { ...r5lc(23000) }] };
const A = analyze(data, schedule);
assert.ok(A.banners.length >= 1);
assert.strictEqual(A.count5, 3);
assert.strictEqual(A.unknown5, 0, 'account-wide unknown5 exposed');
assert.ok(A.luck.charBanner, 'char banner luck present');
assert.ok(A.all5[0].time >= A.all5[A.all5.length - 1].time, 'all5 newest first');

// ---- #22: 5★ rows carry the unique record id (stable per-row React key) ----
id = 7100n;
const idData = { info: {}, list: [r5(1102), r5(1415), r5(1409)] };
const AI = analyze(idData, schedule);
AI.banners.forEach((bn) => bn.stats.fives.forEach((f) => {
  assert.ok(typeof f.id === 'string' && /^\d+$/.test(f.id), '5★ carries string bigint id');
}));
const rowIds = AI.all5.map((f) => f.id);
assert.ok(rowIds.every((x) => x != null), 'every all5 row has an id');
assert.strictEqual(new Set(rowIds).size, rowIds.length, 'all5 ids are unique — safe as keys');

// ---- schedule 누락 방어: throw 없이 모두 unidentified ----
id = 8000n;
const noSched = analyzeBanner([r5(1415)], BANNERS['11'], []);
assert.strictEqual(noSched.fives[0].unidentified, true, 'empty schedule -> unidentified, no throw');

// ---- aggregateFives: 분류된 fives에서 요약치 재계산 ----
const sampleFives = [
  { pity: 70, result: 'guaranteed', fromGuarantee: true, unidentified: false },
  { pity: 50, result: 'win',  fromGuarantee: false, unidentified: false },
  { pity: 80, result: 'loss', fromGuarantee: false, unidentified: false },
  { pity: 10, result: null, fromGuarantee: false, unidentified: true },
];
const agg = aggregateFives(sampleFives, BANNERS['11']);
assert.strictEqual(agg.count5, 4);
assert.strictEqual(agg.contested, 2, 'win+loss=contested');
assert.strictEqual(agg.cWins, 1);
assert.strictEqual(agg.cLoss, 1);
assert.strictEqual(agg.gWins, 1);
assert.strictEqual(agg.unknown5, 1);
assert.strictEqual(agg.pickupTotal, 2, 'cWins+gWins');
assert.ok(Math.abs(agg.win5050Rate - 0.5) < 1e-9, '1승/2contested');
assert.strictEqual(agg.bestPity, 10);
assert.strictEqual(agg.worstPity, 80);
assert.ok(Math.abs(agg.avgPity5 - 52.5) < 1e-9, '(70+50+80+10)/4');
assert.ok(Math.abs(agg.luckPct - (62.5 - 52.5) / 62.5 * 100) < 1e-9, 'luckPct from sample');

// ---- filterAnalysis: 버전 경계를 넘는 5★의 천장·결과 보존 ----
const { filterAnalysis, versionWindows } = require('./analyze.js');
const VERS = [{ v: '3.6', s: '2025-09-23' }, { v: '3.7', s: '2025-11-04' }, { v: '3.8', s: '2025-12-16' }];

// 윈도우: 3.7 = [2025-11-04, 2025-12-16)
const w = versionWindows(VERS);
assert.strictEqual(w.length, 3);
assert.strictEqual(w[1].v, '3.7');
assert.strictEqual(w[2].e, Infinity, '마지막 버전 끝은 무한');

// 시나리오: 3.6에서 픽뚫(loss→확정) 적립, 3.7에서 70천장 확정 5★.
id = 9000n;
const r5t = (iid, t) => ({ id: String(id++), rank_type: '5', item_id: String(iid), name: 'n', item_type: 'C', time: t, gacha_type: '11' });
const r3t = (t) => ({ id: String(id++), rank_type: '3', item_id: '0', name: 'y', item_type: 'C', time: t, gacha_type: '11' });
const recs = [];
recs.push(r5t(1102, '2025-10-01 00:00:00'));           // 3.6: Seele 비픽업 → loss → 확정
for (let i = 0; i < 69; i++) recs.push(r3t(i < 40 ? '2025-11-01 00:00:00' : '2025-11-10 00:00:00')); // 천장 적립(3.6→3.7 경계 넘음)
recs.push(r5t(1415, '2025-11-10 12:00:00'));           // 3.7: 확정 획득(70천장)

const vdata = { info: {}, list: recs };
const full = analyze(vdata, schedule);
const v37 = filterAnalysis(full, vdata, w[1]); // 3.7 윈도우

const b11 = v37.banners.find(b => b.type === '11');
const five = b11.stats.fives.find(f => f.item_id === '1415');
assert.ok(five, '3.7 윈도우에 1415 포함');
assert.strictEqual(five.pity, 70, '천장은 경계 넘어 적립된 70 그대로(잘리지 않음)');
assert.strictEqual(five.result, 'guaranteed', '3.6 픽뚫의 확정 상태 보존');
assert.strictEqual(b11.stats.gWins, 1, '확정 획득 1');
assert.strictEqual(b11.stats.contested, 0, '3.7엔 contested 없음(확정만)');

// 뽑기 횟수는 시각 윈도우로 버킷: 3.7창엔 r3t 29개(2025-11-10) + 5★ 1개 = 30
assert.strictEqual(b11.stats.count5, 1, '3.7창 5★ 1개');
assert.strictEqual(b11.stats.total, 30, '3.7창 뽑기 30(11-10 29건 + 5★)');
assert.strictEqual(b11.stats.jade, 4800, '30*160');
assert.strictEqual(b11.stats.currentPity5, null, '과거 윈도우는 현재천장 의미없음 → null');

// 3.6 윈도우엔 loss 5★ + 3성 40개
const v36 = filterAnalysis(full, vdata, w[0]);
const b11_36 = v36.banners.find(b => b.type === '11');
assert.strictEqual(b11_36.stats.cLoss, 1, '3.6 픽뚫 1');
assert.strictEqual(b11_36.stats.total, 41, '3.6창 뽑기 41(loss 5★ + 3성 40)');

// 뽑기 0 버전 스코프: 배너를 제거하지 않고 0 통계로 유지한다
// (버전 콤보박스는 대응된 모든 버전을 노출하고, 무뽑기 버전 선택 시 0으로 표시).
const v38 = filterAnalysis(full, vdata, w[2]); // 3.8 윈도우: 기록 없음
const b11_38 = v38.banners.find(b => b.type === '11');
assert.ok(b11_38, '뽑기 0 윈도우에도 배너 유지');
assert.strictEqual(b11_38.stats.total, 0, '무뽑기 배너 total 0');
assert.strictEqual(b11_38.stats.count5, 0, '무뽑기 배너 5★ 0');
assert.strictEqual(v38.total, 0, '무뽑기 윈도우 총뽑기 0');

// 불변식: 전체 윈도우 필터 == analyze 핵심 수치
const wholeWin = { v: 'all', s: 0, e: Infinity };
const whole = filterAnalysis(full, vdata, wholeWin);
assert.strictEqual(whole.count5, full.count5, '전체창 5★ 수 일치');
assert.strictEqual(whole.total, full.total, '전체창 총뽑기 일치');

// ---- analyzeVersions: 버전별 비교 행 ----
const { analyzeVersions } = require('./analyze.js');
// 위 Task2의 full/vdata 재사용(3.6 loss + 3.7 guaranteed). VERS=3.6,3.7,3.8
const rows = analyzeVersions(full, vdata, VERS);
assert.strictEqual(rows.length, 2, '뽑기 있는 3.6·3.7만(3.8 제외)');
const row37 = rows.find(r => r.v === '3.7');
assert.strictEqual(row37.count5, 1);
assert.strictEqual(row37.char.cWins + row37.char.cLoss, 0, '3.7은 확정뿐(contested 0)');
assert.strictEqual(row37.total, 30);
assert.strictEqual(row37.char.base, 62.5, '캐릭 기준선 62.5');
assert.strictEqual(row37.lc.base, 53.5, '광추 기준선 53.5');
const row36 = rows.find(r => r.v === '3.6');
assert.strictEqual(row36.char.cLoss, 1, '3.6 픽뚫 1');
assert.strictEqual(row36.s, '2025-09-23', '3.6 시작일');
assert.strictEqual(row36.e, '2025-11-04', '3.6 끝=3.7 시작');
// vdata엔 광추(12) 기록이 없음 → lc 비고, all == char
assert.strictEqual(row36.lc.count5, 0, '광추 5★ 0');
assert.strictEqual(row36.all.count5, row36.char.count5, 'all=char (광추 없음)');
assert.strictEqual(row36.all.cLoss, row36.char.cLoss, 'all 픽뚫=char 픽뚫');

// ---- analyzeVersions: 캐릭+광추 합산(all) ----
id = 20000n;
const cN = t => ({ id: String(id++), rank_type: '3', item_id: '0', name: 'y', item_type: 'C', time: t, gacha_type: '11' });
const cV = (iid, t) => ({ id: String(id++), rank_type: '5', item_id: String(iid), name: 'n', item_type: 'C', time: t, gacha_type: '11' });
const lN = t => ({ id: String(id++), rank_type: '3', item_id: '0', name: 'y', item_type: 'L', time: t, gacha_type: '12' });
const lV = (iid, t) => ({ id: String(id++), rank_type: '5', item_id: String(iid), name: 'n', item_type: 'L', time: t, gacha_type: '12' });
const T37 = '2025-11-10 12:00:00';
const mix = [];
for (let i = 0; i < 4; i++) mix.push(cN(T37)); mix.push(cV(1102, T37));   // 캐릭 5★ 1개, pity 5
for (let i = 0; i < 9; i++) mix.push(lN(T37)); mix.push(lV(23000, T37));  // 광추 5★ 1개, pity 10
const mixData = { info: {}, list: mix };
const mixFull = analyze(mixData, schedule);
const mrow = analyzeVersions(mixFull, mixData, VERS).find(r => r.v === '3.7');
assert.strictEqual(mrow.char.count5, 1, '캐릭 5★ 1');
assert.strictEqual(mrow.char.avgPity, 5, '캐릭 평균뽑기 5');
assert.strictEqual(mrow.lc.count5, 1, '광추 5★ 1');
assert.strictEqual(mrow.lc.avgPity, 10, '광추 평균뽑기 10');
assert.strictEqual(mrow.all.count5, 2, 'all 5★ = 캐릭+광추');
assert.strictEqual(mrow.all.avgPity, 7.5, 'all 평균뽑기 = (5·1+10·1)/2');
assert.strictEqual(mrow.all.base, 58, 'all 기준선 = (62.5+53.5)/2');
assert.strictEqual(mrow.all.cWins, mrow.char.cWins + mrow.lc.cWins, 'all 픽승 = 합');
assert.strictEqual(mrow.all.cLoss, mrow.char.cLoss + mrow.lc.cLoss, 'all 픽뚫 = 합');

// 방어: versions 없으면 빈 배열
assert.deepStrictEqual(analyzeVersions(full, vdata, []), [], '빈 versions → []');
assert.deepStrictEqual(analyzeVersions(full, vdata, undefined), [], 'undefined → []');

// ---- schedule.json versions 데이터 검증 ----
// 날짜 출처: 1.0–3.8 = in-repo schedule 배너 1페이즈 시작일(앵커 1.0/3.0/3.4/3.7로 검증, cadence 근사).
// 4.0–4.4 = HoYoverse 실제 패치일(Asia/CST 서버 글로벌 출시일). 4.1은 검증된 4주 단축 버전이라 4.1→4.2 간격 28일이 정상(오타 아님).
// 아래 단언은 데이터 고정용(우발적 수정 감지)이지 실세계 날짜 증명이 아니다.
assert.ok(Array.isArray(versions) && versions.length >= 29, 'versions 29개 이상');
const W = versionWindows(versions);
for (let i = 1; i < W.length; i++) assert.ok(W[i].s >= W[i - 1].s, 'versions 시각 오름차순');
const find = v => versions.find(x => x.v === v);
assert.strictEqual(find('3.7').s, '2025-11-04', '3.7 앵커(analyze.test의 3.7 p1과 일치)');
assert.strictEqual(find('1.0').s, '2023-04-26', '1.0 = 글로벌 출시');
assert.strictEqual(find('4.0').s, '2026-02-12', '4.0 실제 패치일');
assert.strictEqual(find('4.4').s, '2026-07-15', '4.4 실제 패치일(Asia/CST 글로벌 출시일, 수요일)');
assert.ok(find('3.8'), '3.8 존재(마지막 3.x)');
assert.ok(!versions.find(x => x.v === '3.9'), '3.9 없음');
assert.ok(!versions.find(x => x.v === '4.5'), '4.5 없음(마지막은 4.4)');

console.log('OK  all analyze tests passed');
