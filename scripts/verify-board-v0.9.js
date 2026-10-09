'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const D=require('../src/data'),H=require('../src/grid'),G=require('../src/game'),M=require('../src/maps'),A=require('../src/art'),Controls=require('../src/controls');
const checks=[];
function test(name,fn){try{fn();checks.push({name,ok:true});}catch(error){checks.push({name,ok:false,error:error.stack});console.error(name,error.message);}}
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const building=(type,owner,q,r,id='B')=>({id,type,owner,q,r,level:1,hp:D.buildingById[type].hp,maxHp:D.buildingById[type].hp,state:'complete',stock:[],order:null});
function fixture(units=[],buildings=[]){
 const s=G.create(M.standard(),{fog:false,controllers:['local_human','local_human']});s.cells=[];
 for(let q=-5;q<=5;q++)for(let r=-5;r<=5;r++)s.cells.push({q,r,terrain:'plain'});
 s.units=units;s.buildings=buildings;s.deposits={land:[],sea:[]};s.knownBuildings={P1:{},P2:{}};
 G.vision(s);const ui={game:s,view:'game',selected:null,tile:null,intent:null,camera:{x:0,y:0,width:1000},busy:false,drawer:null,dialog:null,paused:false,sound:true,ambience:true,volume:.4};
 const status={innerHTML:''},route={innerHTML:''},labels={innerHTML:''},attributes={},listeners={};let cameraCalls=0,renders=0;
 const board={clientWidth:1280,clientHeight:720,setAttribute:(k,v)=>attributes[k]=v,addEventListener:(k,fn)=>listeners[k]=fn};
 const doc={getElementById:id=>({board,'context-status':status,'route-preview':route,'label-focus-layer':labels}[id]||null),querySelector:()=>null,addEventListener(){}};
 const context={document:doc,innerWidth:1280,innerHeight:720,performance:{now:()=>0},requestAnimationFrame:()=>1,cancelAnimationFrame(){},addEventListener(){},GameControls:Controls,GameFX:{unlock(){}},console};context.window=context;vm.createContext(context);vm.runInContext(fs.readFileSync('src/battle-ui.js','utf8'),context);
 const b=context.GameBattleUI.create({ui,D,H,G,A,esc,btn:(text,action)=>`<button data-action="${action}">${text}</button>`,commandButton:(text,cmd)=>`<button>${text}</button>`,xy:c=>({x:Math.sqrt(3)*44*(c.q+c.r/2),y:66*c.r}),bounds:()=>({x:-500,y:-400,w:1000,h:800}),viewer:()=>ui.viewerId||s.actor,knownBuildingAt(c){const actual=s.buildings.find(b=>b.q===c.q&&b.r===c.r);return actual&&G.visible(s,ui.viewerId||s.actor,actual)?actual:Object.values(s.knownBuildings[ui.viewerId||s.actor]).find(b=>b.q===c.q&&b.r===c.r);},unitPanel:()=>'',buildingPanel:()=>'',exercisePanel:()=>'',savesPage:()=>'',render:()=>renders++,act(){},toast(){},home:()=>'',resultPanel:()=>'',onCameraChange:()=>cameraCalls++});
 return {s,ui,b,status,route,labels,attributes,listeners,get cameraCalls(){return cameraCalls;},get renders(){return renders;},hover(q,r){b.bindBoard();listeners.pointermove({target:{closest:()=>({dataset:{cell:q+','+r}})}});}};
}
const unit=(type,owner,q,r,id='U')=>G.normalizeUnit({id,type,owner,q,r});
const range=(html,key)=>Array.from(html.matchAll(new RegExp(`data-${key}="([^"]+)"`,'g')),m=>m[1]);
test('All map names appear after map cells and routes in an unclipped pointer-free label layer',()=>{
 const f=fixture([unit('heavyartillery','P1',0,0)],[building('energyplatform',null,1,0)]),html=f.b.board(),start=html.indexOf('id="board-label-layer"');
 assert(start>html.lastIndexOf('data-cell='));assert(start>html.indexOf('id="route-preview"'));
 const layer=html.slice(start);assert(layer.includes('pointer-events="none"'));assert(!layer.includes('clip-path'));assert(layer.includes(D.byId.heavyartillery.type));assert(layer.includes('海上能源平台'));
 assert(!html.slice(0,start).includes('data-building-label='));
});
test('Selected unit and hovered building show full names in a frame sized to text',()=>{
 const city=building('city',null,1,0);city.storyLabel='北部临海联合交通指挥服务中心';
 const f=fixture([unit('longrangeaa','P1',0,0)], [city]);f.ui.selected='U';const html=f.b.board();
 assert(html.includes('远程防空平台 ·'));f.hover(1,0);assert(f.labels.innerHTML.includes(city.storyLabel));assert(f.labels.innerHTML.includes('map-label-expanded'));
 const width=Number(f.labels.innerHTML.match(/<rect[^>]*\swidth="([\d.]+)"/)[1]);assert(width>140);
 f.listeners.pointerleave();assert.equal(f.labels.innerHTML,'');
});
test('Capture mode shows same cell plus six neighbors and the adjacent legal building',()=>{
 const f=fixture([unit('infantry','P1',0,0)], [building('city',null,1,0)]);f.ui.selected='U';f.ui.intent='capture';const html=f.b.board();
 assert.equal(range(html,'capture-cell').length,7);assert(range(html,'capture-cell').includes('0,0'));assert(html.includes('capture-range capture-legal'));assert(!html.includes('reachable-hex'));
});
test('Every one of the 38 models uses the same one-cell capture geometry',()=>{
 for(const d of D.units){const f=fixture([unit(d.id,'P1',0,0)],[building('city',null,1,0)]);if(d.branch==='navy')G.cell(f.s,{q:0,r:0}).terrain='ocean';f.ui.selected='U';f.ui.intent='capture';const html=f.b.board();assert.equal(range(html,'capture-cell').length,7,d.id);assert(html.includes('capture-range capture-legal'),d.id);}
});
test('Observed hostile garrison marks its building blocked without hidden-state checks',()=>{
 const f=fixture([unit('infantry','P1',0,0),unit('tank','P2',1,0,'GUARD')],[building('city','P2',1,0)]);f.ui.selected='U';f.ui.intent='capture';const html=f.b.board();assert(html.includes('capture-range capture-blocked'));assert(html.includes('建筑格内仍有敌方守军'));
});
test('A hidden air garrison does not alter capture colors, labels, or reasons',()=>{
 const f=fixture([unit('infantry','P1',0,0),unit('fighter','P2',1,0,'HIDDEN')],[building('city','P2',1,0)]);f.s.settings.fog=true;f.s.vision.P1={ground:['0,0','1,0'],air:['0,0']};f.ui.selected='U';f.ui.intent='capture';
 const withHidden=f.b.board();assert(!withHidden.includes('HIDDEN'));f.s.units=f.s.units.filter(u=>u.id!=='HIDDEN');assert.equal(f.b.board(),withHidden);
});
test('Cached buildings without current observation cannot receive a legal capture marker',()=>{
 const f=fixture([unit('infantry','P1',0,0)],[building('city','P2',1,0)]);f.s.settings.fog=true;f.s.vision.P1={ground:['0,0'],air:['0,0']};f.ui.selected='U';f.ui.intent='capture';const html=f.b.board();assert(html.includes('等待当前视野确认'));assert(!html.includes('capture-range capture-legal'));
});
test('Setting deployment shows seven local choices and occupied positions remain legal',()=>{
 const fac=building('factory','P1',0,0),f=fixture([unit('tank','P1',0,0)], [fac]);f.ui.intent='setDeployment';f.ui.facility='B';G.cell(f.s,{q:1,r:0}).terrain='ridge';const html=f.b.board();assert.equal(range(html,'deployment-choice').length,7);assert(html.includes('deployment-choice deployment-legal'));assert(html.includes('deployment-choice deployment-blocked'));assert(html.includes('data-deployment-building="B"'));assert(!html.includes('reachable-hex'));
});
test('Configured private queue shows waiting at an occupied cell and ready order waits for space',()=>{
 const fac=building('barracks','P1',0,0);fac.deployment={q:1,r:0};fac.stock=[1,2,3].map(i=>({id:'STOCK'+i,type:'infantry',sourceId:fac.id}));fac.order={id:'ORDER',kind:'unit',type:'infantry',readyOwnTurn:1};
 const f=fixture([unit('infantry','P1',1,0)], [fac]);f.ui.tile=G.cell(f.s,fac);const html=f.b.board();assert(html.includes('deployment-waiting'));assert(html.includes('队列 3/3'));assert(html.includes('部署格占位，等待'));assert(html.includes('在制待入列'));
});
test('Enemy queue and deployment settings remain private even with global visibility',()=>{
 const fac=building('barracks','P2',0,0);fac.deployment={q:1,r:0};fac.stock=[{id:'SECRET',type:'heavyinfantry',sourceId:fac.id}];const f=fixture([], [fac]);f.ui.tile=G.cell(f.s,fac);const html=f.b.board();assert(!html.includes('data-deployment-building='));assert(!html.includes('队列 1/3'));assert(!html.includes('SECRET'));
});
test('Allied production marks are visible under the same team observation permission',()=>{
 const fac=building('barracks','P2',0,0);fac.deployment={q:1,r:0};const f=fixture([], [fac]);G.player(f.s,'P2').teamId=G.player(f.s,'P1').teamId;assert(f.b.board().includes('data-deployment-building="B"'));
});
test('Movement preview reports two AP automatic capture, or the need to wait with one AP',()=>{
 const f=fixture([unit('infantry','P1',0,0)],[building('city',null,2,0)]);f.ui.selected='U';f.ui.intent='move';f.hover(2,0);assert(f.status.innerHTML.includes('移动并占领'));assert(f.status.innerHTML.includes('2 AP'));assert(f.status.innerHTML.includes('到达后接管此建筑'));
 G.unit(f.s,'U').ap=1;f.s.revision++;f.hover(2,0);assert(f.status.innerHTML.includes('1 AP'));assert(f.status.innerHTML.includes('需下回合接管'));
});
test('Hidden garrisons do not alter move-and-capture preview before commitment',()=>{
 const f=fixture([unit('infantry','P1',0,0),unit('fighter','P2',2,0,'HIDDEN')],[building('city','P2',2,0)]);f.s.settings.fog=true;f.s.vision.P1={ground:['0,0','1,0','2,0'],air:['0,0']};f.ui.selected='U';f.ui.intent='move';f.hover(2,0);const status=f.status.innerHTML;f.s.units=f.s.units.filter(u=>u.id!=='HIDDEN');f.hover(2,0);assert.equal(f.status.innerHTML,status);assert(status.includes('移动并占领'));
});
test('Deployment hover states occupancy waiting without extra AP or money',()=>{
 const fac=building('barracks','P1',0,0),f=fixture([unit('infantry','P1',1,0)], [fac]);f.ui.intent='setDeployment';f.ui.facility='B';f.hover(1,0);assert(f.status.innerHTML.includes('无需 AP 或金钱'));assert(f.status.innerHTML.includes('此格占位'));
});
test('Camera updates label density and sound-scene callback without a board render',()=>{
 const f=fixture();f.b.applyCamera();assert.equal(f.cameraCalls,1);assert.equal(f.attributes['data-label-density'],'normal');f.ui.camera.width=4000;f.b.applyCamera();assert.equal(f.attributes['data-label-density'],'overview');assert.equal(f.renders,0);
});
test('Board rendering and staged capture hover do not mutate game ownership, AP or queues',()=>{
 const fac=building('barracks','P1',-1,0),f=fixture([unit('infantry','P1',0,0)], [fac,building('city',null,2,0,'CITY')]);fac.deployment={q:-1,r:1};f.ui.selected='U';f.ui.intent='move';const before=JSON.stringify(f.s);f.b.board();f.hover(2,0);assert.equal(JSON.stringify(f.s),before);
});
test('Ocean ambience has a bounded layer and motion respects pause and reduced-motion',()=>{
 const f=fixture();f.s.cells.forEach(c=>c.terrain='ocean');const html=f.b.board(),layer=html.match(/class="ocean-atmosphere-layer"[^>]*>([\s\S]*?)<\/g>/)[1];assert((layer.match(/<path /g)||[]).length<=18);
 const css=fs.readFileSync('battle.css','utf8');assert(css.includes('.is-paused .ocean-atmosphere-layer'));assert(css.includes('@media (prefers-reduced-motion:reduce)'));f.ui.drawer='menu';assert(f.b.battle().includes('id="battle-ambience"'));
});
const report={version:'0.9',kind:'Node VM and markup observation contracts; not a browser layout measurement',passed:checks.filter(c=>c.ok).length,total:checks.length,checks};fs.mkdirSync('reports',{recursive:true});fs.writeFileSync('reports/board-tests-v0.9.json',JSON.stringify(report,null,2));console.log(`Board v0.9: ${report.passed}/${report.total}`);if(report.passed!==report.total)process.exitCode=1;
