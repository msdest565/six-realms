// Convert the delivered design files into offline browser data. Never rewrites design documents.
const fs = require('fs');
const read = name => fs.readFileSync(`docs/${name}`, 'utf8');
const free = JSON.parse(read('自由战役地图配置-v0.7.json'));
const campaign = JSON.parse(read('战役关卡配置-v0.6.json'));
const script = read('战役流程与剧情脚本-v0.6.md');
const scenes = {};
for (const match of script.matchAll(/###\s+(PROLOGUE|EPILOGUE|C\d{2}-(?:INTRO|MID|OUTRO))([^\n]*)\n([\s\S]*?)(?=\n###|$)/g)) {
  const text = match[3].match(/<!-- STORY_TEXT_START -->([\s\S]*?)<!-- STORY_TEXT_END -->/);
  if (text) scenes[match[1]] = { id: match[1], title: match[2].trim(), text: text[1].trim() };
}
if (Object.keys(scenes).length !== 23) throw Error('Expected all 23 story scenes');
const data = { free, campaign, scenes };
fs.writeFileSync('src/content.js', `(function(root){'use strict';const content=${JSON.stringify(data)};root.GameContent=content;if(typeof module!=='undefined')module.exports=content;})(typeof window!=='undefined'?window:globalThis);\n`);
console.log(`Content: ${free.fixedMaps.length} fixed maps, ${campaign.missions.length} chapters, ${Object.keys(scenes).length} scenes`);
