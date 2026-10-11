(function(root){'use strict';
 const E=root.GameEliteData||(typeof require!=='undefined'&&require('./elite-data'));
 const key='six-realms-elite-v1',campaignId=E.campaignId,difficulties=['easy','standard','hard','hell'],clone=x=>x===undefined?undefined:JSON.parse(JSON.stringify(x));
 let memory=null;
 const blank=()=>({version:1,campaignId,revision:0,earnedByClaim:{},spentByHero:Object.fromEntries(E.heroes.map(h=>[h.id,0])),balance:0,heroes:Object.fromEntries(E.heroes.map(h=>[h.id,{unlocked:false,level:1,portraitIds:[],selectedPortraitId:null,trust:0,acquiredAt:{}}])),unlockedChapters:[1],completedOutros:[],seenScenes:[],lastTransaction:null});
 const numberMission=id=>/^S(0[1-9]|[1-3]\d|4[0-2])$/.test(id||'')?Number(id.slice(1)):0;
 const normalizeDifficulty=d=>({training:'easy',challenge:'hard',简单:'easy',标准:'standard',困难:'hard',地狱:'hell'}[d]||d||'standard');
 const claimKey=(missionId,difficulty)=>`${campaignId}:${missionId}:${normalizeDifficulty(difficulty)}`;
 const cumulative=level=>E.training.upgradeCosts.slice(0,level-1).reduce((a,b)=>a+b,0);
 function parseClaim(k,value){const parts=String(k).split(':');if(parts.length!==3||parts[0]!==campaignId||!numberMission(parts[1])||!difficulties.includes(parts[2])||value!==E.training.rewardByDifficulty[parts[2]])throw Error('训练领奖记录非法');return parts;}
 function validate(p){
  if(!p||p.version!==1||p.campaignId!==campaignId||!Number.isInteger(p.revision)||p.revision<0||!p.earnedByClaim||!p.spentByHero||!p.heroes||!Array.isArray(p.unlockedChapters)||!Array.isArray(p.completedOutros)||!Array.isArray(p.seenScenes))throw Error('训练档案格式非法');
  let earned=0,spent=0;for(const [k,v]of Object.entries(p.earnedByClaim)){parseClaim(k,v);earned+=v;}
  if(p.unlockedChapters.some(x=>!Number.isInteger(x)||x<1||x>6)||!p.unlockedChapters.includes(1)||new Set(p.unlockedChapters).size!==p.unlockedChapters.length||p.unlockedChapters.some(x=>x>1&&!p.unlockedChapters.includes(x-1))||p.completedOutros.some(x=>!numberMission(x))||new Set(p.completedOutros).size!==p.completedOutros.length)throw Error('训练章节记录非法');
  for(const h of E.heroes){const r=p.heroes[h.id];if(!r||typeof r.unlocked!=='boolean'||!Number.isInteger(r.level)||r.level<1||r.level>10||r.level>chapterCap(p)||!r.acquiredAt||typeof r.acquiredAt!=='object'||!Array.isArray(r.portraitIds)||new Set(r.portraitIds).size!==r.portraitIds.length||r.portraitIds.some(id=>!h.portraits.some(p=>p.id===id))||r.selectedPortraitId&&!r.portraitIds.includes(r.selectedPortraitId)||r.trust!==r.portraitIds.length||r.unlocked!==r.portraitIds.includes(h.portraits[0].id)||!r.unlocked&&r.level!==1||p.spentByHero[h.id]!==cumulative(r.level))throw Error('角色等级、信赖或支出冲突');spent+=p.spentByHero[h.id];}
  if(p.balance!==earned-spent||p.balance<0||earned>21000)throw Error('训练积分账本不平衡');return true;
 }
 function read(){let p;if(root.localStorage){let text;try{text=root.localStorage.getItem(key);}catch(e){throw Error('无法读取训练档案，请检查浏览器存储权限');}if(text){try{p=JSON.parse(text);}catch(e){throw Error('训练档案损坏，请保留原档案并导出备份');}}p=p||blank();}else p=memory||blank();validate(p);return clone(p);}
 function write(p){validate(p);if(root.localStorage)try{root.localStorage.setItem(key,JSON.stringify(p));}catch(e){throw Error('训练档案写入失败，积分和等级未变更；请导出存档并清理空间');}memory=clone(p);return clone(p);}
 function transact(kind,change){try{const p=read(),result=change(p)||{};if(result.reason)return {ok:false,...result};if(result.unchanged)return {ok:true,...result,profile:p};p.revision++;p.lastTransaction={id:`${kind}:${p.revision}`,kind};p.balance=Object.values(p.earnedByClaim).reduce((a,b)=>a+b,0)-Object.values(p.spentByHero).reduce((a,b)=>a+b,0);return {ok:true,...result,profile:write(p)};}catch(e){return {ok:false,reason:e.message};}}
 function chapterCap(p=read()){return E.training.chapterCaps[Math.max(...p.unlockedChapters)-1];}
 function missionCap(m){const n=numberMission(m?.id);return m?.eliteLevelCap||m?.eliteDeploymentDesign?.levelCap||E.training.chapterCaps[Math.floor((n-1)/7)]||3;}
 function activeReason(battle){return battle&&!battle.result&&!battle.story?.ending?'对局尚未结束，培养和重置将在战斗后开放':null;}
 function upgradeReason(id,battle,p=read()){const h=E.byId[id],r=p.heroes[id];return !h?'未知角色':activeReason(battle)||(!r.unlocked?`完成 ${h.unlockMission} 的结算剧情后加入`:r.level>=10?'已达到 Lv10':r.level>=chapterCap(p)?`当前章节培养上限 Lv${chapterCap(p)}`:p.balance<E.training.upgradeCosts[r.level-1]?`还需 ${E.training.upgradeCosts[r.level-1]-p.balance} 训练积分`:null);}
 function resetReason(id,battle,p=read()){return !E.byId[id]?'未知角色':activeReason(battle)||(!p.heroes[id].unlocked?'角色尚未加入':p.spentByHero[id]===0?'当前没有可退还的培养支出':null);}
 function upgrade(id,battle){return transact('upgrade',p=>{const reason=upgradeReason(id,battle,p);if(reason)return {reason};const cost=E.training.upgradeCosts[p.heroes[id].level-1];p.heroes[id].level++;p.spentByHero[id]+=cost;return {cost};});}
 function reset(id,battle){return transact('reset',p=>{const reason=resetReason(id,battle,p);if(reason)return {reason};const refund=p.spentByHero[id];p.heroes[id].level=1;p.spentByHero[id]=0;return {refund};});}
 function selectPortrait(id,portraitId){return transact('portrait',p=>{if(!p.heroes[id]?.portraitIds.includes(portraitId))return {reason:'此角色肖像尚未获得'};if(p.heroes[id].selectedPortraitId===portraitId)return {unchanged:true};p.heroes[id].selectedPortraitId=portraitId;return {};});}
 function isCampaign(s){return (s?.campaignId||s?.mission?.campaignId||s?.story?.progress?.campaignId)===campaignId&&['campaign','mission'].includes(s.mode)&&numberMission(s.mission?.id);}
 function commitVictory(s){
  if(!isCampaign(s)||s.result?.winner!=='union'||s.story?.completionMethod==='assisted'||s.completionMethod==='assisted')return {ok:true,reward:0,reason:'仅42关真实玩家战术首胜获得训练积分'};
  const difficulty=normalizeDifficulty(s.trainingDifficulty);if(!s.trainingDifficulty||!difficulties.includes(difficulty))return {ok:false,reason:'战斗冻结难度非法'};
  const k=claimKey(s.mission.id,difficulty),reward=E.training.rewardByDifficulty[difficulty];return transact('victory',p=>{if(Object.hasOwn(p.earnedByClaim,k))return {unchanged:true,reward:0,claimKey:k};p.earnedByClaim[k]=reward;return {reward,claimKey:k};});
 }
 function applyOutro(p,mission){
  const before=JSON.stringify(p),unlocked=[],scenes=[];
  if(!p.completedOutros.includes(mission.id))p.completedOutros.push(mission.id);
  const next=numberMission(mission.nextMission),chapter=next?Math.floor((next-1)/7)+1:Math.floor((numberMission(mission.id)-1)/7)+1;
  for(let c=1;c<=chapter;c++)if(!p.unlockedChapters.includes(c))p.unlockedChapters.push(c);
  for(const h of E.heroes)for(const portrait of h.portraits)if(portrait.unlockMissionId===mission.id){const r=p.heroes[h.id];if(!r.portraitIds.includes(portrait.id)){r.portraitIds.push(portrait.id);r.acquiredAt[portrait.id]=new Date().toISOString();r.trust=r.portraitIds.length;r.unlocked=r.portraitIds.includes(h.portraits[0].id);r.selectedPortraitId=r.selectedPortraitId||portrait.id;unlocked.push(portrait.id);}scenes.push(portrait.unlockSceneId);}
  return {unlocked,scenes,unchanged:before===JSON.stringify(p)};
 }
 function unlockFromOutro(s,id){
  if(!isCampaign(s)||id!==s.mission.scenes?.outro||!s.story?.ending||!['tactical','assisted'].includes(s.story.completionMethod)||s.story.completionMethod==='tactical'&&s.result?.winner!=='union')return {ok:false,reason:'只能在有效任务交接后获得角色与肖像'};
  return transact('outro',p=>applyOutro(p,s.mission));
 }
 function syncProgress(progress){
  if(!progress||progress.campaignId!==campaignId)return {ok:true,unchanged:true,reward:0};
  return transact('progress',p=>{if(!progress.completed||!Array.isArray(progress.seenScenes))return {reason:'主线进度缺少交接凭据'};
   const C=root.GameContent||(typeof require!=='undefined'&&require('./content')),missions=C.campaign42?.missions;if(!missions)return {reason:'42关交接内容尚未加载'};
   const before=JSON.stringify(p),unlocked=[];
   for(const mission of missions){const done=progress.completed[mission.id];if(!done||!['tactical','assisted'].includes(done.method)||!progress.seenScenes.includes(mission.scenes.outro))continue;unlocked.push(...applyOutro(p,mission).unlocked);}
   for(const h of E.heroes)for(const portrait of h.portraits)if(p.heroes[h.id].portraitIds.includes(portrait.id)&&progress.seenScenes.includes(portrait.unlockSceneId)&&!p.seenScenes.includes(portrait.unlockSceneId))p.seenScenes.push(portrait.unlockSceneId);
   return {unlocked,reward:0,unchanged:before===JSON.stringify(p)};
  });
 }
 function unlockFromScene(s,id){return transact('scene',p=>{const h=E.heroes.find(h=>h.portraits.some(x=>x.unlockSceneId===id));if(!isCampaign(s)||!h||!p.heroes[h.id].portraitIds.includes(h.portraits.find(x=>x.unlockSceneId===id).id))return {reason:'此个人剧情尚未解锁'};if(p.seenScenes.includes(id))return {unchanged:true};p.seenScenes.push(id);return {};});}
 function deploymentOptions(mission,id,p=read()){
  const h=E.byId[id],r=p.heroes[id],n=numberMission(mission?.id);if(!h||!n)return {characterId:id,reason:'仅42关主线支持精英出战',slots:[]};if(!r.unlocked)return {characterId:id,reason:`完成 ${h.unlockMission} 结算剧情后加入`,slots:[]};
  const candidate=mission.eliteDeploymentDesign?.candidates?.find(x=>x.characterId===id),keys=candidate?.replaceableUnitKeys||[],slots=keys.map(k=>{const u=mission.units?.find(u=>(u.key||u.id)===k||u.id===`${mission.id}-${k}`);return u&&u.owner==='union'?{unitKey:k,unitId:`${mission.id}-${k}`,type:u.type,position:clone(u.position||[u.q,u.r]),hqGuard:mission.hqGuardKeys?.union===k||u.hqGuard===true}:null;}).filter(Boolean);
  return {characterId:id,reason:slots.length?null:'本关没有可替换的同体系初始部队',slots,effectiveLevel:Math.min(r.level,missionCap(mission)),archiveLevel:r.level,profileLevel:r.level};
 }
 function freezeSelection(mission,selections=[]){try{if(!Array.isArray(selections)||selections.length>E.deployment.maxElite)return {ok:false,reason:'每关最多选择2名精英'};const p=read(),ids=new Set(),slots=new Set(),output=[];for(const choice of selections){const id=typeof choice==='string'?choice:choice.characterId,h=E.byId[id],option=deploymentOptions(mission,id,p);if(option.reason)return {ok:false,reason:option.reason};if(ids.has(id))return {ok:false,reason:'每名精英只能出战一次'};const requested=choice.unitId||choice.unitKey,slot=requested?option.slots.find(x=>x.unitId===requested||x.unitKey===requested):option.slots.find(x=>!slots.has(x.unitId));if(!slot||slots.has(slot.unitId))return {ok:false,reason:'初始部队替换位无效或重复'};ids.add(id);slots.add(slot.unitId);output.push({characterId:id,...slot,archiveLevel:option.archiveLevel,profileLevel:option.profileLevel,effectiveLevel:option.effectiveLevel,portraitId:p.heroes[id].selectedPortraitId,configVersion:E.contentVersion});}return {ok:true,selections:output};}catch(e){return {ok:false,reason:e.message};}}
 function snapshotClaims(){const p=read();return {version:1,campaignId,earnedByClaim:clone(p.earnedByClaim)};}
 function mergeClaims(incoming){if(!incoming)return {ok:true,reward:0,unchanged:true};return transact('merge',p=>{if(incoming.version!==1||incoming.campaignId!==campaignId||!incoming.earnedByClaim)return {reason:'导入训练账本版本非法'};const keys=Object.entries(incoming.earnedByClaim);for(const [k,v]of keys)parseClaim(k,v);let added=0;for(const[k,v]of keys)if(!Object.hasOwn(p.earnedByClaim,k)){p.earnedByClaim[k]=v;added+=v;}return {reward:added,unchanged:!added,conflictPolicy:'local_training_preserved'};});}
 function overview(mission,battle){const p=read(),cap=chapterCap(p),heroes=E.heroes.map(h=>{const r=p.heroes[h.id],effectiveLevel=mission?Math.min(r.level,missionCap(mission)):r.level;return {id:h.id,config:clone(h),...clone(r),effectiveLevel,nextCost:r.level<10?E.training.upgradeCosts[r.level-1]:0,spent:p.spentByHero[h.id],upgradeReason:upgradeReason(h.id,battle,p),resetReason:resetReason(h.id,battle,p),portraits:h.portraits.map(x=>({...clone(x),assetPath:x.assetPath||null,unlocked:r.portraitIds.includes(x.id),selected:r.selectedPortraitId===x.id,acquiredAt:r.acquiredAt[x.id]||null})),skills:h.skills.map(x=>({...clone(x),unlocked:effectiveLevel>=x.unlockLevel,parameters:effectiveLevel>=x.unlockLevel?clone(x.parametersByEffectiveLevel[effectiveLevel]):null}))};});const rows=Array.from({length:42},(_,i)=>{const missionId=`S${String(i+1).padStart(2,'0')}`,claims=Object.fromEntries(difficulties.map(d=>[d,Object.hasOwn(p.earnedByClaim,claimKey(missionId,d))]));return {missionId,earned:difficulties.reduce((n,d)=>n+(claims[d]?E.training.rewardByDifficulty[d]:0),0),completed:p.completedOutros.includes(missionId),unlocked:i===0||p.completedOutros.includes(`S${String(i).padStart(2,'0')}`),claims};});return {profile:p,balance:p.balance,totalEarned:Object.values(p.earnedByClaim).reduce((a,b)=>a+b,0),totalSpent:Object.values(p.spentByHero).reduce((a,b)=>a+b,0),chapterCap:cap,heroes,rewards:{rows,totalEarned:Object.values(p.earnedByClaim).reduce((a,b)=>a+b,0),maximum:21000,rewardByDifficulty:clone(E.training.rewardByDifficulty)}};}
 const api={key,campaignId,difficulties,read,load:read,validate,chapterCap,missionCap,claimKey,normalizeDifficulty,upgradeReason,resetReason,upgrade,reset,selectPortrait,commitVictory,unlockFromOutro,syncProgress,unlockFromScene,deploymentOptions,freezeSelection,prepareSelections:freezeSelection,snapshotClaims,mergeClaims,overview};root.GameTraining=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
