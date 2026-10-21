/* The keys the ? panel shows. Press ? (Shift + /) in the game, or tap the round ? button (top left).
   The panel and the freeze live in the shared kit: kit/help.js (Kit.help). */
Kit.help.setup({
  title: window.ZR_TITLE,
  cols: ['Teddy (left)', 'Tommy (right)'],
  keys: [
    ['move left / right', 'A D', '← →'],
    ['hop over logs', 'W or Space', '↑ or Enter'],
    ["your animal's power", 'S', '↓'],
    ['call your brother · high five', 'T', 'T'],
    ['pick your animal', 'A D', '← →'],
    ['level 🐣 / 🔥', 'W S', '↑ ↓'],
    ['who races', '1 2 3', '1 2 3'],
    ['race! · again', 'Enter or Space', 'Enter or Space'],
    ['the story · what animal am I? · line them up', 'B Y O', 'B Y O'],
    ['pause', 'P or Esc', 'P or Esc'],
    ['sound on / off', 'M', 'M'],
  ],
  note: "Steer round the rocks, hop over the logs, grab the peaches. When your animal's button glows, use its power: the Rat rides the Ox, the Dragon flies, the Tiger swims strong. In 1 player both sets of keys work (Space hops, Enter uses the power) and T calls your brother for a cloud ride; with 2 players, T is a high five.",
  touch: "◀ ▶ to move, ⤴ to hop, and tap your animal when it glows for its power. Tap your brother's face to call him.",
  button: { top: 'calc(env(safe-area-inset-top, 0px) + 10px)', left: 'max(10px, env(safe-area-inset-left, 0px))' },
});
// The language button goes right under the ? button, and the kit's speaker under that: a column in the top left corner,
// away from the steering and power buttons at the bottom.
Kit.lang.setup({ button: { top: 'calc(env(safe-area-inset-top, 0px) + 58px)', left: 'max(10px, env(safe-area-inset-left, 0px))' } });
