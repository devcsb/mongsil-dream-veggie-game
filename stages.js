/**
 * Stage definitions for Mongsil Dream Veggie Game.
 * Five discrete concept stages with rising difficulty and unique entities.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MongsilStages = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /** Deterministic 0..1 RNG so decor layout is stable across reloads. */
  function seededRnd(seed) {
    let s = seed >>> 0;
    return function next() {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  /**
   * Concept-specific ground + island micro-decor (visual only, no collision).
   * Makes aerial platforms and stage identity read clearly instead of empty pastel slabs.
   */
  function scatterConceptDecor(platforms, decor, concept, seed) {
    const rnd = seededRnd(seed);
    const pick = (arr) => arr[Math.floor(rnd() * arr.length) % arr.length];

    const groundTypes = {
      forest: ['tree', 'flower', 'mushroom', 'bush', 'sprout'],
      clouds: ['puff', 'crystal_shard', 'flower', 'sprout'],
      garden_challenge: ['bush', 'flower', 'mushroom', 'lantern', 'sprout'],
      factory: ['pipe', 'candy_stack', 'gear', 'sprout'],
      summit_finale: ['star_pillar', 'crystal_shard', 'nebula_bloom', 'lantern', 'sprout']
    };
    const islandTypes = {
      forest: ['flower', 'sprout', 'mushroom'],
      clouds: ['puff', 'crystal_shard', 'flower'],
      garden_challenge: ['flower', 'sprout', 'bush'],
      factory: ['candy_stack', 'gear', 'sprout'],
      summit_finale: ['crystal_shard', 'nebula_bloom', 'sprout']
    };
    const gTypes = groundTypes[concept] || groundTypes.forest;
    const iTypes = islandTypes[concept] || islandTypes.forest;

    const grounds = platforms.filter((p) => p.kind === 'ground');
    for (const g of grounds) {
      const stepBase = concept === 'factory' ? 150 : concept === 'summit_finale' ? 130 : 110;
      for (let x = g.x + 48; x < g.x + g.w - 48; x += stepBase + rnd() * 100) {
        const type = pick(gTypes);
        const tall = type === 'tree' || type === 'star_pillar' || type === 'pipe';
        decor.push({
          type,
          x: x + (rnd() - 0.5) * 24,
          y: g.y,
          s: tall ? 0.75 + rnd() * 0.85 : 0.45 + rnd() * 0.7,
          hue: rnd(),
          phase: rnd() * 6
        });
      }
    }

    for (const p of platforms) {
      if (p.kind === 'ground' || p.kind === 'moving') continue;
      // bounce/fall get a tiny visual marker only (non-blocking)
      if (p.kind === 'bouncepad' || p.kind === 'fallblock') {
        if (rnd() > 0.55) continue;
        decor.push({
          type: p.kind === 'bouncepad' ? 'sprout' : 'gear',
          x: p.x + p.w * 0.5,
          y: p.y,
          s: 0.32 + rnd() * 0.2,
          hue: rnd(),
          phase: rnd() * 6
        });
        continue;
      }
      if (p.w < 90 || rnd() > 0.48) continue;
      const type = pick(iTypes);
      decor.push({
        type,
        x: p.x + p.w * (0.28 + rnd() * 0.44),
        y: p.y,
        s: 0.38 + rnd() * 0.4,
        hue: rnd(),
        phase: rnd() * 6
      });
    }
  }

  /**
   * Stage catalog.
   * uniqueElements: entity/feature types introduced at this stage (not in earlier stages).
   */
  const STAGES = [
    {
      id: 1,
      key: 'lilac-dew',
      name: '라일락 이슬숲',
      blurb: '부드러운 이슬 길. 수정과 웅덩이를 피해 채소를 모아요.',
      worldW: 5000,
      requiredVeggies: 6,
      spawn: { x: 140, y: 350 },
      portal: { x: 4680, y: 410, w: 125, h: 190 },
      checkpoints: [
        { x: 130, trigger: 0 },
        { x: 2100, trigger: 2050 },
        { x: 4400, trigger: 4340 }
      ],
      palette: {
        name: '라일락 이슬숲',
        skyTop: '#291640', skyBottom: '#9f76d1',
        glow: '#ffc0ec', far: '#5b3e86', mid: '#6f55a3',
        groundTop: '#d7b3ff', groundBody: '#72519b', groundDark: '#3f2b61',
        accent: '#9ff3ff'
      },
      uniqueElements: ['crystal', 'puddle', 'mushroom_patrol'],
      concept: 'forest',
      // layout builders return plain data arrays
      build() {
        const platforms = [];
        const hazards = [];
        const collectibles = [];
        const enemies = [];
        const decor = [];

        const ground = (x, w, y = 600) => platforms.push({ x, y, w, h: 180, kind: 'ground' });
        const isle = (x, y, w, h = 34) => platforms.push({ x, y, w, h, kind: 'island' });
        const hazard = (type, x, y, w = 78, h = 54) =>
          hazards.push({ type, x, y, w, h, pulse: Math.random() * Math.PI * 2 });
        const veg = (type, x, y) =>
          collectibles.push({ type, x, y, r: 27, collected: false, phase: Math.random() * Math.PI * 2 });
        const enemy = (x, y, minX, maxX, speed = 56, kind = 'mushroom_patrol') =>
          enemies.push({
            x, y, w: 62, h: 50, minX, maxX, speed,
            dir: Math.random() > 0.5 ? 1 : -1,
            alive: true,
            phase: Math.random() * 6,
            kind
          });

        ground(0, 1500);
        ground(1700, 1100);
        ground(3000, 2000);

        [
          [480, 500, 220], [860, 420, 210], [1200, 500, 200],
          [1580, 460, 180], [1920, 400, 200], [2280, 480, 220],
          [2620, 390, 200], [2980, 470, 190], [3340, 400, 210],
          [3620, 500, 200], [3960, 460, 190], [4260, 380, 200],
          [4600, 460, 180]
        ].forEach(([x, y, w]) => isle(x, y, w));

        [
          ['crystal', 980, 546, 86, 54],
          ['puddle', 1380, 568, 110, 32],
          ['puddle', 2520, 568, 108, 32],
          ['crystal', 3180, 546, 90, 54],
          ['puddle', 3550, 568, 100, 32]
        ].forEach(([type, x, y, w, h]) => hazard(type, x, y, w, h));

        [
          ['lettuce', 320, 545], ['cabbage', 580, 445], ['carrot', 960, 365],
          ['lettuce', 1320, 445], ['radish', 1720, 405], ['cabbage', 2100, 345],
          ['lettuce', 2480, 425], ['carrot', 2840, 335], ['cabbage', 3200, 415],
          ['lettuce', 3560, 445], ['radish', 3800, 545], ['cabbage', 4000, 545]
        ].forEach(([type, x, y]) => veg(type, x, y));

        enemy(700, 550, 640, 980, 54);
        enemy(2000, 550, 1880, 2360, 58);
        enemy(3200, 550, 3080, 3520, 60);

        scatterConceptDecor(platforms, decor, 'forest', 11001);
        // Landmark trees bookend the first gap so the pit reads as a forest ravine
        decor.push(
          { type: 'tree', x: 1450, y: 600, s: 1.35, hue: 0.2, phase: 1.1 },
          { type: 'tree', x: 1760, y: 600, s: 1.2, hue: 0.65, phase: 2.4 }
        );

        return { platforms, hazards, collectibles, enemies, decor };
      }
    },
    {
      id: 2,
      key: 'cotton-crystal',
      name: '솜사탕 수정구름',
      blurb: '구름 발판과 바람 구역이 나타나요. 공중 점프 보정이 중요해요.',
      worldW: 5600,
      requiredVeggies: 8,
      spawn: { x: 140, y: 350 },
      portal: { x: 5280, y: 410, w: 125, h: 190 },
      checkpoints: [
        { x: 130, trigger: 0 },
        { x: 2200, trigger: 2140 },
        { x: 4700, trigger: 4640 }
      ],
      palette: {
        name: '솜사탕 수정구름',
        skyTop: '#31204d', skyBottom: '#8cc8df',
        glow: '#ffd1ec', far: '#715aa2', mid: '#6f86b4',
        groundTop: '#c5eaff', groundBody: '#8067ae', groundDark: '#46346d',
        accent: '#ffc2e8'
      },
      // New vs stage 1: cloud platforms, wind zones, sleep_cloud enemies
      uniqueElements: ['cloud', 'wind', 'sleep_cloud'],
      concept: 'clouds',
      build() {
        const platforms = [];
        const hazards = [];
        const collectibles = [];
        const enemies = [];
        const decor = [];
        const specials = []; // wind zones etc.

        const ground = (x, w, y = 600) => platforms.push({ x, y, w, h: 180, kind: 'ground' });
        const isle = (x, y, w, h = 34, kind = 'island') => platforms.push({ x, y, w, h, kind });
        const hazard = (type, x, y, w = 78, h = 54) =>
          hazards.push({ type, x, y, w, h, pulse: Math.random() * Math.PI * 2 });
        const veg = (type, x, y) =>
          collectibles.push({ type, x, y, r: 27, collected: false, phase: Math.random() * Math.PI * 2 });
        const enemy = (x, y, minX, maxX, speed = 64, kind = 'sleep_cloud') =>
          enemies.push({
            x, y, w: kind === 'sleep_cloud' ? 70 : 62,
            h: kind === 'sleep_cloud' ? 48 : 50,
            minX, maxX, speed,
            dir: Math.random() > 0.5 ? 1 : -1,
            alive: true,
            phase: Math.random() * 6,
            kind
          });

        // Fragmented ground — more air time than stage 1
        ground(0, 900);
        ground(1200, 700);
        ground(2400, 650);
        ground(3600, 2000);

        // Cloud platforms (unique stage 2)
        [
          [420, 470, 200, 'cloud'], [780, 390, 180, 'cloud'], [1050, 480, 160, 'cloud'],
          [1480, 430, 190, 'cloud'], [1780, 340, 170, 'cloud'], [2080, 450, 180, 'cloud'],
          [2550, 400, 200, 'cloud'], [2900, 320, 180, 'cloud'], [3200, 430, 170, 'cloud'],
          [3550, 360, 190, 'cloud'], [3900, 470, 180, 'cloud'], [4120, 500, 160, 'island'],
          [4400, 430, 190, 'cloud'], [4700, 350, 180, 'cloud'], [5000, 460, 170, 'cloud'],
          [5300, 400, 160, 'cloud']
        ].forEach(([x, y, w, kind]) => isle(x, y, w, 30, kind));

        // Wind zones push player (unique)
        specials.push(
          { type: 'wind', x: 900, y: 200, w: 280, h: 380, forceX: 140, forceY: -40 },
          { type: 'wind', x: 2000, y: 180, w: 320, h: 400, forceX: -90, forceY: -80 },
          { type: 'wind', x: 3100, y: 160, w: 300, h: 420, forceX: 160, forceY: -50 }
        );

        [
          ['crystal', 620, 546, 80, 54],
          ['crystal', 1050, 430, 76, 50],
          ['puddle', 1500, 568, 100, 32],
          ['crystal', 2680, 546, 86, 54],
          ['puddle', 2930, 568, 100, 32],
          ['crystal', 3260, 382, 70, 48],
          ['puddle', 3720, 568, 110, 32]
        ].forEach(([type, x, y, w, h]) => hazard(type, x, y, w, h));

        [
          ['lettuce', 300, 545], ['cabbage', 520, 415], ['carrot', 860, 335],
          ['radish', 1180, 425], ['lettuce', 1600, 375], ['cabbage', 1900, 285],
          ['carrot', 2240, 395], ['lettuce', 2680, 345], ['radish', 3020, 265],
          ['cabbage', 3340, 375], ['carrot', 3680, 305], ['lettuce', 4000, 415],
          ['radish', 4850, 545], ['cabbage', 5150, 545]
        ].forEach(([type, x, y]) => veg(type, x, y));

        enemy(500, 550, 420, 780, 62, 'sleep_cloud');
        enemy(1600, 550, 1480, 1880, 70, 'sleep_cloud');
        enemy(2700, 550, 2560, 3000, 68, 'mushroom_patrol');
        enemy(3800, 550, 3680, 4200, 74, 'sleep_cloud');
        enemy(4900, 550, 4800, 5300, 78, 'sleep_cloud');

        scatterConceptDecor(platforms, decor, 'clouds', 22002);
        // Crystal spires mark wind corridor entrances for spatial reading
        decor.push(
          { type: 'crystal_shard', x: 880, y: 600, s: 1.1, hue: 0.3, phase: 0.4 },
          { type: 'crystal_shard', x: 2050, y: 600, s: 1.0, hue: 0.7, phase: 1.8 },
          { type: 'crystal_shard', x: 3150, y: 600, s: 1.15, hue: 0.45, phase: 2.9 }
        );

        return { platforms, hazards, collectibles, enemies, decor, specials };
      }
    },
    {
      id: 3,
      key: 'moonlit-garden',
      name: '달빛 채소정원',
      blurb: '가시덤불과 그림자 박쥐, 움직이는 발판을 넘어 채소를 모아요.',
      worldW: 6200,
      requiredVeggies: 10,
      spawn: { x: 140, y: 350 },
      portal: { x: 5880, y: 410, w: 125, h: 190 },
      checkpoints: [
        { x: 130, trigger: 0 },
        { x: 1980, trigger: 1900 },
        { x: 3300, trigger: 3240 },
        { x: 5200, trigger: 5140 }
      ],
      palette: {
        name: '달빛 채소정원',
        skyTop: '#181630', skyBottom: '#9b5e9d',
        glow: '#ffc7e7', far: '#493a78', mid: '#66508e',
        groundTop: '#e2b9ee', groundBody: '#775083', groundDark: '#3d2b56',
        accent: '#b8f8dc'
      },
      // New vs 1–2: thorns, moving platforms, shadow_bat
      uniqueElements: ['thorn', 'moving', 'shadow_bat'],
      concept: 'garden_challenge',
      build() {
        const platforms = [];
        const hazards = [];
        const collectibles = [];
        const enemies = [];
        const decor = [];
        const specials = [];
        const movers = [];

        const ground = (x, w, y = 600) => platforms.push({ x, y, w, h: 180, kind: 'ground' });
        const isle = (x, y, w, h = 34, kind = 'island') => platforms.push({ x, y, w, h, kind });
        const hazard = (type, x, y, w = 78, h = 54) =>
          hazards.push({ type, x, y, w, h, pulse: Math.random() * Math.PI * 2 });
        const veg = (type, x, y) =>
          collectibles.push({ type, x, y, r: 27, collected: false, phase: Math.random() * Math.PI * 2 });
        const enemy = (x, y, minX, maxX, speed = 80, kind = 'shadow_bat') =>
          enemies.push({
            x, y,
            w: kind === 'shadow_bat' ? 58 : 62,
            h: kind === 'shadow_bat' ? 40 : 50,
            minX, maxX, speed,
            dir: Math.random() > 0.5 ? 1 : -1,
            alive: true,
            phase: Math.random() * 6,
            kind,
            baseY: y
          });

        // Sparse, punishing ground gaps
        ground(0, 700);
        ground(1000, 520);
        ground(1900, 480);
        ground(2800, 450);
        ground(3700, 500);
        ground(4500, 1700);

        // Tight island chain
        [
          [380, 500, 150], [620, 420, 130], [860, 500, 140],
          [1180, 450, 150], [1450, 360, 130], [1680, 470, 140],
          [2100, 430, 130], [2350, 340, 120], [2580, 450, 140],
          [3000, 400, 130], [3240, 310, 120], [3480, 420, 140],
          [3920, 380, 130], [4160, 300, 120], [4400, 450, 150],
          [4680, 500, 140], [4980, 420, 130], [5220, 340, 120],
          [5460, 450, 140], [5700, 380, 130], [5940, 300, 120]
        ].forEach(([x, y, w]) => isle(x, y, w));

        // Moving platforms (unique challenge)
        movers.push(
          { x: 780, y: 360, w: 140, h: 28, kind: 'moving', minX: 720, maxX: 980, speed: 70, dir: 1, axis: 'x' },
          { x: 1600, y: 300, w: 130, h: 28, kind: 'moving', minY: 260, maxY: 420, speed: 55, dir: 1, axis: 'y', minX: 1600, maxX: 1600 },
          { x: 2500, y: 280, w: 140, h: 28, kind: 'moving', minX: 2420, maxX: 2720, speed: 85, dir: -1, axis: 'x' },
          { x: 3600, y: 320, w: 130, h: 28, kind: 'moving', minX: 3520, maxX: 3900, speed: 90, dir: 1, axis: 'x' }
        );
        movers.forEach((m) => platforms.push(m));

        // Dense hazards: crystals, puddles, thorns (new)
        [
          ['crystal', 500, 546, 82, 54],
          ['thorn', 380, 562, 90, 38],
          ['puddle', 1120, 568, 100, 32],
          ['thorn', 1320, 562, 95, 38],
          ['crystal', 1750, 416, 78, 54],
          ['crystal', 2280, 552, 64, 48],
          ['thorn', 2810, 562, 100, 38],
          ['puddle', 2920, 568, 110, 32],
          ['thorn', 3180, 562, 92, 38],
          ['crystal', 3700, 546, 86, 54],
          ['thorn', 3800, 562, 100, 38],
          ['thorn', 4820, 562, 95, 38],
          ['crystal', 4600, 546, 88, 54]
        ].forEach(([type, x, y, w, h]) => hazard(type, x, y, w, h));

        // Wind + dark mist specials
        specials.push(
          { type: 'wind', x: 1400, y: 150, w: 260, h: 420, forceX: 180, forceY: -30 },
          { type: 'wind', x: 3200, y: 140, w: 280, h: 430, forceX: -150, forceY: -60 }
        );

        [
          ['lettuce', 280, 545], ['cabbage', 480, 445], ['carrot', 700, 365],
          ['radish', 980, 445], ['lettuce', 1280, 395], ['cabbage', 1550, 305],
          ['carrot', 1820, 415], ['lettuce', 2200, 375], ['radish', 2460, 285],
          ['cabbage', 2720, 395], ['carrot', 3080, 345], ['lettuce', 3340, 255],
          ['radish', 3600, 365], ['cabbage', 4000, 325], ['carrot', 4240, 245],
          ['lettuce', 4520, 395], ['radish', 4720, 445], ['cabbage', 5000, 545]
        ].forEach(([type, x, y]) => veg(type, x, y));

        enemy(450, 550, 380, 640, 72, 'mushroom_patrol');
        enemy(1200, 400, 1100, 1500, 95, 'shadow_bat');
        enemy(2100, 380, 2000, 2480, 95, 'shadow_bat');
        enemy(2900, 550, 2800, 3200, 78, 'sleep_cloud');
        enemy(3700, 360, 3600, 4100, 100, 'shadow_bat');
        enemy(4600, 550, 4520, 4850, 80, 'mushroom_patrol');

        scatterConceptDecor(platforms, decor, 'garden_challenge', 33003);
        // Garden lanterns at checkpoints reinforce safe resting spots
        decor.push(
          { type: 'lantern', x: 1980, y: 600, s: 1.05, hue: 0.55, phase: 0.2 },
          { type: 'lantern', x: 3300, y: 600, s: 1.0, hue: 0.4, phase: 1.5 },
          { type: 'lantern', x: 5200, y: 600, s: 1.1, hue: 0.7, phase: 2.7 }
        );

        return { platforms, hazards, collectibles, enemies, decor, specials };
      }
    },
    {
      id: 4,
      key: 'sunset-factory',
      name: '노을 사탕공장',
      blurb: '노을 지는 사탕공장, 탄성 발판과 무너지는 다리를 넘어가요.',
      worldW: 6800,
      requiredVeggies: 12,
      spawn: { x: 140, y: 350 },
      portal: { x: 6480, y: 410, w: 125, h: 190 },
      checkpoints: [
        { x: 130, trigger: 0 },
        { x: 2000, trigger: 1950 },
        { x: 4910, trigger: 4850 },
        { x: 6100, trigger: 6040 }
      ],
      palette: {
        name: '노을 사탕공장',
        skyTop: '#3a1f2e', skyBottom: '#f2a65a',
        glow: '#ffd9a0', far: '#7a4a5e', mid: '#b5687a',
        groundTop: '#ffd9a0', groundBody: '#c47a6a', groundDark: '#5a2f3a',
        accent: '#ff8fb0'
      },
      // New vs 1–3: bouncepad, fallblock (no new enemy kind)
      uniqueElements: ['bouncepad', 'fallblock'],
      concept: 'factory',
      build() {
        const platforms = [];
        const hazards = [];
        const collectibles = [];
        const enemies = [];
        const decor = [];

        const ground = (x, w, y = 600) => platforms.push({ x, y, w, h: 180, kind: 'ground' });
        const isle = (x, y, w, h = 34, kind = 'island') => platforms.push({ x, y, w, h, kind });
        const bouncepad = (x, y, w) => platforms.push({ x, y, w, h: 28, kind: 'bouncepad' });
        const fallblock = (x, y, w) =>
          platforms.push({ x, y, w, h: 28, kind: 'fallblock', homeY: y, triggered: false, fallTimer: 0, vy: 0, gone: false });
        const hazard = (type, x, y, w = 78, h = 54) =>
          hazards.push({ type, x, y, w, h, pulse: Math.random() * Math.PI * 2 });
        const veg = (type, x, y) =>
          collectibles.push({ type, x, y, r: 27, collected: false, phase: Math.random() * Math.PI * 2 });
        const enemy = (x, y, minX, maxX, speed = 70, kind = 'mushroom_patrol') =>
          enemies.push({
            x, y,
            w: kind === 'shadow_bat' ? 58 : 62,
            h: kind === 'shadow_bat' ? 40 : 50,
            minX, maxX, speed,
            dir: Math.random() > 0.5 ? 1 : -1,
            alive: true,
            phase: Math.random() * 6,
            kind,
            baseY: y
          });

        // Main ground segments
        ground(0, 900);
        ground(1150, 550);
        ground(2000, 500);
        ground(2850, 550);
        ground(3650, 500);
        // (fallblock gauntlet bridges 4150 -> 4910, no solid ground beneath)
        ground(4910, 550);
        ground(6100, 700);

        // Bridge islands over the two wider ground gaps
        isle(1850, 520, 150);
        isle(2650, 540, 160);

        // Bouncepad #1: bonus reach near tail of ground(1150-1700)
        bouncepad(1560, 600, 150);
        isle(1590, 380, 170);

        // Bouncepad #2: bonus reach near tail of ground(2850-3400)
        bouncepad(3220, 600, 150);
        isle(3250, 370, 170);

        // Fallblock gauntlet across the 4150-4910 chasm
        fallblock(4150, 600, 130);
        fallblock(4360, 600, 130);
        fallblock(4570, 600, 130);
        fallblock(4780, 600, 130);

        // Bouncepad #3 + descending island chain across the final 640px gap
        bouncepad(5300, 600, 150);
        isle(5320, 330, 180);
        isle(5620, 380, 160);
        isle(5850, 450, 150);
        isle(6050, 520, 140);

        [
          ['crystal', 420, 546, 82, 54],
          ['puddle', 750, 568, 100, 32],
          ['crystal', 1250, 546, 84, 54],
          ['thorn', 1450, 562, 90, 38],
          ['puddle', 2100, 568, 105, 32],
          ['crystal', 2350, 546, 82, 54],
          ['thorn', 2950, 562, 92, 38],
          ['puddle', 3150, 568, 100, 32],
          ['crystal', 3750, 546, 86, 54],
          ['thorn', 3950, 562, 88, 38],
          ['crystal', 5050, 546, 84, 54],
          ['puddle', 5150, 568, 100, 32],
          ['crystal', 6250, 546, 86, 54],
          ['thorn', 6450, 562, 92, 38],
          ['puddle', 6600, 568, 100, 32],
          ['crystal', 6700, 546, 82, 54]
        ].forEach(([type, x, y, w, h]) => hazard(type, x, y, w, h));

        [
          ['lettuce', 300, 545], ['cabbage', 600, 545], ['carrot', 1200, 545],
          ['radish', 1650, 325], ['lettuce', 1900, 465], ['cabbage', 2100, 545],
          ['carrot', 2350, 545], ['radish', 2680, 485], ['lettuce', 2900, 545],
          ['cabbage', 3320, 315], ['carrot', 3300, 545], ['radish', 3750, 545],
          ['lettuce', 4000, 545], ['cabbage', 4360, 545], ['carrot', 5000, 545],
          ['lettuce', 5200, 545], ['radish', 5350, 275], ['cabbage', 5650, 325],
          ['carrot', 5880, 395], ['radish', 6250, 545]
        ].forEach(([type, x, y]) => veg(type, x, y));

        enemy(500, 550, 420, 780, 78, 'mushroom_patrol');
        enemy(1400, 550, 1300, 1650, 82, 'sleep_cloud');
        enemy(1900, 450, 1800, 2100, 102, 'shadow_bat');
        enemy(3000, 550, 2900, 3350, 82, 'mushroom_patrol');
        enemy(3900, 550, 3700, 4100, 88, 'sleep_cloud');
        enemy(5700, 400, 5600, 5950, 105, 'shadow_bat');
        enemy(6300, 550, 6150, 6500, 80, 'mushroom_patrol');

        scatterConceptDecor(platforms, decor, 'factory', 44004);
        // Factory landmarks: pipes frame the fallblock gauntlet so the chasm reads industrial
        decor.push(
          { type: 'pipe', x: 4050, y: 600, s: 1.25, hue: 0.2, phase: 0.3 },
          { type: 'pipe', x: 4960, y: 600, s: 1.15, hue: 0.55, phase: 1.1 },
          { type: 'candy_stack', x: 5300, y: 600, s: 1.0, hue: 0.8, phase: 2.0 },
          { type: 'gear', x: 1600, y: 600, s: 0.95, hue: 0.4, phase: 0.8 }
        );

        return { platforms, hazards, collectibles, enemies, decor };
      }
    },
    {
      id: 5,
      key: 'galaxy-summit',
      name: '은하 꿈길 정상',
      needsKey: true,
      blurb: '은하 정상에서 열쇠를 찾아 반란군 포비를 구출하세요.',
      worldW: 7600,
      requiredVeggies: 14,
      spawn: { x: 140, y: 350 },
      portal: { x: 7420, y: 410, w: 125, h: 190 },
      checkpoints: [
        { x: 130, trigger: 0 },
        { x: 1950, trigger: 1900 },
        { x: 3650, trigger: 3600 },
        { x: 5350, trigger: 5300 },
        { x: 7050, trigger: 6990 }
      ],
      palette: {
        name: '은하 꿈길 정상',
        skyTop: '#0d1030', skyBottom: '#5b4b9d',
        glow: '#cfe3ff', far: '#2a2a5e', mid: '#4a4a8e',
        groundTop: '#cfe3ff', groundBody: '#5a5aa0', groundDark: '#25254a',
        accent: '#9ff0d8'
      },
      // New vs 1–4: key (collectible), pobi_cage (finale prop)
      uniqueElements: ['key', 'pobi_cage'],
      concept: 'summit_finale',
      build() {
        const platforms = [];
        const hazards = [];
        const collectibles = [];
        const enemies = [];
        const decor = [];
        const specials = [];
        const movers = [];

        const ground = (x, w, y = 600) => platforms.push({ x, y, w, h: 180, kind: 'ground' });
        const isle = (x, y, w, h = 34, kind = 'island') => platforms.push({ x, y, w, h, kind });
        const hazard = (type, x, y, w = 78, h = 54) =>
          hazards.push({ type, x, y, w, h, pulse: Math.random() * Math.PI * 2 });
        const veg = (type, x, y) =>
          collectibles.push({ type, x, y, r: 27, collected: false, phase: Math.random() * Math.PI * 2 });
        const key = (x, y) =>
          collectibles.push({ type: 'key', x, y, r: 27, collected: false, phase: Math.random() * Math.PI * 2 });
        const enemy = (x, y, minX, maxX, speed = 80, kind = 'shadow_bat') =>
          enemies.push({
            x, y,
            w: kind === 'shadow_bat' ? 58 : 62,
            h: kind === 'shadow_bat' ? 40 : 50,
            minX, maxX, speed,
            dir: Math.random() > 0.5 ? 1 : -1,
            alive: true,
            phase: Math.random() * 6,
            kind,
            baseY: y
          });

        // Main ground segments
        ground(0, 850);
        ground(1100, 550);
        ground(1950, 500);
        ground(2800, 500);
        ground(3650, 500);
        ground(4500, 550);
        ground(5350, 500);
        ground(6200, 550);
        // Finale plaza: long safe approach for shrine (key → cage → portal)
        ground(7050, 700);

        // Bridge islands over the wider ground gaps
        isle(1780, 520, 180);
        isle(2600, 540, 170);
        isle(3450, 530, 170);
        isle(4300, 520, 170);
        isle(5180, 510, 160);
        isle(6000, 530, 170);
        isle(6880, 520, 160);
        // Aerial path islands (summit altitude chain)
        isle(2100, 360, 140);
        isle(2450, 300, 130);
        isle(3100, 340, 150);
        isle(4800, 300, 140);
        isle(5600, 340, 150);

        // Moving platforms (reused challenge element)
        movers.push(
          { x: 2200, y: 350, w: 140, h: 28, kind: 'moving', minX: 2150, maxX: 2400, speed: 90, dir: 1, axis: 'x' },
          { x: 5000, y: 320, w: 130, h: 28, kind: 'moving', minY: 280, maxY: 420, speed: 60, dir: 1, axis: 'y', minX: 5000, maxX: 5000 }
        );
        movers.forEach((m) => platforms.push(m));

        [
          ['crystal', 400, 546, 84, 54],
          ['puddle', 700, 568, 100, 32],
          ['crystal', 1250, 546, 82, 54],
          ['thorn', 1450, 562, 90, 38],
          ['puddle', 2050, 568, 104, 32],
          ['crystal', 2250, 546, 84, 54],
          ['thorn', 2900, 562, 92, 38],
          ['puddle', 3100, 568, 100, 32],
          ['crystal', 3750, 546, 86, 54],
          ['thorn', 3950, 562, 88, 38],
          ['puddle', 4550, 568, 102, 32],
          ['crystal', 4750, 546, 84, 54],
          ['thorn', 4900, 562, 90, 38],
          ['puddle', 5450, 568, 100, 32],
          ['crystal', 5650, 546, 86, 54],
          ['thorn', 6250, 562, 92, 38],
          ['puddle', 6450, 568, 100, 32],
          ['crystal', 6670, 546, 70, 50],
          // Keep hazards clear of shrine plaza (7050+)
          ['puddle', 6900, 568, 90, 32]
        ].forEach(([type, x, y, w, h]) => hazard(type, x, y, w, h));

        [
          ['lettuce', 250, 545], ['cabbage', 600, 545], ['carrot', 1200, 545],
          ['radish', 1550, 545], ['lettuce', 1850, 465], ['cabbage', 2100, 545],
          // Aerial veggies reward high path
          ['carrot', 2160, 305], ['radish', 2510, 245], ['lettuce', 3160, 285],
          ['cabbage', 3200, 545], ['carrot', 3520, 475], ['radish', 3800, 545],
          ['lettuce', 4050, 545], ['cabbage', 4380, 465], ['carrot', 4650, 545],
          ['radish', 4860, 245], ['lettuce', 5250, 455], ['cabbage', 5500, 545],
          ['carrot', 5660, 285], ['radish', 6080, 475], ['lettuce', 6350, 545],
          ['cabbage', 6600, 545], ['carrot', 6950, 465], ['radish', 7120, 545]
        ].forEach(([type, x, y]) => veg(type, x, y));

        // Key sits on shrine approach — clear of hazards, before cage
        key(7180, 545);

        enemy(500, 550, 420, 780, 88, 'mushroom_patrol');
        enemy(1350, 550, 1150, 1600, 93, 'sleep_cloud');
        enemy(1850, 420, 1750, 2100, 110, 'shadow_bat');
        enemy(2150, 550, 2000, 2400, 90, 'mushroom_patrol');
        enemy(3000, 550, 2850, 3250, 95, 'sleep_cloud');
        enemy(3900, 380, 3700, 4100, 113, 'shadow_bat');
        enemy(4700, 550, 4550, 5000, 92, 'mushroom_patrol');
        enemy(6400, 400, 6250, 6700, 115, 'shadow_bat');

        // Shrine layout: pillars → key → cage → portal (no overlap)
        // cage centered between key and portal on the plaza
        specials.push({ type: 'pobi_cage', x: 7260, y: 430, w: 100, h: 170 });

        scatterConceptDecor(platforms, decor, 'summit_finale', 55005);
        decor.push(
          { type: 'star_pillar', x: 7100, y: 600, s: 1.35, hue: 0.25, phase: 0.5 },
          { type: 'star_pillar', x: 7380, y: 600, s: 1.25, hue: 0.75, phase: 1.8 },
          { type: 'nebula_bloom', x: 7220, y: 600, s: 0.95, hue: 0.5, phase: 2.2 },
          { type: 'crystal_shard', x: 7320, y: 600, s: 0.9, hue: 0.6, phase: 0.9 },
          { type: 'lantern', x: 7160, y: 600, s: 0.85, hue: 0.4, phase: 1.2 }
        );

        return { platforms, hazards, collectibles, enemies, decor, specials };
      }
    }
  ];

  function getStage(index) {
    const i = Math.max(0, Math.min(STAGES.length - 1, index));
    return STAGES[i];
  }

  function stageCount() {
    return STAGES.length;
  }

  /** Elements present in stage N that do not appear in any earlier stage. */
  function uniqueToStage(stageIndex) {
    const earlier = new Set();
    for (let i = 0; i < stageIndex; i++) {
      STAGES[i].uniqueElements.forEach((e) => earlier.add(e));
    }
    return STAGES[stageIndex].uniqueElements.filter((e) => !earlier.has(e));
  }

  function auditStages() {
    const report = {
      count: STAGES.length,
      stages: STAGES.map((s, i) => {
        const built = s.build();
        return {
          id: s.id,
          key: s.key,
          name: s.name,
          worldW: s.worldW,
          requiredVeggies: s.requiredVeggies,
          uniqueElements: s.uniqueElements,
          newVsEarlier: uniqueToStage(i),
          platformCount: built.platforms.length,
          hazardCount: built.hazards.length,
          enemyCount: built.enemies.length,
          veggieCount: built.collectibles.length,
          hazardTypes: [...new Set(built.hazards.map((h) => h.type))],
          enemyKinds: [...new Set(built.enemies.map((e) => e.kind))],
          platformKinds: [...new Set(built.platforms.map((p) => p.kind))],
          specialTypes: [...new Set((built.specials || []).map((sp) => sp.type))]
        };
      })
    };
    return report;
  }

  return {
    STAGES,
    getStage,
    stageCount,
    uniqueToStage,
    auditStages
  };
});
