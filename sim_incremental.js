// Faithful port of the PowerShell incremental-fetch + merge + monthly-bucket logic.
const assert=require('assert');

// ---- mock server: full history per banner, returns NEWEST-first pages of 20 ----
function makeServer(){
  const db={'1':[],'2':[],'11':[],'12':[]};
  let id=1000;
  // helper to push a record (chronological); id increases with time
  const add=(t,month)=>{id+=7;db[t].push({id:String(id),gacha_type:t,rank_type:'3',item_id:'1',name:'x',count:'1',item_type:'C',time:`2025-${month}-01 00:00:00`,uid:'42'});};
  for(let i=0;i<55;i++)add('11', String(1+(i%9)).padStart(2,'0'));
  for(let i=0;i<23;i++)add('12','03');
  for(let i=0;i<11;i++)add('1','02');
  for(let i=0;i<50;i++)add('2','01');
  return {
    db,
    getGachaLog(t,end_id){ // newest-first, items with id < end_id (or newest if end_id==0)
      const sorted=[...db[t]].sort((a,b)=>Number(b.id)-Number(a.id)); // desc
      const start = end_id==='0'?sorted:sorted.filter(r=>Number(r.id)<Number(end_id));
      return start.slice(0,20);
    },
    addNew(t,n,month){for(let i=0;i<n;i++)add(t,month);}
  };
}

// ---- port of PS fetch loop ----
function run(server, existing){
  const seen=new Set(existing.map(r=>String(r.id)));
  const lastId={'1':0,'2':0,'11':0,'12':0};
  for(const r of existing){const t=String(r.gacha_type);if(Number(r.id)>lastId[t])lastId[t]=Number(r.id);}
  const neu=[];
  for(const t of ['1','2','11','12']){
    let endId='0',stop=false,guard=0;
    while(!stop){
      if(++guard>1000)throw new Error('loop guard');
      const list=server.getGachaLog(t,endId);
      if(list.length===0)break;
      for(const it of list){
        if(Number(it.id)<=lastId[t]){stop=true;break;}
        if(!seen.has(String(it.id))){seen.add(String(it.id));neu.push(it);}
      }
      endId=list[list.length-1].id;
    }
  }
  return neu;
}

// ---- monthly bucketing port ----
function bucket(all){
  const m={};
  for(const r of all){const k=r.time.slice(0,7).replace('-','');(m[k]=m[k]||[]).push(r);}
  return m;
}

// ===== TEST 1: first run fetches everything =====
const s=makeServer();
const total=s.db['1'].length+s.db['2'].length+s.db['11'].length+s.db['12'].length;
let existing=[];
let neu=run(s,existing);
assert.strictEqual(neu.length,total,`first run should fetch all ${total}, got ${neu.length}`);
existing=existing.concat(neu);
assert.strictEqual(new Set(existing.map(r=>r.id)).size, total,'no dupes after run1');

// ===== TEST 2: second run with no new data fetches nothing =====
neu=run(s,existing);
assert.strictEqual(neu.length,0,'second run with no changes fetches 0');

// ===== TEST 3: add new records, incremental fetches ONLY the new ones =====
s.addNew('11',5,'05'); s.addNew('12',3,'05');
neu=run(s,existing);
assert.strictEqual(neu.length,8,`incremental should fetch only 8 new, got ${neu.length}`);
const merged=existing.concat(neu);
assert.strictEqual(new Set(merged.map(r=>r.id)).size, total+8,'merged dedup correct');

// ===== TEST 4: monthly bucketing covers all & sums back to total =====
const buckets=bucket(merged);
const sum=Object.values(buckets).reduce((a,b)=>a+b.length,0);
assert.strictEqual(sum, total+8,'monthly buckets sum to total');
assert.ok(Object.keys(buckets).every(k=>/^\d{6}$/.test(k)),'all bucket keys YYYYMM');

// ===== TEST 5: stop condition handles a NEW record sharing a page with old ones =====
// add 1 new record to banner 1 (which had 11, all in one page of 20) -> should fetch exactly 1
s.addNew('1',1,'06');
neu=run(s,merged);
assert.strictEqual(neu.length,1,`mixed page: fetch only the 1 new, got ${neu.length}`);

console.log('OK  incremental + merge + monthly logic verified (5 scenarios)');
