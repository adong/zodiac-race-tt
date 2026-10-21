/* TT Zodiac Race: the game. Home (pick your animal, who races and how hard), the story of the Great Race, the
   birth-year finder, the line-up game, the race (the count-in, steering, hopping, powers, the brother's cloud ride,
   the finish at the Jade Emperor's palace), pause and results. Exposes window.game for tests:
     game.start({ who, animals: { teddy, tommy }, levels: { teddy, tommy }, seed })   who: 'teddy' | 'tommy' | 'both'
     game.step(seconds, fast)  advance at 60 steps a second, drawing as it goes (works in a hidden tab); fast: only the last
     game.hold(true)           only game.step() moves time
     game.steer(pl, dir) / game.jump(pl) / game.power(pl) / game.buddy(pl) / game.five() / game.pause(bool) / game.home()
     game.story(open) / game.finder(open, year) / game.lineup(open) / game.pick(i)
     game.autopilot(kind)      'perfect' | 'teddy' | 'kid' | 'idle' | 'mash' | 'buddy' | null, for every brother
     game.check()              the headless checks, with their proofs (js/checks.js)
     game.info()               state, race time, every animal */
(function () {
  'use strict';
  const T = THREE;
  const ZR = window.ZR;
  const Z = ZR.zodiac, RACE = ZR.race, W = ZR.world;
  const $ = (id) => document.getElementById(id);
  const tr = (s) => Kit.lang.t(s);
  const { rand, pick } = Kit.gfx;

  // ---------------------------------------------------------------- saved choices and scores
  const STORE = 'zodiacRaceTT.v1';
  const save = {
    who: 'teddy', animal: { teddy: 'tiger', tommy: 'rabbit' }, level: { teddy: 'easy', tommy: 'easy' },
    best: {}, wins: { teddy: 0, tommy: 0 }, family: [], lineup: {},
  };
  try { Object.assign(save, JSON.parse(localStorage.getItem(STORE) || '{}')); } catch (e) { /* storage blocked */ }
  function persist() { try { localStorage.setItem(STORE, JSON.stringify(save)); } catch (e) { /* storage blocked */ } }

  const ROSTER = { teddy: Kit.roster.get('teddy'), tommy: Kit.roster.get('tommy') };
  const TREATS = [['🍦', 'ICE CREAM'], ['💧', 'WATER'], ['🧃', 'JUICE BOX'], ['🍪', 'COOKIE'], ['🍉', 'WATERMELON'], ['🍌', 'BANANA']];
  const FRIENDS = [
    { id: 'foxy', kind: 'fox', name: 'FOXY', tag: '#ff9a6b', likes: ['dragon', 'horse', 'tiger', 'dog', 'ox'] },
    { id: 'froggy', kind: 'frog', name: 'FROGGY', tag: '#9be37a', likes: ['rabbit', 'goat', 'pig', 'monkey', 'rooster'] },
  ];
  const RIDER = 0.6; // the brothers ride at 60 % of full size

  const STORY = [
    { art: '👑🏞️🐾', text: 'Long, long ago, the Jade Emperor wanted a way to count the years. He said: "Let\'s have a race across the great river! The first twelve animals to reach my palace will each get a year."' },
    { art: '🐀🐂💨', text: 'The clever Rat couldn\'t swim very well, so she asked the kind Ox for a ride on his back. Just before the end, she jumped off and came 1st! The Ox came 2nd.' },
    { art: '🐅🐇🐉', text: 'The strong Tiger swam hard against the water: 3rd. The Rabbit hopped across on stones and a floating log: 4th. The Dragon could fly, but he stopped to make rain for thirsty people and help the Rabbit: 5th.' },
    { art: '🐍🐎🐐🐒🐓', text: 'The Snake hid on the Horse\'s hoof, then jumped out: SURPRISE! Snake 6th, Horse 7th. The Goat, the Monkey and the Rooster found a raft and crossed together, as a team: 8th, 9th and 10th.' },
    { art: '🐕🐖💤', text: 'The Dog loved the water so much that he stopped to play and take a bath: 11th. Last came the Pig, who stopped for a snack and a nap: 12th!' },
    { art: '🎉🧧🎆', text: 'That\'s the order of the twelve zodiac animals. Every year has one of them, and it goes round and round, every twelve years. What animal are you?' },
  ];

  // ---------------------------------------------------------------- state
  let state = 'loading'; // home | count | race | finish | results
  let paused = false, held = false, overlay = null; // overlay: 'story' | 'finder' | 'lineup' | null
  let race = null, players = [];   // players: ['teddy'] or ['teddy', 'tommy']
  let picker = 'teddy';            // with BOTH, whose animal a tap on a card picks
  let pilotKind = null;
  const A3 = {};                   // animal id -> 3D animal
  let riders = {}, critters = {}, buddies = {}, cloudFor = [];
  let cams = [], homeCam = null, endCam = null, views = [];
  let lastNow = 0;
  let celebrate = null;
  const seqs = [];                 // the brother's visit, per player
  let props = [];                  // thrown treats, the basketball
  let portraits = {};
  let countShown = 99;
  let lastStretch = [];
  let shake = [0, 0];
  let fiveT = 0;
  let mountOf = {};                // animal id -> rider ('teddy' | 'tommy' | 'foxy' | 'froggy')
  let raftMesh = null;

  // ---------------------------------------------------------------- setup
  function init() {
    W.init($('game'));
    homeCam = W.newCamera();
    endCam = W.newCamera();
    portraits = Kit.portraits([ROSTER.teddy, ROSTER.tommy], { size: 128 });
    for (const a of Z.ANIMALS) { A3[a.id] = ZR.animals.build(a.id); W.add(A3[a.id].root); }
    for (const id of ['teddy', 'tommy']) {
      riders[id] = Kit.people.build(ROSTER[id].look);
      riders[id].root.scale.setScalar(RIDER);
      buddies[id] = Kit.people.build(ROSTER[id].look);
      buddies[id].root.scale.setScalar(RIDER * (ROSTER[id].buddyScale || 0.8));
    }
    for (const f of FRIENDS) {
      critters[f.id] = ZR.animals.critter(f.kind);
      const tag = Kit.gfx.nameTag(f.name, f.tag);
      tag.position.set(0, 1.55, 0);
      critters[f.id].root.add(tag);
    }
    raftMesh = ZR.animals.raft().root;
    raftMesh.visible = false;
    W.add(raftMesh);
    homeUI();
    hudUI();
    overlaysUI();
    window.addEventListener('resize', () => { W.resize(); layout(); });
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', () => Kit.sound.init(), { capture: true });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && game.autoPause && (state === 'race' || state === 'count')) setPause(true);
    });
    Kit.sound.onMute((m) => { $('muteBtn').textContent = m ? '🔇' : '🔊'; });
    $('muteBtn').textContent = Kit.sound.isMuted() ? '🔇' : '🔊';
    Kit.lang.onChange(() => { W.relabel(); refreshHome(); drawFinder(); if (overlay === 'story') drawStory(); if (state === 'results') drawResults(); });
    goHome();
    $('loading').classList.add('hidden');
    setTimeout(() => $('loading').remove(), 500);
    lastNow = performance.now();
    requestAnimationFrame(loop);
  }

  // who rides which animal: the brothers on theirs, Foxy and Froggy on the first free ones they like
  function assignRiders() {
    mountOf = {};
    for (const id of players) mountOf[save.animal[id]] = id;
    for (const f of FRIENDS) {
      const a = f.likes.find((x) => !mountOf[x]);
      if (a) mountOf[a] = f.id;
    }
    const scene = W.scene();
    for (const id in riders) if (riders[id].root.parent) riders[id].root.parent.remove(riders[id].root);
    for (const id in critters) if (critters[id].root.parent) critters[id].root.parent.remove(critters[id].root);
    for (const a in mountOf) {
      const who = mountOf[a], A = A3[a];
      if (riders[who]) {
        const p = riders[who];
        A.seat.add(p.root);
        p.root.position.set(0, 0.02 - 0.88 * RIDER, 0);
      } else {
        const c = critters[who];
        A.seat.add(c.root);
        c.root.position.set(0, 0, 0);
      }
    }
    void scene;
  }

  function newRace(seed) {
    players = save.who === 'both' ? ['teddy', 'tommy'] : [save.who];
    if (players.length === 2 && save.animal.teddy === save.animal.tommy) save.animal.tommy = Z.ANIMALS[(Z.byId[save.animal.teddy].order) % 12].id;
    race = RACE.create({
      players: players.map((id) => ({ animal: save.animal[id], who: id, level: save.level[id] })),
      seed: seed === undefined ? Math.floor(Math.random() * 1e6) : seed,
    });
    W.build(race);
    assignRiders();
    cams = players.map(() => W.newCamera());
    seqs.length = 0;
    players.forEach(() => seqs.push(null));
    for (const c of cloudFor) if (c) W.remove(c.root);
    cloudFor = players.map(() => null);
    celebrate = null;
    countShown = 99;
    lastStretch = players.map(() => 'meadow');
    props.forEach((p) => W.scene().remove(p.sp));
    props = [];
    fiveT = 0;
    placeAnimals(0);
  }

  // ---------------------------------------------------------------- home
  function homeUI() {
    const cards = $('cards');
    Z.ANIMALS.forEach((a, i) => {
      const b = document.createElement('button');
      b.className = 'card';
      b.dataset.i = i;
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-label', a.name);
      b.innerHTML = `<span class="num">${a.order}</span><span class="emo">${a.emoji}</span><span class="nm">${a.name}</span><span class="py" data-no-lang></span><span class="faces"></span>`;
      b.addEventListener('click', () => pickCard(i));
      cards.appendChild(b);
    });
    document.querySelectorAll('#who button').forEach((b) => b.addEventListener('click', () => pickWho(b.dataset.who)));
    document.querySelector('#who [data-who="teddy"] img').src = portraits.teddy;
    document.querySelector('#who [data-who="tommy"] img').src = portraits.tommy;
    const duo = document.querySelectorAll('#who .duo img');
    duo[0].src = portraits.teddy;
    duo[1].src = portraits.tommy;
    $('playBtn').addEventListener('click', () => startRace());
    $('storyBtn').addEventListener('click', () => openOverlay('story'));
    $('finderBtn').addEventListener('click', () => openOverlay('finder'));
    $('lineupBtn').addEventListener('click', () => openOverlay('lineup'));
    const t = window.ZR_TITLE.split(' ');
    $('logo').querySelector('small').textContent = t.slice(0, -2).join(' ');
    $('logo').querySelector('big').textContent = t.slice(-2).join(' ');
  }

  function pickCard(i) {
    Kit.sound.init();
    const id = Z.ANIMALS[i].id;
    const who = save.who === 'both' ? picker : save.who;
    const other = who === 'teddy' ? 'tommy' : 'teddy';
    if (save.who === 'both' && save.animal[other] === id) save.animal[other] = save.animal[who]; // swap
    save.animal[who] = id;
    if (save.who === 'both') picker = other;
    persist();
    Kit.sound.click();
    newRace();
    refreshHome();
  }
  function pickWho(w) {
    save.who = w;
    picker = 'teddy';
    persist();
    Kit.sound.click();
    newRace();
    refreshHome();
    layout();
  }
  function moveAnimal(who, d) {
    const other = who === 'teddy' ? 'tommy' : 'teddy';
    let i = Z.byId[save.animal[who]].order - 1;
    do { i = (i + d + 12) % 12; } while (save.who === 'both' && Z.ANIMALS[i].id === save.animal[other]);
    save.animal[who] = Z.ANIMALS[i].id;
    persist();
    Kit.sound.click();
    newRace();
    refreshHome();
  }
  function setLevel(who, lv) {
    save.level[who] = lv;
    persist();
    Kit.sound.click();
    newRace();
    refreshHome();
  }

  function fmt(t) { return t === null || t === undefined ? '' : `${t.toFixed(1)} s`; }
  function bestKey(animal, level) { return `${animal}/${level}`; }

  function refreshHome() {
    const zh = Kit.lang.is('zh');
    const who = save.who === 'both' ? ['teddy', 'tommy'] : [save.who];
    document.querySelectorAll('#cards .card').forEach((b, i) => {
      const a = Z.ANIMALS[i];
      const mine = who.filter((w) => save.animal[w] === a.id);
      b.classList.toggle('on', mine.length > 0);
      b.classList.toggle('on2', mine.length === 1 && mine[0] === 'tommy' && save.who === 'both');
      b.setAttribute('aria-checked', mine.length > 0 ? 'true' : 'false');
      b.querySelector('.py').textContent = zh ? a.zh : a.py;
      b.querySelector('.faces').innerHTML = save.who === 'both' ? mine.map((w) => `<img src="${portraits[w]}" alt="">`).join('') : '';
    });
    document.querySelectorAll('#who button').forEach((b) => {
      b.classList.toggle('on', b.dataset.who === save.who);
      b.setAttribute('aria-checked', b.dataset.who === save.who ? 'true' : 'false');
      const c = b.querySelector('.cups');
      if (c) c.textContent = save.wins[b.dataset.who] ? `🏆${save.wins[b.dataset.who]}` : '';
    });
    const lv = $('lvls');
    lv.innerHTML = '';
    for (const id of who) {
      const box = document.createElement('div');
      box.className = 'lvl';
      box.innerHTML = `<img src="${portraits[id]}" alt=""><button data-l="easy" aria-label="Easy"><span>🐣</span>EASY</button><button data-l="normal" aria-label="Normal"><span>🔥</span>NORMAL</button>`;
      box.querySelectorAll('button').forEach((b) => {
        b.classList.toggle('on', save.level[id] === b.dataset.l);
        b.addEventListener('click', () => setLevel(id, b.dataset.l));
      });
      lv.appendChild(box);
    }
  }

  function goHome() {
    state = 'home';
    paused = false;
    setOverlay('pause', false);
    setOverlay('results', false);
    $('home').classList.remove('hidden');
    $('hud').classList.add('hidden');
    $('pads').classList.add('hidden');
    $('buddyBtn').classList.add('hidden');
    $('fiveBtn').classList.add('hidden');
    $('split').classList.add('hidden');
    $('toasts').innerHTML = '';
    newRace();
    refreshHome();
    layout();
    Kit.sound.music('title');
    ZR.sfx.tune(true);
  }

  // ---------------------------------------------------------------- overlays: story, finder, line-up
  function setOverlay(id, on) { $(id).classList.toggle('hidden', !on); }
  function openOverlay(which) {
    if (state !== 'home' && state !== 'results') return;
    Kit.sound.init();
    Kit.sound.click();
    overlay = which;
    if (which === 'story') { storyPage = 0; drawStory(); }
    if (which === 'finder') { typed = ''; drawFinder(); }
    if (which === 'lineup') lineupStart();
    setOverlay(which, true);
  }
  function closeOverlay() {
    if (!overlay) return;
    setOverlay(overlay, false);
    if (overlay === 'lineup') clearTimeout(lq.hintTimer);
    overlay = null;
    Kit.sound.click();
  }

  function overlaysUI() {
    $('sPrev').addEventListener('click', () => storyTurn(-1));
    $('sNext').addEventListener('click', () => storyTurn(1));
    $('sClose').addEventListener('click', closeOverlay);
    $('fClose').addEventListener('click', closeOverlay);
    $('lClose').addEventListener('click', closeOverlay);
    $('lAgain').addEventListener('click', () => lineupStart());
    document.querySelectorAll('#finder [data-dy]').forEach((b) => b.addEventListener('click', () => finderYear(fYear + +b.dataset.dy)));
    $('fEarly').addEventListener('click', () => { fEarly = !fEarly; Kit.sound.click(); drawFinder(); });
    for (const e of ['👦', '🧒', '👨', '👩', '👴', '👵']) {
      const b = document.createElement('button');
      b.textContent = e;
      b.setAttribute('aria-label', 'Save this year');
      b.addEventListener('click', () => saveFamily(e));
      $('fSavers').appendChild(b);
    }
    for (const [id, fn] of [['pResume', () => setPause(false)], ['pRestart', () => startRace({ seed: race.seed })], ['pHome', goHome],
      ['rAgain', () => startRace()], ['rHome', goHome]]) $(id).addEventListener('click', fn);
  }

  // the story
  let storyPage = 0;
  function storyTurn(d) {
    const n = storyPage + d;
    if (n < 0) return;
    if (n >= STORY.length) { closeOverlay(); return; }
    storyPage = n;
    Kit.sound.click();
    drawStory();
  }
  function drawStory() {
    const p = STORY[storyPage];
    const art = $('sArt');
    art.textContent = p.art;
    art.style.animation = 'none';
    void art.offsetWidth;
    art.style.animation = '';
    $('sText').textContent = p.text;
    $('sDots').innerHTML = STORY.map((s, i) => `<i class="${i === storyPage ? 'on' : ''}"></i>`).join('');
    $('sPrev').style.visibility = storyPage === 0 ? 'hidden' : 'visible';
  }

  // the birth-year finder
  let fYear = new Date().getFullYear(), fEarly = false, typed = '';
  function finderYear(y) {
    fYear = Math.max(1900, Math.min(2100, y));
    typed = '';
    Kit.sound.click();
    drawFinder();
  }
  function finderResult() {
    const f = Z.find(fYear);
    return { f, animal: fEarly ? f.early : f.animal };
  }
  function drawFinder() {
    const { f, animal } = finderResult();
    const yEl = $('fYear');
    yEl.textContent = typed ? typed.padEnd(4, '_') : String(fYear);
    yEl.classList.toggle('typing', !!typed);
    const zh = Kit.lang.is('zh');
    $('fBig').innerHTML = `<span class="emo">${animal.emoji}</span><span class="txt"><span class="nm">${animal.name}</span><span class="sub" data-no-lang>${zh ? animal.zh : animal.py}</span><span class="sub">NUMBER ${animal.order} OF 12</span></span>`;
    const ny = f.newYear;
    const when = ny ? `${Z.MONTHS[ny.month - 1]} ${ny.day}` : null;
    $('fEarly').classList.toggle('on', fEarly);
    $('fEarly').querySelector('.box').textContent = fEarly ? '✔' : '';
    $('fEarlyText').textContent = when ? `BORN BEFORE ${when}?` : 'BORN BEFORE CHINESE NEW YEAR?';
    let note;
    if (fEarly) note = ny ? `Chinese New Year ${fYear} was on ${when}. Born before it? Then you're still in the year before: the ${f.early.name}!` : `Born before Chinese New Year (late January to mid February)? Then you're still in the year before: the ${f.early.name}!`;
    else note = ny ? `A zodiac year starts at Chinese New Year, not on January 1. In ${fYear} that was ${when}: born on it or after, you're a ${f.animal.name}.` : `A zodiac year starts at Chinese New Year, between late January and mid February. Born after it, you're a ${f.animal.name}.`;
    const base = fEarly ? fYear - 1 : fYear;
    const years = [-24, -12, 0, 12, 24].map((d) => base + d).filter((y) => y >= 1900 && y <= 2100);
    const spans = $('fNote').children;
    spans[0].textContent = note;
    spans[1].textContent = `${animal.name} YEARS: ${years.join(', ')}`;
    const fam = $('fFamily');
    fam.innerHTML = '';
    save.family.forEach((m, i) => {
      const a = Z.byId[m.animal];
      const c = document.createElement('div');
      c.className = 'chip';
      c.innerHTML = `<span>${m.who} ${m.year}${m.early ? '*' : ''} ${a.emoji}</span><button class="x" aria-label="Remove">✖</button>`;
      c.querySelector('span').addEventListener('click', () => { fYear = m.year; fEarly = !!m.early; Kit.sound.click(); drawFinder(); });
      c.querySelector('.x').addEventListener('click', () => { save.family.splice(i, 1); persist(); drawFinder(); });
      fam.appendChild(c);
    });
  }
  function saveFamily(emoji) {
    const { animal } = finderResult();
    save.family.push({ who: emoji, year: fYear, early: fEarly, animal: animal.id });
    if (save.family.length > 10) save.family.shift();
    persist();
    ZR.sfx.chime(4);
    drawFinder();
  }
  function finderKey(k, e) {
    if (/^Digit\d$|^Numpad\d$/.test(k)) {
      typed = (typed + k.slice(-1)).slice(0, 4);
      if (typed.length === 4) { const y = +typed; typed = ''; fYear = Math.max(1900, Math.min(2100, y)); }
      drawFinder();
    } else if (k === 'Backspace') { typed = typed.slice(0, -1); drawFinder(); }
    else if (k === 'ArrowLeft' || k === 'KeyA') finderYear(fYear - 1);
    else if (k === 'ArrowRight' || k === 'KeyD') finderYear(fYear + 1);
    else if (k === 'ArrowDown' || k === 'KeyS') finderYear(fYear - 10);
    else if (k === 'ArrowUp' || k === 'KeyW') finderYear(fYear + 10);
    else if (k === 'KeyE' || k === 'Space') { fEarly = !fEarly; drawFinder(); }
    else if (k === 'Escape' || k === 'KeyY' || k === 'Enter') closeOverlay();
    else return false;
    e.preventDefault();
    return true;
  }

  // the line-up game: tap the animals in zodiac order
  const lq = { next: 0, misses: 0, t0: 0, done: false, hintTimer: null, order: [] };
  function lineupStart() {
    lq.next = 0; lq.misses = 0; lq.t0 = performance.now(); lq.done = false;
    lq.order = Z.ANIMALS.map((a, i) => i).sort(() => Math.random() - 0.5);
    $('lSlots').innerHTML = Z.ANIMALS.map((a, i) => `<div class="slot${i === 0 ? ' next' : ''}"><b>${i + 1}</b></div>`).join('');
    const tiles = $('lTiles');
    tiles.innerHTML = '';
    tiles.style.display = '';
    lq.order.forEach((i) => {
      const a = Z.ANIMALS[i];
      const b = document.createElement('button');
      b.className = 'tile';
      b.textContent = a.emoji;
      b.dataset.i = i;
      b.setAttribute('aria-label', a.name);
      b.addEventListener('click', () => lineupTap(i, b));
      tiles.appendChild(b);
    });
    $('lAgain').classList.add('hidden');
    lineupLine();
    lineupHintLater();
  }
  function lineupLine() {
    $('lLine').textContent = lq.done ? '' : `WHO COMES ${placeWord(lq.next + 1)}?`;
  }
  function lineupHintLater() {
    clearTimeout(lq.hintTimer);
    const easy = (save.level[players[0] || 'teddy'] || 'easy') === 'easy';
    lq.hintTimer = setTimeout(lineupHint, easy ? 4000 : 9000);
  }
  function lineupHint() {
    const b = document.querySelector(`#lTiles .tile[data-i="${lq.next}"]`);
    if (b && !lq.done) b.classList.add('hint');
  }
  function lineupTap(i, b) {
    if (lq.done) return;
    Kit.sound.init();
    if (i !== lq.next) {
      lq.misses++;
      b.classList.remove('shake');
      void b.offsetWidth;
      b.classList.add('shake');
      ZR.sfx.wrong();
      toast(`NOT YET! ${Z.ANIMALS[i].emoji} IS NUMBER ${i + 1}`, 'oops');
      if ((save.level[players[0] || 'teddy'] || 'easy') === 'easy') lineupHint();
      return;
    }
    b.classList.add('gone');
    const slots = $('lSlots').children;
    slots[i].classList.remove('next');
    slots[i].classList.add('full');
    slots[i].innerHTML = `<b>${i + 1}</b>${Z.ANIMALS[i].emoji}`;
    ZR.sfx.chime(i);
    lq.next++;
    if (lq.next < 12) { slots[lq.next].classList.add('next'); lineupLine(); lineupHintLater(); return; }
    lq.done = true;
    clearTimeout(lq.hintTimer);
    const t = (performance.now() - lq.t0) / 1000;
    const who = players[0] || 'teddy';
    const prev = save.lineup[who];
    const nb = !prev || t < prev;
    if (nb) { save.lineup[who] = t; persist(); }
    $('lLine').textContent = `🎉 YOU KNOW THE ZODIAC! ${fmt(t)}${nb ? ' · NEW BEST!' : ''}`;
    $('lTiles').style.display = 'none';
    $('lAgain').classList.remove('hidden');
    ZR.sfx.finish(true);
    confetti(120);
  }

  // ---------------------------------------------------------------- the race
  function startRace(o) {
    o = o || {};
    if (o.who) save.who = o.who;
    if (o.animals) Object.assign(save.animal, o.animals);
    if (o.levels) Object.assign(save.level, o.levels);
    if (overlay) closeOverlay();
    Kit.sound.init();
    newRace(o.seed);
    if (pilotKind) game.autopilot(pilotKind);
    state = 'count';
    paused = false;
    $('home').classList.add('hidden');
    setOverlay('results', false);
    setOverlay('pause', false);
    $('hud').classList.remove('hidden');
    $('pads').classList.remove('hidden');
    $('toasts').innerHTML = '';
    bits.length = 0;
    ZR.sfx.tune(false);
    Kit.sound.music('play');
    padsUI();
    trackUI();
    $('track').classList.remove('hidden');
    $('buddyBtn').classList.toggle('hidden', players.length !== 1);
    $('fiveBtn').classList.toggle('hidden', players.length !== 2);
    $('split').classList.toggle('hidden', players.length !== 2);
    if (players.length === 1) $('buddyFace').src = portraits[Kit.roster.buddyFor(players[0])];
    layout();
  }

  function setPause(p) {
    if (state !== 'race' && state !== 'count') p = false;
    paused = p;
    setOverlay('pause', p);
    Kit.sound.music(p ? 'pause' : 'play');
  }

  const R0 = (pl) => race && race.players[pl];
  function act(pl) { return race && state === 'race' && !paused && R0(pl) && R0(pl).finishT === null; }
  function steer(pl, dir) { if (act(pl)) RACE.steer(race, R0(pl).i, dir); }
  function jump(pl) { if (act(pl)) RACE.jump(race, R0(pl).i); }
  function power(pl) {
    if (!act(pl)) return;
    if (R0(pl).power < 1) { if (R0(pl).act || R0(pl).ride) return; toast('NOT READY YET!', 'oops'); return; }
    RACE.power(race, R0(pl).i);
  }
  function callBuddy(pl) {
    if (!race || paused || (state !== 'race' && state !== 'count')) return;
    if (players.length === 2) { highFive(); return; }
    if (state !== 'race') return;
    RACE.buddy(race, R0(pl).i);
  }
  function highFive() {
    if (!act(0) && !act(1)) return;
    if (RACE.highFive(race)) {
      fiveT = 1.2;
      ZR.sfx.five();
      toast('✋ HIGH FIVE!', 'good');
      for (const id of players) {
        const P = riders[id];
        P.root.updateMatrixWorld(true);
        W.burst(Kit.people.handWorld(P, 1), '#ffd400', 14, 3, 4);
      }
    }
  }

  // the brother's visit (1 player): hello with his signature move, a treat, then a cloud ride across the next stretch
  function startSeq(pl) {
    const me = players[pl];
    const bid = Kit.roster.buddyFor(me);
    let S = seqs[pl];
    if (!S) {
      const c = ZR.animals.cloud();
      c.root.scale.setScalar(0.9);
      W.add(c.root);
      const P = buddies[bid];
      c.root.add(P.root);
      P.root.position.set(1.6, 0.55, 0.2);
      P.root.scale.setScalar(RIDER * (ROSTER[bid].buddyScale || 0.8) / 0.9);
      const R = R0(pl);
      c.root.position.set(W.laneX(R.lane) + 3, 6, -R.s + 2);
      S = seqs[pl] = { pl, id: bid, entry: ROSTER[bid], P, cloud: c, t: 0, treated: false, out: 0, again: false };
    } else {
      S.t = 0; S.treated = false; S.again = true; S.out = 0;
    }
    ZR.sfx.buddy();
    $('buddyBtn').classList.add('here');
  }
  function updateSeqs(h) {
    seqs.forEach((S, pl) => {
      if (!S) return;
      S.t += h;
      const R = R0(pl);
      const riding = R.cloud && R.cloud.on;
      const c = S.cloud.root;
      const base = new T.Vector3(W.laneX(R.lane) + W.spotX(R.x), W.groundY(R.s), -R.s);
      let target;
      if (S.out > 0) {
        S.out += h;
        target = base.clone().add(new T.Vector3(4 + S.out * 4, 4 + S.out * 5, 4));
        if (S.out > 1.8) { W.remove(c); seqs[pl] = null; $('buddyBtn').classList.remove('here'); return; }
      } else if (riding) target = base.clone().add(new T.Vector3(0, 0.75 + Math.sin(S.t * 2) * 0.15, 0));
      else target = base.clone().add(new T.Vector3(2.8, 2.2 + Math.sin(S.t * 3) * 0.2, -0.5));
      c.position.lerp(target, Math.min(1, h * (riding ? 10 : 5)));
      c.rotation.y = Math.sin(S.t) * 0.08;
      // the brother: signature hello, then he cheers you on
      const k = 1 - Math.exp(-18 * h);
      if (S.t < 1.5) personSignature(S.P, S.t, S.t, k, S.entry);
      else Kit.people.pose(S.P, S.t * 4, riding ? 'wave' : 'peace', k * 0.5);
      if (S.entry.id === 'teddy' && S.t > 0.8 && S.t < 1.5) S.P.root.position.y = 0.55 + Math.sin((S.t - 0.8) / 0.7 * Math.PI) * 0.5;
      else S.P.root.position.y = 0.55;
      if (S.entry.id === 'teddy' && !S.balled && S.t > 1.0) { S.balled = true; shootBall(S.P); }
      if (S.t > 1.5) S.balled = false;
      if (!S.treated && S.t > 1.2) {
        S.treated = true;
        const [emoji, name] = pick(TREATS);
        S.P.root.updateMatrixWorld(true);
        const from = Kit.people.handWorld(S.P, 1);
        throwTreat(emoji, from, riders[players[pl]]);
        toast(`${emoji} ${name} FROM ${S.entry.name.toUpperCase()}!`, 'treat');
      }
      if (S.again && S.treated && S.t > 1.9 && !S.saidAgain) { S.saidAgain = true; toast(`${S.entry.name.toUpperCase()} SAYS: ONE MORE STRETCH!`, 'buddy'); }
      if (S.t < 0.1) S.saidAgain = false;
      if (R.finishT !== null && !S.out) S.out = 0.01;
    });
  }
  function personSignature(p, since, t, k, entry) {
    const sig = entry.signature || ['wave'];
    if (sig[0] === 'boxing') Kit.people.pose(p, since < 0.8 ? since * 8 : t * 3, since < 0.8 ? 'boxing' : 'jumpshot', k);
    else Kit.people.pose(p, t * 4, sig[0], k);
  }
  function throwTreat(emoji, from, P) {
    const sp = new T.Sprite(new T.SpriteMaterial({ map: Kit.gfx.emojiTexture(emoji), depthWrite: false }));
    sp.scale.setScalar(0.9);
    sp.position.copy(from);
    W.scene().add(sp);
    props.push({ sp, from: from.clone(), P, t: 0, dur: 0.6, kind: 'treat' });
  }
  function shootBall(P) {
    P.root.updateMatrixWorld(true);
    const from = Kit.people.handWorld(P, 1);
    const sp = new T.Sprite(new T.SpriteMaterial({ map: Kit.gfx.emojiTexture('🏀'), depthWrite: false }));
    sp.scale.setScalar(0.6);
    sp.position.copy(from);
    W.scene().add(sp);
    props.push({ sp, from: from.clone(), v: new T.Vector3(rand(-1, 1), 7, -3), t: 0, dur: 1.4, kind: 'ball' });
  }
  function updateProps(h) {
    for (let i = props.length - 1; i >= 0; i--) {
      const p = props[i];
      p.t += h;
      if (p.kind === 'treat') {
        p.P.root.updateMatrixWorld(true);
        const to = new T.Vector3();
        p.P.head.getWorldPosition(to);
        const k = Math.min(1, p.t / p.dur);
        p.sp.position.lerpVectors(p.from, to, k);
        p.sp.position.y += Math.sin(k * Math.PI) * 1.6;
      } else {
        p.v.y -= 9 * h;
        p.sp.position.addScaledVector(p.v, h);
      }
      if (p.t >= p.dur) {
        if (p.kind === 'treat') W.burst(p.sp.position, '#ffd400', 10, 2.5, 3);
        W.scene().remove(p.sp);
        props.splice(i, 1);
      }
    }
  }

  // ---------------------------------------------------------------- the loop
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, Math.max(0, (now - lastNow) / 1000));
    lastNow = now;
    if (held) return;
    frame(dt);
  }

  function frame(dt, noDraw) {
    if ((state === 'count' || state === 'race' || state === 'finish' || state === 'results') && !paused) {
      let left = dt;
      while (left > 1e-6) {
        const h = Math.min(1 / 60, left);
        left -= h;
        tick(h);
      }
    } else if (state === 'home' && !paused) {
      clock += dt;
      placeAnimals(dt);
    }
    W.update(paused ? 0 : dt);
    updateCameras(dt);
    if (noDraw) return;
    updateHUD();
    drawFx(dt);
    W.render(views);
  }

  let clock = 0;
  function tick(h) {
    clock += h;
    if (state === 'count' || state === 'race') {
      RACE.step(race, h);
      if (pilots) for (const p of pilots) if (p) p(h);
      processEvents();
      countIn();
      if (fiveT > 0) fiveT -= h;
      updateSeqs(h);
      if (race.done) beginFinish();
    } else {
      // after the race: the animals walk on into the courtyard, the winner celebrates, then the results
      for (const R of race.racers) {
        const stop = RACE.L + 4 + (R.lane % 3) * 2;
        if (R.s < stop) { R.v = Math.max(R.v * Math.exp(-0.5 * h), 2.5); R.s = Math.min(stop, R.s + R.v * h); }
        else R.v = 0;
      }
      celebrate.t += h;
      if (celebrate.t > 1.2 && !celebrate.cheered) { celebrate.cheered = true; doCelebration(); }
      if (celebrate.t > 3.2 && state === 'finish') showResults();
      updateSeqs(h);
    }
    updateProps(h);
    placeAnimals(h);
  }

  // where every animal is and what it's doing, from the race
  const tmpV = new T.Vector3();
  function placeAnimals(h) {
    const k = 1 - Math.exp(-18 * Math.max(h, 1e-3));
    const home = state === 'home' || state === 'loading';
    if (raftMesh) raftMesh.visible = false;
    for (const R of race.racers) {
      const A = A3[R.animal];
      const lx = W.laneX(R.lane);
      let x = lx + W.spotX(R.x), z = -R.s, y = W.groundY(R.s), air = 0, water = W.wetness(R.s), mode = 'run';
      let ry = 0, rz = 0;
      const P = R.act ? RACE.POWERS[R.act.kind] : null;
      if (R.air > 0) air = Math.sin(Math.PI * (1 - R.air / RACE.PHYS.jumpT)) * 1.3;
      if (P) {
        const t = clock;
        if (R.act.kind === 'fly') { air = 2.6 + Math.sin(t * 3) * 0.3; mode = 'fly'; }
        else if (R.act.kind === 'hop') air = Math.abs(Math.sin(t * 6)) * 1.5;
        else if (R.act.kind === 'swing') air = Math.abs(Math.sin(t * 4)) * 2.2;
        else if (R.act.kind === 'flap') { air = 1.4 + Math.sin(t * 8) * 0.3; mode = 'fly'; }
        else if (R.act.kind === 'raft' && water > 0.5) {
          raftMesh.visible = true; // the goat's raft (one at a time is plenty)
          raftMesh.position.set(x, 0.12, z);
          water = 0; air = 0.25;
        }
      }
      if (P && P.air) water = 0;
      if (R.bonk > 0) rz = Math.sin(clock * 30) * 0.15 * (R.bonk / RACE.PHYS.bonk);
      if (R.spin > 0) ry = (1 - R.spin / RACE.PHYS.spin) * Math.PI * 2;
      if (R.cloud && R.cloud.on) { air = 1.1 + Math.sin(clock * 2) * 0.15; water = 0; }
      if (R.ride) {
        // on the host's back
        const H = A3[race.racers[R.ride.host].animal];
        H.seat.getWorldPosition(tmpV);
        x = tmpV.x; y = tmpV.y - 0.1; z = tmpV.z + 0.2; air = 0; water = 0;
      }
      if (home) { mode = mountOf[R.animal] && players.includes(mountOf[R.animal]) ? 'happy' : 'idle'; air = 0; water = 0; }
      if (state === 'finish' || state === 'results') {
        if (R.v < 0.5) mode = 'idle';
        if (celebrate && celebrate.heroes.includes(R.i)) {
          const spot = celebrate.spots[celebrate.heroes.indexOf(R.i)];
          const w = celebrate.walk;
          x = x + (spot.x - x) * w; z = z + (spot.z - z) * w;
          ry = Math.PI * w;
          if (w < 1) mode = 'run';
          else mode = celebrate.cheered && R.place === 1 ? 'happy' : 'idle';
        }
      }
      A.root.position.set(x, y, z);
      A.root.rotation.set(0, ry, rz);
      A.update(h, { t: clock, speed: home ? 0 : R.v, water, air, mode });
      // the rider
      const who = mountOf[R.animal];
      if (riders[who]) riderPose(riders[who], R, h, k, who);
      else if (critters[who]) critters[who].update(h, (state === 'finish' || state === 'results') && R.place <= 3 ? 'cheer' : home ? 'cheer' : 'ride', clock);
    }
    if (celebrate && celebrate.walk < 1) celebrate.walk = Math.min(1, celebrate.walk + h / 2.2);
  }

  function riderPose(p, R, h, k, who) {
    const home = state === 'home' || state === 'loading';
    const entry = ROSTER[who];
    let standing = false;
    if (home) {
      Kit.people.pose(p, clock * 4, 'wave', k);
    } else if (celebrate && celebrate.cheered && celebrate.heroes.includes(R.i) && celebrate.walk >= 1) {
      const since = celebrate.t - 1.2;
      if (R.place === 1 || players.length === 2) { personSignature(p, since % 3, celebrate.t, k, entry); standing = true; }
      else Kit.people.pose(p, clock * 4, 'wave', k);
    } else if (fiveT > 0) {
      Kit.people.pose(p, clock * 4, 'wave', k);
    } else {
      Kit.people.pose(p, clock * 3, 'grab', k);
    }
    if (!standing) {
      // sitting astride: legs forward and out
      p.legL.rotation.x += (1.2 - p.legL.rotation.x) * k;
      p.legR.rotation.x += (1.2 - p.legR.rotation.x) * k;
      p.legL.rotation.z += (-0.45 - p.legL.rotation.z) * k;
      p.legR.rotation.z += (0.45 - p.legR.rotation.z) * k;
      p.root.position.y = 0.02 - 0.88 * RIDER;
      p.root.rotation.y = 0;
    } else {
      p.legL.rotation.z += (0 - p.legL.rotation.z) * k;
      p.legR.rotation.z += (0 - p.legR.rotation.z) * k;
      let up = 0;
      if (entry.id === 'teddy') {
        const s = (celebrate.t - 1.2) % 3;
        if (s > 0.8 && s < 1.5) up = Math.sin((s - 0.8) / 0.7 * Math.PI) * 0.6;
        if (s > 1.0 && !celebrate.ball) { celebrate.ball = true; shootBall(p); }
        if (s < 0.5) celebrate.ball = false;
      }
      p.root.position.y = 0.02 + up;
    }
  }

  function countIn() {
    const n = Math.ceil(-race.t);
    if (race.t < 0 && n !== countShown && n <= 3) {
      countShown = n;
      bigCount(String(n), false);
      ZR.sfx.count(n);
    } else if (race.t >= 0 && countShown !== 0) {
      countShown = 0;
      state = 'race';
      bigCount('GO!', true);
      ZR.sfx.gong();
      toast('RUN TO THE JADE EMPEROR!', 'good');
    }
  }
  function bigCount(text, go) {
    const el = $('bigCount');
    el.textContent = text;
    el.classList.toggle('go', go);
    el.classList.remove('anim');
    void el.offsetWidth;
    el.classList.add('anim');
  }

  const HOSTNAME = (i) => race.racers[i].a.name;
  function processEvents() {
    for (const e of race.events) {
      const R = e.i >= 0 ? race.racers[e.i] : null;
      const pl = R ? race.players.indexOf(R) : -1;
      const mine = pl >= 0;
      const pos = R ? new T.Vector3(W.laneX(R.lane) + W.spotX(R.x), W.groundY(R.s) + 1, -R.s) : null;
      switch (e.type) {
        case 'bonk': case 'log':
          W.burst(pos, '#fff3a0', mine ? 12 : 5, 3, 4);
          if (mine) { ZR.sfx.bonk(); shake[pl] = 0.35; toast(e.type === 'log' ? 'BONK! HOP OVER THE LOGS!' : 'BONK! A ROCK!', 'oops'); }
          break;
        case 'whirl':
          if (mine) { ZR.sfx.whirl(); toast('WHOOSH! A WHIRLPOOL!', 'oops'); }
          break;
        case 'peach':
          W.hidePeach(R.lane, e.item);
          W.burst(pos, '#ffa07a', mine ? 10 : 4, 2, 3);
          if (mine) ZR.sfx.peach(R.peaches);
          break;
        case 'jump': if (mine) ZR.sfx.jump(); break;
        case 'splash':
          W.burst(new T.Vector3(pos.x, 0.3, pos.z), '#e8fbff', mine ? 16 : 6, 3, 5);
          if (mine) { ZR.sfx.splash(); toast('THE GREAT RIVER! SWIM!', 'good'); }
          break;
        case 'shore':
          if (mine) toast('BAMBOO PATH! RUN TO THE PALACE!', 'good');
          break;
        case 'power': {
          W.burst(pos, '#ffd400', mine ? 18 : 6, 3, 5);
          if (mine) {
            ZR.sfx.power(e.kind);
            const P = Z.POWERS[e.kind] || { say: 'SCURRY!' };
            toast(e.kind === 'scurry' ? `TOO FAR FROM THE ${Z.byId[R.a.host].name}! SCURRY!` : P.say.replace('{HOST}', Z.byId[R.a.host || 'ox'].name), 'good');
          }
          break;
        }
        case 'ride': {
          const host = race.racers[e.host];
          if (mine) ZR.sfx.ride();
          else if (host.human) { ZR.sfx.ride(); toast(`${R.a.emoji} THE ${R.a.name} HOPPED ON YOUR ${host.a.name}!`, 'place'); }
          break;
        }
        case 'leap': {
          const host = race.racers[e.host];
          if (mine) toast(`JUMP! THANK YOU, ${HOSTNAME(e.host)}!`, 'good');
          else if (host.human) toast(`${R.a.emoji} SURPRISE! THE ${R.a.name} JUMPED OFF!`, 'place');
          break;
        }
        case 'buddy': if (mine) startSeq(pl); break;
        case 'cloudOn':
          if (mine && seqs[pl]) { ZR.sfx.cloud(); toast(`${seqs[pl].entry.name.toUpperCase()} SAYS: HOP ON! I'LL GIVE YOU A RIDE!`, 'buddy'); }
          break;
        case 'cloudOff':
          if (mine && seqs[pl]) { seqs[pl].out = 0.01; toast('THANK YOU FOR THE RIDE!', 'good'); }
          break;
        case 'finish':
          if (mine) {
            ZR.sfx.finish(e.place === 1);
            toast(`🏯 ${players.length > 1 ? players[pl].toUpperCase() + ': ' : ''}${placeWord(e.place)}!`, e.place === 1 ? 'good' : 'place');
            if (e.place === 1) confetti(100);
          }
          break;
      }
    }
    race.events.length = 0;
    // a toast for each new stretch of the river
    race.players.forEach((R, pl) => {
      const st = RACE.stretchAt(R.s);
      if (st.id !== lastStretch[pl] && R.finishT === null) {
        lastStretch[pl] = st.id;
        if (st.id === 'lotus' || st.id === 'current' || st.id === 'waves') toast(st.name, 'place');
      }
    });
  }

  function placeWord(n) { return `${n}${n === 1 ? 'ST' : n === 2 ? 'ND' : n === 3 ? 'RD' : 'TH'}`; }

  function beginFinish() {
    state = 'finish';
    paused = false;
    const winner = race.racers[race.order[0]];
    // who walks up to the Jade Emperor: the brothers, and the winner if it's someone else
    const heroes = race.players.map((R) => R.i);
    if (!heroes.includes(winner.i)) heroes.unshift(winner.i);
    heroes.sort((a, b) => race.racers[a].place - race.racers[b].place);
    // beside the Jade Emperor's throne (x = 0), the winner nearest, so he's in the picture with them
    const spots = heroes.map((i, n) => ({ x: 4 + n * 3.4, z: -(RACE.L + 21) }));
    celebrate = { t: 0, winner, heroes, spots, walk: 0, cheered: false };
    $('pads').classList.add('hidden');
    $('buddyBtn').classList.add('hidden');
    $('fiveBtn').classList.add('hidden');
    $('track').classList.add('hidden');
    layout();
  }

  function doCelebration() {
    const winner = celebrate.winner;
    const brother = race.players.find((R) => R.place === 1);
    if (brother) {
      confetti(220);
      ZR.sfx.firecrackers();
      toast(`🏆 ${brother.who.toUpperCase()} AND THE ${brother.a.name} WIN!`, 'good');
    } else {
      toast(`${winner.a.emoji} THE ${winner.a.name} WINS!`, 'place');
    }
  }

  function showResults() {
    state = 'results';
    const lv = race.level;
    const out = { news: [] };
    for (const R of race.players) {
      const key = bestKey(R.animal, R.level);
      if (R.finishT !== null && (!save.best[key] || R.finishT < save.best[key])) { save.best[key] = R.finishT; out.news.push(R.who); }
      if (R.place === 1) save.wins[R.who] = (save.wins[R.who] || 0) + 1;
    }
    persist();
    celebrate.news = out.news;
    $('toasts').innerHTML = '';
    void lv;
    drawResults();
    setOverlay('results', true);
    Kit.sound.music('over');
    layout();
  }

  function drawResults() {
    if (!race || !race.done || !celebrate) return;
    const brother = race.players.slice().sort((a, b) => a.place - b.place)[0];
    const winner = celebrate.winner;
    let head;
    if (race.players.length === 2) head = brother.place === 1 ? `🏆 ${brother.who.toUpperCase()} WINS!` : `${winner.a.emoji} THE ${winner.a.name} WINS!`;
    else head = brother.place === 1 ? `🏆 YOU WIN! ${brother.a.emoji} 1ST!` : `${winner.a.emoji} THE ${winner.a.name} WINS! YOU'RE ${placeWord(brother.place)}, GOOD TRY!`;
    $('rHead').textContent = head;
    const cell = (a, n, me, same) => `<div class="${me ? 'me' : ''}${same ? ' same' : ''}"><b>${n}</b>${a.emoji}${me ? `<img src="${portraits[me]}" alt="">` : ''}</div>`;
    $('rRace').innerHTML = race.order.map((i, n) => {
      const R = race.racers[i];
      return cell(R.a, n + 1, R.human ? R.who : null, R.a.order === n + 1);
    }).join('');
    $('rStory').innerHTML = Z.ANIMALS.map((a) => cell(a, a.order, null, false)).join('');
    // a fact to take away: your animal's real place in the zodiac
    const R = race.players[0];
    $('rFact').textContent = R.place === R.a.order ? `JUST LIKE THE STORY: THE ${R.a.name} IS NUMBER ${R.a.order}!`
      : `IN THE STORY THE ${R.a.name} CAME ${placeWord(R.a.order)}. TODAY IT CAME ${placeWord(R.place)}!`;
    const rb = $('rBest');
    rb.innerHTML = '';
    for (const P of race.players) {
      const span = document.createElement('span');
      const best = save.best[bestKey(P.animal, P.level)];
      span.textContent = `${P.who.toUpperCase()} ${P.a.emoji} ${fmt(P.finishT)} · BEST ${fmt(best)} · 🏆 ${save.wins[P.who] || 0}`;
      rb.appendChild(span);
      if (celebrate.news && celebrate.news.includes(P.who)) {
        const n = document.createElement('span');
        n.className = 'rnew';
        n.textContent = 'NEW BEST!';
        rb.appendChild(n);
      }
    }
  }

  // ---------------------------------------------------------------- cameras and the screen
  function updateCameras(dt) {
    if (state === 'home' || state === 'loading') {
      // from just up the meadow, looking back at the animals on the start line
      const xs = players.map((id) => W.laneX(Z.byId[save.animal[id]].order - 1));
      const mid = xs.reduce((a, b) => a + b, 0) / xs.length;
      homeCam.position.set(mid - 1, 3.6, -13);
      homeCam.lookAt(mid, 2.0, 0);
      return;
    }
    if ((state === 'finish' || state === 'results') && celebrate && celebrate.walk > 0.15) {
      // in the courtyard, the Jade Emperor behind the heroes
      const k = celebrate.camSet ? 1 - Math.exp(-2.5 * dt) : 1;
      celebrate.camSet = true;
      endCam.position.lerp(tmpV.set(5, 4.4, -(RACE.L + 11)), k);
      endCam.lookAt(2.5, 2.6, -(RACE.L + 26));
      if (!celebrate.laidOut) { celebrate.laidOut = true; layout(); }
      return;
    }
    players.forEach((id, pl) => {
      const R = race.players[pl];
      const c = cams[pl];
      const sh = shake[pl] || 0;
      shake[pl] = Math.max(0, sh - dt);
      const narrow = views[pl] && views[pl].w / Math.max(1, views[pl].h) < 1;
      // follow the animal itself (the rat on the ox's back is a lane over), smoothly
      const ax = A3[R.animal].root.position.x;
      c.userData.x = c.userData.x === undefined || state === 'count' ? ax : c.userData.x + (ax - c.userData.x) * Math.min(1, dt * 4);
      const x = W.laneX(R.lane) + (c.userData.x - W.laneX(R.lane)) * 0.6;
      const lift = R.act && (R.act.kind === 'fly' || R.act.kind === 'flap') ? 1.5 : R.cloud && R.cloud.on ? 1 : 0;
      const back = narrow ? 11 : 9;
      c.position.set(x + Math.sin(performance.now() * 0.05) * sh * 0.4, W.groundY(R.s) + (narrow ? 6.5 : 5.2) + lift, -R.s + back);
      c.lookAt(x, 1.2 + lift * 0.6, -R.s - 9);
    });
  }

  function layout() {
    const Wd = window.innerWidth, Ht = window.innerHeight;
    const wide = Wd / Math.max(1, Ht) >= 1.1;
    views = [];
    const split = $('split');
    const ending = (state === 'finish' || state === 'results') && celebrate && celebrate.walk > 0.15;
    if (state === 'home' || state === 'loading' || ending) {
      const cam = ending ? endCam : homeCam;
      const shift = state === 'finish' ? 0 : wide ? 0.2 : -0.28;
      views.push(wide ? { cam, x: 0, y: 0, w: Wd, h: Ht, shiftX: shift } : { cam, x: 0, y: 0, w: Wd, h: Ht, shiftY: shift });
    } else if (players.length === 1) {
      views.push({ cam: cams[0], x: 0, y: 0, w: Wd, h: Ht });
    } else if (wide) {
      const w = Math.floor(Wd / 2);
      views.push({ cam: cams[0], x: 0, y: 0, w, h: Ht }, { cam: cams[1], x: w, y: 0, w: Wd - w, h: Ht });
      Object.assign(split.style, { left: `${w - 2}px`, top: '0', width: '4px', height: '100%' });
    } else {
      const h = Math.floor(Ht / 2);
      views.push({ cam: cams[0], x: 0, y: 0, w: Wd, h }, { cam: cams[1], x: 0, y: h, w: Wd, h: Ht - h });
      Object.assign(split.style, { left: '0', top: `${h - 2}px`, width: '100%', height: '4px' });
    }
    $('split').classList.toggle('hidden', !(players.length === 2 && (state === 'race' || state === 'count' || (state === 'finish' && !ending))));
    for (const v of views) {
      v.cam.fov = 55;
      if (v.shiftX) {
        const F = v.w * (1 + 2 * Math.abs(v.shiftX));
        v.cam.setViewOffset(F, v.h, v.shiftX > 0 ? 2 * v.shiftX * v.w : 0, 0, v.w, v.h);
      } else if (v.shiftY) {
        const F = v.h * (1 + 2 * Math.abs(v.shiftY));
        v.cam.setViewOffset(v.w, F, 0, 2 * Math.abs(v.shiftY) * v.h, v.w, v.h);
        v.cam.fov = 68;
      } else v.cam.clearViewOffset();
    }
    layoutPads();
  }

  // ---------------------------------------------------------------- HUD and the buttons
  function hudUI() {
    $('pauseBtn').addEventListener('click', () => setPause(!paused));
    $('muteBtn').addEventListener('click', () => { Kit.sound.init(); Kit.sound.toggleMute(); });
    $('buddyBtn').addEventListener('pointerdown', (e) => { e.preventDefault(); Kit.sound.init(); callBuddy(0); });
    $('fiveBtn').addEventListener('pointerdown', (e) => { e.preventDefault(); Kit.sound.init(); highFive(); });
  }

  function trackUI() {
    const tk = $('track');
    tk.querySelectorAll('.mark').forEach((m) => m.remove());
    race.racers.forEach((R) => {
      const m = document.createElement('div');
      m.className = 'mark' + (R.human ? ' me' : '');
      m.textContent = R.a.emoji;
      tk.appendChild(m);
      R.markEl = m;
    });
  }

  let padEls = [];
  function padsUI() {
    const pads = $('pads');
    pads.innerHTML = '';
    padEls = players.map((id, pl) => {
      const one = players.length === 1;
      const keys = one ? { l: '←', r: '→', j: 'Space', p: 'Enter' } : pl === 0 ? { l: 'A', r: 'D', j: 'W', p: 'S' } : { l: '←', r: '→', j: '↑', p: '↓' };
      const mk = (cls, label, html, key, fn) => {
        const b = document.createElement('button');
        b.className = 'ctl ' + cls;
        b.setAttribute('aria-label', label);
        b.innerHTML = `${html}<kbd>${key}</kbd>`;
        b.addEventListener('pointerdown', (e) => { e.preventDefault(); Kit.sound.init(); b.classList.add('down'); fn(); });
        const up = () => b.classList.remove('down');
        b.addEventListener('pointerup', up);
        b.addEventListener('pointercancel', up);
        b.addEventListener('pointerleave', up);
        pads.appendChild(b);
        return b;
      };
      const R = race.players[pl];
      const left = mk('steer', 'Move left', '◀', keys.l, () => steer(pl, -1));
      const right = mk('steer', 'Move right', '▶', keys.r, () => steer(pl, 1));
      const jumpB = mk('jump', 'Hop', '⤴', keys.j, () => jump(pl));
      const powB = mk('power', 'Power', `<span class="ring"></span><span class="lbl">${Z.POWERS[R.a.power].label}</span><span class="emo">${R.a.emoji}</span>`, keys.p, () => power(pl));
      const info = document.createElement('div');
      info.className = 'pinfo';
      info.innerHTML = '<span class="place"></span><span class="chip"></span>';
      pads.appendChild(info);
      return { left, right, jumpB, powB, ring: powB.querySelector('.ring'), info, id, shown: {} };
    });
    layoutPads();
  }

  function layoutPads() {
    const Wd = window.innerWidth, Ht = window.innerHeight;
    const vmin = Math.min(Wd, Ht);
    padEls.forEach((p, pl) => {
      const v = players.length === 1 ? { x: 0, y: 0, w: Wd, h: Ht } : (views[pl] && views.length === 2 ? views[pl] : { x: 0, y: 0, w: Wd, h: Ht });
      const small = Math.min(v.w, v.h);
      const big = Math.round(Math.max(76, Math.min(124, small * 0.22)));
      const st = Math.round(Math.max(64, Math.min(100, small * 0.18)));
      const pad = 14;
      const bottom = v.y + v.h - pad - 8;
      const right = v.x + v.w - pad;
      Object.assign(p.left.style, { width: `${st}px`, height: `${st}px`, left: `${v.x + pad}px`, top: `${bottom - st}px` });
      Object.assign(p.right.style, { width: `${st}px`, height: `${st}px`, left: `${v.x + pad + st + 12}px`, top: `${bottom - st}px` });
      Object.assign(p.powB.style, { width: `${big}px`, height: `${big}px`, left: `${right - big}px`, top: `${bottom - big}px` });
      Object.assign(p.jumpB.style, { width: `${st}px`, height: `${st}px`, left: `${right - big - 14 - st}px`, top: `${bottom - st}px` });
      const topY = v.y + (v.y === 0 ? 60 : 10);
      Object.assign(p.info.style, { left: `${v.x + (v.x === 0 ? 70 : 12)}px`, top: `${topY}px` });
    });
    if (players.length === 1 && padEls[0]) {
      const size = Math.round(Math.max(58, Math.min(80, vmin * 0.11)));
      const pr = padEls[0].powB.getBoundingClientRect();
      Object.assign($('buddyBtn').style, { left: `${pr.right - size}px`, top: `${pr.top - size - 16}px`, width: `${size}px`, height: `${size}px` });
    }
    if (players.length === 2) {
      const size = Math.round(Math.max(58, Math.min(80, vmin * 0.11)));
      const wide = views.length === 2 && views[1].x > 0;
      Object.assign($('fiveBtn').style, wide ? { left: `${Wd / 2 - size / 2}px`, top: `${Ht * 0.3}px` } : { left: `${Wd / 2 - size / 2}px`, top: `${Ht / 2 - size / 2}px` }, { width: `${size}px`, height: `${size}px` });
    }
  }

  function setText(el, text) { if (el._t !== text) { el._t = text; el.textContent = text; } }
  function updateHUD() {
    if (!race || state === 'home' || state === 'loading') return;
    // the track: everyone's position
    for (const R of race.racers) {
      if (!R.markEl) continue;
      const f = Math.max(0, Math.min(1, R.s / RACE.L));
      R.markEl.style.left = `calc(14px + (100% - 44px) * ${f.toFixed(4)})`;
    }
    const ranked = race.racers.slice().sort((a, b) => (a.finishT !== null || b.finishT !== null ? (a.finishT === null ? 1e9 : a.finishT) - (b.finishT === null ? 1e9 : b.finishT) : b.s - a.s));
    padEls.forEach((p, pl) => {
      const R = race.players[pl];
      const place = R.finishT !== null ? race.racers.filter((x) => x.finishT !== null && x.finishT <= R.finishT).length : ranked.indexOf(R) + 1;
      const pe = p.info.querySelector('.place');
      setText(pe, placeWord(place));
      pe.classList.toggle('first', place === 1);
      setText(p.info.querySelector('.chip'), R.peaches ? `🍑 ${R.peaches}` : '');
      const ready = R.power >= 1 && !R.act && !R.ride;
      p.powB.classList.toggle('ready', ready);
      p.powB.classList.toggle('used', !!(R.act || R.ride));
      const f = R.act ? R.act.t / RACE.POWERS[R.act.kind].dur : R.ride ? R.ride.t / RACE.POWERS.ride.dur : R.power;
      const deg = Math.round(f * 360);
      if (p.shown.deg !== deg) { p.shown.deg = deg; p.ring.style.background = `conic-gradient(#ffd400 ${deg}deg, rgba(20,18,31,0.35) 0)`; p.ring.style.webkitMask = p.ring.style.mask = 'radial-gradient(circle, transparent 62%, #000 63%)'; }
    });
  }

  function toast(text, kind) {
    const el = document.createElement('div');
    el.className = 'toast' + (kind ? ' ' + kind : '');
    el.textContent = text;
    $('toasts').appendChild(el);
    setTimeout(() => el.remove(), 2200);
    while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
  }

  const fx = $('fx').getContext('2d');
  const bits = [];
  function confetti(n) {
    const Wd = window.innerWidth;
    for (let i = 0; i < n; i++) {
      bits.push({ x: rand(0, Wd), y: rand(-200, -10), vx: rand(-60, 60), vy: rand(80, 220), r: rand(0, 6), vr: rand(-6, 6), w: rand(7, 13), h: rand(4, 8), c: pick(['#ffd400', '#e8382f', '#ff9a1f', '#3fd0a0', '#ff3d7f', '#ffffff']), life: rand(3, 5) });
    }
  }
  function drawFx(dt) {
    const c = $('fx');
    const Wd = window.innerWidth, Ht = window.innerHeight, dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (c.width !== Math.round(Wd * dpr) || c.height !== Math.round(Ht * dpr)) { c.width = Math.round(Wd * dpr); c.height = Math.round(Ht * dpr); }
    fx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fx.clearRect(0, 0, Wd, Ht);
    for (let i = bits.length - 1; i >= 0; i--) {
      const b = bits[i];
      b.life -= dt; b.x += b.vx * dt; b.y += b.vy * dt; b.r += b.vr * dt;
      if (b.life <= 0 || b.y > Ht + 20) { bits.splice(i, 1); continue; }
      fx.save();
      fx.translate(b.x, b.y);
      fx.rotate(b.r);
      fx.fillStyle = b.c;
      fx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
      fx.restore();
    }
  }

  // ---------------------------------------------------------------- keys
  function onKey(e) {
    const k = e.code;
    if (k === 'KeyM') { Kit.sound.init(); Kit.sound.toggleMute(); return; }
    if (state !== 'loading') Kit.sound.init();
    if (overlay === 'story') {
      if (k === 'ArrowRight' || k === 'KeyD' || k === 'Space' || k === 'Enter') storyTurn(1);
      else if (k === 'ArrowLeft' || k === 'KeyA') storyTurn(-1);
      else if (k === 'Escape' || k === 'KeyB') closeOverlay();
      e.preventDefault();
      return;
    }
    if (overlay === 'finder') { finderKey(k, e); return; }
    if (overlay === 'lineup') {
      if (k === 'Escape' || k === 'KeyO') closeOverlay();
      else if ((k === 'Enter' || k === 'Space') && lq.done) lineupStart();
      e.preventDefault();
      return;
    }
    if (state === 'home') {
      const two = save.who === 'both';
      if (k === 'ArrowLeft' || k === 'ArrowRight') moveAnimal(two ? 'tommy' : save.who, k === 'ArrowLeft' ? -1 : 1);
      else if (k === 'KeyA' || k === 'KeyD') moveAnimal(two ? 'teddy' : save.who, k === 'KeyA' ? -1 : 1);
      else if (k === 'ArrowUp' || k === 'ArrowDown') setLevel(two ? 'tommy' : save.who, k === 'ArrowUp' ? 'easy' : 'normal');
      else if (k === 'KeyW' || k === 'KeyS') setLevel(two ? 'teddy' : save.who, k === 'KeyW' ? 'easy' : 'normal');
      else if (k === 'Digit1') pickWho('teddy');
      else if (k === 'Digit2') pickWho('tommy');
      else if (k === 'Digit3') pickWho('both');
      else if (k === 'Enter' || k === 'Space') startRace();
      else if (k === 'KeyB') openOverlay('story');
      else if (k === 'KeyY') openOverlay('finder');
      else if (k === 'KeyO') openOverlay('lineup');
      else return;
      e.preventDefault();
      return;
    }
    if (state === 'results') {
      if (k === 'Enter' || k === 'Space') startRace();
      else if (k === 'Escape' || k === 'KeyH') goHome();
      else if (k === 'KeyB') openOverlay('story');
      else return;
      e.preventDefault();
      return;
    }
    if (state !== 'race' && state !== 'count') return;
    if (k === 'KeyP' || k === 'Escape') { setPause(!paused); e.preventDefault(); return; }
    if (paused) { if (k === 'Enter' || k === 'Space') setPause(false); e.preventDefault(); return; }
    if (k === 'KeyT') { if (!e.repeat) callBuddy(0); e.preventDefault(); return; }
    const two = players.length > 1;
    let pl = -1, a = null;
    if (!two) {
      pl = 0;
      if (k === 'KeyA' || k === 'ArrowLeft') a = -1;
      else if (k === 'KeyD' || k === 'ArrowRight') a = 1;
      else if (k === 'Space' || k === 'KeyW' || k === 'ArrowUp') a = 'jump';
      else if (k === 'Enter' || k === 'NumpadEnter' || k === 'KeyS' || k === 'ArrowDown') a = 'power';
    } else {
      const map = { KeyA: [0, -1], KeyD: [0, 1], KeyW: [0, 'jump'], Space: [0, 'jump'], KeyS: [0, 'power'],
        ArrowLeft: [1, -1], ArrowRight: [1, 1], ArrowUp: [1, 'jump'], Enter: [1, 'jump'], NumpadEnter: [1, 'jump'], ArrowDown: [1, 'power'] };
      if (map[k]) [pl, a] = map[k];
    }
    if (a === null || pl < 0) return;
    e.preventDefault();
    if (e.repeat) return;
    if (a === 'jump') jump(pl);
    else if (a === 'power') power(pl);
    else steer(pl, a);
  }

  // ---------------------------------------------------------------- window.game, for tests
  let pilots = null;
  const game = {
    autoPause: true,
    start(o) { startRace(o || {}); return game.info(); },
    // fast: draw only the last frame (much quicker in software-rendered headless Chrome)
    step(seconds, fast) {
      const n = Math.max(1, Math.round((seconds || 0) * 60));
      for (let i = 0; i < n; i++) frame(1 / 60, fast && i < n - 1);
      return game.info();
    },
    hold(on) { held = !!on; },
    steer(pl, dir) { steer(pl || 0, dir); },
    jump(pl) { jump(pl || 0); },
    power(pl) { power(pl || 0); },
    buddy(pl) { callBuddy(pl || 0); },
    five() { highFive(); },
    pause(p) { setPause(p); },
    home() { goHome(); },
    pick(i) { pickCard(i); },
    who(w) { pickWho(w); },
    story(open) { if (open) openOverlay('story'); else closeOverlay(); },
    storyTurn,
    finder(open, year, early) { if (open) { openOverlay('finder'); if (year) { fYear = year; fEarly = !!early; drawFinder(); } } else closeOverlay(); return open ? finderResult().animal.id : null; },
    lineup(open) { if (open) openOverlay('lineup'); else closeOverlay(); },
    lineupTap(i) { const b = document.querySelector(`#lTiles .tile[data-i="${i}"]`); if (b) lineupTap(i, b); return lq.next; },
    autopilot(kind) {
      pilotKind = kind || null;
      for (const R of race ? race.players : []) R.pilot = kind || null;
      pilots = null;
    },
    check(o) { return ZR.checks.run(Object.assign({ prove: true }, o || {})); },
    info() {
      return {
        state, paused, held, overlay, who: save.who, animals: Object.assign({}, save.animal), levels: Object.assign({}, save.level),
        time: race ? +race.t.toFixed(2) : null, done: race ? race.done : null,
        players: race ? race.players.map((R) => ({ who: R.who, animal: R.animal, s: +R.s.toFixed(1), v: +R.v.toFixed(2), place: R.place, finishT: R.finishT && +R.finishT.toFixed(2), power: +R.power.toFixed(2), act: R.act && R.act.kind, ride: !!R.ride, cloud: R.cloud ? { on: R.cloud.on, to: R.cloud.to } : null, peaches: R.peaches })) : [],
        order: race && race.order ? race.order.map((i) => race.racers[i].animal) : null,
        buddy: seqs.map((s) => (s ? { who: s.id, t: +s.t.toFixed(2), treated: s.treated } : null)),
      };
    },
    get race() { return race; },
  };
  window.game = game;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
