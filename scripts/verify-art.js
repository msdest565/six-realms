'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const A=require('../src/art');
const D=require('../src/data');
const H=require('../src/grid');
const checks=[];
function check(name,fn){fn();checks.push({name,passed:true});}
const center=terrain=>({q:0,r:0,terrain});
const xy=c=>({x:Math.sqrt(3)*44*(c.q+c.r/2),y:66*c.r});
const neighbors=(terrain,mask=63)=>H.offsets.map(([q,r],i)=>({q,r,terrain:mask&(1<<i)?terrain:'plain'}));
const directions=(svg,cls)=>Array.from(svg.matchAll(new RegExp(`class="${cls}" data-direction="(\\d)"`,'g')),m=>Number(m[1]));
check('38 个单位在两个阵营中的完整 SVG 与海陆两栖轮廓',()=>{
  const fingerprints=new Set();
  for(const u of D.units){
    for(const side of ['union','red']){
      const svg=A.unitSvg(u.id,side);
      assert(svg.includes(`unit-${u.id}`));
      assert(!svg.includes('undefined')&&!svg.includes('NaN'));
      assert(svg.includes('<path')&&svg.includes('</svg>'));
      assert(!/(?:href|src)="https?:|<script|onload=/.test(svg));
      assert(fs.existsSync(path.join(__dirname,'../assets/units',`${u.id}-${side}.svg`)));
    }
    fingerprints.add(A.unitMarkup(u.id).replace(/class="[^"]*"|data-art-role="[^"]*"/g,''));
    if(u.amphibious&&u.infantry)assert.notEqual(A.unitMarkup(u.id,'union','land'),A.unitMarkup(u.id,'union','sea'));
  }
  assert.equal(fingerprints.size,38);
  assert(A.unitMarkup('helicopter').includes('class="unit-rotor"'));
});
check('六个方向的道路跨格中点与反向入口一致',()=>{
  for(let i=0;i<6;i++){
    const cells=[center('road'),...neighbors('road',1<<i)],c=cells[0],n=cells[i+1];
    const svg=A.terrainMarkupContext(c,cells),match=svg.match(/class="terrain-road-arm" data-direction="(\d)" d="M0,0L([\d.-]+),([\d.-]+)"/);
    assert.deepEqual(directions(svg,'terrain-road-arm'),[i]);
    const p=xy(n);
    assert(Math.abs(Number(match[2])-p.x/2)<.001);
    assert(Math.abs(Number(match[3])-p.y/2)<.001);
    assert.deepEqual(directions(A.terrainMarkupContext(n,cells),'terrain-road-arm'),[(i+3)%6]);
  }
});
check('64 种道路邻接组合准确连接，孤立道路没有虚构出口',()=>{
  for(let mask=0;mask<64;mask++){
    const cells=[center('road'),...neighbors('road',mask)],expected=H.offsets.flatMap((_,i)=>mask&(1<<i)?[i]:[]);
    assert.deepEqual(directions(A.terrainMarkupContext(cells[0],cells),'terrain-road-arm'),expected);
  }
});
check('64 种海岸邻接组合，水体朝向相邻海洋',()=>{
  for(let mask=0;mask<64;mask++){
    const cells=[center('coast'),...neighbors('ocean',mask)],expected=H.offsets.flatMap((_,i)=>mask&(1<<i)?[i]:[]),svg=A.terrainMarkupContext(cells[0],cells);
    assert.deepEqual(directions(svg,'terrain-shore'),expected);
    assert.equal((svg.match(/class="terrain-shore"/g)||[]).length,expected.length);
  }
});
check('海洋内部六条边无硬边，相邻岸线边也不重复描边',()=>{
  const cells=[center('ocean'),...neighbors('ocean')];
  assert.deepEqual(directions(A.terrainMarkupContext(cells[0],cells),'terrain-boundary'),[]);
  cells[1].terrain='coast';
  assert.deepEqual(directions(A.terrainMarkupContext(cells[0],cells),'terrain-boundary'),[]);
  cells[1].terrain='plain';
  assert.deepEqual(directions(A.terrainMarkupContext(cells[0],cells),'terrain-boundary'),[0]);
});
check('64 种山脊组合和连续山脊的双向接合',()=>{
  for(let mask=0;mask<64;mask++){
    const cells=[center('ridge'),...neighbors('ridge',mask)],expected=H.offsets.flatMap((_,i)=>mask&(1<<i)?[i]:[]);
    assert.deepEqual(directions(A.terrainMarkupContext(cells[0],cells),'terrain-ridge-link'),expected);
    for(const i of expected)assert(directions(A.terrainMarkupContext(cells[i+1],cells),'terrain-ridge-link').includes((i+3)%6));
  }
});
check('邻接缓存兼容地形变化和地图格子追加',()=>{
  const cells=[center('road'),{q:1,r:0,terrain:'plain'}];
  assert.deepEqual(A.terrainContext(cells,cells[0]).road,[]);
  cells[1].terrain='road';
  assert.deepEqual(A.terrainContext(cells,cells[0]).road,[0]);
  cells.push({q:0,r:1,terrain:'road'});
  assert.deepEqual(A.terrainContext(cells,cells[0]).road,[0,1]);
});
check('九类建筑有独立材料地基和结构，75 个建筑等级导出完整',()=>{
  const tiles=new Set(),buildings=new Set();let count=0;
  for(const b of D.buildings){
    tiles.add(A.buildingTileMarkup(b.id,'union').replace(/class="[^"]*"/g,''));
    buildings.add(A.buildingMarkup(b.id,'union').replace(/class="[^"]*"/g,''));
    for(const side of ['union','red','neutral'])for(let level=1;level<=b.maxLevel;level++){
      const svg=A.buildingSvg(b.id,side,level);count++;
      assert(svg.includes(`building-${b.id}`));
      assert(!svg.includes('undefined')&&!svg.includes('NaN'));
      const filename=path.join(__dirname,'../assets/buildings',`${b.id}-${side}-lv${level}.svg`);
      assert.equal(fs.readFileSync(filename,'utf8'),svg);
    }
    if(b.maxLevel>1)assert.notEqual(A.buildingMarkup(b.id,'union',1),A.buildingMarkup(b.id,'union',3));
  }
  assert.equal(tiles.size,9);assert.equal(buildings.size,9);assert.equal(count,75);
});
check('8 类地形导出与地图版 SVG 均无外部依赖',()=>{
  for(const type of Object.keys(D.terrain)){
    const cells=[center(type),...neighbors(type)],svg=A.terrainSvg(type),context=A.terrainMarkupContext(cells[0],cells);
    assert(!svg.includes('undefined')&&!context.includes('NaN'));
    assert(!/https?:|<script|onload=/.test(context));
    assert.equal(fs.readFileSync(path.join(__dirname,'../assets/terrain',`${type}.svg`),'utf8'),svg);
  }
});
const benchmarkCells=[];
for(let r=-15;r<=15;r++)for(let q=-15;q<=15;q++)benchmarkCells.push({q,r,terrain:['plain','road','ridge','coast','ocean','water','rubble','ruins'][(q-r+64)%8]});
const before=performance.now();
const rendered=benchmarkCells.map(c=>A.terrainMarkupContext(c,benchmarkCells)).join('');
const benchmark={cells:benchmarkCells.length,milliseconds:+(performance.now()-before).toFixed(2),characters:rendered.length};
const report={version:'0.8',checks,passed:checks.length,assets:{units:76,terrain:8,buildings:75,total:159},benchmark};
fs.mkdirSync(path.join(__dirname,'../reports'),{recursive:true});
fs.writeFileSync(path.join(__dirname,'../reports/art-tests.json'),JSON.stringify(report,null,2));
console.log(`Art checks: ${checks.length}/${checks.length}; 159 SVG assets. ${benchmark.cells} terrain cells: ${benchmark.milliseconds} ms.`);
