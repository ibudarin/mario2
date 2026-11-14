(function (root) {
  'use strict';

  function Input() {
    this.state = {
      left: false, right: false, run: false, down: false,
      jumpHeld: false, jumpPressed: false,
      pausePressed: false, restartPressed: false, enterPressed: false
    };
    this.touch = {
      left: false, right: false, run: false, down: false, jump: false
    };
    this.enabled = true;
    this._bindKeyboard();
  }

  Input.prototype._bindKeyboard = function () {
    var self = this;
    var keyMap = {
      ArrowLeft: 'left', KeyA: 'left',
      ArrowRight: 'right', KeyD: 'right',
      ArrowDown: 'down', KeyS: 'down',
      ShiftLeft: 'run', ShiftRight: 'run', KeyX: 'run',
      Space: 'jump', KeyW: 'jump', ArrowUp: 'jump'
    };

    function onKeyDown(e) {
      if (!self.enabled) return;
      var action = keyMap[e.code];
      if (action === 'jump') {
        if (!e.repeat && !self.state.jumpHeld) self.state.jumpPressed = true;
        self.state.jumpHeld = true;
        e.preventDefault();
      } else if (action) {
        self.state[action] = true;
        e.preventDefault();
      } else if (e.code === 'KeyP' || e.code === 'Escape') {
        self.state.pausePressed = true;
        e.preventDefault();
      } else if (e.code === 'KeyR') {
        self.state.restartPressed = true;
        e.preventDefault();
      } else if (e.code === 'Enter') {
        self.state.enterPressed = true;
        e.preventDefault();
      }
    }

    function onKeyUp(e) {
      var action = keyMap[e.code];
      if (action === 'jump') {
        self.state.jumpHeld = false;
      } else if (action) {
        self.state[action] = false;
      }
    }

    root.addEventListener('keydown', onKeyDown);
    root.addEventListener('keyup', onKeyUp);
    root.addEventListener('blur', function () { self.releaseAll(); });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) self.releaseAll();
    });
  };

  Input.prototype.bindTouchButton = function (el, name) {
    var self = this;
    function press(e) {
      e.preventDefault();
      self.touch[name] = true;
      if (name === 'jump' && !self.state.jumpHeld) self.state.jumpPressed = true;
      if (name === 'jump') self.state.jumpHeld = true;
      try { el.setPointerCapture(e.pointerId); } catch (err) {}
    }
    function release() {
      self.touch[name] = false;
      if (name === 'jump') self.state.jumpHeld = false;
    }
    el.addEventListener('pointerdown', press);
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('lostpointercapture', release);
    el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  };

  Input.prototype.releaseAll = function () {
    this.state.left = false;
    this.state.right = false;
    this.state.run = false;
    this.state.down = false;
    this.state.jumpHeld = false;
    this.touch.left = false;
    this.touch.right = false;
    this.touch.run = false;
    this.touch.down = false;
    this.touch.jump = false;
  };

  // Snapshot for the simulation; clears single-frame edges.
  Input.prototype.sample = function () {
    var s = this.state;
    var snap = {
      left: s.left || this.touch.left,
      right: s.right || this.touch.right,
      run: s.run || this.touch.run,
      down: s.down || this.touch.down,
      jumpHeld: s.jumpHeld,
      jumpPressed: s.jumpPressed,
      pausePressed: s.pausePressed,
      restartPressed: s.restartPressed,
      enterPressed: s.enterPressed
    };
    s.jumpPressed = false;
    s.pausePressed = false;
    s.restartPressed = false;
    s.enterPressed = false;
    return snap;
  };

  root.LPMInput = { Input: Input };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.LPMInput;
})(typeof self !== 'undefined' ? self : globalThis);
