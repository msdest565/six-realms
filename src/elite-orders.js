(function(root){'use strict';
 // Only specialized multi-target skills use this edge panel. Single-target
 // orders and movement retain the direct map interaction.
 function prepare(s,ui,command){
  const G=root.Game,u=G.unit(s,command.unitId),skill=u&&G.eliteCombat.skill(u,command.slot);
  if(!skill||Math.max(skill.parameters.maxTargets||1,skill.parameters.maxRecipients||1)<=1)return false;
  const preview=G.eliteSkillPreview(s,u,command.slot,command);if(preview.reason)return false;
  const mode=G.eliteCombat.targetMode(u,command.slot),enemy=mode==='enemy',allies=enemy&&skill.parameters.allyRadius!==undefined?s.units.filter(t=>G.allied(s,u.owner,t.owner)&&G.visible(s,u.owner,t)&&root.Hex.domain(t,G.cell(s,t))==='air'&&root.Hex.distance(u,t)<=skill.parameters.allyRadius).map(t=>t.id):[];
  const candidates=enemy?preview.candidates:(G.eliteSkillTargets(s,u,command.slot)||[]).map(t=>t.id);
  if((candidates||[]).length<=1&&allies.length<=1)return false;
  ui.eliteOrder={command:{...command},mode,skillId:skill.id,name:skill.name,primaryId:preview.primaryId||null,candidates:candidates||[],allies,max:enemy?skill.parameters.maxTargets:skill.parameters.maxRecipients,allyMax:skill.parameters.maxRecipients||0,
   selected:enemy?[...(preview.targets||[])]:preview.beneficiaries.map(t=>t.targetId),selectedAllies:preview.beneficiaries.map(t=>t.targetId)};
  ui.drawer=null;ui.choices=null;ui.intent=null;return true;
 }
 function command(ui){const o=ui.eliteOrder;if(!o)return null;return {...o.command,targetIds:[...o.selected],...(o.allies.length?{beneficiaryIds:[...o.selectedAllies]}:{})};}
 function toggle(s,ui,id,ally=false){const o=ui.eliteOrder;if(!o)return;const ids=ally?o.selectedAllies:o.selected,list=ally?o.allies:o.candidates,max=ally?o.allyMax:o.max;if(!list.includes(id)||!ally&&o.primaryId===id)return;const index=ids.indexOf(id);if(index>=0){if(ids.length>1)ids.splice(index,1);}else if(ids.length<max)ids.push(id);}
 function view(s,ui,esc){const o=ui.eliteOrder;if(!o||ui.drawer)return '';const G=root.Game,preview=G.eliteSkillPreview(s,G.unit(s,o.command.unitId),o.command.slot,command(ui));
  const group=(ids,selected,ally)=>ids.map(id=>{const u=G.unit(s,id);if(!u||!G.visible(s,s.actor,u))return '';const d=G.unitStats(s,u);return `<button class="elite-recipient ${selected.includes(id)?'is-selected':''}" data-action="elite-pick-${ally?'ally-':''}${esc(id)}" aria-pressed="${selected.includes(id)}" data-tooltip="${esc(d.name+' · HP '+u.hp+'/'+u.maxHp+(id===o.primaryId?' · 主目标不可取消':''))}">${u.characterId?root.GameTrainingUI.emblem(u.characterId):root.GameAnime?.avatar(u.type)||''}<span>${esc(d.name)}<small>HP ${u.hp}/${u.maxHp}</small></span>${id===o.primaryId?root.GameIcons.svg('sniper'):root.GameIcons.svg(selected.includes(id)?'shield':'zoomIn')}</button>`;}).join('');
  return `<aside class="elite-order-panel hud-panel" aria-label="技能目标预览"><div class="dock-title"><b>${esc(o.name)}</b>${root.GameIcons.button('close','取消技能',{action:'elite-order-cancel'})}</div><small>${o.mode==='enemy'?'攻击目标':'受益单位'} ${o.selected.length}/${o.max} · 可少选</small><div class="elite-recipient-list">${group(o.candidates,o.selected,false)}</div>${o.allies.length?`<small>护盾受益 ${o.selectedAllies.length}/${o.allyMax}</small><div class="elite-recipient-list">${group(o.allies,o.selectedAllies,true)}</div>`:''}<div class="elite-order-preview">${preview.reason?esc(preview.reason):`能源 ${preview.energyCost} · 耗尽AP${(preview.hits||[]).map(h=>`<span>伤害 −${h.damage}${h.shieldDamage?' · 盾−'+h.shieldDamage:''}${h.buildingDamage?' · 设施−'+h.buildingDamage:''}</span>`).join('')}${(preview.beneficiaries||[]).map(h=>`<span>${h.heal?'HP+'+h.heal+' ':''}${h.shieldGranted?'盾+'+h.shieldGranted+' ':''}${h.moveBonus?'移动+'+h.moveBonus:''}</span>`).join('')}${preview.counters?.length?'<span>反击合计 −'+preview.counters.reduce((n,h)=>n+(h.damage||0),0)+'</span>':''}`}</div>${root.GameIcons.button('play','施放技能',{action:'elite-order-confirm',reason:preview.reason||(ui.paused?'对局已暂停':'')})}</aside>`;
 }
 const api={prepare,command,toggle,view};root.GameEliteOrders=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
