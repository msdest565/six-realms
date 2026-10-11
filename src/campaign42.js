(function(root){'use strict';
 const content=()=>root.GameContent||(typeof require!=='undefined'&&require('./content'));
 const id='dawn-six-domains-42';
 function catalog(){return content().campaign42;}
 function mission(missionId){return catalog().missions.find(m=>m.id===missionId)||null;}
 function scene(sceneId){return content().story42.scenes[sceneId]||null;}
 function contains(missionId){return !!mission(missionId);}
 function newProgress(){return {version:'0.7',campaignId:id,contentVersion:catalog().contentVersion,unlocked:[catalog().entryMission],completed:{},clues:[],seenScenes:[],history:[],failures:{},activeMillis:0,complete:false};}
 function unlockScenes(m){return [...(m.scenes.postOutro||[])].sort((a,b)=>{const ca=scene(a)?.characterId||a,cb=scene(b)?.characterId||b;return ca.localeCompare(cb)||a.localeCompare(b);});}
 const api={id,catalog,mission,scene,contains,newProgress,unlockScenes};root.GameCampaign42=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
