(function (root) {
  'use strict';

  var C = root.LPMConfig || require('./config.js');
  var LEVEL = root.LPMLevel || require('./level.js');

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  function aabbOverlap(ax0, ay0, ax1, ay1, bx0, by0, bx1, by1) {
    return ax0 < bx1 && ax1 > bx0 && ay0 < by1 && ay1 > by0;
  }

  var EPS = 0.001;

  function playerHeight(power, ducked) {
    if (ducked && power > 0) return C.HEIGHT_DUCK;
    return power > 0 ? C.HEIGHT_BIG : C.HEIGHT_SMALL;
  }

  function World() {
    this.events = [];
    this.reset(true);
  }

  World.prototype.reset = function () {
    var data = LEVEL.buildLevel();
    this.tiles = {};
    this.tileList = [];
    for (var i = 0; i < data.tiles.length; i++) {
      var t = data.tiles[i];
      var tile = {
        gx: t.gx, gy: t.gy, type: t.type, content: t.content || null,
        area: t.area || 'surface',
        revealed: t.type !== 'hidden',
        solid: t.type !== 'hidden',
        bumpT: 0,
        coinsLeft: t.content === 'multicoin' ? C.MULTI_COIN_PAYOUT : 0,
        breaking: false
      };
      this.tiles[t.gx + ',' + t.gy] = tile;
      this.tileList.push(tile);
    }
    this.pipes = data.pipes;
    this.decor = data.decor;
    this.coinDefs = data.coins;

    this.player = {
      x: C.START_X, y: 0, vx: 0, vy: 0, prevY: 0,
      power: 0, ducked: false, facing: 1,
      grounded: true, coyoteT: 0, bufferT: 0, jumpHeld: false,
      invulnT: 0, starT: 0, growT: 0, skidding: false,
      stompChain: 0, fireCooldown: 0, throwPoseT: 0,
      control: true, deadT: 0
    };
    this.playerH = playerHeight(0, false);

    this.enemies = [];
    this.items = [];
    this.fireballs = [];
    this.popups = [];
    this.coins = [];
    for (i = 0; i < this.coinDefs.length; i++) {
      this.coins.push({ x: this.coinDefs[i].x, y: this.coinDefs[i].y, area: this.coinDefs[i].area, taken: false });
    }
    this.spawnEnemies(data.enemies);

    this.state = 'title';
    this.area = 'surface';
    this.score = 0;
    this.coinCount = 0;
    this.lives = C.LIVES_START;
    this.timeLeft = C.TIMER_START;
    this.hurry = false;
    this.checkpoint = false;
    this.discoveries = { oneUp: false, star: false, cellar: false };
    this.secretCount = 0;
    this.stats = { enemiesDefeated: 0, coinsCollected: 0 };
    this.warpSeq = null;
    this.finishSeq = null;
    this.deathSeq = null;
    this.flagCapture = null;
    this.events.length = 0;
  };

  World.prototype.spawnEnemies = function (defs) {
    for (var i = 0; i < defs.length; i++) {
      var d = defs[i];
      this.enemies.push({
        kind: 'enemy', type: d.type, color: d.color || 'green',
        x: d.x, y: d.y, vx: 0, vy: 0, prevY: d.y,
        w: 0.8, h: d.type === 'koopa' ? 1.5 : 0.8,
        dir: -1, state: 'walk', active: false,
        flatT: 0, wakeT: 0, chainIdx: 0, graceT: 0, deadT: 0,
        spawn: { x: d.x, y: d.y, type: d.type, color: d.color || 'green' }
      });
    }
  };

  World.prototype.event = function (type, data) {
    var e = { type: type, t: 0 };
    if (data) for (var k in data) e[k] = data[k];
    this.events.push(e);
  };

  World.prototype.popup = function (x, y, text) {
    this.popups.push({ kind: 'popup', x: x, y: y, text: String(text), t: 0 });
  };

  World.prototype.addScore = function (n, x, y) {
    this.score += n;
    if (x !== undefined) this.popup(x, y, n);
  };

  World.prototype.addCoin = function (x, y) {
    this.coinCount++;
    this.stats.coinsCollected++;
    this.addScore(C.SCORE_COIN, x, y);
    if (this.coinCount > 0 && this.coinCount % C.COINS_PER_LIFE === 0) {
      this.lives++;
      this.event('oneup');
      this.popup(x, y, '1-UP');
    }
  };

  World.prototype.awardChain = function (chain, idx, x, y) {
    var value = chain[Math.min(idx, chain.length - 1)];
    if (value === '1UP') {
      this.lives++;
      this.event('oneup');
      this.popup(x, y, '1-UP');
    } else {
      this.addScore(value, x, y);
    }
  };

  World.prototype.markSecret = function (name, x, y) {
    if (!this.discoveries[name]) {
      this.discoveries[name] = true;
      this.secretCount++;
      this.event('secret', { name: name });
      this.popup(x, y, 'SECRET!');
    }
  };

  // ------------------------------------------------------------------ tiles

  World.prototype.tileAt = function (gx, gy) {
    return this.tiles[gx + ',' + gy] || null;
  };

  World.prototype.isSolid = function (tile) {
    return !!tile && tile.solid;
  };

  World.prototype.tilesInBox = function (x0, y0, x1, y1, includeHidden) {
    var out = [];
    var gx0 = Math.floor(x0), gx1 = Math.floor(x1 - EPS);
    var gy0 = Math.floor(y0), gy1 = Math.floor(y1 - EPS);
    for (var gx = gx0; gx <= gx1; gx++) {
      for (var gy = gy0; gy <= gy1; gy++) {
        var t = this.tileAt(gx, gy);
        if (!t) continue;
        if (!t.solid) {
          if (!(includeHidden && t.type === 'hidden' && !t.revealed)) continue;
        }
        out.push(t);
      }
    }
    return out;
  };

  World.prototype.removeTile = function (tile) {
    tile.solid = false;
    tile.breaking = true;
    delete this.tiles[tile.gx + ',' + tile.gy];
    var idx = this.tileList.indexOf(tile);
    if (idx >= 0) this.tileList.splice(idx, 1);
  };

  World.prototype.activateBlock = function (tile, byShell) {
    var p = this.player;
    var cx = tile.gx + 0.5, topY = tile.gy + 1;

    if (tile.type === 'question' || tile.type === 'hidden') {
      if (tile.type === 'hidden' && !tile.revealed) {
        tile.revealed = true;
        tile.solid = true;
        this.event('reveal', { x: cx, y: tile.gy + 0.5 });
        this.markSecret('oneUp', cx, tile.gy + 1);
      }
      this.releaseBlockContent(tile, cx, topY);
      tile.type = 'used';
      tile.content = null;
      tile.bumpT = 0.001;
      this.event('bump', { x: cx, y: tile.gy + 0.5 });
      this.bumpKillOnTop(tile);
      return;
    }

    if (tile.type === 'brick') {
      if (tile.content === 'multicoin') {
        if (tile.coinsLeft > 0) {
          tile.coinsLeft--;
          this.addCoin(cx, topY + 0.5);
          this.event('coinpop', { x: cx, y: topY });
          if (tile.coinsLeft === 0) {
            tile.type = 'used';
            tile.content = null;
          }
        }
        tile.bumpT = 0.001;
        this.event('bump', { x: cx, y: tile.gy + 0.5 });
        this.bumpKillOnTop(tile);
        return;
      }
      if (tile.content === 'star') {
        this.releaseBlockContent(tile, cx, topY);
        tile.type = 'used';
        tile.content = null;
        tile.bumpT = 0.001;
        this.event('bump', { x: cx, y: tile.gy + 0.5 });
        this.bumpKillOnTop(tile);
        return;
      }
      var canBreak = byShell || p.power > 0;
      if (canBreak) {
        this.removeTile(tile);
        this.addScore(C.SCORE_BRICK, cx, tile.gy + 0.5);
        this.event('brickbreak', { x: cx, y: tile.gy + 0.5 });
      } else {
        tile.bumpT = 0.001;
        this.event('bump', { x: cx, y: tile.gy + 0.5 });
      }
      this.bumpKillOnTop(tile);
    }
  };

  World.prototype.releaseBlockContent = function (tile, cx, topY) {
    var content = tile.content;
    if (content === 'coin') {
      this.addCoin(cx, topY + 0.5);
      this.event('coinpop', { x: cx, y: topY });
      return;
    }
    var itemType = null;
    if (content === 'power') itemType = this.player.power === 0 ? 'mushroom' : 'flower';
    else if (content === 'oneup') itemType = 'oneup';
    else if (content === 'star') itemType = 'star';
    if (!itemType) return;
    this.items.push({
      kind: 'item', type: itemType,
      x: cx, y: topY - 0.05, vx: 0, vy: 0,
      state: 'emerge', emergeT: 0.8, emergeY0: tile.gy - 0.2,
      dir: 1, w: 0.8, h: 0.8
    });
    this.event('itememerge', { x: cx, y: topY, type: itemType });
  };

  World.prototype.bumpKillOnTop = function (tile) {
    var topY = tile.gy + 1;
    for (var i = 0; i < this.enemies.length; i++) {
      var e = this.enemies[i];
      if (e.state === 'dead' || e.state === 'flat' || !e.active) continue;
      if (Math.abs(e.y - topY) < 0.15 && e.x + e.w / 2 > tile.gx && e.x - e.w / 2 < tile.gx + 1) {
        this.defeatEnemy(e, 'bump');
      }
    }
  };

  World.prototype.defeatEnemy = function (e, cause, shell) {
    if (e.state === 'dead' || e.state === 'flat') return;
    this.stats.enemiesDefeated++;
    var x = e.x, y = e.y + e.h / 2;
    if (cause === 'stomp') {
      this.awardChain(C.STOMP_CHAIN, this.player.stompChain, x, y);
      this.player.stompChain = Math.min(this.player.stompChain + 1, C.STOMP_CHAIN.length - 1);
    } else if (cause === 'shell' && shell) {
      this.awardChain(C.SHELL_CHAIN, shell.chainIdx, x, y);
      shell.chainIdx = Math.min(shell.chainIdx + 1, C.SHELL_CHAIN.length - 1);
    } else {
      this.addScore(C.SCORE_KILL, x, y);
    }
    if (cause === 'bump') {
      e.state = 'dead';
      e.deadT = 0;
      e.vy = 8;
    } else if (e.type === 'goomba' && cause === 'stomp') {
      e.state = 'flat';
      e.flatT = 0.5;
      e.vx = 0;
    } else if (cause === 'stomp' || cause === 'shell' || cause === 'fireball' || cause === 'star') {
      e.state = 'dead';
      e.deadT = 0;
      e.vy = 8;
      e.vx = (e.x < this.player.x ? -2 : 2);
    }
    this.event('enemydefeat', { x: x, y: y, cause: cause, type: e.type });
  };

  // ------------------------------------------------------------------ step

  World.prototype.step = function (dt, input) {
    input = input || {};
    for (var i = 0; i < this.events.length; i++) this.events[i].t += dt;

    if (this.state === 'play') this.playStep(dt, input);
    else if (this.state === 'dying') this.deathStep(dt);
    else if (this.state === 'warp') this.warpStep(dt);
    else if (this.state === 'finish') this.finishStep(dt);

    this.updatePopups(dt);
  };

  World.prototype.updatePopups = function (dt) {
    for (var i = this.popups.length - 1; i >= 0; i--) {
      var p = this.popups[i];
      p.t += dt;
      p.y += dt * 1.5;
      if (p.t > 0.9) this.popups.splice(i, 1);
    }
  };

  // ------------------------------------------------------------------ play

  World.prototype.playStep = function (dt, input) {
    var p = this.player;

    if (p.growT > 0) {
      p.growT -= dt;
      this.updateTileBumps(dt);
      return;
    }

    // Timer
    this.timeLeft -= dt / C.TIMER_UNIT_SECONDS;
    if (!this.hurry && this.timeLeft <= C.TIMER_HURRY_AT) {
      this.hurry = true;
      this.event('hurry');
    }
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.die();
      return;
    }

    p.invulnT = Math.max(0, p.invulnT - dt);
    p.starT = Math.max(0, p.starT - dt);
    if (p.starT === 0 && p._starWas > 0) this.event('starend');
    p._starWas = p.starT;
    p.fireCooldown = Math.max(0, p.fireCooldown - dt);
    p.throwPoseT = Math.max(0, p.throwPoseT - dt);

    this.playerControl(dt, input);
    this.movePlayer(dt);
    this.updateTileBumps(dt);
    this.updateEnemies(dt);
    this.updateItems(dt);
    this.updateFireballs(dt);
    this.collectCoins();
    this.enemyContacts();

    // Flag
    if (this.area === 'surface' && p.x >= C.FLAG_X && p.y > 0.2) {
      this.startFinish();
      return;
    }

    // Pit death
    if (p.y < C.DEATH_Y) {
      this.die();
      return;
    }

    // Cellar exit: stand on the cellar exit pipe and press down.
    if (input.down && p.grounded && this.area === 'cellar') {
      if (this.onPipeTop(p, 214, 215, -3)) {
        this.startWarp('cellar-exit');
        return;
      }
    }
    // Surface cellar entry: stand on the warp pipe and press down.
    if (input.down && p.grounded && this.area === 'surface') {
      if (this.onPipeTop(p, -12, -11, 3)) {
        this.startWarp('cellar-enter');
        return;
      }
    }
  };

  World.prototype.onPipeTop = function (p, gx0, gx1, topY) {
    return Math.abs(p.y - topY) < 0.05 && p.x > gx0 + 0.2 && p.x < gx1 + 0.8;
  };

  World.prototype.playerControl = function (dt, input) {
    var p = this.player;
    if (!p.control) return;

    var dir = (input.left ? -1 : 0) + (input.right ? 1 : 0);
    if (dir !== 0) p.facing = dir;

    // Ducking
    if (input.down && p.grounded && p.power > 0) {
      if (!p.ducked) { p.ducked = true; this.playerH = playerHeight(p.power, true); }
    } else if (p.ducked) {
      // Stand only when there is headroom.
      var standH = C.HEIGHT_BIG;
      var tiles = this.tilesInBox(p.x - C.PLAYER_HALF_W + EPS, p.y + EPS, p.x + C.PLAYER_HALF_W - EPS, p.y + standH - EPS, false);
      if (tiles.length === 0) {
        p.ducked = false;
        this.playerH = playerHeight(p.power, false);
      }
    }

    // Horizontal movement
    var maxSpeed = (input.run && !p.ducked) ? C.RUN_SPEED : C.WALK_SPEED;
    if (p.ducked) maxSpeed = 0;
    var accel = p.grounded ? C.ACCEL_GROUND : C.ACCEL_AIR;
    var brake = p.grounded ? C.BRAKE_GROUND : C.BRAKE_AIR;
    p.skidding = false;
    if (dir !== 0 && !p.ducked) {
      if (p.vx * dir < 0) {
        // Reversing against current motion: brake + accel.
        p.vx += dir * (brake + accel) * dt;
        if (p.grounded && Math.abs(p.vx) > 2) p.skidding = true;
      } else if (Math.abs(p.vx) < maxSpeed) {
        p.vx += dir * accel * dt;
        if (Math.abs(p.vx) > maxSpeed) p.vx = dir * maxSpeed;
      } else {
        // Above cap (e.g. released run): ease back down toward the cap.
        p.vx -= Math.sign(p.vx) * brake * dt;
        if (Math.abs(p.vx) < maxSpeed) p.vx = dir * maxSpeed;
      }
    } else {
      var bv = Math.abs(p.vx);
      var dec = brake * dt;
      if (bv <= dec) p.vx = 0;
      else p.vx -= Math.sign(p.vx) * dec;
    }

    // Jumping: coyote time + buffer
    if (input.jumpPressed) p.bufferT = C.JUMP_BUFFER;
    p.bufferT = Math.max(0, p.bufferT - dt);
    p.coyoteT = Math.max(0, p.coyoteT - dt);

    p.jumpHeld = !!input.jumpHeld;
    if (p.bufferT > 0 && (p.coyoteT > 0 || p.grounded)) {
      var boost = Math.abs(p.vx) > C.WALK_SPEED + 0.1 ? C.RUN_JUMP_BOOST : 0;
      p.vy = C.JUMP_SPEED + boost;
      p.grounded = false;
      p.coyoteT = 0;
      p.bufferT = 0;
      p.jumpHeld = true;
      this.event('jump');
    }
    if (!input.jumpHeld && p.vy > 14) p.vy = 14;

    // Fireballs
    if (p.power === 2 && input.run && p.fireCooldown === 0 && !p.ducked) {
      var count = 0;
      for (var i = 0; i < this.fireballs.length; i++) if (this.fireballs[i].owner === 'player') count++;
      if (count < C.FIREBALL_MAX) {
        var fx = p.x + p.facing * 0.6;
        var fy = p.y + 0.6;
        var blocked = this.tilesInBox(fx - 0.2, fy - 0.2, fx + 0.2, fy + 0.2, false);
        if (blocked.length === 0) {
          this.fireballs.push({ kind: 'fireball', owner: 'player', x: fx, y: fy, vx: p.facing * C.FIREBALL_SPEED, vy: 2, life: C.FIREBALL_LIFE });
          p.fireCooldown = C.FIREBALL_COOLDOWN;
          p.throwPoseT = 0.25;
          this.event('fireball', { x: fx, y: fy });
        }
      }
    }
  };

  World.prototype.movePlayer = function (dt) {
    var p = this.player;
    var hw = C.PLAYER_HALF_W, h = this.playerH;

    // Horizontal
    p.x += p.vx * dt;
    if (p.vx !== 0) {
      var solids = this.tilesInBox(p.x - hw, p.y + EPS, p.x + hw, p.y + h - EPS, false);
      for (var i = 0; i < solids.length; i++) {
        var t = solids[i];
        if (p.vx > 0 && p.x + hw > t.gx && p.x - hw < t.gx + 1) {
          p.x = t.gx - hw - EPS; p.vx = 0;
        } else if (p.vx < 0 && p.x - hw < t.gx + 1 && p.x + hw > t.gx) {
          p.x = t.gx + 1 + hw + EPS; p.vx = 0;
        }
      }
    }

    // Vertical
    p.prevY = p.y;
    p.vy = Math.max(p.vy + C.GRAVITY * dt, -C.MAX_FALL);
    p.y += p.vy * dt;

    if (p.vy > 0) {
      var ups = this.tilesInBox(p.x - hw + EPS, p.y + EPS, p.x + hw - EPS, p.y + h - EPS, true);
      if (ups.length > 0) {
        var botY = Infinity;
        var hitTile = null;
        var bestDist = Infinity;
        for (var i = 0; i < ups.length; i++) {
          if (ups[i].gy < botY) botY = ups[i].gy;
          var d = Math.abs((ups[i].gx + 0.5) - p.x);
          if (d < bestDist) { bestDist = d; hitTile = ups[i]; }
        }
        p.y = botY - h - EPS;
        p.vy = 0;
        if (hitTile && p.control) {
          this.activateBlock(hitTile, false);
        }
      }
    } else {
      var downs = this.tilesInBox(p.x - hw + EPS, p.y + EPS, p.x + hw - EPS, p.y + h - EPS, false);
      if (downs.length > 0) {
        var topY = -Infinity;
        for (var i2 = 0; i2 < downs.length; i2++) topY = Math.max(topY, downs[i2].gy + 1);
        p.y = topY;
        p.vy = 0;
        if (!p.grounded) {
          p.grounded = true;
          p.stompChain = 0;
          this.event('land');
        }
      }
    }

    // Ground probe: stay grounded while supported, walk off edges cleanly.
    if (p.vy <= 0) {
      var support = this.tilesInBox(p.x - hw + EPS, p.y - 0.06, p.x + hw - EPS, p.y + EPS, false);
      if (support.length > 0) {
        if (!p.grounded) {
          p.grounded = true;
          p.stompChain = 0;
          this.event('land');
        }
        p.coyoteT = C.COYOTE_TIME;
      } else if (p.grounded) {
        p.grounded = false;
      }
    }
  };

  World.prototype.updateTileBumps = function (dt) {
    for (var i = 0; i < this.tileList.length; i++) {
      var t = this.tileList[i];
      if (t.bumpT > 0) {
        t.bumpT += dt;
        if (t.bumpT > 0.25) t.bumpT = 0;
      }
    }
  };

  // ------------------------------------------------------------------ enemies

  World.prototype.updateEnemies = function (dt) {
    var p = this.player;
    for (var i = this.enemies.length - 1; i >= 0; i--) {
      var e = this.enemies[i];
      if (!e.active) {
        if (Math.abs(e.x - p.x) < C.ENEMY_ACTIVATE_DIST && e.x > p.x - 10) e.active = true;
        else continue;
      }
      e.graceT = Math.max(0, e.graceT - dt);
      e.prevY = e.y;

      if (e.state === 'dead') {
        e.deadT += dt;
        e.vy += C.GRAVITY * dt;
        e.y += e.vy * dt;
        e.x += e.vx * dt;
        if (e.y < C.DEATH_Y - 6) this.enemies.splice(i, 1);
        continue;
      }
      if (e.state === 'flat') {
        e.flatT -= dt;
        if (e.flatT <= 0) this.enemies.splice(i, 1);
        continue;
      }

      var speed = 0;
      if (e.state === 'walk') speed = e.type === 'goomba' ? C.GOOMBA_SPEED : C.KOOPA_SPEED;
      else if (e.state === 'slide') speed = C.SHELL_SPEED;

      // Gravity + vertical collision
      e.vy = Math.max(e.vy + C.GRAVITY * dt, -C.MAX_FALL);
      e.y += e.vy * dt;
      var hw = e.w / 2;
      var eh = e.state === 'shell' || e.state === 'slide' ? 0.9 : e.h;
      if (e.vy <= 0) {
        var below = this.tilesInBox(e.x - hw + EPS, e.y + EPS, e.x + hw - EPS, e.y + eh - EPS, false);
        if (below.length > 0) {
          var topY = -Infinity;
          for (var b = 0; b < below.length; b++) topY = Math.max(topY, below[b].gy + 1);
          e.y = topY; e.vy = 0;
        }
      }
      if (e.y < C.DEATH_Y - 4) { this.enemies.splice(i, 1); continue; }

      if (e.state === 'shell') {
        e.wakeT -= dt;
        if (e.wakeT < C.SHELL_WARN_TIME && !e.warned) {
          e.warned = true;
          this.event('shellwarn', { x: e.x, y: e.y });
        }
        if (e.wakeT <= 0) {
          var headroom = this.tilesInBox(e.x - e.w / 2 + EPS, e.y + 0.9 + EPS, e.x + e.w / 2 - EPS, e.y + 1.5 - EPS, false);
          if (headroom.length === 0) {
            e.state = 'walk';
            e.warned = false;
            e.h = 1.5;
            this.event('shellwake', { x: e.x, y: e.y });
          } else {
            e.wakeT = C.SHELL_WARN_TIME;
            e.warned = false;
          }
        }
        continue;
      }

      // Horizontal movement
      e.x += e.dir * speed * dt;
      var solids = this.tilesInBox(e.x - hw, e.y + EPS, e.x + hw, e.y + eh - EPS, false);
      for (var s = 0; s < solids.length; s++) {
        var t = solids[s];
        var overlap = false;
        if (e.dir > 0 && e.x + hw > t.gx && e.x - hw < t.gx + 1) overlap = true;
        if (e.dir < 0 && e.x - hw < t.gx + 1 && e.x + hw > t.gx) overlap = true;
        if (!overlap) continue;
        if (e.state === 'slide') {
          if (t.type === 'brick' && t.content !== 'multicoin' && t.content !== 'star') {
            this.removeTile(t);
            this.addScore(C.SCORE_BRICK, t.gx + 0.5, t.gy + 0.5);
            this.event('brickbreak', { x: t.gx + 0.5, y: t.gy + 0.5 });
            this.event('shellbump', { x: e.x, y: e.y });
            solids.splice(s, 1);
            s--;
            continue;
          } else if (t.type === 'question') {
            this.activateBlock(t, true);
          }
          this.event('shellbump', { x: e.x, y: e.y });
        }
        if (e.dir > 0) e.x = t.gx - hw - EPS;
        else e.x = t.gx + 1 + hw + EPS;
        e.dir = -e.dir;
        break;
      }

      // Red koopa ledge check
      if (e.type === 'koopa' && e.color === 'red' && e.state === 'walk' && e.vy === 0) {
        var aheadX = e.dir > 0 ? e.x + hw + 0.1 : e.x - hw - 0.1;
        var support = this.tilesInBox(aheadX - 0.05, e.y - 0.1, aheadX + 0.05, e.y - 0.02, false);
        if (support.length === 0) e.dir = -e.dir;
      }

      // Enemy vs enemy (walking states turn apart)
      for (var j = 0; j < this.enemies.length; j++) {
        if (j === i) continue;
        var o = this.enemies[j];
        if (!o.active || o.state === 'dead' || o.state === 'flat') continue;
        var oh = o.state === 'shell' || o.state === 'slide' ? 0.9 : o.h;
        if (aabbOverlap(e.x - hw, e.y, e.x + hw, e.y + eh, o.x - o.w / 2, o.y, o.x + o.w / 2, o.y + oh)) {
          if (e.state === 'slide') {
            this.defeatEnemy(o, 'shell', e);
          } else if (o.state === 'slide') {
            this.defeatEnemy(e, 'shell', o);
          } else {
            if (e.x < o.x) { e.dir = -1; o.dir = 1; e.x -= 0.02; o.x += 0.02; }
            else { e.dir = 1; o.dir = -1; e.x += 0.02; o.x -= 0.02; }
          }
        }
      }
    }
  };

  World.prototype.enemyContacts = function () {
    var p = this.player;
    if (!p.control || p.growT > 0) return;
    var ph = this.playerH;
    for (var i = 0; i < this.enemies.length; i++) {
      var e = this.enemies[i];
      if (!e.active || e.state === 'dead' || e.state === 'flat') continue;
      var eh = e.state === 'shell' || e.state === 'slide' ? 0.9 : e.h;
      if (!aabbOverlap(p.x - C.PLAYER_HALF_W, p.y, p.x + C.PLAYER_HALF_W, p.y + ph,
        e.x - e.w / 2, e.y, e.x + e.w / 2, e.y + eh)) continue;

      if (p.starT > 0) {
        this.defeatEnemy(e, 'star');
        continue;
      }

      var stomp = p.vy < 0 && p.prevY >= e.y + eh - 0.08;
      if (stomp) {
        if (e.type === 'goomba' && e.state === 'walk') {
          this.defeatEnemy(e, 'stomp');
        } else if (e.type === 'koopa' && e.state === 'walk') {
          e.state = 'shell';
          e.h = 0.9;
          e.wakeT = C.SHELL_WAKE_TIME;
          e.warned = false;
          e.chainIdx = 0;
          e.vx = 0;
          this.awardChain(C.STOMP_CHAIN, p.stompChain, e.x, e.y + 0.5);
          p.stompChain = Math.min(p.stompChain + 1, C.STOMP_CHAIN.length - 1);
          this.event('stomp', { x: e.x, y: e.y });
        } else if (e.state === 'shell') {
          this.kickShell(e, p.x < e.x ? 1 : -1);
        } else if (e.state === 'slide') {
          e.state = 'shell';
          e.wakeT = C.SHELL_WAKE_TIME;
          e.warned = false;
          e.chainIdx = 0;
          this.event('shellstop', { x: e.x, y: e.y });
        }
        p.vy = (p.jumpHeld ? C.STOMP_BOUNCE_HELD : C.STOMP_BOUNCE);
        p.grounded = false;
        continue;
      }

      // Side contact
      if (e.state === 'shell') {
        this.kickShell(e, p.x < e.x ? 1 : -1);
        continue;
      }
      if (e.graceT > 0) continue;
      this.damagePlayer();
    }
  };

  World.prototype.kickShell = function (e, dir) {
    e.state = 'slide';
    e.dir = dir;
    e.graceT = C.SHELL_KICK_GRACE;
    e.wakeT = 0;
    e.chainIdx = 0;
    this.event('shellkick', { x: e.x, y: e.y });
  };

  World.prototype.damagePlayer = function () {
    var p = this.player;
    if (p.invulnT > 0 || p.starT > 0) return;
    if (p.power > 0) {
      p.power = 0;
      p.ducked = false;
      this.playerH = playerHeight(0, false);
      p.invulnT = C.INVULN_TIME;
      p.growT = C.GROW_FREEZE;
      this.event('shrink');
    } else {
      this.die();
    }
  };

  World.prototype.die = function () {
    var p = this.player;
    if (this.state !== 'play') return;
    this.state = 'dying';
    p.control = false;
    p.vy = C.DEATH_HOP;
    p.vx = 0;
    p.ducked = false;
    this.playerH = playerHeight(p.power, false);
    this.deathT = 0;
    this.event('death');
  };

  World.prototype.deathStep = function (dt) {
    var p = this.player;
    this.deathT += dt;
    if (this.deathT > 0.4) {
      p.vy = Math.max(p.vy + C.GRAVITY * dt, -C.MAX_FALL);
      p.y += p.vy * dt;
    }
    if (p.y < C.DEATH_Y - 8) {
      this.lives--;
      if (this.lives > 0) {
        this.respawn();
      } else {
        this.state = 'gameover';
        this.event('gameover');
      }
    }
  };

  World.prototype.respawn = function () {
    var p = this.player;
    p.x = this.checkpoint ? C.CHECKPOINT_X : C.START_X;
    p.y = 0;
    p.vx = 0; p.vy = 0; p.prevY = 0;
    p.power = 0;
    p.ducked = false;
    this.playerH = playerHeight(0, false);
    p.grounded = true;
    p.invulnT = 1.5;
    p.starT = 0;
    p.growT = 0;
    p.stompChain = 0;
    p.control = true;
    p.facing = 1;
    this.area = 'surface';
    this.timeLeft = C.TIMER_START;
    this.hurry = false;
    this.state = 'play';
    this.enemies.length = 0;
    this.items.length = 0;
    this.fireballs.length = 0;
    this.spawnEnemies(LEVEL.buildLevel().enemies);
    this.event('respawn');
  };

  // ------------------------------------------------------------------ items

  World.prototype.updateItems = function (dt) {
    var p = this.player;
    for (var i = this.items.length - 1; i >= 0; i--) {
      var it = this.items[i];
      if (it.state === 'emerge') {
        it.emergeT -= dt;
        var k = 1 - Math.max(it.emergeT, 0) / 0.8;
        it.y = it.emergeY0 + k * (it.emergeY0 + 1.2 - it.emergeY0);
        it.y = it.emergeY0 + k * 1.2;
        if (it.emergeT <= 0) {
          it.state = 'active';
          if (it.type === 'mushroom' || it.type === 'oneup') it.vx = C.MUSHROOM_SPEED;
          if (it.type === 'star') it.vx = C.MUSHROOM_SPEED;
          this.event('itemactive', { x: it.x, y: it.y, type: it.type });
        }
        continue;
      }
      if (it.type !== 'flower') {
        it.vy = Math.max(it.vy + C.GRAVITY * dt, -C.MAX_FALL);
        it.y += it.vy * dt;
        var hw = it.w / 2;
        if (it.vy <= 0) {
          var below = this.tilesInBox(it.x - hw + EPS, it.y + EPS, it.x + hw - EPS, it.y + it.h - EPS, false);
          if (below.length > 0) {
            var topY = -Infinity;
            for (var b = 0; b < below.length; b++) topY = Math.max(topY, below[b].gy + 1);
            it.y = topY;
            if (it.type === 'star') it.vy = 12;
            else it.vy = 0;
          }
        }
        it.x += it.vx * dt;
        var solids = this.tilesInBox(it.x - hw, it.y + EPS, it.x + hw, it.y + it.h - EPS, false);
        for (var s = 0; s < solids.length; s++) {
          var t = solids[s];
          if (it.vx > 0 && it.x + hw > t.gx) { it.x = t.gx - hw - EPS; it.vx = -it.vx; }
          else if (it.vx < 0 && it.x - hw < t.gx + 1) { it.x = t.gx + 1 + hw + EPS; it.vx = -it.vx; }
        }
        if (it.y < C.DEATH_Y - 4) { this.items.splice(i, 1); continue; }
      }

      // Collection
      var ph = this.playerH;
      if (aabbOverlap(p.x - C.PLAYER_HALF_W, p.y, p.x + C.PLAYER_HALF_W, p.y + ph,
        it.x - it.w / 2, it.y, it.x + it.w / 2, it.y + it.h)) {
        this.collectItem(it);
        this.items.splice(i, 1);
      }
    }
  };

  World.prototype.collectItem = function (it) {
    var p = this.player;
    this.addScore(C.SCORE_POWERUP, it.x, it.y + 0.5);
    if (it.type === 'mushroom') {
      if (p.power === 0) {
        p.power = 1;
        p.ducked = false;
        this.playerH = playerHeight(1, false);
        p.growT = C.GROW_FREEZE;
        this.event('grow');
      }
    } else if (it.type === 'flower') {
      if (p.power === 0) {
        p.power = 1;
        this.playerH = playerHeight(1, false);
        p.growT = C.GROW_FREEZE;
        this.event('grow');
      } else if (p.power === 1) {
        p.power = 2;
        this.playerH = playerHeight(2, false);
        p.growT = C.GROW_FREEZE;
        this.event('fire');
      }
    } else if (it.type === 'oneup') {
      this.lives++;
      this.event('oneup');
      this.popup(it.x, it.y + 0.5, '1-UP');
    } else if (it.type === 'star') {
      p.starT = C.STAR_TIME;
      p._starWas = C.STAR_TIME;
      this.event('star');
      this.markSecret('star', it.x, it.y + 0.5);
    }
  };

  // ------------------------------------------------------------------ fireballs

  World.prototype.updateFireballs = function (dt) {
    for (var i = this.fireballs.length - 1; i >= 0; i--) {
      var f = this.fireballs[i];
      f.life -= dt;
      f.vy += C.GRAVITY * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;

      var below = this.tilesInBox(f.x - 0.2, f.y - 0.25, f.x + 0.2, f.y - 0.15, false);
      if (below.length > 0 && f.vy < 0) {
        f.vy = C.FIREBALL_BOUNCE;
      }
      var wall = this.tilesInBox(f.x - 0.22, f.y - 0.2, f.x + 0.22, f.y + 0.2, false);
      if (wall.length > 0) {
        this.event('fireballhit', { x: f.x, y: f.y });
        this.fireballs.splice(i, 1);
        continue;
      }
      var expired = f.life <= 0 || Math.abs(f.x - this.player.x) > 40 || f.y < C.DEATH_Y;
      if (expired) {
        this.fireballs.splice(i, 1);
        continue;
      }
      var hit = false;
      for (var j = 0; j < this.enemies.length; j++) {
        var e = this.enemies[j];
        if (!e.active || e.state === 'dead' || e.state === 'flat') continue;
        var eh = e.state === 'shell' || e.state === 'slide' ? 0.9 : e.h;
        if (aabbOverlap(f.x - 0.25, f.y - 0.25, f.x + 0.25, f.y + 0.25,
          e.x - e.w / 2, e.y, e.x + e.w / 2, e.y + eh)) {
          this.defeatEnemy(e, 'fireball');
          this.event('fireballhit', { x: f.x, y: f.y });
          hit = true;
          break;
        }
      }
      if (hit) this.fireballs.splice(i, 1);
    }
  };

  // ------------------------------------------------------------------ coins

  World.prototype.collectCoins = function () {
    var p = this.player;
    var ph = this.playerH;
    for (var i = 0; i < this.coins.length; i++) {
      var c = this.coins[i];
      if (c.taken || c.area !== this.area) continue;
      if (aabbOverlap(p.x - C.PLAYER_HALF_W, p.y, p.x + C.PLAYER_HALF_W, p.y + ph,
        c.x - 0.4, c.y - 0.4, c.x + 0.4, c.y + 0.4)) {
        c.taken = true;
        this.addCoin(c.x, c.y);
        this.event('coin', { x: c.x, y: c.y });
      }
    }
  };

  // ------------------------------------------------------------------ warp

  World.prototype.startWarp = function (kind) {
    this.state = 'warp';
    this.warpSeq = { kind: kind, phase: 'enter', t: 0, y0: this.player.y };
    this.player.control = false;
    this.player.vx = 0;
    this.player.vy = 0;
    this.fireballs.length = 0;
    this.event(kind === 'cellar-enter' ? 'warpenter' : 'warpexit');
  };

  World.prototype.warpStep = function (dt) {
    var s = this.warpSeq;
    var p = this.player;
    s.t += dt;
    if (s.phase === 'enter') {
      p.y = s.y0 - (s.t / 0.7) * 1.6;
      if (s.t >= 0.7) {
        if (s.kind === 'cellar-enter') {
          this.area = 'cellar';
          p.x = C.CELLAR_SPAWN_X;
          p.y = -0.5;
          p.vy = 0;
          s.phase = 'drop';
          s.t = 0;
          this.markSecret('cellar', p.x, p.y);
          this.event('areachange', { area: 'cellar' });
        } else {
          this.area = 'surface';
          p.x = C.CELLAR_EXIT_X + 1;
          p.y = 3 - 1.6;
          s.phase = 'rise';
          s.t = 0;
          s.y0 = 3 - 1.6;
          this.event('areachange', { area: 'surface' });
        }
      }
      return;
    }
    if (s.phase === 'drop') {
      p.vy = Math.max(p.vy + C.GRAVITY * dt, -C.MAX_FALL);
      p.y += p.vy * dt;
      var below = this.tilesInBox(p.x - C.PLAYER_HALF_W + EPS, p.y, p.x + C.PLAYER_HALF_W - EPS, p.y + 0.02, false);
      if (below.length > 0 && p.vy <= 0) {
        p.y = below[0].gy + 1;
        p.vy = 0;
        this.endWarp();
      }
      return;
    }
    if (s.phase === 'rise') {
      p.y = s.y0 + (s.t / 0.7) * 1.6;
      if (s.t >= 0.7) {
        p.y = 3;
        this.endWarp();
      }
    }
  };

  World.prototype.endWarp = function () {
    var p = this.player;
    p.control = true;
    p.vx = 0;
    p.vy = 0;
    p.grounded = true;
    p.invulnT = 1.0;
    p.facing = 1;
    this.state = 'play';
    this.warpSeq = null;
    this.event('warpdone');
  };

  // ------------------------------------------------------------------ finish

  World.prototype.startFinish = function () {
    var p = this.player;
    this.state = 'finish';
    p.control = false;
    p.vx = 0;
    p.vy = 0;
    var feetY = p.y;
    var bonus = C.FLAG_BONUS[C.FLAG_BONUS.length - 1].points;
    for (var i = 0; i < C.FLAG_BONUS.length; i++) {
      if (feetY > C.FLAG_BONUS[i].min) { bonus = C.FLAG_BONUS[i].points; break; }
    }
    var captured = Math.max(0, Math.ceil(this.timeLeft));
    this.flagCapture = {
      capturedTimer: captured,
      lastDigit: captured % 10,
      flagBonus: bonus,
      timeBonus: 0,
      fireworkBonus: 0,
      fireworks: 0,
      fireworksLaunched: 0
    };
    this.addScore(bonus, C.FLAG_X, feetY + 1);
    this.finishSeq = { phase: 'slide', t: 0 };
    p.x = C.FLAG_X - 0.45;
    p.facing = 1;
    this.event('flaggrab', { y: feetY });
  };

  World.prototype.finishStep = function (dt) {
    var s = this.finishSeq;
    var p = this.player;
    s.t += dt;
    if (s.phase === 'slide') {
      p.y = Math.max(0, p.y - dt * 5);
      this.event('flagslide');
      if (p.y <= 0) {
        p.y = 0;
        s.phase = 'walk';
        s.t = 0;
        this.event('flagdown');
      }
    } else if (s.phase === 'walk') {
      p.x += 4 * dt;
      if (p.x >= C.CASTLE_X + 1.2) {
        p.x = C.CASTLE_X + 1.2;
        s.phase = 'tally';
        s.t = 0;
        this.event('castleenter');
      }
    } else if (s.phase === 'tally') {
      if (this.flagCapture.capturedTimer > 0) {
        this.flagCapture.capturedTimer -= 1;
        this.flagCapture.timeBonus += C.SCORE_TIME_UNIT;
        this.score += C.SCORE_TIME_UNIT;
        this.event('tally');
      } else {
        s.phase = 'fireworks';
        s.t = 0;
        var cap = this.flagCapture;
        var last = cap.lastDigit;
        cap.fireworks = (last === 1 || last === 3 || last === 6) ? last : 0;
        s.nextFirework = 0;
      }
    } else if (s.phase === 'fireworks') {
      var cap = this.flagCapture;
      if (s.nextFirework < cap.fireworks) {
        if (s.t > s.nextFirework * 0.6) {
          s.nextFirework++;
          cap.fireworksLaunched++;
          cap.fireworkBonus += C.SCORE_FIREWORK;
          this.score += C.SCORE_FIREWORK;
          this.event('firework', { x: C.CASTLE_X + (s.nextFirework % 3) - 1, y: 7 + (s.nextFirework % 2) });
        }
      } else if (s.t > cap.fireworks * 0.6 + 0.8 || (cap.fireworks === 0 && s.t > 0.8)) {
        this.state = 'win';
        this.event('win');
      }
    }
  };

  World.prototype.timerDisplay = function () {
    return Math.max(0, Math.ceil(this.timeLeft));
  };

  World.prototype.drainEvents = function () {
    var out = this.events;
    this.events = [];
    return out;
  };

  var api = { World: World, clamp: clamp, aabbOverlap: aabbOverlap, playerHeight: playerHeight };
  root.LPMSim = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : globalThis);
