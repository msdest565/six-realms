const assert = require('node:assert/strict');
const fs = require('node:fs');
const D = require('../src/data'), H = require('../src/grid'), M = require('../src/maps'), G = require('../src/game');
const FX = require('../src/fx');
const tests = [];
async function test(id, name, fn) {
  try { await fn(); tests.push({ id, name, ok: true }); }
  catch (e) { tests.push({ id, name, ok: false, error: e.stack }); console.error(id, name, e.message); }
}
function makeUnit(type, owner, q, r, id = type + owner) { return G.normalizeUnit({ id, type, owner, q, r }); }
function makeBuilding(type, owner, q, r, id = type + owner) { const d = D.buildingById[type]; return { id, type, owner, q, r, level: 1, hp: d.hp, maxHp: d.hp, state: 'complete', stock: [], order: null }; }
function fixture(units = [], buildings = [], fog = false) {
  const s = G.create(M.fixed('S', 2), { fog });
  s.cells = [];
  for (let q = -10; q <= 10; q++) for (let r = -10; r <= 10; r++) s.cells.push({ q, r, terrain: 'plain' });
  s.units = units; s.buildings = buildings;
  s.players.forEach(p => { p.resources = { money: 2500, energy: 200 }; p.ownTurnIndex = p.id === 'P1' ? 1 : 0; });
  s.knownBuildings = { P1: {}, P2: {} }; G.vision(s);
  return s;
}
function perform(s, command, viewer = 'P1') {
  const before = FX.capture(s, command, viewer), outcome = G.execute(s, command);
  assert.equal(outcome.ok, true, outcome.error);
  return { before, plan: FX.plan(before, s, command, viewer), after: s, command, viewerId: viewer };
}
function coordinates(segments) { return segments.flat().map(p => H.key(p.q, p.r)); }

// A deterministic DOM and RAF driver tests cancellation and pause without claiming
// browser paint or audible output. Browser UI checks are performed separately.
class Element {
  constructor(tag) { this.tagName = tag; this.attributes = new Map(); this.children = []; this.style = { opacity: '' }; this.isConnected = true; }
  setAttribute(k, v) { this.attributes.set(k, String(v)); }
  getAttribute(k) { return this.attributes.get(k) ?? null; }
  appendChild(e) { e.parent = this; this.children.push(e); return e; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(e => e !== this); this.parent = null; this.isConnected = false; }
  querySelectorAll(selector) {
    const names = [...selector.matchAll(/\[([^\]]+)\]/g)].map(m => m[1]), found = [];
    function visit(e) { for (const c of e.children) { if (names.some(n => c.attributes.has(n))) found.push(c); visit(c); } }
    visit(this); return found;
  }
}
let rafSerial = 0, timestamp = 0, frames = new Map(), reduced = false;
global.document = { createElementNS: (_, tag) => new Element(tag) };
global.requestAnimationFrame = fn => { const id = ++rafSerial; frames.set(id, fn); return id; };
global.cancelAnimationFrame = id => frames.delete(id);
global.matchMedia = () => ({ matches: reduced });
global.GameArt = require('../src/art');
function boardFor(unit, building) {
  const board = new Element('svg');
  if (unit) { const glyph = new Element('g'); glyph.setAttribute('data-unit-sprite', unit.id); glyph.setAttribute('data-sprite-offset', '-23,-29'); glyph.style.opacity = '.72'; board.appendChild(glyph); }
  if (building) { const glyph = new Element('g'); glyph.setAttribute('data-building-sprite', building.id); glyph.setAttribute('data-sprite-offset', '0,-6'); board.appendChild(glyph); }
  return board;
}
async function pump(count = 1) {
  for (let i = 0; i < count; i++) {
    const active = [...frames]; frames.clear(); timestamp += 16;
    active.forEach(([, fn]) => fn(timestamp));
    await Promise.resolve(); await Promise.resolve();
  }
}
async function finish(promise, maximum = 1200) {
  let done = false, result; promise.then(value => { done = true; result = value; });
  for (let i = 0; i < maximum && !done; i++) await pump();
  assert.ok(done, 'FX promise must settle'); return result;
}

(async () => {
  await test('FX-01', 'Every unit has a movement/weapon family and every active skill has its own effect', () => {
    for (const u of D.units) {
      assert.ok(['infantry', 'vehicle', 'ship', 'helicopter', 'jet'].includes(FX.motionFamily(u.id, u.branch === 'air' ? 'air' : u.branch === 'navy' ? 'sea' : 'land')));
      assert.ok(FX.soundDesign[FX.projectileFamily(u.id, u.branch === 'air' ? 'air' : 'land')]);
    }
    const active = new Set(D.units.map(u => u.skill).filter(x => !['基础作战', '驻守', '伏击', '防空反击'].includes(x)));
    assert.deepEqual([...active].sort(), Object.keys(FX.skillKinds).sort());
    for (const kind of Object.values(FX.skillKinds)) assert.ok(FX.soundDesign[kind] || kind === 'pierce');
    assert.equal(FX.motionFamily('marine', 'land'), 'infantry'); assert.equal(FX.motionFamily('marine', 'sea'), 'ship');
    assert.equal(FX.motionFamily('amphibious', 'land'), 'vehicle'); assert.equal(FX.motionFamily('amphibious', 'sea'), 'ship');
  });
  await test('FX-02', 'Movement follows the actual legal detour, not an invented straight line', () => {
    const u = makeUnit('tank', 'P1', 0, 0), s = fixture([u]);
    G.cell(s, { q: 1, r: 0 }).terrain = 'ridge';
    const expected = [H.key(u.q, u.r), ...G.movement(s, u).get('2,0').path.map(p => H.key(p.q, p.r))];
    const { plan } = perform(s, { kind: 'move', unitId: u.id, q: 2, r: 0 });
    assert.deepEqual(coordinates(plan.steps[0].segments), expected);
    assert.ok(!coordinates(plan.steps[0].segments).includes('1,0'));
  });
  await test('FX-03', 'A hidden collision truncates before the blocked tile and does not animate the planned endpoint', () => {
    const u = makeUnit('scout', 'P1', 0, 0), blocker = makeUnit('infantry', 'P2', 2, 0), s = fixture([u, blocker], [], true);
    s.vision.P1 = { ground: ['0,0'], air: ['0,0'] };
    const { plan } = perform(s, { kind: 'move', unitId: u.id, q: 3, r: 0 });
    assert.deepEqual([u.q, u.r], [1, 0]);
    assert.deepEqual(coordinates(plan.steps[0].segments), ['0,0', '1,0']);
    assert.equal(plan.steps[0].unit.id, u.id);
  });
  await test('FX-04', 'Enemy movement drops hidden coordinates and separates disconnected visible segments', () => {
    const own = makeUnit('infantry', 'P1', -8, -8), enemy = makeUnit('scout', 'P2', 0, 0), s = fixture([own, enemy], [], true);
    s.actor = 'P2'; s.turnOrder = ['P2', 'P1']; s.vision.P1 = { ground: ['0,0', '1,0', '3,0', '4,0'], air: [] };
    const command = { kind: 'move', unitId: enemy.id, q: 4, r: 0 }, before = FX.capture(s, command, 'P1');
    assert.equal(G.execute(s, command).ok, true);
    // Maintain the observer's selective LOS to exercise both visible fragments.
    s.vision.P1 = { ground: ['0,0', '1,0', '3,0', '4,0'], air: [] };
    const sequence = FX.plan(before, s, command, 'P1');
    assert.deepEqual(sequence.steps[0].segments.map(coordinates), [['0,0', '1,0'], ['3,0', '4,0']]);
    assert.ok(!JSON.stringify(sequence).includes('"q":2'));
    assert.equal(before.entities[own.id].owner, 'P1');
  });
  await test('FX-05', 'A wholly hidden AI move creates no effects, sounds or observed unit metadata', () => {
    const own = makeUnit('infantry', 'P1', -8, -8), enemy = makeUnit('scout', 'P2', 0, 0), s = fixture([own, enemy], [], true);
    s.actor = 'P2';
    const { before, plan } = perform(s, { kind: 'move', unitId: enemy.id, q: 2, r: 0 });
    assert.equal(before.entities[enemy.id], undefined);
    assert.equal(plan.observed, false); assert.equal(plan.steps.length, 0);
    assert.ok(!JSON.stringify(before).includes('scout'));
  });
  await test('FX-06', 'Shots and countershots derive damage and order from the completed transaction', () => {
    const a = makeUnit('infantry', 'P1', 0, 0), t = makeUnit('infantry', 'P2', 1, 0), s = fixture([a, t]);
    const { plan } = perform(s, { kind: 'attack', unitId: a.id, targetId: t.id });
    assert.deepEqual(plan.steps.map(x => [x.kind, x.from.id, x.to.id, x.damage, x.counter, x.lethal]), [
      ['shot', a.id, t.id, 40, false, false], ['shot', t.id, a.id, 20, true, false]
    ]);
  });
  await test('FX-07', 'Lethal direct shots and indirect attacks never fabricate a countershot', () => {
    const a = makeUnit('tank', 'P1', 0, 0), t = makeUnit('infantry', 'P2', 1, 0), s = fixture([a, t]); t.hp = 10;
    const first = perform(s, { kind: 'attack', unitId: a.id, targetId: t.id }).plan;
    assert.equal(first.steps.length, 1); assert.equal(first.steps[0].damage, 10); assert.equal(first.steps[0].lethal, true);
    const artillery = makeUnit('artillery', 'P1', 0, 0), aa = makeUnit('antiair', 'P2', 2, 0), second = fixture([artillery, aa]);
    const { plan } = perform(second, { kind: 'attack', unitId: artillery.id, targetId: aa.id });
    assert.equal(plan.steps.length, 1); assert.equal(plan.steps[0].projectile, 'mortar');
  });
  await test('FX-08', 'Dedicated AA lethal retaliation uses its actual 150 percent loss', () => {
    const a = makeUnit('lightbomber', 'P1', 0, 0), t = makeUnit('antiair', 'P2', 1, 0), s = fixture([a, t]);
    const { plan } = perform(s, { kind: 'attack', unitId: a.id, targetId: t.id });
    assert.equal(plan.steps[1].damage, 100); assert.equal(plan.steps[1].lethal, true); assert.equal(plan.steps[1].projectile, 'missile');
  });
  await test('FX-09', 'An unseen artillery attacker shows only an observed impact and own HP loss', () => {
    const own = makeUnit('infantry', 'P1', 0, 0), enemy = makeUnit('heavyartillery', 'P2', 4, 0), s = fixture([own, enemy], [], true);
    s.actor = 'P2'; s.vision.P2.ground.push('0,0');
    const { plan } = perform(s, { kind: 'attack', unitId: enemy.id, targetId: own.id });
    assert.equal(plan.steps[0].from, null); assert.equal(plan.steps[0].projectile, 'unknown');
    assert.equal(plan.steps[0].to.id, own.id); assert.ok(plan.steps[0].damage > 0);
    assert.ok(!JSON.stringify(plan).includes('heavyartillery'));
  });
  await test('FX-10', 'Capture has observed ownership colors; building destruction keeps its original sprite metadata', () => {
    const u = makeUnit('infantry', 'P1', 0, 0), city = makeBuilding('city', null, 1, 0), s = fixture([u], [city]);
    const captured = perform(s, { kind: 'capture', unitId: u.id, buildingId: city.id }).plan.steps[0];
    assert.equal(captured.kind, 'capture'); assert.equal(captured.at.owner, 'P1'); assert.equal(captured.at.color, s.players[0].color);
    const a = makeUnit('tank', 'P1', 0, 0), b = makeBuilding('factory', 'P2', 1, 0), second = fixture([a], [b]); b.hp = 10;
    const hit = perform(second, { kind: 'attack', unitId: a.id, targetId: b.id }).plan.steps[0];
    assert.equal(hit.lethal, true); assert.equal(hit.to.isUnit, false); assert.equal(hit.to.hp, 10);
  });
  await test('FX-11', 'All eight active skills receive their specific successful effect, with actual capped repair amount', () => {
    for (const [type, kind] of [['walker', 'entrench'], ['heavy', 'anchor'], ['scout', 'scan'], ['engineer', 'repair'], ['jammer', 'jam'], ['tank', 'pierce'], ['artillery', 'shock'], ['destroyer', 'sniper']]) {
      const a = makeUnit(type, 'P1', 0, 0), t = makeUnit('tank', type === 'engineer' ? 'P1' : 'P2', type === 'artillery' ? 2 : 1, 0), s = fixture([a, t]);
      if (type === 'engineer') t.hp = t.maxHp - 15;
      const { plan } = perform(s, { kind: 'skill', unitId: a.id, targetId: t.id });
      if (['pierce', 'shock', 'sniper'].includes(kind)) assert.equal(plan.steps[0].skill, kind);
      else assert.equal(plan.steps[0].kind, kind);
      if (type === 'engineer') assert.equal(plan.steps[0].amount, 15);
    }
  });
  await test('FX-12', 'Execution errors and mismatched observers cannot create successful action feedback', () => {
    const a = makeUnit('infantry', 'P1', 0, 0), s = fixture([a]), command = { kind: 'move', unitId: a.id, q: 10, r: 0 }, before = FX.capture(s, command, 'P1');
    assert.equal(G.execute(s, command).ok, false); assert.equal(FX.plan(before, s, command).observed, false);
    s.revision++; assert.equal(FX.plan(before, s, command, 'P2').observed, false);
  });
  await test('FX-13', 'A complete visual action leaves the authoritative state untouched and restores original opacity', async () => {
    const a = makeUnit('infantry', 'P1', 0, 0), s = fixture([a]), data = perform(s, { kind: 'move', unitId: a.id, q: 2, r: 0 });
    const board = boardFor(a), immutable = JSON.stringify(s), el = board.children[0];
    const result = await finish(FX.play({ ...data, board }));
    assert.equal(result.played, true); assert.equal(result.cancelled, false); assert.equal(board.children.length, 1);
    assert.equal(el.style.opacity, '.72'); assert.equal(JSON.stringify(s), immutable);
  });
  await test('FX-14', 'Pause freezes frame progress; resume finishes; cancel settles immediately even with RAF stopped', async () => {
    const a = makeUnit('scout', 'P1', 0, 0), s = fixture([a]), data = perform(s, { kind: 'skill', unitId: a.id });
    const board = boardFor(a); FX.setPaused(true);
    let settled = false;
    const promise = FX.play({ ...data, board }).then(r => { settled = true; return r; });
    const initial = JSON.stringify(board.children.map(e => [...e.attributes]));
    await pump(50); assert.equal(settled, false);
    assert.equal(JSON.stringify(board.children.map(e => [...e.attributes])), initial);
    FX.setPaused(false); assert.equal((await finish(promise)).cancelled, false);
    FX.setPaused(true);
    const cancelled = FX.play({ ...data, board }); FX.cancel();
    const immediate = await Promise.race([cancelled, new Promise(resolve => setTimeout(() => resolve('timeout'), 30))]);
    assert.notEqual(immediate, 'timeout'); assert.equal(immediate.cancelled, true); assert.equal(board.children.length, 1);
    FX.setPaused(false);
  });
  await test('FX-15', 'No board, detached board and disabled effects complete exactly once without hanging', async () => {
    const a = makeUnit('infantry', 'P1', 0, 0), s = fixture([a]), data = perform(s, { kind: 'move', unitId: a.id, q: 1, r: 0 });
    let calls = 0; const callback = () => calls++;
    assert.equal((await FX.play({ ...data, board: null, onComplete: callback })).played, false);
    FX.setEnabled(false); assert.equal((await FX.play({ ...data, board: boardFor(a), onComplete: callback })).played, false); FX.setEnabled(true);
    const detached = boardFor(a); detached.isConnected = false;
    assert.equal((await finish(FX.play({ ...data, board: detached, onComplete: callback }))).cancelled, true);
    assert.equal(calls, 3);
  });
  await test('FX-16', 'Reduced motion and fast AI shorten motion, and abandoned playback is cleaned before the next one', async () => {
    const a = makeUnit('infantry', 'P1', 0, 0), s = fixture([a]), data = perform(s, { kind: 'move', unitId: a.id, q: 2, r: 0 });
    const b1 = boardFor(a), b2 = boardFor(a), first = FX.play({ ...data, board: b1 });
    reduced = true; const second = FX.play({ ...data, board: b2, fast: true });
    assert.equal((await finish(first)).cancelled, true); assert.equal((await finish(second)).cancelled, false);
    assert.equal(b1.children.length, 1); assert.equal(b2.children.length, 1); reduced = false;
  });
  await test('FX-17', 'Audio requires explicit unlock, respects mute/volume bounds, and rejected resumes do not escape', async () => {
    let created = 0, resumed = 0, suspended = 0;
    class AudioContext {
      constructor() { created++; this.currentTime = 0; this.state = 'suspended'; this.destination = {}; }
      createGain() { return { gain: { setValueAtTime() {} }, connect() {} }; }
      createDynamicsCompressor() { return { threshold: {}, knee: {}, ratio: {}, connect() {} }; }
      async resume() { resumed++; this.state = 'running'; }
      async suspend() { suspended++; this.state = 'suspended'; }
    }
    global.AudioContext = AudioContext;
    assert.equal(created, 0); FX.setSoundEnabled(false); assert.equal(await FX.unlock(), false); assert.equal(created, 0);
    FX.setSoundEnabled(true); assert.equal(await FX.unlock(), true); assert.equal(created, 1); assert.equal(resumed, 1);
    FX.setVolume(2); assert.equal(FX.settings().volume, 1); FX.setVolume(-2); assert.equal(FX.settings().volume, 0); FX.setVolume(.55);
    FX.setPaused(true); FX.setPaused(false); await Promise.resolve(); assert.equal(suspended, 1); assert.equal(resumed, 2);
    AudioContext.prototype.resume = async () => { throw new Error('autoplay denied'); };
    FX.setPaused(true); FX.setPaused(false); await Promise.resolve(); await Promise.resolve();
    assert.equal(await FX.unlock(), false);
    FX.setSoundEnabled(false);
  });
  const report = { version: '0.8', scope: 'Pure observed action plans, animation lifecycle under deterministic DOM/RAF, and audio unlock/preferences; no claim of audible browser testing', passed: tests.filter(t => t.ok).length, total: tests.length, tests };
  fs.mkdirSync(require('node:path').join(__dirname, '../reports'), { recursive: true });
  fs.writeFileSync(require('node:path').join(__dirname, '../reports/fx-tests-v0.8.json'), JSON.stringify(report, null, 2));
  console.log(`FX verification ${report.passed}/${report.total}`);
  process.exitCode = report.passed === report.total ? 0 : 1;
})();
