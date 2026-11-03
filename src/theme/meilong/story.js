// 剧本：开场、角色序章、对战前对话、体检关、结局。故事设定见 docs/故事设定.md。
// 数据格式（由 src/ui/cutscene.js 播放，src/ui/storyflow.js 组装）：
//   场景 scene：{ img: 场景图 id（见 IMAGES）或 null, cam: 'push'|'pull'|'panL'|'panR'|'still', lines: [台词] }
//   台词 line： { who: 角色 id | 'npc:名字' | null(旁白), expr: 'normal'|'angry'|'smug'|'hurt', text }
//   对战前对话里，who 为 'me' / 'opp' 时指玩家 / 对手。
// 场景图文件：public/assets/meilong/scenes/<id>.png（16:9，建议 1280×720）
// 表情立绘：  public/assets/meilong/portraits/<角色id>/<expr>.png（透明背景半身像，建议 768×1024）
// 图片缺失时播放器会用渐变色块 + 文字说明顶替，不会报错。

// 场景图清单：id → 画面描述（给出图用，统一画风：厚涂赛璐璐，北方煤矿，偏暖的工业色调）
export const IMAGES = {
  // 开场
  op_town: '黄昏，群山环抱的北方矿区全景：井架、天轮、高耸的烟囱，矿区小镇的楼房亮起灯',
  op_museum: '矿史馆玻璃柜里一盏老式矿灯（头灯），铜灯头擦得发亮，旁边是泛黄的老照片',
  op_square: '矿区广场，电线杆上的铁皮大喇叭，下面一群下了班的矿工抬头听广播',
  op_bath: '澡堂门口和食堂窗口，三三两两的矿工在低声议论，脸上带着煤灰',
  op_tunnel: '井下废弃的老三号大巷，宽阔的拱形巷道，两侧矿灯一字排开，中间空出一片擂台',
  op_eight: '巷道入口逆光，八个人的剪影并排站立，安全帽上的矿灯同时亮起',
  // 序章（每人 2 张）
  c01_a: '工作面上，年轻的采煤队长在轰鸣的采煤机旁指挥，煤尘在矿灯光柱里飞舞',
  c01_b: '老旧的家门口，墙上挂着一顶褪色的安全帽，一位退休老矿工坐在门槛上抽烟',
  c02_a: '救护中队训练场，队员们背着呼吸器在烟雾巷道里匍匐前进',
  c02_b: '值班室墙上的出警记录板，一排排日期和地点，旁边挂着救援钩',
  c03_a: '井下机电硐室，巨大的变压器和配电柜，电缆像藤蔓一样爬满墙壁',
  c03_b: '仓库里一台盖着帆布的旧采煤机，帆布一角掀开，露出擦得锃亮的零件',
  c04_a: '安监科办公室，墙上贴满隐患整改通知单，桌上一本翻旧的罚单本',
  c04_b: '多年前的井下险情现场，昏暗的巷道里一束救护队员的头灯照进来',
  c05_a: '宣传科的办公室，满墙标语和黑板报草稿，桌上堆着广播稿',
  c05_b: '矿史馆的照片墙，几十年的老照片里几乎全是男人的面孔',
  c06_a: '矿灯房里一排排充电架，几百盏矿灯的指示灯闪着绿光',
  c06_b: '深夜的矿灯房，一个姑娘趴在桌上，对着一张老矿灯的图纸出神',
  c07_a: '矿上的大澡堂门口，挂满钥匙的柜台，升井的矿工排着长队领毛巾',
  c07_b: '二十多年前的擂台老照片：一个年轻姑娘和一个年轻矿工在擂台上对峙',
  c08_a: '矿医院急诊室，白大褂挂在椅背上，桌上摊着一叠体检报告',
  c08_b: '井口，救护车旁，一个女医生背着急救包正要下井',
  // 擂台与终局
  vs_arena: '老三号大巷里的擂台，两侧围满戴安全帽的矿工，矿灯光束交错',
  checkup: '擂台尽头，一张铺着白布的桌子，上面放着听诊器和血压计，背后是巷道深处的白光',
  // 结局（每人 1 张）
  c01_end: '矿史馆里，头灯旁边挂着一顶褪色的安全帽，阳光照进窗户',
  c02_end: '训练场上，救护队员身边多了一台四足巡检机器人和一架无人机',
  c03_end: '崭新的智能装备维护中心，大屏幕上跳动着设备数据，机电队长站在最前面',
  c04_end: '全矿大会的礼堂，台下坐满了人，讲台上的人摘下了白色安全帽',
  c05_end: '矿史馆新增的一面墙，上面写满女性的名字，前面摆着鲜花',
  c06_end: '矿史馆里那盏头灯重新亮起，光照亮了玻璃柜里的老照片',
  c07_end: '深夜的澡堂灯火通明，热气腾腾，门口排着长队的矿工们有说有笑',
  c08_end: '矿医院的桌上，一本擂台记录本翻开着，上面写满了体检意见',
};

export const EXPRS = ['normal', 'angry', 'smug', 'hurt'];

// ———————— 开场 ————————
export const OPENING = [
  { img: 'op_town', cam: 'pull', lines: [
    { who: null, text: '北方，黑岭。' },
    { who: null, text: '一座建矿六十年的老矿。井下八百米，井上一座小镇。' },
  ] },
  { img: 'op_museum', cam: 'push', lines: [
    { who: null, text: '矿史馆里锁着一盏灯，大家叫它"头灯"。' },
    { who: null, text: '那是黑岭第一盏下井的矿灯，据说照过黑岭的第一块煤。' },
  ] },
  { img: 'op_square', cam: 'panR', lines: [
    { who: 'npc:广播', text: '全矿职工请注意：建矿六十周年，恢复"井下擂台"！' },
    { who: 'npc:广播', text: '地点，老三号大巷。奖品——头灯出馆！' },
  ] },
  { img: 'op_bath', cam: 'panL', lines: [
    { who: 'npc:老矿工', text: '擂台停了二十多年，怎么突然又办了？' },
    { who: 'npc:年轻矿工', text: '听说六十周年以后，黑岭要"大变样"……' },
    { who: 'npc:老矿工', text: '变样？关井，还是裁人？' },
  ] },
  { img: 'op_tunnel', cam: 'push', lines: [
    { who: null, text: '没人说得清。' },
    { who: null, text: '于是每个人都觉得，这一场，争的不只是一盏灯。' },
  ] },
  { img: 'op_eight', cam: 'still', lines: [
    { who: null, text: '八个人，报了名。' },
  ] },
];

// ———————— 角色序章（选人后播放） ————————
export const PROLOGUE = {
  c01: [
    { img: 'c01_a', cam: 'push', lines: [
      { who: 'npc:队员', text: '队长，听说改造以后，咱们队要裁一半人。' },
      { who: 'c01', expr: 'angry', text: '谁说的？我去问。' },
      { who: 'npc:队员', text: '问也没用啊，你又不是矿长。' },
    ] },
    { img: 'c01_b', cam: 'still', lines: [
      { who: 'npc:父亲', text: '当年擂台，我是最后一个冠军。' },
      { who: 'c01', expr: 'normal', text: '那这次，冠军要是姓林，矿上总得听听我们的话吧。' },
      { who: 'c01', expr: 'smug', text: '我爸那盏灯，该我来接了。' },
    ] },
  ],
  c02: [
    { img: 'c02_a', cam: 'panR', lines: [
      { who: 'npc:新队员', text: '罗哥，都说以后井下人少了，救护队要缩编。' },
      { who: 'c02', expr: 'angry', text: '人少了，救援就不要了？' },
    ] },
    { img: 'c02_b', cam: 'push', lines: [
      { who: 'c02', expr: 'normal', text: '这块板上的每一行，都是一条带出来的命。' },
      { who: 'c02', expr: 'normal', text: '我的本事是从险区里带人出来，不是在擂台上表演。' },
      { who: 'c02', expr: 'smug', text: '不过，今天破个例。' },
    ] },
  ],
  c03: [
    { img: 'c03_a', cam: 'pull', lines: [
      { who: 'npc:技术员', text: '雷队，新设备一来，这些老家伙都得拆了。' },
      { who: 'c03', expr: 'angry', text: '拆？它们跟了我二十年，没一天带病运转！' },
    ] },
    { img: 'c03_b', cam: 'push', lines: [
      { who: 'c03', expr: 'normal', text: '新设备我不反对。' },
      { who: 'c03', expr: 'smug', text: '但谁来管，得我说了算。拿下头灯，这话才有分量。' },
    ] },
  ],
  c04: [
    { img: 'c04_a', cam: 'panL', lines: [
      { who: 'c04', expr: 'angry', text: '井下打架？成何体统！我坚决反对！' },
      { who: 'npc:矿办主任', text: '严主任，反对无效，矿长已经定了。' },
      { who: 'c04', expr: 'normal', text: '……那我就报名。我进去盯着，谁敢违章，当场叫停。' },
    ] },
    { img: 'c04_b', cam: 'push', lines: [
      { who: null, text: '二十多年前，他在井下被困了十一个小时。' },
      { who: null, text: '出来以后，他去了安监科，再也没回过工作面。' },
      { who: 'c04', expr: 'normal', text: '安全这根弦，在我这儿，一刻都不能松。' },
    ] },
  ],
  c05: [
    { img: 'c05_a', cam: 'panR', lines: [
      { who: 'c05', expr: 'normal', text: '六十周年特刊，头版就写井下擂台……' },
      { who: 'c05', expr: 'normal', text: '再配一组老照片。我去矿史馆翻翻。' },
    ] },
    { img: 'c05_b', cam: 'pull', lines: [
      { who: 'c05', expr: 'hurt', text: '六十年……这么多照片，几乎没有一个女人。' },
      { who: 'c05', expr: 'angry', text: '稿子不写了。' },
      { who: 'c05', expr: 'smug', text: '这一场，我要自己上头版。' },
    ] },
  ],
  c06: [
    { img: 'c06_a', cam: 'panL', lines: [
      { who: 'c06', expr: 'normal', text: '三百一十七号，充好了。三百一十八号……' },
      { who: 'npc:灯房组长', text: '小方，听说头灯要出馆了。' },
      { who: 'c06', expr: 'smug', text: '真的？！' },
    ] },
    { img: 'c06_b', cam: 'push', lines: [
      { who: 'c06', expr: 'normal', text: '它里面是建矿时的原装灯头。我十五岁就想修修它。' },
      { who: 'c06', expr: 'normal', text: '只有冠军能碰那盏灯。那我就去当冠军。' },
    ] },
  ],
  c07: [
    { img: 'c07_a', cam: 'panR', lines: [
      { who: 'c07', expr: 'angry', text: '排队！钥匙拿好！洗干净了再出去！' },
      { who: 'npc:矿工', text: '霍姐，擂台你报名不？' },
      { who: 'c07', expr: 'normal', text: '……' },
    ] },
    { img: 'c07_b', cam: 'push', lines: [
      { who: null, text: '二十多年前，最后一届擂台。唯一打进决赛的女人。' },
      { who: 'c07', expr: 'normal', text: '那一场我输了。我一直想知道，如果那天没输，会怎么样。' },
      { who: 'c07', expr: 'smug', text: '报。当然报。' },
    ] },
  ],
  c08: [
    { img: 'c08_a', cam: 'push', lines: [
      { who: 'npc:矿长', text: '沈大夫，擂台最后一关，想请你来守。' },
      { who: 'c08', expr: 'normal', text: '我是医生，不是打擂的。' },
      { who: 'npc:矿长', text: '老规矩，"下井先过体检关"。' },
    ] },
    { img: 'c08_b', cam: 'still', lines: [
      { who: 'c08', expr: 'normal', text: '……也好。擂台上每一个人的身体，我都要亲眼看着。' },
      { who: 'c08', expr: 'smug', text: '放松，只是例行检查。' },
    ] },
  ],
};

// ———————— 对战前对话 ————————
// 有恩怨的组合：'玩家>对手'
export const RIVALS = {
  'c01>c07': [
    { who: 'opp', expr: 'smug', text: '林家小子。你爸当年那一下，我记了二十年。' },
    { who: 'me', expr: 'normal', text: '我爸说，擂台上唯一让他吃过亏的，就是您。' },
    { who: 'opp', expr: 'angry', text: '那今天，替他把账还了！' },
  ],
  'c07>c01': [
    { who: 'me', expr: 'normal', text: '你跟你爸，出拳的架势一模一样。' },
    { who: 'opp', expr: 'smug', text: '霍姨，我可比他快。' },
    { who: 'me', expr: 'smug', text: '那正好。二十年前那场，我要再打一遍。' },
  ],
  'c01>c03': [
    { who: 'opp', expr: 'angry', text: '采煤队的！你们那台机器，上礼拜又是我们修的！' },
    { who: 'me', expr: 'smug', text: '修得好，产量才上得去嘛。' },
    { who: 'opp', expr: 'angry', text: '只会用，不会疼！今天教教你！' },
  ],
  'c03>c01': [
    { who: 'me', expr: 'angry', text: '你们队的设备，什么时候能让我省省心？' },
    { who: 'opp', expr: 'normal', text: '雷队，打完这场，我请你喝酒赔罪。' },
    { who: 'me', expr: 'smug', text: '先让我看看你的接线牢不牢！' },
  ],
  'c02>c04': [
    { who: 'opp', expr: 'normal', text: '救护队出动一次，就是安监科失败一次。' },
    { who: 'me', expr: 'angry', text: '这句话，我听了十二年，一直不服。' },
    { who: 'opp', expr: 'normal', text: '那就用拳头说服我。' },
  ],
  'c04>c02': [
    { who: 'opp', expr: 'normal', text: '严主任，我师父常提起你。' },
    { who: 'me', expr: 'hurt', text: '……当年背我出来的，是他。' },
    { who: 'me', expr: 'angry', text: '所以这一场，我更不能输给他的徒弟！' },
  ],
  'c06>c03': [
    { who: 'opp', expr: 'smug', text: '小姑娘家，别乱碰电。' },
    { who: 'me', expr: 'angry', text: '你们充电架上那三个坏插座，都是我修好的！' },
    { who: 'opp', expr: 'hurt', text: '……啊？' },
  ],
  'c03>c06': [
    { who: 'opp', expr: 'normal', text: '雷队，充电架的事，今天一并说清楚。' },
    { who: 'me', expr: 'smug', text: '行啊。打赢我，灯房的电归你管。' },
  ],
  'c05>c04': [
    { who: 'opp', expr: 'angry', text: '苏主任，你那条横幅挂在巷道里，属于违规悬挂！' },
    { who: 'me', expr: 'smug', text: '那这场擂台，就当是我的现场整改。' },
  ],
  'c04>c05': [
    { who: 'opp', expr: 'smug', text: '严主任，今天这一仗，我可是要上头版的。' },
    { who: 'me', expr: 'normal', text: '上头版可以。先把安全帽戴正。' },
  ],
  'c06>c02': [
    { who: 'me', expr: 'normal', text: '罗哥，你的灯是我亲手充的电。' },
    { who: 'opp', expr: 'normal', text: '我知道。十二年，它一次都没灭过。' },
    { who: 'me', expr: 'smug', text: '那今天，让你见识一下它有多亮！' },
  ],
  'c02>c06': [
    { who: 'opp', expr: 'smug', text: '罗哥，你的灯号是七号，对吧？' },
    { who: 'me', expr: 'normal', text: '……你连这个都记得。' },
  ],
  'c07>c06': [
    { who: 'opp', expr: 'normal', text: '霍姨，您每天第一个上班，最后一个走。' },
    { who: 'me', expr: 'smug', text: '你也是。灯房和澡堂，咱俩是全矿最早亮灯的。' },
  ],
  'c06>c07': [
    { who: 'opp', expr: 'smug', text: '丫头，你的灯照得亮全矿，照得亮我这擂台吗？' },
    { who: 'me', expr: 'smug', text: '霍姨，试试就知道！' },
  ],
  'c04>c07': [
    { who: 'me', expr: 'angry', text: '澡堂地面湿滑，未设警示标志，记一次！' },
    { who: 'opp', expr: 'angry', text: '严正！你这罚单，今天给我当擦脚布！' },
  ],
  'c07>c04': [
    { who: 'opp', expr: 'normal', text: '霍兰同志，你这站位已经构成违章了。' },
    { who: 'me', expr: 'angry', text: '在我的澡堂门口开了二十年罚单，今天跟你算总账！' },
  ],
};

// 没有专门恩怨时：玩家说 open，对手回 reply（各备两句，按对手轮换）
export const TAUNTS = {
  c01: { open: ['采煤队的林啸，请指教。', '我是来接我爸那盏灯的。'], reply: ['队里还等着我回去开机呢。', '想过我这关，先问问我身后这个队。'] },
  c02: { open: ['救护队罗铮。点到为止。', '我只有一个要求：别受伤。'], reply: ['我进过的险区，比你走过的巷道还多。', '站稳了，我出手不留情。'] },
  c03: { open: ['来，让我看看你的接线牢不牢。', '机电队雷钧，脾气比电压还高！'], reply: ['我这双手，拧得动六十年的螺丝。', '别碰我的设备，也别碰我！'] },
  c04: { open: ['你这个站位，已经构成违章了。', '安监科严正。先查隐患，再说别的。'], reply: ['动手之前，先把安全帽戴正。', '违章作业，当场叫停！'] },
  c05: { open: ['这一场，我要上头版。', '宣传科苏红，大喇叭准备好了！'], reply: ['你的样子，我会好好写进稿子里。', '全矿都在听着呢，别丢人。'] },
  c06: { open: ['你的灯，是我充的电。', '灯房方萤！别看我小！'], reply: ['你几号灯？我记得你。', '灯亮着，我就不会输。'] },
  c07: { open: ['洗干净了没？没洗干净的，别想上我的擂台。', '澡堂霍兰。钥匙拿好了，排队！'], reply: ['二十年前我就站在这儿了。', '打完了，来澡堂泡个热水。'] },
  c08: { open: ['放松，只是例行检查。', '矿医院沈清。我看过你的体检报告。'], reply: ['你左膝有旧伤，小心点。', '别逞强。打不动了就说。'] },
};

// ———————— 第七战：体检关 ————————
export const CHECKUP = [
  { img: 'checkup', cam: 'push', lines: [
    { who: null, text: '六战全胜。巷道尽头，亮着一盏白灯。' },
    { who: 'c08', expr: 'normal', text: '老规矩：下井先过体检关。' },
    { who: 'c08', expr: 'smug', text: '你的血压、心率、旧伤，我都清楚。现在，让我看看你的状态。' },
  ] },
];
// 某些玩家在体检关前多说一句
export const CHECKUP_EXTRA = {
  c05: [
    { who: 'c05', expr: 'normal', text: '沈清。高中那年，你考上了医学院，我没有。' },
    { who: 'c08', expr: 'normal', text: '我记得。你那年的作文，全校第一。' },
    { who: 'c05', expr: 'smug', text: '今天，我想赢你一次。' },
  ],
  c02: [
    { who: 'c08', expr: 'normal', text: '罗铮，你的腰伤还没好利索。' },
    { who: 'c02', expr: 'normal', text: '你每次下井都跟着我们，我知道你一直在看着。' },
  ],
};
// 玩家是沈清时，第七战对林啸
export const FINAL_FOR_SHEN = [
  { img: 'vs_arena', cam: 'push', lines: [
    { who: null, text: '体检关的守关人，自己走上了擂台。最后的对手，是上届冠军的儿子。' },
    { who: 'c01', expr: 'normal', text: '沈大夫？您怎么也来打擂了？' },
    { who: 'c08', expr: 'smug', text: '总得有人给冠军做最后一次体检。' },
  ] },
];

// ———————— 结局（通关后播放，然后显示 ending 文字） ————————
export const ENDINGS = {
  c01: [
    { img: 'vs_arena', cam: 'pull', lines: [
      { who: 'npc:矿长', text: '林啸，头灯是你的了。有什么话要说？' },
      { who: 'c01', expr: 'normal', text: '矿长，改造以后，采煤队的兄弟们……' },
      { who: 'npc:矿长', text: '一个不裁。全队转去学智能采煤机，你是第一批。' },
    ] },
    { img: 'c01_end', cam: 'push', lines: [
      { who: 'c01', expr: 'smug', text: '爸，你那顶帽子，我给你挂在头灯旁边了。' },
    ] },
  ],
  c02: [
    { img: 'vs_arena', cam: 'pull', lines: [
      { who: 'npc:矿长', text: '救护队不缩编。还要配机器人和无人机。' },
      { who: 'c02', expr: 'normal', text: '机器能进去，人也得能进去。' },
    ] },
    { img: 'c02_end', cam: 'panR', lines: [
      { who: null, text: '罗铮成了黑岭救护队第一任技术教官。' },
    ] },
  ],
  c03: [
    { img: 'vs_arena', cam: 'pull', lines: [
      { who: 'npc:厂家工程师', text: '这套设备的说明书，大家先看一下……' },
      { who: 'c03', expr: 'smug', text: '第十二页和第三十页，写错了。' },
    ] },
    { img: 'c03_end', cam: 'push', lines: [
      { who: null, text: '三个月后，雷钧成了黑岭智能装备维护中心的主任。' },
    ] },
  ],
  c04: [
    { img: 'c04_end', cam: 'push', lines: [
      { who: 'c04', expr: 'normal', text: '二十多年前，我在井下被困了十一个小时。' },
      { who: 'c04', expr: 'normal', text: '以后井下的人少了。这是我干安监这么多年，最想看到的事。' },
      { who: null, text: '礼堂安静了很久，然后，掌声响了起来。' },
    ] },
  ],
  c05: [
    { img: 'vs_arena', cam: 'pull', lines: [
      { who: 'c05', expr: 'smug', text: '六十周年庆典，由我来主持。' },
    ] },
    { img: 'c05_end', cam: 'panR', lines: [
      { who: 'c05', expr: 'normal', text: '第一个名字，是澡堂的霍兰。第二个，是我。' },
      { who: 'c05', expr: 'smug', text: '以后，这面墙会越写越满。' },
    ] },
  ],
  c06: [
    { img: 'c06_b', cam: 'push', lines: [
      { who: 'c06', expr: 'normal', text: '原装灯头，钨丝还在……一整夜，应该够了。' },
    ] },
    { img: 'c06_end', cam: 'pull', lines: [
      { who: null, text: '六十周年庆典上，头灯重新亮了起来。' },
      { who: 'c06', expr: 'smug', text: '我就说，它还能亮。' },
    ] },
  ],
  c07: [
    { img: 'c01_b', cam: 'push', lines: [
      { who: 'npc:林啸的父亲', text: '……霍兰？' },
      { who: 'c07', expr: 'smug', text: '二十年了。这回，我赢了。' },
      { who: null, text: '两个人对视了很久，一起笑了出来。' },
    ] },
    { img: 'c07_end', cam: 'pull', lines: [
      { who: 'c07', expr: 'normal', text: '今晚澡堂开到天亮，热水管够！' },
    ] },
  ],
  c08: [
    { img: 'c08_end', cam: 'push', lines: [
      { who: 'c08', expr: 'normal', text: '罗铮的腰、雷钧的血压、严正的旧伤、霍兰的膝盖……' },
      { who: 'c08', expr: 'smug', text: '全员合格。下次比武，请提前预约体检。' },
    ] },
  ],
};

// 所有通关结局之后都会出现的真相
export const TRUTH = [
  { img: 'op_town', cam: 'pull', lines: [
    { who: 'npc:矿长', text: '黑岭不关井。六十周年以后，黑岭要改成智能化矿井。' },
    { who: 'npc:矿长', text: '井下的人会少一大半，危险的活交给机器，地面上会多出新岗位。' },
    { who: 'npc:矿长', text: '恢复擂台，是想让大家在变样之前，再痛痛快快较一次劲。' },
  ] },
];


// ———————— 故事模式：每个角色固定的挑战顺序（6 战，第七战体检关另算），宿敌放在后面 ————————
export const ORDER = {
  c01: ['c05', 'c06', 'c02', 'c04', 'c03', 'c07'],
  c02: ['c05', 'c07', 'c01', 'c03', 'c06', 'c04'],
  c03: ['c05', 'c04', 'c02', 'c07', 'c06', 'c01'],
  c04: ['c06', 'c01', 'c03', 'c07', 'c05', 'c02'],
  c05: ['c06', 'c02', 'c03', 'c01', 'c07', 'c04'],
  c06: ['c05', 'c04', 'c01', 'c07', 'c02', 'c03'],
  c07: ['c05', 'c03', 'c02', 'c04', 'c06', 'c01'],
  c08: ['c06', 'c05', 'c03', 'c04', 'c02', 'c07'],
};

// ———————— 故事模式：非宿敌的对战前对话（me = 玩家，opp = 对手）。宿敌对话见 RIVALS ————————
export const DUELS = {
  // 林啸
  'c01>c05': [
    { who: 'opp', expr: 'smug', text: '采煤队长林啸！来，对着喇叭说两句，给全矿听听。' },
    { who: 'me', expr: 'normal', text: '苏主任，我是来比武的，不是来上广播的。' },
    { who: 'opp', expr: 'smug', text: '赢了上头版，输了也上头版。开始吧！' },
  ],
  'c01>c06': [
    { who: 'opp', expr: 'normal', text: '林队，你的 0317 号灯，昨天又晚回来四十分钟。' },
    { who: 'me', expr: 'hurt', text: '……工作面赶进度，下回一定按时。' },
    { who: 'opp', expr: 'angry', text: '灯晚回来，我就在灯房一直等。今天你得让我出这口气！' },
  ],
  'c01>c02': [
    { who: 'opp', expr: 'normal', text: '林啸，你们工作面的避险硐室，我上个月刚去检查过。' },
    { who: 'me', expr: 'normal', text: '罗哥放心，我的兄弟一个都不会让你们背出来。' },
    { who: 'opp', expr: 'smug', text: '好。那今天，我只把你一个人放倒。' },
  ],
  'c01>c04': [
    { who: 'opp', expr: 'normal', text: '林啸，你们队这个月三张罚单，我都记着。' },
    { who: 'me', expr: 'angry', text: '严主任，罚单我认，可裁员的事，总得有人去问。' },
    { who: 'opp', expr: 'smug', text: '想去问？先过我这关。站好，别违章。' },
  ],
  // 罗铮
  'c02>c05': [
    { who: 'opp', expr: 'smug', text: '救护队的硬汉罗铮！我稿子的标题都想好了：《出生入死十二年》。' },
    { who: 'me', expr: 'normal', text: '别写我。写写队里那帮年轻人。' },
    { who: 'opp', expr: 'angry', text: '那你得先赢我，我才听你的！' },
  ],
  'c02>c07': [
    { who: 'opp', expr: 'normal', text: '罗铮，每回你们演练完，澡堂的热水都不够用。' },
    { who: 'me', expr: 'smug', text: '霍姨，那今天打完，我帮你烧锅炉。' },
    { who: 'opp', expr: 'smug', text: '先别说大话，站得住再说。' },
  ],
  'c02>c01': [
    { who: 'opp', expr: 'normal', text: '罗哥，我们队的兄弟都说，见了你就踏实。' },
    { who: 'me', expr: 'normal', text: '最好一辈子别在井下见到我。' },
    { who: 'opp', expr: 'smug', text: '那就在擂台上见！' },
  ],
  'c02>c03': [
    { who: 'opp', expr: 'angry', text: '你们救护队的设备，又找我们机电队要人修！' },
    { who: 'me', expr: 'normal', text: '修得好。那台呼吸器，前年救了三个人。' },
    { who: 'opp', expr: 'smug', text: '……行，这句爱听。手下照样不留情！' },
  ],
  // 雷钧
  'c03>c05': [
    { who: 'opp', expr: 'smug', text: '雷队！你上回在大会上拍桌子，我可全录下来了。' },
    { who: 'me', expr: 'angry', text: '录了又怎样？设备的事，我说的没错！' },
    { who: 'opp', expr: 'smug', text: '那就拿拳头再说一遍，我给你放广播里！' },
  ],
  'c03>c04': [
    { who: 'opp', expr: 'normal', text: '雷钧，三号皮带机的接地，你签了字。' },
    { who: 'me', expr: 'angry', text: '我签的字，我负责！你查一百遍也是合格！' },
    { who: 'opp', expr: 'smug', text: '那今天，我查查你本人合不合格。' },
  ],
  'c03>c02': [
    { who: 'opp', expr: 'normal', text: '雷队，我们那台老呼吸器，还是你半夜给修好的。' },
    { who: 'me', expr: 'smug', text: '记着就好。今天手下留情？' },
    { who: 'opp', expr: 'smug', text: '不留。这是对你手艺的尊重。' },
  ],
  'c03>c07': [
    { who: 'opp', expr: 'angry', text: '雷钧！澡堂的热水器上个月坏了三天，你们机电队人呢？' },
    { who: 'me', expr: 'hurt', text: '那个……那三天我们在井下抢修主排水。' },
    { who: 'opp', expr: 'smug', text: '理由我听了。账，还是要算的！' },
  ],
  // 严正
  'c04>c06': [
    { who: 'opp', expr: 'normal', text: '严主任，我们灯房的充电架，按你说的全部换了新的。' },
    { who: 'me', expr: 'normal', text: '我看到了。这是全矿最规范的一间屋子。' },
    { who: 'opp', expr: 'smug', text: '那今天，我也让你看看我规范的拳法！' },
  ],
  'c04>c01': [
    { who: 'opp', expr: 'normal', text: '严主任，您罚了我们三张单子，兄弟们都挺服气。' },
    { who: 'me', expr: 'normal', text: '服气就好。我只想你们每个人都平安升井。' },
    { who: 'opp', expr: 'smug', text: '那您也得平安打完这一场。' },
  ],
  'c04>c03': [
    { who: 'opp', expr: 'angry', text: '严正！又来查我的接线？' },
    { who: 'me', expr: 'normal', text: '你的接线我不担心。我担心的是你的脾气。' },
    { who: 'opp', expr: 'angry', text: '那你就试试，我这脾气有多高！' },
  ],
  // 苏红
  'c05>c06': [
    { who: 'opp', expr: 'normal', text: '苏主任，你那篇写灯房的稿子，我剪下来贴在墙上了。' },
    { who: 'me', expr: 'smug', text: '那今天这一场，我再给你写一篇。' },
    { who: 'opp', expr: 'smug', text: '标题我替你想好了——《小灯房打败大喇叭》！' },
  ],
  'c05>c02': [
    { who: 'opp', expr: 'normal', text: '苏主任，采访的事，我真不擅长。' },
    { who: 'me', expr: 'smug', text: '没事，你不说，我替你说。先打赢我再谈。' },
    { who: 'opp', expr: 'normal', text: '那就点到为止。' },
  ],
  'c05>c03': [
    { who: 'opp', expr: 'angry', text: '宣传科的！上回你把我拍桌子的样子贴在黑板报上！' },
    { who: 'me', expr: 'smug', text: '那期黑板报，全矿评了第一。' },
    { who: 'opp', expr: 'angry', text: '今天你就拍不成了！' },
  ],
  'c05>c01': [
    { who: 'opp', expr: 'normal', text: '苏主任，您也来打擂台？' },
    { who: 'me', expr: 'angry', text: '六十年的矿史，没几个女人的名字。这一次，我要自己写上去。' },
    { who: 'opp', expr: 'smug', text: '好。那我不会让着您。' },
  ],
  'c05>c07': [
    { who: 'opp', expr: 'smug', text: '小苏，我当年进决赛的时候，你还没出生呢。' },
    { who: 'me', expr: 'normal', text: '霍姐，你是我矿史墙上要写的第一个名字。' },
    { who: 'opp', expr: 'smug', text: '那就先让我看看，你配不配写第二个！' },
  ],
  // 方萤
  'c06>c05': [
    { who: 'opp', expr: 'smug', text: '小方萤！听说你要修头灯？这可是条大新闻。' },
    { who: 'me', expr: 'normal', text: '苏姐，修好了再报道，修不好就别写了。' },
    { who: 'opp', expr: 'smug', text: '那先过我这关，修灯的事我替你喊出去！' },
  ],
  'c06>c04': [
    { who: 'opp', expr: 'normal', text: '方萤，你们灯房是全矿最规范的一间。' },
    { who: 'me', expr: 'smug', text: '那严主任，今天手下能不能也规范点？' },
    { who: 'opp', expr: 'normal', text: '规范的意思是：一招都不放水。' },
  ],
  'c06>c01': [
    { who: 'opp', expr: 'hurt', text: '方萤……我那盏灯晚回来的事，真的对不住。' },
    { who: 'me', expr: 'angry', text: '你知道我在灯房等到几点吗！' },
    { who: 'opp', expr: 'normal', text: '知道。所以今天，我认真打。' },
  ],
  // 霍兰
  'c07>c05': [
    { who: 'opp', expr: 'smug', text: '霍姐，矿史墙上的第一个名字，我写的就是你。' },
    { who: 'me', expr: 'normal', text: '写我干什么。我就是个看澡堂的。' },
    { who: 'opp', expr: 'angry', text: '看澡堂的，也打进过决赛！今天，我要亲手赢你一次！' },
  ],
  'c07>c03': [
    { who: 'opp', expr: 'hurt', text: '霍姨，热水器那回……真对不住。' },
    { who: 'me', expr: 'smug', text: '今天打完，你亲自来修。' },
    { who: 'opp', expr: 'smug', text: '修！先打！' },
  ],
  'c07>c02': [
    { who: 'opp', expr: 'normal', text: '霍姨，您这拖把，比我们的救援钩还沉。' },
    { who: 'me', expr: 'smug', text: '二十七年了，拖过的地比你们跑过的巷道还长。' },
    { who: 'opp', expr: 'smug', text: '那今天，让我领教领教。' },
  ],
  // 沈清
  'c08>c06': [
    { who: 'opp', expr: 'normal', text: '沈大夫？您怎么不在最后一关等着？' },
    { who: 'me', expr: 'normal', text: '矿长让我守关，可没说我不能先走一遍。' },
    { who: 'me', expr: 'smug', text: '方萤，你的手腕老是酸，打完我给你看看。' },
  ],
  'c08>c05': [
    { who: 'opp', expr: 'angry', text: '沈清！高中那年你考上了，我没考上。' },
    { who: 'me', expr: 'normal', text: '你没考医学院，全矿却多了一个最会说话的人。' },
    { who: 'opp', expr: 'hurt', text: '……你还是这么会讲道理。来吧！' },
  ],
  'c08>c03': [
    { who: 'opp', expr: 'angry', text: '沈大夫，你又要说我血压高？' },
    { who: 'me', expr: 'smug', text: '上周一百六十。今天这一场，你别激动。' },
    { who: 'opp', expr: 'angry', text: '……我偏要激动！' },
  ],
  'c08>c04': [
    { who: 'opp', expr: 'normal', text: '沈大夫，我那条腿的旧伤，您比我还清楚。' },
    { who: 'me', expr: 'normal', text: '十一个小时被困，落下的。我一直记着。' },
    { who: 'opp', expr: 'smug', text: '那就别手下留情。我想看看自己还行不行。' },
  ],
  'c08>c02': [
    { who: 'opp', expr: 'normal', text: '沈清，你每次跟着我们下井，从没掉过队。' },
    { who: 'me', expr: 'normal', text: '你们往前冲，总得有人在后面接着。' },
    { who: 'me', expr: 'smug', text: '今天，换我往前冲。' },
  ],
  'c08>c07': [
    { who: 'opp', expr: 'smug', text: '沈丫头，你小时候在澡堂摔破的膝盖，还是我抱去医院的。' },
    { who: 'me', expr: 'hurt', text: '……霍姨，这事您就别提了。' },
    { who: 'me', expr: 'smug', text: '今天，我来看看您的膝盖。' },
  ],
};

// ———————— 故事模式：第三战之后的中段剧情（推进"黑岭要变样"的悬念） ————————
export const MIDPOINT = {
  c01: [{ img: 'c01_b', cam: 'still', lines: [
    { who: null, text: '三战三胜。下班的人群里，有人在议论"智能化"三个字。' },
    { who: 'npc:队员', text: '队长，听说厂家的工程师已经来矿上看过工作面了。' },
    { who: 'c01', expr: 'angry', text: '那更不能停。赢到最后，我当面去问矿长。' },
  ] }],
  c02: [{ img: 'c02_b', cam: 'still', lines: [
    { who: null, text: '救护队的板子上，又多了一张新设备的说明书：井下救援机器人。' },
    { who: 'npc:新队员', text: '罗哥，机器都能下井了，还要我们吗？' },
    { who: 'c02', expr: 'normal', text: '机器能进去的地方，人也得能进去。接着打。' },
  ] }],
  c03: [{ img: 'c03_b', cam: 'still', lines: [
    { who: null, text: '机电队库房门口，停着几个贴着封条的大木箱。' },
    { who: 'c03', expr: 'angry', text: '新设备？说明书先给我看看！' },
    { who: 'c03', expr: 'smug', text: '……写得一般。等我拿下头灯，这些铁疙瘩归我管。' },
  ] }],
  c04: [{ img: 'c04_b', cam: 'still', lines: [
    { who: null, text: '深夜的安监科，只亮着一盏台灯。' },
    { who: 'c04', expr: 'hurt', text: '十一个小时……那时候要是井下少几个人，该多好。' },
    { who: 'c04', expr: 'normal', text: '继续。剩下的人，我也要一个个看着他们打完。' },
  ] }],
  c05: [{ img: 'c05_b', cam: 'still', lines: [
    { who: null, text: '宣传科的稿纸堆了半桌子，最上面一页只写了一个标题。' },
    { who: 'c05', expr: 'normal', text: '《黑岭六十年，她们在哪里》。' },
    { who: 'c05', expr: 'smug', text: '稿子写不完，那就打完再写。' },
  ] }],
  c06: [{ img: 'c06_b', cam: 'still', lines: [
    { who: null, text: '灯房里，几百盏矿灯在充电架上一闪一闪。' },
    { who: 'c06', expr: 'normal', text: '再赢几场，我就能摸到那盏头灯了。' },
    { who: 'npc:老师傅', text: '小方，那灯头六十年没亮过，你真有把握？' },
    { who: 'c06', expr: 'smug', text: '没把握，所以更要试。' },
  ] }],
  c07: [{ img: 'c07_b', cam: 'still', lines: [
    { who: null, text: '澡堂收工，霍兰一把一把清点着更衣柜的钥匙。' },
    { who: 'c07', expr: 'normal', text: '二十年前那场决赛，也是这么个晚上。' },
    { who: 'c07', expr: 'smug', text: '这回，我要把那场打完。' },
  ] }],
  c08: [{ img: 'c08_b', cam: 'still', lines: [
    { who: null, text: '矿医院的走廊里，体检报告按名字排得整整齐齐。' },
    { who: 'c08', expr: 'normal', text: '每个人身上都有旧伤，可没有一个人肯认输。' },
    { who: 'c08', expr: 'smug', text: '那就让我亲自确认一遍：他们都还打得动。' },
  ] }],
};

export default { IMAGES, EXPRS, OPENING, PROLOGUE, RIVALS, TAUNTS, CHECKUP, CHECKUP_EXTRA, FINAL_FOR_SHEN, ENDINGS, TRUTH, ORDER, DUELS, MIDPOINT };
