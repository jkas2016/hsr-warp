const assert = require('assert');
const { analyzeBanner, analyze, monthly, BANNERS } = require('./analyze.js');

let id = 1000n;
// helper: make a record. rank 5 needs an item_id (to test pool membership).
const r5 = (item_id, time = '2025-03-01 00:00:00') => ({ id: String(id++), rank_type: '5', item_id: String(item_id), name: 'x', item_type: 'C', time, gacha_type: '11' });
const r34 = (rank) => ({ id: String(id++), rank_type: String(rank), item_id: '0', name: 'y', item_type: 'C', time: '2025-03-01 00:00:00', gacha_type: '11' });

// ---- pity ----
const seq = ['3','3','3','4','3'].map(r34).concat([r5(9999)]); // 6 pulls, 5* at pity 6
const b = analyzeBanner(seq, BANNERS['11']);
assert.strictEqual(b.total, 6);
assert.strictEqual(b.count5, 1);
assert.strictEqual(b.fives[0].pity, 6, 'pity counts the winning pull');
assert.strictEqual(b.currentPity5, 0, 'reset after 5*');

// ---- 50/50: loss -> guaranteed win -> contested win -> loss (LIMITED 기반) ----
// standard char: 1003(Himeko),1101(Bronya) | limited(픽업): 1005(Kafka),1006(Silver Wolf)
id = 5000n;
const banner11 = [
  r5(1003),  // standard -> contested LOSS(픽뚫) -> guaranteed
  r5(1005),  // guaranteed WIN(픽업)
  r5(1006),  // contested WIN(픽승, 픽업)
  r5(1101),  // standard -> contested LOSS(픽뚫) -> guaranteed
];
const s = analyzeBanner(banner11, BANNERS['11']);
assert.strictEqual(s.contested, 3, '3 contested (#1,#3,#4)');
assert.strictEqual(s.cWins, 1, '1 contested win');
assert.strictEqual(s.cLoss, 2, '2 contested losses');
assert.strictEqual(s.gWins, 1, '1 guaranteed win');
assert.strictEqual(s.pickupTotal, 2, 'featured = contested wins + guaranteed wins');
assert.ok(Math.abs(s.win5050Rate - 1 / 3) < 1e-9, '50/50 win rate = 1/3');
assert.strictEqual(s.currentGuaranteed, true, 'ends on loss -> next guaranteed');
assert.deepStrictEqual(s.fives.map(f => f.result), ['loss', 'guaranteed', 'win', 'loss']);
assert.deepStrictEqual(s.fives.map(f => f.isPickup), [false, true, true, false]);
assert.strictEqual(s.unknown5, 0, 'all ids in LIMITED or STANDARD');

// ---- 미확인 5★: LIMITED·STANDARD 어디에도 없으면 contested loss + unidentified ----
id = 5500n;
const u = analyzeBanner([r5(9999)], BANNERS['11']);
assert.strictEqual(u.fives[0].result, 'loss', 'unknown contested -> loss');
assert.strictEqual(u.fives[0].isPickup, false);
assert.strictEqual(u.fives[0].unidentified, true);
assert.strictEqual(u.unknown5, 1);
const std = analyzeBanner([r5(1003)], BANNERS['11']);
assert.strictEqual(std.fives[0].unidentified, false, 'standard id is identified');
assert.strictEqual(std.unknown5, 0);

// ---- light cone pool (banner 12): standard 23002 -> loss, limited 23001 -> guaranteed ----
const r5lc = (iid) => ({ id: String(id++), rank_type: '5', item_id: String(iid), name: 'z', item_type: 'L', time: '2025-03-01 00:00:00', gacha_type: '12' });
const banner12 = [r5lc(23002) /*standard -> loss*/, r5lc(23001) /*limited -> guaranteed*/];
const sl = analyzeBanner(banner12, BANNERS['12']);
assert.deepStrictEqual(sl.fives.map(f => f.result), ['loss', 'guaranteed'], 'LC: loss then guaranteed');
assert.strictEqual(sl.unknown5, 0);

// ---- luck (소프트천장/early 제거 확인) ----
id = 6000n;
const lk = analyzeBanner([r5(1005)], BANNERS['11']); // Kafka pity 1 -> 픽승, 매우 행운
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
const data = { info: { uid: '1' }, list: [r5(1003), r5(1005), r34(3), { ...r5lc(23002) }] };
const A = analyze(data);
assert.ok(A.banners.length >= 1);
assert.strictEqual(A.count5, 3);
assert.strictEqual(A.unknown5, 0, 'account-wide unknown5 exposed');
assert.ok(A.luck.charBanner, 'char banner luck present');
assert.ok(A.all5[0].time >= A.all5[A.all5.length - 1].time, 'all5 newest first');

console.log('OK  all analyze tests passed');
