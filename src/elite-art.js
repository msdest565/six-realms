(function(root){'use strict';
 const E=root.GameEliteData||(typeof require!=='undefined'&&require('./elite-data'));
 const palette={E01:['#72e0b6','#f6d76e'],E02:['#efb95f','#574d49'],E03:['#baa5f3','#e3e4f0'],E04:['#7bbdde','#ff9e78'],E05:['#a6d4ee','#f6e6a5']};
 const domains={E01:['land'],E02:['land'],E03:['land'],E04:['land','sea'],E05:['air']};
 const imageBox={x:7,y:0,width:86,height:86};
 const escape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const config=id=>E?.byId?.[id]||E?.heroes?.find(h=>h.id===id);
 function profile(options={}){if(options.profile)return options.profile;try{return root.GameTraining?.read?.()||null;}catch(_){return null;}}
 function unitIdentity(id,unit){return !!unit&&unit.characterId===id&&unit.elite?.characterId===id&&!!config(id);}
 // Art selection never grants a portrait or changes the training ledger. A frozen
 // battle identity remains displayable when restoring a battle on another device.
 function selectedPortrait(id,options={}){
  const h=config(id);if(!h||options.unlocked===false)return null;
  const r=profile(options)?.heroes?.[id],battle=unitIdentity(id,options.unit),portraitId=battle?options.unit.elite.portraitId:options.portraitId||h.portraits.find(x=>x.unlockSceneId===options.sceneId)?.id||r?.selectedPortraitId;
  let p=h.portraits.find(x=>x.id===portraitId);
  if(!p&&!options.portraitId)p=h.portraits.find(x=>r?.portraitIds?.includes(x.id));
  if(!p&&battle)p=h.portraits[0];
  if(!p&&options.sceneId)p=h.portraits.find(x=>x.unlockSceneId===options.sceneId);
  if(!p&&options.storyMissionId===h.portraits[0]?.unlockMissionId)p=h.portraits[0];
  if(!p)return null;
  const acquired=r?.unlocked&&r.portraitIds?.includes(p.id),story=p.unlockSceneId===options.sceneId||(p===h.portraits[0]&&p.unlockMissionId===options.storyMissionId);
  if(!acquired&&!battle&&!story)return null;
  // plannedPath is a delivery brief, never a loadable resource.
  if(p.assetPath!==`assets/elites/portraits/${p.id}.png`)return null;
  return p;
 }
 function imagePath(png,small=false){return png.replace(/\.png$/,small?'-small.webp':'.webp');}
 function placeholder(id,label='尚未加入',className=''){
  const h=config(id),color=palette[id]?.[0]||palette.E01[0];
  return `<div class="elite-placeholder elite-art-placeholder ${escape(className)}" style="--elite-color:${color}" role="img" aria-label="${escape(h?.name||id)}，${escape(label)}"><span class="elite-art-placeholder-mark" aria-hidden="true">◇</span><strong>${escape(h?.callsign||id)}</strong><small>${escape(label)}</small></div>`;
 }
 function portrait(id,options={}){
  const h=config(id),p=selectedPortrait(id,options),cls=options.className||'';
  if(!p)return placeholder(id,options.label||'完成对应剧情后获得',cls);
  const small=options.small??!!root.GameMobile?.compact?.(),png=p.assetPath;
  return `<figure class="elite-art ${escape(cls)}" data-elite-art="${escape(id)}" data-portrait-id="${escape(p.id)}" style="--elite-color:${palette[id][0]}"><img class="elite-portrait-image" src="${imagePath(png,small)}" data-png-fallback="${png}" data-elite-art-image="${escape(id)}" alt="${escape(h.name)} · ${escape(h.callsign)} · ${escape(p.title)}" loading="lazy" decoding="async"><div class="elite-art-load-fallback" hidden>${placeholder(id,'图像未能加载')}</div><figcaption><strong>${escape(h.callsign)}</strong><span>${escape(p.title)}</span></figcaption></figure>`;
 }
 function avatar(id,options={}){
  const h=config(id),p=selectedPortrait(id,options);if(!p)return placeholder(id,options.label||'尚未加入','elite-avatar-placeholder');
  const png=`assets/elites/avatars/${id}.png`;
  return `<span class="elite-avatar-frame" data-elite-art="${escape(id)}"><img class="character-avatar elite-avatar" src="${imagePath(png)}" data-png-fallback="${png}" data-elite-art-image="${escape(id)}" alt="${escape(h.name)} · ${escape(h.callsign)}" loading="lazy" decoding="async"><span class="elite-art-load-fallback" hidden aria-label="头像未能加载">◇</span></span>`;
 }
 function orientation(direction=1){direction=((direction%6)+6)%6;return {rear:direction>=4,mirror:false,direction};}
 function formPath(id,domain,rear=false,original=false){
  if(!config(id))return '';const form=domains[id].includes(domain)?domain:domains[id][0],png=`assets/elites/chibi/${id}-${form}-${rear?'rear':'front'}.png`;
  return original?png:imagePath(png);
 }
 function unitSprite(u,options={}){
  const id=u?.characterId,h=config(id);if(!h)return '';
  const domain=options.domain||u.domain||domains[id][0],direction=options.direction??root.GameAnime?.headings?.get(u.id)??1,o=orientation(direction),[a,b]=palette[id];
  const signs={E01:'<path d="M41 31h18v24H41zM44 27h12M45 38l10 12m0-12L45 50"/>',E02:'<rect x="34" y="40" width="32" height="18" rx="4"/><path d="M38 61h24M50 41V28"/>',E03:'<circle cx="50" cy="43" r="12"/><path d="M50 27v32M34 43h32"/>',E04:'<path d="M33 46h34L59 60H41zM50 46V28l12 12H50"/>',E05:'<path d="M50 27l6 16 15 10H56l-6 12-6-12H29l15-10z"/>'};
  const far=`<g class="chibi-far-symbol elite-far-symbol"><circle cx="50" cy="50" r="31" fill="#f3f6f0" stroke="${a}" stroke-width="3"/><g fill="none" stroke="#17364b" stroke-width="2.4" stroke-linejoin="round">${signs[id]}</g><text x="50" y="73" text-anchor="middle" font-size="11" font-weight="bold" fill="#17364b">${escape(h.callsign)}</text></g>`;
  const fallback=`<g class="chibi-fallback elite-sprite-fallback" style="display:none" fill="#193641" stroke="${a}" stroke-width="3"><path d="M25 18 50 5 75 18v56L50 89 25 74z"/><path d="M38 40h24v21H38z" fill="${b}"/><text x="50" y="76" text-anchor="middle" font-size="10" fill="#fff" stroke="none">${escape(h.callsign)}</text></g>`;
  return `<g class="unit-art anime-chibi elite-chibi" data-model="${escape(u.type||h.inheritUnitId)}" data-elite="${escape(id)}" data-form="${escape(domain)}" data-family="${domain==='sea'?'N':domain==='air'?'A':root.GameAnime?.family?.(h.inheritUnitId,domain)||'P'}"><ellipse class="chibi-shadow" cx="50" cy="89" rx="25" ry="5" fill="#17364b" opacity=".22"/>${domain==='sea'?'<g class="chibi-water" fill="none" stroke="#dcf5ee" stroke-width="2"><path d="M15 87q35 10 70 0M22 94q28 8 56 0"/></g>':''}<g class="chibi-body"><g class="chibi-skin"><image href="${formPath(id,domain,o.rear)}" data-character-image="${escape(id)}" data-elite-image="${escape(id)}" data-elite-art-image="${escape(id)}" data-png-fallback="${formPath(id,domain,o.rear,true)}" x="${imageBox.x}" y="${imageBox.y}" width="${imageBox.width}" height="${imageBox.height}" preserveAspectRatio="xMidYMid meet"/></g></g>${fallback}${far}<path class="elite-unit-marker" d="m50 91 5 4-5 4-5-4z" fill="${b}" stroke="#17364b" stroke-width="1.5"/></g>`;
 }
 function imageError(event){
  const el=event.target;if(!el?.hasAttribute?.('data-elite-art-image'))return;
  const attr=el.tagName?.toLowerCase()==='image'?'href':'src',png=el.getAttribute('data-png-fallback');
  if(png&&el.getAttribute(attr)!==png){el.setAttribute(attr,png);return;}
  const sprite=el.closest?.('[data-elite]');if(sprite){sprite.querySelector('.chibi-fallback')?.style.setProperty('display','inline');for(const part of sprite.querySelectorAll('.chibi-body,.chibi-rig'))part.style.display='none';return;}
  const container=el.closest?.('[data-elite-art]'),fallback=container?.querySelector?.('.elite-art-load-fallback');el.hidden=true;if(fallback)fallback.hidden=false;
 }
 const api={config,palette,domains,imageBox,selectedPortrait,portrait,avatar,placeholder,imagePath,orientation,formPath,unitSprite,imageError};root.GameEliteArt=api;if(typeof module!=='undefined')module.exports=api;
 root.document?.addEventListener('error',imageError,true);
})(typeof window!=='undefined'?window:globalThis);
