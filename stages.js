/**
 * Stage definitions for Mongsil Dream Veggie Game.
 * Three discrete concept stages with rising difficulty and unique entities.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MongsilStages = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

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
      worldW: 4200,
      requiredVeggies: 6,
      spawn: { x: 140, y: 350 },
      portal: { x: 3920, y: 410, w: 125, h: 190 },
      checkpoints: [
        { x: 130, trigger: 0 },
        { x: 2100, trigger: 2050 }
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
        ground(3000, 1200);

        [
          [480, 500, 220], [860, 420, 210], [1200, 500, 200],
          [1580, 460, 180], [1920, 400, 200], [2280, 480, 220],
          [2620, 390, 200], [2980, 470, 190], [3340, 400, 210],
          [3620, 500, 200]
        ].forEach(([x, y, w]) => isle(x, y, w));

        [
          ['crystal', 980, 546, 86, 54],
          ['puddle', 1380, 568, 110, 32],
          ['crystal', 2100, 546, 88, 54],
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

        for (let x = 240; x < 4100; x += 320 + Math.random() * 160) {
          decor.push({
            type: Math.random() < 0.55 ? 'flower' : Math.random() < 0.7 ? 'mushroom' : 'sprout',
            x, y: 600, s: 0.55 + Math.random() * 0.85, hue: Math.random(), phase: Math.random() * 6
          });
        }

        return { platforms, hazards, collectibles, enemies, decor };
      }
    },
    {
      id: 2,
      key: 'cotton-crystal',
      name: '솜사탕 수정구름',
      blurb: '구름 발판과 바람 구역이 나타나요. 공중 점프 보정이 중요해요.',
      worldW: 4600,
      requiredVeggies: 8,
      spawn: { x: 140, y: 350 },
      portal: { x: 4300, y: 410, w: 125, h: 190 },
      checkpoints: [
        { x: 130, trigger: 0 },
        { x: 2300, trigger: 2240 }
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
        ground(3600, 1000);

        // Cloud platforms (unique stage 2)
        [
          [420, 470, 200, 'cloud'], [780, 390, 180, 'cloud'], [1050, 480, 160, 'cloud'],
          [1480, 430, 190, 'cloud'], [1780, 340, 170, 'cloud'], [2080, 450, 180, 'cloud'],
          [2550, 400, 200, 'cloud'], [2900, 320, 180, 'cloud'], [3200, 430, 170, 'cloud'],
          [3550, 360, 190, 'cloud'], [3900, 470, 180, 'cloud'], [4120, 500, 160, 'island']
        ].forEach(([x, y, w, kind]) => isle(x, y, w, 30, kind));

        // Wind zones push player (unique)
        specials.push(
          { type: 'wind', x: 900, y: 200, w: 280, h: 380, forceX: 140, forceY: -40 },
          { type: 'wind', x: 2000, y: 180, w: 320, h: 400, forceX: -90, forceY: -80 },
          { type: 'wind', x: 3100, y: 160, w: 300, h: 420, forceX: 160, forceY: -50 }
        );

        [
          ['crystal', 620, 546, 80, 54],
          ['puddle', 1500, 568, 100, 32],
          ['crystal', 2680, 546, 86, 54],
          ['crystal', 3360, 286, 70, 48],
          ['puddle', 3720, 568, 110, 32]
        ].forEach(([type, x, y, w, h]) => hazard(type, x, y, w, h));

        [
          ['lettuce', 300, 545], ['cabbage', 520, 415], ['carrot', 860, 335],
          ['radish', 1180, 425], ['lettuce', 1600, 375], ['cabbage', 1900, 285],
          ['carrot', 2240, 395], ['lettuce', 2680, 345], ['radish', 3020, 265],
          ['cabbage', 3340, 375], ['carrot', 3680, 305], ['lettuce', 4000, 415],
          ['radish', 4200, 545], ['cabbage', 4400, 545]
        ].forEach(([type, x, y]) => veg(type, x, y));

        enemy(500, 550, 420, 780, 62, 'sleep_cloud');
        enemy(1600, 550, 1480, 1880, 70, 'sleep_cloud');
        enemy(2700, 550, 2560, 3000, 68, 'mushroom_patrol');
        enemy(3800, 550, 3680, 4200, 74, 'sleep_cloud');

        for (let x = 200; x < 4500; x += 280 + Math.random() * 140) {
          decor.push({
            type: Math.random() < 0.4 ? 'flower' : 'sprout',
            x, y: 600, s: 0.5 + Math.random() * 0.7, hue: Math.random(), phase: Math.random() * 6
          });
        }

        return { platforms, hazards, collectibles, enemies, decor, specials };
      }
    },
    {
      id: 3,
      key: 'moonlit-garden',
      name: '달빛 채소정원',
      blurb: '반란군 포비를 구출하세요. 가시와 그림자 박쥐, 움직이는 발판이 기다립니다.',
      worldW: 5200,
      requiredVeggies: 10,
      spawn: { x: 140, y: 350 },
      portal: { x: 4880, y: 410, w: 125, h: 190 },
      checkpoints: [
        { x: 130, trigger: 0 },
        { x: 1800, trigger: 1740 },
        { x: 3400, trigger: 3340 }
      ],
      palette: {
        name: '달빛 채소정원',
        skyTop: '#181630', skyBottom: '#9b5e9d',
        glow: '#ffc7e7', far: '#493a78', mid: '#66508e',
        groundTop: '#e2b9ee', groundBody: '#775083', groundDark: '#3d2b56',
        accent: '#b8f8dc'
      },
      // New vs 1–2: thorns, moving platforms, shadow_bat, cage (pobi rescue prop)
      uniqueElements: ['thorn', 'moving', 'shadow_bat', 'pobi_cage'],
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
        ground(4500, 700);

        // Tight island chain
        [
          [380, 500, 150], [620, 420, 130], [860, 500, 140],
          [1180, 450, 150], [1450, 360, 130], [1680, 470, 140],
          [2100, 430, 130], [2350, 340, 120], [2580, 450, 140],
          [3000, 400, 130], [3240, 310, 120], [3480, 420, 140],
          [3920, 380, 130], [4160, 300, 120], [4400, 450, 150],
          [4680, 500, 140]
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
          ['thorn', 720, 562, 90, 38],
          ['puddle', 1120, 568, 100, 32],
          ['thorn', 1320, 562, 95, 38],
          ['crystal', 1750, 546, 78, 54],
          ['thorn', 2050, 562, 88, 38],
          ['crystal', 2280, 306, 64, 48],
          ['thorn', 2550, 562, 100, 38],
          ['puddle', 2920, 568, 110, 32],
          ['thorn', 3180, 562, 92, 38],
          ['crystal', 3450, 546, 86, 54],
          ['thorn', 3800, 562, 100, 38],
          ['crystal', 4100, 266, 66, 48],
          ['thorn', 4350, 562, 95, 38],
          ['crystal', 4600, 546, 88, 54]
        ].forEach(([type, x, y, w, h]) => hazard(type, x, y, w, h));

        // Wind + dark mist specials
        specials.push(
          { type: 'wind', x: 1400, y: 150, w: 260, h: 420, forceX: 180, forceY: -30 },
          { type: 'wind', x: 3200, y: 140, w: 280, h: 430, forceX: -150, forceY: -60 }
        );

        // Pobi cage near portal (visual + ending trigger prop)
        specials.push({
          type: 'pobi_cage',
          x: 4780,
          y: 430,
          w: 100,
          h: 170
        });

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
        enemy(2100, 380, 2000, 2480, 100, 'shadow_bat');
        enemy(2900, 550, 2800, 3200, 78, 'sleep_cloud');
        enemy(3700, 360, 3600, 4100, 110, 'shadow_bat');
        enemy(4500, 550, 4400, 4850, 80, 'mushroom_patrol');

        for (let x = 180; x < 5100; x += 240 + Math.random() * 120) {
          decor.push({
            type: Math.random() < 0.35 ? 'flower' : Math.random() < 0.55 ? 'mushroom' : 'sprout',
            x, y: 600, s: 0.45 + Math.random() * 0.75, hue: Math.random(), phase: Math.random() * 6
          });
        }

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
