const fs=require('node:fs');const data=require('../src/data');
fs.mkdirSync('reports',{recursive:true});
fs.writeFileSync('reports/runtime-data-v0.7.json',JSON.stringify(data,null,2));
console.log('Exported runtime data to reports/runtime-data-v0.7.json; delivered design documents are preserved.');
