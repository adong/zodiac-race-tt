/* TT Zodiac Race: the headless checks, run as game.check() in the page and by `node tools/check.js`.
   They check the brief's rules with the page's own code (js/zodiac.js, js/race.js), playing whole races with pretend
   players (ZR.race.PILOTS) at 60 steps a second:
     finder        the year-to-animal finder is right: known years, the 12-year round, and the Chinese New Year caveat
                   (a birthday before that year's Chinese New Year is the year before's animal), and every Chinese New
                   Year date in the table is the day of a new moon in Beijing (worked out with an astronomy formula)
     everyFinishes every animal can finish: each of the 12, played by any pretend player (even one doing nothing) on
                   both levels, crosses the line, and in a race run to the end all 12 animals cross it
     racesEnd      every race ends, with all 12 animals placed 1 to 12, whoever plays and however badly, 1 and 2 players
     fair          every animal is as fast over the whole course (perfect rowing... running, alone: all within 6 %),
                   on EASY a wobbly 5-year-old wins almost every race with any animal, and on NORMAL the CPU animals are
                   a real race: perfect play wins, a good 8-year-old wins some, doing nothing never wins
   run({ prove: true }) also breaks each rule on purpose and checks that the check then fails, so a check that can't
   fail can't pass unnoticed. */
(function () {
  'use strict';
  const ZR = (window.ZR = window.ZR || {});

  function finder(broken) {
    const Z = ZR.zodiac;
    const problems = [];
    const animalOfYear = broken === 'formula' ? (y) => Z.ANIMALS[((y - 3) % 12 + 12) % 12] : Z.animalOfYear;
    const find = (y, m, d) => {
      const out = Z.find(y, m, d);
      if (broken === 'formula') { out.animal = animalOfYear(y); out.born = out.born && animalOfYear(m === 1 || (m === 2 && d < out.newYear.day) ? y - 1 : y); }
      if (broken === 'caveat' && m && d) out.born = out.animal; // forgets about Chinese New Year
      return out;
    };
    // years everyone knows
    const known = { 1900: 'rat', 1924: 'rat', 1950: 'tiger', 1975: 'rabbit', 1984: 'rat', 1988: 'dragon', 1990: 'horse', 2000: 'dragon',
      2008: 'rat', 2012: 'dragon', 2016: 'monkey', 2017: 'rooster', 2018: 'dog', 2019: 'pig', 2020: 'rat', 2021: 'ox', 2022: 'tiger',
      2023: 'rabbit', 2024: 'dragon', 2025: 'snake', 2026: 'horse', 2027: 'goat', 2030: 'dog', 2100: 'monkey' };
    for (const y in known) if (animalOfYear(+y).id !== known[y]) problems.push(`${y} should be ${known[y]}, finder says ${animalOfYear(+y).id}`);
    // the round of twelve: next year is the next animal, twelve years on is the same one
    for (let y = 1900; y <= 2100; y++) {
      if (animalOfYear(y + 12) !== animalOfYear(y)) problems.push(`${y} and ${y + 12} differ`);
      if (animalOfYear(y + 1).order !== animalOfYear(y).order % 12 + 1) problems.push(`${y + 1} doesn't follow ${y}`);
    }
    // the Chinese New Year caveat: the day before and the day of, every year in the table
    let caveats = 0;
    for (let y = Z.CNY_FIRST; y <= Z.CNY_LAST; y++) {
      const ny = Z.newYear(y);
      const dayBefore = ny.day > 1 ? [ny.month, ny.day - 1] : [1, 31];
      const before = find(y, dayBefore[0], dayBefore[1]).born, on = find(y, ny.month, ny.day).born;
      if (!before || before.id !== animalOfYear(y - 1).id) problems.push(`born ${y}-${dayBefore.join('-')}, before New Year (${ny.month}/${ny.day}), should be ${animalOfYear(y - 1).id}`);
      if (!on || on.id !== animalOfYear(y).id) problems.push(`born on New Year ${y}-${ny.month}-${ny.day} should be ${animalOfYear(y).id}`);
      if (find(y, 1, 1).born.id !== animalOfYear(y - 1).id) problems.push(`born ${y}-1-1 should be ${animalOfYear(y - 1).id}`);
      if (find(y, 3, 1).born.id !== animalOfYear(y).id) problems.push(`born ${y}-3-1 should be ${animalOfYear(y).id}`);
      caveats += 4;
    }
    // examples to read: Teddy-age and Tommy-age birthdays round New Year
    const ex = [[2018, 2, 15, 'rooster'], [2018, 2, 16, 'dog'], [2021, 2, 11, 'rat'], [2021, 2, 12, 'ox'], [2020, 1, 24, 'pig'], [2020, 1, 25, 'rat']];
    for (const [y, m, d, id] of ex) if (find(y, m, d).born.id !== id) problems.push(`born ${y}-${m}-${d} should be ${id}`);
    // the dates themselves: new moons in Beijing
    const table = Z.table();
    if (broken === 'date') table[2034 - Z.CNY_FIRST][1] -= 1; // 2034's New Year a day early
    const moon = Z.moonCheck(table);
    problems.push(...moon);
    return { problems, stat: `${Object.keys(known).length} known years, 1900-2112 in order, ${caveats} New Year birthdays, ${table.length} New Year dates on a new moon (${Z.CNY_FIRST}-${Z.CNY_LAST})` };
  }

  const R = () => ZR.race;
  const ANIMALS = () => ZR.zodiac.ANIMALS;

  function everyFinishes(tweak) {
    const problems = [];
    let n = 0, slowest = 0, slowestTag = '';
    for (const a of ANIMALS()) {
      for (const level of ['easy', 'normal']) {
        for (const pilot of ['idle', 'kid', 'mash', 'perfect']) {
          const r = R().simulate({ players: [{ animal: a.id, who: 'teddy', level, pilot }], seed: 3, tweak });
          const me = r.players[0];
          n++;
          if (me.finishT === null) problems.push(`${a.id} ${level} ${pilot}: never crossed the line (got to ${me.s.toFixed(0)} m)`);
          else if (me.finishT > slowest) { slowest = me.finishT; slowestTag = `${a.id} ${level} ${pilot}`; }
        }
      }
    }
    // a race run until everyone is home: all 12 animals cross the line, CPU ones too
    for (const level of ['easy', 'normal']) {
      for (const seed of [1, 2]) {
        const r = R().simulate({ players: [{ animal: 'rat', who: 'tommy', level, pilot: 'kid' }], seed, tweak: Object.assign({ allFinish: true }, tweak) });
        n++;
        for (const x of r.racers) if (x.finishT === null) problems.push(`${level} seed ${seed}: the CPU ${x.animal} never crossed the line`);
      }
    }
    return { problems, stat: `${n} races: every animal crossed the line, the slowest ${slowestTag} after ${slowest.toFixed(0)} s` };
  }

  function racesEnd(tweak) {
    const problems = [];
    let n = 0, longest = 0;
    const pilots = Object.keys(R().PILOTS);
    for (const level of ['easy', 'normal']) {
      for (const pilot of pilots) {
        for (const mode of ['1p', '2p']) {
          for (let k = 0; k < 3; k++) {
            const a = ANIMALS()[(k * 5 + pilots.indexOf(pilot)) % 12], b = ANIMALS()[(k * 5 + pilots.indexOf(pilot) + 6) % 12];
            const players = mode === '1p' ? [{ animal: a.id, who: 'teddy', level, pilot }]
              : [{ animal: a.id, who: 'teddy', level, pilot }, { animal: b.id, who: 'tommy', level: level === 'easy' ? 'normal' : 'easy', pilot: pilot === 'idle' ? 'idle' : 'kid' }];
            const r = R().simulate({ players, seed: k + 1, tweak });
            n++;
            longest = Math.max(longest, r.t);
            const tag = `${level} ${pilot} ${mode} ${a.id}`;
            if (!r.done) { problems.push(`${tag}: never ended`); continue; }
            if (r.t >= R().PHYS.cap) problems.push(`${tag}: only the safety cap ended it (${r.t.toFixed(0)} s)`);
            const places = r.racers.map((x) => x.place).sort((x, y) => x - y).join();
            if (places !== '1,2,3,4,5,6,7,8,9,10,11,12') problems.push(`${tag}: places ${places}`);
            if (r.players.some((p) => p.finishT === null)) problems.push(`${tag}: a brother never finished`);
            if (r.racers.some((x) => !isFinite(x.s) || x.s < 0)) problems.push(`${tag}: an animal went backwards or NaN`);
          }
        }
      }
    }
    return { problems, stat: `${n} races ended, the longest after ${longest.toFixed(0)} s` };
  }

  function fair(tweak) {
    const problems = [];
    // 1. every animal as fast as the others over the whole course: alone (no CPU racing), perfect play, 3 seeds
    const times = {};
    for (const a of ANIMALS()) {
      let sum = 0;
      for (const seed of [1, 2, 3]) {
        const r = R().simulate({ players: [{ animal: a.id, who: 'teddy', level: 'normal', pilot: 'perfect' }], seed, tweak: Object.assign({ cpuSpeed: 0.0001 }, tweak) });
        sum += r.players[0].finishT === null ? 999 : r.players[0].finishT;
      }
      times[a.id] = sum / 3;
    }
    const vals = Object.values(times), mean = vals.reduce((x, y) => x + y) / vals.length;
    for (const id in times) if (Math.abs(times[id] / mean - 1) > 0.06) problems.push(`${id} takes ${times[id].toFixed(1)} s, the average is ${mean.toFixed(1)} s`);
    const spread = (Math.max(...vals) - Math.min(...vals)) / mean * 100;
    // 2. EASY: a wobbly 5-year-old wins almost every race, with every animal
    let kidWins = 0, kidN = 0;
    for (const a of ANIMALS()) {
      let w = 0;
      for (let seed = 1; seed <= 8; seed++) {
        const r = R().simulate({ players: [{ animal: a.id, who: 'tommy', level: 'easy', pilot: 'kid' }], seed, tweak });
        if (r.players[0].place === 1) w++;
      }
      kidWins += w; kidN += 8;
      if (w < 7) problems.push(`EASY: a wobbly kid with the ${a.id} won only ${w} of 8`);
    }
    // 3. NORMAL: a real race
    const wins = { perfect: 0, teddy: 0, idle: 0 };
    let n = 0;
    for (const a of ANIMALS()) {
      for (const seed of [1, 2, 3, 4, 5]) {
        n++;
        for (const pilot in wins) {
          const r = R().simulate({ players: [{ animal: a.id, who: 'teddy', level: 'normal', pilot }], seed, tweak });
          if (r.players[0].place === 1) wins[pilot]++;
        }
      }
    }
    if (wins.perfect < n * 0.85) problems.push(`NORMAL: perfect play won only ${wins.perfect} of ${n}`);
    if (wins.teddy < n * 0.3 || wins.teddy > n * 0.85) problems.push(`NORMAL: a good 8-year-old won ${wins.teddy} of ${n} (want 30-85 %)`);
    if (wins.idle > 0) problems.push(`NORMAL: doing nothing won ${wins.idle} of ${n}`);
    return { problems, stat: `animals within ${spread.toFixed(1)} % of each other; EASY wobbly kid won ${kidWins}/${kidN}; NORMAL wins: perfect ${wins.perfect}/${n}, good 8-year-old ${wins.teddy}/${n}, idle ${wins.idle}/${n}` };
  }

  const CHECKS = { finder, everyFinishes, racesEnd, fair };
  // each check broken on purpose: it must fail
  const PROOFS = [
    { name: 'finder', why: 'counts the animals from the wrong year', arg: 'formula' },
    { name: 'finder', why: 'forgets the Chinese New Year caveat', arg: 'caveat' },
    { name: 'finder', why: "2034's New Year date a day early", arg: 'date' },
    { name: 'everyFinishes', why: 'the pig can\'t swim', arg: { stuck: 'pig' } },
    { name: 'racesEnd', why: 'nobody runs by himself', arg: { noRun: true } },
    { name: 'fair', why: 'the horse is 30 % faster', arg: { speedy: 'horse' } },
    { name: 'fair', why: 'no catching up for the kid on EASY', arg: { noBand: true, noHelp: true } },
  ];

  function run(o) {
    o = o || {};
    const t0 = Date.now();
    const results = [];
    for (const name in CHECKS) {
      if (o.only && o.only !== name) continue;
      const r = CHECKS[name]();
      results.push({ name, ok: r.problems.length === 0, stat: r.stat, problems: r.problems });
    }
    const prove = [];
    if (o.prove) {
      for (const p of PROOFS) {
        if (o.only && o.only !== p.name) continue;
        const r = CHECKS[p.name](p.arg);
        prove.push({ name: p.name, why: p.why, caught: r.problems.length > 0, first: r.problems[0] || '(nothing caught)' });
      }
    }
    return { ok: results.every((r) => r.ok) && prove.every((p) => p.caught), results, prove, ms: Date.now() - t0 };
  }

  ZR.checks = { run, CHECKS, PROOFS };
})();
