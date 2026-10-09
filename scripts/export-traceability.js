'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const documents=[['v0.5','验收用例-v0.5.md',64],['v0.6','战役验收与实现交接-v0.6.md',35],['v0.7','自由战役验收与实现交接-v0.7.md',56]];
const records=[];
function sources(version,id){
  const prefix=id.replace(/-?\d+$/,''),n=Number(id.match(/\d+$/)[0]);
  if(version==='v0.7'){
    if(prefix==='EN')return ['src/data.js','src/game.js','src/storage.js','src/art.js','src/ui.js'];
    if(n<=4)return ['src/ui.js','src/maps.js'];
    if(n>=41&&n<=45)return ['src/random.js','src/maps.js','src/storage.js'];
    if(n===46||n===47)return ['src/ai.js','src/game.js'];
    if(n===48)return ['src/game.js','src/ui.js'];
    if(n===37||n===38)return ['src/game.js','src/ui.js'];
    if(n===39||n===40)return ['src/storage.js','src/game.js'];
    return ['src/game.js','src/grid.js','src/ui.js'];
  }
  if(version==='v0.6'){
    if(prefix==='CAMP')return ['src/maps.js','src/content.js','src/game.js','src/ai.js'];
    if(prefix==='SAVE')return ['src/storage.js','src/campaign.js'];
    if(prefix==='TIME')return ['src/content.js','src/campaign.js','src/ui.js'];
    return ['src/campaign.js','src/ui.js','src/storage.js'];
  }
  return ({MAP:['src/maps.js','src/grid.js'],SAV:['src/storage.js'],UI:['src/ui.js','src/art.js'],FOG:['src/game.js','src/ui.js'],MOV:['src/grid.js','src/game.js'],ATK:['src/game.js','src/grid.js'],DEP:['src/game.js','src/ui.js']})[prefix]||['src/game.js'];
}
for(const [version,filename,count] of documents){
  const entries=fs.readFileSync(path.join(root,'docs',filename),'utf8').split(/\r?\n/).filter(line=>/^\|\s*[A-Z]+-?\d+\s*\|/.test(line)).map(line=>line.split('|').slice(1,-1).map(s=>s.trim()));
  assert.equal(entries.length,count,filename+' requirement count');
  for(const columns of entries){const id=columns[0],manual=id==='TIME-03',time=id==='TIME-04';records.push({version,id,requirement:columns.at(-2),expected:columns.at(-1),status:manual?'待首次玩家完整流程采样':time?'功能已实现；30分钟体验目标待真人采样':'功能已实现',sources:sources(version,id)});}
}
const intro='# 功能实现逐项对照 v0.7\n\n日期：2026-10-09。依据三份正式验收清单，保留原编号，共 155 项。这里记录开发实现位置，不把“已实现”当作每项都单独进行过真人验收。实际自动与浏览器结果见 [开发验收报告](开发验收报告-v0.7.md) 和 `reports/*.json`。\n\n总部出局清理、同队胜利及保守恢复判据在自由战役按 v0.7 覆盖；剧情的总部胜利保持立即结束且冻结其他资产快照。v0.4 不完整工作台存档明确拒绝。联网、真人胜率和新手时间样本不属于已验证结论。\n';
let markdown=intro;
for(const [version,filename] of documents){markdown+=`\n## ${version} · [原验收清单](${filename})\n\n| 编号 | 要求/场景 | 开发状态 | 实现位置 |\n|---|---|---|---|\n`;for(const record of records.filter(r=>r.version===version)){markdown+=`| ${record.id} | ${record.requirement} | ${record.status} | ${record.sources.map(file=>`[${file.split('/').at(-1)}](../${file})`).join('、')} |\n`;}}
fs.writeFileSync(path.join(root,'docs','功能实现对照-v0.7.md'),markdown);
fs.writeFileSync(path.join(root,'reports','requirements-v0.7.json'),JSON.stringify({date:new Date().toISOString(),records},null,2));
console.log(`Exported ${records.length} traceability entries; player timing remains explicitly pending.`);
