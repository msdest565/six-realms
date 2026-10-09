(function(root){'use strict';
  const D=root.GameData||(typeof require!=='undefined'&&require('./data'));
  const H=root.Hex||(typeof require!=='undefined'&&require('./grid'));
  const G=root.Game||(typeof require!=='undefined'&&require('./game'));
  const same=(a,b)=>a&&b&&a.q===b.q&&a.r===b.r;
  const error=message=>({kind:'error',message});
  const command=value=>({kind:'command',command:value});
  const entityName=e=>D.byId[e.type]?.type||D.buildingById[e.type]?.name||'目标';

  // Validators run against observations, so a hidden garrison cannot change a
  // cursor, disabled choice, or explanation before the command is committed.
  function observation(s,viewerId){
    const known=s.knownBuildings?.[viewerId]||{};
    return {...s,
      units:s.units.filter(u=>u.hp>0&&G.visible(s,viewerId,u)),
      buildings:s.buildings.map(b=>G.visible(s,viewerId,b)?b:known[b.id]).filter(Boolean)
    };
  }

  function choose(choices,otherwise){
    if(choices.length===1)return command(choices[0].command);
    if(choices.length>1)return {kind:'choices',choices};
    return error(otherwise);
  }
  function move(s,u,c){
    const reason=G.canAct(s,u);
    if(reason)return error(reason);
    if(u.status.anchor)return error('锚定中不能移动');
    const route=G.movement(s,u).get(H.key(c.q,c.r));
    if(!route?.path.length)return error(same(u,c)?'单位已经位于此格':'此格无法在剩余移动预算与能源内到达');
    return command({kind:'move',unitId:u.id,q:c.q,r:c.r});
  }
  function attacks(s,u,targets,kind='attack'){
    const choices=[],reasons=[];
    for(const target of targets){
      const reason=kind==='skill'?G.skillReason(s,u,target):G.attackReason(s,u,target);
      if(reason){reasons.push(reason);continue;}
      const label=kind==='skill'?`${D.byId[u.type].skill} · ${D.byId[target.type]?'单位':'建筑'} ${entityName(target)}`:`攻击${D.byId[target.type]?'单位':'建筑'} · ${entityName(target)}`;
      choices.push({label,command:{kind,unitId:u.id,targetId:target.id}});
    }
    return choose(choices,reasons[0]||'当前格没有可见目标');
  }

  function resolve(s,options={}){
    if(!s||!Array.isArray(s.cells))return error('尚未进入对局');
    const viewerId=options.viewerId||s.actor;
    if(!G.player(s,viewerId))return error('观察方不存在');
    const c=G.cell(s,options.cell);
    if(!c)return error('格子不存在');
    const observed=observation(s,viewerId);
    const visibleUnit=observed.units.find(u=>same(u,c));
    // Cached buildings remain inspectable but cannot be used for blind commands.
    const visibleBuilding=s.buildings.find(b=>same(b,c)&&G.visible(s,viewerId,b));
    const intent=options.intent||null,button=options.button||'left';
    const targeting=['skill','deploy','construct'].includes(intent);
    if(button==='left'&&!targeting&&visibleUnit?.owner===s.actor&&viewerId===s.actor){
      return {kind:'select',unitId:visibleUnit.id};
    }
    if(viewerId!==s.actor)return {kind:'inspect'};
    if(s.result)return error('对局已经结束');
    if(s.story?.combatLocked||s.story?.queue?.length)return error('请先阅读并确认当前剧情');
    if(!s.turnStarted)return error('回合尚未开始');

    if(intent==='deploy'){
      const facility=observed.buildings.find(b=>b.id===options.facilityId);
      const stock=facility?.stock?.find(x=>x.id===options.stockId);
      const reason=G.deployReason(observed,facility,stock,c);
      return reason?error(reason):command({kind:'deploy',buildingId:facility.id,stockId:stock.id,q:c.q,r:c.r});
    }
    if(intent==='construct'){
      const reason=G.constructReason(observed,options.buildType,c);
      return reason?error(reason):command({kind:'construct',type:options.buildType,q:c.q,r:c.r});
    }

    const u=observed.units.find(a=>a.id===options.unitId);
    if(!u)return intent?error('请先选择己方单位'):{kind:'inspect'};
    const canAct=G.canAct(observed,u);
    if(canAct)return error(canAct);
    if(intent==='move')return move(observed,u,c);
    if(intent==='capture'){
      if(!visibleBuilding)return error('当前格没有可见建筑');
      const reason=G.captureReason(observed,u,visibleBuilding);
      return reason?error(reason):command({kind:'capture',unitId:u.id,buildingId:visibleBuilding.id});
    }
    const targets=[visibleUnit,visibleBuilding].filter(Boolean);
    if(intent==='attack')return attacks(observed,u,targets);
    if(intent==='skill'){
      const skill=D.byId[u.type].skill;
      if(['构筑掩体','锚定防线','主动扫描'].includes(skill)){
        const reason=G.skillReason(observed,u);
        return reason?error(reason):command({kind:'skill',unitId:u.id});
      }
      // Repair deliberately takes priority over left-click selection in skill
      // mode; each damaged unit/building is still independently selectable.
      return attacks(observed,u,targets,'skill');
    }
    if(intent)return error('未知操作模式');

    if(visibleUnit&&!G.allied(observed,u.owner,visibleUnit.owner))return attacks(observed,u,targets);
    if(visibleBuilding&&!G.allied(observed,u.owner,visibleBuilding.owner)){
      if(!G.captureReason(observed,u,visibleBuilding))return command({kind:'capture',unitId:u.id,buildingId:visibleBuilding.id});
    }
    return move(observed,u,c);
  }
  const api={resolve,observation};
  root.GameControls=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
