'use strict';
const {spawnSync}=require('node:child_process');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
for(const name of ['verify-core.js','verify-facilities.js','verify-deployment.js','verify-controls.js','verify-ui.js','verify-ui-integration.js','verify-board-v0.9.js','verify-fx.js','verify-art.js','verify-anime-runtime.cjs','verify-static-resources.cjs','verify-ai.js','verify-maps.js','verify-battles.js']){
  const result=spawnSync(process.execPath,[path.join(__dirname,name)],{cwd:root,stdio:'inherit'});
  if(result.error)throw result.error;
  if(result.status!==0)process.exit(result.status||1);
}
console.log('All runtime verification suites passed. See reports/*.json.');
