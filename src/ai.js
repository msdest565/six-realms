(function(root){'use strict';
 const G=root.Game||(typeof require!=='undefined'&&require('./game')),H=root.Hex||(typeof require!=='undefined'&&require('./grid')),D=root.GameData||(typeof require!=='undefined'&&require('./data'));
 const fieldCaches=new WeakMap();
 // Reverse terrain distances include detours and exclude unreachable coastal targets.
 // Only observed units and public/last-observed building coordinates enter this field.
 function objectiveField(s,u,goals){let cache=fieldCaches.get(s.cells);if(!cache){cache=new Map();fieldCaches.set(s.cells,cache);}const signature=u.type+'|'+goals.map(t=>`${t.id}:${t.q},${t.r}:${t.type}`).sort().join(';');if(cache.has(signature))return cache.get(signature);const model=D.byId[u.type],dist=new Map(),queue=[];for(const t of goals){const target=D.byId[t.type],state=target?H.domain(t,G.cell(s,t)):null;if(target&&state==='air'&&!model.antiAir)continue;for(const c of s.cells){if(!Number.isFinite(H.cost(u.type,c)))continue;const range=H.distance(c,t),valid=target?range>=model.minRange&&range<=model.maxRange&&(model.indirect||model.branch==='air'||state==='air'||H.los(s.cells,c,t)):range<=1;if(valid&&!dist.has(H.key(c.q,c.r))){dist.set(H.key(c.q,c.r),0);queue.push({...c,cost:0});}}}while(queue.length){queue.sort((a,b)=>a.cost-b.cost||H.sort(a,b));const c=queue.shift();if(dist.get(H.key(c.q,c.r))!==c.cost)continue;for(const n of H.neighbors(c)){const next=G.cell(s,n);if(!next||!Number.isFinite(H.cost(u.type,next)))continue;const cost=c.cost+H.cost(u.type,G.cell(s,c)),key=H.key(n.q,n.r);if(!dist.has(key)||cost<dist.get(key)){dist.set(key,cost);queue.push({...n,cost});}}}if(cache.size>500)cache.clear();cache.set(signature,dist);return dist;}
 function observation(s,id=s.actor){return {player:G.player(s,id),cells:s.cells,units:s.units.filter(u=>G.visible(s,id,u)),buildings:Object.values(s.knownBuildings[id]).map(b=>{const real=G.building(s,b.id);return real&&G.visible(s,id,real)?real:b;}),round:s.round};}
 function baseline(s){if(s.result||s.story?.combatLocked||s.story?.queue.length||G.player(s).controller!=='ai')return null;const view=observation(s),p=view.player,id=p.id,own=view.units.filter(u=>u.owner===id&&u.ap>0),enemies=view.units.filter(u=>!G.allied(s,id,u.owner)),assets=G.ownBuildings(s),training=G.difficulty(s)==='easy'&&p.ownTurnIndex<=8,challenge=['hard','hell'].includes(G.difficulty(s));
  for(const plan of s.enemyPlan.filter(o=>o.state==='pending')){const b=G.building(s,`${s.mission?.id}-${plan.facility}`);if(!b||b.owner!=='red'||b.hp<=0)plan.state='cancelled';}
  const committed=[...G.ownUnits(s),...assets.flatMap(b=>[...b.stock,...(b.order?.kind==='unit'?[b.order]:[])])];const branchCounts=Object.fromEntries(['army','navy','air'].map(branch=>[branch,committed.filter(u=>D.byId[u.type].branch===branch).length]));const hasEngineer=committed.some(u=>u.type==='engineer');
  const allowedTarget=t=>!(training&&s.players.some(x=>x.originalHqId===t.id));
  for(const b of assets){if(b.hp<=0||b.state!=='complete')continue;for(const stock of b.stock){const candidates=[b,...H.neighbors(b)].map(c=>G.cell(s,c)).filter(c=>!G.deployReason(s,b,stock,c));if(candidates.length){candidates.sort((a,b)=>enemies.length?Math.min(...enemies.map(e=>H.distance(a,e)))-Math.min(...enemies.map(e=>H.distance(b,e))):H.sort(a,b));return {kind:'deploy',buildingId:b.id,stockId:stock.id,q:candidates[0].q,r:candidates[0].r};}}}
  const captures=[];for(const u of own)for(const b of view.buildings){if(allowedTarget(b)&&!G.captureReason(s,u,G.building(s,b.id)))captures.push({u,b,score:(b.type==='hq'?1000:0)+(b.type==='city'?40:b.type==='energyplatform'?35:25)});}if(captures.length){captures.sort((a,b)=>b.score-a.score||a.u.id.localeCompare(b.u.id));const c=captures[0];return {kind:'capture',unitId:c.u.id,buildingId:c.b.id};}
  for(const u of own.filter(u=>u.type==='engineer')){const t=[...G.ownUnits(s),...assets].filter(t=>!G.skillReason(s,u,t)).sort((a,b)=>(b.maxHp-b.hp)-(a.maxHp-a.hp))[0];if(t)return {kind:'skill',unitId:u.id,targetId:t.id};}
  const attacks=[];for(const u of own){for(const t of [...enemies,...view.buildings.filter(b=>b.owner&&!G.allied(s,id,b.owner)&&G.visible(s,id,b))]){if(!allowedTarget(t))continue;const target=G.unit(s,t.id)||G.building(s,t.id),preview=G.attackPreview(s,u,target);if(preview.reason)continue;const score=preview.damage-preview.counter*(challenge?1:.8)+(preview.targetHp===0?80:0)+(t.id===G.player(s,t.owner)?.originalHqId?10:0);if(preview.attackerHp>0||preview.targetHp===0)attacks.push({u,t,score});}}
  if(attacks.length){attacks.sort((a,b)=>b.score-a.score||a.u.id.localeCompare(b.u.id));const {u,t}=attacks[0],skill=D.byId[u.type].skill;if(['穿甲弹','震荡弹','定点狙击'].includes(skill)&&!G.skillReason(s,u,G.unit(s,t.id)||G.building(s,t.id)))return {kind:'skill',unitId:u.id,targetId:t.id};return {kind:'attack',unitId:u.id,targetId:t.id};}
  for(const u of own){if(u.type==='jammer'){const target=enemies.filter(t=>!G.skillReason(s,u,t)).sort((a,b)=>D.byId[b.type].damage-D.byId[a.type].damage)[0];if(target)return {kind:'skill',unitId:u.id,targetId:target.id};}if(D.byId[u.type].skill==='主动扫描'&&!G.skillReason(s,u)&&enemies.length===0)return {kind:'skill',unitId:u.id};}
  // Plans reference initial facility instances and cannot respawn after their loss.
  if(s.mission&&id==='red'){for(const plan of s.enemyPlan.filter(o=>o.state==='pending')){const b=G.building(s,`${s.mission.id}-${plan.facility}`);if(!b||b.owner!=='red'||b.hp<=0){plan.state='cancelled';continue;}if(p.ownTurnIndex>=plan.earliestOwnTurn&&!G.productionReason(s,b,plan.unit)){return {kind:'produce',buildingId:b.id,type:plan.unit,planId:plan.id};}}}else{
   const unbusy=assets.filter(b=>!G.facilityReason?.(s,b)&&b.hp>0&&b.state==='complete'&&!b.order);
   if(!s.mission&&p.resources.energy<16){const c=s.cells.find(c=>!G.constructReason(s,c.terrain==='ocean'?'energyplatform':'energyfield',c));if(c)return {kind:'construct',type:c.terrain==='ocean'?'energyplatform':'energyfield',q:c.q,r:c.r};}
   if(p.resources.money>250&&G.count(s)>=8){const b=unbusy.filter(b=>b.level<3&&!G.upgradeReason(s,b)).sort((a,b)=>(D.buildingById[b.type].group==='production'?1:0)-(D.buildingById[a.type].group==='production'?1:0))[0];if(b)return {kind:'upgrade',buildingId:b.id};}
   for(const b of unbusy.filter(b=>D.buildingById[b.type].group==='production').sort((a,b)=>{const priority=x=>x.type==='airfield'&&branchCounts.air<2?3:x.type==='port'&&branchCounts.navy<3?2:1;return priority(b)-priority(a)||a.id.localeCompare(b.id);})){const threats=enemies.filter(e=>H.domain(e,G.cell(s,e))==='air').length,unitTypes=D.units.filter(u=>!G.productionReason(s,b,u.id)&&(u.branch!=='army'||branchCounts.army<14||u.id==='engineer'&&!hasEngineer)&&(u.branch!=='navy'||branchCounts.navy<6)&&(u.branch!=='air'||branchCounts.air<6));unitTypes.sort((a,b)=>{const score=u=>(u.id==='engineer'&&!hasEngineer?80:0)+u.damage+u.hp/8+u.move*4-u.cost/5+(threats&&u.antiAir?40:0)+(u.infantry&&G.count(s)<10?25:0)+(challenge?u.maxRange*4:0);return score(b)-score(a)||a.id.localeCompare(b.id);});if(unitTypes.length)return {kind:'produce',buildingId:b.id,type:unitTypes[0].id};}
   if(!s.mission&&p.resources.money>350){const missing=['airfield','port','barracks','factory'].find(type=>!assets.some(b=>b.type===type&&b.hp>0&&b.state==='complete'));const type=missing||(assets.filter(b=>b.type==='city'||b.type==='market').length<4?'market':assets.filter(b=>D.buildingById[b.type].group==='production').length<6?'factory':null);if(type){const c=s.cells.find(c=>!G.constructReason(s,type,c));if(c)return {kind:'construct',type,q:c.q,r:c.r};}}
  }
  const moves=[];for(const u of own){const hq=G.building(s,p.originalHqId);if(u.id===p.hqGuardId&&hq&&u.q===hq.q&&u.r===hq.r)continue;const goals=[...view.buildings.filter(b=>!G.allied(s,id,b.owner)&&allowedTarget(b)),...enemies];if(!goals.length)continue;const field=objectiveField(s,u,goals),old=field.get(H.key(u.q,u.r))??Infinity;const routes=G.movement(s,u);let best=null;for(const route of routes.values()){if(!route.path.length)continue;const now=field.get(H.key(route.q,route.r))??Infinity,nearest=[...goals].sort((a,b)=>H.distance(route,a)-H.distance(route,b)||(b.type==='hq'?1:0)-(a.type==='hq'?1:0))[0];if(!Number.isFinite(now))continue;let score=(old-now)*20-route.energy*.05-now+(nearest.type==='hq'&&!training?10:0);if(now===0||now===1)score+=15;if(D.byId[u.type].indirect&&now>=D.byId[u.type].minRange&&now<=D.byId[u.type].maxRange)score+=8;if(!best||score>best.score||score===best.score&&H.sort(route,best.route)<0)best={route,score};}if(best&&best.score>0)moves.push({u,...best});}
  if(moves.length){moves.sort((a,b)=>b.score-a.score||a.u.id.localeCompare(b.u.id));const {u,route}=moves[0];return {kind:'move',unitId:u.id,q:route.q,r:route.r};}return {kind:'end'};
 }
 const difficulties=Object.freeze([
  {id:'easy',name:'简单',description:'AI 生命与伤害 85%，护甲 90%；前 8 回合不主动夺取总部。'},
  {id:'standard',name:'标准',description:'基准属性，优先夺点、修复、攻击与扩军。'},
  {id:'hard',name:'困难',description:'基准属性；威胁地图、集火、安全走位与反制生产。'},
  {id:'hell',name:'地狱',description:'增强决策；AI 生命与伤害 120%，护甲 110%，初始资源与收入 150%。'}
 ].map(d=>Object.freeze({...d,...G.difficultyProfiles[d.id]})));
 const tacticalCaches=new WeakMap();
 function canHit(s,a,target){
  const d=D.byId[a.type],state=D.byId[target.type]?H.domain(target,G.cell(s,target)):target.type==='energyplatform'?'sea':'land',range=H.distance(a,target);
  return (state!=='air'||d.antiAir)&&range>=d.minRange&&range<=d.maxRange&&(d.indirect||d.branch==='air'||state==='air'||H.los(s.cells,a,target));
 }
 // Threats use only observed enemies. They assume one move then one shot next
 // turn; stationary artillery contributes only its current firing positions.
 function threatMap(s,u,enemies){
  enemies=enemies.filter(e=>G.visible(s,s.actor,e));
  const observedUnits=s.units.filter(e=>G.visible(s,s.actor,e));
  let cache=tacticalCaches.get(s);
  const signature=s.actor+':'+s.revision+':'+G.difficulty(s)+':'+enemies.map(e=>`${e.id},${e.q},${e.r},${e.hp}`).join(';');
  if(!cache||cache.signature!==signature){cache={signature,maps:new Map()};tacticalCaches.set(s,cache);}
  const type=u.type+':'+!!u.status.anchor+':'+!!u.status.entrench;
  if(cache.maps.has(type))return cache.maps.get(type);
  const map=new Map(),grid=new Map(s.cells.map(c=>[H.key(c.q,c.r),c]));
  for(const enemy of enemies){
   const d=D.byId[enemy.type],positions=d.fireAfterMove?[...H.routes(s.cells,enemy,enemy.type,c=>observedUnits.some(o=>o.id!==enemy.id&&o.q===c.q&&o.r===c.r),d.move+1).values()]:[enemy];
   const threatened=new Map();
   for(const position of positions){
    const source={...enemy,q:position.q,r:position.r};
    for(let dq=-d.maxRange;dq<=d.maxRange;dq++)for(let dr=-d.maxRange;dr<=d.maxRange;dr++){
     const c=grid.get(H.key(source.q+dq,source.r+dr));if(!c)continue;
     const target={...u,q:c.q,r:c.r};if(!canHit(s,source,target))continue;
     const k=H.key(c.q,c.r),weight=position.q===enemy.q&&position.r===enemy.r?1:.65;
     const amount=G.standardDamage(s,source,target)*weight;
     if(amount>(threatened.get(k)||0))threatened.set(k,amount);
    }
   }
   for(const [key,amount] of threatened){const old=map.get(key)||{damage:0,enemies:0};map.set(key,{damage:old.damage+amount,enemies:old.enemies+1});}
  }
  cache.maps.set(type,map);return map;
 }
 function candidate(command,phase,reason,score,extra={}){return {command,phase,reason,score,...extra};}
 function advanced(s){
  const view=observation(s),p=view.player,id=p.id,hell=G.difficulty(s)==='hell',enemies=view.units.filter(u=>!G.allied(s,id,u.owner)),own=view.units.filter(u=>u.owner===id&&u.ap>0);
  const os={...s,units:view.units,buildings:view.buildings},assets=G.ownBuildings(s),choices=[];
  const risk=(u,c)=>threatMap(os,u,enemies).get(H.key(c.q,c.r))?.damage||0;
  const winning=b=>s.players.some(x=>x.originalHqId===b.id)&&s.settings.victoryMode==='capture_hq';
  const assetValue=b=>winning(b)?1200:b.type==='city'?110:['energyfield','energyplatform'].includes(b.type)?(p.resources.energy<25?150:90):D.buildingById[b.type].group==='production'?100:70;
  for(const plan of s.enemyPlan.filter(x=>x.state==='pending')){const b=G.building(s,`${s.mission?.id}-${plan.facility}`);if(!b||b.owner!=='red'||b.hp<=0)plan.state='cancelled';}
  // Deployment is immediate and does not consume an on-map unit action.
  for(const b of assets)for(const stock of b.stock){
   const spots=[b,...H.neighbors(b)].map(c=>G.cell(s,c)).filter(c=>!G.deployReason(os,b,stock,c));
   const hypothetical=G.normalizeUnit({id:'forecast',type:stock.type,owner:id,q:b.q,r:b.r},s);
   spots.sort((a,b)=>{const rank=c=>risk(hypothetical,c)*.3+(enemies.length?Math.min(...enemies.map(e=>H.distance(c,e)))*2:0);return rank(a)-rank(b)||H.sort(a,b);});
   if(spots.length)return candidate({kind:'deploy',buildingId:b.id,stockId:stock.id,q:spots[0].q,r:spots[0].r},'deployment','将库存部署到较安全的设施邻格',1000);
  }
  for(const u of own){
   for(const b of view.buildings){const real=G.building(s,b.id);if(real&&G.visible(s,id,real)&&!G.captureReason(os,u,real))choices.push(candidate({kind:'capture',unitId:u.id,buildingId:b.id},'capture',`接管${D.buildingById[b.type].name}，切断对方收入或生产`,winning(b)?10000:300+assetValue(b)-risk(u,u)*.15));}
   if(u.type==='engineer')for(const target of [...G.ownUnits(s),...assets])if(!G.skillReason(os,u,target)){const missing=target.maxHp-target.hp;choices.push(candidate({kind:'skill',unitId:u.id,targetId:target.id},'repair','优先修复受损部队，保留前线作战能力',Math.min(40,missing)*2+(target.hp<target.maxHp*.4?80:0)+(D.byId[target.type]?.cost||0)/10));}
   const targets=[...enemies,...view.buildings.filter(b=>b.owner&&!G.allied(s,id,b.owner)&&G.visible(s,id,b))];
   for(const target of targets){
    const skill=D.byId[u.type].skill,offensive=['穿甲弹','震荡弹','定点狙击'].includes(skill)&&!G.skillReason(os,u,target),skillKey=offensive?{'穿甲弹':'pierce','震荡弹':'shock','定点狙击':'sniper'}[skill]:'';
    const preview=G.attackPreview(os,u,target,skillKey);if(preview.reason)continue;
    const targetModel=D.byId[target.type],kill=preview.targetHp===0,contributors=own.filter(a=>a.id!==u.id&&canHit(os,a,target)).length;
    const score=preview.damage*(targetModel?1.2:.35)-preview.counter*(hell?1.6:1.35)+(kill&&targetModel?140:0)+(targetModel?(1-target.hp/target.maxHp)*45+Math.min(4,contributors)*(hell?14:8)+(targetModel.indirect?25:0)+(target.type==='engineer'?30:0):0)-(preview.attackerHp===0?D.byId[u.type].cost+160:0);
    if(score>0)choices.push(candidate({kind:offensive?'skill':'attack',unitId:u.id,targetId:target.id},'attack',kill?'集中火力击毁可见目标，减少敌方行动':'比较伤害与反击代价，集中火力压低目标生命',score,{preview}));
   }
   if(u.type==='jammer')for(const target of enemies)if(!G.skillReason(os,u,target))choices.push(candidate({kind:'skill',unitId:u.id,targetId:target.id},'electronic','干扰可见高火力单位，削减其下回合行动',50+G.unitStats(s,target).damage*.7));
  }
  choices.sort((a,b)=>b.score-a.score||JSON.stringify(a.command).localeCompare(JSON.stringify(b.command)));
  if(choices.length)return {...choices[0],alternatives:choices.slice(0,3)};

  const committed=[...G.ownUnits(s),...assets.flatMap(b=>[...b.stock,...(b.order?.kind==='unit'?[b.order]:[])])],hasEngineer=committed.some(u=>u.type==='engineer'),unbusy=assets.filter(b=>!G.facilityReason(s,b)&&!b.order);
  const observedAir=enemies.filter(e=>H.domain(e,G.cell(s,e))==='air').length,observedArmor=enemies.filter(e=>D.byId[e.type].category==='armored').length,aa=committed.filter(u=>D.byId[u.type].antiAir).length;
  const needEnergy=committed.reduce((n,u)=>n+D.byId[u.type].energyPerStep*D.byId[u.type].move*.25,0),gain=G.income(s,id),lowEnergy=p.resources.energy+gain.energy<needEnergy;
  const placement=(type)=>s.cells.filter(c=>!s.settings.fog||s.vision[id].air.includes(H.key(c.q,c.r))).filter(c=>!G.constructReason(os,type,c)).sort((a,b)=>{const hazard=c=>enemies.length?Math.min(...enemies.map(e=>H.distance(c,e))):10;return hazard(b)-hazard(a)||H.sort(a,b);})[0];
  if(!s.mission&&lowEnergy){
   const upgrade=unbusy.filter(b=>['energyfield','energyplatform'].includes(b.type)&&!G.upgradeReason(s,b)).sort((a,b)=>a.id.localeCompare(b.id))[0];
   if(upgrade)return candidate({kind:'upgrade',buildingId:upgrade.id},'economy','升级能源收入，保障下回合机动',90);
   for(const type of ['energyfield','energyplatform']){const c=placement(type);if(c)return candidate({kind:'construct',type,q:c.q,r:c.r},'economy','补充能源设施，避免部队因缺能停滞',90);}
  }
  if(s.mission&&id==='red'){
   const plan=s.enemyPlan.filter(o=>o.state==='pending'&&p.ownTurnIndex>=o.earliestOwnTurn).find(o=>!G.productionReason(s,G.building(s,`${s.mission.id}-${o.facility}`),o.unit));
   if(plan)return candidate({kind:'produce',buildingId:`${s.mission.id}-${plan.facility}`,type:plan.unit,planId:plan.id},'economy','执行本关有限生产计划，补充授权兵种',80);
  }else{
   const production=[];
   for(const b of unbusy.filter(b=>D.buildingById[b.type].group==='production'))for(const model of D.units.filter(d=>!G.productionReason(s,b,d.id))){
    const branchCount=committed.filter(u=>D.byId[u.type].branch===model.branch).length;
    if(branchCount>=(model.branch==='army'?14:6)&&!(model.id==='engineer'&&!hasEngineer))continue;
    const wounded=G.ownUnits(s).filter(u=>u.hp<u.maxHp*.7).length;
    const score=model.damage*.5+model.hp*.12+model.move*3+model.maxRange*(hell?9:6)-model.cost*.16+(observedAir&&model.antiAir?Math.max(20,100+observedAir*15-aa*30):0)+(observedArmor?Math.max(0,model.bonusArmor)*.6:0)+(model.id==='engineer'&&!hasEngineer?45+wounded*30:0)+(model.infantry&&(lowEnergy||G.count(s)<10)?55:0)-(lowEnergy?model.energyPerStep*20:0);
    production.push(candidate({kind:'produce',buildingId:b.id,type:model.id},'economy',observedAir&&model.antiAir?'针对已观察到的空军补充防空':'根据已观察敌军、部队组成与能源选择生产型号',score));
   }
   production.sort((a,b)=>b.score-a.score||JSON.stringify(a.command).localeCompare(JSON.stringify(b.command)));
   if(production.length)return {...production[0],alternatives:production.slice(0,3)};
   if(G.count(s)>=8&&p.resources.money>250){const upgrade=unbusy.filter(b=>D.buildingById[b.type].group==='production'&&!G.upgradeReason(s,b)).sort((a,b)=>a.level-b.level||a.id.localeCompare(b.id))[0];if(upgrade)return candidate({kind:'upgrade',buildingId:upgrade.id},'economy','扩军达到规模后提升生产等级',70);}
   if(!s.mission&&p.resources.money>350){const missing=['barracks','factory','airfield','port'].find(type=>!assets.some(b=>b.type===type&&b.hp>0));const type=missing||(gain.money<180?'market':null);if(type){const c=placement(type);if(c)return candidate({kind:'construct',type,q:c.q,r:c.r},'economy','扩充可持续收入与缺少的生产体系',65);}}
  }
  const moves=[],hq=G.building(s,p.originalHqId),urgent=enemies.filter(e=>hq&&H.distance(e,hq)<=3);
  for(const u of own){
   if(u.id===p.hqGuardId&&hq&&u.q===hq.q&&u.r===hq.r)continue;
   const goals=[...view.buildings.filter(b=>!G.allied(s,id,b.owner)),...enemies];if(!goals.length)continue;
   const importance=g=>D.byId[g.type]?(urgent.some(e=>e.id===g.id)?600:130):assetValue(g);
   const ranked=[...goals].sort((a,b)=>importance(b)/(H.distance(u,b)+2)-importance(a)/(H.distance(u,a)+2)||a.id.localeCompare(b.id));
   const field=objectiveField(os,u,ranked.slice(0,hell?4:3)),old=field.get(H.key(u.q,u.r))??Infinity,oldRisk=risk(u,u);
   for(const route of G.movement(os,u).values()){
    if(!route.path.length)continue;const now=field.get(H.key(route.q,route.r))??Infinity;if(!Number.isFinite(now))continue;
    const danger=risk(u,route),cover=D.terrain[G.cell(s,route).terrain].defense||0;
    const improvement=Number.isFinite(old)?old-now:10;
    let score=improvement*20-now-route.energy*.08-danger*(hell?.38:.25)+(now===0?20:0)+cover*.3;
    const retreat=u.hp<u.maxHp*.4&&oldRisk>u.hp*.7&&oldRisk-danger>10;
    if(retreat)score+=(oldRisk-danger)*(hell?1.3:1)+50;
    if(score>0)moves.push(candidate({kind:'move',unitId:u.id,q:route.q,r:route.r},retreat?'retreat':'advance',retreat?'将重伤单位移出可见敌军的火力覆盖':'沿可达路线接近目标，并比较敌军威胁与地形掩护',score,{risk:danger}));
   }
  }
  moves.sort((a,b)=>b.score-a.score||JSON.stringify(a.command).localeCompare(JSON.stringify(b.command)));
  if(moves.length)return {...moves[0],alternatives:moves.slice(0,3),observedEnemies:enemies.length};
  const scan=own.find(u=>D.byId[u.type].skill==='主动扫描'&&!G.skillReason(s,u));
  if(scan&&enemies.length===0)return candidate({kind:'skill',unitId:scan.id},'recon','扩大观察范围，寻找尚未确认的目标',30);
  return candidate({kind:'end'},'hold','本回合可见范围内没有值得执行的剩余行动',0);
 }
 const phaseLabels={deployment:'部署库存',capture:'夺取目标',repair:'前线修复',attack:'火力评估',electronic:'电子干扰',recon:'主动侦察',economy:'后方调度',advance:'路线规划',retreat:'保存兵力',hold:'结束回合',dispatch:'部队调度'};
 function describe(s,command){
  if(!command)return null;
  const skill=D.byId[G.unit(s,command.unitId)?.type]?.skill;
  const phase=({deploy:'deployment',capture:'capture',attack:'attack',produce:'economy',upgrade:'economy',construct:'economy',move:'advance',end:'hold'})[command.kind]||(command.kind==='skill'?(skill==='应急修复'?'repair':skill==='链路干扰'?'electronic':['穿甲弹','震荡弹','定点狙击'].includes(skill)?'attack':'recon'):'dispatch');
  return candidate(command,phase,({deployment:'部署已完成生产的库存',capture:'接管当前可见的空置建筑',attack:'选择可见范围内收益较高的攻击',economy:'根据当前可用设施组织后方生产',advance:'沿可达路线接近已知目标',repair:'修复当前受损友军',recon:'执行可用单位技能',hold:'结束当前行动阶段'})[phase]||'调整当前部队部署',0);
 }
 function forViewer(s,result,viewerId){
  if(viewerId===s.actor)return result;
  const cmd=result.command;
  if(!cmd)return {...result,scores:[],threat:null};
  const actor=G.unit(s,cmd.unitId)||G.building(s,cmd.buildingId),target=G.unit(s,cmd.targetId)||G.building(s,cmd.targetId),destination=Number.isFinite(cmd.q)?G.cell(s,cmd):null;
  const visible=!!G.player(s,viewerId)&&(!actor||G.visible(s,viewerId,actor))&&(!target||G.visible(s,viewerId,target))&&(!destination||G.visible(s,viewerId,destination));
  const phase=visible?result.phase:'dispatch';
  const reasons={deployment:'正在部署可见设施附近的部队',capture:'正在接管可见建筑',repair:'正在修复可见目标',attack:'正在评估可见目标的攻击与反击',electronic:'正在干扰可见目标',recon:'正在使用可见侦察部队的技能',economy:'正在调度可见设施',advance:'正在规划可见部队的移动路线',retreat:'正在重新部署可见部队',hold:'正在结束当前回合'};
  return {command:visible&&['move','attack','capture','skill','end'].includes(cmd.kind)?cmd:null,phase,phaseLabel:phaseLabels[phase],reason:visible?(reasons[phase]||'正在调度可见部队'):'正在调度部队；行动细节将在进入当前视野后显示',difficulty:result.difficulty,scores:[],threat:null};
 }
 function decision(s,viewerId=s.actor){
  if(s.result||s.story?.combatLocked||s.story?.queue.length||G.player(s)?.controller!=='ai')return {command:null,phase:'hold',phaseLabel:'等待',reason:'AI 当前无法行动',scores:[],threat:null,difficulty:G.difficulty(s)};
  // Legacy choose() cancels obsolete plans. The decision preview itself never
  // writes game state: both planners receive private copies of plan records.
  const planning={...s,enemyPlan:s.enemyPlan.map(plan=>({...plan}))};
  const level=G.difficulty(s),result=['hard','hell'].includes(level)?advanced(planning):describe(planning,baseline(planning));
  if(!result)return {command:null,phase:'hold',phaseLabel:'等待',reason:'AI 当前无法行动',scores:[],threat:null,difficulty:level};
  const raw={command:result.command,phase:result.phase,phaseLabel:phaseLabels[result.phase],reason:result.reason,difficulty:level,
   scores:(result.alternatives||[result]).map(x=>({command:x.command,score:Math.round(x.score*100)/100})),
   threat:{observedEnemies:observation(s).units.filter(e=>!G.allied(s,s.actor,e.owner)).length,selectedRisk:Math.round(result.risk||0)}};
  return forViewer(s,raw,viewerId);
 }
 function choose(s){for(const plan of s.enemyPlan.filter(x=>x.state==='pending')){const b=G.building(s,`${s.mission?.id}-${plan.facility}`);if(!b||b.owner!=='red'||b.hp<=0)plan.state='cancelled';}return decision(s).command;}
 function step(s){const command=choose(s);if(!command)return {ok:false,error:'AI 当前无法行动'};const result=G.execute(s,command);return {...result,command};}
 const api={difficulties,observation,objectiveField,threatMap,decision,forViewer,choose,step};root.GameAI=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
