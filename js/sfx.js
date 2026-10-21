/* TT Zodiac Race: sound effects, all synthesised through Kit.sound.tone / hiss, so the kit's sound switch mutes them.
     ZR.sfx.gong() / count(n) / splash() / jump() / land() / bonk() / whirl() / peach(n) / power(kind) / ride()
     ZR.sfx.buddy() / cloud() / five() / finish(win) / chime(n) / wrong() / firecrackers()
     ZR.sfx.tune(on)   a little pentatonic tune on the home screen and the results */
(function () {
  'use strict';
  const ZR = window.ZR;
  const S = Kit.sound;
  const PENTA = [523, 587, 659, 784, 880, 1047, 1175, 1319];

  function gong() {
    for (const [f, v] of [[196, 0.3], [293, 0.14], [415, 0.1], [587, 0.06]]) S.tone({ type: 'sine', f, to: f * 0.98, dur: 1.8, vol: v, attack: 0.01 });
    S.hiss({ f: 3000, to: 1200, dur: 1.2, vol: 0.08, q: 0.6 });
  }
  function count(n) { S.tone({ type: 'triangle', f: n > 0 ? 660 : 990, dur: 0.18, vol: 0.14 }); S.tone({ f: 110, to: 55, dur: 0.25, vol: 0.3 }); }
  function splash() { S.hiss({ f: 1800, to: 400, dur: 0.45, vol: 0.28, q: 0.7 }); S.hiss({ filter: 'lowpass', f: 700, to: 200, dur: 0.3, vol: 0.2, at: 0.04 }); }
  function jump() { S.jump(); }
  function land() { S.land(); }
  function bonk() {
    S.bump();
    S.tone({ type: 'square', f: 420, to: 150, dur: 0.25, vol: 0.06, at: 0.05, lp: 1500 });
  }
  function whirl() { S.tone({ type: 'sine', f: 700, to: 300, dur: 0.5, vol: 0.1 }); S.hiss({ f: 1200, to: 600, dur: 0.5, vol: 0.1, q: 2 }); }
  function peach(n) { S.coin(n || 0); }
  function power(kind) {
    S.powerup();
    if (kind === 'fly' || kind === 'flap') S.hiss({ f: 800, to: 2400, dur: 0.6, vol: 0.12, q: 0.8 });
    else if (kind === 'gallop' || kind === 'plow') for (let i = 0; i < 4; i++) S.tone({ f: 160, to: 80, dur: 0.08, vol: 0.18, at: i * 0.12 });
    else if (kind === 'hop' || kind === 'swing') for (let i = 0; i < 3; i++) S.tone({ type: 'triangle', f: 600 + i * 200, to: 900 + i * 200, dur: 0.1, vol: 0.08, at: i * 0.14 });
    else if (kind === 'snack') for (let i = 0; i < 3; i++) S.hiss({ filter: 'bandpass', f: 1800, dur: 0.05, vol: 0.2, q: 3, at: i * 0.15 });
  }
  function ride() { [523, 659, 784].forEach((f, i) => S.tone({ type: 'triangle', f, dur: 0.12, vol: 0.1, at: i * 0.07 })); }
  function buddy() { S.powerup(); }
  function cloud() { S.hiss({ f: 600, to: 2200, dur: 0.8, vol: 0.12, q: 0.6 }); [784, 988, 1175].forEach((f, i) => S.tone({ type: 'sine', f, dur: 0.4, vol: 0.07, at: 0.1 + i * 0.1 })); }
  function five() {
    S.hiss({ filter: 'highpass', f: 2500, dur: 0.08, vol: 0.4 });
    S.tone({ type: 'triangle', f: 880, to: 1320, dur: 0.2, vol: 0.12, at: 0.05 });
  }
  function firecrackers() {
    for (let i = 0; i < 10; i++) S.hiss({ filter: 'highpass', f: 1500 + Math.random() * 1500, dur: 0.05, vol: 0.25, at: i * 0.07 + Math.random() * 0.04 });
  }
  function finish(win) {
    gong();
    if (win) { firecrackers(); [784, 988, 1175, 1568].forEach((f, i) => S.tone({ type: 'triangle', f, dur: 0.3, vol: 0.12, at: 0.15 + i * 0.11 })); }
  }
  function chime(n) { S.tone({ type: 'triangle', f: PENTA[n % PENTA.length], dur: 0.22, vol: 0.12 }); }
  function wrong() { S.tone({ type: 'square', f: 300, to: 220, dur: 0.18, vol: 0.05, lp: 1000 }); }

  // the tune: C D E G A, looped with a timer, quiet under everything
  const MEL = [0, 2, 4, 3, 2, 0, 1, 2, 4, 5, 4, 3, 2, 3, 1, 0];
  let tuneTimer = null, step = 0;
  function tune(on) {
    if (!on) { clearInterval(tuneTimer); tuneTimer = null; return; }
    if (tuneTimer) return;
    step = 0;
    tuneTimer = setInterval(() => {
      if (!S.isRunning()) return;
      const n = MEL[step % MEL.length];
      S.tone({ type: 'triangle', f: PENTA[n], dur: 0.26, vol: 0.045 });
      if (step % 4 === 0) S.tone({ f: 110, to: 55, dur: 0.25, vol: 0.15 });
      if (step % 8 === 4) S.tone({ type: 'sine', f: PENTA[n] / 2, dur: 0.5, vol: 0.04 });
      step++;
    }, 320);
  }

  ZR.sfx = { gong, count, splash, jump, land, bonk, whirl, peach, power, ride, buddy, cloud, five, firecrackers, finish, chime, wrong, tune };
})();
