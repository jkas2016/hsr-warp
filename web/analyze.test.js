const assert = require('assert');
const { analyzeBanner, analyze, monthly, BANNERS, aggregateFives } = require('./analyze.js');
const { schedule } = require('./schedule.json'); // 배너 일정은 데이터 파일에서 주입

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
  { rank_type: '5', gacha_type: '11', name: 'a', time: '2025-01-15 10:00:00' },
  { rank_type: '3', gacha_type: '11', name: 'b', time: '2025-01-20 10:00:00' },
  { rank_type: '4', gacha_type: '12', name: 'c', time: '2025-02-02 10:00:00' },
];
const mo = monthly(mlist);
assert.strictEqual(mo.length, 2, 'two months');
assert.strictEqual(mo[0].month, '202501');
assert.strictEqual(mo[0].total, 2);
assert.strictEqual(mo[0].c5, 1);
assert.strictEqual(mo[0].jade, 320);
assert.strictEqual(mo[1].month, '202502');

// ---- analyze() integration ----
id = 7000n;
const data = { info: { uid: '1' }, list: [r5(1102), r5(1415), r34(3), { ...r5lc(23000) }] };
const A = analyze(data, schedule);
assert.ok(A.banners.length >= 1);
assert.strictEqual(A.count5, 3);
assert.strictEqual(A.unknown5, 0, 'account-wide unknown5 exposed');
assert.ok(A.luck.charBanner, 'char banner luck present');
assert.ok(A.all5[0].time >= A.all5[A.all5.length - 1].time, 'all5 newest first');

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

console.log('OK  all analyze tests passed');
