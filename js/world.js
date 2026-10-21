/* TT Zodiac Race: the Three.js world. The course runs along -z (z = -s): the village gate and the meadow, the great
   river (calm water, the lotus pond, fast water, big waves), the bamboo path and the Jade Emperor's palace in the
   clouds. Twelve lanes side by side, one per animal in zodiac order (the Rat on the left, the Pig on the right).
     ZR.world.init(canvas), build(race) (the rocks, logs, whirlpools and peaches of a race), update(dt), render(views)
     laneX(lane), spotX(spot), groundY(s), hidePeach(lane, id), burst(pos, color, n, speed), relabel() */
(function () {
  'use strict';
  const T = THREE;
  const ZR = window.ZR;
  const { makeCanvas, toTexture, rand } = Kit.gfx;
  const RACE = ZR.race;
  const L = RACE.L, W0 = RACE.WATER0, W1 = RACE.WATER1;
  const LW = 4.2, SPOT = 1.3, NL = 12;
  const HALF = (NL * LW) / 2;
  const LAND_Y = 0.45;

  let renderer, scene, sky, W = 1, H = 1, clock = 0;
  const root = new T.Group();
  let itemsRoot = null;
  let waterTex = null, fastTex = null, whirlTex = null;
  const particles = [];
  let peachMesh = null, peachLeaf = null, peachList = [];
  let whirlMesh = null, whirlList = [];
  let banner = null;
  let waves = [];
  const dummy = new T.Object3D();

  const laneX = (lane) => (lane - (NL - 1) / 2) * LW;
  const spotX = (spot) => spot * SPOT;
  // the ground under an animal: land is a little higher than the water, with a sloping bank in between
  function groundY(s) {
    if (s < W0 - 2 || s > W1 + 2) return LAND_Y;
    if (s < W0 + 2) return LAND_Y * (W0 + 2 - s) / 4;
    if (s > W1 - 2) return LAND_Y * (s - (W1 - 2)) / 4;
    return 0;
  }
  // how much of the animal is in the water (0 on land, 1 swimming)
  function wetness(s) {
    if (s < W0 || s > W1) return 0;
    return Math.min(1, (s - W0) / 3, (W1 - s) / 3);
  }

  function lam(color, o) { return new T.MeshLambertMaterial(Object.assign({ color }, o || {})); }
  function mesh(geo, m, x, y, z, parent) {
    const o = new T.Mesh(geo, m);
    o.position.set(x, y, z);
    (parent || root).add(o);
    return o;
  }

  // ---------------------------------------------------------------- textures
  function skyTexture() {
    const [c, g] = makeCanvas(4, 256);
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#3d8fe0');
    gr.addColorStop(0.45, '#9fd4ff');
    gr.addColorStop(0.52, '#fff1d6');
    gr.addColorStop(1, '#ffe2b8');
    g.fillStyle = gr;
    g.fillRect(0, 0, 4, 256);
    return toTexture(c);
  }
  function waterTexture(base, streaks) {
    const [c, g] = makeCanvas(256, 256);
    g.fillStyle = base;
    g.fillRect(0, 0, 256, 256);
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.lineWidth = 3;
    for (let k = 0; k < (streaks ? 26 : 34); k++) {
      const x = Math.random() * 256, y = Math.random() * 256, w = streaks ? 4 : 18 + Math.random() * 24;
      g.beginPath();
      if (streaks) { g.moveTo(x, y); g.lineTo(x + 2, y + 40 + Math.random() * 40); }
      else { g.moveTo(x - w, y); g.quadraticCurveTo(x, y - 6, x + w, y); }
      g.stroke();
    }
    const t = toTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    return t;
  }
  function grassTexture(base, dot) {
    const [c, g] = makeCanvas(128, 128);
    g.fillStyle = base;
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = dot;
    for (let k = 0; k < 140; k++) g.fillRect(Math.random() * 128, Math.random() * 128, 3, 5);
    const t = toTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    return t;
  }
  function spiralTexture() {
    const [c, g] = makeCanvas(128, 128);
    g.translate(64, 64);
    g.strokeStyle = 'rgba(255,255,255,0.85)';
    g.lineWidth = 6;
    g.beginPath();
    for (let a = 0; a < Math.PI * 7; a += 0.1) {
      const r = a * 2.6;
      g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.stroke();
    return toTexture(c);
  }
  function bannerTexture(text) {
    const [c, g] = makeCanvas(512, 128);
    g.fillStyle = '#d8261c';
    g.fillRect(0, 0, 512, 128);
    g.strokeStyle = '#ffd400';
    g.lineWidth = 10;
    g.strokeRect(8, 8, 496, 112);
    g.fillStyle = '#ffd400';
    g.font = `76px ${Kit.gfx.FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, 256, 68, 470);
    return toTexture(c);
  }

  // ---------------------------------------------------------------- setup
  function init(canvas) {
    renderer = new T.WebGLRenderer({ canvas, antialias: true });
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setScissorTest(true);
    scene = new T.Scene();
    scene.fog = new T.Fog('#e9f3ff', 90, 260);
    scene.add(new T.HemisphereLight('#e6f4ff', '#6a9a4a', 0.95));
    const sun = new T.DirectionalLight('#fff4dc', 0.8);
    sun.position.set(-30, 60, 25);
    scene.add(sun);
    sky = new T.Mesh(new T.SphereGeometry(400, 24, 12), new T.MeshBasicMaterial({ map: skyTexture(), side: T.BackSide, fog: false, depthWrite: false }));
    scene.add(sky);
    scene.add(root);
    const dot = Kit.gfx.dotTexture();
    for (let i = 0; i < 220; i++) {
      const s = new T.Sprite(new T.SpriteMaterial({ map: dot, transparent: true, depthWrite: false }));
      s.visible = false;
      scene.add(s);
      particles.push({ s, v: new T.Vector3(), life: 0, max: 1 });
    }
    terrain();
    scenery();
    palace();
    resize();
  }

  function terrain() {
    const grass = grassTexture('#79c24a', '#5fa83a');
    grass.repeat.set(30, 30);
    const gm = lam('#ffffff', { map: grass });
    const width = 260;
    // land before the river, land after it, and the river bed under the water
    mesh(new T.BoxGeometry(width, 2, 120), gm, 0, LAND_Y - 1, -W0 + 60 + 2);
    mesh(new T.BoxGeometry(width, 2, 260), gm, 0, LAND_Y - 1, -W1 - 130 - 2);
    mesh(new T.BoxGeometry(width, 1, W1 - W0 + 10), lam('#2f7f8f'), 0, -2.2, -(W0 + W1) / 2);
    // land along both sides of the river, so it's a river and not a sea
    const sideW = width / 2 - HALF - 3;
    for (const sx of [-1, 1]) mesh(new T.BoxGeometry(sideW, 2, W1 - W0 + 4), gm, sx * (HALF + 3 + sideW / 2), LAND_Y - 1, -(W0 + W1) / 2);
    // the banks: slopes down into the water
    for (const [s, dir] of [[W0, 1], [W1, -1]]) {
      const b = mesh(new T.BoxGeometry(width, 0.3, 5), lam('#c8b37a'), 0, LAND_Y / 2 - 0.3, -s);
      b.rotation.x = dir * 0.2;
    }
    // the water: one long plane, plus faster streaks in the fast water
    waterTex = waterTexture('#3fb8d0', false);
    waterTex.repeat.set(16, 60);
    const wm = new T.MeshLambertMaterial({ color: '#ffffff', map: waterTex, transparent: true, opacity: 0.92 });
    const water = mesh(new T.PlaneGeometry(width, W1 - W0 + 6), wm, 0, -0.05, -(W0 + W1) / 2);
    water.rotation.x = -Math.PI / 2;
    fastTex = waterTexture('rgba(0,0,0,0)', true);
    fastTex.repeat.set(10, 8);
    const fm = new T.MeshBasicMaterial({ map: fastTex, transparent: true, opacity: 0.55, depthWrite: false });
    const fast = mesh(new T.PlaneGeometry(HALF * 2 + 20, 80), fm, 0, 0.0, -245);
    fast.rotation.x = -Math.PI / 2;
    // dirt paths for each lane on land, and stone kerbs between lanes
    const path = lam('#e0c48c');
    for (let i = 0; i < NL; i++) {
      for (const [s0, s1] of [[-8, W0 - 2], [W1 + 2, L + 12]]) {
        const p = mesh(new T.PlaneGeometry(LW - 0.7, s1 - s0), path, laneX(i), LAND_Y + 0.01, -(s0 + s1) / 2);
        p.rotation.x = -Math.PI / 2;
      }
    }
    // lines of red and yellow floats between the lanes on the water
    const fgeo = new T.SphereGeometry(0.22, 8, 6);
    const floats = [];
    for (let i = 0; i <= NL; i++) for (let s = W0 + 2; s < W1 - 1; s += 2.4) floats.push([laneX(i) - LW / 2, s, (Math.round(s / 2.4) % 2)]);
    const fl = new T.InstancedMesh(fgeo, lam('#ffffff'), floats.length);
    const cRed = new T.Color('#e8382f'), cYel = new T.Color('#ffd400');
    floats.forEach(([x, s, k], n) => {
      dummy.position.set(x, 0.05, -s); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(1); dummy.updateMatrix();
      fl.setMatrixAt(n, dummy.matrix);
      fl.setColorAt(n, k ? cRed : cYel);
    });
    root.add(fl);
    // little stone posts between the lanes on land
    const posts = [];
    for (let i = 0; i <= NL; i++) for (const [s0, s1] of [[0, W0 - 3], [W1 + 3, L]]) for (let s = s0; s <= s1; s += 6) posts.push([laneX(i) - LW / 2, s]);
    const pm = new T.InstancedMesh(new T.BoxGeometry(0.3, 0.5, 0.3), lam('#b8b0a0'), posts.length);
    posts.forEach(([x, s], n) => { dummy.position.set(x, LAND_Y + 0.25, -s); dummy.updateMatrix(); pm.setMatrixAt(n, dummy.matrix); });
    root.add(pm);
    // bigger waves in the last stretch of river
    for (let k = 0; k < 40; k++) {
      const w = mesh(new T.BoxGeometry(rand(3, 6), 0.18, 0.5), new T.MeshLambertMaterial({ color: '#e8fbff', transparent: true, opacity: 0.8 }), rand(-HALF, HALF), 0.05, -rand(288, 362));
      waves.push({ m: w, ph: rand(0, 6), z: w.position.z });
    }
  }

  function instanced(geo, m, list, colorOf) {
    const im = new T.InstancedMesh(geo, m, list.length);
    list.forEach((o, n) => {
      dummy.position.set(o.x, o.y, o.z);
      dummy.rotation.set(o.rx || 0, o.ry || 0, 0);
      dummy.scale.set(o.sx || o.sc || 1, o.sy || o.sc || 1, o.sz || o.sc || 1);
      dummy.updateMatrix();
      im.setMatrixAt(n, dummy.matrix);
      if (colorOf) im.setColorAt(n, new T.Color(colorOf(o, n)));
    });
    root.add(im);
    return im;
  }

  function scenery() {
    const side = (k) => (k % 2 ? 1 : -1) * (HALF + rand(5, 40));
    // the village gate behind the start line: a red paifang with lanterns
    gate(-2.5, '#d8261c', false);
    // trees along the banks and meadow: willows by the water, round trees elsewhere
    const trees = [];
    for (let k = 0; k < 120; k++) {
      const s = rand(-30, W1 + 10);
      trees.push({ x: side(k), s, h: rand(3, 5.5), c: s > W0 && s < W1 ? '#6fbf4a' : '#4fa84a' });
    }
    instanced(new T.BoxGeometry(0.5, 1, 0.5), lam('#8a5a36'), trees.map((t) => ({ x: t.x, y: LAND_Y + t.h / 2, z: -t.s, sy: t.h })));
    instanced(new T.SphereGeometry(1, 8, 6), lam('#ffffff'), trees.map((t) => ({ x: t.x, y: LAND_Y + t.h + 1.2, z: -t.s, sx: 2.2, sy: 1.8, sz: 2.2 })), (o, n) => trees[n].c);
    // peach blossom trees on the meadow
    const blossom = [];
    for (let k = 0; k < 24; k++) blossom.push({ x: side(k), y: 4.4, z: -rand(-25, W0 - 4), sx: 2, sy: 1.6, sz: 2 });
    instanced(new T.SphereGeometry(1, 8, 6), lam('#ffb3d1'), blossom);
    // flowers in the meadow
    const flowers = [];
    for (let k = 0; k < 260; k++) flowers.push({ x: rand(-HALF - 30, HALF + 30), y: LAND_Y + 0.12, z: -rand(-20, W0 - 4), sc: 0.25 });
    instanced(new T.BoxGeometry(1, 1, 1), lam('#ffffff'), flowers.filter((f) => Math.abs(((f.x + HALF) % LW + LW) % LW - LW / 2) > 1.6), () => Kit.gfx.pick(['#ff6b8a', '#ffd400', '#ffffff', '#b28cff']));
    // the lotus pond: big green leaves and pink flowers between the lanes and by the sides
    const pads = [], lotus = [];
    for (let k = 0; k < 220; k++) {
      const s = rand(127, 203);
      const x = k % 3 ? laneX(Math.floor(rand(0, NL + 1))) - LW / 2 + rand(-0.4, 0.4) : (k % 2 ? 1 : -1) * (HALF + rand(0.5, 2.5));
      pads.push({ x, y: 0.02, z: -s, sx: rand(0.7, 1.1), sy: 1, sz: rand(0.7, 1.1) });
      if (k % 4 === 0) lotus.push({ x: x + 0.2, y: 0.25, z: -s, sc: 0.32 });
    }
    instanced(new T.CylinderGeometry(1, 1, 0.06, 10), lam('#3f9a3a'), pads);
    instanced(new T.ConeGeometry(1, 1.6, 6), lam('#ff8fc0'), lotus);
    // reeds along the river's sides
    const reeds = [];
    for (let k = 0; k < 200; k++) reeds.push({ x: (k % 2 ? 1 : -1) * (HALF + rand(1, 3)), y: 0.6, z: -rand(W0, W1), sx: 0.12, sy: rand(1, 1.8), sz: 0.12 });
    instanced(new T.BoxGeometry(1, 1, 1), lam('#6a9a3a'), reeds);
    // bamboo groves on the far bank
    const bamboo = [];
    for (let k = 0; k < 260; k++) bamboo.push({ x: (k % 2 ? 1 : -1) * (HALF + rand(1.5, 22)), y: 4, z: -rand(W1 + 4, L + 10), sx: 0.25, sy: 8, sz: 0.25 });
    instanced(new T.CylinderGeometry(1, 1, 1, 6), lam('#6cbf3a'), bamboo);
    const leaves = bamboo.filter((b, k) => k % 2 === 0).map((b) => ({ x: b.x, y: 7.6, z: b.z, sx: 1.4, sy: 0.9, sz: 1.4 }));
    instanced(new T.SphereGeometry(1, 6, 4), lam('#4f9a2a'), leaves);
    // stone lanterns along the bamboo path
    for (const s of [W1 + 14, W1 + 34, W1 + 54]) for (const x of [-HALF - 1.5, HALF + 1.5]) stoneLantern(x, s);
    // far mountains, misty green
    for (let k = 0; k < 26; k++) {
      const m = mesh(new T.ConeGeometry(rand(14, 26), rand(30, 60), 6), lam(k % 2 ? '#7fae8a' : '#93bfa0'), (k % 2 ? 1 : -1) * rand(HALF + 50, HALF + 130), 0, -rand(-60, L + 80));
      m.position.y = m.geometry.parameters.height / 2 - 2;
    }
    // clouds in the sky
    for (let k = 0; k < 24; k++) {
      const c = ZR.animals.cloud();
      c.root.position.set(rand(-120, 120), rand(26, 46), -rand(-40, L + 120));
      c.root.scale.setScalar(rand(2.5, 5));
      root.add(c.root);
    }
  }

  function stoneLantern(x, s) {
    const g = new T.Group();
    const st = lam('#b8b0a0');
    mesh(new T.BoxGeometry(0.8, 0.3, 0.8), st, 0, 0.15, 0, g);
    mesh(new T.BoxGeometry(0.3, 1.2, 0.3), st, 0, 0.9, 0, g);
    mesh(new T.BoxGeometry(0.8, 0.6, 0.8), lam('#ffd27a', { emissive: '#ff9a1f', emissiveIntensity: 0.4 }), 0, 1.8, 0, g);
    mesh(new T.ConeGeometry(0.75, 0.5, 4), st, 0, 2.35, 0, g).rotation.y = Math.PI / 4;
    g.position.set(x, LAND_Y, -s);
    root.add(g);
  }

  // a red gate (paifang) across all the lanes at s, with lanterns; with a banner when it's the finish
  function gate(s, color, withBanner) {
    const g = new T.Group();
    const red = lam(color), gold = lam('#ffc21a'), roof = lam('#2a6b5a');
    const span = HALF * 2;
    // the pillars stand on lane edges, so no animal runs into one
    for (const x of [-span / 2, -span / 6, span / 6, span / 2]) mesh(new T.BoxGeometry(0.6, 9, 0.6), red, x, 4.5, 0, g);
    mesh(new T.BoxGeometry(span + 2, 0.8, 1.2), red, 0, 8.2, 0, g);
    mesh(new T.BoxGeometry(span + 3, 0.4, 1.6), gold, 0, 8.8, 0, g);
    mesh(new T.BoxGeometry(span + 5, 0.5, 2.6), roof, 0, 9.3, 0, g);
    for (const s2 of [-1, 1]) { const e = mesh(new T.BoxGeometry(2, 0.4, 2.6), roof, s2 * (span / 2 + 2.6), 9.7, 0, g); e.rotation.z = s2 * 0.35; }
    // lanterns
    const lgeo = new T.SphereGeometry(0.55, 10, 8), lm = lam('#e8382f', { emissive: '#ff3a1a', emissiveIntensity: 0.35 });
    for (let k = 0; k < NL; k++) {
      const l = mesh(lgeo, lm, laneX(k), 7.2, 0, g);
      l.scale.y = 1.2;
      mesh(new T.BoxGeometry(0.05, 0.6, 0.05), gold, laneX(k), 7.9, 0, g);
      mesh(new T.CylinderGeometry(0.2, 0.2, 0.15, 8), gold, laneX(k), 6.5, 0, g);
    }
    if (withBanner) {
      banner = mesh(new T.PlaneGeometry(16, 4), new T.MeshBasicMaterial({ map: bannerTexture(Kit.lang.t('FINISH')), fog: false }), 0, 10.9, 0.05, g);
      mesh(new T.BoxGeometry(16.6, 4.6, 0.3), gold, 0, 10.9, -0.15, g);
    }
    g.position.set(0, LAND_Y, -s);
    root.add(g);
    return g;
  }

  let emperor = null;
  function palace() {
    gate(L, '#d8261c', true);
    // the courtyard: white jade flagstones
    const yard = mesh(new T.PlaneGeometry(HALF * 2 + 16, 40), lam('#efe8d8'), 0, LAND_Y + 0.02, -(L + 22));
    yard.rotation.x = -Math.PI / 2;
    // the palace hall: steps, red pillars, two golden roofs
    const g = new T.Group();
    g.position.set(0, LAND_Y, -(L + 46));
    root.add(g);
    for (let k = 0; k < 4; k++) mesh(new T.BoxGeometry(44 - k * 3, 0.6, 14 - k * 1.2), lam('#f4efe4'), 0, 0.3 + k * 0.6, 0, g);
    const red = lam('#c8261c'), gold = lam('#ffc21a');
    mesh(new T.BoxGeometry(30, 9, 9), red, 0, 7, -1, g);
    for (let k = 0; k < 8; k++) mesh(new T.CylinderGeometry(0.6, 0.6, 9, 10), lam('#e0301f'), -14 + k * 4, 6.9, 3.8, g);
    for (const [y, w, d] of [[12, 38, 15], [16.5, 28, 11]]) {
      mesh(new T.BoxGeometry(w, 0.8, d), gold, 0, y, -1, g);
      const r = mesh(new T.CylinderGeometry(0.1, w * 0.5, 3, 4, 1), gold, 0, y + 1.9, -1, g);
      r.rotation.y = Math.PI / 4;
      r.scale.z = d / w;
      if (y < 14) mesh(new T.BoxGeometry(24, 3, 7), red, 0, y + 2.2, -1, g);
    }
    // the Jade Emperor on his throne, waiting at the top of the courtyard
    emperor = ZR.animals.emperor();
    emperor.root.position.set(0, LAND_Y, -(L + 30));
    emperor.root.scale.setScalar(1.4);
    root.add(emperor.root);
    // clouds round the palace: it's in the sky
    for (let k = 0; k < 14; k++) {
      const c = ZR.animals.cloud();
      c.root.position.set((k % 2 ? 1 : -1) * rand(HALF + 4, HALF + 30), rand(1, 8), -(L + rand(10, 70)));
      c.root.scale.setScalar(rand(2, 4));
      root.add(c.root);
    }
  }

  // ---------------------------------------------------------------- a race's things in every lane
  function build(race) {
    if (itemsRoot) { root.remove(itemsRoot); itemsRoot.traverse((o) => { if (o.isInstancedMesh) o.dispose(); }); }
    itemsRoot = new T.Group();
    root.add(itemsRoot);
    const rocks = [], logs = [], whirls = [], peaches = [];
    for (let lane = 0; lane < NL; lane++) {
      const mirror = lane % 2 ? -1 : 1;
      for (const it of race.course) {
        const x = laneX(lane) + spotX(it.spot * mirror), z = -it.s, gy = groundY(it.s);
        if (it.kind === 'rock') rocks.push({ x, y: gy + (gy > 0 ? 0.35 : 0.2), z, sx: 0.95, sy: 1.2, sz: 0.95, ry: it.id });
        else if (it.kind === 'log') logs.push({ x: laneX(lane), y: 0.15, z, rz: 0 });
        else if (it.kind === 'whirl') whirls.push({ x, z, lane, id: it.id });
        else peaches.push({ x, y: gy + 0.6, z, lane, id: it.id, ph: Math.random() * 6 });
      }
    }
    const rm = instanced(new T.DodecahedronGeometry(0.9, 0), lam('#8f8a86', { flatShading: true }), rocks);
    itemsRoot.add(rm);
    const lg = new T.CylinderGeometry(0.38, 0.38, LW - 0.4, 10);
    lg.rotateZ(Math.PI / 2);
    itemsRoot.add(instanced(lg, lam('#8a5a30'), logs));
    whirlTex = whirlTex || spiralTexture();
    whirlMesh = new T.InstancedMesh(new T.CircleGeometry(1.1, 20).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ map: whirlTex, transparent: true, depthWrite: false, color: '#dff8ff' }), Math.max(1, whirls.length));
    whirlMesh.count = whirls.length;
    whirlList = whirls;
    itemsRoot.add(whirlMesh);
    // peaches: a pink-orange ball with a green leaf
    peachList = peaches;
    peachMesh = new T.InstancedMesh(new T.SphereGeometry(0.36, 10, 8), lam('#ffa07a', { emissive: '#ff6b5a', emissiveIntensity: 0.25 }), Math.max(1, peaches.length));
    peachLeaf = new T.InstancedMesh(new T.BoxGeometry(0.28, 0.05, 0.14), lam('#3f9a3a'), Math.max(1, peaches.length));
    peachMesh.count = peachLeaf.count = peaches.length;
    itemsRoot.add(peachMesh, peachLeaf);
  }

  function hidePeach(lane, id) {
    const p = peachList.find((o) => o.lane === lane && o.id === id);
    if (p) p.hidden = true;
  }

  function burst(pos, color, n, speed, up) {
    let made = 0;
    for (const p of particles) {
      if (p.life > 0) continue;
      p.life = p.max = rand(0.45, 0.85);
      p.s.position.copy(pos);
      p.v.set(rand(-1, 1) * speed, rand(0.4, 1) * (up || speed), rand(-1, 1) * speed);
      p.s.material.color.set(color);
      p.s.scale.setScalar(rand(0.3, 0.55));
      p.s.visible = true;
      if (++made >= n) break;
    }
  }

  function update(dt) {
    clock += dt;
    if (waterTex) waterTex.offset.set(Math.sin(clock * 0.3) * 0.02, -clock * 0.05);
    if (fastTex) fastTex.offset.set(0, -clock * 0.9);
    for (const w of waves) {
      w.m.position.y = 0.05 + Math.sin(clock * 1.6 + w.ph) * 0.25;
      w.m.position.z = w.z + Math.sin(clock * 0.5 + w.ph) * 1.5;
    }
    if (peachMesh) {
      peachList.forEach((p, n) => {
        if (p.hidden) dummy.position.set(0, -50, 0);
        else dummy.position.set(p.x, p.y + Math.sin(clock * 3 + p.ph) * 0.15, p.z);
        dummy.rotation.set(0, clock * 1.4 + p.ph, 0);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        peachMesh.setMatrixAt(n, dummy.matrix);
        dummy.position.y += 0.36;
        dummy.updateMatrix();
        peachLeaf.setMatrixAt(n, dummy.matrix);
      });
      peachMesh.instanceMatrix.needsUpdate = peachLeaf.instanceMatrix.needsUpdate = true;
    }
    if (whirlMesh) {
      whirlList.forEach((w, n) => {
        dummy.position.set(w.x, 0.03, w.z);
        dummy.rotation.set(0, -clock * 3, 0);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        whirlMesh.setMatrixAt(n, dummy.matrix);
      });
      whirlMesh.instanceMatrix.needsUpdate = true;
    }
    for (const p of particles) {
      if (p.life <= 0) continue;
      p.life -= dt;
      p.v.y -= 9 * dt;
      p.s.position.addScaledVector(p.v, dt);
      p.s.material.opacity = Math.max(0, p.life / p.max);
      if (p.life <= 0 || p.s.position.y < -0.6) { p.life = 0; p.s.visible = false; }
    }
  }

  function render(views) {
    if ((window.innerWidth || 1) !== W || (window.innerHeight || 1) !== H) resize(); // a turned iPad, before its resize event
    for (const v of views) {
      const y = H - v.y - v.h;
      renderer.setViewport(v.x, y, v.w, v.h);
      renderer.setScissor(v.x, y, v.w, v.h);
      v.cam.aspect = v.w / Math.max(1, v.h);
      v.cam.updateProjectionMatrix();
      sky.position.copy(v.cam.position); // the sky goes wherever the camera goes
      renderer.render(scene, v.cam);
    }
  }

  function resize() {
    W = window.innerWidth || 1;
    H = window.innerHeight || 1;
    if (renderer) renderer.setSize(W, H, false);
  }

  function relabel() {
    if (banner) { banner.material.map = bannerTexture(Kit.lang.t('FINISH')); banner.material.needsUpdate = true; }
  }

  ZR.world = {
    init, build, update, render, resize, relabel, burst, hidePeach, laneX, spotX, groundY, wetness, LW, SPOT, NL, LAND_Y,
    scene: () => scene, add: (o) => root.add(o), remove: (o) => root.remove(o), size: () => ({ W, H }), emperor: () => emperor,
    newCamera: () => new T.PerspectiveCamera(55, 1, 0.3, 700),
    toScreen(v, view) {
      const p = v.clone().project(view.cam);
      return { x: view.x + (p.x * 0.5 + 0.5) * view.w, y: view.y + (-p.y * 0.5 + 0.5) * view.h, behind: p.z > 1 };
    },
  };
})();
