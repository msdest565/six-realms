'use strict';
const fs=require('node:fs'),path=require('node:path'),{root,inspect}=require('./elite-art-resources.cjs');
const assets=inspect(),manifest={version:1,artVersion:'1.3.1',description:'Five named elites: 15 separately unlocked portraits, five avatars, six front/rear battlefield forms. No ordinary model substitutes.',assets};
fs.writeFileSync(path.join(root,'assets/elites/manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(`Elite art manifest: ${assets.length} inspected local PNG/WebP files`);
