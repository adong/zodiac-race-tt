/* TT Zodiac Race: the twelve animals as blocky toys, plus Foxy and Froggy (the CPU friends who ride along), the Jade
   Emperor on his throne, the brother's lucky cloud and the goat's raft. Every animal faces -z like the kit's people,
   about 2 m long, big enough to ride: `seat` is where a rider sits.
     ZR.animals.build(id)            -> { root, lift, seat, update(dt, st) }   st: { t, speed, water, air, mode }
     ZR.animals.critter('fox'|'frog') -> { root, update(dt, mode) }
     ZR.animals.emperor() / cloud() / raft() */
(function () {
  'use strict';
  const T = THREE;
  const ZR = window.ZR;

  const mats = {};
  function mat(color, o) {
    const key = color + JSON.stringify(o || {});
    if (!mats[key]) mats[key] = new T.MeshLambertMaterial(Object.assign({ color }, o || {}));
    return mats[key];
  }
  const geos = {};
  function boxGeo(w, h, d) {
    const k = `${w.toFixed(3)},${h.toFixed(3)},${d.toFixed(3)}`;
    return geos[k] || (geos[k] = new T.BoxGeometry(w, h, d));
  }
  function box(w, h, d, color, x, y, z, parent) {
    const m = new T.Mesh(boxGeo(w, h, d), typeof color === 'string' ? mat(color) : color);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }
  function group(parent, x, y, z) {
    const g = new T.Group();
    g.position.set(x || 0, y || 0, z || 0);
    if (parent) parent.add(g);
    return g;
  }
  const INK = '#1b1a22', WHITE = '#ffffff';

  // two eyes with a shine, on the front (-z) face of a head of half-width hw at depth zf
  function eyes(head, hw, y, zf, gap, size) {
    for (const s of [-1, 1]) {
      box(size, size * 1.15, 0.04, INK, s * gap, y, zf, head);
      box(size * 0.35, size * 0.35, 0.02, WHITE, s * gap - size * 0.18, y + size * 0.22, zf - 0.025, head);
    }
  }

  // ---------------------------------------------------------------- four legs and a body
  const QUADS = {
    rat: { color: '#9aa0ad', belly: '#d9dce3', body: [0.95, 0.75, 1.5], legH: 0.38, legW: 0.22, head: [0.62, 0.55, 0.6], snout: [0.32, 0.26, 0.3, '#c9ccd4'], nose: '#ff8fab', ears: 'roundBig', inner: '#ffb3c7', tail: 'thin', tailColor: '#ffb3c7', whiskers: true },
    ox: { color: '#8a5a36', belly: '#b98a62', body: [1.3, 1.05, 2.1], legH: 0.62, legW: 0.32, head: [0.82, 0.74, 0.7], snout: [0.7, 0.42, 0.26, '#e0b993'], nose: '#5a3a22', ears: 'side', horns: 'ox', tail: 'tuft', hooves: '#3a2a20' },
    tiger: { color: '#ff9a1f', belly: '#fff4e0', body: [1.0, 0.85, 1.9], legH: 0.55, legW: 0.28, head: [0.86, 0.76, 0.7], snout: [0.5, 0.3, 0.2, '#fff4e0'], nose: '#ff6b8a', ears: 'round', inner: '#2a1a10', tail: 'long', stripes: '#2a1a10', brow: true },
    rabbit: { color: '#f4efe8', belly: '#ffffff', body: [0.9, 0.85, 1.3], legH: 0.42, legW: 0.26, head: [0.66, 0.62, 0.6], snout: [0.3, 0.22, 0.14, '#ffffff'], nose: '#ff8fab', ears: 'long', inner: '#ffb3c7', tail: 'puff', teeth: true },
    horse: { color: '#b5733e', belly: '#c98c58', body: [0.95, 0.95, 2.1], legH: 0.95, legW: 0.26, head: [0.52, 0.58, 1.0], snout: [0.5, 0.36, 0.3, '#8a5530'], nose: '#3a2418', ears: 'point', inner: '#8a5530', tail: 'horse', mane: '#3a2418', neck: true, hooves: '#2a1a12' },
    goat: { color: '#efe9dc', belly: '#ffffff', body: [0.95, 0.85, 1.6], legH: 0.72, legW: 0.22, head: [0.56, 0.6, 0.72], snout: [0.42, 0.3, 0.2, '#e2d8c4'], nose: '#8a6a5a', ears: 'flop', inner: '#ffc9c9', horns: 'goat', tail: 'stub', beard: true, hooves: '#5a4a40' },
    monkey: { color: '#9a6a3f', belly: '#e7c49b', body: [0.8, 0.8, 1.25], legH: 0.55, legW: 0.22, head: [0.72, 0.68, 0.62], face: '#f0d2aa', ears: 'cup', inner: '#e7c49b', tail: 'curl' },
    dog: { color: '#d9a066', belly: '#fff1dc', body: [0.92, 0.8, 1.6], legH: 0.6, legW: 0.25, head: [0.72, 0.66, 0.68], snout: [0.46, 0.32, 0.34, '#fff1dc'], nose: INK, ears: 'floppy', inner: '#8a5a30', tail: 'wag', tongue: true, collar: '#e8382f' },
    pig: { color: '#ffb3c7', belly: '#ffc9d6', body: [1.15, 0.98, 1.6], legH: 0.4, legW: 0.3, head: [0.86, 0.78, 0.6], disc: '#ff8fab', ears: 'pig', inner: '#ff8fab', tail: 'curly', hooves: '#e07a96' },
  };

  function quad(o) {
    const root = group();
    const lift = group(root);           // jumps and swimming move this up and down
    const body = group(lift);           // the trot bob
    const [w, h, len] = o.body;
    const by = o.legH + h / 2;
    box(w, h, len, o.color, 0, by, 0, body);
    if (o.belly) box(w * 0.7, 0.06, len * 0.75, o.belly, 0, by - h / 2 - 0.01, 0, body);
    if (o.stripes) {
      for (let k = 0; k < 5; k++) {
        const z = -len * 0.38 + k * len * 0.19;
        box(w + 0.02, 0.1, 0.12, o.stripes, 0, by + h * 0.3, z, body);
        for (const s of [-1, 1]) box(0.02, h * 0.55, 0.12, o.stripes, s * (w / 2 + 0.005), by + 0.04, z + 0.04, body);
      }
    }
    if (o.collar) {
      box(w * 0.75, 0.14, 0.14, o.collar, 0, by + h * 0.25, -len / 2 + 0.08, body);
      box(0.14, 0.14, 0.04, '#ffd400', 0, by + h * 0.1, -len / 2 - 0.02, body);
    }
    // legs, pivoting at the hip
    const legs = [];
    for (const front of [1, -1]) {
      for (const s of [-1, 1]) {
        const g = group(body, s * (w / 2 - o.legW / 2 - 0.02), o.legH + 0.06, front * -(len / 2 - o.legW / 2 - 0.08));
        box(o.legW, o.legH + 0.08, o.legW, o.color, 0, -o.legH / 2, 0, g);
        if (o.hooves) box(o.legW + 0.02, 0.14, o.legW + 0.02, o.hooves, 0, -o.legH + 0.03, 0, g);
        legs.push({ g, s, front, ph: (front > 0 ? 0 : Math.PI) + (s > 0 ? Math.PI : 0) * 0.5 });
      }
    }
    // the head
    const [hw, hh, hd] = o.head;
    let headParent = body, hy = by + h * 0.35, hz = -len / 2 - hd * 0.3;
    if (o.neck) {
      const neck = group(body, 0, by + h * 0.25, -len / 2 + 0.15);
      neck.rotation.x = 0.6;
      box(0.42, 0.95, 0.48, o.color, 0, 0.42, -0.05, neck);
      if (o.mane) box(0.14, 1.0, 0.2, o.mane, 0, 0.5, 0.24, neck);
      headParent = neck; hy = 0.9; hz = -0.25;
    }
    const head = group(headParent, 0, hy, hz);
    if (o.neck) head.rotation.x = -0.6;
    box(hw, hh, hd, o.face && !o.snout ? o.color : o.color, 0, 0, 0, head);
    const zf = -hd / 2 - 0.01;
    if (o.face) {
      box(hw * 0.78, hh * 0.7, 0.06, o.face, 0, -hh * 0.08, zf, head);
      eyes(head, hw, hh * 0.08, zf - 0.04, hw * 0.2, 0.11);
      box(0.2, 0.05, 0.02, INK, 0, -hh * 0.28, zf - 0.04, head);
    } else {
      eyes(head, hw, hh * 0.15, zf, hw * 0.24, Math.min(0.13, hw * 0.18));
    }
    if (o.snout) {
      const [sw, sh, sd, sc] = o.snout;
      const sn = box(sw, sh, sd, sc, 0, -hh * 0.22, zf - sd / 2 + 0.02, head);
      if (o.nose) box(Math.min(0.22, sw * 0.5), 0.1, 0.06, o.nose, 0, -hh * 0.22 + sh * 0.3, zf - sd + 0.01, head);
      if (o.tongue) box(0.14, 0.04, 0.2, '#ff6b8a', 0.06, -hh * 0.22 - sh / 2 - 0.01, zf - sd * 0.6, head);
      if (o.teeth) box(0.12, 0.1, 0.03, WHITE, 0, -hh * 0.22 - sh / 2 - 0.03, zf - sd + 0.02, head);
      void sn;
    }
    if (o.disc) {
      box(0.44, 0.34, 0.14, o.disc, 0, -hh * 0.18, zf - 0.06, head);
      for (const s of [-1, 1]) box(0.07, 0.11, 0.02, '#c25a78', s * 0.09, -hh * 0.18, zf - 0.14, head);
    }
    if (o.brow) { // the tiger's forehead stripes
      for (const y of [0.18, 0.28]) box(0.3, 0.05, 0.02, o.stripes, 0, hh * y + 0.05, zf - 0.005, head);
      box(0.05, 0.16, 0.02, o.stripes, 0, hh * 0.23 + 0.05, zf - 0.01, head);
    }
    if (o.whiskers) for (const s of [-1, 1]) for (const dy of [0, 0.06]) box(0.42, 0.015, 0.015, WHITE, s * 0.28, -hh * 0.2 + dy, zf - 0.22, head);
    const ears = [];
    for (const s of [-1, 1]) {
      let e;
      switch (o.ears) {
        case 'roundBig': e = group(head, s * hw * 0.42, hh * 0.5, 0.05); box(0.34, 0.32, 0.06, o.color, 0, 0.12, 0, e); box(0.22, 0.2, 0.02, o.inner, 0, 0.12, -0.04, e); break;
        case 'round': e = group(head, s * hw * 0.38, hh * 0.5, 0.08); box(0.24, 0.22, 0.1, o.color, 0, 0.06, 0, e); box(0.14, 0.12, 0.02, o.inner, 0, 0.06, -0.06, e); break;
        case 'long': e = group(head, s * hw * 0.22, hh * 0.5, 0.06); box(0.16, 0.62, 0.1, o.color, 0, 0.3, 0, e); box(0.08, 0.46, 0.02, o.inner, 0, 0.3, -0.06, e); e.rotation.z = -s * 0.12; break;
        case 'point': e = group(head, s * hw * 0.32, hh * 0.5, 0.25); box(0.12, 0.24, 0.1, o.color, 0, 0.1, 0, e); break;
        case 'side': e = group(head, s * (hw / 2 + 0.1), hh * 0.2, 0.1); box(0.26, 0.12, 0.12, o.color, s * 0.06, 0, 0, e); break;
        case 'flop': e = group(head, s * (hw / 2 + 0.04), hh * 0.25, 0.1); box(0.24, 0.1, 0.14, o.color, s * 0.1, -0.04, 0, e); e.rotation.z = s * -0.5; break;
        case 'cup': e = group(head, s * (hw / 2 + 0.05), hh * 0.08, 0.05); box(0.12, 0.24, 0.2, o.color, 0, 0, 0, e); box(0.02, 0.16, 0.12, o.inner, s * -0.06, 0, 0, e); break;
        case 'floppy': e = group(head, s * (hw / 2 + 0.03), hh * 0.4, 0.06); box(0.12, 0.42, 0.26, o.inner, 0, -0.2, 0, e); e.rotation.z = s * 0.15; break;
        case 'pig': e = group(head, s * hw * 0.32, hh * 0.5, 0.05); box(0.22, 0.2, 0.06, o.color, 0, 0.08, 0, e); e.rotation.x = -0.5; break;
      }
      ears.push(e);
    }
    if (o.horns === 'ox') for (const s of [-1, 1]) {
      const g = group(head, s * hw * 0.42, hh * 0.45, 0.05);
      box(0.3, 0.12, 0.12, '#f3e6c8', s * 0.12, 0, 0, g);
      box(0.12, 0.26, 0.12, '#f3e6c8', s * 0.24, 0.14, 0, g);
    }
    if (o.horns === 'goat') for (const s of [-1, 1]) {
      const g = group(head, s * hw * 0.2, hh * 0.5, 0.05);
      g.rotation.x = 0.9;
      box(0.1, 0.36, 0.12, '#9a9088', 0, 0.16, 0, g);
      box(0.1, 0.12, 0.2, '#9a9088', 0, 0.32, 0.08, g);
    }
    if (o.beard) box(0.14, 0.24, 0.1, WHITE, 0, -hh / 2 - 0.1, zf - 0.1, head);
    // the tail
    const tail = group(body, 0, by + h * 0.25, len / 2);
    const tc = o.tailColor || o.color;
    switch (o.tail) {
      case 'thin': for (let k = 0; k < 4; k++) box(0.07, 0.07, 0.32, tc, 0, -0.06 * k + 0.02 * k * k, 0.16 + k * 0.28, tail); break;
      case 'tuft': box(0.08, 0.6, 0.08, o.color, 0, -0.3, 0.06, tail); box(0.16, 0.2, 0.16, INK, 0, -0.62, 0.06, tail); break;
      case 'long': tail.rotation.x = -0.7; for (let k = 0; k < 4; k++) box(0.12, 0.12, 0.3, k % 2 ? o.stripes : o.color, 0, 0, 0.15 + k * 0.28, tail); break;
      case 'puff': box(0.3, 0.3, 0.24, WHITE, 0, 0, 0.08, tail); break;
      case 'horse': tail.rotation.x = 0.4; box(0.18, 0.8, 0.18, o.mane, 0, -0.38, 0.12, tail); break;
      case 'stub': box(0.12, 0.2, 0.1, o.color, 0, 0.08, 0.04, tail); break;
      case 'curl': box(0.1, 0.1, 0.5, o.color, 0, 0.05, 0.25, tail); box(0.1, 0.6, 0.1, o.color, 0, 0.35, 0.5, tail); box(0.1, 0.1, 0.3, o.color, 0, 0.62, 0.38, tail); break;
      case 'wag': tail.rotation.x = -0.9; box(0.12, 0.12, 0.5, o.color, 0, 0, 0.22, tail); box(0.13, 0.13, 0.14, o.belly, 0, 0, 0.46, tail); break;
      case 'curly': box(0.08, 0.08, 0.16, o.color, 0, 0, 0.08, tail); box(0.08, 0.16, 0.08, o.color, 0, 0.08, 0.16, tail); box(0.08, 0.08, 0.14, o.color, 0, 0.16, 0.1, tail); break;
    }
    const seat = group(body, 0, by + h / 2, len * 0.04);
    return { root, lift, body, legs, head, ears, tail, seat, swimSink: Math.min(0.75, by), kind: 'quad', o };
  }

  // ---------------------------------------------------------------- the long ones: snake and dragon
  function chain(o) {
    const root = group();
    const lift = group(root);
    const body = group(lift);
    const segs = [];
    for (let k = 0; k < o.n; k++) {
      const r = o.r * (k < 2 ? 1 : 1 - (k - 2) / (o.n + 2));
      const g = group(body, 0, o.y, -0.9 + k * o.gap);
      box(r * 2, r * 1.8, o.gap + 0.08, k % 2 && o.alt ? o.alt : o.color, 0, 0, 0, g);
      box(r * 1.5, 0.06, o.gap, o.belly, 0, -r * 0.9 - 0.02, 0, g);
      if (o.spikes && k < o.n - 1) box(0.08, 0.26, 0.24, o.spikes, 0, r * 0.9 + 0.1, 0, g);
      if (o.dragon && (k === 1 || k === o.n - 3)) {
        for (const s of [-1, 1]) {
          const leg = group(g, s * r * 0.9, -r * 0.5, 0);
          box(0.16, 0.5, 0.16, o.color, 0, -0.22, 0, leg);
          box(0.24, 0.08, 0.28, o.horn, 0, -0.48, -0.06, leg);
          segs.legs = (segs.legs || []).concat([{ g: leg, s, ph: k * 1.3 + (s > 0 ? Math.PI : 0) }]);
        }
      }
      segs.push(g);
    }
    if (o.fin) box(0.06, 0.5, 0.5, o.fin, 0, 0.1, 0.2, segs[o.n - 1]);
    const head = group(body, 0, o.y + 0.08, -0.9 - o.gap * 0.5 - o.head[2] / 2 + 0.1);
    const [hw, hh, hd] = o.head;
    box(hw, hh, hd, o.color, 0, 0, 0, head);
    const zf = -hd / 2 - 0.01;
    eyes(head, hw, hh * 0.18, zf, hw * 0.26, o.dragon ? 0.13 : 0.1);
    if (o.dragon) {
      box(hw * 0.8, hh * 0.45, 0.3, o.color, 0, -hh * 0.22, zf - 0.13, head);       // the long snout
      box(hw * 0.7, 0.06, 0.3, o.belly, 0, -hh * 0.48, zf - 0.13, head);
      for (const s of [-1, 1]) {
        box(0.08, 0.08, 0.06, INK, s * 0.12, -hh * 0.08, zf - 0.29, head);           // nostrils
        const h1 = group(head, s * hw * 0.3, hh * 0.5, 0.1);                         // antlers
        h1.rotation.x = 0.5;
        box(0.08, 0.5, 0.08, o.horn, 0, 0.22, 0, h1);
        box(0.2, 0.07, 0.07, o.horn, s * 0.08, 0.34, 0, h1);
        const wh = group(head, s * hw * 0.42, -hh * 0.2, zf - 0.22);                  // whiskers
        box(0.6, 0.04, 0.04, o.whisker, s * 0.3, -0.05, 0, wh);
        wh.rotation.z = s * -0.4;
        box(0.06, 0.3, 0.3, o.spikes, s * (hw / 2 + 0.03), 0, 0.12, head);         // red mane at the cheeks
      }
      box(hw * 0.6, 0.06, 0.06, WHITE, 0, -hh * 0.42, zf - 0.27, head);              // teeth
    } else {
      const tongue = group(head, 0, -hh * 0.25, zf);
      box(0.05, 0.03, 0.3, '#e8382f', 0, 0, -0.15, tongue);
      for (const s of [-1, 1]) box(0.03, 0.03, 0.1, '#e8382f', s * 0.03, 0, -0.33, tongue);
      head.userData.tongue = tongue;
    }
    if (o.pattern) for (let k = 1; k < o.n - 1; k += 2) box(0.2, 0.04, 0.2, o.pattern, 0, o.r * 0.9 + 0.005, 0, segs[k]);
    const seat = group(segs[1], 0, o.r * 0.9, 0);
    return { root, lift, body, segs, head, seat, legs: segs.legs || [], swimSink: o.y * 0.7, kind: 'chain', o };
  }

  // ---------------------------------------------------------------- the rooster: two legs and wings
  function rooster() {
    const root = group();
    const lift = group(root);
    const body = group(lift);
    const by = 1.0;
    box(0.95, 0.9, 1.2, '#f6f1e7', 0, by, 0, body);
    box(0.7, 0.6, 0.5, '#f6f1e7', 0, by + 0.25, -0.65, body); // the breast
    const head = group(body, 0, by + 0.8, -0.65);
    box(0.5, 0.55, 0.5, '#f6f1e7', 0, 0, 0, head);
    eyes(head, 0.5, 0.06, -0.26, 0.15, 0.09);
    box(0.24, 0.12, 0.26, '#ffb02e', 0, -0.06, -0.36, head);                      // beak
    box(0.12, 0.22, 0.08, '#e8382f', 0, -0.28, -0.26, head);                      // wattle
    for (let k = 0; k < 3; k++) box(0.1, 0.22 - k * 0.03, 0.14, '#e8382f', 0, 0.36 - k * 0.02, -0.12 + k * 0.13, head); // comb
    const wings = [];
    for (const s of [-1, 1]) {
      const g = group(body, s * 0.5, by + 0.25, 0);
      box(0.08, 0.6, 0.9, '#e9e1d2', 0, -0.25, 0.05, g);
      wings.push({ g, s });
    }
    const tail = group(body, 0, by + 0.2, 0.55);
    const fc = ['#1f6b4a', '#2a2a3a', '#ff7a1a', '#1f6b4a', '#2a2a3a'];
    fc.forEach((c, k) => {
      const f = group(tail, (k - 2) * 0.12, 0, 0);
      f.rotation.x = -0.5 - Math.abs(k - 2) * 0.15;
      f.rotation.z = (k - 2) * 0.2;
      box(0.1, 0.9, 0.16, c, 0, 0.45, 0, f);
    });
    const legs = [];
    for (const s of [-1, 1]) {
      const g = group(body, s * 0.25, by - 0.42, 0);
      box(0.1, 0.62, 0.1, '#ffb02e', 0, -0.28, 0, g);
      box(0.26, 0.06, 0.34, '#ffb02e', 0, -0.58, -0.08, g);
      legs.push({ g, s, front: 1, ph: s > 0 ? Math.PI : 0 });
    }
    const seat = group(body, 0, by + 0.45, 0.1);
    return { root, lift, body, legs, head, wings, tail, seat, swimSink: 0.6, kind: 'bird' };
  }

  const CHAINS = {
    snake: { n: 9, r: 0.36, y: 0.38, gap: 0.42, color: '#7ac943', alt: '#6ab536', belly: '#e9f59a', head: [0.62, 0.42, 0.6], pattern: '#3f7a22' },
    dragon: { n: 10, r: 0.42, y: 1.05, gap: 0.46, color: '#2fbf71', belly: '#ffd24a', head: [0.7, 0.6, 0.62], spikes: '#e8382f', horn: '#ffd24a', whisker: '#ffd24a', fin: '#e8382f', dragon: true },
  };

  function build(id) {
    let A;
    if (QUADS[id]) A = quad(QUADS[id]);
    else if (CHAINS[id]) A = chain(CHAINS[id]);
    else A = rooster();
    A.id = id;
    A.update = (dt, st) => animate(A, dt, st);
    return A;
  }

  // st: { t (seconds), speed (m/s), water (0..1), air (height above the ground), mode: 'run' | 'idle' | 'fly' | 'happy' }
  function animate(A, dt, st) {
    const k = 1 - Math.exp(-12 * dt);
    const run = st.mode === 'idle' || st.mode === 'happy' ? 0 : Math.min(1, st.speed / 6);
    const ph = A.ph = (A.ph || 0) + dt * (2 + st.speed * 1.5);
    const swim = st.water;
    const sink = -A.swimSink * swim;
    A.lift.position.y += (sink + st.air - A.lift.position.y) * Math.min(1, dt * 14);
    if (st.mode === 'happy') A.lift.position.y += Math.abs(Math.sin(st.t * 6)) * 0.35;
    if (A.kind === 'quad' || A.kind === 'bird') {
      const amp = swim > 0.5 ? 0.7 : 0.75 * run;
      for (const L of A.legs) {
        const a = Math.sin(ph * (swim > 0.5 ? 1.3 : 1) + L.ph) * amp * (A.kind === 'bird' ? 1.2 : 1);
        L.g.rotation.x += (a - L.g.rotation.x) * k;
      }
      A.body.position.y = Math.abs(Math.sin(ph)) * 0.08 * run * (1 - swim);
      A.body.rotation.x = Math.sin(ph) * 0.04 * run;
      if (A.head) A.head.rotation.x = (A.head.userData.rx || 0) + Math.sin(ph + 1) * 0.06 * run;
      if (A.tail && A.o && (A.o.tail === 'wag' || A.o.tail === 'curl')) A.tail.rotation.y = Math.sin(st.t * 9) * 0.5;
      else if (A.tail) A.tail.rotation.y = Math.sin(st.t * 3) * 0.2;
      if (A.wings) for (const W of A.wings) {
        const flap = st.mode === 'fly' ? Math.sin(st.t * 22) * 0.9 + 0.6 : Math.sin(ph) * 0.15;
        W.g.rotation.z += (W.s * flap - W.g.rotation.z) * k;
      }
      if (A.ears) A.ears.forEach((e, i) => { if (e) e.rotation.y = Math.sin(st.t * 2 + i) * 0.1; });
    } else {
      // the snake slithers, the dragon waves through the air
      const amp = A.o.dragon ? 0.28 : 0.4;
      A.segs.forEach((g, i) => {
        const w = Math.sin(st.t * (A.o.dragon ? 3 : 7) - i * 0.7);
        g.position.x = w * amp * (0.4 + i / A.segs.length);
        if (A.o.dragon) g.position.y = A.o.y + Math.cos(st.t * 3 - i * 0.7) * 0.18;
        g.rotation.y = Math.cos(st.t * (A.o.dragon ? 3 : 7) - i * 0.7) * 0.25;
      });
      A.head.position.x = A.segs[0].position.x * 0.8;
      if (A.o.dragon) A.head.position.y = A.o.y + 0.08 + A.segs[0].position.y - A.o.y;
      for (const L of A.legs) L.g.rotation.x = Math.sin(ph + L.ph) * 0.6 * run;
      if (A.head.userData.tongue) A.head.userData.tongue.visible = Math.sin(st.t * 5) > 0.3;
    }
  }

  // ---------------------------------------------------------------- Foxy and Froggy, who ride along
  function critter(kind) {
    const root = group();
    const fox = kind === 'fox';
    const c = fox ? '#ff8a3c' : '#69c94e', belly = fox ? '#fff1e0' : '#d8f5b0';
    const body = group(root);
    box(0.5, 0.5, 0.4, c, 0, 0.3, 0, body);
    box(0.36, 0.34, 0.05, belly, 0, 0.28, -0.21, body);
    const head = group(body, 0, 0.78, 0);
    box(0.56, 0.46, 0.46, c, 0, 0, 0, head);
    eyes(head, 0.56, 0.06, -0.24, 0.13, 0.08);
    if (fox) {
      box(0.24, 0.16, 0.14, belly, 0, -0.1, -0.28, head);
      box(0.08, 0.06, 0.04, INK, 0, -0.06, -0.36, head);
      for (const s of [-1, 1]) { const e = box(0.16, 0.18, 0.06, '#3a2418', s * 0.18, 0.3, 0, head); e.rotation.z = Math.PI / 4; }
      const tail = box(0.18, 0.18, 0.5, c, 0, 0.2, 0.35, body);
      box(0.2, 0.2, 0.14, belly, 0, 0.2, 0.62, body);
      void tail;
    } else {
      for (const s of [-1, 1]) { box(0.18, 0.14, 0.18, c, s * 0.16, 0.28, -0.06, head); box(0.09, 0.09, 0.04, INK, s * 0.16, 0.3, -0.16, head); }
      box(0.3, 0.04, 0.02, INK, 0, -0.1, -0.24, head);
    }
    const arms = [];
    for (const s of [-1, 1]) {
      const a = group(body, s * 0.3, 0.5, 0);
      box(0.12, 0.34, 0.12, c, 0, -0.14, 0, a);
      arms.push(a);
    }
    root.scale.setScalar(1.25);
    return {
      root, kind,
      update(dt, mode, t) {
        const up = mode === 'cheer';
        arms.forEach((a, i) => { a.rotation.x = up ? 2.8 + Math.sin(t * 10 + i * 3) * 0.3 : 1.2; a.rotation.z = (i ? 1 : -1) * (up ? 0.3 : 0.1); });
        body.position.y = up ? Math.abs(Math.sin(t * 8)) * 0.15 : 0;
      },
    };
  }

  // ---------------------------------------------------------------- the Jade Emperor (玉皇大帝) on his throne
  function emperor() {
    const root = group();
    // the throne
    box(3.0, 0.5, 2.0, '#b51f18', 0, 0.25, 0, root);
    box(2.6, 1.0, 1.6, '#d8261c', 0, 1.0, 0.1, root);
    // the back behind him (he faces +z, down the courtyard)
    box(2.8, 2.8, 0.4, '#d8261c', 0, 2.0, -0.85, root);
    box(3.0, 0.3, 0.5, '#ffc21a', 0, 3.5, -0.85, root);
    for (const s of [-1, 1]) { box(0.35, 1.0, 1.8, '#ffc21a', s * 1.35, 1.4, 0.1, root); box(0.5, 0.5, 0.5, '#ffd400', s * 1.45, 3.6, -0.85, root); }
    const look = { skin: '#f6c9a0', hair: 'short', hairColor: '#2a2a2a', shirt: 'jacket', top: '#ffc21a', bottom: '#e8a10e', shoes: '#b51f18', brows: true, smile: true, mustache: true };
    const p = Kit.people.build(look);
    p.root.rotation.y = Math.PI; // faces the racers coming up the path (+z)
    p.root.scale.setScalar(1.35);
    p.root.position.set(0, 0.9, -0.2);
    root.add(p.root);
    Kit.people.pose(p, 0, 'stand', 1);
    p.legL.rotation.x = p.legR.rotation.x = 1.45; // sitting
    p.legL.rotation.z = -0.15; p.legR.rotation.z = 0.15;
    // a long white beard, and the flat crown with strings of beads
    box(0.5, 0.55, 0.12, '#f4f4f4', 0, -0.35, -0.3, p.head);
    const crown = group(p.head, 0, 0.42, 0);
    box(0.62, 0.22, 0.6, '#ffc21a', 0, 0, 0, crown);
    box(0.9, 0.06, 1.1, '#1b1a22', 0, 0.16, -0.05, crown);
    for (let k = 0; k < 6; k++) {
      const x = -0.36 + k * 0.144;
      box(0.025, 0.36, 0.025, '#ffd400', x, -0.02, -0.6, crown);
      box(0.06, 0.06, 0.06, k % 2 ? '#e8382f' : '#3fd0c9', x, -0.2, -0.6, crown);
    }
    // a jade tablet (笏) in his hands
    box(0.12, 0.7, 0.04, '#9fe3c4', 0, 0.2, -0.55, p.armR);
    p.armL.rotation.x = p.armR.rotation.x = 0.9;
    p.armL.rotation.z = 0.3; p.armR.rotation.z = -0.3;
    return { root, person: p };
  }

  // ---------------------------------------------------------------- the brother's lucky cloud (祥云) and the goat's raft
  function cloud() {
    const root = group();
    const m = new T.MeshLambertMaterial({ color: '#fff6dc', emissive: '#ffcc55', emissiveIntensity: 0.25 });
    const sph = new T.SphereGeometry(1, 12, 8);
    const puffs = [[0, 0, 0, 1.2], [1.1, -0.1, 0.2, 0.9], [-1.1, -0.1, 0.1, 0.95], [0.5, 0.3, -0.5, 0.8], [-0.5, 0.25, 0.6, 0.8], [2.0, -0.15, 0.3, 0.6], [-2.0, -0.15, -0.2, 0.6]];
    for (const [x, y, z, r] of puffs) {
      const s = new T.Mesh(sph, m);
      s.position.set(x, y, z);
      s.scale.set(r, r * 0.55, r);
      root.add(s);
    }
    // the curls at the ends, gold
    const gold = mat('#ffc21a');
    for (const s of [-1, 1]) {
      const t = new T.Mesh(new T.TorusGeometry(0.42, 0.11, 6, 14, Math.PI * 1.5), gold);
      t.position.set(s * 2.45, 0.05, 0.2);
      t.rotation.y = Math.PI / 2;
      root.add(t);
    }
    return { root };
  }

  function raft() {
    const root = group();
    for (let k = 0; k < 7; k++) {
      const c = new T.Mesh(new T.CylinderGeometry(0.16, 0.16, 2.6, 8), mat(k % 2 ? '#c8b04a' : '#a8902e'));
      c.rotation.x = Math.PI / 2;
      c.position.set(-0.96 + k * 0.32, 0, 0);
      root.add(c);
    }
    for (const z of [-0.9, 0.9]) box(2.3, 0.08, 0.14, '#7a5a2a', 0, 0.16, z, root);
    return { root };
  }

  ZR.animals = { build, critter, emperor, cloud, raft, QUADS, CHAINS, box, mat };
})();
