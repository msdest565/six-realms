// Exercises delivered maps and actual command/story contracts, not human balance.
const fs=require('node:fs'),assert=require('node:assert/strict');
const Content=require('../src/content'),D=require('../src/data'),H=require('../src/grid'),M=require('../src/maps'),G=require('../src/game'),C=require('../src/campaign'),B=require('../src/campaign-budget'),S=require('../src/storage'),T=require('../src/training'),AI=require('../src/ai');
const results=[],copy=x=>JSON.parse(JSON.stringify(x)),id=C.newId;
function test(name,fn){try{fn();results.push({name,ok:true});}catch(e){results.push({name,ok:false,error:e.stack});console.error(name,e.stack);}}
function ok(s,command){const r=G.execute(s,command);assert.equal(r.ok,true,r.error);return r;}
function consume(s){let n=0;while(s.story.queue.length){assert.ok(n++<10,'story queue terminates');C.confirm(s);}}
function red(mission='S01',difficulty='standard'){const s=G.create(M.campaign(mission),{difficulty,fog:false});s.actor='red';s.turnStarted=true;G.player(s).ownTurnIndex=8;G.player(s).resources={money:3000,energy:300};return s;}
function finishOrders(s){for(const b of G.ownBuildings(s))if(b.order?.kind==='unit')b.order.readyOwnTurn=G.player(s).ownTurnIndex+1;ok(s,{kind:'end'});ok(s,{kind:'end'});}

test('42 missions form six distinct seven-stage chapters and retain seven tutorial IDs',()=>{
 assert.equal(Content.campaign.missions.length,7);assert.equal(C.missions(id).length,42);assert.equal(C.catalogs().length,2);assert.equal(C.catalog(id).chapters.length,6);
 const missions=C.missions(id);for(let i=0;i<42;i++){const m=missions[i];assert.equal(m.id,'S'+String(i+1).padStart(2,'0'));assert.equal(m.nextMission,missions[i+1]?.id||null);assert.equal(m.chapterId,'CH'+String(Math.floor(i/7)+1).padStart(2,'0'));assert.equal(m.stageInChapter,i%7+1);}
 assert.throws(()=>C.create('S01',C.newProgress()),/不匹配/);assert.throws(()=>C.create('C01',C.newProgress(id)),/不匹配/);
});
test('128 main and 15 personal scenes preserve all 49 exact speaker channels',()=>{
 const scenes=Object.values(Content.story42.scenes);assert.equal(scenes.length,143);assert.equal(scenes.filter(s=>s.characterId).length,15);assert.equal(Object.keys(Content.story42.speakers).length,49);
 for(const s of scenes){assert.equal(Content.scenes[s.id].text,s.text);for(const line of s.lines)assert.ok(Content.story42.speakers[line.speakerId]);}
 for(const speaker of Object.values(Content.story42.speakers).filter(s=>s.characterId)){assert.ok(speaker.characterId.startsWith('E'));assert.equal(speaker.assetsStatus,'delivered');}
 for(const portrait of Object.values(Content.story42.elitePortraits)){assert.equal(portrait.assetStatus,'delivered');assert.equal(portrait.assetPath,'assets/elites/portraits/'+portrait.portraitId+'.png');assert.ok(fs.existsSync(portrait.assetPath));}
});
test('42 real maps contain 215 player units, 400 enemy units, 341 buildings and 187 paid plans',()=>{
 const maps=C.missions(id).map(m=>M.campaign(m.id));assert.equal(maps.reduce((n,m)=>n+m.initialUnits.filter(u=>u.owner==='union').length,0),215);assert.equal(maps.reduce((n,m)=>n+m.initialUnits.filter(u=>u.owner==='red').length,0),400);assert.equal(maps.reduce((n,m)=>n+m.buildings.length,0),341);assert.equal(maps.reduce((n,m)=>n+m.mission.enemyProductionPlan.length,0),187);
 for(const map of maps){const s=G.create(map,{fog:map.mission.fog,deferStart:true}),seen=new Set();assert.equal(s.cells.length,map.size[0]*map.size[1]);for(const u of s.units){assert.ok(!seen.has(H.key(u.q,u.r)));seen.add(H.key(u.q,u.r));assert.ok(Number.isFinite(H.cost(u,G.cell(s,u))));}for(const p of s.players){const guard=G.unit(s,p.hqGuardId),hq=G.building(s,p.originalHqId);assert.ok(guard&&hq);assert.deepEqual([guard.q,guard.r],[hq.q,hq.r]);}for(const b of s.buildings.filter(b=>D.buildingById[b.type].group==='production'))assert.equal(G.deploymentPositionReason(s,b,G.deploymentCell(s,b)),null);S.validate(s);}
});
test('all 168 four-difficulty openings apply current ordinary air stats and hell scaling once',()=>{
 for(const m of C.missions(id))for(const difficulty of ['easy','standard','hard','hell']){const s=G.create(M.campaign(m.id),{difficulty,deferStart:true});for(const u of s.units){const factor=u.owner==='red'?G.difficultyProfiles[difficulty].hp/100:1;assert.equal(u.maxHp,Math.round(D.byId[u.type].hp*factor));assert.ok(u.hp>0&&u.hp<=u.maxHp);}const factor=G.difficultyProfiles[difficulty].resources/100;assert.equal(G.player(s,'red').resources.money,Math.min(3000,Math.round(m.initialResources.red.money*factor)));assert.equal(G.player(s,'union').resources.money,m.initialResources.union.money);}
});
test('explicit current-air map inputs are never converted through legacy air HP twice',()=>{
 const map=M.campaign('S24'),u=map.initialUnits.find(u=>D.byId[u.type].branch==='air');assert.ok(u);u.hp=D.byId[u.type].hp;u.hpInputVersion='balance-1';const s=G.create(map,{deferStart:true});assert.equal(G.unit(s,u.id).hp,D.byId[u.type].hp);
});
test('first intro gates first income and Sxx progress is saved independently from Cxx',()=>{
 const s=C.create('S01');assert.deepEqual(s.story.queue,['PROLOGUE-42','S01-INTRO']);assert.equal(G.player(s).resources.money,100);C.confirm(s);assert.equal(s.turnStarted,false);C.confirm(s);assert.equal(G.player(s).resources.money,160);G.begin(s);assert.equal(G.player(s).resources.money,160);
 S.progress(C.newProgress());S.progress(s.story.progress);assert.deepEqual(S.progress().unlocked,['C01']);assert.deepEqual(S.progress(undefined,id).unlocked,['S01']);assert.equal(S.restore(S.pack(s,'intro')).mission.id,'S01');
});
let finalProgress;
test('full assisted mainline confirms all 143 scenes and all 15 portrait nodes without training points',()=>{
 let p=C.newProgress(id);for(const mission of C.missions(id)){const s=C.create(mission.id,p);C.assist(s);if(mission.id==='S42'){while(s.story.queue[0]!=='S42-OUTRO')C.confirm(s);C.confirm(s);assert.deepEqual(s.story.queue,['ELITE-E05-P03','EPILOGUE-42']);assert.equal(s.story.progress.complete,false);const restored=S.restore(S.pack(s,'final personal queue'));assert.deepEqual(restored.story.queue,s.story.queue);}consume(s);p=s.story.progress;}
 finalProgress=p;assert.equal(p.complete,true);assert.equal(p.clues.length,42);assert.equal(p.seenScenes.length,143);const profile=T.read();assert.equal(profile.balance,0);assert.equal(Object.keys(profile.earnedByClaim).length,0);for(const hero of Object.values(profile.heroes)){assert.equal(hero.unlocked,true);assert.equal(hero.portraitIds.length,3);assert.equal(hero.level,1);}assert.equal(T.chapterCap(profile),10);
});
test('replaying a completed mission repeats personal text but grants no duplicate portrait or points',()=>{
 const before=T.read(),s=C.create('S02',finalProgress);consume(s);C.assist(s);consume(s);const p=T.read();assert.deepEqual(p.heroes,before.heroes);assert.equal(p.balance,before.balance);assert.equal(p.completedOutros.length,42);
});
test('same-system elite replaces an original key and HQ guard without adding population',()=>{
 const s=C.create('S03',finalProgress,{eliteSelection:[{characterId:'E01',unitKey:'U01'}]}),u=G.unit(s,'S03-U01');assert.equal(u.characterId,'E01');assert.equal(u.key,'U01');assert.equal(G.player(s,'union').hqGuardId,u.id);assert.equal(u.maxHp,180);assert.equal(s.units.length,M.campaign('S03').initialUnits.length);assert.equal(s.trainingDifficulty,'standard');assert.equal(S.restore(S.pack(s,'elite')).units.find(x=>x.id===u.id).characterId,'E01');
 assert.throws(()=>C.create('S03',finalProgress,{eliteSelection:[{characterId:'E01',unitKey:'U02'}]}),/位置|替换|无效/);assert.throws(()=>C.create('C01',C.newProgress(),{eliteSelection:[{characterId:'E01',unitKey:'U01'}]}),/不支持/);
});
test('authored and adaptive orders share two slots and real paid money without free spawns',()=>{
 const s=red(),b=G.building(s,'S01-RB13'),before=s.units.length,cash=G.player(s).resources.money;ok(s,{kind:'produce',buildingId:b.id,type:'infantry'});assert.equal(s.units.length,before);assert.equal(b.order.budgetSource,'authored');assert.equal(s.enemyProductionLedger.paidOrdersUsed,1);assert.equal(G.player(s).resources.money,cash-35);finishOrders(s);ok(s,{kind:'produce',buildingId:b.id,type:'infantry'});assert.equal(b.order.budgetSource,'adaptive');assert.equal(s.enemyProductionLedger.paidOrdersUsed,2);finishOrders(s);assert.match(G.productionReason(s,b,'infantry'),/名额/);const snapshot=JSON.stringify(s);assert.equal(G.execute(s,{kind:'produce',buildingId:b.id,type:'infantry'}).ok,false);assert.equal(JSON.stringify(s),snapshot);assert.equal(s.enemyProductionLedger.moneySpentOnNewUnits,70);assert.equal(B.validate(s),null);
});
test('parallel, cumulative-spend, money-reserve and energy-reserve refusals are atomic',()=>{
 for(const kind of ['parallel','money','energy','total']){const s=red(),b=G.building(s,'S01-RB13');if(kind==='parallel')s.mission.enemyProductionBudget.maxSimultaneousOrders=0;if(kind==='money')G.player(s).resources.money=154;if(kind==='energy')G.player(s).resources.energy=15;if(kind==='total')s.mission.enemyProductionBudget.maxMoneySpentOnNewUnits=34;const before=JSON.stringify(s);const r=G.execute(s,{kind:'produce',buildingId:b.id,type:'infantry'});assert.equal(r.ok,false,kind);assert.equal(JSON.stringify(s),before,kind);}
});
test('two facilities competing for the final shared paid slot accept only one command',()=>{
 const s=red('S08');for(const plan of s.enemyPlan){const facility=G.building(s,`${s.mission.id}-${plan.facility}`);ok(s,{kind:'produce',buildingId:facility.id,type:plan.unit});finishOrders(s);}
 assert.equal(s.enemyProductionLedger.paidOrdersUsed,3);const choices=G.ownBuildings(s).filter(b=>D.buildingById[b.type].group==='production').map(b=>({b,d:D.units.find(d=>!G.productionReason(s,b,d.id))}));assert.equal(choices.filter(x=>x.d).length,2);ok(s,{kind:'produce',buildingId:choices[0].b.id,type:choices[0].d.id});const before=JSON.stringify(s),other=G.execute(s,{kind:'produce',buildingId:choices[1].b.id,type:choices[1].d.id});assert.equal(other.ok,false);assert.match(other.error,/共享付费名额/);assert.equal(JSON.stringify(s),before);assert.equal(s.enemyProductionLedger.paidOrdersUsed,4);assert.equal(B.validate(s),null);
});
test('a real pending order blocks another idle source when one parallel slot is allowed',()=>{
 const s=red('S08');s.mission.enemyProductionBudget.maxSimultaneousOrders=1;const first=s.enemyPlan[0],second=s.enemyPlan[1];ok(s,{kind:'produce',buildingId:`S08-${first.facility}`,type:first.unit});const before=JSON.stringify(s),result=G.execute(s,{kind:'produce',buildingId:`S08-${second.facility}`,type:second.unit});assert.equal(result.ok,false);assert.match(result.error,/并行生产名额/);assert.equal(JSON.stringify(s),before);
});
test('unit deaths and production facility capture never restore spent quotas',()=>{
 const s=red(),b=G.building(s,'S01-RB13');ok(s,{kind:'produce',buildingId:b.id,type:'infantry'});const used=copy(s.enemyProductionLedger);s.actor='union';const u=G.ownUnits(s)[0];s.units=s.units.filter(x=>x.id===u.id||x.q!==b.q||x.r!==b.r);u.q=b.q;u.r=b.r;u.ap=2;G.vision(s);ok(s,{kind:'capture',unitId:u.id,buildingId:b.id});assert.equal(b.order,null);assert.deepEqual(s.enemyProductionLedger,used);s.units=s.units.filter(x=>x.owner!=='red'||x.id===G.player(s,'red').hqGuardId);assert.deepEqual(s.enemyProductionLedger,used);assert.equal(B.validate(s),null);
});
test('restore preserves paid history and rejects missing, excess, or forged enemy budgets',()=>{
 const s=red(),b=G.building(s,'S01-RB13');ok(s,{kind:'produce',buildingId:b.id,type:'infantry'});const restored=S.restore(S.pack(s,'paid'));assert.deepEqual(restored.enemyProductionLedger,s.enemyProductionLedger);assert.deepEqual(G.player(restored).resources,G.player(s).resources);for(const mutate of [t=>delete t.enemyProductionLedger,t=>t.enemyProductionLedger.paidOrdersUsed++,t=>t.enemyProductionLedger.records[0].cost=1]){const broken=copy(s);mutate(broken);assert.throws(()=>S.validate(broken),/预算|账本|支付/);}
});
test('easy mode pays finite authored orders and never fills adaptive quota',()=>{
 const s=red('S01','easy'),b=G.building(s,'S01-RB13');ok(s,{kind:'produce',buildingId:b.id,type:'infantry'});finishOrders(s);assert.match(G.productionReason(s,b,'infantry'),/简单|定额|有限/);assert.equal(s.enemyProductionLedger.adaptiveUsed.length,0);
});
test('standard new-campaign AI immediately returns a legal guard to a threatened empty HQ',()=>{
 const s=red(),hq=G.building(s,G.player(s).originalHqId),guard=G.unit(s,G.player(s).hqGuardId);guard.q=4;guard.r=2;const enemy=G.ownUnits(s,'union')[0];enemy.q=3;enemy.r=3;s.units=s.units.filter(u=>u.id===guard.id||u.id===enemy.id||u.q!==hq.q||u.r!==hq.r);G.vision(s);const decision=AI.decision(s);assert.equal(decision.phase,'defense');assert.deepEqual([decision.command.q,decision.command.r],[hq.q,hq.r]);ok(s,decision.command);assert.equal(G.occupied(s,hq).owner,'red');assert.notEqual(AI.decision(s).command?.unitId===guard.id&&AI.decision(s).command?.kind==='move',true);
});
test('standard AI enters a reachable empty HQ to win rather than endlessly attacking its structure',()=>{
 const s=red(),home=G.building(s,G.player(s,'union').originalHqId),guard=G.unit(s,G.player(s,'red').hqGuardId),attacker=G.ownUnits(s).find(u=>u.id!==guard.id);s.units=s.units.filter(u=>u.owner==='red');attacker.q=1;attacker.r=0;attacker.hp=5;attacker.ap=2;G.vision(s);assert.equal(G.attackReason(s,attacker,home),null);const command=AI.decision(s).command;assert.equal(command.kind,'move');assert.equal(command.unitId,attacker.id);assert.deepEqual([command.q,command.r],[home.q,home.r]);ok(s,command);assert.equal(s.result.winner,'red');assert.equal(s.result.reason,'接管敌方原始总部');assert.equal(home.owner,'red');assert.deepEqual([guard.q,guard.r],[5,3]);
});
test('visible elites inform threat models but changing a hidden elite does not change a decision',()=>{
 const s=red('S24','hard');s.settings.fog=true;s.units=s.units.filter(u=>u.owner==='red'||u.id===G.player(s,'union').hqGuardId);const hidden=G.ownUnits(s,'union')[0];hidden.q=0;hidden.r=0;G.vision(s);assert.equal(G.visible(s,'red',hidden),false);const first=AI.decision(s);hidden.characterId='E01';hidden.elite=G.eliteFreeze('E01',10,8);hidden.hp=hidden.maxHp=hidden.elite.stats.hp;G.vision(s);assert.deepEqual(AI.decision(s),first);
});
test('new-campaign AI executes legal commands in all six chapter openings',()=>{
 for(const mission of ['S01','S08','S15','S22','S29','S36']){const s=red(mission,'standard');for(let n=0;n<8&&!s.result;n++){const decision=AI.decision(s);assert.ok(decision.command);const result=G.execute(s,decision.command);assert.equal(result.ok,true,mission+' '+result.error);assert.equal(B.validate(s),null);if(decision.command.kind==='end')break;}}
});
test('fallback victory report describes actual elimination rather than claiming all buildings captured',()=>{
 const s=C.create('S01');consume(s);s.settings.victoryMode='own_all_registered_buildings';s.result={winner:'union',reason:'其余队伍全部出局'};C.after(s);assert.match(s.story.report.brief,/尚未接管/);assert.equal(s.story.report.reason,'其余队伍全部出局');assert.ok(s.buildings.some(b=>b.owner!=='union'));
});
test('an actual S01 HQ capture claims before OUTRO, restores once, and shares the reward slot across modes',()=>{
 const before=T.read().balance;for(const victoryMode of ['capture_hq','own_all_registered_buildings']){const s=C.create('S01',finalProgress,{victoryMode,difficulty:'hard'});consume(s);if(victoryMode==='capture_hq'){const hq=G.building(s,G.player(s,'red').originalHqId),u=G.ownUnits(s)[0];s.units=s.units.filter(x=>x.owner==='union'||x.q!==hq.q||x.r!==hq.r);u.q=hq.q;u.r=hq.r;u.ap=2;G.vision(s);ok(s,{kind:'capture',unitId:u.id,buildingId:hq.id});}else{for(const b of s.buildings)b.owner='union';G.checkVictory(s);}assert.equal(s.result.winner,'union');C.after(s);assert.ok(s.story.queue.includes('S01-OUTRO'));assert.equal(T.read().balance,before+150);const restored=S.restore(S.pack(s,'won before outro'));C.after(restored);assert.equal(T.read().balance,before+150);consume(restored);assert.equal(T.read().balance,before+150);}
});
const report={version:'1.3.0',date:new Date().toISOString(),scope:'42 delivered runtime maps, 168 openings, 143 scene playback, 15 unlock nodes, real command-budget enforcement, restore, observation and sampled tactical AI; no full 42 tactical completion or device/human balance claims.',passed:results.filter(r=>r.ok).length,total:results.length,results};
fs.writeFileSync('reports/campaign42-tests-v1.3.0.json',JSON.stringify(report,null,2)+'\n');console.log(`Campaign42 ${report.passed}/${report.total}`);if(report.passed!==report.total)process.exitCode=1;
