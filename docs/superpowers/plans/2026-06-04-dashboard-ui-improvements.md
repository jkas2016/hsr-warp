# 대시보드 UI 개선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `web/dashboard.html`에서 5★ 획득 기록·월별 집계에 "더보기" 페이징을 넣고, 배너별 현황에서 '출발 워프' 카드를 숨긴다.

**Architecture:** 변경은 `web/dashboard.html` 한 파일로 한정. `analyze.js`는 무변경(출발 데이터는 유지, 렌더에서만 카드 숨김 / 페이징은 클라이언트 표시 로직). `render(A)`가 `app.innerHTML`을 통째로 다시 그리는 기존 구조를 유지하되, 두 테이블은 `tbody`만 부분 갱신하는 헬퍼(`refreshFives`/`refreshMonth`)로 분리하고 "더보기" 버튼에 바인딩한다.

**Tech Stack:** 바닐라 JS(의존성 0), 기존 인라인 `<script>`. 검증은 node 정적 서버 + chrome-devtools-mcp.

**환경 노트:** 이 작업 환경(macOS)에는 Go가 없어 exe 빌드·`go test`는 불가하다. `web/` 변경뿐이라 정적 서버 검증으로 충분하며, 최종 Windows exe 빌드·실게임 조회 검증은 사용자(Windows) 측 책임이다.

**참조 설계:** `docs/superpowers/specs/2026-06-04-dashboard-ui-improvements-design.md`

---

## File Structure

- **Modify: `web/dashboard.html`** — 유일 변경 파일.
  - `<style>` 블록: `.more` 버튼 스타일 추가.
  - 스크립트 상단: 페이징 상수/상태 변수.
  - `statCard` 인근: 행 생성 함수(`fivesRowsHTML`/`monthRowsHTML`)와 부분 갱신 함수(`refreshFives`/`refreshMonth`).
  - 배너 카드 루프: 출발(`type==='2'`) 가드.
  - `render()` 내 5★·월별 섹션 마크업: `tbody` id + 더보기 버튼으로 교체.
  - `render()` 말미: 상태 리셋 + 첫 갱신 + 버튼 이벤트 바인딩.
- **무변경: `web/analyze.js`, `web/analyze.test.js`** — 회귀 통과만 확인.

각 코드 태스크 직후 `node web/analyze.test.js`로 회귀를 확인한다(무변경이라 항상 PASS여야 함). 실제 렌더 동작은 Task 4에서 통합 검증한다.

---

## Task 1: 출발 워프 배너 카드 숨김

**Files:**
- Modify: `web/dashboard.html:205` (배너 카드 루프 시작 줄)

- [ ] **Step 1: 배너 루프에 출발 가드 추가**

`render()` 안의 배너 카드 루프 첫 줄을 교체한다.

찾을 줄(`web/dashboard.html:205`):

```js
  for(const b of A.banners){const s=b.stats,cap=b.meta.cap,pct=Math.min(100,s.currentPity5/cap*100);
```

다음으로 교체:

```js
  for(const b of A.banners){if(b.type==='2')continue;const s=b.stats,cap=b.meta.cap,pct=Math.min(100,s.currentPity5/cap*100);
```

- [ ] **Step 2: 회귀 테스트**

Run: `node web/analyze.test.js`
Expected: `OK  all analyze tests passed` (analyze.js 무변경)

- [ ] **Step 3: Commit**

```bash
git add web/dashboard.html
git commit -m "feat: 출발 워프 배너 카드 숨김 (#4)

배너별 현황에서 beginner(gacha_type 2) 카드만 렌더 스킵.
데이터(월별·총계·5★ 기록)는 보존.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: 5★ 획득 기록 더보기 페이징

**Files:**
- Modify: `web/dashboard.html` — `<style>`(68행 인근), 스크립트 상단(102행 인근), `statCard` 다음(156행 인근), 5★ 섹션 마크업(235-244행), `render()` 말미(246-247행)

- [ ] **Step 1: `.more` 버튼 CSS 추가**

`<style>` 블록 마지막 규칙(`details summary{...}`, 68행) 바로 다음 줄에 추가한다.

찾을 줄:

```css
  details summary{cursor:pointer;color:var(--gold);font-size:13px;margin-top:8px}
```

그 아래에 삽입:

```css
  .more{margin-top:12px;padding:8px 16px;border:1px solid var(--line);border-radius:8px;background:var(--panel2);color:var(--txt);font-size:13px;cursor:pointer}
  .more:hover{background:var(--line)}
```

- [ ] **Step 2: 페이징 상수/상태 변수 추가**

`let charts=[];`(102행) 다음 줄에 삽입한다.

찾을 줄:

```js
let charts=[];
```

그 아래에 삽입:

```js
const PAGE_FIVES=20,PAGE_MONTH=12;
let fivesShown=PAGE_FIVES,monthShown=PAGE_MONTH;
```

- [ ] **Step 3: 5★ 행 생성·갱신 함수 추가**

`statCard` 함수 정의(156행) 바로 다음에 삽입한다.

찾을 줄:

```js
function statCard(k,v,small){return `<div class="card stat"><div class="k">${k}</div><div class="v">${v}${small?` <small>${small}</small>`:''}</div></div>`;}
```

그 아래에 삽입:

```js
function fivesRowsHTML(A,limit){
  if(!A.all5.length)return `<tr><td colspan="5" class="muted">5★ 기록 없음</td></tr>`;
  return A.all5.slice(0,limit).map(f=>{const showRes=f.result!=null;
    return `<tr><td class="name5" style="color:${f.isPickup===false?'var(--muted)':'var(--gold)'}">${f.name}</td>
      <td><span class="tag">${f.banner}</span></td>
      <td><span class="pill" style="background:${pityColor(f.pity)}">${f.pity}</span></td>
      <td>${showRes?`<span class="res ${resClass[f.result]}">${resText[f.result]}</span>`:'<span class="muted">-</span>'}</td>
      <td class="muted">${f.time}</td></tr>`;}).join('');
}
function refreshFives(A){
  $('#fivesBody').innerHTML=fivesRowsHTML(A,fivesShown);
  const rest=A.all5.length-fivesShown,btn=$('#moreFives');
  btn.style.display=rest>0?'inline-block':'none';
  if(rest>0)btn.textContent=`더보기 (${rest}개 남음)`;
}
```

- [ ] **Step 4: 5★ 섹션 마크업 교체**

`render()` 안의 5-star history 블록(235-244행) 전체를 교체한다.

찾을 블록:

```js
  // 5-star history
  h+=`<section><h2>5★ 획득 기록 <span class="note">(최신순)</span></h2>
    <table><thead><tr><th>이름</th><th>배너</th><th>천장</th><th>결과</th><th>획득 시각</th></tr></thead><tbody>`;
  for(const f of A.all5){const showRes=f.result!=null;
    h+=`<tr><td class="name5" style="color:${f.isPickup===false?'var(--muted)':'var(--gold)'}">${f.name}</td>
      <td><span class="tag">${f.banner}</span></td>
      <td><span class="pill" style="background:${pityColor(f.pity)}">${f.pity}</span></td>
      <td>${showRes?`<span class="res ${resClass[f.result]}">${resText[f.result]}</span>`:'<span class="muted">-</span>'}</td>
      <td class="muted">${f.time}</td></tr>`;}
  if(!A.all5.length)h+=`<tr><td colspan="5" class="muted">5★ 기록 없음</td></tr>`;
  h+=`</tbody></table></section>`;
```

다음으로 교체:

```js
  // 5-star history (페이징: fivesShown 개씩 더보기)
  h+=`<section><h2>5★ 획득 기록 <span class="note">(최신순)</span></h2>
    <table><thead><tr><th>이름</th><th>배너</th><th>천장</th><th>결과</th><th>획득 시각</th></tr></thead>
    <tbody id="fivesBody"></tbody></table>
    <button id="moreFives" class="more" style="display:none">더보기</button></section>`;
```

- [ ] **Step 5: `render()` 말미에 리셋·갱신·바인딩 추가**

`render()` 끝의 `app.innerHTML=h;` ~ `drawCharts(A);`(246-247행)를 교체한다.

찾을 블록:

```js
  app.innerHTML=h;
  drawCharts(A);
```

다음으로 교체:

```js
  app.innerHTML=h;
  fivesShown=PAGE_FIVES;monthShown=PAGE_MONTH;
  refreshFives(A);
  $('#moreFives').addEventListener('click',()=>{fivesShown+=PAGE_FIVES;refreshFives(A);});
  drawCharts(A);
```

- [ ] **Step 6: 회귀 테스트**

Run: `node web/analyze.test.js`
Expected: `OK  all analyze tests passed`

- [ ] **Step 7: Commit**

```bash
git add web/dashboard.html
git commit -m "feat: 5★ 획득 기록 더보기 페이징 (#4)

초기 20개, 더보기당 +20. tbody 부분 갱신.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: 월별 집계 더보기 페이징

**Files:**
- Modify: `web/dashboard.html` — `refreshFives` 다음, 월별 섹션 마크업(227-232행), `render()` 말미(Task 2에서 바꾼 블록)

- [ ] **Step 1: 월별 행 생성·갱신 함수 추가**

Task 2 Step 3에서 추가한 `refreshFives` 함수 정의 바로 다음에 삽입한다.

찾을 줄(방금 추가한 `refreshFives`의 닫는 중괄호):

```js
function refreshFives(A){
  $('#fivesBody').innerHTML=fivesRowsHTML(A,fivesShown);
  const rest=A.all5.length-fivesShown,btn=$('#moreFives');
  btn.style.display=rest>0?'inline-block':'none';
  if(rest>0)btn.textContent=`더보기 (${rest}개 남음)`;
}
```

그 아래에 삽입:

```js
function monthRowsHTML(A,limit){
  return [...A.monthly].reverse().slice(0,limit).map(m=>{const lbl=m.month.slice(0,4)+'.'+m.month.slice(4);
    return `<tr><td><b>${lbl}</b></td><td>${m.total}</td><td class="muted">${num(m.jade)}</td>
      <td>${m.c5?`<span class="pill" style="background:var(--gold)">${m.c5}</span>`:'<span class="muted">0</span>'}</td>
      <td class="muted">${m.fives.map(f=>f.name).join(', ')||'-'}</td></tr>`;}).join('');
}
function refreshMonth(A){
  $('#monthBody').innerHTML=monthRowsHTML(A,monthShown);
  const rest=A.monthly.length-monthShown,btn=$('#moreMonth');
  btn.style.display=rest>0?'inline-block':'none';
  if(rest>0)btn.textContent=`더보기 (${rest}개월 남음)`;
}
```

- [ ] **Step 2: 월별 섹션 마크업 교체**

`render()` 안의 monthly table 블록(227-232행) 전체를 교체한다.

찾을 블록:

```js
  // monthly table
  h+=`<section><h2>월별 집계</h2><table><thead><tr><th>월</th><th>뽑기</th><th>성옥</th><th>5★</th><th>획득 5★</th></tr></thead><tbody>`;
  for(const m of [...A.monthly].reverse()){const lbl=m.month.slice(0,4)+'.'+m.month.slice(4);
    h+=`<tr><td><b>${lbl}</b></td><td>${m.total}</td><td class="muted">${num(m.jade)}</td>
      <td>${m.c5?`<span class="pill" style="background:var(--gold)">${m.c5}</span>`:'<span class="muted">0</span>'}</td>
      <td class="muted">${m.fives.map(f=>f.name).join(', ')||'-'}</td></tr>`;}
  h+=`</tbody></table></section>`;
```

다음으로 교체:

```js
  // monthly table (페이징: monthShown 개월씩 더보기)
  h+=`<section><h2>월별 집계</h2>
    <table><thead><tr><th>월</th><th>뽑기</th><th>성옥</th><th>5★</th><th>획득 5★</th></tr></thead>
    <tbody id="monthBody"></tbody></table>
    <button id="moreMonth" class="more" style="display:none">더보기</button></section>`;
```

- [ ] **Step 3: `render()` 말미에 월별 갱신·바인딩 추가**

Task 2 Step 5에서 만든 블록을 교체한다.

찾을 블록:

```js
  app.innerHTML=h;
  fivesShown=PAGE_FIVES;monthShown=PAGE_MONTH;
  refreshFives(A);
  $('#moreFives').addEventListener('click',()=>{fivesShown+=PAGE_FIVES;refreshFives(A);});
  drawCharts(A);
```

다음으로 교체:

```js
  app.innerHTML=h;
  fivesShown=PAGE_FIVES;monthShown=PAGE_MONTH;
  refreshFives(A);refreshMonth(A);
  $('#moreFives').addEventListener('click',()=>{fivesShown+=PAGE_FIVES;refreshFives(A);});
  $('#moreMonth').addEventListener('click',()=>{monthShown+=PAGE_MONTH;refreshMonth(A);});
  drawCharts(A);
```

- [ ] **Step 4: 회귀 테스트**

Run: `node web/analyze.test.js`
Expected: `OK  all analyze tests passed`

- [ ] **Step 5: Commit**

```bash
git add web/dashboard.html
git commit -m "feat: 월별 집계 더보기 페이징 (#4)

초기 12개월, 더보기당 +12. tbody 부분 갱신.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: 통합 렌더 검증 (chrome-devtools)

**Files:** 변경 없음(검증 전용). 필요 시 앞 태스크 수정.

- [ ] **Step 1: 정적 서버 기동(백그라운드)**

`web/`를 정적 서빙한다. (서버는 `/analyze.js` 절대경로 해석용. `/api/*`는 없어도 됨 — render를 직접 호출하므로 `loadStored()`의 fetch 실패는 무시됨.)

Run (백그라운드): `python3 -m http.server 8799 --directory web`

- [ ] **Step 2: 페이지 열기**

chrome-devtools-mcp `new_page` 로 `http://127.0.0.1:8799/dashboard.html` 을 연다.

- [ ] **Step 3: 샘플 데이터로 render 주입 + 초기 상태 확인**

`evaluate_script` 로 실행한다(5★ 26개[캐릭터 25 + 출발 1], 13개월 분포 → 초기 표시 5★ 20행·월별 12행, 출발 카드 없음 기대):

```js
(()=>{
  const M=['2024-12','2025-01','2025-02','2025-03','2025-04','2025-05','2025-06','2025-07','2025-08','2025-09','2025-10','2025-11','2025-12'];
  const list=[];let id=1000000000000000000n;
  const push=o=>list.push({id:String(id++),item_type:'',name:'',item_id:'1403',...o});
  for(let i=0;i<25;i++){const t=`${M[i%M.length]}-15 10:00:00`;
    for(let j=0;j<5;j++)push({gacha_type:'11',rank_type:'3',name:'fill',time:t});
    push({gacha_type:'11',rank_type:'5',item_type:'角色',name:'캐릭터'+i,item_id:'1403',time:t});}
  push({gacha_type:'2',rank_type:'5',item_type:'角色',name:'출발보장',item_id:'1001',time:'2024-12-10 10:00:00'});
  render(WarpAnalyze.analyze({info:{uid:'888888888'},list}));
  const A=WarpAnalyze.analyze({info:{},list});
  return {all5:A.all5.length, months:A.monthly.length,
    fivesShown:document.querySelectorAll('#fivesBody tr').length,
    monthShown:document.querySelectorAll('#monthBody tr').length,
    moreFivesText:document.querySelector('#moreFives').textContent,
    moreMonthText:document.querySelector('#monthBody')&&document.querySelector('#moreMonth').textContent,
    beginnerCard:[...document.querySelectorAll('.banner h3')].some(h=>/출발/.test(h.textContent))};
})()
```

Expected(반환 객체):
- `all5: 26`, `months: 13`
- `fivesShown: 20`, `monthShown: 12`
- `moreFivesText: "더보기 (6개 남음)"`, `moreMonthText: "더보기 (1개월 남음)"`
- `beginnerCard: false` (출발 카드 미표시)

- [ ] **Step 4: 더보기 클릭 동작 확인**

`evaluate_script` 로 실행한다:

```js
(()=>{
  document.querySelector('#moreFives').click();
  document.querySelector('#moreMonth').click();
  const fb=document.querySelector('#moreFives'),mb=document.querySelector('#moreMonth');
  return {
    fivesShown:document.querySelectorAll('#fivesBody tr').length,   // 26 (전부)
    monthShown:document.querySelectorAll('#monthBody tr').length,   // 13 (전부)
    fivesBtnHidden:getComputedStyle(fb).display==='none',          // true
    monthBtnHidden:getComputedStyle(mb).display==='none'};         // true
})()
```

Expected: `fivesShown: 26`, `monthShown: 13`, `fivesBtnHidden: true`, `monthBtnHidden: true`.

- [ ] **Step 5: 콘솔 에러 확인 + 스크린샷**

`list_console_messages` 로 에러가 없는지 확인하고, `take_screenshot` 으로 배너별 현황(출발 없음)·두 테이블·더보기 버튼을 시각 확인한다.

- [ ] **Step 6: 서버 종료**

백그라운드 `python3 -m http.server` 프로세스를 종료한다.

- [ ] **Step 7: (검증 실패 시) 수정 후 해당 태스크 재실행**

기대값과 다르면 원인 태스크의 코드를 고치고 Step 1~5를 다시 돌린다. 모두 통과하면 추가 커밋 없음(앞 태스크에서 이미 커밋됨). 코드 수정이 있었으면:

```bash
git add web/dashboard.html
git commit -m "fix: 대시보드 페이징 검증 반영 (#4)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage:**
- 5★ 페이징 → Task 2 ✓
- 월별 페이징 → Task 3 ✓
- 출발 카드 숨김 → Task 1 ✓
- "배너 카드만 숨김" 범위(데이터 보존) → Task 1이 렌더 스킵만 함, analyze 무변경 ✓
- 초기 20/12, 더보기 +20/+12 → Task 2/3 상수 `PAGE_FIVES=20`,`PAGE_MONTH=12` ✓
- analyze.test 회귀 → 각 태스크 Step ✓
- chrome-devtools 렌더 검증 → Task 4 ✓

**2. Placeholder scan:** TBD/TODO/"적절히 처리" 없음. 모든 코드 블록 완전 기재 ✓

**3. Type consistency:**
- id: `fivesBody`/`monthBody`/`moreFives`/`moreMonth` — 마크업·refresh·바인딩·검증 전반 일치 ✓
- 함수명: `fivesRowsHTML`/`monthRowsHTML`/`refreshFives`/`refreshMonth` — 정의·호출 일치 ✓
- 상수: `PAGE_FIVES`/`PAGE_MONTH`, 상태 `fivesShown`/`monthShown` — 선언·사용 일치 ✓
- `render()` 말미 블록은 Task 2가 만들고 Task 3가 확장(월별 추가) — 교체 대상 명시됨 ✓
- 검증 샘플의 `monthShown`은 월별 `tbody` 행 수를 가리키며, 상태변수 `monthShown`과 이름이 같지만 검증 스크립트는 DOM 쿼리라 충돌 없음 ✓
