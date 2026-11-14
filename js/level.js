(function (root) {
  'use strict';

  var C = root.LPMConfig || require('./config.js');

  function tileKey(gx, gy) { return gx + ',' + gy; }

  function buildLevel() {
    var tiles = [];
    var pipes = [];
    var enemies = [];
    var coins = [];
    var decor = { trees: [], bushes: [], hills: [], clouds: [] };

    function ground(x0, x1, shift, area) {
      shift = shift || 0;
      area = area || 'surface';
      for (var gx = x0; gx <= x1; gx++) {
        for (var gy = -3; gy <= -1; gy++) {
          tiles.push({ gx: gx, gy: gy + shift, type: 'ground', area: area });
        }
      }
    }
    function stairs(x0, count, dir) {
      for (var i = 0; i < count; i++) {
        var h = dir > 0 ? i + 1 : count - i;
        for (var j = 0; j < h; j++) {
          tiles.push({ gx: x0 + i, gy: j, type: 'stair' });
        }
      }
    }
    function pipe(gx, h, opts) {
      opts = opts || {};
      pipes.push({ gx: gx, h: h, warp: !!opts.warp, exit: !!opts.exit, area: opts.area || 'surface' });
      for (var dx = 0; dx < 2; dx++) {
        for (var dy = 0; dy < h; dy++) {
          tiles.push({ gx: gx + dx, gy: dy, type: 'pipe', area: opts.area || 'surface' });
        }
      }
    }
    function block(gx, gy, type, content) {
      tiles.push({ gx: gx, gy: gy, type: type, content: content || null });
    }
    function coinRow(x0, x1, y) {
      for (var x = x0; x <= x1; x++) coins.push({ x: x + 0.5, y: y, area: 'surface' });
    }

    // ---- Surface course ----
    ground(-60, 4);
    ground(7, 37);
    ground(41, 90);
    ground(93, 148);

    // Safe opening: coin block, adaptive power block, first goomba.
    block(-50, 4, 'question', 'coin');
    block(-46, 4, 'question', 'power');
    enemies.push({ type: 'goomba', x: -42, y: 0 });
    coins.push({ x: -54.5, y: 1.2, area: 'surface' });
    coins.push({ x: -53.5, y: 1.2, area: 'surface' });

    // Pipe sequence with a hidden 1-Up and the secret warp pipe.
    pipe(-30, 2);
    pipe(-24, 3);
    block(-26, 7, 'hidden', 'oneup');
    pipe(-18, 4);
    pipe(-12, 3, { warp: true });
    enemies.push({ type: 'goomba', x: -33, y: 0 });
    enemies.push({ type: 'goomba', x: -21, y: 0 });
    enemies.push({ type: 'goomba', x: -15, y: 0 });
    enemies.push({ type: 'koopa', x: -8, y: 0, color: 'green' });

    // First gap (5..6), then the brick route.
    block(13, 4, 'question', 'power');
    block(16, 4, 'brick');
    block(17, 4, 'brick', 'multicoin');
    block(18, 4, 'brick');
    block(19, 4, 'brick');
    block(16, 7, 'brick');
    block(17, 7, 'brick');
    block(18, 7, 'brick');
    block(19, 7, 'brick');
    block(25, 4, 'brick', 'star');
    coinRow(21, 23, 5.5);
    coins.push({ x: 17.5, y: 8.6, area: 'surface' });
    coins.push({ x: 18.5, y: 8.6, area: 'surface' });
    enemies.push({ type: 'goomba', x: 22, y: 0 });
    enemies.push({ type: 'goomba', x: 28, y: 0 });
    enemies.push({ type: 'goomba', x: 31, y: 0 });
    enemies.push({ type: 'koopa', x: 34, y: 0, color: 'green' });

    // Second gap (38..40), middle stretch with the cellar exit pipe.
    pipe(48, 3, { exit: true });
    block(58, 4, 'question', 'power');
    enemies.push({ type: 'goomba', x: 52, y: 0 });
    block(63, 0, 'brick');
    block(64, 0, 'brick');
    enemies.push({ type: 'goomba', x: 62, y: 0 });
    enemies.push({ type: 'koopa', x: 66, y: 0, color: 'red' });
    coinRow(55, 57, 1.2);

    // Staircase practice and the stair gap (90..92).
    stairs(70, 4, 1);
    stairs(74, 4, -1);
    enemies.push({ type: 'goomba', x: 82, y: 0 });
    stairs(86, 4, 1);
    stairs(93, 3, -1);

    // Final approach.
    block(100, 4, 'question', 'power');
    enemies.push({ type: 'goomba', x: 104, y: 0 });
    enemies.push({ type: 'goomba', x: 107, y: 0 });
    enemies.push({ type: 'goomba', x: 110, y: 0 });
    enemies.push({ type: 'koopa', x: 114, y: 0, color: 'green' });
    pipe(118, 2);

    // Finale: staircase, flagpole, castle.
    stairs(122, 8, 1);
    coins.push({ x: 133.5, y: 6.0, area: 'surface' });

    // ---- Secret coin cellar ----
    // Walkable floor top at y = -6, ceiling at y = 0, walls at gx 199 and 218.
    ground(200, 217, -6, 'cellar');
    for (var gx = 199; gx <= 218; gx++) {
      tiles.push({ gx: gx, gy: 0, type: 'ground', area: 'cellar' }); // ceiling row
    }
    for (gx = 199; gx <= 218; gx++) {
      for (var gy = -7; gy <= -1; gy++) {
        if (gx !== 199 && gx !== 218) continue;
        tiles.push({ gx: gx, gy: gy, type: 'ground', area: 'cellar' }); // side walls
      }
    }
    // Exit pipe standing on the cellar floor; press down on its top to return.
    pipes.push({ gx: 214, h: 3, warp: false, exit: true, area: 'cellar', floorY: -6 });
    for (gx = 214; gx <= 215; gx++) {
      for (var gy2 = -6; gy2 <= -4; gy2++) {
        tiles.push({ gx: gx, gy: gy2, type: 'pipe', area: 'cellar' });
      }
    }
    // Cellar coin arrangement.
    for (gx = 203; gx <= 211; gx += 2) {
      coins.push({ x: gx + 0.5, y: -5.4, area: 'cellar' });
    }
    for (gx = 204; gx <= 210; gx += 2) {
      coins.push({ x: gx + 0.5, y: -3.9, area: 'cellar' });
    }
    coins.push({ x: 212.5, y: -5.4, area: 'cellar' });

    // ---- Scenery (rendering only, never collides) ----
    decor.trees = [-58, -47, -38, -14, 3, 20, 33, 45, 60, 78, 96, 112, 128, 146].map(function (x) {
      return { x: x, z: -6 - (Math.abs(x) % 3), h: 3 + (Math.abs(x) % 2) };
    });
    decor.bushes = [-55, -44, -28, -6, 12, 26, 44, 63, 84, 102, 124, 144].map(function (x) {
      return { x: x, z: -4.5, w: 2 + (Math.abs(x) % 2) };
    });
    decor.hills = [
      { x: -52, w: 18, h: 7, z: -26, c: 0 }, { x: -20, w: 26, h: 10, z: -34, c: 0 },
      { x: 12, w: 22, h: 8, z: -28, c: 1 }, { x: 48, w: 30, h: 11, z: -36, c: 0 },
      { x: 84, w: 20, h: 7, z: -26, c: 1 }, { x: 118, w: 28, h: 10, z: -34, c: 0 },
      { x: 148, w: 22, h: 8, z: -28, c: 1 }
    ];
    decor.clouds = [];
    for (var i = 0; i < 14; i++) {
      decor.clouds.push({ x: -60 + i * 16, y: 16 + (i % 3) * 3, z: -30 - (i % 4) * 4, s: 1 + (i % 3) * 0.4 });
    }

    return { tiles: tiles, pipes: pipes, enemies: enemies, coins: coins, decor: decor };
  }

  var api = {
    tileKey: tileKey,
    buildLevel: buildLevel,
    START_X: C.START_X,
    FLAG_X: C.FLAG_X,
    CASTLE_X: C.CASTLE_X
  };

  root.LPMLevel = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : globalThis);
