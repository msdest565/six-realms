'use strict';
const fs=require('node:fs'),path=require('node:path');
const D=require('../src/data.js'),H=require('../src/hex.js'),E=require('../src/economy.js');
const root=path.join(__dirname,'..','docs');
fs.mkdirSync(root,{recursive:true});
const range=u=>u.minRange===u.maxRange?String(u.minRange):u.minRange+'–'+u.maxRange;
const fuel=u=>u.seaOil===undefined?String(u.oil):'陆 '+u.oil+' / 海 '+u.seaOil;
const signed=n=>n>0?'+'+n:String(n);
const label=u=>u.type+'（'+u.name+'）';
const group=u=>u.system?D.systemById[u.system].name:'特殊·'+u.specialRole;
const level=u=>u.system?D.levels[u.modelLevel]:'特殊 / 解锁'+u.tier+'级';
const row=values=>'| '+values.join(' | ')+' |';
const write=(name,lines)=>fs.writeFileSync(path.join(root,name),lines.join('\n')+'\n','utf8');
const counts=Object.fromEntries(Object.keys(D.branches).map(b=>[b,D.units.filter(u=>u.branch===b).length]));
const special=D.units.filter(u=>!u.system),main=D.units.filter(u=>u.system);
const seriesRows=D.systems.map(s=>row([D.branches[s.branch],s.name,...[1,2,3].map(n=>label(D.units.find(u=>u.system===s.id&&u.modelLevel===n)))])).join('\n');
const seriesTable=['| 军种 | 体系 | Ⅰ级·基础型 | Ⅱ级·主力型 | Ⅲ级·强化型 |','|---|---|---|---|---|',seriesRows].join('\n');
const specialRows=special.map(u=>row([D.branches[u.branch],label(u),u.specialRole,D.buildingById[u.facility].name+' Lv.'+u.tier,u.cost,u.buildTurns])).join('\n');
const unitRows=D.units.map(u=>row([label(u),D.branches[u.branch],group(u),u.modelLevel||'—',u.cost,fuel(u),D.buildingById[u.facility].name+' '+u.tier,u.buildTurns,u.hp,u.armor,u.move,range(u),u.vision,u.damage,signed(u.bonusLight),signed(u.bonusArmor),signed(u.bonusAir)])).join('\n');
const limits='当前试验台已支持单位档案、招募、部署、移动、实际扣油、普通攻击与通用占领。反击、主动技能、自动防空拦截、战争迷雾、敌方AI、建筑破坏、胜负和存档尚未实现。数值是首轮测试初值，规则验证不代表完成完整对局平衡。';
const specialTable=['| 军种 | 单位 | 用途 | 设施解锁 | 金钱 | 生产回合 |','|---|---|---|---|---:|---:|',specialRows].join('\n');
write('单位体系与等级划分-v0.4.md',[
'# 《六域：边境交锋》单位体系与等级划分 v0.4','',
'日期：2026-10-08。十个主体体系各有Ⅰ／Ⅱ／Ⅲ三个型号，另有'+special.length+'种独立特殊单位，共'+D.units.length+'种。所有型号已补入src/data.js，生产、档案和SVG共用该数据。本文件由scripts/export-design.js自动生成。','',
'## 等级定义','',
'| 型号等级 | 定位 | 取舍 |','|---|---|---|',
'| Ⅰ级·基础型 | 早期提供核心功能 | 低价格、低门槛，适合应急补充 |',
'| Ⅱ级·主力型 | 常规编队骨干 | 核心职责更高效，兼顾投入与产出 |',
'| Ⅲ级·强化型 | 后期高投入任务 | 防护、火力或部署能力更强，承担成本、油耗或机动代价 |','',
'型号等级与生产设施要求对应，不是经验军衔，也不会自动升级场上部队。特殊单位仅显示设施解锁要求，不另设三个虚构型号。生产时间为独立字段buildTurns；各级不要求每项属性都增加。高级设施保留低级型号。','',
'## 完整体系表','',seriesTable,'',
'## 共同职责','',D.systems.map(s=>'- **'+D.branches[s.branch]+' / '+s.name+'**：'+s.text).join('\n'),'',
'全部38种单位都有占领能力，总部不再例外。占领本格或相邻格建筑花费1 AP并结束行动，需要先清除建筑内任一图层的敌军。舰船可从相邻海洋格接管沿岸建筑；飞机可从空中接管。陆战队仍保留登陆与免油优势；两栖轻坦独立提供装甲支援，反坦克步兵独立为Ⅱ级特殊单位。','',
'陆地防空和海洋防空是专门对空序列；驱逐舰和巡洋舰保留多用途防空。防空射程表示主动攻击范围，当前不存在对附近友军的自动拦截。战列舰仍不能对空；不能按Ⅲ级标记推断其继承所有低阶武器。','',
'## 防空数值','',
'| 体系 | 型号 | 金钱 | HP | 装甲 | 移动 | 射程 | 油/格 | 基伤 | 对空加成 | 对苍隼伤害 |',
'|---|---|---:|---:|---:|---:|---|---:|---:|---:|---:|',
D.units.filter(u=>['landaa','navalaa'].includes(u.system)).map(u=>row([group(u),level(u)+' '+label(u),u.cost,u.hp,u.armor,u.move,range(u),fuel(u),u.damage,signed(u.bonusAir),H.damage(u,D.byId.fighter,{terrain:'plain'}).value])).join('\n'),'',
'对苍隼伤害按无技能、无反击计算，空中目标不享受下方地形减伤。专门防空单位对陆、对海的火力较低，需主战部队保护。','',
'## 特殊单位','',specialTable,'',
'## 规模与学习方式','',
'主体型号'+main.length+'种，特殊单位'+special.length+'种；陆军'+counts.army+'、海军'+counts.navy+'、空军'+counts.air+'，共'+D.units.length+'种。相较v0.2保留原21种，补充17种。天幕从工厂Ⅱ级提前至Ⅰ级，猎矛从兵营Ⅲ级提前至Ⅱ级。','',
'单位界面先显示通用兵种，再显示代号；可按军种、体系和等级筛选，特殊单位单独分组。新型号复用体系核心规则，不为每个等级增加新的资源、弹药或主动操作。','',limits
]);
const details=D.units.map(u=>[
'### '+u.code+' '+label(u),'',
'- 分类：'+D.branches[u.branch]+' / '+group(u)+' / '+level(u)+'；伤害类别为'+(u.category==='armored'?'装甲':'轻型')+'。',
'- 职责：'+u.role+'。'+u.strengths,
'- 生产：'+D.buildingById[u.facility].name+' Lv.'+u.tier+'；'+u.cost+'金钱，'+u.buildTurns+'回合。',
'- 数值：HP '+u.hp+'；装甲'+u.armor+'；移动'+u.move+'；射程'+range(u)+'；视野'+u.vision+'；基伤'+u.damage+'。',
'- 移动：'+(u.branch==='air'?'始终为空中状态，可跨越地形。':u.amphibious?'海洋可航行，陆地可登陆，状态随位置切换。':u.branch==='navy'?'仅在海洋移动，不能上岸。':'地表移动，不能进入海洋。')+'油耗'+fuel(u)+'/进入格。'+(u.infantry?'步兵全程免油。':''),
'- 火力：对轻型'+signed(u.bonusLight)+'；对装甲'+signed(u.bonusArmor)+'；对空额外'+signed(u.bonusAir)+'；对陆额外'+signed(u.bonusLand)+'；对海额外'+signed(u.bonusSea)+'。',
'- 攻击权限：'+u.targets.map(t=>D.states[t]).join('、')+'。'+(u.indirect?'间接火力越过遮挡。':'直射火力，地表对地表检查射线。')+(u.fireAfterMove===false?'移动后不能攻击。':''),
'- 占领：可占领本格或相邻格的全部建筑，包括总部；花费1 AP并结束行动，建筑内有敌军时先清除守军。',
'- 反击设计：'+(u.counter?'可进行一次半伤反击':'不能反击')+'；反击尚未执行。',
'- 弱点：'+u.weakness,'- 配合：'+u.tactic,'- 轮廓：'+u.silhouette+'。',
'- 技能设计「'+u.skill+'」：'+u.skillText+'主动技能与被动加成均尚未执行。',''
].join('\n')).join('\n');
write('单位设计-v0.4.md',[
'# 《六域：边境交锋》单位设计 v0.4','',
'日期：2026-10-08。'+D.units.length+'种单位、十个三级体系、八种特殊单位。本文件从src/data.js自动导出，运行界面、生产和文档同源。','',
'## 分类与解锁','',seriesTable,'',
'完整等级表与特殊单位见[单位体系与等级划分](单位体系与等级划分-v0.4.md)。型号等级是装备层级，设施等级是生产门槛，经验军衔尚未引入。','',
'## 完整数值表','',
'| 单位 | 军种 | 体系/用途 | 型号级 | 金钱 | 油/格 | 设施/等级 | 生产回合 | HP | 装甲 | 移动 | 射程 | 视野 | 基伤 | 对轻型 | 对装甲 | 对空额外 |',
'|---|---|---|---:|---:|---|---|---:|---:|---:|---:|---|---:|---:|---:|---:|---:|',unitRows,'',
'## 通用规则','',
'步枪步兵采用80 HP、0装甲、30固定基础伤害，落在20–40的设计范围内；暂不引入随机伤害。单位生命、装甲、基础伤害、目标加成、地形减伤和后续技能效果统一使用10点步长。详见[数值设计与交战示例](数值设计-v0.4.md)。','',
'军种用于组织和生产；当前状态按位置与图层分为陆地、海洋、空中。两栖步兵与轻坦登陆后变为陆地状态；飞机始终为空中状态。所有单位允许攻击陆地和海洋；只有antiAir为true的单位可以对空。权限通过后仍检查最小/最大射程和视线。','',
'伤害=max(10,基伤+对轻型或装甲加成+对当前状态加成−装甲−地形减伤)。空中目标不享受地形减伤；当前生命不改变火力。攻击本身不耗油，移动按实际进入格扣油。','',
'每单位2 AP；移动花1 AP，攻击或占领花1 AP后结束行动。三个等级炮兵均配置fireAfterMove=false，移动后不能攻击；战列舰保留移动后炮击能力。所有步兵免油，普通舰船不能登陆。','',
'## 单位档案','',details,'## 验证边界','',limits
]);
const buildRows=D.buildings.map(b=>row([b.name,b.cost||'场景预设',b.upgrades[0]||'—',b.upgrades[1]||'—',b.money.join(' / '),b.oil.join(' / '),b.hp+' / '+b.armor,b.place])).join('\n');
const unlockRows=D.buildings.filter(b=>b.group==='production').map(b=>row([b.name,...[1,2,3].map(n=>D.units.filter(u=>u.facility===b.id&&u.tier===n).map(u=>group(u)+'：'+label(u)).join('；'))])).join('\n');
const gain=E.income(E.createState());
write('经济与建筑设计-v0.4.md',[
'# 《六域：边境交锋》经济与建筑设计 v0.4','',
'日期：2026-10-08。经济成本与收益保持原值，建筑耐久与装甲统一到新战斗量级，支持通用占领和38种单位生产；由共享数据自动导出。','',
'## 资源与编制','',
'初始'+D.economy.initialMoney+'金钱、'+D.economy.initialOil+'石油；上限'+D.economy.moneyCap+'金钱、'+D.economy.oilCap+'石油。单位上限'+D.economy.unitCap+'，包括场上存活单位、库存和生产订单。工作台初始收入'+gain.money+'金钱、'+gain.oil+'石油/回合。','',
'金钱支付建造、升级与单位生产；石油只用于实际移动。所有步兵免油；两栖轻坦陆地每格1油、海洋每格2油；无油时非步兵无法移动，但仍可攻击。暂不加入维护费、弹药、独立油箱或强制返航。','',
'## 建筑数值','',
'收益按Ⅰ/Ⅱ/Ⅲ级顺序；HP与装甲为后续建筑破坏方案，当前尚未执行。','',
'| 建筑 | 建造金钱 | 1→2 | 2→3 | 每回合金钱 | 每回合石油 | HP/装甲 | 地块 |',
'|---|---:|---:|---:|---|---|---|---|',buildRows,'',
'## 完整生产解锁','',
'| 设施 | Ⅰ级新增 | Ⅱ级新增 | Ⅲ级新增 |','|---|---|---|---|',unlockRows,'',
'天幕在一级工厂解锁，猎矛在二级兵营解锁。高级设施保留低级型号。生产时间由各单位buildTurns配置；当前基础和主力型号一般1回合、强化型号2回合，与设施门槛分开维护。','',
'## 订单与结算','',
'1. 提交前检查设施、等级、空闲槽、单位上限和金钱；失败不扣款。',
'2. 每座设施一个槽，升级和生产互斥。提交时一次支付金钱；建造、升级各1回合。',
'3. 推进己方试验回合先按旧等级结算收入，再减少订单时间并完成订单。',
'4. 成品进入库存；部署到设施或合法邻格，按地表/空中层分别检查占位。部署不耗油，获得2 AP。',
'5. 无合法部署格则保留库存，继续计入编制。新建和升级建筑从后一次收入结算开始提供新收益。','',
'工作台每类建筑有一个初始预留地块；占领可增加同类建筑实例。各实例独立升级、生产与收益。自由建设多座同类建筑、敌方回合和订单损毁仍待实现。','',
'## 后续建筑控制','',
'全部单位可占领所有建筑，包括总部。需要位于本格或相邻格，且建筑内无存活敌军；花费1 AP后结束行动。占领保留等级，转移归属，收益从下一次结算发放，生产设施可立即使用独立生产槽。库存记录来源设施，成品部署到实际生产设施或合法邻格。试验台敌方设施没有运行中的订单与库存。建筑受损与总部胜负仍待实现；后续建筑按装甲类别受击，油井属于海洋状态，其他建筑属于陆地状态。','',limits
]);
write('美术设计-v0.4.md',[
'# 《六域：边境交锋》美术设计 v0.4','',
'单位38种，双方各一套配色，共76个单位SVG；地形8个、建筑75个，总计159个SVG。由src/art.js绘制，运行scripts/export-assets.js导出。','',
'主体型号显示一至三条等级标记，特殊单位不显示型号等级条。通用兵种名优先于代号。步兵以编队和护甲区分，炮兵以轮架、履带、炮管与稳定支架区分，防空车以雷达和导弹箱区分；防空舰使用雷达与导弹阵列，区别于主炮舰。侦察机突出机翼和观察镜，战斗机采用后掠翼与发动机，轰炸机采用平直翼和发动机阵列。','',
'陆战队在海洋显示登陆艇，在陆地显示步兵；两栖轻坦保持浮力侧舱。联合军青绿圆环，防卫军珊瑚红三角。画布100×100，透明背景，无外部图像依赖。','',
'新增SVG已覆盖全部型号；概念图继续使用既有battlefield-v2.png作为氛围参考，精确格位以棋盘为准。'
]);
write('策划方案-v0.4.md',[
'# 《六域：边境交锋》策划方案 v0.4','',
'日期：2026-10-08。延续v0.2六边形沿岸战略、双资源、同构阵营、确定伤害和双图层规则。完整地图与敌方回合仍待实现。','',
'本版落实38种单位：陆军17、海军11、空军10。主体体系为步兵、装甲车、炮兵、陆地防空、船舰、海军陆战队、海洋防空、侦察、战斗、轰炸，每体系三级；另有8种特殊单位。','',
'[体系与等级表](单位体系与等级划分-v0.4.md)；[全部单位数值与档案](单位设计-v0.4.md)；[经济与生产解锁](经济与建筑设计-v0.4.md)；[美术资产](美术设计-v0.4.md)。','',
'38种单位均已接入生产、部署、普通攻击、通用占领、档案、筛选及SVG导出。炮兵的移动后射击限制由单位规则字段统一执行，生产时间由独立字段统一执行。防空与战斗机按显式权限对空；地面与海洋普通攻击权限保持一致。','',
'战斗数值重新以步枪步兵80 HP、0装甲、30基础伤害为锚点；生命、装甲、基础伤害与目标加成采用10点步长。地形减伤为10/20，最低伤害10；单位成本、机动与设施门槛保持。所有单位可以占领包括总部在内的建筑。海洋防空解释为专门防空舰序列，不是反潜或制海序列。','',
'完整标准局仍以18–24轮、35–50分钟为待验证目标；通用占领已完成；后续先完成双方回合、反击、建筑耐久与胜负，再验证迷雾下侦察、舰队护航和经济节奏。详细既有地图、回合与建筑方案见历史策划方案-v0.2.md。','',limits
]);
console.log('Exported v0.4 design: '+D.units.length+' units, '+D.systems.length+' complete series, '+special.length+' specials.');
const duelPairs=[
['infantry','infantry','plain'],['walker','infantry','plain'],['infantry','tank','plain'],
['antitank','tank','plain'],['antitank','tank','ruins'],['destroyer','tank','plain'],
['tank','heavy','plain'],['heavy','tank','plain'],['artillery','tank','plain'],
['heavyartillery','heavy','plain'],['antiair','fighter','plain'],['longrangeaa','fighter','plain'],
['aafrigate','fighter','ocean'],['areaaship','bomber','ocean'],['fighter','bomber','plain'],
['bomber','heavy','plain'],['battleship','cruiser','ocean'],['submarine','navaldestroyer','ocean']
];
write('数值设计-v0.4.md',[
'# 《六域：边境交锋》数值设计 v0.4','',
'日期：2026-10-08。38种单位的战斗数值已重新设计；完整逐单位表见[单位设计](单位设计-v0.4.md)。','',
'## 基准与步长','',
'- 步枪步兵：80 HP、0装甲、30固定基础伤害。30位于20–40范围内，攻击预览和实际结算一致，没有随机波动。',
'- 生命采用10点步长：轻型观察单位60–100，主力步兵100–160，主战装甲160–220，重型舰船最高300。',
'- 装甲采用固定减伤，0／10／20／30／40；不是百分比。重型舰船与坦克仍可被专业反装甲火力有效打击。',
'- 基础伤害20–100，目标类别与陆海空状态加成按10点步长配置。专门防空依靠对空加成，反坦克依靠对装甲加成。',
'- 碎石减伤10，工业废墟减伤20；最低伤害10，空中目标不享受地形减伤。',
'- 建筑方案的HP与装甲、修复40 HP、穿甲10、锚定装甲+20、狙击伤害+20等技能设计同步量级；建筑受损和技能仍未执行。',
'- 移动、射程、视野、AP、油耗、成本和生产回合各有自己的单位，不乘十。','',
'## 结算公式','',
'实际伤害=max(10,基础伤害+对轻型或装甲加成+对当前陆海空状态加成−目标装甲−目标地形减伤)。只选用一种目标类别加成和一种状态加成。最后按目标剩余HP截断，避免显示超额伤害。','',
'## 代表性交战','',
'以下为满血目标、固定位置、无技能、无反击、无修复的单次攻击。所需攻击次数只用于比较火力，不能当作完整对局的击杀回合数。','',
'| 攻击者 | 目标 | 地形 | 基伤 | 总加成 | 装甲 | 地形减伤 | 每次伤害 | 目标HP | 所需攻击次数 |',
'|---|---|---|---:|---:|---:|---:|---:|---:|---:|',
duelPairs.map(([a,b,t])=>{const attacker=D.byId[a],target=D.byId[b],d=H.damage(attacker,target,{terrain:t});return row([label(attacker),label(target),D.terrain[t].name,d.base,signed(d.bonus),d.armor,d.defense,d.value,target.hp,Math.ceil(target.hp/d.value)]);}).join('\n'),'',
'## 取舍与后续平衡','',
'步兵保持廉价、免油；轻型武器对坦克低效，需要反坦克支援。主战与重型单位增加生命和装甲，但承担更高成本、油耗或更低机动。侦察与工程单位以支援和机动为主。防空专长体现为对空输出，不能替代主战坦克与主炮舰。','',
'占领现为所有单位的通用能力，不能再用“能占领／不能占领”作为兵种差异；步兵的优势来自价格、免油与地面生存，陆战队的优势来自登陆。','',
'上述数值是可以运行的初始设计，仍需完整对局验证经济效率、集火和控制地图的节奏；反击、技能、战争迷雾和胜负尚未加入结算。'
]);
