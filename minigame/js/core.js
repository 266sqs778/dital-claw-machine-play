/* =========================================================================
 * 地摊抓娃娃 · 竖屏极简版 核心层（唯一真源）
 * -------------------------------------------------------------------------
 * 纯逻辑 + 纯 Canvas 2D 绘制，不引用 document / window / wx / localStorage。
 * 浏览器预览版与微信小游戏版共用本文件，两端只负责：画布、触摸、音频、存档。
 *
 * 设计原则（相对 v0.1–v0.9 的「后端化」反向收敛）：
 *   1. 一个动作：点娃娃 = 移爪 + 下爪，没有甩爪 / 节拍 / 连点 / 校准 / 阶梯
 *   2. 参数全是常量，界面上不暴露任何调参面板
 *   3. 玩家只看得到：币、保底进度、图鉴、老板说啥
 *   4. 广告换币：开局领 20 → 用完看激励视频再领 20；看完才发币，
 *      中途关闭不发；并保留「免费领 2 币」通道，广告不是唯一续玩方式。
 *      core 只负责弹层/发币/存档，广告组件由壳层注入（opts.ads）。
 * ========================================================================= */
(function (root) {
  'use strict';

  var W = 390, H = 720;
  var OUT_X = 318, TOP_Y = 214, PILE_BOTTOM = 512;
  var CLAW_HOME = 195;

  /* ---------- 唯一的平衡配置：只有 8 个字段，改数值就改这里 ---------- */
  var BALANCE = {
    version: '2.1-box',
    cost: 2,            // 每把消耗圈币
    welcomeCoins: 20,   // 开局领 20 币
    adCoins: 20,        // 看完激励视频领 20 币
    freeCoins: 2,       // 不看广告也能领 2 币（合规：广告非唯一出口）
    strongRate: 0.18,   // 强爪基础概率（明示在规则页）
    pity: 8,            // 连续未出货满 N 把，下把必出（明示）
    hitRadius: 34,      // 点到娃娃多少像素内算对准
    slipStart: 0.60,    // 弱爪最早滑落高度
    slipEnd: 0.95       // 弱爪最晚滑落高度
  };

  /* ---------- 演出节拍（秒）：一点击到可再点，总共约 2.3s ----------
   * 竖屏极简版要「点了就动」，整体按 0.62 倍压缩；弱爪滑落判定用的是
   * 相对 lift 进度的比例（slipStart/slipEnd），缩短时长不影响概率。 */
  var TIMING = {
    drop: 0.38, grip: 0.16, lift: 0.62,
    carry: 0.55, release: 0.32, back: 0.25,
    respawn: 220
  };

  /* ---------- 8 款原创 meme 娃娃（网梗二创，无知名 IP）
   * face: 眼神表情；prop: 随身小道具；meme: 抓到时飘出的梗标签 */
  var PLUSH = [
    { id: 'tang',  name: '躺平猫', meme: '本喵只想躺着',   body: '#9CA6AF', dark: '#737D87', belly: '#E8EDF0', ear: 'round', blush: '#C2CAD2', face: 'droopy', prop: 'none' },
    { id: 'gan',   name: '干饭狗', meme: '干饭才是头等大事', body: '#E9C58F', dark: '#B98544', belly: '#FFF3DC', ear: 'flop',  blush: '#E8A06A', face: 'happy',  prop: 'bowl' },
    { id: 'ning',  name: '柠檬猫', meme: '我酸了酸了',     body: '#D6DE83', dark: '#9CB03C', belly: '#F4F8D0', ear: 'round', blush: '#E4E98F', face: 'sour',   prop: 'lemon' },
    { id: 'zao',   name: '暴躁狗', meme: '再碰我试试？',   body: '#BCA48E', dark: '#84685A', belly: '#E5D7C5', ear: 'sharp', blush: '#D9A08A', face: 'angry',  prop: 'none' },
    { id: 'lan',   name: '摆烂蛙', meme: '努力是不可能努力的', body: '#8FBF6A', dark: '#5E8B3C', belly: '#D9EDB8', ear: 'none', blush: '#A8CC8C', face: 'dead',   prop: 'none' },
    { id: 'juan',  name: '卷王鼠', meme: '你卷不过我的',   body: '#E3C7B4', dark: '#B3866C', belly: '#F7EBDD', ear: 'round', blush: '#E2B29B', face: 'smug',   prop: 'curl' },
    { id: 'emo',   name: 'emo企鹅', meme: '网抑云时间到',  body: '#5E6C7A', dark: '#39424C', belly: '#EAEFF4', ear: 'none', blush: '#8A97A4', face: 'droopy', prop: 'none', beak: true },
    { id: 'bao',   name: '暴富猫', meme: '今日宜暴富',     body: '#F5C542', dark: '#C79718', belly: '#FFE9A0', ear: 'round', blush: '#EFC25C', face: 'happy',  prop: 'coin' }
  ];

  /* ---------- 台词：与 tools/gen_voice.py 一一对应 ----------
   * 运行时优先读 globalThis.ClawLines.lines（语音包生成脚本产出的真源）；
   * 找不到时用下面这份纯字幕兜底，保证单独打开也不黑屏。 */
  var FALLBACK = [
    { id: 'v01', key: 'greet',       mood: '招呼', text: '来啦老弟！两币一把，抓着算你本事！' },
    { id: 'v02', key: 'idle',        mood: '招揽', text: '随便瞅，随便挑，别光看不伸手啊！' },
    { id: 'v03', key: 'grab',        mood: '招呼', text: '诶，就它了？行，姐给你下爪！' },
    { id: 'v04', key: 'miss',        mood: '嘲讽', text: '哎呀妈呀，这都能抓空？你瞅哪儿呢！' },
    { id: 'v05', key: 'missStreak',  mood: '调侃', text: '三把了吧？要不先歇会儿，喝口水再整！' },
    { id: 'v06', key: 'slipEarly',   mood: '暗爽', text: '哎哟我天，爪子松得跟没吃饭似的～' },
    { id: 'v07', key: 'slipMid',     mood: '暗爽', text: '哎呀妈呀！就差一丢丢，急人不！' },
    { id: 'v08', key: 'slipLate',    mood: '暗爽', text: '到顶了都！我这心都提到嗓子眼儿了！' },
    { id: 'v09', key: 'win',         mood: '懊恼', text: '行吧行吧，拿走拿走，别搁这儿显摆了！' },
    { id: 'v10', key: 'winFirst',    mood: '懊恼', text: '头一把就中了？你是不是练过啊！' },
    { id: 'v11', key: 'winStreak',   mood: '心疼', text: '我滴妈呀，又来？我这摊子快让你搬空了！' },
    { id: 'v12', key: 'winPity',     mood: '认栽', text: '得得得，算你赢，下回可不带你这样的了！' },
    { id: 'v13', key: 'pityNear',    mood: '心虚', text: '哎哎哎，快到底儿了啊，可别赖我！' },
    { id: 'v14', key: 'nocoins',     mood: '招揽', text: '没币啦？姐给你添点儿，接着整！' },
    { id: 'v15', key: 'collection',  mood: '心疼', text: '好家伙，都收集这么些了，你是来进货的吧！' },
    { id: 'v16', key: 'clear',       mood: '认栽', text: '完犊子，全让你抱走了，明儿我改卖烤冷面得了！' },
    { id: 'v17', key: 'welcome',     mood: '招呼', text: '头回来吧？姐先给你二十个币，可劲儿造！' },
    { id: 'v18', key: 'adReward',    mood: '招揽', text: '看完啦？行，二十币拿去，悠着点儿花啊！' },
    { id: 'v19', key: 'adSkip',      mood: '嘲讽', text: '这广告没瞅完就关了，可不能给你币啊！' },
    { id: 'v20', key: 'adFail',      mood: '招揽', text: '广告没加载出来，姐先给你俩币垫着！' }
  ];

  var RULES = [
    '玩法：点机柜里任意一只娃娃，爪子就过去下爪。',
    '一次消耗 2 枚圈币，点空了算夹空，不扣保底。',
    '强爪（能出货）概率 18%，连续 8 把没出货，',
    '下一把必出，进度条实时可见。',
    '点得越准，弱爪滑落得越晚，越接近洞口。',
    '开局领 20 币；用完可看一段广告再领 20 币。',
    '广告须完整看完才发币，中途关闭不发。',
    '不想看也能免费领 2 币，不看广告照样能玩。',
    '圈币与奖品均为虚拟道具，不充值、不兑换实物，',
    '不涉真实货币交易；梗娃造型均为原创手绘，',
    '仅玩梗、不涉任何知名 IP 形象。',
    '点任意处关闭本页。'
  ];

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * clamp(t, 0, 1); }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function wrap(ctx, text, x, y, maxW, lh, maxLines) {
    var line = '', lines = [];
    for (var i = 0; i < text.length; i++) {
      var test = line + text[i];
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = text[i]; }
      else line = test;
    }
    if (line) lines.push(line);
    if (maxLines) lines = lines.slice(0, maxLines);
    for (var j = 0; j < lines.length; j++) ctx.fillText(lines[j], x, y + j * lh);
    return lines.length;
  }

  function createGame(opts) {
    opts = opts || {};
    var R = opts.random || Math.random;
    var voice = opts.voice || function () {};
    var sfx = opts.sfx || function () {};
    var store = opts.storage || { get: function () { return null; }, set: function () {} };
    var ads = opts.ads || null;   // 壳层注入：{ available, show(done) }

    var LINE_MAP = {};
    var src = (root.ClawLines && root.ClawLines.lines) || FALLBACK;
    for (var i = 0; i < src.length; i++) LINE_MAP[src[i].key] = src[i];

    var G = {
      W: W, H: H, BALANCE: BALANCE, PLUSH: PLUSH, RULES: RULES,
      state: 'idle', t: 0, dt: 0, time: 0,
      coins: 0, pity: 0, plays: 0, wins: 0,
      misses: 0, slips: 0, pityHits: 0, streak: 0, combo: 0,
      got: {}, voiceOn: true, showRules: false,
      // 广告换币
      welcomed: false, panel: null, adBusy: false, adToken: 0,
      adResult: '', adCount: 0, freeCount: 0,
      dolls: [], fx: [], bubble: null, face: 'happy', bubbleT: 0,
      claw: { x: CLAW_HOME, y: TOP_Y, fromX: CLAW_HOME, toX: CLAW_HOME, open: 1, targetY: TOP_Y },
      mode: 'weak', miss: false, slipAt: 0.8, target: null, held: null,
      lastKey: '', lastWinFirst: false, roundWins: 0,
      banner: '', bannerT: 0
    };

    /* ---------------- 存档 ---------------- */
    function save() {
      store.set({
        coins: G.coins, pity: G.pity, got: G.got, plays: G.plays, wins: G.wins,
        welcomed: G.welcomed, adCount: G.adCount, freeCount: G.freeCount
      });
    }
    function load() {
      var s = store.get();
      if (!s) return;
      G.coins = typeof s.coins === 'number' ? s.coins : 0;
      G.pity = s.pity || 0; G.got = s.got || {};
      G.plays = s.plays || 0; G.wins = s.wins || 0;
      G.welcomed = !!s.welcomed;
      G.adCount = s.adCount || 0; G.freeCount = s.freeCount || 0;
    }

    /* ---------------- 娃娃堆 ----------------
     * 三行深度：后排小、前排大，营造柜内纵深 */
    function slots() {
      return [
        { x: 92, y: 432, s: 0.84 }, { x: 168, y: 428, s: 0.84 }, { x: 244, y: 432, s: 0.84 },
        { x: 88, y: 480, s: 0.96 }, { x: 168, y: 478, s: 0.96 }, { x: 248, y: 480, s: 0.96 },
        { x: 126, y: 514, s: 1.08 }, { x: 208, y: 516, s: 1.08 }
      ];
    }
    function makePile() {
      G.dolls = [];
      var s = slots();
      for (var i = 0; i < s.length; i++) {
        G.dolls.push({
          type: PLUSH[i % PLUSH.length], x: s[i].x, y: s[i].y, s: s[i].s,
          homeX: s[i].x, homeY: s[i].y, state: 'pile',
          vx: 0, vy: 0, rot: (R() - 0.5) * 0.18, alpha: 1, bounce: 0
        });
      }
    }
    function respawn(old) {
      // 出货后按原坑位补一只全新梗娃，保持摊子不空（v2 修复：不再复用已有对象导致重复入列）
      var s = (old && old.homeX != null) ? { x: old.homeX, y: old.homeY, s: old.s || 1 } : slots()[Math.floor(R() * 8)];
      G.dolls.push({
        type: PLUSH[Math.floor(R() * PLUSH.length)],
        x: s.x, y: s.y, s: s.s, homeX: s.x, homeY: s.y, state: 'pile',
        vx: 0, vy: 0, rot: (R() - 0.5) * 0.18, alpha: 1, bounce: 0
      });
    }
    function nearest(x, y) {
      var best = null, bd = 1e9;
      for (var i = 0; i < G.dolls.length; i++) {
        var d = G.dolls[i];
        if (d.state !== 'pile') continue;
        var dx = d.x - x, dy = (d.y - 12) - y;
        var dist = Math.sqrt(dx * dx + dy * dy * 0.55);
        if (dist < bd) { bd = dist; best = d; }
      }
      return { doll: best, dist: bd };
    }

    /* ---------------- 老板说话 ---------------- */
    function say(key, opt) {
      var line = LINE_MAP[key];
      if (!line) return;
      opt = opt || {};
      G.bubble = { text: line.text, mood: line.mood || '', key: key, t: 0, dur: opt.dur || 2.8 };
      G.face = faceOf(line.mood);
      G.bubbleT = 0;
      // 同一句连着触发时只换字幕、不重复播语音，避免复读机
      var again = (G.lastKey === key);
      G.lastKey = key;
      if (!again && G.voiceOn) voice(line.id, line.text, line.mood);
      if (!again) sfx(moodSfx(line.mood));
    }
    function moodSfx(m) {
      if (m === '懊恼' || m === '认栽' || m === '心疼') return 'sigh';
      if (m === '嘲讽' || m === '暗爽' || m === '调侃') return 'laugh';
      return 'blip';
    }
    function faceOf(m) {
      if (m === '懊恼' || m === '认栽') return 'pain';
      if (m === '心疼') return 'weep';
      if (m === '心虚') return 'sweat';
      if (m === '嘲讽' || m === '暗爽' || m === '调侃') return 'smug';
      return 'happy';
    }
    function pop(text, x, y, color, size) {
      G.fx.push({ text: text, x: x, y: y, color: color || '#C6322B', size: size || 20, life: 1.3, max: 1.3 });
    }

    /* ---------------- 广告换币 ----------------
     * 合规要点（微信小游戏流量主运营规范）：
     *   - 只在玩家主动点「看广告」时拉起，绝不自动播放；
     *   - 入口文案写明「看一段广告 / 看完领 20 币」；
     *   - 完整看完才发币，中途关闭不发；播完必发；
     *   - 广告不是唯一出口：面板可关闭，且常驻「免费领 2 币」通道；
     *   - 单屏只有一个广告入口，不诱导、不刷量。
     * 壳层 ads.show(done) 只需回调 {status:'ok',ended:true/false} 或 {status:'error'}。 */
    function openNoCoins() {
      if (G.panel === 'welcome' || G.adBusy) return;
      G.panel = 'nocoins';
      say('nocoins', { dur: 2.4 });
    }
    function claimWelcome() {
      if (G.panel !== 'welcome') return 'none';
      if (G.welcomed) { G.panel = null; return 'welcomeAgain'; }  // 防止重复领开局币
      G.coins += BALANCE.welcomeCoins;
      G.welcomed = true; G.panel = null;
      sfx('coin'); say('welcome', { dur: 3.0 }); save();
      return 'welcome';
    }
    function claimFree() {
      G.coins += BALANCE.freeCoins; G.freeCount++;
      G.panel = null; sfx('coin');
      say('adFail', { dur: 1.8 }); save();
      return 'free';
    }
    function requestAd() {
      if (G.adBusy) return 'adBusy';
      // 未配置广告位 / 未开通流量主 / 测试号：直接走免费通道，绝不卡住玩家
      if (!ads || ads.available === false) {
        G.panel = 'adResult';
        G.adResult = '广告位还没接上，先送你 2 币垫着';
        G.coins += BALANCE.freeCoins; G.freeCount++;
        sfx('coin'); say('adFail'); save();
        return 'adFallback';
      }
      G.adBusy = true; G.adToken++;
      var tk = G.adToken;
      G.panel = null; G.adResult = '';
      try {
        ads.show(function (res) { settleAd(tk, res); });
      } catch (e) {
        settleAd(tk, { status: 'error' });
      }
      return 'adShow';
    }
    function settleAd(tk, res) {
      if (tk !== G.adToken || !G.adBusy) return false;  // 一次广告只结算一次
      G.adBusy = false;
      res = res || {};
      if (res.status === 'ok' && res.ended === true) {
        G.coins += BALANCE.adCoins; G.adCount++;
        G.panel = null; sfx('coin');
        pop('+20 币', W / 2, 300, '#B07A1B', 26);
        say('adReward', { dur: 2.8 });
      } else if (res.status === 'ok') {
        // 中途关闭：不发奖励，也不惩罚玩家，可随时重试
        G.panel = 'adResult'; G.adResult = '没看完，这 20 币可不能给～';
        say('adSkip', { dur: 2.4 });
      } else {
        // 无填充 / 加载失败 / 基础库不支持：给 2 币降级，保证游戏能继续
        G.panel = 'adResult'; G.adResult = '广告没加载出来，先送你 2 币垫着';
        G.coins += BALANCE.freeCoins; G.freeCount++;
        sfx('coin'); say('adFail', { dur: 2.4 });
      }
      save();
      return true;
    }

    /* ---------------- 主操作：点娃娃 = 下爪 ---------------- */
    function startGrab(tx, ty) {
      if (G.state !== 'idle') return false;
      if (G.coins < BALANCE.cost) { openNoCoins(); return false; }

      G.coins -= BALANCE.cost; G.plays++;
      sfx('coin');
      var n = nearest(tx, ty);
      var hit = n.doll && n.dist <= BALANCE.hitRadius;
      G.miss = !hit;
      G.target = hit ? n.doll : null;
      G.claw.fromX = G.claw.x;
      G.claw.toX = clamp(tx, 44, 300);
      G.claw.targetY = hit ? (n.doll.y - 14) : PILE_BOTTOM - 10;
      G.claw.open = 1;
      G.held = null;
      G.state = 'drop'; G.t = 0;

      if (hit) {
        var align = 1 - clamp(n.dist / BALANCE.hitRadius, 0, 1);
        var forced = (G.pity + 1 >= BALANCE.pity);
        G.mode = (forced || R() < BALANCE.strongRate) ? 'strong' : 'weak';
        G.pityReason = forced ? 'pity' : 'roll';
        G.slipAt = clamp(
          BALANCE.slipStart + (BALANCE.slipEnd - BALANCE.slipStart) * (0.25 + align * 0.7) + (R() - 0.5) * 0.05,
          BALANCE.slipStart, BALANCE.slipEnd
        );
        if (forced) G.pityHits++;
        say('grab', { dur: 1.6 });
      } else {
        G.mode = 'weak'; G.pityReason = 'miss';
      }
      save();
      return true;
    }

    function beginSlip() {
      var h = G.held;
      if (!h) return;
      h.state = 'falling';
      h.vx = (R() - 0.5) * 50; h.vy = -40; h.bounce = 1;
      h.x = G.claw.x; h.y = G.claw.y + 16;
      G.dolls.push(h);
      G.held = null; G.slips++; G.streak++; G.combo = 0; G.pity++;
      var p = (TOP_Y - G.claw.y) / (TOP_Y - G.claw.targetY);
      var key = p > 0.90 ? 'slipLate' : (p > 0.75 ? 'slipMid' : 'slipEarly');
      pop('差一点！', G.claw.x, G.claw.y - 26, '#C6322B', 21);
      sfx('slip');
      if (G.streak >= 3) say('missStreak'); else say(key);
      if (G.pity >= BALANCE.pity - 2) say('pityNear');
      save();
    }

    function win() {
      var h = G.held;
      if (!h) return;
      h.state = 'gone'; h.alpha = 1;
      // 放回娃娃堆，让它在出货口按 alpha 渐隐「落进洞里」，而不是瞬间凭空消失
      G.dolls.push(h);
      G.got[h.type.id] = (G.got[h.type.id] || 0) + 1;
      G.wins++; G.roundWins++; G.combo++; G.streak = 0;
      var wasPity = G.pityReason === 'pity';
      G.pity = 0; G.held = null;
      sfx('win');
      pop('出货啦！', OUT_X - 8, 466, '#3B6D11', 22);
      G.fx.push({ text: h.type.name + '到手 · ' + h.type.meme, x: W / 2, y: 264, color: '#C6322B', size: 18, life: 2.0, max: 2.0 });
      G.fx.push({ text: '+1 图鉴', x: OUT_X - 6, y: 492, color: '#3B6D11', size: 15, life: 1.4, max: 1.4 });
      var kinds = Object.keys(G.got).length;
      if (G.roundWins === 1) say('winFirst');
      else if (wasPity) say('winPity');
      else if (G.combo >= 2) say('winStreak');
      else if (kinds >= PLUSH.length) say('clear');
      else if (kinds >= 4) say('collection');
      else say('win');
      save();
      var wonDoll = h;
      setTimeoutSafe(function () { respawn(wonDoll); }, TIMING.respawn);
    }

    // 小游戏与浏览器都可能没有 setTimeout；由壳端注入，缺省走 update 里的延时队列
    var timers = [];
    function setTimeoutSafe(fn, ms) { timers.push({ fn: fn, t: ms / 1000 }); }

    /* ---------------- 状态机 ---------------- */
    function update(dt) {
      dt = clamp(dt, 0, 0.05);
      G.dt = dt; G.time += dt; G.t += dt;
      for (var i = timers.length - 1; i >= 0; i--) {
        timers[i].t -= dt;
        if (timers[i].t <= 0) { var f = timers[i].fn; timers.splice(i, 1); f(); }
      }
      for (var j = G.fx.length - 1; j >= 0; j--) {
        G.fx[j].life -= dt; G.fx[j].y -= 22 * dt;
        if (G.fx[j].life <= 0) G.fx.splice(j, 1);
      }
      if (G.bubble) {
        G.bubble.t += dt; G.bubbleT += dt;
        if (G.bubble.t > G.bubble.dur) { G.bubble = null; G.face = 'happy'; }
      }
      if (G.bannerT > 0) G.bannerT -= dt;

      var c = G.claw;
      switch (G.state) {
        case 'drop':
          c.x = lerp(c.fromX, c.toX, G.t / TIMING.drop);
          c.y = lerp(TOP_Y, c.targetY, G.t / TIMING.drop);
          if (G.t >= TIMING.drop) { G.state = 'grip'; G.t = 0; }
          break;
        case 'grip':
          c.open = lerp(1, G.held ? 0.18 : 0.34, G.t / TIMING.grip);
          if (G.t >= TIMING.grip) {
            if (!G.miss && G.target) {
              G.target.state = 'held'; G.held = G.target;
              var idx = G.dolls.indexOf(G.target);
              if (idx >= 0) G.dolls.splice(idx, 1);
              // 关键：夹住的瞬间就把娃娃挪到爪下，绝不能让它留在原坑位
              G.held.x = c.x; G.held.y = c.y + 16; G.held.rot = 0;
            } else {
              G.misses++;
              pop('夹空了', c.x, c.targetY - 24, '#8A8172', 18);
              sfx('miss');
              if (G.streak >= 2) say('missStreak'); else say('miss');
            }
            G.state = 'lift'; G.t = 0;
          }
          break;
        case 'lift':
          // 爪子与娃娃同一帧同步上升：娃娃始终挂在爪下，不再「人爪分离」
          c.y = lerp(c.targetY, TOP_Y, G.t / TIMING.lift);
          if (G.held) { G.held.x = c.x; G.held.y = c.y + 16; }
          var p = (c.targetY - c.y) / (c.targetY - TOP_Y);
          if (G.mode === 'weak' && G.held && p >= G.slipAt) beginSlip();
          if (G.t >= TIMING.lift) {
            if (G.held) { G.state = 'carry'; G.carryFrom = c.x; }
            else G.state = 'back';
            G.t = 0;
          }
          break;
        case 'carry':
          c.x = lerp(G.carryFrom, OUT_X, G.t / TIMING.carry);
          c.y = TOP_Y + Math.sin(G.t * 8) * 2;
          if (G.held) { G.held.x = c.x; G.held.y = c.y + 16; }
          if (G.t >= TIMING.carry) { G.state = 'release'; G.t = 0; }
          break;
        case 'release':
          if (G.held) { G.held.x = OUT_X; G.held.y = lerp(TOP_Y + 16, 500, G.t / TIMING.release); }
          if (G.t >= TIMING.release) { win(); G.state = 'back'; G.t = 0; }
          break;
        case 'back':
          c.x = lerp(c.x, CLAW_HOME, G.t / TIMING.back);
          c.open = lerp(c.open, 1, G.t / TIMING.back);
          if (G.t >= TIMING.back) { c.x = CLAW_HOME; c.y = TOP_Y; c.open = 1; G.state = 'idle'; G.t = 0; }
          break;
      }

      // 掉落中的娃娃弹回堆里
      for (var k = 0; k < G.dolls.length; k++) {
        var d = G.dolls[k];
        if (d.state === 'falling') {
          d.vy += 1400 * dt;   // 滑落归位更利落，不留拖沓空档
          d.x += d.vx * dt; d.y += d.vy * dt;
          d.vx *= Math.pow(0.35, dt);
          if (d.y > d.homeY) {
            d.y = d.homeY; d.vy = -d.vy * 0.3; d.vx *= 0.5; d.bounce--;
            if (d.bounce <= 0 || Math.abs(d.vy) < 40) { d.vy = 0; d.state = 'pile'; d.x = d.homeX; d.y = d.homeY; }
          }
          d.x = clamp(d.x, 50, 286);
        } else if (d.state === 'gone') {
          d.alpha -= dt * 2;
          if (d.alpha <= 0) { var gi = G.dolls.indexOf(d); if (gi >= 0) G.dolls.splice(gi, 1); k--; }
        }
      }
    }

    /* ---------------- 绘制 ---------------- */
    function drawPlush(ctx, p, x, y, rot, alpha, sc) {
      sc = sc || 1;
      ctx.save();
      ctx.globalAlpha = alpha == null ? 1 : alpha;
      ctx.translate(x, y); ctx.rotate(rot || 0); ctx.scale(sc, sc);

      // 影子不画在娃娃身上：统一由 draw() 投到地板平面，
      // 这样娃娃被拎起来时影子会留在地面，离地感才成立。
      // ---- 耳朵 ----
      ctx.fillStyle = p.dark;
      if (p.ear === 'round') {
        ctx.beginPath(); ctx.arc(-15, -18, 7.5, 0, 6.283); ctx.arc(15, -18, 7.5, 0, 6.283); ctx.fill();
        ctx.fillStyle = p.blush;
        ctx.beginPath(); ctx.arc(-15, -18, 3.5, 0, 6.283); ctx.arc(15, -18, 3.5, 0, 6.283); ctx.fill();
      } else if (p.ear === 'flop') {
        ctx.beginPath();
        ctx.ellipse(-19, -10, 6.5, 12, -0.35, 0, 6.283);
        ctx.ellipse(19, -10, 6.5, 12, 0.35, 0, 6.283); ctx.fill();
      } else if (p.ear === 'sharp') {
        ctx.beginPath();
        ctx.moveTo(-20, -13); ctx.lineTo(-11, -26); ctx.lineTo(-7, -12); ctx.closePath();
        ctx.moveTo(20, -13); ctx.lineTo(11, -26); ctx.lineTo(7, -12); ctx.closePath();
        ctx.fill();
      }
      if (p.prop === 'curl') {  // 卷王鼠：头顶螺旋卷毛
        ctx.strokeStyle = p.dark; ctx.lineWidth = 2; ctx.lineCap = 'round';
        for (var ci = -1; ci <= 1; ci++) {
          ctx.beginPath();
          for (var a = 0; a < 4.4; a += 0.35) {
            var rr = 1.2 + a * 1.1;
            ctx.lineTo(ci * 7 + Math.cos(a) * rr, -21 - a * 1.0 + Math.sin(a) * rr);
          }
          ctx.stroke();
        }
        ctx.lineCap = 'butt';
      }

      // ---- 身体 ----
      ctx.fillStyle = p.body;
      ctx.beginPath(); ctx.ellipse(0, 0, 21, 19, 0, 0, 6.283); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.10)'; ctx.lineWidth = 1; ctx.stroke();
      // 肚皮
      ctx.fillStyle = p.belly;
      ctx.beginPath(); ctx.ellipse(0, 5, 13, 10, 0, 0, 6.283); ctx.fill();
      // 腮红
      ctx.fillStyle = p.blush; ctx.globalAlpha *= 0.55;
      ctx.beginPath(); ctx.arc(-13, 3, 4, 0, 6.283); ctx.arc(13, 3, 4, 0, 6.283); ctx.fill();
      ctx.globalAlpha = alpha == null ? 1 : alpha;

      // ---- 表情（每款 meme 一双专属眼神）----
      var f = p.face;
      ctx.strokeStyle = '#2B2825'; ctx.fillStyle = '#2B2825'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
      if (f === 'droopy') {          // 躺平 / emo：耷拉眼
        ctx.beginPath();
        ctx.moveTo(-10, -5); ctx.lineTo(-4, -3.4);
        ctx.moveTo(4, -3.4); ctx.lineTo(10, -5); ctx.stroke();
      } else if (f === 'dead') {     // 摆烂：眼神放空上飘
        ctx.beginPath();
        ctx.moveTo(-10, -5); ctx.lineTo(-4, -5);
        ctx.moveTo(4, -5); ctx.lineTo(10, -5); ctx.stroke();
        ctx.beginPath(); ctx.arc(-7, -6.6, 1.6, 0, 6.283); ctx.arc(7, -6.6, 1.6, 0, 6.283); ctx.fill();
      } else if (f === 'sour') {     // 柠檬：酸到眯眼 ><
        ctx.beginPath();
        ctx.moveTo(-10, -7); ctx.lineTo(-4, -4.5); ctx.lineTo(-10, -2);
        ctx.moveTo(10, -7); ctx.lineTo(4, -4.5); ctx.lineTo(10, -2); ctx.stroke();
      } else if (f === 'angry') {    // 暴躁：倒八字眉
        ctx.beginPath(); ctx.arc(-7, -5, 2.3, 0, 6.283); ctx.arc(7, -5, 2.3, 0, 6.283); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-12, -11); ctx.lineTo(-4, -8);
        ctx.moveTo(12, -11); ctx.lineTo(4, -8); ctx.stroke();
      } else if (f === 'smug') {     // 卷王：单边眨眼
        ctx.beginPath(); ctx.arc(-7, -5, 2.3, 0, 6.283); ctx.fill();
        ctx.beginPath(); ctx.moveTo(4, -4.6); ctx.lineTo(10, -4.6); ctx.stroke();
      } else {                       // happy：圆眼
        ctx.beginPath(); ctx.arc(-7, -5, 2.3, 0, 6.283); ctx.arc(7, -5, 2.3, 0, 6.283); ctx.fill();
      }

      // ---- 嘴 / 企鹅喙 ----
      ctx.strokeStyle = '#2B2825'; ctx.lineWidth = 1.3;
      if (p.beak) {
        ctx.fillStyle = '#F0953F';
        ctx.beginPath(); ctx.moveTo(-3.5, 0); ctx.lineTo(0, -1.5); ctx.lineTo(3.5, 0); ctx.lineTo(0, 4); ctx.closePath(); ctx.fill();
      } else if (f === 'angry') {
        ctx.beginPath(); ctx.arc(0, 7, 3, Math.PI + 0.35, Math.PI * 2 - 0.35); ctx.stroke();
      } else if (f === 'sour') {
        ctx.beginPath();
        ctx.moveTo(-4, 2); ctx.quadraticCurveTo(-2, 4.2, 0, 2); ctx.quadraticCurveTo(2, -0.2, 4, 2); ctx.stroke();
      } else if (f === 'smug') {
        ctx.beginPath(); ctx.moveTo(-3, 1.5); ctx.quadraticCurveTo(2, 5, 5.5, 0.5); ctx.stroke();
      } else if (f === 'droopy' || f === 'dead') {
        ctx.beginPath(); ctx.moveTo(-3.5, 2.5); ctx.lineTo(3.5, 2.5); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.arc(0, 1, 3, 0.15, Math.PI - 0.15); ctx.stroke();
      }

      // ---- 随身道具 ----
      if (p.prop === 'bowl') {       // 干饭狗：饭碗
        ctx.fillStyle = '#3E6FA6';
        ctx.beginPath(); ctx.moveTo(3, 13); ctx.quadraticCurveTo(9.5, 22, 16, 13); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#FFFDF6';
        ctx.beginPath(); ctx.ellipse(9.5, 13.4, 6.5, 2, 0, 0, 6.283); ctx.fill();
      } else if (p.prop === 'lemon') { // 柠檬猫：头顶小柠檬
        ctx.fillStyle = '#EFD23B'; ctx.strokeStyle = '#C2A61E'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(-16, -27, 6, 4.5, -0.3, 0, 6.283); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#8AA84A';
        ctx.beginPath(); ctx.ellipse(-13, -32, 2.5, 1.2, -0.3, 0, 6.283); ctx.fill();
      } else if (p.prop === 'coin') {  // 暴富猫：怀里抱金币
        ctx.fillStyle = '#F5C542'; ctx.strokeStyle = '#B8890F'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(0, 6, 5.5, 0, 6.283); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#B8890F'; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('¥', 0, 8.8);
      }
      ctx.lineCap = 'butt';
      ctx.restore();
    }

    function drawClaw(ctx, c) {
      var x = c.x, y = c.y;
      // 天车滑块（骑在导轨上）
      ctx.fillStyle = '#7E8A93';
      roundRect(ctx, x - 15, 205, 30, 9, 3); ctx.fill();
      ctx.strokeStyle = '#8E9AA3'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x, 214); ctx.lineTo(x, y - 6); ctx.stroke();
      ctx.fillStyle = '#B9C3CA';
      roundRect(ctx, x - 12, y - 8, 24, 10, 3); ctx.fill();
      var a = 0.25 + c.open * 0.75;
      ctx.strokeStyle = '#7C8891'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      [-1, 0, 1].forEach(function (s) {
        ctx.beginPath();
        ctx.moveTo(x + s * 7, y);
        ctx.lineTo(x + s * (10 + 12 * a), y + 14);
        ctx.lineTo(x + s * (7 + 16 * a), y + 25);
        ctx.stroke();
      });
      ctx.lineCap = 'butt';
    }

    /* 老板：具象东北大姨 —— 花棉袄 + 盘头丸子 + 大金链子，
     * 半身从小摊台后探出来，台面上摆着币罐和蒲扇 */
    function drawVendor(ctx, g) {
      var bx = 78, by = 586;      // 头心
      var bob = Math.sin(g.time * 2) * 1.6;
      ctx.save(); ctx.translate(0, bob);

      // ---- 小摊台 ----
      ctx.fillStyle = 'rgba(60,45,30,.08)';
      ctx.beginPath(); ctx.ellipse(74, 672, 66, 7, 0, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#A8845C';
      roundRect(ctx, 8, 636, 132, 36, 8); ctx.fill();
      ctx.fillStyle = '#8E6C46';
      roundRect(ctx, 8, 636, 132, 7, 4); ctx.fill();
      // 币罐
      ctx.fillStyle = 'rgba(222,238,246,.9)';
      roundRect(ctx, 12, 612, 26, 27, 5); ctx.fill();
      ctx.fillStyle = '#F5C542';
      for (var cj = 0; cj < 6; cj++) {
        ctx.beginPath(); ctx.arc(18 + (cj % 3) * 7, 630 - Math.floor(cj / 3) * 4, 3, 0, 6.283); ctx.fill();
      }
      ctx.fillStyle = '#B07A1B';
      roundRect(ctx, 12, 607, 26, 7, 3); ctx.fill();
      // 蒲扇（搁台面）
      ctx.save(); ctx.translate(104, 660); ctx.rotate(-0.12);
      ctx.fillStyle = '#D9B465';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(22, -15, 34, -4);
      ctx.quadraticCurveTo(25, 11, 0, 6); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#B8944C'; ctx.lineWidth = 1;
      for (var fd = 0; fd < 3; fd++) {
        ctx.beginPath(); ctx.moveTo(4, 3); ctx.lineTo(10 + fd * 9, -9 + fd * 7); ctx.stroke();
      }
      ctx.restore();

      // ---- 大姨半身 ----
      // 花棉袄（大花布）
      ctx.fillStyle = '#C6322B';
      roundRect(ctx, bx - 40, by + 18, 80, 34, 16); ctx.fill();
      for (var i = 0; i < 6; i++) {
        var fxp = bx - 30 + (i % 3) * 25, fyp = by + 24 + Math.floor(i / 3) * 18;
        ctx.fillStyle = '#F5C542';
        for (var pt = 0; pt < 5; pt++) {
          var ang = pt * 1.2566 - Math.PI / 2;
          ctx.beginPath(); ctx.arc(fxp + Math.cos(ang) * 4.5, fyp + Math.sin(ang) * 4.5, 3, 0, 6.283); ctx.fill();
        }
        ctx.fillStyle = '#FFF3D0';
        ctx.beginPath(); ctx.arc(fxp, fyp, 2.6, 0, 6.283); ctx.fill();
      }
      // 大金链子 + 富字金牌
      ctx.strokeStyle = '#F5C542'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(bx, by + 24, 13, 0.35, Math.PI - 0.35); ctx.stroke();
      ctx.lineCap = 'butt';
      ctx.fillStyle = '#B8890F'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('富', bx, by + 40);
      // 左手扶台
      ctx.strokeStyle = '#C6322B'; ctx.lineWidth = 11; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(bx - 32, by + 34); ctx.lineTo(bx - 40, by + 52); ctx.stroke();
      ctx.lineCap = 'butt';
      ctx.fillStyle = '#F2C9A0';
      ctx.beginPath(); ctx.arc(bx - 42, by + 56, 6.5, 0, 6.283); ctx.fill();

      // ---- 头 ----
      ctx.fillStyle = '#F2C9A0';
      ctx.beginPath(); ctx.arc(bx, by + 2, 26, 0, 6.283); ctx.fill();
      // 盘发 + 丸子
      ctx.fillStyle = '#4B3423';
      ctx.beginPath(); ctx.arc(bx, by, 26, Math.PI * 1.02, Math.PI * 1.98); ctx.fill();
      ctx.beginPath(); ctx.arc(bx, by - 28, 8.5, 0, 6.283); ctx.fill();
      // 头花
      ctx.fillStyle = '#F5C542';
      for (var hf = 0; hf < 5; hf++) {
        var ha = hf * 1.2566;
        ctx.beginPath(); ctx.arc(bx + 22 + Math.cos(ha) * 3.6, by - 12 + Math.sin(ha) * 3.6, 2.6, 0, 6.283); ctx.fill();
      }
      ctx.fillStyle = '#FFF3D0';
      ctx.beginPath(); ctx.arc(bx + 22, by - 12, 2.2, 0, 6.283); ctx.fill();
      // 耳环
      ctx.strokeStyle = '#F5C542'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(bx - 24, by + 8, 3.4, 0, Math.PI); ctx.stroke();

      // ---- 表情 ----
      var f = g.face;
      ctx.strokeStyle = '#3A322B'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
      if (f === 'smug') {
        ctx.beginPath(); ctx.moveTo(bx - 14, by - 3); ctx.lineTo(bx - 5, by - 1);
        ctx.moveTo(bx + 5, by - 1); ctx.lineTo(bx + 14, by - 4); ctx.stroke();
      } else if (f === 'pain' || f === 'weep') {
        ctx.beginPath(); ctx.moveTo(bx - 15, by - 6); ctx.lineTo(bx - 5, by - 2);
        ctx.moveTo(bx + 5, by - 2); ctx.lineTo(bx + 15, by - 6); ctx.stroke();
      } else if (f === 'sweat') {
        ctx.beginPath(); ctx.arc(bx - 8, by - 1, 2.6, 0, 6.283); ctx.arc(bx + 8, by - 1, 2.6, 0, 6.283); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.arc(bx - 8, by - 2, 2.6, 0, 6.283); ctx.arc(bx + 8, by - 2, 2.6, 0, 6.283); ctx.stroke();
      }
      // 腮红
      ctx.fillStyle = 'rgba(232,128,124,.30)';
      ctx.beginPath(); ctx.arc(bx - 15, by + 9, 5, 0, 6.283); ctx.arc(bx + 15, by + 9, 5, 0, 6.283); ctx.fill();
      // 嘴（说话时开合）
      var speaking = !!g.bubble && g.bubble.t < g.bubble.dur - 0.2;
      var mo = speaking ? (2 + Math.abs(Math.sin(g.time * 13)) * 4) : 2;
      ctx.fillStyle = '#8B4A3F';
      ctx.beginPath(); ctx.ellipse(bx, by + 12, 5, mo, 0, 0, 6.283); ctx.fill();
      if (f === 'weep') {
        ctx.fillStyle = '#7FB5E6';
        ctx.beginPath(); ctx.ellipse(bx - 15, by + 12 + (g.time * 22 % 14), 2.5, 4, 0, 0, 6.283); ctx.fill();
      }
      if (f === 'sweat') {
        ctx.fillStyle = '#9CC9E8';
        ctx.beginPath(); ctx.ellipse(bx + 23, by - 8 + (g.time * 20 % 10), 2.2, 3.4, 0, 0, 6.283); ctx.fill();
      }
      ctx.lineCap = 'butt';
      ctx.restore();
    }

    function drawBubble(ctx, g) {
      var x = 118, y = 552, w = 250, h = 84;
      ctx.save();
      ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = '#E6DFCF'; ctx.lineWidth = 1.5;
      roundRect(ctx, x, y, w, h, 14); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath(); ctx.moveTo(x + 2, y + 50); ctx.lineTo(x - 13, y + 60); ctx.lineTo(x + 2, y + 70); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#E6DFCF'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x + 2.5, y + 49); ctx.lineTo(x - 11, y + 59); ctx.stroke();
      var mood = g.bubble ? g.bubble.mood : '招揽';
      var color = (mood === '懊恼' || mood === '认栽' || mood === '心疼') ? '#C6322B'
        : (mood === '嘲讽' || mood === '暗爽' || mood === '调侃') ? '#8A6D1F' : '#3B6D11';
      ctx.fillStyle = color; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'left';
      ctx.fillText('老板 · ' + mood, x + 14, y + 21);
      ctx.fillStyle = '#2F2B26'; ctx.font = 'bold 14px sans-serif';
      var txt = g.bubble ? g.bubble.text : '来啦老弟！两币一把，抓着算你本事！';
      wrap(ctx, txt, x + 14, y + 42, w - 28, 20, 2);
      // 说话声波
      if (g.bubble && g.bubble.t < g.bubble.dur - 0.2) {
        ctx.strokeStyle = color; ctx.lineWidth = 1.6;
        for (var i = 0; i < 3; i++) {
          var a = 0.3 + 0.7 * Math.abs(Math.sin(g.time * 7 + i));
          ctx.beginPath(); ctx.arc(x + w - 20 + i * 5, y + 18, 3 + a * 3, -0.9, 0.9); ctx.stroke();
        }
      }
      ctx.restore();
    }

    function panelBtn(ctx, x, y, w, h, label, bg, fg) {
      ctx.fillStyle = bg;
      ctx.strokeStyle = bg === '#FFFFFF' ? '#DCD3C0' : bg;
      ctx.lineWidth = 1.5;
      roundRect(ctx, x, y, w, h, 10); ctx.fill(); ctx.stroke();
      ctx.fillStyle = fg; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(label, x + w / 2, y + h / 2 + 5);
    }

    function drawPanels(ctx, g) {
      if (g.adBusy) {
        ctx.fillStyle = 'rgba(28,24,20,.62)'; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#FFFDF6'; roundRect(ctx, 60, 300, W - 120, 118, 14); ctx.fill();
        ctx.textAlign = 'center'; ctx.fillStyle = '#3B3630'; ctx.font = 'bold 17px sans-serif';
        ctx.fillText('广告播放中…', W / 2, 350);
        ctx.fillStyle = '#8A8172'; ctx.font = '12px sans-serif';
        ctx.fillText('完整看完才会发 20 币', W / 2, 378);
        return;
      }
      if (!g.panel) return;
      ctx.fillStyle = 'rgba(28,24,20,.66)'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#FFFDF6'; ctx.strokeStyle = '#DCD3C0'; ctx.lineWidth = 2;
      roundRect(ctx, 24, 224, W - 48, 296, 16); ctx.fill(); ctx.stroke();
      ctx.textAlign = 'center';
      if (g.panel === 'welcome') {
        ctx.fillStyle = '#C6322B'; ctx.font = 'bold 23px sans-serif';
        ctx.fillText('开 张 啦', W / 2, 278);
        ctx.fillStyle = '#5B544A'; ctx.font = '14px sans-serif';
        ctx.fillText('东北大姨先给你备了 20 个圈币', W / 2, 318);
        ctx.fillText('两币一把，抓着算你本事！', W / 2, 346);
        panelBtn(ctx, 64, 386, W - 128, 56, '领 20 币 · 开整', '#C6322B', '#FFF3D0');
        ctx.fillStyle = '#8A8172'; ctx.font = '12px sans-serif';
        ctx.fillText('圈币与奖品均为虚拟道具，不兑换实物', W / 2, 484);
      } else if (g.panel === 'nocoins') {
        ctx.fillStyle = '#C6322B'; ctx.font = 'bold 22px sans-serif';
        ctx.fillText('圈 币 用 完 啦', W / 2, 270);
        ctx.fillStyle = '#5B544A'; ctx.font = '12.5px sans-serif';
        ctx.fillText('看一段广告（约 15–30 秒），看完领 20 币', W / 2, 302);
        ctx.fillText('不想看也能免费领 2 币，照样接着玩', W / 2, 324);
        panelBtn(ctx, 48, 346, W - 96, 52, '看广告 · 再领 20 币', '#C6322B', '#FFF3D0');
        panelBtn(ctx, 48, 408, W - 96, 44, '不看了 · 免费领 2 币', '#FFFFFF', '#5B544A');
        ctx.fillStyle = '#8A8172'; ctx.font = '12px sans-serif';
        ctx.fillText('点空白处关闭 · 不看广告不影响继续玩', W / 2, 486);
      } else if (g.panel === 'adResult') {
        ctx.fillStyle = '#C6322B'; ctx.font = 'bold 21px sans-serif';
        ctx.fillText('老板有话说', W / 2, 288);
        ctx.fillStyle = '#3B3630'; ctx.font = 'bold 14px sans-serif';
        ctx.fillText(g.adResult, W / 2, 342);
        panelBtn(ctx, 64, 396, W - 128, 50, '知道了', '#C6322B', '#FFF3D0');
        ctx.fillStyle = '#8A8172'; ctx.font = '12px sans-serif';
        ctx.fillText('点任意处关闭', W / 2, 484);
      }
    }

    function draw(ctx) {
      var g = G;
      ctx.save();
      // 背景
      ctx.fillStyle = '#F6F0E2'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#EFE5CF'; ctx.fillRect(0, 92, W, 76);
      // 横幅
      ctx.fillStyle = '#C6322B'; roundRect(ctx, 12, 10, W - 24, 72, 10); ctx.fill();
      ctx.fillStyle = '#F5C542'; ctx.textAlign = 'center';
      ctx.font = 'bold 27px sans-serif'; ctx.fillText('地摊抓娃娃', W / 2, 50);
      ctx.font = '12px sans-serif'; ctx.fillStyle = '#FFE9B0';
      ctx.fillText('东北大姨摊 · 网红梗娃 · 抓不着不许急眼', W / 2, 70);
      for (var i = 0; i < 11; i++) {
        var lx = 24 + i * 34, ly = 12 + Math.sin(i * 1.7 + g.time * 2) * 2;
        ctx.fillStyle = i % 2 ? '#FFE9A0' : '#FFF6D8';
        ctx.beginPath(); ctx.arc(lx, ly, 2.6, 0, 6.283); ctx.fill();
      }
      // 状态卡
      ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = '#E6DFCF'; ctx.lineWidth = 1;
      roundRect(ctx, 12, 100, W - 24, 58, 12); ctx.fill(); ctx.stroke();
      var kinds = Object.keys(g.got).length;
      var cells = [
        { label: '圈 币', value: String(g.coins), c: '#B07A1B' },
        { label: '保 底', value: g.pity + ' / ' + BALANCE.pity, c: '#C6322B' },
        { label: '图 鉴', value: kinds + ' / ' + PLUSH.length, c: '#3B6D11' }
      ];
      for (var s = 0; s < 3; s++) {
        var cx = 12 + (W - 24) / 3 * (s + 0.5);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#8A8172'; ctx.font = '11px sans-serif'; ctx.fillText(cells[s].label, cx, 119);
        ctx.fillStyle = cells[s].c; ctx.font = 'bold 20px sans-serif'; ctx.fillText(cells[s].value, cx, 144);
        if (s < 2) { ctx.strokeStyle = '#EDE6D6'; ctx.beginPath(); ctx.moveTo(12 + (W - 24) / 3 * (s + 1), 108); ctx.lineTo(12 + (W - 24) / 3 * (s + 1), 150); ctx.stroke(); }
      }
      // 保底进度条
      ctx.fillStyle = '#EFE7D6'; roundRect(ctx, 24, 153, W - 48, 4, 2); ctx.fill();
      ctx.fillStyle = '#C6322B'; roundRect(ctx, 24, 153, (W - 48) * clamp(g.pity / BALANCE.pity, 0, 1), 4, 2); ctx.fill();

      // ===== 机柜（伪 3D：灯箱顶盖 / 玻璃橱窗 / 侧壁透视 / 出货口 / 落地投影）=====
      // 落地投影
      ctx.fillStyle = 'rgba(60,45,30,.10)';
      ctx.beginPath(); ctx.ellipse(W / 2, 552, 180, 11, 0, 0, 6.283); ctx.fill();
      // 柜体外壳（左右厚度：亮面→暗边）
      var shell = ctx.createLinearGradient(12, 0, W - 12, 0);
      shell.addColorStop(0, '#E7DFC9'); shell.addColorStop(0.07, '#FFFFFF');
      shell.addColorStop(0.93, '#FFFFFF'); shell.addColorStop(1, '#D5CCB4');
      ctx.fillStyle = shell; ctx.strokeStyle = '#C9C0A8'; ctx.lineWidth = 2;
      roundRect(ctx, 12, 168, W - 24, 380, 14); ctx.fill(); ctx.stroke();

      // 灯箱顶盖（跑马灯）
      var marq = ctx.createLinearGradient(0, 172, 0, 202);
      marq.addColorStop(0, '#D8462E'); marq.addColorStop(1, '#B23122');
      ctx.fillStyle = marq;
      roundRect(ctx, 20, 172, W - 40, 30, 8); ctx.fill();
      for (var m = 0; m < 10; m++) {
        var mx = 30 + m * 36.6;
        var on = ((m + Math.floor(g.time * 4)) % 2) === 0;
        ctx.fillStyle = on ? '#FFF3C4' : '#E9A62E';
        ctx.beginPath(); ctx.arc(mx, 172, 3, 0, 6.283); ctx.fill();
      }
      ctx.fillStyle = '#FFE9B0'; ctx.textAlign = 'center';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText('今日梗娃 · 全场 2 币 · 假一赔十', W / 2, 193);

      /* ===== 柜内 = 一个看得见的立方体盒子 =====
       * 前框大矩形 (24,202)-(366,536)，后壁小矩形 (64,224)-(326,424)，
       * 顶 / 底 / 左 / 右四个梯形把两面连起来，八个角用棱线描清；
       * 地板画透视网格，娃娃影子投在地板上 —— 一眼看出站在哪个平面。 */
      var FX0 = 24, FX1 = W - 24, FY0 = 202, FY1 = 536;   // 前框（近）
      var BX0 = 64, BX1 = W - 64, BY0 = 224, BY1 = 424;   // 后壁（远）

      // 后壁（远面）：上亮下暗，竖向分格 + 价签牌当纵深参照
      var cav = ctx.createLinearGradient(0, BY0, 0, BY1);
      cav.addColorStop(0, '#F8FBFD'); cav.addColorStop(0.6, '#DFE9EE'); cav.addColorStop(1, '#C1CFD8');
      ctx.fillStyle = cav; ctx.fillRect(BX0, BY0, BX1 - BX0, BY1 - BY0);
      ctx.strokeStyle = 'rgba(110,135,150,.16)'; ctx.lineWidth = 1;
      for (var bw = 1; bw < 4; bw++) {
        var bwx = BX0 + (BX1 - BX0) * bw / 4;
        ctx.beginPath(); ctx.moveTo(bwx, BY0); ctx.lineTo(bwx, BY1); ctx.stroke();
      }
      // 价签牌放在后壁左侧，避开爪子上升的主路径（x≈168）
      ctx.fillStyle = 'rgba(255,255,255,.62)';
      roundRect(ctx, 72, 306, 82, 52, 8); ctx.fill();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#B07A1B'; ctx.font = 'bold 15px sans-serif';
      ctx.fillText('2 币 / 把', 113, 328);
      ctx.fillStyle = '#7A6C56'; ctx.font = '11px sans-serif';
      ctx.fillText('童叟无欺', 113, 346);

      // 顶内壁（天花板）：前低后高的梯形，越往里越亮
      var ceil = ctx.createLinearGradient(0, FY0, 0, BY0);
      ceil.addColorStop(0, '#A9B8C3'); ceil.addColorStop(1, '#DEE8ED');
      ctx.fillStyle = ceil;
      ctx.beginPath(); ctx.moveTo(FX0, FY0); ctx.lineTo(FX1, FY0);
      ctx.lineTo(BX1, BY0); ctx.lineTo(BX0, BY0); ctx.closePath(); ctx.fill();
      // 左右内壁：光源在左上，左亮右暗
      ctx.fillStyle = '#CCDAE1';
      ctx.beginPath(); ctx.moveTo(FX0, FY0); ctx.lineTo(BX0, BY0);
      ctx.lineTo(BX0, BY1); ctx.lineTo(FX0, FY1); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#A4B2BD';
      ctx.beginPath(); ctx.moveTo(FX1, FY0); ctx.lineTo(BX1, BY0);
      ctx.lineTo(BX1, BY1); ctx.lineTo(FX1, FY1); ctx.closePath(); ctx.fill();

      // 底内壁（地板）：暖色渐变 + 透视网格
      var fl = ctx.createLinearGradient(0, BY1, 0, FY1);
      fl.addColorStop(0, '#DDC39E'); fl.addColorStop(1, '#B18B5B');
      ctx.fillStyle = fl;
      ctx.beginPath(); ctx.moveTo(BX0, BY1); ctx.lineTo(BX1, BY1);
      ctx.lineTo(FX1, FY1); ctx.lineTo(FX0, FY1); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,248,230,.38)'; ctx.lineWidth = 1;
      for (var gt = 1; gt <= 5; gt++) {          // 横向深度线
        var tt = gt / 6, gy = BY1 + (FY1 - BY1) * tt;
        var gl = BX0 + (FX0 - BX0) * tt, gr = BX1 + (FX1 - BX1) * tt;
        ctx.beginPath(); ctx.moveTo(gl, gy); ctx.lineTo(gr, gy); ctx.stroke();
      }
      for (var gv = 0; gv <= 6; gv++) {           // 纵向收敛线
        var gbx = BX0 + (BX1 - BX0) * gv / 6;
        var gfx = FX0 + (FX1 - FX0) * gv / 6;
        ctx.beginPath(); ctx.moveTo(gbx, BY1); ctx.lineTo(gfx, FY1); ctx.stroke();
      }

      // 八条棱：前框亮边、后壁暗边、四条对角收敛线
      ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(255,255,255,.8)';
      ctx.strokeRect(FX0 + 1, FY0 + 1, FX1 - FX0 - 2, FY1 - FY0 - 2);
      ctx.strokeStyle = 'rgba(60,82,98,.45)';
      ctx.strokeRect(BX0, BY0, BX1 - BX0, BY1 - BY0);
      ctx.strokeStyle = 'rgba(60,82,98,.26)'; ctx.lineWidth = 1.2;
      [[FX0, FY0, BX0, BY0], [FX1, FY0, BX1, BY0],
       [FX0, FY1, BX0, BY1], [FX1, FY1, BX1, BY1]].forEach(function (e) {
        ctx.beginPath(); ctx.moveTo(e[0], e[1]); ctx.lineTo(e[2], e[3]); ctx.stroke();
      });
      ctx.fillStyle = 'rgba(60,82,98,.30)';        // 墙脚线：后壁与地板的交界
      ctx.fillRect(BX0, BY1 - 4, BX1 - BX0, 4);

      // 天车导轨（骑在天花板前缘）
      ctx.fillStyle = '#8D9AA4'; ctx.fillRect(FX0 + 6, 207, FX1 - FX0 - 12, 5);
      ctx.fillStyle = '#C6D0D6';
      for (var rg = 0; rg < 10; rg++) ctx.fillRect(FX0 + 10 + rg * 33, 206, 3, 7);

      // 红毯：顺着地板透视铺开，不是一条水平色块
      ctx.fillStyle = 'rgba(184,46,39,.72)';
      ctx.beginPath(); ctx.moveTo(150, BY1 + 4); ctx.lineTo(240, BY1 + 4);
      ctx.lineTo(286, FY1); ctx.lineTo(104, FY1); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.20)'; ctx.lineWidth = 1;
      for (var cz = 1; cz <= 4; cz++) {
        var ct = cz / 5, cy = BY1 + (FY1 - BY1) * ct;
        ctx.beginPath();
        ctx.moveTo(150 + (104 - 150) * ct, cy);
        ctx.lineTo(240 + (286 - 240) * ct, cy); ctx.stroke();
      }

      // 出货口（整体左移，避开前框右立柱；内凹立体：外框→面板→黑洞）
      ctx.fillStyle = '#77828C'; roundRect(ctx, 286, 468, 66, 68, 9); ctx.fill();
      ctx.fillStyle = '#3B4148'; roundRect(ctx, 290, 472, 58, 60, 8); ctx.fill();
      ctx.fillStyle = '#20252A'; roundRect(ctx, 296, 478, 46, 48, 6); ctx.fill();
      var hole = ctx.createLinearGradient(0, 478, 0, 526);
      hole.addColorStop(0, 'rgba(255,255,255,.16)'); hole.addColorStop(1, 'rgba(0,0,0,.5)');
      ctx.fillStyle = hole; roundRect(ctx, 296, 478, 46, 48, 6); ctx.fill();
      // 出货口招牌（独立底板，右缘不压到立柱）
      ctx.fillStyle = '#3B4148'; roundRect(ctx, 289, 447, 60, 18, 5); ctx.fill();
      ctx.fillStyle = '#F5C542'; ctx.textAlign = 'center'; ctx.font = 'bold 11px sans-serif';
      ctx.fillText('出 货 口', 319, 460);
      // 地面投影：影子投在地板平面上，娃娃被拎起时留在原地变淡变小
      function groundShadow(sx, gy, sc, lift) {
        ctx.save();
        ctx.globalAlpha = 0.18 * (1 - lift * 0.72);
        ctx.fillStyle = '#4A3A24';
        ctx.beginPath();
        ctx.ellipse(sx, gy, 18 * sc * (1 - lift * 0.4), 4.6 * sc * (1 - lift * 0.3), 0, 0, 6.283);
        ctx.fill(); ctx.restore();
      }
      for (var sh = 0; sh < g.dolls.length; sh++) {
        var sd = g.dolls[sh];
        if (sd.state !== 'pile' && sd.state !== 'falling') continue;
        var sgy = (sd.homeY || sd.y) + 19 * (sd.s || 1);
        groundShadow(sd.x, sgy, sd.s || 1, clamp((sgy - sd.y) / 220, 0, 1));
      }
      if (g.held) {
        var hd = g.held, hgy = (hd.homeY || 500) + 19 * (hd.s || 1);
        groundShadow(hd.homeX || hd.x, hgy, hd.s || 1, clamp((hgy - hd.y) / 220, 0, 1));
      }

      // 娃娃（按远近行缩放）
      for (var d = 0; d < g.dolls.length; d++) {
        var dd = g.dolls[d];
        if (dd.state === 'pile' || dd.state === 'falling' || dd.state === 'gone')
          drawPlush(ctx, dd.type, dd.x, dd.y, dd.rot, dd.alpha, dd.s);
      }
      // 被夹住的娃娃：坐标由 update 每帧同步，始终挂在爪下
      if (g.held) drawPlush(ctx, g.held.type, g.held.x, g.held.y, 0, 1, g.held.s || 1);
      drawClaw(ctx, g.claw);

      // 前框四根立柱（画在娃娃之上 = 玻璃档在前面）
      ctx.fillStyle = '#F5F1E5';
      ctx.fillRect(FX0 - 2, FY0, 8, FY1 - FY0);
      ctx.fillRect(FX1 - 6, FY0, 8, FY1 - FY0);
      ctx.fillRect(FX0 - 2, FY0, FX1 - FX0 + 4, 7);
      ctx.fillRect(FX0 - 2, FY1 - 8, FX1 - FX0 + 4, 9);
      ctx.strokeStyle = '#CFC6B0'; ctx.lineWidth = 1;
      ctx.strokeRect(FX0 - 2, FY0, FX1 - FX0 + 4, FY1 - FY0);

      // 前玻璃反光（减弱，别把柜内结构糊住）
      ctx.save();
      roundRect(ctx, FX0, FY0, FX1 - FX0, FY1 - FY0, 10);
      ctx.clip();
      ctx.fillStyle = 'rgba(255,255,255,.075)';
      ctx.beginPath(); ctx.moveTo(60, FY0); ctx.lineTo(126, FY0);
      ctx.lineTo(FX0 + 8, 382); ctx.lineTo(FX0, 330); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.045)';
      ctx.beginPath(); ctx.moveTo(170, FY0); ctx.lineTo(196, FY0);
      ctx.lineTo(78, FY1); ctx.lineTo(48, FY1); ctx.closePath(); ctx.fill();
      var hg = ctx.createLinearGradient(0, FY0, 0, FY0 + 34);
      hg.addColorStop(0, 'rgba(255,255,255,.16)'); hg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = hg; ctx.fillRect(FX0, FY0, FX1 - FX0, 34);
      ctx.restore();
      // 柜内提示
      ctx.fillStyle = 'rgba(255,255,255,.88)'; roundRect(ctx, 40, 252, 226, 26, 13); ctx.fill();
      ctx.fillStyle = '#6B6459'; ctx.textAlign = 'center'; ctx.font = '12px sans-serif';
      ctx.fillText('点任意一只梗娃就下爪 · ' + BALANCE.cost + ' 币', 153, 269);

      drawVendor(ctx, g);
      drawBubble(ctx, g);

      // 飘字
      for (var f = 0; f < g.fx.length; f++) {
        var e = g.fx[f];
        ctx.save(); ctx.globalAlpha = clamp(e.life / e.max, 0, 1);
        ctx.fillStyle = e.color; ctx.font = 'bold ' + e.size + 'px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(e.text, e.x, e.y); ctx.restore();
      }

      // 底部
      ctx.textAlign = 'center'; ctx.fillStyle = '#8A8172'; ctx.font = '12px sans-serif';
      ctx.fillText(g.state === 'idle' ? '对准了再点 · 别赖我' : '爪子忙着呢，稍等～', 212, 664);
      var btns = [
        { x: 12, w: 116, label: '免费领 ' + BALANCE.freeCoins + ' 币', key: 'gift' },
        { x: 136, w: 106, label: '规则 / 概率', key: 'rules' },
        { x: 250, w: 128, label: g.voiceOn ? '老板说话 · 开' : '老板说话 · 关', key: 'voice' }
      ];
      for (var b = 0; b < btns.length; b++) {
        var t = btns[b];
        ctx.fillStyle = t.key === 'gift' ? '#C6322B' : '#FFFFFF';
        ctx.strokeStyle = t.key === 'gift' ? '#C6322B' : '#DCD3C0'; ctx.lineWidth = 1.5;
        roundRect(ctx, t.x, 674, t.w, 38, 10); ctx.fill(); ctx.stroke();
        ctx.fillStyle = t.key === 'gift' ? '#FFF3D0' : '#5B544A';
        ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(t.label, t.x + t.w / 2, 698);
      }

      // 规则页（合规：概率、广告、虚拟道具全部明示）
      if (g.showRules) {
        ctx.fillStyle = 'rgba(28,24,20,.72)'; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#FFFDF6'; ctx.strokeStyle = '#DCD3C0'; ctx.lineWidth = 2;
        roundRect(ctx, 24, 166, W - 48, 382, 16); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#C6322B'; ctx.textAlign = 'center'; ctx.font = 'bold 20px sans-serif';
        ctx.fillText('摊主的话，都写这儿了', W / 2, 202);
        ctx.textAlign = 'left'; ctx.fillStyle = '#3B3630'; ctx.font = '12px sans-serif';
        for (var r = 0; r < RULES.length; r++) ctx.fillText(RULES[r], 42, 234 + r * 25);
        ctx.textAlign = 'center'; ctx.fillStyle = '#8A8172'; ctx.font = '12px sans-serif';
        ctx.fillText('点任意处关闭', W / 2, 532);
      }
      drawPanels(ctx, g);
      ctx.restore();
    }

    /* ---------------- 输入 ---------------- */
    function tap(x, y) {
      if (G.adBusy) return 'adBusy';
      if (G.showRules) { G.showRules = false; return 'closeRules'; }
      if (G.panel === 'welcome') return claimWelcome();       // 点哪都算领，防卡死
      if (G.panel === 'adResult') { G.panel = null; return 'closeAdResult'; }
      if (G.panel === 'nocoins') {
        if (y >= 346 && y <= 398 && x >= 48 && x <= W - 48) return requestAd();
        if (y >= 408 && y <= 452 && x >= 48 && x <= W - 48) return claimFree();
        G.panel = null; return 'closeNoCoins';               // 可关闭，广告非唯一出口
      }
      if (y >= 674 && y <= 712) {
        if (x >= 12 && x <= 128) return claimFree();
        if (x >= 136 && x <= 242) { G.showRules = true; return 'rules'; }
        if (x >= 250 && x <= 378) { G.voiceOn = !G.voiceOn; return 'voice'; }
        return 'none';
      }
      if (y >= 180 && y <= 540 && x >= 24 && x <= 366) {
        return startGrab(x, y) ? 'grab' : 'nocoins';
      }
      return 'none';
    }

    function snapshot() {
      return {
        state: G.state, coins: G.coins, pity: G.pity, plays: G.plays,
        wins: G.wins, misses: G.misses, slips: G.slips, pityHits: G.pityHits,
        got: Object.keys(G.got).length, dolls: G.dolls.length,
        voiceOn: G.voiceOn, showRules: G.showRules, mode: G.mode, miss: G.miss,
        bubble: G.bubble ? G.bubble.text : '', face: G.face,
        panel: G.panel, adBusy: G.adBusy, welcomed: G.welcomed,
        adCount: G.adCount, freeCount: G.freeCount, adResult: G.adResult
      };
    }

    load();
    makePile();
    if (!G.welcomed) { G.panel = 'welcome'; say('welcome', { dur: 3.4 }); }
    else say('greet', { dur: 3.2 });

    G.update = update; G.draw = draw; G.tap = tap; G.snapshot = snapshot;
    G.startGrab = startGrab; G.say = say; G.save = save; G.makePile = makePile;
    G.onAdResult = function (res) { return settleAd(G.adToken, res); };
    // 测试钩子：只在验证脚本里用，不影响玩法
    G.test = {
      forceMode: function (m) { G.__force = m; },
      setRandom: function (fn) { R = fn; },
      setPity: function (n) { G.pity = n; },
      setCoins: function (n) { G.coins = n; },
      requestAd: requestAd,
      settleAd: settleAd,
      openNoCoins: openNoCoins,
      setPanel: function (p) { G.panel = p; },
      getToken: function () { return G.adToken; },
      nearest: nearest,
      lines: LINE_MAP,
      forceGrab: function (x, y, mode) {
        var old = R;
        R = function () { return mode === 'strong' ? 0 : 0.99; };
        var r = startGrab(x, y);
        R = old;
        return r;
      }
    };
    return G;
  }

  var API = {
    version: '2.1',
    W: W, H: H,
    BALANCE: BALANCE,
    PLUSH: PLUSH,
    FALLBACK: FALLBACK,
    RULES: RULES,
    createGame: createGame
  };
  root.ClawCore = API;
  // 小程序预览壳用 CommonJS require 拿到同一份 API；小游戏壳仍走 globalThis.ClawCore
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis
   : (typeof window !== 'undefined' ? window
     : (typeof GameGlobal !== 'undefined' ? GameGlobal
       : (typeof module !== 'undefined' && module.exports ? module.exports : this))));
