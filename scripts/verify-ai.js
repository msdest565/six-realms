const assert=require('node:assert/strict'),fs=require('node:fs');
const D=require('../src/data'),H=require('../src/grid'),M=require('../src/maps'),G=require('../src/game'),AI=require('../src/ai'),C=require('../src/campaign'),S=require('../src/storage');
const results=[],battles=[];
function test(name,fn){try{fn();results.push({name,ok:true});}catch(e){results.push({name,ok:false,error:e.stack});console.error(name,e.stack);}}
function unit(type,owner,q,r,id=type+owner){return G.normalizeUnit({id,type,owner,q,r});}
function building(type,owner,q,r,id=type+owner){const d=D.buildingById[type];return G.normalizeBuilding({id,type,owner,q,r,level:1,hp:d.hp,maxHp:d.hp,state:'complete',stock:[],order:null});}
function fixture(units=[],buildings=[],difficulty='standard',fog=false){
 const s=G.create(M.fixed('S',2),{difficulty,fog});s.cells=[];
 for(let q=-8;q<=8;q++)for(let r=-8;r<=8;r++)s.cells.push({q,r,terrain:'plain'});
 s.actor='P2';s.units=units;s.buildings=buildings;s.knownBuildings={P1:{},P2:{}};
 for(const p of s.players){p.resources={money:2500,energy:200};p.ownTurnIndex=1;}
 for(const u of units)G.tuneUnit(s,u);G.vision(s);return s;
}
function execute(s,c){const r=G.execute(s,c);assert.equal(r.ok,true,r.error);return r;}
function preview(s){const before=JSON.stringify(s),r=AI.decision(s);assert.equal(JSON.stringify(s),before,'AI decision preview must not mutate state');return r;}
test('Four profiles and legacy aliases are canonical',()=>{
 assert.deepEqual(AI.difficulties.map(d=>d.id),['easy','standard','hard','hell']);assert.equal(G.difficulty('training'),'easy');assert.equal(G.difficulty('challenge'),'hard');assert.equal(G.difficulty('toString'),'standard');
});
test('Only AI receives unit attribute multipliers; catalog and human stay unchanged',()=>{
 const catalog=JSON.stringify(D.units);
 for(const [difficulty,scale] of [['easy',.85],['standard',1],['hard',1],['hell',1.2]]){
  const s=G.create(M.fixed('S',2),{difficulty,deferStart:true});
  for(const u of s.units)assert.equal(u.maxHp,Math.round(D.byId[u.type].hp*(u.owner==='P2'?scale:1)));
  const human=G.ownUnits(s,'P1')[0];assert.equal(G.unitStats(s,human).damage,D.byId[human.type].damage);
 }
 assert.equal(JSON.stringify(D.units),catalog);
});
test('Damage scales base plus bonuses before armor and terrain cover',()=>{
 const a=unit('infantry','P2',0,0),t=unit('infantry','P1',1,0),easy=fixture([a,t],[],'easy');assert.equal(G.standardDamage(easy,a,t),34);
 const b=unit('infantry','P2',0,0),t2=unit('infantry','P1',1,0),hell=fixture([b,t2],[],'hell');assert.equal(G.standardDamage(hell,b,t2),48);
 const armor=unit('tank','P2',1,0),s=fixture([unit('tank','P1',0,0),armor],[],'hell');assert.equal(G.unitStats(s,armor).armor,22);assert.equal(G.standardDamage(s,s.units[0],armor),D.byId.tank.damage+D.byId.tank.bonusArmor-22);
});
test('Preview, execution and counterattack agree at both numerical difficulty extremes',()=>{
 for(const [difficulty,damage,counter] of [['easy',34,17],['hell',48,24]]){
  const a=unit('infantry','P2',0,0),t=unit('infantry','P1',1,0),s=fixture([a,t],[],difficulty);const r=G.attackPreview(s,a,t);assert.equal(r.damage,damage);assert.equal(r.counter,20); // Human retaliation keeps its baseline damage.
  execute(s,{kind:'attack',unitId:a.id,targetId:t.id});assert.equal(t.hp,80-damage);assert.equal(a.hp,a.maxHp-20);
  const both=G.create(M.fixed('S',2),{difficulty,controllers:['ai','ai']});const x=unit('infantry','P1',0,0),y=unit('infantry','P2',1,0);both.cells=[{q:0,r:0,terrain:'plain'},{q:1,r:0,terrain:'plain'}];both.units=[x,y];G.tuneUnit(both,x);G.tuneUnit(both,y);both.settings.fog=false;assert.equal(G.attackPreview(both,x,y).counter,counter);
 }
});
test('Dedicated AA multiplies tuned retaliation once and caps it at attacker HP',()=>{
 const aa=unit('antiair','P2',1,0),bomber=unit('lightbomber','P1',0,0),s=fixture([aa,bomber],[],'hell');s.actor='P1';const r=G.attackPreview(s,bomber,aa);assert.equal(r.counter,100);execute(s,{kind:'attack',unitId:bomber.id,targetId:aa.id});assert.equal(G.unit(s,bomber.id),undefined);
});
test('All 38 deployed AI models receive the correct maximum HP',()=>{
 for(const model of D.units){const f=building(model.facility,'P2',0,0),s=fixture([],[f],'hell');f.stock=[{id:'stock',type:model.id,sourceId:f.id}];if(model.branch==='navy'&&!model.amphibious)G.cell(s,{q:1,r:0}).terrain='ocean';execute(s,{kind:'deploy',buildingId:f.id,stockId:'stock',q:1,r:0});assert.equal(s.units[0].maxHp,Math.round(model.hp*1.2));}
});
test('Campaign settings tune enemies, including wounded starting units, before intro',()=>{
 const normal=C.create('C02',{...C.newProgress(),unlocked:['C02']}),hell=C.create('C02',{...C.newProgress(),unlocked:['C02']},{difficulty:'hell'});
 for(const u of hell.units){const base=G.unit(normal,u.id);assert.equal(u.maxHp,Math.round(base.maxHp*(u.owner==='red'?1.2:1)));assert.equal(u.hp,Math.round(base.hp*u.maxHp/base.maxHp));}
 assert.equal(hell.turnStarted,false);assert.deepEqual(G.player(hell,'union').resources,G.player(normal,'union').resources);
});
test('Tuning wounded reinforcements is proportional and idempotent without resetting AP',()=>{
 const s=G.create(M.fixed('S',2),{difficulty:'hell'}),u=unit('infantry','P2',0,0);u.hp=40;u.ap=1;u.status.jam={turn:2,protectedUntil:4};G.tuneUnit(s,u);assert.deepEqual([u.hp,u.maxHp,u.ap],[48,96,1]);const before=JSON.stringify(u);G.tuneUnit(s,u);assert.equal(JSON.stringify(u),before);
});
test('Repair uses instance maxHp and cannot overfill a tuned AI unit',()=>{
 const e=unit('engineer','P2',0,0),t=unit('infantry','P2',1,0),s=fixture([e,t],[],'hell');t.hp=80;execute(s,{kind:'skill',unitId:e.id,targetId:t.id});assert.equal(t.hp,96);
});
test('Hell scales only AI initial resources and income, retaining caps',()=>{
 const s=G.create(M.fixed('S',2),{difficulty:'hell',deferStart:true});assert.deepEqual(G.player(s,'P1').resources,{money:600,energy:60});assert.deepEqual(G.player(s,'P2').resources,{money:900,energy:90});assert.deepEqual(G.income(s,'P2'),{money:180,energy:21});G.begin(s);execute(s,{kind:'end'});assert.deepEqual(G.player(s).resources,{money:1080,energy:111});G.player(s).resources={money:2999,energy:299};s.turnStarted=false;G.begin(s);assert.deepEqual(G.player(s).resources,{money:3000,energy:300});
});
test('Neutral and AI-owned buildings keep baseline HP and construction prices',()=>{
 const h=building('hq','P2',0,0),neutral=building('city',null,2,0),s=fixture([],[h,neutral],'hell');const before=G.player(s).resources.money;execute(s,{kind:'construct',type:'market',q:1,r:0});assert.equal(before-G.player(s).resources.money,D.buildingById.market.cost);assert.equal(s.buildings[2].maxHp,null);assert.equal(neutral.hp,null);
});
test('Save restoration and repeated exports do not multiply HP or resources again',()=>{
 const s=G.create(M.fixed('S',2),{difficulty:'hell'});const ai=G.ownUnits(s,'P2')[0];ai.hp-=11;const original=JSON.stringify({units:s.units,resources:s.players.map(p=>p.resources)});let restored=s;
 for(let i=0;i<4;i++){restored=S.restore(S.pack(restored,'AI tuning'));assert.equal(JSON.stringify({units:restored.units,resources:restored.players.map(p=>p.resources)}),original);}
});
test('Legacy training migrates to easy once and challenge to hard without resource changes',()=>{
 for(const [legacy,canonical,factor] of [['training','easy',.85],['challenge','hard',1]]){
  const old=G.create(M.fixed('S',2));delete old.aiDifficultyVersion;old.settings.difficulty=legacy;for(const u of old.units)delete u.difficultyApplied;
  const snapshot=M.clone(old);delete snapshot.cells;const entry={snapshot,checksum:M.sha256(M.canonical(snapshot))};const restored=S.restore(entry);assert.equal(restored.settings.difficulty,canonical);assert.equal(G.ownUnits(restored,'P2')[0].maxHp,Math.round(80*factor));assert.deepEqual(restored.players.map(p=>p.resources),old.players.map(p=>p.resources));assert.equal(S.restore(S.pack(restored,'again')).units[6].maxHp,restored.units[6].maxHp);
 }
});
test('Corrupt instance HP and unsupported difficulty versions are rejected',()=>{
 const s=G.create(M.fixed('S',2),{difficulty:'hell'});s.units[6].maxHp=999;assert.throws(()=>S.validate(s),/单位/);s.units[6].maxHp=96;s.aiDifficultyVersion=2;assert.throws(()=>S.validate(s),/难度/);
});
test('Hard focuses a killable enemy instead of spreading fire',()=>{
 const a=unit('tank','P2',0,0),t=unit('tank','P1',1,0),weak=unit('infantry','P1',-1,0),s=fixture([a,t,weak],[],'hard');weak.hp=10;assert.equal(preview(s).command.targetId,weak.id);
});
test('Hard chooses a safer approach than baseline against stationary artillery',()=>{
 const make=difficulty=>fixture([unit('scout','P2',0,0),unit('artillery','P1',5,0)],[building('city','P1',7,0)],difficulty);
 const standard=make('standard'),hard=make('hard'),a=preview(standard).command,b=preview(hard).command;assert.equal(a.kind,'move');assert.equal(b.kind,'move');const field=AI.threatMap(hard,hard.units[0],[hard.units[1]]);assert.ok((field.get(H.key(b.q,b.r))?.damage||0)<(field.get(H.key(a.q,a.r))?.damage||0));
});
test('Hard production counters observed aircraft with an affordable AA model',()=>{
 const f=building('factory','P2',0,0),s=fixture([unit('fighter','P1',5,0)],[f],'hard');const r=preview(s);assert.equal(r.command.kind,'produce');assert.equal(D.byId[r.command.type].antiAir,true);
});
test('Hard invests in energy before fuel-heavy expansion when needed',()=>{
 const energy=building('energyfield','P2',0,0),s=fixture([unit('tank','P2',1,0),unit('fighter','P2',0,1),unit('bomber','P2',-1,0)],[energy],'hard');G.player(s).resources.energy=0;const r=preview(s);assert.equal(r.command.kind,'upgrade');assert.equal(r.command.buildingId,energy.id);
});
test('Decision previews are pure even when obsolete enemy plans exist',()=>{
 const s=G.create(M.campaign('C02'));s.actor='red';s.turnStarted=true;const b=G.building(s,'C02-RB');b.owner='union';const before=JSON.stringify(s);AI.decision(s);assert.equal(JSON.stringify(s),before);AI.choose(s);assert.equal(s.enemyPlan[0].state,'cancelled');
});
test('Hidden opponent changes do not affect AI command, score or threat summary',()=>{
 const a=unit('scout','P2',0,0),hidden=unit('tank','P1',7,0),b=building('city',null,5,0),s=fixture([a,hidden],[b],'hard',true);s.vision.P2={ground:['0,0'],air:['0,0']};const before=preview(s);hidden.q=-7;hidden.hp=1;assert.deepEqual(preview(s),before);
});
test('Public decision redacts invisible actions and never exposes private scores or threat data',()=>{
 const a=unit('tank','P2',0,0),t=unit('infantry','P1',1,0),s=fixture([a,t],[],'hard',true);s.vision.P1={ground:[],air:[]};const raw=preview(s),publicResult=AI.forViewer(s,raw,'P1');assert.equal(raw.phase,'attack');assert.ok(['attack','skill'].includes(raw.command.kind));assert.equal(publicResult.command,null);assert.equal(publicResult.phase,'dispatch');assert.deepEqual(publicResult.scores,[]);assert.equal(publicResult.threat,null);assert.ok(!publicResult.reason.includes('步兵'));
 s.vision.P1={ground:['0,0','1,0'],air:[]};assert.equal(AI.forViewer(s,raw,'P1').phase,'attack');assert.equal(AI.forViewer(s,raw,'P1').command.kind,raw.command.kind);
});
test('Decision is deterministic and public projection does not re-evaluate or mutate it',()=>{
 const s=G.create(M.fixed('S',2),{difficulty:'hell',controllers:['ai','ai']});const raw=preview(s),before=JSON.stringify(raw);assert.deepEqual(preview(s),raw);AI.forViewer(s,raw,'P2');assert.equal(JSON.stringify(raw),before);
});
test('All difficulties preserve campaign finite production authorizations',()=>{
 for(const difficulty of ['easy','standard','hard','hell']){const s=C.create('C02',{...C.newProgress(),unlocked:['C02']},{difficulty});C.confirm(s);execute(s,{kind:'end'});const r=preview(s);if(r.command.kind==='produce')assert.ok(s.enemyPlan.some(p=>p.unit===r.command.type&&p.state==='pending'));G.building(s,'C02-RB').level=3;assert.match(G.productionReason(s,G.building(s,'C02-RB'),'heavyinfantry'),/有限生产计划未授权/);}
});

if(!process.argv.includes('--quick'))for(const difficulty of ['easy','standard','hard','hell'])for(const mode of ['free','campaign']){
 test(`${difficulty} ${mode} natural AI battle completes with legal economy and commands`,()=>{
  const s=G.create(mode==='free'?M.fixed('S',2):M.campaign('C03'),{difficulty,controllers:['ai','ai'],fog:true});if(mode==='campaign'){s.players[0].controller='ai';for(const u of s.units)G.tuneUnit(s,u);}
  let actions=0,start=Date.now();
  for(;actions<2200&&!s.result;actions++){const raw=preview(s);assert.ok(raw.command);execute(s,raw.command);for(const p of s.players){assert.ok(p.resources.money>=0&&p.resources.energy>=0);assert.ok(G.count(s,p.id)<=24);}if(actions%100===0)S.validate(s);}
  assert.ok(s.result,`${difficulty} ${mode} stalled after ${actions} commands in round ${s.round}`);S.validate(s);const report={difficulty,mode,actions,rounds:s.round,milliseconds:Date.now()-start,winner:s.result.winner};battles.push(report);console.log(JSON.stringify(report));
 });
}
fs.mkdirSync('reports',{recursive:true});fs.writeFileSync('reports/ai-tests-v0.8.json',JSON.stringify({date:new Date().toISOString(),passed:results.filter(x=>x.ok).length,total:results.length,results,battles},null,2));console.log(`AI: ${results.filter(x=>x.ok).length}/${results.length} groups passed`);if(results.some(x=>!x.ok))process.exitCode=1;
