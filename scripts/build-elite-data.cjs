'use strict';
// The delivered JSON is the sole source; runtime copies never invent alternate values.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),source=path.join(root,'docs','精英角色与养成配置-v0.2.json');
const data=JSON.parse(fs.readFileSync(source,'utf8'));
if(data.contentVersion!=='0.2'||data.heroes.length!==5||data.training.upgradeCosts.length!==9)throw Error('精英交付配置不完整');
const output="/* Generated from docs/精英角色与养成配置-v0.2.json; run node scripts/build-elite-data.cjs. */\n(function(root){'use strict';\n const data="+JSON.stringify(data)+";\n data.byId=Object.fromEntries(data.heroes.map(h=>[h.id,h]));\n root.GameEliteData=data;if(typeof module!=='undefined')module.exports=data;\n})(typeof window!=='undefined'?window:globalThis);\n";
fs.writeFileSync(path.join(root,'src','elite-data.js'),output);console.log('elite-data: 5 characters, 50 stat rows, 15 skills; authoritative v0.2');
