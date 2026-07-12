/**
 * Stage catalog audit + ending path structural checks.
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

assert(Stages.stageCount() === 3, 'exactly 3 stages', `count=${Stages.stageCount()}`);

const audit = Stages.auditStages();
log(JSON.stringify(audit, null, 2));

const s1 = audit.stages[0];
const s2 = audit.stages[1];
const s3 = audit.stages[3 - 1];

assert(s1.name && s2.name && s3.name, 'all stages have names');
assert(s1.name !== s2.name && s2.name !== s3.name, 'stage names are distinct');
assert(s1.worldW > 0 && s2.worldW > 0 && s3.worldW > 0, 'stages have world widths');

// Stage 2 unique elements not in stage 1
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

// Stage 3 challenge + unique
assert(s3.newVsEarlier.length > 0, 'stage3 introduces new elements');
assert(
  s3.hazardTypes.includes('thorn') || s3.platformKinds.includes('moving'),
  'stage3 has thorns or moving platforms'
);
assert(s3.enemyKinds.includes('shadow_bat'), 'stage3 has shadow_bat');
assert(s3.specialTypes.includes('pobi_cage'), 'stage3 has pobi_cage for rescue');
assert(
  s3.hazardCount >= s2.hazardCount || s3.enemyCount >= s2.enemyCount,
  'stage3 is denser (hazards or enemies)',
  `h3=${s3.hazardCount} h2=${s2.hazardCount} e3=${s3.enemyCount} e2=${s2.enemyCount}`
);
assert(s3.requiredVeggies >= s2.requiredVeggies, 'stage3 requires at least as many veggies');

// Ending path: stage progression semantics
assert(Stages.getStage(0).id === 1, 'getStage(0) is stage 1');
assert(Stages.getStage(2).id === 3, 'getStage(2) is stage 3');
assert(Stages.getStage(2).portal && Stages.getStage(2).portal.x > 0, 'stage3 has portal');

// Clear condition constants expected by game: after stage index 2 clear → Pobi ending
const finalStageIndex = Stages.stageCount() - 1;
assert(finalStageIndex === 2, 'final stage index is 2');
log('ENDING_PATH: clear stages 0,1,2 → 반란군 포비 rescue');

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
      'ENDING: After clearing all 3 stages, show 반란군 포비 rescue.',
      `finalStageIndex=${finalStageIndex}`,
      `pobiAsset=${pobiPath}`,
      `pobiBytes=${stat.size}`,
      `stage3Unique=${s3.newVsEarlier.join(',')}`,
      failed === 0 ? 'ENDING_OK' : 'ENDING_FAIL'
    ].join('\n') + '\n'
  );
} catch (e) {
  log('warn: scratch write failed: ' + e.message);
}

process.exit(failed > 0 ? 1 : 0);
