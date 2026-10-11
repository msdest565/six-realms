(function(root){'use strict';
 const key='six-realms-character-guides-v1';
 const roles={E01:'观察与地面支援',E02:'装甲突破与编队整备',E03:'远程炮火与观测支援',E04:'海陆登陆与补给',E05:'制空护航与航空保护'};
 const tactics={E01:'把灯芽放在推进队伍后方。先用信标照亮前线，再让陆海伙伴攻击观察区中的目标；她的陆地移动不耗能源，也能接管据点。',E02:'让回铸与装甲编队一起推进，保留机动能源。破阵适合清除坚固守军，直射目标仍可能反击；不要独自冲进敌军包围。',E03:'把准弦留在前排伙伴身后，先用侦察取得目标视野。她的射程为 2—5 格，本回合移动后不能开火，也无法攻击相邻敌军。',E04:'用潮灯带登陆伙伴上岸，在友军受伤或即将承受火力时补给。治疗与护盾只作用于范围内的合法陆海友军，受益者可以在预览中少选。',E05:'让归航跟随航空编队。先保护需要继续飞行的友军，再争夺空域；航空每格消耗能源，制空大招的攻击目标必须在空中。'};
 const effectSteps={
  beacon_observation_and_fire_support:'点击「灯芽信标」，再点距本人 3 格内高亮、可见且射线通畅的合法陆地格。信标提供观察与火力支援，不占格，也不会占领该格。',
  direct_attack_bonus_and_pierce:'点击「楔形破阵」，再点高亮的敌方陆海单位或可破坏结构设施，执行强化穿甲攻击。可以先移动，但要为敌方反击留出生命；收入据点只能占领。',
  direct_area_attack_and_self_shield:'点击「回铸突破」，再点高亮的敌方陆海单位作为主目标，不能选建筑。单目标直接施放；出现多人预览时，选择附加敌军、检查反击与能源，再点击「施放技能」。附加目标也须分别在本人射程与射线内。',
  indirect_area_attack:'本回合先保持不动，点击「分区校射」，再点可见且在 2—5 格内的高亮敌方陆海单位，不能选建筑；有多个合法目标时，在预览里选附加目标后点击「施放技能」。每个附加目标也须在本人射程内且已观测。',
  indirect_bombardment:'本回合先保持不动，点击「终点协奏」，再点 2—5 格内可见的敌方陆海单位作为中心，不能选建筑。单目标直接施放；出现多人预览时，选择范围内合法敌军，再点击「施放技能」。每个附加目标也须在本人射程内且已观测。',
  ground_allies_shield_and_movement:'把陆地伙伴（可含本人）集合在小禾附近，点击「黎明通行」。多人受益时先检查预览、调整名单，再点击「施放技能」；只作用于陆地单位，护盾与移动预算不会返还行动点或开放新的地形通行。',
  land_sea_heal_and_shield:'让陆海伙伴（可含本人）进入角色周围，点击「潮线掩护」。单人受益立即生效；多人受益时在预览中选择受伤或需要护盾的伙伴，点击「施放技能」确认。不能修复建筑，也不作用于飞机。',
  land_sea_group_recovery:'让陆海伙伴（可含本人）集合在角色周围，点击「潮灯登陆」。单人受益立即生效；多人受益时在预览中选择需要恢复生命、护盾与移动预算的陆海友军，点击「施放技能」确认。不修复建筑、不恢复行动点，也不开放新的地形通行。',
  air_shield_armor_energy:'点击「归航引导」，再点高亮的可见友方飞机（可选本人），给予护盾、装甲与移动能耗折扣。施放耗尽本人行动点；选本人时要到下一回合才能继续移动，不返还已花能源。',
  air_superiority_attack_and_shield:'点击「晴空回响」，再点高亮的敌方飞机，不能选陆海单位或建筑。出现多人预览时，可选攻击目标与护盾受益友机（可含本人），点击「施放技能」；只有一组合法对象时直接施放。每架敌机仍须在本人射程内，存活目标可能逐一反击。'
 };
 const auraSteps={
  ground_units_fire_and_vision:'街区联络自动生效。让陆地友军（含本人）留在作用半径内，提升原始火力与视野；两栖伙伴必须在陆地，不需要点技能。',
  ground_armored_armor_and_energy:'整备共振自动生效。让当前在陆地的装甲类别友军（含本人、炮兵）留在作用半径内，增加装甲并降低移动每格能源；不解除炮兵移动后禁射。',
  land_sea_fire_support:'观测校核自动生效。让陆海友军（含本人）留在作用半径内，提升原始火力；间接火力单位还增加视野，原射程与移动后禁射条件仍有效。',
  land_sea_armor_and_fire:'岸线协作自动生效。让陆海友军（含本人）留在作用半径内，增加装甲与原始火力；不会开放新的陆地或海洋通行权限。',
  air_fire_and_armor:'归航编队自动生效。让友方航空单位（含本人）留在作用半径内，增加原始火力与装甲；轰炸机、侦察机不会因此获得对空能力。'
 };
 const escape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function skillSteps(skill){if(skill.type==='aura')return (auraSteps[skill.effect]||'光环自动生效。让符合条件的友军保持在作用半径内，不需要点击技能，也不消耗行动点或能源。')+(Number.isFinite(skill.parameters?.radius)?`作用半径 ${skill.parameters.radius} 格。`:'');return effectSteps[skill.effect]||`先让合法陆海友军进入角色周围，再点击「${skill.name}」。多人受益时在预览中选择需要治疗或保护的伙伴，点击「施放技能」确认。`;}
 function create(env){
  const {ui,D,G,H,esc=escape,btn,render,toast,dialog,focusUnit}=env;
  let enabled=true,seen=new Set(),skipped=new Set(),battle=null;
  const allowed=new Set([...D.units.map(u=>'unit:'+u.id),...(root.GameEliteData?.heroes||[]).flatMap(h=>h.skills.map(s=>'elite:'+h.id+':'+s.type))]);
  try{const saved=JSON.parse(root.localStorage.getItem(key)||'{}');enabled=saved.enabled!==false;seen=new Set((Array.isArray(saved.seen)?saved.seen:[]).filter(x=>allowed.has(x)));}catch{}
  function write(){try{root.localStorage.setItem(key,JSON.stringify({version:1,enabled,seen:[...seen]}));}catch{}}
  function viewer(){const s=ui.game;if(!s)return null;const p=G.player(s,s.actor);return p?.controller==='local_human'&&!p.eliminated?p.id:ui.observer||s.players.find(p=>p.controller==='local_human')?.id||s.actor;}
  function available(){const s=ui.game;return !!s&&ui.view==='game'&&!s.result&&!s.handoffRequired&&!s.story?.ending&&!s.story?.queue?.length&&!s.story?.combatLocked&&s.actor===viewer()&&G.player(s,s.actor)?.controller==='local_human';}
  const validUnit=u=>!!u&&u.owner===viewer()&&G.player(ui.game,u.owner)?.controller==='local_human'&&G.visible(ui.game,viewer(),u);
  function keys(u){return u.characterId?u.elite.skills.filter(s=>s.unlocked).map(s=>'elite:'+u.characterId+':'+s.type):['unit:'+u.type];}
  function candidates(){if(!available())return [];const ids=new Set();return ui.game.units.filter(validUnit).filter(u=>keys(u).some(k=>!seen.has(k)&&!skipped.has(k))).sort((a,b)=>Number(!!b.characterId)-Number(!!a.characterId)||a.id.localeCompare(b.id)).filter(u=>{const id=u.characterId||u.type;if(ids.has(id))return false;ids.add(id);return true;});}
  function observe(){if(battle!==ui.game){battle=ui.game;skipped=new Set();}}
  function current(){observe();return candidates()[0]||null;}
  function active(){return enabled&&available()&&!ui.busy&&!ui.paused&&!ui.dialog&&!ui.drawer&&!ui.choices&&!ui.touchMap&&!ui.eliteOrder&&!ui.intent&&!!current();}
  function acknowledge(u=current()){if(!validUnit(u))return;keys(u).forEach(k=>seen.add(k));write();}
  function toggle(value=!enabled){enabled=!!value;write();}
  function intro(u){
   const s=ui.game,d=G.unitStats(s,u),h=u.characterId&&root.GameEliteData?.byId[u.characterId],model=G.model(s,u),elite=!!h;
   const title=elite?`${h.name} · ${h.callsign}`:`${d.name} · ${d.type}`;
   const portrait=elite?root.GameTrainingUI?.portrait(u.characterId,'','character-guide-portrait',{unit:u,portraitId:u.elite.portraitId,unlocked:true}):root.GameAnime?.avatar(u.type)||'';
   const energy=H.energy(model,G.cell(s,u)),movement=d.fireAfterMove===false?'本回合移动后不能攻击或施放攻击技能。':d.amphibious?'可在海洋与陆地切换；按当前地形结算能耗。':d.branch==='navy'?'普通舰船只能在海洋移动。':d.branch==='air'?'空中单位可跨越地形，仍需合法空格与能源。':energy===0?'陆地移动不消耗能源。':`每格实际消耗 ${energy} 能源。`;
   const identity=elite?`${h.age} 岁 · ${roles[h.id]} · 档案 Lv${u.elite.archiveLevel} / 本关 Lv${u.elite.effectiveLevel}`:d.role;
   const stats=`HP ${u.hp}/${u.maxHp} · 装甲 ${d.armor} · 伤害 ${d.damage} · 射程 ${d.minRange}—${d.maxRange} · 移动 ${d.move}`;
   const skills=elite?h.skills.map(config=>{const sk=u.elite.skills.find(k=>k.id===config.id),unlocked=!!sk?.unlocked;return `<article class="character-guide-skill ${unlocked?'':'is-locked'}"><h4>${esc(config.name)} <small>${config.type==='aura'?'自动光环':config.type==='ultimate'?'大招':'主动技能'} · ${unlocked?'本关已开放':`本关未开放，需要 Lv${config.unlockLevel}`}</small></h4><p>${esc(config.description)}</p>${unlocked?`<p class="guide-operation">${esc(skillSteps(sk))}</p><small>${sk.type==='aura'?'持续自动生效':`${sk.energyCost} 能源 · 耗尽剩余行动点 · ${sk.type==='ultimate'?'100 充能，每关一次':`冷却 ${sk.cooldownOwnTurns} 个己方回合`}`}</small>${root.GameTrainingUI?.params(sk.parameters)||''}`:''}</article>`;}).join(''):`<article class="character-guide-skill"><h4>${esc(d.skill)}</h4><p>${esc(d.skillText)}</p><p class="guide-operation">${esc(ordinarySkillSteps(d))}</p></article>`;
   return {title,portrait,identity,stats,movement,tactic:elite?tactics[h.id]:d.tactic,skills,elite,newSkills:elite&&seen.has('elite:'+u.characterId+':active')};
  }
  function ordinarySkillSteps(d){
   if(['基础作战','驻守','伏击','防空反击'].includes(d.skill))return '这是基础或被动能力，不需要施放按钮。选中角色后，直接点击高亮空格移动、点击可见敌军攻击；接管建筑必须到本格。'+(d.skill==='伏击'?'要获得对装甲的伏击加值，本回合先不要移动。':d.skill==='防空反击'?'受到可反击的攻击时自动反击，仍需目标在射程内且有剩余反击次数。':'');
   if(['构筑掩体','锚定防线','主动扫描'].includes(d.skill))return `选中角色，点击「${d.skill}」即在自身生效；无需再点地图目标。技能会结束本次单位行动，先安排好位置。`;
   if(d.skill==='应急修复')return '选中角色，点击「应急修复」，再点高亮的合法目标：邻格己方受损单位（不能选本人），或同格/邻格的己方结构设施。结构必须完工、未损毁且生命低于 50%，修复上限为 50%；每个目标每己方回合最多接受一次修复。修复会结束单位本次行动，先安排好位置。';
   if(d.skill==='链路干扰')return '选中角色，点击「链路干扰」，再点 1—2 格内高亮的合法可见敌方单位，不能选建筑或处于干扰/保护期的单位。陆海目标需要射线通畅，空中单位也可以被干扰。技能结束单位行动；按钮变灰时可查看详情了解原因。';
   return `选中角色，点击「${d.skill}」，再点高亮的合法${d.skill==='震荡弹'?'敌方陆海单位（不能选建筑）':'敌方陆海单位或可破坏结构设施'}。${d.skill==='定点狙击'?'定点狙击需要本回合未移动。':d.fireAfterMove===false?'本回合移动后不能开火。':''}技能结束单位行动；按钮变灰时可长按或查看详情了解原因。`;
  }
  function fullMarkup(u){const t=intro(u);return `<div class="character-guide-detail"><div class="character-guide-heading">${t.portrait}<div><h3>${esc(t.title)}</h3><p>${esc(t.identity)}</p><small>${esc(t.stats)}</small></div></div><p>${esc(t.tactic)}</p><p>${esc(t.movement)} ${G.model(ui.game,u).antiAir?'可以攻击空中目标。':'不能攻击空中目标。'}</p><h3>怎样指挥</h3><ol><li>点击地图上的角色，或通过「部队」定位；高亮格表示当前合法行动。</li><li>直接点空格移动，点可见敌军攻击。占领需要进入建筑本格；移动后仍有行动点时自动接管。</li><li>按下列技能步骤使用，留意能源、冷却与目标；取消选点不消耗资源。</li></ol>${t.skills}${t.elite?'<p class="note">大招在本关 Lv5 开放：首个己方回合充能 0，之后每己方回合 +25；成功主动技能 +20，普通攻击每己方回合最多 +10。达到 100 后每关可用一次。</p>':''}</div>`;}
  function card(){if(!active())return '';const u=current(),t=intro(u),count=candidates().length;
   const face=t.elite?(root.GameEliteArt?.avatar(u.characterId,{unit:u})||t.portrait):t.portrait;
   const steps=t.elite?u.elite.skills.filter(sk=>sk.unlocked).map(sk=>`<p class="character-guide-open-skill"><b>${esc(sk.name)} · ${sk.type==='aura'?'自动光环':sk.type==='ultimate'?'大招':'主动技能'}</b><br>${esc(skillSteps(sk))}<small>${sk.type==='aura'?'自动生效，不消耗行动点或能源':`${sk.energyCost} 能源 · 耗尽剩余行动点 · ${sk.type==='ultimate'?'100充能，每关一次':`冷却 ${sk.cooldownOwnTurns} 个己方回合`}`}</small></p>`).join(''):`<p><b>${esc(G.unitStats(ui.game,u).skill)}</b>：${esc(ordinarySkillSteps(G.unitStats(ui.game,u)))}</p>`;
   return `<aside id="character-guide-coach" class="character-guide-coach ${ui.selected?'has-unit-selection':''}" aria-label="新角色登场指引" data-character-guide="${esc(u.characterId||u.type)}"><div class="character-guide-heading">${face}<div><small>${t.newSkills?'新技能已开放':'角色登场'}${count>1?` · 待读 ${count} 位`:''}</small><h3>${esc(t.title)}</h3><p>${esc(t.identity)}</p></div></div><div class="character-guide-copy"><p>${esc(t.tactic)}</p>${steps}<small>${esc(t.stats)}<br>${esc(t.movement)}</small></div><div class="character-guide-actions">${btn('定位角色','character-guide-focus')}${btn('全部技能与步骤','character-guide-current')}${btn(count>1?'已了解 · 下一位':'已了解 · 开始指挥','character-guide-ack','primary')}${btn('本次跳过','character-guide-later')}</div></aside>`;
  }
  function show(u){if(!validUnit(u)){toast?.('先选择一名己方可见角色');return;}dialog(`${intro(u).title} · 角色用法`,fullMarkup(u),btn('关闭，继续指挥','close'));}
  function library(){const units=ui.game?.units.filter(validUnit)||[];dialog('当前部队 · 角色教学',`<p>点击角色查看本关属性、技能与使用步骤。已读角色也可重复查看。</p><div class="character-guide-library">${units.map(u=>btn(intro(u).title,'character-guide-unit-'+u.id)).join('')||'<p>当前没有可指挥的角色。</p>'}</div>`,btn('返回战场','close'));}
  function menu(){return `<section class="tutorial-settings"><h3>新角色登场指引</h3><p class="note">首次指挥新型号或精英、首次使用新开放技能时显示文字教学；可在角色详情重看。</p><div class="actions">${btn(enabled?'关闭自动指引':'开启自动指引','character-guide-toggle')}${btn('查看当前部队教学','character-guide-library')}</div></section>`;}
  function action(name){if(!name.startsWith('character-guide-'))return false;const u=current();if(name==='character-guide-toggle'){toggle();render();return true;}if(name==='character-guide-library'){library();return true;}if(name==='character-guide-selected'){show(G.unit(ui.game,ui.selected));return true;}if(name.startsWith('character-guide-unit-')){show(G.unit(ui.game,name.slice(21)));return true;}if(name==='character-guide-current'){if(u)show(u);return true;}if(name==='character-guide-focus'){if(u){focusUnit?.(u.id);toast?.('已选中 '+intro(u).title+'，按指引点击地图或技能');render();}return true;}if(name==='character-guide-ack'){acknowledge(u);render();return true;}if(name==='character-guide-later'){if(u)keys(u).forEach(k=>skipped.add(k));render();return true;}return false;}
  return {observe,current,active,card,menu,action,toggle,acknowledge,intro,fullMarkup,status:()=>({enabled,seen:[...seen],pending:candidates().map(u=>u.characterId||u.type)})};
 }
 const api={create,key,skillSteps,roles};root.GameCharacterGuides=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
