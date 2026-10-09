'use strict';
const fs=require('fs'),path=require('path'),D=require('../src/data'),Anime=require('../src/anime');
const root=path.resolve(__dirname,'..');global.GameAnime=Anime;const Art=require('../src/art'),Audio=require('../src/audio');
fs.mkdirSync(path.join(root,'assets/units/layers'),{recursive:true});
const models=D.units.map(d=>{
 const a=Anime.asset(d.id);const svg=Art.unitSvg(d.id).replaceAll('assets/units/chibi/','../chibi/').replaceAll('assets/units/rear/','../rear/');
 fs.writeFileSync(path.join(root,'assets/units/layers',d.id+'.svg'),svg);
 return {...a,symmetricRig:Anime.mirrorSafe.has(d.id),directionViews:Array.from({length:6},(_,direction)=>Anime.orientation(d.id,direction)),layerSource:'assets/units/layers/'+d.id+'.svg',layerContract:['shadow','water / engine','rig bitmap mask','body bitmap clip','weapon','terminal','faction emblem','far symbol'],clips:{idle:'CSS breathing: selected + max 3 adjacent visible units',selected:'selection outline + HUD; no automatic portrait cut-in',move:'interpolate actual visible path, family timing and domain transition',transition:'replace land / sea bitmap at cell midpoint',attack:'prepare, muzzle launch, observed impact, settle',skill:'terminal + skill-specific result icon',hit:'observed damage confirmation',exit:'nonviolent rig shutdown / retreat label',deploy:'hidden until impact, then confirm',capture:'old owner at prepare; current owner at impact'}};
});
const clips={};for(const kind of ['direct','guided','indirect','sniper','entrench','anchor','scan','repair','jam','deploy','capture'])clips[kind]=Object.fromEntries(['standard','fast','reduced'].map(m=>[m,Anime.timeline(kind,m)]));
fs.writeFileSync(path.join(root,'assets/units/manifests/runtime.json'),JSON.stringify({version:'1.0',coordinateSpace:[100,100],gameplayRuleVersion:'game-0.7',states:Anime.states,modeMarkers:clips,movementFamilies:['P','T','R','W','G','N','A','H'],models},null,2));
const scores={};for(const [id,p]of Object.entries(Audio.chapters)){Audio.setScene({place:id==='menu'?'menu':id==='briefing'?'briefing':'battle',chapter:id});scores[id]={...p,beats:192,seconds:192*60/p.bpm,notes:Array.from({length:192},(_,beat)=>Audio.notesAt(beat,p).map(note=>({beat,...note}))).flat()};}
fs.writeFileSync(path.join(root,'assets/audio/manifests/score.json'),JSON.stringify({author:'Six Realms project / original offline algorithmic composition',format:'192-beat loop; Web Audio synthesis; melody motif shared across chapters',mix:{master:.26,oscillatorLimit:18,voices:'local-device optional Chinese synthesis, off by default'},scores},null,2));
const legacy=JSON.parse(fs.readFileSync(path.join(root,'assets/units/manifests/generation.json'),'utf8'));const prompts=[...legacy.records];
for(const dir of ['assets/units/sources','assets/units/direction-sources','assets/scenes'])if(fs.existsSync(path.join(root,dir)))for(const file of fs.readdirSync(path.join(root,dir)).filter(n=>n.endsWith('.prompt.json'))){prompts.push({file:dir+'/'+file,...JSON.parse(fs.readFileSync(path.join(root,dir,file),'utf8'))});}
fs.writeFileSync(path.join(root,'assets/units/manifests/prompt-records.json'),JSON.stringify({generatedWith:'built-in image_gen',records:[...new Map(prompts.map(p=>[p.prompt,p])).values()]},null,2));
console.log('38 layered SVG wrappers, 38 registry records, 12 editable original score profiles exported');
