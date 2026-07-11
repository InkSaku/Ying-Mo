# 温暖克制中文友好 UI 设计范式 Skill v2.0

> 说明：本文件是映墨项目的前端 UI 设计规范，可供 Codex、Cursor、Claude Code 等开发工具读取。  
> 用途：将本文件作为 Codex / Cursor / Claude Code / ChatGPT Agent 的前端 UI 设计技能文档。  
> 版本：v2.0，增强“只学方法、不复制结构”的边界约束，并补充多业务适配、照片生活类页面适配、字体兜底、深色模式兼容、可访问性动效规则和 Codex 汇报规范。  
> 目标：让 AI 在修改 HTML、CSS、React、Vue、Next.js、Vite 等项目前端页面时，稳定产出一种**温暖、克制、清爽、中文阅读友好、有个人站气质**的视觉风格。  
> 参考来源：本设计范式学习参考站点 `https://xn--ygr25xpohxwz.com/` 的整体设计语言、布局气质、组件节奏和交互方式。  
> 核心边界：本文件是 **UI 设计范式文档**，不是业务需求文档。它只约束视觉语言、布局节奏、组件气质和响应式方式；具体页面内容、业务模块、导航名称、文案方向，必须以每次用户给 Codex 的任务为准。

---

## 0. 一句话目标

把任何普通前端页面，改造成一个**温暖、克制、清爽、低饱和、中文阅读友好、带有手作感和个人表达气质的页面**：浅米色背景、深绿色强调色、霞鹜文楷屏幕阅读版字体、舒展留白、圆角卡片、细边框、轻阴影、柔和视觉锚点、清晰但不过度商业化的页面结构。

请注意：

- 本 Skill **不决定网站是做什么的**。
- 本 Skill **不默认生成课程、博客、文章、学习路线、教程、Bilibili 引导等业务内容**。
- 本 Skill 中所有 HTML 示例只用于说明结构和样式，不代表要照搬文案和业务模块。
- Codex 必须优先服从用户每次对话中给出的具体需求。

---

## 1. 文档定位与执行边界

### 1.1 这是 UI 范式，不是需求文档

本文件负责回答：

- 页面应该是什么气质？
- 字体、颜色、字号、行高、间距如何统一？
- 卡片、按钮、导航、列表、详情、表单、弹窗如何设计？
- 页面如何保持温暖、克制、清爽、适合中文阅读？
- 移动端如何自然适配？

本文件不负责回答：

- 网站具体做什么？
- 首页应该有哪些业务模块？
- 导航栏应该叫什么？
- 卡片里应该写课程、照片、商品、项目还是动态？
- 按钮应该跳转到哪里？

这些具体需求必须由用户在每次任务中明确给出。

### 1.2 Codex 使用本文件时的最高原则

当用户同时提供本 Skill 和具体任务时，优先级如下：

1. **用户本次明确需求**：页面内容、功能、业务场景、文案方向。
2. **项目已有功能**：不要删除已有交互、数据结构、文件路径和核心功能。
3. **本 UI Skill**：用于统一视觉语言、布局、组件和响应式。
4. **Codex 自己的默认模板**：优先级最低，不得用常见模板覆盖用户需求。

### 1.3 禁止从示例反推业务

本文件里的示例会使用中性名称，例如“内容卡片”“详情页”“媒体网格”“信息区块”。

Codex 不得因为看到：

- `card`
- `content`
- `detail`
- `tag`
- `grid`
- `sidebar`
- `hero`
- `cta`

就自动生成课程、博客、文章、教程、学习路线、Read More、Categories、Tags 等内容。

如果用户要求做照片分享网站，就围绕照片和生活记录；如果用户要求做作品集，就围绕作品；如果用户要求做后台，则在保留温暖克制气质的前提下做后台布局。


### 1.4 参考边界：只学方法，不复制标识

本 Skill 只学习参考站点的设计方法，包括：颜色系统、字体气质、留白节奏、组件克制程度、中文阅读体验、圆角与阴影系统、明暗主题方式、导航轻量感和交互轻重。

不得复制或默认生成参考站点的以下内容：

- 站点名称、logo、个人称谓、个人品牌符号。
- 课程系列、学习路线、教学栏目、课程目录。
- Bilibili / YouTube / 课程平台引导按钮。
- “从零开始，建立技术直觉”等原站核心文案。
- 原站页面结构顺序，例如固定套用“课程系列 + 课程理念 + 博客入口”。
- 原站具体图片、插画、品牌素材、页脚版权句式。
- 与用户本次项目无关的导航项、标签、按钮和详情页结构。

Codex 只能迁移设计原则，不能迁移业务表达。判断是否越界时，以“这个内容是否来自用户本次需求或当前项目已有内容”为准。

### 1.5 业务适配层：同一视觉范式，不同页面气质

本 Skill 的视觉语言是统一的，但不同业务类型的页面重心不同。Codex 必须先判断用户本次项目属于什么类型，再决定组件优先级与信息密度。

| 业务类型 | 页面重心 | 推荐组件 | 注意事项 |
|---|---|---|---|
| 照片 / 生活记录 / 相册 / 社区动态 | 图片情绪、时间感、生活流 | 媒体卡片、瀑布流、头像、地点、心情标签、轻评论入口 | 图片优先，文字退后，不要做成文章站 |
| 作品集 / 个人主页 | 项目展示、个人气质、联系方式 | 项目卡片、经历时间线、技能标签、精选作品 | 不要过度营销，保持个人表达 |
| 产品官网 / 工具官网 | 价值主张、使用场景、行动按钮 | Hero、功能卡片、流程说明、FAQ、CTA | 不要变成大厂 SaaS 模板，不要强商业风 |
| 工具页 / 上传页 / 生成页 | 操作效率、状态反馈、结果展示 | 表单、上传区、结果卡、空状态、错误状态 | 视觉温和，但效率优先 |
| 后台 / 管理页 | 信息密度、筛选、状态、操作 | 表格、筛选栏、统计卡、分页、状态标签 | 保留浅米色和绿色系统，但不宜过度文艺 |
| 文档 / 知识库 / 博客 | 阅读体验、层级结构、检索 | 目录、正文、提示框、代码块、上一篇下一篇 | 只有用户明确要求时才生成文章/博客结构 |
| 电商 / 展示页 | 商品/内容识别、价格、筛选 | 商品卡、筛选侧栏、图片网格、详情页 | 保持克制，不要高饱和促销风 |

Codex 不得把所有项目都改成“个人博客 / 知识站 / 课程站”。视觉气质统一，业务结构必须服从用户当前项目。

### 1.6 照片与生活记录类页面适配

当用户项目是照片分享、生活记录、相册、社区动态、个人影像空间、生活方式社区等类型时，优先使用以下策略：

1. **图片是第一视觉层级**：照片、相册封面、生活瞬间应比标题和说明更先被看到。
2. **文字要轻**：标题短，描述像日常记录，不写成课程简介、文章摘要或产品口号。
3. **保留照片情绪**：不要给所有图片强行套统一滤镜；允许真实光影、季节感、生活感存在。
4. **媒体卡片要低打扰**：头像、昵称、时间、地点、心情、点赞、评论等信息都用小字号、低对比。
5. **交互要轻**：喜欢、收藏、评论、分享可以存在，但不要像强社交平台那样压迫用户。
6. **首页可用照片墙或精选生活流**：用媒体网格、瀑布流、横向精选区作为视觉锚点。
7. **详情页可偏“影像手账”**：大图、时间地点、文字记录、评论区、相邻照片，不默认目录和长文章结构。
8. **空状态要温柔**：例如“这里还没有记录”“上传第一张照片”“把今天留下来”。
9. **避免博客化**：不要默认生成 Read More、文章分类、目录、作者栏、上一篇下一篇，除非项目确实是文章内容。
10. **避免课程化**：不要出现课程系列、学习路线、章节、开始学习、加入等待等内容。


---

## 2. 参考网站设计思路提炼

参考站点的价值不在于某一个具体页面，而在于一整套克制的设计判断。

### 2.1 整体气质

页面不像 SaaS 官网，不像大厂营销页，也不像后台系统。它更像：

- 一张整理得很干净的纸。
- 一个认真维护的个人站。
- 一个适合慢慢阅读和浏览的内容空间。
- 一个功能完整但不压迫用户的轻量网站。

这种气质来自几个关键选择：

1. **底色柔和**  
   页面不用纯白，而用浅米色、奶油白、浅灰绿，让页面像纸张一样温和。

2. **强调色克制**  
   深绿色只用于链接、按钮、状态、边框、关键字，不大面积铺满页面。

3. **字体有书卷气**  
   中文和西文都使用偏文艺、偏手作感的字体系统，避免默认 Arial / Helvetica 的生硬感。

4. **留白非常充足**  
   首屏、区块、卡片、文章正文都不拥挤。页面愿意“空一点”，让内容自己呼吸。

5. **组件不炫技**  
   卡片、按钮、标签、面包屑、分页、目录都很朴素，但统一、耐看。

6. **页面结构完整**  
   首页、列表页、详情页、关于页、分类页、标签页、分页、页脚等功能都存在，但每个页面都不复杂。

### 2.2 从整个网站学习到的页面范式

本 Skill 学习的是这些通用页面范式，而不是学习其业务内容：

- 首页：大标题 + 简短副标题 + 主行动按钮 + 视觉锚点 + 分区卡片 + 说明区 + CTA + Footer。
- 列表页：页面标题 + 面包屑 + 主列表/网格 + 侧边信息区 + 分页。
- 详情页：封面/主视觉 + 标题 + 元信息 + 目录 + 正文/内容区 + 引用提示 + 上下篇/相关链接 + 标签/分享。
- 关于页：上方视觉图 + 窄正文 + 清晰分段 + 引用块 + 列表说明。
- 分类/筛选页：保持列表页结构，不额外复杂化。
- 页脚：简单品牌区 + 导航链接 + 版权信息 + 返回顶部。
- 移动端：导航收敛、布局单列、留白缩小但仍不拥挤。

### 2.3 核心设计原则

执行时始终记住：

- 少即是多，但不是空。
- 温暖，不甜腻。
- 克制，不冷淡。
- 清爽，不单薄。
- 亲近，不幼稚。
- 有个人站气质，不像模板站。
- 有秩序，但不要像后台管理系统。
- 有视觉锚点，但不要过度插画化。
- 有交互反馈，但不要炫技。

---

## 3. 设计关键词

执行设计时始终围绕这些关键词：

- 温暖
- 克制
- 清爽
- 低饱和
- 中文友好
- 个人站气质
- 手作感
- 纸张感
- 轻量卡片
- 绿色强调
- 浅米色背景
- 宽松留白
- 细边框
- 轻阴影
- 温柔动效
- 标题不乱加粗
- 正文行距舒展
- 中英文统一文气
- 不商业化
- 不炫技
- 不赛博
- 不玻璃拟态
- 不大厂营销页
- 不强烈渐变
- 不纯白刺眼
- 不深色科技风

避免这些业务导向关键词作为默认内容：

- 课程感
- 博客感
- 教学站
- 学习路线
- 文章教程
- Bilibili 频道
- Read More
- Categories
- Tags

除非用户本次明确要求。

---

## 4. 颜色系统

### 4.1 核心配色

优先使用下面这组颜色。除非项目已有强品牌色，否则不要随便换。

```css
:root {
  --color-bg: #f5f4ec;
  --color-bg-soft: #faf9f2;
  --color-surface: #fffefa;
  --color-surface-muted: #f0efe7;

  --color-primary: #2f8373;
  --color-primary-dark: #22675a;
  --color-primary-soft: #d8eee8;
  --color-primary-lighter: #eaf7f3;

  --color-text: #20231f;
  --color-text-muted: #69736d;
  --color-text-subtle: #8a948d;

  --color-border: #e2e0d5;
  --color-border-strong: #d3d0c2;

  --color-code-bg: #20231e;
  --color-code-text: #e8eadf;

  --color-warning-soft: #fff6d8;
  --color-note-border: #2f8373;

  --shadow-card: 0 14px 32px rgba(32, 35, 31, 0.04);
  --shadow-card-hover: 0 18px 38px rgba(32, 35, 31, 0.07);
}
```

### 4.2 使用比例

页面中颜色使用比例建议：

| 类型 | 占比 | 用途 |
|---|---:|---|
| 浅米背景 | 60% - 70% | body、section、页面底色 |
| 奶油白/纸张白 | 18% - 25% | 卡片、内容块、表单、详情容器 |
| 深色文字 | 8% - 12% | 标题、正文、导航 |
| 绿色强调 | 3% - 6% | 按钮、链接、标签、边框、状态 |
| 柔和辅助色 | 1% - 3% | 插画、提示、轻微点缀 |

绿色是点睛，不是主背景。不要把整块区域刷成深绿色。

### 4.3 背景层次

推荐背景写法：

```css
body {
  background:
    radial-gradient(circle at 10% 8%, rgba(216, 238, 232, 0.46), transparent 30%),
    linear-gradient(180deg, var(--color-bg-soft) 0%, var(--color-bg) 360px);
}
```

这种背景能让页面有一点空气感，但不会变成花哨渐变。

### 4.4 颜色禁忌

不要使用：

- 大面积纯黑背景。
- 大面积纯白背景。
- 高饱和荧光绿。
- 蓝紫赛博渐变。
- 金属质感。
- 大面积红色、橙色。
- 强烈玻璃拟态透明色。
- 过度阴影导致的浮夸商业感。


### 4.5 圆角、阴影与层级变量

本风格的“纸片感”来自统一的圆角与轻阴影。不要每个组件单独写一套圆角和阴影。

```css
:root {
  --radius-xs: 4px;
  --radius-xs: 4px;
  --radius-sm: 7px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --radius-xl: 20px;
  --radius-2xl: 24px;
  --radius-pill: 999px;
  --radius-xl: 20px;
  --radius-2xl: 24px;
  --radius-pill: 999px;

  --shadow-card: 0 14px 32px rgba(32, 35, 31, 0.04);
  --shadow-card-hover: 0 18px 38px rgba(32, 35, 31, 0.07);
  --shadow-floating: 0 24px 60px rgba(32, 35, 31, 0.16);
  --shadow-focus: 0 0 0 4px rgba(47, 131, 115, 0.10);
}
```

使用建议：

- 小按钮、输入框：`--radius-sm` / `--radius-md`。
- 普通卡片、媒体卡片：`--radius-lg`。
- 大说明区、弹窗、Hero 视觉容器：`--radius-xl` / `--radius-2xl`。
- 标签、状态徽章：`--radius-pill`。
- 卡片默认阴影要轻，hover 只增加一点点，不要做成悬浮商业卡片。

### 4.6 品牌色替换规则

如果项目已有品牌色，Codex 可以保留项目品牌，但必须遵守：

1. 背景仍应保持柔和，不要因为品牌色改成大面积纯色背景。
2. 品牌色如果过饱和，应生成一个低饱和版本用于 UI 主色。
3. 强调色使用比例仍控制在 3% - 6%。
4. 重要按钮可用品牌色，普通链接和标签可用低饱和派生色。
5. 不要把参考站的绿色当成唯一正确答案；绿色是风格锚点，项目品牌优先。

若用户没有明确品牌色，默认使用本 Skill 的墨绿色系统。


---

## 5. 字体系统：该风格的核心亮点

> 重要程度：极高。这个风格的高级感、亲和感和中文阅读感，很大一部分来自字体系统。只要项目允许加载网页字体，就优先使用 **LXGW WenKai Screen / 霞鹜文楷屏幕阅读版**。

### 5.1 字体目标

字体最终要呈现这样的感觉：

- 中文像认真整理过的个人记录，有一点书卷气和手写感。
- 西文、数字、技术词不要像默认 Arial 那样硬。
- 标题有温柔的力量感，但不粗暴、不商业。
- 正文适合长时间阅读，行距宽松，颜色不是纯黑。
- 全站字体气质统一，导航、按钮、标题、正文、卡片、标签都像同一个系统。

### 5.2 字体引入方式

普通 HTML 项目在 `<head>` 中加入：

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/lxgw-wenkai-screen-web/style.css">
```

如果在 CSS 文件中统一引入：

```css
@import url("https://cdn.jsdelivr.net/npm/lxgw-wenkai-screen-web/style.css");
```

优先使用 `<link>`，不要重复引入。

### 5.3 全局字体变量

```css
:root {
  --font-main:
    "LXGW WenKai Screen",
    "PingFang SC",
    "Microsoft YaHei",
    "Noto Sans SC",
    system-ui,
    sans-serif;

  --font-mono:
    "LXGW WenKai Mono Screen",
    "SFMono-Regular",
    Consolas,
    "Liberation Mono",
    monospace;
}
```

### 5.4 全站应用

```css
html {
  font-family: var(--font-main);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  scroll-behavior: smooth;
}

body,
button,
input,
textarea,
select {
  font-family: var(--font-main);
}

code,
pre,
kbd,
samp {
  font-family: var(--font-mono);
}
```

### 5.5 标题字体规则

标题一定要克制。不要因为标题大就强行加粗。

```css
h1,
h2,
h3,
h4 {
  font-family: var(--font-main);
  color: var(--color-text);
  font-weight: 400;
  letter-spacing: -0.02em;
}

h1 {
  font-size: clamp(38px, 5vw, 56px);
  line-height: 1.22;
}

h2 {
  font-size: clamp(28px, 4vw, 38px);
  line-height: 1.35;
}

h3 {
  font-size: 23px;
  line-height: 1.4;
}
```

特殊情况：

- 导航栏可以使用 `font-weight: 500` 或 `600`，不要太重。
- 按钮可以使用 `font-weight: 500` 或 `600`，保证可点击性。
- 主标题优先 `font-weight: 400/500`。
- 不要全站滥用 `font-weight: 700/800`。

### 5.6 正文字体规则

```css
body {
  font-size: 16px;
  font-weight: 400;
  line-height: 1.82;
  color: var(--color-text);
}

p,
li {
  color: var(--color-text-muted);
  line-height: 1.85;
}

.content-rich p,
.detail-content p,
.article-content p {
  margin: 18px 0;
  font-size: 17px;
  line-height: 1.95;
}
```

正文颜色不要使用纯黑。推荐：

```css
--color-text: #20231f;
--color-text-muted: #69736d;
--color-text-subtle: #8a948d;
```

### 5.7 中文和西文混排

优先让 `LXGW WenKai Screen` 排在最前面：

```css
font-family: "LXGW WenKai Screen", "PingFang SC", "Microsoft YaHei", sans-serif;
```

不要默认使用：

```css
font-family: Arial, Helvetica, sans-serif;
```

也不要写成：

```css
font-family: Inter, "LXGW WenKai Screen", sans-serif;
```

除非用户明确要求更现代、更产品化的英文气质。


### 5.8 字体加载兜底

字体是该风格的核心，但 Codex 不能为了使用字体而写出错误路径或破坏项目。

字体加载优先级：

1. **项目已有本地字体文件**：优先检查 `/assets/fonts/`、`/public/fonts/`、`/static/fonts/`、`src/assets/fonts/` 等目录。
2. **CDN 引入**：如果项目允许外链，使用 `https://cdn.jsdelivr.net/npm/lxgw-wenkai-screen-web/style.css`。
3. **系统中文字体回退**：`PingFang SC`、`Microsoft YaHei`、`Noto Sans SC`。
4. **最后回退**：`system-ui`、`sans-serif`。

规则：

- 引入本地字体前，必须确认字体文件真实存在。
- 不要凭空写死 `/fonts/LXGWWenKai.woff2` 这类路径。
- 如果项目是离线部署、内网部署或不允许 CDN，必须使用本地字体或系统字体回退。
- 如果字体加载失败，页面仍应保持可读，不能出现大片乱码或布局崩坏。
- 不要把英文字体 Inter 放在文楷之前，除非用户明确要求更现代、更产品化。

### 5.9 字体与业务气质微调

不同项目可以在不破坏整体气质的前提下微调字体策略：

- 照片生活类：文楷作为主字体，突出手账感和生活记录感。
- 作品集类：文楷 + 稍克制的无衬线回退，兼顾个人气质和专业感。
- 工具类 / 后台类：可以在表格、数字、按钮中更多使用系统字体或等宽字体，提高识别效率。
- 长文阅读类：正文保持文楷或宋体/思源宋体类回退，行高加大。

无论业务类型如何，标题都不要滥用 700/800 字重。


---

## 6. 布局系统

### 6.1 容器宽度

```css
:root {
  --container-xl: 1180px;
  --container-lg: 960px;
  --container-md: 760px;
  --container-detail: 860px;
}
```

推荐：

- 首页主内容宽度：`1180px`
- 列表/网格页内容宽度：`1180px`
- 详情页正文宽度：`760px - 860px`
- 关于/说明页正文：`720px - 800px`
- 表单页主体：`560px - 720px`

### 6.2 全局留白

```css
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-7: 48px;
  --space-8: 64px;
  --space-9: 96px;
}
```

页面节奏：

- 顶部导航高度：72px - 88px
- Hero 区上下 padding：72px - 120px
- Section 上下 padding：64px - 100px
- 卡片内边距：24px - 36px
- 详情正文段落间距：18px - 24px
- 详情章节间距：48px - 72px

### 6.3 标准页面骨架

```html
<body>
  <header class="site-header"></header>
  <main>
    <section class="page-hero"></section>
    <section class="content-section"></section>
  </main>
  <footer class="site-footer"></footer>
</body>
```

### 6.4 Section 设计

```css
.content-section {
  padding: 76px 0;
}

.container {
  max-width: var(--container-xl);
  margin: 0 auto;
  padding: 0 24px;
}

.section-heading {
  max-width: 760px;
  margin: 0 auto 44px;
  text-align: center;
}

.section-heading h2 {
  margin: 0;
  font-size: clamp(28px, 4vw, 38px);
  font-weight: 500;
  line-height: 1.3;
}

.section-heading p:last-child {
  margin: 14px 0 0;
  color: var(--color-text-muted);
}
```

### 6.5 页面不要太满

每个大区块都应该有清楚的呼吸空间。不要为了“内容丰富”把页面堆满。

建议：

- 首屏最多表达一个核心主题。
- 每个 Section 只承担一个明确功能。
- 每个卡片最多 1 个标题、1 段描述、1 组辅助信息、1 个主操作。
- 不要在同一块区域同时放太多按钮、标签、说明和图片。

---

## 7. 顶部导航栏范式

### 7.1 目标效果

导航栏要简洁、轻盈、稳定。它像页面的“书签”，不是营销横幅。

特点：

- 浅米色半透明背景。
- 轻微 backdrop blur。
- 细边框分割。
- 左侧 logo / 站点名。
- 中间或右侧导航链接。
- 右侧可放主题切换、登录、外部链接或主要操作。
- 当前项或 hover 使用绿色。
- 不要复杂下拉菜单，不要大面积阴影。

### 7.2 中性 HTML 结构

```html
<header class="site-header">
  <div class="site-header__inner">
    <a class="brand" href="/" aria-label="回到首页">
      <span class="brand__mark" aria-hidden="true">
        <img class="brand__logo" src="/assets/brand/logo.png" alt="">
      </span>
      <span class="brand__text">站点名称</span>
    </a>

    <nav class="site-nav" aria-label="站点导航">
      <a href="/" class="site-nav__link is-active">导航一</a>
      <a href="/section" class="site-nav__link">导航二</a>
      <a href="/about" class="site-nav__link">导航三</a>
    </nav>

    <div class="header-actions">
      <button class="theme-toggle" type="button" aria-label="切换主题"></button>
      <a class="external-button" href="#">主要操作</a>
    </div>
  </div>
</header>
```

### 7.3 CSS 规范

```css
.site-header {
  position: sticky;
  top: 0;
  z-index: 50;
  background: rgba(245, 244, 236, 0.92);
  border-bottom: 1px solid rgba(226, 224, 213, 0.78);
  backdrop-filter: blur(10px);
}

.site-header__inner {
  max-width: var(--container-xl);
  height: 78px;
  margin: 0 auto;
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--color-text);
  text-decoration: none;
  font-weight: 500;
  white-space: nowrap;
}

.brand__mark {
  width: 38px;
  height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  border-radius: 12px;
  background: transparent;
  overflow: visible;
}

.brand__logo {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: contain;
}

.brand__text {
  font-size: 20px;
  letter-spacing: 0.01em;
}

.site-nav {
  display: flex;
  align-items: center;
  gap: 30px;
}

.site-nav__link {
  color: var(--color-text);
  text-decoration: none;
  font-size: 15px;
  font-weight: 500;
  transition: color 160ms ease;
}

.site-nav__link:hover,
.site-nav__link.is-active {
  color: var(--color-primary);
}

.header-actions {
  display: inline-flex;
  align-items: center;
  gap: 12px;
}
```

### 7.4 移动端

```css
@media (max-width: 760px) {
  .site-header__inner {
    height: auto;
    min-height: 68px;
    padding: 14px 20px;
    align-items: flex-start;
    flex-direction: column;
  }

  .site-nav {
    width: 100%;
    gap: 16px;
    overflow-x: auto;
    padding-bottom: 2px;
  }

  .external-button {
    display: none;
  }
}
```

移动端可以使用横向滚动导航，也可以使用菜单按钮展开。不要让导航项挤成一团。

---

## 8. Hero 首屏范式

### 8.1 目标效果

Hero 要干净，中心只有一句强主题表达和一段简短说明。它承担“定调”，不是承担全部内容。

特点：

- 大标题明确。
- 副标题低饱和灰色。
- 关键词可使用绿色轻强调。
- 主按钮清晰，次按钮克制。
- 可搭配一张柔和视觉锚点。
- 不使用强烈背景图，不做大面积炫酷渐变。

### 8.2 居中型 Hero

```html
<section class="home-hero">
  <div class="home-hero__inner home-hero__inner--center">
    <p class="eyebrow">短标签</p>
    <h1>一句清楚、有温度的页面主题</h1>
    <p>用一两句话说明这个页面能提供什么，不要写成营销口号。</p>
    <div class="hero-actions">
      <a class="button button-primary" href="#primary">主要操作</a>
      <a class="button button-outline" href="#secondary">次要操作</a>
    </div>
  </div>
</section>
```

```css
.home-hero {
  padding: 86px 24px 80px;
}

.home-hero__inner--center {
  max-width: var(--container-lg);
  margin: 0 auto;
  text-align: center;
}

.eyebrow {
  margin: 0 0 12px;
  color: var(--color-primary);
  font-size: 15px;
  font-weight: 700;
}

.home-hero h1 {
  margin: 0;
  color: var(--color-text);
  font-size: clamp(38px, 6vw, 56px);
  font-weight: 400;
  line-height: 1.22;
}

.home-hero p {
  margin: 20px 0 30px;
  color: var(--color-text-muted);
  font-size: 18px;
  line-height: 1.9;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 14px;
}
```

### 8.3 左文右图型 Hero

```html
<section class="home-hero">
  <div class="home-hero__inner">
    <div class="hero-copy">
      <p class="eyebrow">短标签</p>
      <h1>一句清楚、有温度的页面主题</h1>
      <p>说明文字保持自然，不要堆概念。</p>
      <div class="hero-actions">
        <a class="button button-primary" href="#primary">主要操作</a>
        <a class="button button-outline" href="#secondary">次要操作</a>
      </div>
    </div>

    <div class="hero-visual" aria-hidden="true">
      <!-- 插画、图片、柔和几何图形、产品截图等 -->
    </div>
  </div>
</section>
```

```css
.home-hero__inner {
  max-width: var(--container-xl);
  margin: 0 auto;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 390px;
  align-items: center;
  gap: 64px;
}

.hero-copy {
  max-width: 720px;
}

.hero-visual {
  min-height: 360px;
  border: 1px solid var(--color-border);
  border-radius: 18px;
  background: rgba(255, 254, 250, 0.72);
  box-shadow: var(--shadow-card);
  overflow: hidden;
}

@media (max-width: 980px) {
  .home-hero__inner {
    grid-template-columns: 1fr;
  }

  .hero-visual {
    min-height: 300px;
  }
}
```

---

## 9. 卡片系统

卡片是这个风格非常关键的组件。卡片应该像轻量纸片，而不是电商商品卡，也不是后台面板。

### 9.1 通用卡片

```css
.card,
.content-card,
.media-card,
.info-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg, 16px);
  box-shadow: var(--shadow-card);
}
```

### 9.2 内容入口卡片

用于承载任何“入口型内容”：动态、照片、作品、项目、记录、资源、功能入口等。

不要把它写死成课程卡片或博客文章卡片。

```html
<article class="content-card">
  <span class="status-badge">状态</span>
  <h3>内容标题</h3>
  <p>一段简短说明，控制在两到三行以内。</p>
  <div class="tag-list">
    <span class="tag">标签一</span>
    <span class="tag">标签二</span>
  </div>
  <a class="button button-primary" href="#">主要操作</a>
</article>
```

```css
.content-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 24px;
}

.content-card {
  min-width: 0;
  padding: 30px 30px 26px;
  display: flex;
  flex-direction: column;
  transition:
    transform 180ms ease,
    box-shadow 180ms ease,
    border-color 180ms ease;
}

.content-card:hover {
  transform: translateY(-3px);
  border-color: var(--color-border-strong);
  box-shadow: var(--shadow-card-hover);
}

.content-card h3 {
  margin: 24px 0 12px;
  color: var(--color-text);
  font-size: 23px;
  font-weight: 500;
  line-height: 1.35;
}

.content-card p {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 15px;
  line-height: 1.8;
}

.content-card .button {
  margin-top: auto;
}

@media (max-width: 980px) {
  .content-grid {
    grid-template-columns: 1fr;
  }
}
```

### 9.3 媒体卡片

用于图片、视频、相册、作品封面、截图、文件预览等。

```html
<article class="media-card">
  <div class="media-card__media">
    <img src="image.jpg" alt="图片描述">
  </div>
  <div class="media-card__body">
    <h3 class="media-card__title">媒体标题</h3>
    <p class="media-card__desc">简短描述。</p>
    <span class="media-card__meta">辅助信息</span>
  </div>
</article>
```

```css
.media-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 22px;
}

.media-card {
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg, 16px);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
  cursor: pointer;
  transition:
    transform 180ms ease,
    box-shadow 180ms ease,
    border-color 180ms ease;
}

.media-card:hover,
.media-card:focus-visible {
  transform: translateY(-3px);
  border-color: var(--color-border-strong);
  box-shadow: var(--shadow-card-hover);
}

.media-card__media {
  position: relative;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  background:
    linear-gradient(135deg, rgba(47, 131, 115, 0.1), transparent 58%),
    var(--color-surface-muted);
}

.media-card__media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 220ms ease;
}

.media-card:hover img {
  transform: scale(1.025);
}

.media-card__body {
  padding: 16px 18px 18px;
}

.media-card__title {
  margin: 0;
  color: var(--color-text);
  font-size: 17px;
  font-weight: 500;
  line-height: 1.45;
}

.media-card__desc {
  margin: 7px 0 0;
  color: var(--color-text-muted);
  font-size: 14px;
  line-height: 1.75;
}

.media-card__meta {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  margin: 14px 0 0;
  padding: 0 9px;
  border: 1px solid var(--color-primary-soft);
  border-radius: 999px;
  background: var(--color-primary-lighter);
  color: var(--color-primary);
  font-size: 12px;
  line-height: 1;
}

@media (max-width: 980px) {
  .media-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .media-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }
}

@media (max-width: 460px) {
  .media-grid {
    grid-template-columns: 1fr;
  }
}
```

### 9.4 大说明卡片

用于价值说明、产品介绍、步骤说明、个人说明、功能解释等。

```html
<section class="statement-block">
  <div class="container">
    <div class="statement-card">
      <div class="statement-card__aside" aria-hidden="true"></div>
      <div class="statement-card__content">
        <h2>区块标题</h2>
        <p>解释说明，语气自然，不要堆砌概念。</p>
        <ul class="check-list">
          <li><strong>重点一</strong>，补充说明。</li>
          <li><strong>重点二</strong>，补充说明。</li>
        </ul>
      </div>
    </div>
  </div>
</section>
```

```css
.statement-block {
  padding: 24px 0 76px;
}

.statement-card {
  display: grid;
  grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr);
  gap: 48px;
  align-items: center;
  padding: 54px 60px;
  border: 1px solid rgba(226, 224, 213, 0.8);
  border-radius: 18px;
  background: rgba(255, 254, 250, 0.66);
}

.statement-card__aside {
  min-height: 260px;
  border-radius: 16px;
  background:
    linear-gradient(135deg, rgba(47, 131, 115, 0.12), transparent 55%),
    var(--color-bg-soft);
  border: 1px solid var(--color-border);
}

.statement-card h2 {
  margin: 0 0 18px;
  font-size: 30px;
  font-weight: 500;
  line-height: 1.35;
}

.statement-card p {
  margin: 0;
  color: var(--color-text-muted);
  line-height: 1.9;
}

@media (max-width: 980px) {
  .statement-card {
    grid-template-columns: 1fr;
  }
}
```

---

## 10. 按钮系统

### 10.1 基础按钮

```css
.button,
.external-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 42px;
  padding: 0 18px;
  border-radius: var(--radius-sm, 7px);
  font-size: 15px;
  font-weight: 500;
  text-decoration: none;
  font-family: inherit;
  appearance: none;
  cursor: pointer;
  transition:
    background 160ms ease,
    border-color 160ms ease,
    color 160ms ease,
    transform 160ms ease;
}
```

### 10.2 主按钮

```css
.button-primary {
  border: 1px solid var(--color-primary);
  background: var(--color-primary);
  color: #fff;
}

.button-primary:hover {
  border-color: var(--color-primary-dark);
  background: var(--color-primary-dark);
  transform: translateY(-1px);
}
```

### 10.3 描边按钮

```css
.button-outline,
.external-button {
  border: 1px solid var(--color-text);
  color: var(--color-text);
  background: var(--color-surface);
}

.button-outline:hover,
.external-button:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
  transform: translateY(-1px);
}
```

### 10.4 按钮禁忌

不要：

- 做成高饱和大渐变按钮。
- 使用特别重的阴影。
- 让按钮过圆像移动 App 胶囊，除非用户明确要求。
- 一个区块塞太多主按钮。

---

## 11. 标签、徽章与元信息

### 11.1 普通标签

```css
.tag,
.badge {
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  padding: 0 10px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg-soft);
  color: var(--color-text-subtle);
  font-size: 13px;
  line-height: 1;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
```

### 11.2 状态标签

```css
.status-badge {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 5px 12px;
  border: 1px solid var(--color-primary-soft);
  border-radius: 999px;
  background: var(--color-primary-lighter);
  color: var(--color-primary);
  font-size: 12px;
  line-height: 1;
}

.status-badge::before {
  content: "";
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: currentColor;
}
```

### 11.3 元信息

元信息用于时间、作者、分类、地点、状态等辅助信息。不要比正文更抢眼。

```css
.meta,
.card-meta,
.detail-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 16px;
  color: var(--color-text-subtle);
  font-size: 13px;
}
```

---

## 12. 列表页 / 网格页范式

### 12.1 目标效果

列表页用于承载一组内容，可以是媒体、动态、作品、记录、文档、商品、功能入口等。它不默认是博客或课程。

特点：

- 顶部页面标题区。
- 标题下方可有面包屑或说明。
- 主区域可以是网格、列表、瀑布流或左右布局。
- 侧边栏是可选项，用于筛选、分类、统计、说明。
- 分页简洁。

### 12.2 页面标题区

```html
<section class="page-title-block">
  <h1>页面标题</h1>
  <nav class="breadcrumb" aria-label="面包屑">
    <a href="/">Home</a>
    <span>/</span>
    <span>当前页面</span>
  </nav>
</section>
```

```css
.page-title-block {
  max-width: var(--container-xl);
  margin: 0 auto;
  padding: 90px 24px 78px;
  text-align: center;
  background: var(--color-bg-soft);
  border-radius: 0 0 14px 14px;
}

.page-title-block h1 {
  margin: 0 0 22px;
  font-size: 42px;
  font-weight: 500;
  letter-spacing: -0.02em;
}

.breadcrumb {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--color-primary);
  font-size: 14px;
}

.breadcrumb a {
  color: var(--color-primary);
  text-decoration: none;
}
```

### 12.3 左右布局

```html
<section class="archive-layout">
  <div class="archive-main">
    <div class="content-grid"></div>
  </div>
  <aside class="archive-sidebar" aria-label="辅助信息"></aside>
</section>
```

```css
.archive-layout {
  max-width: var(--container-xl);
  margin: 88px auto;
  padding: 0 24px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 52px;
}

.archive-sidebar {
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.sidebar-widget {
  background: rgba(255, 254, 250, 0.68);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg, 16px);
  padding: 26px;
}

.sidebar-widget h3 {
  margin: 0 0 18px;
  font-size: 21px;
  font-weight: 500;
}

@media (max-width: 980px) {
  .archive-layout {
    grid-template-columns: 1fr;
  }
}
```

### 12.4 分页

```html
<nav class="pagination" aria-label="分页">
  <a class="pagination__prev" href="#">‹</a>
  <span class="pagination__item is-active">1</span>
  <a class="pagination__item" href="#">2</a>
  <a class="pagination__next" href="#">›</a>
</nav>
```

```css
.pagination {
  margin: 68px 0 0;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 18px;
}

.pagination a,
.pagination span {
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  color: var(--color-text);
  text-decoration: none;
}

.pagination .is-active {
  background: var(--color-primary);
  color: #fff;
}
```

---

## 13. 详情页 / 阅读页范式

### 13.1 目标效果

详情页用于承载一条完整内容，可以是文章、照片、作品、项目、记录、说明、产品详情等。它不默认是教学文章。

特点：

- 顶部可有封面/主视觉。
- 标题大但克制。
- 元信息在标题下方。
- 可以有目录、摘要、提示框、正文、评论、相关内容。
- 正文窄宽度，适合阅读。
- 章节之间有分割线。
- 代码块可选，只有用户需求需要代码时才生成。

### 13.2 HTML 结构

```html
<main class="detail-page">
  <article class="detail-container">
    <img class="detail-cover" src="cover.jpg" alt="">

    <header class="detail-header">
      <h1>详情标题</h1>
      <div class="detail-meta">
        <span>辅助信息一</span>
        <span>辅助信息二</span>
      </div>
    </header>

    <div class="detail-note">
      一句摘要、提示或引导。
    </div>

    <section class="detail-content">
      <h2>章节标题</h2>
      <p>正文内容。</p>
    </section>
  </article>
</main>
```

### 13.3 CSS

```css
.detail-container {
  max-width: var(--container-detail);
  margin: 0 auto;
  padding: 72px 24px 120px;
}

.detail-cover {
  width: 100%;
  max-height: 460px;
  object-fit: cover;
  border-radius: 8px;
  margin-bottom: 34px;
}

.detail-header h1 {
  margin: 0 0 18px;
  color: var(--color-text);
  font-size: clamp(32px, 5vw, 44px);
  line-height: 1.25;
  font-weight: 500;
  letter-spacing: -0.03em;
}

.detail-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  color: var(--color-text-muted);
  font-size: 14px;
  margin-bottom: 24px;
}

.detail-note {
  margin: 32px 0 48px;
  border: 1px solid var(--color-note-border);
  border-left: 8px solid var(--color-note-border);
  border-radius: 6px;
  padding: 16px 22px;
  color: var(--color-text-muted);
  background: rgba(255, 254, 250, 0.7);
}

.detail-content {
  color: var(--color-text-muted);
}

.detail-content h2 {
  margin: 60px 0 20px;
  padding-top: 40px;
  border-top: 1px solid var(--color-border);
  color: var(--color-text);
  font-size: 30px;
  font-weight: 500;
  line-height: 1.35;
}

.detail-content h3 {
  margin: 36px 0 14px;
  color: var(--color-text);
  font-size: 22px;
  font-weight: 500;
}

.detail-content p {
  margin: 18px 0;
  line-height: 1.95;
  font-size: 17px;
}

.detail-content ul,
.detail-content ol {
  margin: 18px 0 28px;
  padding-left: 26px;
}

.detail-content li {
  margin: 10px 0;
  line-height: 1.9;
}

.detail-content strong {
  color: var(--color-text);
  font-weight: 700;
}
```

### 13.4 目录块

只有内容较长时才使用目录。

```html
<nav class="toc" aria-label="目录">
  <div class="toc__title">Table of Contents</div>
  <ol>
    <li><a href="#section-1">章节一</a></li>
    <li><a href="#section-2">章节二</a></li>
  </ol>
</nav>
```

```css
.toc {
  margin: 28px 0 30px;
  background: #fbfbf7;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid var(--color-border);
}

.toc__title {
  background: #555552;
  color: #fff;
  padding: 10px 16px;
  font-size: 15px;
}

.toc ol {
  margin: 0;
  padding: 22px 28px 24px 38px;
}

.toc li {
  margin: 11px 0;
  color: var(--color-text-muted);
}

.toc a {
  color: var(--color-text);
  text-decoration: none;
}

.toc a:hover {
  color: var(--color-primary);
}
```

---

## 14. 表单与上传区域范式

表单也要温和，不要变成后台系统。

### 14.1 表单容器

```html
<section class="form-section">
  <div class="form-panel">
    <header class="form-header">
      <p class="eyebrow">短标签</p>
      <h1>表单标题</h1>
      <p>简短说明。</p>
    </header>

    <form class="form-stack">
      <label class="field">
        <span>字段名称</span>
        <input type="text" placeholder="请输入内容">
      </label>
      <button class="button button-primary" type="submit">提交</button>
    </form>
  </div>
</section>
```

```css
.form-section {
  padding: 72px 24px 110px;
}

.form-panel {
  max-width: 680px;
  margin: 0 auto;
  padding: 38px;
  border: 1px solid var(--color-border);
  border-radius: 18px;
  background: rgba(255, 254, 250, 0.82);
  box-shadow: var(--shadow-card);
}

.form-header {
  margin-bottom: 28px;
}

.form-header h1 {
  margin: 0;
  font-size: clamp(30px, 5vw, 42px);
  font-weight: 500;
}

.form-header p:last-child {
  color: var(--color-text-muted);
  line-height: 1.85;
}

.form-stack {
  display: grid;
  gap: 18px;
}

.field {
  display: grid;
  gap: 8px;
  color: var(--color-text);
  font-size: 15px;
}

.field input,
.field textarea,
.field select {
  width: 100%;
  min-height: 44px;
  padding: 10px 13px;
  border: 1px solid var(--color-border);
  border-radius: 9px;
  background: var(--color-bg-soft);
  color: var(--color-text);
  outline: none;
  transition: border-color 160ms ease, box-shadow 160ms ease, background 160ms ease;
}

.field textarea {
  min-height: 132px;
  resize: vertical;
}

.field input:focus,
.field textarea:focus,
.field select:focus {
  border-color: var(--color-primary);
  background: var(--color-surface);
  box-shadow: 0 0 0 4px rgba(47, 131, 115, 0.1);
}
```

### 14.2 上传区域

```html
<label class="upload-dropzone">
  <input type="file" hidden>
  <span class="upload-dropzone__icon">＋</span>
  <strong>上传文件</strong>
  <span>支持拖拽或点击选择。</span>
</label>
```

```css
.upload-dropzone {
  min-height: 220px;
  display: grid;
  place-items: center;
  gap: 10px;
  padding: 28px;
  border: 1px dashed var(--color-border-strong);
  border-radius: 18px;
  background:
    linear-gradient(135deg, rgba(47, 131, 115, 0.08), transparent 58%),
    var(--color-bg-soft);
  color: var(--color-text-muted);
  text-align: center;
  cursor: pointer;
  transition: border-color 160ms ease, background 160ms ease, transform 160ms ease;
}

.upload-dropzone:hover,
.upload-dropzone:focus-within {
  border-color: var(--color-primary);
  background: var(--color-primary-lighter);
  transform: translateY(-1px);
}

.upload-dropzone__icon {
  width: 44px;
  height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  background: var(--color-surface);
  color: var(--color-primary);
  border: 1px solid var(--color-primary-soft);
  font-size: 24px;
}
```

---

## 15. 弹窗、预览与轻交互

### 15.1 目标效果

弹窗要像轻柔的纸片浮起来，而不是厚重的后台 Modal。

### 15.2 通用预览弹窗

```html
<div class="lightbox" role="dialog" aria-modal="true" aria-hidden="true">
  <div class="lightbox__dialog" role="document">
    <button class="lightbox__close" type="button" aria-label="关闭">×</button>
    <div class="lightbox__media"></div>
    <div class="lightbox__content">
      <span class="lightbox__tag">标签</span>
      <h2 class="lightbox__title">标题</h2>
      <p class="lightbox__desc">描述文字。</p>
    </div>
  </div>
</div>
```

```css
.lightbox {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: center;
  padding: 28px;
  background: rgba(32, 35, 31, 0.42);
  backdrop-filter: blur(8px);
  opacity: 0;
  pointer-events: none;
  visibility: hidden;
  transition:
    opacity 180ms ease,
    visibility 0s linear 180ms;
}

.lightbox.is-active {
  opacity: 1;
  pointer-events: auto;
  visibility: visible;
  transition:
    opacity 180ms ease,
    visibility 0s linear 0s;
}

.lightbox__dialog {
  position: relative;
  width: min(1040px, 100%);
  max-height: calc(100vh - 56px);
  overflow: auto;
  padding: 22px;
  border: 1px solid rgba(226, 224, 213, 0.82);
  border-radius: 18px;
  background: rgba(255, 254, 250, 0.92);
  box-shadow: 0 24px 60px rgba(32, 35, 31, 0.16);
  transform: translateY(10px) scale(0.98);
  transition: transform 180ms ease;
}

.lightbox.is-active .lightbox__dialog {
  transform: translateY(0) scale(1);
}

.lightbox__close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm, 7px);
  background: rgba(250, 249, 242, 0.92);
  color: var(--color-text);
  cursor: pointer;
  transition:
    border-color 160ms ease,
    color 160ms ease,
    transform 160ms ease;
}

.lightbox__close:hover,
.lightbox__close:focus-visible {
  border-color: var(--color-primary);
  color: var(--color-primary);
  transform: translateY(-1px);
}
```

### 15.3 Hover 与动画

```css
.interactive {
  transition:
    transform 180ms ease,
    box-shadow 180ms ease,
    color 160ms ease,
    background 160ms ease,
    border-color 160ms ease;
}

.interactive:hover {
  transform: translateY(-2px);
}
```

允许：

- 轻微上浮。
- 轻微变色。
- 轻微阴影变化。
- 弹窗淡入。
- 图片轻微放大。

不建议：

- 大量滚动动画。
- 视差效果。
- 粒子背景。
- 自动播放炫酷动画。
- 首屏复杂 loading。

---

## 16. 代码块、提示框与引用

只有当页面真的需要展示代码或长文本说明时才使用这些组件。不要默认把普通页面做成教程。

### 16.1 代码块

```css
pre {
  margin: 26px 0 0;
  padding: 18px 22px;
  overflow-x: auto;
  border-radius: var(--radius-sm, 7px);
  background: var(--color-code-bg);
  color: var(--color-code-text);
}

code {
  font-family: var(--font-mono);
  font-size: 14px;
  line-height: 1.75;
}

p code,
li code {
  padding: 2px 6px;
  border-radius: 5px;
  color: var(--color-text);
  background: rgba(47, 131, 115, 0.1);
  border: 1px solid rgba(47, 131, 115, 0.14);
  font-size: 0.92em;
}
```

### 16.2 提示框

```css
.note,
.detail-note,
.callout {
  margin: 28px 0;
  padding: 16px 22px;
  border: 1px solid var(--color-primary);
  border-left: 8px solid var(--color-primary);
  border-radius: var(--radius-sm, 7px);
  background: rgba(255, 254, 250, 0.78);
  color: var(--color-text-muted);
}
```

### 16.3 引用块

```css
blockquote {
  margin: 28px 0;
  padding: 18px 24px;
  border: 1px solid var(--color-primary);
  border-left: 8px solid var(--color-primary);
  border-radius: 7px;
  color: var(--color-text-muted);
  background: rgba(255, 254, 250, 0.76);
}
```

---

## 17. 空状态、错误状态与加载状态

### 17.1 空状态

空状态要温和，不要像系统报错。

```html
<div class="empty-state">
  <h3>这里还没有内容</h3>
  <p>可以添加第一条内容，或者稍后再回来看看。</p>
  <a class="button button-primary" href="#">添加内容</a>
</div>
```

```css
.empty-state {
  max-width: 720px;
  margin: 0 auto;
  padding: 30px 28px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg, 16px);
  background: rgba(250, 249, 242, 0.78);
  color: var(--color-text-muted);
  text-align: center;
}

.empty-state h3 {
  margin: 0 0 10px;
  color: var(--color-text);
  font-size: 22px;
  font-weight: 500;
}

.empty-state p {
  margin: 0 0 20px;
}
```

### 17.2 错误状态

```css
.alert {
  padding: 14px 18px;
  border: 1px solid var(--color-border-strong);
  border-radius: 10px;
  background: var(--color-warning-soft);
  color: var(--color-text-muted);
}
```

### 17.3 骨架屏

骨架屏用低对比，不要强灰闪烁。

```css
.skeleton {
  border-radius: 8px;
  background: linear-gradient(90deg, var(--color-surface-muted), var(--color-bg-soft), var(--color-surface-muted));
  background-size: 200% 100%;
  animation: skeleton-pulse 1.4s ease-in-out infinite;
}

@keyframes skeleton-pulse {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

---

## 18. Footer 范式

### 18.1 目标效果

Footer 应该简洁、安静，像页面自然收尾。

特点：

- 背景浅色。
- 上半部分有品牌/Logo 和导航链接。
- 下半部分版权信息居中。
- 顶部有细分割线。
- 右下角可有返回顶部按钮。

### 18.2 HTML

```html
<footer class="site-footer">
  <div class="footer-main">
    <a class="brand" href="/">
      <span class="brand__mark" aria-hidden="true">
        <img class="brand__logo" src="/assets/brand/logo.png" alt="">
      </span>
      <span class="brand__text">站点名称</span>
    </a>
    <nav class="footer-nav" aria-label="页脚导航">
      <a href="#">链接一</a>
      <a href="#">链接二</a>
      <a href="#">链接三</a>
    </nav>
  </div>
  <div class="footer-bottom">
    <p>© 站点名称</p>
    <p>一句很轻的站点说明。</p>
  </div>
</footer>

<a class="back-to-top" href="#top" aria-label="返回顶部">↑</a>
```

### 18.3 CSS

```css
.site-footer {
  margin-top: 24px;
  border-top: 1px solid var(--color-border);
  background: var(--color-bg-soft);
}

.footer-main {
  max-width: var(--container-xl);
  margin: 0 auto;
  padding: 38px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.footer-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
}

.footer-nav a {
  color: var(--color-text-muted);
  text-decoration: none;
  font-size: 14px;
}

.footer-nav a:hover {
  color: var(--color-primary);
}

.footer-bottom {
  border-top: 1px solid var(--color-border);
  padding: 20px 24px 28px;
  text-align: center;
  color: var(--color-text-subtle);
  font-size: 13px;
}

.footer-bottom p {
  margin: 4px 0;
}

.back-to-top {
  position: fixed;
  right: 22px;
  bottom: 22px;
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm, 7px);
  background: var(--color-primary);
  color: #fff;
  text-decoration: none;
  box-shadow: 0 8px 20px rgba(47, 131, 115, 0.22);
}

@media (max-width: 760px) {
  .footer-main {
    align-items: flex-start;
    flex-direction: column;
  }

  .back-to-top {
    right: 16px;
    bottom: 16px;
  }
}
```

---

## 19. 响应式规范

### 19.1 断点

```css
:root {
  --breakpoint-sm: 640px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 980px;
  --breakpoint-xl: 1200px;
}
```

### 19.2 移动端必须做到

- 导航不要挤压。
- Hero 标题缩小。
- 多列卡片变为单列或双列。
- 侧边栏移动到内容下方。
- 详情正文宽度撑满但保留 20px 左右 padding。
- 代码块允许横向滚动。
- 弹窗高度适配移动端。
- 按钮保持易点击。

```css
@media (max-width: 760px) {
  .home-hero {
    padding: 62px 20px 56px;
  }

  .home-hero h1 {
    font-size: 38px;
  }

  .home-hero p {
    font-size: 16px;
  }

  .container {
    padding: 0 20px;
  }

  .content-section {
    padding: 58px 0;
  }

  .content-card,
  .media-card,
  .sidebar-widget,
  .detail-panel,
  .statement-card,
  .form-panel {
    padding: 24px;
  }

  .detail-container {
    padding: 42px 20px 80px;
  }
}
```

---

## 20. 深色模式

若项目需要深色模式，可以做柔和暗色，而不是纯黑科技风。优先同时兼容 `.dark` 和 `[data-theme="dark"]` 两种常见写法。

```css
.dark,
[data-theme="dark"] {
  --color-bg: #181b17;
  --color-bg-soft: #20241f;
  --color-surface: #222720;
  --color-surface-muted: #2a2f29;

  --color-primary: #7bc7b6;
  --color-primary-dark: #9bd9cb;
  --color-primary-soft: rgba(123, 199, 182, 0.18);
  --color-primary-lighter: rgba(123, 199, 182, 0.12);

  --color-text: #eef0e8;
  --color-text-muted: #b8c0b8;
  --color-text-subtle: #8f998f;

  --color-border: #343a33;
  --color-border-strong: #465044;

  --color-code-bg: #11130f;
}
```

深色模式也要温和，不要变成黑客终端风。

---

## 21. 可访问性与语义

### 21.1 基本要求

- `img` 必须有合适的 `alt`，装饰性图片使用 `alt=""`。
- 交互元素使用 `button` 或 `a`，不要用 `div` 冒充按钮。
- 弹窗使用 `role="dialog"` 和 `aria-modal="true"`。
- 导航使用 `nav` 和 `aria-label`。
- 表单控件要有 label。
- 焦点状态不能被删除。
- 颜色对比要足够，不要用太淡的文字。

### 21.2 焦点样式

```css
:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 4px;
}
```

不要写：

```css
*:focus {
  outline: none;
}
```

除非同时提供更清楚的替代焦点样式。


### 21.3 减少动画偏好

如果用户系统设置了减少动画，页面必须尊重该偏好。温柔动效是加分项，不是必要项。

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

Codex 不要为了“高级感”加入大量滚动动画、视差动画、粒子背景和自动播放动效。


---

## 22. 插画与视觉锚点

### 22.1 方向

视觉锚点可以是：

- 原创插画。
- 柔和照片。
- 线性图形。
- 简单 SVG。
- 产品截图。
- 低饱和几何色块。
- logo 或品牌符号。

### 22.2 视觉要求

- 低饱和。
- 绿灰色、浅黄、奶油白、淡蓝绿为主。
- 线条圆润。
- 表情或姿态友好。
- 不写实厚重。
- 不高对比。
- 不要 3D 金属科技感。

### 22.3 使用节奏

不要每个区块都放插画。一般：

- 首页首屏可以有一个视觉锚点。
- 大说明区可以有一个视觉锚点。
- 空状态可以有一个小图标或小插画。
- 详情页根据内容决定是否放封面。

---

## 23. Codex 执行规则

### 23.1 修改顺序

Codex 修改代码时按这个顺序执行：

1. 阅读用户本次明确需求，确认业务场景。
2. 查看现有项目结构和已有功能。
3. 保留原有内容、数据结构、路由和交互。
4. 建立或整理全局 CSS 变量。
5. 引入并应用字体系统。
6. 统一页面背景、容器宽度、留白节奏。
7. 统一导航、按钮、卡片、标签、表单、弹窗、Footer。
8. 优化响应式。
9. 检查图片路径、无障碍、hover、焦点状态。
10. 不要擅自新增用户未要求的业务模块。

### 23.2 不要偷懒

必须做到：

- 不要只换背景色和按钮色。
- 不要只添加几个 class。
- 要系统性重构视觉层次。
- 要统一字体、颜色、间距、圆角、阴影、组件。
- 要检查移动端。
- 要保留现有功能。
- 要让页面像一个完整、温暖、克制的个人化前端页面，而不是普通作业网页。

### 23.3 不要越界

除非用户明确要求，否则不要生成：

- 课程系列。
- 学习路线。
- 博客列表。
- 文章教程。
- 代码教学。
- Bilibili 引导。
- Read More。
- Categories。
- Tags。
- “开始学习”。
- “进入课程”。

如果需要列表、标签、详情、侧边栏，必须根据用户本次业务场景命名。例如用户要求照片站，就应该是照片、相册、动态、心情、地点等；用户要求作品集，就应该是作品、项目、案例、技术栈等。


### 23.4 完成后汇报格式

Codex 完成修改后，必须简短但具体地汇报，不要只说“已完成优化”。推荐格式：

1. **修改文件**：列出改动过的文件。
2. **保留功能**：说明保留了哪些原有功能、路由、数据结构或交互。
3. **视觉系统**：说明统一了哪些内容，例如颜色、字体、间距、圆角、阴影、卡片、按钮、响应式。
4. **字体处理**：说明是否引入 LXGW WenKai Screen，使用 CDN 还是本地路径，是否有回退字体。
5. **移动端适配**：说明多列布局、导航、弹窗、图片是否适配。
6. **检查结果**：说明是否发现路径错误、控制台错误、图片变形、溢出等问题。
7. **待确认事项**：如果有无法确定的业务内容或资源路径，明确列出。

### 23.5 修改幅度判断

Codex 应根据项目现状选择修改幅度：

- 如果原页面结构合理：优先保留 HTML，只系统整理 CSS 和 class。
- 如果原页面结构混乱：可以适度重构语义结构，但不能删除用户已有内容。
- 如果已有设计系统：不要强行覆盖，应该映射到本 Skill 的颜色、字体和间距原则。
- 如果是单页静态项目：可以集中写在 `style.css` 或 `<style>`，但要保持变量清晰。
- 如果是 React / Vue / Next 项目：优先抽象通用 class 或组件，不要重复写大量内联样式。

### 23.6 命名规则

推荐使用中性 class 命名，不绑定业务：

- `site-header`、`site-footer`、`page-hero`、`content-section`。
- `content-card`、`media-card`、`info-card`、`statement-card`。
- `tag`、`status-badge`、`meta`、`button-primary`、`button-outline`。

当项目已有命名体系时，优先沿用现有命名，不要为了套本 Skill 全部重命名。


---

## 24. 推荐给 Codex 的通用 Prompt

把下面这段和本文件一起交给 Codex：

```text
请阅读 docs/warm-neutral-ui-style-skill.md。

这是本项目的 UI 设计范式文档，不是业务需求文档。请你严格按照其中的设计语言，系统优化当前项目的 HTML/CSS/前端组件。

本次具体业务需求以我当前这条对话中的描述为准。不要从 Skill 文档里的示例推断业务类型，不要自动生成课程、博客、文章教程、学习路线、Bilibili 引导、Read More、Categories、Tags 等内容，除非我本次明确要求。

请先判断本项目的业务类型，例如照片生活类、作品集、产品官网、工具页、后台、文档站等。视觉风格可以统一，但页面结构、组件重心、文案气质必须服务当前业务。只学习参考站点的设计方法，不复制其品牌、课程结构、专有文案、图片或导航。

视觉目标：
把当前页面改造成温暖、克制、清爽、低饱和、中文阅读友好、有个人站气质的前端页面。整体使用浅米色背景、深绿色主色、LXGW WenKai Screen / 霞鹜文楷屏幕阅读版字体、宽松留白、圆角卡片、细边框、轻阴影、柔和视觉锚点和轻量交互。

执行要求：
1. 保留原有页面内容、文案、数据结构和核心功能。
2. 可以适度重构 HTML 结构和 class 名，但不要破坏语义。
3. 优先建立全局 CSS 变量，包括颜色、字体、间距、圆角、阴影、容器宽度。
4. 必须引入并使用 LXGW WenKai Screen / 霞鹜文楷屏幕阅读版作为全站主字体。
5. 代码块仅在页面确实需要展示代码时使用，并使用 LXGW WenKai Mono Screen 或等宽字体回退。
6. 标题不要滥用粗体，主标题优先使用 font-weight: 400/500。
7. 正文使用 16px-17px 和 1.8-1.95 行高，正文颜色不要纯黑。
8. 系统优化导航栏、按钮、卡片、标签、列表/网格、表单、弹窗、详情页和页脚。
9. 页面背景使用浅米色，不要使用纯白、科技蓝紫、玻璃拟态或强商业风。
10. 按钮使用深绿色主色，hover 反馈要轻。
11. 内容区域要有宽松留白，避免拥挤。
12. 做好响应式布局，移动端自然单列或双列显示。
13. 不要引入重型 UI 框架。优先使用原生 CSS。
14. 不要只做简单换色，要完整优化视觉层级、间距、字体和组件系统。
15. 完成后检查控制台是否有路径错误，移动端是否溢出，图片是否变形。
16. 如果项目是照片/生活记录类，优先让图片成为第一视觉层级，文字和交互保持轻。
17. 如果不能使用 CDN 字体，先检查本地字体文件；不要写死不存在的字体路径。
18. 深色模式优先同时兼容 `.dark` 和 `[data-theme="dark"]`。
19. 尊重 `prefers-reduced-motion`，不要加入大量滚动动画或视差效果。
20. 完成后按“修改文件 / 保留功能 / 视觉系统 / 字体处理 / 移动端适配 / 检查结果 / 待确认事项”汇报。

请先分析当前页面结构，然后直接修改代码。
```

---

## 25. 项目落地检查清单

### 25.1 全局

- [ ] 背景是否为浅米色，而不是纯白。
- [ ] 主色是否为深绿色。
- [ ] 页面是否有足够留白。
- [ ] 是否已引入 LXGW WenKai Screen / 霞鹜文楷屏幕阅读版。
- [ ] 字体是否适合中文阅读。
- [ ] 中文和西文是否有统一的文气。
- [ ] 标题是否没有滥用粗体。
- [ ] 标题层级是否清楚。
- [ ] 正文行距是否舒服。
- [ ] 示例业务内容是否没有污染本次需求。
- [ ] 是否只学习设计方法，没有复制参考站的品牌、课程结构和专有文案。
- [ ] 是否已经根据当前业务类型调整组件重心，而不是所有项目都做成内容站。

### 25.2 导航

- [ ] 顶部导航是否简洁。
- [ ] logo / 站点名是否左对齐。
- [ ] 导航链接是否清楚。
- [ ] 当前状态或 hover 是否为绿色。
- [ ] 移动端是否不拥挤。

### 25.3 卡片与网格

- [ ] 卡片是否有圆角。
- [ ] 卡片是否有轻边框或轻阴影。
- [ ] 卡片内部留白是否充足。
- [ ] 图片是否不变形。
- [ ] 标签是否为浅色小胶囊。
- [ ] 按钮是否统一。

### 25.4 列表/详情

- [ ] 列表页是否有清楚标题和内容组织。
- [ ] 详情页宽度是否适合阅读。
- [ ] 提示框是否有绿色边框。
- [ ] 需要代码块时是否使用深色代码块。
- [ ] 章节之间是否有分割线。
- [ ] 段落行距是否足够。

### 25.5 表单/弹窗

- [ ] 表单控件是否统一。
- [ ] 输入框 focus 是否明显。
- [ ] 弹窗是否有遮罩和关闭按钮。
- [ ] 弹窗移动端是否可滚动。
- [ ] 上传区域是否清晰且不刺眼。

### 25.6 照片 / 生活记录类页面

仅当项目属于照片、生活记录、相册、社区动态类时检查：

- [ ] 图片是否是第一视觉层级。
- [ ] 媒体卡片是否保留生活感，而不是文章卡片感。
- [ ] 头像、昵称、时间、地点、心情标签是否低对比且不抢图片。
- [ ] 喜欢、评论、收藏等交互是否轻量。
- [ ] 是否没有默认生成 Read More、目录、文章分类、课程入口。

### 25.7 移动端

- [ ] 多列布局是否变为单列或合理双列。
- [ ] 侧边栏是否下移。
- [ ] 代码块是否可横向滚动。
- [ ] 标题是否不会溢出。
- [ ] 按钮是否易点击。
- [ ] 弹窗是否不超出屏幕。

---

## 26. 常见错误

避免以下错误：

1. **把 UI 范式当成业务需求**  
   这是最严重的错误。Skill 只规定视觉，不规定页面要做什么。

2. **自动生成课程/博客/教程套话**  
   除非用户明确要求，否则不要生成“课程系列、学习笔记、Read More、Categories、Tags、开始学习”等内容。

3. **忽略字体系统**  
   该风格的灵魂之一是 LXGW WenKai Screen / 霞鹜文楷屏幕阅读版。只改颜色不改字体，页面仍然会像普通 HTML。

4. **只把按钮改成绿色**  
   必须同时处理背景、字体、间距、卡片、排版、组件。

5. **使用纯白背景**  
   关键是浅米色和纸张感，不是默认白色。

6. **阴影太重**  
   该风格轻柔，不需要强烈悬浮感。

7. **标题过于商业化或过粗**  
   不要做成大厂营销页。标题可以大，但要克制。

8. **正文太小、太黑、太密**  
   不要 14px + 纯黑 + 1.4 行高。正文建议 16px-17px，行高 1.8-1.95，颜色使用灰绿色。

9. **标签过于鲜艳**  
   标签应为浅色、低对比、小圆角或胶囊。

10. **移动端没有适配**  
   这是必须检查项。

11. **复制参考站专有内容**  
   可以学习设计语言、布局气质、组件节奏，不要复制 logo、插画、品牌名、课程文案、专有素材。


12. **没有业务适配**  
同一套视觉范式不能套所有业务。照片站要重图片，工具页要重操作，后台要重效率，作品集要重项目表达。

13. **字体路径写错**  
不要凭空写 `/fonts/xxx.woff2`。使用本地字体前先确认存在；否则使用 CDN 或系统字体回退。

14. **暗色模式只兼容一种写法**  
优先同时兼容 `.dark` 和 `[data-theme="dark"]`。

15. **动效不尊重用户偏好**  
需要加入 `prefers-reduced-motion`，不要强制复杂动画。

---

## 27. 最小可用 CSS 模板

如果项目很小，可以直接使用下面这段作为起点。它已经包含字体系统。

```css
@import url("https://cdn.jsdelivr.net/npm/lxgw-wenkai-screen-web/style.css");

:root {
  --font-main:
    "LXGW WenKai Screen",
    "PingFang SC",
    "Microsoft YaHei",
    "Noto Sans SC",
    system-ui,
    sans-serif;

  --font-mono:
    "LXGW WenKai Mono Screen",
    "SFMono-Regular",
    Consolas,
    "Liberation Mono",
    monospace;

  --color-bg: #f5f4ec;
  --color-bg-soft: #faf9f2;
  --color-surface: #fffefa;
  --color-surface-muted: #f0efe7;
  --color-primary: #2f8373;
  --color-primary-dark: #22675a;
  --color-primary-soft: #d8eee8;
  --color-primary-lighter: #eaf7f3;
  --color-text: #20231f;
  --color-text-muted: #69736d;
  --color-text-subtle: #8a948d;
  --color-border: #e2e0d5;
  --color-border-strong: #d3d0c2;
  --color-code-bg: #20231e;
  --color-code-text: #e8eadf;
  --radius-xs: 4px;
  --radius-sm: 7px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --radius-xl: 20px;
  --radius-2xl: 24px;
  --radius-pill: 999px;
  --shadow-card: 0 14px 32px rgba(32, 35, 31, 0.04);
  --shadow-card-hover: 0 18px 38px rgba(32, 35, 31, 0.07);
  --container-xl: 1180px;
  --container-lg: 960px;
  --container-md: 760px;
  --container-detail: 860px;
}


.dark,
[data-theme="dark"] {
  --color-bg: #181b17;
  --color-bg-soft: #20241f;
  --color-surface: #222720;
  --color-surface-muted: #2a2f29;
  --color-primary: #7bc7b6;
  --color-primary-dark: #9bd9cb;
  --color-primary-soft: rgba(123, 199, 182, 0.18);
  --color-primary-lighter: rgba(123, 199, 182, 0.12);
  --color-text: #eef0e8;
  --color-text-muted: #b8c0b8;
  --color-text-subtle: #8f998f;
  --color-border: #343a33;
  --color-border-strong: #465044;
  --color-code-bg: #11130f;
}

* {
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
  font-family: var(--font-main);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

body {
  margin: 0;
  background:
    radial-gradient(circle at 10% 8%, rgba(216, 238, 232, 0.46), transparent 30%),
    linear-gradient(180deg, var(--color-bg-soft) 0%, var(--color-bg) 360px);
  color: var(--color-text);
  font-family: var(--font-main);
  font-size: 16px;
  font-weight: 400;
  line-height: 1.82;
}

button,
input,
textarea,
select {
  font: inherit;
}

a {
  color: var(--color-primary);
}

img,
svg {
  display: block;
  max-width: 100%;
}

h1,
h2,
h3,
h4 {
  font-family: var(--font-main);
  color: var(--color-text);
  font-weight: 400;
  letter-spacing: -0.02em;
}

h1 {
  font-size: clamp(38px, 5vw, 56px);
  line-height: 1.22;
}

h2 {
  font-size: clamp(28px, 4vw, 38px);
  line-height: 1.35;
}

h3 {
  font-size: 23px;
  line-height: 1.4;
}

p,
li {
  color: var(--color-text-muted);
  line-height: 1.85;
}

code,
pre,
kbd,
samp {
  font-family: var(--font-mono);
}

.container {
  max-width: var(--container-xl);
  margin: 0 auto;
  padding: 0 24px;
}

.site-header {
  position: sticky;
  top: 0;
  z-index: 50;
  background: rgba(245, 244, 236, 0.92);
  border-bottom: 1px solid rgba(226, 224, 213, 0.78);
  backdrop-filter: blur(10px);
}

.site-header__inner {
  max-width: var(--container-xl);
  height: 78px;
  margin: 0 auto;
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}

.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  padding: 30px;
}

.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 42px;
  padding: 0 18px;
  border-radius: var(--radius-sm);
  font-size: 15px;
  font-weight: 500;
  text-decoration: none;
  cursor: pointer;
  transition:
    background 160ms ease,
    color 160ms ease,
    border-color 160ms ease,
    transform 160ms ease;
}

.button-primary {
  background: var(--color-primary);
  color: white;
  border: 1px solid var(--color-primary);
}

.button-primary:hover {
  background: var(--color-primary-dark);
  border-color: var(--color-primary-dark);
  transform: translateY(-1px);
}

.button-outline {
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-text);
}

.button-outline:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
  transform: translateY(-1px);
}

.tag {
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  padding: 0 10px;
  border-radius: var(--radius-sm);
  background: var(--color-bg-soft);
  border: 1px solid var(--color-border);
  color: var(--color-text-subtle);
  font-size: 13px;
}

@media (max-width: 760px) {
  .site-header__inner {
    height: auto;
    min-height: 68px;
    padding: 14px 20px;
    align-items: flex-start;
    flex-direction: column;
  }

  .container {
    padding: 0 20px;
  }

  h1 {
    font-size: 38px;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

```

---

## 28. 最终提醒

本 Skill 的目标不是“复刻某个站点”，也不是“固定某种业务页面”。

真正要复用的是：

- 字体气质。
- 纸张感背景。
- 低饱和配色。
- 深绿色点睛。
- 舒展留白。
- 轻量卡片。
- 克制动效。
- 中文阅读友好。
- 个人站的温度。

每次具体做什么页面，都由用户当次需求决定。Codex 要把本文件当成“视觉范式”，而不是“页面内容模板”。

最重要的边界：

- 可以学习“浅米色纸感 + 墨绿色点睛 + 文楷字体 + 轻卡片 + 大留白”的方法。
- 不可以复制参考站的课程站结构、品牌名称、专有文案和图片素材。
- 可以把这套方法迁移到照片站、作品集、工具页、产品页、后台等不同业务。
- 不可以让所有项目都长成同一种个人知识站。
- 对于映墨这类照片生活记录项目，应优先服务“照片、生活、情绪、记录、他人日常”的产品气质。
