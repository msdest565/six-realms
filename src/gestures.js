(function(root){'use strict';
 // Pointer-only controller: a multi-touch gesture can never turn into a tap.
 function create({camera,width=()=>1,rect=()=>({left:0,top:0,width:1,height:1}),apply=()=>{},tap=()=>{},capture=()=>{},clear=()=>{}}){
  const pointers=new Map();let base=null,consumed=false;
  function snapshot(){const p=[...pointers.values()];if(!p.length){base=null;return;}const box=rect(),center={x:p.reduce((n,a)=>n+a.x,0)/p.length,y:p.reduce((n,a)=>n+a.y,0)/p.length};base={camera:{...camera},points:p.map(a=>({...a})),center,distance:p.length>1?Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y):0,box};}
  function down(e){if(e.button!==0&&e.button!==undefined)return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,type:e.pointerType});if(pointers.size===1)consumed=false;else {consumed=true;clear();}snapshot();capture(e.pointerId);}
  function move(e){const p=pointers.get(e.pointerId);if(!p||!base)return false;p.x=e.clientX;p.y=e.clientY;const list=[...pointers.values()],center={x:list.reduce((n,a)=>n+a.x,0)/list.length,y:list.reduce((n,a)=>n+a.y,0)/list.length};if(list.length>1){consumed=true;const d=Math.hypot(list[0].x-list[1].x,list[0].y-list[1].y),old=base.camera.width,newWidth=Math.max(220,Math.min(6000,old*base.distance/Math.max(1,d))),box=base.box;camera.width=newWidth;const worldX=base.camera.x+(base.center.x-box.left-box.width/2)*old/box.width,worldY=base.camera.y+(base.center.y-box.top-box.height/2)*old/box.width;camera.x=worldX-(center.x-box.left-box.width/2)*newWidth/box.width;camera.y=worldY-(center.y-box.top-box.height/2)*newWidth/box.width;apply();return true;}
   const dx=p.x-base.center.x,dy=p.y-base.center.y;if(Math.hypot(dx,dy)>7){if(!consumed)clear();consumed=true;}if(consumed){const scale=base.camera.width/Math.max(1,width());camera.x=base.camera.x-dx*scale;camera.y=base.camera.y-dy*scale;apply();return true;}return false;
  }
  function up(e){const p=pointers.get(e.pointerId);if(!p)return;const wasTap=pointers.size===1&&!consumed&&Math.hypot(e.clientX-p.startX,e.clientY-p.startY)<=7;pointers.delete(e.pointerId);if(wasTap)tap(e);if(pointers.size)snapshot();else base=null;}
  function cancel(){pointers.clear();base=null;consumed=true;clear();}
  return {down,move,up,cancel,count:()=>pointers.size,has:id=>pointers.has(id)};
 }
 root.GameGestures={create};if(typeof module!=='undefined')module.exports={create};
})(typeof window!=='undefined'?window:globalThis);
