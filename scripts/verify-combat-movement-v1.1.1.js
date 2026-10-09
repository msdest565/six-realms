'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const D=require('../src/data'),H=require('../src/grid'),M=require('../src/maps'),G=require('../src/game'),Controls=require('../src/controls'),FX=require('../src/fx');
const results=[];
function test(name,fn){try{fn();results.push({name,ok:true});}catch(error){results.push({name,ok:false,error:error.stack});console.error(name,error.stack);}}
const unit=(type,owner,q,id)=>G.normalizeUnit({id,type,owner,q,r:0});
const building=(type,owner,q,id='FACILITY')=>G.normalizeBuilding({id,type,owner,q,r:0,level:1});
function fixture(units=[],buildings=[],settings={}){
 const s=G.create(M.fixed((settings.playerCount||2)>2?'M':'S',settings.playerCount||2),{fog:false,...settings});
 s.cells=Array.from({length:6},(_,q)=>({q,r:0,terrain:'plain'}));s.units=units;s.buildings=buildings;
 for(const p of s.players){p.resources={money:2000,energy:200};s.knownBuildings[p.id]={};s.explored[p.id]=s.cells.map(c=>H.key(c.q,c.r));}
 G.vision(s);return s;
}
function ok(s,command){const result=G.execute(s,command);assert.equal(result.ok,true,result.error);}
function unique(s){assert.equal(new Set(s.units.map(u=>H.key(u.q,u.r))).size,s.units.length,'No committed unit stacking');}

test('All structural facilities take a visible direct hit and emit the actual damage effect',()=>{
 for(const type of ['hq','barracks','factory','port','airfield']){
  const a=unit('tank','P1',0,'A'),b=building(type,'P2',1),s=fixture([a],[b]),command={kind:'attack',unitId:a.id,targetId:b.id};
  const old=b.hp,p=G.attackPreview(s,a,b),before=FX.capture(s,command);ok(s,command);
  assert.equal(b.hp,old-p.damage);assert.ok(b.hp<old);assert.equal(s.knownBuildings.P1[b.id].hp,b.hp);
  const shot=FX.plan(before,s,command,'P1').steps.find(step=>step.kind==='shot');
  assert.equal(shot.to.id,b.id);assert.equal(shot.damage,old-b.hp);assert.equal(shot.to.isUnit,false);
 }
});
test('Default click attacks an in-range hostile facility; explicit movement remains available',()=>{
 const a=unit('tank','P1',0,'A'),b=building('factory','P2',1),s=fixture([a],[b]);
 const attack=Controls.resolve(s,{unitId:a.id,cell:b});assert.equal(attack.command.kind,'attack');
 assert.equal(Controls.resolve(s,{unitId:a.id,cell:b,intent:'move'}).command.kind,'move');
 ok(s,attack.command);assert.equal(a.q,0);assert.equal(b.owner,'P2');assert.equal(b.hp,150);
});
test('Neutral, ruined and income buildings retain move-and-capture as their default action',()=>{
 for(const mode of ['neutral','ruin','income']){
  const a=unit('tank','P1',0,'A'),b=building(mode==='income'?'city':'factory',mode==='neutral'?null:'P2',1),s=fixture([a],[b]);
  if(mode==='ruin')b.hp=0;
  const choice=Controls.resolve(s,{unitId:a.id,cell:b});assert.equal(choice.command.kind,'move');ok(s,choice.command);
  assert.equal(b.owner,'P1');assert.equal(a.q,1);assert.equal(a.ap,0);
 }
});
test('A protected garrison and its facility both lose HP and the effect includes structural damage',()=>{
 const a=unit('tank','P1',0,'A'),t=unit('infantry','P2',1,'GUARD'),b=building('factory','P2',1),s=fixture([a,t],[b]);
 const command=Controls.resolve(s,{unitId:a.id,cell:b}).command,before=FX.capture(s,command);ok(s,command);
 assert.equal(t.hp,35);assert.equal(b.hp,185);
 const shot=FX.plan(before,s,command,'P1').steps.find(step=>step.kind==='shot');
 assert.equal(shot.damage,45);assert.equal(shot.shelter.damage,15);assert.equal(shot.shelter.to.id,b.id);
});
test('A lethal direct hit reaches zero and disables production without removing ownership',()=>{
 const a=unit('tank','P1',0,'A'),b=building('factory','P2',1),s=fixture([a],[b]);b.hp=10;
 ok(s,Controls.resolve(s,{unitId:a.id,cell:b}).command);
 assert.equal(b.hp,0);assert.equal(b.owner,'P2');assert.equal(G.buildingActive(b),false);
});
test('All 38 models traverse compatible friendly cells without moving the occupant',()=>{
 for(const d of D.units){
  const a=unit(d.id,'P1',0,'A'),friend=unit(d.branch==='navy'?'aafrigate':'infantry','P1',1,'FRIEND'),s=fixture([a,friend]);
  if(d.branch==='navy')s.cells.forEach(c=>c.terrain='ocean');
  const route=G.movement(s,a).get('2,0');assert.ok(route,d.id);assert.equal(route.path[0].q,1);
  ok(s,{kind:'move',unitId:a.id,q:2,r:0});assert.equal(a.q,2,d.id);assert.equal(friend.q,1);unique(s);
 }
});
test('Allied players also permit transit through their unit cells',()=>{
 const a=unit('tank','P1',0,'A'),friend=unit('infantry','P2',1,'ALLY'),s=fixture([a,friend],[],{playerCount:4});
 G.player(s,'P2').teamId=G.player(s,'P1').teamId;G.vision(s);
 assert.ok(G.movement(s,a).get('2,0'));ok(s,{kind:'move',unitId:a.id,q:2,r:0});assert.equal(a.q,2);assert.equal(friend.q,1);unique(s);
});
test('An occupied friendly destination is rejected atomically and explained by the controller',()=>{
 const a=unit('tank','P1',0,'A'),friend=unit('infantry','P1',1,'FRIEND'),s=fixture([a,friend]),before=JSON.stringify(s);
 assert.equal(G.movement(s,a).has('1,0'),false);assert.equal(G.execute(s,{kind:'move',unitId:a.id,q:1,r:0}).ok,false);assert.equal(JSON.stringify(s),before);
 assert.match(Controls.resolve(s,{unitId:a.id,cell:friend,button:'right'}).message,/穿过友军/);
});
test('Visible enemies still block a narrow corridor',()=>{
 const a=unit('tank','P1',0,'A'),enemy=unit('infantry','P2',1,'ENEMY'),s=fixture([a,enemy]);
 assert.equal(G.movement(s,a).has('2,0'),false);
});
test('An unseen enemy after a friendly column stops movement on the last free cell',()=>{
 const a=unit('tank','P1',0,'A'),friend=unit('infantry','P1',2,'FRIEND'),enemy=unit('infantry','P2',3,'HIDDEN'),s=fixture([a,friend,enemy],[],{fog:true});
 s.vision.P1={ground:['0,0'],air:[]};assert.ok(G.movement(s,a).has('3,0'));
 ok(s,{kind:'move',unitId:a.id,q:3,r:0});assert.equal(a.q,1);assert.equal(a.spentMove,1);assert.equal(a.ap,1);assert.equal(G.player(s).resources.energy,198);unique(s);
});
test('A blocked friendly-only prefix leaves position, AP and fuel unchanged',()=>{
 const a=unit('tank','P1',0,'A'),friend=unit('infantry','P1',1,'FRIEND'),enemy=unit('infantry','P2',2,'HIDDEN'),s=fixture([a,friend,enemy],[],{fog:true});
 s.vision.P1={ground:['0,0'],air:[]};ok(s,{kind:'move',unitId:a.id,q:2,r:0});
 assert.equal(a.q,0);assert.equal(a.ap,2);assert.equal(a.spentMove,0);assert.equal(G.player(s).resources.energy,200);unique(s);
});
test('Crossing a friendly rubble cell pays its movement and fuel costs',()=>{
 const a=unit('tank','P1',0,'A'),friend=unit('infantry','P1',1,'FRIEND'),s=fixture([a,friend]);G.cell(s,friend).terrain='rubble';
 ok(s,{kind:'move',unitId:a.id,q:2,r:0});assert.equal(a.spentMove,3);assert.equal(a.ap,1);assert.equal(G.player(s).resources.energy,196);
});
test('Road transit retains the shared per-turn budget across two moves',()=>{
 const a=unit('infantry','P1',0,'A'),f1=unit('infantry','P1',1,'F1'),f2=unit('infantry','P1',3,'F2'),s=fixture([a,f1,f2]);
 s.cells.forEach(c=>c.terrain='road');ok(s,{kind:'move',unitId:a.id,q:2,r:0});ok(s,{kind:'move',unitId:a.id,q:4,r:0});
 assert.equal(a.spentMove,4);assert.equal(a.ap,0);assert.equal(G.player(s).resources.energy,200);unique(s);
});
test('Friendly occupants do not make incompatible terrain traversable',()=>{
 for(const [type,terrain] of [['infantry','ridge'],['infantry','ocean'],['aafrigate','plain']]){
  const a=unit(type,'P1',0,'A'),friend=unit('fighter','P1',1,'FRIEND'),s=fixture([a,friend]);
  if(type==='aafrigate')s.cells.forEach(c=>c.terrain='ocean');G.cell(s,friend).terrain=terrain;
  assert.equal(G.movement(s,a).has('2,0'),false);
 }
});
test('Passing an occupied building does not capture it or release its blocked warehouse',()=>{
 const a=unit('infantry','P1',0,'A'),friend=unit('infantry','P1',1,'FRIEND'),b=building('barracks','P1',1),s=fixture([a,friend],[b]);
 b.deployment={q:1,r:0};b.stock=[{id:'STOCK',type:'infantry',sourceId:b.id}];
 ok(s,{kind:'move',unitId:a.id,q:2,r:0});assert.equal(b.stock.length,1);assert.equal(G.occupied(s,b).id,friend.id);unique(s);
 const enemyBuilding=building('city','P2',1,'CITY'),other=fixture([unit('infantry','P1',0,'A'),unit('infantry','P1',1,'FRIEND')],[enemyBuilding]);
 ok(other,{kind:'move',unitId:'A',q:2,r:0});assert.equal(enemyBuilding.owner,'P2');
});
test('Movement effects follow friendly transit cells and still finish on a free destination',()=>{
 const a=unit('infantry','P1',0,'A'),friend=unit('infantry','P1',1,'FRIEND'),s=fixture([a,friend]),command={kind:'move',unitId:a.id,q:2,r:0},before=FX.capture(s,command);
 ok(s,command);const move=FX.plan(before,s,command,'P1').steps.find(step=>step.kind==='move'),path=move.segments.flat();
 assert.deepEqual(path.map(p=>p.q),[0,1,2]);assert.equal(move.destinationVisible,true);unique(s);
});
const report={version:'1.1.1',scope:'Building damage, controller commands, actual movement and observed effects; no browser measurement',passed:results.filter(r=>r.ok).length,total:results.length,results};
fs.writeFileSync('reports/combat-movement-tests-v1.1.1.json',JSON.stringify(report,null,2));console.log('Combat and movement: '+report.passed+'/'+report.total);
if(report.passed!==report.total)process.exitCode=1;
