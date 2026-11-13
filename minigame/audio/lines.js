// 本文件由 tools/gen_voice.py 生成，请勿手改；改词请改脚本后重跑。
(function(){var R=(typeof globalThis!=='undefined')?globalThis:(typeof window!=='undefined'?window:(typeof GameGlobal!=='undefined'?GameGlobal:this));R.ClawLines = {
  "version": "1.1.0",
  "voice": "zh-CN-liaoning-XiaobeiNeural",
  "dialect": "东北话（辽宁话）",
  "character": "东北大姐摊主",
  "lines": [
    {
      "id": "v01",
      "key": "greet",
      "text": "来啦老弟！两币一把，抓着算你本事！",
      "rate": "+8%",
      "pitch": "+2Hz",
      "mood": "招呼",
      "when": "首次开局"
    },
    {
      "id": "v02",
      "key": "idle",
      "text": "随便瞅，随便挑，别光看不伸手啊！",
      "rate": "+6%",
      "pitch": "+0Hz",
      "mood": "招揽",
      "when": "空闲一段时间"
    },
    {
      "id": "v03",
      "key": "grab",
      "text": "诶，就它了？行，姐给你下爪！",
      "rate": "+8%",
      "pitch": "+1Hz",
      "mood": "招呼",
      "when": "点中娃娃下爪"
    },
    {
      "id": "v04",
      "key": "miss",
      "text": "哎呀妈呀，这都能抓空？你瞅哪儿呢！",
      "rate": "+12%",
      "pitch": "+4Hz",
      "mood": "嘲讽",
      "when": "没对准夹空"
    },
    {
      "id": "v05",
      "key": "missStreak",
      "text": "三把了吧？要不先歇会儿，喝口水再整！",
      "rate": "+5%",
      "pitch": "-1Hz",
      "mood": "调侃",
      "when": "连续 3 把没出货"
    },
    {
      "id": "v06",
      "key": "slipEarly",
      "text": "哎哟我天，爪子松得跟没吃饭似的～",
      "rate": "+6%",
      "pitch": "+0Hz",
      "mood": "暗爽",
      "when": "上升 60–75% 就滑落"
    },
    {
      "id": "v07",
      "key": "slipMid",
      "text": "哎呀妈呀！就差一丢丢，急人不！",
      "rate": "+12%",
      "pitch": "+3Hz",
      "mood": "暗爽",
      "when": "上升 75–90% 滑落"
    },
    {
      "id": "v08",
      "key": "slipLate",
      "text": "到顶了都！我这心都提到嗓子眼儿了！",
      "rate": "+15%",
      "pitch": "+6Hz",
      "mood": "暗爽",
      "when": "上升 90% 以上滑落"
    },
    {
      "id": "v09",
      "key": "win",
      "text": "行吧行吧，拿走拿走，别搁这儿显摆了！",
      "rate": "+0%",
      "pitch": "-4Hz",
      "mood": "懊恼",
      "when": "普通出货"
    },
    {
      "id": "v10",
      "key": "winFirst",
      "text": "头一把就中了？你是不是练过啊！",
      "rate": "+8%",
      "pitch": "+2Hz",
      "mood": "懊恼",
      "when": "本局第一只"
    },
    {
      "id": "v11",
      "key": "winStreak",
      "text": "我滴妈呀，又来？我这摊子快让你搬空了！",
      "rate": "+6%",
      "pitch": "-2Hz",
      "mood": "心疼",
      "when": "连续出货"
    },
    {
      "id": "v12",
      "key": "winPity",
      "text": "得得得，算你赢，下回可不带你这样的了！",
      "rate": "+0%",
      "pitch": "-5Hz",
      "mood": "认栽",
      "when": "保底出货"
    },
    {
      "id": "v13",
      "key": "pityNear",
      "text": "哎哎哎，快到底儿了啊，可别赖我！",
      "rate": "+8%",
      "pitch": "+1Hz",
      "mood": "心虚",
      "when": "保底只差 1–2 把"
    },
    {
      "id": "v14",
      "key": "nocoins",
      "text": "没币啦？姐给你添点儿，接着整！",
      "rate": "+8%",
      "pitch": "+1Hz",
      "mood": "招揽",
      "when": "币不足"
    },
    {
      "id": "v15",
      "key": "collection",
      "text": "好家伙，都收集这么些了，你是来进货的吧！",
      "rate": "+6%",
      "pitch": "+0Hz",
      "mood": "心疼",
      "when": "图鉴过半"
    },
    {
      "id": "v16",
      "key": "clear",
      "text": "完犊子，全让你抱走了，明儿我改卖烤冷面得了！",
      "rate": "+4%",
      "pitch": "-2Hz",
      "mood": "认栽",
      "when": "8 款集齐"
    },
    {
      "id": "v17",
      "key": "welcome",
      "text": "头回来吧？姐先给你二十个币，可劲儿造！",
      "rate": "+9%",
      "pitch": "+2Hz",
      "mood": "招呼",
      "when": "开局领 20 币"
    },
    {
      "id": "v18",
      "key": "adReward",
      "text": "看完啦？行，二十币拿去，悠着点儿花啊！",
      "rate": "+8%",
      "pitch": "+1Hz",
      "mood": "招揽",
      "when": "看完广告发 20 币"
    },
    {
      "id": "v19",
      "key": "adSkip",
      "text": "这广告没瞅完就关了，可不能给你币啊！",
      "rate": "+10%",
      "pitch": "+3Hz",
      "mood": "嘲讽",
      "when": "广告中途关闭"
    },
    {
      "id": "v20",
      "key": "adFail",
      "text": "广告没加载出来，姐先给你俩币垫着！",
      "rate": "+7%",
      "pitch": "+0Hz",
      "mood": "招揽",
      "when": "广告加载失败降级"
    }
  ]
};
})();
