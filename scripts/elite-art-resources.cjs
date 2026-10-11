'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..');
function pngAlphaRange(buffer,width,height){
 const channels=buffer[25]===6?4:buffer[25]===4?2:0;if(!channels||buffer[24]!==8||buffer[28]!==0)return {};
 const compressed=[];for(let offset=8;offset+12<=buffer.length;){const length=buffer.readUInt32BE(offset),type=buffer.toString('ascii',offset+4,offset+8);if(type==='IDAT')compressed.push(buffer.subarray(offset+8,offset+8+length));offset+=length+12;}
 const scan=zlib.inflateSync(Buffer.concat(compressed)),rowBytes=width*channels+1;let previous=new Uint8Array(width),alphaMin=255,alphaMax=0;
 for(let y=0;y<height;y++){const row=y*rowBytes,filter=scan[row],current=new Uint8Array(width);for(let x=0;x<width;x++){const left=x?current[x-1]:0,up=previous[x],upperLeft=x?previous[x-1]:0;let predictor=0;if(filter===1)predictor=left;else if(filter===2)predictor=up;else if(filter===3)predictor=Math.floor((left+up)/2);else if(filter===4){const estimate=left+up-upperLeft,a=Math.abs(estimate-left),b=Math.abs(estimate-up),c=Math.abs(estimate-upperLeft);predictor=a<=b&&a<=c?left:b<=c?up:upperLeft;}else if(filter!==0)throw Error('Unsupported PNG filter');const alpha=(scan[row+1+x*channels+channels-1]+predictor)&255;current[x]=alpha;alphaMin=Math.min(alphaMin,alpha);alphaMax=Math.max(alphaMax,alpha);}previous=current;}
 return {alphaMin,alphaMax};
}
function dimensions(buffer,uri){
 if(uri.endsWith('.png')){if(!buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error('Invalid PNG: '+uri);const width=buffer.readUInt32BE(16),height=buffer.readUInt32BE(20);return {width,height,alpha:buffer[25]===6||buffer[25]===4,...pngAlphaRange(buffer,width,height)};}
 if(buffer.toString('ascii',0,4)!=='RIFF'||buffer.toString('ascii',8,12)!=='WEBP')throw Error('Invalid WebP: '+uri);
 for(let offset=12;offset+8<=buffer.length;){const type=buffer.toString('ascii',offset,offset+4),size=buffer.readUInt32LE(offset+4),p=offset+8;
  if(type==='VP8X')return {width:buffer.readUIntLE(p+4,3)+1,height:buffer.readUIntLE(p+7,3)+1,alpha:!!(buffer[p]&16)};
  if(type==='VP8L'){const bits=buffer.readUInt32LE(p+1);return {width:(bits&16383)+1,height:((bits>>>14)&16383)+1,alpha:!!((bits>>>28)&1)};}
  if(type==='VP8 ')return {width:buffer.readUInt16LE(p+6)&16383,height:buffer.readUInt16LE(p+8)&16383,alpha:false};offset=p+size+(size%2);
 }throw Error('WebP dimensions not found: '+uri);
}
function specifications(){
 const cfg=JSON.parse(fs.readFileSync(path.join(root,'docs','精英角色与养成配置-v0.2.json'),'utf8')),assets=[];
 for(const h of cfg.heroes){
  for(const portrait of h.portraits){const png=portrait.assetPath;if(png!==`assets/elites/portraits/${portrait.id}.png`)throw Error('Portrait must use its delivered assetPath: '+portrait.id);for(const [suffix,variant] of [['.png','original'],['.webp','web'],['-small.webp','compact']])assets.push({uri:png.replace(/\.png$/,suffix),role:'portrait',characterId:h.id,portraitId:portrait.id,variant});}
  for(const suffix of ['.png','.webp'])assets.push({uri:`assets/elites/avatars/${h.id}${suffix}`,role:'avatar',characterId:h.id,variant:suffix==='.png'?'original':'web'});
  for(const domain of h.id==='E04'?['land','sea']:[h.id==='E05'?'air':'land'])for(const view of ['front','rear'])for(const suffix of ['.png','.webp'])assets.push({uri:`assets/elites/chibi/${h.id}-${domain}-${view}${suffix}`,role:'chibi',characterId:h.id,domain,view,variant:suffix==='.png'?'original':'web'});
 }
 return assets;
}
function inspect(){return specifications().map(entry=>{const target=path.resolve(root,entry.uri);if(!target.startsWith(root+path.sep))throw Error('Asset escapes workspace: '+entry.uri);let folder=root;for(const name of entry.uri.split('/')){if(!fs.readdirSync(folder).includes(name))throw Error('Missing asset or wrong filename case: '+entry.uri);folder=path.join(folder,name);}const b=fs.readFileSync(target);return {...entry,...dimensions(b,entry.uri),bytes:b.length};});}
module.exports={root,dimensions,specifications,inspect};
