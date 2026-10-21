/* 中文 for TT Zodiac Race: the words on the page, the toasts, the finish banner (drawn through Kit.lang.t in js/world.js),
   the story, the birth-year finder, the line-up game and the ? panel (Kit.lang, from kit/lang.js). Simple words:
   Tommy is 5. The kids' names, Foxy and Froggy, and the game's own name stay in English on purpose. */
(function () {
  const L = Kit.lang;
  const title = window.ZR_TITLE;
  const words = title.split(' ');
  L.keep(['TEDDY', 'TOMMY', 'FOXY', 'FROGGY', 'Teddy', 'Tommy', title, words.slice(0, -2).join(' '), words.slice(-2).join(' '), 'Esc']);

  // the animals: everyday words on the cards, the zodiac characters (鼠 牛 虎...) under them
  const NAME = { RAT: '老鼠', OX: '牛', TIGER: '老虎', RABBIT: '兔子', DRAGON: '龙', SNAKE: '蛇', HORSE: '马', GOAT: '羊', MONKEY: '猴子', ROOSTER: '公鸡', DOG: '狗', PIG: '猪' };
  const ZODIAC = { RAT: '鼠', OX: '牛', TIGER: '虎', RABBIT: '兔', DRAGON: '龙', SNAKE: '蛇', HORSE: '马', GOAT: '羊', MONKEY: '猴', ROOSTER: '鸡', DOG: '狗', PIG: '猪' };
  const A = Object.keys(NAME).join('|');
  const n = (x) => NAME[x] || x;
  const PLACE = (k) => `第${k}名`;
  const P = '(\\d+)(?:ST|ND|RD|TH)';
  const MONTH = { JANUARY: 1, FEBRUARY: 2 };
  const date = (m, d) => `${MONTH[m]}月${d}日`;
  L.add(NAME);

  L.add({
    // home
    'THE GREAT RACE': '十二生肖大赛跑', 'Pick your animal': '选你的动物', "Who's racing?": '谁来比赛？', 'BOTH': '一起比',
    'Teddy races': 'Teddy 比赛', 'Tommy races': 'Tommy 比赛', 'Teddy and Tommy race': 'Teddy 和 Tommy 一起比赛',
    'Easy': '简单', 'Normal': '普通', 'EASY': '简单', 'NORMAL': '普通',
    'The story': '十二生肖的故事', 'The story (B)': '十二生肖的故事 (B)', 'What animal am I?': '我属什么？', 'What animal am I? (Y)': '我属什么？(Y)',
    'Line them up!': '排排队！', 'Line them up! (O)': '排排队！(O)', 'Race!': '比赛！', 'Race! (Enter)': '比赛！(回车)',
    // racing
    'Pause': '暂停', 'Pause (P)': '暂停 (P)', 'Sound (M)': '声音 (M)', 'Sound on or off': '声音 开 / 关',
    'Call your brother': '叫兄弟来帮忙', 'High five': '击掌', 'Move left': '往左', 'Move right': '往右', 'Hop': '跳', 'Power': '本领',
    RIDE: '骑', STRONG: '大力', SWIM: '游', HOP: '跳跳', FLY: '飞', GALLOP: '飞奔', RAFT: '木筏', SWING: '荡', FLAP: '扑扑', PADDLE: '狗刨', SNACK: '吃点心',
    'GO!': '出发！', 'RUN TO THE JADE EMPEROR!': '跑去见玉皇大帝！', 'NOT READY YET!': '还没准备好！', '✋ HIGH FIVE!': '✋ 击掌！',
    'BONK! HOP OVER THE LOGS!': '咚！跳过木头！', 'BONK! A ROCK!': '咚！撞到石头了！', 'WHOOSH! A WHIRLPOOL!': '呼！一个大漩涡！',
    'THE GREAT RIVER! SWIM!': '大河到啦！游过去！', 'BAMBOO PATH! RUN TO THE PALACE!': '竹林小路！跑到宫殿去！',
    'LOTUS POND': '荷花池', 'FAST WATER': '急流', 'BIG WAVES': '大浪', 'THANK YOU FOR THE RIDE!': '谢谢你带我！',
    'STRONG OX, PUSH THROUGH!': '大力牛，冲过去！', 'TIGER SWIM!': '老虎游泳！', 'HOP HOP HOP!': '跳跳跳！', 'DRAGON FLY!': '龙飞起来！',
    'GALLOP!': '快快跑！', 'RAFT TIME!': '坐木筏！', 'SWING!': '荡过去！', 'FLAP FLAP!': '扑扑飞！', 'DOGGY PADDLE!': '狗刨式！', 'SNACK POWER!': '吃饱了有力气！',
    FINISH: '终点',
    // pause, results
    'Keep racing': '继续比赛', 'Start the race again': '重新开始', 'Pick an animal': '选动物', 'Play again': '再玩一次',
    'THIS RACE': '这次比赛', "THE STORY'S ORDER": '故事里的顺序', 'NEW BEST!': '新纪录！',
    // the story
    'Back a page': '上一页', 'Next page': '下一页', 'Close the story': '关上故事', 'Close': '关上',
    'Long, long ago, the Jade Emperor wanted a way to count the years. He said: "Let\'s have a race across the great river! The first twelve animals to reach my palace will each get a year."':
      '很久很久以前，玉皇大帝想找个办法来数年份。他说：“我们来比赛，渡过大河！最先到我宫殿的十二只动物，每只都能得到一年。”',
    'The clever Rat couldn\'t swim very well, so she asked the kind Ox for a ride on his back. Just before the end, she jumped off and came 1st! The Ox came 2nd.':
      '聪明的老鼠不太会游泳，就请善良的牛背她过河。快到终点的时候，她一下跳了下来，得了第一名！牛得了第二名。',
    'The strong Tiger swam hard against the water: 3rd. The Rabbit hopped across on stones and a floating log: 4th. The Dragon could fly, but he stopped to make rain for thirsty people and help the Rabbit: 5th.':
      '强壮的老虎使劲游过大河：第三名。兔子踩着石头、坐着漂来的木头过了河：第四名。龙会飞，可是他停下来给口渴的人们下雨，还帮了兔子：第五名。',
    'The Snake hid on the Horse\'s hoof, then jumped out: SURPRISE! Snake 6th, Horse 7th. The Goat, the Monkey and the Rooster found a raft and crossed together, as a team: 8th, 9th and 10th.':
      '蛇躲在马蹄上，然后跳出来：吓一跳！蛇第六，马第七。羊、猴子和公鸡找到一只木筏，一起过了河：第八、第九、第十名。',
    'The Dog loved the water so much that he stopped to play and take a bath: 11th. Last came the Pig, who stopped for a snack and a nap: 12th!':
      '狗太喜欢水了，停下来玩水、洗澡：第十一名。最后来的是猪，他停下来吃东西，还睡了一觉：第十二名！',
    'That\'s the order of the twelve zodiac animals. Every year has one of them, and it goes round and round, every twelve years. What animal are you?':
      '这就是十二生肖的顺序。每一年都有一个生肖，十二年转一圈。你属什么？',
    // the finder
    'WHAT ANIMAL AM I?': '我属什么？', 'Ten years back': '往前十年', 'A year back': '往前一年', 'A year on': '往后一年', 'Ten years on': '往后十年',
    'BORN BEFORE CHINESE NEW YEAR?': '在春节以前出生？', 'SAVE FOR': '记下来：', 'Save this year': '记下这一年', 'Remove': '删掉',
    // the line-up game
    'LINE THEM UP!': '排排队！',
    // the ? panel (js/keys.js)
    'Teddy (left)': 'Teddy（左边）', 'Tommy (right)': 'Tommy（右边）',
    'move left / right': '往左 / 往右', 'hop over logs': '跳过木头', "your animal's power": '动物的本领', 'pick your animal': '选动物',
    'level 🐣 / 🔥': '难度 🐣 / 🔥', 'who races': '谁来比赛', 'race! · again': '比赛！· 再来',
    'the story · what animal am I? · line them up': '故事 · 我属什么？· 排排队',
    "Steer round the rocks, hop over the logs, grab the peaches. When your animal's button glows, use its power: the Rat rides the Ox, the Dragon flies, the Tiger swims strong. In 1 player both sets of keys work (Space hops, Enter uses the power) and T calls your brother for a cloud ride; with 2 players, T is a high five.":
      '绕开石头，跳过木头，吃桃子。动物的按钮一发光，就用它的本领：老鼠骑牛，龙会飞，老虎游得快。一个人玩时两套按键都能用（空格跳，回车用本领），T 叫兄弟来，坐祥云飞一段；两个人玩时，T 是击掌。',
    "◀ ▶ to move, ⤴ to hop, and tap your animal when it glows for its power. Tap your brother's face to call him.":
      '点 ◀ ▶ 移动，点 ⤴ 跳，动物发光时点它用本领。点兄弟的头像叫他来。',
  });

  const TREAT = { 'ICE CREAM': '冰淇淋', WATER: '水', 'JUICE BOX': '果汁', COOKIE: '饼干', WATERMELON: '西瓜', BANANA: '香蕉' };
  L.rule(new RegExp(`^${P}$`), (m, k) => PLACE(k));
  L.rule(new RegExp(`^🏯 ${P}!$`), (m, k) => `🏯 ${PLACE(k)}！`);
  L.rule(new RegExp(`^🏯 (TEDDY|TOMMY): ${P}!$`), (m, who, k) => `🏯 ${who}：${PLACE(k)}！`);
  L.rule(/^(\S+) (ICE CREAM|WATER|JUICE BOX|COOKIE|WATERMELON|BANANA) FROM (.+)!$/, (m, emoji, item, who) => `${emoji} ${who} 给你${TREAT[item]}！`);
  L.rule(/^(\S+) SAYS: HOP ON! I'LL GIVE YOU A RIDE!$/, '$1 说：上来！我带你飞过去！');
  L.rule(/^(\S+) SAYS: ONE MORE STRETCH!$/, '$1 说：再带你一段！');
  L.rule(new RegExp(`^HOP ON THE (${A})!$`), (m, a) => `跳到${n(a)}背上！`);
  L.rule(new RegExp(`^TOO FAR FROM THE (${A})! SCURRY!$`), (m, a) => `离${n(a)}太远啦！快快跑！`);
  L.rule(new RegExp(`^(\\S+) THE (${A}) HOPPED ON YOUR (${A})!$`), (m, e, a, b) => `${e} ${n(a)}跳到你的${n(b)}背上啦！`);
  L.rule(new RegExp(`^JUMP! THANK YOU, (${A})!$`), (m, a) => `跳！谢谢你，${n(a)}！`);
  L.rule(new RegExp(`^(\\S+) SURPRISE! THE (${A}) JUMPED OFF!$`), (m, e, a) => `${e} 吓一跳！${n(a)}跳下去啦！`);
  // the finish and the results
  L.rule(/^🏆 (TEDDY|TOMMY) WINS!$/, '🏆 $1 赢啦！');
  L.rule(new RegExp(`^🏆 (TEDDY|TOMMY) AND THE (${A}) WIN!$`), (m, who, a) => `🏆 ${who} 和${n(a)}赢啦！`);
  L.rule(new RegExp(`^(\\S+) THE (${A}) WINS!$`), (m, e, a) => `${e} ${n(a)}赢啦！`);
  L.rule(new RegExp(`^(\\S+) THE (${A}) WINS! YOU'RE ${P}, GOOD TRY!$`), (m, e, a, k) => `${e} ${n(a)}赢啦！你是${PLACE(k)}，加油！`);
  L.rule(new RegExp(`^🏆 YOU WIN! (\\S+) 1ST!$`), (m, e) => `🏆 你赢啦！${e} 第1名！`);
  L.rule(new RegExp(`^JUST LIKE THE STORY: THE (${A}) IS NUMBER (\\d+)!$`), (m, a, k) => `和故事里一样：${n(a)}是第${k}个！`);
  L.rule(new RegExp(`^IN THE STORY THE (${A}) CAME ${P}\\. TODAY IT CAME ${P}!$`), (m, a, k1, k2) => `故事里${n(a)}是第${k1}名，今天是第${k2}名！`);
  L.rule(/^(TEDDY|TOMMY) (\S+) ([\d.]+) s · BEST ([\d.]+) s · 🏆 (\d+)$/, '$1 $2 $3 秒 · 最快 $4 秒 · 🏆 $5');
  // the finder
  L.rule(/^NUMBER (\d+) OF 12$/, '十二生肖第 $1 个');
  L.rule(/^BORN BEFORE (JANUARY|FEBRUARY) (\d+)\?$/, (m, mo, d) => `在${date(mo, d)}以前出生？`);
  L.rule(new RegExp(`^A zodiac year starts at Chinese New Year, not on January 1\\. In (\\d+) that was (JANUARY|FEBRUARY) (\\d+): born on it or after, you're a (${A})\\.$`),
    (m, y, mo, d, a) => `生肖年从春节开始，不是从1月1日开始。${y}年的春节是${date(mo, d)}：在这一天或以后出生，你属${ZODIAC[a]}。`);
  L.rule(new RegExp(`^Chinese New Year (\\d+) was on (JANUARY|FEBRUARY) (\\d+)\\. Born before it\\? Then you're still in the year before: the (${A})!$`),
    (m, y, mo, d, a) => `${y}年的春节是${date(mo, d)}。在这一天以前出生？那你还算前一年：你属${ZODIAC[a]}！`);
  L.rule(new RegExp(`^A zodiac year starts at Chinese New Year, between late January and mid February\\. Born after it, you're a (${A})\\.$`),
    (m, a) => `生肖年从春节开始，春节在1月下旬到2月中旬。在春节以后出生，你属${ZODIAC[a]}。`);
  L.rule(new RegExp(`^Born before Chinese New Year \\(late January to mid February\\)\\? Then you're still in the year before: the (${A})!$`),
    (m, a) => `在春节（1月下旬到2月中旬）以前出生？那你还算前一年：你属${ZODIAC[a]}！`);
  L.rule(new RegExp(`^(${A}) YEARS: (.+)$`), (m, a, ys) => `${ZODIAC[a]}年：${ys.split(', ').join('、')}`);
  // the line-up game
  L.rule(new RegExp(`^WHO COMES ${P}\\?$`), (m, k) => `谁是第${k}个？`);
  L.rule(/^NOT YET! (\S+) IS NUMBER (\d+)$/, '还没到！$1 是第 $2 个');
  L.rule(/^🎉 YOU KNOW THE ZODIAC! ([\d.]+) s( · NEW BEST!)?$/, (m, t, nb) => `🎉 你记住十二生肖啦！${t} 秒${nb ? ' · 新纪录！' : ''}`);
})();
