# HSR 픽업 데이터 반영

## 파일

`web/schedule.json` — 1줄 minified JSON. 최상위 키 순서는 `version, order, ranks, banners, schedule, versions`.

```json
{"s":"2026-08-05","e":"2026-08-25","c":["1412","1405","1304"],"l":["23048","23041","23023"]}
```

- `s`/`e` — 픽업 시작·종료일 (`YYYY-MM-DD`)
- `c` — featured 캐릭터 `item_id` 배열 (4자리)
- `l` — featured 광추 `item_id` 배열 (5자리)

캐릭터와 광추 개수는 대응하지 않아도 된다. 초기 버전은 1개, 최근은 3개까지 동시 픽업이 있다.

## 반영 절차

HSR은 추출 스크립트가 없다. `web/schedule.json`을 직접 편집한다.

1. **`schedule` 배열에 항목 추가** — 시작일 오름차순을 유지한다.
2. **`versions` 배열에 `{v, s}` 추가** — 신규 패치일 때만. 버전 경계를 모르면 넣지 않는다(§주의 참조).
3. **`version` 정수를 올린다** — 업데이터가 이 값을 비교해 배포한다. 올리지 않으면 기존 사용자에게 갱신이 전달되지 않는다.

배열이 크므로(60여 구간) 손으로 편집하다 깨뜨리기 쉽다. 스크립트로 편집하고 건수를 확인하는 편이 안전하다.

```bash
node -e "
const fs=require('fs'); const p='web/schedule.json';
const s=JSON.parse(fs.readFileSync(p,'utf8'));
s.schedule.push({s:'2026-08-26',e:'2026-09-16',c:['1234'],l:['23099']});
s.schedule.sort((a,b)=>a.s<b.s?-1:a.s>b.s?1:0);
s.version += 1;
const out={version:s.version,order:s.order,ranks:s.ranks,banners:s.banners,schedule:s.schedule,versions:s.versions};
fs.writeFileSync(p,JSON.stringify(out),'utf8');
console.log('schedule:',out.schedule.length,'versions:',out.versions.length,'version:',out.version);
"
```

편집 후 건수가 예상과 다르면 배열이 손상된 것이므로 되돌린다.

## item_id 확인

우선순위대로 시도한다.

1. **사용자 실데이터** — `data/hsr/warp_*.json`의 `name`으로 역인덱스. 가장 확실하다.
2. **아이템 이름 사전** — `web/ui_kits/dashboard/i18n/items.js`에 `{id: {ko,en,zh,ja}}` 형태로 들어 있다. 신규 캐릭터가 없으면 재추출한다.
   ```bash
   node scripts/extract-item-names.mjs
   ```
   [Mar-7th/StarRailRes](https://github.com/Mar-7th/StarRailRes)에서 4개 언어를 받아 `items.js`를 다시 만든다. 신규 패치마다 돌리면 된다.
3. **StarRailRes 직접 조회** — `index_min/<lang>/characters.json`, `light_cones.json`.

캐릭터는 4자리, 광추는 5자리라 id 공간이 겹치지 않는다. `web/ui_kits/dashboard/items.test.js`가 이 규칙을 고정하고 있으므로 자릿수로 종류를 교차 검증할 수 있다.

## 배너 일정 출처

`web/analyze.js` 파일 끝의 `SOURCES:` 주석이 권위 있는 목록이다.

- 픽업 일정: [Mantan21/HSR-Warp-Simulator](https://github.com/Mantan21/HSR-Warp-Simulator) — `banners/lists.json`이 배너 id → featured slug, `characters.json`·`light-cones.json`이 slug → item_id
- item_id 검증: [Mar-7th/StarRailRes](https://github.com/Mar-7th/StarRailRes) `index_min/en`
- 확률·50/50: [prydwen.gg](https://www.prydwen.gg/star-rail/guides/gacha-system/)
- `gacha_type` 코드: [uigf.org SRGF 표준](https://uigf.org/en/standards/srgf.html)

이 소스가 아직 신규 배너를 담지 않았다면 웹 검색으로 공식 배너 안내를 찾는다.

## 채널 코드

| 코드 | 역할 | 천장 | 픽업 확률 | `expAvg` |
|---|---|---|---|---|
| `11` | 캐릭터 이벤트 (`limited-char`) | 90 | 50% | 62.5 |
| `12` | 광추 이벤트 (`limited-weapon`) | 80 | 75% | 53.5 |
| `1` | 스텔라 / 일반 (`standard`) | 90 | — | 62.5 |
| `2` | 출발 워프 (`beginner`) | 50 | — | — |

`rank_type`은 최고 `5` / 중간 `4`. 대시보드는 `limited-char`와 `limited-weapon` 두 축만 표시한다.

## 주의

**`versions`는 전부 확인하거나 비워 둔다.** 이 배열은 각 버전의 시작일 목록이고, 빠진 버전이 있으면 그 구간이 앞 버전에 흡수되어 버전별 통계가 조용히 왜곡된다. 부분적으로 채우는 것이 비워 두는 것보다 나쁘다.

**`web/analyze.test.js`가 이 파일의 실제 내용을 검증한다.** `versions.length >= 29`, 오름차순, 특정 버전의 앵커 날짜를 단언하므로, 편집 후 `npm test`로 확인한다.

## 현황 확인

```bash
npm run schedule:status
```

두 게임의 배너 데이터 버전, 최신 대응 게임 버전, 픽업 일정 커버 범위를 보고한다.
