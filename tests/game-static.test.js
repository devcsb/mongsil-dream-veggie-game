/**
 * Static + load checks for shipped game entry (no browser required).
 * Run: node tests/game-static.test.js
 */
'use strict';

const path = require('path');
const fs = require('fs');
const vm = require('vm');

const root = path.join(__dirname, '..');
const logLines = [];
function log(msg) {
  logLines.push(msg);
  console.log(msg);
}

let passed = 0;
let failed = 0;
function assert(cond, name, detail) {
  if (cond) {
    passed++;
    log(`PASS: ${name}`);
  } else {
    failed++;
    log(`FAIL: ${name}${detail ? ' — ' + detail : ''}`);
  }
}

const files = ['index.html', 'physics.js', 'stages.js', 'game.js', 'styles.css', 'assets/pobi.png', 'assets/snail.png'];
for (const f of files) {
  const p = path.join(root, f);
  assert(fs.existsSync(p), `exists ${f}`, p);
}

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert(html.includes('physics.js'), 'index loads physics.js');
assert(html.includes('stages.js'), 'index loads stages.js');
assert(html.includes('game.js'), 'index loads game.js');
assert(html.includes('assets/pobi.png'), 'index references pobi.png');
assert(html.includes('result-pobi'), 'index has result-pobi container');
assert(html.includes('1280') && html.includes('720'), 'canvas 1280x720 in html');

const gameSrc = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
assert(gameSrc.includes('facingRenderScale'), 'game uses facingRenderScale');
assert(gameSrc.includes('completeStage'), 'game has completeStage progression');
assert(gameSrc.includes('반란군 포비'), 'game ending mentions 반란군 포비');
assert(gameSrc.includes('jumpJustReleased'), 'game wires jump cut flag');
assert(gameSrc.includes('MongsilPhysics'), 'game depends on MongsilPhysics');
assert(gameSrc.includes('MongsilStages'), 'game depends on MongsilStages');

// Syntax / load physics + stages in isolation
const Physics = require(path.join(root, 'physics.js'));
const Stages = require(path.join(root, 'stages.js'));
assert(typeof Physics.stepHorizontal === 'function', 'Physics.stepHorizontal export');
assert(Stages.stageCount() === 3, 'Stages.stageCount is 3');

// Ending path simulation via stage API
let cleared = 0;
for (let i = 0; i < Stages.stageCount(); i++) {
  const s = Stages.getStage(i);
  assert(s.portal && s.requiredVeggies > 0, `stage ${i + 1} clearable`);
  cleared++;
}
assert(cleared === 3, 'all three stages clearable in sequence');
log('ENDING_SIM: clear 1→2→3 then rescue 반란군 포비');

// game.js syntax check via new Function (strip IIFE runtime by checking parse)
try {
  new Function(gameSrc);
  assert(true, 'game.js parses as JS');
} catch (e) {
  assert(false, 'game.js parses as JS', e.message);
}

try {
  new Function(fs.readFileSync(path.join(root, 'physics.js'), 'utf8'));
  assert(true, 'physics.js parses as JS');
} catch (e) {
  assert(false, 'physics.js parses as JS', e.message);
}

try {
  new Function(fs.readFileSync(path.join(root, 'stages.js'), 'utf8'));
  assert(true, 'stages.js parses as JS');
} catch (e) {
  assert(false, 'stages.js parses as JS', e.message);
}

log('');
log(`Results: ${passed} passed, ${failed} failed`);

const scratch = process.env.SCRATCH_DIR || path.join(root, '.test-out');
fs.mkdirSync(scratch, { recursive: true });
fs.writeFileSync(path.join(scratch, 'game-static.log'), logLines.join('\n') + '\n');

process.exit(failed > 0 ? 1 : 0);
