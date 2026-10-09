(() => {
  'use strict';
  const D = window.GameData, A = window.GameArt, H = window.HexRules, E = window.EconomyRules;
  const $ = id => document.getElementById(id);
  const cells = H.makeMap(), cellMap = new Map(cells.map(c => [H.key(c.q,c.r),c]));
  const at = (col,r) => cells.find(c => c.col===col && c.r===r);
  const rangeText = u => u.minRange===u.maxRange?String(u.minRange):`${u.minRange}–${u.maxRange}`;
  const bonusText = n => n>0?`+${n}`:String(n);
  let army = [], selectedId = 'union-tank', mode = 'move', reach = new Map(), pendingTarget = null;
  let archiveSide = 'union', filter = 'all', systemFilter='all', levelFilter='all', toastTimer, mapLayer='surface', buildingFilter='all';
  let economy=E.createState(), serial=0;
  const chosenProducts={};
  const oilText=u=>u.oil===0?'免油':u.seaOil!==undefined?`${u.oil} 陆 / ${u.seaOil} 海`:`${u.oil} / 格`;
  const classText=u=>u.system?`${D.systemById[u.system].name} · ${D.levels[u.modelLevel]}`:`特殊 · ${u.specialRole}`;
  const unitLabel=u=>`${u.type}（${u.name}）`;
  const productionLabel=u=>`${u.system?D.systemById[u.system].name:'特殊'} · ${u.type} · ${u.cost} 金钱 · ${u.buildTurns} 回合`;

  function initialArmy() {
    const placements = [
      ['union','tank',3,4],['union','infantry',2,5],['union','walker',4,4],['union','artillery',1,4],
      ['union','marine',3,2],['union','amphibious',4,2],['union','navaldestroyer',2,1],
      ['union','helicopter',1,6],['union','fighter',3,1],['union','bomber',1,7],
      ['red','tank',9,4],['red','infantry',10,5],['red','walker',8,4],['red','artillery',11,4],
      ['red','marine',9,2],['red','amphibious',8,2],['red','navaldestroyer',10,1],
      ['red','helicopter',11,6],['red','fighter',9,1],['red','bomber',11,7]
    ];
    return placements.map(([side,type,col,r]) => {const c=at(col,r);return {id:`${side}-${type}`,type,side,q:c.q,r:c.r,hp:D.byId[type].hp,ap:2,moved:false};});
  }
  const selected = () => army.find(u => u.id===selectedId && u.hp>0);
  const unitAt = (c,wantedLayer=mapLayer) => army.find(u => u.q===c.q && u.r===c.r && u.hp>0 && H.layer(D.byId[u.type])===wantedLayer);
  const tileOf = u => cellMap.get(H.key(u.q,u.r));
  function notify(message) { $('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),2600); }
  function log(message) { $('log-text').textContent=message; }

  function showPage(id, scroll=true) {
    if(!['overview','units','economy','art','roadmap'].includes(id))id='overview';
    document.querySelectorAll('.page').forEach(el=>el.hidden=el.id!==id);
    document.querySelectorAll('.tab').forEach(el=>{const active=el.dataset.page===id;el.classList.toggle('active',active);el.setAttribute('aria-selected',String(active));el.tabIndex=active?0:-1;});
    if(location.hash!==`#${id}`) history.replaceState(null,'',`#${id}`);
    if(scroll)window.scrollTo({top:0,behavior:'instant'});
  }
  document.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>showPage(b.dataset.page)));
  document.querySelectorAll('[data-goto]').forEach(b=>b.addEventListener('click',()=>showPage(b.dataset.goto)));
  window.addEventListener('hashchange',()=>showPage(location.hash.slice(1)));
  document.querySelector('.brand').addEventListener('click',()=>showPage('overview'));
  document.querySelector('.tabs').addEventListener('keydown',e=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
    e.preventDefault();const tabs=[...document.querySelectorAll('.tab')],current=tabs.indexOf(document.activeElement);
    const n=e.key==='Home'?0:e.key==='End'?tabs.length-1:(current+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
    showPage(tabs[n].dataset.page,false);tabs[n].focus();
  });
  $('enter-sandbox').addEventListener('click',()=>$('sandbox-heading').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}));

  function makeHeroArt() {
    let hexes='';for(let r=0;r<5;r++)for(let c=0;c<7;c++)hexes+=`<g transform="translate(${c*77+(r%2)*38+12},${r*66+35})">${A.terrainMarkup((r+c)%7===0?'rubble':(r+c)%5===0?'ruins':'plain',44,r*7+c)}</g>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 360"><rect width="560" height="360" fill="#1e352b"/>${hexes}<g transform="translate(220 84) scale(1.8)">${A.unitMarkup('tank')}</g><g transform="translate(108 215) scale(.85)">${A.unitMarkup('scout')}</g><g transform="translate(415 56) scale(.85)">${A.unitMarkup('destroyer','red')}</g></svg>`;
  }
  $('hero-fallback').innerHTML=makeHeroArt();$('art-fallback').innerHTML=makeHeroArt();

  function renderBoard() {
    const s=selected(), spec=s?D.byId[s.type]:null;
    reach=s&&s.ap>0?H.reach(s,spec,cells,army,{oil:economy.oil}):new Map();
    const showRange=$('show-range').checked, showCoords=$('show-coords').checked;
    $('battlefield').innerHTML=cells.map(c=>{
      const p=H.position(c,44),x=p.x+84,y=p.y+63,k=H.key(c.q,c.r),u=unitAt(c),isSelected=u&&u.id===selectedId;
      const canMove=showRange&&mode==='move'&&reach.has(k);
      const rangeTarget=u||{...c,state:mapLayer==='air'?'air':c.terrain==='ocean'?'sea':'land'};
      const inFire=showRange&&mode==='attack'&&s&&s.ap>0&&H.canAttack(s,rangeTarget,spec,cells).ok;
      const canCapture=showRange&&mode==='capture'&&s&&H.canCapture(s,c,spec,army).ok;
      let overlay='';
      if(canMove)overlay=`<polygon class="range-overlay" points="${A.hexPoints(41)}" fill="#68d9bc10" stroke="#68d9bc" stroke-opacity=".45" stroke-width="1.5"/><circle cy="26" r="2.3" fill="#68d9bc" opacity=".8"/>`;
      if(canCapture)overlay=`<polygon class="range-overlay" points="${A.hexPoints(41)}" fill="#e3c98918" stroke="#e3c989" stroke-width="2"/>`;
      if(inFire&&!isSelected)overlay=`<polygon class="range-overlay" points="${A.hexPoints(41)}" fill="#ef8a7809" stroke="#ef8a78" stroke-opacity=".55" stroke-width="1.4" stroke-dasharray="4 4"/>${u&&u.side==='red'?'<path d="M-9 0H9M0-9V9" stroke="#ef8a78" stroke-width="2"/>':''}`;
      if(isSelected)overlay+=`<polygon class="range-overlay" points="${A.hexPoints(42)}" fill="none" stroke="#ecf0e7" stroke-width="2.4"/><polygon class="range-overlay" points="${A.hexPoints(37)}" fill="none" stroke="#ecf0e7" stroke-opacity=".2"/>`;
      if(pendingTarget&&u&&u.id===pendingTarget.id)overlay+=`<polygon class="range-overlay" points="${A.hexPoints(38)}" fill="none" stroke="#ef8a78" stroke-width="2.4"/>`;
      let building=c.building?A.buildingMarkup(c.building,c.owner,c.level||1):'';
      if(u&&c.building)building=`<circle cx="25" cy="-25" r="6" fill="#e3c989"/><text x="25" y="-22" text-anchor="middle" font-size="8" fill="#172b21">${c.building==='node'?'◈':'▣'}</text>`;
      const image=u?`<g class="unit-image" transform="translate(-29 -33) scale(.58)">${A.unitMarkup(u.type,u.side,H.domain(D.byId[u.type],c))}</g><g transform="translate(-17 29)"><rect width="34" height="3" rx="1" fill="#091915"/><rect width="${34*u.hp/D.byId[u.type].hp}" height="3" rx="1" fill="${D.factions[u.side].accent}"/></g>${u.side==='union'?`<circle cx="-29" cy="-24" r="4" fill="none" stroke="#68d9bc" stroke-width="2"/>`:`<path d="M-29-29l5 9h-10z" fill="none" stroke="#ef8a78" stroke-width="2"/>`}`:'';
      const other=unitAt(c,mapLayer==='air'?'surface':'air');
      const otherBadge=other?`<circle cx="28" cy="23" r="7" fill="#142b29" stroke="${D.factions[other.side].accent}"/><text x="28" y="26" text-anchor="middle" font-size="9" fill="${D.factions[other.side].accent}">${mapLayer==='air'?'▣':'✈'}</text>`:'';
      const label=showCoords?`<text y="${u||c.building?39:5}" text-anchor="middle" font-size="8" fill="#a4b9a7">${c.q},${c.r}</text>`:'';
      const unitLabel=u?`，${D.factions[u.side].short}${D.byId[u.type].name}，生命${u.hp}`:'';
      const buildingLabel=c.building?`，${D.factions[c.owner]?.short||'中立'}${D.buildingById[c.building].name} Lv.${c.level}`:'';
      return `<g class="hex-cell" data-key="${k}" transform="translate(${x} ${y})" role="button" tabindex="0" aria-label="坐标 ${c.q},${c.r}，${D.terrain[c.terrain].name}${unitLabel}${buildingLabel}">${A.terrainMarkup(c.terrain,44,c.col*9+c.r)}${building}${overlay}${image}${otherBadge}${label}<polygon class="hit-target" points="${A.hexPoints(43)}"/></g>`;
    }).join('');
    $('battlefield').querySelectorAll('.hex-cell').forEach(el=>{
      const c=cellMap.get(el.dataset.key);
      el.addEventListener('click',()=>clickCell(c));
      el.addEventListener('pointerenter',()=>previewCell(c));
      el.addEventListener('focus',()=>previewCell(c));
      el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();clickCell(c);}});
    });
  }
  function renderInspector() {
    const s=selected();if(!s)return;const u=D.byId[s.type];
    $('selected-code').textContent=u.code;$('selected-art').innerHTML=A.unitSvg(u.id,s.side,'',H.domain(u,tileOf(s)));
    $('selected-name').textContent=u.name;$('selected-role').textContent=`${D.states[H.domain(u,tileOf(s))]} / ${classText(u)} / ${u.type}`;
    $('selected-hp').textContent=`${s.hp} / ${u.hp}`;$('health-fill').style.width=`${s.hp/u.hp*100}%`;
    $('ap-indicators').innerHTML=[0,1].map(n=>`<span class="ap-dot ${n<s.ap?'filled':''}" aria-label="${n<s.ap?'可用':'已用'}行动点"></span>`).join('');
    $('selected-stats').innerHTML=[['移动',u.move],[u.system==='recon'?'视野':'射程',u.system==='recon'?u.vision:rangeText(u)],['油 / 格',u.oil===0?'0':u.seaOil?`${u.oil}/${u.seaOil}`:u.oil]].map(([name,value])=>`<div><span>${name}</span><b>${value}</b></div>`).join('');
    $('mode-move').classList.toggle('active',mode==='move');$('mode-move').setAttribute('aria-pressed',String(mode==='move'));
    $('mode-attack').classList.toggle('active',mode==='attack');$('mode-attack').setAttribute('aria-pressed',String(mode==='attack'));
    $('mode-capture').classList.toggle('active',mode==='capture');$('mode-capture').setAttribute('aria-pressed',String(mode==='capture'));
    $('mode-move').disabled=s.ap===0;$('mode-attack').disabled=s.ap===0;$('mode-capture').disabled=s.ap===0;
    defaultPreview();
  }
  function defaultPreview() {
    const s=selected();if(!s)return;const u=D.byId[s.type];
    $('board-hint').textContent=mode==='move'?'选择友军，再点击高亮格移动。':mode==='capture'?'点击金色高亮建筑，确认占领。':'点击敌军预览，再确认攻击。';
    if(mode==='capture'&&s.ap>0){$('target-preview').innerHTML='<strong>占领建筑 / 花费 1 AP</strong>所有单位都可占领本格或相邻格建筑，包括总部。需要先清除建筑内的敌军；占领后结束行动。';return;}
    $('target-preview').innerHTML=s.ap===0?'<strong>本单位已结束行动</strong>选择其他友军，或推进试验回合。':mode==='move'?`<strong>移动 ${u.move} / ${oilText(u)}</strong>剩余石油 ${economy.oil}。范围已按地形、占位和石油筛选。${u.amphibious?'<br>可以在海洋与陆地之间移动。':''}${u.branch==='navy'&&!u.amphibious?'<br>普通舰船只能进入海洋。':''}`:`<strong>攻击射程 ${rangeText(u)} / 花费 1 AP</strong>攻击目标：${u.targets.map(t=>({land:'陆地',sea:'海洋',air:'空中'})[t]).join('、')}。点击敌军预览，再确认。<br>切换地图图层可选择另一层的目标。`;
  }
  function previewCell(c) {
    if(pendingTarget)return;const s=selected();if(!s||s.ap===0)return;
    const target=unitAt(c),t=D.terrain[c.terrain];
    if(mode==='capture'){renderCapturePreview(c,false);return;}
    if(mode==='move') {
      if(target){$('target-preview').innerHTML=`<strong>${D.byId[target.type].name} · ${target.side==='union'?'友军':'敌军'}</strong>${t.name}，减伤 ${t.defense}。${target.side==='union'?'点击可切换选择。':'切换攻击模式查看伤害。'}`;return;}
      const route=reach.get(H.key(c.q,c.r));
      $('target-preview').innerHTML=route?`<strong>${t.name} · 可到达</strong>路径 ${route.path.length} 格，移动消耗 ${route.cost}，花费 1 AP。<br>石油 −${route.fuel}，执行后剩余 ${economy.oil-route.fuel}。${route.road?'<br>全程道路，移动预算 +1。':''}`:`<strong>${t.name} · 无法到达</strong>可能受移动领域、预算、石油或同层占位限制。地形减伤 ${t.defense}。`;
    } else if(target&&target.side!==s.side) renderAttackPreview(target,false);
    else $('target-preview').innerHTML=`<strong>${t.name} · 坐标 ${c.q},${c.r}</strong>${target?'友军不是攻击目标。':'此格没有敌军。'}地形减伤 ${t.defense}。`;
  }
  function renderAttackPreview(target,confirm) {
    const s=selected(),u=D.byId[s.type],t=D.byId[target.type],check=H.canAttack(s,target,u,cells),tile=tileOf(target);
    if(!check.ok){$('target-preview').innerHTML=`<strong>${t.name} · 无法攻击</strong>${check.reason}，距离 ${H.distance(s,target)}。`;return;}
    const d=H.damage(u,t,tile),actual=Math.min(d.value,target.hp);
    $('target-preview').innerHTML=`<strong>${t.name} · ${D.states[H.domain(t,tile)]}目标</strong><span class="damage">−${actual} HP</span> <span>剩余 ${Math.max(0,target.hp-d.value)} / ${t.hp}</span><br>${d.base} ${d.bonus<0?'−':'+'} ${Math.abs(d.bonus)} − ${d.armor} − ${d.defense} = ${d.value}<br>此处未结算反击。${confirm?'<button class="primary full" id="confirm-attack" style="margin-top:9px;padding:7px">确认攻击 · 结束行动</button>':''}`;
    if(confirm)$('confirm-attack').addEventListener('click',()=>attack(target));
  }
  function clickCell(c) {
    const u=unitAt(c),s=selected();
    if(mode==='capture'&&c.building&&s&&s.ap>0){pendingTarget=null;const check=H.canCapture(s,c,D.byId[s.type],army);if(check.ok)pendingTarget={...c,capture:true};renderBoard();renderCapturePreview(c,check.ok);return;}
    if(u&&u.side==='union'){selectedId=u.id;pendingTarget=null;mode='move';renderBoard();renderInspector();return;}
    if(!s||s.ap===0){notify('该单位已结束行动，请选择其他友军或重置行动点。');return;}
    if(mode==='move') {
      if(u){notify('敌军占据此格，请切换攻击模式。');return;}
      const path=reach.get(H.key(c.q,c.r));if(!path){previewCell(c);notify('无法到达：请查看地形、路径或移动预算。');return;}
      const debit=E.spendOil(economy,path.fuel);if(!debit.ok){notify(debit.reason);return;}
      const name=D.byId[s.type].name;s.q=c.q;s.r=c.r;s.ap--;s.moved=true;pendingTarget=null;
      log(`${name} 移动 ${path.path.length} 格至 (${c.q},${c.r})，消耗 ${path.cost} 移动预算、${path.fuel} 石油与 1 AP，剩余 ${s.ap} AP。`);
      renderBoard();renderInspector();renderEconomy();
    } else if(mode==='attack') {
      if(!u){pendingTarget=null;previewCell(c);renderBoard();return;}
      const check=H.canAttack(s,u,D.byId[s.type],cells);
      pendingTarget=check.ok?u:null;renderBoard();renderAttackPreview(u,check.ok);
    }
  }
  function renderCapturePreview(c,confirm){
    const s=selected(),spec=s&&D.byId[s.type];if(!s)return;
    const check=H.canCapture(s,c,spec,army),name=c.building?D.buildingById[c.building].name:D.terrain[c.terrain].name;
    $('target-preview').innerHTML=`<strong>${name} · ${check.ok?'可占领':'无法占领'}</strong>${check.reason}。${check.ok?`<br>保留 Lv.${c.level}；收益从下次结算生效，生产设施可立即接管。${confirm?'<button class="primary full" id="confirm-capture" style="margin-top:9px;padding:7px">确认占领 · 结束行动</button>':''}`:''}`;
    if(confirm)$('confirm-capture').addEventListener('click',()=>captureBuilding(c));
  }
  function captureBuilding(c){
    const s=selected();if(!s||!H.canCapture(s,c,D.byId[s.type],army).ok)return;
    const result=E.capture(economy,c,s.side);if(!result.ok){notify(result.reason);return;}
    s.ap=0;pendingTarget=null;syncBuildings();renderEconomy();renderBoard();renderInspector();
    const name=D.buildingById[c.building].name;
    log(`${D.byId[s.type].name} 占领了 ${name} Lv.${c.level}，花费 1 AP 并结束行动。建筑归属与设施等级已更新。`);notify(`${name} 已归属联合军`);
  }
  function attack(target) {
    const s=selected();if(!s||s.ap<1||target.hp<=0||target.side===s.side)return;
    const u=D.byId[s.type],t=D.byId[target.type];if(!H.canAttack(s,target,u,cells).ok)return;
    const d=H.damage(u,t,tileOf(target)),actual=Math.min(d.value,target.hp);target.hp=Math.max(0,target.hp-d.value);s.ap=0;pendingTarget=null;
    log(`${u.name} 对${t.name}造成 ${actual} 伤害${target.hp===0?'，目标已击毁':`，目标剩余 ${target.hp} HP`}。本次行动结束；试验台未结算反击。`);
    renderBoard();renderInspector();notify(target.hp===0?`${t.name} 已击毁`:`${t.name} −${actual} HP`);
  }
  function setMode(next) {const s=selected();if(!s||s.ap===0)return;mode=next;pendingTarget=null;renderBoard();renderInspector();}
  $('mode-move').addEventListener('click',()=>setMode('move'));$('mode-attack').addEventListener('click',()=>setMode('attack'));
  $('mode-capture').addEventListener('click',()=>setMode('capture'));
  $('show-coords').addEventListener('change',renderBoard);$('show-range').addEventListener('change',renderBoard);
  $('battlefield').addEventListener('pointerleave',()=>{if(!pendingTarget)defaultPreview();});
  $('refresh-ap').addEventListener('click',()=>{army.forEach(u=>{u.ap=2;u.moved=false;});pendingTarget=null;mode='move';renderBoard();renderInspector();log('行动点重置为 2；位置、生命与石油保留，不发放收入。');notify('行动点已重置');});
  function resetAll(){economy=E.createState();const fresh=H.makeMap();cells.forEach((c,i)=>Object.assign(c,fresh[i]));army=initialArmy();Object.keys(chosenProducts).forEach(id=>delete chosenProducts[id]);selectedId='union-tank';mode='move';mapLayer='surface';pendingTarget=null;syncBuildings();renderBoard();renderInspector();renderEconomy();document.querySelectorAll('[data-layer]').forEach(el=>{const active=el.dataset.layer==='surface';el.classList.toggle('active',active);el.setAttribute('aria-pressed',String(active));});log('场景与经济已恢复：金钱 600，石油 60，试验回合 1。');$('economy-log').textContent='预算、建筑、归属、订单、库存与军队均已恢复初始值。';notify('场景与经济已恢复');}
  $('reset-scene').addEventListener('click',resetAll);$('reset-economy').addEventListener('click',resetAll);
  document.querySelectorAll('[data-layer]').forEach(b=>b.addEventListener('click',()=>{mapLayer=b.dataset.layer;pendingTarget=null;renderBoard();defaultPreview();document.querySelectorAll('[data-layer]').forEach(el=>{const active=el===b;el.classList.toggle('active',active);el.setAttribute('aria-pressed',String(active));});}));
  $('inspect-dossier').addEventListener('click',()=>openDossier(selected().type,'union'));
  document.addEventListener('keydown',e=>{
    if($('unit-dialog').open||$('overview').hidden||/input|textarea|select/i.test(e.target.tagName)||e.ctrlKey||e.altKey||e.metaKey)return;
    if(e.key.toLowerCase()==='m')setMode('move');
    if(e.key.toLowerCase()==='a')setMode('attack');
    if(e.key.toLowerCase()==='c')setMode('capture');
    if(e.key==='Escape'){pendingTarget=null;mode='move';renderBoard();renderInspector();}
  });

  function syncBuildings(){
    cells.filter(c=>c.owner==='union'&&c.site).forEach(c=>{const b=E.owned(economy,c.siteId);c.building=b?c.site:null;c.level=b?b.level:0;});
  }
  function renderEconomy(){
    economy.fieldCount=army.filter(u=>u.side==='union'&&u.hp>0).length;
    const gain=E.income(economy);
    $('field-money').textContent=economy.money;$('field-oil').textContent=economy.oil;$('field-turn').textContent=economy.turn;
    $('budget-money').textContent=economy.money;$('budget-oil').textContent=economy.oil;$('budget-turn').textContent=String(economy.turn).padStart(2,'0');
    $('income-money').textContent=`+${gain.money} / 回合 · 上限 3000`;$('income-oil').textContent=`+${gain.oil} / 回合 · 上限 300`;
    $('force-count').textContent=`战场 ${economy.fieldCount} · 库存 ${economy.stock.length} · 编制 ${E.count(economy)} / 24`;
    const facilities=D.buildings.flatMap(b=>{const own=economy.buildings.filter(i=>i.id===b.id),instances=own.some(i=>i.key===`union-${b.id}`)?own:[null,...own];return instances.map(instance=>({b,instance}));});
    document.querySelectorAll('[data-building-filter]').forEach(button=>{const group=button.dataset.buildingFilter;button.textContent=`${{all:'全部',economy:'经济',resource:'资源',production:'生产'}[group]} ${facilities.filter(({b})=>group==='all'||b.group===group).length}`;});
    $('building-grid').innerHTML=facilities.filter(({b})=>buildingFilter==='all'||b.group===buildingFilter).map(({b,instance})=>{
      const key=instance?instance.key:`union-${b.id}`,captured=instance&&!key.startsWith('union-'),label=b.name+(captured?'（占领）':'');
      const level=instance?instance.level:1,job=economy.orders.find(o=>(o.facilityKey||o.facility)===key);
      const options=D.units.filter(u=>u.facility===b.id).sort((a,b)=>a.tier-b.tier||Number(!a.system)-Number(!b.system));
      let action='';
      if(!instance)action=`<button class="secondary full" data-build="${b.id}" ${job||economy.money<b.cost?'disabled':''}>${job?'建设中':`建造 · ${b.cost} 金钱`}</button>`;
      else{
        const upgradeCost=b.upgrades[level-1];
        action=`<button class="secondary full" data-upgrade="${key}" ${job||level>=b.maxLevel||economy.money<upgradeCost?'disabled':''}>${level>=b.maxLevel?'最高等级':`升级至 Lv.${level+1} · ${upgradeCost} 金钱`}</button>`;
        if(b.group==='production'){
          if(!chosenProducts[key]||!D.byId[chosenProducts[key]])chosenProducts[key]=options[0].id;
          const product=chosenProducts[key],check=E.unitCheck(economy,product,key);
          action+=`<select class="production-select" aria-label="${label}生产单位" data-product="${key}">${[1,2,3].map(tier=>`<optgroup label="${tier}级设施解锁">${options.filter(u=>u.tier===tier).map(u=>`<option value="${u.id}" ${u.id===product?'selected':''} ${u.tier>level?'disabled':''}>${productionLabel(u)}${u.tier>level?'（未解锁）':''}</option>`).join('')}</optgroup>`).join('')}</select><button class="primary full" data-recruit="${product}" data-facility="${key}" ${check.ok?'':'disabled'}>${check.ok?`生产 ${D.byId[product].type}`:check.reason}</button>`;
        }
      }
      return `<article class="building-card"><div class="unit-card-head"><span>${{economy:'经济建筑',resource:'资源建筑',production:'生产建筑'}[b.group]}</span><span>${instance?`Lv.${level}`:'待建造'}</span></div><div class="building-art">${A.buildingSvg(b.id,'union',level)}</div><h3>${label}</h3><div class="building-yield">${b.group==='production'?`${options.filter(u=>u.tier<=level).length} 种可用兵种`:`金钱 +${b.money[level-1]} · 石油 +${b.oil[level-1]} / 回合`}</div><p>${b.text}</p><div class="building-job">${job?`${{unit:'生产',upgrade:'升级',build:'建设'}[job.kind]}中 · 剩余 ${job.remaining} 回合`:'设施槽空闲'}</div>${action}<a class="asset-link" href="assets/buildings/${b.id}-union-lv${level}.svg" download>下载 Lv.${level} SVG ↗</a></article>`;
    }).join('');
    $('building-grid').querySelectorAll('[data-build]').forEach(b=>b.addEventListener('click',()=>economyAction(E.construct,b.dataset.build,'建造')));
    $('building-grid').querySelectorAll('[data-upgrade]').forEach(b=>b.addEventListener('click',()=>economyAction(E.upgrade,b.dataset.upgrade,'升级')));
    $('building-grid').querySelectorAll('[data-recruit]').forEach(b=>b.addEventListener('click',()=>economyAction(E.recruit,b.dataset.recruit,'生产',b.dataset.facility)));
    $('building-grid').querySelectorAll('[data-product]').forEach(el=>el.addEventListener('change',()=>{chosenProducts[el.dataset.product]=el.value;renderEconomy();}));
    $('production-stock').innerHTML=economy.stock.length?economy.stock.map((id,i)=>`<article class="stock-card">${A.unitSvg(id)}<div><strong>${D.byId[id].type}</strong><small>${classText(D.byId[id])} · 生产完成</small></div><button class="secondary" data-deploy="${i}">部署 →</button></article>`).join(''):'<div class="empty-stock">暂无待部署单位。生产时间按具体型号显示，完成后可部署到设施或合法邻格。</div>';
    $('production-stock').querySelectorAll('[data-deploy]').forEach(b=>b.addEventListener('click',()=>deployStock(Number(b.dataset.deploy))));
    $('production-tree').innerHTML=D.buildings.filter(b=>b.group==='production').map(b=>{
      const current=economy.buildings.filter(i=>i.id===b.id).sort((a,b)=>b.level-a.level)[0];
      return `<article class="tree-card"><h3>${b.name}</h3>${[1,2,3].map(level=>`<div class="tree-level ${current&&current.level>=level?'unlocked':''}"><b>设施 Lv.${level}</b>${D.systems.filter(sys=>sys.facility===b.id).map(sys=>`<p><span class="tree-system">${sys.name}</span> ${D.units.filter(u=>u.system===sys.id&&u.modelLevel===level).map(u=>`${u.type} <small>${u.cost} / ${u.buildTurns}回合</small>`).join('、')}</p>`).join('')}<p class="tree-special"><span class="tree-system">特殊</span> ${D.units.filter(u=>!u.system&&u.facility===b.id&&u.tier===level).map(u=>`${u.type} <small>${u.cost}</small>`).join('、')||'—'}</p></div>`).join('')}</article>`;
    }).join('');
  }
  function economyAction(action,id,label,facilityKey){
    const result=action(economy,id,facilityKey);if(!result.ok){notify(result.reason);return;}
    const name=D.byId[id]?D.byId[id].name:D.buildingById[E.owned(economy,id)?.id||id].name;
    $('economy-log').textContent=`${name}：${label}订单已提交并扣除金钱；推进试验回合后完成。`;
    renderEconomy();notify(`${name} ${label}已排队`);
  }
  function deployStock(index){
    const id=economy.stock[index],u=D.byId[id];if(!u)return;
    const source=economy.stockFacilities[index];
    const origin=cells.find(c=>c.owner==='union'&&c.building===u.facility&&(source?c.siteId===source:c.level>=u.tier));
    if(!origin){notify('生产设施不存在，单位保留在库存。');return;}
    const candidates=[origin,...H.neighbors(origin,cellMap)];
    const target=candidates.find(c=>Number.isFinite(H.movementCost(c,u))&&!unitAt(c,H.layer(u)));
    if(!target){notify('设施和合法邻格已被占用；单位保留在库存。');return;}
    const instance={id:`union-${id}-${++serial}`,type:id,side:'union',q:target.q,r:target.r,hp:u.hp,ap:2,moved:false};
    army.push(instance);economy.stock.splice(index,1);economy.stockFacilities.splice(index,1);selectedId=instance.id;mapLayer=H.layer(u);mode='move';pendingTarget=null;
    document.querySelectorAll('[data-layer]').forEach(el=>{const active=el.dataset.layer===mapLayer;el.classList.toggle('active',active);el.setAttribute('aria-pressed',String(active));});
    renderEconomy();renderBoard();renderInspector();log(`${u.name} 已部署至 (${target.q},${target.r})，获得 2 AP。`);showPage('overview');notify(`${u.name} 已部署，可在地图操作`);
  }
  $('advance-economy').addEventListener('click',()=>{
    const result=E.advance(economy);army.forEach(u=>{u.ap=2;u.moved=false;});pendingTarget=null;syncBuildings();renderEconomy();renderBoard();renderInspector();
    $('economy-log').textContent=`进入试验回合 ${economy.turn}：金钱 +${result.gain.money}，石油 +${result.gain.oil}；完成 ${result.done.length} 个订单。新建或升级建筑的收益从下一次结算生效。`;
    log('试验回合已推进，收入和订单已结算，行动点已刷新。暂不执行敌方行动。');
  });
  document.querySelectorAll('[data-building-filter]').forEach(b=>b.addEventListener('click',()=>{buildingFilter=b.dataset.buildingFilter;document.querySelectorAll('[data-building-filter]').forEach(el=>{const active=el===b;el.classList.toggle('active',active);el.setAttribute('aria-pressed',String(active));});renderEconomy();}));

  function renderArchive() {
    const options=D.systems.filter(sys=>filter==='all'||sys.branch===filter);
    $('system-filter').innerHTML=`<option value="all">全部体系</option>${options.map(sys=>`<option value="${sys.id}">${D.branches[sys.branch]} · ${sys.name}</option>`).join('')}<option value="special">特殊单位</option>`;
    $('system-filter').value=systemFilter;
    const visible=D.units.filter(u=>(filter==='all'||u.branch===filter)&&(systemFilter==='all'||(systemFilter==='special'?!u.system:u.system===systemFilter))&&(levelFilter==='all'||u.tier===Number(levelFilter)));
    $('archive-count').textContent=`显示 ${visible.length} / ${D.units.length} 种`;
    let lastGroup='';
    $('unit-grid').innerHTML=visible.map(u=>{
      const group=u.system||`special-${u.branch}`;
      const heading=group!==lastGroup?`<div class="archive-group"><strong>${D.branches[u.branch]} · ${u.system?D.systemById[u.system].name:'特殊单位'}</strong><span>${u.system?D.systemById[u.system].text:'按用途选择；等级表示设施解锁要求。'}</span></div>`:'';
      lastGroup=group;
      return `${heading}<article class="unit-card ${u.system?'':'unit-special'}" data-side="${archiveSide}"><div class="unit-card-head"><span>${u.code}</span><span>${u.system?D.levels[u.modelLevel]:`特殊 · 解锁${u.tier}级`}</span></div><div class="unit-card-art">${A.unitSvg(u.id,archiveSide)}</div><h3>${u.type}<small>${u.name}</small></h3><div class="unit-role">${u.role} · ${u.cost} 金钱</div><div class="unit-mini-stats">${[['生命',u.hp],['移动',u.move],[u.system==='recon'?'视野':'射程',u.system==='recon'?u.vision:rangeText(u)],['油 / 格',u.oil===0?'0':u.seaOil?`${u.oil}/${u.seaOil}`:u.oil]].map(([n,v])=>`<div><span>${n}</span><b>${v}</b></div>`).join('')}</div><p>${u.blurb}</p><div class="production-requirement">${D.buildingById[u.facility].name} Lv.${u.tier} · ${u.buildTurns} 回合 · ${oilText(u)}</div><div class="card-links"><button class="text-button" data-dossier="${u.id}">查看档案 →</button><a href="assets/units/${u.id}-${archiveSide}.svg" download>下载 SVG ↗</a></div></article>`;
    }).join('')||'<div class="empty-stock">该筛选下没有单位，可选择其他体系或等级。</div>';
    $('unit-grid').querySelectorAll('[data-dossier]').forEach(b=>b.addEventListener('click',()=>openDossier(b.dataset.dossier,archiveSide)));
    $('unit-table').querySelector('tbody').innerHTML=visible.map(u=>`<tr><td>${unitLabel(u)}<small>${u.code}</small></td>${[D.branches[u.branch],u.system?D.systemById[u.system].name:`特殊·${u.specialRole}`,u.system?u.modelLevel:'—',u.cost,oilText(u),`${D.buildingById[u.facility].name} Lv.${u.tier}`,u.buildTurns,u.hp,u.armor,u.move,rangeText(u),u.vision,u.damage].map(v=>`<td>${v}</td>`).join('')}</tr>`).join('');
  }
  document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.filter;systemFilter='all';document.querySelectorAll('[data-filter]').forEach(el=>{const active=el===b;el.classList.toggle('active',active);el.setAttribute('aria-pressed',String(active));});renderArchive();}));
  $('system-filter').addEventListener('change',e=>{systemFilter=e.target.value;renderArchive();});
  $('level-filter').addEventListener('change',e=>{levelFilter=e.target.value;renderArchive();});
  document.querySelectorAll('.faction-switch [data-side]').forEach(b=>b.addEventListener('click',()=>{archiveSide=b.dataset.side;document.querySelectorAll('[data-side]').forEach(el=>{const active=el===b;el.classList.toggle('active',active);el.setAttribute('aria-pressed',String(active));});renderArchive();}));
  function openDossier(id,side='union') {
    const u=D.byId[id];
    $('dialog-content').innerHTML=`<div class="dialog-header">${A.unitSvg(id,side)}<div><div class="eyebrow">${u.code} / ${D.branches[u.branch]} / ${classText(u)}</div><h2 id="dialog-title">${u.type} <small style="font-size:14px;color:var(--muted)">${u.name}</small></h2><p>${u.role} · ${u.category==='light'?'轻型':'装甲'} · ${u.cost} 金钱</p><p>${D.buildingById[u.facility].name} Lv.${u.tier} · ${u.buildTurns} 回合 · ${oilText(u)}</p></div></div><div class="dialog-body"><div class="inspector-stats">${[['生命',u.hp],['装甲',u.armor],['移动',u.move],['射程',rangeText(u)],['视野',u.vision],['伤害',u.damage]].map(([n,v])=>`<div><span>${n}</span><b>${v}</b></div>`).join('')}</div><h3>战术职责</h3><p>${u.strengths}</p><h3>移动与攻击领域</h3><p>${u.branch==='air'?'空中层，可以越过地形。':u.amphibious?'海洋与陆地，可登陆。':u.branch==='navy'?'仅限海洋，不能上岸。':'地表层，不能进入海洋。'}攻击目标：${u.targets.map(t=>D.states[t]).join('、')}。${u.fireAfterMove===false?'移动后不能攻击。':''}石油按实际经过的格子扣除，${oilText(u)}。</p><h3>弱点与应对</h3><p>${u.weakness}</p><h3>技能设计 · ${u.skill}</h3><p>${u.skillText} 主动技能和被动加成尚未在试验台实现。</p><h3>编队建议</h3><p>${u.tactic}</p><h3>轮廓语言</h3><p>${u.silhouette}</p><h3>规则备注</h3><p>对轻型加成 ${bonusText(u.bonusLight)}，对装甲加成 ${bonusText(u.bonusArmor)}，对空额外 ${bonusText(u.bonusAir)}，对陆额外 ${bonusText(u.bonusLand)}，对海额外 ${bonusText(u.bonusSea)}。可占领本格或相邻格的全部建筑，包括总部；花费 1 AP 并结束行动。${u.counter?'正式版可进行半伤反击。':'不能反击。'} 生产时间 ${u.buildTurns} 回合。</p><a class="dialog-asset" href="assets/units/${u.id}-${side}.svg" download>下载 ${u.name} SVG 资产 ↗</a></div>`;
    $('unit-dialog').showModal();
  }
  $('dialog-close').addEventListener('click',()=>$('unit-dialog').close());
  $('unit-dialog').addEventListener('click',e=>{if(e.target===$('unit-dialog')){const rect=$('unit-dialog').getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)$('unit-dialog').close();}});

  function terrainCards(download=false) {
    return Object.entries(D.terrain).map(([id,t])=>`<article class="terrain-card">${A.terrainSvg(id)}<h3>${t.name}</h3><div class="terrain-values"><span>${Number.isFinite(t.cost)?`消耗 ${t.cost}`:'不可进入'}</span><span>${id==='ridge'?'遮挡视线':`减伤 ${t.defense}`}</span></div><p>${t.text}</p>${download?`<a href="assets/terrain/${id}.svg" download>下载 SVG ↗</a>`:''}</article>`).join('');
  }
  $('terrain-overview').innerHTML=terrainCards();$('terrain-art').innerHTML=terrainCards(true);
  const palette=[['背景','#101c1b'],['面板','#182927'],['主文字','#ecf0e7'],['次文字','#a4b5ad'],['联合军','#68d9bc'],['防卫军','#ef8a78'],['金钱 / 等级','#e3c989'],['海洋','#173e54']];
  $('palette').innerHTML=palette.map(([name,color])=>`<div class="swatch"><div class="swatch-color" style="background:${color}"></div><span>${name}</span><small>${color.toUpperCase()}</small></div>`).join('');
  $('silhouettes').innerHTML=D.units.map(u=>`<article class="silhouette-card">${A.unitSvg(u.id)}<strong>${u.type}</strong><small>${u.silhouette.split(' / ').slice(0,2).join('<br>')}</small></article>`).join('');
  document.querySelectorAll('[data-filter]').forEach(b=>{const branch=b.dataset.filter;b.textContent=`${branch==='all'?'全部':D.branches[branch]} ${D.units.filter(u=>branch==='all'||u.branch===branch).length}`;});
  $('catalog-summary').textContent=`${D.units.length} 种单位 · ${D.systems.length} 个三级体系 · ${D.units.filter(u=>!u.system).length} 种特殊单位`;
  $('unit-count-brief').textContent=`${D.units.length} 种单位 · ${D.systems.length} 个体系 · 三级型号`;
  $('anti-air-list').textContent=D.units.filter(u=>u.antiAir).map(u=>u.type).join('、');
  $('asset-summary').textContent=`${D.units.length*2} 个阵营单位 SVG、8 个地块 SVG、75 个分级建筑 SVG；共 ${D.units.length*2+83} 个矢量资产。单位包含体系等级标记，可从档案下载。`;
  $('series-table').querySelector('tbody').innerHTML=D.systems.map(sys=>`<tr><td>${D.branches[sys.branch]}</td><td>${sys.name}<small>${sys.role}</small></td>${[1,2,3].map(level=>{const u=D.units.find(u=>u.system===sys.id&&u.modelLevel===level);return `<td>${unitLabel(u)}<small>${u.cost} 金钱 · ${u.buildTurns} 回合</small></td>`;}).join('')}</tr>`).join('');
  army=initialArmy();syncBuildings();renderEconomy();renderBoard();renderInspector();renderArchive();showPage(location.hash.slice(1),false);
})();
