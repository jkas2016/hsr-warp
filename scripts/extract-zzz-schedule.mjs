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

// 게임 버전 목록은 소스에 없어 별도 관리한다. 신규 패치마다 한 줄 추가한다.
//
// 확인된 값만 넣는다 — 잘못된 버전 경계는 버전별 통계를 조용히 왜곡한다.
// 1.0 시작일만 zzz_formatted.json 의 최초 배너 시작일로 확정돼 있다.
// 나머지는 공식 출처(패치 노트·업데이트 공지)로 확인한 뒤 추가한다.
// 비어 있어도 앱은 동작한다: analyzeVersions 가 빈 배열을 반환해 버전 비교
// 탭이 빈 상태가 될 뿐이고, 다른 지표는 전부 정상이다.
const VERSIONS = [
  { v: '1.0', s: '2024-07-04' },
];

// 공시 원문(general_prob_star5) 기준. 값은 32개 배너 표본에서 채널별로 일정했다.
const BANNERS = {
  '2': { role: 'limited-char',   name: '독점 채널',   short: '독점',   color: '#ff5a6e', cap: 90, rateUp: 0.5,  expAvg: 62.5 },
  '3': { role: 'limited-weapon', name: 'W-엔진 채널', short: 'W-엔진', color: '#f5a524', cap: 80, rateUp: 0.75, expAvg: 50.0 },
  '1': { role: 'standard',       name: '상시 채널',   short: '상시',   color: '#52d39a', cap: 90, rateUp: null, expAvg: 62.5 },
  '5': { role: 'bangboo',        name: '본디 채널',   short: '본디',   color: '#7aa2ff', cap: 80, rateUp: null, expAvg: 50.0 },
};

// ZZZ 는 B급=2 / A급=3 / S급=4 다(실측). HSR 의 3/4/5 와 다르다.
const RANKS = { top: '4', mid: '3' };

// utcDate 는 시각 문자열에서 날짜만 취한다. 소스는 +08:00/+01:00 오프셋이
// 섞여 있고 is_server_time 플래그가 따로 붙지만, 오프셋을 반영해 UTC로 완전
// 환산하면 자정 근처 항목의 날짜가 하루 밀려 원문 표시일과 어긋난다.
// wasPickup 이 ±60일 여유를 두므로 오프셋을 무시하고 날짜만 취해도 판정에는
// 영향이 없다 — 대신 원문 날짜와 일치하는 값을 유지한다.
function utcDate(t) {
  if (!t || !t.time) return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(t.time);
  return m ? m[1] : null;
}

// buildSchedule 은 원본을 schedule 배열로 변환한다. 순수 함수라 테스트가
// 네트워크 없이 돈다.
export function buildSchedule(raw) {
  const byStart = new Map();
  const skipped = [];

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
    const ids = (b.uprate_5 || [])
      .map((u) => (u && u.id !== undefined && u.id !== null ? String(u.id) : null))
      .filter(Boolean);
    if (ids.length === 0) {
      skipped.push({ name: b.name, reason: 'uprate_5 에 id 가 없다' });
      continue;
    }
    if (!byStart.has(s)) byStart.set(s, { s, e, c: [], l: [] });
    const slot = byStart.get(s);
    // 같은 기간 안에서 종료일이 다르면 늦은 쪽을 취한다(동시 병행 배너).
    if (e > slot.e) slot.e = e;
    for (const id of ids) if (!slot[pool].includes(id)) slot[pool].push(id);
  }

  const schedule = [...byStart.values()].sort((a, b) => (a.s < b.s ? -1 : a.s > b.s ? 1 : 0));
  return { schedule, skipped };
}

async function main() {
  const res = await fetch(SRC, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`소스 응답 ${res.status}`);
  const { schedule, skipped } = buildSchedule(await res.json());

  for (const s of skipped) console.warn(`건너뜀: ${s.name} — ${s.reason}`);
  if (schedule.length === 0) throw new Error('일정이 비었다 — 소스 스키마가 바뀐 것 같다');

  const out = { version: 1, order: ['2', '3', '1', '5'], ranks: RANKS, banners: BANNERS, schedule, versions: VERSIONS };
  const dst = join(dirname(fileURLToPath(import.meta.url)), '..', 'web', 'zzz', 'schedule.json');
  mkdirSync(dirname(dst), { recursive: true });
  writeFileSync(dst, JSON.stringify(out), 'utf8');
  console.log(`${dst} 기록 — 일정 ${schedule.length}건, 건너뜀 ${skipped.length}건`);
}

// 테스트에서 import 할 때는 실행하지 않는다.
if (process.argv[1] && process.argv[1].endsWith('extract-zzz-schedule.mjs')) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
