(() => {
  'use strict';

  const Physics = globalThis.MongsilPhysics;
  const StageLib = globalThis.MongsilStages;
  if (!Physics || !StageLib) {
    console.error('physics.js and stages.js must load before game.js');
    return;
  }

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const W = canvas.width;
  const H = canvas.height;

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
    resultPobi: document.getElementById('result-pobi'),
    toast: document.getElementById('toast'),
    leftButton: document.getElementById('left-button'),
    rightButton: document.getElementById('right-button'),
    jumpButton: document.getElementById('jump-button'),
    mobileControls: document.getElementById('mobile-controls'),
    keyHud: document.getElementById('key-hud'),
    nameEntry: document.getElementById('name-entry'),
    nameInput: document.getElementById('name-input'),
    nameSubmit: document.getElementById('name-submit'),
    startLeaderboard: document.getElementById('start-leaderboard'),
    resultLeaderboard: document.getElementById('result-leaderboard')
  };

  const snailImage = new Image();
  snailImage.src = document.querySelector('.hero-snail')?.src || 'assets/snail.png?v=2';
  const pobiImage = new Image();
  pobiImage.src = 'assets/pobi.png?v=3';

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
    stageIndex: 0,
    stagesCleared: 0,
    combo: 0,
    comboTimer: 0,
    toastTimer: 0,
    shake: 0,
    flash: 0,
    sound: true,
    lastTime: performance.now(),
    portalNotice: 0,
    worldW: 4200,
    requiredVeggies: 6,
    jumpWasHeld: false,
    hasKey: false,
    stageStart: 0,
    comboMilestone: false
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

  let currentStage = null;
  const platforms = [];
  const hazards = [];
  const collectibles = [];
  const enemies = [];
  const particles = [];
  const decor = [];
  const specials = [];
  const pits = [];
  const bgIslands = [];
  const bgClouds = [];
  const stars = [];

  function seededRandom(seed) {
    let t = seed >>> 0;
    return () => {
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ t >>> 15, 1 | t);
      r ^= r + Math.imul(r ^ r >>> 7, 61 | r);
      return ((r ^ r >>> 14) >>> 0) / 4294967296;
    };
  }

  function clearArrays() {
    platforms.length = hazards.length = collectibles.length = enemies.length = 0;
    decor.length = specials.length = particles.length = 0;
  }

  function loadStage(index, keepScore) {
    const stage = StageLib.getStage(index);
    currentStage = stage;
    state.stageIndex = index;
    state.worldW = stage.worldW;
    state.requiredVeggies = stage.requiredVeggies;
    state.collected = 0;
    state.checkpoint = 0;
    state.checkpointX = stage.spawn.x;
    state.combo = 0;
    state.comboTimer = 0;
    state.portalNotice = 0;
    state.hasKey = false;
    state.stageStart = state.time;
    state.comboMilestone = false;
    if (!keepScore) {
      state.score = 0;
      state.lives = 4;
      state.stagesCleared = 0;
    }

    clearArrays();
    const built = stage.build();
    built.platforms.forEach((p) => {
      if (p.kind === 'fallblock') {
        platforms.push({
          ...p,
          homeY: p.homeY ?? p.y,
          triggered: false,
          fallTimer: 0,
          vy: 0,
          gone: false
        });
      } else {
        platforms.push(p);
      }
    });
    built.hazards.forEach((h) => hazards.push(h));
    built.collectibles.forEach((v) => collectibles.push(v));
    built.enemies.forEach((e) => enemies.push(e));
    built.decor.forEach((d) => decor.push(d));
    (built.specials || []).forEach((s) => specials.push(s));

    player.x = stage.spawn.x;
    player.y = stage.spawn.y;
    player.prevX = player.x;
    player.prevY = player.y;
    player.vx = 0;
    player.vy = 0;
    player.grounded = false;
    player.coyote = 0;
    player.jumpBuffer = 0;
    player.facing = 1;
    player.invincible = 0;
    player.squash = 0;
    player.landingPulse = 0;

    state.cameraX = 0;
    state.targetCameraX = 0;
    computePits();
    buildBackground(stage.worldW);
    updateHUD();
  }

  // Fall-to-death gaps between ground segments. Rendered as ominous abysses so
  // players read them as traps, not just lower terrain.
  function computePits() {
    pits.length = 0;
    const grounds = platforms.filter((p) => p.kind === 'ground').sort((a, b) => a.x - b.x);
    for (let i = 1; i < grounds.length; i++) {
      const x0 = grounds[i - 1].x + grounds[i - 1].w;
      const x1 = grounds[i].x;
      if (x1 - x0 > 40) pits.push({ x0, x1, top: Math.min(grounds[i - 1].y, grounds[i].y) });
    }
  }

  function buildBackground(worldW) {
    const concept = currentStage?.concept || 'forest';
    const rnd = seededRandom(240513 + state.stageIndex * 97);
    stars.length = bgIslands.length = bgClouds.length = 0;

    // Stage identity: star density, cloud density, island density
    const profile = {
      forest: { stars: 70, clouds: 28, islands: 14 },
      clouds: { stars: 90, clouds: 48, islands: 10 },
      garden_challenge: { stars: 110, clouds: 22, islands: 16 },
      factory: { stars: 45, clouds: 18, islands: 8 },
      summit_finale: { stars: 180, clouds: 16, islands: 20 }
    }[concept] || { stars: 100, clouds: 30, islands: 16 };

    for (let i = 0; i < profile.stars; i++) {
      stars.push({
        x: rnd() * (W + 300),
        y: 30 + rnd() * (concept === 'summit_finale' ? 420 : 360),
        r: 0.55 + rnd() * (concept === 'summit_finale' ? 2.6 : 1.9),
        tw: rnd() * 6.28,
        layer: 0.02 + rnd() * 0.07
      });
    }
    for (let i = 0; i < profile.clouds; i++) {
      bgClouds.push({
        x: rnd() * worldW,
        y: 70 + rnd() * (concept === 'clouds' ? 360 : 300),
        s: 0.45 + rnd() * (concept === 'clouds' ? 1.5 : 1.15),
        layer: 0.07 + rnd() * 0.2,
        phase: rnd() * 6.28
      });
    }
    for (let i = 0; i < profile.islands; i++) {
      bgIslands.push({
        x: 200 + rnd() * Math.max(400, worldW - 400),
        y: 220 + rnd() * 240,
        s: 0.45 + rnd() * 1.2,
        layer: 0.16 + rnd() * 0.22,
        hue: rnd(),
        phase: rnd() * 6.28,
        kind: concept === 'factory' ? 'chimney' : concept === 'forest' ? 'tree_isle' : 'isle'
      });
    }
  }

  loadStage(0, false);

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
      this.master.gain.value = 0.22;
      this.master.connect(this.ctx.destination);
    }
    setEnabled(enabled) {
      if (!this.ctx || !this.master) return;
      this.master.gain.setTargetAtTime(enabled ? 0.22 : 0, this.ctx.currentTime, 0.03);
      if (enabled && state.mode === 'playing') this.startMusic();
      else this.stopMusic();
    }
    tone(freq, duration = 0.1, type = 'sine', volume = 0.18, slide = 1) {
      if (!state.sound) return;
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), now + duration);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(volume, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(now);
      osc.stop(now + duration + 0.02);
    }
    chord(notes, duration = 0.8, volume = 0.025) {
      if (!state.sound || !this.ctx) return;
      notes.forEach((n, i) => {
        setTimeout(() => this.tone(n, duration, i % 2 ? 'sine' : 'triangle', volume, 1.002), i * 70);
      });
    }
    startMusic() {
      if (!state.sound || this.musicTimer) return;
      this.init();
      const chords = [
        [261.63, 329.63, 392.0],
        [293.66, 369.99, 440.0],
        [246.94, 329.63, 415.3],
        [220.0, 293.66, 369.99]
      ];
      const tick = () => {
        if (state.mode !== 'playing' || !state.sound) return;
        this.chord(chords[this.step % chords.length], 1.35, 0.022);
        this.step++;
      };
      tick();
      this.musicTimer = setInterval(tick, 1550);
    }
    stopMusic() {
      if (this.musicTimer) clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    jump() {
      this.tone(420, 0.13, 'sine', 0.11, 1.55);
    }
    collect(combo = 0) {
      this.tone(640 + combo * 35, 0.12, 'triangle', 0.13, 1.35);
      setTimeout(() => this.tone(890 + combo * 22, 0.1, 'sine', 0.08, 1.12), 55);
    }
    hurt() {
      this.tone(180, 0.28, 'sawtooth', 0.11, 0.55);
    }
    stomp() {
      this.tone(230, 0.12, 'square', 0.07, 1.6);
    }
    checkpoint() {
      [523, 659, 784].forEach((n, i) => setTimeout(() => this.tone(n, 0.25, 'sine', 0.08, 1.08), i * 90));
    }
    win() {
      [523, 659, 784, 1047].forEach((n, i) => setTimeout(() => this.tone(n, 0.45, 'triangle', 0.11, 1.03), i * 120));
    }
    stageClear() {
      [392, 494, 587, 784].forEach((n, i) => setTimeout(() => this.tone(n, 0.28, 'triangle', 0.1, 1.05), i * 100));
    }
  }

  const audio = new DreamAudio();

  function resetGame() {
    state.stagesCleared = 0;
    loadStage(0, false);
  }

  function startGame() {
    resetGame();
    state.mode = 'playing';
    state.jumpWasHeld = false;
    ui.startScreen.classList.remove('is-visible');
    ui.resultScreen.classList.remove('is-visible');
    ui.pauseScreen.classList.remove('is-visible');
    if (ui.resultPobi) ui.resultPobi.classList.remove('is-visible');
    ui.hud.classList.add('is-visible');
    ui.hud.setAttribute('aria-hidden', 'false');
    ui.mobileControls.classList.add('is-visible');
    audio.init();
    audio.setEnabled(state.sound);
    const s = StageLib.getStage(0);
    showToast(`${s.name} · 채소 ${s.requiredVeggies}개를 모아 꿈문으로!`);
  }

  function pauseGame(force) {
    if (state.mode === 'menu' || state.mode === 'won' || state.mode === 'gameover') return;
    const shouldPause = force ?? state.mode === 'playing';
    state.mode = shouldPause ? 'paused' : 'playing';
    ui.pauseScreen.classList.toggle('is-visible', shouldPause);
    ui.pauseScreen.setAttribute('aria-hidden', String(!shouldPause));
    ui.mobileControls.classList.toggle('is-visible', !shouldPause);
    if (shouldPause) audio.stopMusic();
    else audio.startMusic();
  }

  function readBestScore() {
    try {
      return Number(localStorage.getItem('snailDreamBest') || 0);
    } catch (_) {
      return 0;
    }
  }

  function writeBestScore(value) {
    try {
      localStorage.setItem('snailDreamBest', String(value));
    } catch (_) {
      /* private mode */
    }
  }

  const SCORES_KEY = 'snailDreamScores';
  function readScores() {
    try {
      const raw = localStorage.getItem(SCORES_KEY);
      let arr = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(arr)) arr = [];
      return arr.sort((a, b) => b.score - a.score).slice(0, 10);
    } catch (_) { return []; }
  }
  function writeScores(arr) {
    try { localStorage.setItem(SCORES_KEY, JSON.stringify(arr.slice(0, 10))); } catch (_) {}
  }
  // One-time migration of the legacy single best score into the board.
  // Runs at load, before any new score is written, so it captures the real
  // legacy value (not the current run) and never re-seeds a phantom row.
  function migrateScores() {
    try {
      if (localStorage.getItem(SCORES_KEY)) return;
      const best = readBestScore();
      if (best > 0) {
        writeScores([{ name: '몽실이', score: best, date: new Date().toISOString(), stagesCleared: 0 }]);
      }
    } catch (_) {}
  }
  function qualifiesForBoard(score) {
    if (score <= 0) return false;
    const s = readScores();
    return s.length < 10 || score > (s[s.length - 1]?.score || 0);
  }
  function submitScore(name, score, stages) {
    const s = readScores();
    s.push({ name: (name || '몽실이').slice(0, 8), score, date: new Date().toISOString(), stagesCleared: stages });
    s.sort((a, b) => b.score - a.score);
    const top = s.slice(0, 10);
    writeScores(top);
    return top;
  }
  function renderLeaderboard(el) {
    if (!el) return;
    const s = readScores();
    el.innerHTML = '';
    if (!s.length) {
      const li = document.createElement('li');
      li.className = 'leaderboard-empty';
      li.textContent = '아직 기록이 없어요. 첫 주인공이 되어보세요!';
      el.appendChild(li);
      return;
    }
    s.forEach((e, i) => {
      const li = document.createElement('li');
      if (i === 0) li.className = 'lb-top1';
      const left = document.createElement('span');
      left.className = 'lb-left';
      const rank = document.createElement('span');
      rank.className = 'lb-rank';
      rank.textContent = String(i + 1);
      const nm = document.createElement('span');
      nm.className = 'lb-name';
      nm.textContent = e.name;
      left.appendChild(rank); left.appendChild(nm);
      const sc = document.createElement('span');
      sc.className = 'lb-score';
      sc.textContent = Number(e.score).toLocaleString('ko-KR');
      li.appendChild(left); li.appendChild(sc);
      el.appendChild(li);
    });
  }

  function completeStage() {
    const elapsed = state.time - state.stageStart;
    const targetSec = state.worldW / 260;
    const timeBonus = Math.max(0, Math.min(1200, Math.round((targetSec - elapsed) * 8)));
    const totalVeg = collectibles.filter((v) => v.type !== 'key').length;
    const perfectBonus = state.collected === totalVeg ? 1000 : 0;
    state.score += 1500 + state.lives * 300 + timeBonus + perfectBonus;
    if (perfectBonus) showToast('완벽 수확! +1000 ✦', 2400);
    state.stagesCleared = state.stageIndex + 1;
    audio.stageClear();

    if (state.stageIndex >= StageLib.stageCount() - 1) {
      endGame(true);
      return;
    }

    const next = state.stageIndex + 1;
    const nextStage = StageLib.getStage(next);
    showToast(`스테이지 클리어! → ${nextStage.name}`, 2600);
    loadStage(next, true);
    state.mode = 'playing';
    audio.checkpoint();
  }

  function endGame(won) {
    state.mode = won ? 'won' : 'gameover';
    audio.stopMusic();
    ui.mobileControls.classList.remove('is-visible');
    if (won) audio.win();
    else audio.hurt();
    const best = Math.max(readBestScore(), state.score);
    writeBestScore(best);

    const rescued = won && state.stagesCleared >= StageLib.stageCount();
    ui.resultIcon.textContent = rescued ? '★' : won ? '✦' : '☁';
    ui.resultKicker.textContent = rescued ? 'REBEL RESCUED' : won ? 'DREAM COMPLETE' : 'TRY AGAIN';
    ui.resultTitle.textContent = rescued
      ? '반란군 포비를 구출했어요!'
      : won
        ? `${StageLib.getStage(state.stagesCleared - 1)?.name || '꿈'} 도착!`
        : '꿈길에서 깨어났어요';
    ui.resultMessage.textContent = rescued
      ? '다섯 스테이지를 모두 클리어하고 반란군 포비를 안전하게 구출했습니다. 몽실이와 포비가 함께 미소 지어요!'
      : won
        ? '몽실이가 반짝이는 꿈채소를 품에 안고 무사히 도착했어요.'
        : '괜찮아요. 다음 꿈에서는 장애물을 더 가볍게 넘어봐요!';
    ui.resultVeggies.textContent = `${state.collected}개`;
    ui.resultScore.textContent = state.score.toLocaleString('ko-KR');
    ui.bestScore.textContent = best.toLocaleString('ko-KR');

    if (ui.resultPobi) {
      ui.resultPobi.classList.toggle('is-visible', rescued);
      ui.resultPobi.setAttribute('aria-hidden', String(!rescued));
    }

    const doQualify = qualifiesForBoard(Math.floor(state.score));
    if (ui.nameEntry) ui.nameEntry.hidden = !doQualify;
    if (doQualify && ui.nameInput) { ui.nameInput.value = ''; setTimeout(() => ui.nameInput.focus(), 320); }
    renderLeaderboard(ui.resultLeaderboard);

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
    ui.hearts.textContent = Array.from({ length: 4 }, (_, i) => (i < state.lives ? '♥' : '♡')).join(' ');
    ui.veggie.textContent = `${state.collected} / ${state.requiredVeggies}`;
    ui.score.textContent = String(Math.max(0, Math.floor(state.score))).padStart(6, '0');
    const progress = state.worldW > 0 ? player.x / (state.worldW - 200) : 0;
    ui.progress.style.width = `${Math.min(100, Math.max(0, progress * 100))}%`;
    const stage = StageLib.getStage(state.stageIndex);
    ui.stage.textContent = `S${stage.id} ${stage.name}`;
    if (ui.keyHud) {
      const needsKey = !!currentStage?.needsKey;
      ui.keyHud.hidden = !needsKey;
      ui.keyHud.classList.toggle('has-key', needsKey && state.hasKey);
    }
  }

  function queueJump() {
    input.jumpQueued = true;
    player.jumpBuffer = Physics.DEFAULTS.jumpBufferTime;
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

  window.addEventListener(
    'keydown',
    (event) => {
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
    },
    { passive: false }
  );

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

  if (ui.nameSubmit) {
    const doSubmit = () => {
      const nm = (ui.nameInput?.value || '').trim() || '몽실이';
      submitScore(nm, Math.floor(state.score), state.stagesCleared);
      if (ui.nameEntry) ui.nameEntry.hidden = true;
      renderLeaderboard(ui.resultLeaderboard);
      renderLeaderboard(ui.startLeaderboard);
    };
    ui.nameSubmit.addEventListener('click', doSubmit);
    ui.nameInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doSubmit(); } });
  }

  function rectsOverlap(a, b, inset = 0) {
    return (
      a.x + inset < b.x + b.w &&
      a.x + a.w - inset > b.x &&
      a.y + inset < b.y + b.h &&
      a.y + a.h - inset > b.y
    );
  }

  function updateMovers(dt) {
    for (const p of platforms) {
      if (p.kind !== 'moving') continue;
      if (p.axis === 'y') {
        p.y += p.speed * p.dir * dt;
        if (p.y < p.minY) {
          p.y = p.minY;
          p.dir = 1;
        }
        if (p.y > p.maxY) {
          p.y = p.maxY;
          p.dir = -1;
        }
      } else {
        p.x += p.speed * p.dir * dt;
        if (p.x < p.minX) {
          p.x = p.minX;
          p.dir = 1;
        }
        if (p.x + p.w > p.maxX) {
          p.x = p.maxX - p.w;
          p.dir = -1;
        }
      }
    }
  }

  function updateFallblocks(dt) {
    for (const p of platforms) {
      if (p.kind !== 'fallblock' || p.gone) continue;
      if (p.triggered) {
        p.fallTimer -= dt;
        if (p.fallTimer <= 0) {
          p.vy = (p.vy || 0) + 1800 * dt;
          p.y += p.vy * dt;
          if (p.y > H + 200) p.gone = true;
        }
      }
    }
  }

  function applyWind(dt) {
    const pbox = { x: player.x + 16, y: player.y + 10, w: player.w - 32, h: player.h - 14 };
    for (const s of specials) {
      if (s.type !== 'wind') continue;
      if (rectsOverlap(pbox, s)) {
        player.vx += s.forceX * dt;
        player.vy += s.forceY * dt;
      }
    }
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

    updateMovers(dt);
    updateFallblocks(dt);

    const jumpJustReleased = state.jumpWasHeld && !input.jumpHeld;
    state.jumpWasHeld = input.jumpHeld;

    const h = Physics.stepHorizontal(
      { vx: player.vx, grounded: player.grounded, facing: player.facing },
      input,
      dt
    );
    player.vx = h.vx;
    player.facing = h.facing;
    player.runCycle += h.runDelta;

    const v = Physics.stepVertical(
      {
        vy: player.vy,
        grounded: player.grounded,
        coyote: player.coyote,
        jumpBuffer: player.jumpBuffer
      },
      input,
      dt,
      { jumpJustReleased }
    );
    player.vy = v.vy;
    player.coyote = v.coyote;
    player.jumpBuffer = v.jumpBuffer;
    input.jumpQueued = v.jumpQueued;
    if (v.didJump) {
      player.grounded = false;
      player.squash = -0.12;
      audio.jump();
      emitDust(player.x + player.w * 0.45, player.y + player.h, 6, '#d9b5ff');
    }

    applyWind(dt);

    player.x += player.vx * dt;
    collideHorizontal();
    player.y += player.vy * dt;
    collideVertical();

    if (player.x < 0) {
      player.x = 0;
      player.vx = 0;
    }
    if (player.x > state.worldW - player.w) {
      player.x = state.worldW - player.w;
      player.vx = 0;
    }

    updateEnemies(dt);
    checkCollectibles();
    checkHazards();
    updateCheckpoints();
    checkPortal();

    if (player.y > H + 180) hurtPlayer(player.x, true);

    const lookAhead = player.vx * 0.32;
    state.targetCameraX = Math.max(
      0,
      Math.min(state.worldW - W, player.x - W * 0.31 + lookAhead)
    );
    state.cameraX += (state.targetCameraX - state.cameraX) * Math.min(1, dt * 4.8);

    updateHUD();
  }

  function collideHorizontal() {
    const box = { x: player.x + 12, y: player.y + 10, w: player.w - 24, h: player.h - 13 };
    for (const p of platforms) {
      if (p.gone) continue;
      if (!rectsOverlap(box, p)) continue;
      const prevBox = {
        x: player.prevX + 12,
        y: player.prevY + 10,
        w: player.w - 24,
        h: player.h - 13
      };
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
    const prevBox = {
      x: player.prevX + 16,
      y: player.prevY + 6,
      w: player.w - 30,
      h: player.h - 6
    };
    for (const p of platforms) {
      if (p.gone) continue;
      if (!rectsOverlap(box, p)) continue;
      if (player.vy >= 0 && prevBox.y + prevBox.h <= p.y + 16) {
        if (p.kind === 'bouncepad') {
          player.y = p.y - player.h;
          player.vy = -1050;
          player.grounded = false;
          player.squash = -0.2;
          audio.jump();
          emitDust(player.x + player.w * 0.5, p.y, 8, '#9ff0d8');
          box.y = player.y + 6;
          continue;
        }
        const hardLanding = player.vy > 650;
        player.y = p.y - player.h;
        player.vy = 0;
        player.grounded = true;
        player.coyote = Physics.DEFAULTS.coyoteTime;
        // Ride moving platforms horizontally
        if (p.kind === 'moving' && p.axis !== 'y') {
          player.x += p.speed * p.dir * (1 / 60);
        }
        box.y = player.y + 6;
        if (hardLanding) {
          player.squash = 0.15;
          player.landingPulse = 1;
          emitDust(player.x + player.w * 0.5, p.y, 9, '#d7c0ff');
        }
        if (p.kind === 'fallblock' && !p.triggered) { p.triggered = true; p.fallTimer = 0.35; }
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
      e.phase += dt * (e.kind === 'shadow_bat' ? 4.2 : 2.4);
      e.x += e.speed * e.dir * dt;
      if (e.x < e.minX) {
        e.x = e.minX;
        e.dir = 1;
      }
      if (e.x + e.w > e.maxX) {
        e.x = e.maxX - e.w;
        e.dir = -1;
      }
      if (e.kind === 'shadow_bat' && e.baseY != null) {
        e.y = e.baseY + Math.sin(e.phase) * 28;
      }
      const pbox = { x: player.x + 13, y: player.y + 11, w: player.w - 26, h: player.h - 13 };
      if (rectsOverlap(pbox, e, 4)) {
        const prevBottom = player.prevY + player.h;
        if (player.vy > 120 && prevBottom <= e.y + 16) {
          e.alive = false;
          player.vy = -520;
          state.score += e.kind === 'shadow_bat' ? 320 : 240;
          audio.stomp();
          emitBurst(e.x + e.w / 2, e.y + e.h / 2, '#f3b7e3', 15);
        } else {
          hurtPlayer(e.x + e.w / 2, false);
        }
      }
    }
  }

  function checkCollectibles() {
    const cx = player.x + player.w * 0.5;
    const cy = player.y + player.h * 0.48;
    for (const v of collectibles) {
      if (v.collected) continue;
      const dx = cx - v.x;
      const dy = cy - v.y;
      if (dx * dx + dy * dy < 62 * 62) {
        if (v.type === 'key') {
          v.collected = true;
          state.hasKey = true;
          audio.checkpoint();
          emitBurst(v.x, v.y, '#ffe08a', 24);
          showToast('은하 열쇠 획득! 꿈문을 열 수 있어요 🔑', 2600);
          updateHUD();
          continue;
        }
        v.collected = true;
        state.collected++;
        state.combo = state.comboTimer > 0 ? Math.min(9, state.combo + 1) : 1;
        state.comboTimer = 2.4;
        state.score += 100 * state.combo;
        if (state.combo === 9 && !state.comboMilestone) {
          state.score += 500;
          state.comboMilestone = true;
          showToast('9콤보 폭발! +500 🌟', 2200);
        }
        audio.collect(state.combo);
        const colors = {
          lettuce: '#a8f2b3',
          cabbage: '#d8f0a4',
          carrot: '#ffad73',
          radish: '#ff9fcf'
        };
        emitBurst(v.x, v.y, colors[v.type], 18);
        const names = {
          lettuce: '꼬마 상추',
          cabbage: '몽글 배추',
          carrot: '별빛 당근',
          radish: '분홍 무'
        };
        if (state.combo >= 3) showToast(`${names[v.type]} 획득 · ${state.combo}콤보!`);
        if (state.collected === state.requiredVeggies) {
          showToast('꿈문을 열 만큼 모았어요! 끝까지 가요 ✦', 2800);
          audio.checkpoint();
        }
      }
    }
  }

  function checkHazards() {
    const pbox = { x: player.x + 18, y: player.y + 14, w: player.w - 34, h: player.h - 18 };
    for (const h of hazards) {
      let hitbox;
      if (h.type === 'puddle') {
        hitbox = { x: h.x + 8, y: h.y + 7, w: h.w - 16, h: h.h - 3 };
      } else if (h.type === 'thorn') {
        hitbox = { x: h.x + 6, y: h.y + 8, w: h.w - 12, h: h.h - 6 };
      } else {
        hitbox = { x: h.x + 12, y: h.y + 12, w: h.w - 24, h: h.h - 10 };
      }
      if (rectsOverlap(pbox, hitbox)) {
        hurtPlayer(h.x + h.w / 2, false);
        return;
      }
    }
  }

  function updateCheckpoints() {
    const list = currentStage?.checkpoints || [];
    for (let i = list.length - 1; i >= 0; i--) {
      if (player.x >= list[i].trigger && i > state.checkpoint) {
        state.checkpoint = i;
        state.checkpointX = list[i].x;
        showToast('반짝이는 이슬에 진행 지점을 저장했어요 ✦');
        audio.checkpoint();
        emitBurst(player.x + player.w / 2, player.y + player.h / 2, '#aaf3ff', 22);
        break;
      }
    }
  }

  function checkPortal() {
    const portal = currentStage?.portal;
    if (!portal) return;
    const pbox = { x: player.x + 14, y: player.y + 10, w: player.w - 24, h: player.h - 10 };
    if (rectsOverlap(pbox, portal)) {
      const gateOk = state.collected >= state.requiredVeggies && (!currentStage.needsKey || state.hasKey);
      if (gateOk) {
        completeStage();
      } else if (!state.portalNotice || state.time - state.portalNotice > 2.5) {
        let msg;
        if (state.collected < state.requiredVeggies) {
          msg = `꿈문이 졸고 있어요. 채소 ${state.requiredVeggies - state.collected}개를 더 모아 주세요!`;
        } else {
          msg = '은하 열쇠가 필요해요! 맵에서 🔑 를 찾아보세요.';
        }
        showToast(msg, 2600);
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
    state.flash = 0.65;
    audio.hurt();
    emitBurst(player.x + player.w / 2, player.y + player.h / 2, '#ff9dcc', 20);
    if (state.lives <= 0) {
      endGame(false);
      return;
    }
    showToast(fell ? '구름 아래로 퐁! 이슬 지점에서 다시 시작해요.' : '앗, 반짝 장애물에 닿았어요!');
    // Reset fallblocks so gauntlet death never soft-locks progress
    for (const p of platforms) {
      if (p.kind !== 'fallblock') continue;
      p.gone = false;
      p.triggered = false;
      p.fallTimer = 0;
      p.vy = 0;
      p.y = p.homeY ?? p.y;
    }
    player.x = state.checkpointX;
    {
      const sx = state.checkpointX + player.w * 0.5;
      let landY = 360, topFound = Infinity;
      for (const p of platforms) {
        if (p.kind === 'moving' || p.kind === 'fallblock' || p.gone) continue;
        if (sx >= p.x && sx <= p.x + p.w && p.y < topFound) { topFound = p.y; landY = p.y - player.h; }
      }
      player.y = landY;
    }
    player.prevX = player.x;
    player.prevY = player.y;
    player.vx = sourceX < player.x ? 170 : -170;
    player.vy = -180;
    player.invincible = 2.1;
    state.cameraX = Math.max(0, player.x - W * 0.28);
    state.targetCameraX = state.cameraX;
    updateHUD();
  }

  function emitBurst(x, y, color, count = 14) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 70 + Math.random() * 230;
      particles.push({
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed - 50,
        life: 0.55 + Math.random() * 0.65,
        max: 1.2,
        size: 3 + Math.random() * 7,
        color,
        shape: Math.random() < 0.42 ? 'star' : 'orb',
        gravity: 240
      });
    }
  }

  function emitDust(x, y, count, color) {
    for (let i = 0; i < count; i++) {
      particles.push({
        x: x + (Math.random() - 0.5) * 42,
        y: y - Math.random() * 8,
        vx: (Math.random() - 0.5) * 80,
        vy: -30 - Math.random() * 70,
        life: 0.35 + Math.random() * 0.3,
        max: 0.7,
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
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.max(0, 1 - dt * 1.2);
    }
  }

  function hexToRgb(hex) {
    const value = hex.replace('#', '');
    const n = parseInt(value.length === 3 ? value.split('').map((c) => c + c).join('') : value, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mixColor(a, b, t) {
    const A = hexToRgb(a);
    const B = hexToRgb(b);
    const C = A.map((v, i) => Math.round(v + (B[i] - v) * t));
    return `rgb(${C[0]}, ${C[1]}, ${C[2]})`;
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

  function drawPits() {
    for (const pit of pits) {
      const w = pit.x1 - pit.x0;
      if (!isVisible(pit.x0, w)) continue;
      const top = pit.top; // ~600, ground surface line

      // 1. Deep abyss: dark void deepening toward the bottom of the screen.
      const g = ctx.createLinearGradient(0, top - 6, 0, H);
      g.addColorStop(0, 'rgba(8,3,16,0)');
      g.addColorStop(0.16, 'rgba(11,4,22,0.92)');
      g.addColorStop(1, 'rgba(1,0,4,1)');
      ctx.fillStyle = g;
      ctx.fillRect(pit.x0 - 2, top - 6, w + 4, H - top + 80);

      // 2. Broken, jagged rim so the ground looks torn open.
      ctx.save();
      ctx.fillStyle = 'rgba(6,2,12,0.96)';
      const teeth = Math.max(3, Math.floor(w / 26));
      ctx.beginPath();
      ctx.moveTo(pit.x0, top - 2);
      for (let i = 0; i <= teeth; i++) {
        const tx = pit.x0 + (w * i) / teeth;
        ctx.lineTo(tx, top + (i % 2 ? 22 : 5));
      }
      ctx.lineTo(pit.x1, top - 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // 3. Pulsing danger glow on both cliff walls.
      const pulse = 0.5 + 0.5 * Math.sin(state.time * 4 + pit.x0 * 0.01);
      ctx.save();
      ctx.strokeStyle = `rgba(255,86,140,${0.32 + 0.42 * pulse})`;
      ctx.shadowColor = 'rgba(255,70,130,0.9)';
      ctx.shadowBlur = 14;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(pit.x0 + 2, top - 4);
      ctx.lineTo(pit.x0 + 2, top + 48);
      ctx.moveTo(pit.x1 - 2, top - 4);
      ctx.lineTo(pit.x1 - 2, top + 48);
      ctx.stroke();
      ctx.restore();

      // 4. Menacing spikes rising out of the dark in the visible band.
      ctx.save();
      const sN = Math.max(2, Math.floor(w / 62));
      const baseY = H - 6;
      for (let i = 0; i < sN; i++) {
        const sx = pit.x0 + (w * (i + 0.5)) / sN;
        const peak = 46 + Math.sin(state.time * 2 + i) * 5;
        const g2 = ctx.createLinearGradient(sx, baseY - peak, sx, baseY);
        g2.addColorStop(0, 'rgba(255,96,134,0.92)');
        g2.addColorStop(1, 'rgba(70,10,35,0.15)');
        ctx.fillStyle = g2;
        ctx.beginPath();
        ctx.moveTo(sx - 13, baseY);
        ctx.lineTo(sx, baseY - peak);
        ctx.lineTo(sx + 13, baseY);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function draw() {
    const palette = currentStage?.palette || StageLib.getStage(0).palette;
    drawBackground(palette);

    ctx.save();
    if (state.shake > 0) {
      const mag = 9 * state.shake;
      ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
    }
    ctx.translate(-state.cameraX, 0);

    drawBackDecor(palette);
    drawPits(palette);
    for (const p of platforms) if (!p.gone && isVisible(p.x, p.w)) drawPlatform(p, palette);
    for (const d of decor) if (isVisible(d.x, 100)) drawDecor(d);
    for (const s of specials) if (isVisible(s.x, s.w || 100)) drawSpecial(s);
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
      ctx.fillStyle = `rgba(255, 167, 214, ${state.flash * 0.22})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function isVisible(x, w = 0) {
    return x + w > state.cameraX - 180 && x < state.cameraX + W + 180;
  }

  function drawBackground(p) {
    const concept = currentStage?.concept || 'forest';
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, p.skyTop);
    sky.addColorStop(0.58, mixColor(p.skyTop, p.skyBottom, 0.58));
    sky.addColorStop(1, p.skyBottom);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Soft nebula blotches on summit / garden for depth without clutter
    if (concept === 'summit_finale' || concept === 'garden_challenge') {
      for (let i = 0; i < 4; i++) {
        const nx = ((i * 310 - state.cameraX * 0.02) % (W + 200) + W + 200) % (W + 200) - 80;
        const ny = 90 + i * 55;
        const ng = ctx.createRadialGradient(nx, ny, 10, nx, ny, 140);
        ng.addColorStop(0, concept === 'summit_finale' ? 'rgba(140,170,255,.14)' : 'rgba(255,150,210,.1)');
        ng.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = ng;
        ctx.beginPath();
        ctx.arc(nx, ny, 140, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const moonX = 1010 - ((state.cameraX * 0.03) % 1300);
    const moonY = 118 + Math.sin(state.time * 0.2) * 4;
    const moonScale = concept === 'factory' ? 0.72 : concept === 'summit_finale' ? 1.15 : 1;
    const moonGlow = ctx.createRadialGradient(moonX, moonY, 10, moonX, moonY, 125 * moonScale);
    if (concept === 'factory') {
      moonGlow.addColorStop(0, 'rgba(255,220,170,.55)');
      moonGlow.addColorStop(0.28, 'rgba(255,160,110,.22)');
      moonGlow.addColorStop(1, 'rgba(255,160,110,0)');
    } else {
      moonGlow.addColorStop(0, 'rgba(255,247,255,.72)');
      moonGlow.addColorStop(0.28, 'rgba(255,207,239,.32)');
      moonGlow.addColorStop(1, 'rgba(255,207,239,0)');
    }
    ctx.fillStyle = moonGlow;
    ctx.beginPath();
    ctx.arc(moonX, moonY, 125 * moonScale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = concept === 'factory' ? 'rgba(255,236,200,.86)' : 'rgba(255,250,255,.83)';
    ctx.beginPath();
    ctx.arc(moonX, moonY, 44 * moonScale, 0, Math.PI * 2);
    ctx.fill();

    for (const s of stars) {
      const x = (((s.x - state.cameraX * s.layer) % (W + 300)) + (W + 300)) % (W + 300) - 120;
      const a = 0.35 + 0.55 * (0.5 + 0.5 * Math.sin(state.time * 2 + s.tw));
      ctx.fillStyle = `rgba(255,247,255,${a})`;
      ctx.beginPath();
      ctx.arc(x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    drawHillLayer(p.far, 500, 64, 0.055, 300, 0.55);
    drawHillLayer(p.mid, 555, 88, 0.12, 260, 0.76);

    // Forest midground tree silhouettes for stage-1 identity
    if (concept === 'forest') {
      drawForestSilhouettes(p);
    }
    // Factory chimney row for stage-4 skyline
    if (concept === 'factory') {
      drawFactorySkyline(p);
    }
    // Garden trellis / moon arches for stage-3 identity
    if (concept === 'garden_challenge') {
      drawGardenTrellis(p);
    }

    for (const c of bgClouds) {
      const x = c.x - state.cameraX * c.layer;
      if (x < -240 || x > W + 240) continue;
      drawCloud(x, c.y + Math.sin(state.time * 0.28 + c.phase) * 5, c.s, c.layer > 0.16 ? 0.22 : 0.12);
    }
    for (const island of bgIslands) {
      const x = island.x - state.cameraX * island.layer;
      if (x < -260 || x > W + 260) continue;
      drawFloatingIsland(
        x,
        island.y + Math.sin(state.time * 0.35 + island.phase) * 7,
        island.s,
        island.hue,
        p,
        island.kind
      );
    }

    const haze = ctx.createLinearGradient(0, 360, 0, H);
    haze.addColorStop(0, 'rgba(255,255,255,0)');
    haze.addColorStop(
      1,
      concept === 'factory' ? 'rgba(255,180,120,.14)' : 'rgba(255,220,248,.16)'
    );
    ctx.fillStyle = haze;
    ctx.fillRect(0, 300, W, H - 300);
  }

  function drawForestSilhouettes(p) {
    const period = 420;
    const offset = -((state.cameraX * 0.09) % period);
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = mixColor(p.far, '#1a0e28', 0.35);
    for (let x = offset - period; x < W + period; x += period) {
      const h = 90 + ((Math.sin(x * 0.02) + 1) * 35);
      ctx.beginPath();
      ctx.moveTo(x, 560);
      ctx.lineTo(x + 18, 560 - h);
      ctx.lineTo(x + 36, 560);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + 50, 560);
      ctx.lineTo(x + 78, 560 - h * 0.75);
      ctx.lineTo(x + 106, 560);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawFactorySkyline(p) {
    const period = 520;
    const offset = -((state.cameraX * 0.1) % period);
    ctx.save();
    ctx.globalAlpha = 0.32;
    ctx.fillStyle = mixColor(p.mid, '#3a1824', 0.4);
    for (let x = offset - period; x < W + period; x += period) {
      // Block + chimney
      ctx.fillRect(x + 20, 470, 70, 120);
      ctx.fillRect(x + 40, 400, 22, 70);
      ctx.fillRect(x + 110, 500, 90, 90);
      ctx.fillRect(x + 150, 440, 18, 60);
      // Soft exhaust puffs
      ctx.globalAlpha = 0.14;
      ctx.fillStyle = 'rgba(255,220,200,.9)';
      ctx.beginPath();
      ctx.ellipse(x + 51, 385 + Math.sin(state.time + x) * 4, 16, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.32;
      ctx.fillStyle = mixColor(p.mid, '#3a1824', 0.4);
    }
    ctx.restore();
  }

  function drawGardenTrellis(p) {
    const period = 480;
    const offset = -((state.cameraX * 0.085) % period);
    ctx.save();
    ctx.globalAlpha = 0.26;
    ctx.strokeStyle = mixColor(p.mid, '#2a1838', 0.25);
    ctx.fillStyle = mixColor(p.far, '#3a2050', 0.2);
    ctx.lineWidth = 3;
    for (let x = offset - period; x < W + period; x += period) {
      // Moon arch
      ctx.beginPath();
      ctx.arc(x + 90, 520, 55, Math.PI, 0);
      ctx.stroke();
      // Trellis posts + vine blobs
      ctx.fillRect(x + 40, 480, 8, 90);
      ctx.fillRect(x + 140, 480, 8, 90);
      ctx.beginPath();
      ctx.ellipse(x + 90, 500, 40, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = mixColor(p.glow, '#ffb0d8', 0.3);
      ctx.globalAlpha = 0.18;
      ctx.beginPath();
      ctx.arc(x + 70, 490, 8, 0, Math.PI * 2);
      ctx.arc(x + 110, 495, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.26;
      ctx.fillStyle = mixColor(p.far, '#3a2050', 0.2);
    }
    ctx.restore();
  }

  function drawHillLayer(color, base, amp, speed, period, alpha) {
    const offset = -((state.cameraX * speed) % period);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-period, H);
    for (let x = -period + offset; x <= W + period; x += 12) {
      const y =
        base -
        Math.sin(((x + state.cameraX * speed) / period) * Math.PI * 2) * amp * 0.45 -
        Math.sin(((x + state.cameraX * speed) / (period * 0.63)) * Math.PI * 2) * amp * 0.21;
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

  function drawFloatingIsland(x, y, s, hue, p, kind = 'isle') {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.globalAlpha = 0.36;
    if (kind === 'chimney') {
      ctx.fillStyle = mixColor(p.groundDark, '#402028', 0.3);
      ctx.fillRect(-28, -50, 56, 90);
      ctx.fillRect(-10, -80, 20, 30);
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = 'rgba(255,200,180,.8)';
      ctx.beginPath();
      ctx.ellipse(0, -90, 18, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    const g = ctx.createLinearGradient(0, -20, 0, 80);
    g.addColorStop(0, mixColor(p.groundTop, '#ffffff', 0.2));
    g.addColorStop(0.24, p.groundBody);
    g.addColorStop(1, p.groundDark);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-78, -12);
    ctx.quadraticCurveTo(0, -34, 78, -12);
    ctx.quadraticCurveTo(44, 42, 4, 74);
    ctx.quadraticCurveTo(-45, 38, -78, -12);
    ctx.fill();
    ctx.fillStyle = hue > 0.5 ? 'rgba(255,196,235,.65)' : 'rgba(171,244,255,.58)';
    ctx.beginPath();
    ctx.ellipse(0, -15, 80, 17, 0, 0, Math.PI * 2);
    ctx.fill();
    if (kind === 'tree_isle') {
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = mixColor(p.far, '#2a1840', 0.2);
      ctx.beginPath();
      ctx.moveTo(-12, -18);
      ctx.lineTo(0, -70);
      ctx.lineTo(12, -18);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawBackDecor() {
    const concept = currentStage?.concept || 'forest';
    const start = Math.floor((state.cameraX - 300) / 900) * 900;
    for (let x = start; x < state.cameraX + W + 500; x += 900) {
      const grad = ctx.createLinearGradient(x, 90, x + 180, 590);
      if (concept === 'factory') {
        grad.addColorStop(0, 'rgba(255,200,140,.07)');
        grad.addColorStop(1, 'rgba(255,140,80,0)');
      } else if (concept === 'summit_finale') {
        grad.addColorStop(0, 'rgba(180,200,255,.1)');
        grad.addColorStop(1, 'rgba(140,160,255,0)');
      } else {
        grad.addColorStop(0, 'rgba(255,255,255,.08)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
      }
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(x + 120, 20);
      ctx.lineTo(x + 300, 20);
      ctx.lineTo(x + 570, 600);
      ctx.lineTo(x + 290, 600);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawPlatform(p, palette) {
    ctx.save();
    const x = p.x;
    const y = p.y;
    const w = p.w;
    const h = p.h;
    ctx.shadowColor = 'rgba(18,7,36,.32)';
    ctx.shadowBlur = p.kind === 'ground' ? 18 : 24;
    ctx.shadowOffsetY = 12;

    const isCloud = p.kind === 'cloud';
    const isMoving = p.kind === 'moving';
    const isBounce = p.kind === 'bouncepad';
    const isFall = p.kind === 'fallblock';

    if (isFall && p.triggered) ctx.translate((Math.random() - 0.5) * 3, 0);

    // Cloud platforms: multi-ellipse silhouette (reads as cloud, not slab)
    if (isCloud) {
      ctx.shadowColor = 'rgba(160,210,255,.45)';
      ctx.shadowBlur = 22;
      ctx.fillStyle = 'rgba(245,252,255,.94)';
      const cy = y + 6;
      const n = Math.max(3, Math.floor(w / 42));
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const cx = x + 18 + (i / Math.max(1, n - 1)) * (w - 36);
        const rr = 16 + (i % 2 ? 8 : 4) + Math.sin(i * 1.7) * 3;
        ctx.ellipse(cx, cy - (i % 2 ? 6 : 0), rr, rr * 0.72, 0, 0, Math.PI * 2);
      }
      ctx.ellipse(x + w * 0.5, cy + 4, w * 0.42, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = 'rgba(255,255,255,.55)';
      ctx.beginPath();
      ctx.ellipse(x + w * 0.38, cy - 8, w * 0.18, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    const body = ctx.createLinearGradient(0, y, 0, y + Math.min(h, 160));
    if (isMoving) {
      body.addColorStop(0, mixColor(palette.accent, '#ffffff', 0.25));
      body.addColorStop(0.5, palette.groundBody);
      body.addColorStop(1, palette.groundDark);
    } else if (isBounce) {
      body.addColorStop(0, mixColor(palette.accent, '#ffffff', 0.35));
      body.addColorStop(0.5, palette.groundTop);
      body.addColorStop(1, palette.accent);
    } else if (isFall) {
      body.addColorStop(0, p.triggered ? mixColor(palette.groundBody, '#ff6a6a', 0.55) : mixColor(palette.groundBody, palette.groundDark, 0.2));
      body.addColorStop(0.56, p.triggered ? mixColor(palette.groundDark, '#ff6a6a', 0.4) : mixColor(palette.groundBody, palette.groundDark, 0.5));
      body.addColorStop(1, palette.groundDark);
    } else {
      body.addColorStop(0, palette.groundBody);
      body.addColorStop(0.56, mixColor(palette.groundBody, palette.groundDark, 0.42));
      body.addColorStop(1, palette.groundDark);
    }
    ctx.fillStyle = body;
    roundedPath(ctx, x, y, w, h, p.kind === 'ground' ? 22 : 18);
    ctx.fill();

    ctx.shadowColor = 'transparent';
    const top = ctx.createLinearGradient(0, y - 8, 0, y + 24);
    top.addColorStop(0, mixColor(palette.groundTop, '#ffffff', 0.27));
    top.addColorStop(0.45, palette.groundTop);
    top.addColorStop(1, mixColor(palette.groundTop, palette.groundBody, 0.45));
    ctx.fillStyle = top;
    roundedPath(ctx, x - 2, y - 8, w + 4, 31, 16);
    ctx.fill();

    // Surface fringe for ground/island edge readability
    if (p.kind === 'ground' || p.kind === 'island') {
      ctx.fillStyle = mixColor(palette.groundTop, palette.accent, 0.35);
      const tufts = Math.max(2, Math.floor(w / 36));
      for (let i = 0; i < tufts; i++) {
        const tx = x + 10 + (i / tufts) * (w - 20);
        const th = 5 + (i % 3);
        ctx.beginPath();
        ctx.moveTo(tx - 4, y - 2);
        ctx.quadraticCurveTo(tx, y - 8 - th, tx + 4, y - 2);
        ctx.fill();
      }
    }

    // Cliff lip markers at ground segment ends
    if (p.kind === 'ground') {
      ctx.fillStyle = 'rgba(20,8,30,.22)';
      ctx.fillRect(x, y - 6, 10, 20);
      ctx.fillRect(x + w - 10, y - 6, 10, 20);
    }

    if (isMoving) {
      ctx.strokeStyle = 'rgba(184,248,220,.65)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      roundedPath(ctx, x + 4, y + 4, w - 8, h - 8, 10);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(184,248,220,.7)';
      const midX = x + w * 0.5;
      const midY = y + h * 0.55;
      const dir = p.dir < 0 ? -1 : 1;
      ctx.beginPath();
      if (p.axis === 'y') {
        // Vertical mover: point along current travel (dir>0 → down)
        if (dir > 0) {
          ctx.moveTo(midX - 7, midY - 6);
          ctx.lineTo(midX + 7, midY - 6);
          ctx.lineTo(midX, midY + 8);
        } else {
          ctx.moveTo(midX - 7, midY + 6);
          ctx.lineTo(midX + 7, midY + 6);
          ctx.lineTo(midX, midY - 8);
        }
      } else {
        ctx.moveTo(midX - 8 * dir, midY - 5);
        ctx.lineTo(midX + 6 * dir, midY);
        ctx.lineTo(midX - 8 * dir, midY + 5);
      }
      ctx.closePath();
      ctx.fill();
    }

    if (isBounce) {
      ctx.strokeStyle = mixColor(palette.accent, '#ffffff', 0.5);
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const cy = y + 8 + i * 7;
        ctx.beginPath();
        ctx.moveTo(x + 10, cy);
        ctx.lineTo(x + w - 10, cy);
        ctx.stroke();
      }
      ctx.fillStyle = mixColor(palette.accent, '#ffffff', 0.65);
      ctx.beginPath();
      ctx.moveTo(x + w / 2 - 10, y - 2);
      ctx.lineTo(x + w / 2 + 10, y - 2);
      ctx.lineTo(x + w / 2, y - 14);
      ctx.closePath();
      ctx.fill();
    }

    if (isFall) {
      ctx.strokeStyle = p.triggered ? 'rgba(80,15,20,.7)' : 'rgba(40,20,30,.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + w * 0.25, y + 2);
      ctx.lineTo(x + w * 0.35, y + h - 3);
      ctx.moveTo(x + w * 0.7, y + 3);
      ctx.lineTo(x + w * 0.58, y + h - 2);
      if (p.triggered) {
        ctx.moveTo(x + w * 0.3, y + 3);
        ctx.lineTo(x + w * 0.42, y + h * 0.5);
        ctx.lineTo(x + w * 0.34, y + h - 4);
        ctx.moveTo(x + w * 0.68, y + 2);
        ctx.lineTo(x + w * 0.58, y + h * 0.55);
        ctx.lineTo(x + w * 0.66, y + h - 3);
      }
      ctx.stroke();
    }

    if (p.kind !== 'ground') {
      ctx.fillStyle = 'rgba(255,212,244,.24)';
      ctx.beginPath();
      ctx.moveTo(x + 22, y + h);
      ctx.lineTo(x + w - 20, y + h);
      ctx.lineTo(x + w * 0.57, y + h + 34);
      ctx.lineTo(x + w * 0.44, y + h + 41);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawDecor(d) {
    const sway = Math.sin(state.time * 1.2 + d.phase) * 0.08;
    ctx.save();
    ctx.translate(d.x, d.y + 2);
    ctx.rotate(sway * (d.type === 'tree' || d.type === 'pipe' || d.type === 'star_pillar' ? 0.35 : 1));
    ctx.scale(d.s, d.s);
    ctx.globalAlpha = 0.82;
    const t = d.type;

    if (t === 'flower') {
      ctx.strokeStyle = '#8cd4b1';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-5, -34, 4, -60);
      ctx.stroke();
      const petal = d.hue > 0.5 ? '#f4a9df' : '#bfa8ff';
      ctx.fillStyle = petal;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(Math.cos(a) * 13, -65 + Math.sin(a) * 13, 11, 6, a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#fff3b3';
      ctx.beginPath();
      ctx.arc(0, -65, 7, 0, Math.PI * 2);
      ctx.fill();
    } else if (t === 'mushroom') {
      ctx.fillStyle = '#eee2f5';
      roundedPath(ctx, -7, -34, 14, 34, 7);
      ctx.fill();
      const cap = ctx.createRadialGradient(-10, -48, 2, 0, -38, 34);
      cap.addColorStop(0, '#ffd7ef');
      cap.addColorStop(1, d.hue > 0.5 ? '#b88ee8' : '#8fd8e8');
      ctx.fillStyle = cap;
      ctx.beginPath();
      ctx.ellipse(0, -40, 31, 19, 0, Math.PI, Math.PI * 2);
      ctx.lineTo(-31, -40);
      ctx.fill();
    } else if (t === 'tree') {
      ctx.fillStyle = '#6b4a3a';
      roundedPath(ctx, -8, -70, 16, 70, 6);
      ctx.fill();
      const leaf = ctx.createRadialGradient(-10, -90, 4, 0, -80, 50);
      leaf.addColorStop(0, d.hue > 0.5 ? '#d4ffc8' : '#b8f0d8');
      leaf.addColorStop(1, d.hue > 0.5 ? '#6bb88a' : '#7a9fd8');
      ctx.fillStyle = leaf;
      ctx.beginPath();
      ctx.ellipse(0, -95, 38, 34, 0, 0, Math.PI * 2);
      ctx.ellipse(-22, -75, 24, 20, 0, 0, Math.PI * 2);
      ctx.ellipse(22, -78, 26, 22, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (t === 'bush') {
      ctx.fillStyle = d.hue > 0.5 ? '#9ae0b0' : '#b8a0e8';
      ctx.beginPath();
      ctx.ellipse(0, -18, 28, 18, 0, 0, Math.PI * 2);
      ctx.ellipse(-16, -12, 16, 12, 0, 0, Math.PI * 2);
      ctx.ellipse(16, -14, 16, 13, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,200,230,.7)';
      ctx.beginPath();
      ctx.arc(-8, -20, 3, 0, Math.PI * 2);
      ctx.arc(10, -16, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (t === 'lantern') {
      ctx.strokeStyle = '#c9a070';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -48);
      ctx.stroke();
      ctx.shadowColor = 'rgba(255,210,120,.7)';
      ctx.shadowBlur = 16;
      const lg = ctx.createRadialGradient(0, -58, 2, 0, -58, 18);
      lg.addColorStop(0, '#fff6c8');
      lg.addColorStop(1, '#f0a050');
      ctx.fillStyle = lg;
      roundedPath(ctx, -12, -74, 24, 28, 6);
      ctx.fill();
    } else if (t === 'puff') {
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.shadowColor = 'rgba(180,220,255,.4)';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.ellipse(0, -18, 22, 12, 0, 0, Math.PI * 2);
      ctx.ellipse(-12, -14, 12, 9, 0, 0, Math.PI * 2);
      ctx.ellipse(12, -16, 13, 10, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (t === 'crystal_shard') {
      ctx.shadowColor = 'rgba(160,220,255,.55)';
      ctx.shadowBlur = 14;
      const cg = ctx.createLinearGradient(0, -70, 0, 0);
      cg.addColorStop(0, '#e8ffff');
      cg.addColorStop(0.5, d.hue > 0.5 ? '#c0a0ff' : '#90d8ff');
      cg.addColorStop(1, '#504080');
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.moveTo(0, -72);
      ctx.lineTo(14, -20);
      ctx.lineTo(0, 0);
      ctx.lineTo(-14, -20);
      ctx.closePath();
      ctx.fill();
    } else if (t === 'pipe') {
      ctx.fillStyle = d.hue > 0.5 ? '#e890a8' : '#d8a070';
      roundedPath(ctx, -16, -90, 32, 90, 8);
      ctx.fill();
      ctx.fillStyle = mixColor('#ffffff', d.hue > 0.5 ? '#e890a8' : '#d8a070', 0.3);
      roundedPath(ctx, -22, -102, 44, 20, 8);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.25)';
      roundedPath(ctx, -10, -80, 8, 50, 4);
      ctx.fill();
    } else if (t === 'candy_stack') {
      const colors = ['#ff9ec8', '#ffd080', '#a0e8ff', '#c8a0ff'];
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = colors[(i + Math.floor(d.hue * 4)) % 4];
        roundedPath(ctx, -18 + i * 2, -22 - i * 18, 36 - i * 4, 18, 6);
        ctx.fill();
      }
    } else if (t === 'gear') {
      ctx.fillStyle = '#e8c070';
      ctx.beginPath();
      ctx.arc(0, -28, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#c09040';
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + state.time * 0.4;
        ctx.save();
        ctx.translate(Math.cos(a) * 22, -28 + Math.sin(a) * 22);
        ctx.rotate(a);
        ctx.fillRect(-5, -7, 10, 14);
        ctx.restore();
      }
      ctx.fillStyle = '#5a3a20';
      ctx.beginPath();
      ctx.arc(0, -28, 6, 0, Math.PI * 2);
      ctx.fill();
    } else if (t === 'star_pillar') {
      ctx.fillStyle = '#7a70c0';
      roundedPath(ctx, -10, -100, 20, 100, 6);
      ctx.fill();
      ctx.shadowColor = 'rgba(200,230,255,.8)';
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#fff8d0';
      // 5-point star
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
        const outer = 18;
        const inner = 8;
        const ao = a;
        const ai = a + Math.PI / 5;
        if (i === 0) ctx.moveTo(Math.cos(ao) * outer, -110 + Math.sin(ao) * outer);
        else ctx.lineTo(Math.cos(ao) * outer, -110 + Math.sin(ao) * outer);
        ctx.lineTo(Math.cos(ai) * inner, -110 + Math.sin(ai) * inner);
      }
      ctx.closePath();
      ctx.fill();
    } else if (t === 'nebula_bloom') {
      const ng = ctx.createRadialGradient(0, -30, 2, 0, -30, 36);
      ng.addColorStop(0, 'rgba(255,220,255,.9)');
      ng.addColorStop(0.45, d.hue > 0.5 ? 'rgba(160,140,255,.55)' : 'rgba(120,200,255,.55)');
      ng.addColorStop(1, 'rgba(80,60,140,0)');
      ctx.fillStyle = ng;
      ctx.beginPath();
      ctx.arc(0, -30, 36, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + d.phase;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * 14, -30 + Math.sin(a) * 14, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // sprout default
      ctx.strokeStyle = '#92ddb9';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-2, -25, 0, -46);
      ctx.stroke();
      ctx.fillStyle = '#aaf1c7';
      ctx.beginPath();
      ctx.ellipse(-11, -38, 14, 7, -0.5, 0, Math.PI * 2);
      ctx.ellipse(12, -47, 14, 7, 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawSpecial(s) {
    if (s.type === 'wind') {
      ctx.save();
      const dirX = Math.sign(s.forceX || 0) || 0;
      const dirY = Math.sign(s.forceY || 0) || 0;
      const pulse = 0.09 + Math.sin(state.time * 2.4 + s.x * 0.01) * 0.03;
      // Zone fill + dashed outline for readable wind volume
      const zg = ctx.createLinearGradient(s.x, s.y, s.x + s.w, s.y + s.h);
      zg.addColorStop(0, `rgba(160,220,255,${pulse + 0.05})`);
      zg.addColorStop(1, `rgba(200,240,255,${pulse})`);
      ctx.fillStyle = zg;
      roundedPath(ctx, s.x, s.y, s.w, s.h, 18);
      ctx.fill();
      ctx.setLineDash([8, 6]);
      ctx.strokeStyle = `rgba(210,240,255,${0.35 + pulse})`;
      ctx.lineWidth = 2;
      roundedPath(ctx, s.x, s.y, s.w, s.h, 18);
      ctx.stroke();
      ctx.setLineDash([]);

      const span = s.w + 40;
      ctx.globalAlpha = 0.28 + Math.sin(state.time * 3 + s.x * 0.01) * 0.06;
      ctx.strokeStyle = 'rgba(200,240,255,.95)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        let t = (state.time * 80 * (dirX || 1) + i * 40) % span;
        if (t < 0) t += span;
        const ox = t - 20;
        const yy = s.y + 40 + i * (s.h / 6);
        const dx = (dirX || 1) * 30;
        ctx.beginPath();
        ctx.moveTo(s.x + ox, yy);
        ctx.quadraticCurveTo(s.x + ox + dx, yy - 12 + dirY * 6, s.x + ox + dx * 2, yy + dirY * 10);
        ctx.stroke();
      }

      // Primary direction chevron
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = 'rgba(220,245,255,.95)';
      const cx = s.x + s.w * 0.5;
      const cy = s.y + s.h * 0.35;
      ctx.beginPath();
      if (Math.abs(s.forceY || 0) > Math.abs(s.forceX || 0)) {
        const up = (s.forceY || 0) < 0;
        if (up) {
          ctx.moveTo(cx - 12, cy + 10);
          ctx.lineTo(cx + 12, cy + 10);
          ctx.lineTo(cx, cy - 14);
        } else {
          ctx.moveTo(cx - 12, cy - 10);
          ctx.lineTo(cx + 12, cy - 10);
          ctx.lineTo(cx, cy + 14);
        }
      } else if ((dirX || 1) > 0) {
        ctx.moveTo(cx - 14, cy - 12);
        ctx.lineTo(cx + 16, cy);
        ctx.lineTo(cx - 14, cy + 12);
      } else {
        ctx.moveTo(cx + 14, cy - 12);
        ctx.lineTo(cx - 16, cy);
        ctx.lineTo(cx + 14, cy + 12);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else if (s.type === 'pobi_cage') {
      drawPobiCage(s);
    }
  }

  function drawPobiCage(s) {
    const open =
      state.collected >= state.requiredVeggies &&
      (!currentStage?.needsKey || state.hasKey);
    ctx.save();
    ctx.translate(s.x + s.w / 2, s.y + s.h / 2);
    ctx.shadowColor = open ? 'rgba(184,248,220,.55)' : 'rgba(255,180,220,.35)';
    ctx.shadowBlur = 18;
    // Cage frame
    ctx.strokeStyle = open ? '#b8f8dc' : '#c9a0e0';
    ctx.lineWidth = 5;
    roundedPath(ctx, -s.w / 2, -s.h / 2, s.w, s.h, 12);
    ctx.stroke();
    for (let i = 1; i < 4; i++) {
      const lx = -s.w / 2 + (s.w / 4) * i;
      ctx.beginPath();
      ctx.moveTo(lx, -s.h / 2 + 8);
      ctx.lineTo(lx, s.h / 2 - 8);
      ctx.stroke();
    }
    // Pobi portrait inside
    if (pobiImage.complete && pobiImage.naturalWidth) {
      ctx.save();
      ctx.beginPath();
      roundedPath(ctx, -32, -48, 64, 72, 10);
      ctx.clip();
      ctx.globalAlpha = open ? 1 : 0.85;
      ctx.drawImage(pobiImage, -36, -52, 72, 80);
      ctx.restore();
    } else {
      ctx.fillStyle = '#f0d0e8';
      ctx.beginPath();
      ctx.arc(0, -10, 22, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(20,10,35,.7)';
    roundedPath(ctx, -48, s.h / 2 - 28, 96, 24, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '700 11px ui-rounded, system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(open ? '포비 구출!' : '반란군 포비', 0, s.h / 2 - 16);
    ctx.restore();
  }

  function drawHazard(h) {
    h.pulse = (h.pulse || 0) + 0.02;
    if (h.type === 'puddle') drawPuddle(h);
    else if (h.type === 'thorn') drawThorn(h);
    else drawCrystal(h);
  }

  function drawPuddle(h) {
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.shadowColor = 'rgba(60,13,91,.55)';
    ctx.shadowBlur = 18;
    const g = ctx.createRadialGradient(h.w * 0.36, 5, 5, h.w * 0.5, h.h * 0.4, h.w * 0.58);
    g.addColorStop(0, '#ff9fe4');
    g.addColorStop(0.37, '#8f70dc');
    g.addColorStop(1, '#3c245f');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(
      h.w * 0.5,
      h.h * 0.52,
      h.w * 0.5,
      h.h * 0.42 + Math.sin(state.time * 2 + h.pulse) * 1.5,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.restore();
  }

  function drawCrystal(h) {
    ctx.save();
    ctx.translate(h.x, h.y + h.h);
    ctx.shadowColor = 'rgba(199,125,255,.65)';
    ctx.shadowBlur = 17;
    const spikes = 3;
    for (let i = 0; i < spikes; i++) {
      const sw = h.w / spikes;
      const x = i * sw;
      const peak = h.h * (0.76 + ((i * 7) % 3) * 0.12);
      const g = ctx.createLinearGradient(x, -peak, x + sw, 0);
      g.addColorStop(0, i % 2 ? '#baf6ff' : '#ffd1f0');
      g.addColorStop(0.5, '#b594f0');
      g.addColorStop(1, '#59417d');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + sw * 0.52, -peak);
      ctx.lineTo(x + sw, 0);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawThorn(h) {
    ctx.save();
    ctx.translate(h.x, h.y + h.h);
    ctx.shadowColor = 'rgba(180,40,90,.5)';
    ctx.shadowBlur = 12;
    const n = Math.max(3, Math.floor(h.w / 22));
    for (let i = 0; i < n; i++) {
      const x = (i + 0.5) * (h.w / n);
      const peak = h.h * (0.85 + Math.sin(i + h.pulse) * 0.08);
      const g = ctx.createLinearGradient(x, -peak, x, 0);
      g.addColorStop(0, '#ff8ab8');
      g.addColorStop(0.5, '#c44a7a');
      g.addColorStop(1, '#5a2040');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x - 10, 0);
      ctx.lineTo(x, -peak);
      ctx.lineTo(x + 10, 0);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawVegetable(v) {
    const bob = Math.sin(state.time * 3.2 + v.phase) * 7;
    const pulse = 1 + Math.sin(state.time * 4 + v.phase) * 0.035;
    ctx.save();
    ctx.translate(v.x, v.y + bob);
    ctx.scale(pulse, pulse);
    if (v.type === 'key') {
      drawKey();
      ctx.restore();
      return;
    }
    ctx.shadowColor = v.type === 'carrot' ? 'rgba(255,170,93,.55)' : 'rgba(153,255,188,.55)';
    ctx.shadowBlur = 18;
    if (v.type === 'lettuce') drawLettuce();
    else if (v.type === 'cabbage') drawCabbage();
    else if (v.type === 'carrot') drawCarrot();
    else drawRadish();
    ctx.restore();
  }

  function drawKey() {
    ctx.shadowColor = 'rgba(255,210,90,.75)';
    ctx.shadowBlur = 20;
    // ring
    ctx.strokeStyle = '#ffe08a';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, -10, 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#ffc24a';
    ctx.lineWidth = 3;
    ctx.stroke();
    // shaft
    const g = ctx.createLinearGradient(0, 0, 0, 34);
    g.addColorStop(0, '#fff3b0');
    g.addColorStop(1, '#e0a030');
    ctx.fillStyle = g;
    roundedPath(ctx, -5, 2, 10, 30, 4);
    ctx.fill();
    // teeth
    ctx.fillRect(5, 18, 10, 6);
    ctx.fillRect(5, 28, 14, 6);
    // sparkle
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    ctx.beginPath();
    ctx.arc(-6, -18, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  function cuteFace(y = 4, scale = 1) {
    ctx.save();
    ctx.scale(scale, scale);
    ctx.fillStyle = '#34233e';
    ctx.beginPath();
    ctx.arc(-7, y, 2.3, 0, Math.PI * 2);
    ctx.arc(7, y, 2.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#34233e';
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, y + 2, 4.5, 0.2, Math.PI - 0.2);
    ctx.stroke();
    ctx.restore();
  }

  function drawLettuce() {
    const leaves = [
      [-17, 3, 18, 27, -0.45],
      [17, 3, 18, 27, 0.45],
      [0, -10, 20, 28, 0],
      [-7, 10, 20, 24, -0.12],
      [8, 10, 20, 24, 0.12]
    ];
    for (const [x, y, rx, ry, rot] of leaves) {
      const g = ctx.createLinearGradient(x - 10, y - 20, x + 15, y + 20);
      g.addColorStop(0, '#d4ffd2');
      g.addColorStop(1, '#72d993');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
      ctx.fill();
    }
    cuteFace(5, 1);
  }

  function drawCabbage() {
    const g = ctx.createRadialGradient(-9, -14, 3, 0, 0, 32);
    g.addColorStop(0, '#f5ffcc');
    g.addColorStop(0.5, '#c8eda0');
    g.addColorStop(1, '#82c684');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 29, 0, Math.PI * 2);
    ctx.fill();
    cuteFace(4, 1);
  }

  function drawCarrot() {
    ctx.fillStyle = '#79d897';
    ctx.beginPath();
    ctx.ellipse(-8, -25, 8, 18, -0.45, 0, Math.PI * 2);
    ctx.ellipse(8, -26, 8, 19, 0.45, 0, Math.PI * 2);
    ctx.ellipse(0, -29, 7, 19, 0, 0, Math.PI * 2);
    ctx.fill();
    const g = ctx.createLinearGradient(-18, -14, 18, 24);
    g.addColorStop(0, '#ffc07b');
    g.addColorStop(0.55, '#ff986d');
    g.addColorStop(1, '#e86d65');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-21, -13);
    ctx.quadraticCurveTo(0, -21, 21, -13);
    ctx.quadraticCurveTo(12, 14, 0, 31);
    ctx.quadraticCurveTo(-13, 14, -21, -13);
    ctx.fill();
    cuteFace(-3, 0.9);
  }

  function drawRadish() {
    ctx.fillStyle = '#8be1a4';
    ctx.beginPath();
    ctx.ellipse(-7, -23, 8, 17, -0.55, 0, Math.PI * 2);
    ctx.ellipse(8, -24, 8, 18, 0.5, 0, Math.PI * 2);
    ctx.fill();
    const g = ctx.createRadialGradient(-8, -10, 3, 0, 0, 30);
    g.addColorStop(0, '#ffd6ec');
    g.addColorStop(0.6, '#f697c7');
    g.addColorStop(1, '#d868a7');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 27, 0, Math.PI * 2);
    ctx.fill();
    cuteFace(3, 1);
  }

  function drawEnemy(e) {
    if (e.kind === 'shadow_bat') {
      drawShadowBat(e);
      return;
    }
    if (e.kind === 'sleep_cloud') {
      drawSleepCloud(e);
      return;
    }
    // mushroom_patrol (default)
    const bounce = Math.sin(e.phase) * 2;
    ctx.save();
    ctx.translate(e.x + e.w / 2, e.y + e.h + bounce);
    ctx.scale(e.dir, 1);
    ctx.shadowColor = 'rgba(25,9,42,.3)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 7;
    const cap = ctx.createRadialGradient(-12, -40, 4, 0, -28, 38);
    cap.addColorStop(0, '#ffd9ef');
    cap.addColorStop(0.5, '#d995d9');
    cap.addColorStop(1, '#7c5b9d');
    ctx.fillStyle = cap;
    ctx.beginPath();
    ctx.ellipse(0, -28, 32, 22, 0, Math.PI, Math.PI * 2);
    ctx.lineTo(-32, -28);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#f3e8ee';
    roundedPath(ctx, -18, -31, 36, 31, 14);
    ctx.fill();
    ctx.strokeStyle = '#4a3151';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-10, -19);
    ctx.lineTo(-4, -19);
    ctx.moveTo(5, -19);
    ctx.lineTo(11, -19);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -11, 4, 0.15, Math.PI - 0.15);
    ctx.stroke();
    ctx.restore();
  }

  function drawSleepCloud(e) {
    const bob = Math.sin(e.phase) * 3;
    ctx.save();
    ctx.translate(e.x + e.w / 2, e.y + e.h / 2 + bob);
    ctx.scale(e.dir, 1);
    ctx.shadowColor = 'rgba(120,160,220,.4)';
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#e8f4ff';
    ctx.beginPath();
    ctx.ellipse(0, 0, 34, 18, 0, 0, Math.PI * 2);
    ctx.ellipse(-18, 2, 16, 12, 0, 0, Math.PI * 2);
    ctx.ellipse(18, -2, 18, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4a3151';
    ctx.beginPath();
    ctx.arc(-8, -2, 2.5, 0, Math.PI * 2);
    ctx.arc(10, -2, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#4a3151';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(2, 4, 5, 0.2, Math.PI - 0.2);
    ctx.stroke();
    // zzz
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    ctx.font = '700 12px ui-rounded, system-ui';
    ctx.fillText('z', 22, -14 + Math.sin(e.phase * 2) * 2);
    ctx.restore();
  }

  function drawShadowBat(e) {
    const flap = Math.sin(e.phase * 2) * 0.35;
    ctx.save();
    ctx.translate(e.x + e.w / 2, e.y + e.h / 2);
    ctx.scale(e.dir, 1);
    ctx.shadowColor = 'rgba(40,10,60,.5)';
    ctx.shadowBlur = 14;
    // wings
    ctx.fillStyle = '#5a3a78';
    ctx.beginPath();
    ctx.ellipse(-22, -2, 18, 10 + flap * 8, -0.4 + flap, 0, Math.PI * 2);
    ctx.ellipse(22, -2, 18, 10 + flap * 8, 0.4 - flap, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a1838';
    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff6aa8';
    ctx.beginPath();
    ctx.arc(-5, -2, 2.2, 0, Math.PI * 2);
    ctx.arc(5, -2, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawCheckpointBeacons() {
    const list = currentStage?.checkpoints || [];
    for (let i = 1; i < list.length; i++) {
      const x = list[i].x;
      if (!isVisible(x - 70, 140)) continue;
      ctx.save();
      ctx.translate(x, 598);
      const active = state.checkpoint >= i;
      const glow = ctx.createRadialGradient(0, -75, 4, 0, -75, 70);
      glow.addColorStop(0, active ? 'rgba(183,250,255,.72)' : 'rgba(255,208,241,.44)');
      glow.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, -75, 70, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = active ? '#b8f7ff' : '#e5a9e2';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-9, -54, 0, -100);
      ctx.stroke();
      ctx.fillStyle = active ? '#d8ffff' : '#f9d5ed';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(0, -103, 12 + Math.sin(state.time * 3) * 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = active ? '#1a4050' : '#5a3050';
      ctx.font = '800 11px ui-rounded, system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i), 0, -103);
      ctx.restore();
    }
  }

  function drawPortal() {
    const portal = currentStage?.portal;
    if (!portal) return;
    const x = portal.x;
    const y = portal.y;
    const w = portal.w;
    const h = portal.h;
    if (!isVisible(x - 80, 280)) return;
    const veggiesOk = state.collected >= state.requiredVeggies;
    const isFinal = state.stageIndex >= StageLib.stageCount() - 1;
    const open = veggiesOk && (!currentStage?.needsKey || state.hasKey);
    const veggiesOnly = veggiesOk && !open; // has veggies but missing key
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    const pulse = 1 + Math.sin(state.time * 2.3) * 0.025;
    ctx.scale(pulse, pulse);
    const glow = ctx.createRadialGradient(0, 0, 15, 0, 0, 118);
    glow.addColorStop(0, open ? 'rgba(185,255,231,.72)' : veggiesOnly ? 'rgba(255,220,140,.5)' : 'rgba(255,196,231,.42)');
    glow.addColorStop(0.45, open ? 'rgba(149,224,255,.27)' : 'rgba(177,125,221,.19)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 118, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowColor = open ? '#aaf7e3' : '#d8a5ea';
    ctx.shadowBlur = 24;
    ctx.lineWidth = 18;
    const frame = ctx.createLinearGradient(-50, -80, 55, 80);
    frame.addColorStop(0, '#fff4ff');
    frame.addColorStop(0.42, open ? '#b5f3e0' : '#d4b2ef');
    frame.addColorStop(1, '#8370c4');
    ctx.strokeStyle = frame;
    ctx.beginPath();
    ctx.arc(0, 0, 58, Math.PI, Math.PI * 2);
    ctx.lineTo(58, 78);
    ctx.lineTo(-58, 78);
    ctx.closePath();
    ctx.stroke();
    const inside = ctx.createRadialGradient(-12, -20, 3, 0, 0, 70);
    inside.addColorStop(0, open ? '#eafff6' : '#5d416e');
    inside.addColorStop(0.4, open ? '#85dfea' : '#6d4c80');
    inside.addColorStop(1, open ? '#7159a9' : '#2b1d42');
    ctx.fillStyle = inside;
    ctx.beginPath();
    ctx.arc(0, 0, 48, Math.PI, Math.PI * 2);
    ctx.lineTo(48, 74);
    ctx.lineTo(-48, 74);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(x + w / 2, y - 28);
    ctx.fillStyle = 'rgba(25,12,42,.72)';
    roundedPath(ctx, -72, -17, 144, 34, 17);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '800 13px ui-rounded, system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let label;
    if (open) {
      label = isFinal ? '포비 구출 OPEN ★' : '다음 스테이지 ✦';
    } else if (veggiesOnly) {
      label = '열쇠 필요 🔑';
    } else {
      label = `${state.collected} / ${state.requiredVeggies}`;
    }
    ctx.fillText(label, 0, 0);
    ctx.restore();
  }

  function drawPlayer() {
    const blink = player.invincible > 0 && Math.floor(player.invincible * 10) % 2 === 0;
    if (blink) return;
    const x = player.x + player.w / 2;
    const y = player.y + player.h;
    const airborne = !player.grounded;
    const bob = player.grounded
      ? Math.sin(player.runCycle) * Math.min(3.5, Math.abs(player.vx) * 0.01)
      : 0;
    const tilt = airborne
      ? Math.max(-0.12, Math.min(0.12, player.vx / 2200))
      : Math.sin(player.runCycle) * Math.min(0.045, Math.abs(player.vx) / 9000);
    const stretch = airborne ? Math.max(-0.07, Math.min(0.08, -player.vy / 6500)) : 0;
    const sx = 1 - player.squash + stretch;
    const sy = 1 + player.squash - stretch;

    ctx.save();
    ctx.fillStyle = 'rgba(24,10,38,.25)';
    ctx.beginPath();
    ctx.ellipse(
      x,
      y + 4,
      39 * (1 - Math.min(0.35, Math.abs(player.y - 488) / 360)),
      10,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
    if (player.landingPulse > 0) {
      ctx.strokeStyle = `rgba(224,190,255,${player.landingPulse * 0.45})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(
        x,
        y + 1,
        42 + (1 - player.landingPulse) * 40,
        9 + (1 - player.landingPulse) * 8,
        0,
        0,
        Math.PI * 2
      );
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.translate(x, y - player.h / 2 + bob);
    ctx.rotate(tilt);
    // Corrected facing: art faces left natively
    const faceScale = Physics.facingRenderScale(player.facing);
    ctx.scale(faceScale * sx, sy);
    const glow = ctx.createRadialGradient(13, 12, 4, 13, 12, 68);
    glow.addColorStop(0, 'rgba(255,170,228,.35)');
    glow.addColorStop(1, 'rgba(255,170,228,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(13, 12, 68, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowColor = 'rgba(15,5,25,.38)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 10;
    if (snailImage.complete && snailImage.naturalWidth) {
      ctx.drawImage(snailImage, -player.w * 0.5, -player.h * 0.5, player.w, player.h);
    } else {
      ctx.fillStyle = '#fff';
      roundedPath(ctx, -28, -45, 56, 90, 20);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawParticles() {
    for (const p of particles) {
      const alpha = Math.max(0, Math.min(1, p.life / Math.max(0.01, p.max)));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 9;
      if (p.shape === 'star') {
        ctx.rotate(state.time * 3 + p.x * 0.01);
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4;
          const r = i % 2 ? p.size * 0.32 : p.size;
          ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fill();
      } else if (p.shape === 'cloud') {
        ctx.beginPath();
        ctx.arc(-p.size * 0.25, 0, p.size * 0.5, 0, Math.PI * 2);
        ctx.arc(p.size * 0.2, -p.size * 0.12, p.size * 0.6, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawForegroundGlow(p) {
    const vignette = ctx.createRadialGradient(W * 0.5, H * 0.44, H * 0.18, W * 0.5, H * 0.5, W * 0.7);
    vignette.addColorStop(0, 'rgba(255,255,255,0)');
    vignette.addColorStop(0.72, 'rgba(20,7,35,.03)');
    vignette.addColorStop(1, 'rgba(13,5,25,.34)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);

    const bottomGlow = ctx.createLinearGradient(0, H - 150, 0, H);
    bottomGlow.addColorStop(0, 'rgba(255,255,255,0)');
    bottomGlow.addColorStop(
      1,
      mixColor(p.glow, '#ffffff', 0.1).replace('rgb', 'rgba').replace(')', ', .08)')
    );
    ctx.fillStyle = bottomGlow;
    ctx.fillRect(0, H - 150, W, 150);
  }

  function loop(now) {
    const dt = Math.min(0.034, Math.max(0, (now - state.lastTime) / 1000));
    state.lastTime = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  // Expose minimal hooks for diagnostics / launch checks
  globalThis.__mongsilGame = {
    Physics,
    StageLib,
    getState: () => ({
      mode: state.mode,
      stageIndex: state.stageIndex,
      worldW: state.worldW,
      requiredVeggies: state.requiredVeggies,
      canvasW: W,
      canvasH: H,
      facing: player.facing,
      faceScale: Physics.facingRenderScale(player.facing),
      vx: player.vx,
      x: player.x,
      y: player.y
    }),
    loadStage,
    completeStage,
    endGame
  };

  migrateScores();
  renderLeaderboard(ui.startLeaderboard);

  requestAnimationFrame(loop);
})();
