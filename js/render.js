(function (root) {
  'use strict';

  var THREE = root.THREE;
  var C = root.LPMConfig || require('./config.js');

  function mat(color, tex) {
    if (tex) return new THREE.MeshLambertMaterial({ map: tex });
    return new THREE.MeshLambertMaterial({ color: color });
  }

  function box(w, h, d, material, x, y, z) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x || 0, y || 0, z || 0);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }

  function Renderer(container, world) {
    this.container = container;
    this.ok = false;
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch (e) {
      this.renderer = null;
    }
    if (!this.renderer) return;
    this.ok = true;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(C.COLORS.sky);
    this.camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 300);

    var hemi = new THREE.HemisphereLight(0xffffff, 0x88aa66, 0.75);
    this.scene.add(hemi);
    this.sun = new THREE.DirectionalLight(0xfff4e0, 0.9);
    this.sun.position.set(10, 24, 12);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.width = 1024;
    this.sun.shadow.mapSize.height = 1024;
    var sc = this.sun.shadow.camera;
    sc.left = -18; sc.right = 18; sc.top = 18; sc.bottom = -18; sc.near = 1; sc.far = 80;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    this.textures = root.LPMTextures.buildTextures();
    this.materials = {
      grass: mat(0, this.textures.grassTop),
      soil: mat(0, this.textures.soil),
      stair: mat(0, this.textures.stair),
      pipe: mat(0, this.textures.pipe),
      brick: mat(0, this.textures.brick),
      question: mat(0, this.textures.question),
      used: mat(0, this.textures.used),
      coin: mat(0, this.textures.coin),
      hillFar: mat(C.COLORS.hillFar),
      hillNear: mat(C.COLORS.hillNear),
      cloud: mat(0xffffff),
      trunk: mat(0, this.textures.trunk),
      leaves: mat(0, this.textures.leaves),
      bush: mat(0, this.textures.bush),
      castleWall: mat(0, this.textures.castleWall),
      castleRoof: mat(C.COLORS.castleRoof),
      flagCloth: mat(0xe84b3c),
      pole: mat(0x9aa0a6)
    };

    this.fx = [];
    this.entityMeshes = new Map();
    this.popupMeshes = new Map();
    this.animT = 0;
    this.flagClothY = 7;

    this.buildStatic(world);
    this.buildMario();
    this.buildFlagAndCastle(world);
  }

  // ------------------------------------------------------------- static world

  Renderer.prototype.buildStatic = function (world) {
    if (this.staticGroup) this.disposeGroup(this.staticGroup);
    this.staticGroup = new THREE.Group();
    this.tileIndex = {};
    this.instanceMeshes = [];

    var byMat = {};
    var i, t;
    for (i = 0; i < world.tileList.length; i++) {
      t = world.tileList[i];
      var m = this.materialForTile(t);
      if (!m) continue;
      if (!byMat[m.uuid]) byMat[m.uuid] = { mat: m, tiles: [] };
      byMat[m.uuid].tiles.push(t);
    }
    for (var key in byMat) {
      var group = byMat[key];
      var im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), group.mat, group.tiles.length);
      im.castShadow = true;
      im.receiveShadow = true;
      var dummy = new THREE.Object3D();
      for (i = 0; i < group.tiles.length; i++) {
        t = group.tiles[i];
        var hidden = t.type === 'hidden' && !t.revealed;
        dummy.position.set(t.gx + 0.5, t.gy + 0.5, 0);
        dummy.scale.set(hidden ? 0 : 1, hidden ? 0 : 1, hidden ? 0 : 1);
        dummy.updateMatrix();
        im.setMatrixAt(i, dummy.matrix);
        this.tileIndex[t.gx + ',' + t.gy] = { mesh: im, index: i, tile: t };
      }
      im.instanceMatrix.needsUpdate = true;
      this.staticGroup.add(im);
      this.instanceMeshes.push(im);
    }

    // Pipe rims (slightly wider caps, cosmetic only).
    for (i = 0; i < world.pipes.length; i++) {
      var p = world.pipes[i];
      var baseY = p.area === 'cellar' ? -6 : 0;
      var rim = box(2.2, 0.4, 1.2, this.materials.pipe, p.gx + 1, baseY + p.h - 0.2, 0);
      this.staticGroup.add(rim);
    }

    // Scenery: hills, clouds, trees, bushes.
    var d = world.decor;
    for (i = 0; i < d.hills.length; i++) {
      var h = d.hills[i];
      var hm = box(h.w, h.h, 6, h.c === 0 ? this.materials.hillFar : this.materials.hillNear, h.x, h.h / 2 - 1, h.z);
      hm.castShadow = false;
      this.staticGroup.add(hm);
    }
    this.clouds = [];
    for (i = 0; i < d.clouds.length; i++) {
      var cl = d.clouds[i];
      var cm = new THREE.Group();
      cm.add(box(2.4 * cl.s, 0.8, 1, this.materials.cloud, 0, 0, 0));
      cm.add(box(1.4 * cl.s, 0.7, 1, this.materials.cloud, 0.8 * cl.s, 0.5, 0));
      cm.add(box(1.2 * cl.s, 0.6, 1, this.materials.cloud, -0.7 * cl.s, 0.4, 0));
      cm.position.set(cl.x, cl.y, cl.z);
      cm.traverse(function (o) { o.castShadow = false; });
      this.clouds.push(cm);
      this.staticGroup.add(cm);
    }
    for (i = 0; i < d.trees.length; i++) {
      var tr = d.trees[i];
      var tm = new THREE.Group();
      tm.add(box(0.5, tr.h, 0.5, this.materials.trunk, 0, tr.h / 2, 0));
      tm.add(box(2.2, 1.2, 2.2, this.materials.leaves, 0, tr.h + 0.3, 0));
      tm.add(box(1.6, 1.0, 1.6, this.materials.leaves, 0, tr.h + 1.2, 0));
      tm.position.set(tr.x, 0, tr.z);
      this.staticGroup.add(tm);
    }
    for (i = 0; i < d.bushes.length; i++) {
      var b = d.bushes[i];
      var bm = new THREE.Group();
      bm.add(box(b.w, 0.9, 1, this.materials.bush, 0, 0.45, 0));
      bm.add(box(b.w * 0.55, 0.7, 1, this.materials.bush, 0, 1.0, 0));
      bm.position.set(b.x, 0, b.z);
      this.staticGroup.add(bm);
    }
    this.scene.add(this.staticGroup);
  };

  Renderer.prototype.materialForTile = function (t) {
    if (t.type === 'ground') {
      return t.gy >= -1 ? this.materials.grass : this.materials.soil;
    }
    if (t.type === 'stair') return this.materials.stair;
    if (t.type === 'pipe') return this.materials.pipe;
    if (t.type === 'brick') return this.materials.brick;
    if (t.type === 'question') return this.materials.question;
    if (t.type === 'used') return this.materials.used;
    if (t.type === 'hidden') return this.materials.used;
    return null;
  };

  Renderer.prototype.setTileVisible = function (gx, gy, visible) {
    var rec = this.tileIndex[gx + ',' + gy];
    if (!rec) return;
    var dummy = new THREE.Object3D();
    dummy.position.set(gx + 0.5, gy + 0.5, 0);
    dummy.scale.set(visible ? 1 : 0.001, visible ? 1 : 0.001, visible ? 1 : 0.001);
    dummy.updateMatrix();
    rec.mesh.setMatrixAt(rec.index, dummy.matrix);
    rec.mesh.instanceMatrix.needsUpdate = true;
  };

  Renderer.prototype.setTileType = function (gx, gy, type) {
    var rec = this.tileIndex[gx + ',' + gy];
    if (!rec) return;
    rec.mesh.setColorAt(rec.index, new THREE.Color(0xffffff));
    if (rec.mesh.instanceColor) rec.mesh.instanceColor.needsUpdate = true;
    this.setTileVisible(gx, gy, true);
  };

  // ------------------------------------------------------------- mario

  Renderer.prototype.buildMario = function () {
    var g = new THREE.Group();
    var red = mat(0xd63a2f), blue = mat(0x2f5fd3), skin = mat(0xf3c092),
        white = mat(0xffffff), brown = mat(0x6a4326), dark = mat(0x2b2b2b),
        gold = mat(0xf2b632);
    this.marioMats = { red: red, blue: blue, skin: skin, white: white, brown: brown, dark: dark, gold: gold };

    // Legs (hip pivots)
    this.marioLegL = new THREE.Group();
    this.marioLegR = new THREE.Group();
    this.marioLegL.add(box(0.22, 0.45, 0.26, blue, 0, -0.22, 0));
    this.marioLegL.add(box(0.26, 0.14, 0.4, brown, 0.02, -0.45, 0.06));
    this.marioLegR.add(box(0.22, 0.45, 0.26, blue, 0, -0.22, 0));
    this.marioLegR.add(box(0.26, 0.14, 0.4, brown, 0.02, -0.45, 0.06));
    this.marioLegL.position.set(-0.14, 0.45, 0);
    this.marioLegR.position.set(0.14, 0.45, 0);

    // Body
    var body = new THREE.Group();
    body.add(box(0.62, 0.5, 0.4, this.marioMats.red, 0, 0.7, 0));
    body.add(box(0.66, 0.28, 0.44, this.marioMats.blue, 0, 0.42, 0));
    body.add(box(0.14, 0.4, 0.05, this.marioMats.blue, -0.17, 0.78, 0.21));
    body.add(box(0.14, 0.4, 0.05, this.marioMats.blue, 0.17, 0.78, 0.21));
    body.add(box(0.09, 0.09, 0.06, this.marioMats.gold, -0.17, 0.55, 0.23));
    body.add(box(0.09, 0.09, 0.06, this.marioMats.gold, 0.17, 0.55, 0.23));

    // Arms (shoulder pivots)
    this.marioArmL = new THREE.Group();
    this.marioArmR = new THREE.Group();
    this.marioArmL.add(box(0.18, 0.4, 0.2, this.marioMats.red, 0, -0.2, 0));
    this.marioArmL.add(box(0.2, 0.16, 0.22, this.marioMats.white, 0, -0.44, 0));
    this.marioArmR.add(box(0.18, 0.4, 0.2, this.marioMats.red, 0, -0.2, 0));
    this.marioArmR.add(box(0.2, 0.16, 0.22, this.marioMats.white, 0, -0.44, 0));
    this.marioArmL.position.set(-0.4, 1.05, 0);
    this.marioArmR.position.set(0.4, 1.05, 0);

    // Head
    var head = new THREE.Group();
    head.add(box(0.56, 0.46, 0.5, this.marioMats.skin, 0, 0.23, 0));
    head.add(box(0.6, 0.16, 0.54, this.marioMats.red, 0, 0.5, 0.02));
    head.add(box(0.42, 0.1, 0.34, this.marioMats.red, 0, 0.44, 0.28));
    head.add(box(0.14, 0.12, 0.02, this.marioMats.white, -0.12, 0.28, 0.26));
    head.add(box(0.14, 0.12, 0.02, this.marioMats.white, 0.12, 0.28, 0.26));
    head.add(box(0.1, 0.06, 0.02, this.marioMats.dark, -0.12, 0.32, 0.27));
    head.add(box(0.1, 0.06, 0.02, this.marioMats.dark, 0.12, 0.32, 0.27));
    head.add(box(0.3, 0.06, 0.02, this.marioMats.dark, -0.02, 0.4, 0.27));
    head.add(box(0.2, 0.16, 0.2, this.marioMats.skin, 0, 0.16, 0.3));
    head.add(box(0.34, 0.08, 0.1, this.marioMats.dark, 0, 0.08, 0.26));
    head.add(box(0.1, 0.16, 0.12, this.marioMats.skin, -0.3, 0.22, 0.05));
    head.add(box(0.1, 0.16, 0.12, this.marioMats.skin, 0.3, 0.22, 0.05));
    var mLetter = box(0.12, 0.12, 0.02, this.marioMats.white, 0, 0.5, 0.29);
    head.add(mLetter);
    head.position.set(0, 1.15, 0);

    g.add(this.marioLegL);
    g.add(this.marioLegR);
    g.add(body);
    g.add(this.marioArmL);
    g.add(this.marioArmR);
    g.add(head);
    this.marioGroup = g;
    this.marioHead = head;
    this.marioBody = body;
    this.marioWalkPhase = 0;
    this.scene.add(g);

    // Blob shadow
    var shGeo = new THREE.CircleGeometry(0.42, 16);
    this.marioShadow = new THREE.Mesh(shGeo, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 }));
    this.marioShadow.rotation.x = -Math.PI / 2;
    this.scene.add(this.marioShadow);
  };

  // ------------------------------------------------------------- flag & castle

  Renderer.prototype.buildFlagAndCastle = function (world) {
    var g = new THREE.Group();
    var pole = box(0.14, 9, 0.14, this.materials.pole, C.FLAG_X, 4.5, 0);
    g.add(pole);
    g.add(box(0.5, 0.3, 0.3, mat(0xf2b632), C.FLAG_X, 9, 0));
    this.flagCloth = box(1.1, 0.8, 0.06, this.materials.flagCloth, C.FLAG_X - 0.62, 8.2, 0);
    g.add(this.flagCloth);

    var cx = C.CASTLE_X;
    g.add(box(7, 5, 4, this.materials.castleWall, cx + 1, 2.5, 0));
    g.add(box(1.6, 3, 0.4, mat(0x3a2a1a), cx + 1, 1.5, 2.05));
    g.add(box(2.2, 2.2, 4.4, this.materials.castleRoof, cx - 1.6, 6.1, 0));
    g.add(box(2.2, 2.2, 4.4, this.materials.castleRoof, cx + 3.6, 6.1, 0));
    g.add(box(1.8, 2.6, 4.2, this.materials.castleWall, cx + 1, 6.3, 0));
    g.add(box(2.4, 1.2, 4.6, this.materials.castleRoof, cx + 1, 8.1, 0));
    this.scene.add(g);
    this.castleGroup = g;
  };

  // ------------------------------------------------------------- entities

  Renderer.prototype.buildGoomba = function () {
    var g = new THREE.Group();
    var brown = mat(0x9c5a2e), dark = mat(0x2b2b2b), feet = mat(0x3a2a1a), light = mat(0xf0d0a0);
    var body = box(0.8, 0.6, 0.7, brown, 0, 0.45, 0);
    body.geometry = body.geometry.clone();
    g.add(body);
    g.add(box(0.5, 0.25, 0.5, light, 0, 0.72, 0.1));
    g.add(box(0.12, 0.16, 0.05, dark, -0.15, 0.55, 0.36));
    g.add(box(0.12, 0.16, 0.05, dark, 0.15, 0.55, 0.36));
    g.add(box(0.3, 0.08, 0.04, dark, 0, 0.38, 0.36));
    g.add(box(0.22, 0.16, 0.3, feet, -0.22, 0.08, 0));
    g.add(box(0.22, 0.16, 0.3, feet, 0.22, 0.08, 0));
    g.userData.body = body;
    return g;
  };

  Renderer.prototype.buildKoopa = function (color) {
    var g = new THREE.Group();
    var shellC = color === 'red' ? 0xd63a2f : 0x2fae4a;
    var shell = mat(shellC), skin = mat(0xf3c092), dark = mat(0x2b2b2b), white = mat(0xffffff);
    g.add(box(0.7, 0.5, 0.6, shell, 0, 0.35, 0));
    g.add(box(0.5, 0.3, 0.2, mat(0xf2d94e), 0, 0.35, 0.32));
    var head = new THREE.Group();
    head.add(box(0.34, 0.32, 0.34, skin, 0, 0.16, 0));
    head.add(box(0.28, 0.1, 0.3, mat(0x3f9330), 0, 0.34, 0));
    head.add(box(0.08, 0.08, 0.04, dark, -0.09, 0.2, 0.18));
    head.add(box(0.08, 0.08, 0.04, dark, 0.09, 0.2, 0.18));
    head.add(box(0.1, 0.06, 0.1, mat(0xf2b632), 0, 0.12, 0.2));
    head.position.set(0, 0.6, 0.28);
    g.userData.head = head;
    g.add(head);
    var footL = box(0.18, 0.22, 0.26, skin, -0.2, 0.11, 0.05);
    var footR = box(0.18, 0.22, 0.26, skin, 0.2, 0.11, 0.05);
    g.userData.footL = footL;
    g.userData.footR = footR;
    g.add(footL); g.add(footR);
    return g;
  };

  Renderer.prototype.buildItem = function (type) {
    var g = new THREE.Group();
    if (type === 'mushroom' || type === 'oneup') {
      var capC = type === 'oneup' ? 0x2fae4a : 0xd63a2f;
      g.add(box(0.6, 0.35, 0.55, mat(capC), 0, 0.5, 0));
      g.add(box(0.16, 0.16, 0.02, mat(0xffffff), -0.15, 0.55, 0.28));
      g.add(box(0.16, 0.16, 0.02, mat(0xffffff), 0.17, 0.55, 0.28));
      g.add(box(0.14, 0.14, 0.02, mat(0xffffff), 0.01, 0.68, 0.28));
      g.add(box(0.4, 0.3, 0.35, mat(0xf3c092), 0, 0.18, 0));
      g.add(box(0.08, 0.06, 0.02, mat(0x2b2b2b), -0.09, 0.22, 0.18));
      g.add(box(0.08, 0.06, 0.02, mat(0x2b2b2b), 0.09, 0.22, 0.18));
    } else if (type === 'flower') {
      g.add(box(0.1, 0.4, 0.1, mat(0x3f9330), 0, 0.2, 0));
      g.add(box(0.3, 0.12, 0.1, mat(0x3f9330), 0.14, 0.15, 0));
      g.add(box(0.4, 0.3, 0.3, mat(0xf0503c), 0, 0.55, 0));
      g.add(box(0.2, 0.2, 0.32, mat(0xffffff), 0, 0.55, 0));
      g.add(box(0.14, 0.14, 0.02, mat(0xf2b632), 0, 0.55, 0.17));
    } else if (type === 'star') {
      g.add(box(0.5, 0.5, 0.3, mat(0xf2d94e), 0, 0.4, 0));
      g.add(box(0.2, 0.2, 0.32, mat(0xffffff), -0.12, 0.48, 0));
      g.add(box(0.2, 0.2, 0.32, mat(0xffffff), 0.12, 0.48, 0));
      g.add(box(0.08, 0.08, 0.02, mat(0x2b2b2b), -0.12, 0.5, 0.17));
      g.add(box(0.08, 0.08, 0.02, mat(0x2b2b2b), 0.12, 0.5, 0.17));
    }
    return g;
  };

  Renderer.prototype.buildCoin = function () {
    var g = new THREE.Group();
    var c = box(0.5, 0.62, 0.1, this.materials.coin, 0, 0, 0);
    c.add(box(0.3, 0.4, 0.12, mat(0xe8a20c), 0, 0, 0));
    g.add(c);
    return g;
  };

  Renderer.prototype.buildFireball = function () {
    var g = new THREE.Group();
    g.add(box(0.3, 0.3, 0.3, mat(0xff7a1e), 0, 0, 0));
    g.add(box(0.16, 0.16, 0.16, mat(0xffd23e), 0, 0, 0));
    return g;
  };

  Renderer.prototype.buildPopup = function (text) {
    var c = document.createElement('canvas');
    c.width = 128; c.height = 48;
    var ctx = c.getContext('2d');
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#263B36';
    ctx.fillText(text, 66, 34);
    ctx.fillStyle = '#FFF6D9';
    ctx.fillText(text, 64, 32);
    var tex = new THREE.CanvasTexture(c);
    var sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
    sprite.scale.set(1.6, 0.6, 1);
    return sprite;
  };

  // ------------------------------------------------------------- effects

  Renderer.prototype.spawnFx = function (type, x, y) {
    var self = this;
    function debris(color, n, speed, size, life) {
      for (var i = 0; i < n; i++) {
        var m = box(size, size, size, mat(color), x, y, 0);
        self.fx.push({
          mesh: m, t: 0, life: life,
          vx: (Math.random() - 0.5) * speed, vy: 3 + Math.random() * speed * 0.6,
          vr: (Math.random() - 0.5) * 10, gravity: true
        });
        self.scene.add(m);
      }
    }
    if (type === 'brickbreak') debris(0xc0622e, 4, 5, 0.3, 1.0);
    else if (type === 'stomp') debris(0xffffff, 3, 2, 0.12, 0.4);
    else if (type === 'fireballhit') debris(0xff7a1e, 3, 2.5, 0.12, 0.35);
    else if (type === 'firework') {
      var colors = [0xf2d94e, 0xf0503c, 0x5fd97a, 0xffffff];
      debris(colors[Math.floor(Math.random() * colors.length)], 14, 9, 0.22, 1.2);
    } else if (type === 'coin') debris(0xffd23e, 3, 1.5, 0.1, 0.4);
    else if (type === 'reveal') debris(0xffffff, 4, 2, 0.12, 0.5);
  };

  Renderer.prototype.updateFx = function (dt) {
    for (var i = this.fx.length - 1; i >= 0; i--) {
      var f = this.fx[i];
      f.t += dt;
      if (f.gravity) f.vy -= 20 * dt;
      f.mesh.position.x += f.vx * dt;
      f.mesh.position.y += f.vy * dt;
      f.mesh.rotation.z += f.vr * dt;
      if (f.t >= f.life) {
        this.scene.remove(f.mesh);
        f.mesh.geometry.dispose();
        this.fx.splice(i, 1);
      }
    }
  };

  // ------------------------------------------------------------- sync

  Renderer.prototype.sync = function (world, dt) {
    var p = world.player;
    this.animT += dt;

    // Camera
    var camX = p.x + 3, camY = Math.max(p.y + 3.2, 4.5);
    if (world.area === 'cellar') camY = p.y + 3.5;
    this.camera.position.x += (camX - this.camera.position.x) * Math.min(1, dt * 8);
    this.camera.position.y += (camY - this.camera.position.y) * Math.min(1, dt * 6);
    this.camera.position.z = 14;
    this.camera.lookAt(this.camera.position.x - 1.5, this.camera.position.y - 1.5, 0);
    this.sun.position.set(p.x + 10, 24, 12);
    this.sun.target.position.set(p.x, 0, 0);
    this.sun.target.updateMatrixWorld();

    // Area atmosphere
    var targetBg = world.area === 'cellar' ? new THREE.Color(0x1a2230) : new THREE.Color(C.COLORS.sky);
    this.scene.background.lerp(targetBg, Math.min(1, dt * 4));

    // Clouds drift
    for (var i = 0; i < this.clouds.length; i++) {
      this.clouds[i].position.x += dt * 0.3;
    }

    this.syncMario(world, dt);
    this.syncEntities(world, dt);
    this.updateFx(dt);

    // Flag cloth lowering during finish
    if (world.state === 'finish' && world.finishSeq && world.finishSeq.phase === 'slide') {
      this.flagClothY = Math.max(1.2, this.flagClothY - dt * 5);
      this.flagCloth.position.y = this.flagClothY;
    } else if (world.state !== 'finish') {
      this.flagClothY = 8.2;
      this.flagCloth.position.y = this.flagClothY;
    }

    this.renderer.render(this.scene, this.camera);
  };

  Renderer.prototype.syncMario = function (world, dt) {
    var p = world.player;
    var g = this.marioGroup;
    var visible = true;
    if (p.invulnT > 0 && world.state === 'play') {
      visible = Math.floor(this.animT * 12) % 2 === 0;
    }
    g.visible = visible;

    g.position.set(p.x, p.y, 0);
    g.rotation.y = p.facing >= 0 ? 0.35 : -0.35;

    var scale = p.power > 0 ? 1.5 : 1.0;
    if (world.state === 'dying') g.rotation.z = Math.PI;
    else g.rotation.z = 0;
    if (p.ducked) {
      g.scale.set(scale, scale * 0.72, scale);
    } else {
      g.scale.set(scale, scale, scale);
    }

    // Limb animation
    var speed = Math.abs(p.vx);
    if (!p.grounded && world.state !== 'dying') {
      this.marioArmL.rotation.x = -2.4;
      this.marioArmR.rotation.x = -2.4;
      this.marioLegL.rotation.x = 0.5;
      this.marioLegR.rotation.x = -0.3;
    } else if (speed > 0.3) {
      this.marioWalkPhase += speed * dt * 3.2;
      var swing = Math.sin(this.marioWalkPhase * 2.2) * 0.7;
      this.marioLegL.rotation.x = swing;
      this.marioLegR.rotation.x = -swing;
      this.marioArmL.rotation.x = -swing * 0.8;
      this.marioArmR.rotation.x = swing * 0.8;
      if (p.skidding) {
        this.marioArmL.rotation.x = 1.2;
        this.marioArmR.rotation.x = 1.2;
      }
    } else {
      this.marioLegL.rotation.x *= 0.8;
      this.marioLegR.rotation.x *= 0.8;
      this.marioArmL.rotation.x *= 0.8;
      this.marioArmR.rotation.x *= 0.8;
    }
    if (p.throwPoseT > 0) this.marioArmR.rotation.x = 2.6;

    // Fire outfit
    var fire = p.power === 2;
    this.marioMats.red.color.setHex(fire ? 0xffffff : 0xd63a2f);
    this.marioMats.white.color.setHex(fire ? 0xf0503c : 0xffffff);

    // Star tint
    if (p.starT > 0) {
      var hue = (this.animT * 3) % 1;
      var c = new THREE.Color().setHSL(hue, 0.8, 0.6);
      this.marioMats.red.color.copy(c);
      this.marioMats.blue.color.setHSL((hue + 0.3) % 1, 0.8, 0.55);
    } else {
      this.marioMats.blue.color.setHex(0x2f5fd3);
    }

    // Blob shadow
    this.marioShadow.visible = world.state !== 'dying';
    this.marioShadow.position.set(p.x, 0.02, 0);
    if (world.area === 'cellar') this.marioShadow.position.y = -5.98;
  };

  Renderer.prototype.syncEntities = function (world, dt) {
    var self = this;
    var seen = new Set();

    function ensureMesh(key, builder) {
      seen.add(key);
      if (!self.entityMeshes.has(key)) {
        var m = builder();
        self.entityMeshes.set(key, m);
        self.scene.add(m);
      }
      return self.entityMeshes.get(key);
    }

    // Enemies
    for (var i = 0; i < world.enemies.length; i++) {
      var e = world.enemies[i];
      (function (e) {
        var m = ensureMesh(e, function () { return e.type === 'goomba' ? self.buildGoomba() : self.buildKoopa(e.color); });
        m.visible = e.active;
        m.position.set(e.x, e.y, 0);
        m.rotation.y = e.dir > 0 ? 0.35 : -0.35;
        if (e.state === 'walk') {
          m.scale.set(1, 1, 1);
          m.position.y = e.y + (e.type === 'koopa' ? 0 : 0) + Math.abs(Math.sin(self.animT * 8)) * 0.04;
          m.rotation.z = 0;
          if (e.type === 'goomba' && m.userData.body) {
            m.userData.body.rotation.z = Math.sin(self.animT * 10) * 0.08;
          }
        } else if (e.state === 'flat') {
          m.scale.set(1.15, 0.25, 1.15);
          m.rotation.z = 0;
        } else if (e.state === 'shell' || e.state === 'slide') {
          m.scale.set(1, 1, 1);
          if (m.userData.head) m.userData.head.visible = false;
          if (m.userData.footL) { m.userData.footL.visible = false; m.userData.footR.visible = false; }
          m.rotation.z = e.state === 'slide' ? self.animT * 14 : (e.wakeT < 1 ? Math.sin(self.animT * 30) * 0.12 : 0);
          m.position.y = e.y;
        } else if (e.state === 'dead') {
          m.rotation.z = Math.PI;
          if (m.userData.head) m.userData.head.visible = true;
        }
        if (e.state === 'walk' && m.userData.head) {
          m.userData.head.visible = true;
          if (m.userData.footL) { m.userData.footL.visible = true; m.userData.footR.visible = true; }
        }
      })(e);
    }

    // Items
    for (i = 0; i < world.items.length; i++) {
      var it = world.items[i];
      (function (it) {
        var m = ensureMesh(it, function () { return self.buildItem(it.type); });
        m.position.set(it.x, it.y, 0);
        if (it.state === 'emerge') {
          m.visible = true;
          m.position.y = it.y;
        }
        if (it.type === 'flower') m.rotation.y = Math.sin(self.animT * 2) * 0.4;
        if (it.type === 'star') m.rotation.y = self.animT * 3;
      })(it);
    }

    // Fireballs
    for (i = 0; i < world.fireballs.length; i++) {
      var f = world.fireballs[i];
      (function (f) {
        var m = ensureMesh(f, function () { return self.buildFireball(); });
        m.position.set(f.x, f.y, 0);
        m.rotation.x += dt * 12;
        m.rotation.y += dt * 9;
      })(f);
    }

    // Coins
    for (i = 0; i < world.coins.length; i++) {
      var c = world.coins[i];
      (function (c) {
        var key = 'coin' + i;
        var m = ensureMesh(key, function () { return self.buildCoin(); });
        m.visible = !c.taken && c.area === world.area;
        m.position.set(c.x, c.y, 0);
        m.rotation.y = self.animT * 4;
      })(c);
    }

    // Popups
    for (i = 0; i < world.popups.length; i++) {
      var pop = world.popups[i];
      (function (pop, idx) {
        var key = 'pop' + idx;
        if (!self.popupMeshes.has(key) || self.popupMeshes.get(key).userData.text !== pop.text) {
          var old = self.popupMeshes.get(key);
          if (old) { self.scene.remove(old); old.material.map.dispose(); old.material.dispose(); }
          var s = self.buildPopup(pop.text);
          s.userData.text = pop.text;
          self.popupMeshes.set(key, s);
          self.scene.add(s);
        }
        var sp = self.popupMeshes.get(key);
        sp.position.set(pop.x, pop.y + 0.8, 1);
        sp.material.opacity = Math.max(0, 1 - pop.t / 0.9);
      })(pop, i);
    }
    // Remove stale popup sprites
    var popKeys = new Set();
    for (i = 0; i < world.popups.length; i++) popKeys.add('pop' + i);
    var stalePops = [];
    this.popupMeshes.forEach(function (mesh, key) {
      if (!popKeys.has(key)) stalePops.push(key);
    });
    for (i = 0; i < stalePops.length; i++) {
      var old2 = this.popupMeshes.get(stalePops[i]);
      this.scene.remove(old2);
      old2.material.map.dispose();
      old2.material.dispose();
      this.popupMeshes.delete(stalePops[i]);
    }

    // Remove meshes for gone entities
    var deleteKeys = [];
    this.entityMeshes.forEach(function (mesh, key) {
      if (!seen.has(key)) deleteKeys.push(key);
    });
    for (i = 0; i < deleteKeys.length; i++) {
      var mesh = this.entityMeshes.get(deleteKeys[i]);
      this.scene.remove(mesh);
      mesh.traverse(function (o) {
        if (o.geometry) o.geometry.dispose();
      });
      this.entityMeshes.delete(deleteKeys[i]);
    }
  };

  Renderer.prototype.onResize = function () {
    var w = this.container.clientWidth, h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  Renderer.prototype.handleEvents = function (events) {
    for (var i = 0; i < events.length; i++) {
      var e = events[i];
      if (e.type === 'brickbreak') this.setTileVisible(Math.floor(e.x), Math.floor(e.y), false);
      else if (e.type === 'reveal') this.setTileVisible(Math.floor(e.x), Math.floor(e.y), true);
      else if (e.type === 'stomp') this.spawnFx('stomp', e.x, e.y);
      else if (e.type === 'fireballhit') this.spawnFx('fireballhit', e.x, e.y);
      else if (e.type === 'firework') this.spawnFx('firework', e.x, e.y);
      else if (e.type === 'coin' || e.type === 'coinpop') this.spawnFx('coin', e.x, e.y);
    }
  };

  Renderer.prototype.rebuild = function (world) {
    // Full rebuild for a fresh run (restart). Bounded: static group is disposed.
    this.buildStatic(world);
    var meshes = [];
    this.entityMeshes.forEach(function (m) { meshes.push(m); });
    for (var i = 0; i < meshes.length; i++) {
      this.scene.remove(meshes[i]);
    }
    this.entityMeshes.clear();
    this.popupMeshes.forEach(function (m) { this.scene.remove(m); }, this);
    this.popupMeshes.clear();
    for (i = this.fx.length - 1; i >= 0; i--) {
      this.scene.remove(this.fx[i].mesh);
    }
    this.fx.length = 0;
  };

  Renderer.prototype.disposeGroup = function (g) {
    g.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
    });
    this.scene.remove(g);
  };

  root.LPMRenderer = { Renderer: Renderer };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.LPMRenderer;
})(typeof self !== 'undefined' ? self : globalThis);
