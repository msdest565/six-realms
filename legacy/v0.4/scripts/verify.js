'use strict';
const assert = require('node:assert/strict');
const D = require('../src/data.js');
const H = require('../src/hex.js');
const E = require('../src/economy.js');
const A = require('../src/art.js');
const fs = require('node:fs');
const path = require('node:path');
let checks=0;
function check(name,fn){fn();checks++;console.log(`PASS ${name}`);}
const map=H.makeMap();
const cell=(q,r,terrain='plain')=>({q,r,terrain});
const corridor=(n,terrain='plain')=>Array.from({length:n},(_,q)=>cell(q,0,terrain));
check('117 unique axial cells, rotational grid, ocean and coastal production sites',()=>{
  assert.equal(map.length,117);assert.equal(new Set(map.map(c=>H.key(c.q,c.r))).size,117);
  map.forEach(c=>{const opposite=map.find(t=>t.col===12-c.col&&t.r===8-c.r);assert.equal(opposite.q,8-c.q);assert.equal(opposite.r,8-c.r);});
  assert(map.some(c=>c.terrain==='ocean'));assert(map.some(c=>c.terrain==='coast'&&c.building==='port'));
});
check('Six adjacent directions all have distance 1',()=>{H.directions.forEach(([q,r])=>assert.equal(H.distance(cell(0,0),cell(q,r)),1));assert.equal(H.distance(cell(0,0),cell(2,-2)),2);});
check('Move budget, path reconstruction, occupied blocking',()=>{
  const m=corridor(6),u=D.byId.tank;const r=H.reach(m[0],u,m);
  assert.equal(r.get('3,0').cost,3);assert.equal(r.get('3,0').path.length,3);assert(!r.has('4,0'));assert(!r.has('0,0'));
  assert.equal(H.reach(m[0],u,m,[{q:1,r:0,hp:8}]).size,0);
});
check('Pure road path grants exactly +1; mixed path does not',()=>{
  const m=corridor(6,'road');assert(H.reach(m[0],D.byId.tank,m).has('4,0'));assert(!H.reach(m[0],D.byId.tank,m).has('5,0'));
  m[2].terrain='plain';assert(!H.reach(m[0],D.byId.tank,m).has('4,0'));
});
check('Rubble cost, scout shallow-water exception, impassable ridge',()=>{
  const m=corridor(6);m[1].terrain='rubble';assert.equal(H.reach(m[0],D.byId.tank,m).get('2,0').cost,3);assert(!H.reach(m[0],D.byId.tank,m).has('3,0'));
  m[1].terrain='water';assert.equal(H.reach(m[0],D.byId.scout,m).get('2,0').cost,2);
  m[1].terrain='ridge';assert.equal(H.reach(m[0],D.byId.scout,m).size,0);
});
check('Direct fire blocked; target ruins do not block themselves; indirect fire passes',()=>{
  const m=corridor(5);m[1].terrain='ruins';assert(!H.visible(m[0],m[3],m));assert(!H.canAttack(m[0],m[3],D.byId.tank,m).ok);assert(H.canAttack(m[0],m[3],D.byId.artillery,m).ok);assert(H.visible(m[0],m[1],m));
});
check('Boundary ray allows either clear neighboring line',()=>{
  const m=[cell(0,0),cell(1,0,'ridge'),cell(0,1),cell(1,1)];assert(H.visible(m[0],m[3],m));m[2].terrain='ruins';assert(!H.visible(m[0],m[3],m));
});
check('Artillery minimum and maximum ranges',()=>{const m=corridor(6);assert(!H.canAttack(m[0],m[1],D.byId.artillery,m).ok);assert(H.canAttack(m[0],m[4],D.byId.artillery,m).ok);assert(!H.canAttack(m[0],m[5],D.byId.artillery,m).ok);});
check('Damage formula uses the new scale, armor, cover and minimum 10',()=>{
  assert.equal(H.damage(D.byId.tank,D.byId.destroyer,cell(0,0,'ruins')).value,30);
  assert.equal(H.damage(D.byId.destroyer,D.byId.tank,cell(0,0)).value,80);
  assert.equal(H.damage(D.byId.scout,D.byId.tank,cell(0,0)).value,10);
  assert.equal(H.damage(D.byId.infantry,D.byId.heavy,cell(0,0,'ruins')).value,10);
});
check('38 units in three branches and 159 exported SVG assets',()=>{
  assert.equal(D.units.filter(u=>u.branch==='army').length,17);assert.equal(D.units.filter(u=>u.branch==='navy').length,11);assert.equal(D.units.filter(u=>u.branch==='air').length,10);assert.equal(new Set(D.units.map(u=>u.id)).size,38);
  D.units.forEach(u=>{assert.equal(typeof u.role,'string');assert(u.role.length>0);assert(Number.isInteger(u.minRange)&&u.minRange>=1);assert(u.maxRange>=u.minRange);});
  for(const u of D.units)for(const side of Object.keys(D.factions))assert(fs.existsSync(path.join(__dirname,'..','assets','units',`${u.id}-${side}.svg`)));
  for(const type of Object.keys(D.terrain))assert(fs.existsSync(path.join(__dirname,'..','assets','terrain',`${type}.svg`)));
  let buildings=0;for(const b of D.buildings)for(const side of ['union','red','neutral'])for(let level=1;level<=b.maxLevel;level++){buildings++;assert(fs.existsSync(path.join(__dirname,'..','assets','buildings',`${b.id}-${side}-lv${level}.svg`)));}assert.equal(buildings,75);
});
check('All infantry are oil-free and cheaper than main battle tanks',()=>{D.units.filter(u=>u.infantry).forEach(u=>{assert.equal(u.oil,0);assert(u.cost<D.byId.tank.cost);});});
check('Warships remain in ocean; only marine infantry and light tanks land',()=>{
  const m=[cell(0,0,'ocean'),cell(1,0,'ocean'),cell(2,0,'coast'),cell(3,0)];
  assert(H.reach(m[0],D.byId.navaldestroyer,m).has('1,0'));assert(!H.reach(m[0],D.byId.navaldestroyer,m).has('2,0'));
  assert(H.reach(m[0],D.byId.marine,m).has('2,0'));assert(H.reach(m[0],D.byId.amphibious,m).has('2,0'));
  assert.equal(H.reach(m[2],D.byId.infantry,m).has('1,0'),false);
});
check('Insufficient oil limits range; zero oil still allows infantry',()=>{
  const m=corridor(5);assert(H.reach(m[0],D.byId.tank,m,[],{oil:3}).has('1,0'));assert(!H.reach(m[0],D.byId.tank,m,[],{oil:3}).has('2,0'));
  assert(H.reach(m[0],D.byId.infantry,m,[],{oil:0}).has('3,0'));m[1].terrain='rubble';assert.equal(H.reach(m[0],D.byId.tank,m).get('1,0').fuel,2);
});
check('Amphibious tank charges oil 2 at sea and 1 on land',()=>{const m=[cell(0,0,'ocean'),cell(1,0,'ocean'),cell(2,0,'coast')];assert.equal(H.reach(m[0],D.byId.amphibious,m).get('2,0').fuel,3);assert(!H.reach(m[0],D.byId.amphibious,m,[],{oil:2}).has('2,0'));});
check('Aircraft cross ridge/ocean, ignore ground occupancy, obey air occupancy',()=>{
  const m=[cell(0,0),cell(1,0,'ridge'),cell(2,0,'ocean')];
  assert(H.reach(m[0],D.byId.fighter,m,[{q:1,r:0,type:'infantry',hp:8}]).has('2,0'));
  assert(!H.reach(m[0],D.byId.fighter,m,[{q:1,r:0,type:'fighter',hp:12}]).has('2,0'));
  assert(D.byId.bomber.move>D.byId.fighter.move);assert(D.byId.fighter.move>D.byId.helicopter.move);
});
check('Three current states: landed marines become land targets, planes always air',()=>{assert.equal(H.domain(D.byId.marine,cell(0,0,'ocean')),'sea');assert.equal(H.domain(D.byId.marine,cell(0,0,'coast')),'land');assert.equal(H.domain(D.byId.fighter,cell(0,0,'ocean')),'air');});
check('All units attack land/sea; only explicitly anti-air units attack air',()=>{
  const m=[cell(0,0),cell(1,0),cell(0,1,'ocean'),cell(1,-1)];
  D.units.forEach(u=>{assert(u.targets.includes('land'));assert(u.targets.includes('sea'));assert.equal(u.targets.includes('air'),u.antiAir);});
  assert(H.canAttack(m[0],{q:1,r:0,type:'infantry'},D.byId.bomber,m).ok);
  assert(H.canAttack(m[0],{q:0,r:1,type:'navaldestroyer'},D.byId.bomber,m).ok);
  assert(!H.canAttack(m[0],{q:1,r:-1,type:'fighter'},D.byId.bomber,m).ok);
  assert(!H.canAttack(m[0],{q:1,r:-1,type:'fighter'},D.byId.tank,m).ok);
  assert(H.canAttack(m[0],{q:1,r:-1,type:'fighter'},D.byId.antiair,m).ok);
  assert(!H.canAttack(m[0],{q:1,r:0,state:'air'},D.byId.tank,m).ok);
  assert(H.canAttack(m[0],{q:1,r:0,state:'air'},D.byId.antiair,m).ok);
});
check('Artillery moved restriction and air targets ignore ground cover',()=>{const m=corridor(4);assert(!H.canAttack({q:0,r:0,moved:true},m[3],D.byId.artillery,m).ok);assert.equal(H.damage(D.byId.antiair,D.byId.fighter,cell(0,0,'ruins')).defense,0);});
check('Economy initial income, caps and atomic money failures',()=>{const s=E.createState();assert.deepEqual(E.income(s),{money:120,oil:14});s.money=0;const before=JSON.stringify(s);assert(!E.recruit(s,'infantry').ok);assert.equal(JSON.stringify(s),before);s.money=2990;s.oil=299;E.advance(s);assert.equal(s.money,3000);assert.equal(s.oil,300);});
check('Facility level gates production, upgrade and production share a slot',()=>{const s=E.createState();assert(!E.recruit(s,'tank').ok);assert(E.upgrade(s,'factory').ok);assert(!E.recruit(s,'scout').ok);assert.equal(s.money,440);E.advance(s);assert.equal(E.owned(s,'factory').level,2);assert(E.recruit(s,'tank').ok);assert.equal(s.money,420);});
check('Income uses old level; upgrade starts yielding next settlement',()=>{const s=E.createState();E.upgrade(s,'city');const first=E.advance(s);assert.equal(first.gain.money,120);assert.equal(E.income(s).money,140);assert.equal(E.advance(s).gain.money,140);});
check('Offshore construction costs money; new oil income waits until next round',()=>{const s=E.createState();assert(E.construct(s,'oilrig').ok);assert.equal(s.money,400);assert(!E.construct(s,'oilrig').ok);const first=E.advance(s);assert.equal(first.gain.oil,14);assert.equal(s.oil,74);assert.equal(E.income(s).oil,30);E.advance(s);assert.equal(s.oil,104);});
check('Production: low tiers take 1 turn, high tiers 2; stock and orders count toward cap',()=>{const s=E.createState();assert(E.recruit(s,'infantry').ok);E.advance(s);assert.deepEqual(s.stock,['infantry']);E.owned(s,'airfield').level=3;assert(E.recruit(s,'bomber').ok);E.advance(s);assert.equal(s.stock.length,1);E.advance(s);assert.deepEqual(s.stock,['infantry','bomber']);s.stock=Array(14).fill('infantry');assert(!E.recruit(s,'infantry').ok);});
check('Fuel deduction refuses negative or insufficient amounts without partial mutation',()=>{const s=E.createState();assert(!E.spendOil(s,61).ok);assert(!E.spendOil(s,-1).ok);assert.equal(s.oil,60);assert(E.spendOil(s,2).ok);assert.equal(s.oil,58);assert(E.spendOil(s,0).ok);assert.equal(s.oil,58);});
check('Ten complete three-level systems and eight separately classified specials',()=>{
  assert.equal(D.systems.length,10);assert.equal(D.units.filter(u=>u.system).length,30);assert.equal(D.units.filter(u=>!u.system).length,8);
  for(const sys of D.systems){const list=D.units.filter(u=>u.system===sys.id);assert.deepEqual(list.map(u=>u.modelLevel),[1,2,3]);list.forEach(u=>{assert.equal(u.branch,sys.branch);assert.equal(u.facility,sys.facility);assert.equal(u.tier,u.modelLevel);});assert(list[0].cost<list[1].cost&&list[1].cost<list[2].cost);}
  D.units.filter(u=>!u.system).forEach(u=>{assert.equal(u.modelLevel,null);assert(u.specialRole.length>0);});
});
check('Every model has a complete numeric profile, production time and dossier',()=>{
  D.units.forEach(u=>{for(const k of ['cost','hp','armor','move','minRange','maxRange','vision','damage','oil','buildTurns','tier','bonusLight','bonusArmor','bonusAir','bonusLand','bonusSea'])assert(Number.isInteger(u[k]),u.id+' '+k);assert(u.hp>0&&u.cost>0&&u.move>0&&u.buildTurns>0);for(const k of ['name','type','code','role','strengths','weakness','tactic','silhouette','skill','skillText','blurb'])assert(typeof u[k]==='string'&&u[k].length>0,u.id+' '+k);assert.equal(typeof u.fireAfterMove,'boolean');assert(u.capture);});
});
check('All 38 models can complete production; lower facility levels reject locked models',()=>{
  for(const u of D.units){const s=E.createState();s.money=3000;s.fieldCount=0;E.owned(s,u.facility).level=u.tier;assert(E.recruit(s,u.id).ok,u.id);assert.equal(s.money,3000-u.cost);for(let n=1;n<u.buildTurns;n++){E.advance(s);assert.equal(s.stock.length,0,u.id);}E.advance(s);assert.deepEqual(s.stock,[u.id]);if(u.tier>1){const locked=E.createState();locked.money=3000;E.owned(locked,u.facility).level=u.tier-1;assert(!E.recruit(locked,u.id).ok,u.id);assert.equal(locked.money,3000);}}
});
check('Production time is independent from the facility tier',()=>{
  const u=D.byId.longrangeaa,original=u.buildTurns;
  try{u.buildTurns=1;const s=E.createState();E.owned(s,'factory').level=3;assert(E.recruit(s,u.id).ok);E.advance(s);assert.deepEqual(s.stock,[u.id]);}finally{u.buildTurns=original;}
});
check('Every artillery level uses moved restriction, while battleships can move and fire',()=>{
  const m=corridor(7);for(const u of D.units.filter(u=>u.system==='artillery')){assert(H.canAttack(m[0],m[u.minRange],u,m).ok);assert(!H.canAttack({...m[0],moved:true},m[u.minRange],u,m).ok);assert(!H.canAttack(m[0],m[1],u,m).ok);assert(!H.canAttack(m[0],m[u.maxRange+1],u,m).ok);}assert(H.canAttack({...m[0],moved:true},m[2],D.byId.battleship,m).ok);
});
check('Both AA series and every fighter explicitly attack air, with increasing coverage',()=>{
  const m=corridor(7);for(const id of ['landaa','navalaa','fighter']){const list=D.units.filter(u=>u.system===id);list.forEach(u=>{assert(u.antiAir);assert(H.canAttack(m[0],{...m[1],type:'fighter'},u,m).ok);assert(H.damage(u,D.byId.fighter,m[1]).value>H.damage(u,D.byId.tank,m[1]).value);});assert(list[0].maxRange<=list[1].maxRange&&list[1].maxRange<=list[2].maxRange);}assert.equal(D.units.filter(u=>u.antiAir).length,11);assert.equal(D.byId.antiair.tier,1);assert.equal(D.byId.antitank.tier,2);
});
check('All marine grades land and stay oil-free; all naval AA models remain at sea',()=>{
  const m=[cell(0,0,'ocean'),cell(1,0,'coast'),cell(2,0)];D.units.filter(u=>u.system==='marine').forEach(u=>{assert(H.reach(m[0],u,m,[],{oil:0}).has('1,0'));assert(u.capture);assert.equal(H.domain(u,m[1]),'land');assert.notEqual(A.unitMarkup(u.id,'union','sea'),A.unitMarkup(u.id,'union','land'));});D.units.filter(u=>u.system==='navalaa').forEach(u=>assert(!H.reach(m[0],u,m).has('1,0')));
});
check('Every faction model renders without missing artwork, and exported dossiers cover all units',()=>{
  const doc=fs.readFileSync(path.join(__dirname,'..','docs','单位设计-v0.4.md'),'utf8');for(const u of D.units){assert(doc.includes('### '+u.code+' '+u.type+'（'+u.name+'）'));for(const side of Object.keys(D.factions)){const svg=A.unitSvg(u.id,side);assert(!/undefined|NaN/.test(svg),u.id);assert(svg.includes('<svg')&&svg.includes('</svg>'));assert.equal(fs.readFileSync(path.join(__dirname,'..','assets','units',u.id+'-'+side+'.svg'),'utf8'),svg);}}
});
check('All 38 models capture every building including headquarters regardless of branch',()=>{
  for(const u of D.units)for(const b of D.buildings){const from={q:0,r:0,side:'union',hp:u.hp,ap:1},tile={q:1,r:0,building:b.id,owner:'red'};assert(H.canCapture(from,tile,u).ok,u.id+' '+b.id);assert(H.canCapture({...from,q:1},tile,u).ok);}
  assert(!H.canCapture({q:0,r:0,side:'union',hp:80,ap:0},{q:1,r:0,building:'hq',owner:'red'},D.byId.infantry).ok);
});
check('Capture requires nearby enemy buildings and cleared guards on both layers',()=>{
  const u=D.byId.tank,from={q:0,r:0,side:'union',hp:160,ap:2},tile={q:1,r:0,building:'hq',owner:'red'};
  assert(!H.canCapture(from,{...tile,q:2},u).ok);assert(!H.canCapture(from,{...tile,owner:'union'},u).ok);assert(!H.canCapture(from,{...tile,building:null},u).ok);
  for(const type of ['infantry','fighter'])assert(!H.canCapture(from,tile,u,[{q:1,r:0,side:'red',hp:80,type}]).ok);
  assert(H.canCapture(from,tile,u,[{q:1,r:0,side:'red',hp:0,type:'fighter'}]).ok);
  assert(H.canCapture(from,tile,u,[{q:1,r:0,side:'union',hp:80,type:'fighter'}]).ok);
});
check('Captured headquarters and cities retain levels and add income exactly once',()=>{
  const s=E.createState(),hq={q:0,r:0,building:'hq',siteId:'red-hq',owner:'red',level:1};
  assert(E.capture(s,hq).ok);assert.equal(hq.owner,'union');assert.equal(s.money,600);assert.deepEqual(E.income(s),{money:180,oil:18});
  const before=JSON.stringify(s);assert(!E.capture(s,hq).ok);assert.equal(JSON.stringify(s),before);assert.equal(E.advance(s).gain.money,180);
  const city={q:1,r:0,building:'city',siteId:'red-city',owner:'red',level:2};assert(E.capture(s,city).ok);assert.equal(E.owned(s,'red-city').level,2);assert.equal(E.owned(s,'city').level,1);assert.equal(E.income(s).money,235);
  assert(E.upgrade(s,'red-city').ok);E.advance(s);assert.equal(E.owned(s,'red-city').level,3);assert.equal(E.owned(s,'union-city').level,1);assert.equal(E.income(s).money,260);
});
check('Captured factories use independent levels, slots and recorded deployment origins',()=>{
  const s=E.createState();s.money=3000;s.fieldCount=0;assert(E.capture(s,{building:'factory',siteId:'red-factory',owner:'red',level:3}).ok);
  assert(!E.recruit(s,'longrangeaa','union-factory').ok);assert(!E.recruit(s,'infantry','red-factory').ok);
  assert(E.recruit(s,'longrangeaa','red-factory').ok);assert(E.recruit(s,'lighttank','union-factory').ok);assert(!E.upgrade(s,'union-factory').ok);assert(!E.recruit(s,'tank','red-factory').ok);
  E.advance(s);assert.deepEqual(s.stock,['lighttank']);assert.deepEqual(s.stockFacilities,['union-factory']);E.advance(s);assert.deepEqual(s.stock,['lighttank','longrangeaa']);assert.deepEqual(s.stockFacilities,['union-factory','red-factory']);
});
check('Combat values and terrain share ten-point steps with the requested infantry anchor',()=>{
  assert.deepEqual([D.byId.infantry.hp,D.byId.infantry.armor,D.byId.infantry.damage],[80,0,30]);
  for(const u of D.units)for(const k of ['hp','armor','damage','bonusLight','bonusArmor','bonusAir','bonusLand','bonusSea'])assert.equal(Math.abs(u[k]%10),0,u.id+' '+k);
  assert.equal(D.terrain.rubble.defense,10);assert.equal(D.terrain.ruins.defense,20);assert.equal(D.combat.minDamage,10);
  assert.equal(H.damage(D.byId.infantry,D.byId.infantry,cell(0,0)).value,40);assert.equal(H.damage(D.byId.antitank,D.byId.tank,cell(0,0)).value,50);assert.equal(H.damage(D.byId.antiair,D.byId.fighter,cell(0,0)).value,60);
});
check('Capturing an offshore rig does not consume the original construction site',()=>{
  const s=E.createState();assert(E.capture(s,{building:'oilrig',siteId:'red-oilrig',owner:'red',level:2}).ok);
  assert(E.construct(s,'oilrig').ok);const before=JSON.stringify(s);assert(!E.construct(s,'oilrig').ok);assert.equal(JSON.stringify(s),before);
  E.advance(s);assert.equal(E.owned(s,'union-oilrig').level,1);assert.equal(E.owned(s,'red-oilrig').level,2);assert.equal(E.income(s).oil,54);
});
console.log(`${checks} rule and asset checks passed.`);
