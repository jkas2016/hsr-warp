// 원본 데이터에 실재하는 함정들을 픽스처로 고정한다. 소스가 갱신되며
// 스키마가 흔들려도 조용히 잘못된 일정을 만들지 않게 한다.
import assert from 'assert';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { buildSchedule, ORDER, RANKS, BANNERS } from './extract-zzz-schedule.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// 함정 1: top-level 키를 믿으면 안 된다 — 키 "3" 배열에 banner_type 2 가 섞여 있다.
// 함정 2: rank / rarity 필드명 혼재, id 가 string / number 혼재.
// 함정 3: uprate_5 에 빈 객체가 들어 있는 항목이 있다.
// 함정 4: 타임존이 +08:00 / +01:00 혼재, is_server_time 플래그가 따로 있다.
// 함정 5: banner_type 12/13 은 특별 채널로 각각 독점 / 음의 엔진에 대응한다.
// 함정 6(실데이터에서만 드러남): 소스의 banner_type 표기 자체가 틀린 항목이
// 있다 — 실제로는 W-엔진(5자리 id) 배너인데 banner_type 이 2(독점)로 잘못
// 찍혀 있다. banner_type 만 믿으면 c 에 5자리 id 가 섞여 들어가고, 정작
// 진짜 l(무기 픽업)이 비어 wasPickup 이 그 기간의 실제 픽업 당첨을
// 'loss'+'guaranteed' 로 오분류한다. id 자릿수(캐릭터=4자리/무기=5자리)로
// 교정해야 한다.
const RAW = {
  '2': [
    {
      name: 'Mellow Waveride', banner_type: 2,
      uprate_5: [
        { id: '1191', name: 'Ellen', rank: 5, item_type: 'character' },
        { id: '14119', name: 'Miscategorized Engine', rank: 5, item_type: 'weapon' },
      ],
      start_time: { time: '2024-07-04 02:00:00+08:00', is_server_time: false },
      end_time: { time: '2024-07-24 11:59:59+01:00', is_server_time: true },
    },
    {
      name: 'Neon Angel', banner_type: 2,
      uprate_5: [{ id: 1501, name: 'Aria', rarity: 5, item_type: 'character' }],
      start_time: { time: '2026-07-29 02:00:00+08:00', is_server_time: false },
      end_time: { time: '2026-08-19 11:59:59+01:00', is_server_time: true },
    },
    // 소스가 uprate_5 를 비운 실제 배너. UPRATE_FALLBACK 이 픽업을 보완해야 한다.
    { name: 'Paradise Regained', banner_type: 2, uprate_5: [{}],
      start_time: { time: '2026-07-29 02:00:00+08:00', is_server_time: false },
      end_time: { time: '2026-09-08 14:59:59+01:00', is_server_time: true } },
    // 폴백 테이블에 없는 빈 배너는 여전히 skipped 여야 한다.
    { name: 'Unknown Empty Banner', banner_type: 2, uprate_5: [{}],
      start_time: { time: '2026-10-01 02:00:00+08:00', is_server_time: false },
      end_time: { time: '2026-10-21 11:59:59+01:00', is_server_time: true } },
  ],
  '3': [
    {
      name: 'Dissonant Sonata', banner_type: 3,
      uprate_5: [{ id: '14158', name: 'Returning Wings', rank: 5, item_type: 'weapon' }],
      start_time: { time: '2026-07-29 02:00:00+08:00', is_server_time: false },
      end_time: { time: '2026-08-19 11:59:59+01:00', is_server_time: true },
    },
    {
      name: 'Misfiled Exclusive', banner_type: 2,
      uprate_5: [{ id: '1381', name: 'Soldier 0', rank: 5, item_type: 'character' }],
      start_time: { time: '2026-07-29 02:00:00+08:00', is_server_time: false },
      end_time: { time: '2026-08-19 11:59:59+01:00', is_server_time: true },
    },
  ],
  '12': [{
    name: 'Sworn to Noble Courage', banner_type: 12,
    uprate_5: [{ id: '1401', name: 'Alice', rank: 5, item_type: 'character' }],
    start_time: { time: '2026-01-21 12:00:00+01:00', is_server_time: true },
    end_time: { time: '2026-02-05 14:59:59+01:00', is_server_time: true },
  }],
  '13': [{
    name: 'Dazzling Melody', banner_type: 13,
    uprate_5: [{ id: '14138', name: 'Severed Innocence', rank: 5, item_type: 'weapon' }],
    start_time: { time: '2026-01-21 12:00:00+01:00', is_server_time: true },
    end_time: { time: '2026-02-05 14:59:59+01:00', is_server_time: true },
  }],
};

const { schedule, skipped, warnings } = buildSchedule(RAW);

// ---- 같은 기간은 한 항목으로 병합된다 ----
{
  const aug = schedule.filter((p) => p.s === '2026-07-29');
  assert.strictEqual(aug.length, 1, '같은 시작일은 한 항목으로 병합');
  // 독점 3건(Neon Angel, 잘못 분류된 Misfiled Exclusive, 폴백으로 보완된
  // Paradise Regained)이 c 에 모인다.
  assert.deepStrictEqual(aug[0].c.sort(), ['1381', '1501', '1581'], 'banner_type 필드가 권위 + 폴백 보완');
  assert.deepStrictEqual(aug[0].l, ['14158'], '음의 엔진은 l 로');
  // 병행 배너의 종료일은 늦은 쪽을 취한다(레미엘 배너가 09-08 까지).
  assert.strictEqual(aug[0].e, '2026-09-08', '병행 배너 종료일은 늦은 쪽');
}

// ---- 소스가 uprate_5 를 비운 배너를 공식 정보로 보완한다 ----
// 소스 repo 가 신규 배너의 픽업 id 를 늦게 채우는 일이 실제로 있었고, 그동안
// 그 기간의 S급이 전부 '픽뚫'로 오판됐다(레미엘 3.1 배너). 이 폴백이 없으면
// 같은 사고가 반복된다.
{
  const p = schedule.find((x) => x.s === '2026-07-29');
  assert.ok(p.c.includes('1581'), '레미엘(1581)이 픽업으로 보완돼야 한다');
  const w = warnings.find((x) => x.name === 'Paradise Regained');
  assert.ok(w, '보완 사실이 warnings 로 표면화돼야 한다');
  assert.ok(/폴백|보완/.test(w.reason), `보완 사유가 담겨야 한다: ${w && w.reason}`);
}

// ---- 특별 채널 12/13 매핑 ----
{
  const jan = schedule.find((p) => p.s === '2026-01-21');
  assert.ok(jan, '특별 채널 기간이 있다');
  assert.deepStrictEqual(jan.c, ['1401'], 'banner_type 12 → c');
  assert.deepStrictEqual(jan.l, ['14138'], 'banner_type 13 → l');
}

// ---- id 는 문자열로 정규화된다 (analyze.js 가 문자열 비교를 한다) ----
for (const p of schedule) {
  for (const arr of [p.c, p.l]) {
    for (const v of arr) assert.strictEqual(typeof v, 'string', `id 가 문자열이 아니다: ${v}`);
  }
}

// ---- 폴백 테이블에 없는 빈 uprate_5 항목은 여전히 보고된다 ----
{
  assert.strictEqual(skipped.length, 1, '건너뛴 항목 수');
  assert.strictEqual(skipped[0].name, 'Unknown Empty Banner');
  // 폴백으로 보완된 배너는 건너뛰지 않는다.
  assert.ok(!skipped.some((s) => s.name === 'Paradise Regained'), '보완된 배너는 skipped 가 아니다');
}

// ---- 날짜는 UTC 정규화 후 YYYY-MM-DD ----
{
  const first = schedule.find((p) => p.s === '2024-07-04');
  assert.ok(first, '타임존 혼재 항목이 날짜로 정규화됐다');
  assert.match(first.e, /^\d{4}-\d{2}-\d{2}$/, '종료일 형식');
}

// ---- 함정 6: banner_type 오표기는 id 자릿수로 교정되고, 교정 사실이 보고된다 ----
{
  const first = schedule.find((p) => p.s === '2024-07-04');
  assert.deepStrictEqual(first.c, ['1191'], '5자리 id 는 c 에서 빠진다');
  assert.deepStrictEqual(first.l, ['14119'], 'banner_type 오표기라도 5자리 id 는 l 로 교정된다');
  // warnings 에는 pool 교정과 폴백 보완이 함께 담기므로 이름으로 골라 본다.
  const fix = warnings.find((w) => w.name === 'Mellow Waveride');
  assert.ok(fix, 'pool 교정 사실이 보고돼야 한다');
  assert.strictEqual(fix.id, '14119');
  assert.ok(/교정/.test(fix.reason), `교정 사유가 담겨야 한다: ${fix.reason}`);
}

// ---- order/ranks/banners 확률 값은 회귀 방지를 위해 고정한다 ----
// (analyze.js 의 resolveConfig 가 order 없으면 Object.keys() 로 폴백해
//  정수 유사 키를 숫자순 재정렬 — 배너 표시 순서가 조용히 뒤집힌다)
{
  assert.deepStrictEqual(ORDER, ['2', '3', '1', '5'], '배너 표시 순서');
  assert.deepStrictEqual(RANKS, { top: '4', mid: '3' }, 'B/A/S 랭크 매핑');
  assert.strictEqual(BANNERS['2'].cap, 90);
  assert.strictEqual(BANNERS['2'].rateUp, 0.5);
  assert.strictEqual(BANNERS['2'].expAvg, 62.5);
  assert.strictEqual(BANNERS['3'].cap, 80);
  assert.strictEqual(BANNERS['3'].rateUp, 0.75);
  assert.strictEqual(BANNERS['3'].expAvg, 50.0);
  assert.strictEqual(BANNERS['1'].cap, 90);
  assert.strictEqual(BANNERS['1'].rateUp, null);
  assert.strictEqual(BANNERS['1'].expAvg, 62.5);
  assert.strictEqual(BANNERS['5'].cap, 80);
  assert.strictEqual(BANNERS['5'].rateUp, null);
  assert.strictEqual(BANNERS['5'].expAvg, 50.0);
}

// ---- 시작일 오름차순 ----
for (let i = 1; i < schedule.length; i++) {
  assert.ok(schedule[i - 1].s <= schedule[i].s, '시작일 오름차순');
}

// ---- 모든 항목이 c 와 l 키를 갖는다 ----
// analyze.js 의 wasPickup 이 p[poolKey].includes 를 옵셔널 체이닝 없이 부른다.
for (const p of schedule) {
  assert.ok(Array.isArray(p.c), 'c 키 필수');
  assert.ok(Array.isArray(p.l), 'l 키 필수');
}

// ---- 게임 버전 목록 ----
// 버전 경계가 틀리면 버전별 통계가 조용히 왜곡된다(에러가 안 난다). 그래서
// 손으로 관리하는 VERSIONS 를 실제 배너 일정과 대조해 드리프트를 막는다.
// 위 검사들과 달리 픽스처가 아니라 **커밋된 산출물**을 본다 — 실제 배포되는 값이
// 맞는지가 관심사이기 때문이다.
{
  const real = JSON.parse(readFileSync(join(ROOT, 'web', 'zzz', 'schedule.json'), 'utf8'));
  const versions = real.versions;
  const realSchedule = real.schedule;

  assert.ok(versions.length > 0, 'versions 가 비어 있다');

  // 1) 오름차순 + 중복 없음.
  for (let i = 1; i < versions.length; i++) {
    assert.ok(versions[i - 1].s < versions[i].s,
      `versions 시작일 오름차순 위반: ${versions[i - 1].v} → ${versions[i].v}`);
  }
  const vs = versions.map((x) => x.v);
  assert.strictEqual(new Set(vs).size, vs.length, '버전 번호 중복');

  // 2) 모든 버전 시작일은 실제 배너 페이즈 시작일과 일치해야 한다.
  //    새 버전은 항상 새 배너와 함께 열리므로, 여기서 어긋나면 날짜가 틀린 것이다.
  const bannerStarts = new Set(realSchedule.map((p) => p.s));
  for (const v of versions) {
    assert.ok(bannerStarts.has(v.s),
      `버전 ${v.v} 시작일 ${v.s} 이 배너 일정에 없다 — 날짜 확인 필요`);
  }

  // 3) 첫 버전은 서비스 시작일과 같아야 한다(그 이전 기록은 존재할 수 없다).
  assert.strictEqual(versions[0].s, realSchedule[0].s, '첫 버전 시작일 ≠ 최초 배너 시작일');

  // 4) 마지막 버전이 일정의 마지막 구간을 덮어야 한다 — 신규 패치 미반영 조기 경보.
  //    한 버전 안에서도 후반기 페이즈가 새 구간으로 열리므로(3.1 은 07-29 전반기 +
  //    08-19 후반기 3중 픽업) "마지막 구간 = 새 버전 시작"으로 볼 수 없다. 대신
  //    버전 시작일로부터의 경과로 판단한다 — 이력상 페이즈 지연은 최대 26일인데
  //    버전 간격은 최소 34일이라, 그 사이에 경계를 두면 둘이 겹치지 않는다.
  const DAY = 86400000;
  const at = (d) => new Date(`${d}T00:00:00Z`).getTime();
  const minVersionSpan = Math.min(...versions.slice(1).map((v, i) => (at(v.s) - at(versions[i].s)) / DAY));
  const lastPhase = realSchedule[realSchedule.length - 1];
  const lastVersion = versions[versions.length - 1];
  const lag = (at(lastPhase.s) - at(lastVersion.s)) / DAY;
  assert.ok(lag >= 0 && lag < minVersionSpan,
    `최신 배너(${lastPhase.s})가 마지막 버전 ${lastVersion.v}(${lastVersion.s}) 시작 ${lag}일 뒤다 ` +
    `— 버전 간격 최소 ${minVersionSpan}일 이상 벌어졌으니 새 패치가 반영되지 않았다. VERSIONS 갱신 필요`);
}

console.log('OK  extract-zzz-schedule tests passed');
