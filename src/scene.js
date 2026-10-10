(function(root){'use strict';
 // A guarded viewport avoids replacing SVG nodes for every finger movement.
 const margin=220,guard=80;
 function extent(camera,width,height){const h=camera.width*height/Math.max(1,width);return {left:camera.x-camera.width/2-margin,right:camera.x+camera.width/2+margin,top:camera.y-h/2-margin,bottom:camera.y+h/2+margin};}
 function contains(window,camera,width,height){if(!window)return false;const h=camera.width*height/Math.max(1,width);return camera.x-camera.width/2>=window.left+guard&&camera.x+camera.width/2<=window.right-guard&&camera.y-h/2>=window.top+guard&&camera.y+h/2<=window.bottom-guard;}
 function cells(map,window,xy){return map.filter(c=>{const p=xy(c);return p.x>=window.left&&p.x<=window.right&&p.y>=window.top&&p.y<=window.bottom;});}
 const api={extent,contains,cells,margin,guard};root.GameScene=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
