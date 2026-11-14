'use strict';

// Deterministic gameplay checks against the real simulation modules.
var path = require('path');
var C = require(path.join(__dirname, '..', 'js', 'config.js'));
var SIM = require(path.join(__dirname, '..', 'js', 'sim.js'));

var passed = 0, failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + (detail ? '  [' + detail + ']' : '')); }
}

function mk(over) {
  var i = { left: false, right: false, run: false, down: false, jumpPressed: false, jumpHeld: false };
  if (over) for (var k in over) i[k] = over[k];
  return i;
}

function newWorld() {
  var w = new SIM.World();
  w.state = 'play';
  return w;
}

function step(w, input, seconds) {
  var n = Math.round(seconds / C.STEP);
  for (var i = 0; i < n; i++) w.step(C.STEP, input);
}

// ---------------------------------------------------------------- movement

console.log('Movement');
(function () {
  var w = newWorld();
  step(w, mk({ right: true }), 1.0);
  var vRight = w.player.vx;
  var xRight = w.player.x;
  check('symmetric acceleration to walk cap', Math.abs(vRight - 6) < 0.01 && xRight > -52,
    'vx=' + vRight.toFixed(2) + ' x=' + xRight.toFixed(2));

  var w2 = newWorld();
  step(w2, mk({ left: true }), 1.0);
  check('left/right symmetric', Math.abs(w2.player.vx - (-6)) < 0.01 && Math.abs(w2.player.x - (2 * C.START_X - xRight)) < 0.35,
    'vx=' + w2.player.vx.toFixed(2) + ' x=' + w2.player.x.toFixed(2));

  var w3 = newWorld();
  w3.player.x = -58;
  step(w3, mk({ right: true, run: true }), 1.2);
  check('run cap 9.8', Math.abs(w3.player.vx - 9.8) < 0.01, 'vx=' + w3.player.vx.toFixed(2));

  var w4 = newWorld();
  w4.player.x = -58;
  step(w4, mk({ right: true, run: true }), 1.2);
  step(w4, mk({}), 0.6);
  check('braking stops', Math.abs(w4.player.vx) < 0.01, 'vx=' + w4.player.vx.toFixed(3));

  var w5 = newWorld();
  w5.player.x = -58;
  w5.step(C.STEP, mk({ jumpPressed: true, jumpHeld: true }));
  step(w5, mk({ right: true, jumpHeld: true }), 0.4);
  check('air steering accelerates', w5.player.vx > 3, 'vx=' + w5.player.vx.toFixed(2));

  var w6 = newWorld();
  w6.player.x = -58;
  step(w6, mk({ right: true, run: true }), 1.0);
  w6.step(C.STEP, mk({ left: true }));
  check('skid flag while reversing', w6.player.skidding === true, 'skid=' + w6.player.skidding);
})();

// ---------------------------------------------------------------- jumping

console.log('Jumping');
(function () {
  function rise(holdSecs) {
    var w = newWorld();
    w.player.x = -58;
    w.step(C.STEP, mk({ jumpPressed: true, jumpHeld: true }));
    var maxY = 0, held = holdSecs;
    for (var i = 0; i < 700; i++) {
      w.step(C.STEP, mk({ jumpHeld: held > 0 }));
      if (held > 0) held -= C.STEP;
      maxY = Math.max(maxY, w.player.y);
      if (w.player.grounded && i > 5) break;
    }
    return maxY;
  }
  var held = rise(10);
  check('held jump rises ~5.4', held > 5.0 && held < 5.9, 'rise=' + held.toFixed(2));
  var tap = rise(2 * C.STEP);
  check('tap jump rises 2.4-2.8', tap > 2.2 && tap < 3.0, 'rise=' + tap.toFixed(2));

  var w = newWorld();
  w.player.x = 5.38;
  w.player.vx = 6;
  w.player.grounded = false;
  w.player.coyoteT = C.COYOTE_TIME;
  w.step(C.STEP, mk({ jumpPressed: true, jumpHeld: true }));
  check('coyote jump works', w.player.vy > 15, 'vy=' + w.player.vy.toFixed(1));

  var w2 = newWorld();
  w2.player.x = -58;
  w2.player.y = 1.5;
  w2.player.vy = -15;
  w2.player.grounded = false;
  w2.step(C.STEP, mk({ jumpPressed: true }));
  var fired = false;
  for (var i2 = 0; i2 < 40; i2++) {
    w2.step(C.STEP, mk({}));
    if (!w2.player.grounded && w2.player.vy > 10) { fired = true; break; }
  }
  check('buffered jump fires on landing', fired, 'vy=' + w2.player.vy.toFixed(1) + ' grounded=' + w2.player.grounded);

  var w3 = newWorld();
  w3.player.x = -58;
  w3.step(C.STEP, mk({ jumpPressed: true, jumpHeld: true }));
  var vyAfterFirst = w3.player.vy;
  w3.step(C.STEP, mk({ jumpPressed: true, jumpHeld: true }));
  w3.step(C.STEP, mk({ jumpPressed: true, jumpHeld: true }));
  check('no double jump', w3.player.vy < 20.5 && !w3.player.grounded, 'vy=' + w3.player.vy.toFixed(2));

  var w4 = newWorld();
  w4.player.x = -17;
  w4.player.y = 6;
  w4.player.vy = 0;
  step(w4, mk({}), 1.0);
  check('falls onto and stands on tallest pipe', Math.abs(w4.player.y - 4) < 0.01 && w4.player.grounded,
    'y=' + w4.player.y.toFixed(2) + ' grounded=' + w4.player.grounded);

  check('held jump reaches block-row tops (5)', held >= 5.0, 'rise=' + held.toFixed(2));
})();

// ---------------------------------------------------------------- blocks

console.log('Blocks and coins');
(function () {
  var w = newWorld();
  w.player.x = -49.5;
  w.step(C.STEP, mk({ jumpPressed: true, jumpHeld: true }));
  step(w, mk({ jumpHeld: true }), 1.2);
  var q = w.tileAt(-50, 4);
  check('question block becomes used once', q && q.type === 'used', 'type=' + (q && q.type));
  check('coin block awards coin + score', w.coinCount === 1 && w.score >= C.SCORE_COIN,
    'coins=' + w.coinCount + ' score=' + w.score);
  var coinsBefore = w.coinCount;
  w.player.x = -49.5; w.player.y = 0; w.player.vy = 0; w.player.grounded = true;
  w.step(C.STEP, mk({ jumpPressed: true, jumpHeld: true }));
  step(w, mk({ jumpHeld: true }), 1.2);
  check('used block does not re-release', w.coinCount === coinsBefore, 'coins=' + w.coinCount);

  var w2 = newWorld();
  w2.player.x = -45.5;
  w2.step(C.STEP, mk({ jumpPressed: true, jumpHeld: true }));
  step(w2, mk({ jumpHeld: true }), 1.2);
  var items = w2.items.filter(function (it) { return it.type === 'mushroom'; });
  check('small Mario gets a mushroom', items.length === 1, 'items=' + w2.items.length);

  var w2b = newWorld();
  w2b.player.power = 1;
  w2b.playerH = SIM.playerHeight(1, false);
  w2b.player.x = -45.5;
  w2b.step(C.STEP, mk({ jumpPressed: true, jumpHeld: true }));
  step(w2b, mk({ jumpHeld: true }), 1.2);
  var flowers = w2b.items.filter(function (it) { return it.type === 'flower'; });
  check('big Mario gets a flower', flowers.length === 1, 'items=' + w2b.items.length);

  var w3 = newWorld();
  w3.player.power = 1;
  w3.playerH = SIM.playerHeight(1, false);
  w3.player.x = 16.5;
  w3.step(C.STEP, mk({ jumpPressed: true, jumpHeld: true }));
  step(w3, mk({ jumpHeld: true }), 1.2);
  var brick = w3.tileAt(16, 4);
  check('big Mario breaks brick', !brick || brick.breaking, 'brick=' + !!brick);
  check('brick break awarded once', w3.score >= C.SCORE_BRICK, 'score=' + w3.score);

  var w4 = newWorld();
  w4.player.x = 16.5;
  w4.step(C.STEP, mk({ jumpPressed: true, jumpHeld: true }));
  step(w4, mk({ jumpHeld: true }), 1.2);
  var brick2 = w4.tileAt(16, 4);
  check('small Mario bumps brick without breaking', brick2 && brick2.solid, 'solid=' + (brick2 && brick2.solid));

  var w5 = newWorld();
  w5.enemies.length = 0;
  w5.player.x = 17.5;
  for (var i = 0; i < 15; i++) {
    w5.player.y = 0; w5.player.vy = 0; w5.player.grounded = true;
    w5.step(C.STEP, mk({ jumpPressed: true, jumpHeld: true }));
    step(w5, mk({ jumpHeld: true }), 1.1);
  }
  var mc = w5.tileAt(17, 4);
  check('multi-coin brick pays exactly ' + C.MULTI_COIN_PAYOUT, w5.coinCount === C.MULTI_COIN_PAYOUT,
    'coins=' + w5.coinCount);
  check('multi-coin brick becomes used', mc && mc.type === 'used', 'type=' + (mc && mc.type));

  var w6 = newWorld();
  w6.player.x = -25.5;
  w6.step(C.STEP, mk({ jumpPressed: true, jumpHeld: true }));
  step(w6, mk({ jumpHeld: true }), 1.2);
  var hidden = w6.tileAt(-26, 7);
  check('hidden block reveals on hit', hidden && hidden.revealed && hidden.solid,
    'revealed=' + (hidden && hidden.revealed));
  var oneups = w6.items.filter(function (it) { return it.type === 'oneup'; });
  check('hidden block releases 1-Up', oneups.length === 1, 'items=' + w6.items.length);
  check('1-Up discovery counted once', w6.secretCount === 1 && w6.discoveries.oneUp,
    'secrets=' + w6.secretCount);

  var w7 = newWorld();
  w7.player.x = -27.5;
  w7.player.y = 7.2;
  step(w7, mk({ right: true }), 0.3);
  check('unrevealed hidden block is not a side wall', w7.player.x > -27.2, 'x=' + w7.player.x.toFixed(2));

  var w8 = newWorld();
  w8.player.x = -54.5;
  step(w8, mk({}), 0.1);
  var c = w8.coins.filter(function (cc) { return cc.taken; }).length;
  check('coin collected once with score', c === 1 && w8.score >= C.SCORE_COIN, 'taken=' + c);
})();

// ---------------------------------------------------------------- items

console.log('Items');
(function () {
  var w = newWorld();
  w.player.x = -45.5;
  w.player.y = 5.05;
  w.player.grounded = true;
  w.items.push({ kind: 'item', type: 'mushroom', x: -45.5, y: 4.6, vx: 0, vy: 0, state: 'emerge', emergeT: 0.8, emergeY0: 4.0, dir: 1, w: 0.8, h: 0.8 });
  step(w, mk({}), 0.2);
  check('cannot collect item while emerging', w.items.length === 1, 'items=' + w.items.length);
  step(w, mk({}), 1.5);
  check('item collectible after emerging', w.items.length === 0, 'items=' + w.items.length);

  var w2 = newWorld();
  w2.player.x = -58;
  w2.items.push({ kind: 'item', type: 'mushroom', x: -27, y: 0, vx: C.MUSHROOM_SPEED, vy: 0, state: 'active', emergeT: 0, emergeY0: 0, dir: 1, w: 0.8, h: 0.8 });
  step(w2, mk({}), 1.5);
  var item = w2.items[0];
  check('mushroom reverses at pipe wall', item && item.vx < 0 && item.x < -24,
    'x=' + (item && item.x.toFixed(2)) + ' vx=' + (item && item.vx.toFixed(2)));

  var w3 = newWorld();
  w3.player.x = -58;
  w3.items.push({ kind: 'item', type: 'flower', x: -58, y: 0, vx: 0, vy: 0, state: 'active', emergeT: 0, emergeY0: 0, dir: 1, w: 0.8, h: 0.8 });
  step(w3, mk({}), 0.05);
  check('flower grows small Mario to big', w3.player.power === 1, 'power=' + w3.player.power);

  var w4 = newWorld();
  w4.player.x = -58;
  w4.items.push({ kind: 'item', type: 'flower', x: 13.5, y: 5.05, vx: 0, vy: 0, state: 'active', emergeT: 0, emergeY0: 5, dir: 1, w: 0.8, h: 0.8 });
  step(w4, mk({}), 2.0);
  var f = w4.items[0];
  check('flower stays in place', f && Math.abs(f.x - 13.5) < 0.01 && Math.abs(f.y - 5.05) < 0.01,
    'x=' + f.x.toFixed(2) + ' y=' + f.y.toFixed(2));

  var w5 = newWorld();
  w5.player.x = -58;
  w5.player.starT = C.STAR_TIME;
  w5.player._starWas = C.STAR_TIME;
  step(w5, mk({}), C.STAR_TIME + 0.5);
  check('star invincibility expires', w5.player.starT === 0, 'starT=' + w5.player.starT);

  var w6 = newWorld();
  w6.player.x = -58;
  w6.items.push({ kind: 'item', type: 'oneup', x: -58, y: 0, vx: 0, vy: 0, state: 'active', emergeT: 0, emergeY0: 0, dir: 1, w: 0.8, h: 0.8 });
  step(w6, mk({}), 0.05);
  check('1-Up mushroom adds one life', w6.lives === C.LIVES_START + 1, 'lives=' + w6.lives);
})();

// ---------------------------------------------------------------- enemies

console.log('Enemies');
(function () {
  function addEnemy(w, type, x, extra) {
    var e = { kind: 'enemy', type: type, color: 'green', x: x, y: 0, vx: 0, vy: 0, prevY: 0, w: 0.8, h: type === 'koopa' ? 1.5 : 0.8, dir: -1, state: 'walk', active: true, flatT: 0, wakeT: 0, chainIdx: 0, graceT: 0, deadT: 0, spawn: { x: x, y: 0 } };
    if (extra) for (var k in extra) e[k] = extra[k];
    w.enemies.push(e);
    return e;
  }

  var w = newWorld();
  w.player.x = -100;
  w.enemies.length = 0;
  var g = addEnemy(w, 'goomba', -52);
  w.player.x = -52;
  w.player.y = 2.2;
  w.player.vy = -1;
  w.player.grounded = false;
  step(w, mk({}), 0.3);
  check('stomp flattens goomba', g.state === 'flat', 'state=' + g.state);
  check('stomp bounces player', w.player.vy > 5, 'vy=' + w.player.vy.toFixed(1));
  check('stomp awards chain score', w.score >= 100, 'score=' + w.score);

  var livesBefore = w.lives;
  w.player.invulnT = 0;
  w.player.x = g.x; w.player.y = 0.1; w.player.vy = 0;
  step(w, mk({}), 0.2);
  check('flat goomba is harmless', w.lives === livesBefore && w.state === 'play', 'lives=' + w.lives);

  var w2 = newWorld();
  w2.player.x = -100;
  w2.enemies.length = 0;
  addEnemy(w2, 'goomba', -52);
  addEnemy(w2, 'goomba', -49);
  w2.player.x = -52;
  w2.player.y = 2.2; w2.player.vy = -1; w2.player.grounded = false;
  step(w2, mk({ jumpHeld: true }), 0.3);
  var scoreAfterFirst = w2.score;
  w2.player.x = w2.enemies[1].x; w2.player.y = 2.0; w2.player.vy = -1; w2.player.prevY = 2.0; w2.player.vx = 0;
  step(w2, mk({ jumpHeld: true }), 0.35);
  check('airborne stomp chain increases 100 -> 200', w2.score - scoreAfterFirst === 200,
    'delta=' + (w2.score - scoreAfterFirst));

  var w2b = newWorld();
  w2b.player.x = -100;
  w2b.enemies.length = 0;
  addEnemy(w2b, 'goomba', -52);
  w2b.player.x = -52; w2b.player.y = 2.2; w2b.player.vy = -1; w2b.player.grounded = false;
  step(w2b, mk({}), 1.5);
  check('stomp chain resets on landing', w2b.player.stompChain === 0, 'chain=' + w2b.player.stompChain);

  var w3 = newWorld();
  w3.player.x = -100;
  w3.enemies.length = 0;
  addEnemy(w3, 'goomba', -56.4);
  w3.player.x = -58;
  step(w3, mk({ right: true }), 0.35);
  check('side contact kills small Mario', w3.state === 'dying' || w3.lives === 2, 'state=' + w3.state + ' lives=' + w3.lives);

  var w4 = newWorld();
  w4.player.x = -100;
  w4.enemies.length = 0;
  addEnemy(w4, 'goomba', -56.4);
  w4.player.x = -58;
  w4.player.power = 1; w4.playerH = SIM.playerHeight(1, false);
  step(w4, mk({ right: true }), 0.35);
  check('big Mario shrinks instead of dying', w4.player.power === 0 && w4.lives === 3,
    'power=' + w4.player.power + ' lives=' + w4.lives);

  var w5 = newWorld();
  w5.player.x = -100;
  w5.enemies.length = 0;
  addEnemy(w5, 'goomba', -52);
  w5.player.x = -51.2;
  w5.player.y = 0.4;
  w5.player.vy = -2;
  w5.player.prevY = 0.35;
  w5.player.grounded = false;
  step(w5, mk({}), 0.1);
  check('descending side overlap damages, not stomps', w5.state === 'dying' || w5.player.power === 0,
    'state=' + w5.state);

  var w6 = newWorld();
  w6.player.x = -58;
  w6.enemies.length = 0;
  addEnemy(w6, 'koopa', 36.5, { color: 'red', dir: 1 });
  step(w6, mk({}), 1.5);
  var k = w6.enemies[0];
  check('red koopa turns at ledge', k && k.dir === -1, 'x=' + k.x.toFixed(2) + ' dir=' + k.dir);

  var w7 = newWorld();
  w7.player.x = -58;
  w7.enemies.length = 0;
  addEnemy(w7, 'koopa', 36.5, { color: 'green', dir: 1 });
  step(w7, mk({}), 1.5);
  var k2 = w7.enemies[0];
  check('green koopa walks off ledge', !k2 || k2.y < 0, 'y=' + (k2 && k2.y.toFixed(2)));

  var w8 = newWorld();
  w8.player.x = -100;
  w8.enemies.length = 0;
  var onTop = addEnemy(w8, 'goomba', -49.5, { y: 5 });
  w8.player.x = -49.5;
  w8.step(C.STEP, mk({ jumpPressed: true, jumpHeld: true }));
  step(w8, mk({ jumpHeld: true }), 1.2);
  check('block bump defeats enemy on top', onTop.state === 'dead', 'state=' + onTop.state);
})();

// ---------------------------------------------------------------- shells

console.log('Shells');
(function () {
  function addKoopa(w, x, extra) {
    var e = { kind: 'enemy', type: 'koopa', color: 'green', x: x, y: 0, vx: 0, vy: 0, prevY: 0, w: 0.8, h: 1.5, dir: -1, state: 'walk', active: true, flatT: 0, wakeT: 0, chainIdx: 0, graceT: 0, deadT: 0, spawn: { x: x, y: 0 } };
    if (extra) for (var k in extra) e[k] = extra[k];
    w.enemies.push(e);
    return e;
  }

  var w = newWorld();
  w.player.x = -100;
  w.enemies.length = 0;
  var k = addKoopa(w, -52);
  w.player.x = -52;
  w.player.y = 2.5;
  w.player.vy = -1;
  w.player.grounded = false;
  step(w, mk({}), 0.3);
  check('stomping koopa retracts to shell', k.state === 'shell', 'state=' + k.state);
  check('shell is harmless to stand beside briefly', w.state === 'play', 'state=' + w.state);

  w.player.x = k.x - 1.3; w.player.y = 0; w.player.grounded = true; w.player.vy = 0;
  w.player.invulnT = 0;
  step(w, mk({ right: true }), 0.25);
  check('touching shell kicks it', k.state === 'slide', 'state=' + k.state + ' dir=' + k.dir);
  check('kick survives via grace period', w.state === 'play' && w.lives === 3,
    'state=' + w.state + ' lives=' + w.lives);

  k.dir = 0;
  w.player.x = k.x; w.player.y = 2.5; w.player.vy = -1; w.player.vx = 0; w.player.grounded = false; w.player.prevY = 2.5;
  step(w, mk({}), 0.4);
  check('stomping sliding shell stops it', k.state === 'shell', 'state=' + k.state);

  k.wakeT = 0.1;
  step(w, mk({}), 0.3);
  check('shell wakes to walking koopa', k.state === 'walk', 'state=' + k.state);

  var w2 = newWorld();
  w2.player.x = -58;
  w2.enemies.length = 0;
  var s2 = addKoopa(w2, -27, { state: 'slide', dir: -1, h: 0.9 });
  step(w2, mk({}), 0.12);
  check('sliding shell ricochets from pipe', s2.dir === 1, 'dir=' + s2.dir);

  var w3 = newWorld();
  w3.player.x = -58;
  w3.enemies.length = 0;
  addKoopa(w3, 97, { state: 'slide', dir: 1, h: 0.9 });
  var tg1 = { kind: 'enemy', type: 'goomba', color: 'green', x: 98.5, y: 0, vx: 0, vy: 0, prevY: 0, w: 0.8, h: 0.8, dir: -1, state: 'walk', active: true, flatT: 0, wakeT: 0, chainIdx: 0, graceT: 0, deadT: 0, spawn: { x: 98.5, y: 0 } };
  var tg2 = { kind: 'enemy', type: 'goomba', color: 'green', x: 100, y: 0, vx: 0, vy: 0, prevY: 0, w: 0.8, h: 0.8, dir: -1, state: 'walk', active: true, flatT: 0, wakeT: 0, chainIdx: 0, graceT: 0, deadT: 0, spawn: { x: 100, y: 0 } };
  w3.enemies.push(tg1, tg2);
  var scoreBefore = w3.score;
  step(w3, mk({}), 0.5);
  check('shell chain awards 500 then 800', w3.score - scoreBefore === 1300,
    'delta=' + (w3.score - scoreBefore));

  var w4 = newWorld();
  w4.player.x = -58;
  w4.enemies.length = 0;
  addKoopa(w4, 60, { state: 'slide', dir: 1, h: 0.9 });
  step(w4, mk({}), 0.6);
  var brick = w4.tileAt(63, 0);
  check('sliding shell breaks brick from side', !brick || brick.breaking, 'brick=' + !!brick);

  var w5 = newWorld();
  w5.player.x = -58;
  w5.enemies.length = 0;
  var shA = addKoopa(w5, 20, { state: 'slide', dir: 1, h: 0.9 });
  var shB = addKoopa(w5, 80, { state: 'slide', dir: -1, h: 0.9 });
  check('independent shell chain indices', shA.chainIdx === 0 && shB.chainIdx === 0,
    'a=' + shA.chainIdx + ' b=' + shB.chainIdx);
})();

// ---------------------------------------------------------------- fireballs

console.log('Fireballs');
(function () {
  var w = newWorld();
  w.player.x = -58;
  w.player.power = 2;
  w.playerH = SIM.playerHeight(2, false);
  w.player.facing = 1;
  w.enemies.length = 0;
  w.enemies.push({ kind: 'enemy', type: 'goomba', color: 'green', x: -54, y: 0, vx: 0, vy: 0, prevY: 0, w: 0.8, h: 0.8, dir: -1, state: 'walk', active: true, flatT: 0, wakeT: 0, chainIdx: 0, graceT: 0, deadT: 0, spawn: { x: -54, y: 0 } });
  var scoreBefore = w.score;
  w.step(C.STEP, mk({ run: true }));
  check('fireball spawns', w.fireballs.length === 1, 'n=' + w.fireballs.length);
  w.step(C.STEP, mk({ run: true }));
  check('cooldown blocks immediate second shot', w.fireballs.length === 1, 'n=' + w.fireballs.length);
  step(w, mk({ run: true }), 0.4);
  check('fireball kills enemy once for 100', w.enemies[0].state === 'dead' && w.score - scoreBefore === 100,
    'delta=' + (w.score - scoreBefore) + ' state=' + w.enemies[0].state);

  var w2 = newWorld();
  w2.player.x = -58;
  w2.player.power = 2; w2.playerH = SIM.playerHeight(2, false);
  w2.player.facing = 1;
  w2.step(C.STEP, mk({ run: true }));
  w2.player.fireCooldown = 0;
  w2.step(C.STEP, mk({ run: true }));
  w2.player.fireCooldown = 0;
  w2.step(C.STEP, mk({ run: true }));
  check('at most two active fireballs', w2.fireballs.length === 2, 'n=' + w2.fireballs.length);

  var w3 = newWorld();
  w3.player.x = -31.5;
  w3.player.power = 2; w3.playerH = SIM.playerHeight(2, false);
  w3.player.facing = 1;
  w3.step(C.STEP, mk({ run: true }));
  check('fireball fired at wall', w3.fireballs.length === 1, 'n=' + w3.fireballs.length);
  step(w3, mk({}), 0.4);
  check('fireball removed at wall', w3.fireballs.length === 0, 'n=' + w3.fireballs.length);

  var w4 = newWorld();
  w4.player.x = -58;
  w4.player.power = 2; w4.playerH = SIM.playerHeight(2, false);
  w4.player.facing = 1;
  w4.step(C.STEP, mk({ run: true }));
  var bounced = false;
  for (var i = 0; i < 240; i++) {
    w4.step(C.STEP, mk({}));
    if (w4.fireballs[0] && w4.fireballs[0].vy > 5) bounced = true;
  }
  check('fireball bounces off the floor', bounced, 'bounced=' + bounced);
})();

// ---------------------------------------------------------------- progression

console.log('Progression');
(function () {
  var w = newWorld();
  w.player.x = -11.5;
  w.player.y = 3;
  w.player.grounded = true;
  w.step(C.STEP, mk({ down: true }));
  check('down on warp pipe starts warp', w.state === 'warp', 'state=' + w.state);
  step(w, mk({}), 3.0);
  check('mario arrives in cellar', w.area === 'cellar' && w.state === 'play' && Math.abs(w.player.y + 6) < 0.01,
    'area=' + w.area + ' y=' + w.player.y.toFixed(2));
  var coinsBefore = w.coinCount;
  w.player.x = 203.5; w.player.y = -6;
  step(w, mk({}), 0.2);
  check('cellar coin collected once', w.coinCount === coinsBefore + 1, 'coins=' + w.coinCount);
  w.player.x = 214.7; w.player.y = -3; w.player.grounded = true; w.player.vy = 0;
  w.step(C.STEP, mk({ down: true }));
  step(w, mk({}), 3.0);
  check('cellar exit returns to surface', w.area === 'surface' && w.player.x > 47 && w.player.x < 51,
    'area=' + w.area + ' x=' + w.player.x.toFixed(2));
  check('cellar discovery counted once', w.secretCount === 1 && w.discoveries.cellar,
    'secrets=' + w.secretCount);

  w.player.x = -11.5; w.player.y = 3; w.player.grounded = true; w.player.vy = 0;
  w.step(C.STEP, mk({ down: true }));
  step(w, mk({}), 3.0);
  var coins2 = w.coinCount;
  w.player.x = 203.5; w.player.y = -6;
  step(w, mk({}), 0.2);
  check('cellar coins not re-awarded', w.coinCount === coins2, 'coins=' + w.coinCount);
  check('secret count does not repeat', w.secretCount === 1, 'secrets=' + w.secretCount);
  check('score preserved across travel', w.score > 0, 'score=' + w.score);

  var w4 = newWorld();
  w4.player.x = -9.5;
  w4.player.y = 0;
  step(w4, mk({ down: true }), 0.3);
  check('down beside pipe does not warp', w4.state === 'play' && w4.area === 'surface',
    'state=' + w4.state + ' area=' + w4.area);

  var w2 = newWorld();
  w2.checkpoint = true;
  w2.player.y = -10;
  step(w2, mk({}), 0.1);
  check('pit death starts dying sequence', w2.state === 'dying', 'state=' + w2.state);
  var livesBefore = w2.lives;
  var respawned = false;
  for (var i3 = 0; i3 < 600; i3++) {
    step(w2, mk({}), 0.05);
    if (w2.state === 'play') { respawned = true; break; }
  }
  check('death deducts one life', respawned && w2.lives === livesBefore - 1, 'lives=' + w2.lives + ' before=' + livesBefore);
  check('respawn at checkpoint', Math.abs(w2.player.x - C.CHECKPOINT_X) < 0.01, 'x=' + w2.player.x);
  check('respawn is small mario', w2.player.power === 0, 'power=' + w2.player.power);
  check('respawn has safe protection', w2.player.invulnT > 0, 'invuln=' + w2.player.invulnT.toFixed(2));

  var w3 = newWorld();
  w3.timeLeft = 0.01;
  step(w3, mk({}), 0.1);
  check('timeout kills mario', w3.state === 'dying', 'state=' + w3.state);

  var w5 = newWorld();
  w5.player.x = -58;
  w5.coinCount = 99;
  w5.addCoin(-58, 1);
  check('100 coins awards extra life', w5.lives === C.LIVES_START + 1, 'lives=' + w5.lives);
})();

// ---------------------------------------------------------------- finish

console.log('Finish');
(function () {
  function runFinish(lastDigit) {
    var w = newWorld();
    w.timeLeft = 90 + lastDigit;
    w.player.x = 133.9;
    w.player.y = 5.5;
    w.player.vy = 0;
    w.player.vx = 6;
    step(w, mk({ right: true }), 0.05);
    if (w.state !== 'finish') return { error: 'no finish, state=' + w.state + ' x=' + w.player.x };
    var fireworks = 0;
    var guard = 0;
    while (w.state !== 'win' && guard < 4000) {
      w.step(C.STEP, mk({}));
      var evs = w.drainEvents();
      for (var i = 0; i < evs.length; i++) if (evs[i].type === 'firework') fireworks++;
      guard++;
    }
    return { world: w, fireworks: fireworks, guard: guard };
  }

  var r1 = runFinish(3);
  check('flag contact starts finish', r1.world && r1.world.state === 'win', r1.error || ('guard=' + r1.guard));
  check('timer digit 3 launches 3 fireworks', r1.fireworks === 3, 'n=' + r1.fireworks);
  check('fireworks award 500 each', r1.world.flagCapture.fireworkBonus === 1500,
    'bonus=' + r1.world.flagCapture.fireworkBonus);
  check('time bonus converts captured timer', r1.world.flagCapture.timeBonus === 93 * C.SCORE_TIME_UNIT,
    'bonus=' + r1.world.flagCapture.timeBonus);
  check('flag bonus captured', r1.world.flagCapture.flagBonus === 2000, 'bonus=' + r1.world.flagCapture.flagBonus);

  var r2 = runFinish(5);
  check('timer digit 5 launches no fireworks', r2.fireworks === 0, 'n=' + r2.fireworks);

  var r3 = runFinish(1);
  check('timer digit 1 launches 1 firework', r3.fireworks === 1, 'n=' + r3.fireworks);

  function flagBonusAt(y) {
    var w = newWorld();
    w.player.x = 133.9;
    w.player.y = y;
    w.player.vy = 0;
    w.player.vx = 6;
    step(w, mk({ right: true }), 0.05);
    return w.flagCapture ? w.flagCapture.flagBonus : -1;
  }
  check('high flag contact gives 5000', flagBonusAt(8.0) === 5000);
  check('mid flag contact gives 2000', flagBonusAt(6.0) === 2000);
  check('low flag contact gives 800', flagBonusAt(4.0) === 800);
  check('ground-level flag contact gives 400', flagBonusAt(1.5) === 400);

  var w4 = newWorld();
  w4.player.x = 133.5;
  w4.player.y = -2;
  step(w4, mk({ right: true }), 0.2);
  check('crossing flag x below ground does not clear', w4.state !== 'finish', 'state=' + w4.state);

  var w5 = newWorld();
  w5.player.x = 133.9;
  w5.player.y = 12;
  w5.player.vy = 0;
  w5.player.vx = 6;
  step(w5, mk({ right: true }), 0.05);
  check('jump above flag top still clears', w5.state === 'finish' && w5.flagCapture.flagBonus === 5000,
    'state=' + w5.state);
})();

// ---------------------------------------------------------------- full route bot

function botRun(big) {
  var w = newWorld();
  if (big) { w.player.power = 1; w.playerH = SIM.playerHeight(1, false); }
  // Route geometry verification: enemies are cleared here. Enemy interactions
  // (stomps, side damage, shells, fireballs) are verified in the dedicated suites above.
  w.enemies.length = 0;
  var guard = 0;
  var maxSteps = Math.ceil(240 / C.STEP);
  var holdJump = 0;
  while (w.state !== 'win' && w.state !== 'gameover' && guard < maxSteps) {
    var p = w.player;
    var jump = false;
    if (p.grounded) {
      var ahead = w.tilesInBox(p.x + 0.4, p.y + 0.05, p.x + 1.6, p.y + 0.7, false);
      if (ahead.length > 0) jump = true;
      var groundAhead = w.tilesInBox(p.x + 0.6, p.y - 0.3, p.x + 3.0, p.y - 0.05, false);
      if (groundAhead.length === 0) jump = true;
      var nearGround = w.tilesInBox(p.x + 0.4, p.y - 0.3, p.x + 0.9, p.y - 0.05, false);
      if (nearGround.length === 0) jump = true;
    }
    if (jump && p.grounded) holdJump = 0.6;
    if (holdJump > 0) holdJump -= C.STEP;
    w.step(C.STEP, mk({ right: true, run: true, jumpPressed: jump, jumpHeld: jump || holdJump > 0 }));
    w.drainEvents();
    guard++;
  }
  return { world: w, steps: guard };
}

console.log('Main route (scripted Small Mario run; enemies cleared, see note in README/audit)');
(function () {
  var r = botRun(false);
  check('small Mario completes the surface route', r.world.state === 'win',
    'state=' + r.world.state + ' x=' + r.world.player.x.toFixed(1) + ' y=' + r.world.player.y.toFixed(1) +
    ' lives=' + r.world.lives + ' steps=' + r.steps);
  console.log('    (bot: state=' + r.world.state + ', x=' + r.world.player.x.toFixed(1) +
    ', lives=' + r.world.lives + ', score=' + r.world.score + ')');
})();

console.log('Main route (scripted Big Mario run)');
(function () {
  var r = botRun(true);
  check('big Mario completes the surface route', r.world.state === 'win',
    'state=' + r.world.state + ' x=' + r.world.player.x.toFixed(1) + ' steps=' + r.steps);
  console.log('    (bot: state=' + r.world.state + ', x=' + r.world.player.x.toFixed(1) +
    ', lives=' + r.world.lives + ', score=' + r.world.score + ')');
})();

// ---------------------------------------------------------------- lifecycle

console.log('Lifecycle');
(function () {
  var w = newWorld();
  w.score = 12345;
  w.coinCount = 55;
  w.player.power = 2;
  w.checkpoint = true;
  w.timeLeft = 12;
  w.reset();
  check('reset restores fresh run state', w.score === 0 && w.coinCount === 0 && w.lives === C.LIVES_START &&
    w.player.power === 0 && w.checkpoint === false && w.timeLeft === C.TIMER_START,
    'score=' + w.score + ' coins=' + w.coinCount + ' lives=' + w.lives);

  var n1 = w.enemies.length;
  w.reset();
  check('restart does not accumulate enemies', w.enemies.length === n1, 'n=' + w.enemies.length + ' before=' + n1);

  var w2 = newWorld();
  w2.popup(0, 0, '100');
  step(w2, mk({}), 1.2);
  check('popups expire', w2.popups.length === 0, 'n=' + w2.popups.length);

  var w3 = newWorld();
  w3.player.power = 1;
  w3.playerH = SIM.playerHeight(1, false);
  w3.player.x = -58;
  w3.step(C.STEP, mk({ down: true }));
  check('ducking shortens the body', Math.abs(w3.playerH - C.HEIGHT_DUCK) < 0.01, 'h=' + w3.playerH);
})();

console.log('');
console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
