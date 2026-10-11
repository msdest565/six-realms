'use strict';
// Distribution resizing/cropping only. Keep every generated PNG source intact.
const fs=require('node:fs'),path=require('node:path');
let sharp;try{sharp=require(process.env.SIX_REALMS_SHARP_PATH||'sharp');}catch{throw Error('Set SIX_REALMS_SHARP_PATH to the installed sharp module. The game needs no build or package.');}
const root=path.resolve(__dirname,'..'),cfg=require('../docs/精英角色与养成配置-v0.2.json');
const crops={E01:[285,0,400,400],E02:[325,0,420,420],E03:[230,10,420,420],E04:[315,0,420,420],E05:[325,0,420,420]};
(async()=>{
 fs.mkdirSync(path.join(root,'assets/elites/avatars'),{recursive:true});
 for(const h of cfg.heroes){
  for(const p of h.portraits){const source=path.join(root,p.assetPath);for(const [height,suffix] of [[768,'.webp'],[512,'-small.webp']])await sharp(source).resize({height,withoutEnlargement:true}).webp({quality:86,alphaQuality:100,effort:5}).toFile(source.replace(/\.png$/,suffix));}
  const [left,top,width,height]=crops[h.id],portrait=path.join(root,h.portraits[0].assetPath),avatar=path.join(root,'assets/elites/avatars',h.id+'.png');
  await sharp(portrait).extract({left,top,width,height}).resize(192,192).png().toFile(avatar);
  await sharp(avatar).webp({quality:90,alphaQuality:100}).toFile(avatar.replace('.png','.webp'));
 }
 const chibi=path.join(root,'assets/elites/chibi');if(fs.existsSync(chibi))for(const name of fs.readdirSync(chibi).filter(n=>n.endsWith('.png')))await sharp(path.join(chibi,name)).resize({width:320,height:320,fit:'inside',withoutEnlargement:true}).webp({quality:90,alphaQuality:100,effort:5}).toFile(path.join(chibi,name.replace(/\.png$/,'.webp')));
 // Contact sheet for visual QA, never loaded by the game.
 const composite=[];for(let row=0;row<5;row++)for(let column=0;column<3;column++){const h=cfg.heroes[row],png=path.join(root,h.portraits[column].assetPath),buffer=await sharp(png).resize(240,340,{fit:'contain',background:{r:14,g:32,b:46,alpha:1}}).png().toBuffer();composite.push({input:buffer,left:column*260+10,top:row*370+10});}
 await sharp({create:{width:780,height:1850,channels:4,background:'#0e202e'}}).composite(composite).png().toFile(path.join(root,'reports/elite-portraits-v1.3.1.png'));
 console.log('Elite distribution: 30 portrait WebP, 10 avatars, available chibi WebP; originals preserved.');
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
