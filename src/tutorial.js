(function(root){'use strict';
 const key='six-realms-tutorial-v1';
 const step=(title,text,options={})=>({title,text,...options});
 const lessons={
  C01:{title:'指挥入门',guide:'infantry',steps:[
   step('欢迎，指挥官','我是前哨。七次任务中，我们会陪你练习指挥。提示不阻挡地图；可以直接操作，也可用箭头翻页。菜单能关闭或重看教程。'),
   step('先找到伙伴','轻点己方部队即可选中。步兵便宜，移动不耗能源；行动点 AP 与本回合剩余移动距离仍会限制行动。试着选中前哨。',{select:['infantry'],target:'[data-action="drawer-army"]'}),
   step('直接移动','选中部队后点高亮空格，立即移动。友军可穿过，终点不能叠放。手机单指拖图、双指缩放；电脑 WASD / 方向键平移，滚轮缩放。试着移动一次。',{command:['move']}),
   step('可以撤销','回转箭头撤销本回合连续移动，恢复行动点、能源、自动占领和出库；已探明情报保留。攻击、技能、生产、换回合、剧情交接后不能撤销。',{action:['undo-move'],target:'[data-action="undo-move"]'}),
   step('直接攻击','选中部队，点射程内可见敌军或有结构 HP 的敌方建筑即可攻击。攻击结束该部队行动；目标存活且满足反击条件时会反击。无需选择攻击驻军还是建筑。',{command:['attack']}),
   step('到达才能占领','必须站上建筑本格，并有行动点。移动抵达且还剩 AP 时自动占领；已站在建筑上则再点本格。占领结束该单位行动。行政城市下回合开始提供资金。',{capture:true}),
   step('地图边缘的工具','部队图标定位伙伴，旗帜查看胜利条件，卷轴查看记录，问号查看操作。详情、技能、生产按钮只在需要时出现；X 或点弹窗外关闭。',{action:['drawer-objectives'],target:'[data-action="drawer-objectives"]'}),
   step('交给下一位','结束回合按钮让敌方行动，再轮到我们时领取收入、恢复行动点。顶部暂停或空格可停下游戏；菜单可存档。保持总部守军，再结束一次回合。',{command:['end'],target:'.end-turn'})]},
  C02:{title:'侦察、维修与生产',guide:'engineer',steps:[
   step('织补报到','我是织补。轻装部队省钱，坦克更耐打。轻坦雨燕负责机动，反坦克步兵猎矛对付装甲；猎矛本回合没移动时对装甲攻击更强。'),
   step('先看能力','选中工程车，再点右侧详情。每个伙伴都有射程、视野、能耗和技能；被动能力自动生效，没有技能按钮。',{select:['engineer'],target:'[data-action="drawer-details"]'}),
   step('应急修复','我的修复按钮需要再点相邻受损友军或己方结构建筑，不能修复自己。一次最多恢复 40 HP，结构建筑最多修到 50%；技能结束本次行动。暂无受损目标可先翻页。',{command:['skill'],unitTypes:['engineer'],target:'[data-action="intent-skill"]'}),
   step('让视野先行','游隼等侦察型号能主动扫描，扩大视野到下次己方回合。迷雾外不能盲射；旧设施情报仅是最后观测。单位手册可随时查看所有型号。'),
   step('打开生产','点己方步兵营或工厂，再点生产图标。头像表示型号，等级、价格和回合数就在旁边；点头像立即下单，灰色型号的说明会解释缺少什么。',{building:['barracks','factory'],target:'[data-action="drawer-production"]'}),
   step('支付并等待','生产需要资金与等待回合，设施等级和本关授权同时限制可造型号。每座设施同一时间一个生产或升级订单；已满 24 支编制时不能继续招募。试着下单一次。',{command:['produce']}),
   step('固定部署与仓库','生产窗口的准星设置本格或邻格为自动部署格。部署格有单位才入仓，最多 3 支；空出时自动部署队首。取消订单不返还资金，仓库头像按出库顺序排列。',{command:['setDeployment'],target:'[data-action="set-deployment"]'}),
   step('金钱与能源','资金用于生产、建设和升级，能源用于机动及重建设施。行政城市与商贸中心产钱，陆地能源站与海上平台供能；己方回合开始结算。',{action:['drawer-details'],target:'[data-action="drawer-details"]'})]},
  C03:{title:'海陆协作',guide:'marine',steps:[
   step('浪锋带你出海','我是浪锋。普通舰船只能在海洋移动；陆战步兵与两栖轻坦可以上岸。当前海洋 / 陆地 / 空中状态决定地形和目标权限。'),
   step('陆战伙伴','点浪锋或涉潮看看形态。陆战步兵在陆地移动免能源，海上要能源；两栖轻坦也会随地形切换状态。不要把普通舰艇当作登陆部队。',{select:['marine','assaultmarine','amphibious']}),
   step('舰队与防空','潮刃驱逐舰压制海陆目标，云帆防空护卫舰还能攻击空中目标。没有明确防空能力的部队不能对空；不同舰艇射程不同。',{select:['navaldestroyer','aafrigate']}),
   step('船舰移动','点海上高亮格直接航行。普通舰艇不能进入陆地军港格；军港生产舰艇时，应把自动部署格设在邻接海洋。',{command:['move'],domain:'sea'}),
   step('军港的作用','军港按等级生产舰船、陆战与海上防空型号。它是有结构 HP 的核心设施；舰队保护航道，登陆伙伴负责接管岸上港口。',{building:['port']}),
   step('平台必须登格','海上能源平台提供能源，没有结构 HP 或驻军庇护。舰船要直接驶到平台本格，剩余 AP 自动完成占领；在旁边不能占领。',{capture:true})]},
  C04:{title:'航空与防空',guide:'tacticalrecon',steps:[
   step('望隼呼叫指挥部','我是望隼。直升机是轻型机动单位，战斗机负责制空，轰炸机对付海陆。空军能越过地形，但仍需合法空格、行动点和能源。'),
   step('扫描航路','选中望隼，雷达图标是主动扫描。它是自身技能，点一下立即生效，扩大视野；冷却按己方回合计算。',{select:['tacticalrecon'],target:'[data-action="intent-skill"]'}),
   step('试一次扫描','扫描不会攻击，能帮助发现目标。点技能后，不用再点自己的格子；其它需要目标的技能则要再点目标。',{command:['skill'],unitTypes:['tacticalrecon'],target:'[data-action="intent-skill"]'}),
   step('识别攻击权限','青隼等战斗机有对空能力；鸣雷等轰炸机只能攻击海洋和陆地目标，不能攻击空中单位。请在详情确认射程与权限。',{select:['lightfighter','lightbomber']}),
   step('防空保护航线','天幕与导弹防空单位能对空，专用防空型号遭直接攻击后满足条件可强化反击。普通坦克、炮兵与轰炸机无法攻击空中目标。',{select:['antiair'],target:'[data-action="drawer-details"]'}),
   step('机场与供能','机场升级逐步解锁高级航空型号；下单、取消与固定部署和其它生产设施一致。查看顶部能源，长距离飞行前先准备补给。',{building:['airfield']})]},
  C05:{title:'装甲、炮兵与庇护',guide:'tank',steps:[
   step('棱镜接管阵线','我是棱镜。主战坦克平衡火力与防护；弧光炮兵擅长远程，但有最小射程，贴身目标可能打不到。远近搭配，保留观察伙伴。'),
   step('穿甲弹','我的穿甲图标是一次忽略部分装甲的攻击，需要点合法目标。长钉狙击需本回合未移动，弧光震荡弹限制目标下一回合移动；每种图标对应自己的技能。',{select:['tank'],target:'[data-action="intent-skill"]'}),
   step('电子战支援','脉冲的干扰图标需要点距离 1—2、可见且射线通畅的敌军，使其下次回合只有 1 AP。技能有冷却，不能一直叠加。',{select:['jammer'],target:'[data-action="intent-skill"]'}),
   step('核心设施庇护','总部、步兵营、工厂、军港、机场有结构 HP。同格友方驻军被攻击时，设施分担四分之一伤害；一次攻击同时结算。城市、市场、能源据点没有 HP 或庇护。',{action:['drawer-details'],target:'[data-action="drawer-details"]'}),
   step('损毁与恢复','核心设施损毁后保留归属和等级，重建图标花资金与能源修到 50% HP。完好设施每个所属方回合开始按等级恢复最大 HP 的 5% / 7.5% / 10%。左下 HP 卡片可关闭。'),
   step('升级与授权','向上箭头升级设施：花资金、下一己方回合完成，高级生产保留低级型号；关卡授权可能限制最高等级与型号。被禁用的按钮可悬停或长按解释。',{command:['upgrade']}),
   step('经济设施有分工','行政城市收入高，商贸中心投入低；都可升级增加资金。它们不能生产、不能受结构攻击，也不保护驻军；对驻军的攻击仍会正常结算。',{building:['city','market']})]},
  C06:{title:'重装与联合作战',guide:'battleship',steps:[
   step('镇海已就位','我是镇海。重型舰炮需要足够距离；礁盾负责登陆，穹海保护对空，霄刃争取制空，天眼提供视野。用三军的不同优势补齐盲区。'),
   step('重装伙伴','选中磐石查看锚定防线：提高装甲并禁止移动，到下次己方回合开始结束。重装型号造价与能源需求更高；动作按钮只会展示主动技能。',{select:['heavy'],target:'[data-action="intent-skill"]'}),
   step('射程与反击','雷砧和镇海都有最小射程。攻击前可在电脑悬停预览结果，手机长按查看情报；反击也受射程、状态和剩余次数限制。',{select:['heavyartillery','battleship']}),
   step('补给与调度','部队按钮可定位伙伴，下一部队跳到还能行动的单位；小地图、缩放、总部定位帮助巡视。不要把所有总部守军都派走。',{action:['next-unit'],target:'[data-action="next-unit"]'}),
   step('建设按钮','自由演习的建设图标打开设施选择，选设施再点合法高亮格开工，资金立即支付，地基逐回合完成。教程关卡使用预置据点，不开放自由建设。',{action:['drawer-build'],target:'[data-action="drawer-build"]'}),
   step('记录与中断','菜单支持命名存档、读档与导出。离开战场自动保存，手机切到后台自动保存并暂停。记录面板只展示允许你观测的行动；无需一直盯着动画。',{action:['drawer-log'],target:'[data-action="drawer-log"]'})]},
  C07:{title:'综合指挥与毕业',guide:'jammer',steps:[
   step('脉冲为你整理战术','最后一课是协同：步兵省能源，装甲推进，炮兵压制，侦察开视野，防空护航，航空与登陆部队跨越障碍。先读本局目标，再分配任务。'),
   step('检查胜利条件','旗帜查看原始总部或全部登记建筑目标。本格占领才改变归属；摧毁 HP 不等于占领。可选目标影响记录，参谋提示能提供合法行动建议。',{action:['drawer-objectives'],target:'[data-action="drawer-objectives"]'}),
   step('八种技能图标','掩体、锚定、扫描是自身技能；穿甲、震荡、狙击、干扰、修复需要目标。技能结束单位行动；基础作战与驻守、伏击、防空反击自动生效。详情记载精确数值。',{action:['intent-skill'],target:'[data-action="intent-skill"]'}),
   step('随时查手册','问号打开操作帮助，菜单中的教程手册涵盖所有按钮、38 位型号伙伴、9 类设施，以及七课全文。说明不会泄露迷雾里的敌人位置。',{action:['tutorial-library','drawer-touchHelp'],target:'[data-action="drawer-touchHelp"]'}),
   step('自选教学方式','菜单“新手教程”开关立即生效，下次启动仍记得。重看当前关从第一条开始；每关进度独立保存，不影响存档、战术勋章或关卡解锁。',{action:['drawer-menu'],target:'[data-action="drawer-menu"]'}),
   step('准备独立指挥','用已学会的移动、攻击、占领、补给和技能完成枢纽交接。教程可跳过，不强迫指定路线。若卡住，目标或菜单的参谋提示与协同接管可以帮助继续剧情。')]}
 };
 // Every illustrated instrument also appears in the reference, including passive indicators.
 const buttons=[
  ['menu','指挥菜单','存档、教程开关、图鉴、声音设置与返回大厅。'],['pause','暂停','暂停 / 继续游戏与声音，电脑空格也可切换。'],['play','继续','从暂停或大厅返回当前对局。'],['army','部队 / 图鉴','列出己方部队并定位；菜单的图鉴可查看所有型号。'],['build','建设','自由演习选设施后点合法格开工；剧情使用预置设施。'],['flag','目标 / 占领','旗帜面板查看胜利条件；地图占领必须到建筑本格并有 AP。'],['log','记录 / 剧情回顾','查看本方可观测行动或已经确认的对白。'],['help','操作 / 参谋提示','查询指挥方式，任务中可查看当前合法行动建议。'],['info','详情','单位、设施与地形详细资料，手机按需打开。'],['undo','撤销移动 / 重试','撤销本回合连续移动；任务重试使用独立入口。'],['close','关闭 / 取消选择','X 或弹窗外关闭；取消技能选点不消耗 AP。'],['map','小地图','打开 / 收起地图，点击小地图定位。'],['next','下一部队','定位下一支还可行动的己方部队。'],['end','结束回合 / 确认对白','回合结束后让下一方行动；对白箭头确认本段剧情。'],['home','总部 / 大厅','战场定位总部；菜单返回大厅并自动保存。'],['overview','全图 / 展开字幕','战场拉远到全图；剧情中立即展开本段字幕。'],['zoomIn','放大','缩小地图视野范围。'],['zoomOut','缩小','扩大地图视野范围。'],['produce','生产','打开型号头像选择，点头像立即付资金下单。'],['upgrade','升级','资金升级、下一己方回合完成；等级与任务授权共同限制解锁。'],['deployment','部署格 / 移动','准星后选合法部署格；基础移动直接点地图即可。'],['repair','重建设施','己方损毁核心设施付资金与能源，重建到 50% HP。'],['cancel','取消订单','取消当前生产或升级，不退资金；仓库内容保留。'],['save','存档 / 读档','命名存档或查看自动、手动和回合起点存档。'],['export','导出','下载对局 JSON；在存档页可导入。'],['sound','声音','音效开关、音量、环境声与配乐设置。'],['money','资金','每己方回合收入；生产、建设与升级费用。'],['energy','能源','机械部队的机动能源；步兵陆地移动免能源。'],['shield','掩体 / 庇护','掩体技能提高地形防护；设施盾徽表示核心驻军庇护。'],['anchor','锚定防线','自身技能，增加装甲并禁止移动到下次己方回合。'],['scan','主动扫描','自身技能，视野 +2 到下次己方回合开始。'],['pierce','穿甲弹','选目标攻击，忽略 10 点装甲。'],['shock','震荡弹','选目标攻击，伤害减 10（至少 10），降低目标下回合移动预算。'],['sniper','定点狙击 / 攻击','狙击须本回合未移动，伤害 +20；基础攻击直接点敌人。'],['jam','链路干扰','选合法敌军，使其下回合只获得 1 AP。'],['skillRepair','应急修复','选相邻受损友军或己方结构设施，修复最多 40 HP，设施上限 50%。'],['mute','静音','关闭声音；再次开启后继续原有音量设置。']
 ];
 function create({ui,D,G,H,esc}){
  let enabled=true,progress={},lastSelection='',tab='lessons';
  try{const p=JSON.parse(root.localStorage.getItem(key)||'{}');enabled=p.enabled!==false;for(const [id,value] of Object.entries(p.progress||{}))if(lessons[id]&&Number.isInteger(value)&&value>=0)progress[id]=Math.min(value,lessons[id].steps.length);}catch{}
  const write=()=>{try{root.localStorage.setItem(key,JSON.stringify({version:1,enabled,progress}));}catch{}};
  const mission=()=>ui.game?.mission?.id;
  const active=()=>enabled&&ui.view==='game'&&lessons[mission()]&&!ui.busy&&!ui.paused&&!ui.dialog&&!ui.drawer&&!ui.choices&&!ui.touchMap&&!ui.game.result&&!ui.game.handoffRequired&&!ui.game.story?.queue.length&&!ui.game.story?.combatLocked&&ui.game.actor===ui.observer&&G.player(ui.game).controller==='local_human';
  const current=()=>lessons[mission()]?.steps[progress[mission()]||0];
  function advance(delta=1){const id=mission();if(!lessons[id])return;progress[id]=Math.max(0,Math.min(lessons[id].steps.length,(progress[id]||0)+delta));write();}
  function observe(){const s=ui.game,id=mission(),signature=`${id}:${ui.selected||''}:${ui.tile?H.key(ui.tile.q,ui.tile.r):''}`;if(signature===lastSelection)return;lastSelection=signature;if(!active())return;const st=current(),u=G.unit(s,ui.selected),b=ui.tile&&s.buildings.find(b=>b.q===ui.tile.q&&b.r===ui.tile.r);if(st?.select?.includes(u?.type)&&u.owner===s.actor||st?.building?.includes(b?.type)&&G.visible(s,s.actor,b))advance();}
  function command(command,{automatic=false,actor,events=[],domain,captured=false}={}){if(automatic||!enabled||!lessons[mission()]||actor!==ui.observer||G.player(ui.game,actor)?.controller!=='local_human')return;const st=current();if(!st)return;const u=G.unit(ui.game,command.unitId);if(st.unitTypes&&!st.unitTypes.includes(u?.type)||st.domain&&st.domain!==domain)return;if(st.command?.includes(command.kind)||st.capture&&(captured||events.some(e=>e.actor===actor&&e.buildingId&&['capture','first_capture_enemy_production_facility','first_capture_central_city'].includes(e.kind))))advance();}
  function signal(name){if(active()&&current()?.action?.includes(name))advance();}
  function toggle(value=!enabled){enabled=!!value;write();}
  function reset(){const id=mission();if(lessons[id]){progress[id]=0;enabled=true;lastSelection='';write();}}
  function status(id){return {enabled,index:progress[id]||0,total:lessons[id]?.steps.length||0};}
  function menu(){return `<section class="tutorial-settings"><h3>角色教学</h3><label class="toggle-setting"><input id="tutorial-enabled" type="checkbox" ${enabled?'checked':''}> 新手教程 · C01—C07</label><div class="actions">${root.GameIcons.button('help','教程手册',{action:'tutorial-library'})}${lessons[mission()]?root.GameIcons.button('undo','重看当前关教程',{action:'tutorial-replay'}):''}</div><small>开关与每关阅读进度保存在本机，不改变对局。</small></section>`;}
  function card(){if(!active())return '';const id=mission(),lesson=lessons[id],index=progress[id]||0,st=current();if(!st)return '';const I=root.GameIcons;return `<aside id="tutorial-coach" class="tutorial-coach" aria-label="角色教学" data-lesson="${id}" data-step="${index}" data-tutorial-target="${esc(st.target||'')}">${root.GameAnime.avatar(lesson.guide)}<div class="tutorial-copy"><div class="tutorial-caption"><strong>${esc(D.byId[lesson.guide].name)} · ${esc(st.title)}</strong><small>${id} ${index+1}/${lesson.steps.length}</small></div><p>${esc(st.text)}</p><div class="tutorial-actions">${I.button('undo','上一条教程',{action:'tutorial-prev',reason:index?'':'已经是第一条'})}${I.button('help','打开教程手册',{action:'tutorial-library'})}${I.button('end',index===lesson.steps.length-1?'完成本关教程':'下一条 / 跳过当前练习',{action:'tutorial-next'})}${I.button('close','关闭教程，可在菜单重新开启',{action:'tutorial-disable'})}</div></div></aside>`;}
  function decorate(){if(!active())return;const selector=current()?.target;if(selector)root.document.querySelector(selector)?.classList.add('tutorial-focus');}
  function unitText(d){return `${d.blurb} ${d.tactic} 标准基础 HP ${d.hp}，装甲 ${d.armor}，伤害 ${d.damage}。射程 ${d.minRange}—${d.maxRange}；移动 ${d.move}，视野 ${d.vision}；造价 ${d.cost}，${D.buildingById[d.facility].name} ${d.tier}级。${d.antiAir?'可对空、海、陆攻击。':'只对海、陆攻击。'}${d.amphibious?'可海陆切换；按当前状态适用地形与能耗。':d.branch==='navy'?'只能在海洋移动。':d.branch==='air'?'空中状态，可跨越地形，移动消耗能源。':d.energyPerStep===0?'陆地移动免能源。':`每格耗 ${d.energyPerStep} 能源。`} ${d.skill}：${d.id==='engineer'?'修复相邻友军或己方结构设施最多 40 HP，设施最多 50%；不能自修，技能结束行动。':d.skillText}`;}
  function buildingText(d){const core=d.id==='hq'||d.group==='production';return `${d.text} ${d.cost?`建设 ${d.cost} 资金。`:'场景预置，不可自由建造。'}最高 ${d.maxLevel}级${d.upgrades.length?`，升级费用 ${d.upgrades.join(' / ')} 资金`:''}。每己方回合资金 ${d.money.join(' / ')}、能源 ${d.energy.join(' / ')}（按等级）。${core?`结构 HP ${d.hp}、装甲 ${d.armor}，同格驻军由设施分担 25% 伤害；完好设施回合恢复 5% / 7.5% / 10%，损毁可付费重建至 50%。`:'收入据点，无结构 HP、无驻军庇护，不能生产。'}${d.group==='production'?'固定部署格有单位才入仓，FIFO 最多 3 支，格子空出自动部署队首；等级与任务授权限制型号。':''} 必须到本格且有行动点才能占领。`;}
  function library(){const I=root.GameIcons,tabs=[['lessons','七课全文','log'],['buttons','按钮图鉴','help'],['units','角色特性','army'],['buildings','设施效果','build']];let content='';if(tab==='buttons')content=buttons.map(([icon,title,text])=>`<article class="tutorial-reference">${I.svg(icon)}<div><h3>${esc(title)}</h3><p>${esc(text)}</p></div></article>`).join('')+'<p>额外操作：自由演习可申请 / 拒绝和局、投降；教程关可协同接管（不颁战术勋章）。长按或悬停按钮查看当前位置的具体说明。字幕箭头确认剧情，X 可保存退出；即时字幕与快速 AI 可在任务列表配置。</p>';else if(tab==='units')content=D.units.map(d=>`<article class="tutorial-reference">${root.GameAnime.avatar(d.id)}<div><h3>${esc(d.name)} · ${esc(d.type)}</h3><p>${esc(unitText(d))}</p></div></article>`).join('');else if(tab==='buildings')content=D.buildings.map(d=>`<article class="tutorial-reference"><svg class="tutorial-building" viewBox="-50 -50 100 100" aria-hidden="true">${root.GameArt.buildingMarkup(d.id,'union',1)}</svg><div><h3>${esc(d.name)}</h3><p>${esc(buildingText(d))}</p></div></article>`).join('');else content=Object.entries(lessons).map(([id,l])=>`<details class="tutorial-lesson" ${id===mission()?'open':''}><summary>${id} · ${esc(l.title)} · ${esc(D.byId[l.guide].name)} · ${status(id).index}/${l.steps.length}</summary>${l.steps.map(s=>`<h3>${esc(s.title)}</h3><p>${esc(s.text)}</p>`).join('')}</details>`).join('');return `<nav class="tutorial-tabs" aria-label="教程手册分类">${tabs.map(([id,label,icon])=>`<button type="button" class="${id===tab?'active':''}" data-action="tutorial-tab-${id}" aria-label="${label}" aria-pressed="${id===tab}">${I.svg(icon)}<span>${label}</span></button>`).join('')}</nav><div class="tutorial-library">${content}</div>`;}
  const api={active,current,observe,command,signal,toggle,reset,status,menu,card,decorate,library,advance,setTab(value){if(['lessons','buttons','units','buildings'].includes(value))tab=value;},unitText,buildingText};return api;
 }
 const api={create,lessons,buttons,key};root.GameTutorial=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
