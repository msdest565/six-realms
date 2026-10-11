'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const D=require('../src/data'),H=require('../src/grid'),M=require('../src/maps'),G=require('../src/game'),E=require('../src/elite-combat'),Config=require('../src/elite-data');
const results=[];function test(name,fn){try{fn();results.push({name,ok:true});}catch(e){results.push({name,ok:false,error:e.stack});console.error(name,e.stack);}}
const normal=(type,q,r=0,owner='P1',id=type+owner)=>({id,type,owner,q,r});
function elite(id,level,q=0,r=0,owner='P1',cap=10){const h=Config.heroes.find(h=>h.id===id);return {...normal(h.inheritUnitId,q,r,owner,id+owner),characterId:id,elite:E.freeze(id,level,cap)};}
function field(units=[],buildings=[],settings={}){
 const cells=[];for(let q=-8;q<=8;q++)for(let r=-8;r<=8;r++)cells.push({q,r,terrain:'plain'});
 const map={id:'ELITE-LAB',size:'S',radius:8,playerCount:2,terrain:M.terrainObject(cells),buildings:[{id:'HQ1',type:'hq',owner:'P1',q:-8,r:-8,level:1},{id:'HQ2',type:'hq',owner:'P2',q:8,r:8,level:1},...buildings],initialUnits:units,seats:[{id:'P1',originalHqId:'HQ1'},{id:'P2',originalHqId:'HQ2'}],deposits:{land:[],sea:[]},actualSource:'standard'};map.contentHash=M.contentHash(map);
 const s=G.create(map,{fog:false,...settings});s.players.forEach(p=>p.resources={money:2500,energy:200});return s;
}
function ok(s,c){const r=G.execute(s,c);assert.ok(r.ok,r.error);return r;}
function fail(s,c,pattern){const before=JSON.stringify(s);const r=G.execute(s,c);assert.equal(r.ok,false);if(pattern)assert.match(r.error,pattern);assert.equal(JSON.stringify(s),before);}
function cast(s,u,slot='active',options={}){const preview=G.eliteSkillPreview(s,u,slot,options);assert.equal(preview.reason,undefined,preview.reason);const before=JSON.stringify(s);G.eliteSkillPreview(s,u,slot,options);assert.equal(JSON.stringify(s),before);ok(s,{kind:'eliteSkill',unitId:u.id,slot,...options});const event=s.events.filter(e=>e.kind==='eliteSkill').at(-1);assert.deepEqual(event.hits,preview.hits);assert.deepEqual(event.counters,preview.counters);assert.deepEqual(event.beneficiaries,preview.beneficiaries);return event;}
function cycle(s){ok(s,{kind:'end'});ok(s,{kind:'end'});}
test('50 frozen rows use authored stats and fixed permissions; ordinary catalogue remains 38',()=>{
 assert.equal(D.units.length,38);for(const h of Config.heroes)for(let level=1;level<=10;level++){const u=elite(h.id,level),s=field([u]),actual=s.units[0],row=h.statsByLevel[level-1],model=D.unitModel(actual);assert.deepEqual([actual.maxHp,model.armor,model.damage],[row.hp,row.armor,row.damage]);assert.equal(G.model(s,actual).maxRange,h.fixedStats.maxRange);assert.equal(E.validateSnapshot(s,actual),null);}
});
test('chapter replay freezes level and every skill parameter without changing archive level',()=>{
 for(const cap of [3,5,6,8,9,10])for(const h of Config.heroes){const u=elite(h.id,10,0,0,'P1',cap),s=field([u]);assert.equal(s.units[0].elite.archiveLevel,10);assert.equal(s.units[0].elite.effectiveLevel,cap);for(const sk of s.units[0].elite.skills){assert.equal(sk.unlocked,cap>=sk.unlockLevel);assert.deepEqual(sk.parameters,cap>=sk.unlockLevel?h.skills.find(x=>x.id===sk.id).parametersByEffectiveLevel[cap]:null);}}
});
test('elite aircraft avoids legacy ordinary air HP conversion and keeps true seven-step budget',()=>{
 const s=field([{...elite('E05',1),hp:190}]),u=s.units[0];assert.equal(u.hp,190);assert.equal(u.maxHp,190);assert.equal(G.movement(s,u).get('7,0').energy,28);assert.equal(G.movement(s,u).has('8,0'),false);ok(s,{kind:'move',unitId:u.id,q:7,r:0});assert.equal(u.spentMove,7);assert.equal(s.players[0].resources.energy,172);
});
test('elite infantry/amphibious movement preserves terrain and zero energy',()=>{
 const s=field([elite('E01',1),elite('E04',1,0,1)]),a=s.units[0],m=s.units[1];G.cell(s,{q:1,r:0}).terrain='ocean';G.cell(s,{q:1,r:1}).terrain='ocean';assert.equal(H.cost(a,G.cell(s,{q:1,r:0})),Infinity);assert.equal(H.cost(m,G.cell(s,{q:1,r:1})),1);assert.equal(H.energy(m,G.cell(s,{q:1,r:1})),0);ok(s,{kind:'move',unitId:m.id,q:1,r:1});assert.equal(s.players[0].resources.energy,200);assert.equal(H.domain(m,G.cell(s,m)),'sea');
});
test('E01 beacon adds LOS observation and observed land/sea fire; caster retreat removes it',()=>{
 const s=field([elite('E01',1),normal('tank',2,0),normal('infantry',4,0,'P2','target')],[],{fog:true}),u=s.units[0],a=s.units[1],t=s.units[2];const base=G.standardDamage(s,a,t);cast(s,u,'active',{q:2,r:0});assert.equal(E.observations(s).length,1);assert.ok(G.visible(s,'P1',t));assert.equal(G.standardDamage(s,a,t),base+20);G.applyHit(s,u,G.splitDamage(s,u,1000),t);assert.equal(E.observations(s).length,0);assert.equal(G.standardDamage(s,a,t),base);
});
test('E01 beacon rejects ocean, blocked ray and invisible target atomically',()=>{
 const s=field([elite('E01',1)],[],{fog:true}),u=s.units[0];G.cell(s,{q:2,r:0}).terrain='ocean';fail(s,{kind:'eliteSkill',unitId:u.id,slot:'active',q:2,r:0},/陆地/);G.cell(s,{q:2,r:0}).terrain='plain';G.cell(s,{q:1,r:0}).terrain='ridge';fail(s,{kind:'eliteSkill',unitId:u.id,slot:'active',q:2,r:0},/射线/);fail(s,{kind:'eliteSkill',unitId:u.id,slot:'active',q:4,r:0});assert.equal(u.elite.charge,0);
});
test('E01 aura is real-time, ground only, recomputes each recipient LOS and ends on retreat',()=>{
 const s=field([elite('E01',3),normal('tank',2,0),normal('marine',1,1),normal('fighter',0,1)]),u=s.units[0],tank=s.units[1],marine=s.units[2],air=s.units[3];G.cell(s,marine).terrain='ocean';assert.equal(G.model(s,tank).fireBonus,10);assert.equal(G.model(s,tank).vision,4);assert.equal(G.model(s,marine).fireBonus,0);assert.equal(G.model(s,air).fireBonus,0);tank.q=3;assert.equal(G.model(s,tank).fireBonus,0);tank.q=2;G.applyHit(s,u,G.splitDamage(s,u,1000),tank);assert.equal(G.model(s,tank).vision,3);
});
test('E01 ultimate grants shields and budgets without AP refund; observation persists after retreat',()=>{
 const s=field([elite('E01',5),normal('infantry',1),normal('fighter',0,1)]),u=s.units[0],t=s.units[1];u.elite.charge=100;t.ap=1;const event=cast(s,u,'ultimate');assert.equal(event.beneficiaries.length,2);assert.equal(E.shieldAmount(s,t),80);assert.equal(G.model(s,t).move,5);assert.equal(t.ap,1);assert.equal(u.ap,0);assert.equal(u.elite.ultimateUsed,true);assert.equal(s.players[0].resources.energy,192);G.applyHit(s,u,G.splitDamage(s,u,1000),t);assert.equal(E.observations(s).length,1);
});
test('E02 active snapshots full fire/armor-ignore and direct retaliation; no inherited ordinary skill',()=>{
 const s=field([elite('E02',1),normal('heavy',2,0,'P2')]),u=s.units[0],t=s.units[1];const expected=100+20+40-(30-20),event=cast(s,u,'active',{targetId:t.id});assert.equal(event.hits[0].standard,expected);assert.equal(event.counters.length,1);assert.equal(u.elite.charge,20);assert.equal(u.elite.activeReadyOwnTurn,3);fail(s,{kind:'skill',unitId:u.id},/行动点/);u.ap=1;fail(s,{kind:'skill',unitId:u.id},/专属/);
});
test('E02 active may directly hit every empty hostile structure; preview equals execution and structures never counter',()=>{
 for(const type of ['hq','barracks','factory','port','airfield']){
  const s=field([elite('E02',1)],[{id:'FORT',type,owner:'P2',q:2,r:0,level:1}]),u=s.units[0],b=G.building(s,'FORT'),beforeHp=b.hp,before=JSON.stringify(s);
  assert.ok(G.eliteSkillTargets(s,u,'active').some(t=>t.id===b.id));
  const preview=G.eliteSkillPreview(s,u,'active',{targetId:b.id});assert.equal(JSON.stringify(s),before);assert.deepEqual(preview.targets,[b.id]);assert.equal(preview.hits[0].standard,160);
  const event=cast(s,u,'active',{targetId:b.id});assert.deepEqual(event.targets,[b.id]);assert.equal(b.hp,Math.max(0,beforeHp-160));assert.equal(event.hits[0].damage,Math.min(beforeHp,160));assert.equal(event.counters.length,0);assert.equal(u.ap,0);assert.equal(s.players[0].resources.energy,194);assert.equal(u.elite.activeReadyOwnTurn,3);assert.equal(u.elite.charge,20);
 }
});
test('E02 active coordinate targeting after movement can destroy an empty structure and atomically clear its orders',()=>{
 const s=field([elite('E02',1)],[{id:'FORT',type:'factory',owner:'P2',q:2,r:0,level:1,hp:100}]),u=s.units[0],b=G.building(s,'FORT');u.movedSinceOwnStart=true;b.order={id:'PENDING',kind:'unit',type:'tank',readyOwnTurn:10};b.stock=[{id:'STORED',type:'tank'}];
 const event=cast(s,u,'active',{q:2,r:0});assert.deepEqual(event.targets,['FORT']);assert.equal(event.hits[0].lethal,true);assert.equal(b.hp,0);assert.equal(b.state,'complete');assert.equal(b.maxHp,200);assert.equal(b.order,null);assert.deepEqual(b.stock,[]);assert.equal(event.counters.length,0);assert.equal(s.players[0].stats.kills,0);
});
test('E02 active structure IDs redirect to visible ground defenders once, preserving shelter and retaliation',()=>{
 const s=field([elite('E02',1),normal('tank',2,0,'P2','GUARD')],[{id:'FORT',type:'factory',owner:'P2',q:2,r:0,level:1}]),u=s.units[0],guard=G.unit(s,'GUARD'),b=G.building(s,'FORT'),choices=G.eliteSkillTargets(s,u,'active');
 assert.equal(choices.filter(t=>t.q===2&&t.r===0).length,1);assert.ok(choices.some(t=>t.id===guard.id));assert.equal(choices.some(t=>t.id===b.id),false);
 const event=cast(s,u,'active',{targetId:b.id,targetIds:[b.id]});assert.deepEqual(event.targets,[guard.id]);assert.equal(event.hits.length,1);assert.equal(event.hits[0].buildingId,b.id);assert.equal(event.hits[0].buildingDamage,40);assert.equal(event.hits[0].damage,120);assert.equal(b.hp,160);assert.equal(guard.hp,40);assert.equal(event.counters.length,1);assert.equal(guard.counterRemaining,0);
});
test('E02 active rejects income points and ruined structures without spending AP, energy, charge or cooldown',()=>{
 for(const type of ['city','market','energyfield','energyplatform','factory']){
  const s=field([elite('E02',1)],[{id:'INVALID',type,owner:'P2',q:2,r:0,level:1,...(type==='factory'?{hp:0}:{})}]),u=s.units[0];
  assert.equal(G.eliteSkillTargets(s,u,'active').some(t=>t.id==='INVALID'),false);const before=JSON.stringify(s),preview=G.eliteSkillPreview(s,u,'active',{targetId:'INVALID'});assert.ok(preview.reason);assert.equal(JSON.stringify(s),before);fail(s,{kind:'eliteSkill',unitId:u.id,slot:'active',targetId:'INVALID'},type==='factory'?/失去/:/只能占领/);fail(s,{kind:'eliteSkill',unitId:u.id,slot:'active',q:2,r:0});
 }
});
test('E02 empty structure targeting retains visibility, own range, direct LOS and strict single-target validation',()=>{
 const s=field([elite('E02',1)],[{id:'FORT',type:'factory',owner:'P2',q:2,r:0,level:1},{id:'FAR',type:'factory',owner:'P2',q:4,r:0,level:1},{id:'ALLY',type:'factory',owner:'P1',q:0,r:1,level:1}],{fog:true}),u=s.units[0];
 fail(s,{kind:'eliteSkill',unitId:u.id,slot:'active',targetId:'FAR'});fail(s,{kind:'eliteSkill',unitId:u.id,slot:'active',targetId:'ALLY'});fail(s,{kind:'eliteSkill',unitId:u.id,slot:'active',targetId:'FORT',targetIds:['FORT','FORT']});fail(s,{kind:'eliteSkill',unitId:u.id,slot:'active',targetId:'FORT',targetIds:['FORT','FAR']});
 s.vision.P1={ground:['0,0'],air:[]};assert.equal(G.eliteSkillTargets(s,u,'active').some(t=>t.id==='FORT'),false);fail(s,{kind:'eliteSkill',unitId:u.id,slot:'active',targetId:'FORT'});s.vision.P1={ground:['0,0','1,0','2,0'],air:[]};G.cell(s,{q:1,r:0}).terrain='ridge';fail(s,{kind:'eliteSkill',unitId:u.id,slot:'active',targetId:'FORT'});
});
test('multi-target elite attacks keep units-only primary and extra targets despite direct-skill structure support',()=>{
 for(const [id,slot] of [['E02','ultimate'],['E03','active'],['E03','ultimate'],['E05','ultimate']]){
  const s=field([elite(id,5),normal('heavy',2,0,'P2','GROUND'),normal('fighter',2,-1,'P2','AIR')],[{id:'FORT',type:'factory',owner:'P2',q:2,r:1,level:1}]),u=s.units[0];u.elite.charge=100;assert.equal(G.eliteSkillTargets(s,u,slot).some(t=>t.id==='FORT'),false);fail(s,{kind:'eliteSkill',unitId:u.id,slot,targetId:'FORT'});fail(s,{kind:'eliteSkill',unitId:u.id,slot,targetId:id==='E05'?'AIR':'GROUND',targetIds:[id==='E05'?'AIR':'GROUND','FORT']});
 }
});
test('E02 aura armor and step energy apply to ground armored only, including own virtual route',()=>{
 const s=field([elite('E02',3),normal('tank',1),normal('infantry',0,1),normal('marine',1,1)]),u=s.units[0],t=s.units[1];assert.equal(G.model(s,t).armor,32);assert.equal(G.movement(s,t).get('2,0').energy,1);assert.equal(G.movement(s,u).get('3,0').energy,6);const before=s.players[0].resources.energy;ok(s,{kind:'move',unitId:u.id,q:3,r:0});assert.equal(before-s.players[0].resources.energy,6);assert.equal(G.model(s,s.units[2]).armor,0);assert.equal(G.model(s,t).armor,32);
});
test('E02 ultimate hits all outgoing targets before each stable surviving counter, shielding first',()=>{
 const s=field([elite('E02',5),normal('heavy',2,0,'P2','T1'),normal('heavy',2,-1,'P2','T2'),normal('heavy',1,1,'P2','T3')]),u=s.units[0];for(const t of s.units.slice(1))t.hp=t.maxHp=500;u.elite.charge=100;const event=cast(s,u,'ultimate',{targetId:'T1'});assert.equal(event.hits.length,3);assert.equal(event.counters.length,3);assert.equal(event.hits[0].standard,132+20+80+0-(30-30));assert.equal(event.hits[1].standard,Math.round((132+20)*.8));assert.equal(G.model(s,G.unit(s,'T1')).armor,10);assert.ok(event.counters[0].shieldDamage>0);assert.equal(u.elite.charge,0);
});
test('E02 explicit multi-target list rejects hidden, duplicates, range and over-cap without costs',()=>{
 const s=field([elite('E02',5),normal('heavy',2,0,'P2','T1'),normal('heavy',2,-1,'P2','T2'),normal('heavy',3,-1,'P2','T3'),normal('heavy',5,0,'P2','T4')]),u=s.units[0];u.elite.charge=100;for(const ids of [['T1','T1'],['T1','T2','T3','T4'],['T1','T4'],['T2']])fail(s,{kind:'eliteSkill',unitId:u.id,slot:'ultimate',targetId:'T1',targetIds:ids});const event=cast(s,u,'ultimate',{targetId:'T1',targetIds:['T1','T2']});assert.equal(event.hits.length,2);
});
test('E03 active has independent splash raw scale, four cap, indirect no counter and two-cell blind spot',()=>{
 const s=field([elite('E03',1),normal('heavy',3,0,'P2','T1'),normal('heavy',3,-1,'P2','T2'),normal('heavy',4,-1,'P2','T3'),normal('heavy',2,1,'P2','T4'),normal('heavy',4,0,'P2','T5'),normal('heavy',1,0,'P2','BLIND')]),u=s.units[0];assert.ok(G.attackReason(s,u,G.unit(s,'BLIND')));const event=cast(s,u,'active',{targetId:'T1'});assert.equal(event.hits.length,4);assert.equal(event.hits[0].standard,110+20+30-30);assert.equal(event.hits[1].standard,Math.round((110+20)*.6)-30);assert.equal(event.counters.length,0);
});
test('E03 aura adds real fire to sea and land, extra sight only to indirect; keeps mobile fire ban',()=>{
 const s=field([elite('E03',3),normal('artillery',1),normal('battleship',1,1),normal('fighter',0,1)]),u=s.units[0];G.cell(s,s.units[2]).terrain='ocean';assert.equal(G.model(s,s.units[1]).fireBonus,15);assert.equal(G.model(s,s.units[1]).vision,3);assert.equal(G.model(s,s.units[2]).fireBonus,15);assert.equal(G.model(s,s.units[2]).vision,D.byId.battleship.vision+1);assert.equal(G.model(s,s.units[3]).fireBonus,0);u.movedSinceOwnStart=true;fail(s,{kind:'eliteSkill',unitId:u.id,slot:'active',targetId:s.units[2].id});
});
test('E03 ultimate obeys each own range/vision despite radius two and snapshots fire before armor',()=>{
 const s=field([elite('E03',5),normal('heavy',4,0,'P2','T1'),normal('heavy',5,0,'P2','T2'),normal('heavy',6,0,'P2','OUT'),normal('fighter',4,-1,'P2','AIR')]),u=s.units[0];u.elite.charge=100;const event=cast(s,u,'ultimate',{targetId:'T1'});assert.deepEqual(event.hits.map(h=>h.targetId),['T1','T2']);assert.equal(event.hits[0].standard,Math.round((142+20+15+40)*1.3)-(30-10));assert.equal(event.counters.length,0);
});
test('E04 active heals living land/sea only to max HP, single shields cannot stack, no building heal',()=>{
 const s=field([elite('E04',1),normal('infantry',1),normal('navaldestroyer',1,1),normal('fighter',0,1)], [{id:'B',type:'factory',owner:'P1',q:2,r:0,level:1,hp:100}]),u=s.units[0],t=s.units[1];t.hp=50;G.cell(s,s.units[2]).terrain='ocean';const event=cast(s,u,'active');assert.equal(event.beneficiaries.length,3);assert.equal(t.hp,80);assert.equal(E.shieldAmount(s,t),60);assert.equal(s.buildings.find(b=>b.id==='B').hp,110);cycle(s);u.ap=2;fail(s,{kind:'eliteSkill',unitId:u.id,slot:'active'},/冷却/);cycle(s);cast(s,u,'active');assert.equal(E.shieldAmount(s,t),60);
});
test('E04 aura protects amphibious sea and land; removed at retreat without granting sea access',()=>{
 const s=field([elite('E04',3),normal('tank',1),normal('marine',1,1),normal('fighter',0,1)]),u=s.units[0],t=s.units[1],m=s.units[2];G.cell(s,m).terrain='ocean';assert.equal(G.model(s,t).armor,30);assert.equal(G.model(s,m).fireBonus,10);assert.equal(G.model(s,s.units[3]).fireBonus,0);assert.equal(H.cost(t,G.cell(s,m)),Infinity);G.applyHit(s,u,G.splitDamage(s,u,1000),t);assert.equal(G.model(s,t).armor,20);
});
test('E04 ultimate heals 90, shields 90, move +1 but does not reset AP or spent movement',()=>{
 const s=field([elite('E04',5),normal('tank',1)]),u=s.units[0],t=s.units[1];u.elite.charge=100;t.hp=10;t.spentMove=2;t.ap=1;cast(s,u,'ultimate',{targetIds:[t.id]});assert.equal(t.hp,100);assert.equal(E.shieldAmount(s,t),90);assert.equal(G.model(s,t).move,4);assert.deepEqual([t.ap,t.spentMove],[1,2]);assert.equal(E.shieldAmount(s,u),0);
});
test('E05 active only accepts a legal friendly aircraft, gives shield/armor/energy for two caster starts',()=>{
 const s=field([elite('E05',1),normal('fighter',1),normal('infantry',0,1)]),u=s.units[0],t=s.units[1];fail(s,{kind:'eliteSkill',unitId:u.id,slot:'active',targetId:s.units[2].id});cast(s,u,'active',{targetId:t.id});assert.equal(E.shieldAmount(s,t),60);assert.equal(G.model(s,t).armor,20);assert.equal(G.movement(s,t).get('2,0').energy,2);ok(s,{kind:'end'});assert.equal(G.model(s,t).armor,20);ok(s,{kind:'end'});assert.equal(G.model(s,t).armor,20);cycle(s);assert.equal(G.model(s,t).armor,5);assert.equal(E.shieldAmount(s,t),0);
});
test('E05 aura raises aircraft stats without changing bomber anti-air permissions',()=>{
 const s=field([elite('E05',3),normal('bomber',1),normal('fighter',2,0,'P2','enemy'),normal('tank',0,1)]),u=s.units[0],b=s.units[1];assert.equal(G.model(s,b).fireBonus,15);assert.equal(G.model(s,b).armor,13);assert.match(G.attackReason(s,b,s.units[2]),/对空/);assert.equal(G.model(s,s.units[3]).fireBonus,0);b.q=4;assert.equal(G.model(s,b).fireBonus,0);
});
test('E05 ultimate hits air only, shields friendly air before counters and remains vulnerable to AA',()=>{
 const s=field([elite('E05',5),normal('heavyfighter',2,0,'P2','T1'),normal('heavyfighter',2,-1,'P2','T2'),normal('tank',1,0,'P2','GROUND'),normal('fighter',0,1)]),u=s.units[0];for(const t of s.units.filter(t=>t.owner==='P2'&&t.type==='heavyfighter')){t.hp=t.maxHp=500;}u.elite.charge=100;const event=cast(s,u,'ultimate',{targetId:'T1'});assert.deepEqual(event.hits.map(h=>h.targetId),['T1','T2']);assert.equal(event.beneficiaries.length,2);assert.ok(event.counters.length>0);assert.ok(event.counters[0].shieldDamage>0);u.ap=1;const aa=G.normalizeUnit(normal('longrangeaa',1,-1,'P2','AA'));s.units.push(aa);assert.ok(G.attackPreview(s,u,aa).counter+G.attackPreview(s,u,aa).counterShieldDamage>0);
});
test('all damage divides structure first then shield; shield may absorb every unit HP point',()=>{
 const s=field([elite('E04',1),normal('infantry',1),normal('tank',2,0,'P2','enemy')],[{id:'FORT',type:'factory',owner:'P1',q:1,r:0,level:1}]),u=s.units[0],t=s.units[1],enemy=s.units[2],b=G.building(s,'FORT');cast(s,u,'active');s.actor='P2';s.turnStarted=true;const preview=G.attackPreview(s,enemy,t);assert.equal(preview.standard,60);assert.deepEqual([preview.buildingDamage,preview.shieldDamage,preview.damage],[15,45,0]);const before=t.hp;ok(s,{kind:'attack',unitId:enemy.id,targetId:b.id});assert.equal(t.hp,before);assert.equal(b.hp,185);assert.equal(E.shieldAmount(s,t),15);
});
test('resource points offer no structural shield share; shield pool refresh uses max, not sum',()=>{
 const s=field([elite('E01',5),elite('E04',5,0,1),normal('tank',1)]),u=s.units[0],v=s.units[1],t=s.units[2];u.elite.charge=v.elite.charge=100;cast(s,u,'ultimate',{targetIds:[t.id]});cast(s,v,'ultimate',{targetIds:[t.id]});assert.equal(E.shieldAmount(s,t),90);assert.equal(G.model(s,t).move,6);G.applyHit(s,t,G.splitDamage(s,t,30),u);assert.equal(E.shieldAmount(s,t),60);
});
test('multiple different aura IDs add; duplicate same ID takes largest value',()=>{
 const s=field([elite('E01',3),elite('E03',3,0,1),elite('E04',3,1,-1),normal('tank',1)]),t=s.units.at(-1);assert.equal(G.model(s,t).fireBonus,35);assert.equal(G.model(s,t).armor,30);const duplicate=G.normalizeUnit({...elite('E01',10,1,1),id:'DUP'});s.units.push(duplicate);assert.equal(G.model(s,t).fireBonus,45);
});
test('charge first start zero, later starts +25, active +20, ordinary attack once and counter zero',()=>{
 const s=field([elite('E02',5),normal('heavy',2,0,'P2','T')]),u=s.units[0],t=s.units[1];assert.equal(u.elite.charge,0);cast(s,u,'active',{targetId:t.id});assert.equal(u.elite.charge,20);cycle(s);assert.equal(u.elite.charge,45);t.hp=220;t.ap=2;ok(s,{kind:'attack',unitId:u.id,targetId:t.id});assert.equal(u.elite.charge,55);u.ap=1;t.hp=220;ok(s,{kind:'attack',unitId:u.id,targetId:t.id});assert.equal(u.elite.charge,55);cycle(s);assert.equal(u.elite.charge,80);u.ap=1;t.hp=220;ok(s,{kind:'attack',unitId:u.id,targetId:t.id});assert.equal(u.elite.charge,90);
});
test('failed skill consumes no AP, energy, charge, cooldown; ultimate cannot repeat',()=>{
 const s=field([elite('E01',3)]),u=s.units[0];u.elite.charge=100;fail(s,{kind:'eliteSkill',unitId:u.id,slot:'ultimate'},/Lv5/);u.elite=E.freeze('E01',5,5);u.hp=u.maxHp=260;u.elite.charge=99;fail(s,{kind:'eliteSkill',unitId:u.id,slot:'ultimate'},/100/);u.elite.charge=100;s.players[0].resources.energy=7;fail(s,{kind:'eliteSkill',unitId:u.id,slot:'ultimate'},/能源/);s.players[0].resources.energy=8;cast(s,u,'ultimate');u.ap=1;u.elite.charge=100;fail(s,{kind:'eliteSkill',unitId:u.id,slot:'ultimate'},/已经/);
});
test('beacon and buff expiry use caster clock only; reading/preview never advances clocks',()=>{
 const s=field([elite('E01',5),normal('tank',1)]),u=s.units[0],t=s.units[1];u.elite.charge=100;cast(s,u,'ultimate');for(let n=0;n<8;n++)G.eliteSkillPreview(s,u,'active',{q:1,r:0});assert.equal(s.players[0].ownTurnIndex,1);ok(s,{kind:'end'});assert.equal(E.shieldAmount(s,t),80);ok(s,{kind:'end'});assert.equal(E.shieldAmount(s,t),80);cycle(s);assert.equal(E.shieldAmount(s,t),0);assert.equal(E.observations(s).length,0);assert.equal(G.model(s,t).move,3);
});
test('ordinary engineer repairs elite true max HP and cannot manufacture elite IDs',()=>{
 const s=field([elite('E02',10),normal('engineer',1)],[{id:'FAC',type:'factory',owner:'P1',q:2,r:0,level:3}]),u=s.units[0],eng=s.units[1];u.hp=530;ok(s,{kind:'skill',unitId:eng.id,targetId:u.id});assert.equal(u.hp,550);fail(s,{kind:'produce',buildingId:'FAC',type:'E02'});assert.equal(G.count(s),2);
});
test('direct LOS, artillery post-move ban and air guarding structure permissions remain exact',()=>{
 const s=field([elite('E02',1),normal('fighter',2,0,'P2','AIR')],[{id:'FORT',type:'factory',owner:'P2',q:2,r:0,level:1}]),u=s.units[0];assert.match(G.attackReason(s,u,G.building(s,'FORT')),/对空/);fail(s,{kind:'eliteSkill',unitId:u.id,slot:'active',targetId:'FORT'});const arty=G.normalizeUnit(elite('E03',1,0,1));s.units.push(arty);arty.movedSinceOwnStart=true;fail(s,{kind:'eliteSkill',unitId:arty.id,slot:'active',targetId:'AIR'});
});
test('all 15 skills strengthen authored parameters at levels 6 through 10',()=>{
 for(const h of Config.heroes)for(const sk of h.skills){let previous=sk.parametersByEffectiveLevel[5];for(let level=6;level<=10;level++){const current=E.freeze(h.id,level,10).skills.find(s=>s.id===sk.id).parameters;assert.ok(Object.keys(current).some(key=>current[key]>previous[key]),sk.id+' Lv'+level);assert.deepEqual(current,sk.parametersByEffectiveLevel[level]);previous=current;}}
});
test('all outgoing splash lands before a lethal first counter stops later retaliation',()=>{
 const s=field([elite('E02',5),normal('heavy',2,0,'P2','T1'),normal('heavy',2,-1,'P2','T2'),normal('heavy',1,1,'P2','T3')]),u=s.units[0];u.elite.charge=100;u.hp=1;for(const t of s.units.slice(1)){t.hp=t.maxHp=500;t.status.eliteEffects=[{skillId:'E03-S2',owner:'P2',casterId:'T1',castOwnTurn:0,expiresOwnTurn:2,fireBonus:500}];}const event=cast(s,u,'ultimate',{targetId:'T1'});assert.equal(event.hits.length,3);assert.equal(event.counters.length,1);assert.equal(G.unit(s,u.id),undefined);for(const id of ['T1','T2','T3'])assert.ok(G.unit(s,id).hp<500);assert.equal(s.units.filter(t=>t.counterRemaining===0).length,1);
});
test('granted buffs survive caster retreat but clear when its owner is eliminated',()=>{
 const s=field([elite('E04',5),normal('tank',1),normal('infantry',2,0,'P2','ENEMY')]),u=s.units[0],t=s.units[1];u.elite.charge=100;cast(s,u,'ultimate',{targetIds:[t.id]});G.applyHit(s,u,G.splitDamage(s,u,1000),s.units[2]);assert.equal(E.shieldAmount(s,t),90);assert.equal(G.model(s,t).move,4);s.players[0].eliminated=true;E.cleanup(s);assert.equal(E.shieldAmount(s,t),0);assert.equal(G.model(s,t).move,3);
});
test('fog target lists and area secondary selection never include unobserved enemies',()=>{
 const s=field([elite('E03',5),normal('scout',2),normal('heavy',3,0,'P2','SEEN'),normal('heavy',4,0,'P2','HIDDEN')],[],{fog:true}),u=s.units[0];u.elite.charge=100;s.vision.P1={ground:['0,0','2,0','3,0'],air:[]};const choices=G.eliteSkillTargets(s,u,'ultimate');assert.ok(choices.some(c=>c.id==='SEEN'));assert.equal(choices.some(c=>c.id==='HIDDEN'),false);fail(s,{kind:'eliteSkill',unitId:u.id,slot:'ultimate',targetId:'SEEN',targetIds:['SEEN','HIDDEN']});const event=cast(s,u,'ultimate',{targetId:'SEEN'});assert.deepEqual(event.hits.map(h=>h.targetId),['SEEN']);
});
test('aura entry feedback uses five distinct skill events without continuous replay',()=>{
 for(const h of Config.heroes){const s=field([elite(h.id,3)]),u=s.units[0],id=h.skills[1].id;const count=()=>s.events.filter(e=>e.kind==='eliteAura'&&e.skillId===id).length;assert.equal(count(),1);G.vision(s);G.vision(s);assert.equal(count(),1);assert.equal(s.events.find(e=>e.skillId===id).eventId,'elite.'+id);}
});
fs.mkdirSync('reports',{recursive:true});const report={date:new Date().toISOString(),passed:results.filter(t=>t.ok).length,total:results.length,results};fs.writeFileSync('reports/elite-combat-tests.json',JSON.stringify(report,null,2));console.log(`Elite combat: ${report.passed}/${report.total}`);if(report.passed!==report.total)process.exitCode=1;
