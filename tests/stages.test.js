/**
 * Stage catalog audit + ending path + reachability/safety checks.
 * Run: node tests/stages.test.js
 */
'use strict';

const path = require('path');
const fs = require('fs');
const Stages = require(path.join(__dirname, '..', 'stages.js'));

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

const STAGE_COUNT = 5;
assert(Stages.stageCount() === STAGE_COUNT, `exactly ${STAGE_COUNT} stages`, `count=${Stages.stageCount()}`);

const audit = Stages.auditStages();
log(JSON.stringify(audit, null, 2));

const stages = audit.stages;
const s1 = stages[0];
const s2 = stages[1];
const s3 = stages[2]; // moonlit-garden challenge
const final = stages[stages.length - 1]; // galaxy summit + pobi

// Names distinct, world widths present
const names = new Set(stages.map((s) => s.name));
assert(names.size === stages.length, 'all stage names are distinct', [...names].join(', '));
assert(stages.every((s) => s.worldW > 0), 'all stages have world widths');

// Difficulty curve: worldW and requiredVeggies monotonically non-decreasing
let worldMono = true;
let vegMono = true;
for (let i = 1; i < stages.length; i++) {
  if (stages[i].worldW < stages[i - 1].worldW) worldMono = false;
  if (stages[i].requiredVeggies < stages[i - 1].requiredVeggies) vegMono = false;
}
assert(worldMono, 'worldW is non-decreasing across stages', stages.map((s) => s.worldW).join(','));
assert(vegMono, 'requiredVeggies non-decreasing across stages', stages.map((s) => s.requiredVeggies).join(','));

// Stage 2 unique vs stage 1
const s1Set = new Set(s1.uniqueElements);
for (const el of s2.newVsEarlier) {
  assert(!s1Set.has(el), `stage2 element ${el} is new vs stage1`);
}
assert(s2.newVsEarlier.length > 0, 'stage2 introduces new elements');
assert(
  s2.platformKinds.includes('cloud') || s2.specialTypes.includes('wind'),
  'stage2 has cloud platforms or wind specials'
);
assert(s2.enemyKinds.includes('sleep_cloud'), 'stage2 has sleep_cloud enemies');

// Stage 3 challenge
assert(
  s3.hazardTypes.includes('thorn') || s3.platformKinds.includes('moving'),
  'stage3 has thorns or moving platforms'
);
assert(s3.enemyKinds.includes('shadow_bat'), 'stage3 has shadow_bat');

// Stage 4 new mechanics
const s4 = stages[3];
assert(
  s4.platformKinds.includes('bouncepad') || s4.platformKinds.includes('fallblock'),
  'stage4 introduces bouncepad or fallblock',
  s4.platformKinds.join(',')
);

// Final stage: key + pobi rescue + gate
assert(final.specialTypes.includes('pobi_cage'), 'final stage has pobi_cage for rescue');
const finalStageObj = Stages.getStage(stages.length - 1);
assert(finalStageObj.needsKey === true, 'final stage requires a key (needsKey)');
const finalBuilt = finalStageObj.build();
const keyCount = finalBuilt.collectibles.filter((c) => c.type === 'key').length;
assert(keyCount === 1, 'final stage has exactly one key collectible', `keys=${keyCount}`);

// pobi_cage must be only on final stage
for (let i = 0; i < stages.length - 1; i++) {
  assert(!stages[i].specialTypes.includes('pobi_cage'), `stage ${i + 1} has no pobi_cage (only final)`);
}

// Ending path semantics
assert(Stages.getStage(0).id === 1, 'getStage(0) is stage 1');
assert(Stages.getStage(4).id === 5, 'getStage(4) is stage 5');
assert(finalStageObj.portal && finalStageObj.portal.x > 0, 'final stage has portal');
const finalStageIndex = Stages.stageCount() - 1;
assert(finalStageIndex === 4, 'final stage index is 4');
log('ENDING_PATH: clear stages 0..4 → 반란군 포비 rescue');

// --- Reachability screener + checkpoint safety ---
const STANDABLE = new Set(['ground', 'island', 'cloud', 'bouncepad', 'fallblock', 'moving']);
const SOLID_RESPAWN = new Set(['ground', 'island', 'cloud', 'bouncepad']); // where a respawn snap can land

for (let i = 0; i < stages.length; i++) {
  const stage = Stages.getStage(i);
  const built = stage.build();
  const plats = built.platforms.filter((p) => STANDABLE.has(p.kind));
  const sorted = [...plats].sort((a, b) => a.x - b.x);

  // Forward gap screener: consecutive-by-x platforms should not leave an
  // unbridgeable horizontal gap. Jump envelope (measured): level/drop ≤ ~300,
  // rise-heavy narrower. Use a lenient gate to catch gross authoring errors only.
  const badGaps = [];
  for (let k = 1; k < sorted.length; k++) {
    const prev = sorted[k - 1];
    const cur = sorted[k];
    const gap = cur.x - (prev.x + prev.w);
    if (gap <= 0) continue; // overlapping in x, always bridgeable
    const rise = prev.y - cur.y; // >0 means target is higher
    let maxGap = 300;
    if (rise > 150) maxGap = 200;
    else if (rise > 100) maxGap = 240;
    if (gap > maxGap) badGaps.push({ at: Math.round(cur.x), gap: Math.round(gap), rise: Math.round(rise) });
  }
  assert(
    badGaps.length === 0,
    `stage ${i + 1} has no unbridgeable forward gaps`,
    JSON.stringify(badGaps.slice(0, 6))
  );

  // Checkpoint safety: each checkpoint.x must sit over a solid respawn platform.
  const cps = stage.checkpoints || [];
  const unsafe = [];
  for (const cp of cps) {
    const sx = cp.x + 38; // player center-ish (w76 → +38)
    const overSolid = built.platforms.some(
      (p) => SOLID_RESPAWN.has(p.kind) && sx >= p.x && sx <= p.x + p.w
    );
    if (!overSolid) unsafe.push(cp.x);
  }
  assert(unsafe.length === 0, `stage ${i + 1} checkpoints are all over solid ground`, JSON.stringify(unsafe));

  // Spawn safety too
  const spawnX = stage.spawn.x + 38;
  const spawnSafe = built.platforms.some(
    (p) => SOLID_RESPAWN.has(p.kind) && spawnX >= p.x && spawnX <= p.x + p.w
  );
  assert(spawnSafe, `stage ${i + 1} spawn is over solid ground`, `spawnX=${stage.spawn.x}`);
}

// Asset check
const pobiPath = path.join(__dirname, '..', 'assets', 'pobi.png');
assert(fs.existsSync(pobiPath), 'pobi.png asset exists', pobiPath);
const stat = fs.statSync(pobiPath);
assert(stat.size > 1000, 'pobi.png has non-trivial size', `size=${stat.size}`);

log('');
log(`Results: ${passed} passed, ${failed} failed`);

const scratch = process.env.SCRATCH_DIR || path.join(__dirname, '..', '.test-out');
try {
  fs.mkdirSync(scratch, { recursive: true });
  fs.writeFileSync(path.join(scratch, 'stages-audit.txt'), logLines.join('\n') + '\n');
  fs.writeFileSync(
    path.join(scratch, 'ending-pobi.txt'),
    [
      'ENDING: After clearing all 5 stages, show 반란군 포비 rescue.',
      `finalStageIndex=${finalStageIndex}`,
      `pobiAsset=${pobiPath}`,
      `pobiBytes=${stat.size}`,
      `finalUnique=${final.newVsEarlier.join(',')}`,
      failed === 0 ? 'ENDING_OK' : 'ENDING_FAIL'
    ].join('\n') + '\n'
  );
} catch (e) {
  log('warn: scratch write failed: ' + e.message);
}

process.exit(failed > 0 ? 1 : 0);
