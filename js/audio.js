(function (root) {
  'use strict';

  // Original chiptune melodies generated with Web Audio oscillators.
  var N = {
    C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00, A3: 220.00, B3: 246.94,
    C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88,
    C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.00, B5: 987.77,
    C6: 1046.5, E6: 1318.5, G6: 1568.0
  };

  function seq(notes) { return notes; } // [freq|0, beats]

  var THEMES = {
    meadow: {
      tempo: 104,
      lead: seq([
        N.E5, 0.5, N.E5, 0.5, 0, 0.5, N.E5, 0.5, 0, 0.5, N.C5, 0.5, N.E5, 0.5, 0, 1,
        N.G5, 1, 0, 1, N.G4, 1, 0, 1,
        N.C5, 0.75, 0, 0.25, N.G4, 0.75, 0, 0.25, N.E4, 0.75, 0, 0.25,
        N.A4, 0.5, N.B4, 0.5, N.A4, 0.5, N.G4, 0.5, N.E5, 0.5, N.G5, 0.5, N.A5, 1, 0, 0.5,
        N.G5, 0.75, 0, 0.25, N.F5, 0.75, 0, 0.25, N.E5, 0.75, 0, 0.25,
        N.C5, 0.5, N.D5, 0.5, N.C5, 1, 0, 1
      ]),
      bass: seq([
        N.C3, 1, N.C3, 1, N.C3, 1, N.C3, 1,
        N.G3, 1, N.G3, 1, N.G3, 1, N.G3, 1,
        N.F3, 1, N.F3, 1, N.A3, 1, N.A3, 1,
        N.G3, 1, N.G3, 1, N.C3, 1, N.C3, 1
      ])
    },
    cellar: {
      tempo: 88,
      lead: seq([
        N.C4, 0.5, N.D4, 0.5, N.E4, 1, N.E4, 0.5, N.D4, 0.5,
        N.C4, 1, N.C4, 0.5, N.D4, 0.5, N.E4, 1, 0, 1,
        N.F4, 0.5, N.E4, 0.5, N.D4, 1, N.D4, 0.5, N.C4, 0.5,
        N.B3, 1, 0, 1
      ]),
      bass: seq([
        N.C3, 1, N.C3, 1, N.A3, 1, N.A3, 1,
        N.F3, 1, N.F3, 1, N.G3, 1, N.G3, 1
      ])
    },
    star: {
      tempo: 150,
      lead: seq([
        N.C5, 0.25, N.C5, 0.25, N.C5, 0.25, N.C5, 0.25,
        N.A4, 0.25, N.A4, 0.25, N.A4, 0.25, N.A4, 0.25,
        N.G4, 0.25, N.G4, 0.25, N.G4, 0.25, N.G4, 0.25,
        N.A4, 0.5, N.B4, 0.5, N.C5, 0.5, N.C5, 0.5
      ]),
      bass: seq([
        N.C3, 0.5, N.C3, 0.5, N.C3, 0.5, N.C3, 0.5,
        N.F3, 0.5, N.F3, 0.5, N.G3, 0.5, N.G3, 0.5
      ])
    }
  };

  function AudioEngine() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.muted = false;
    this.theme = null;
    this.hurry = false;
    this.leadIdx = 0;
    this.bassIdx = 0;
    this.nextLead = 0;
    this.nextBass = 0;
    this.timerId = null;
    this.suspended = true;
  }

  AudioEngine.prototype.ensure = function () {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    var AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return false;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 1;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.5;
      this.musicGain.connect(this.master);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.8;
      this.sfxGain.connect(this.master);
      this.suspended = false;
      this.startScheduler();
      return true;
    } catch (e) {
      return false;
    }
  };

  AudioEngine.prototype.setMuted = function (muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 1;
  };

  AudioEngine.prototype.tone = function (freq, start, dur, type, gainNode, vol, slideTo) {
    var ctx = this.ctx;
    if (!ctx || freq <= 0) return;
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
    g.gain.setValueAtTime(vol, start);
    g.gain.exponentialRampToValueAtTime(0.001, start + dur);
    osc.connect(g);
    g.connect(gainNode);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  };

  AudioEngine.prototype.noise = function (start, dur, vol) {
    var ctx = this.ctx;
    if (!ctx) return;
    var len = Math.floor(ctx.sampleRate * dur);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var g = ctx.createGain();
    g.gain.value = vol;
    src.connect(g);
    g.connect(this.sfxGain);
    src.start(start);
  };

  AudioEngine.prototype.jingle = function (notes, gap, type, vol) {
    if (!this.ctx) return;
    var t = this.ctx.currentTime;
    for (var i = 0; i < notes.length; i++) {
      this.tone(notes[i], t + i * gap, gap * 1.6, type || 'square', this.sfxGain, vol || 0.18);
    }
  };

  AudioEngine.prototype.sfx = function (name) {
    if (!this.ctx || this.muted) return;
    var t = this.ctx.currentTime;
    switch (name) {
      case 'jump': this.tone(330, t, 0.18, 'square', this.sfxGain, 0.15, 660); break;
      case 'coin': this.tone(988, t, 0.08, 'square', this.sfxGain, 0.16); this.tone(1319, t + 0.08, 0.25, 'square', this.sfxGain, 0.16); break;
      case 'coinpop': this.tone(988, t, 0.06, 'square', this.sfxGain, 0.14); this.tone(1319, t + 0.06, 0.18, 'square', this.sfxGain, 0.14); break;
      case 'stomp': this.tone(400, t, 0.12, 'square', this.sfxGain, 0.2, 120); break;
      case 'bump': this.tone(160, t, 0.09, 'square', this.sfxGain, 0.2, 110); break;
      case 'brickbreak': this.noise(t, 0.25, 0.25); this.tone(220, t, 0.12, 'square', this.sfxGain, 0.12, 80); break;
      case 'grow': this.jingle([N.C4, N.E4, N.G4, N.C5, N.E5], 0.07); break;
      case 'fire': this.jingle([N.G4, N.C5, N.E5, N.G5], 0.06); break;
      case 'shrink': this.jingle([N.G5, N.E5, N.C5, N.G4], 0.06); break;
      case 'fireball': this.tone(700, t, 0.14, 'sawtooth', this.sfxGain, 0.12, 180); break;
      case 'fireballhit': this.noise(t, 0.12, 0.18); break;
      case 'shellkick': this.tone(500, t, 0.1, 'square', this.sfxGain, 0.2, 200); break;
      case 'shellbump': this.tone(200, t, 0.08, 'square', this.sfxGain, 0.18, 140); break;
      case 'shellwarn': this.tone(600, t, 0.07, 'square', this.sfxGain, 0.1, 500); break;
      case 'shellwake': this.jingle([N.C5, N.G4], 0.05); break;
      case 'oneup': this.jingle([N.E5, N.G5, N.E6, N.C6, N.D6, N.G6], 0.09); break;
      case 'star': this.jingle([N.C5, N.E5, N.G5], 0.07); break;
      case 'starend': this.jingle([N.G5, N.C5], 0.06); break;
      case 'death': this.jingle([N.B4, N.F4, 0, N.D4, 0, N.C4], 0.12); break;
      case 'hurry': this.jingle([N.C5, N.C5, N.C5], 0.1, 'square', 0.2); break;
      case 'reveal': this.tone(880, t, 0.12, 'square', this.sfxGain, 0.15, 1200); break;
      case 'secret': this.jingle([N.C5, N.E5, N.G5, N.C6], 0.08); break;
      case 'warpenter': case 'warpexit': this.tone(400, t, 0.4, 'square', this.sfxGain, 0.14, 100); break;
      case 'flaggrab': this.jingle([N.G4, N.C5, N.E5, N.G5, N.C6], 0.08); break;
      case 'tally': this.tone(1100, t, 0.04, 'square', this.sfxGain, 0.1); break;
      case 'firework': this.noise(t, 0.5, 0.3); this.tone(200, t, 0.3, 'triangle', this.sfxGain, 0.15, 60); break;
      case 'pause': this.tone(660, t, 0.08, 'square', this.sfxGain, 0.12); break;
      case 'select': this.tone(880, t, 0.08, 'square', this.sfxGain, 0.12); break;
      case 'win': this.jingle([N.C5, N.E5, N.G5, N.C6, N.E6, N.G6, 0, N.C6], 0.12); break;
      case 'gameover': this.jingle([N.C5, N.G4, N.E4, 0, N.C4], 0.15); break;
    }
  };

  // ---- music sequencer (bounded scheduling) ----

  AudioEngine.prototype.startScheduler = function () {
    var self = this;
    this.nextLead = this.ctx.currentTime + 0.1;
    this.nextBass = this.ctx.currentTime + 0.1;
    this.timerId = setInterval(function () { self.schedule(); }, 100);
  };

  AudioEngine.prototype.setTheme = function (name) {
    if (this.theme === name) return;
    this.theme = name;
    this.leadIdx = 0;
    this.bassIdx = 0;
    if (this.ctx) {
      this.nextLead = this.ctx.currentTime + 0.05;
      this.nextBass = this.ctx.currentTime + 0.05;
    }
  };

  AudioEngine.prototype.setHurry = function (on) {
    this.hurry = on;
  };

  AudioEngine.prototype.schedule = function () {
    if (!this.ctx || this.suspended || this.muted || !this.theme) return;
    var theme = THEMES[this.theme];
    if (!theme) return;
    var beat = 60 / (theme.tempo * (this.hurry ? 1.35 : 1));
    var horizon = this.ctx.currentTime + 0.25;

    while (this.nextLead < horizon) {
      var f = theme.lead[this.leadIdx];
      var d = theme.lead[this.leadIdx + 1];
      if (f > 0) this.tone(f, this.nextLead, Math.min(d * beat * 0.9, 0.5), 'square', this.musicGain, 0.1);
      this.nextLead += d * beat;
      this.leadIdx += 2;
      if (this.leadIdx >= theme.lead.length) this.leadIdx = 0;
    }
    while (this.nextBass < horizon) {
      var bf = theme.bass[this.bassIdx];
      var bd = theme.bass[this.bassIdx + 1];
      if (bf > 0) this.tone(bf, this.nextBass, Math.min(bd * beat * 0.9, 0.5), 'triangle', this.musicGain, 0.14);
      this.nextBass += bd * beat;
      this.bassIdx += 2;
      if (this.bassIdx >= theme.bass.length) this.bassIdx = 0;
    }
  };

  AudioEngine.prototype.suspendMusic = function () {
    this.suspended = true;
  };

  AudioEngine.prototype.resumeMusic = function () {
    if (!this.ctx) return;
    this.suspended = false;
    this.nextLead = this.ctx.currentTime + 0.05;
    this.nextBass = this.ctx.currentTime + 0.05;
  };

  var api = { AudioEngine: AudioEngine, THEMES: THEMES };
  root.LPMAudio = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : globalThis);
