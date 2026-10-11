// Real bounded headless battles. No assistance, result editing, state teleport,
// hidden enemy search, or save/load retries are used after the opening.
const fs=require('node:fs'),assert=require('node:assert/strict');
const G=require('../src/game'),M=require('../src/maps'),H=require('../src/grid'),AI=require('../src/ai'),B=require('../src/campaign-budget'),S=require('../src/storage');
const limits={maxRounds:150,maxCommands:10000,maxMilliseconds:90000};
const cases=['S01','S08','S15','S22','S29','S36'].map(missionId=>({missionId,elites:[]}));
cases.push({missionId:'S29',elites:[{characterId:'E01',level:6},{characterId:'E02',level:6}]});
const selection=process.argv.indexOf('--case');if(selection>=0){const requested=process.argv[selection+1];for(let i=cases.length-1;i>=0;i--)if(cases[i].missionId!==requested||cases[i].elites.length)cases.splice(i,1);}
const report={version:'1.3.0',date:new Date().toISOString(),scope:'Six chapter representatives at standard HQ difficulty plus one legal two-elite opening. Both sides use observation-only automated controllers; not full 42-mission completion, a human victory-route proof, balance or real device QA.',limits,cases:[]};
function write(){fs.writeFileSync('reports/campaign42-battles-v1.3.0.json',JSON.stringify(report,null,2)+'\n');}
function eliteCommand(s){
 if(s.actor!=='union')return null;const options=[],enemies=s.units.filter(u=>!G.allied(s,s.actor,u.owner)&&G.visible(s,s.actor,u));
 for(const u of G.ownUnits(s).filter(u=>u.characterId&&u.ap>0))for(const slot of ['ultimate','active']){
  if(G.eliteSkillReason(s,u,slot))continue;const mode=G.eliteCombat.targetMode(u,slot);
  const targets=G.eliteSkillTargets(s,u,slot),commands=mode==='enemy'?targets.map(t=>({kind:'eliteSkill',unitId:u.id,slot,targetId:t.id})):mode==='cell'?targets.map(t=>({kind:'eliteSkill',unitId:u.id,slot,q:t.q,r:t.r})):mode==='ally'?targets.map(t=>({kind:'eliteSkill',unitId:u.id,slot,targetId:t.id})):[{kind:'eliteSkill',unitId:u.id,slot}];
  for(const command of commands){const outcome=G.eliteSkillPreview(s,u,slot,command);if(outcome.reason)continue;const hits=outcome.hits||[],support=outcome.beneficiaries||[];let score=hits.reduce((n,h)=>n+h.damage+(h.buildingDamage||0)+(h.lethal?100:0),0)-outcome.counters.reduce((n,h)=>n+h.damage,0);
   if(enemies.some(e=>H.distance(e,u)<=6))score+=support.reduce((n,h)=>n+h.heal*.5+h.shieldGranted*.15,0);
   if(outcome.observation)score+=enemies.filter(e=>H.distance(e,outcome.observation)<=outcome.observation.visionRadius).length*15;
   if(outcome.attackerHp<=0)score-=300;if(score>0)options.push({command,score});
  }
 }
 options.sort((a,b)=>b.score-a.score||JSON.stringify(a.command).localeCompare(JSON.stringify(b.command)));return options[0]?.command||null;
}
for(const spec of cases){
 const map=M.campaign(spec.missionId),openingUnits=map.initialUnits.length,openingGuard=map.seats[0].hqGuardId;
 for(const choice of spec.elites){const candidate=map.mission.eliteDeploymentDesign.candidates.find(c=>c.characterId===choice.characterId);assert.ok(candidate,'Elite must have a source-authorized slot');const u=map.initialUnits.find(u=>u.key===candidate.replaceableUnitKeys[0]);assert.ok(u&&u.owner==='union');u.characterId=choice.characterId;u.elite=G.eliteFreeze(choice.characterId,choice.level,map.mission.eliteLevelCap);delete u.hp;}
 const s=G.create(map,{difficulty:'standard',fog:map.mission.fog,victoryMode:'capture_hq'});G.player(s,'union').controller='ai';assert.equal(s.units.length,openingUnits);assert.equal(G.player(s,'union').hqGuardId,openingGuard);S.validate(s);
 const entry={missionId:spec.missionId,elites:spec.elites.map(c=>({...c,effectiveLevel:G.ownUnits(s,'union').find(u=>u.characterId===c.characterId).elite.effectiveLevel})),fog:s.settings.fog,actions:0,commandKinds:{},peakPopulation:{union:G.count(s,'union'),red:G.count(s,'red')},paidEnemyOrders:0,paidEnemyCost:0,illegalCommands:[],assertionFailures:[],completed:false,status:'running',lastCommands:[]};report.cases.push(entry);write();const started=Date.now();
 try{
  while(!s.result&&s.round<=limits.maxRounds&&entry.actions<limits.maxCommands&&Date.now()-started<limits.maxMilliseconds){
   const command=eliteCommand(s)||AI.choose(s);assert.ok(command,'AI must produce an actual legal command');const unit=command.unitId?G.unit(s,command.unitId):null,apBefore=unit?.ap,actor=s.actor,energyBefore=G.player(s).resources.energy,ownTurnBefore=G.player(s).ownTurnIndex;
   const result=G.execute(s,command);if(!result.ok){entry.illegalCommands.push({command,error:result.error,actor,round:s.round,ownTurn:ownTurnBefore});throw Error(result.error);}
   entry.actions++;entry.commandKinds[command.kind]=(entry.commandKinds[command.kind]||0)+1;
   entry.lastCommands.push({actor,round:s.round,command});if(entry.lastCommands.length>12)entry.lastCommands.shift();
   if(['attack','capture','skill','eliteSkill'].includes(command.kind)&&G.unit(s,unit?.id))assert.equal(G.unit(s,unit.id).ap,0,'Final action consumes AP');
   if(command.kind==='move'&&G.unit(s,unit?.id))assert.ok(G.unit(s,unit.id).ap<apBefore,'Movement consumes AP');
   if(command.kind!=='end')assert.ok(G.player(s,actor).resources.energy<=energyBefore,'Commands do not grant free movement energy');
   for(const p of s.players){assert.ok(p.resources.money>=0&&p.resources.energy>=0);assert.ok(p.resources.money<=3000&&p.resources.energy<=300);assert.ok(G.count(s,p.id)<=24);entry.peakPopulation[p.id]=Math.max(entry.peakPopulation[p.id],G.count(s,p.id));}
   for(const u of s.units){assert.ok(Number.isInteger(u.ap)&&u.ap>=0&&u.ap<=2);assert.ok(u.hp>0&&u.hp<=u.maxHp);assert.ok(Number.isFinite(H.cost(u,G.cell(s,u))),'No illegal terrain landing');}
   assert.equal(B.validate(s),null);entry.paidEnemyOrders=s.enemyProductionLedger.paidOrdersUsed;entry.paidEnemyCost=s.enemyProductionLedger.moneySpentOnNewUnits;
   if(entry.actions%50===0){S.validate(s);entry.rounds=s.round;entry.milliseconds=Date.now()-started;write();}
  }
  S.validate(s);entry.completed=!!s.result;entry.status=s.result?'finished':Date.now()-started>=limits.maxMilliseconds?'wall_time_limit':s.round>limits.maxRounds?'round_limit':'command_limit';entry.result=s.result;entry.rounds=s.round;entry.milliseconds=Date.now()-started;entry.enemyBudget={limits:s.mission.enemyProductionBudget,ledger:s.enemyProductionLedger};entry.finalResources=s.players.map(p=>({id:p.id,money:p.resources.money,energy:p.resources.energy,population:G.count(s,p.id),ownTurn:p.ownTurnIndex}));
  if(!s.result)entry.stallDiagnostic={actor:s.actor,units:s.units.map(u=>({id:u.id,type:u.type,owner:u.owner,q:u.q,r:u.r,hp:u.hp,maxHp:u.maxHp,ap:u.ap})),buildings:s.buildings.map(b=>({id:b.id,type:b.type,owner:b.owner,q:b.q,r:b.r,hp:b.hp,order:b.order,stock:b.stock})),players:s.players.map(p=>({id:p.id,controller:p.controller,hqGuardId:p.hqGuardId,originalHqId:p.originalHqId,resources:p.resources,recovery:G.recovery(s,p)})),productionReasons:s.buildings.filter(b=>b.owner===s.actor&&['barracks','factory','port','airfield'].includes(b.type)).map(b=>({id:b.id,rebuild:G.repairBuildingReason(s,b),models:map.mission.playerProductionWhitelist.map(type=>({type,reason:G.productionReason(s,b,type)}))})),decision:AI.decision(s)};
 }catch(e){entry.status='failed';entry.assertionFailures.push(e.stack);entry.rounds=s.round;entry.milliseconds=Date.now()-started;process.exitCode=1;}
 write();console.log(JSON.stringify({mission:entry.missionId,elites:entry.elites.map(e=>e.characterId),status:entry.status,actions:entry.actions,rounds:entry.rounds,winner:entry.result?.winner||null,paidEnemyOrders:entry.paidEnemyOrders,milliseconds:entry.milliseconds}));
}
report.finished=report.cases.filter(c=>c.completed).length;report.boundedWithoutError=report.cases.filter(c=>c.status!=='failed').length;report.illegalCommands=report.cases.reduce((n,c)=>n+c.illegalCommands.length,0);report.total=report.cases.length;write();console.log(`Campaign42 battles: ${report.finished}/${report.total} finished, ${report.boundedWithoutError}/${report.total} bounded without errors, ${report.illegalCommands} illegal commands`);
