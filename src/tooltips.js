(function(root){'use strict';
 const DELAY=1500;
 function create(document,clock=root){
  let timer=null,target=null,tooltip=null,press=null,blockedClick=null,clickTimer=null;
  function hide(){if(timer!==null)clock.clearTimeout(timer);timer=null;if(target){target.removeAttribute('aria-describedby');target=null;}if(tooltip)tooltip.hidden=true;}
  function prepare(scope=document){
   for(const node of scope.querySelectorAll('[title]')){const text=node.getAttribute('title');if(text)node.setAttribute('data-tooltip',text);node.removeAttribute('title');}
   for(const title of scope.querySelectorAll('svg title')){const text=title.textContent;if(text&&title.parentElement)title.parentElement.setAttribute('data-tooltip',text);title.remove();}
  }
  function schedule(node,delay=DELAY){
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
   },delay);
  }
  document.addEventListener('pointerover',event=>{if(event.pointerType==='touch'||event.pointerType==='pen')return;schedule(event.target.closest?.('[data-tooltip]'));});
  document.addEventListener('pointerout',event=>{if(['touch','pen'].includes(event.pointerType))return;if(target&&!target.contains(event.relatedTarget))hide();});
  document.addEventListener('focusin',event=>schedule(event.target.closest?.('[data-tooltip]')));
  document.addEventListener('focusout',hide);
  document.addEventListener('pointerdown',(event={})=>{
   blockedClick=null;if(clickTimer!==null)clock.clearTimeout(clickTimer);clickTimer=null;
   hide();if(press){press=null;return;}
   if(!['touch','pen'].includes(event.pointerType)||event.target.closest?.('#board'))return;
   const node=event.target.closest?.('[data-tooltip]');if(!node)return;
   press={id:event.pointerId,x:event.clientX,y:event.clientY,node};schedule(node,650);
  },true);
  document.addEventListener('pointermove',event=>{if(press&&event.pointerId===press.id&&Math.hypot(event.clientX-press.x,event.clientY-press.y)>9){press=null;hide();}},true);
  document.addEventListener('pointerup',event=>{if(!press||event.pointerId!==press.id)return;if(tooltip&&!tooltip.hidden&&target===press.node){blockedClick=press.node;if(clickTimer!==null)clock.clearTimeout(clickTimer);clickTimer=clock.setTimeout(()=>{blockedClick=null;clickTimer=null;},800);}else hide();press=null;},true);
  document.addEventListener('pointercancel',()=>{press=null;hide();},true);
  // A held production/upgrade control is an explanation, never an order.
  document.addEventListener('click',event=>{if(blockedClick&&(blockedClick===event.target||blockedClick.contains(event.target))){event.preventDefault();event.stopImmediatePropagation();blockedClick=null;}},true);
  document.addEventListener('scroll',hide,true);
  document.addEventListener('keydown',hide);
  document.addEventListener('visibilitychange',hide);
  root.addEventListener?.('blur',hide);
  return {prepare,hide,schedule,delay:DELAY};
 }
 const api={create,delay:DELAY};if(root.document)Object.assign(api,create(root.document));root.GameTooltips=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
