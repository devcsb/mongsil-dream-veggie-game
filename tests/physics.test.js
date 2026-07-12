/**
 * Unit tests for MongsilPhysics — drives the real shipped physics module.
 * Run: node tests/physics.test.js
 */
'use strict';

const path = require('path');
const fs = require('fs');
const Physics = require(path.join(__dirname, '..', 'physics.js'));

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

const dt = 1 / 60;
const cfg = Physics.DEFAULTS;

// --- (a) Hold right: vx grows positive to cap; release decelerates to 0 ---
{
  const hold = Physics.simulateHorizontal(0, true, { left: false, right: true }, 1.2, dt, cfg);
  assert(hold.vx > 0, 'right hold produces positive vx', `vx=${hold.vx}`);
  assert(
    Math.abs(hold.vx - cfg.maxRunSpeed) < 1,
    'right hold reaches max run speed',
    `vx=${hold.vx} max=${cfg.maxRunSpeed}`
  );

  const coast = Physics.simulateHorizontal(hold.vx, true, { left: false, right: false }, 1.5, dt, cfg);
  assert(Math.abs(coast.vx) < 5, 'release decelerates toward 0', `vx=${coast.vx}`);
}

// --- (b) Skid: opposing input decelerates faster than friction alone, then reverses ---
{
  const startVx = 350;
  const skid = Physics.simulateHorizontal(startVx, true, { left: true, right: false }, 0.25, dt, cfg);
  const frictionOnly = Physics.simulateHorizontal(startVx, true, { left: false, right: false }, 0.25, dt, cfg);
  assert(
    skid.vx < frictionOnly.vx,
    'skid reduces speed faster than neutral friction',
    `skid=${skid.vx} friction=${frictionOnly.vx}`
  );

  const reverse = Physics.simulateHorizontal(startVx, true, { left: true, right: false }, 0.8, dt, cfg);
  assert(reverse.vx < 0, 'after skid, direction reverses to left', `vx=${reverse.vx}`);

  // Symmetric: left run then right input
  const startLeft = -350;
  const skidR = Physics.simulateHorizontal(startLeft, true, { left: false, right: true }, 0.25, dt, cfg);
  const fricR = Physics.simulateHorizontal(startLeft, true, { left: false, right: false }, 0.25, dt, cfg);
  assert(
    skidR.vx > fricR.vx,
    'skid from left is symmetric (faster toward zero/right)',
    `skid=${skidR.vx} friction=${fricR.vx}`
  );
  const revR = Physics.simulateHorizontal(startLeft, true, { left: false, right: true }, 0.8, dt, cfg);
  assert(revR.vx > 0, 'after skid from left, reverses to right', `vx=${revR.vx}`);
}

// --- (c) Short hold jump apex lower than long hold ---
{
  const shortHop = Physics.simulateJumpTrajectory({ holdTime: 0.06, dt, cfg, startVx: 0 });
  const longHop = Physics.simulateJumpTrajectory({ holdTime: 0.45, dt, cfg, startVx: 0 });
  // y increases downward in game coords, so apex is more negative when higher
  assert(
    shortHop.apexY > longHop.apexY,
    'short jump apex is lower than long hold jump',
    `shortApex=${shortHop.apexY} longApex=${longHop.apexY}`
  );
}

// --- (d) Jump cut: release makes vy less upward than holding ---
{
  // Step vertical mid-rise with and without release
  const rising = { vy: -500, grounded: false, coyote: 0, jumpBuffer: 0 };
  const held = Physics.stepVertical(rising, { jumpHeld: true, jumpQueued: false }, dt, {}, cfg);
  const cut = Physics.stepVertical(
    rising,
    { jumpHeld: false, jumpQueued: false },
    dt,
    { jumpJustReleased: true },
    cfg
  );
  // After cut, vy should be closer to zero / more downward than hold path
  assert(
    cut.vy > held.vy,
    'jump cut moves vy toward descent vs hold',
    `cut.vy=${cut.vy} held.vy=${held.vy}`
  );
  assert(cut.vy > rising.vy * cfg.jumpCutFactor - 50, 'jump cut applies factor', `cut.vy=${cut.vy}`);
}

// --- (e) Air control changes x ---
{
  const withAir = Physics.simulateJumpTrajectory({
    holdTime: 0.3,
    dt,
    cfg,
    startVx: 0,
    airInput: { left: false, right: true }
  });
  const noAir = Physics.simulateJumpTrajectory({
    holdTime: 0.3,
    dt,
    cfg,
    startVx: 0,
    airInput: { left: false, right: false }
  });
  assert(
    withAir.endX > noAir.endX + 20,
    'air right input increases horizontal travel',
    `with=${withAir.endX} none=${noAir.endX}`
  );
}

// --- (f) Running jump travels farther horizontally ---
{
  const runJump = Physics.simulateJumpTrajectory({
    holdTime: 0.35,
    dt,
    cfg,
    startVx: cfg.maxRunSpeed,
    airInput: { left: false, right: true }
  });
  const standJump = Physics.simulateJumpTrajectory({
    holdTime: 0.35,
    dt,
    cfg,
    startVx: 0,
    airInput: { left: false, right: false }
  });
  assert(
    Math.abs(runJump.endX) > Math.abs(standJump.endX) + 80,
    'running jump has greater horizontal distance',
    `run=${runJump.endX} stand=${standJump.endX}`
  );
}

// --- Facing render scale (art faces right natively) ---
{
  const rightScale = Physics.facingRenderScale(1);
  const leftScale = Physics.facingRenderScale(-1);
  assert(rightScale === 1, 'facing right renders with scaleX +1 (art faces right)', `got ${rightScale}`);
  assert(leftScale === -1, 'facing left renders with scaleX -1', `got ${leftScale}`);
  assert(rightScale !== leftScale, 'left and right facing scales differ');
  assert(rightScale > 0 && leftScale < 0, 'right/left scale signs match movement');
}

// --- Facing from input ---
{
  assert(Physics.facingFromVelocityOrInput(0, 1, 1) === 1, 'input right sets facing +1');
  assert(Physics.facingFromVelocityOrInput(0, -1, 1) === -1, 'input left sets facing -1');
}

log('');
log(`Results: ${passed} passed, ${failed} failed`);

const scratch = process.env.SCRATCH_DIR || path.join(__dirname, '..', '.test-out');
try {
  fs.mkdirSync(scratch, { recursive: true });
  fs.writeFileSync(path.join(scratch, 'physics-tests.log'), logLines.join('\n') + '\n');
  fs.writeFileSync(
    path.join(scratch, 'facing-check.log'),
    [
      `facingRenderScale(+1)=${Physics.facingRenderScale(1)}`,
      `facingRenderScale(-1)=${Physics.facingRenderScale(-1)}`,
      `right faces corrected: scaleX=${Physics.facingRenderScale(1)}`,
      `left faces corrected: scaleX=${Physics.facingRenderScale(-1)}`,
      failed === 0 ? 'FACING_OK' : 'FACING_FAIL'
    ].join('\n') + '\n'
  );
} catch (e) {
  log('warn: could not write scratch logs: ' + e.message);
}

process.exit(failed > 0 ? 1 : 0);
