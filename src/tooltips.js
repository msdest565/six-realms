(function(root){'use strict';
 const DELAY=1500;
 function create(document,clock=root){
  let timer=null,target=null,tooltip=null;
  function hide(){if(timer!==null)clock.clearTimeout(timer);timer=null;if(target){target.removeAttribute('aria-describedby');target=null;}if(tooltip)tooltip.hidden=true;}
  function prepare(scope=document){
   for(const node of scope.querySelectorAll('[title]')){const text=node.getAttribute('title');if(text)node.setAttribute('data-tooltip',text);node.removeAttribute('title');}
   for(const title of scope.querySelectorAll('svg title')){const text=title.textContent;if(text&&title.parentElement)title.parentElement.setAttribute('data-tooltip',text);title.remove();}
  }
  function schedule(node){
   if(node===target)return;hide();
   if(!node?.getAttribute('data-tooltip'))return;
   target=node;
   timer=clock.setTimeout(()=>{
    timer=null;if(target!==node||!node.isConnected||document.hidden)return;
    if(!tooltip){tooltip=document.createElement('div');tooltip.id='game-tooltip';tooltip.className='game-tooltip';tooltip.setAttribute('role','tooltip');document.body.appendChild(tooltip);}
    tooltip.textContent=node.getAttribute('data-tooltip');tooltip.hidden=false;node.setAttribute('aria-describedby',tooltip.id);
    const rect=node.getBoundingClientRect(),tip=tooltip.getBoundingClientRect(),width=root.innerWidth||document.documentElement.clientWidth,height=root.innerHeight||document.documentElement.clientHeight;
    tooltip.style.left=Math.max(8,Math.min(width-tip.width-8,rect.left+rect.width/2-tip.width/2))+'px';
    tooltip.style.top=Math.max(8,Math.min(height-tip.height-8,rect.bottom+tip.height+12<=height?rect.bottom+8:rect.top-tip.height-8))+'px';
   },DELAY);
  }
  document.addEventListener('pointerover',event=>{if(event.pointerType==='touch'||event.pointerType==='pen')return;schedule(event.target.closest?.('[data-tooltip]'));});
  document.addEventListener('pointerout',event=>{if(target&&!target.contains(event.relatedTarget))hide();});
  document.addEventListener('focusin',event=>schedule(event.target.closest?.('[data-tooltip]')));
  document.addEventListener('focusout',hide);
  document.addEventListener('pointerdown',hide,true);
  document.addEventListener('scroll',hide,true);
  document.addEventListener('keydown',hide);
  document.addEventListener('visibilitychange',hide);
  root.addEventListener?.('blur',hide);
  return {prepare,hide,schedule,delay:DELAY};
 }
 const api={create,delay:DELAY};if(root.document)Object.assign(api,create(root.document));root.GameTooltips=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
