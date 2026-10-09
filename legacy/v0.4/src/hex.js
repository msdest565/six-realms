(function (root) {
  'use strict';
  const data = root.GameData || (typeof require !== 'undefined' && require('./data.js'));
  const directions = [[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];
  const key = (q, r) => `${q},${r}`;
  const distance = (a, b) => Math.max(Math.abs(a.q-b.q), Math.abs(a.r-b.r), Math.abs(a.q+a.r-b.q-b.r));
  const position = (cell, size = 44) => ({x: Math.sqrt(3)*size*(cell.q+cell.r/2), y: 1.5*size*cell.r});
  function makeMap() {
    const cells = [];
    for (let r=0; r<9; r++) for (let col=0; col<13; col++) {
      // Bottom odd rows shift left so rotation about (q=4,r=4) preserves the board.
      const q = col - Math.floor(r/2) - (r>4 && r%2 ? 1 : 0);
      const cell = {q, r, col, terrain:'plain', building:null, owner:null};
      if (r===4 && col>0 && col<12 || (r===2 || r===6) && col>=2 && col<=10) cell.terrain='road';
      cells.push(cell);
    }
    const get = (col,r) => cells.find(c=>c.col===col&&c.r===r);
    for(const c of cells){if(c.r<3)c.terrain='ocean';if(c.r===3)c.terrain='coast';}
    [[6,1],[6,5],[5,7],[7,7]].forEach(([c,r])=>get(c,r).terrain='ridge');
    [[4,5],[8,5]].forEach(([c,r])=>get(c,r).terrain='water');
    [[4,6],[8,6],[3,8],[9,8]].forEach(([c,r])=>get(c,r).terrain='ruins');
    [[5,4],[7,4],[4,7],[8,7]].forEach(([c,r])=>get(c,r).terrain='rubble');
    const sites=[['hq',0,5],['city',2,5],['market',0,7],['oilfield',3,7],['oilrig',1,0],['barracks',2,7],['factory',1,6],['port',2,3],['airfield',1,8]];
    sites.forEach(([type,col,r])=>[['union',col],['red',12-col]].forEach(([side,c])=>{
      const t=get(c,r);t.site=type;t.siteId=`${side}-${type}`;t.owner=side;t.building=type==='oilrig'&&side==='union'?null:type;t.level=1;
      t.terrain=type==='oilrig'?'ocean':type==='port'?'coast':'plain';
      if(type==='oilrig'||type==='oilfield')t.oilDeposit=true;
    }));
    return cells;
  }
  function neighbors(cell, map) { return directions.map(([q,r])=>map.get(key(cell.q+q,cell.r+r))).filter(Boolean); }
  function layer(unit){return unit.layer||'surface';}
  function domain(unit,tile){return layer(unit)==='air'?'air':tile.terrain==='ocean'?'sea':'land';}
  function movementCost(tile,unit){
    if(layer(unit)==='air')return 1;
    if(tile.terrain==='ocean')return unit.branch==='navy'?1:Infinity;
    if(unit.branch==='navy'&&!unit.amphibious)return Infinity;
    if(unit.id==='scout'&&tile.terrain==='water')return 1;
    return data.terrain[tile.terrain].cost;
  }
  function fuelCost(tile,unit){return tile.terrain==='ocean'&&unit.seaOil!==undefined?unit.seaOil:(unit.oil||0);}
  function reach(start, unit, cells, occupied = [], options = {}) {
    const map = new Map(cells.map(c=>[key(c.q,c.r),c]));
    const blocked = new Set(occupied.filter(u=>u.hp>0 && layer(data.byId[u.type]||u)===layer(unit) && key(u.q,u.r)!==key(start.q,start.r)).map(u=>key(u.q,u.r)));
    const queue = [{cell:start,cost:0,fuel:0,road:true,path:[]}], costs = new Map([[`${key(start.q,start.r)}:1:0`,0]]), result = new Map();
    while (queue.length) {
      queue.sort((a,b)=>a.cost-b.cost||a.fuel-b.fuel);
      const current=queue.shift();
      const stateKey = `${key(current.cell.q,current.cell.r)}:${Number(current.road)}:${current.fuel}`;
      if (current.cost!==costs.get(stateKey)) continue;
      for (const next of neighbors(current.cell,map)) {
        const k=key(next.q,next.r), step=movementCost(next,unit);
        if (blocked.has(k)||!Number.isFinite(step)) continue;
        const road=layer(unit)!=='air'&&current.road&&next.terrain==='road';
        const cost=current.cost+step,fuel=current.fuel+fuelCost(next,unit);
        if(fuel>(options.oil??Infinity))continue;
        if (cost>unit.move+(road?1:0)) continue;
        const sk=`${k}:${Number(road)}:${fuel}`;
        if (cost>=(costs.get(sk)??Infinity)) continue;
        const state={cell:next,cost,fuel,road,path:[...current.path,next]};
        costs.set(sk,cost);queue.push(state);
        if (k!==key(start.q,start.r)&&(!result.has(k)||cost<result.get(k).cost||cost===result.get(k).cost&&fuel<result.get(k).fuel)) result.set(k,state);
      }
    }
    return result;
  }
  function roundCube(q,r) {
    const s=-q-r;let rq=Math.round(q),rr=Math.round(r),rs=Math.round(s);
    const dq=Math.abs(rq-q),dr=Math.abs(rr-r),ds=Math.abs(rs-s);
    if(dq>dr&&dq>ds)rq=-rr-rs;else if(dr>ds)rr=-rq-rs;
    return {q:rq,r:rr};
  }
  function line(a,b,nudge=1e-6) {
    const n=distance(a,b);if(!n)return [a];
    return Array.from({length:n+1},(_,i)=>roundCube(a.q+(b.q-a.q)*i/n+nudge,a.r+(b.r-a.r)*i/n+nudge));
  }
  function visible(a,b,cells) {
    const map=new Map(cells.map(c=>[key(c.q,c.r),c]));
    return [1e-6,-1e-6].some(e=>line(a,b,e).slice(1,-1).every(c=>{
      const tile=map.get(key(c.q,c.r));return tile&&!data.terrain[tile.terrain].blocks;
    }));
  }
  function canAttack(from,target,unit,cells) {
    if(unit.fireAfterMove===false&&from.moved)return {ok:false,reason:`${unit.type}移动后不能攻击`};
    const targetTile=cells.find(c=>c.q===target.q&&c.r===target.r);
    const targetSpec=data.byId[target.type];
    const targetDomain=targetSpec&&targetTile?domain(targetSpec,targetTile):data.states[target.state]?target.state:targetTile&&targetTile.terrain==='ocean'?'sea':'land';
    if(unit.targets&&!unit.targets.includes(targetDomain))return {ok:false,reason:`${unit.name}不能攻击${{land:'陆地',sea:'海洋',air:'空中'}[targetDomain]}目标`};
    const d=distance(from,target);
    if(d<unit.minRange)return {ok:false,reason:'目标太近，低于最小射程'};
    if(d>unit.maxRange)return {ok:false,reason:'目标超出射程'};
    if(layer(unit)!=='air'&&targetDomain!=='air'&&!unit.indirect&&!visible(from,target,cells))return {ok:false,reason:'射线被山脊或废墟遮挡'};
    return {ok:true,reason:unit.indirect?'间接火力越过遮挡（试验台全图可见）':'射程与视线均满足'};
  }
  function damage(attacker,target,tile) {
    const targetDomain=domain(target,tile);
    const domainBonus=targetDomain==='air'?(attacker.bonusAir||0):targetDomain==='sea'?(attacker.bonusSea||0):(attacker.bonusLand||0);
    const bonus=(target.category==='armored'?attacker.bonusArmor:attacker.bonusLight)+domainBonus;
    const defense=layer(target)==='air'?0:data.terrain[tile.terrain].defense;
    return {value:Math.max(data.combat.minDamage,attacker.damage+bonus-target.armor-defense),base:attacker.damage,bonus,armor:target.armor,defense};
  }
  function canCapture(from,tile,unit,occupied=[]) {
    if(!from||from.hp<=0||from.ap<1)return {ok:false,reason:'需要存活单位和至少 1 AP'};
    if(!unit.capture)return {ok:false,reason:'单位没有占领权限'};
    if(!tile.building)return {ok:false,reason:'此格没有可占领建筑'};
    if(tile.owner===from.side)return {ok:false,reason:'建筑已经属于己方'};
    if(distance(from,tile)>1)return {ok:false,reason:'需要位于建筑本格或相邻格'};
    if(occupied.some(u=>u.hp>0&&u.side!==from.side&&u.q===tile.q&&u.r===tile.r))return {ok:false,reason:'建筑内仍有敌军，需要先清除守军'};
    return {ok:true,reason:'花费 1 AP，占领后结束行动；总部同样适用'};
  }
  const hex={key,directions,distance,position,neighbors,reach,roundCube,line,visible,canAttack,damage,canCapture,makeMap,layer,domain,movementCost,fuelCost};
  root.HexRules=hex;
  if(typeof module!=='undefined'&&module.exports)module.exports=hex;
})(typeof window!=='undefined'?window:globalThis);
