(function (root) {
  'use strict';

  var THREE = root.THREE;

  function makeCanvas(size) {
    var c = document.createElement('canvas');
    c.width = size; c.height = size;
    return c;
  }

  function toTexture(canvas) {
    var tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    return tex;
  }

  function px(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }

  function noiseFlecks(ctx, size, colors, count) {
    for (var i = 0; i < count; i++) {
      var x = Math.floor(Math.random() * size);
      var y = Math.floor(Math.random() * size);
      px(ctx, x, y, 1, 1, colors[i % colors.length]);
    }
  }

  function grassTop() {
    var c = makeCanvas(16), ctx = c.getContext('2d');
    px(ctx, 0, 0, 16, 16, '#4fae3d');
    noiseFlecks(ctx, 16, ['#63c24a', '#3f9330', '#7ed957'], 26);
    return toTexture(c);
  }

  function soil() {
    var c = makeCanvas(16), ctx = c.getContext('2d');
    px(ctx, 0, 0, 16, 16, '#9c6b3f');
    noiseFlecks(ctx, 16, ['#8a5c34', '#b07a4a', '#7a4f2e'], 30);
    px(ctx, 0, 5, 16, 1, '#8a5c34');
    px(ctx, 0, 11, 16, 1, '#8a5c34');
    return toTexture(c);
  }

  function brickTex() {
    var c = makeCanvas(16), ctx = c.getContext('2d');
    px(ctx, 0, 0, 16, 16, '#c0622e');
    px(ctx, 0, 0, 16, 1, '#e8d5b5');
    px(ctx, 0, 5, 16, 1, '#e8d5b5');
    px(ctx, 0, 10, 16, 1, '#e8d5b5');
    px(ctx, 0, 15, 16, 1, '#e8d5b5');
    px(ctx, 7, 1, 1, 4, '#e8d5b5');
    px(ctx, 3, 6, 1, 4, '#e8d5b5');
    px(ctx, 11, 6, 1, 4, '#e8d5b5');
    px(ctx, 7, 11, 1, 4, '#e8d5b5');
    noiseFlecks(ctx, 16, ['#a9526a'.replace('6a', '24'), '#d3743e'], 10);
    return toTexture(c);
  }

  function questionTex() {
    var c = makeCanvas(16), ctx = c.getContext('2d');
    px(ctx, 0, 0, 16, 16, '#f2b632');
    px(ctx, 0, 0, 16, 1, '#ffd97a');
    px(ctx, 0, 15, 16, 1, '#b8862a');
    px(ctx, 0, 0, 1, 16, '#ffd97a');
    px(ctx, 15, 0, 1, 16, '#b8862a');
    // pixel '?'
    var q = [
      '  XXXX  ',
      ' XX  XX ',
      ' XX  XX ',
      '     XX ',
      '    XX  ',
      '    XX  ',
      '        ',
      '    XX  '
    ];
    for (var y = 0; y < 8; y++) {
      for (var x = 0; x < 8; x++) {
        if (q[y][x] === 'X') px(ctx, 4 + x, 4 + y, 1, 1, '#7a4f1d');
      }
    }
    return toTexture(c);
  }

  function usedTex() {
    var c = makeCanvas(16), ctx = c.getContext('2d');
    px(ctx, 0, 0, 16, 16, '#8a6a4a');
    px(ctx, 0, 0, 16, 1, '#a0825e');
    px(ctx, 0, 15, 16, 1, '#6a4e34');
    noiseFlecks(ctx, 16, ['#7a5c40', '#96754f'], 12);
    return toTexture(c);
  }

  function pipeTex() {
    var c = makeCanvas(16), ctx = c.getContext('2d');
    px(ctx, 0, 0, 16, 16, '#2fae4a');
    px(ctx, 2, 0, 2, 16, '#5fd97a');
    px(ctx, 12, 0, 2, 16, '#1d7a31');
    return toTexture(c);
  }

  function stairTex() {
    var c = makeCanvas(16), ctx = c.getContext('2d');
    px(ctx, 0, 0, 16, 16, '#b9905e');
    noiseFlecks(ctx, 16, ['#a9814f', '#c9a06c'], 18);
    px(ctx, 0, 7, 16, 1, '#a9814f');
    return toTexture(c);
  }

  function trunkTex() {
    var c = makeCanvas(16), ctx = c.getContext('2d');
    px(ctx, 0, 0, 16, 16, '#7a4f2e');
    for (var x = 1; x < 16; x += 3) px(ctx, x, 0, 1, 16, '#5e3c22');
    return toTexture(c);
  }

  function leavesTex() {
    var c = makeCanvas(16), ctx = c.getContext('2d');
    px(ctx, 0, 0, 16, 16, '#3f9330');
    noiseFlecks(ctx, 16, ['#4fae3d', '#2f7a24', '#63c24a'], 34);
    return toTexture(c);
  }

  function flatColor(hex) {
    var c = makeCanvas(16), ctx = c.getContext('2d');
    px(ctx, 0, 0, 16, 16, hex);
    return toTexture(c);
  }

  function buildTextures() {
    return {
      grassTop: grassTop(),
      soil: soil(),
      brick: brickTex(),
      question: questionTex(),
      used: usedTex(),
      pipe: pipeTex(),
      stair: stairTex(),
      trunk: trunkTex(),
      leaves: leavesTex(),
      coin: flatColor('#ffd23e'),
      hillNear: flatColor('#7cc9a0'),
      hillFar: flatColor('#a8e0c8'),
      cloud: flatColor('#ffffff'),
      bush: flatColor('#4fae3d'),
      castleWall: brickTex(),
      castleRoof: flatColor('#c94b3c'),
      flagCloth: flatColor('#e84b3c')
    };
  }

  var api = { buildTextures: buildTextures, makeCanvas: makeCanvas, toTexture: toTexture };
  root.LPMTextures = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : globalThis);
