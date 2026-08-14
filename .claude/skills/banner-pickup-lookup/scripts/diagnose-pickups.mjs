// 픽업 판정이 의심스러운 5성을 찾아 원인을 진단한다.
//
//   node .claude/skills/banner-pickup-lookup/scripts/diagnose-pickups.mjs <game>
//   node .claude/skills/banner-pickup-lookup/scripts/diagnose-pickups.mjs zzz --all
//
// 기본은 '픽뚫(loss)·미판정' 만 보여준다. --all 을 주면 전 5성을 보여준다.
//
// 왜 필요한가: 픽업 목록이 불완전하면 실제로는 픽승인 5성이 조용히 픽뚫로
// 집계된다. 에러가 나지 않으므로 숫자만 보고는 알 수 없고, 획득 시각의 픽업
// 목록과 대조해야 드러난다. 그 대조를 손으로 하면 매번 같은 일회용 스크립트를
// 쓰게 되므로 여기 고정해 둔다.
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

const game = (process.argv[2] || 'hsr').toLowerCase();
const showAll = process.argv.includes('--all');

const schedulePath = game === 'hsr'
  ? join(ROOT, 'web', 'schedule.json')
  : join(ROOT, 'web', game, 'schedule.json');

if (!existsSync(schedulePath)) {
  console.error(`schedule 을 찾을 수 없다: ${schedulePath}`);
  console.error(`지원 게임 인자: hsr | zzz`);
  process.exit(1);
}

// 저장 레이아웃은 data/<game>/warp_YYYYMM.json 이다(구버전은 data/warp_*.json).
const dataDir = join(ROOT, 'data', game);
const legacyDir = join(ROOT, 'data');
const dir = existsSync(dataDir) ? dataDir : legacyDir;

let list = [];
let info = null;
if (existsSync(dir)) {
  for (const f of readdirSync(dir)) {
    if (!/^warp_\d+\.json$/.test(f)) continue;
    const j = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    if (Array.isArray(j.list)) list.push(...j.list);
    if (j.info && j.info.uid) info = j.info;
  }
}
if (list.length === 0) {
  console.error(`${dir} 에 기록이 없다. 앱에서 한 번 수집한 뒤 다시 실행하라.`);
  process.exit(1);
}

const schedule = JSON.parse(readFileSync(schedulePath, 'utf8'));
// analyze.js 는 CommonJS(IIFE UMD)라 ESM 에서 import 하면 module.exports 가
// default 로 들어온다. named 추론에 기대지 않고 default 를 명시적으로 편다.
const mod = await import('file://' + join(ROOT, 'web', 'analyze.js').replace(/\\/g, '/'));
const { analyze, resolveConfig } = mod.default || mod;
const cfg = resolveConfig(schedule);
const result = analyze({ info, list }, schedule);

// item_id → 이름 역인덱스. 실데이터의 name 은 authkey 의 lang 을 따라 현지화돼
// 있으므로, 픽업 목록에 넣을 id 를 이름으로 되짚을 때 이게 가장 확실한 근거다.
const nameOf = new Map();
for (const r of list) if (r.item_id && r.name) nameOf.set(String(r.item_id), r.name);

// 특정 시각을 포함하는 일정 구간을 찾는다(wasPickup 과 같은 ±60일 여유).
const DAY = 86400000;
const TOL = 60 * DAY;
function windowsAt(t) {
  return (cfg.list || []).filter((p) => {
    const s = Date.parse(p.s), e = Date.parse(p.e);
    const d = t >= s && t < e ? 0 : Math.min(Math.abs(t - s), Math.abs(t - e));
    return d <= TOL;
  });
}

console.log(`게임: ${game} · 기록 ${list.length}건 · schedule ${(cfg.list || []).length}구간`);
console.log(`최고등급 코드: ${cfg.ranks.top} · 중간: ${cfg.ranks.mid}`);
console.log('');

// 확실한 데이터 결함 두 가지를 먼저 본다. 이 둘은 외부 지식 없이 판정할 수 있다.
//
//   A. 픽업 배열이 빈 구간 — 소스가 uprate_5 를 못 채운 흔적이다.
//   B. 일정 마지막 종료일 이후에 획득한 5성 — 신규 패치가 아직 반영되지 않았다.
//
// 반면 "픽뚫이 실제로는 픽업이었나"는 그 시기 공식 라인업을 알아야 판단할 수 있다.
// 그래서 픽뚫은 단정하지 않고 대조표로만 보여준다 — 사용자가 아는 신규 캐릭터가
// 거기 있으면 그게 누락이다.
const defects = [];
for (const p of cfg.list || []) {
  if ((p.c || []).length === 0) defects.push(`${p.s}~${p.e} 의 캐릭터 픽업(c)이 비었다`);
  if ((p.l || []).length === 0) defects.push(`${p.s}~${p.e} 의 무기 픽업(l)이 비었다`);
}
const schedEnd = (cfg.list || []).reduce((m, p) => Math.max(m, Date.parse(p.e)), 0);
const afterEnd = [];

for (const b of result.banners) {
  // 픽업 개념이 없는 채널은 판정 자체를 하지 않으므로 진단 대상이 아니다.
  if (b.meta.rateUp === null) continue;
  const pool = cfg.banners[b.type].role === 'limited-weapon' ? 'l' : 'c';
  const fives = b.stats.fives.filter((f) => showAll || f.result === 'loss' || f.result === null);
  if (fives.length === 0) continue;

  console.log(`[${b.meta.short}] 픽승${b.stats.cWins} 픽뚫${b.stats.cLoss} 확정${b.stats.gWins}`);
  for (const f of fives) {
    const day = String(f.time).slice(0, 10);
    const t = Date.parse(day);
    if (t >= schedEnd) afterEnd.push(`${day} ${f.name} (id ${f.item_id})`);
    const wins = windowsAt(t);
    console.log(`   ${day} ${f.name} (id ${f.item_id}) → ${f.result || '미판정'}`);
    if (f.result === 'loss' || f.result === null) {
      for (const p of wins) {
        const names = (p[pool] || []).map((id) => `${id}${nameOf.has(id) ? '(' + nameOf.get(id) + ')' : ''}`);
        console.log(`       ${p.s}~${p.e} 의 ${pool} 픽업: ${names.join(', ') || '(없음)'}`);
      }
      if (wins.length === 0) console.log('       해당 시각을 덮는 일정 구간이 없다');
    }
  }
  console.log('');
}

let bad = false;
if (defects.length) {
  bad = true;
  console.log('데이터 결함 — 픽업 배열이 빈 구간:');
  for (const d of defects) console.log('  ' + d);
  console.log('');
}
if (afterEnd.length) {
  bad = true;
  console.log('일정 미반영 — schedule 마지막 종료일 이후 획득:');
  for (const a of afterEnd) console.log('  ' + a);
  console.log('');
}

console.log('위 픽뚫·미판정 목록에서 실제로는 픽업이었던 항목이 있는지 확인하라.');
console.log('그 시기 공식 배너 라인업을 모르면 판단할 수 없으니, 사용자가 기억하는');
console.log('신규 캐릭터·전용 무기가 목록에 있으면 그것이 누락 후보다.');
if (bad) process.exitCode = 1;
