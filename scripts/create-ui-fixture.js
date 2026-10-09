const fs=require('node:fs'),G=require('../src/game'),M=require('../src/maps'),D=require('../src/data'),S=require('../src/storage');
const map=M.standard();map.id='UI-V08-ACCEPTANCE';
map.initialUnits=[
 ['infantry','P1',3,6,'步兵移动'],['scout','P1',4,5,'侦察攻击'],['engineer','P1',3,7,'工程修复'],
 ['marine','P1',4,3,'两栖移动'],['aafrigate','P1',3,2,'海军移动'],['lighttank','P1',6,6,'装甲行动'],
 ['fighter','P1',4,4,'空军行动'],['antiair','P1',5,7,'防空反击'],['infantry','P2',5,5,'近距敌军'],
 ['lighttank','P2',7,6,'敌军守备'],['fighter','P2',6,7,'敌军战机'],['antiair','P2',5,4,'敌军防空'],
 ['lightbomber','P2',6,4,'敌军轰炸机']
].map(([type,owner,q,r,label],i)=>({id:'UI-'+i,type,owner,q,r,label}));
const s=G.create(map,{fog:false,controllers:['local_human','local_human'],victoryMode:'own_all_registered_buildings'});
s.mode='sandbox';s.map.actualSource='sandbox';s.players.forEach(p=>p.resources={money:2400,energy:200});
s.buildings.filter(b=>b.owner&&D.buildingById[b.type].maxLevel===3).forEach(b=>b.level=3);
G.unit(s,'UI-0').hp=50;G.building(s,'STD-P1-barracks').stock=[{id:'UI-STOCK',type:'infantry',sourceId:'STD-P1-barracks'}];
G.vision(s);fs.mkdirSync('reports',{recursive:true});fs.writeFileSync('reports/ui-fixture-v0.8.json',JSON.stringify(S.pack(s,'v0.8 浏览器验收场景'),null,2));
console.log('Created reports/ui-fixture-v0.8.json');
