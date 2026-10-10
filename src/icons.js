(function(root){'use strict';
 // Native SVG symbols stay crisp on small screens and require no network fonts.
 const paths={
  close:'M6 6l12 12M18 6 6 18',info:'M12 10v7M12 7h.01',
  undo:'M9 5 4 10l5 5M4 10h9a6 6 0 0 1 0 12',
  pause:'M8 5v14M16 5v14',play:'m8 4 12 8-12 8Z',menu:'M4 6h16M4 12h16M4 18h16',
  money:'M12 3v18M17 6H9a3 3 0 0 0 0 6h6a3 3 0 0 1 0 6H6',energy:'m14 2-9 12h6l-1 8 9-13h-6Z',
  next:'m5 5 9 7-9 7ZM19 5v14',end:'M4 12h14m-5-5 5 5-5 5M21 4v16',
  map:'m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2ZM9 3v16M15 5v16',
  zoomIn:'M5 11h12M11 5v12m5 5 5 5',zoomOut:'M5 11h12m-1 5 5 5',
  home:'m3 10 9-7 9 7M6 9v12h12V9M10 21v-7h4v7',overview:'M3 9V3h6M15 3h6v6M21 15v6h-6M9 21H3v-6',
  army:'M8 10V4h8v6M6 21v-5a6 6 0 0 1 12 0v5M8 7h8',build:'M4 20h16M6 20V8h12v12M10 8V4h4v4M9 12h2m2 0h2m-6 4h2m2 0h2',
  log:'M6 3h12v18H6ZM9 7h6M9 11h6M9 15h4',flag:'M5 22V3m0 0h15l-4 5 4 5H5',help:'M9 7a3 3 0 1 1 5 2c-2 1-2 2-2 4M12 17h.01',
  produce:'M3 21V9l6 4V9l6 4V5h5v16ZM6 17h2m3 0h2m3 0h2',upgrade:'m5 13 7-7 7 7M12 6v15M5 3h14',
  deployment:'M4 4h6M4 4v6M20 4h-6m6 0v6M4 20h6m-6 0v-6M20 20h-6m6 0v-6M8 12h8m-4-4v8',
  repair:'m5 20 7-7M13 3a6 6 0 0 0 8 8l-4-4 2-3-3 2Z',cancel:'M6 6l12 12M18 6 6 18',
  save:'M4 3h14l3 3v15H3V3ZM7 3v7h10V3M7 21v-7h10v7',export:'M12 15V2m-4 4 4-4 4 4M4 12v9h16v-9',
  sound:'M3 9h4l5-5v16l-5-5H3ZM16 8q5 4 0 8',mute:'M3 9h4l5-5v16l-5-5H3ZM16 9l6 6m0-6-6 6',
  shield:'m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6ZM7 12l4 4 6-7',
  anchor:'M12 7v14M4 14c0 10 16 10 16 0M3 16l1-3 3 1m14 2-1-3-3 1M8 10h8',
  scan:'M12 12 19 5M12 12v-7',pierce:'m4 20 13-13m-7 1 7-1-1 7M5 3v6m-3-3h6M15 19h6',
  shock:'m12 3 2 6 7 3-7 3-2 6-2-6-7-3 7-3Z',sniper:'M12 2v5m0 10v5M2 12h5m10 0h5',
  jam:'M4 9q8-9 16 0M7 12q5-5 10 0M10 15q2-2 4 0M12 19h.01M3 3l18 18',
  skillRepair:'M8 3h8v5h5v8h-5v5H8v-5H3V8h5Z'
 };
 const skills={'构筑掩体':'shield','锚定防线':'anchor','主动扫描':'scan','穿甲弹':'pierce','震荡弹':'shock','定点狙击':'sniper','链路干扰':'jam','应急修复':'skillRepair'};
 const ring=new Set(['info','help','scan','sniper','zoomIn','zoomOut']);
 function svg(name){const shape=paths[name]||paths.info;return `<svg class="ui-icon" data-icon="${name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ring.has(name)?`<circle cx="${name.startsWith('zoom')?11:12}" cy="${name.startsWith('zoom')?11:12}" r="${name.startsWith('zoom')?8:9}"/>`:''}${name==='anchor'?'<circle cx="12" cy="4" r="2"/>':''}<path d="${shape}"/></svg>`;}
 function button(icon,label,{action,command,reason='',tip='',cls=''}={}){const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));return `<button type="button" class="picture-button ${cls}" aria-label="${esc(label)}" data-tooltip="${esc(reason||tip||label)}" ${reason?'disabled':''} ${command?`data-cmd="${esc(JSON.stringify(command))}"`:`data-action="${esc(action)}"`}>${svg(icon)}</button>`;}
 const api={svg,button,skills};root.GameIcons=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
