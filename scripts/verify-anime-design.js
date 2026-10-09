/* Design-document and isolated preview checks. This does not inspect browser layout or audio quality. */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const assert = require('assert');
const data = require('../src/data.js');
const base = path.resolve(__dirname, '..');
const files = {
  style: 'docs/二次元整体游戏风格设定-2026-10-09.md',
  motion: 'docs/二次元动作设计-2026-10-09.md',
  audio: 'docs/二次元音效与音乐设计-2026-10-09.md',
  index: 'docs/二次元风格与视听交付索引-2026-10-09.md',
  feedback: 'docs/用户反馈台账.md'
};
const docs = Object.fromEntries(Object.entries(files).map(([k, p]) => [k, fs.readFileSync(path.join(base, p), 'utf8')]));
const skills = {entrench:'构筑掩体', pierce:'穿甲弹', anchor:'锚定防线', scan:'主动扫描', shock:'震荡弹', sniper:'定点狙击', repair:'应急修复', jam:'链路干扰'};
const coverage = {};
for (const key of ['motion', 'audio']) {
  const ids = [...docs[key].matchAll(/^\| `([a-z]+)`[^\n]*$/gm)].map(m => m[1]).filter(id => data.byId[id]);
  const missing = data.units.map(u => u.id).filter(id => !ids.includes(id));
  assert.equal(new Set(ids).size, data.units.length);
  assert.equal(ids.length, data.units.length);
  assert.equal(missing.length, 0);
  for (const name of Object.values(skills)) assert(docs[key].includes(name), key + ' missing ' + name);
  coverage[key] = {uniqueUnits: new Set(ids).size, missing, duplicates: ids.filter((id, i) => ids.indexOf(id) !== i)};
}
function timelineRows(s) {
  return s.split('\n').filter(l => /^\|[^|]+\|\s*\d+\s*[／/]/.test(l)).map(l => {
    const cells = l.split('|').map(s => s.trim());
    return {label: cells[1], values: cells.slice(2, 5).map(s => s.split(/[／/]/).map(Number))};
  });
}
const motionRows = timelineRows(docs.motion), audioRows = timelineRows(docs.audio);
assert.equal(motionRows.length, 11); assert.equal(audioRows.length, 11);
for (const row of motionRows) assert(audioRows.some(other => JSON.stringify(row.values) === JSON.stringify(other.values)), 'missing timeline ' + row.label);
const terrainIds = Object.keys(data.terrain), buildingIds = data.buildings.map(b => b.id);
for (const id of [...terrainIds, ...buildingIds]) assert(docs.style.includes('`' + id + '`'), 'style missing ' + id);
let localLinks = 0;
for (const [key, file] of Object.entries(files)) for (const match of docs[key].matchAll(/\]\(([^)]+)\)/g)) {
  const target = match[1];
  if (/^https?:/.test(target) || target.startsWith('#')) continue;
  const resolved = path.resolve(base, path.dirname(file), target.split('#')[0]);
  if (resolved.endsWith('anime-design-checks-2026-10-09.json')) continue;
  assert(fs.existsSync(resolved), 'missing ' + target); localLinks++;
}
const fragmentPath = process.argv[2];
assert(fragmentPath, 'Pass the absolute preview fragment path as the first argument.');
const fragment = fs.readFileSync(fragmentPath, 'utf8');
const script = fragment.match(/<script>([\s\S]*?)<\/script>/)[1];
assert(Buffer.byteLength(fragment) < 1000000);
assert(!/<(?:!doctype|html|head|body)\b/i.test(fragment));
assert(!/\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(/.test(script));
new vm.Script(script);
class Element {
  constructor(tag) { this.tag = tag; this.attrs = {}; this.children = []; this.listeners = {}; this.value = ''; this.checked = false; this.isConnected = true; this.history = []; this._text = ''; }
  set textContent(v) { this._text = v; this.history.push(v); } get textContent() { return this._text; }
  setAttribute(k, v) { this.attrs[k] = v; } appendChild(n) { this.children.push(n); return n; } replaceChildren() { this.children = []; }
  addEventListener(k, f) { (this.listeners[k] ??= []).push(f); } async dispatch(k, e = {}) { for (const f of this.listeners[k] || []) await f(e); }
  getBoundingClientRect() { return {width: this.width || 736}; } all() { return [this, ...this.children.flatMap(c => c.all())]; }
}
function environment(options = {}) {
  let now = 0, seq = 0, maxVoices = 0;
  const queue = new Map(), nodes = [], saved = [];
  const elements = Object.fromEntries([...fragment.matchAll(/id="([^"]+)"/g)].map(m => [m[1], new Element('html')]));
  const root = elements['six-realms-av-study']; root.width = options.width || 736;
  root.querySelector = s => { assert(elements[s.slice(1)], 'query ' + s); return elements[s.slice(1)]; };
  const media = new Element(); media.matches = !!options.reduced;
  const doc = new Element(); doc.hidden = false; doc.getElementById = id => elements[id]; doc.createElementNS = (ns, tag) => new Element(tag);
  const win = new Element(); win.matchMedia = () => media;
  win.openai = {widgetState: options.state, setWidgetState: s => { saved.push(s); return Promise.resolve(); }};
  const param = {setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {}};
  class AudioContext {
    constructor() { this.state = 'suspended'; this.destination = {}; } get currentTime() { return now / 1000; }
    resume() { this.state = 'running'; return Promise.resolve(); } suspend() { this.state = 'suspended'; return Promise.resolve(); } close() { this.state = 'closed'; return Promise.resolve(); }
    createGain() { return {gain: param, connect() {}, disconnect() {}}; }
    createOscillator() {
      const n = {frequency: param, connect() {}, disconnect() {}, start() { n.started = true; maxVoices = Math.max(maxVoices, nodes.filter(x => x.started && !x.ended).length); }, stop(t) { if (t === undefined) { n.ended = true; n.onended?.(); } else n.end = t; }};
      nodes.push(n); return n;
    }
  }
  if (!options.noAudio) win.AudioContext = AudioContext;
  const context = vm.createContext({document: doc, window: win, performance: {now: () => now}, ResizeObserver: class { observe() {} }, requestAnimationFrame: f => { queue.set(++seq, f); return seq; }, cancelAnimationFrame: id => queue.delete(id), setTimeout, console});
  vm.runInContext(script, context);
  function tick(ms = 20) { now += ms; for (const [id, f] of [...queue]) { queue.delete(id); f(now); } for (const n of nodes) if (n.started && !n.ended && n.end <= now / 1000) { n.ended = true; n.onended?.(); } }
  async function choose(which, mode, sound = false) {
    elements['av-case'].value = which; await elements['av-case'].dispatch('change');
    elements['av-mode'].value = mode; await elements['av-mode'].dispatch('change');
    elements['av-sound'].checked = sound; await elements['av-sound'].dispatch('change');
  }
  async function play() { await elements['av-play'].dispatch('click'); }
  function complete() { let ticks = 0; while (queue.size) { tick(); assert(++ticks < 160); } for (let i = 0; i < 30; i++) tick(); assert(elements['av-state'].textContent.includes('完成')); assert.equal(elements['av-play'].textContent, '播放'); }
  return {elements, doc, win, media, choose, play, tick, complete, queue, nodes, saved, get maxVoices() { return maxVoices; }};
}
(async () => {
  const scenarios = [];
  const durations = {attack: {standard:1240, fast:440, reduced:240}, capture: {standard:1240, fast:500, reduced:280}, repair: {standard:720, fast:250, reduced:160}, scan: {standard:640, fast:220, reduced:120}, jam: {standard:640, fast:220, reduced:120}};
  for (const which of Object.keys(durations)) for (const mode of ['standard', 'fast', 'reduced']) {
    const e = environment(); await e.choose(which, mode); assert.equal(e.nodes.length, 0); await e.play(); e.complete();
    const marks = e.elements['av-scene'].all().map(n => n.textContent);
    if (which === 'attack') { assert(marks.includes('受击')); assert(marks.includes('反击命中')); }
    if (which === 'capture') {
      assert(marks.includes('归属确认')); assert(marks.includes('出库确认'));
      const history = e.elements['av-state'].history;
      assert(history.findIndex(s => s.includes('接管 · 确认')) < history.findIndex(s => s.includes('部署 · 确认')));
    }
    assert(e.elements['av-timeline'].all().some(n => n.textContent === durations[which][mode] + ' ms'));
    assert.equal(e.nodes.length, 0); scenarios.push({event: which, mode, totalMs: durations[which][mode], pass: true});
  }
  const audible = environment(); await audible.choose('repair', 'standard', true); assert.equal(audible.nodes.length, 0); await audible.play(); audible.complete(); assert(audible.nodes.length > 0); assert(audible.maxVoices <= 11); assert(audible.nodes.every(n => n.ended));
  const stop = environment(); await stop.choose('attack', 'standard', true); await stop.play(); stop.tick(150); await stop.play(); assert.equal(stop.queue.size, 0); assert(stop.nodes.every(n => n.ended));
  const hidden = environment(); await hidden.play(); hidden.doc.hidden = true; await hidden.doc.dispatch('visibilitychange'); assert.equal(hidden.queue.size, 0); assert.equal(hidden.elements['av-play'].textContent, '播放');
  const os = environment({reduced: true, state: {modelContent: {event: 'scan', mode: 'standard', sound: false}}, width: 320}); assert.equal(os.elements['av-mode'].value, 'reduced'); assert.equal(os.elements['av-mode'].disabled, true); await os.play(); os.complete();
  const restored = environment({state: {modelContent: {event: 'jam', mode: 'fast', sound: false}}}); assert.equal(restored.elements['av-case'].value, 'jam'); assert.equal(restored.elements['av-mode'].value, 'fast'); assert.equal(restored.saved.length, 0); await restored.play(); restored.complete();
  const unavailable = environment({noAudio: true}); await unavailable.choose('scan', 'fast', true); await unavailable.play(); unavailable.complete(); assert(unavailable.elements['av-state'].textContent.includes('音频未启用'));
  const report = {
    date: '2026-10-09', scope: 'Design documents and isolated JavaScript execution; no game runtime changes',
    dataCoverage: {source: 'src/data.js', sourceUnitCount: data.units.length, activeSkills: skills, activeSkillCount: 8, ...coverage, terrainCount: terrainIds.length, buildingCount: buildingIds.length},
    timelines: {classes: 11, modes: 3, markers: 3, valuesChecked: 99, conflicts: 0}, links: {checked: localLinks, missing: 0},
    preview: {fragmentBytes: Buffer.byteLength(fragment), syntax: true, elementQueries: true, scenarios, checks: ['no automatic sound', 'capture before deployment', 'counterattack sequence in schematic', 'user-triggered synthetic node lifecycle', 'stop cancels animation/audio', 'background cancels animation', 'saved choices restore without autosaving', 'system reduced motion overrides', 'audio unavailable retains visual completion'], syntheticAudioNodesCreated: audible.nodes.length, maxConcurrentSyntheticNodes: audible.maxVoices},
    limits: ['Isolated DOM and Web Audio stubs verify control flow, not browser layout, device gestures, audio decoding or listening quality.', 'In-app browser local preview timed out; local HTTP access was restricted by socket permissions. No visual browser QA or real phone QA is claimed.', 'No formal chibi animation, SFX recording, BGM recording, voice recording or game integration was created.']
  };
  fs.writeFileSync(path.join(base, 'reports/anime-design-checks-2026-10-09.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({units: data.units.length, skills: 8, timelineValues: 99, localLinks, previewScenarios: scenarios.length, extraBehaviorChecks: 9, pass: true}));
})().catch(e => { console.error(e.stack); process.exitCode = 1; });
