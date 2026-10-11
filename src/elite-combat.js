(function(root){'use strict';
  const D=root.GameData||(typeof require!=='undefined'&&require('./data'));
  const H=root.Hex||(typeof require!=='undefined'&&require('./grid'));
  const Content=root.GameEliteData||(typeof require!=='undefined'&&require('./elite-data'));
  const copy=value=>JSON.parse(JSON.stringify(value));
  let game=null;const G=()=>game||root.Game;
  const hero=id=>Content.heroes.find(h=>h.id===id);
  const auraMembership=new WeakMap();
  const casterLists=new WeakMap(),neutralModels=new WeakMap();
  function casters(s){let cached=casterLists.get(s.units);if(!cached||cached.length!==s.units.length){cached={length:s.units.length,list:s.units.filter(u=>u.elite)};casterLists.set(s.units,cached);}return cached.list;}
  const clock=(s,owner)=>s.players.find(p=>p.id===owner)?.ownTurnIndex||0;
  const active=(s,e)=>!!e&&!!s.players.find(p=>p.id===e.owner&&!p.eliminated)&&clock(s,e.owner)<e.expiresOwnTurn;
  const stable=(origin,list)=>[...list].sort((a,b)=>H.distance(origin,a)-H.distance(origin,b)||a.q-b.q||a.r-b.r||a.id.localeCompare(b.id));
  function freeze(characterId,archiveLevel=1,chapterCap=10){
    const h=hero(characterId);if(!h)throw Error('精英角色不存在');
    if(!Number.isInteger(archiveLevel)||archiveLevel<1||archiveLevel>10||!Number.isInteger(chapterCap)||chapterCap<1||chapterCap>10)throw Error('精英等级或章节上限不合法');
    const effectiveLevel=Math.min(archiveLevel,chapterCap),stats=h.statsByLevel.find(row=>row.level===effectiveLevel);
    return {configVersion:Content.contentVersion,characterId,inheritUnitId:h.inheritUnitId,name:h.name,callsign:h.callsign,archiveLevel,effectiveLevel,
      stats:{hp:stats.hp,armor:stats.armor,damage:stats.damage},fixedStats:copy(h.fixedStats),
      skills:h.skills.map(sk=>({id:sk.id,name:sk.name,type:sk.type,unlockLevel:sk.unlockLevel,energyCost:sk.energyCost,cooldownOwnTurns:sk.cooldownOwnTurns,effect:sk.effect,unlocked:effectiveLevel>=sk.unlockLevel,parameters:effectiveLevel>=sk.unlockLevel?copy(sk.parametersByEffectiveLevel[String(effectiveLevel)]):null})),
      charge:0,ultimateUsed:false,activeReadyOwnTurn:0,normalAttackChargedOwnTurn:0,starts:0};
  }
  function validateSnapshot(s,u){
    if(!u.characterId&&!u.elite)return null;if(!u.characterId||!u.elite||u.elite.characterId!==u.characterId)return '精英身份与快照不匹配';
    let expected;try{expected=freeze(u.characterId,u.elite.archiveLevel,u.elite.effectiveLevel);}catch(err){return err.message;}
    for(const key of ['configVersion','characterId','inheritUnitId','name','callsign','archiveLevel','effectiveLevel','stats','fixedStats','skills'])if(JSON.stringify(u.elite[key])!==JSON.stringify(expected[key]))return `精英冻结字段不匹配：${key}`;
    for(const key of ['charge','activeReadyOwnTurn','normalAttackChargedOwnTurn','starts'])if(!Number.isSafeInteger(u.elite[key])||u.elite[key]<0)return `精英状态时钟不合法：${key}`;
    if(u.elite.charge>100||typeof u.elite.ultimateUsed!=='boolean')return '精英充能或大招次数不合法';
    const h=hero(u.characterId);if(D.byId[u.type]?.system!==h.system)return '精英与原始单位体系不匹配';
    if(s?.mission?.eliteLevelCap&&u.elite.effectiveLevel!==Math.min(u.elite.archiveLevel,s.mission.eliteLevelCap))return '精英本关有效等级不匹配';
    return null;
  }
  function skill(u,slot){return u?.elite?.skills.find(sk=>sk.type===slot)||null;}
  function observations(s){return (s.eliteObservations||[]).filter(e=>active(s,e)&&(!e.removeWithCaster||s.units.some(u=>u.id===e.casterId&&u.hp>0&&u.owner===e.owner)));}
  function resolve(s,u){
    const base=D.unitModel(u);if(!base||!s?.players||!s.cells)return base;
    const sources=casters(s);if(!sources.length&&!u.status?.eliteEffects?.length){let plain=neutralModels.get(base);if(!plain){plain={...base,fireBonus:0,energyDiscount:0,eliteEffects:[]};neutralModels.set(base,plain);}return plain;}
    const effects=new Map(),domain=H.domain(u,G().cell(s,u));
    const add=(id,p)=>{const old=effects.get(id)||{};for(const [name,value] of Object.entries(p))if(typeof value==='number')old[name]=Math.max(old[name]||0,value);effects.set(id,old);};
    for(const realCaster of sources){const caster=realCaster.id===u.id?u:realCaster;if(!caster.elite||caster.hp<=0||!G().allied(s,u.owner,caster.owner))continue;const aura=skill(caster,'aura');if(!aura?.unlocked||H.distance(caster,u)>aura.parameters.radius)continue;const p=aura.parameters;
      switch(aura.effect){
        case 'ground_units_fire_and_vision':if(domain==='land')add(aura.id,{fireBonus:p.fireBonus,visionBonus:p.visionBonus});break;
        case 'ground_armored_armor_and_energy':if(domain==='land'&&base.category==='armored')add(aura.id,{armorBonus:p.armorBonus,energyDiscount:p.energyDiscount});break;
        case 'land_sea_fire_support':if(domain!=='air')add(aura.id,{fireBonus:p.fireBonus,visionBonus:base.indirect?p.indirectVisionBonus:0});break;
        case 'land_sea_armor_and_fire':if(domain!=='air')add(aura.id,{fireBonus:p.fireBonus,armorBonus:p.armorBonus});break;
        case 'air_fire_and_armor':if(domain==='air')add(aura.id,{fireBonus:p.fireBonus,armorBonus:p.armorBonus});break;
      }
    }
    for(const e of u.status?.eliteEffects||[])if(active(s,e))add(e.skillId,e);
    const sum=name=>[...effects.values()].reduce((n,p)=>n+(p[name]||0),0);
    return {...base,armor:Math.max(0,base.armor+sum('armorBonus')-sum('armorDebuff')),fireBonus:sum('fireBonus'),vision:base.vision+sum('visionBonus'),move:base.move+sum('moveBonus'),energyDiscount:Math.max(0,...[...effects.values()].map(p=>p.energyDiscount||0)),eliteEffects:[...effects.keys()]};
  }
  function energy(s,u,c){return H.energy({...resolve(s,{...u,q:c.q,r:c.r}),type:undefined},c);}
  function beaconFire(s,u,target){if(H.domain(u,G().cell(s,u))==='air'||!D.byId[target?.type]||!G().visible(s,u.owner,target))return 0;const same=new Map();
    for(const e of observations(s))if(e.fireBonus&&G().allied(s,u.owner,e.owner)&&H.distance(e,target)<=e.visionRadius&&(H.domain(target,G().cell(s,target))==='air'||H.los(s.cells,e,target)))same.set(e.skillId,Math.max(same.get(e.skillId)||0,e.fireBonus));
    return [...same.values()].reduce((n,x)=>n+x,0);
  }
  function cleanup(s){
    for(const u of s.units){if(u.status?.eliteEffects){u.status.eliteEffects=u.status.eliteEffects.filter(e=>active(s,e));if(!u.status.eliteEffects.length)delete u.status.eliteEffects;}if(u.status?.eliteShield&&!active(s,u.status.eliteShield))delete u.status.eliteShield;}
    if(s.eliteObservations){s.eliteObservations=observations(s);if(!s.eliteObservations.length)delete s.eliteObservations;}
  }
  function syncAuras(s){
    const previous=auraMembership.get(s)||new Map(),current=new Map();
    for(const caster of s.units){const aura=skill(caster,'aura');if(caster.hp<=0||!aura?.unlocked)continue;const entered=[];
      for(const target of s.units){if(target.hp<=0||!G().allied(s,caster.owner,target.owner)||H.distance(caster,target)>aura.parameters.radius)continue;const model=D.unitModel(target),domain=H.domain(target,G().cell(s,target));
        const eligible=aura.effect==='ground_units_fire_and_vision'?domain==='land':aura.effect==='ground_armored_armor_and_energy'?domain==='land'&&model.category==='armored':aura.effect==='air_fire_and_armor'?domain==='air':domain!=='air';
        if(!eligible)continue;const key=`${caster.id}:${aura.id}:${target.id}`;current.set(key,{casterId:caster.id,characterId:caster.characterId,skillId:aura.id,owner:caster.owner,name:aura.name,caster:{id:caster.id,q:caster.q,r:caster.r,owner:caster.owner},target:{id:target.id,q:target.q,r:target.r,owner:target.owner}});if(!previous.has(key))entered.push({targetId:target.id,q:target.q,r:target.r});
      }
      if(entered.length)G().emit(s,'eliteAura',`${caster.elite.name} · ${aura.name}`,[caster,...entered.map(e=>G().unit(s,e.targetId))],{casterId:caster.id,owner:caster.owner,characterId:caster.characterId,skillId:aura.id,eventId:`elite.${aura.id}`,slot:'aura',phase:'enter',recipientIds:entered.map(e=>e.targetId),beneficiaries:entered,parameters:copy(aura.parameters)});
    }
    const left=new Map();for(const [key,record] of previous)if(!current.has(key)){const id=`${record.casterId}:${record.skillId}`;if(!left.has(id))left.set(id,{...record,targets:[]});left.get(id).targets.push(G().unit(s,record.target.id)||record.target);}
    for(const group of left.values())G().emit(s,'eliteAura',`${group.name} 范围解除`,[G().unit(s,group.casterId)||group.caster,...group.targets],{casterId:group.casterId,owner:group.owner,characterId:group.characterId,skillId:group.skillId,eventId:`elite.${group.skillId}`,slot:'aura',phase:'exit',recipientIds:group.targets.map(t=>t.id),beneficiaries:group.targets.map(t=>({targetId:t.id,q:t.q,r:t.r}))});
    auraMembership.set(s,current);
  }
  function ownStart(s,owner){cleanup(s);for(const u of s.units)if(u.owner===owner&&u.elite){if(u.elite.starts>0)u.elite.charge=Math.min(100,u.elite.charge+Content.combat.laterOwnStartCharge);u.elite.starts++;}}
  function normalAttack(s,u){if(u?.elite&&u.elite.normalAttackChargedOwnTurn!==clock(s,u.owner)){u.elite.charge=Math.min(100,u.elite.charge+Content.combat.normalAttackChargePerOwnTurn);u.elite.normalAttackChargedOwnTurn=clock(s,u.owner);}}
  const shieldAmount=(s,u)=>active(s,u.status?.eliteShield)?u.status.eliteShield.amount:0;
  function consumeShield(s,u,amount){if(!amount)return;const e=u.status?.eliteShield;if(active(s,e)){e.amount=Math.max(0,e.amount-amount);if(!e.amount)delete u.status.eliteShield;}}
  function stateMeta(s,caster,skillId){const castOwnTurn=clock(s,caster.owner);return {skillId,owner:caster.owner,casterId:caster.id,castOwnTurn,expiresOwnTurn:castOwnTurn+2};}
  function grantShield(s,caster,target,skillId,amount){if(!amount)return;const meta=stateMeta(s,caster,skillId),old=target.status.eliteShield;
    if(!active(s,old)||amount>old.amount)target.status.eliteShield={...meta,amount};
    else if(amount===old.amount){const oldRemaining=old.expiresOwnTurn-clock(s,old.owner);if(meta.expiresOwnTurn-clock(s,meta.owner)>oldRemaining)target.status.eliteShield={...meta,amount};}
  }
  function grantEffect(s,caster,target,skillId,values){if(!Object.values(values).some(Boolean))return;const effect={...stateMeta(s,caster,skillId),...values};target.status.eliteEffects=(target.status.eliteEffects||[]).filter(e=>e.skillId!==skillId);target.status.eliteEffects.push(effect);}
  function baseReason(s,u,slot){const err=G().canAct(s,u);if(err)return err;if(!u.characterId||!u.elite)return '该单位不是精英角色';const sk=skill(u,slot);if(!sk||!['active','ultimate'].includes(slot))return '技能类型不合法';if(!sk.unlocked)return `本关有效等级需要 Lv${sk.unlockLevel}`;
    if(slot==='active'&&clock(s,u.owner)<u.elite.activeReadyOwnTurn)return `技能冷却至第 ${u.elite.activeReadyOwnTurn} 己方回合`;
    if(slot==='ultimate'&&(u.elite.ultimateUsed||u.elite.charge<100))return u.elite.ultimateUsed?'本关大招已经使用':'大招需要 100 充能';
    if(G().player(s,u.owner).resources.energy<sk.energyCost)return '技能能源不足';return null;
  }
  function targetMode(u,slot){const sk=skill(u,slot);if(!sk)return 'none';if(sk.effect==='beacon_observation_and_fire_support')return 'cell';if(sk.effect==='air_shield_armor_energy')return 'ally';return ['direct_attack_bonus_and_pierce','direct_area_attack_and_self_shield','indirect_area_attack','indirect_bombardment','air_superiority_attack_and_shield'].includes(sk.effect)?'enemy':'area';}
  const directStructureSkill=sk=>sk.effect==='direct_attack_bonus_and_pierce';
  function legalEnemies(s,u,sk){
    const candidates=directStructureSkill(sk)?[...s.units,...s.buildings.filter(t=>G().hasBuildingHealth(t)&&t.hp>0)]:s.units;
    // A guarded structure is one unit hit, never a duplicate structure target.
    const legal=candidates.map(t=>directStructureSkill(sk)?G().combatTarget(s,u,t):t).filter(t=>!G().attackReason(s,u,t)&&(sk.effect!=='air_superiority_attack_and_shield'||H.domain(t,G().cell(s,t))==='air'));
    return [...new Map(legal.map(t=>[t.id,t])).values()];
  }
  function legalAllies(s,u,sk,radius){return stable(u,s.units.filter(t=>t.hp>0&&G().allied(s,u.owner,t.owner)&&G().visible(s,u.owner,t)&&H.distance(u,t)<=radius&&(sk.effect.startsWith('air_')?H.domain(t,G().cell(s,t))==='air':sk.effect==='ground_allies_shield_and_movement'?H.domain(t,G().cell(s,t))==='land':H.domain(t,G().cell(s,t))!=='air')));}
  function select(candidates,max,ids,requiredId=null){
    if(ids===undefined)return {targets:candidates.slice(0,max)};
    if(!Array.isArray(ids)||!ids.length||ids.length>max||ids.some(id=>typeof id!=='string')||new Set(ids).size!==ids.length||requiredId&&!ids.includes(requiredId))return {reason:'目标清单重复、超过上限或遗漏主目标'};
    const targets=candidates.filter(t=>ids.includes(t.id));return targets.length===ids.length?{targets}:{reason:'目标清单包含非法或未观测单位'};
  }
  function plan(s,u,slot,options={}){
    const error=baseReason(s,u,slot);if(error)return {reason:error};const sk=skill(u,slot),p=sk.parameters,mode=targetMode(u,slot),result={skillId:sk.id,eventId:`elite.${sk.id}`,name:sk.name,slot,parameters:copy(p),targetMode:mode,energyCost:sk.energyCost,targets:[],beneficiaries:[]};
    if(mode==='cell'){const c=G().cell(s,options);if(!c||H.domain({type:'infantry'},c)!=='land'||!Number.isFinite(H.cost('infantry',c))||H.distance(u,c)>p.targetRange||!G().visible(s,u.owner,c)||!H.los(s.cells,u,c))return {reason:'信标需要范围内可见、有射线的合法陆地格'};result.observation={...stateMeta(s,u,sk.id),q:c.q,r:c.r,visionRadius:p.visionRadius,fireBonus:p.fireBonus,removeWithCaster:true};return result;}
    if(mode==='enemy'){
      const available=legalEnemies(s,u,sk),requested=options.targetId===undefined?null:G().unit(s,options.targetId)||G().building(s,options.targetId);
      if(directStructureSkill(sk)&&requested&&!D.byId[requested.type]){if(!G().hasBuildingHealth(requested))return {reason:'收入据点只能占领，不能攻击'};if(requested.hp<=0)return {reason:'目标已经失去作战能力'};}
      const canonical=directStructureSkill(sk)&&requested?G().combatTarget(s,u,requested):requested,primary=available.find(t=>t.id===(canonical?.id||options.targetId))||(options.targetId===undefined?available.find(t=>t.q===options.q&&t.r===options.r):null);
      if(!primary)return {reason:directStructureSkill(sk)?'请选择合法、可见且在射程内的敌方单位或结构':'请选择合法、可见且在射程内的敌方单位'};
      const radius=p.targetRadius??1,candidates=[primary,...stable(primary,available.filter(t=>t.id!==primary.id&&H.distance(primary,t)<=radius))];
      const ids=directStructureSkill(sk)&&Array.isArray(options.targetIds)?options.targetIds.map(id=>{const t=G().unit(s,id)||G().building(s,id);return t&&G().hasBuildingHealth(t)&&t.hp>0?G().combatTarget(s,u,t).id:id;}):options.targetIds;
      const picked=select(candidates,p.maxTargets||1,ids,primary.id);if(picked.reason)return picked;
      result.targets=picked.targets;result.primaryId=primary.id;result.candidates=candidates.map(t=>t.id);
      if(sk.effect==='air_superiority_attack_and_shield'){
        const allies=legalAllies(s,u,sk,p.allyRadius),beneficiaries=select(allies,p.maxRecipients,options.beneficiaryIds);if(beneficiaries.reason)return beneficiaries;result.beneficiaries=beneficiaries.targets;
      }
      return result;
    }
    const allies=legalAllies(s,u,sk,p.radius),ids=options.targetIds||(options.targetId?[options.targetId]:undefined);
    if(mode==='ally'&&ids===undefined)return {reason:'请选择范围内可见的友方航空单位'};
    const beneficiaries=select(allies,p.maxRecipients,ids);if(beneficiaries.reason)return beneficiaries;if(!beneficiaries.targets.length)return {reason:'范围内没有合法受益单位'};result.beneficiaries=beneficiaries.targets;
    if(sk.effect==='ground_allies_shield_and_movement')result.observation={...stateMeta(s,u,sk.id),q:u.q,r:u.r,visionRadius:p.observationRadius,removeWithCaster:false};return result;
  }
  function reason(s,u,slot,options){return options===undefined?baseReason(s,u,slot):plan(s,u,slot,options).reason||null;}
  function targets(s,u,slot){if(baseReason(s,u,slot))return [];const sk=skill(u,slot),mode=targetMode(u,slot);let list=[];
    if(mode==='cell')list=s.cells.filter(c=>Number.isFinite(H.cost('infantry',c))&&H.distance(u,c)<=sk.parameters.targetRange&&G().visible(s,u.owner,c)&&H.los(s.cells,u,c));
    else if(mode==='enemy')list=stable(u,legalEnemies(s,u,sk));else list=legalAllies(s,u,sk,sk.parameters.radius||sk.parameters.allyRadius);
    return list.map(t=>({id:t.id,q:t.q,r:t.r,owner:t.owner,targetMode:mode}));
  }
  function cast(s,u,slot,options={},previewOnly=false){
    const locked=plan(s,u,slot,options);if(locked.reason)return locked;const sk=skill(u,slot),p=sk.parameters;
    // Compute all outgoing damage from the state before any shield, debuff or death.
    const outgoing=locked.targets.map(t=>{
      const primary=t.id===locked.primaryId;let bonus=0,scale=1;
      if(sk.effect==='direct_attack_bonus_and_pierce')bonus=p.fireBonus;
      if(['direct_area_attack_and_self_shield','indirect_area_attack'].includes(sk.effect)){bonus=primary?p.primaryFireBonus:0;scale=primary?1:p.secondaryRawScale;}
      if(sk.effect==='indirect_bombardment'){bonus=p.fireBonus;scale=p.rawScale;}
      if(sk.effect==='air_superiority_attack_and_shield')scale=p.rawScale;
      return {targetId:t.id,standard:G().standardDamage(s,u,t,{fireBonus:bonus,rawScale:scale,armorIgnore:p.armorIgnore||0})};
    });
    const beneficiaries=[];
    if(p.selfShield){const oldShield=shieldAmount(s,u);grantShield(s,u,u,sk.id,p.selfShield);beneficiaries.push({targetId:u.id,q:u.q,r:u.r,heal:0,shield:shieldAmount(s,u),shieldGranted:Math.max(0,shieldAmount(s,u)-oldShield),moveBonus:0,armorBonus:0,energyDiscount:0});}
    for(const t of locked.beneficiaries){const oldHp=t.hp,oldShield=shieldAmount(s,t);if(p.heal)t.hp=Math.min(t.maxHp,t.hp+p.heal);grantShield(s,u,t,sk.id,p.shield);grantEffect(s,u,t,sk.id,{moveBonus:p.moveBonus||0,armorBonus:p.armorBonus||0,energyDiscount:p.energyDiscount||0});beneficiaries.push({targetId:t.id,q:t.q,r:t.r,heal:t.hp-oldHp,shield:shieldAmount(s,t),shieldGranted:Math.max(0,shieldAmount(s,t)-oldShield),moveBonus:p.moveBonus||0,armorBonus:p.armorBonus||0,energyDiscount:p.energyDiscount||0});}
    if(locked.observation){s.eliteObservations=(s.eliteObservations||[]).filter(e=>e.skillId!==sk.id||e.casterId!==u.id);s.eliteObservations.push(copy(locked.observation));}
    const hits=[];
    for(const shot of outgoing){const t=G().unit(s,shot.targetId)||G().building(s,shot.targetId),hit=G().splitDamage(s,t,shot.standard);G().applyHit(s,t,hit,u);hits.push({targetId:t.id,q:t.q,r:t.r,standard:shot.standard,...hit,lethal:t.hp<=0,targetHp:t.hp});}
    if(p.armorDebuff)for(const shot of outgoing){const t=G().unit(s,shot.targetId);if(t)grantEffect(s,u,t,sk.id,{armorDebuff:p.armorDebuff});}
    const counters=[];
    if(!D.unitModel(u).indirect)for(const t of stable(u,outgoing.map(shot=>G().unit(s,shot.targetId)).filter(Boolean))){if(u.hp<=0)break;const err=G().attackReason(s,t,u,true);if(err)continue;const standard=Math.floor(G().standardDamage(s,t,u)*(D.unitModel(t).dedicatedAA?1.5:.5)),hit=G().splitDamage(s,u,standard);t.counterRemaining--;G().applyHit(s,u,hit,t);if(D.unitModel(t).dedicatedAA)G().player(s,t.owner).exercise.aaCounter=true;counters.push({targetId:t.id,q:t.q,r:t.r,standard,...hit,attackerHp:u.hp});}
    u.ap=0;const now=clock(s,u.owner);if(slot==='active'){u.elite.activeReadyOwnTurn=now+sk.cooldownOwnTurns;u.elite.charge=Math.min(100,u.elite.charge+Content.combat.successfulActiveCharge);}else{u.elite.charge-=100;u.elite.ultimateUsed=true;}G().player(s,u.owner).resources.energy-=sk.energyCost;
    cleanup(s);const result={...locked,targets:locked.targets.map(t=>t.id),hits,beneficiaries,counters,attackerHp:u.hp,attackerShield:shieldAmount(s,u),charge:u.elite.charge,ultimateUsed:u.elite.ultimateUsed,activeReadyOwnTurn:u.elite.activeReadyOwnTurn};
    if(!previewOnly)G().emit(s,'eliteSkill',`${u.elite.name} · ${sk.name}`,[u,...locked.targets,...locked.beneficiaries],{characterId:u.characterId,...result});return result;
  }
  function preview(s,u,slot,options={}){
    const planned=plan(s,u,slot,options);if(planned.reason)return planned;
    const sim={...s,players:copy(s.players),units:copy(s.units),buildings:copy(s.buildings),enemyPlan:copy(s.enemyPlan||[]),events:[],logs:[],eliteObservations:copy(s.eliteObservations||[])};
    return cast(sim,G().unit(sim,u.id),slot,options,true);
  }
  const api={bind:api=>{game=api;},freeze,validateSnapshot,resolve,energy,beaconFire,observations,cleanup,syncAuras,ownStart,normalAttack,shieldAmount,consumeShield,skill,reason,preview,targets,cast,targetMode};
  root.GameEliteCombat=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
