/* TT Zodiac Race: the race itself, with no Three.js, so it runs in Node too (tools/check.js).
   All twelve animals race at once, each in its own lane across the meadow, the great river and the bamboo path to the
   Jade Emperor's palace. Every lane has the same rocks, logs, whirlpools and peaches (odd lanes mirrored), so it's a
   fair race. In a lane an animal can be in three spots: -1 left, 0 middle, 1 right.

     create({ players: [{ animal, who, level }], seed, tweak })   who: 'teddy' | 'tommy'; level: 'easy' | 'normal'
     step(race, dt)                       60 steps a second
     steer(race, i, dir) / jump(race, i) / power(race, i) / buddy(race, i) / highFive(race)
     simulate({ players: [{ animal, who, level, pilot }], seed, tweak })   a whole race with pretend players
   race.events collects what happened (bonk, peach, power, ride, leap, finish...) for the page to show; the page clears it. */
(function () {
  'use strict';
  const ZR = (window.ZR = window.ZR || {});
  const Z = ZR.zodiac;

  // ---------------------------------------------------------------- the course
  const L = 440;
  const STRETCHES = [
    { id: 'meadow', name: 'THE MEADOW', s0: 0, s1: 45, land: true },
    { id: 'calm', name: 'THE GREAT RIVER', s0: 45, s1: 125 },
    { id: 'lotus', name: 'LOTUS POND', s0: 125, s1: 205 },
    { id: 'current', name: 'FAST WATER', s0: 205, s1: 285 },
    { id: 'waves', name: 'BIG WAVES', s0: 285, s1: 365 },
    { id: 'bamboo', name: 'BAMBOO PATH', s0: 365, s1: L, land: true },
  ];
  const WATER0 = 45, WATER1 = 365;
  const isWater = (s) => s >= WATER0 && s < WATER1;
  const stretchAt = (s) => STRETCHES.find((x) => s < x.s1) || STRETCHES[STRETCHES.length - 1];
  const LAND_M = WATER0 + (L - WATER1), WATER_M = WATER1 - WATER0;

  const PHYS = {
    vref: 7.2,          // m/s, an animal's top speed (before its own land/water strengths)
    accel: 2.2,         // how fast it gets back to speed (per second, as a share of the gap)
    steer: 6,           // spots a second
    jumpT: 0.62,        // seconds in the air
    bonk: 0.7, bonkKeep: 0.3,   // a rock or a log: stuck this long, keeping this share of the speed
    spin: 0.9, spinKeep: 0.55,  // a whirlpool
    peachT: 1.6, peachMul: 1.3, peachPower: 0.25,
    hit: 0.55,          // how close (in spots) counts as touching
    cloudV: 12,         // the brother's cloud
    cloudWait: 2.0,     // hello, signature move and the treat before the ride starts
    fiveT: 3, fiveMul: 1.25, fiveCool: 6,
    afterLast: 2.5,     // the race ends this long after the last brother finishes
    afterFirst: 40,     // ... or this long after the first animal does
    cap: 240,
  };
  const LEVELS = {
    easy: { charge: 7, rocks: 7, whirls: 3, logs: 0, peaches: 9, help: true, cpu: { speed: 0.87, dodge: 0.45, jump: 0.5, delay: 1.6, band: true } },
    normal: { charge: 9, rocks: 14, whirls: 6, logs: 5, peaches: 8, help: false, cpu: { speed: 0.885, dodge: 0.7, jump: 0.6, delay: 0.6, band: false } },
  };
  // each power: seconds, speed, and whether rocks and logs can touch it (immune) or it's up in the air (air)
  const POWERS = {
    plow: { dur: 5, mul: 1.45, immune: true },
    swim: { dur: 3.5, mul: 1.45, water: 1.62 },
    hop: { dur: 4, mul: 1.5, immune: true, air: true },
    fly: { dur: 4, mul: 1.5, immune: true, air: true },
    gallop: { dur: 3, mul: 1.6, land: 1.75 },
    raft: { dur: 5, mul: 1.45, immune: true },
    swing: { dur: 4, mul: 1.5, immune: true, air: true },
    flap: { dur: 4, mul: 1.5, immune: true, air: true },
    paddle: { dur: 3.5, mul: 1.45, water: 1.62 },
    snack: { dur: 5, mul: 1.45 },
    scurry: { dur: 3.5, mul: 1.6 }, // the rat or the snake when its ride is too far away
    ride: { dur: 5, immune: true },
  };
  const RIDE_WINDOW = [-3, 10]; // the host can be this far behind (-) or ahead (+) to hop on

  // every animal is as fast over the whole course: its land and water strengths are scaled so the totals match
  const SPEED = {};
  for (const a of Z.ANIMALS) {
    const c = (LAND_M / a.land + WATER_M / a.water) / (LAND_M + WATER_M);
    SPEED[a.id] = { land: a.land * c, water: a.water * c };
  }

  // ---------------------------------------------------------------- random numbers that repeat with a seed
  function rng(seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // the lane's things, the same for every lane (odd lanes mirror the spots)
  function layout(level, seed) {
    const r = rng(seed * 7 + 13);
    const Lv = LEVELS[level];
    const items = [];
    const taken = []; // [s0, s1] bands with something in them
    const free = (s, gap) => taken.every(([a, b]) => s < a - gap || s > b + gap);
    const put = (it, len, gap) => { items.push(it); taken.push([it.s, it.s + len]); };
    const spot = () => Math.floor(r() * 3) - 1;
    function place(n, kind, s0, s1, gap, len) {
      for (let k = 0, tries = 0; k < n && tries < 400; tries++) {
        const s = s0 + r() * (s1 - s0);
        if (!free(s, gap)) continue;
        put({ kind, s, spot: kind === 'log' ? 0 : spot() }, len || 0, gap);
        k++;
      }
    }
    place(Lv.logs, 'log', WATER0 + 15, WATER1 - 10, 14);
    place(Lv.rocks, 'rock', 16, L - 18, 9);
    place(Lv.whirls, 'whirl', WATER0 + 8, WATER1 - 8, 8);
    // peaches in lines of three, away from the rocks in the same spot
    for (let k = 0, tries = 0; k < Lv.peaches && tries < 400; tries++) {
      const s = 10 + r() * (L - 30), sp = spot();
      const near = items.some((it) => it.kind !== 'peach' && Math.abs(it.s - s - 2.5) < 7 && (it.kind === 'log' || it.spot === sp));
      if (near || items.some((it) => it.kind === 'peach' && Math.abs(it.s - s) < 10)) continue;
      for (let j = 0; j < 3; j++) items.push({ kind: 'peach', s: s + j * 2.5, spot: sp });
      k++;
    }
    items.sort((a, b) => a.s - b.s);
    items.forEach((it, i) => { it.id = i; });
    return items;
  }

  // ---------------------------------------------------------------- a race
  function create(o) {
    const tweak = o.tweak || {};
    const seed = o.seed || 1;
    const r = rng(seed);
    const humans = o.players.map((p) => p.animal);
    // the CPU crews race at the easy level when any brother does
    const level = o.players.some((p) => p.level === 'easy') ? 'easy' : 'normal';
    const course = layout(level, seed);
    const racers = Z.ANIMALS.map((a, lane) => {
      const hi = humans.indexOf(a.id);
      const human = hi >= 0 ? o.players[hi] : null;
      const lv = human ? human.level : level;
      return {
        i: lane, lane, animal: a.id, a, human: !!human, who: human ? human.who : null, player: hi, level: lv,
        pilot: human ? human.pilot || null : null,
        skill: human ? 1 : 0.97 + r() * 0.06, // CPU animals aren't all the same
        s: 0, v: 0, x: 0, spot: 0, air: 0, cool: 0, bonk: 0, spin: 0, boost: 0, power: 0, act: null, ride: null,
        cloud: null, five: 0, finishT: null, place: 0, peaches: 0, taken: {}, nextThink: r() * 0.3, steerHold: 0,
        mirror: lane % 2 ? -1 : 1, rnd: rng(seed * 31 + lane * 7 + 1),
      };
    });
    return {
      t: -3, L, course, racers, level, seed, tweak, events: [], done: false, endT: null, firstT: null, fiveCool: 0,
      players: o.players.map((p) => racers.find((x) => x.animal === p.animal)),
    };
  }

  const spotOf = (R, it) => it.spot * R.mirror;
  function emit(race, type, R, extra) { race.events.push(Object.assign({ type, i: R ? R.i : -1, t: race.t }, extra || {})); }

  function steer(race, i, dir) {
    const R = race.racers[i];
    if (!R || R.finishT !== null || R.ride) return;
    R.spot = Math.max(-1, Math.min(1, R.spot + dir));
    R.steerHold = 0.8; // EASY's help leaves the steering alone for a moment after the kid steers
  }
  function jump(race, i) {
    const R = race.racers[i];
    if (!R || race.t < 0 || R.finishT !== null || R.air > 0 || R.cool > 0 || R.ride || (R.cloud && R.cloud.on)) return false;
    if (R.act && POWERS[R.act.kind].air) return false;
    R.air = PHYS.jumpT;
    emit(race, 'jump', R);
    return true;
  }
  function power(race, i) {
    const R = race.racers[i];
    if (!R || race.t < 0 || R.finishT !== null || R.power < 1 || R.act || R.ride) return false;
    R.power = 0;
    let kind = R.a.power;
    if (kind === 'ride') {
      const host = race.racers.find((x) => x.animal === R.a.host);
      const gap = host.s - R.s;
      if (host.finishT === null && !host.ride && gap >= RIDE_WINDOW[0] && gap <= RIDE_WINDOW[1] && host.s < L - 20) {
        R.ride = { host: host.i, t: POWERS.ride.dur };
        R.air = 0;
        emit(race, 'ride', R, { host: host.i });
        emit(race, 'power', R, { kind: 'ride' });
        return true;
      }
      kind = 'scurry';
    }
    R.act = { kind, t: POWERS[kind].dur };
    emit(race, 'power', R, { kind });
    return true;
  }
  // the brother's cloud ride: across the next stretch, starting after his hello (PHYS.cloudWait)
  function rideTarget(s) {
    for (const x of STRETCHES) if (x.s1 >= s + 40) return x.s1;
    return L;
  }
  function buddy(race, i) {
    const R = race.racers[i];
    if (!R || race.t < 0 || R.finishT !== null) return false;
    if (R.cloud) R.cloud.to = Math.min(L, rideTarget(R.cloud.to + 1)); // calling again: on to the stretch after
    else R.cloud = { wait: PHYS.cloudWait, on: false, to: rideTarget(R.s + R.v * PHYS.cloudWait) };
    emit(race, 'buddy', R, { to: R.cloud.to });
    return true;
  }
  function highFive(race) {
    if (race.fiveCool > 0 || race.t < 0) return false;
    race.fiveCool = PHYS.fiveCool;
    for (const R of race.players) if (R.finishT === null) R.five = PHYS.fiveT;
    emit(race, 'five', null);
    return true;
  }

  function topSpeed(race, R) {
    const sp = SPEED[R.animal];
    const water = isWater(R.s);
    let v = PHYS.vref * (water ? sp.water : sp.land);
    if (race.tweak.stuck === R.animal && water) v = 0; // the proof that "every animal can finish" can fail
    if (race.tweak.noRun) v = 0;
    if (race.tweak.speedy === R.animal) v *= 1.3;
    if (!R.human) {
      const C = LEVELS[race.level].cpu;
      v *= C.speed * R.skill * (race.tweak.cpuSpeed || 1);
      if (!C.band) {
        const lead = race.players.reduce((m, p) => Math.max(m, p.s), 0);
        if (lead - R.s > 30) v *= 1.06; // NORMAL: a small catch-up when far behind
      }
    }
    if (R.act) {
      const P = POWERS[R.act.kind];
      v *= (water && P.water) || (!water && P.land) || P.mul;
    }
    if (R.boost > 0) v *= PHYS.peachMul;
    if (R.five > 0) v *= PHYS.fiveMul;
    if (!R.human && LEVELS[race.level].cpu.band && !race.tweak.noBand) {
      // EASY: an animal ahead of the slowest brother waits for him, and on the bamboo path it's always a bit slower
      // than him, so a brother who keeps going gets through
      const kid = race.players.filter((p) => p.finishT === null).reduce((m, p) => (m && m.s < p.s ? m : p), null);
      if (kid) {
        const ahead = R.s - kid.s;
        if (R.s > L - 70 && ahead > -1) v = Math.min(v, 0.85 * PHYS.vref * SPEED[kid.animal].land);
        else if (ahead > 2) v *= Math.max(0.7, 1 - (ahead - 2) / 50);
      }
    }
    return v;
  }

  function pilotThink(race, R, dt) {
    if (R.pilot && PILOTS[R.pilot]) PILOTS[R.pilot](race, R, dt);
    else if (!R.human) cpuThink(race, R, dt);
  }

  // what's coming in this lane within `ahead` metres
  function upcoming(race, R, ahead) {
    const out = [];
    for (const it of race.course) {
      if (it.s < R.s) continue;
      if (it.s > R.s + ahead) break;
      if (it.kind === 'peach' && R.taken[it.id]) continue;
      out.push(it);
    }
    return out;
  }
  function dangerIn(race, R, spot, list) {
    return list.some((it) => (it.kind === 'rock' || it.kind === 'whirl') && spotOf(R, it) === spot);
  }
  // pick the safest spot, preferring peaches and staying put
  function bestSpot(race, R, list) {
    let best = R.spot, score = -1e9;
    for (const sp of [R.spot, -1, 0, 1]) {
      let sc = 0;
      if (dangerIn(race, R, sp, list)) sc -= 100;
      if (list.some((it) => it.kind === 'peach' && spotOf(R, it) === sp)) sc += 5;
      sc -= Math.abs(sp - R.spot) * 0.5;
      if (sc > score) { score = sc; best = sp; }
    }
    return best;
  }

  function cpuThink(race, R, dt) {
    R.nextThink -= dt;
    if (R.nextThink > 0) return;
    R.nextThink = 0.25;
    const C = LEVELS[race.level].cpu;
    const list = upcoming(race, R, 9);
    if (dangerIn(race, R, R.spot, list) && R.rnd() < C.dodge) R.spot = bestSpot(race, R, list);
    else if (R.rnd() < 0.15) R.spot = bestSpot(race, R, upcoming(race, R, 14));
    const log = list.find((it) => it.kind === 'log');
    if (log && log.s - R.s < 3.5 && R.rnd() < C.jump * 2.2) jump(race, R.i);
    if (R.power >= 1) {
      R.wantPower = (R.wantPower || 0) + 0.25;
      if (R.wantPower >= C.delay) { R.wantPower = 0; power(race, R.i); }
    }
  }

  // EASY's help for a brother: slips round rocks and whirlpools, hops logs
  function help(race, R) {
    if (R.steerHold > 0) return;
    const list = upcoming(race, R, 7);
    if (dangerIn(race, R, R.spot, list)) R.spot = bestSpot(race, R, list);
    const log = list.find((it) => it.kind === 'log');
    if (log && log.s - R.s < 3) jump(race, R.i);
  }

  // race.events piles up until whoever runs the race clears it (the page, after showing them; simulate(), every step),
  // so the events of a button press between two steps aren't lost
  function step(race, dt) {
    if (race.done) return;
    race.t += dt;
    if (race.t < 0) return;
    if (race.fiveCool > 0) race.fiveCool -= dt;
    for (const R of race.racers) {
      if (R.finishT !== null) { R.v *= 0.97; R.s += R.v * dt; continue; }
      pilotThink(race, R, dt);
      if (R.human && LEVELS[R.level].help && !race.tweak.noHelp) help(race, R);
      if (R.steerHold > 0) R.steerHold -= dt;
      move(race, R, dt);
    }
    for (const R of race.racers) {
      if (R.finishT === null && R.s >= L) {
        R.finishT = race.t;
        R.s = Math.max(R.s, L);
        if (race.firstT === null) race.firstT = race.t;
        emit(race, 'finish', R, { place: race.racers.filter((x) => x.finishT !== null).length });
      }
    }
    const humansDone = race.tweak.allFinish ? race.racers.every((p) => p.finishT !== null) : race.players.every((p) => p.finishT !== null);
    if (humansDone && race.endT === null) race.endT = race.t + PHYS.afterLast;
    const lateEnd = race.firstT !== null && race.t >= race.firstT + PHYS.afterFirst && !race.tweak.allFinish;
    if ((race.endT !== null && race.t >= race.endT) || lateEnd || race.t >= PHYS.cap) finish(race);
  }

  function move(race, R, dt) {
    const prev = R.s;
    if (R.ride) {
      // the rat on the ox's back (the snake on the horse's hoof): goes where the host goes, then leaps off ahead
      const H = race.racers[R.ride.host];
      R.ride.t -= dt;
      R.s = H.s;
      R.v = H.v;
      R.x += (H.x - R.x) * Math.min(1, dt * 8);
      if (R.ride.t <= 0 || H.s >= L - 12 || H.finishT !== null) {
        // the story's leap off the front; a CPU on EASY lands behind instead, and on NORMAL only just gets ahead of a brother
        R.s = R.human ? H.s + 3 : race.level === 'easy' ? H.s - 1.5 : H.human ? H.s + 1 : H.s + 3;
        R.v = Math.max(R.v, topSpeed(race, R));
        R.ride = null;
        R.air = PHYS.jumpT;
        emit(race, 'leap', R, { host: H.i });
      }
      collect(race, R, prev, true);
      return;
    }
    if (R.cloud) {
      const C = R.cloud;
      if (!C.on) {
        C.wait -= dt;
        if (C.wait <= 0) { C.on = true; R.act = null; emit(race, 'cloudOn', R); }
      }
      if (C.on) {
        R.v += (PHYS.cloudV - R.v) * Math.min(1, dt * 3);
        R.s += R.v * dt;
        R.x += (0 - R.x) * Math.min(1, dt * 4);
        R.spot = 0;
        R.bonk = R.spin = R.air = 0;
        if (R.s >= C.to) { R.cloud = null; emit(race, 'cloudOff', R); }
        collect(race, R, prev, true);
        return;
      }
    }
    if (R.act) {
      R.act.t -= dt;
      if (R.act.t <= 0) R.act = null;
    } else if (R.power < 1) R.power = Math.min(1, R.power + dt / LEVELS[R.level].charge);
    if (R.air > 0) { R.air -= dt; if (R.air <= 0) { R.air = 0; R.cool = 0.15; emit(race, 'land', R); } }
    if (R.cool > 0) R.cool -= dt;
    if (R.boost > 0) R.boost -= dt;
    if (R.five > 0) R.five -= dt;
    if (R.bonk > 0) R.bonk -= dt;
    else if (R.spin > 0) R.spin -= dt;
    else R.v += (topSpeed(race, R) - R.v) * Math.min(1, dt * PHYS.accel);
    R.x += Math.max(-dt * PHYS.steer, Math.min(dt * PHYS.steer, R.spot - R.x));
    R.s += R.v * dt;
    if (prev < WATER0 && R.s >= WATER0) emit(race, 'splash', R);
    if (prev < WATER1 && R.s >= WATER1) emit(race, 'shore', R);
    collect(race, R, prev, false);
  }

  function collect(race, R, prev, safe) {
    const immune = safe || (R.act && POWERS[R.act.kind].immune);
    const up = R.air > 0 || (R.act && POWERS[R.act.kind].air);
    for (const it of race.course) {
      if (it.s <= prev) continue;
      if (it.s > R.s) break;
      const near = Math.abs(R.x - spotOf(R, it)) < PHYS.hit;
      if (it.kind === 'peach') {
        if (near && !R.taken[it.id]) {
          R.taken[it.id] = true;
          R.peaches++;
          R.boost = PHYS.peachT;
          if (!R.act) R.power = Math.min(1, R.power + PHYS.peachPower);
          emit(race, 'peach', R, { item: it.id });
        }
        continue;
      }
      if (immune) continue;
      if (it.kind === 'rock' && near) {
        R.v *= PHYS.bonkKeep; R.bonk = PHYS.bonk; R.air = 0;
        emit(race, 'bonk', R, { item: it.id });
      } else if (it.kind === 'log' && !up) {
        R.v *= PHYS.bonkKeep; R.bonk = PHYS.bonk;
        emit(race, 'log', R, { item: it.id });
      } else if (it.kind === 'whirl' && near && !up) {
        R.v *= PHYS.spinKeep; R.spin = PHYS.spin;
        emit(race, 'whirl', R, { item: it.id });
      }
    }
  }

  function finish(race) {
    race.done = true;
    const order = race.racers.slice().sort((a, b) => {
      if (a.finishT !== null && b.finishT !== null) return a.finishT - b.finishT || a.i - b.i;
      if (a.finishT !== null) return -1;
      if (b.finishT !== null) return 1;
      return b.s - a.s || a.i - b.i;
    });
    order.forEach((R, k) => { R.place = k + 1; });
    race.order = order.map((R) => R.i);
    emit(race, 'done', null);
  }

  // ---------------------------------------------------------------- pretend players, for the checks and the autopilot
  const PILOTS = {
    // sees everything, dodges every rock, hops every log, grabs peaches, uses the power at once
    perfect(race, R) {
      const list = upcoming(race, R, 9);
      R.spot = bestSpot(race, R, list);
      const log = list.find((it) => it.kind === 'log');
      if (log && log.s - R.s < 2.6 && log.s - R.s > 0.3) jump(race, R.i);
      if (R.power >= 1) power(race, R.i);
    },
    // a good 8-year-old: mostly dodges and hops, a bit late on the power
    teddy(race, R, dt) {
      R.nextThink -= dt;
      if (R.nextThink > 0) return;
      R.nextThink = 0.2;
      const list = upcoming(race, R, 8);
      if (dangerIn(race, R, R.spot, list) && R.rnd() < 0.8) R.spot = bestSpot(race, R, list);
      const log = list.find((it) => it.kind === 'log');
      if (log && log.s - R.s < 3 && R.rnd() < 0.55) jump(race, R.i);
      if (R.power >= 1 && R.rnd() < 0.3) power(race, R.i);
    },
    // a wobbly 5-year-old: steers now and then for no reason, never hops on purpose, presses the power late
    kid(race, R, dt) {
      R.nextThink -= dt;
      if (R.nextThink > 0) return;
      R.nextThink = 0.5;
      if (R.rnd() < 0.12) steer(race, R.i, R.rnd() < 0.5 ? -1 : 1);
      if (R.rnd() < 0.05) jump(race, R.i);
      if (R.power >= 1 && R.rnd() < 0.2) power(race, R.i);
    },
    idle() {},
    // presses everything all the time
    mash(race, R) {
      jump(race, R.i);
      power(race, R.i);
      if (R.rnd() < 0.05) steer(race, R.i, R.rnd() < 0.5 ? -1 : 1);
    },
    // a wobbly kid who calls his brother every 12 seconds
    buddy(race, R, dt) {
      PILOTS.kid(race, R, dt);
      R.callT = (R.callT || 0) + dt;
      if (R.callT >= 12) { R.callT = 0; buddy(race, R.i); }
    },
  };

  function simulate(o) {
    const race = create(o);
    const dt = 1 / 60;
    let n = 0;
    while (!race.done && n++ < (PHYS.cap + 10) * 60) { race.events.length = 0; step(race, dt); }
    return race;
  }

  ZR.race = {
    L, STRETCHES, WATER0, WATER1, isWater, stretchAt, PHYS, LEVELS, POWERS, SPEED, PILOTS, RIDE_WINDOW,
    rng, layout, create, step, steer, jump, power, buddy, highFive, simulate, rideTarget, spotOf, upcoming, topSpeed,
  };
})();
