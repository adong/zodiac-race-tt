/* TT Zodiac Race: the twelve animals of the 十二生肖 in their order, and the birth-year finder ("what animal am I?").
   No Three.js here, so it runs in Node too (tools/check.js).

   The animal of a year: 2020 was a Rat year, and the animals go round every 12 years, so (year - 4) mod 12 counts from
   the Rat. The catch is the start of the year: a zodiac year starts at Chinese New Year (between January 21 and
   February 20), not on January 1. Someone born on February 10, 2018 is a Rooster, because the Dog year began on
   February 16, 2018. CNY below has the date of Chinese New Year for 1924-2043 (ten full rounds of twelve); the checks
   prove every one of them is the day of a new moon in Beijing, with an astronomy formula (Meeus, Astronomical
   Algorithms, chapter 49) in moonCheck(). */
(function () {
  'use strict';
  const ZR = (window.ZR = window.ZR || {});

  // land and water: how the animal runs and swims compared with the others (the race evens out the totals, so every
  // animal is as fast over the whole course; see js/race.js). power: its special move, from the story.
  const ANIMALS = [
    { id: 'rat', emoji: '🐀', name: 'RAT', zh: '鼠', py: 'shǔ', land: 1.1, water: 0.9, power: 'ride', host: 'ox', color: '#9aa0ad' },
    { id: 'ox', emoji: '🐂', name: 'OX', zh: '牛', py: 'niú', land: 0.92, water: 1.06, power: 'plow', color: '#8a5a36' },
    { id: 'tiger', emoji: '🐅', name: 'TIGER', zh: '虎', py: 'hǔ', land: 0.98, water: 1.06, power: 'swim', color: '#ff9a1f' },
    { id: 'rabbit', emoji: '🐇', name: 'RABBIT', zh: '兔', py: 'tù', land: 1.16, water: 0.88, power: 'hop', color: '#f4efe8' },
    { id: 'dragon', emoji: '🐉', name: 'DRAGON', zh: '龙', py: 'lóng', land: 0.95, water: 1.04, power: 'fly', color: '#2fbf71' },
    { id: 'snake', emoji: '🐍', name: 'SNAKE', zh: '蛇', py: 'shé', land: 0.92, water: 1.05, power: 'ride', host: 'horse', color: '#7ac943' },
    { id: 'horse', emoji: '🐎', name: 'HORSE', zh: '马', py: 'mǎ', land: 1.2, water: 0.88, power: 'gallop', color: '#b5733e' },
    { id: 'goat', emoji: '🐐', name: 'GOAT', zh: '羊', py: 'yáng', land: 1.04, water: 0.95, power: 'raft', color: '#efe9dc' },
    { id: 'monkey', emoji: '🐒', name: 'MONKEY', zh: '猴', py: 'hóu', land: 1.08, water: 0.93, power: 'swing', color: '#9a6a3f' },
    { id: 'rooster', emoji: '🐓', name: 'ROOSTER', zh: '鸡', py: 'jī', land: 1.05, water: 0.94, power: 'flap', color: '#f6f1e7' },
    { id: 'dog', emoji: '🐕', name: 'DOG', zh: '狗', py: 'gǒu', land: 1.0, water: 1.03, power: 'paddle', color: '#d9a066' },
    { id: 'pig', emoji: '🐖', name: 'PIG', zh: '猪', py: 'zhū', land: 0.96, water: 1.0, power: 'snack', color: '#ffb3c7' },
  ];
  ANIMALS.forEach((a, i) => { a.order = i + 1; });
  const byId = {};
  ANIMALS.forEach((a) => { byId[a.id] = a; });

  // what each power is called on its button and in the toast, and what it does (the numbers are in js/race.js)
  const POWERS = {
    ride: { label: 'RIDE', say: 'HOP ON THE {HOST}!' },
    plow: { label: 'STRONG', say: 'STRONG OX, PUSH THROUGH!' },
    swim: { label: 'SWIM', say: 'TIGER SWIM!' },
    hop: { label: 'HOP', say: 'HOP HOP HOP!' },
    fly: { label: 'FLY', say: 'DRAGON FLY!' },
    gallop: { label: 'GALLOP', say: 'GALLOP!' },
    raft: { label: 'RAFT', say: 'RAFT TIME!' },
    swing: { label: 'SWING', say: 'SWING!' },
    flap: { label: 'FLAP', say: 'FLAP FLAP!' },
    paddle: { label: 'PADDLE', say: 'DOGGY PADDLE!' },
    snack: { label: 'SNACK', say: 'SNACK POWER!' },
  };

  // Chinese New Year, 1924-2043: [month, day] for each year. Checked against the new moon by moonCheck().
  const CNY_FIRST = 1924;
  const CNY = [
    [2, 5], [1, 24], [2, 13], [2, 2], [1, 23], [2, 10], // 1924-1929
    [1, 30], [2, 17], [2, 6], [1, 26], [2, 14], [2, 4], [1, 24], [2, 11], [1, 31], [2, 19], // 1930s
    [2, 8], [1, 27], [2, 15], [2, 5], [1, 25], [2, 13], [2, 2], [1, 22], [2, 10], [1, 29], // 1940s
    [2, 17], [2, 6], [1, 27], [2, 14], [2, 3], [1, 24], [2, 12], [1, 31], [2, 18], [2, 8], // 1950s
    [1, 28], [2, 15], [2, 5], [1, 25], [2, 13], [2, 2], [1, 21], [2, 9], [1, 30], [2, 17], // 1960s
    [2, 6], [1, 27], [2, 15], [2, 3], [1, 23], [2, 11], [1, 31], [2, 18], [2, 7], [1, 28], // 1970s
    [2, 16], [2, 5], [1, 25], [2, 13], [2, 2], [2, 20], [2, 9], [1, 29], [2, 17], [2, 6], // 1980s
    [1, 27], [2, 15], [2, 4], [1, 23], [2, 10], [1, 31], [2, 19], [2, 7], [1, 28], [2, 16], // 1990s
    [2, 5], [1, 24], [2, 12], [2, 1], [1, 22], [2, 9], [1, 29], [2, 18], [2, 7], [1, 26], // 2000s
    [2, 14], [2, 3], [1, 23], [2, 10], [1, 31], [2, 19], [2, 8], [1, 28], [2, 16], [2, 5], // 2010s
    [1, 25], [2, 12], [2, 1], [1, 22], [2, 10], [1, 29], [2, 17], [2, 6], [1, 26], [2, 13], // 2020s
    [2, 3], [1, 23], [2, 11], [1, 31], [2, 19], [2, 8], [1, 28], [2, 15], [2, 4], [1, 24], // 2030s
    [2, 12], [2, 1], [1, 22], [2, 10], // 2040-2043
  ];
  const MONTHS = ['JANUARY', 'FEBRUARY'];

  function mod(a, n) { return ((a % n) + n) % n; }
  // the animal of a zodiac year (the year Chinese New Year falls in)
  function animalOfYear(y) { return ANIMALS[mod(y - 4, 12)]; }
  function newYear(y) {
    const d = CNY[y - CNY_FIRST];
    return d ? { year: y, month: d[0], day: d[1] } : null;
  }
  // The finder: someone born in `year` (and, if known, on month/day). Says which animal, and what the caveat is:
  // `early` is the animal for a birthday before that year's Chinese New Year (the year before's animal).
  function find(year, month, day) {
    const ny = newYear(year);
    const out = { year, animal: animalOfYear(year), early: animalOfYear(year - 1), newYear: ny };
    if (month && day && ny) out.born = month < ny.month || (month === ny.month && day < ny.day) ? out.early : out.animal;
    else if (month && day) out.born = month > 2 || (month === 2 && day > 20) ? out.animal : null; // outside the table: only sure after Feb 20
    return out;
  }
  // the animal of a calendar date (today's year animal, for "this year is the year of the Horse")
  function animalOfDate(date) {
    const y = date.getFullYear();
    return find(y, date.getMonth() + 1, date.getDate()).born || animalOfYear(y);
  }

  // ---------------------------------------------------------------- the moon, for the check
  // Julian Ephemeris Day of new moon number k (k = 0 is the one of 6 January 2000), Meeus chapter 49.
  function newMoonJDE(k) {
    const r = Math.PI / 180;
    const T = k / 1236.85, T2 = T * T, T3 = T2 * T, T4 = T3 * T;
    let jde = 2451550.09766 + 29.530588861 * k + 0.00015437 * T2 - 0.00000015 * T3 + 0.00000000073 * T4;
    const E = 1 - 0.002516 * T - 0.0000074 * T2;
    const M = (2.5534 + 29.1053567 * k - 0.0000014 * T2 - 0.00000011 * T3) * r;
    const Mp = (201.5643 + 385.81693528 * k + 0.0107582 * T2 + 0.00001238 * T3 - 0.000000058 * T4) * r;
    const F = (160.7108 + 390.67050284 * k - 0.0016118 * T2 - 0.00000227 * T3 + 0.000000011 * T4) * r;
    const Om = (124.7746 - 1.56375588 * k + 0.0020672 * T2 + 0.00000215 * T3) * r;
    const s = Math.sin;
    jde += -0.4072 * s(Mp) + 0.17241 * E * s(M) + 0.01608 * s(2 * Mp) + 0.01039 * s(2 * F) + 0.00739 * E * s(Mp - M)
      - 0.00514 * E * s(Mp + M) + 0.00208 * E * E * s(2 * M) - 0.00111 * s(Mp - 2 * F) - 0.00057 * s(Mp + 2 * F)
      + 0.00056 * E * s(2 * Mp + M) - 0.00042 * s(3 * Mp) + 0.00042 * E * s(M + 2 * F) + 0.00038 * E * s(M - 2 * F)
      - 0.00024 * E * s(2 * Mp - M) - 0.00017 * s(Om) - 0.00007 * s(Mp + 2 * M) + 0.00004 * s(2 * Mp - 2 * F)
      + 0.00004 * s(3 * M) + 0.00003 * s(Mp + M - 2 * F) + 0.00003 * s(2 * Mp + 2 * F) - 0.00003 * s(Mp + M + 2 * F)
      + 0.00003 * s(Mp - M + 2 * F) - 0.00002 * s(Mp - M - 2 * F) - 0.00002 * s(3 * Mp + M) + 0.00002 * s(4 * Mp);
    // the biggest planetary terms
    jde += 0.000325 * s((299.77 + 0.107408 * k - 0.009173 * T2) * r) + 0.000165 * s((251.88 + 0.016321 * k) * r)
      + 0.000164 * s((251.83 + 26.651886 * k) * r) + 0.000126 * s((349.42 + 36.412478 * k) * r);
    return jde;
  }
  // the calendar date in Beijing (UTC+8) of a Julian Day (TT; ΔT is under 2 minutes for these years)
  function beijingDate(jde) {
    const ms = (jde - 2440587.5) * 86400000 - 70000 + 8 * 3600000;
    const d = new Date(ms);
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), hour: d.getUTCHours() + d.getUTCMinutes() / 60 };
  }
  // For every year in the table: is Chinese New Year the day of a new moon in Beijing, between January 21 and
  // February 20? Returns the problems ([] when all is well). `table` lets the proof hand in a broken copy.
  function moonCheck(table) {
    const problems = [];
    const t = table || CNY;
    t.forEach((md, i) => {
      const y = CNY_FIRST + i;
      const tag = `${y}`;
      if (md[0] === 1 ? md[1] < 21 : md[0] !== 2 || md[1] > 20) problems.push(`${tag}: ${md.join('/')} is outside Jan 21-Feb 20`);
      // the new moon nearest to the table date
      const approx = (y + (md[0] === 1 ? md[1] : 31 + md[1]) / 365.25 - 2000) * 12.3685;
      const nm = beijingDate(newMoonJDE(Math.round(approx)));
      if (nm.y !== y || nm.m !== md[0] || nm.d !== md[1]) problems.push(`${tag}: table says ${md.join('/')}, new moon in Beijing on ${nm.m}/${nm.d}`);
    });
    return problems;
  }

  ZR.zodiac = {
    ANIMALS, POWERS, byId, get: (id) => byId[id], MONTHS, CNY_FIRST, CNY_LAST: CNY_FIRST + CNY.length - 1,
    animalOfYear, newYear, find, animalOfDate, newMoonJDE, beijingDate, moonCheck, table: () => CNY.map((d) => d.slice()),
  };
})();
