const assert=require('node:assert/strict');
const D=require('../src/data'),H=require('../src/grid'),M=require('../src/maps'),G=require('../src/game'),Controls=require('../src/controls');
const results=[];
function test(name,fn){try{fn();results.push({name,ok:true});}catch(e){results.push({name,ok:false});console.error(name,e.stack);}}
function unit(type,owner,q,r,id=type+owner){return G.normalizeUnit({id,type,owner,q,r});}
function building(type,owner,q,r,id=type+owner){const d=D.buildingById[type];return G.normalizeBuilding({id,type,owner,q,r,level:1,hp:d.hp,maxHp:d.hp,state:'complete',stock:[],order:null});}
function fixture(units=[],buildings=[],fog=false){
  const s=G.create(M.fixed('S',2),{fog});s.cells=[];
  for(let q=-8;q<=8;q++)for(let r=-8;r<=8;r++)s.cells.push({q,r,terrain:'plain'});
  s.units=units;s.buildings=buildings;s.knownBuildings={P1:{},P2:{}};
  for(const p of s.players){p.resources={money:2500,energy:200};p.ownTurnIndex=p.id==='P1'?1:0;}
  G.vision(s);return s;
}
function resolve(s,options){const before=JSON.stringify(s),result=Controls.resolve(s,options);assert.equal(JSON.stringify(s),before,'resolver must not mutate game state');return result;}
function at(s,u,q,r,extra={}){return resolve(s,{unitId:u?.id,cell:{q,r},...extra});}
function kind(s,u,q,r,extra,expected){const result=at(s,u,q,r,extra);assert.equal(result.kind,expected,result.message);return result;}
test('Left click always selects a visible current-player unit in normal, move and attack modes',()=>{
  const a=unit('tank','P1',0,0),b=unit('infantry','P1',1,0),s=fixture([a,b]);
  for(const intent of [null,'move','attack'])assert.deepEqual(at(s,a,1,0,{intent}),{kind:'select',unitId:b.id});
});
test('No selected unit inspects instead of issuing a command',()=>{const s=fixture([unit('infantry','P2',1,0)]);assert.deepEqual(at(s,null,1,0),{kind:'inspect'});});
test('A selected unit moves on one left click or right click',()=>{
  const a=unit('tank','P1',0,0),s=fixture([a]);
  for(const button of ['left','right'])assert.deepEqual(at(s,a,1,0,{button}),{kind:'command',command:{kind:'move',unitId:a.id,q:1,r:0}});
});
test('Right click never changes selection to another own unit',()=>{
  const a=unit('infantry','P1',0,0),b=unit('infantry','P1',1,0,'friend'),s=fixture([a,b]);kind(s,a,1,0,{button:'right'},'error');
});
test('A visible enemy is attacked directly without confirmation',()=>{
  const a=unit('tank','P1',0,0),t=unit('infantry','P2',1,0),s=fixture([a,t]);
  assert.deepEqual(at(s,a,1,0),{kind:'command',command:{kind:'attack',unitId:a.id,targetId:t.id}});
});
test('Building and garrison use one direct attack',()=>{
  const a=unit('tank','P1',0,0),t=unit('infantry','P2',1,0),b=building('city','P2',1,0),s=fixture([a,t],[b]);
  const r=kind(s,a,1,0,{},'command');assert.equal(r.command.targetId,t.id);
});
test('Attack choices omit air targets when the attacker lacks AA',()=>{
  const a=unit('tank','P1',0,0),t=unit('fighter','P2',1,0),b=building('city','P2',1,0),s=fixture([a,t],[b]);
  assert.match(kind(s,a,1,0,{intent:'attack'},'error').message,/对空/);
});
test('A neutral building receives movement from an adjacent cell',()=>{
  const a=unit('infantry','P1',0,0),b=building('city',null,1,0),s=fixture([a],[b]);
  assert.deepEqual(at(s,a,1,0),{kind:'command',command:{kind:'move',unitId:a.id,q:1,r:0}});
});
test('A distant neutral building first receives a direct movement command',()=>{
  const a=unit('infantry','P1',0,0),b=building('city',null,2,0),s=fixture([a],[b]);assert.equal(kind(s,a,2,0,{},'command').command.kind,'move');
});
test('Explicit capture never falls back to movement or attack',()=>{
  const a=unit('infantry','P1',0,0),b=building('city',null,2,0),s=fixture([a],[b]);assert.match(kind(s,a,2,0,{intent:'capture'},'error').message,/本格/);
});
test('Capture mode works on the selected unit standing on a sea platform',()=>{
  const a=unit('aafrigate','P1',0,0),b=building('energyplatform',null,0,0),s=fixture([a],[b]);G.cell(s,a).terrain='ocean';G.vision(s);
  assert.deepEqual(at(s,a,0,0,{intent:'capture'}),{kind:'command',command:{kind:'capture',unitId:a.id,buildingId:b.id}});
});
test('Automatic deployment setting accepts occupied compatible tiles without selecting their unit',()=>{
  const b=building('barracks','P1',0,0),u=unit('infantry','P1',1,0),s=fixture([u],[b]);
  assert.deepEqual(at(s,null,1,0,{intent:'setDeployment',facilityId:b.id}),{kind:'command',command:{kind:'setDeployment',buildingId:b.id,q:1,r:0}});
});
test('Deployment setting validates facility, range and queued unit terrain',()=>{
  const b=building('barracks','P1',0,0),s=fixture([],[b]);b.stock=[{id:'inf',type:'infantry',sourceId:b.id}];G.cell(s,{q:1,r:0}).terrain='ocean';
  kind(s,null,1,0,{intent:'setDeployment',facilityId:b.id},'error');kind(s,null,2,0,{intent:'setDeployment',facilityId:b.id},'error');kind(s,null,0,0,{intent:'setDeployment',facilityId:'missing'},'error');
});
test('Allied buildings cannot be captured and allied units cannot be attacked',()=>{
  const a=unit('tank','P1',0,0),t=unit('infantry','P2',1,0),b=building('city','P2',1,0),s=fixture([a,t],[b]);s.players[1].teamId=s.players[0].teamId;
  kind(s,a,1,0,{intent:'capture'},'error');kind(s,a,1,0,{intent:'attack'},'error');
});
test('Movement respects remaining AP, energy, anchor and terrain',()=>{
  const a=unit('tank','P1',0,0),s=fixture([a]);a.ap=0;kind(s,a,1,0,{},'error');a.ap=2;s.players[0].resources.energy=0;kind(s,a,1,0,{},'error');s.players[0].resources.energy=200;a.status.anchor=true;kind(s,a,1,0,{},'error');delete a.status.anchor;G.cell(s,{q:1,r:0}).terrain='ridge';kind(s,a,1,0,{},'error');
});
test('Artillery cannot attack after moving and indirect attacks still need visibility',()=>{
  const a=unit('artillery','P1',0,0),t=unit('tank','P2',2,0),s=fixture([a,t]);a.movedSinceOwnStart=true;kind(s,a,2,0,{intent:'attack'},'error');
});
test('Sniper requires an unmoved attacker and honors cooldown',()=>{
  const a=unit('destroyer','P1',0,0),t=unit('tank','P2',1,0),s=fixture([a,t]);assert.equal(kind(s,a,1,0,{intent:'skill'},'command').command.targetId,t.id);a.movedSinceOwnStart=true;kind(s,a,1,0,{intent:'skill'},'error');a.movedSinceOwnStart=false;a.cooldownReady=3;kind(s,a,1,0,{intent:'skill'},'error');
});
test('Shock can target a unit but not a co-located building',()=>{
  const a=unit('artillery','P1',0,0),t=unit('tank','P2',2,0),b=building('city','P2',2,0),s=fixture([a,t],[b]);assert.equal(kind(s,a,2,0,{intent:'skill'},'command').command.targetId,t.id);s.units.pop();kind(s,a,2,0,{intent:'skill'},'error');
});
test('Repair mode repairs a friendly unit instead of selecting it',()=>{
  const a=unit('engineer','P1',0,0),t=unit('tank','P1',1,0),s=fixture([a,t]);t.hp-=40;assert.deepEqual(at(s,a,1,0,{intent:'skill'}),{kind:'command',command:{kind:'skill',unitId:a.id,targetId:t.id}});
});
test('Repair offers two damaged friendly targets on a shared tile',()=>{
  const a=unit('engineer','P1',0,0),t=unit('tank','P1',1,0),b=building('factory','P1',1,0),s=fixture([a,t],[b]);t.hp-=40;b.hp=50;assert.equal(kind(s,a,1,0,{intent:'skill'},'choices').choices.length,2);
});
test('Repair rejects self, full HP, foundations and already-repaired targets',()=>{
  const a=unit('engineer','P1',0,0),t=unit('tank','P1',1,0),b=building('city','P1',0,1),s=fixture([a,t],[b]);kind(s,a,0,0,{intent:'skill'},'error');kind(s,a,1,0,{intent:'skill'},'error');b.hp-=40;b.state='foundation';kind(s,a,0,1,{intent:'skill'},'error');b.state='complete';b.repairedOnOwnerTurn=1;kind(s,a,0,1,{intent:'skill'},'error');
});
test('Jam targets visible enemies including aircraft, but not buildings or protected units',()=>{
  const a=unit('jammer','P1',0,0),t=unit('fighter','P2',1,0),b=building('city','P2',1,0),s=fixture([a,t],[b]);assert.equal(kind(s,a,1,0,{intent:'skill'},'command').command.targetId,t.id);t.status.jam={turn:2,protectedUntil:4};kind(s,a,1,0,{intent:'skill'},'error');
});
test('Self buffs and scan issue target-free commands',()=>{
  for(const type of ['walker','heavy','scout']){const a=unit(type,'P1',0,0),s=fixture([a]);assert.deepEqual(kind(s,a,1,0,{intent:'skill'},'command').command,{kind:'skill',unitId:a.id});}
});
test('Passive skills do not become active commands',()=>{
  const a=unit('antitank','P1',0,0),t=unit('tank','P2',1,0),s=fixture([a,t]);assert.match(kind(s,a,1,0,{intent:'skill'},'error').message,/被动/);
});
test('Deployment commits directly and rejects incompatible terrain',()=>{
  const f=building('barracks','P1',0,0),s=fixture([],[f]);f.stock=[{id:'stock',type:'infantry',sourceId:f.id}];const extra={intent:'deploy',facilityId:f.id,stockId:'stock'};
  assert.deepEqual(at(s,null,1,0,extra),{kind:'command',command:{kind:'deploy',buildingId:f.id,stockId:'stock',q:1,r:0}});G.cell(s,{q:1,r:0}).terrain='ocean';kind(s,null,1,0,extra,'error');
});
test('Construction commits directly and retains placement and money checks',()=>{
  const h=building('hq','P1',0,0),s=fixture([],[h]),extra={intent:'construct',buildType:'city'};assert.equal(kind(s,null,1,0,extra,'command').command.kind,'construct');s.players[0].resources.money=0;kind(s,null,1,0,extra,'error');
});
test('Hidden blockers do not affect direct movement or target errors',()=>{
  const a=unit('tank','P1',0,0),t=unit('infantry','P2',1,0),s=fixture([a,t],[],true);s.vision.P1={ground:['0,0'],air:[]};const withEnemy=at(s,a,1,0);s.units.pop();assert.deepEqual(at(s,a,1,0),withEnemy);assert.equal(withEnemy.command.kind,'move');
});
test('Hidden aircraft do not reveal themselves via capture, deploy or construction cursors',()=>{
  for(const mode of ['capture','deploy','construct']){
    const a=unit('infantry','P1',0,0),hidden=unit('fighter','P2',1,0),hq=building('hq','P1',0,1),b=building(mode==='deploy'?'barracks':'city',mode==='capture'?null:'P1',1,0),s=fixture([a,hidden],[hq,...(mode==='construct'?[]:[b])],true);
    s.vision.P1={ground:['0,0','0,1','1,0'],air:[]};b.stock=[{id:'stock',type:'infantry',sourceId:b.id}];const opts={intent:mode,facilityId:b.id,stockId:'stock',buildType:'market'};const withHidden=at(s,a,1,0,opts);s.units.pop();assert.deepEqual(at(s,a,1,0,opts),withHidden);assert.equal(withHidden.kind,mode==='capture'?'error':'command');
  }
});
test('Last observed hidden buildings are inspectable, never blind attack or capture targets',()=>{
  const a=unit('tank','P1',0,0),b=building('city','P2',1,0),s=fixture([a],[b],true);s.knownBuildings.P1[b.id]={...b};s.vision.P1={ground:['0,0'],air:[]};kind(s,a,1,0,{intent:'attack'},'error');kind(s,a,1,0,{intent:'capture'},'error');
});
test('Hidden changes to known building ownership/HP do not alter command resolution',()=>{
  const a=unit('tank','P1',0,0),b=building('city','P2',1,0),h=building('hq','P1',0,1),s=fixture([a],[b,h],true);s.knownBuildings.P1[b.id]={...b};s.vision.P1={ground:['0,0','0,1'],air:[]};const before=at(s,a,1,0,{intent:'construct',buildType:'city'});b.owner=null;b.hp=0;assert.deepEqual(at(s,a,1,0,{intent:'construct',buildType:'city'}),before);
});
test('Observation mode never commands another actor and story lock blocks orders',()=>{
  const a=unit('tank','P1',0,0),s=fixture([a]);assert.deepEqual(at(s,a,1,0,{viewerId:'P2'}),{kind:'inspect'});s.story={combatLocked:true,queue:[]};kind(s,a,1,0,{},'error');
});
test('Malformed cells, IDs and modes return errors without throwing',()=>{
  const a=unit('tank','P1',0,0),s=fixture([a]);assert.equal(resolve(s,{}).kind,'error');kind(s,a,99,99,{},'error');kind(s,a,1,0,{intent:'unexpected'},'error');kind(s,a,1,0,{viewerId:'unknown'},'error');kind(s,null,1,0,{intent:'deploy',facilityId:'missing',stockId:'missing'},'error');
});
require('node:fs').writeFileSync(require('node:path').join(__dirname,'../reports/controls-tests-v1.0.json'),JSON.stringify({scope:'Isolated command-resolution checks; no browser input',passed:results.filter(x=>x.ok).length,total:results.length,results},null,2));
console.log(`Controls: ${results.filter(x=>x.ok).length}/${results.length} groups passed`);if(results.some(x=>!x.ok))process.exitCode=1;
