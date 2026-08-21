// 简体中文词典。键结构必须与 ko.jsx 完全一致（由 i18n.test.mjs 强制）。
export default {
  meta: {
    title: '抽卡记录仪表盘 — 我的抽卡记录，在我自己的电脑上',
    description: '一个小型本地程序：导入崩坏：星穹铁道的跃迁记录与绝区零的调频记录，展示保底·运气·歪了(50/50)·月度统计。安装简单，完全本地，无需登录账号。',
    ogTitle: '抽卡记录仪表盘 — 我的抽卡记录，在我自己的电脑上',
    ogDescription: '在自己的电脑上分析崩坏：星穹铁道跃迁记录与绝区零调频记录 — 保底·运气·歪了(50/50)·月度统计。完全本地，无需登录。',
  },
  nav: {
    brand: '抽卡记录', logoAlt: '崩坏：星穹铁道 logo', logoAltZzz: '绝区零 logo',
    start: '快速开始', metrics: '指标', files: '保存文件', trouble: '问题排查', faq: 'FAQ',
    github: 'GitHub 仓库', theme: '切换主题', lang: '选择语言', download: '下载',
  },
  hero: {
    eyebrow: 'Honkai: Star Rail · Zenless Zone Zero · 抽卡记录分析',
    title: <>我的抽卡记录，<br /><span className="accent">在我自己的电脑上。</span></>,
    lead: <>导入崩坏：星穹铁道的<b style={{ color: 'var(--txt)' }}>跃迁</b>与绝区零的<b style={{ color: 'var(--txt)' }}>调频</b>记录，一眼看清<b style={{ color: 'var(--txt)' }}>保底 · 运气 · 歪了(50/50) · 月度统计</b>的小程序。安装并运行后，浏览器会自动打开仪表盘，用顶部切换器在两款游戏之间切换。</>,
    ctaDownload: '下载最新版本',
    ctaStart: '查看快速开始',
    chips: ['支持两款游戏', '安装简单（向导）', '完全本地 · 无需登录', 'MIT 开源'],
  },
  mock: {
    heading: <>跃迁 · 调频 <span className="g">抽卡仪表盘</span></>,
    totalPulls: '总抽数', totalUnit: ' 抽', fiveStar: '5★ / S级', fiveUnit: ' 个',
    winRate: '没歪率', winUnit: ' %', luckLabel: '运气指标 · 角色平均保底', luckUnit: ' 抽',
  },
  features: [
    { title: '安装简单', body: '一个安装向导即可完成（无需管理员权限）。自动创建开始菜单和桌面快捷方式，出新版本时启动会提醒你。' },
    { title: '完全本地', body: '所有处理只在你的电脑上进行，记录不会被发送到任何地方。也不需要登录账号。' },
    { title: '安全累积', body: '再次查询时过去的记录原样保留，只追加新记录。按游戏分开，以标准格式保存（星穹铁道为 SRGF v1.0，绝区零为 UIGF v4.0）。' },
  ],
  quick: {
    eyebrow: 'Quick Start',
    title: '四步即可完成',
    lead: '在游戏里打开一次记录界面，安装并运行，然后查询即可。最重要的是第一步。',
    step1: {
      title: <>在游戏中打开抽卡记录 <span className="badge warn">最重要</span></>,
      body: <>只<b>启动游戏是不够的。</b>必须在游戏内亲自打开记录界面，让<b>抽卡列表显示在屏幕上</b> — 星穹铁道为<b>「跃迁」→「记录」</b>，绝区零为<b>「调频」→「详情」→「调频记录」</b>。此时游戏会把鉴权信息（authkey）写入电脑缓存，本程序读取它来查询记录。</>,
      callout: <>该鉴权信息会随时间过期。请在<b>查询之前</b>先打开一次记录界面。两款游戏的鉴权信息各自独立，要查询哪款游戏就在哪款游戏里打开。</>,
    },
    step2: {
      title: '安装并运行',
      body: <>从 <a href="https://github.com/jkas2016/hsr-warp/releases/latest" target="_blank" rel="noopener">Releases</a> 下载 <code>hsr-warp-setup-X.X.X.exe</code> 并运行，会出现安装向导（无需管理员权限，安装到用户文件夹）。安装完成后，从开始菜单或桌面快捷方式启动。会弹出黑色控制台窗口，默认浏览器自动打开仪表盘（如 <code>http://127.0.0.1:8787/ui_kits/dashboard/</code>）。</>,
      callout: <>程序未签名，<b>安装或运行时 Windows 可能发出警告</b>（见下图）。如果确认是你自己下载的文件，依次点击<b>更多信息 → 仍要运行</b>即可。</>,
      shot1: { alt: 'Windows SmartScreen 警告首屏 — 「更多信息」链接', caption: <>点击<b>更多信息</b></> },
      shot2: { alt: '点击「更多信息」后出现的「仍要运行」按钮', caption: <>点击<b>仍要运行</b></> },
    },
    step3: {
      title: '查询',
      body: <>请先用顶部的<b>游戏切换器</b>选择要查看的游戏。<b>游戏路径</b>会自动填充（上次使用的路径 → 否则自动检测）。为空或不对时，请直接输入游戏文件夹 — 星穹铁道为 <code>…\Star Rail Games</code>，绝区零为 <code>…\ZenlessZoneZero Game</code>。点击<b>查询</b>按钮，只实时拉取新记录并刷新图表。已保存的记录无需查询即可直接显示。</>,
    },
    step4: {
      title: '退出',
      body: <>运行时会同时出现如下<b>黑色控制台窗口</b>（仪表盘在浏览器中打开）。看完后<b>关闭该窗口</b>，或在窗口中按 <span className="kbd">Ctrl + C</span> 即可退出程序。</>,
      shot: { alt: '与程序一同弹出的控制台窗口', caption: '关闭此窗口即退出程序。' },
    },
  },
  metricsSec: {
    eyebrow: 'Metrics',
    title: '仪表盘展示的指标',
    lead: '所有数值均按标准官方概率计算。保底越低，运气越好。',
    luck: { title: '运气指标', big: '62.5', bigUnit: ' 抽基准', body: <>将你的最高稀有度（5★ · S级）平均保底与理论平均 <b style={{ color: 'var(--txt)' }}>62.5 抽</b>（综合概率 1.6%）对比。低于该值说明运气不错。两款游戏的角色卡池采用相同基准。</> },
    avg: { title: '平均保底', body: '展示抽出最高稀有度角色平均花了多少抽，以及最幸运/最不幸的保底数。' },
    win: { title: '没歪率 (50/50)', body: <>限定卡池（星穹铁道角色活动 · 绝区零独家频段）50/50 对决中<b style={{ color: 'var(--txt)' }}>抽中 UP 的比例</b>。歪了之后的大保底另行统计。</> },
    monthly: { title: '月度汇总', body: '每月抽数 · 消耗资源（星琼 · 菲林）· 获得最高稀有度一目了然，哪个版本花得最多一看便知。' },
    criteria: {
      title: '判定标准',
      items: [
        { tag: '没歪 / 歪了', body: <>最高稀有度在<b>获得时点是当期卡池 UP（rate-up）</b>对象则判为<b>没歪</b>，否则为<b>歪了</b>。基于时点判定，可准确处理常驻池收编、复刻、联动与 Celestial Invitation（各游戏的 UP 日程见 <code>schedule.json</code>）。</> },
        { tag: '未确认', body: <>UP 日程尚未覆盖的时点（多为刚上线的新版本）的最高稀有度显示为<b>未确认</b> — 更新日程后会自动解决。</> },
        { tag: '官方概率', body: <>两款游戏骨架相同 — 角色硬保底 <b>90</b>（50/50）· 武器（光锥 · 音擎）硬保底 <b>80</b>（75/25）。仅武器的期望抽数不同（光锥 53.5 · 音擎 50）。</> },
      ],
    },
  },
  filesSec: {
    eyebrow: 'Storage',
    title: '保存的文件',
    lead: <>自动创建于安装文件夹 <code>%LOCALAPPDATA%\HSR Warp</code>。全是普通文件，可以直接打开查看。</>,
    thName: '文件夹 / 文件', thDesc: '内容',
    rows: [
      <>抽卡记录。按游戏分为 <code>data\hsr\</code> 与 <code>data\zzz\</code>，并按月保存（<code>warp_YYYYMM.json</code>）。标准格式（星穹铁道 SRGF v1.0 · 绝区零 UIGF v4.0），其他工具也能导入。</>,
      <>各游戏上次使用的游戏路径</>,
      <>运行日志（按日 <code>hsr-warp-YYYY-MM-DD.log</code>）。出问题时用来定位原因。</>,
    ],
    note: <>要迁移到其他电脑或备份，整个复制 <code>data\</code> 文件夹即可。</>,
  },
  troubleSec: {
    eyebrow: 'Troubleshooting',
    title: '问题排查',
    lead: '大多是鉴权信息（authkey）的问题。卡住时，重做第 1 步几乎总能解决。',
    cards: [
      { tag: 'authkey 已过期', body: <>仅启动游戏不会刷新。请在游戏内重新亲自打开记录界面（直到列表可见）后再查询 — 星穹铁道为<b>「跃迁」→「记录」</b>，绝区零为<b>「调频」→「详情」→「调频记录」</b>。若消息中显示的<b>签发时间</b>很旧，说明没有打开该界面。</> },
      { tag: '查询过于频繁（服务器限流）', body: <>短时间内多次查询会被服务器暂时拦截。<b>等待 1~2 分钟</b>后再查询。</> },
      { tag: '找不到游戏路径 / 没有 webCaches', body: <>请在路径输入框中直接输入游戏安装文件夹 — 星穹铁道为 <code>…\Star Rail Games</code>，绝区零为 <code>…\ZenlessZoneZero Game</code>。</> },
      { tag: '其他错误', body: <>打开 <code>logs\</code> 文件夹中最新的日志文件，即可看到卡在哪一步。需要更详细的记录时，设置 <code>HSRWARP_LOG=debug</code> 后运行（错误会附带堆栈跟踪）。</> },
    ],
  },
  faqSec: {
    eyebrow: 'FAQ',
    title: '常见问题',
    items: [
      { q: '我的账号会有风险吗？', a: <>本程序读取游戏留在电脑上的仅供查询的鉴权信息，只调用<b>只读</b>的非官方记录 API。不接触密码或账号信息，也不对游戏做任何修改。</> },
      { q: '数据会被发送到哪里？', a: <>不会发送到任何地方。只存在你的电脑与米哈游查询服务器之间的通信，结果只保存在你的电脑上。</> },
      { q: '可以使用多个账号吗？', a: <>目前按每款游戏最后一次查询的账号保存。两款游戏的记录分别存放于不同文件夹，不会混在一起。</> },
      { q: '能查到多久以前的记录？', a: <>取决于游戏服务器返回的范围。<b>绝区零</b>只返回<b>最近约 6 个月</b>的记录，比这更早的调频记录在你第一次查询时就已经取不到了。<b>崩坏：星穹铁道</b>在实测中连 6 个月以前的跃迁记录也一并返回（这是米哈游随时可能调整的服务器端策略）。已经取回的记录本程序会一直保存，所以越早开始，保留的历史越长。</> },
      { q: '新版本·新卡池会自动生效吗？', a: <>有两样东西自动更新。<b>UP 日程数据</b>（<code>schedule.json</code>）在启动时自动拉取最新版，刚上线新版本最高稀有度的"未确认"标记无需发版即可解决。<b>程序本身</b>出新版本时启动会提醒，并通过安装向导更新。</> },
      { q: '可以从源码自己构建吗？', a: <>需要同时安装 <code>go</code> 和 <code>node</code> — 只有 <code>node</code> 必须在 PATH 中，<code>go</code> 由构建脚本自动寻找。用 <code>npm run build</code> 构建静态单文件 exe，用 <code>npm start</code> 运行。详见仓库 README。</> },
    ],
  },
  cta: {
    title: '现在就来看看你的运气',
    lead: '一个安装向导即可开始。无需登录，数据不外传。',
    github: '在 GitHub 上查看',
  },
  footer: {
    brand: '抽卡记录仪表盘',
    disc: <>在本地分析崩坏：星穹铁道跃迁记录与绝区零调频记录的非官方开源工具。<b style={{ color: 'var(--txt)' }}>与 HoYoverse 无关</b>，不会修改游戏内任何数据。数据格式为 SRGF v1.0（星穹铁道）· UIGF v4.0（绝区零）。</>,
    repo: 'GitHub 仓库', releases: '下载 (Releases)', srgf: 'SRGF 格式标准',
    gacha: '概率 · 50/50 指南', arch: '架构文档',
    license: 'MIT License · © 2026 hsr-warp',
    mono: 'SRGF v1.0 · UIGF v4.0 · 硬保底 角色90 / 武器80',
  },
};
