(function(root){
  'use strict';
  const D=root.GameData||(typeof require!=='undefined'&&require('./data.js'));
  const fail=reason=>({ok:false,reason});
  function createState(){return {turn:1,money:D.economy.initialMoney,oil:D.economy.initialOil,fieldCount:10,buildings:['hq','city','market','oilfield','barracks','factory','port','airfield'].map(id=>({id,key:`union-${id}`,level:1})),orders:[],stock:[],stockFacilities:[]};}
  const owned=(s,id)=>s.buildings.find(b=>b.key===id)||s.buildings.find(b=>b.id===id);
  const busy=(s,id)=>{const b=owned(s,id),key=b&&(b.key||b.id);return s.orders.some(o=>key?(o.facilityKey||o.facility)===key:o.facility===id||o.facilityKey===id);};
  const count=s=>s.fieldCount+s.stock.length+s.orders.filter(o=>o.kind==='unit').length;
  function income(s){return s.buildings.reduce((total,b)=>{const spec=D.buildingById[b.id];total.money+=spec.money[b.level-1];total.oil+=spec.oil[b.level-1];return total;},{money:0,oil:0});}
  function unitCheck(s,id,facilityKey){
    const u=D.byId[id];if(!u)return fail('未知单位');const b=owned(s,facilityKey||u.facility);
    if(!b)return fail(`需要${D.buildingById[u.facility].name}`);
    if(b.id!==u.facility)return fail('设施类型不匹配');
    if(b.level<u.tier)return fail(`需要 ${D.buildingById[u.facility].name} Lv.${u.tier}`);
    if(busy(s,b.key||b.id))return fail('生产槽正在工作');
    if(count(s)>=D.economy.unitCap)return fail('达到 24 单位上限（含订单与库存）');
    if(s.money<u.cost)return fail('金钱不足');return {ok:true,facilityKey:b.key||b.id};
  }
  function recruit(s,id,facilityKey){const result=unitCheck(s,id,facilityKey);if(!result.ok)return result;const u=D.byId[id];s.money-=u.cost;s.orders.push({kind:'unit',facility:u.facility,facilityKey:result.facilityKey,unit:id,remaining:u.buildTurns,paid:u.cost});return {ok:true};}
  function upgrade(s,id){
    const b=owned(s,id),spec=b&&D.buildingById[b.id];if(!b||!spec)return fail('尚未建造');
    if(b.level>=spec.maxLevel)return fail('已达最高等级');if(busy(s,id))return fail('生产或建设槽正在工作');
    const cost=spec.upgrades[b.level-1];if(s.money<cost)return fail('金钱不足');
    s.money-=cost;s.orders.push({kind:'upgrade',facility:b.id,facilityKey:b.key||b.id,remaining:1,paid:cost});return {ok:true};
  }
  function construct(s,id){
    const b=D.buildingById[id];if(!b||id==='hq')return fail('总部由场景预设');
    if(owned(s,`union-${id}`)||busy(s,`union-${id}`))return fail('初始预留地块已建造或正在建设');
    if(s.money<b.cost)return fail('金钱不足');s.money-=b.cost;s.orders.push({kind:'build',facility:id,facilityKey:`union-${id}`,remaining:1,paid:b.cost});return {ok:true};
  }
  function advance(s){
    const gain=income(s);s.money=Math.min(D.economy.moneyCap,s.money+gain.money);s.oil=Math.min(D.economy.oilCap,s.oil+gain.oil);s.turn++;
    const done=[];
    s.orders.forEach(o=>{o.remaining--;if(o.remaining>0)return;
      if(o.kind==='unit'){s.stock.push(o.unit);s.stockFacilities.push(o.facilityKey||o.facility);}
      else if(o.kind==='upgrade')owned(s,o.facilityKey||o.facility).level++;
      else s.buildings.push({id:o.facility,key:o.facilityKey,level:1});done.push(o);
    });s.orders=s.orders.filter(o=>o.remaining>0);return {gain,done};
  }
  function spendOil(s,value){if(!Number.isInteger(value)||value<0)return fail('油耗无效');if(s.oil<value)return fail('石油不足');s.oil-=value;return {ok:true};}
  function capture(s,tile,side='union'){
    if(!tile.building||!D.buildingById[tile.building])return fail('此格没有建筑');
    if(tile.owner===side)return fail('建筑已经属于己方');
    if(!tile.siteId||s.buildings.some(b=>b.key===tile.siteId))return fail('建筑实例无效或已登记');
    const previousOwner=tile.owner;s.buildings.push({id:tile.building,key:tile.siteId,level:tile.level||1});tile.owner=side;
    return {ok:true,previousOwner};
  }
  const E={createState,owned,busy,count,income,unitCheck,recruit,upgrade,construct,advance,spendOil,capture};root.EconomyRules=E;if(typeof module!=='undefined'&&module.exports)module.exports=E;
})(typeof window!=='undefined'?window:globalThis);
