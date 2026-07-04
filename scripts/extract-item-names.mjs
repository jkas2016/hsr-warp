// 캐릭터/광추 이름 4언어 사전 추출기. 원본(Mar-7th/StarRailRes)의 index_min에서
// characters.json + light_cones.json 을 언어별로 받아 item_id → {ko,en,zh,ja}로 병합,
// web/ui_kits/dashboard/i18n/items.js (window.ITEM_NAMES) 로 쓴다.
//
//   node scripts/extract-item-names.mjs
//
// 신규 패치로 캐릭터/광추가 추가되면 이 스크립트를 다시 돌려 items.js 를 갱신한다
// (추론으로 손대지 말 것 — 원본에서 재추출). id 공간: 캐릭터=4자리, 광추=5자리(안 겹침).
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = 'https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/index_min';
const FILES = ['characters.json', 'light_cones.json'];
// SRGF/앱 언어코드 → StarRailRes 디렉토리명.
const LANGS = { ko: 'kr', en: 'en', zh: 'cn', ja: 'jp' };

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  return res.json();
}

async function main() {
  const merged = {}; // item_id → {ko,en,zh,ja}
  for (const [lang, dir] of Object.entries(LANGS)) {
    for (const file of FILES) {
      const data = await fetchJSON(`${BASE}/${dir}/${file}`);
      for (const [id, entry] of Object.entries(data)) {
        if (!entry || !entry.name) continue; // 빈 이름(원본 미번역)은 건너뜀 → 표시 시 raw 폴백
        (merged[id] || (merged[id] = {}))[lang] = entry.name;
      }
    }
    process.stderr.write(`fetched ${lang} (${dir})\n`);
  }

  // id 오름차순(숫자) 정렬 — diff 안정성.
  const ids = Object.keys(merged).sort((a, b) => Number(a) - Number(b));
  const lines = ids.map((id) => `  ${JSON.stringify(id)}: ${JSON.stringify(merged[id])},`);
  const out =
    '// 자동 생성 — scripts/extract-item-names.mjs (원본: Mar-7th/StarRailRes index_min).\n' +
    '// 직접 편집하지 말 것. 신규 패치 반영은 스크립트를 재실행한다.\n' +
    'window.ITEM_NAMES = {\n' + lines.join('\n') + '\n};\n';

  const dst = path.join(fileURLToPath(new URL('.', import.meta.url)), '..', 'web', 'ui_kits', 'dashboard', 'i18n', 'items.js');
  writeFileSync(dst, out);
  process.stderr.write(`wrote ${ids.length} items → ${dst}\n`);
}

main().catch((e) => { process.stderr.write(String(e && e.stack || e) + '\n'); process.exit(1); });
