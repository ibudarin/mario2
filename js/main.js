(function (root) {
  'use strict';

  var C = root.LPMConfig;
  var SIM = root.LPMSim;
  var AUDIO = root.LPMAudio;
  var INPUT = root.LPMInput;

  var RECORDS_KEY = 'lpm.records.v1';

  function Game() {
    this.world = new SIM.World();
    this.input = new INPUT.Input();
    this.audio = new AUDIO.AudioEngine();
    this.renderer = null;
    this.records = this.loadRecords();
    this.runTimeMs = 0;
    this.accum = 0;
    this.lastTime = 0;
    this.rafId = null;
    this.muted = false;
    this.overlayMode = 'title';

    var container = document.getElementById('game');
    try {
      this.renderer = new root.LPMRenderer.Renderer(container, this.world);
    } catch (e) {
      this.renderer = null;
    }
    if (!this.renderer || !this.renderer.ok) {
      document.getElementById('webgl-error').style.display = 'flex';
      document.getElementById('overlay').classList.add('hidden');
      return;
    }

    this.ui = {
      score: document.getElementById('hud-score'),
      coins: document.getElementById('hud-coins'),
      time: document.getElementById('hud-time'),
      lives: document.getElementById('hud-lives'),
      power: document.getElementById('hud-power'),
      secrets: document.getElementById('hud-secrets'),
      progress: document.getElementById('progressBar'),
      overlay: document.getElementById('overlay'),
      ovTitle: document.getElementById('ov-title'),
      ovHeading: document.getElementById('ov-heading'),
      ovText: document.getElementById('ov-text'),
      ovStats: document.getElementById('ov-stats'),
      ovBtn: document.getElementById('ov-btn'),
      btnPause: document.getElementById('btn-pause'),
      btnMute: document.getElementById('btn-mute')
    };

    this.bindUi();
    this.showOverlay('title');
    this.lastTime = performance.now();
    var self = this;
    function frame(t) {
      self.frame(t);
      self.rafId = requestAnimationFrame(frame);
    }
    this.rafId = requestAnimationFrame(frame);
  }

  // ------------------------------------------------------------ records

  Game.prototype.loadRecords = function () {
    var fallback = { version: 1, bestScore: 0, bestTimeMs: null };
    try {
      var raw = root.localStorage.getItem(RECORDS_KEY);
      if (!raw) return fallback;
      var data = JSON.parse(raw);
      if (typeof data !== 'object' || data === null) return fallback;
      return {
        version: 1,
        bestScore: Number(data.bestScore) >= 0 ? Number(data.bestScore) : 0,
        bestTimeMs: Number(data.bestTimeMs) > 0 ? Number(data.bestTimeMs) : null
      };
    } catch (e) {
      return fallback;
    }
  };

  Game.prototype.saveRecords = function () {
    try {
      root.localStorage.setItem(RECORDS_KEY, JSON.stringify(this.records));
    } catch (e) {
      // Storage unavailable or full: keep in-memory records.
    }
  };

  // ------------------------------------------------------------ ui

  Game.prototype.bindUi = function () {
    var self = this;
    this.ui.ovBtn.addEventListener('click', function () { self.primaryAction(); });
    this.ui.btnPause.addEventListener('click', function () { self.togglePause(); });
    this.ui.btnMute.addEventListener('click', function () { self.toggleMute(); });

    var touchNames = { 't-left': 'left', 't-right': 'right', 't-down': 'down', 't-run': 'run', 't-jump': 'jump' };
    for (var id in touchNames) {
      var el = document.getElementById(id);
      if (el) this.input.bindTouchButton(el, touchNames[id]);
    }
    if ('ontouchstart' in root || navigator.maxTouchPoints > 0) {
      document.body.classList.add('touch-mode');
    }
    root.addEventListener('resize', function () { self.renderer.onResize(); });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        self.audio.suspendMusic();
        self.input.releaseAll();
        if (self.world.state === 'play') self.pause();
      } else if (!self.muted) {
        self.audio.resumeMusic();
      }
    });
    root.addEventListener('keydown', function (e) {
      if (e.code === 'KeyM') self.toggleMute();
    });
  };

  Game.prototype.showOverlay = function (mode, data) {
    this.overlayMode = mode;
    var ui = this.ui;
    ui.overlay.classList.remove('hidden');
    ui.ovTitle.style.display = mode === 'title' ? '' : 'none';
    ui.ovHeading.style.display = mode === 'title' ? 'none' : '';
    ui.ovStats.style.display = 'none';
    ui.ovStats.innerHTML = '';
    ui.ovText.style.display = '';

    if (mode === 'title') {
      ui.ovHeading.textContent = '';
      ui.ovText.innerHTML = 'Arrows / A D move &middot; Space jump (hold for higher) &middot; Shift run &middot; Down enter pipes<br>Stomp enemies &middot; Find 3 secrets &middot; Reach the flag!';
      ui.ovBtn.textContent = 'Play';
    } else if (mode === 'paused') {
      ui.ovHeading.textContent = 'Paused';
      ui.ovText.textContent = 'Take a breather.';
      ui.ovBtn.textContent = 'Resume';
    } else if (mode === 'gameover') {
      ui.ovHeading.textContent = 'Game Over';
      ui.ovText.textContent = 'The meadow got the better of you this time.';
      ui.ovBtn.textContent = 'Try Again';
    } else if (mode === 'win') {
      ui.ovHeading.textContent = 'Course Clear!';
      ui.ovText.style.display = 'none';
      ui.ovStats.style.display = '';
      ui.ovBtn.textContent = 'Play Again';
      this.fillWinStats(data);
    }
  };

  Game.prototype.hideOverlay = function () {
    this.ui.overlay.classList.add('hidden');
  };

  Game.prototype.fillWinStats = function (data) {
    var ui = this.ui;
    var rows = [
      ['Final score', data.score],
      ['Run time', data.timeText],
      ['Coins collected', data.coins],
      ['Secrets found', data.secrets + ' / 3'],
      ['Enemies defeated', data.enemies],
      ['Flag bonus', data.flagBonus],
      ['Time bonus', data.timeBonus],
      ['Firework bonus', data.fireworkBonus],
      ['Best score', this.records.bestScore],
      ['Best time', this.records.bestTimeMs ? (this.records.bestTimeMs / 1000).toFixed(1) + 's' : '-']
    ];
    var html = '';
    for (var i = 0; i < rows.length; i++) {
      html += '<div><span>' + rows[i][0] + '</span><span>' + rows[i][1] + '</span></div>';
    }
    if (data.newBestScore) html += '<div class="newbest"><span>NEW BEST</span><span>Score!</span></div>';
    if (data.newBestTime) html += '<div class="newbest"><span>NEW BEST</span><span>Time!</span></div>';
    ui.ovStats.innerHTML = html;
  };

  Game.prototype.primaryAction = function () {
    this.audio.ensure();
    this.audio.sfx('select');
    if (this.overlayMode === 'title' || this.overlayMode === 'gameover' || this.overlayMode === 'win') {
      this.startRun();
    } else if (this.overlayMode === 'paused') {
      this.resume();
    }
  };

  Game.prototype.startRun = function () {
    this.world.reset();
    this.world.state = 'play';
    this.runTimeMs = 0;
    this.renderer.rebuild(this.world);
    this.hideOverlay();
    this.audio.setHurry(false);
    this.audio.setTheme('meadow');
    this.audio.resumeMusic();
  };

  Game.prototype.togglePause = function () {
    if (this.world.state === 'play') this.pause();
    else if (this.world.state === 'paused') this.resume();
  };

  Game.prototype.pause = function () {
    if (this.world.state !== 'play') return;
    this.world.state = 'paused';
    this.audio.suspendMusic();
    this.audio.sfx('pause');
    this.input.releaseAll();
    this.showOverlay('paused');
  };

  Game.prototype.resume = function () {
    if (this.world.state !== 'paused') return;
    this.world.state = 'play';
    this.audio.resumeMusic();
    this.hideOverlay();
  };

  Game.prototype.toggleMute = function () {
    this.muted = !this.muted;
    this.audio.setMuted(this.muted);
    this.ui.btnMute.textContent = this.muted ? 'Sound: Off' : 'Sound: On';
  };

  // ------------------------------------------------------------ loop

  Game.prototype.frame = function (t) {
    var dt = Math.min((t - this.lastTime) / 1000, C.MAX_FRAME_DT);
    this.lastTime = t;

    var snap = this.input.sample();

    if (snap.restartPressed && this.world.state !== 'title') {
      this.startRun();
      return;
    }
    if (snap.pausePressed) this.togglePause();
    if (snap.enterPressed) {
      if (this.world.state === 'paused') this.resume();
      else if (this.world.state !== 'play') this.primaryAction();
    }

    var simActive = this.world.state === 'play' || this.world.state === 'dying' ||
      this.world.state === 'warp' || this.world.state === 'finish';
    if (simActive) {
      if (this.world.state === 'play') this.runTimeMs += dt * 1000;
      this.accum += dt;
      var steps = 0;
      while (this.accum >= C.STEP && steps < 12) {
        this.world.step(C.STEP, snap);
        this.accum -= C.STEP;
        steps++;
        snap.jumpPressed = false;
      }
      this.afterStep();
    }

    this.renderer.sync(this.world, dt);
    this.updateHud();
  };

  Game.prototype.afterStep = function () {
    var w = this.world;
    var events = w.drainEvents();
    for (var i = 0; i < events.length; i++) {
      var e = events[i];
      this.audio.sfx(e.type);
      this.renderer.handleEvents([e]);
      if (e.type === 'hurry') this.audio.setHurry(true);
      if (e.type === 'starend') this.audio.setTheme(w.area === 'cellar' ? 'cellar' : 'meadow');
      if (e.type === 'areachange') this.audio.setTheme(e.area === 'cellar' ? 'cellar' : 'meadow');
      if (e.type === 'gameover') this.onGameOver();
      if (e.type === 'win') this.onWin();
    }
    if (w.state === 'play' || w.state === 'finish') {
      var wantTheme = w.player.starT > 0 ? 'star' : (w.area === 'cellar' ? 'cellar' : 'meadow');
      if (this.audio.theme !== wantTheme) this.audio.setTheme(wantTheme);
    }
  };

  Game.prototype.onGameOver = function () {
    this.audio.suspendMusic();
    if (this.world.score > this.records.bestScore) {
      this.records.bestScore = this.world.score;
      this.saveRecords();
    }
    this.showOverlay('gameover');
  };

  Game.prototype.onWin = function () {
    this.audio.suspendMusic();
    var w = this.world;
    var newBestScore = false, newBestTime = false;
    if (w.score > this.records.bestScore) {
      this.records.bestScore = w.score;
      newBestScore = true;
    }
    if (this.records.bestTimeMs === null || this.runTimeMs < this.records.bestTimeMs) {
      this.records.bestTimeMs = Math.round(this.runTimeMs);
      newBestTime = true;
    }
    this.saveRecords();
    var cap = w.flagCapture || {};
    this.showOverlay('win', {
      score: w.score,
      timeText: (this.runTimeMs / 1000).toFixed(1) + 's',
      coins: w.stats.coinsCollected,
      secrets: w.secretCount,
      enemies: w.stats.enemiesDefeated,
      flagBonus: cap.flagBonus || 0,
      timeBonus: cap.timeBonus || 0,
      fireworkBonus: cap.fireworkBonus || 0,
      newBestScore: newBestScore,
      newBestTime: newBestTime
    });
  };

  Game.prototype.updateHud = function () {
    var w = this.world;
    var ui = this.ui;
    ui.score.textContent = w.score;
    ui.coins.textContent = w.coinCount;
    ui.time.textContent = w.timerDisplay();
    ui.lives.textContent = w.lives;
    ui.power.textContent = w.player.power === 0 ? 'Small' : (w.player.power === 1 ? 'Big' : 'Fire');
    ui.secrets.textContent = w.secretCount + ' / 3';
    var progress = Math.max(0, Math.min(100, ((w.player.x - C.START_X) / (C.FLAG_X - C.START_X)) * 100));
    if (w.area === 'cellar') progress = 100;
    ui.progress.style.width = progress + '%';
  };

  root.LPMGame = { Game: Game };

  // Inspection API for deterministic gameplay checks.
  root.__lpm = {
    config: C,
    game: null
  };

  function boot() {
    var game = new Game();
    root.__lpm.game = game;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(typeof window !== 'undefined' ? window : globalThis);
