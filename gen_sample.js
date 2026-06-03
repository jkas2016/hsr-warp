const fs=require('fs');
let id=1700000000000000000n;
let clock=new Date('2024-09-01T12:00:00Z').getTime();
const STD_CHAR={1003:'히메코',1004:'벨트',1101:'브로냐',1104:'게파드',1107:'클라라',1209:'연경',1211:'백로'};
const STD_LC={23000:'은하 철도의 밤',23002:'대체 불가능한 것',23003:'하지만 전투는 끝나지 않았다',23004:'세계의 이름으로',23005:'승리의 순간',23012:'죽은 듯이 잠들다',23013:'시간은 기다려주지 않는다'};
const LIM_CHAR={9001:'카프카',9002:'아케론',9003:'피라',9004:'붕괴',9005:'단항·음월'};
const LIM_LC={21001:'시공의 균열',21002:'은하를 가르며'};
const stdCharIds=Object.keys(STD_CHAR), stdLcIds=Object.keys(STD_LC);
const limCharIds=Object.keys(LIM_CHAR), limLcIds=Object.keys(LIM_LC);
const pick=a=>a[Math.floor(Math.random()*a.length)];
function rec(gt,rank,iid,name,type){
  id+=BigInt(1+Math.floor(Math.random()*40));
  clock+=1000*60*(30+Math.floor(Math.random()*1700));
  return {gacha_id:'1001',gacha_type:gt,item_id:String(iid),count:'1',
    time:new Date(clock).toISOString().slice(0,19).replace('T',' '),
    name,item_type:type,rank_type:String(rank),id:String(id)};
}
function sim(gt,n,kind){ // kind: 'char11','lc12','std1','beg2'
  const out=[];let p5=0,p4=0,guar=false;
  const soft=gt==='12'?65:74, cap=gt==='12'?80:(gt==='2'?50:90), rate=gt==='12'?0.75:0.5;
  for(let i=0;i<n;i++){
    p5++;p4++;let rank=3;
    if(p5>=cap)rank=5; else if(p5>=soft&&Math.random()<0.5)rank=5;
    else if(p4>=10)rank=4; else if(Math.random()<(gt==='12'?0.007:0.006))rank=5;
    else if(Math.random()<0.13)rank=4;
    if(rank===5){
      let iid,name,type;
      if(gt==='11'){type='Character';
        const win=guar||Math.random()<rate;
        if(win){iid=pick(limCharIds);name=LIM_CHAR[iid];guar=false;}
        else{iid=pick(stdCharIds);name=STD_CHAR[iid];guar=true;}
      }else if(gt==='12'){type='Light Cone';
        const win=guar||Math.random()<rate;
        if(win){iid=pick(limLcIds);name=LIM_LC[iid];guar=false;}
        else{iid=pick(stdLcIds);name=STD_LC[iid];guar=true;}
      }else{ // standard / beginner -> from standard pool
        if(Math.random()<0.5){iid=pick(stdCharIds);name=STD_CHAR[iid];type='Character';}
        else{iid=pick(stdLcIds);name=STD_LC[iid];type='Light Cone';}
      }
      out.push(rec(gt,5,iid,name,type));p5=0;p4=0;
    } else if(rank===4){out.push(rec(gt,4,'400'+i,'4성 항목','Character'));p4=0;}
    else out.push(rec(gt,3,'200'+i,'3성 광추','Light Cone'));
  }
  return out;
}
const list=[...sim('11',360),...sim('12',200),...sim('1',90),...sim('2',50)];
const data={info:{uid:'801234567',lang:'ko-kr',region:'prod_official_asia',region_time_zone:8,
  export_timestamp:Math.floor(Date.now()/1000),export_app:'DIY-HSR-Warp',export_app_version:'1.0',srgf_version:'v1.0'},list};
fs.writeFileSync('warp_data.sample.json',JSON.stringify(data,null,2));
const A=require('./analyze.js').analyze(data);
console.log('total',A.total,'5*',A.count5,'4*',A.count4);
A.banners.forEach(b=>{const s=b.stats;
  console.log(b.meta.short.padEnd(4),'pulls',s.total,'5*',s.count5,'avgPity',s.avgPity5.toFixed(1),
    s.win5050Rate!=null?`win50/50 ${(s.win5050Rate*100).toFixed(0)}% (W${s.cWins}/L${s.cLoss}/guar${s.gWins}) pickup${s.pickupTotal}`:'',
    s.currentGuaranteed?'[NEXT GUARANTEED]':'');});
console.log('char luck vs 62.5:', A.luck.charLuckPct.toFixed(1)+'%','| months:',A.monthly.length);
