const assert=require('node:assert/strict'),fs=require('node:fs');
const D=require('../src/data'),H=require('../src/grid'),M=require('../src/maps'),G=require('../src/game'),S=require('../src/storage'),AI=require('../src/ai');
const results=[];
function test(name,fn){try{fn();results.push({name,ok:true});}catch(e){results.push({name,ok:false,error:e.stack});console.error(name,e.stack);}}
function unit(type,owner,q,r,id=type+owner){return G.normalizeUnit({id,type,owner,q,r});}
function building(type,owner,q,r,id=type+owner){const d=D.buildingById[type];return {id,type,owner,q,r,level:1,hp:d.hp,maxHp:d.hp,state:'complete',stock:[],order:null};}
function stock(b,type,id){return {id,type,sourceId:b.id};}
function fixture(units=[],buildings=[],settings={}){const s=G.create(M.fixed('S',2),{fog:false,...settings});s.cells=[];for(let q=-8;q<=8;q++)for(let r=-8;r<=8;r++)s.cells.push({q,r,terrain:'plain'});s.units=units;s.buildings=buildings;s.knownBuildings={P1:{},P2:{}};for(const p of s.players){p.resources={money:2500,energy:200};p.ownTurnIndex=p.id==='P1'?1:0;}for(const u of units)G.tuneUnit(s,u);G.vision(s);return s;}
function ok(s,c){const r=G.execute(s,c);assert.equal(r.ok,true,r.error);return r;}
function fail(s,c){const before=JSON.stringify(s),r=G.execute(s,c);assert.equal(r.ok,false);assert.equal(JSON.stringify(s),before,'Rejected command must not alter any game field');return r;}
function cycle(s){ok(s,{kind:'end'});ok(s,{kind:'end'});}
function deployed(s){return s.events.filter(e=>e.kind==='deployment');}

test('Default deployment cells are pure, stable and do not seek a different unoccupied tile',()=>{
 const f=building('factory','P1',0,0),port=building('port','P1',3,0),s=fixture([unit('infantry','P1',0,0),unit('aafrigate','P1',4,0)],[f,port]);G.cell(s,port).terrain='coast';G.cell(s,{q:4,r:0}).terrain='ocean';G.cell(s,{q:3,r:1}).terrain='ocean';const before=JSON.stringify(s);assert.equal(G.deploymentCell(s,f),G.cell(s,f));assert.deepEqual([G.deploymentCell(s,port).q,G.deploymentCell(s,port).r],[4,0]);assert.equal(JSON.stringify(s),before);assert.equal(G.deploymentCell(s,building('city',null,0,2)),null);
});
test('Port defaults to its ocean tile when present and has a stable coast fallback otherwise',()=>{
 const p=building('port','P1',0,0),s=fixture([],[p]);G.cell(s,p).terrain='ocean';assert.equal(G.deploymentCell(s,p),G.cell(s,p));G.cell(s,p).terrain='coast';assert.equal(G.deploymentCell(s,p),G.cell(s,p));assert.ok(G.productionReason(s,p,'aafrigate'));assert.equal(G.productionReason(s,p,'marine'),null);
});
test('Setting an occupied deployment tile is legal and free of AP or resource cost',()=>{
 const u=unit('infantry','P1',0,0),enemy=unit('infantry','P2',1,0),f=building('barracks','P1',0,0),s=fixture([u,enemy],[f]);const money=G.player(s).resources.money,ap=u.ap;ok(s,{kind:'setDeployment',buildingId:f.id,q:1,r:0});assert.deepEqual(f.deployment,{q:1,r:0});assert.equal(G.player(s).resources.money,money);assert.equal(u.ap,ap);
});
test('Deployment settings reject invalid facility, distance, terrain and ownership atomically',()=>{
 const f=building('factory','P1',0,0),other=building('barracks','P2',3,0),city=building('city','P1',0,2),s=fixture([],[f,other,city]);for(const cmd of [{buildingId:f.id,q:3,r:0},{buildingId:other.id,q:3,r:0},{buildingId:city.id,q:0,r:2},{buildingId:f.id,q:999,r:999}])fail(s,{kind:'setDeployment',...cmd});G.cell(s,{q:1,r:0}).terrain='ocean';fail(s,{kind:'setDeployment',buildingId:f.id,q:1,r:0});
});
test('Setting deployment must support every queued and in-production model',()=>{
 const p=building('port','P1',0,0),s=fixture([],[p]);G.cell(s,p).terrain='coast';G.cell(s,{q:1,r:0}).terrain='ocean';p.stock=[stock(p,'marine','marine'),stock(p,'aafrigate','ship')];fail(s,{kind:'setDeployment',buildingId:p.id,q:0,r:0});p.stock=[];p.order={id:'order',kind:'unit',type:'aafrigate',readyOwnTurn:2};fail(s,{kind:'setDeployment',buildingId:p.id,q:0,r:1});ok(s,{kind:'setDeployment',buildingId:p.id,q:1,r:0});assert.equal(p.order.type,'aafrigate');
});
test('New production cannot choose a model incompatible with the configured deployment tile',()=>{
 const p=building('port','P1',0,0),s=fixture([],[p]);G.cell(s,p).terrain='coast';G.cell(s,{q:1,r:0}).terrain='ocean';ok(s,{kind:'setDeployment',buildingId:p.id,q:0,r:0});assert.match(G.productionReason(s,p,'aafrigate'),/部署格/);fail(s,{kind:'produce',buildingId:p.id,type:'aafrigate'});ok(s,{kind:'produce',buildingId:p.id,type:'marine'});
});
test('Production waits for owner turn then automatically deploys onto an empty configured cell',()=>{
 const f=building('barracks','P1',0,0),s=fixture([],[f]);ok(s,{kind:'setDeployment',buildingId:f.id,q:1,r:0});ok(s,{kind:'produce',buildingId:f.id,type:'infantry'});const count=G.count(s);ok(s,{kind:'end'});assert.ok(f.order);assert.equal(s.units.length,0);ok(s,{kind:'end'});const u=G.occupied(s,{q:1,r:0});assert.equal(u.type,'infantry');assert.equal(u.owner,'P1');assert.equal(u.ap,2);assert.equal(f.order,null);assert.equal(f.stock.length,0);assert.equal(G.count(s),count);assert.equal(G.player(s).stats.produced,1);
});
test('Blocked production enters FIFO inventory with a maximum of three',()=>{
 const blocker=unit('infantry','P1',0,0),f=building('barracks','P1',0,0),s=fixture([blocker],[f]);for(let i=0;i<3;i++){ok(s,{kind:'produce',buildingId:f.id,type:'infantry'});cycle(s);assert.equal(f.stock.length,i+1);}assert.match(G.productionReason(s,f,'infantry'),/库存已满/);fail(s,{kind:'produce',buildingId:f.id,type:'infantry'});assert.equal(deployed(s).length,0);
});
test('Moving the blocker automatically releases exactly one FIFO entry per transaction',()=>{
 const blocker=unit('infantry','P1',0,0),f=building('barracks','P1',0,0),s=fixture([blocker],[f]);f.stock=[stock(f,'infantry','first'),stock(f,'antitank','second'),stock(f,'heavyinfantry','third')];ok(s,{kind:'move',unitId:blocker.id,q:1,r:0});let u=G.occupied(s,f);assert.equal(u.type,'infantry');assert.equal(deployed(s).at(-1).stockId,'first');assert.deepEqual(f.stock.map(x=>x.id),['second','third']);ok(s,{kind:'move',unitId:u.id,q:0,r:1});u=G.occupied(s,f);assert.equal(u.type,'antitank');assert.equal(deployed(s).at(-1).stockId,'second');assert.equal(f.stock.length,1);ok(s,{kind:'move',unitId:u.id,q:-1,r:0});assert.equal(G.occupied(s,f).type,'heavyinfantry');assert.equal(f.stock.length,0);
});
test('A full queue retains a finished order, then uses the freed slot without losing FIFO',()=>{
 const blocker=unit('infantry','P1',0,0),f=building('barracks','P1',0,0),s=fixture([blocker],[f]);f.stock=[stock(f,'infantry','first'),stock(f,'antitank','second'),stock(f,'heavyinfantry','third')];f.order={id:'fourth',kind:'unit',type:'infantry',readyOwnTurn:2};cycle(s);assert.equal(f.stock.length,3);assert.equal(f.order.id,'fourth');assert.equal(G.player(s).stats.produced,0);ok(s,{kind:'move',unitId:blocker.id,q:1,r:0});assert.equal(deployed(s).at(-1).stockId,'first');assert.deepEqual(f.stock.map(x=>x.id),['second','third','fourth']);assert.equal(f.order,null);assert.equal(G.player(s).stats.produced,1);
});
test('Changing to an empty compatible deployment cell immediately releases the FIFO head',()=>{
 const blocker=unit('infantry','P1',0,0),f=building('barracks','P1',0,0),s=fixture([blocker],[f]);f.stock=[stock(f,'infantry','head'),stock(f,'antitank','tail')];ok(s,{kind:'setDeployment',buildingId:f.id,q:1,r:0});assert.equal(G.occupied(s,{q:1,r:0}).type,'infantry');assert.equal(f.stock[0].id,'tail');assert.equal(G.occupied(s,f),blocker);
});
test('Cross-player vacancy release preserves unit owner, grants zero AP, and resets on owner turn',()=>{
 const moving=unit('infantry','P1',0,0),f=building('barracks','P2',0,0),s=fixture([moving],[f]);f.stock=[stock(f,'infantry','enemy-head')];ok(s,{kind:'move',unitId:moving.id,q:1,r:0});const newborn=G.occupied(s,f);assert.equal(newborn.owner,'P2');assert.equal(newborn.ap,0);assert.equal(newborn.counterRemaining,1);assert.equal(deployed(s).at(-1).actor,'P2');assert.equal(G.player(s,'P2').exercise.deployment,true);ok(s,{kind:'end'});assert.equal(newborn.ap,2);
});
test('Destroying a blocker releases its owner inventory after combat without a new counterattack',()=>{
 const a=unit('tank','P1',0,0),blocker=unit('infantry','P2',1,0),f=building('barracks','P2',1,0),s=fixture([a,blocker],[f]);blocker.hp=10;f.stock=[stock(f,'infantry','head')];const hp=a.hp;ok(s,{kind:'attack',unitId:a.id,targetId:blocker.id});const newborn=G.occupied(s,f);assert.notEqual(newborn.id,blocker.id);assert.equal(newborn.owner,'P2');assert.equal(newborn.ap,0);assert.equal(a.hp,hp);
});
test('Hidden cross-player automatic deployment is not broadcast in human action logs',()=>{
 const a=unit('infantry','P1',0,0),f=building('barracks','P2',7,0),s=fixture([a],[f],{fog:true});f.stock=[stock(f,'infantry','head')];ok(s,{kind:'drawDecline'});assert.equal(G.occupied(s,f).owner,'P2');const log=s.logs.filter(l=>l.kind==='deployment').at(-1);assert.ok(log.audiences.includes('P2'));assert.ok(!log.audiences.includes('P1'));
});
test('Automatic deployment events expose complete identifiers to the effect pipeline',()=>{
 const f=building('barracks','P1',0,0),s=fixture([],[f]);f.stock=[stock(f,'infantry','head')];ok(s,{kind:'drawDecline'});const e=deployed(s).at(-1);assert.deepEqual([e.buildingId,e.stockId,e.type,e.unitId,e.q,e.r,e.automatic,e.owner],[f.id,'head','infantry',s.units[0].id,0,0,true,'P1']);
});
test('Each shared deployment tile is allocated deterministically to one facility',()=>{
 const a=building('barracks','P1',0,0,'A'),b=building('barracks','P1',1,0,'B'),s=fixture([],[b,a]);a.deployment=b.deployment={q:0,r:1};a.stock=[stock(a,'infantry','a')];b.stock=[stock(b,'infantry','b')];ok(s,{kind:'drawDecline'});assert.equal(deployed(s).length,1);assert.equal(deployed(s)[0].buildingId,'A');assert.equal(b.stock.length,1);
});
test('Ruins, foundations and eliminated owners never release inventory',()=>{
 for(const mode of ['ruin','foundation','eliminated']){const f=building('barracks','P2',0,0),s=fixture([unit('infantry','P1',3,0)],[f]);f.stock=[stock(f,'infantry','head')];if(mode==='ruin')f.hp=0;if(mode==='foundation'){f.state='foundation';f.maxHp=f.hp=80;f.readyOwnTurn=9;}if(mode==='eliminated')G.player(s,'P2').eliminated=true;G.flushDeployments(s);assert.equal(f.stock.length,1);assert.equal(G.occupied(s,f),undefined);}
});
test('Rejected commands do not release waiting inventory or complete orders',()=>{
 const a=unit('infantry','P1',1,0),f=building('barracks','P1',0,0),s=fixture([a],[f]);f.stock=[stock(f,'infantry','head')];fail(s,{kind:'move',unitId:a.id,q:999,r:999});assert.equal(f.stock.length,1);
});
test('Legacy manual deploy is retained but cannot cause a second output from that facility in the same action',()=>{
 const f=building('barracks','P1',0,0),s=fixture([],[f]);f.stock=[stock(f,'infantry','head'),stock(f,'antitank','tail')];ok(s,{kind:'deploy',buildingId:f.id,stockId:'head',q:1,r:0});assert.equal(s.units.length,1);assert.equal(f.stock.length,1);assert.equal(G.occupied(s,f),undefined);assert.equal(deployed(s)[0].automatic,false);
});
test('Automatic output retains the 24 cap because inventory and orders are already reserved',()=>{
 const f=building('barracks','P1',0,0),units=Array.from({length:23},(_,i)=>unit('infantry','P1',i%6+1,Math.floor(i/6),`u${i}`)),s=fixture(units,[f]);f.stock=[stock(f,'infantry','head')];assert.equal(G.count(s),24);ok(s,{kind:'drawDecline'});assert.equal(G.count(s),24);assert.equal(s.units.length,24);fail(s,{kind:'produce',buildingId:f.id,type:'infantry'});
});
test('Automatic movement capture consumes movement AP plus capture AP in one transaction',()=>{
 const a=unit('tank','P1',0,0),b=building('city',null,1,0),s=fixture([a],[b]);const energy=G.player(s).resources.energy;ok(s,{kind:'move',unitId:a.id,q:1,r:0});assert.equal(a.ap,0);assert.equal(a.spentMove,1);assert.equal(G.player(s).resources.energy,energy-2);assert.equal(b.owner,'P1');assert.equal(G.player(s).stats.captures,1);assert.equal(s.revision,1);const e=s.events.find(e=>e.kind==='capture');assert.equal(e.automatic,true);assert.equal(e.unitId,a.id);assert.deepEqual([e.q,e.r],[1,0]);
});
test('A move with only one AP reaches the building without granting a free capture',()=>{
 const a=unit('infantry','P1',0,0),b=building('city',null,1,0),s=fixture([a],[b]);a.ap=1;ok(s,{kind:'move',unitId:a.id,q:1,r:0});assert.equal(a.ap,0);assert.equal(b.owner,null);fail(s,{kind:'capture',unitId:a.id,buildingId:b.id});cycle(s);assert.equal(G.captureReason(s,a,b),null);ok(s,{kind:'capture',unitId:a.id,buildingId:b.id});assert.equal(b.owner,'P1');
});
test('Traversed buildings are ignored; only the actual endpoint is captured',()=>{
 const a=unit('infantry','P1',0,0),one=building('city',null,1,0,'one'),two=building('city',null,2,0,'two'),s=fixture([a],[one,two]);ok(s,{kind:'move',unitId:a.id,q:2,r:0});assert.equal(one.owner,null);assert.equal(two.owner,'P1');assert.equal(a.ap,0);
 const x=unit('infantry','P1',0,0),b=building('city',null,1,0),other=fixture([x],[b]);ok(other,{kind:'move',unitId:x.id,q:3,r:0});assert.equal(b.owner,null);assert.equal(x.ap,1);
});
test('A collision captures an eligible actual stopping cell, not the unentered requested endpoint',()=>{
 const a=unit('tank','P1',0,0),hidden=unit('infantry','P2',2,0),b=building('city',null,1,0),s=fixture([a,hidden],[b],{fog:true});s.cells=s.cells.filter(c=>c.r===0&&c.q>=0&&c.q<=3);s.vision.P1={ground:['0,0'],air:[]};ok(s,{kind:'move',unitId:a.id,q:3,r:0});assert.equal(a.q,1);assert.equal(a.ap,0);assert.equal(b.owner,'P1');assert.equal(hidden.q,2);assert.equal(s.events.filter(e=>e.kind==='capture').length,1);
});
test('Zero-step collisions do not auto-capture the unit current building or spend AP',()=>{
 const a=unit('tank','P1',0,0),hidden=unit('infantry','P2',1,0),b=building('city',null,0,0),s=fixture([a,hidden],[b],{fog:true});s.cells=s.cells.filter(c=>c.r===0&&c.q>=0&&c.q<=2);s.vision.P1={ground:['0,0'],air:[]};ok(s,{kind:'move',unitId:a.id,q:2,r:0});assert.equal(a.q,0);assert.equal(a.ap,2);assert.equal(b.owner,null);
});
test('Own and allied buildings are not automatically captured',()=>{
 for(const owner of ['P1','P2']){const a=unit('infantry','P1',0,0),b=building('city',owner,1,0),s=fixture([a],[b]);s.players[1].teamId=s.players[0].teamId;s.players.push({...structuredClone(s.players[1]),id:'P3',teamId:'P3',originalHqId:null});s.knownBuildings.P3={};s.explored.P3=[];s.revealed.P3=[];ok(s,{kind:'move',unitId:a.id,q:1,r:0});assert.equal(b.owner,owner);assert.equal(a.ap,1);assert.equal(s.events.filter(e=>e.kind==='capture').length,0);}
});
test('All three states may automatically capture their reachable endpoint',()=>{
 for(const type of ['infantry','fighter','aafrigate','amphibious']){const a=unit(type,'P1',0,0),b=building(type==='aafrigate'?'energyplatform':'city',null,1,0),s=fixture([a],[b]);if(type==='aafrigate'){G.cell(s,a).terrain='ocean';G.cell(s,b).terrain='ocean';}ok(s,{kind:'move',unitId:a.id,q:1,r:0});assert.equal(b.owner,'P1');assert.equal(a.ap,0);}
});
test('Arriving at an enemy foundation captures it as a ruin and discards its old queue',()=>{
 const a=unit('infantry','P1',0,0),b=building('factory','P2',1,0),s=fixture([a],[b]);b.state='foundation';b.hp=b.maxHp=100;b.readyOwnTurn=4;b.stock=[stock(b,'lighttank','head')];ok(s,{kind:'move',unitId:a.id,q:1,r:0});assert.deepEqual([b.owner,b.state,b.hp,b.stock.length],['P1','complete',0,0]);
});
test('Automatic HQ capture terminates play before unrelated waiting stock can spawn',()=>{
 const a=unit('infantry','P1',0,0),hq=building('hq','P2',1,0,'target-hq'),f=building('barracks','P1',3,0),s=fixture([a],[hq,f]);G.player(s,'P2').originalHqId=hq.id;f.stock=[stock(f,'infantry','head')];ok(s,{kind:'move',unitId:a.id,q:1,r:0});assert.equal(s.result.winner,'P1');assert.equal(G.player(s,'P2').eliminated,true);assert.equal(f.stock.length,1);assert.equal(deployed(s).length,0);
});
test('Spawning onto a neutral building never grants an uncharged automatic capture',()=>{
 const f=building('barracks','P1',0,0),b=building('city',null,1,0),s=fixture([],[f,b]);f.stock=[stock(f,'infantry','head')];ok(s,{kind:'setDeployment',buildingId:f.id,q:1,r:0});const u=G.occupied(s,b);assert.equal(b.owner,null);assert.equal(u.ap,2);assert.equal(G.captureReason(s,u,b),null);ok(s,{kind:'capture',unitId:u.id,buildingId:b.id});assert.equal(b.owner,'P1');
});
test('Configured cells, FIFO order and completed production survive save/restore without replay',()=>{
 const s=G.create(M.fixed('S',2),{fog:false}),f=G.ownBuildings(s).find(b=>b.type==='factory'),point=G.deploymentCell(s,f);f.deployment={q:point.q,r:point.r};f.stock=[stock(f,'lighttank','first'),stock(f,'engineer','second')];const blocker=G.occupied(s,point);if(!blocker)s.units.push(G.normalizeUnit({id:'queue-blocker',type:'infantry',owner:'P1',q:point.q,r:point.r},s));let restored=S.restore(S.pack(s,'deployment state'));for(let i=0;i<3;i++){const state=JSON.stringify({units:restored.units,buildings:restored.buildings,resources:restored.players.map(p=>p.resources)});restored=S.restore(S.pack(restored,'again'));assert.equal(JSON.stringify({units:restored.units,buildings:restored.buildings,resources:restored.players.map(p=>p.resources)}),state);}const result=G.building(restored,f.id);assert.deepEqual(result.deployment,f.deployment);assert.deepEqual(result.stock.map(x=>x.id),['first','second']);
});
test('Old save files lacking deployment fields read stable defaults and do not auto-release on restore',()=>{
 const s=G.create(M.fixed('S',2),{fog:false});for(const b of s.buildings)delete b.deployment;const f=G.ownBuildings(s).find(b=>b.type==='factory');f.stock=[stock(f,'infantry','bad-source')];f.stock[0].type='lighttank';const before=s.units.length,restored=S.restore(S.pack(s,'legacy deployment'));assert.equal(restored.units.length,before);assert.equal(G.building(restored,f.id).stock.length,1);assert.deepEqual([G.deploymentCell(restored,G.building(restored,f.id)).q,G.deploymentCell(restored,G.building(restored,f.id)).r],[f.q,f.r]);
});
test('Save validation rejects configured cells with bad coordinates, range or queue terrain compatibility',()=>{
 const make=()=>G.create(M.fixed('S',2),{fog:false});for(const point of [{q:999,r:999},{q:0.5,r:0},'bad']){const s=make(),f=G.ownBuildings(s).find(b=>b.type==='factory');f.deployment=point;assert.throws(()=>S.validate(s),/部署格/);}const s=make(),p=G.ownBuildings(s).find(b=>b.type==='port');p.deployment={q:p.q,r:p.r};p.stock=[stock(p,'aafrigate','ship')];assert.throws(()=>S.validate(s),/部署格/);
});
test('Automatic AI output uses the selected difficulty without modifying human units',()=>{
 const a=unit('infantry','P1',0,0),f=building('barracks','P2',3,0),s=fixture([a],[f],{difficulty:'hell'});f.stock=[stock(f,'infantry','head')];ok(s,{kind:'drawDecline'});const u=G.occupied(s,f);assert.equal(u.maxHp,104);assert.equal(u.ap,0);assert.equal(a.maxHp,80);assert.equal(G.unitStats(s,u).damage,39);
});
test('AI uses deployment settings with FIFO instead of legacy arbitrary manual deployment',()=>{
 for(const difficulty of ['easy','standard','hard','hell']){const f=building('barracks','P2',0,0),blocker=unit('infantry','P2',0,0),s=fixture([blocker],[f],{difficulty});s.actor='P2';G.player(s).ownTurnIndex=1;f.stock=[stock(f,'infantry','first'),stock(f,'antitank','second')];const before=JSON.stringify(s),decision=AI.decision(s);assert.equal(JSON.stringify(s),before);assert.equal(decision.command.kind,'setDeployment');ok(s,decision.command);assert.equal(deployed(s).at(-1).stockId,'first');assert.equal(f.stock[0].id,'second');}
});
test('AI does not repeat a blocked setting for the same head and turn or consult an unseen blocker',()=>{
 for(const difficulty of ['easy','standard','hard','hell']){const f=building('barracks','P2',0,0),hidden=unit('fighter','P1',0,0),s=fixture([hidden],[f],{difficulty,fog:true});s.actor='P2';G.player(s).ownTurnIndex=1;f.stock=[stock(f,'infantry','first')];const observe=()=>{s.vision.P2={ground:['0,0'],air:[]};};observe();assert.equal(G.visible(s,'P2',hidden),false);const first=AI.decision(s).command;assert.equal(first.kind,'setDeployment');ok(s,first);assert.equal(f.stock.length,1);assert.equal(s.events.find(e=>e.kind==='deploymentSetting').stockId,'first');observe();const before=JSON.stringify(s);assert.notEqual(AI.decision(s).command.kind,'setDeployment');assert.equal(JSON.stringify(s),before);f.stock[0].id='second';assert.equal(AI.decision(s).command.kind,'setDeployment');f.stock[0].id='first';G.player(s).ownTurnIndex=2;assert.equal(AI.decision(s).command.kind,'setDeployment');}
});

fs.mkdirSync('reports',{recursive:true});fs.writeFileSync('reports/deployment-tests-v0.9.json',JSON.stringify({date:new Date().toISOString(),passed:results.filter(r=>r.ok).length,total:results.length,results},null,2));console.log(`Deployment: ${results.filter(r=>r.ok).length}/${results.length} groups passed`);if(results.some(r=>!r.ok))process.exitCode=1;
