(function(root){'use strict';
 const D=root.GameData||(typeof require!=='undefined'&&require('./data'));
 const CAMPAIGN='dawn-six-domains-42';
 function configurationReason(b){return ['maxPaidOrders','authoredOrderQuota','adaptiveOrderQuota','maxMoneySpentOnNewUnits','maxSimultaneousOrders','reserveRebuildMoney','reserveMovementEnergy'].every(k=>Number.isSafeInteger(b?.[k])&&b[k]>=0)?null:'敌军生产预算配置不合法';}
 function applies(s,b){return s.mission?.campaignId===CAMPAIGN&&s.mission.enemyProductionBudget&&(!b||b.owner==='red');}
 function create(s){if(!applies(s))return null;return s.enemyProductionLedger={version:1,paidOrdersUsed:0,moneySpentOnNewUnits:0,authoredUsed:[],adaptiveUsed:[],records:[]};}
 function source(s,b,type,order){const p=s.players.find(p=>p.id==='red'),plan=s.enemyPlan.find(x=>(order?.planId?x.id===order.planId:x.state==='pending')&&x.unit===type&&`${s.mission.id}-${x.facility}`===b.id&&x.earliestOwnTurn<=p.ownTurnIndex);return plan?{kind:'authored',key:plan.id}: {kind:'adaptive',key:order?.id||null};}
 function reason(s,b,type){
  if(!applies(s,b))return null;
  const limits=s.mission.enemyProductionBudget,ledger=s.enemyProductionLedger,p=s.players.find(p=>p.id==='red'),d=D.byId[type];
  const invalid=configurationReason(limits);if(invalid)return invalid;
  if(!ledger)return '敌军生产账本缺失';if(!d)return '未知生产型号';
  const from=source(s,b,type),adaptive=s.mission.enemyAdaptiveProduction;
  if(ledger.paidOrdersUsed>=limits.maxPaidOrders)return '本关敌军共享付费名额已用完';
  if(ledger.moneySpentOnNewUnits+d.cost>limits.maxMoneySpentOnNewUnits)return '本关敌军累计单位支出已达上限';
  if(s.buildings.filter(x=>x.owner==='red'&&x.order?.kind==='unit').length>=limits.maxSimultaneousOrders)return '本关敌军并行生产名额已满';
  if(p.resources.money-d.cost<limits.reserveRebuildMoney)return '需保留设施重建资金';
  if(p.resources.energy<limits.reserveMovementEnergy)return '需保留部队机动能源';
  if(from.kind==='authored'){
   if(ledger.authoredUsed.includes(from.key)||ledger.authoredUsed.length>=limits.authoredOrderQuota)return '本关定额订单配额已用完';
  }else{
   if(s.settings.difficulty==='easy')return '简单难度仅执行定额生产计划';
   if(!adaptive?.allowedModels.includes(type))return '本关自适应型号未授权';
   if(ledger.adaptiveUsed.length>=limits.adaptiveOrderQuota)return '本关自适应订单配额已用完';
  }
  return null;
 }
 // Called only after the complete Game.productionReason check, before charging.
 // Cancelling an order does not erase this append-only paid history.
 function commit(s,b,type,order){if(!applies(s,b))return;const ledger=s.enemyProductionLedger,from=source(s,b,type,order),cost=D.byId[type].cost;order.budgetSource=from.kind;ledger.paidOrdersUsed++;ledger.moneySpentOnNewUnits+=cost;(from.kind==='authored'?ledger.authoredUsed:ledger.adaptiveUsed).push(from.kind==='authored'?from.key:order.id);ledger.records.push({orderId:order.id,buildingId:b.id,type,cost,source:from.kind,planId:from.kind==='authored'?from.key:null,ownTurn:s.players.find(p=>p.id==='red').ownTurnIndex});}
 function validate(s){
  if(!applies(s))return !s.enemyProductionLedger?null:'非新版战役不可携带生产预算';
  const l=s.enemyProductionLedger,b=s.mission.enemyProductionBudget;
  const invalid=configurationReason(b);if(invalid)return invalid;
  if(!l||l.version!==1||!Number.isInteger(l.paidOrdersUsed)||!Number.isInteger(l.moneySpentOnNewUnits)||!Array.isArray(l.authoredUsed)||!Array.isArray(l.adaptiveUsed)||!Array.isArray(l.records))return '敌军生产账本格式不合法';
  if(l.paidOrdersUsed<0||l.paidOrdersUsed>b.maxPaidOrders||l.moneySpentOnNewUnits<0||l.moneySpentOnNewUnits>b.maxMoneySpentOnNewUnits||l.authoredUsed.length>b.authoredOrderQuota||l.adaptiveUsed.length>b.adaptiveOrderQuota)return '敌军生产账本超过本关配额';
  if(l.records.length!==l.paidOrdersUsed||l.authoredUsed.length+l.adaptiveUsed.length!==l.paidOrdersUsed||new Set([...l.authoredUsed,...l.adaptiveUsed]).size!==l.paidOrdersUsed)return '敌军生产账本数量不一致';
  let paid=0;const seen=new Set(),authored=[],adaptive=[];
  for(const r of l.records){const d=D.byId[r.type],facility=s.buildings.find(x=>x.id===r.buildingId);if(!d||r.cost!==d.cost||typeof r.orderId!=='string'||!/^ORDER-\d+$/.test(r.orderId)||seen.has(r.orderId)||!facility||d.facility!==facility.type||!Number.isInteger(r.ownTurn)||r.ownTurn<1)return '敌军生产支付记录不合法';seen.add(r.orderId);paid+=r.cost;if(r.source==='authored'){const plan=s.enemyPlan.find(x=>x.id===r.planId);if(!plan||plan.unit!==r.type||`${s.mission.id}-${plan.facility}`!==r.buildingId||r.ownTurn<plan.earliestOwnTurn)return '敌军定额支付记录不合法';authored.push(r.planId);}else if(r.source==='adaptive'&&s.mission.enemyAdaptiveProduction.allowedModels.includes(r.type))adaptive.push(r.orderId);else return '敌军自适应支付记录不合法';}
  if(paid!==l.moneySpentOnNewUnits||JSON.stringify(authored)!==JSON.stringify(l.authoredUsed)||JSON.stringify(adaptive)!==JSON.stringify(l.adaptiveUsed))return '敌军累计支付账本不一致';
  for(const order of s.buildings.flatMap(x=>x.owner==='red'&&x.order?.kind==='unit'?[x.order]:[]))if(!seen.has(order.id))return '敌军单位订单缺少付费记录';
  if(s.buildings.filter(x=>x.owner==='red'&&x.order?.kind==='unit').length>b.maxSimultaneousOrders)return '敌军并行单位订单超额';
  return null;
 }
 const api={applies,create,reason,commit,validate,source};root.GameCampaignBudget=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
