// Runs the real controller in an isolated VM. This is a controller integration
// check, not a browser, layout, audio-output, or accessibility measurement.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const project=path.resolve(__dirname,'..'),results=[];
const watchdog=require.main===module?setTimeout(()=>{console.error('UI integration did not complete: an unresolved fixture effect blocked the test chain.');process.exitCode=1;},30000):null;
const decode=s=>String(s||'').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
const copy=x=>JSON.parse(JSON.stringify(x));
class Classes{
 constructor(text=''){this.values=new Set(text.split(/\s+/).filter(Boolean));}
 add(...values){values.forEach(v=>this.values.add(v));}remove(...values){values.forEach(v=>this.values.delete(v));}
 contains(v){return this.values.has(v);}toggle(v,force){const on=force===undefined?!this.values.has(v):!!force;on?this.values.add(v):this.values.delete(v);return on;}
}
class Element{
 constructor(doc,tag='div',attributes={}){this.doc=doc;this.tagName=tag.toUpperCase();this.attributes=attributes;this.id=attributes.id||'';this.dataset={};for(const [k,v] of Object.entries(attributes))if(k.startsWith('data-'))this.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=v;this.classList=new Classes(attributes.class);this.style={setProperty(name,value){this[name]=value;}};this.disabled=Object.hasOwn(attributes,'disabled');this.hidden=Object.hasOwn(attributes,'hidden');this.checked=Object.hasOwn(attributes,'checked');this.value=attributes.value||'';this.clientWidth=doc.viewport?.width||1300;this.clientHeight=doc.viewport?.height||800;this.listeners=new Map();this.nodes=[];this.inert=false;this.isContentEditable=false;this.textContent='';this._html='';this.writes=0;}
 set innerHTML(value){this._html=String(value);this.writes++;this.nodes=this.doc.parse(this._html);}
 get innerHTML(){return this._html;}
 matches(selector){return selector.split(',').some(part=>{part=part.trim();if(part===':disabled')return this.disabled;if(part.startsWith('.'))return this.classList.contains(part.slice(1));if(part.startsWith('#'))return this.id===part.slice(1);const attr=/^\[([^=\]]+)(?:="([^"]*)")?\]$/.exec(part);if(attr)return Object.hasOwn(this.attributes,attr[1])&&(attr[2]===undefined||this.attributes[attr[1]]===attr[2]);return this.tagName===part.toUpperCase();});}
 closest(selector){return this.matches(selector)?this:null;}
 querySelector(selector){return this.nodes.find(n=>n.matches(selector))||null;}querySelectorAll(selector){return this.nodes.filter(n=>n.matches(selector));}
 addEventListener(name,fn){const list=this.listeners.get(name)||[];list.push(fn);this.listeners.set(name,list);}
 setAttribute(name,value){this.attributes[name]=String(value);}getAttribute(name){return this.attributes[name]??null;}
 getBoundingClientRect(){return {left:0,top:0,width:this.clientWidth,height:this.clientHeight};}
 focus(){this.doc.activeElement=this;}setPointerCapture(){}remove(){}click(){this.doc.dispatch('click',{target:this});}
 createSVGPoint(){return {x:0,y:0,matrixTransform(){return {x:this.x,y:this.y};}};}getScreenCTM(){return {inverse(){return {};}};}
}
class MiniDocument{
 constructor(viewport){this.viewport=viewport;this.documentElement={style:{setProperty(name,value){this[name]=value;}}};this.listeners=new Map();this.body=new Element(this,'body');this.header=new Element(this,'header',{class:'masthead'});this.app=new Element(this,'main',{id:'app'});this.modal=new Element(this,'div',{id:'modal-root'});this.toast=new Element(this,'div',{id:'toast'});this.static=[this.body,this.header,this.app,this.modal,this.toast];this.hidden=false;this.activeElement=this.body;}
 parse(html){const nodes=[],pattern=/<([a-z][\w:-]*)\b([^<>]*)>/gi;let match;
  while((match=pattern.exec(html))){const attributes={},parts=/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'))?/g;let attr;while((attr=parts.exec(match[2])))attributes[attr[1]]=decode(attr[2]??attr[3]??'');
   if(!attributes.id&&!['button','select','input','a'].includes(match[1].toLowerCase())&&!/battle-frame|pause-banner|preview-grid|end-turn/.test(attributes.class||'')&&!Object.hasOwn(attributes,'data-camera-box')&&!Object.hasOwn(attributes,'data-dismiss')&&!/battle-drawer|modal-backdrop/.test(attributes.class||''))continue;
   const element=new Element(this,match[1],attributes);
   if(element.tagName==='SELECT'){const end=html.indexOf('</select>',pattern.lastIndex),body=html.slice(pattern.lastIndex,end),options=[...body.matchAll(/<option\b([^>]*)>([^<]*)<\/option>/g)].map(o=>({value:decode(/value="([^"]*)"/.exec(o[1])?.[1]),selected:/\bselected\b/.test(o[1]),disabled:/\bdisabled\b/.test(o[1])}));element.options=options;element.value=(options.find(o=>o.selected)||options[0])?.value||'';}
   nodes.push(element);
  }return nodes;
 }
 get nodes(){return [...this.static,...this.app.nodes,...this.modal.nodes,...this.header.nodes];}
 getElementById(id){return this.nodes.find(n=>n.id===id)||null;}querySelector(selector){return this.nodes.find(n=>n.matches(selector))||null;}querySelectorAll(selector){return this.nodes.filter(n=>n.matches(selector));}
 createElement(tag){return new Element(this,tag);}elementFromPoint(){return null;}
 addEventListener(name,fn){const list=this.listeners.get(name)||[];list.push(fn);this.listeners.set(name,list);}
 dispatch(name,properties){const event={target:this.body,repeat:false,ctrlKey:false,altKey:false,metaKey:false,preventDefault(){this.defaultPrevented=true;},...properties};for(const fn of this.listeners.get(name)||[])fn(event);return event;}
}
function harness(initialStored={},viewport={width:1300,height:800,coarse:false}){
 const document=new MiniDocument(viewport),stored=new Map(Object.entries(initialStored)),intervals=[],timers=new Map(),animationFrames=new Map(),pending=[],fxCalls=[],saved=[],executed=[],campaignCalls=[],freeCalls=[],errors=[],sceneCalls=[],ambienceCalls=[];let now=0,nextTimer=1,paused=false,environment,battle;
 const windowListeners=new Map();
 const sandbox={document,TextEncoder,TextDecoder,Uint32Array,console:{log(){},warn(){},error(...args){errors.push(args.map(String).join(' '));}},innerWidth:viewport.width,innerHeight:viewport.height,matchMedia:()=>({matches:!!viewport.coarse}),performance:{now:()=>now},location:{hash:''},navigator:{clipboard:{writeText:async()=>{}}},crypto:{getRandomValues(array){array.fill(0);return array;}},localStorage:{getItem:key=>stored.get(key)||null,setItem:(key,value)=>stored.set(key,String(value)),removeItem:key=>stored.delete(key)},setInterval:(fn,ms)=>{const id=nextTimer++;intervals.push({id,fn,ms});return id;},clearInterval:id=>{const index=intervals.findIndex(t=>t.id===id);if(index>=0)intervals.splice(index,1);},setTimeout:(fn,ms)=>{const id=nextTimer++;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),requestAnimationFrame:fn=>{const id=nextTimer++;animationFrames.set(id,fn);return id;},cancelAnimationFrame:id=>animationFrames.delete(id),addEventListener:(name,fn)=>{const list=windowListeners.get(name)||[];list.push(fn);windowListeners.set(name,list);},Blob,URL};sandbox.window=sandbox;
 sandbox.GameFX={capture(s,command,viewerId){return {command:copy(command),viewerId,revision:s.revision};},play(options){fxCalls.push(options);return new Promise(resolve=>pending.push({resolve,options}));},cancel(){while(pending.length)pending.shift().resolve();},setPaused(value){paused=!!value;},setSoundEnabled(v){sandbox.fixtureSound=v;sandbox.GameAudio?.setMaster(v,sandbox.fixtureVolume??.45);},setVolume(v){sandbox.fixtureVolume=v;sandbox.GameAudio?.setMaster(sandbox.fixtureSound!==false,v);},setAmbienceEnabled(v){ambienceCalls.push(v);},setScene(v){sceneCalls.push(copy(v));},unlock(){}};
 const context=vm.createContext(sandbox);
 for(const name of ['data','anime','art','audio','gestures','content','grid','maps','random','game','campaign','ai','storage','controls','mobile','icons','move-undo','mobile-battle','battle-ui'])vm.runInContext(fs.readFileSync(path.join(project,'src',name+'.js'),'utf8'),context,{filename:name+'.js'});
 const createBattle=context.GameBattleUI.create;context.GameBattleUI.create=env=>{environment=env;battle=createBattle(env);return battle;};
 const createCampaign=context.Campaign.create;context.Campaign.create=(id,progress,settings)=>{campaignCalls.push({id,settings:copy(settings||{})});return createCampaign(id,progress,settings);};
 const createFree=context.Game.create;context.Game.create=(map,settings)=>{freeCalls.push({map:map.id,settings:copy(settings||{})});return createFree(map,settings);};
 const save=context.GameStorage.save;context.GameStorage.save=(s,options)=>{const entry=save(s,options);saved.push({options:copy(options||{}),entry:copy(entry)});return entry;};
 const execute=context.Game.execute;context.Game.execute=(s,command)=>{const before=copy(s),result=execute(s,command);executed.push({command:copy(command),result:copy(result),before,after:copy(s)});return result;};
 vm.runInContext(fs.readFileSync(path.join(project,'src','ui.js'),'utf8'),context,{filename:'ui.js'});
 const flush=async()=>{for(let i=0;i<5;i++)await Promise.resolve();};
 async function click(selector){const target=document.querySelector(selector);assert.ok(target,'Missing rendered control '+selector);assert.equal(target.disabled,false,'Rendered control disabled '+selector);document.dispatch('click',{target});await flush();}
 async function change(selector,value){const target=document.querySelector(selector);assert.ok(target,'Missing rendered field '+selector);target.value=value;document.dispatch('change',{target});await flush();}
 async function action(name){await environment.action(name);await flush();}
 async function finish(){assert.equal(paused,false,'Paused effects must not be completed by fixture');while(pending.length)pending.shift().resolve();await flush();}
 async function tick(ms=1000){now+=ms;const ticker=intervals.find(t=>t.ms===100);assert.ok(ticker,'UI timer exists');ticker.fn();await flush();}
 async function key(code,extra={}){const e=document.dispatch('keydown',{code,key:code==='Space'?' ':code,...extra});await flush();return e;}
 function resize(width,height){viewport.width=width;viewport.height=height;context.innerWidth=width;context.innerHeight=height;for(const el of document.nodes){el.clientWidth=width;el.clientHeight=height;}for(const fn of windowListeners.get('resize')||[])fn();}
 return {elapse(ms){now+=ms;},resize,context,document,stored,saved,executed,campaignCalls,freeCalls,fxCalls,errors,pending,sceneCalls,ambienceCalls,flush,click,change,action,finish,tick,key,get ui(){return environment.ui;},get env(){return environment;},get battle(){return battle;},get paused(){return paused;}};
}
async function test(name,fn){try{await fn();results.push({name,ok:true});}catch(e){results.push({name,ok:false,error:e.stack});console.error(name,e.stack);}}
async function freeGame(h,difficulty='standard'){await h.action('free');await h.change('[data-setting="difficulty"]',difficulty);await h.click('[data-action="preview"]');await h.click('[data-action="start-free"]');await h.click('[data-action="close"]');}
async function chapter(h,difficulty='standard'){await h.action('campaign');await h.change('#campaign-difficulty',difficulty);await h.click('[data-chapter="C01"]');}
function oneStep(h,unit){return [...h.context.Game.movement(h.ui.game,unit).values()].find(route=>route.path.length===1);}
function lastSave(h){assert.ok(h.saved.length);return h.saved.at(-1).entry.snapshot;}

module.exports={harness,freeGame,chapter,oneStep,lastSave,Element,copy};
if(require.main===module)(async()=>{
 for(const difficulty of ['easy','standard','hard','hell']){
  await test(`${difficulty}: chapter field forwards difficulty to Campaign.create and retry`,async()=>{
   const h=harness();await chapter(h,difficulty);assert.equal(h.campaignCalls.at(-1).settings.difficulty,difficulty);assert.equal(h.ui.game.settings.difficulty,difficulty);await h.action('retry');assert.equal(h.campaignCalls.at(-1).id,'C01');assert.equal(h.campaignCalls.at(-1).settings.difficulty,difficulty);assert.equal(h.errors.length,0);
  });
  await test(`${difficulty}: free-game difficulty reaches the real engine and saved snapshot`,async()=>{
   const h=harness();await freeGame(h,difficulty);assert.equal(h.freeCalls.at(-1).settings.difficulty,difficulty);assert.equal(h.ui.game.settings.difficulty,difficulty);assert.equal(lastSave(h).settings.difficulty,difficulty);const enemy=h.context.Game.ownUnits(h.ui.game,'P2')[0];assert.equal(enemy.maxHp,Math.round(h.context.GameData.byId[enemy.type].hp*h.context.Game.difficultyProfiles[difficulty].hp/100));assert.equal(h.errors.length,0);
  });
 }
 await test('Next chapter retains selected difficulty after the configuration field disappears',async()=>{
  const h=harness();await chapter(h,'hell');assert.equal(h.document.getElementById('campaign-difficulty'),null);await h.action('assist-confirm');let confirmations=0;while(h.ui.game.story.queue.length&&confirmations++<10)await h.action('story-confirm');assert.ok(confirmations<10);await h.click('[data-chapter="C02"]');assert.equal(h.campaignCalls.at(-1).id,'C02');assert.equal(h.campaignCalls.at(-1).settings.difficulty,'hell');assert.equal(h.ui.game.settings.difficulty,'hell');
 });
 await test('Automatic assisted chapter chain retains difficulty and victory mode',async()=>{
  const h=harness();await chapter(h,'hard');h.ui.chainAssist=true;await h.action('assist-confirm');let confirmations=0;while(h.ui.game.mission.id==='C01'&&confirmations++<10)await h.action('story-confirm');assert.equal(h.ui.game.mission.id,'C02');assert.equal(h.campaignCalls.at(-1).settings.difficulty,'hard');assert.equal(h.campaignCalls.at(-1).settings.victoryMode,'capture_hq');
 });
 await test('Hidden AI movement executes the raw decision once while UI receives only its public projection',async()=>{
  const h=harness();await freeGame(h,'hard');const G=h.context.Game,s=h.ui.game;const ending=h.env.act({kind:'end'});await h.flush();await h.finish();await ending;assert.equal(s.actor,'P2');
  for(const b of s.buildings)if(!b.owner)b.owner='P2';const source=G.ownUnits(s).find(u=>u.type==='infantry'&&u.id!==G.player(s).hqGuardId);
  // Keep the entire AI route outside human vision, rather than checking a
  // command that legitimately becomes visible while advancing into contact.
  for(const u of G.ownUnits(s,'P1').filter(u=>u.id!==G.player(s,'P1').hqGuardId)){const cell=s.cells.filter(c=>c.q>=5&&Number.isFinite(h.context.Hex.cost(u.type,c))&&!G.occupied(s,c)).sort((a,b)=>h.context.Hex.distance(b,source)-h.context.Hex.distance(a,source)||h.context.Hex.sort(a,b))[0];assert.ok(cell);u.q=cell.q;u.r=cell.r;}
  for(const u of G.ownUnits(s))u.ap=u.id===source.id?2:0;source.cooldownReady=999;G.player(s).resources.money=0;G.player(s).resources.energy=200;G.vision(s);
  const humanTile=G.cell(s,G.building(s,G.player(s,'P1').originalHqId));h.ui.tile=humanTile;h.ui.selected=source.id;let decisions=0,projections=0,raw,publicResult;
  const decision=h.context.GameAI.decision,project=h.context.GameAI.forViewer;h.context.GameAI.decision=(...args)=>{decisions++;raw=decision(...args);return raw;};h.context.GameAI.forViewer=(...args)=>{const result=project(...args);if(args[2]!==s.actor){projections++;publicResult=result;}return result;};
  const before=h.executed.length;await h.tick();assert.equal(decisions,1);assert.equal(projections,1);assert.equal(raw.command.kind,'move');assert.equal(publicResult.command,null);assert.equal(h.executed.length,before+1);assert.equal(h.executed.at(-1).command.kind,'move');assert.deepEqual(h.executed.at(-1).command,copy(raw.command));assert.equal(s.actor,'P2');assert.equal(h.ui.aiDecision.phase,'dispatch');assert.deepEqual(copy(h.ui.aiDecision.scores),[]);assert.equal(h.ui.aiDecision.threat,null);assert.equal(h.ui.tile,humanTile);assert.equal(h.ui.selected,null);assert.ok(!h.battle.board().includes('stroke="#fff2b6"'));assert.ok(!h.battle.board().includes('reachable-hex'));await h.finish();assert.equal(h.errors.length,0);
 });
 await test('A default facility attack refreshes its map HP bar and saves the actual structural loss',async()=>{
  const h=harness();await freeGame(h);const G=h.context.Game,H=h.context.Hex,s=h.ui.game,b=G.ownBuildings(s,'P2').find(b=>b.type==='factory');
  const c=s.cells.find(c=>H.distance(c,b)===1&&Number.isFinite(H.cost('tank',c)));assert.ok(c);
  const a=G.normalizeUnit({id:'ATTACKER',type:'tank',owner:'P1',q:c.q,r:c.r});s.units=[a];G.vision(s);h.battle.focusUnit(a.id);
  const old=b.hp,expected=G.attackPreview(s,a,b).targetHp;h.battle.pickCell(b.q,b.r);await h.flush();
  assert.equal(h.executed.at(-1).command.kind,'attack');assert.equal(b.hp,expected);assert(b.hp<old);assert.equal(a.q,c.q);assert.equal(b.owner,'P2');
  assert(h.document.app.innerHTML.includes(`HP ${b.hp}/${b.maxHp}`));assert(h.document.app.innerHTML.includes(`data-building-health="${b.id}"`));assert.equal(lastSave(h).buildings.find(row=>row.id===b.id).hp,b.hp);
  await h.finish();assert.equal(h.ui.busy,false);assert(h.document.app.innerHTML.includes(`data-hp="${b.hp}"`));assert.equal(h.errors.length,0);
 });
 await test('Space pauses and resumes a busy effect without replacing the board or saving a partial transaction',async()=>{
  const h=harness();await freeGame(h);const s=h.ui.game,u=h.context.Game.ownUnits(s).find(u=>oneStep(h,u)),route=oneStep(h,u);h.battle.focusUnit(u.id);h.battle.pickCell(route.q,route.r);await h.flush();assert.equal(h.ui.busy,true);const board=h.document.getElementById('board'),writes=h.document.app.writes,saves=h.saved.length,revision=s.revision;
  const event=await h.key('Space');assert.equal(event.defaultPrevented,true);assert.equal(h.ui.paused,true);assert.equal(h.paused,true);assert.equal(h.document.getElementById('board'),board);assert.equal(h.document.app.writes,writes);assert.equal(h.saved.length,saves);const active=s.activeMillis;await h.tick();assert.equal(s.activeMillis,active);assert.equal(s.revision,revision);
  await h.key('Space',{repeat:true});assert.equal(h.ui.paused,true);await h.key('Space');assert.equal(h.paused,false);assert.equal(h.document.getElementById('board'),board);await h.finish();assert.equal(h.ui.busy,false);assert.equal(lastSave(h).revision,revision);
 });
 await test('Space in editable fields does not pause the game',async()=>{
  const h=harness();await freeGame(h);const input=h.document.createElement('input');await h.key('Space',{target:input});assert.equal(h.ui.paused,false);assert.equal(h.paused,false);
 });
 await test('Direct construction commits money and foundation to the same saved transaction',async()=>{
  const h=harness();await freeGame(h);const G=h.context.Game,s=h.ui.game,type='market',c=s.cells.find(c=>!G.constructReason(s,type,c));assert.ok(c);await h.action('drawer-build');await h.change('#build-type',type);await h.click('[data-action="build-mode"]');const money=G.player(s).resources.money,revision=s.revision;h.battle.pickCell(c.q,c.r);await h.flush();assert.equal(h.executed.at(-1).command.kind,'construct');assert.equal(G.player(s).resources.money,money-h.context.GameData.buildingById[type].cost);assert.equal(s.revision,revision+1);const saved=lastSave(h),newBuilding=s.buildings.at(-1);assert.equal(saved.buildings.at(-1).id,newBuilding.id);assert.equal(saved.buildings.at(-1).state,'foundation');assert.equal(saved.players.find(p=>p.id===s.actor).resources.money,G.player(s).resources.money);assert.equal(h.ui.busy,true);await h.finish();
 });
 await test('Production button immediately pays and saves a complete facility order',async()=>{
  const h=harness();await freeGame(h);const G=h.context.Game,s=h.ui.game,b=G.ownBuildings(s).find(b=>b.type==='barracks');await h.action('drawer-building');h.battle.pickCell(b.q,b.r);const select=h.document.getElementById('production-type');assert.ok(select);const type=select.value,money=G.player(s).resources.money;await h.click('[data-action="produce"]');assert.equal(h.executed.at(-1).command.kind,'produce');assert.equal(b.order.kind,'unit');assert.equal(b.order.type,type);assert.equal(G.player(s).resources.money,money-h.context.GameData.byId[type].cost);const saved=lastSave(h);assert.equal(saved.buildings.find(x=>x.id===b.id).order.id,b.order.id);assert.equal(saved.players.find(p=>p.id===s.actor).resources.money,G.player(s).resources.money);await h.finish();
 });
 await test('Setting a deployment tile persists it, and clearing an occupied tile deploys exactly the FIFO head in the same save',async()=>{
  const h=harness();await freeGame(h);const G=h.context.Game,s=h.ui.game,b=G.ownBuildings(s).find(b=>b.type==='barracks'),c=[b,...h.context.Hex.neighbors(b)].map(p=>G.cell(s,p)).find(c=>c&&!G.occupied(s,c)&&Number.isFinite(h.context.Hex.cost('infantry',c)));assert.ok(c);
  await h.action('drawer-building');h.battle.pickCell(b.q,b.r);await h.click('[data-action="set-deployment"]');assert.equal(h.ui.intent,'setDeployment');h.battle.pickCell(c.q,c.r);await h.flush();assert.equal(h.executed.at(-1).command.kind,'setDeployment');assert.deepEqual(copy(lastSave(h).buildings.find(x=>x.id===b.id).deployment),{q:c.q,r:c.r});await h.finish();assert.equal(h.ui.drawer,'building');
  const blocker=G.normalizeUnit({id:'integration-blocker',type:'infantry',owner:s.actor,q:c.q,r:c.r},s);s.units.push(blocker);b.stock.push({id:'fifo-one',type:'infantry',sourceId:b.id},{id:'fifo-two',type:'infantry',sourceId:b.id});G.vision(s);h.env.render();assert.ok(h.document.app.innerHTML.includes('仓库 2/3'));assert.ok(!h.document.app.innerHTML.includes('data-stock="fifo-one"'));
  const route=[...G.movement(s,blocker).values()].find(p=>p.path.length===1);assert.ok(route);h.battle.focusUnit(blocker.id);h.battle.pickCell(route.q,route.r);await h.flush();assert.equal(h.executed.at(-1).command.kind,'move');assert.equal(b.stock.length,1);assert.equal(b.stock[0].id,'fifo-two');const spawned=G.occupied(s,c);assert.ok(spawned&&spawned.id!==blocker.id);const saved=lastSave(h);assert.ok(saved.units.some(u=>u.id===spawned.id));assert.equal(saved.buildings.find(x=>x.id===b.id).stock[0].id,'fifo-two');await h.finish();assert.equal(h.errors.length,0);
 });
 await test('Production completion automatically creates a field unit at its saved deployment tile without a manual deploy button',async()=>{
  const h=harness();await freeGame(h);const G=h.context.Game,s=h.ui.game,b=G.ownBuildings(s).find(b=>b.type==='barracks'),target=G.deploymentCell(s,b);s.units=s.units.filter(u=>u.q!==target.q||u.r!==target.r);G.vision(s);await h.action('drawer-building');h.battle.pickCell(b.q,b.r);await h.change('#production-type','infantry');await h.click('[data-action="produce"]');await h.finish();
  for(let i=0;i<2;i++){const ending=h.env.act({kind:'end'},true);await h.flush();await h.finish();await ending;}
  const deployed=G.occupied(s,target);assert.ok(deployed&&deployed.type==='infantry');assert.equal(b.order,null);assert.equal(b.stock.length,0);assert.ok(lastSave(h).units.some(u=>u.id===deployed.id));assert.ok(s.events.some(e=>e.kind==='deployment'&&e.automatic));assert.equal(h.errors.length,0);
 });
 await test('Loading an old queued snapshot releases its free deployment head once without another turn or income',async()=>{
  const h=harness();await freeGame(h);const G=h.context.Game,s=h.ui.game,b=G.ownBuildings(s).find(b=>b.type==='barracks'),destination=G.deploymentCell(s,b);s.units=s.units.filter(u=>u.q!==destination.q||u.r!==destination.r);b.stock.push({id:'restore-fifo',type:'infantry',sourceId:b.id});G.vision(s);const count=s.units.length,money=G.player(s).resources.money,ownTurn=G.player(s).ownTurnIndex,entry=h.context.GameStorage.save(s,{manual:true,label:'Queued snapshot'});
  await h.action('saves');await h.click(`[data-load="${entry.id}"]`);const loaded=h.ui.game,facility=G.building(loaded,b.id);assert.equal(facility.stock.length,0);assert.equal(loaded.units.length,count+1);assert.ok(G.occupied(loaded,destination));assert.equal(G.player(loaded).resources.money,money);assert.equal(G.player(loaded).ownTurnIndex,ownTurn);assert.equal(lastSave(h).buildings.find(x=>x.id===b.id).stock.length,0);assert.equal(h.errors.length,0);
 });
 await test('Repeated clicks while busy execute no extra commands and rejected movement does not save',async()=>{
  const h=harness();await freeGame(h);const s=h.ui.game,u=h.context.Game.ownUnits(s).find(u=>oneStep(h,u)),route=oneStep(h,u);h.battle.focusUnit(u.id);const before=h.executed.length;h.battle.pickCell(route.q,route.r);h.battle.pickCell(route.q,route.r);assert.equal(h.executed.length,before+1);await h.finish();const saves=h.saved.length;await h.env.act({kind:'move',unitId:u.id,q:999,r:999});assert.equal(h.saved.length,saves);assert.equal(h.ui.busy,false);
 });
 await test('Ambient scene is active only on the current battlefield and its independent setting is saved',async()=>{
  const h=harness();assert.equal(h.sceneCalls.at(-1).active,false);await freeGame(h);assert.equal(h.sceneCalls.at(-1).active,true);await h.action('drawer-menu');const option=h.document.getElementById('battle-ambience');assert.ok(option);option.checked=false;h.document.dispatch('change',{target:option});await h.flush();assert.equal(h.ambienceCalls.at(-1),false);assert.equal(JSON.parse(h.stored.get('six-realms-ui-v08')).ambience,false);await h.key('Space');assert.equal(h.sceneCalls.at(-1).active,false);await h.key('Space');assert.equal(h.sceneCalls.at(-1).active,true);h.document.hidden=true;h.document.dispatch('visibilitychange',{});assert.equal(h.sceneCalls.at(-1).active,false);h.document.hidden=false;await h.action('home');assert.equal(h.sceneCalls.at(-1).active,false);assert.equal(h.errors.length,0);
 });
 await test('Fixture storage is isolated in VM memory and real source files remain unchanged',async()=>{
  const before=fs.readFileSync(path.join(project,'src','ui.js'),'utf8'),h=harness();await freeGame(h,'hell');assert.ok(h.stored.has('six-realms-v0.7'));assert.equal(fs.readFileSync(path.join(project,'src','ui.js'),'utf8'),before);assert.equal(h.context.localStorage.getItem('unrelated-user-key'),null);assert.equal(h.errors.length,0);
 });

 await test('Touch movement executes directly, saves once and can undo AP and energy',async()=>{
  const h=harness();await freeGame(h);const G=h.context.Game,s=h.ui.game,u=G.ownUnits(s).find(u=>oneStep(h,u)),route=oneStep(h,u),before=copy(u),energy=G.player(s).resources.energy;h.battle.focusUnit(u.id);h.ui.isTouch=true;
  const revision=s.revision,saves=h.saved.length,executed=h.executed.length;h.battle.touchCell(route.q,route.r);await h.flush();assert.equal(h.executed.length,executed+1);assert.equal(h.ui.pendingTouch,null);assert.equal(s.revision,revision+1);assert.equal(h.saved.length,saves+1);await h.finish();await h.action('undo-move');assert.deepEqual(copy(G.unit(s,u.id)),before);assert.equal(G.player(s).resources.energy,energy);assert.equal(lastSave(h).revision,s.revision);assert.ok(s.revision>revision+1);assert.equal(h.errors.length,0);
 });
 await test('Paused touch orders cannot execute or create an undo entry',async()=>{
  const h=harness();await freeGame(h);const G=h.context.Game,s=h.ui.game,u=G.ownUnits(s).find(u=>oneStep(h,u)),route=oneStep(h,u);h.battle.focusUnit(u.id);await h.action('pause');const n=h.executed.length,saves=h.saved.length;h.battle.touchCell(route.q,route.r);assert.equal(h.executed.length,n);assert.equal(h.saved.length,saves);assert.ok(h.ui.moveUndoReason);await h.action('pause');
 });
 await test('Touch at overview zoom uses the tapped cell directly without another tap or camera change',async()=>{
  const h=harness();await freeGame(h);const G=h.context.Game,s=h.ui.game,u=G.ownUnits(s).find(u=>oneStep(h,u)),route=oneStep(h,u);h.battle.focusUnit(u.id);h.ui.camera.width=6000;h.battle.touchCell(route.q,route.r);await h.flush();assert.equal(h.ui.camera.width,6000);assert.equal(h.executed.at(-1).command.kind,'move');assert.equal(h.ui.pendingTouch,null);await h.finish();
 });
 await test('Lobby exposes all audio groups and retains a migrated total mute',async()=>{
  const h=harness();await h.action('audio-settings');assert.ok(h.document.getElementById('battle-sound'));assert.equal(h.document.querySelectorAll('[data-audio-group]').length,6);const sound=h.document.getElementById('battle-sound');sound.checked=false;h.document.dispatch('change',{target:sound});await h.flush();assert.equal(h.ui.sound,false);assert.equal(JSON.parse(h.stored.get('six-realms-ui-v08')).sound,false);assert.equal(h.context.GameAudio.settings().muted,true);await h.action('close');assert.equal(h.ui.dialog,null);
 });


 await test('FX-only legacy mute and zero volume migrate before a new music or voice context can start',async()=>{
  for(const legacy of [{soundEnabled:false,volume:.7},{soundEnabled:true,volume:0}]){const h=harness({'six-realms-fx-v0.8':JSON.stringify(legacy),'six-realms-audio-v1':JSON.stringify({voiceEnabled:true,music:true})});assert.equal(h.ui.sound,legacy.soundEnabled);assert.equal(h.ui.volume,legacy.volume);assert.equal(h.context.GameAudio.settings().muted,!legacy.soundEnabled);assert.equal(h.context.GameAudio.settings().sources,0);}
 });


 await test('Touch long-press cannot use the desktop right-click path; returning to a mouse restores direct orders',async()=>{
  const h=harness();await freeGame(h);const s=h.ui.game,u=h.context.Game.ownUnits(s).find(u=>oneStep(h,u)),route=oneStep(h,u);h.battle.focusUnit(u.id);h.ui.isTouch=true;
  let board=h.document.getElementById('board'),target=new Element(h.document,'g',{'data-cell':route.q+','+route.r});assert.ok(h.document.app.innerHTML.includes('data-cell="'+route.q+','+route.r+'"'));const before=h.executed.length;
  board.listeners.get('contextmenu')[0]({target,pointerType:'touch',preventDefault(){}});assert.equal(h.executed.length,before);assert.equal(h.ui.pendingTouch,null);
  board.listeners.get('contextmenu')[0]({target,pointerType:'mouse',preventDefault(){}});await h.flush();assert.equal(h.ui.isTouch,false);assert.equal(h.executed.length,before+1);assert.equal(h.executed.at(-1).command.kind,'move');await h.finish();
 });

 await test('Facility management renders one avatar warehouse row and explanations as tooltips',async()=>{
  const h=harness();await freeGame(h);const s=h.ui.game,b=h.context.Game.ownBuildings(s).find(b=>b.type==='factory');b.stock=[{id:'queue-a',type:'lighttank',sourceId:b.id},{id:'queue-b',type:'engineer',sourceId:b.id}];
  h.ui.tile=h.context.Game.cell(s,b);h.ui.drawer='building';h.env.render();const html=h.document.app.innerHTML;
  assert.ok(html.includes('facility-warehouse'));assert.ok(html.includes('仓库 2/3'));assert.ok(html.includes('assets/units/avatars/lighttank.png'));assert.ok(html.includes('assets/units/avatars/engineer.png'));assert.ok(!html.includes('production-queue'));assert.ok(!html.includes('自动部署与仓库'));assert.ok(html.includes('data-tooltip='));assert.equal(h.document.querySelectorAll('[data-action="set-deployment"]').length,1);assert.ok(h.document.getElementById('production-type'));
 });
 await test('Paid rebuild control reaches the engine and saves both currencies and half HP',async()=>{
  const h=harness();await freeGame(h);const s=h.ui.game,b=h.context.Game.ownBuildings(s).find(b=>b.type==='factory');b.hp=0;const old=copy(h.context.Game.player(s).resources),cost=h.context.Game.repairCost(b);
  h.ui.tile=h.context.Game.cell(s,b);h.ui.drawer='building';h.env.render();const button=h.document.app.nodes.find(n=>n.dataset.cmd&&JSON.parse(n.dataset.cmd).kind==='repairBuilding');assert.ok(button);assert.equal(button.disabled,false);h.document.dispatch('click',{target:button});await h.flush();await h.finish();
  assert.equal(b.hp,b.maxHp/2);assert.deepEqual(copy(h.context.Game.player(s).resources),{money:old.money-cost.money,energy:old.energy-cost.energy});assert.equal(lastSave(h).buildings.find(x=>x.id===b.id).hp,b.maxHp/2);assert.equal(h.errors.length,0);
 });
 await test('Income facility management omits structural HP, repair and protection controls',async()=>{
  const h=harness();await freeGame(h);const b=h.context.Game.ownBuildings(h.ui.game).find(b=>b.type==='city'),html=h.env.buildingPanel(b);
  assert.ok(html.includes('收入据点'));assert.ok(!html.includes('facility-health'));assert.ok(!html.includes('repairBuilding'));assert.ok(!html.includes('facility-warehouse'));assert.equal(b.hp,null);
 });
 const report={date:new Date().toISOString(),scope:'Real ui.js and battle-ui.js controller with an isolated VM DOM fixture; no browser or native UI accessed.',passed:results.filter(r=>r.ok).length,total:results.length,results};
 fs.mkdirSync(path.join(project,'reports'),{recursive:true});fs.writeFileSync(path.join(project,'reports','ui-integration-tests-v0.9.json'),JSON.stringify(report,null,2));console.log(`UI integration: ${report.passed}/${report.total} groups passed`);if(report.passed!==report.total)process.exitCode=1;clearTimeout(watchdog);
})().catch(e=>{console.error(e.stack);process.exitCode=1;clearTimeout(watchdog);});
