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
// The new source replaces presentation, while mission IDs, maps and triggers stay stable.
if(fs.existsSync('docs/雾海回响-运行剧情-v1.json')){
  const story=JSON.parse(read('雾海回响-运行剧情-v1.json'));
  Object.assign(scenes,story.scenes);
  campaign.title=story.title;
  for(const mission of campaign.missions)Object.assign(mission,story.metadata[mission.id]||{});
}
const storySource=fs.existsSync('docs/雾海回响-运行剧情-v1.json')?JSON.parse(read('雾海回响-运行剧情-v1.json')):{};
const campaign42=JSON.parse(read('雾海回响-6章42关配置-v1.3.json'));
const story42=JSON.parse(read('雾海回响-42关剧情台词-v1.3.json'));
const eliteDesign=JSON.parse(read('精英角色与养成配置-v0.2.json'));
if(campaign42.campaignId!==story42.campaignId||campaign42.campaignId!==eliteDesign.campaignId)throw Error('New campaign source IDs do not agree');
if(campaign42.missions.length!==42||campaign42.chapters.length!==6||Object.keys(story42.scenes).length!==143||Object.keys(story42.speakers).length!==49)throw Error('Expected 42 missions, six chapters, 128 main + 15 personal scenes and 49 speaker channels');
const mainScenes=Object.values(story42.scenes).filter(s=>!s.characterId),personalScenes=Object.values(story42.scenes).filter(s=>s.characterId);
if(mainScenes.length!==128||personalScenes.length!==15)throw Error('Invalid story scene partition');
for(const mission of campaign42.missions){
  mission.lesson=mission.primaryLesson;
  mission.optionalGoal.text=mission.optionalGoal.description;
  for(const id of [mission.scenes.intro,mission.scenes.mid,mission.scenes.outro,...mission.scenes.postOutro])if(!story42.scenes[id])throw Error('Missing scene '+id);
  for(const scene of [mission.scenes.intro,mission.scenes.mid,mission.scenes.outro])if(scenes[scene])throw Error('Legacy scene collision '+scene);
}
for(const scene of Object.values(story42.scenes))for(const line of scene.lines)if(!story42.speakers[line.speakerId])throw Error('Missing speaker '+line.speakerId);
Object.assign(scenes,story42.scenes);
const clueNames={...storySource.clueNames,...Object.fromEntries(campaign42.missions.map(m=>[m.clue,m.clueName]))};
const data = { free, campaign, campaign42, story42, eliteDesign, scenes, clueNames };
fs.writeFileSync('src/content.js', `(function(root){'use strict';const content=${JSON.stringify(data)};root.GameContent=content;if(typeof module!=='undefined')module.exports=content;})(typeof window!=='undefined'?window:globalThis);\n`);
console.log(`Content: ${free.fixedMaps.length} fixed maps, ${campaign.missions.length} tutorial missions + ${campaign42.missions.length} campaign missions, ${Object.keys(scenes).length} scenes`);
