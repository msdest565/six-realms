'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const D=require('../src/data'),H=require('../src/grid'),M=require('../src/maps'),G=require('../src/game'),AI=require('../src/ai'),C=require('../src/campaign'),S=require('../src/storage'),Undo=require('../src/move-undo');
const {harness,freeGame,copy}=require('./verify-ui-integration');
const results=[],benchmarks=[];
async function test(name,fn){try{await fn();results.push({name,ok:true});}catch(e){results.push({name,ok:false,error:e.stack});console.error(name,e.stack);}}
const unit=(type,owner,q,r=0,id=type+owner)=>({id,type,owner,q,r});
const facility=(type,q,r=0,id=type+q)=>({id,type,owner:'P2',q,r,level:1});
function field(units=[],buildings=[],settings={}){
 const ocean=settings.ocean||[],cells=[];for(let q=-9;q<=9;q++)for(let r=-9;r<=9;r++)cells.push({q,r,terrain:ocean.some(c=>c[0]===q&&c[1]===r)?'ocean':'plain'});
 const hq=[{id:'HQ1',type:'hq',owner:'P1',q:8,r:8,level:1},{id:'HQ2',type:'hq',owner:'P2',q:-8,r:-8,level:1}];
 const map={id:'BALANCE-LAB',size:'S',radius:9,playerCount:2,terrain:M.terrainObject(cells),buildings:[...hq,...buildings],initialUnits:units,seats:[{id:'P1',originalHqId:'HQ1'},{id:'P2',originalHqId:'HQ2'}],deposits:{land:[],sea:[]},actualSource:'standard'};map.contentHash=M.contentHash(map);
 const s=G.create(map,{fog:false,difficulty:'hard',...settings});s.actor='P2';s.turnStarted=true;for(const p of s.players){p.ownTurnIndex=1;p.resources={money:2500,energy:200};}G.vision(s);return s;
}
function ok(s,cmd){const r=G.execute(s,cmd);assert.ok(r.ok,r.error);return r;}
function decide(s){const before=JSON.stringify(s),d=AI.decision(s);assert.equal(JSON.stringify(s),before);return d;}
function move(s,undo,cmd){const before=undo.snapshot(s),result=ok(s,cmd);undo.commit(s,before,cmd,false,result);return result;}
function oldSave(s,aiVersion=true){const old=M.clone(s);delete old.cells;delete old.balanceVersion;if(!aiVersion)delete old.aiDifficultyVersion;for(const u of old.units){const d=D.byId[u.type],ai=G.player(old,u.owner).controller==='ai',scale=aiVersion&&ai?(old.settings.difficulty==='hell'?1.2:old.settings.difficulty==='easy'?.85:1):1;const max=Math.round((D.balance.legacyAirHp[u.type]||d.hp)*scale);u.hp=Math.max(1,Math.round(u.hp*max/u.maxHp));u.maxHp=max;}return {snapshot:old,checksum:M.sha256(M.canonical(old))};}
(async()=>{
 await test('all ten aircraft have less HP; long bomber retains role without one-hit infantry deletion',()=>{
  const old={reconplane:60,tacticalrecon:80,longrangerecon:100,lightfighter:100,fighter:130,heavyfighter:170,lightbomber:100,tacticalbomber:140,bomber:180,helicopter:90};for(const [id,hp] of Object.entries(old))assert.ok(D.byId[id].hp<hp,id);
  assert.deepEqual([D.byId.bomber.hp,D.byId.bomber.damage,D.byId.bomber.move,D.byId.bomber.maxRange],[135,60,7,3]);assert.deepEqual([D.byId.fighter.hp,D.byId.fighter.damage,D.byId.fighter.move],[105,40,6]);
  const s=field([unit('bomber','P1',0),unit('infantry','P2',1)]);s.actor='P1';const p=G.attackPreview(s,s.units[0],s.units[1]);assert.equal(p.damage,65);assert.equal(p.targetHp,15);assert.equal(p.counter,0);
 });
 await test('fighter specializes in air combat, bombing keeps sea/land and AA remains effective',()=>{
  const s=field([unit('fighter','P2',0),unit('infantry','P1',1),unit('fighter','P1',0,1,'AIR'),unit('bomber','P2',2,0,'BOMB'),unit('antiair','P1',3)],[]);
  assert.equal(G.standardDamage(s,s.units[0],s.units[1]),10);assert.equal(G.standardDamage(s,s.units[0],s.units[2]),65);assert.match(G.attackReason(s,s.units[3],s.units[2]),/对空/);assert.ok(G.attackPreview(s,s.units[3],s.units[4]).counter>0);assert.equal(D.byId.infantry.hp,80);assert.equal(D.byId.tank.hp,160);
 });
 await test('air movement uses the reduced whole-turn budget and unchanged energy charging',()=>{
  const s=field([unit('fighter','P2',0)]),u=s.units[0];ok(s,{kind:'move',unitId:u.id,q:3,r:0});assert.equal(u.spentMove,3);assert.equal(G.player(s).resources.energy,191);ok(s,{kind:'move',unitId:u.id,q:6,r:0});assert.equal(u.spentMove,6);assert.equal(u.ap,0);
 });
 await test('hell numerical and economy boosts are AI-only: 130/115/200 with caps',()=>{
  const s=G.create(M.fixed('S',2),{difficulty:'hell',deferStart:true});assert.deepEqual(G.player(s,'P1').resources,{money:600,energy:60});assert.deepEqual(G.player(s,'P2').resources,{money:1200,energy:120});assert.deepEqual(G.income(s,'P2'),{money:240,energy:28});assert.equal(G.unitStats(s,G.ownUnits(s,'P2')[0]).hp,104);assert.equal(G.unitStats(s,G.ownUnits(s,'P1')[0]).hp,80);
 });
 await test('older air and hell saves migrate wounds proportionally once without fresh income',()=>{
  const s=field([unit('bomber','P1',0),unit('infantry','P2',2),unit('fighter','P2',3)],[],{difficulty:'hell'});s.units.forEach(u=>u.hp=Math.floor(u.maxHp/2));const entry=oldSave(s);entry.snapshot.units.forEach(u=>u.hp=Math.floor(u.maxHp/2));entry.checksum=M.sha256(M.canonical(entry.snapshot));const resources=copy(entry.snapshot.players.map(p=>p.resources)),hash=entry.snapshot.map.contentHash;
  let loaded=S.restore(entry);assert.equal(loaded.units[0].maxHp,135);assert.equal(loaded.units[0].hp,68);assert.equal(loaded.units[1].maxHp,104);assert.equal(loaded.units[1].hp,52);assert.equal(loaded.units[2].maxHp,137);assert.deepEqual(copy(loaded.players.map(p=>p.resources)),resources);assert.equal(loaded.map.contentHash,hash);assert.equal(loaded.balanceVersion,1);const expected=JSON.stringify(loaded.units);for(let i=0;i<3;i++){loaded=S.restore(S.pack(loaded,'again'));assert.equal(JSON.stringify(loaded.units),expected);assert.deepEqual(copy(loaded.players.map(p=>p.resources)),resources);}
 });
 await test('pre-difficulty saves and unsupported balance versions retain strict validation',()=>{
  const s=field([unit('fighter','P2',0)],[],{difficulty:'easy'}),old=oldSave(s,false);const loaded=S.restore(old);assert.equal(loaded.units[0].maxHp,89);assert.equal(loaded.aiDifficultyVersion,1);assert.equal(loaded.balanceVersion,1);
  const corrupt=oldSave(s);corrupt.snapshot.units[0].maxHp=999;corrupt.checksum=M.sha256(M.canonical(corrupt.snapshot));assert.throws(()=>S.restore(corrupt),/生命/);loaded.balanceVersion=2;assert.throws(()=>S.validate(loaded),/平衡/);
 });
 await test('standard/hard/hell repeat paid campaign production after authored plan; easy cannot',()=>{
  for(const difficulty of ['easy','standard','hard','hell']){const s=G.create(M.campaign('C02'),{difficulty});s.actor='red';G.player(s).ownTurnIndex=4;G.player(s).resources.money=1000;const b=G.building(s,'C02-RB');s.enemyPlan.forEach(p=>p.state='submitted');if(difficulty==='easy')assert.match(G.productionReason(s,b,'infantry'),/有限/);else {const cash=G.player(s).resources.money;ok(s,{kind:'produce',buildingId:b.id,type:'infantry'});assert.equal(cash-G.player(s).resources.money,35);assert.equal(b.order.planId,undefined);assert.ok(!G.productionReason(s,{...b,order:null},'infantry'));}}
 });
 await test('dynamic recruitment still enforces ownership, cost, tiers, authorizations and total 24',()=>{
  const s=G.create(M.campaign('C02'),{difficulty:'hell'});s.actor='red';G.player(s).resources.money=1000;const b=G.building(s,'C02-RB');b.level=3;assert.match(G.productionReason(s,b,'heavyinfantry'),/授权/);b.level=1;G.player(s).resources.money=0;assert.match(G.productionReason(s,b,'infantry'),/金钱/);b.owner='union';assert.match(G.productionReason(s,b,'infantry'),/己方/);
  const free=field([], [facility('barracks',0)]);free.units=Array.from({length:24},(_,i)=>G.normalizeUnit(unit('infantry','P2',i%8,Math.floor(i/8),'CAP'+i),free));assert.match(G.productionReason(free,G.building(free,'barracks0'),'infantry'),/24/);
 });
 await test('production plan earliest turn is not submitted early by dynamic recruitment',()=>{
  const s=G.create(M.campaign('C02'));s.actor='red';G.player(s).ownTurnIndex=1;G.player(s).resources.money=1000;ok(s,{kind:'produce',buildingId:'C02-RB',type:'infantry'});assert.equal(s.enemyPlan[0].state,'pending');assert.equal(G.building(s,'C02-RB').order.planId,undefined);
 });
 await test('AI fills three idle factories this round with paid orders without spending unit AP',()=>{
  const s=field([unit('infantry','P1',8,8)],[facility('barracks',0),facility('factory',2),facility('factory',4)]),cash=G.player(s).resources.money;let spent=0;for(let i=0;i<3;i++){const cmd=decide(s).command;assert.equal(cmd.kind,'produce');spent+=D.byId[cmd.type].cost;ok(s,cmd);}assert.equal(G.ownBuildings(s).filter(b=>b.order?.kind==='unit').length,3);assert.equal(G.player(s).resources.money,cash-spent);
 });
 await test('AI frees blocked FIFO before continuing recruitment',()=>{
  const f=facility('barracks',0),s=field([unit('infantry','P2',0),unit('infantry','P1',8,8)],[f]),b=G.building(s,f.id);b.stock=[{id:'QUEUE',sourceId:b.id,type:'infantry'}];const cmd=decide(s).command;assert.equal(cmd.kind,'setDeployment');ok(s,cmd);assert.equal(b.stock.length,0);assert.equal(G.ownUnits(s).length,2);
 });
 await test('port switches an incompatible land setting to sea and then produces a vessel',()=>{
  const f=facility('port',0),s=field([unit('infantry','P1',8,8),unit('fighter','P1',1,2,'THREAT')],[f],{ocean:[[1,0]],difficulty:'hard'}),b=G.building(s,f.id);b.deployment={q:0,r:0};const first=decide(s).command;assert.equal(first.kind,'setDeployment');assert.deepEqual([first.q,first.r],[1,0]);ok(s,first);const next=decide(s).command;assert.equal(next.kind,'produce');assert.equal(D.byId[next.type].branch,'navy');ok(s,next);
 });
 await test('observed aircraft drives multiple AA orders, not omniscient enemy knowledge',()=>{
  const s=field([unit('fighter','P1',4,4),unit('bomber','P1',5,4)],[facility('factory',0),facility('factory',2)]);for(let i=0;i<2;i++){const cmd=decide(s).command;assert.equal(cmd.kind,'produce');assert.ok(D.byId[cmd.type].antiAir);ok(s,cmd);}
  const hidden=field([unit('fighter','P1',8,8)],[facility('factory',0)],{fog:true});const a=decide(hidden);hidden.units[0].type='bomber';hidden.units[0].hp=1;assert.deepEqual(decide(hidden),a);
 });
 await test('advanced AI protects an exposed HQ before new construction and holds the new defender',()=>{
  const s=field([unit('lighttank','P2',-4),unit('tank','P1',1)]),hq=G.building(s,'HQ2');hq.q=0;hq.r=0;G.vision(s);const cmd=decide(s).command;assert.equal(cmd.kind,'move');assert.deepEqual([cmd.q,cmd.r],[0,0]);ok(s,cmd);const follow=decide(s).command;assert.notEqual(follow.kind,'move');
 });
 await test('economy never spends rebuild money before repairing a ruined HQ',()=>{
  const s=field([unit('infantry','P1',8,8)],[facility('barracks',0)]),hq=G.building(s,'HQ2');hq.hp=0;const cmd=decide(s).command;assert.equal(cmd.kind,'repairBuilding');assert.equal(cmd.buildingId,hq.id);
 });
 await test('six recruitment turns sustain a real growing army with legal paid orders',()=>{
  const s=field([unit('infantry','P1',8,8)],[facility('barracks',0),facility('factory',2),facility('factory',4)],{difficulty:'hell'});let peak=0,orders=0,steps=0;const start=Date.now();
  for(let turn=0;turn<6&&!s.result;turn++){let ended=false;for(let action=0;action<100&&!s.result;action++){const cmd=AI.choose(s);assert.ok(cmd);if(cmd.kind==='produce')orders++;peak=Math.max(peak,G.count(s));ok(s,cmd);steps++;assert.ok(G.player(s,'P2').resources.money>=0);assert.ok(G.count(s,'P2')<=24);if(cmd.kind==='end'){ended=true;break;}}if(!s.result){assert.ok(ended);ok(s,{kind:'end'});}}
  assert.ok(orders>=9,orders);assert.ok(peak>=10,peak);benchmarks.push({label:'hell six recruitment turns',orders,peak,steps,milliseconds:Date.now()-start});S.validate(s);
 });
 await test('safe exploration of terrain remains undoable',()=>{
  const s=field([unit('infantry','P1',0),unit('infantry','P2',8,8)],[],{fog:true}),undo=Undo.create(G);s.actor='P1';const result=move(s,undo,{kind:'move',unitId:s.units[0].id,q:1,r:0});assert.deepEqual(result.encounteredEnemyIds,[]);assert.equal(undo.reason(s),'');assert.ok(undo.restore(s).ok);assert.equal(s.units[0].q,0);
 });
 await test('newly visible enemy locks this turn, clears earlier undo, and later moves cannot bypass',()=>{
  const s=field([unit('infantry','P1',0),unit('infantry','P2',5)],[],{fog:true}),u=s.units[0],undo=Undo.create(G);s.actor='P1';move(s,undo,{kind:'move',unitId:u.id,q:1,r:0});assert.equal(undo.reason(s),'');const result=move(s,undo,{kind:'move',unitId:u.id,q:2,r:0});assert.deepEqual(result.encounteredEnemyIds,[s.units[1].id]);assert.match(undo.reason(s),/侦察遇敌/);const before=JSON.stringify(s);assert.equal(undo.restore(s).ok,false);assert.equal(JSON.stringify(s),before);u.ap=2;move(s,undo,{kind:'move',unitId:u.id,q:1,r:0});assert.match(undo.reason(s),/侦察遇敌/);
 });
 await test('contact seen only midway through a flight still prohibits retreat undo',()=>{
  const s=field([unit('bomber','P1',-5),unit('infantry','P2',-3,4)],[],{fog:true}),u=s.units[0],e=s.units[1],undo=Undo.create(G);s.actor='P1';assert.equal(G.visible(s,'P1',e),false);const result=move(s,undo,{kind:'move',unitId:u.id,q:2,r:0});assert.equal(G.visible(s,'P1',e),false);assert.deepEqual(result.encounteredEnemyIds,[e.id]);assert.match(undo.reason(s),/侦察遇敌/);
 });
 await test('zero-distance collision with an unseen blocker also prohibits undo',()=>{
  const s=field([unit('infantry','P1',0),unit('infantry','P2',1)],[],{fog:true}),u=s.units[0],e=s.units[1],undo=Undo.create(G);s.actor='P1';s.vision.P1={ground:['0,0'],air:['0,0']};s.revealed.P1=[];const before=undo.snapshot(s),result=ok(s,{kind:'move',unitId:u.id,q:3,r:0});undo.commit(s,before,{kind:'move',unitId:u.id,q:3,r:0},false,result);assert.equal(u.q,0);assert.ok(result.encounteredEnemyIds.includes(e.id));assert.match(undo.reason(s),/侦察遇敌/);
 });
 await test('already visible enemy and allied units do not disable undo',()=>{
  const s=field([unit('infantry','P1',0),unit('infantry','P2',3),unit('infantry','P1',2,1,'ALLY')],[],{fog:true}),undo=Undo.create(G);s.actor='P1';assert.ok(G.visible(s,'P1',s.units[1]));const result=move(s,undo,{kind:'move',unitId:s.units[0].id,q:1,r:0});assert.deepEqual(result.encounteredEnemyIds,[]);assert.ok(undo.restore(s).ok);
 });
 await test('save/load before exploration restores position and clears ephemeral lock, without free income',()=>{
  const s=field([unit('infantry','P1',0),unit('infantry','P2',5)],[],{fog:true}),undo=Undo.create(G);s.actor='P1';const saved=S.pack(s,'before scout'),resources=copy(G.player(s).resources);move(s,undo,{kind:'move',unitId:s.units[0].id,q:2,r:0});assert.match(undo.reason(s),/侦察遇敌/);const restored=S.restore(saved);undo.clear();assert.equal(restored.units[0].q,0);assert.deepEqual(copy(G.player(restored).resources),resources);assert.ok(!Object.hasOwn(saved.snapshot,'encounterTurn'));assert.match(undo.reason(restored),/没有/);
 });
 await test('AI contact cannot lock human undo, next turn releases the contact latch',()=>{
  const s=field([unit('infantry','P1',0),unit('infantry','P2',5)],[],{fog:true}),undo=Undo.create(G);s.actor='P1';move(s,undo,{kind:'move',unitId:s.units[0].id,q:2,r:0});ok(s,{kind:'end'});ok(s,{kind:'end'});const before=undo.snapshot(s);ok(s,{kind:'move',unitId:s.units[0].id,q:1,r:0});undo.commit(s,before,{kind:'move',unitId:s.units[0].id,q:1,r:0});assert.equal(undo.reason(s),'');assert.ok(undo.restore(s).ok);
 });
 await test('phone controller forwards encounters and disables the actual undo icon',async()=>{
  const h=harness({}, {width:390,height:844,coarse:true});await freeGame(h);const G=h.context.Game,s=h.ui.game,H=h.context.Hex;s.settings.fog=true;
  const c=s.cells.find(c=>c.terrain==='plain'&&H.neighbors(c).some(n=>G.cell(s,n)?.terrain==='plain')),target=H.neighbors(c).map(n=>G.cell(s,n)).find(n=>n?.terrain==='plain');s.units=[];s.buildings.forEach(b=>b.owner=null);s.result=null;const own=G.normalizeUnit(unit('infantry',s.actor,c.q,c.r,'SCOUT'),s),other=G.normalizeUnit(unit('infantry',s.players.find(p=>p.id!==s.actor).id,target.q,target.r,'CONTACT'),s);s.units=[own,other];G.vision(s);s.vision[s.actor]={ground:[H.key(c.q,c.r)],air:[H.key(c.q,c.r)]};s.revealed[s.actor]=[];h.battle.focusUnit(own.id);const task=h.env.act({kind:'move',unitId:own.id,q:target.q,r:target.r});await h.finish();await task;assert.match(h.ui.moveUndoReason,/侦察遇敌/);const button=h.document.querySelector('[data-action="undo-move"]');assert.ok(button.disabled);assert.ok(button.dataset.tooltip.includes('读'));const revision=s.revision;await h.action('undo-move');assert.equal(s.revision,revision);
 });
 const report={version:'1.1.6',date:new Date().toISOString(),scope:'Air/hell balance, paid AI economy and tactics, legacy migration, real movement encounters + isolated phone controller; not human balance or browser QA',passed:results.filter(r=>r.ok).length,total:results.length,results,benchmarks};fs.writeFileSync('reports/balance-tests-v1.1.6.json',JSON.stringify(report,null,2)+'\n');console.log(`Balance/AI/fog ${report.passed}/${report.total}`);if(report.passed!==report.total)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
