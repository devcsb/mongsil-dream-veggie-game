(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const W = canvas.width;
  const H = canvas.height;
  const WORLD_W = 10850;
  const REQUIRED_VEGGIES = 18;

  const ui = {
    hud: document.getElementById('hud'),
    hearts: document.getElementById('hearts-text'),
    veggie: document.getElementById('veggie-text'),
    score: document.getElementById('score-text'),
    stage: document.getElementById('stage-name'),
    progress: document.getElementById('progress-fill'),
    startScreen: document.getElementById('start-screen'),
    pauseScreen: document.getElementById('pause-screen'),
    resultScreen: document.getElementById('result-screen'),
    startButton: document.getElementById('start-button'),
    pauseButton: document.getElementById('pause-button'),
    soundButton: document.getElementById('sound-button'),
    resumeButton: document.getElementById('resume-button'),
    restartButton: document.getElementById('restart-button'),
    resultIcon: document.getElementById('result-icon'),
    resultKicker: document.getElementById('result-kicker'),
    resultTitle: document.getElementById('result-title'),
    resultMessage: document.getElementById('result-message'),
    resultVeggies: document.getElementById('result-veggies'),
    resultScore: document.getElementById('result-score'),
    bestScore: document.getElementById('best-score'),
    toast: document.getElementById('toast'),
    leftButton: document.getElementById('left-button'),
    rightButton: document.getElementById('right-button'),
    jumpButton: document.getElementById('jump-button'),
    mobileControls: document.getElementById('mobile-controls')
  };

  const snailImage = new Image();
  snailImage.src = document.querySelector('.hero-snail')?.src || 'assets/snail.png';

  const state = {
    mode: 'menu',
    time: 0,
    cameraX: 0,
    targetCameraX: 0,
    score: 0,
    collected: 0,
    lives: 4,
    checkpoint: 0,
    checkpointX: 130,
    stage: 0,
    combo: 0,
    comboTimer: 0,
    toastTimer: 0,
    shake: 0,
    flash: 0,
    sound: true,
    lastTime: performance.now()
  };

  const input = {
    left: false,
    right: false,
    jumpHeld: false,
    jumpQueued: false
  };

  const player = {
    x: 140,
    y: 360,
    prevX: 140,
    prevY: 360,
    w: 76,
    h: 112,
    vx: 0,
    vy: 0,
    grounded: false,
    coyote: 0,
    jumpBuffer: 0,
    facing: 1,
    invincible: 0,
    runCycle: 0,
    squash: 0,
    landingPulse: 0
  };

  const palettes = [
    {
      name: '라일락 이슬숲',
      skyTop: '#291640', skyBottom: '#9f76d1',
      glow: '#ffc0ec', far: '#5b3e86', mid: '#6f55a3',
      groundTop: '#d7b3ff', groundBody: '#72519b', groundDark: '#3f2b61',
      accent: '#9ff3ff'
    },
    {
      name: '솜사탕 수정구름',
      skyTop: '#31204d', skyBottom: '#8cc8df',
      glow: '#ffd1ec', far: '#715aa2', mid: '#6f86b4',
      groundTop: '#c5eaff', groundBody: '#8067ae', groundDark: '#46346d',
      accent: '#ffc2e8'
    },
    {
      name: '달빛 채소정원',
      skyTop: '#181630', skyBottom: '#9b5e9d',
      glow: '#ffc7e7', far: '#493a78', mid: '#66508e',
      groundTop: '#e2b9ee', groundBody: '#775083', groundDark: '#3d2b56',
      accent: '#b8f8dc'
    }
  ];

  const platforms = [];
  const hazards = [];
  const collectibles = [];
  const enemies = [];
  const particles = [];
  const decor = [];
  const bgIslands = [];
  const bgClouds = [];
  const stars = [];

  function addPlatform(x, y, w, h = 34, kind = 'island') {
    platforms.push({ x, y, w, h, kind });
  }
  function addGround(x, w, y = 600) {
    addPlatform(x, y, w, 180, 'ground');
  }
  function addHazard(type, x, y, w = 78, h = 54) {
    hazards.push({ type, x, y, w, h, pulse: Math.random() * Math.PI * 2 });
  }
  function addVeg(type, x, y) {
    collectibles.push({ type, x, y, r: 27, collected: false, phase: Math.random() * Math.PI * 2 });
  }
  function addEnemy(x, y, minX, maxX, speed = 58) {
    enemies.push({ x, y, w: 62, h: 50, minX, maxX, speed, dir: Math.random() > .5 ? 1 : -1, alive: true, phase: Math.random() * 6 });
  }

  function buildWorld() {
    platforms.length = hazards.length = collectibles.length = enemies.length = decor.length = 0;

    addGround(0, 1700);
    addGround(1950, 1380);
    addGround(3500, 1210);
    addGround(4960, 1150);
    addGround(6380, 1270);
    addGround(7920, 1210);
    addGround(9390, 1460);

    [
      [520, 500, 240], [900, 420, 230], [1280, 500, 210],
      [1690, 510, 170], [1860, 420, 165], [2030, 500, 190],
      [2440, 470, 245], [2820, 385, 225], [3160, 495, 205],
      [3650, 480, 245], [4050, 395, 220], [4460, 500, 205],
      [4745, 490, 170], [4915, 405, 175], [5090, 490, 190],
      [5530, 440, 240], [5910, 355, 220], [6150, 485, 175],
      [6330, 405, 175], [6505, 490, 190], [6960, 420, 230], [7350, 500, 215],
      [8060, 470, 230], [8450, 380, 225], [8840, 495, 215],
      [9160, 480, 170], [9335, 395, 175], [9515, 480, 190],
      [9890, 425, 235], [10260, 345, 230]
    ].forEach(([x, y, w]) => addPlatform(x, y, w));

    [
      ['crystal', 1080, 546, 86, 54], ['puddle', 1490, 568, 110, 32],
      ['crystal', 2675, 546, 88, 54], ['puddle', 3050, 568, 118, 32],
      ['crystal', 3900, 546, 92, 54], ['puddle', 4300, 568, 112, 32],
      ['crystal', 5630, 386, 76, 54], ['crystal', 5740, 546, 88, 54],
      ['puddle', 7040, 568, 120, 32], ['crystal', 7440, 446, 74, 54],
      ['crystal', 8390, 546, 90, 54], ['puddle', 8920, 568, 122, 32],
      ['crystal', 10080, 371, 78, 54], ['crystal', 10370, 546, 90, 54]
    ].forEach(([type, x, y, w, h]) => addHazard(type, x, y, w, h));

    [
      ['lettuce', 350, 545], ['cabbage', 635, 445], ['carrot', 1015, 365], ['lettuce', 1390, 445],
      ['radish', 1780, 365], ['cabbage', 2145, 445], ['lettuce', 2545, 415], ['cabbage', 2930, 330],
      ['carrot', 3230, 440], ['lettuce', 3580, 545], ['radish', 3760, 425], ['cabbage', 4145, 340],
      ['lettuce', 4550, 445], ['carrot', 4830, 435], ['cabbage', 5165, 435], ['radish', 5650, 385],
      ['lettuce', 6020, 300], ['cabbage', 6440, 350], ['carrot', 7050, 365], ['lettuce', 7445, 445],
      ['cabbage', 8000, 545], ['radish', 8160, 415], ['lettuce', 8550, 325], ['carrot', 8940, 440],
      ['cabbage', 9425, 340], ['lettuce', 9970, 370], ['radish', 10360, 290], ['cabbage', 10600, 545]
    ].forEach(([type, x, y]) => addVeg(type, x, y));

    addEnemy(760, 550, 700, 1000, 56);
    addEnemy(2300, 550, 2180, 2600, 64);
    addEnemy(3720, 550, 3560, 4060, 62);
    addEnemy(5290, 550, 5150, 5580, 68);
    addEnemy(6730, 550, 6600, 7180, 70);
    addEnemy(8180, 550, 8060, 8600, 66);
    addEnemy(9690, 550, 9550, 10020, 72);

    for (let x = 280; x < WORLD_W; x += 290 + Math.random() * 180) {
      decor.push({
        type: Math.random() < .5 ? 'flower' : Math.random() < .72 ? 'mushroom' : 'sprout',
        x,
        y: 600,
        s: .55 + Math.random() * .85,
        hue: Math.random(),
        phase: Math.random() * 6
      });
    }
  }

  function seededRandom(seed) {
    let t = seed >>> 0;
    return () => {
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ t >>> 15, 1 | t);
      r ^= r + Math.imul(r ^ r >>> 7, 61 | r);
      return ((r ^ r >>> 14) >>> 0) / 4294967296;
    };
  }

  function buildBackground() {
    const rnd = seededRandom(240513);
    stars.length = bgIslands.length = bgClouds.length = 0;
    for (let i = 0; i < 125; i++) {
      stars.push({ x: rnd() * (W + 300), y: 45 + rnd() * 370, r: .6 + rnd() * 1.9, tw: rnd() * 6.28, layer: .025 + rnd() * .06 });
    }
    for (let i = 0; i < 34; i++) {
      bgClouds.push({ x: rnd() * WORLD_W, y: 90 + rnd() * 310, s: .5 + rnd() * 1.2, layer: .08 + rnd() * .18, phase: rnd() * 6.28 });
    }
    for (let i = 0; i < 22; i++) {
      bgIslands.push({ x: 200 + rnd() * (WORLD_W - 400), y: 250 + rnd() * 220, s: .5 + rnd() * 1.25, layer: .18 + rnd() * .2, hue: rnd(), phase: rnd() * 6.28 });
    }
  }

  buildWorld();
  buildBackground();

  class DreamAudio {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.musicTimer = null;
      this.step = 0;
    }
    init() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return;
      }
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.master = this.ctx.createGain();
      this.master.gain.value = .22;
      this.master.connect(this.ctx.destination);
    }
    setEnabled(enabled) {
      if (!this.ctx || !this.master) return;
      this.master.gain.setTargetAtTime(enabled ? .22 : 0, this.ctx.currentTime, .03);
      if (enabled && state.mode === 'playing') this.startMusic();
      else this.stopMusic();
    }
    tone(freq, duration = .1, type = 'sine', volume = .18, slide = 1) {
      if (!state.sound) return;
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), now + duration);
      gain.gain.setValueAtTime(.0001, now);
      gain.gain.exponentialRampToValueAtTime(volume, now + .012);
      gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
      osc.connect(gain); gain.connect(this.master);
      osc.start(now); osc.stop(now + duration + .02);
    }
    chord(notes, duration = .8, volume = .025) {
      if (!state.sound || !this.ctx) return;
      notes.forEach((n, i) => {
        setTimeout(() => this.tone(n, duration, i % 2 ? 'sine' : 'triangle', volume, 1.002), i * 70);
      });
    }
    startMusic() {
      if (!state.sound || this.musicTimer) return;
      this.init();
      const chords = [
        [261.63, 329.63, 392.00],
        [293.66, 369.99, 440.00],
        [246.94, 329.63, 415.30],
        [220.00, 293.66, 369.99]
      ];
      const tick = () => {
        if (state.mode !== 'playing' || !state.sound) return;
        this.chord(chords[this.step % chords.length], 1.35, .022);
        this.step++;
      };
      tick();
      this.musicTimer = setInterval(tick, 1550);
    }
    stopMusic() {
      if (this.musicTimer) clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    jump() { this.tone(420, .13, 'sine', .11, 1.55); }
    collect(combo = 0) { this.tone(640 + combo * 35, .12, 'triangle', .13, 1.35); setTimeout(() => this.tone(890 + combo * 22, .1, 'sine', .08, 1.12), 55); }
    hurt() { this.tone(180, .28, 'sawtooth', .11, .55); }
    stomp() { this.tone(230, .12, 'square', .07, 1.6); }
    checkpoint() { [523, 659, 784].forEach((n, i) => setTimeout(() => this.tone(n, .25, 'sine', .08, 1.08), i * 90)); }
    win() { [523, 659, 784, 1047].forEach((n, i) => setTimeout(() => this.tone(n, .45, 'triangle', .11, 1.03), i * 120)); }
  }

  const audio = new DreamAudio();

  function resetGame() {
    state.score = 0;
    state.collected = 0;
    state.lives = 4;
    state.checkpoint = 0;
    state.checkpointX = 130;
    state.stage = 0;
    state.combo = 0;
    state.comboTimer = 0;
    state.cameraX = 0;
    state.targetCameraX = 0;
    state.shake = 0;
    state.flash = 0;
    particles.length = 0;
    player.x = 140;
    player.y = 350;
    player.prevX = player.x;
    player.prevY = player.y;
    player.vx = 0;
    player.vy = 0;
    player.grounded = false;
    player.coyote = 0;
    player.jumpBuffer = 0;
    player.invincible = 0;
    player.squash = 0;
    player.landingPulse = 0;
    collectibles.forEach(v => { v.collected = false; });
    enemies.forEach(e => { e.alive = true; e.dir = Math.random() > .5 ? 1 : -1; });
    updateHUD();
  }

  function startGame() {
    resetGame();
    state.mode = 'playing';
    ui.startScreen.classList.remove('is-visible');
    ui.resultScreen.classList.remove('is-visible');
    ui.pauseScreen.classList.remove('is-visible');
    ui.hud.classList.add('is-visible');
    ui.hud.setAttribute('aria-hidden', 'false');
    ui.mobileControls.classList.add('is-visible');
    audio.init();
    audio.setEnabled(state.sound);
    showToast('상추와 배추를 18개 모아 달빛 꿈문으로 가요!');
  }

  function pauseGame(force) {
    if (state.mode === 'menu' || state.mode === 'won' || state.mode === 'gameover') return;
    const shouldPause = force ?? state.mode === 'playing';
    state.mode = shouldPause ? 'paused' : 'playing';
    ui.pauseScreen.classList.toggle('is-visible', shouldPause);
    ui.pauseScreen.setAttribute('aria-hidden', String(!shouldPause));
    ui.mobileControls.classList.toggle('is-visible', !shouldPause);
    if (shouldPause) audio.stopMusic(); else audio.startMusic();
  }

  function readBestScore() {
    try { return Number(localStorage.getItem('snailDreamBest') || 0); }
    catch (_) { return 0; }
  }

  function writeBestScore(value) {
    try { localStorage.setItem('snailDreamBest', String(value)); }
    catch (_) { /* Storage can be disabled in private or embedded browsers. */ }
  }

  function endGame(won) {
    state.mode = won ? 'won' : 'gameover';
    audio.stopMusic();
    ui.mobileControls.classList.remove('is-visible');
    if (won) audio.win(); else audio.hurt();
    const best = Math.max(readBestScore(), state.score);
    writeBestScore(best);
    ui.resultIcon.textContent = won ? '✦' : '☁';
    ui.resultKicker.textContent = won ? 'DREAM COMPLETE' : 'TRY AGAIN';
    ui.resultTitle.textContent = won ? '달빛 정원 도착!' : '꿈길에서 깨어났어요';
    ui.resultMessage.textContent = won
      ? '몽실이가 반짝이는 꿈채소를 품에 안고 무사히 도착했어요.'
      : '괜찮아요. 다음 꿈에서는 수정 장애물을 더 가볍게 넘어봐요!';
    ui.resultVeggies.textContent = `${state.collected}개`;
    ui.resultScore.textContent = state.score.toLocaleString('ko-KR');
    ui.bestScore.textContent = best.toLocaleString('ko-KR');
    ui.resultScreen.classList.add('is-visible');
    ui.resultScreen.setAttribute('aria-hidden', 'false');
  }

  function showToast(message, duration = 2100) {
    ui.toast.textContent = message;
    ui.toast.classList.add('is-visible');
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => ui.toast.classList.remove('is-visible'), duration);
  }

  function updateHUD() {
    ui.hearts.textContent = Array.from({ length: 4 }, (_, i) => i < state.lives ? '♥' : '♡').join(' ');
    ui.veggie.textContent = `${state.collected} / ${REQUIRED_VEGGIES}`;
    ui.score.textContent = String(Math.max(0, Math.floor(state.score))).padStart(6, '0');
    ui.progress.style.width = `${Math.min(100, Math.max(0, player.x / 10550 * 100))}%`;
    ui.stage.textContent = palettes[state.stage].name;
  }

  function queueJump() {
    input.jumpQueued = true;
    player.jumpBuffer = .14;
  }

  function bindHoldButton(button, key) {
    const press = (event) => {
      event.preventDefault();
      if (state.mode === 'menu') return;
      input[key] = true;
      button.classList.add('is-pressed');
      button.setPointerCapture?.(event.pointerId);
    };
    const release = (event) => {
      event.preventDefault();
      input[key] = false;
      button.classList.remove('is-pressed');
    };
    button.addEventListener('pointerdown', press);
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
  }

  bindHoldButton(ui.leftButton, 'left');
  bindHoldButton(ui.rightButton, 'right');
  ui.jumpButton.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    input.jumpHeld = true;
    ui.jumpButton.classList.add('is-pressed');
    ui.jumpButton.setPointerCapture?.(event.pointerId);
    queueJump();
  });
  const releaseJump = (event) => {
    event.preventDefault();
    input.jumpHeld = false;
    ui.jumpButton.classList.remove('is-pressed');
  };
  ui.jumpButton.addEventListener('pointerup', releaseJump);
  ui.jumpButton.addEventListener('pointercancel', releaseJump);
  ui.jumpButton.addEventListener('lostpointercapture', releaseJump);

  window.addEventListener('keydown', (event) => {
    const code = event.code;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space'].includes(code)) event.preventDefault();
    if (code === 'ArrowLeft' || code === 'KeyA') input.left = true;
    if (code === 'ArrowRight' || code === 'KeyD') input.right = true;
    if ((code === 'ArrowUp' || code === 'KeyW' || code === 'Space') && !event.repeat) {
      input.jumpHeld = true;
      if (state.mode === 'menu') startGame();
      else if (state.mode === 'playing') queueJump();
    }
    if ((code === 'KeyP' || code === 'Escape') && !event.repeat) pauseGame();
    if (code === 'Enter' && !event.repeat) {
      if (state.mode === 'menu') startGame();
      else if (state.mode === 'paused') pauseGame(false);
      else if (state.mode === 'won' || state.mode === 'gameover') startGame();
    }
    if (code === 'KeyR' && !event.repeat && state.mode !== 'menu') startGame();
  }, { passive: false });

  window.addEventListener('keyup', (event) => {
    const code = event.code;
    if (code === 'ArrowLeft' || code === 'KeyA') input.left = false;
    if (code === 'ArrowRight' || code === 'KeyD') input.right = false;
    if (code === 'ArrowUp' || code === 'KeyW' || code === 'Space') input.jumpHeld = false;
  });

  window.addEventListener('blur', () => {
    input.left = input.right = input.jumpHeld = false;
    if (state.mode === 'playing') pauseGame(true);
  });

  ui.startButton.addEventListener('click', startGame);
  ui.restartButton.addEventListener('click', startGame);
  ui.resumeButton.addEventListener('click', () => pauseGame(false));
  ui.pauseButton.addEventListener('click', () => pauseGame());
  ui.soundButton.addEventListener('click', () => {
    state.sound = !state.sound;
    ui.soundButton.textContent = state.sound ? '♪' : '×';
    ui.soundButton.setAttribute('aria-label', state.sound ? '소리 끄기' : '소리 켜기');
    audio.setEnabled(state.sound);
  });

  function rectsOverlap(a, b, inset = 0) {
    return a.x + inset < b.x + b.w && a.x + a.w - inset > b.x && a.y + inset < b.y + b.h && a.y + a.h - inset > b.y;
  }

  function update(dt) {
    state.time += dt;
    state.shake = Math.max(0, state.shake - dt * 2.8);
    state.flash = Math.max(0, state.flash - dt * 2.6);
    updateParticles(dt);

    if (state.mode !== 'playing') {
      state.cameraX += (state.targetCameraX - state.cameraX) * Math.min(1, dt * 2);
      return;
    }

    if (state.comboTimer > 0) state.comboTimer -= dt;
    else state.combo = 0;
    if (player.invincible > 0) player.invincible -= dt;
    if (player.landingPulse > 0) player.landingPulse -= dt * 3.2;
    player.squash += (0 - player.squash) * Math.min(1, dt * 8);

    player.prevX = player.x;
    player.prevY = player.y;

    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const accel = player.grounded ? 2300 : 1450;
    const maxSpeed = 420;
    if (dir !== 0) {
      player.vx += dir * accel * dt;
      player.vx = Math.max(-maxSpeed, Math.min(maxSpeed, player.vx));
      player.facing = dir;
      player.runCycle += Math.abs(player.vx) * dt * .022;
    } else {
      const friction = player.grounded ? 10.5 : 2.1;
      player.vx *= Math.max(0, 1 - friction * dt);
    }

    player.coyote = player.grounded ? .12 : Math.max(0, player.coyote - dt);
    player.jumpBuffer = Math.max(0, player.jumpBuffer - dt);
    if (input.jumpQueued) {
      player.jumpBuffer = .14;
      input.jumpQueued = false;
    }
    if (player.jumpBuffer > 0 && (player.grounded || player.coyote > 0)) {
      player.vy = -760;
      player.grounded = false;
      player.coyote = 0;
      player.jumpBuffer = 0;
      player.squash = -.12;
      audio.jump();
      emitDust(player.x + player.w * .45, player.y + player.h, 6, '#d9b5ff');
    }

    const gravity = (!input.jumpHeld && player.vy < -160) ? 3200 : 2100;
    player.vy = Math.min(1050, player.vy + gravity * dt);

    player.x += player.vx * dt;
    collideHorizontal();
    player.y += player.vy * dt;
    collideVertical();

    if (player.x < 0) { player.x = 0; player.vx = 0; }
    if (player.x > WORLD_W - player.w) { player.x = WORLD_W - player.w; player.vx = 0; }

    updateEnemies(dt);
    checkCollectibles();
    checkHazards();
    updateCheckpoints();
    checkPortal();

    if (player.y > H + 180) hurtPlayer(player.x, true);

    const lookAhead = player.vx * .32;
    state.targetCameraX = Math.max(0, Math.min(WORLD_W - W, player.x - W * .31 + lookAhead));
    state.cameraX += (state.targetCameraX - state.cameraX) * Math.min(1, dt * 4.8);

    const newStage = player.x < 3500 ? 0 : player.x < 7920 ? 1 : 2;
    if (newStage !== state.stage) {
      state.stage = newStage;
      showToast(`✦ ${palettes[newStage].name}에 도착했어요`);
      audio.checkpoint();
    }

    updateHUD();
  }

  function collideHorizontal() {
    const box = { x: player.x + 12, y: player.y + 10, w: player.w - 24, h: player.h - 13 };
    for (const p of platforms) {
      if (!rectsOverlap(box, p)) continue;
      const prevBox = { x: player.prevX + 12, y: player.prevY + 10, w: player.w - 24, h: player.h - 13 };
      if (player.vx > 0 && prevBox.x + prevBox.w <= p.x + 8) {
        player.x = p.x - (player.w - 12);
        player.vx = 0;
        box.x = player.x + 12;
      } else if (player.vx < 0 && prevBox.x >= p.x + p.w - 8) {
        player.x = p.x + p.w - 12;
        player.vx = 0;
        box.x = player.x + 12;
      }
    }
  }

  function collideVertical() {
    player.grounded = false;
    const box = { x: player.x + 16, y: player.y + 6, w: player.w - 30, h: player.h - 6 };
    const prevBox = { x: player.prevX + 16, y: player.prevY + 6, w: player.w - 30, h: player.h - 6 };
    for (const p of platforms) {
      if (!rectsOverlap(box, p)) continue;
      if (player.vy >= 0 && prevBox.y + prevBox.h <= p.y + 16) {
        const hardLanding = player.vy > 650;
        player.y = p.y - player.h;
        player.vy = 0;
        player.grounded = true;
        player.coyote = .12;
        box.y = player.y + 6;
        if (hardLanding) {
          player.squash = .15;
          player.landingPulse = 1;
          emitDust(player.x + player.w * .5, p.y, 9, '#d7c0ff');
        }
      } else if (player.vy < 0 && prevBox.y >= p.y + p.h - 12) {
        player.y = p.y + p.h - 6;
        player.vy = 50;
        box.y = player.y + 6;
      }
    }
  }

  function updateEnemies(dt) {
    for (const e of enemies) {
      if (!e.alive) continue;
      e.phase += dt * 2.4;
      e.x += e.speed * e.dir * dt;
      if (e.x < e.minX) { e.x = e.minX; e.dir = 1; }
      if (e.x + e.w > e.maxX) { e.x = e.maxX - e.w; e.dir = -1; }
      const pbox = { x: player.x + 13, y: player.y + 11, w: player.w - 26, h: player.h - 13 };
      if (rectsOverlap(pbox, e, 4)) {
        const prevBottom = player.prevY + player.h;
        if (player.vy > 120 && prevBottom <= e.y + 16) {
          e.alive = false;
          player.vy = -520;
          state.score += 240;
          audio.stomp();
          emitBurst(e.x + e.w / 2, e.y + e.h / 2, '#f3b7e3', 15);
        } else {
          hurtPlayer(e.x + e.w / 2, false);
        }
      }
    }
  }

  function checkCollectibles() {
    const cx = player.x + player.w * .5;
    const cy = player.y + player.h * .48;
    for (const v of collectibles) {
      if (v.collected) continue;
      const dx = cx - v.x;
      const dy = cy - v.y;
      if (dx * dx + dy * dy < 62 * 62) {
        v.collected = true;
        state.collected++;
        state.combo = state.comboTimer > 0 ? Math.min(7, state.combo + 1) : 1;
        state.comboTimer = 2.1;
        state.score += 100 * state.combo;
        audio.collect(state.combo);
        const colors = { lettuce: '#a8f2b3', cabbage: '#d8f0a4', carrot: '#ffad73', radish: '#ff9fcf' };
        emitBurst(v.x, v.y, colors[v.type], 18);
        const names = { lettuce: '꼬마 상추', cabbage: '몽글 배추', carrot: '별빛 당근', radish: '분홍 무' };
        if (state.combo >= 3) showToast(`${names[v.type]} 획득 · ${state.combo}콤보!`);
        if (state.collected === REQUIRED_VEGGIES) {
          showToast('꿈문을 열 만큼 모았어요! 끝까지 가요 ✦', 2800);
          audio.checkpoint();
        }
      }
    }
  }

  function checkHazards() {
    const pbox = { x: player.x + 18, y: player.y + 14, w: player.w - 34, h: player.h - 18 };
    for (const h of hazards) {
      const hitbox = h.type === 'puddle'
        ? { x: h.x + 8, y: h.y + 7, w: h.w - 16, h: h.h - 3 }
        : { x: h.x + 12, y: h.y + 12, w: h.w - 24, h: h.h - 10 };
      if (rectsOverlap(pbox, hitbox)) {
        hurtPlayer(h.x + h.w / 2, false);
        return;
      }
    }
  }

  function updateCheckpoints() {
    const checkpoints = [
      { x: 130, trigger: 0 },
      { x: 3610, trigger: 3550 },
      { x: 8030, trigger: 7970 }
    ];
    for (let i = checkpoints.length - 1; i >= 0; i--) {
      if (player.x >= checkpoints[i].trigger && i > state.checkpoint) {
        state.checkpoint = i;
        state.checkpointX = checkpoints[i].x;
        showToast('달빛 이슬에 진행 지점을 저장했어요 ✦');
        audio.checkpoint();
        emitBurst(player.x + player.w / 2, player.y + player.h / 2, '#aaf3ff', 22);
        break;
      }
    }
  }

  function checkPortal() {
    const portal = { x: 10610, y: 410, w: 125, h: 190 };
    const pbox = { x: player.x + 14, y: player.y + 10, w: player.w - 24, h: player.h - 10 };
    if (rectsOverlap(pbox, portal)) {
      if (state.collected >= REQUIRED_VEGGIES) {
        state.score += 2500 + state.lives * 500;
        endGame(true);
      } else if (!state.portalNotice || state.time - state.portalNotice > 2.5) {
        const needed = REQUIRED_VEGGIES - state.collected;
        showToast(`꿈문이 졸고 있어요. 채소 ${needed}개를 더 모아 주세요!`, 2600);
        state.portalNotice = state.time;
        player.vx = -220;
      }
    }
  }

  function hurtPlayer(sourceX, fell) {
    if (player.invincible > 0 || state.mode !== 'playing') return;
    state.lives--;
    state.combo = 0;
    state.comboTimer = 0;
    state.shake = 1;
    state.flash = .65;
    audio.hurt();
    emitBurst(player.x + player.w / 2, player.y + player.h / 2, '#ff9dcc', 20);
    if (state.lives <= 0) {
      endGame(false);
      return;
    }
    showToast(fell ? '구름 아래로 퐁! 이슬 지점에서 다시 시작해요.' : '앗, 반짝 장애물에 닿았어요!');
    player.x = state.checkpointX;
    player.y = 360;
    player.prevX = player.x;
    player.prevY = player.y;
    player.vx = sourceX < player.x ? 170 : -170;
    player.vy = -180;
    player.invincible = 2.1;
    state.cameraX = Math.max(0, player.x - W * .28);
    state.targetCameraX = state.cameraX;
    updateHUD();
  }

  function emitBurst(x, y, color, count = 14) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 70 + Math.random() * 230;
      particles.push({
        x, y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed - 50,
        life: .55 + Math.random() * .65,
        max: 1.2,
        size: 3 + Math.random() * 7,
        color,
        shape: Math.random() < .42 ? 'star' : 'orb',
        gravity: 240
      });
    }
  }

  function emitDust(x, y, count, color) {
    for (let i = 0; i < count; i++) {
      particles.push({
        x: x + (Math.random() - .5) * 42,
        y: y - Math.random() * 8,
        vx: (Math.random() - .5) * 80,
        vy: -30 - Math.random() * 70,
        life: .35 + Math.random() * .3,
        max: .7,
        size: 8 + Math.random() * 13,
        color,
        shape: 'cloud',
        gravity: -10
      });
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.max(0, 1 - dt * 1.2);
    }
  }

  function hexToRgb(hex) {
    const value = hex.replace('#', '');
    const n = parseInt(value.length === 3 ? value.split('').map(c => c + c).join('') : value, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mixColor(a, b, t) {
    const A = hexToRgb(a), B = hexToRgb(b);
    const C = A.map((v, i) => Math.round(v + (B[i] - v) * t));
    return `rgb(${C[0]}, ${C[1]}, ${C[2]})`;
  }
  function paletteAt(x) {
    if (x < 3150) return palettes[0];
    if (x < 3900) {
      const t = (x - 3150) / 750;
      return blendPalette(palettes[0], palettes[1], t);
    }
    if (x < 7400) return palettes[1];
    if (x < 8200) {
      const t = (x - 7400) / 800;
      return blendPalette(palettes[1], palettes[2], t);
    }
    return palettes[2];
  }
  function blendPalette(a, b, t) {
    const out = {};
    for (const key of Object.keys(a)) out[key] = key === 'name' ? (t < .5 ? a.name : b.name) : mixColor(a[key], b[key], t);
    return out;
  }

  function roundedPath(context, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    context.beginPath();
    context.moveTo(x + radius, y);
    context.arcTo(x + w, y, x + w, y + h, radius);
    context.arcTo(x + w, y + h, x, y + h, radius);
    context.arcTo(x, y + h, x, y, radius);
    context.arcTo(x, y, x + w, y, radius);
    context.closePath();
  }

  function draw() {
    const palette = paletteAt(state.cameraX + W * .5);
    drawBackground(palette);

    ctx.save();
    if (state.shake > 0) {
      const mag = 9 * state.shake;
      ctx.translate((Math.random() - .5) * mag, (Math.random() - .5) * mag);
    }
    ctx.translate(-state.cameraX, 0);

    drawBackDecor(palette);
    for (const p of platforms) if (isVisible(p.x, p.w)) drawPlatform(p, palette);
    for (const d of decor) if (isVisible(d.x, 100)) drawDecor(d);
    for (const h of hazards) if (isVisible(h.x, h.w)) drawHazard(h);
    for (const v of collectibles) if (!v.collected && isVisible(v.x - 40, 80)) drawVegetable(v);
    for (const e of enemies) if (e.alive && isVisible(e.x, e.w)) drawEnemy(e);
    drawCheckpointBeacons();
    drawPortal();
    drawPlayer();
    drawParticles();
    ctx.restore();

    drawForegroundGlow(palette);
    if (state.flash > 0) {
      ctx.fillStyle = `rgba(255, 167, 214, ${state.flash * .22})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function isVisible(x, w = 0) {
    return x + w > state.cameraX - 180 && x < state.cameraX + W + 180;
  }

  function drawBackground(p) {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, p.skyTop);
    sky.addColorStop(.58, mixColor(p.skyTop, p.skyBottom, .58));
    sky.addColorStop(1, p.skyBottom);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    const moonX = 1010 - (state.cameraX * .03 % 1300);
    const moonY = 118 + Math.sin(state.time * .2) * 4;
    const moonGlow = ctx.createRadialGradient(moonX, moonY, 10, moonX, moonY, 125);
    moonGlow.addColorStop(0, 'rgba(255,247,255,.72)');
    moonGlow.addColorStop(.28, 'rgba(255,207,239,.32)');
    moonGlow.addColorStop(1, 'rgba(255,207,239,0)');
    ctx.fillStyle = moonGlow;
    ctx.beginPath(); ctx.arc(moonX, moonY, 125, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,250,255,.83)';
    ctx.beginPath(); ctx.arc(moonX, moonY, 44, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(186,142,219,.22)';
    ctx.beginPath(); ctx.arc(moonX - 11, moonY + 8, 9, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(moonX + 14, moonY - 12, 6, 0, Math.PI * 2); ctx.fill();

    for (const s of stars) {
      const x = ((s.x - state.cameraX * s.layer) % (W + 300) + (W + 300)) % (W + 300) - 120;
      const a = .35 + .55 * (.5 + .5 * Math.sin(state.time * 2 + s.tw));
      ctx.fillStyle = `rgba(255,247,255,${a})`;
      ctx.beginPath(); ctx.arc(x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
      if (s.r > 1.7) {
        ctx.strokeStyle = `rgba(221,235,255,${a * .65})`;
        ctx.lineWidth = .7;
        ctx.beginPath(); ctx.moveTo(x - 5, s.y); ctx.lineTo(x + 5, s.y); ctx.moveTo(x, s.y - 5); ctx.lineTo(x, s.y + 5); ctx.stroke();
      }
    }

    drawHillLayer(p.far, 500, 64, .055, 300, .55);
    drawHillLayer(p.mid, 555, 88, .12, 260, .76);

    for (const c of bgClouds) {
      const x = c.x - state.cameraX * c.layer;
      if (x < -240 || x > W + 240) continue;
      drawCloud(x, c.y + Math.sin(state.time * .28 + c.phase) * 5, c.s, c.layer > .16 ? .2 : .12);
    }
    for (const island of bgIslands) {
      const x = island.x - state.cameraX * island.layer;
      if (x < -260 || x > W + 260) continue;
      drawFloatingIsland(x, island.y + Math.sin(state.time * .35 + island.phase) * 7, island.s, island.hue, p);
    }

    const haze = ctx.createLinearGradient(0, 360, 0, H);
    haze.addColorStop(0, 'rgba(255,255,255,0)');
    haze.addColorStop(1, 'rgba(255,220,248,.16)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, 300, W, H - 300);
  }

  function drawHillLayer(color, base, amp, speed, period, alpha) {
    const offset = -((state.cameraX * speed) % period);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-period, H);
    for (let x = -period + offset; x <= W + period; x += 12) {
      const y = base - Math.sin((x + state.cameraX * speed) / period * Math.PI * 2) * amp * .45
        - Math.sin((x + state.cameraX * speed) / (period * .63) * Math.PI * 2) * amp * .21;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W + period, H);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawCloud(x, y, s, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#fff7ff';
    ctx.shadowColor = 'rgba(255,216,247,.32)';
    ctx.shadowBlur = 18 * s;
    ctx.beginPath();
    ctx.ellipse(x, y, 52 * s, 23 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(x - 32 * s, y + 3 * s, 30 * s, 18 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 30 * s, y - 7 * s, 35 * s, 25 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 62 * s, y + 5 * s, 26 * s, 15 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawFloatingIsland(x, y, s, hue, p) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.globalAlpha = .36;
    const g = ctx.createLinearGradient(0, -20, 0, 80);
    g.addColorStop(0, mixColor(p.groundTop, '#ffffff', .2));
    g.addColorStop(.24, p.groundBody);
    g.addColorStop(1, p.groundDark);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-78, -12); ctx.quadraticCurveTo(0, -34, 78, -12);
    ctx.quadraticCurveTo(44, 42, 4, 74);
    ctx.quadraticCurveTo(-45, 38, -78, -12); ctx.fill();
    ctx.fillStyle = hue > .5 ? 'rgba(255,196,235,.65)' : 'rgba(171,244,255,.58)';
    ctx.beginPath(); ctx.ellipse(0, -15, 80, 17, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawBackDecor(p) {
    // Soft vertical light shafts that make the world feel dimensional.
    const start = Math.floor((state.cameraX - 300) / 900) * 900;
    for (let x = start; x < state.cameraX + W + 500; x += 900) {
      const grad = ctx.createLinearGradient(x, 90, x + 180, 590);
      grad.addColorStop(0, 'rgba(255,255,255,.08)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(x + 120, 20); ctx.lineTo(x + 300, 20); ctx.lineTo(x + 570, 600); ctx.lineTo(x + 290, 600); ctx.closePath(); ctx.fill();
    }
  }

  function drawPlatform(p, palette) {
    ctx.save();
    const x = p.x, y = p.y, w = p.w, h = p.h;
    ctx.shadowColor = 'rgba(18,7,36,.32)';
    ctx.shadowBlur = p.kind === 'ground' ? 18 : 24;
    ctx.shadowOffsetY = 12;

    const body = ctx.createLinearGradient(0, y, 0, y + Math.min(h, 160));
    body.addColorStop(0, palette.groundBody);
    body.addColorStop(.56, mixColor(palette.groundBody, palette.groundDark, .42));
    body.addColorStop(1, palette.groundDark);
    ctx.fillStyle = body;
    roundedPath(ctx, x, y, w, h, p.kind === 'ground' ? 22 : 18);
    ctx.fill();

    ctx.shadowColor = 'transparent';
    const top = ctx.createLinearGradient(0, y - 8, 0, y + 24);
    top.addColorStop(0, mixColor(palette.groundTop, '#ffffff', .27));
    top.addColorStop(.45, palette.groundTop);
    top.addColorStop(1, mixColor(palette.groundTop, palette.groundBody, .45));
    ctx.fillStyle = top;
    roundedPath(ctx, x - 2, y - 8, w + 4, 31, 16);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,.28)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x + 14, y - 3); ctx.quadraticCurveTo(x + w * .5, y - 11, x + w - 14, y - 3); ctx.stroke();

    ctx.globalAlpha = .22;
    for (let px = x + 30; px < x + w - 10; px += 70) {
      const py = y + 42 + ((px * .31) % Math.max(34, Math.min(85, h - 55)));
      ctx.fillStyle = 'rgba(255,255,255,.5)';
      ctx.beginPath(); ctx.ellipse(px, py, 10, 4, -.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(34,18,55,.55)';
      ctx.beginPath(); ctx.arc(px + 14, py + 18, 6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (p.kind !== 'ground') {
      ctx.fillStyle = 'rgba(255,212,244,.24)';
      ctx.beginPath();
      ctx.moveTo(x + 22, y + h); ctx.lineTo(x + w - 20, y + h); ctx.lineTo(x + w * .57, y + h + 34); ctx.lineTo(x + w * .44, y + h + 41); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  function drawDecor(d) {
    const sway = Math.sin(state.time * 1.2 + d.phase) * .08;
    ctx.save();
    ctx.translate(d.x, d.y + 2);
    ctx.rotate(sway);
    ctx.scale(d.s, d.s);
    ctx.globalAlpha = .78;
    if (d.type === 'flower') {
      ctx.strokeStyle = '#8cd4b1'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-5, -34, 4, -60); ctx.stroke();
      const petal = d.hue > .5 ? '#f4a9df' : '#bfa8ff';
      ctx.fillStyle = petal;
      for (let i = 0; i < 5; i++) {
        const a = i / 5 * Math.PI * 2;
        ctx.beginPath(); ctx.ellipse(Math.cos(a) * 13, -65 + Math.sin(a) * 13, 11, 6, a, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#fff3b3'; ctx.beginPath(); ctx.arc(0, -65, 7, 0, Math.PI * 2); ctx.fill();
    } else if (d.type === 'mushroom') {
      ctx.fillStyle = '#eee2f5'; roundedPath(ctx, -7, -34, 14, 34, 7); ctx.fill();
      const cap = ctx.createRadialGradient(-10, -48, 2, 0, -38, 34);
      cap.addColorStop(0, '#ffd7ef'); cap.addColorStop(1, d.hue > .5 ? '#b88ee8' : '#8fd8e8');
      ctx.fillStyle = cap; ctx.beginPath(); ctx.ellipse(0, -40, 31, 19, 0, Math.PI, Math.PI * 2); ctx.lineTo(-31, -40); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.72)'; ctx.beginPath(); ctx.arc(-9, -48, 5, 0, Math.PI * 2); ctx.arc(13, -43, 3, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.strokeStyle = '#92ddb9'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-2, -25, 0, -46); ctx.stroke();
      ctx.fillStyle = '#aaf1c7'; ctx.beginPath(); ctx.ellipse(-11, -38, 14, 7, -.5, 0, Math.PI * 2); ctx.ellipse(12, -47, 14, 7, .5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawHazard(h) {
    h.pulse += .02;
    if (h.type === 'puddle') drawPuddle(h);
    else drawCrystal(h);
  }

  function drawPuddle(h) {
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.shadowColor = 'rgba(60,13,91,.55)'; ctx.shadowBlur = 18;
    const g = ctx.createRadialGradient(h.w * .36, 5, 5, h.w * .5, h.h * .4, h.w * .58);
    g.addColorStop(0, '#ff9fe4'); g.addColorStop(.37, '#8f70dc'); g.addColorStop(1, '#3c245f');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(h.w * .5, h.h * .52, h.w * .5, h.h * .42 + Math.sin(state.time * 2 + h.pulse) * 1.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(h.w * .38, h.h * .38, h.w * .22, h.h * .12, -.15, Math.PI * 1.06, Math.PI * 1.86); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.78)';
    ctx.beginPath(); ctx.ellipse(h.w * .31, h.h * .29, 7, 3, -.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawCrystal(h) {
    ctx.save();
    ctx.translate(h.x, h.y + h.h);
    ctx.shadowColor = 'rgba(199,125,255,.65)'; ctx.shadowBlur = 17;
    const spikes = 3;
    for (let i = 0; i < spikes; i++) {
      const sw = h.w / spikes;
      const x = i * sw;
      const peak = h.h * (.76 + ((i * 7) % 3) * .12);
      const g = ctx.createLinearGradient(x, -peak, x + sw, 0);
      g.addColorStop(0, i % 2 ? '#baf6ff' : '#ffd1f0');
      g.addColorStop(.5, '#b594f0');
      g.addColorStop(1, '#59417d');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + sw * .52, -peak); ctx.lineTo(x + sw, 0); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.42)'; ctx.lineWidth = 1.3; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.58)';
      ctx.beginPath(); ctx.moveTo(x + sw * .48, -peak + 9); ctx.lineTo(x + sw * .31, -peak * .34); ctx.lineTo(x + sw * .5, -peak * .48); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  function drawVegetable(v) {
    const bob = Math.sin(state.time * 3.2 + v.phase) * 7;
    const pulse = 1 + Math.sin(state.time * 4 + v.phase) * .035;
    ctx.save();
    ctx.translate(v.x, v.y + bob);
    ctx.scale(pulse, pulse);
    ctx.shadowColor = v.type === 'carrot' ? 'rgba(255,170,93,.55)' : 'rgba(153,255,188,.55)';
    ctx.shadowBlur = 18;
    const aura = ctx.createRadialGradient(0, 0, 4, 0, 0, 42);
    aura.addColorStop(0, 'rgba(255,255,255,.25)'); aura.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = aura; ctx.beginPath(); ctx.arc(0, 0, 42, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 10;
    if (v.type === 'lettuce') drawLettuce();
    else if (v.type === 'cabbage') drawCabbage();
    else if (v.type === 'carrot') drawCarrot();
    else drawRadish();
    ctx.restore();
  }

  function cuteFace(y = 4, scale = 1) {
    ctx.save(); ctx.scale(scale, scale);
    ctx.fillStyle = '#34233e';
    ctx.beginPath(); ctx.arc(-7, y, 2.3, 0, Math.PI * 2); ctx.arc(7, y, 2.3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#34233e'; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, y + 2, 4.5, .2, Math.PI - .2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,139,190,.62)'; ctx.beginPath(); ctx.ellipse(-13, y + 5, 4, 2, 0, 0, Math.PI * 2); ctx.ellipse(13, y + 5, 4, 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawLettuce() {
    const leaves = [
      [-17, 3, 18, 27, -.45], [17, 3, 18, 27, .45], [0, -10, 20, 28, 0], [-7, 10, 20, 24, -.12], [8, 10, 20, 24, .12]
    ];
    for (const [x, y, rx, ry, rot] of leaves) {
      const g = ctx.createLinearGradient(x - 10, y - 20, x + 15, y + 20);
      g.addColorStop(0, '#d4ffd2'); g.addColorStop(1, '#72d993');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(58,145,90,.34)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x, y - ry * .66); ctx.lineTo(x, y + ry * .58); ctx.stroke();
    }
    cuteFace(5, 1);
    ctx.fillStyle = 'rgba(255,255,255,.56)'; ctx.beginPath(); ctx.ellipse(-11, -14, 5, 2.5, -.5, 0, Math.PI * 2); ctx.fill();
  }

  function drawCabbage() {
    const g = ctx.createRadialGradient(-9, -14, 3, 0, 0, 32);
    g.addColorStop(0, '#f5ffcc'); g.addColorStop(.5, '#c8eda0'); g.addColorStop(1, '#82c684');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 29, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(72,135,78,.34)'; ctx.lineWidth = 2;
    [-1, 1].forEach(side => {
      ctx.beginPath(); ctx.moveTo(0, -24); ctx.quadraticCurveTo(18 * side, -6, 21 * side, 18); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -20); ctx.quadraticCurveTo(8 * side, 4, 4 * side, 24); ctx.stroke();
    });
    cuteFace(4, 1);
    ctx.fillStyle = 'rgba(255,255,255,.56)'; ctx.beginPath(); ctx.ellipse(-9, -14, 6, 3, -.45, 0, Math.PI * 2); ctx.fill();
  }

  function drawCarrot() {
    ctx.fillStyle = '#79d897';
    ctx.beginPath(); ctx.ellipse(-8, -25, 8, 18, -.45, 0, Math.PI * 2); ctx.ellipse(8, -26, 8, 19, .45, 0, Math.PI * 2); ctx.ellipse(0, -29, 7, 19, 0, 0, Math.PI * 2); ctx.fill();
    const g = ctx.createLinearGradient(-18, -14, 18, 24);
    g.addColorStop(0, '#ffc07b'); g.addColorStop(.55, '#ff986d'); g.addColorStop(1, '#e86d65');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(-21, -13); ctx.quadraticCurveTo(0, -21, 21, -13); ctx.quadraticCurveTo(12, 14, 0, 31); ctx.quadraticCurveTo(-13, 14, -21, -13); ctx.fill();
    cuteFace(-3, .9);
    ctx.strokeStyle = 'rgba(173,77,54,.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-12, 9); ctx.lineTo(-5, 7); ctx.moveTo(7, 14); ctx.lineTo(13, 12); ctx.stroke();
  }

  function drawRadish() {
    ctx.fillStyle = '#8be1a4';
    ctx.beginPath(); ctx.ellipse(-7, -23, 8, 17, -.55, 0, Math.PI * 2); ctx.ellipse(8, -24, 8, 18, .5, 0, Math.PI * 2); ctx.fill();
    const g = ctx.createRadialGradient(-8, -10, 3, 0, 0, 30);
    g.addColorStop(0, '#ffd6ec'); g.addColorStop(.6, '#f697c7'); g.addColorStop(1, '#d868a7');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 27, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f5b7d9'; ctx.beginPath(); ctx.moveTo(-7, 22); ctx.lineTo(0, 37); ctx.lineTo(7, 22); ctx.closePath(); ctx.fill();
    cuteFace(3, 1);
  }

  function drawEnemy(e) {
    const bounce = Math.sin(e.phase) * 2;
    ctx.save();
    ctx.translate(e.x + e.w / 2, e.y + e.h + bounce);
    ctx.scale(e.dir, 1);
    ctx.shadowColor = 'rgba(25,9,42,.3)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 7;
    ctx.fillStyle = 'rgba(24,14,38,.24)'; ctx.beginPath(); ctx.ellipse(0, 2, 30, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.shadowOffsetY = 0;
    const cap = ctx.createRadialGradient(-12, -40, 4, 0, -28, 38);
    cap.addColorStop(0, '#ffd9ef'); cap.addColorStop(.5, '#d995d9'); cap.addColorStop(1, '#7c5b9d');
    ctx.fillStyle = cap; ctx.beginPath(); ctx.ellipse(0, -28, 32, 22, 0, Math.PI, Math.PI * 2); ctx.lineTo(-32, -28); ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#f3e8ee'; roundedPath(ctx, -18, -31, 36, 31, 14); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.62)'; ctx.beginPath(); ctx.arc(-12, -40, 5, 0, Math.PI * 2); ctx.arc(12, -35, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#4a3151'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-10, -19); ctx.lineTo(-4, -19); ctx.moveTo(5, -19); ctx.lineTo(11, -19); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -11, 4, .15, Math.PI - .15); ctx.stroke();
    ctx.restore();
  }

  function drawCheckpointBeacons() {
    const beacons = [3610, 8030];
    for (let i = 0; i < beacons.length; i++) {
      const x = beacons[i];
      if (!isVisible(x - 70, 140)) continue;
      ctx.save(); ctx.translate(x, 598);
      const active = state.checkpoint >= i + 1;
      const glow = ctx.createRadialGradient(0, -75, 4, 0, -75, 70);
      glow.addColorStop(0, active ? 'rgba(183,250,255,.72)' : 'rgba(255,208,241,.44)');
      glow.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, -75, 70, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = active ? '#b8f7ff' : '#e5a9e2'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-9, -54, 0, -100); ctx.stroke();
      ctx.fillStyle = active ? '#d8ffff' : '#f9d5ed'; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 18;
      ctx.beginPath(); ctx.arc(0, -103, 12 + Math.sin(state.time * 3) * 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  function drawPortal() {
    const x = 10610, y = 410, w = 125, h = 190;
    if (!isVisible(x - 80, 280)) return;
    const open = state.collected >= REQUIRED_VEGGIES;
    ctx.save(); ctx.translate(x + w / 2, y + h / 2);
    const pulse = 1 + Math.sin(state.time * 2.3) * .025;
    ctx.scale(pulse, pulse);
    const glow = ctx.createRadialGradient(0, 0, 15, 0, 0, 118);
    glow.addColorStop(0, open ? 'rgba(185,255,231,.72)' : 'rgba(255,196,231,.42)');
    glow.addColorStop(.45, open ? 'rgba(149,224,255,.27)' : 'rgba(177,125,221,.19)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, 118, 0, Math.PI * 2); ctx.fill();
    ctx.shadowColor = open ? '#aaf7e3' : '#d8a5ea'; ctx.shadowBlur = 24;
    ctx.lineWidth = 18; ctx.lineCap = 'round';
    const frame = ctx.createLinearGradient(-50, -80, 55, 80);
    frame.addColorStop(0, '#fff4ff'); frame.addColorStop(.42, open ? '#b5f3e0' : '#d4b2ef'); frame.addColorStop(1, '#8370c4');
    ctx.strokeStyle = frame;
    ctx.beginPath(); ctx.arc(0, 0, 58, Math.PI, Math.PI * 2); ctx.lineTo(58, 78); ctx.lineTo(-58, 78); ctx.closePath(); ctx.stroke();
    ctx.shadowBlur = 8;
    const inside = ctx.createRadialGradient(-12, -20, 3, 0, 0, 70);
    inside.addColorStop(0, open ? '#eafff6' : '#5d416e');
    inside.addColorStop(.4, open ? '#85dfea' : '#6d4c80');
    inside.addColorStop(1, open ? '#7159a9' : '#2b1d42');
    ctx.fillStyle = inside;
    ctx.beginPath(); ctx.arc(0, 0, 48, Math.PI, Math.PI * 2); ctx.lineTo(48, 74); ctx.lineTo(-48, 74); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = open ? .82 : .26;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 7; i++) {
      const a = state.time * .5 + i * .9;
      const r = 18 + (i % 3) * 12;
      ctx.beginPath(); ctx.arc(Math.cos(a) * r, Math.sin(a * 1.2) * 50, 2 + i % 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    ctx.save(); ctx.translate(x + w / 2, y - 28);
    ctx.fillStyle = 'rgba(25,12,42,.72)'; roundedPath(ctx, -64, -17, 128, 34, 17); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = '800 14px ui-rounded, system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(open ? '꿈문 OPEN ✦' : `${state.collected} / ${REQUIRED_VEGGIES}`, 0, 0);
    ctx.restore();
  }

  function drawPlayer() {
    const blink = player.invincible > 0 && Math.floor(player.invincible * 10) % 2 === 0;
    if (blink) return;
    const x = player.x + player.w / 2;
    const y = player.y + player.h;
    const airborne = !player.grounded;
    const bob = player.grounded ? Math.sin(player.runCycle) * Math.min(3.5, Math.abs(player.vx) * .01) : 0;
    const tilt = airborne ? Math.max(-.12, Math.min(.12, player.vx / 2200)) : Math.sin(player.runCycle) * Math.min(.045, Math.abs(player.vx) / 9000);
    const stretch = airborne ? Math.max(-.07, Math.min(.08, -player.vy / 6500)) : 0;
    const sx = 1 - player.squash + stretch;
    const sy = 1 + player.squash - stretch;

    ctx.save();
    ctx.fillStyle = 'rgba(24,10,38,.25)';
    ctx.beginPath(); ctx.ellipse(x, y + 4, 39 * (1 - Math.min(.35, Math.abs(player.y - 488) / 360)), 10, 0, 0, Math.PI * 2); ctx.fill();
    if (player.landingPulse > 0) {
      ctx.strokeStyle = `rgba(224,190,255,${player.landingPulse * .45})`; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse(x, y + 1, 42 + (1 - player.landingPulse) * 40, 9 + (1 - player.landingPulse) * 8, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.translate(x, y - player.h / 2 + bob);
    ctx.rotate(tilt);
    ctx.scale(player.facing * sx, sy);
    const glow = ctx.createRadialGradient(13, 12, 4, 13, 12, 68);
    glow.addColorStop(0, 'rgba(255,170,228,.35)'); glow.addColorStop(1, 'rgba(255,170,228,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(13, 12, 68, 0, Math.PI * 2); ctx.fill();
    ctx.shadowColor = 'rgba(15,5,25,.38)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 10;
    if (snailImage.complete && snailImage.naturalWidth) {
      ctx.drawImage(snailImage, -player.w * .5, -player.h * .5, player.w, player.h);
    } else {
      ctx.fillStyle = '#fff'; roundedPath(ctx, -28, -45, 56, 90, 20); ctx.fill();
    }
    ctx.restore();
  }

  function drawParticles() {
    for (const p of particles) {
      const alpha = Math.max(0, Math.min(1, p.life / Math.max(.01, p.max)));
      ctx.save(); ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color; ctx.shadowBlur = 9;
      if (p.shape === 'star') {
        ctx.rotate(state.time * 3 + p.x * .01);
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = i * Math.PI / 4;
          const r = i % 2 ? p.size * .32 : p.size;
          ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath(); ctx.fill();
      } else if (p.shape === 'cloud') {
        ctx.beginPath(); ctx.arc(-p.size * .25, 0, p.size * .5, 0, Math.PI * 2); ctx.arc(p.size * .2, -p.size * .12, p.size * .6, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(0, 0, p.size, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawForegroundGlow(p) {
    const vignette = ctx.createRadialGradient(W * .5, H * .44, H * .18, W * .5, H * .5, W * .7);
    vignette.addColorStop(0, 'rgba(255,255,255,0)');
    vignette.addColorStop(.72, 'rgba(20,7,35,.03)');
    vignette.addColorStop(1, 'rgba(13,5,25,.34)');
    ctx.fillStyle = vignette; ctx.fillRect(0, 0, W, H);

    const bottomGlow = ctx.createLinearGradient(0, H - 150, 0, H);
    bottomGlow.addColorStop(0, 'rgba(255,255,255,0)');
    bottomGlow.addColorStop(1, mixColor(p.glow, '#ffffff', .1).replace('rgb', 'rgba').replace(')', ', .08)'));
    ctx.fillStyle = bottomGlow; ctx.fillRect(0, H - 150, W, 150);
  }

  function loop(now) {
    const dt = Math.min(.034, Math.max(0, (now - state.lastTime) / 1000));
    state.lastTime = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
})();
