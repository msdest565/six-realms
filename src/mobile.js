(function(root){'use strict';
 // Layout and input are independent: compact mouse windows keep direct orders.
 function viewport(){const v=root.visualViewport;return {width:v?.width||root.innerWidth||1280,height:v?.height||root.innerHeight||720};}
 function compact(){const v=viewport();return v.width<=760||(v.width<=1200&&!!root.matchMedia?.('(pointer: coarse)').matches);}
 function cameraWidth(width=viewport().width){return Math.max(220,Math.min(6000,width*76/64));}
 function imagePath(uri){return compact()&&/^assets\/units\/(portraits|thumbnails|avatars|chibi|rear)\/[\w-]+\.png$/.test(uri)?uri.replace('assets/units/','assets/mobile/units/').replace(/\.png$/,'.webp'):uri;}
 function sync(document=root.document){if(!document)return;const v=viewport();document.body.classList.toggle('mobile-ui',compact());document.body.classList.toggle('mobile-landscape',compact()&&v.width>v.height);document.documentElement?.style?.setProperty('--viewport-height',v.height+'px');}
 const api={viewport,compact,cameraWidth,imagePath,sync};root.GameMobile=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
