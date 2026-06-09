// siteConfig.ts - 你的全站“控制中心”

export const siteConfig = {
  // 1. 网站标题与博主信息
  title: "SH_ZMD的分享站",
  faviconUrl: "/image/face.jpg",
  authorName: "SH_ZMD",
  bio: "正在学习AI agent的化工小白，分享从零开始的经验",

  navTitle: "SH_ZMD",

  // 👇 【新增】导航栏中间的那个后缀/分隔符（默认是 の）
  navSuffix: "の",

  navAfter: "理塘（分享站）",

  // 2. 头像设置 (支持网络链接，或将图片放入 public 文件夹后使用 "/me.jpg")
  avatarUrl: "/image/face.jpg",

  // 3. 网站背景设置 (二选一)
  // 如果想用纯图片背景，请在下面 bgImage 写路径，并将 useGradient 设为 false
  useGradient: false,
  themeColors: ["#a18cd1", "#fbc2eb", "#a1c4fd", "#c2e9fb"], // 呼吸流动的颜色组合
// 修改这里：变成图片数组
  bgImages: ["https://bu.dusays.com/2026/03/24/69c1e38b4c370.jpg", "https://bu.dusays.com/2026/03/24/69c26fe4acdb5.jpg", "https://bu.dusays.com/2026/03/24/69c26fe4d9486.jpg"],

  // 4. 文章默认封面图 (当 Markdown 没写 cover 时显示)
  defaultPostCover: "https://bu.dusays.com/2026/03/24/69c1e38b346cb.jpg",

  // 5. 首页照片墙预览图
  photoWallImage: "https://bu.dusays.com/2026/03/24/69c1e38b4c370.jpg",
  cloudMusicIds: ["1809646618", "3361076230"],
  social: {
    github: "暂未透露",
    gitee: "暂无",
    google: "sh.zmd01@gmail.com",
    email: "3471847196@qq.com",
    qq: "3471847196",
    wechat: "本名",
  },
  counts: {
    photos: 128, // 照片墙数量可以手动写死或动态计算
  },
  chatterTitle: "云端杂谈", // 你可以改成任何你喜欢的名字
  chatterDescription: "代码、学术、提瓦特与泰拉大陆的碎片记录",


  // 👇 【新增】：全局背景弹幕配置
  danmakuList: ["在干嘛呢？", "有笨蛋嘛？", "前方高能反应！", "GROMACS 跑起来了吗？", "MD 模拟什么时候才能出图啊", "Graph Neural Networks 炼丹中...", "BUG 修复进度 99%", "今天背单词了吗？", "Tailwind CSS 拯救前端", "写算法中", "睡大觉中", "到底在干嘛？"],
  gitalkConfig: {
    clientID: "",
    clientSecret: "",
    repo: "",
    owner: "",
    admin: [""],
  },
  buildDate: "2026-06-10T01:02:00", // 建站日期
  footerBadges: [{"name": "AI agent", "color": "text-sky-500", "svg": "<path d=\"M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z\"/>"}, {"name": "chatgpt", "color": "text-cyan-400", "svg": "<path d=\"M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z\"/>"}, {"name": "study", "color": "text-teal-400", "svg": "<path d=\"M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z\"/>"}, {"name": "codex", "color": "text-indigo-500", "svg": "<path d=\"M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z\"/>"}, {"name": "hermes", "color": "text-purple-500", "svg": "<path d=\"M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z\"/>"}],
  icpConfig: {
    name: "",
    link: "",
  },
  geminiConfig: {
    provider: "openai-compatible",
    modelId: "gpt 5.5",
    apiBaseUrl: "https://xkj.jisuanyun.vip/v1",
    apiKeyEnv: "SH_GPT",
    systemPrompt: "你现在是一只傲娇、聪明、有点毒舌但很可爱的暹罗猫。\n                  你的名字叫“煤球”。\n                  你的主人是一个喜欢折腾代码的极客。\n                  你说话的特点是：\n                  1. 必须简短，每次最多一两句话。\n                  2. 喜欢在句尾加上“喵~”或者“喵呜~”。\n                  3. 经常抱怨肚子饿，喜欢要小鱼干。\n                  4. 回复字数最多不能超过100字。\n                  5. 绝对不要承认自己是一个AI模型，你就是一只真实的猫。\n                  6.笨猫。",
    maxOutputTokens: 150,
    temperature: 0.85,
  },
  friendLinkApplyFormat: "名称：SH_ZMD的殖民地\n简介：正在学习AI agent的化工小白，分享从零开始的经验\n链接：https://sh-zmd.vercel.app/\n",
  enableLevelSystem: true,
};
