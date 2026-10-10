(function(root){'use strict';
 // Original cel-shaded instrument illustrations: shared motifs, no fonts or filters.
 const C={ink:'#182d46',cream:'#fff4d1',gold:'#ffc75b',darkGold:'#b57d3e',teal:'#74e0ca',darkTeal:'#328a91',blue:'#9fd8f5',darkBlue:'#487da8',rose:'#ffaf9b',darkRose:'#ad5869',violet:'#d4baff',darkViolet:'#7e6aaa'};
 const p=(d,f=C.cream)=>`<path d="${d}" fill="${f}"/>`,l=(d,c=C.cream,w=2)=>`<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}"/>`,c=(x,y,r,f=C.cream,extra='')=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${f}" ${extra}/>`,r=(x,y,w,h,f=C.cream)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${f}"/>`;
 const arrow=()=>p('M23 27h8v-6l12 11-12 11v-6h-8z',C.gold)+l('M25 29h8v-4',C.cream,1.2);
 const helmet=()=>p('M10 25v-8q14-20 28 0v8l-5 5H15z',C.blue)+p('M25 6q13 5 13 19l-5 5h-8z',C.darkBlue)+p('M11 23h26v5H11z',C.ink)+l('M15 13q5-5 10-5')+p('M18 28v8l6 4 7-5v-7')+l('M24 29v6',C.darkGold,1.5);
 const factory=()=>p('M8 39V20l10 5V16l11 8V11h8v28z')+p('M29 12h8v27h-8z',C.darkBlue)+p('M6 38h34v4H6z',C.darkTeal)+r(11,29,6,6,C.darkBlue)+r(20,29,6,6,C.darkBlue)+l('M31 9h7',C.gold,3)+l('M11 22l7 5m3-8 6 7',C.darkGold,1.3);
 const shield=()=>p('M24 6l15 6v12q-1 12-15 19Q10 36 9 24V12z',C.blue)+p('M24 9l12 5v10q-1 10-12 16z',C.darkBlue)+l('M14 15l10-4')+p('M24 18l3 5 6 1-5 4 1 6-5-3-5 3 1-6-5-4 6-1z',C.gold);
 const radar=()=>c(24,24,16,C.darkTeal)+c(24,24,12,'none',`stroke="${C.teal}" stroke-width="1.5"`)+c(24,24,6,'none',`stroke="${C.teal}" stroke-width="1"`)+p('M24 24V8q10 1 15 10z',C.teal)+l('M24 7v34M7 24h34',C.blue,1)+l('M24 24 36 13',C.cream,2.5)+c(34,17,2.5,C.gold)+c(18,30,2,C.rose);
 const tool=()=>p('M30 7q10 1 10 10l-7-3-4 5 3 5 7-3q-3 10-13 8L14 41l-7-7 14-13q-4-10 5-14l-1 7 5 3 5-3z')+p('M7 34l7 7 12-12-5-6z',C.darkGold)+c(13,35,2,C.ink)+l('M16 31l9-9',C.gold);
 const lens=()=>c(21,20,13)+c(21,20,9,C.darkTeal)+p('M26 29l5-5 12 12-7 7z',C.gold)+l('M16 14q4-3 8-1',C.blue);
 const doc=()=>p('M10 6h20l8 8v28H10z')+p('M30 6v9h8M32 16v23H13v3h25V14',C.darkGold)+l('M16 21h15M16 27h15M16 33h9',C.darkBlue);
 const flag=()=>p('M12 7h25l-6 9 6 9H12z',C.rose)+p('M12 19h21l4 6H12z',C.darkRose)+l('M11 6v36',C.cream,3)+p('M5 42l6-8 6 8z',C.gold)+p('M24 10l2 4 4 1-3 3v4l-3-2-3 2v-4l-3-3 4-1z');
 const a={
 close:()=>p('M13 8 24 19 35 8l5 5-11 11 11 11-5 5-11-11-11 11-5-5 11-11L8 13z',C.rose)+l('M13 11l11 11 11-11',C.cream,1.5),
 info:()=>doc()+`<g transform="translate(14 14) scale(.65)">${lens()}</g>`,
 undo:()=>p('M20 6 5 20l15 11v-9h9q10 0 10 10 0 7-10 8V32q3-1 3-3 0-1-3-1H20v-6H8l12-9z',C.gold)+l('M21 18h10q13 0 13 13'),
 pause:()=>r(11,8,9,32,C.gold)+r(28,8,9,32,C.gold)+r(16,10,4,28,C.darkGold)+r(33,10,4,28,C.darkGold)+l('M13 11v25M30 11v25',C.cream,1.5),
 play:()=>p('M13 7l28 17-28 17z',C.teal)+p('M13 35l24-11 4 0-28 17z',C.darkTeal)+l('M16 12l18 11'),
 menu:()=>r(7,9,34,30,C.darkBlue)+r(10,12,28,24)+[17,24,31].map(y=>c(15,y,2,C.darkTeal)+l(`M21 ${y}h12`,C.darkBlue,2.5)).join('')+p('M22 4h4v7h-4z',C.gold),
 money:()=>c(24,26,16,C.darkGold)+c(24,23,16,C.gold)+c(24,23,12,'none',`stroke="${C.cream}" stroke-width="1.7"`)+p('M24 12l6 11-6 11-6-11z',C.darkGold)+p('M24 12v22l6-11z'),
 energy:()=>p('M25 4 12 19l6 21 14 3 8-23z',C.darkTeal)+p('M25 4 14 20l10 10 14-10z',C.teal)+p('M25 4v26l13-10z')+p('M14 20l4 20 6-10z',C.blue)+l('M24 30l8 13',C.cream,1.5),
 next:()=>`<g transform="translate(-1 1) scale(.8)">${helmet()}</g>`+arrow(),
 end:()=>`<g transform="translate(-1 -2) scale(.8)">${flag()}</g>`+c(32,32,12,C.teal)+l('M26 32l4 5 8-10',C.ink,3),
 map:()=>p('M6 12l12-5 12 5 12-5v30l-12 5-12-5-12 5z')+p('M18 7v30l12 5V12z',C.darkTeal)+p('M7 26l11-4 12 6 11-8v16l-11 5-12-5-11 5z',C.blue)+l('M18 8v28M30 13v27',C.darkGold,1.5)+p('M24 17q-6-9 0-12 7 2 0 12z',C.rose)+c(24,9,1.5),
 zoomIn:()=>lens()+l('M16 20h10M21 15v10',C.cream,2.5),zoomOut:()=>lens()+l('M16 20h10',C.cream,2.5),
 home:()=>p('M8 25V17l16-12 16 12v8z',C.darkBlue)+p('M12 21h24v19H12z')+p('M19 29h10v11H19z',C.darkTeal)+p('M24 9l4 7-4 7-4-7z',C.gold)+l('M7 41h34',C.gold,3),
 overview:()=>p('M14 18l10-4 10 4v15l-10 4-10-4z',C.teal)+l('M7 16V7h9M32 7h9v9M41 32v9h-9M16 41H7v-9',C.gold,3),
 army:()=>helmet()+p('M6 38l8-7 4 6h12l4-6 8 7v5H6z',C.darkTeal)+p('M20 36l4 4 4-4',C.gold),
 build:()=>factory()+`<g transform="translate(21 19) scale(.5)">${tool()}</g>`,
 log:()=>doc()+c(32,32,10,C.darkTeal)+l('M32 25v8l5 3'),flag,
 help:()=>p('M5 11q9-4 19 1 10-5 19-1v28q-10-5-19 0-9-5-19 0z')+p('M24 12q10-5 19-1v28q-10-5-19 0z',C.blue)+l('M24 13v26M9 18l10 2M9 24l10 2M9 30l10 2',C.darkGold,1.5)+l('M31 18q7-4 7 1 0 3-5 5v3',C.ink)+c(33,32,1.3,C.ink),
 produce:()=>factory()+c(33,31,10,C.teal)+`<g transform="translate(22 20) scale(.46)">${helmet()}</g>`,
 upgrade:()=>`<g transform="translate(-2 7) scale(.77)">${factory()}</g>`+p('M30 5 41 17h-7v22h-8V17h-7z',C.gold)+l('M29 20v15M27 12l3-3 5 6',C.cream,1.5),
 deployment:()=>p('M7 28l17-10 17 10-17 12z',C.darkBlue)+l('M7 30v7l17 9 17-9v-7',C.teal)+p('M20 5h8v14h7L24 31 13 19h7z',C.gold)+l('M24 8v14'),
 repair:()=>tool()+c(35,35,8,C.darkTeal)+l('M35 30v10M30 35h10',C.cream,2.5),
 save:()=>p('M8 6h26l7 7v29H8z',C.blue)+p('M26 6h8l7 7v29H26z',C.darkBlue)+r(14,6,17,12)+r(15,26,19,16)+r(25,8,4,7,C.ink)+l('M19 31h11M19 36h11',C.darkTeal,1.8),
 export:()=>p('M7 24h9v12h16V24h9v18H7z',C.darkBlue)+p('M24 4 39 19H29v14H19V19H9z',C.gold)+l('M24 10v18'),
 sound:()=>p('M7 18h10L28 8v32L17 30H7z',C.gold)+p('M23 13l5-5v32l-5-5z',C.darkGold)+l('M33 16q10 8 0 16M37 9q15 15 0 30',C.teal,2.3),
 mute:()=>a.sound()+l('M7 7l34 34',C.rose,4),shield,
 anchor:()=>c(24,10,5,C.darkGold)+c(24,10,2)+l('M24 14v28M14 21h20',C.cream,4)+p('M24 38Q10 35 10 26l-6 5 4 9 4-4q12 15 24 0l4 4 4-9-6-5q0 9-14 12z',C.blue)+l('M24 17v20',C.gold),
 scan:radar,
 pierce:()=>p('M9 34l6 7 25-24-7-7z',C.gold)+p('M33 10l7-4 4 5-4 6z')+p('M6 6h15v12l-6 8-9-8z',C.darkBlue)+l('M16 5l-4 11 7 4-5 8',C.rose)+l('M10 33l7 7M24 21l6 6',C.darkGold),
 shock:()=>c(24,27,16,'none',`stroke="${C.darkRose}" stroke-width="2"`)+p('M24 4l4 14 12-8-6 14 11 7-15 2-6 12-4-12-16-2 12-7-5-14 12 8z',C.gold)+p('M24 16l4 9 8 3-9 3-3 9-3-9-8-3 8-3z'),
 sniper:()=>p('M6 37l27-27 9 9-7 7-8-1-9 15z',C.darkBlue)+p('M10 32l7 7 9-9-7-7z',C.gold)+c(27,20,12,C.ink)+c(27,20,9,C.darkTeal)+l('M27 10v6m0 8v6M17 20h6m8 0h6',C.cream,1.7)+c(27,20,1.5,C.rose),
 jam:()=>p('M12 40l12-25 12 25z',C.darkViolet)+l('M24 7v29M14 28h20M19 18h10')+l('M14 13q-7 7 0 14M34 13q7 7 0 14',C.violet)+p('M8 7l32 28-4 4L4 11z',C.rose)+c(24,8,3,C.gold),
 skillRepair:()=>p('M15 8h18v8h9v18h-9v8H15v-8H6V16h9z',C.darkTeal)+p('M19 12h10v9h9v9h-9v9H19v-9h-9v-9h9z')+l('M20 13h8M12 23h6',C.teal,1.5)
 };a.cancel=a.close;
 const skills={'构筑掩体':'shield','锚定防线':'anchor','主动扫描':'scan','穿甲弹':'pierce','震荡弹':'shock','定点狙击':'sniper','链路干扰':'jam','应急修复':'skillRepair'};
 function svg(name){const tone=['close','cancel','flag','shock','pierce'].includes(name)?'rose':['upgrade','money','undo','end'].includes(name)?'gold':name==='jam'?'violet':'teal';return `<svg xmlns="http://www.w3.org/2000/svg" class="ui-icon icon-${tone}" data-icon="${name}" data-art="cel-instrument" viewBox="0 0 48 48" stroke="${C.ink}" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M9 2h30l7 7v30l-7 7H9l-7-7V9z" fill="${C.ink}" stroke="${C[tone]}" stroke-width="1.4"/><path d="M9 4h28l5 5H8z" fill="${C[tone]}" opacity=".17"/>${(a[name]||a.info)()}</svg>`;}
 function button(icon,label,{action,command,reason='',tip='',cls=''}={}){const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));return `<button type="button" class="picture-button ${cls}" aria-label="${esc(label)}" data-tooltip="${esc(reason||tip||label)}" ${reason?'disabled':''} ${command?`data-cmd="${esc(JSON.stringify(command))}"`:`data-action="${esc(action)}"`}>${svg(icon)}</button>`;}
 const api={svg,button,skills,names:Object.keys(a),colors:C};root.GameIcons=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
