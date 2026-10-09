'use strict';
const fs = require('node:fs');
const path = require('node:path');
const data = require('../src/data.js');
const art = require('../src/art.js');
const root = path.join(__dirname, '..', 'assets');
fs.mkdirSync(path.join(root, 'units'), {recursive: true});
fs.mkdirSync(path.join(root, 'terrain'), {recursive: true});
fs.mkdirSync(path.join(root, 'buildings'), {recursive: true});
for (const unit of data.units) for (const side of Object.keys(data.factions)) {
  fs.writeFileSync(path.join(root,'units',`${unit.id}-${side}.svg`),art.unitSvg(unit.id,side));
}
for (const type of Object.keys(data.terrain)) fs.writeFileSync(path.join(root,'terrain',`${type}.svg`),art.terrainSvg(type));
for(const b of data.buildings)for(const side of ['union','red','neutral'])for(let level=1;level<=b.maxLevel;level++)fs.writeFileSync(path.join(root,'buildings',`${b.id}-${side}-lv${level}.svg`),art.buildingSvg(b.id,side,level));
console.log(`Exported ${data.units.length*2} unit SVGs, ${Object.keys(data.terrain).length} terrain SVGs, 75 building SVGs.`);
