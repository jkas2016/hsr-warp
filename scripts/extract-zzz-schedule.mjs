// ZZZ 배너 일정을 web/zzz/schedule.json 으로 추출한다.
//
//   node scripts/extract-zzz-schedule.mjs
//
// 소스: FuriaPaladins/Hoyoverse-Data (GitHub Actions 로 매일 자동 갱신).
// 산출물은 repo 에 벤더링하므로 런타임 의존은 없다 — 소스가 죽어도 기존
// 사용자 앱은 정상 동작하고, 신규 패치 반영 경로만 막힌다.
//
// 확률·천장 값(banners 블록)은 인게임 공시 원문의 general_prob_star5 기준이며
// 추론이 아니다. expAvg = 1 / 종합확률.
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const SRC = 'https://raw.githubusercontent.com/FuriaPaladins/Hoyoverse-Data/main/banners/zzz_formatted.json';

// banner_type → schedule 픽업 키. 12/13 은 특별 채널로 각각 독점·음의 엔진과
// 확률 파라미터가 같다(공시 원문 확인).
const POOL_OF = { 2: 'c', 3: 'l', 12: 'c', 13: 'l' };

// 대시보드가 배너 표시 순서를 이 배열로 강제한다(analyze.js 의 resolveConfig
// 가 order 없으면 Object.keys() 로 폴백하는데, 정수 유사 키를 숫자순 재정렬해
// 순서가 뒤집힌다). resolveConfig(schedule.json) 로 직접 확인된 값.
export const ORDER = ['2', '3', '1', '5'];

// 게임 버전 목록은 소스에 없어 별도 관리한다. 신규 패치마다 한 줄 추가한다.
//
// 확인된 값만 넣는다 — 잘못된 버전 경계는 버전별 통계를 조용히 왜곡한다.
// 비어 있어도 앱은 동작한다: analyzeVersions 가 빈 배열을 반환해 버전 비교
// 탭이 빈 상태가 될 뿐이고, 다른 지표는 전부 정상이다.
//
// 아래 값의 근거(2026-08 조사)
//  1. 각 버전 1페이즈 시작일을 GamingOnPhone "The Complete Banner History"(1.0~2.8)
//     에서 표로 확보하고, 1.3·2.0·2.6·2.7·2.8·3.0·3.1 은 별도 기사로 교차 확인했다.
//  2. 그 표를 zzz_formatted.json 의 실제 배너 시작일과 대조했다 — 19건 중 17건이
//     정확히 일치했고, 2.2(09-03 vs 09-04)·2.5(12-29 vs 12-30) 두 건만 하루 달랐다.
//  3. 하루 차이는 타임존·점검 시작 기준 차이다. 여기서는 **배너 데이터 쪽 날짜**를
//     채택한다 — analyze.js 는 레코드의 게임 로컬 시각을 이 경계와 비교하므로
//     schedule 과 같은 기준이어야 버전 구간과 배너 구간이 어긋나지 않는다.
//
// 버전당 배너 페이즈 수는 일정하지 않다(1.5·2.5 등 연말 구간은 페이즈가 길거나
// 수가 다르다). 그래서 "N페이즈마다 한 버전" 식으로 유도하지 말고 위 표를 갱신한다.
const VERSIONS = [
  { v: '1.0', s: '2024-07-04' },
  { v: '1.1', s: '2024-08-14' },
  { v: '1.2', s: '2024-09-25' },
  { v: '1.3', s: '2024-11-06' },
  { v: '1.4', s: '2024-12-18' },
  { v: '1.5', s: '2025-01-22' },
  { v: '1.6', s: '2025-03-12' },
  { v: '1.7', s: '2025-04-23' },
  { v: '2.0', s: '2025-06-06' },
  { v: '2.1', s: '2025-07-16' },
  { v: '2.2', s: '2025-09-04' },
  { v: '2.3', s: '2025-10-15' },
  { v: '2.4', s: '2025-11-26' },
  { v: '2.5', s: '2025-12-30' },
  { v: '2.6', s: '2026-02-06' },
  { v: '2.7', s: '2026-03-24' },
  { v: '2.8', s: '2026-05-06' },
  { v: '3.0', s: '2026-06-17' },
  { v: '3.1', s: '2026-07-29' },
];

// 공시 원문(general_prob_star5) 기준. 값은 32개 배너 표본에서 채널별로 일정했다.
export const BANNERS = {
  '2': { role: 'limited-char',   name: '독점 채널',   short: '독점',   color: '#ff5a6e', cap: 90, rateUp: 0.5,  expAvg: 62.5 },
  '3': { role: 'limited-weapon', name: 'W-엔진 채널', short: 'W-엔진', color: '#f5a524', cap: 80, rateUp: 0.75, expAvg: 50.0 },
  '1': { role: 'standard',       name: '상시 채널',   short: '상시',   color: '#52d39a', cap: 90, rateUp: null, expAvg: 62.5 },
  '5': { role: 'bangboo',        name: '본디 채널',   short: '본디',   color: '#7aa2ff', cap: 80, rateUp: null, expAvg: 50.0 },
};

// ZZZ 는 B급=2 / A급=3 / S급=4 다(실측). HSR 의 3/4/5 와 다르다.
export const RANKS = { top: '4', mid: '3' };

/**
 * 시각 문자열에서 날짜만 취한다. 소스는 +08:00/+01:00 오프셋이 섞여 있고
 * is_server_time 플래그가 따로 붙지만, 오프셋을 반영해 UTC로 완전 환산하면
 * 자정 근처 항목의 날짜가 하루 밀려 원문 표시일과 어긋난다.
 * wasPickup 이 ±60일 여유를 두므로 오프셋을 무시하고 날짜만 취해도 판정에는
 * 영향이 없다 — 대신 원문 날짜와 일치하는 값을 유지한다.
 * @param {{time?: string}|null} t 소스의 시각 객체.
 * @returns {string|null} 'YYYY-MM-DD'. 파싱할 수 없으면 null.
 */
function utcDate(t) {
  if (!t || !t.time) return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(t.time);
  return m ? m[1] : null;
}

/**
 * id 자릿수로 픽업 풀을 교정한다.
 * ZZZ id 자릿수 규칙: 에이전트(캐릭터)=4자리, W-엔진(무기)=5자리(HSR 도 같은
 * 패턴 — 캐릭터 4자리/광추 5자리 — web/ui_kits/dashboard/items.test.js:11-12
 * 가 그 규칙을 고정한다). banner_type 표기가 틀려도 id 자릿수는 어긋나지
 * 않으므로, 소스의 banner_type 오표기(실측: 음의 엔진 배너 1건이 2로 오표기)
 * 를 자릿수로 교정한다.
 * @param {'c'|'l'} pool 소스의 banner_type 에서 유도한 풀.
 * @param {string} id 아이템 id.
 * @returns {'c'|'l'} 교정된 풀.
 */
function poolFor(pool, id) {
  if (pool === 'c' && id.length === 5) return 'l';
  if (pool === 'l' && id.length === 4) return 'c';
  return pool;
}

// 소스가 uprate_5 를 비운 채 배너 이름·기간만 담는 일이 실제로 있다. 소스
// repo 가 신규 배너의 픽업 id 를 늦게 채우기 때문이며, 그동안 그 기간에 뽑은
// S급이 전부 '픽뚫'로 오판된다(픽업 목록에 없으니 wasPickup 이 false).
//
// 그래서 배너 이름으로 픽업을 보완하는 테이블을 둔다. 소스에 id 가 들어오면
// 소스가 이기므로(아래 ids.length === 0 일 때만 조회) 소스가 갱신되면 이
// 항목은 자연히 무효가 된다. 각 항목에 근거를 남긴다 — 추론으로 채우지 않는다.
const UPRATE_FALLBACK = {
  // ZZZ 3.1 (2026-07-29 ~ 09-08). 근거: 공식 3.1 배너 안내(레미엘 독점 채널
  // "Paradise Regained", 시그니처 W-엔진 "Ode of Resurrected Wings")와
  // 실제 수집 데이터에서 확인한 item_id — 레미엘 1581, 돌아온 날개의 시 14158.
  'Paradise Regained': ['1581'],
  'Ode of Resurrected Wings': ['14158'],
};

/**
 * 원본 응답을 schedule 배열로 변환한다. 순수 함수라 테스트가 네트워크 없이 돈다.
 * @param {Object} raw 소스 JSON 원본.
 * @returns {{schedule: Array<{s: string, e: string, c: string[], l: string[]}>, skipped: Array<{name: string, reason: string}>, warnings: Array<{name: string, id: string, reason: string}>}}
 *   시작일 오름차순 일정, 건너뛴 배너, 자릿수로 교정한 항목.
 */
export function buildSchedule(raw) {
  const byStart = new Map();
  const skipped = [];
  const warnings = [];

  // top-level 키는 신뢰하지 않는다 — 키 "3" 배열에 banner_type 2 가 섞여 있다.
  const all = [];
  for (const v of Object.values(raw)) if (Array.isArray(v)) all.push(...v);

  for (const b of all) {
    const pool = POOL_OF[b.banner_type];
    if (!pool) {
      skipped.push({ name: b.name, reason: `알 수 없는 banner_type ${b.banner_type}` });
      continue;
    }
    const s = utcDate(b.start_time);
    const e = utcDate(b.end_time);
    if (!s || !e) {
      skipped.push({ name: b.name, reason: '시각 파싱 실패' });
      continue;
    }
    // id 는 string / number 가 섞여 있고, 빈 객체 항목도 있다.
    let ids = (b.uprate_5 || [])
      .map((u) => (u && u.id !== undefined && u.id !== null ? String(u.id) : null))
      .filter(Boolean);
    // 소스가 비운 경우에만 폴백 테이블을 본다 — 소스에 값이 들어오면 소스가 이긴다.
    if (ids.length === 0 && UPRATE_FALLBACK[b.name]) {
      ids = UPRATE_FALLBACK[b.name].slice();
      warnings.push({
        name: b.name, id: ids.join(','),
        reason: `소스가 uprate_5 를 비워 폴백 테이블로 보완(공식 배너 안내 + 실측 item_id 근거)`,
      });
    }
    if (ids.length === 0) {
      skipped.push({ name: b.name, reason: 'uprate_5 에 id 가 없다' });
      continue;
    }
    if (!byStart.has(s)) byStart.set(s, { s, e, c: [], l: [] });
    const slot = byStart.get(s);
    // 같은 기간 안에서 종료일이 다르면 늦은 쪽을 취한다(동시 병행 배너).
    if (e > slot.e) slot.e = e;
    for (const id of ids) {
      const actual = poolFor(pool, id);
      if (actual !== pool) {
        warnings.push({
          name: b.name, id,
          reason: `banner_type 기준 pool='${pool}' 이지만 id 자릿수(${id.length})로 pool='${actual}' 로 교정`,
        });
      }
      if (!slot[actual].includes(id)) slot[actual].push(id);
    }
  }

  const schedule = [...byStart.values()].sort((a, b) => (a.s < b.s ? -1 : a.s > b.s ? 1 : 0));
  return { schedule, skipped, warnings };
}

/**
 * 소스에서 ZZZ 배너 원본을 받아 web/zzz/schedule.json 의 schedule 을 갱신한다.
 * 건너뜀·교정은 전부 경고로 표면화한다.
 * @returns {Promise<void>}
 */
async function main() {
  const res = await fetch(SRC, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`소스 응답 ${res.status}`);
  const { schedule, skipped, warnings } = buildSchedule(await res.json());

  for (const s of skipped) console.warn(`건너뜀: ${s.name} — ${s.reason}`);
  // 교정은 조용히 삼키지 않는다 — 소스가 매일 갱신되는 외부 데이터라 같은
  // banner_type 오표기가 재발할 수 있다. 다음에 사람이 알아챌 수 있게 표면화한다.
  for (const w of warnings) console.warn(`교정: ${w.name} (id ${w.id}) — ${w.reason}`);
  if (schedule.length === 0) throw new Error('일정이 비었다 — 소스 스키마가 바뀐 것 같다');

  // 배포 버전. 업데이터가 이 정수를 비교해 갱신을 내려보내므로 산출물이 바뀌면 올린다.
  // 2: VERSIONS 를 1.0~3.1 전 구간으로 채움(버전 비교 탭 활성화).
  // 3: 3.1 후반기(2026-08-19~) 반영 — 신규 독점 1591/14159 와 특별 채널
  //    3중 픽업(banner_type 12/13: 1411·1481·1201 / 14141·14148·14120).
  const out = { version: 3, order: ORDER, ranks: RANKS, banners: BANNERS, schedule, versions: VERSIONS };
  const dst = join(dirname(fileURLToPath(import.meta.url)), '..', 'web', 'zzz', 'schedule.json');
  mkdirSync(dirname(dst), { recursive: true });
  writeFileSync(dst, JSON.stringify(out), 'utf8');
  console.log(`${dst} 기록 — 일정 ${schedule.length}건, 건너뜀 ${skipped.length}건, 교정 ${warnings.length}건`);
}

// 테스트에서 import 할 때는 실행하지 않는다.
if (process.argv[1] && process.argv[1].endsWith('extract-zzz-schedule.mjs')) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
