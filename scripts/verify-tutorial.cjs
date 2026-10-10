'use strict';
// Real controller + isolated DOM; deliberately not a browser/layout measurement.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {harness,chapter,freeGame,oneStep,copy}=require('./verify-ui-integration');
const T=require('../src/tutorial'),D=require('../src/data'),I=require('../src/icons');
const results=[];
async function test(name,fn){try{await fn();results.push({name,ok:true});}catch(e){results.push({name,ok:false,error:e.stack});console.error(name,e.stack);}}
function tutorStored(id,index,enabled=true){return {[T.key]:JSON.stringify({version:1,enabled,progress:{[id]:index}})};}
async function ready(h,id='C01'){
 if(id==='C01')await chapter(h);else {const p=h.context.Campaign.newProgress();p.unlocked.push(id);h.context.GameStorage.progress(p);await h.action('campaign');await h.click(`[data-chapter="${id}"]`);}
 while(h.ui.game.story.queue.length)await h.action('story-confirm');
 assert.equal(h.ui.dialog,null);
}
const state=h=>JSON.parse(h.stored.get(T.key)||'{}');
const coach=h=>h.document.getElementById('tutorial-coach');
(async()=>{
 await test('seven existing IDs, actual units, 47 authored lessons, 37 instrument drawings',()=>{
  assert.deepEqual(Object.keys(T.lessons),['C01','C02','C03','C04','C05','C06','C07']);assert.equal(Object.values(T.lessons).reduce((n,l)=>n+l.steps.length,0),47);
  assert.deepEqual(T.buttons.map(b=>b[0]).sort(),I.names.slice().sort());for(const l of Object.values(T.lessons)){assert.ok(D.byId[l.guide]);for(const s of l.steps){assert.ok(s.text.length>20);for(const id of [...s.select||[],...s.unitTypes||[]])assert.ok(D.byId[id]);for(const id of s.building||[])assert.ok(D.buildingById[id]);}}
 });
 await test('opening story suppresses coach, then nonmodal first lesson appears inside frame',async()=>{
  const h=harness();await chapter(h);assert.equal(coach(h),null);while(h.ui.game.story.queue.length)await h.action('story-confirm');assert.ok(coach(h));assert.equal(coach(h).dataset.lesson,'C01');assert.equal(h.document.app.inert,false);assert.ok(h.document.app.innerHTML.indexOf('id="tutorial-coach"')<h.document.app.innerHTML.lastIndexOf('</div>'));assert.equal(h.executed.length,0);
 });
 await test('direct selection and successful move each advance once; rejected command does not',async()=>{
  const h=harness(tutorStored('C01',1));await ready(h);const G=h.context.Game,u=G.ownUnits(h.ui.game,'union').find(u=>u.type==='infantry');h.battle.pickCell(u.q,u.r);assert.equal(state(h).progress.C01,2);h.env.render();assert.equal(state(h).progress.C01,2);
  await h.env.act({kind:'move',unitId:u.id,q:999,r:999});assert.equal(state(h).progress.C01,2);const route=oneStep(h,u);const promise=h.env.act({kind:'move',unitId:u.id,q:route.q,r:route.r});assert.equal(state(h).progress.C01,3);assert.equal(coach(h),null);await h.finish();await promise;h.env.render();assert.equal(state(h).progress.C01,3);assert.equal(h.ui.pendingTouch,null);
 });
 await test('undo completes reading practice without changing tutorial format or save schema',async()=>{
  const h=harness(tutorStored('C01',2));await ready(h);const G=h.context.Game,u=G.ownUnits(h.ui.game,'union')[0],route=oneStep(h,u),before=copy(u);h.battle.focusUnit(u.id);const p=h.env.act({kind:'move',unitId:u.id,q:route.q,r:route.r});await h.finish();await p;await h.action('undo-move');assert.equal(state(h).progress.C01,4);assert.equal(G.unit(h.ui.game,u.id).q,before.q);assert.equal(h.ui.game.schemaVersion,'game-0.7');assert.equal(h.ui.game.ruleVersion,'0.7');assert.ok(!Object.hasOwn(h.saved.at(-1).entry.snapshot,'tutorial'));
 });
 await test('end turn advances despite actor change; AI commands cannot advance',async()=>{
  const h=harness(tutorStored('C01',7));await ready(h);const p=h.env.act({kind:'end'});assert.equal(state(h).progress.C01,8);await h.finish();await p;assert.equal(coach(h),null);h.env.Tutorial.advance(-1);const before=state(h).progress.C01;h.env.Tutorial.command({kind:'end'},{automatic:true,actor:'red'});assert.equal(state(h).progress.C01,before);
 });
 await test('mobile off/on menu is persistent and immediately removes hints; disabled actions earn no progress',async()=>{
  const h=harness({}, {width:390,height:844,coarse:true});await ready(h);await h.click('[data-action="tutorial-disable"]');assert.equal(state(h).enabled,false);assert.equal(coach(h),null);await h.action('drawer-menu');const toggle=h.document.getElementById('tutorial-enabled');assert.equal(toggle.checked,false);toggle.checked=true;await h.change('#tutorial-enabled',true);assert.equal(state(h).enabled,true);await h.action('drawer-close');assert.ok(coach(h));
  const reload=harness(Object.fromEntries(h.stored),{width:390,height:844,coarse:true});await ready(reload);assert.ok(coach(reload));assert.equal(reload.document.app.inert,false);
 });
 await test('off preference survives reload, mission progress independent, replay scoped to current mission',async()=>{
  const h=harness({[T.key]:JSON.stringify({enabled:false,progress:{C01:5,C02:4}})});await ready(h,'C02');assert.equal(coach(h),null);h.env.Tutorial.command({kind:'produce'},{actor:'union'});assert.equal(state(h).progress.C02,4);await h.action('tutorial-replay');assert.ok(coach(h));assert.equal(state(h).progress.C02,0);assert.equal(state(h).progress.C01,5);
 });
 await test('each mission can read all steps without a forced command or reward; completion survives replay entry',async()=>{
  for(const id of Object.keys(T.lessons)){const h=harness();await ready(h,id);const before=copy(h.ui.game),writes=h.saved.length;for(let n=0;n<T.lessons[id].steps.length;n++)await h.action('tutorial-next');assert.equal(coach(h),null);assert.deepEqual(copy(h.ui.game),before);assert.equal(h.executed.length,0);assert.equal(h.saved.length,writes);assert.equal(state(h).progress[id],T.lessons[id].steps.length);assert.ok(!h.ui.game.story.progress.completed[id]);await h.action('tutorial-prev');assert.ok(coach(h));}
 });
 await test('library has all roles, facilities, buttons and curriculum; mobile backdrop/X dismiss',async()=>{
  const h=harness({}, {width:390,height:844,coarse:true});await ready(h);await h.action('tutorial-library');assert.equal(coach(h),null);assert.ok(h.document.app.innerHTML.includes('七课全文'));for(const id of Object.keys(T.lessons))assert.ok(h.document.app.innerHTML.includes(id));
  await h.action('tutorial-tab-buttons');for(const icon of I.names)assert.ok(h.document.app.innerHTML.includes(`data-icon="${icon}"`),icon);
  await h.action('tutorial-tab-units');for(const d of D.units)assert.ok(h.document.app.innerHTML.includes(d.name));
  await h.action('tutorial-tab-buildings');for(const b of D.buildings)assert.ok(h.document.app.innerHTML.includes(b.name));assert.ok(h.document.app.innerHTML.includes('无结构 HP'));
  await h.click('[data-dismiss="drawer"]');assert.equal(h.ui.drawer,null);assert.ok(coach(h));await h.action('tutorial-library');await h.click('[data-action="drawer-close"]');assert.equal(h.ui.drawer,null);
 });
 await test('library from lobby supports real tab changes and close',async()=>{
  const h=harness();await h.action('audio-settings');assert.ok(h.document.getElementById('tutorial-enabled'));await h.action('tutorial-library');await h.action('tutorial-tab-units');assert.ok(h.document.modal.innerHTML.includes('远雷'));await h.action('close');assert.equal(h.ui.dialog,null);
 });
 await test('pause suppresses coach and focus; resume restores it, dialogs and AI never overlay',async()=>{
  const h=harness(tutorStored('C01',1));await ready(h);assert.ok(h.document.querySelector('.tutorial-focus'));await h.action('pause');assert.equal(coach(h).hidden,true);assert.equal(h.document.querySelector('.tutorial-focus'),null);await h.action('pause');assert.equal(coach(h).hidden,false);await h.action('drawer-menu');assert.equal(coach(h),null);await h.action('drawer-close');const p=h.env.act({kind:'end'});await h.finish();await p;assert.equal(coach(h),null);
 });
 await test('capture advances on successful auto occupation only, skill filters require right model',async()=>{
  const h=harness(tutorStored('C01',5));await ready(h);h.env.Tutorial.command({kind:'move'},{actor:'union',events:[{kind:'move',actor:'union'}]});assert.equal(h.env.Tutorial.status('C01').index,5);h.env.Tutorial.command({kind:'move'},{actor:'union',events:[{kind:'capture',actor:'union',buildingId:'C01-NC'}]});assert.equal(state(h).progress.C01,6);
  const h2=harness(tutorStored('C04',2));await ready(h2,'C04');const units=h2.context.Game.ownUnits(h2.ui.game,'union'),wrong=units.find(u=>u.type!=='tacticalrecon'),right=units.find(u=>u.type==='tacticalrecon');h2.env.Tutorial.command({kind:'skill',unitId:wrong.id},{actor:'union'});assert.equal(h2.env.Tutorial.status('C04').index,2);const p=h2.env.act({kind:'skill',unitId:right.id});await h2.finish();await p;assert.equal(state(h2).progress.C04,3);
 });
 await test('real arrival occupation teaches correctly even with a full 600-event ring',async()=>{
  const h=harness(tutorStored('C01',5));await ready(h);const s=h.ui.game,G=h.context.Game,H=h.context.Hex,city=s.buildings.find(b=>b.type==='city'),u=G.ownUnits(s,'union').find(u=>u.type==='infantry');
  const origin=s.cells.find(c=>H.distance(c,city)===1&&['plain','road','coast'].includes(c.terrain)&&!G.occupied(s,c)&&!s.buildings.some(b=>b.q===c.q&&b.r===c.r));assert.ok(origin);Object.assign(u,{q:origin.q,r:origin.r,ap:2});s.events=Array.from({length:600},()=>({kind:'move',actor:'union'}));G.vision(s);h.battle.focusUnit(u.id);
  const p=h.env.act({kind:'move',unitId:u.id,q:city.q,r:city.r});await h.finish();await p;assert.equal(city.owner,'union');assert.equal(u.ap,0);assert.equal(s.events.length,600);assert.equal(state(h).progress.C01,6);assert.equal(h.executed.at(-1).result.ok,true);
 });
 await test('old UI preferences and malformed teaching storage gracefully retain gameplay',async()=>{
  for(const stored of ['{bad',JSON.stringify({progress:{C01:-1,C02:'3',C03:99999,UNKNOWN:8}})]){const h=harness({'six-realms-ui-v08':JSON.stringify({sound:false,volume:.2}),[T.key]:stored});await ready(h);assert.equal(h.ui.sound,false);assert.equal(h.ui.volume,.2);assert.ok(coach(h));await h.action('toggle-sound');assert.ok(coach(h));assert.equal(h.errors.length,0);}
 });
 await test('free battle has no automatic lessons but reference and menu toggle remain available',async()=>{
  const h=harness();await freeGame(h);assert.equal(coach(h),null);await h.action('drawer-menu');assert.ok(h.document.getElementById('tutorial-enabled'));await h.action('tutorial-library');assert.ok(h.document.app.innerHTML.includes('C07'));
 });
 await test('teaching reference uses static rules only; no unseen positions or HP are fetched',async()=>{
  const h=harness();await ready(h);const before=copy(h.ui.game),a=h.env.Tutorial.library();h.ui.game.units.filter(u=>u.owner==='red').forEach(u=>{u.q=899;u.r=799;u.hp=12345;});assert.equal(h.env.Tutorial.library(),a);h.env.Tutorial.setTab('units');const text=h.env.Tutorial.library();assert.ok(!text.includes('12345'));assert.ok(!text.includes('899'));h.ui.game=before;
 });
 await test('mobile coach is compact, edge placed, hidden obeys CSS, safe insets and landscape handled',()=>{
  const css=fs.readFileSync(path.join(__dirname,'../tutorial.css'),'utf8');assert.ok(css.includes('.tutorial-coach[hidden]{display:none}'));assert.ok(css.includes('var(--safe-top)'));assert.ok(css.includes('var(--safe-left)'));assert.ok(css.includes('orientation:landscape'));assert.ok(css.includes('overflow-y:auto'));assert.ok(!css.includes('inset:0'));assert.ok(!css.includes('animation:'));
 });
 const failures=results.filter(r=>!r.ok);const report={date:new Date().toISOString(),scope:'Controller integration + curriculum/rules/static CSS, no browser or real phone layout measurement',passed:results.length-failures.length,total:results.length,results};fs.writeFileSync(path.join(__dirname,'../reports/tutorial-tests-v1.1.5.json'),JSON.stringify(report,null,2)+'\n');console.log(`Tutorial ${report.passed}/${report.total} checks passed`);if(failures.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
