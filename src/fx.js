(function (root) {
  'use strict';

  const D = root.GameData || (typeof require !== 'undefined' && require('./data'));
  const H = root.Hex || (typeof require !== 'undefined' && require('./grid'));
  const G = root.Game || (typeof require !== 'undefined' && require('./game'));
  const SVG = 'http://www.w3.org/2000/svg';
  const privateSnapshots = new WeakMap();
  const skillKinds = Object.freeze({
    '穿甲弹': 'pierce', '震荡弹': 'shock', '定点狙击': 'sniper',
    '构筑掩体': 'entrench', '锚定防线': 'anchor', '主动扫描': 'scan',
    '应急修复': 'repair', '链路干扰': 'jam'
  });
  const colors = Object.freeze({
    move: '#d2f9d3', shot: '#ffd984', counter: '#ffa678', impact: '#ffc966',
    pierce: '#d5faff', shock: '#ffd879', sniper: '#f4efcc', repair: '#76efb6',
    entrench: '#e0c79b', anchor: '#a5dbe4', scan: '#79eddd', jam: '#ca9cff'
  });
  let enabled = true, soundEnabled = true, ambienceEnabled = true, volume = .55, paused = false;
  let audioContext = null, master = null, unlocked = false, currentRun = null, serial = 0;
  const voices = new Set();
  const voiceCleanups = new Map(), ambienceBuffers = new Map();
  let ambientNodes = null, actionPan = 0;
  let scene = { active: false, profile: 'wind' };
  try {
    const stored = JSON.parse(root.localStorage?.getItem('six-realms-fx-v0.8') || '{}');
    enabled = stored.enabled !== false;
    soundEnabled = stored.soundEnabled !== false;
    ambienceEnabled = stored.ambienceEnabled !== false;
    if (Number.isFinite(stored.volume)) volume = Math.max(0, Math.min(1, stored.volume));
  } catch (_) { /* Preferences are optional in file:// and private browsing. */ }
  function persist() {
    try { root.localStorage?.setItem('six-realms-fx-v0.8', JSON.stringify({ enabled, soundEnabled, ambienceEnabled, volume })); } catch (_) {}
  }
  function settings() { return { enabled, soundEnabled, ambienceEnabled, volume, paused, unlocked, scene: { ...scene }, ambienceRunning: !!ambientNodes }; }
  function copy(p) { return p ? JSON.parse(JSON.stringify(p)) : null; }
  function position(p) { return { q: p.q, r: p.r }; }
  function motionFamily(type, domain) {
    const d = D.byId[type];
    if (!d) return 'vehicle';
    if (domain === 'sea') return 'ship';
    if (domain === 'air') return d.system === 'helicopter' || type === 'helicopter' ? 'helicopter' : 'jet';
    return d.infantry ? 'infantry' : 'vehicle';
  }
  function projectileFamily(type, domain, skill = '') {
    const d = D.byId[type];
    if (skill === 'pierce' || skill === 'sniper') return 'rail';
    if (skill === 'shock') return 'mortar';
    if (!d) return 'unknown';
    if (d.system === 'bomber') return 'bomb';
    if (d.indirect) return 'mortar';
    if (type === 'submarine') return 'torpedo';
    if (d.system === 'fighter' || d.dedicatedAA || type === 'antitank') return 'missile';
    if (d.infantry || domain === 'air' && motionFamily(type, domain) === 'helicopter') return 'rifle';
    return 'shell';
  }
  function summary(s, entity) {
    if (!entity) return null;
    const unit = !!D.byId[entity.type], owner = G.player(s, entity.owner);
    return {
      id: entity.id, type: entity.type, owner: entity.owner, q: entity.q, r: entity.r,
      hp: entity.hp, maxHp: entity.maxHp, isUnit: unit,
      domain: unit ? H.domain(entity, G.cell(s, entity)) : entity.type === 'energyplatform' ? 'sea' : 'land',
      color: owner?.color || '#cfbd87', factionStyle: owner?.factionStyle || 'union',
      ...(unit ? { counterRemaining: entity.counterRemaining, status: copy(entity.status) } : { level: entity.level, state: entity.state })
    };
  }
  function seen(s, viewerId, entity) { return !!entity && G.visible(s, viewerId, entity); }
  function seenPoint(s, viewerId, unit, p) {
    return !s.settings.fog || s.mission?.fog === false || G.allied(s, viewerId, unit.owner)
      || (s.vision[viewerId]?.[H.domain(unit, G.cell(s, p)) === 'air' ? 'air' : 'ground'] || []).includes(H.key(p.q, p.r));
  }

  // Only observations enter the returned object. The private route exists briefly to
  // truncate at the actual endpoint and never serializes hidden units or coordinates.
  function capture(s, command, viewerId = s.actor) {
    const entities = {};
    for (const e of [...s.units, ...s.buildings]) if (seen(s, viewerId, e)) entities[e.id] = summary(s, e);
    const actor = G.unit(s, command.unitId), target = G.unit(s, command.targetId) || G.building(s, command.targetId);
    let route = null;
    if (command.kind === 'move' && actor) {
      const found = G.movement(s, actor).get(H.key(command.q, command.r));
      if (found) route = [position(actor), ...found.path.map(position)];
    }
    const before = { revision: s.revision, viewerId, kind: command.kind, actor: s.actor, entities };
    privateSnapshots.set(before, {
      unit: actor ? copy(actor) : null, target: target ? copy(target) : null, route,
      cells: s.cells, fog: s.settings.fog && s.mission?.fog !== false,
      vision: copy(s.vision[viewerId]), allied: actor ? G.allied(s, viewerId, actor.owner) : false,
      unitIds: new Set(s.units.map(u => u.id)), buildingIds: new Set(s.buildings.map(b => b.id)),
      eventTail: s.events.at(-1) || null, priorEvents: new Set(s.events)
    });
    return before;
  }

  function plan(before, after, command, viewerId = before?.viewerId || after.actor) {
    const result = { revision: after.revision, kind: command.kind, steps: [], observed: false };
    if (!before || after.revision <= before.revision || before.viewerId !== viewerId) return result;
    const hidden = privateSnapshots.get(before), observed = before.entities || {};
    const rawActor = hidden?.unit, currentActor = G.unit(after, command.unitId);
    const a = observed[command.unitId] || (seen(after, viewerId, currentActor) ? summary(after, currentActor) : null);
    const rawTarget = G.unit(after, command.targetId) || G.building(after, command.targetId);
    const b = observed[command.targetId], t = seen(after, viewerId, rawTarget) ? summary(after, rawTarget) : null;
    const skill = command.kind === 'skill' ? skillKinds[D.byId[rawActor?.type || a?.type]?.skill] : '';

    if (command.kind === 'move' && hidden?.route && currentActor) {
      const end = hidden.route.findIndex(p => p.q === currentActor.q && p.r === currentActor.r);
      if (end > 0) {
        const path = hidden.route.slice(0, end + 1), segments = [];
        let part = [];
        for (const p of path) {
          const domain = H.domain(rawActor, G.cell(after, p));
          const visible = hidden.allied || !hidden.fog
            || (hidden.vision?.[domain === 'air' ? 'air' : 'ground'] || []).includes(H.key(p.q, p.r))
            || seenPoint(after, viewerId, currentActor, p);
          if (visible) part.push({ ...p, domain, family: motionFamily(rawActor.type, domain) });
          else if (part.length) { segments.push(part); part = []; }
        }
        if (part.length) segments.push(part);
        if (segments.length) {
          const first = segments[0][0], visibleActor = summary(after, { ...currentActor, ...first });
          result.steps.push({ kind: 'move', unit: visibleActor, segments, destinationVisible: seen(after, viewerId, currentActor) });
        }
      } else if (end === 0 && a && hidden.allied) result.steps.push({ kind: 'blocked', at: a });
    } else if (command.kind === 'attack' || command.kind === 'skill' && ['pierce', 'shock', 'sniper'].includes(skill)) {
      const originalA = observed[command.unitId], originalT = observed[command.targetId];
      const from = originalA || (t && a ? a : null), to = originalT || t;
      // An observer can see an impact without seeing who fired. No hidden endpoint
      // or hidden attacker's weapon class is added to the projectile.
      const projectile = from ? projectileFamily(from.type, from.domain, skill) : 'unknown';
      if (from || to) {
        const loss = originalT ? Math.max(0, originalT.hp - (rawTarget?.hp || 0)) : null;
        result.steps.push({ kind: 'shot', from, to, projectile, skill: from ? skill : '',
          damage: loss, lethal: !!originalT && loss >= originalT.hp, counter: false });
        const counterLoss = originalA ? Math.max(0, originalA.hp - (currentActor?.hp || 0)) : 0;
        if (counterLoss > 0) result.steps.push({ kind: 'shot', from: originalT || t, to: originalA,
          projectile: originalT || t ? projectileFamily((originalT || t).type, (originalT || t).domain) : 'unknown',
          skill: '', damage: counterLoss, lethal: counterLoss >= originalA.hp, counter: true });
      }
    } else if (command.kind === 'skill' && skill) {
      if (skill === 'repair') {
        if (a || b || t) result.steps.push({ kind: 'repair', from: a, to: b || t,
          amount: b && rawTarget ? Math.max(0, rawTarget.hp - b.hp) : null });
      } else if (skill === 'jam') {
        if (a || b || t) result.steps.push({ kind: 'jam', from: a, to: b || t });
      } else if (a) result.steps.push({ kind: skill, at: a, radius: D.byId[a.type].vision + (skill === 'scan' ? 2 : 0) });
    } else if (command.kind === 'capture') {
      const captured = G.building(after, command.buildingId), old = observed[command.buildingId];
      if (captured && (old || seen(after, viewerId, captured))) {
        const now = seen(after, viewerId, captured) ? summary(after, captured) : { ...old, owner: null, color: '#cfbd87' };
        result.steps.push({ kind: 'capture', from: a, at: now, oldColor: old?.color || '#cfbd87' });
      }
    } else if (command.kind === 'deploy') {
      const deployed = after.units.find(u => u.owner === before.actor && u.q === command.q && u.r === command.r && !hidden?.unitIds.has(u.id));
      if (seen(after, viewerId, deployed)) result.steps.push({ kind: 'deploy', at: summary(after, deployed) });
    } else if (command.kind === 'construct') {
      const built = after.buildings.find(x => x.q === command.q && x.r === command.r && !hidden?.buildingIds.has(x.id));
      if (seen(after, viewerId, built)) result.steps.push({ kind: 'construct', at: summary(after, built) });
    } else if (['produce', 'upgrade', 'cancel'].includes(command.kind)) {
      const facility = G.building(after, command.buildingId);
      if (seen(after, viewerId, facility) && G.allied(after, viewerId, facility.owner))
        result.steps.push({ kind: command.kind, at: summary(after, facility) });
    } else if (command.kind === 'end' && (G.allied(after, viewerId, before.actor) || after.actor === viewerId)) {
      result.steps.push({ kind: 'turn' });
    }
    // A single transaction may now move -> capture -> release a facility and
    // deploy its FIFO stock, or begin a turn and deploy multiple completed units.
    // Preserve the core's event order rather than losing those secondary actions.
    const events = transactionEvents(after, hidden), captureEvents = new Set(['capture', 'first_capture_enemy_production_facility', 'first_capture_central_city']);
    const eventCapture = events.some(e => captureEvents.has(e.kind) && e.buildingId);
    const eventDeploy = events.some(e => e.kind === 'deployment' && e.unitId);
    if (eventCapture) result.steps = result.steps.filter(step => step.kind !== 'capture');
    if (eventDeploy) result.steps = result.steps.filter(step => step.kind !== 'deploy');
    if (command.kind === 'end' && events.some(e => e.kind === 'turn')) result.steps = result.steps.filter(step => step.kind !== 'turn');
    const displayedCaptures = new Set(), displayedUnits = new Set();
    for (const event of events) {
      if (captureEvents.has(event.kind) && event.buildingId && !displayedCaptures.has(event.buildingId)) {
        const building = G.building(after, event.buildingId), old = observed[event.buildingId];
        if (building && (old || seen(after, viewerId, building))) {
          const now = seen(after, viewerId, building) ? summary(after, building) : { ...old, owner: null, color: '#cfbd87' };
          const source = G.unit(after, event.unitId || command.unitId);
          result.steps.push({ kind: 'capture', from: seen(after, viewerId, source) ? summary(after, source) : a,
            at: now, oldColor: old?.color || '#cfbd87', auto: !!(event.automatic || event.auto), eventOrder: events.indexOf(event) });
          displayedCaptures.add(event.buildingId);
        }
      } else if (event.kind === 'deployment' && event.unitId && !displayedUnits.has(event.unitId)) {
        const unit = G.unit(after, event.unitId);
        if (!hidden?.unitIds.has(event.unitId) && seen(after, viewerId, unit)) {
          result.steps.push({ kind: 'deploy', at: summary(after, unit), auto: !!(event.automatic || event.auto), eventOrder: events.indexOf(event) });
          displayedUnits.add(event.unitId);
        }
      } else if (command.kind === 'end' && event.kind === 'turn' && (G.allied(after, viewerId, event.actor) || event.actor === viewerId)) {
        result.steps.push({ kind: 'turn', eventOrder: events.indexOf(event) });
      }
    }
    // Older game-0.7 snapshots have no enriched deployment event metadata. Their
    // newly visible units still get a safe fallback in deterministic instance order.
    for (const unit of after.units) if (!hidden?.unitIds.has(unit.id) && seen(after, viewerId, unit)
      && !result.steps.some(step => step.kind === 'deploy' && step.at.id === unit.id)) {
      result.steps.push({ kind: 'deploy', at: summary(after, unit), auto: command.kind !== 'deploy' });
    }
    result.observed = result.steps.length > 0;
    return result;
  }

  function transactionEvents(after, hidden) {
    if (!hidden) return [];
    const index = hidden.eventTail ? after.events.indexOf(hidden.eventTail) : -1;
    return index >= 0 ? after.events.slice(index + 1) : after.events.filter(event => !hidden.priorEvents.has(event));
  }

  function setEnabled(value) { enabled = !!value; persist(); }
  function setSoundEnabled(value) { soundEnabled = !!value; applyVolume(); updateAmbience(); persist(); }
  function setAmbienceEnabled(value) { ambienceEnabled = !!value; updateAmbience(); persist(); }
  function setVolume(value) { if (Number.isFinite(Number(value))) volume = Math.max(0, Math.min(1, Number(value))); applyVolume(); updateAmbience(); persist(); }
  function applyVolume() { if (master && audioContext) master.gain.setValueAtTime(soundEnabled ? volume * .32 : 0, audioContext.currentTime); }
  function ambienceProfile(terrain) {
    const allowed = new Set([...Object.keys(D.terrain), ...Object.keys(D.buildingById)]), counts = {};
    if (typeof terrain === 'string' && allowed.has(terrain)) counts[terrain] = 1;
    else if (Array.isArray(terrain)) for (const value of terrain) {
      const type = typeof value === 'string' ? value : value?.terrain;
      if (allowed.has(type)) counts[type] = (counts[type] || 0) + 1;
    }
    else if (terrain && typeof terrain === 'object') for (const [type, amount] of Object.entries(terrain))
      if (allowed.has(type) && Number.isFinite(amount) && amount > 0) counts[type] = Math.min(1e6, amount);
    const total = Object.values(counts).reduce((n, amount) => n + amount, 0) || 1;
    const sea = (counts.ocean || 0) + (counts.coast || 0) * .6 + (counts.port || 0) + (counts.energyplatform || 0);
    const industrial = ['road', 'city', 'factory', 'energyfield', 'barracks', 'airfield', 'market', 'hq'].reduce((n, type) => n + (counts[type] || 0), 0);
    return sea / total >= .2 ? 'sea' : industrial / total >= .35 ? 'industrial' : 'wind';
  }
  function setScene(next = {}) {
    scene = { active: next.active === undefined ? scene.active : !!next.active,
      profile: next.terrain === undefined ? scene.profile : ambienceProfile(next.terrain) };
    updateAmbience(); return { ...scene };
  }
  function stopAmbience() {
    const old = ambientNodes; ambientNodes = null;
    if (!old) return;
    for (const gain of old.gains) try { gain.gain.setValueAtTime(0, audioContext.currentTime); } catch (_) {}
    for (const source of old.sources) try { source.stop(); } catch (_) {}
    for (const item of old.nodes) try { item.disconnect(); } catch (_) {}
  }
  function ambientBuffer(profile) {
    if (ambienceBuffers.has(profile)) return ambienceBuffers.get(profile);
    const frames = Math.ceil(audioContext.sampleRate * 8), buffer = audioContext.createBuffer(2, frames, audioContext.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const values = buffer.getChannelData(channel); let brown = 0;
      for (let i = 0; i < frames; i++) {
        brown = (brown + .025 * (Math.random() * 2 - 1)) / 1.025;
        const time = i / audioContext.sampleRate;
        const wave = profile === 'sea' ? .66 + .21 * Math.sin(time * Math.PI * .5 + channel * 1.2)
          + .1 * Math.sin(time * Math.PI * .75 + channel) : .85 + .1 * Math.sin(time * Math.PI * .25 + channel);
        // Crossfade the loop ends to avoid a discontinuity every eight seconds.
        const edge = Math.min(1, i / (frames * .02), (frames - 1 - i) / (frames * .02));
        values[i] = brown * 4 * wave * Math.max(0, edge);
      }
    }
    ambienceBuffers.set(profile, buffer); return buffer;
  }
  function updateAmbience() {
    const canPlay = scene.active && ambienceEnabled && soundEnabled && volume > 0 && !paused
      && unlocked && audioContext?.state === 'running';
    if (!canPlay) { stopAmbience(); return; }
    if (ambientNodes?.profile === scene.profile) return;
    stopAmbience();
    const created = [];
    try {
      const source = audioContext.createBufferSource(), filter = audioContext.createBiquadFilter(), bed = audioContext.createGain();
      const hum = audioContext.createOscillator(), humGain = audioContext.createGain();
      const sway = audioContext.createOscillator(), swayGain = audioContext.createGain();
      created.push(source, filter, bed, hum, humGain, sway, swayGain);
      source.buffer = ambientBuffer(scene.profile); source.loop = true;
      filter.type = 'lowpass'; filter.frequency.value = scene.profile === 'sea' ? 780 : scene.profile === 'industrial' ? 350 : 620;
      bed.gain.setValueAtTime(0, audioContext.currentTime);
      bed.gain.linearRampToValueAtTime(scene.profile === 'sea' ? .11 : .075, audioContext.currentTime + .65);
      hum.type = scene.profile === 'industrial' ? 'triangle' : 'sine'; hum.frequency.value = scene.profile === 'industrial' ? 74 : 56;
      humGain.gain.setValueAtTime(0, audioContext.currentTime);
      humGain.gain.linearRampToValueAtTime(scene.profile === 'industrial' ? .017 : .006, audioContext.currentTime + .8);
      sway.type = 'sine'; sway.frequency.value = scene.profile === 'sea' ? .12 : .07; swayGain.gain.value = .018;
      source.connect(filter); filter.connect(bed); bed.connect(master);
      hum.connect(humGain); humGain.connect(master); sway.connect(swayGain); swayGain.connect(bed.gain);
      source.start(); hum.start(); sway.start();
      ambientNodes = { profile: scene.profile, nodes: created, sources: [source, hum, sway], gains: [bed, humGain] };
    } catch (_) {
      for (const item of created) { try { item.stop?.(); } catch (_) {} try { item.disconnect(); } catch (_) {} }
      ambientNodes = null;
    }
  }
  async function unlock() {
    if (!soundEnabled) return false;
    try {
      const Context = root.AudioContext || root.webkitAudioContext;
      if (!Context) return false;
      if (!audioContext) {
        audioContext = new Context();
        master = audioContext.createGain();
        const limiter = audioContext.createDynamicsCompressor();
        limiter.threshold.value = -18; limiter.knee.value = 12; limiter.ratio.value = 7;
        master.connect(limiter); limiter.connect(audioContext.destination); applyVolume();
      }
      // The first successful gesture authorizes future resume. Calling unlock
      // while paused must never erase that authorization (Space resumes too).
      if (paused && unlocked) return true;
      if (audioContext.state !== 'running') await audioContext.resume();
      unlocked = true;
      if (paused) await audioContext.suspend();
      updateAmbience();
      return unlocked;
    } catch (_) { return false; }
  }
  function setPaused(value) {
    paused = !!value;
    if (currentRun) currentRun.last = null;
    if (paused) stopAmbience();
    if (audioContext) {
      const promise = paused ? audioContext.suspend() : unlocked ? audioContext.resume() : null;
      promise?.then(() => updateAmbience()).catch(() => {});
    }
  }
  function voice(node, connected = []) {
    voices.add(node);
    const cleanup = () => { voices.delete(node); voiceCleanups.delete(node); for (const n of [node, ...connected]) try { n.disconnect(); } catch (_) {} };
    voiceCleanups.set(node, cleanup); node.onended = cleanup; return node;
  }
  function output(gain) {
    if (!audioContext.createStereoPanner) { gain.connect(master); return null; }
    const panner = audioContext.createStereoPanner(); panner.pan.value = actionPan;
    gain.connect(panner); panner.connect(master); return panner;
  }
  function tone(freq, seconds, waveform = 'sine', gain = .2, delay = 0, endFreq = freq) {
    if (!audioContext || audioContext.state !== 'running' || !unlocked || !soundEnabled || volume === 0 || paused) return;
    const start = audioContext.currentTime + delay, env = audioContext.createGain(), panner = output(env), osc = voice(audioContext.createOscillator(), [env, ...(panner ? [panner] : [])]);
    osc.type = waveform; osc.frequency.setValueAtTime(freq, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(12, endFreq), start + seconds);
    env.gain.setValueAtTime(0, start); env.gain.linearRampToValueAtTime(gain, start + .009);
    env.gain.exponentialRampToValueAtTime(.0001, start + seconds);
    osc.connect(env); osc.start(start); osc.stop(start + seconds + .02);
  }
  function noise(seconds, gain = .2, cutoff = 900, delay = 0, highpass = false) {
    if (!audioContext || audioContext.state !== 'running' || !unlocked || !soundEnabled || volume === 0 || paused) return;
    const start = audioContext.currentTime + delay, env = audioContext.createGain(), filter = audioContext.createBiquadFilter(), panner = output(env), source = voice(audioContext.createBufferSource(), [env, filter, ...(panner ? [panner] : [])]);
    const buffer = audioContext.createBuffer(1, Math.ceil(audioContext.sampleRate * seconds), audioContext.sampleRate), data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    source.buffer = buffer; filter.type = highpass ? 'highpass' : 'lowpass'; filter.frequency.value = cutoff;
    env.gain.setValueAtTime(gain, start); env.gain.exponentialRampToValueAtTime(.0001, start + seconds);
    source.connect(filter); filter.connect(env); source.start(start); source.stop(start + seconds + .02);
  }
  const soundDesign = Object.freeze({
    infantry: '轻短脚步与装备碰撞', vehicle: '低频履带马达与机械卡扣', ship: '流水与舰体低鸣',
    helicopter: '旋翼四拍与涡轮', jet: '推进气流与高频滑音',
    rifle: '三发短促枪声', shell: '低频炮口冲击', missile: '点火与升频尾焰', mortar: '抛射哨音',
    rail: '磁轨蓄能与穿透', bomb: '投弹滑音', torpedo: '水下低频发射', unknown: '已观测命中声',
    impact: '冲击与碎屑', destruction: '爆破低鸣', capture: '三音据点确认',
    repair: '工具棘轮与恢复双音', scan: '雷达高低脉冲', jam: '失谐电子颤音',
    entrench: '砂石与工程扣合', anchor: '液压锁定', shock: '震荡冲击', sniper: '单次磁轨脉冲',
    deploy: '部署确认双音', construct: '吊装与机械扣合', produce: '订单确认', upgrade: '升级确认', cancel: '取消低音', turn: '回合交接',
    wind: '低强度双声道风声', sea: '渐起渐落海浪与海风', industrial: '轻机械低鸣与风声'
  });
  function sound(name, pan = 0) {
    const previousPan = actionPan; actionPan = Math.max(-.65, Math.min(.65, Number(pan) || 0));
    try { switch (name) {
      case 'infantry': noise(.06, .11, 1100); tone(170, .06, 'triangle', .06); noise(.055, .09, 950, .11); break;
      case 'vehicle': tone(68, .23, 'triangle', .14, 0, 54); noise(.12, .08, 600); tone(170, .04, 'square', .025, .13); break;
      case 'ship': noise(.28, .12, 460); tone(85, .27, 'sine', .08, 0, 70); break;
      case 'helicopter': for (let i = 0; i < 4; i++) noise(.045, .065, 580, i * .055); tone(115, .24, 'triangle', .06); break;
      case 'jet': noise(.28, .09, 1400); tone(210, .26, 'sawtooth', .045, 0, 390); break;
      case 'rifle': for (let i = 0; i < 3; i++) { noise(.07, .19, 2700, i * .05); tone(210, .04, 'square', .04, i * .05, 70); } break;
      case 'shell': noise(.04, .16, 2400, 0, true); noise(.16, .3, 1050, .018); tone(92, .21, 'triangle', .26, .012, 28); tone(165, .06, 'square', .025, .055, 105); break;
      case 'missile': noise(.23, .2, 1600); tone(230, .24, 'sawtooth', .06, 0, 850); break;
      case 'mortar': tone(740, .28, 'sine', .1, 0, 160); noise(.1, .16, 900); break;
      case 'rail': case 'sniper': tone(720, .13, 'sawtooth', .12, 0, 110); noise(.05, .2, 3200); break;
      case 'bomb': tone(650, .3, 'sine', .08, 0, 100); noise(.08, .06, 1200); break;
      case 'torpedo': tone(80, .25, 'sine', .13, 0, 40); noise(.22, .1, 300); break;
      case 'impact': case 'unknown': noise(.045, .15, 2600, 0, true); noise(.17, .18, 1300, .015); tone(75, .18, 'triangle', .15, .01, 25); break;
      case 'destruction': noise(.4, .35, 750); tone(60, .4, 'triangle', .3, 0, 20); break;
      case 'capture': [330, 440, 660].forEach((f, i) => tone(f, .19, 'triangle', .13, i * .09)); break;
      case 'repair': tone(540, .14, 'sine', .1); tone(810, .18, 'sine', .1, .1); noise(.06, .08, 1700, .05); break;
      case 'scan': tone(950, .1, 'sine', .1); tone(480, .16, 'sine', .075, .12); break;
      case 'jam': [180, 560, 230, 790].forEach((f, i) => tone(f, .08, 'square', .035, i * .055, f * .8)); break;
      case 'entrench': noise(.25, .18, 480); tone(110, .13, 'triangle', .1, .1); break;
      case 'anchor': tone(170, .25, 'sawtooth', .07, 0, 55); noise(.12, .13, 700, .14); break;
      case 'shock': tone(70, .35, 'triangle', .2, 0, 25); noise(.22, .22, 700); break;
      case 'deploy': case 'upgrade': tone(390, .1, 'triangle', .09); tone(590, .13, 'triangle', .08, .1); break;
      case 'construct': noise(.2, .12, 600); tone(125, .1, 'triangle', .1, .1); break;
      case 'produce': tone(440, .13, 'sine', .08); break;
      case 'cancel': tone(260, .12, 'sine', .06, 0, 160); break;
      case 'turn': tone(280, .12, 'sine', .06); tone(350, .12, 'sine', .05, .12); break;
    }} finally { actionPan = previousPan; }
  }
  function soundAt(run, name, point) {
    const raw = run.board.viewBox?.baseVal || (() => {
      const values = run.board.getAttribute('viewBox')?.split(/[\s,]+/).map(Number);
      return values?.length === 4 ? { x: values[0], width: values[2] } : null;
    })();
    const pan = point && raw?.width > 0 ? (point.x - raw.x) / raw.width * 2 - 1 : 0;
    sound(name, pan);
  }

  function node(tag, attrs = {}, parent) {
    const el = root.document.createElementNS(SVG, tag);
    for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, String(value));
    if (parent) parent.appendChild(el);
    return el;
  }
  const linear = t => t, ease = t => 1 - Math.pow(1 - t, 3), mix = (a, b, t) => a + (b - a) * t;
  function duration(base, run) { return Math.max(run.reduced ? 40 : 65, base * run.speed); }
  function animate(run, ms, update, easing = linear) {
    if (run.cancelled) return Promise.resolve(false);
    return new Promise(resolve => {
      let elapsed = 0, previous = null, done = false, frameId = null;
      const finish = value => {
        if (done) return;
        done = true; run.waiters.delete(stop);
        if (frameId !== null) root.cancelAnimationFrame?.(frameId);
        resolve(value);
      };
      const stop = () => finish(false);
      run.waiters.add(stop);
      function frame(now) {
        if (done) return;
        if (!run.board.isConnected) run.cancelled = true;
        if (run.cancelled) { finish(false); return; }
        if (paused) { previous = null; frameId = root.requestAnimationFrame(frame); return; }
        if (previous !== null) elapsed += Math.min(70, now - previous);
        previous = now;
        const t = Math.min(1, elapsed / duration(ms, run));
        update(easing(t), t);
        if (t >= 1) finish(true); else frameId = root.requestAnimationFrame(frame);
      }
      update(0, 0);
      frameId = root.requestAnimationFrame(frame);
    });
  }
  function ring(run, p, color, radius = 55, attrs = {}) {
    return node('circle', { cx: p.x, cy: p.y, r: 6, fill: 'none', stroke: color, 'stroke-width': 3, ...attrs }, run.layer);
  }
  function hideSprite(run, id) {
    if (!id) return;
    for (const el of run.board.querySelectorAll('[data-unit-sprite],[data-building-sprite],[data-unit-label],[data-building-label]')) if ((el.getAttribute('data-unit-sprite') || el.getAttribute('data-building-sprite') || el.getAttribute('data-unit-label') || el.getAttribute('data-building-label')) === id && !run.hidden.some(x => x.el === el)) {
      run.hidden.push({ el, opacity: el.style.opacity }); el.style.opacity = '0';
    }
  }
  function restoreSprite(run, id) {
    const retained = [];
    for (const item of run.hidden) {
      const instanceId = item.el.getAttribute('data-unit-sprite') || item.el.getAttribute('data-building-sprite') || item.el.getAttribute('data-unit-label') || item.el.getAttribute('data-building-label');
      if (instanceId === id) item.el.style.opacity = item.opacity; else retained.push(item);
    }
    run.hidden = retained;
  }
  function sprite(run, entity, where) {
    if (!entity) return null;
    const wrapper = node('g', { class: 'fx-unit', 'data-fx-unit': entity.id, transform: `translate(${where.x} ${where.y})` }, run.layer);
    const shadow = node('ellipse', { cx: 0, cy: 23, rx: entity.isUnit ? 21 : 31, ry: 6, fill: '#09211c', opacity: .35 }, wrapper);
    let offset = entity.isUnit ? run.offset : run.buildingOffset, scale = entity.isUnit ? run.scale : run.buildingScale;
    const real = [...run.board.querySelectorAll('[data-unit-sprite],[data-building-sprite]')].find(el => (el.getAttribute('data-unit-sprite') || el.getAttribute('data-building-sprite')) === entity.id);
    const rawOffset = real?.getAttribute('data-sprite-offset')?.split(',').map(Number), rawScale = Number(real?.getAttribute('data-sprite-scale'));
    if (rawOffset?.length === 2 && rawOffset.every(Number.isFinite)) offset = { x: rawOffset[0], y: rawOffset[1] };
    if (rawScale > 0 && Number.isFinite(rawScale)) scale = rawScale;
    if (!entity.isUnit && root.GameArt?.buildingTileMarkup) {
      const floor = node('g', {}, wrapper);
      floor.innerHTML = root.GameArt.buildingTileMarkup(entity.type, entity.factionStyle, entity.level);
    }
    const glyph = node('g', { transform: `translate(${offset.x} ${offset.y}) scale(${scale})` }, wrapper);
    if (entity.isUnit && root.GameArt?.unitMarkup) glyph.innerHTML = root.GameArt.unitMarkup(entity.type, entity.factionStyle, entity.domain);
    else if (!entity.isUnit && root.GameArt?.buildingMarkup) glyph.innerHTML = root.GameArt.buildingMarkup(entity.type, entity.factionStyle, entity.level);
    else node('path', { d: 'M0-20L17 15H-17Z', fill: entity.color, stroke: '#edf5df', 'stroke-width': 2 }, glyph);
    hideSprite(run, entity.id);
    return { wrapper, glyph, shadow };
  }
  async function floating(run, p, text, color, ms = 350) {
    const el = node('text', { x: p.x, y: p.y - 29, fill: color, class: 'fx-label', 'text-anchor': 'middle' }, run.layer);
    el.textContent = text;
    await animate(run, ms, t => { el.setAttribute('y', p.y - 29 - t * 19); el.setAttribute('opacity', 1 - Math.max(0, (t - .5) * 2)); });
    el.remove();
  }
  function particles(run, p, color, count = 9, seed = 0) {
    return Array.from({ length: count }, (_, i) => {
      const angle = (i + seed) * 2.399963, length = 14 + i % 4 * 9;
      const el = node('circle', { cx: p.x, cy: p.y, r: i % 3 ? 2 : 3, fill: color }, run.layer);
      return { el, dx: Math.cos(angle) * length, dy: Math.sin(angle) * length };
    });
  }
  async function pulse(run, p, color, ms = 340, radius = 55, label = '') {
    const waves = [ring(run, p, color), ring(run, p, color, radius, { 'stroke-width': 1.4 })];
    if (label) floating(run, p, label, color, ms);
    await animate(run, ms, t => waves.forEach((r, i) => {
      r.setAttribute('r', 8 + Math.max(0, t - i * .12) * radius);
      r.setAttribute('opacity', (1 - t) * .8);
    }));
    waves.forEach(r => r.remove());
  }
  async function moveEffect(run, step) {
    const glyph = sprite(run, step.unit, run.xy(step.segments[0][0]));
    if (!glyph) return;
    const marks = node('g', { class: 'fx-trail' }, run.layer);
    for (let segmentIndex = 0; segmentIndex < step.segments.length; segmentIndex++) {
      const path = step.segments[segmentIndex];
      if (segmentIndex) { glyph.wrapper.setAttribute('opacity', '0'); await animate(run, 70, () => {}); }
      const start = run.xy(path[0]); glyph.wrapper.setAttribute('transform', `translate(${start.x} ${start.y})`); glyph.wrapper.setAttribute('opacity', '1');
      for (let i = 1; i < path.length; i++) {
        const a = run.xy(path[i - 1]), b = run.xy(path[i]), family = path[i].family;
        soundAt(run, family, a);
        const trail = family === 'ship' ? node('path', { d: 'M-11 0L0 10L11 0M-16 8L0 20L16 8', fill: 'none', stroke: '#d3fbef', 'stroke-width': 2, opacity: .6 }, marks)
          : family === 'infantry' ? node('g', { opacity: .45 }, marks) : node('path', { d: family === 'vehicle' ? 'M-7 0L-7 16M7 0L7 16' : 'M-13 0L0 16L13 0', fill: 'none', stroke: family === 'vehicle' ? '#cbb686' : '#d9fff4', 'stroke-width': family === 'vehicle' ? 3 : 1.5, opacity: .35 }, marks);
        if (family === 'infantry') { node('ellipse', { cx: -4, cy: 4, rx: 2.1, ry: 4, fill: '#e2d8bd' }, trail); node('ellipse', { cx: 4, cy: 12, rx: 2.1, ry: 4, fill: '#e2d8bd' }, trail); }
        const angle = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI - 90;
        trail.setAttribute('transform', `translate(${a.x} ${a.y}) rotate(${angle})`);
        const dust = family === 'vehicle' || family === 'infantry' ? particles(run, { x: a.x, y: a.y + 18 }, '#c7b38b', run.reduced ? 0 : 3, i) : [];
        let domainChanged = false;
        await animate(run, family === 'infantry' ? 175 : family === 'jet' ? 135 : 205, (t, raw) => {
          const x = mix(a.x, b.x, t), y = mix(a.y, b.y, t), bob = run.reduced ? 0 : Math.sin(raw * Math.PI * (family === 'infantry' ? 4 : 2)) * (family === 'infantry' ? 2 : 1);
          glyph.wrapper.setAttribute('transform', `translate(${x} ${y + bob})`);
          glyph.shadow.setAttribute('opacity', family === 'jet' || family === 'helicopter' ? '.2' : '.35');
          dust.forEach((d, index) => { d.el.setAttribute('cx', a.x + d.dx * raw * .4); d.el.setAttribute('cy', a.y + 18 + d.dy * raw * .15 - raw * 6); d.el.setAttribute('r', 1.5 + raw * (index + 1)); d.el.setAttribute('opacity', (1 - raw) * .22); });
          if (!domainChanged && raw > .5 && path[i].domain !== path[i - 1].domain && root.GameArt?.unitMarkup) {
            glyph.glyph.innerHTML = root.GameArt.unitMarkup(step.unit.type, step.unit.factionStyle, path[i].domain); domainChanged = true;
          }
          if (family === 'helicopter' && !run.reduced) {
            // A translucent rotor disc preserves the unit's actual silhouette.
            glyph.glyph.setAttribute('opacity', .92 + Math.sin(raw * Math.PI * 12) * .08);
          }
        }, ease);
        dust.forEach(d => d.el.remove());
        if (run.cancelled) break;
      }
      if (run.cancelled) break;
      if (path.length === 1) await pulse(run, run.xy(path[0]), colors.move, 130, 24);
    }
    if (!run.cancelled) await animate(run, 90, t => marks.setAttribute('opacity', 1 - t));
    marks.remove(); glyph.wrapper.remove(); restoreSprite(run, step.unit.id);
  }
  function projectilePoint(a, b, t, family) {
    const arc = ['mortar', 'bomb', 'missile'].includes(family) ? Math.sin(Math.PI * t) * Math.min(75, Math.hypot(b.x - a.x, b.y - a.y) * .25) : 0;
    return { x: mix(a.x, b.x, t), y: mix(a.y, b.y, t) - arc };
  }
  async function impact(run, step, p, targetGlyph) {
    soundAt(run, step.lethal ? 'destruction' : step.skill === 'shock' ? 'shock' : 'impact', p);
    const color = colors[step.skill] || colors.impact, flash = node('circle', { cx: p.x, cy: p.y, r: 3, fill: '#fff1ba', opacity: .9 }, run.layer);
    const smoke = node('circle', { cx: p.x, cy: p.y, r: 9, fill: '#3d5149', opacity: .5 }, run.layer);
    const sparks = particles(run, p, color, step.lethal ? 16 : 8);
    const wave = step.skill === 'shock' ? ring(run, p, color) : null;
    if (step.damage !== null && step.damage > 0) floating(run, p, `${step.counter ? '反击 ' : ''}−${step.damage}`, step.counter ? colors.counter : '#ffe8bf', step.lethal ? 450 : 360);
    if (step.lethal) floating(run, { x: p.x, y: p.y + 22 }, step.to?.isUnit ? '击毁' : '建筑毁坏', '#ffd7ac', 450);
    await animate(run, step.lethal ? 460 : 310, (t, raw) => {
      flash.setAttribute('r', 4 + t * (step.lethal ? 35 : 18)); flash.setAttribute('opacity', Math.max(0, 1 - t * 2));
      smoke.setAttribute('r', 10 + t * (step.lethal ? 31 : 17)); smoke.setAttribute('opacity', (1 - t) * .5);
      sparks.forEach(s => { s.el.setAttribute('cx', p.x + s.dx * t); s.el.setAttribute('cy', p.y + s.dy * t + t * t * 8); s.el.setAttribute('opacity', 1 - t); });
      if (wave) { wave.setAttribute('r', 8 + t * 74); wave.setAttribute('opacity', 1 - t); }
      if (targetGlyph) {
        targetGlyph.wrapper.setAttribute('transform', `translate(${p.x + (run.reduced ? 0 : Math.sin(raw * Math.PI * 8) * (1 - raw) * 3)} ${p.y})`);
        if (step.lethal) targetGlyph.wrapper.setAttribute('opacity', Math.max(0, 1 - t * 1.5));
      }
    });
    [flash, smoke, wave, ...sparks.map(s => s.el)].filter(Boolean).forEach(e => e.remove());
  }
  async function shotEffect(run, step) {
    const from = step.from ? run.xy(step.from) : null, to = step.to ? run.xy(step.to) : null;
    const attacker = step.from ? sprite(run, step.from, from) : null;
    const target = step.to ? sprite(run, step.to, to) : null;
    const color = colors[step.skill] || (step.counter ? colors.counter : colors.shot);
    if (from) {
      soundAt(run, step.projectile, from);
      const muzzle = node('path', { d: 'M0-14L4-5L13-8L6 1L12 8L3 6L0 15L-4 5L-12 8L-6 0L-12-8L-4-5Z', fill: color }, run.layer);
      muzzle.setAttribute('transform', `translate(${from.x} ${from.y - 12})`);
      if (step.skill === 'sniper') {
        const reticle = node('g', { stroke: color, 'stroke-width': 1.8, opacity: .8 }, run.layer);
        if (to) { node('circle', { cx: to.x, cy: to.y, r: 22, fill: 'none' }, reticle); node('path', { d: `M${to.x - 31} ${to.y}h18m26 0h18M${to.x} ${to.y - 31}v18m0 26v18`, fill: 'none' }, reticle); }
        await animate(run, 180, t => reticle.setAttribute('opacity', 1 - t * .6)); reticle.remove();
      }
      const dx = to ? to.x - from.x : 0, dy = to ? to.y - from.y : -1, len = Math.hypot(dx, dy) || 1;
      await animate(run, 85, (t, raw) => {
        muzzle.setAttribute('opacity', 1 - t);
        if (attacker && !run.reduced) attacker.wrapper.setAttribute('transform', `translate(${from.x - dx / len * Math.sin(raw * Math.PI) * 4} ${from.y - dy / len * Math.sin(raw * Math.PI) * 4})`);
      }); muzzle.remove();
    }
    if (from && to) {
      const beam = ['rail', 'rifle'].includes(step.projectile);
      const missile = step.projectile === 'missile', shell = node(beam ? 'path' : 'ellipse', beam ? { fill: 'none', stroke: color, 'stroke-width': step.projectile === 'rail' ? 3 : 1.5 }
        : { cx: from.x, cy: from.y, rx: missile ? 6 : step.projectile === 'bomb' ? 4 : 3, ry: 2.5, fill: color, stroke: '#fff5c9', 'stroke-width': .8 }, run.layer);
      const trail = node('path', { fill: 'none', stroke: color, 'stroke-width': 1.5, opacity: .4 }, run.layer);
      await animate(run, step.projectile === 'mortar' || step.projectile === 'bomb' ? 330 : beam ? 160 : 235, t => {
        const p = projectilePoint(from, to, t, step.projectile), prev = projectilePoint(from, to, Math.max(0, t - .16), step.projectile);
        if (beam) shell.setAttribute('d', `M${prev.x} ${prev.y}L${p.x} ${p.y}`);
        else { shell.setAttribute('cx', p.x); shell.setAttribute('cy', p.y); shell.setAttribute('transform', `rotate(${Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI} ${p.x} ${p.y})`); }
        trail.setAttribute('d', `M${prev.x} ${prev.y}L${p.x} ${p.y}`);
      }); shell.remove(); trail.remove();
    }
    if (to) await impact(run, step, to, target);
    if (step.skill === 'pierce' && to) await pulse(run, to, colors.pierce, 160, 34, '穿甲');
    if (step.skill === 'shock' && to && !step.lethal) await pulse(run, to, colors.shock, 160, 33, '震荡');
    attacker?.wrapper.remove(); target?.wrapper.remove();
  }
  async function supportEffect(run, step) {
    const p = step.at ? run.xy(step.at) : step.to ? run.xy(step.to) : step.from ? run.xy(step.from) : null;
    const from = step.from && run.xy(step.from), to = step.to && run.xy(step.to);
    if (!p) return;
    const color = colors[step.kind] || step.at?.color || '#d4edba';
    soundAt(run, step.kind, p);
    if (step.kind === 'deploy') {
      const glyph = sprite(run, step.at, p), wave = ring(run, p, color, 42, { 'stroke-width': 2 });
      const ms = step.auto ? 150 : 270;
      if (!step.auto) floating(run, p, '部署', color, ms);
      await animate(run, ms, (t, raw) => {
        wave.setAttribute('r', 9 + t * 38); wave.setAttribute('opacity', (1 - t) * .65);
        if (glyph) { glyph.wrapper.setAttribute('opacity', Math.min(1, raw * 3)); glyph.wrapper.setAttribute('transform', `translate(${p.x} ${p.y}) scale(${.85 + ease(raw) * .15})`); }
      }); glyph?.wrapper.remove(); wave.remove(); restoreSprite(run, step.at.id);
    } else
    if (step.kind === 'repair') {
      const line = from && to ? node('path', { d: `M${from.x} ${from.y}L${to.x} ${to.y}`, stroke: color, 'stroke-width': 2.5, 'stroke-dasharray': '5 7', fill: 'none' }, run.layer) : null;
      const cross = node('path', { d: 'M-5-15H5V-5H15V5H5V15H-5V5H-15V-5H-5Z', fill: color, stroke: '#e3ffe9', 'stroke-width': 1 }, run.layer);
      cross.setAttribute('transform', `translate(${p.x} ${p.y})`);
      if (step.amount !== null) floating(run, p, `+${step.amount} 修复`, color, 450);
      await animate(run, 450, t => { cross.setAttribute('transform', `translate(${p.x} ${p.y - t * 15}) scale(${.8 + t * .3})`); cross.setAttribute('opacity', 1 - t); if (line) line.setAttribute('stroke-dashoffset', -t * 36); });
      cross.remove(); line?.remove();
    } else if (step.kind === 'jam') {
      const link = from && to ? node('path', { stroke: color, fill: 'none', 'stroke-width': 2, opacity: .85 }, run.layer) : null;
      const brackets = node('path', { d: `M${p.x - 21} ${p.y - 14}h-8v28h8m42-28h8v28h-8`, stroke: color, 'stroke-width': 3, fill: 'none' }, run.layer);
      floating(run, p, '链路干扰', color, 470);
      await animate(run, 470, (t, raw) => {
        if (link) { const pts = Array.from({ length: 9 }, (_, i) => { const f = i / 8; return `${mix(from.x, to.x, f)},${mix(from.y, to.y, f) + Math.sin(i * 2 + raw * 32) * Math.sin(Math.PI * f) * 8}`; }); link.setAttribute('d', 'M' + pts.join('L')); }
        brackets.setAttribute('opacity', (1 - t) * (.65 + Math.sin(raw * 28) * .3));
      }); link?.remove(); brackets.remove();
    } else if (step.kind === 'scan') {
      const sweep = node('path', { fill: color, opacity: .1 }, run.layer), rings = [ring(run, p, color), ring(run, p, color, 1, { 'stroke-width': 1 })];
      const scanRadius = Math.min(210, step.radius * 34);
      floating(run, p, '主动扫描', color, 430);
      await animate(run, 650, (t, raw) => {
        rings.forEach((r, i) => { r.setAttribute('r', 10 + Math.max(0, t - i * .13) * scanRadius); r.setAttribute('opacity', (1 - t) * .7); });
        const angle = raw * Math.PI * 2, radius = scanRadius * t;
        sweep.setAttribute('d', `M${p.x} ${p.y}L${p.x + Math.cos(angle) * radius} ${p.y + Math.sin(angle) * radius}A${radius} ${radius} 0 0 0 ${p.x + Math.cos(angle - .5) * radius} ${p.y + Math.sin(angle - .5) * radius}Z`);
      }); sweep.remove(); rings.forEach(r => r.remove());
    } else if (step.kind === 'entrench') {
      const bags = node('g', { fill: color, stroke: '#695e43', 'stroke-width': 1.5 }, run.layer);
      for (let i = 0; i < 6; i++) { const angle = Math.PI * .16 + i * Math.PI * .135; node('rect', { x: p.x + Math.cos(angle) * 28 - 8, y: p.y + Math.sin(angle) * 28 - 4, width: 16, height: 8, rx: 3 }, bags); }
      floating(run, p, '构筑掩体', color, 420);
      await animate(run, 420, t => { bags.setAttribute('opacity', Math.min(1, t * 4) * (1 - Math.max(0, (t - .7) / .3))); bags.setAttribute('transform', `translate(0 ${(1 - t) * 12})`); }); bags.remove();
    } else if (step.kind === 'anchor') {
      const arms = node('g', { stroke: color, 'stroke-width': 3, fill: 'none' }, run.layer);
      for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + i * Math.PI / 2; node('path', { d: `M${p.x + Math.cos(a) * 16} ${p.y + Math.sin(a) * 16}L${p.x + Math.cos(a) * 34} ${p.y + Math.sin(a) * 34}l-8 0m8 0l0-8` }, arms); }
      floating(run, p, '锚定防线', color, 420); await animate(run, 430, t => arms.setAttribute('opacity', Math.min(1, t * 4) * (1 - Math.max(0, (t - .7) / .3)))); arms.remove();
    } else if (step.kind === 'capture') {
      if (run.heldCaptures.has(step.at.id)) {
        run.heldCaptures.get(step.at.id).wrapper.remove(); run.heldCaptures.delete(step.at.id); restoreSprite(run, step.at.id);
      }
      const flag = node('g', {}, run.layer), mast = node('path', { d: `M${p.x} ${p.y + 15}V${p.y - 32}`, stroke: '#e8edce', 'stroke-width': 3 }, flag);
      const cloth = node('path', { fill: step.at.color, stroke: '#f8ffe3', 'stroke-width': 1.2 }, flag);
      floating(run, p, step.at.owner ? '据点接管' : '据点易手', step.at.color, 550);
      const waves = [ring(run, p, step.oldColor), ring(run, p, step.at.color)];
      await animate(run, 620, (t, raw) => {
        const top = p.y + 10 - ease(Math.min(1, t * 1.6)) * 42;
        mast.setAttribute('d', `M${p.x} ${p.y + 15}V${top}`);
        cloth.setAttribute('d', `M${p.x} ${top}q11 ${Math.sin(raw * 20) * 3 - 3} 27 1v16q-15-4-27 0z`);
        waves.forEach((w, i) => { w.setAttribute('r', 12 + Math.max(0, t - i * .12) * 65); w.setAttribute('opacity', (1 - t) * .8); });
        flag.setAttribute('opacity', 1 - Math.max(0, (t - .8) * 5));
      }); flag.remove(); waves.forEach(w => w.remove());
    } else if (step.kind === 'construct') {
      const braces = node('path', { d: `M${p.x - 27} ${p.y + 15}v-40h54v40m-54-10h54m-42-30v40m30-40v40`, fill: 'none', stroke: '#e8c782', 'stroke-width': 3, 'stroke-dasharray': '5 4' }, run.layer);
      await animate(run, 330, t => braces.setAttribute('opacity', Math.sin(t * Math.PI))); braces.remove();
    } else await pulse(run, p, color, 260, step.kind === 'deploy' ? 42 : 30, step.kind === 'deploy' ? '部署' : step.kind === 'upgrade' ? '升级排程' : step.kind === 'produce' ? '生产排程' : '');
  }

  function cleanup(run) {
    // Floating labels can outlast the main impact by a few frames. Settle those
    // too, so no orphan RAF survives switching pages or replacing the battle.
    for (const stop of [...run.waiters]) stop();
    run.layer?.remove();
    for (const { el, opacity } of run.hidden) el.style.opacity = opacity;
    if (currentRun === run) currentRun = null;
  }
  function cancel({ keepAmbience = false } = {}) {
    if (currentRun) { const run = currentRun; run.cancelled = true; for (const stop of [...run.waiters]) stop(); cleanup(run); }
    for (const n of [...voices]) { try { n.stop(); } catch (_) {} voiceCleanups.get(n)?.(); }
    voices.clear(); voiceCleanups.clear();
    if (!keepAmbience) { scene = { ...scene, active: false }; stopAmbience(); }
  }
  async function play({ before, after, command, board, viewerId, xy, fast = false, spriteScale = .46, unitOffset = { x: -23, y: -24 }, buildingScale = .65, buildingOffset = { x: 0, y: -6 }, onComplete } = {}) {
    cancel({ keepAmbience: true });
    let outcome = { played: false, cancelled: false, steps: 0 };
    try {
      if (!after || !command) return outcome;
      const sequence = plan(before, after, command, viewerId);
      outcome.steps = sequence.steps.length;
      if (!sequence.observed) return outcome;
      if (!enabled || !board || !root.document || !root.requestAnimationFrame) {
        // Sound remains an independent preference when visual effects are disabled.
        for (const step of sequence.steps) sound(step.kind === 'shot' ? step.projectile : step.kind === 'move' ? step.segments[0][0].family : step.kind);
        return outcome;
      }
      const reduced = !!root.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const run = { board, layer: node('g', { class: 'game-fx-layer', 'data-fx-layer': ++serial, 'aria-hidden': 'true', 'pointer-events': 'none' }, board),
        xy: xy || (p => ({ x: Math.sqrt(3) * 44 * (p.q + p.r / 2), y: 66 * p.r })),
        hidden: [], waiters: new Set(), heldCaptures: new Map(), cancelled: false, speed: reduced ? .14 : fast ? .36 : 1, reduced, scale: spriteScale, offset: unitOffset,
        buildingScale, buildingOffset };
      currentRun = run; outcome.played = true;
      try {
        for (const step of sequence.steps) {
          if (step.kind === 'deploy') hideSprite(run, step.at.id);
          else if (step.kind === 'capture' && before.entities[step.at.id] && !run.heldCaptures.has(step.at.id)) {
            const original = before.entities[step.at.id], held = sprite(run, original, run.xy(original));
            if (held) run.heldCaptures.set(step.at.id, held);
          }
        }
        for (const step of sequence.steps) {
          if (run.cancelled) break;
          if (step.kind === 'move') await moveEffect(run, step);
          else if (step.kind === 'shot') await shotEffect(run, step);
          else if (step.kind === 'blocked') { sound('cancel'); await pulse(run, run.xy(step.at), '#ffbd88', 200, 24, '路线受阻'); }
          else if (step.kind === 'turn') sound('turn');
          else await supportEffect(run, step);
        }
        outcome.cancelled = run.cancelled;
      } finally { cleanup(run); }
      return outcome;
    } finally { if (typeof onComplete === 'function') onComplete(outcome); }
  }

  const api = { capture, plan, play, cancel, setPaused, unlock, setEnabled, setSoundEnabled, setAmbienceEnabled, setScene, setVolume, settings,
    motionFamily, projectileFamily, skillKinds, soundDesign, ambienceProfile };
  root.GameFX = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
