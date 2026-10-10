(function(root){'use strict';
 const clone=value=>JSON.parse(JSON.stringify(value));
 function create(G){
  let history=[],game=null;
  const boundary=s=>JSON.stringify(s.story&&{queue:s.story.queue,seen:s.story.seen,ending:s.story.ending,progress:s.story.progress,combatLocked:s.story.combatLocked});
  function clear(){history=[];game=null;}
  function snapshot(s){const {cells,...state}=s;return clone(state);}
  function commit(s,before,command,automatic=false){
   if(automatic||command.kind!=='move'||s.result||s.actor!==before.actor||boundary(s)!==boundary(before)){clear();return;}
   if(game!==s){clear();game=s;}
   const old=before.units.find(u=>u.id===command.unitId),now=G.unit(s,command.unitId);
   // A blocked route with no actual movement supplies intel but is not an undoable move.
   if(!old||!now||old.q===now.q&&old.r===now.r){if(history.length)history.at(-1).revision=s.revision;return;}
   history.push({before,unitId:command.unitId,revision:s.revision});if(history.length>48)history.shift();
  }
  function reason(s){return !s||game!==s||!history.length?'没有可撤销的移动':s.result||s.handoffRequired||s.story?.queue.length?'当前阶段不能撤销':G.player(s).controller!=='local_human'?'当前不是玩家回合':history.at(-1).revision!==s.revision?'已执行其他行动，不能撤销':'';}
  function restore(s){const error=reason(s);if(error)return {ok:false,error};const entry=history.pop(),next=clone(entry.before),revision=s.revision+1,cells=s.cells,millis=s.activeMillis;
   if(next.story)next.story.helpDismissed=s.story.helpDismissed;
   // Keep discovered terrain/intel. Undo never turns exploration into amnesia.
   for(const p of s.players){const id=p.id;next.explored[id]=[...new Set([...next.explored[id],...s.explored[id]])];next.revealed[id]=[...new Set([...(next.revealed[id]||[]),...(s.revealed[id]||[])])];for(const b of Object.values(s.knownBuildings[id]||{})){if(!next.knownBuildings[id][b.id]){const restored=next.buildings.find(x=>x.id===b.id);if(restored)next.knownBuildings[id][b.id]=clone(restored);}}}
   for(const key of Object.keys(s))delete s[key];Object.assign(s,next,{cells,revision,activeMillis:millis});G.vision(s);if(history.length)history.at(-1).revision=revision;
   return {ok:true,unitId:entry.unitId};
  }
  return {clear,snapshot,commit,reason,restore,get size(){return history.length;}};
 }
 const api={create};root.GameMoveUndo=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
