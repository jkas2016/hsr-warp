// 원본 데이터에 실재하는 함정들을 픽스처로 고정한다. 소스가 갱신되며
// 스키마가 흔들려도 조용히 잘못된 일정을 만들지 않게 한다.
import assert from 'assert';
import { buildSchedule } from './extract-zzz-schedule.mjs';

// 함정 1: top-level 키를 믿으면 안 된다 — 키 "3" 배열에 banner_type 2 가 섞여 있다.
// 함정 2: rank / rarity 필드명 혼재, id 가 string / number 혼재.
// 함정 3: uprate_5 에 빈 객체가 들어 있는 항목이 있다.
// 함정 4: 타임존이 +08:00 / +01:00 혼재, is_server_time 플래그가 따로 있다.
// 함정 5: banner_type 12/13 은 특별 채널로 각각 독점 / 음의 엔진에 대응한다.
const RAW = {
  '2': [
    {
      name: 'Mellow Waveride', banner_type: 2,
      uprate_5: [{ id: '1191', name: 'Ellen', rank: 5, item_type: 'character' }],
      start_time: { time: '2024-07-04 02:00:00+08:00', is_server_time: false },
      end_time: { time: '2024-07-24 11:59:59+01:00', is_server_time: true },
    },
    {
      name: 'Neon Angel', banner_type: 2,
      uprate_5: [{ id: 1501, name: 'Aria', rarity: 5, item_type: 'character' }],
      start_time: { time: '2026-07-29 02:00:00+08:00', is_server_time: false },
      end_time: { time: '2026-08-19 11:59:59+01:00', is_server_time: true },
    },
    { name: 'Paradise Regained', banner_type: 2, uprate_5: [{}],
      start_time: { time: '2026-07-29 02:00:00+08:00', is_server_time: false },
      end_time: { time: '2026-08-19 11:59:59+01:00', is_server_time: true } },
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

const { schedule, skipped } = buildSchedule(RAW);

// ---- 같은 기간은 한 항목으로 병합된다 ----
{
  const aug = schedule.filter((p) => p.s === '2026-07-29');
  assert.strictEqual(aug.length, 1, '같은 시작일은 한 항목으로 병합');
  // 독점 2건(Neon Angel, 잘못 분류된 Misfiled Exclusive)이 c 에 모인다.
  assert.deepStrictEqual(aug[0].c.sort(), ['1381', '1501'], 'banner_type 필드가 권위');
  assert.deepStrictEqual(aug[0].l, ['14158'], '음의 엔진은 l 로');
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

// ---- 빈 uprate_5 항목은 조용히 무시되지 않고 보고된다 ----
{
  assert.strictEqual(skipped.length, 1, '건너뛴 항목 수');
  assert.strictEqual(skipped[0].name, 'Paradise Regained');
}

// ---- 날짜는 UTC 정규화 후 YYYY-MM-DD ----
{
  const first = schedule.find((p) => p.s === '2024-07-04');
  assert.ok(first, '타임존 혼재 항목이 날짜로 정규화됐다');
  assert.match(first.e, /^\d{4}-\d{2}-\d{2}$/, '종료일 형식');
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

console.log('OK  extract-zzz-schedule tests passed');
