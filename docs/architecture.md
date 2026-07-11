# 映墨 V2 技术架构

> 状态：M0 基线。本文定义后续工程初始化的目标结构，不代表工程已经创建。

## 1. 当前状态与迁移结论

当前仓库已完成的是 V1 静态生活照片首页，而非 V2 业务系统：Vite 脚本、单页 HTML、响应式 CSS、深浅主题及本地记忆、品牌图标、7 张本地照片和由 `galleryItems` 驱动的照片卡片/详情弹窗均可运行。上传表单、评论、点赞、可见范围和统计仅为静态展示；没有 React、Flask、数据库、认证、真实上传或 API。

可复用的结论如下：

| 范围 | 复用结论 | 后续落点 |
| --- | --- | --- |
| 品牌 | `assets/brand/` 的 logo、favicon、Apple Touch Icon 直接保留 | `frontend/public/brand/`（迁移任务复制，不删除原件） |
| 图片样例 | `assets/gallery/photo-01.jpg` 至 `photo-07.jpg` 仅作视觉 demo | `frontend/public/demo/` 或 mock；不得作为生产内容 |
| 视觉 token | `style.css` 的颜色、圆角、阴影、容器和深浅主题 token 可提炼 | `frontend/src/styles/tokens.css` |
| 组件样式 | Header、按钮、卡片、ProfileChip、照片网格、Lightbox、空状态、页脚和断点 | `frontend/src/components/` 与 feature 样式 |
| 交互 | `yingmo-theme` 存储键、系统主题跟随、Esc/遮罩关闭弹窗、焦点回退、图片懒加载 | `ThemeProvider`、`PhotoLightbox` |
| 文案气质 | "把日常映成墨色"及温和、低压力的生活区表达 | 首页和日常区；游戏区使用更结构化的信息展示 |

迁移结论：保留静态 V1 直到 React 首页视觉验收完成；之后将其移至一次性确定的 `legacy-static/` 或由 Git 标签 `static-v1` 保留。硬编码 `galleryItems` 必须迁至集中 mock 文件，不能进入业务组件。V2 首页改为“日常 + 游戏教材”分流，不能只复制 V1 生活照片信息架构。

## 2. 明确技术决策

| 决策 | 结论 |
| --- | --- |
| 前端 | React + Vite，JavaScript 首次初始化；若团队决定 TypeScript，必须在 1A 一次性切换，不能半仓混用。 |
| 前端路由 | React Router；页面按 feature 组织，路由组件不得直接拼装 API 请求。 |
| 服务端 | Flask App Factory + Blueprint；业务规则在 service 层，路由仅负责 HTTP、鉴权和序列化。 |
| ORM/迁移 | SQLAlchemy + Flask-Migrate（Alembic）；所有 schema 演进使用迁移。 |
| 数据库 | SQLite 仅用于本地开发/测试；联调与生产固定 MySQL 8.0+，使用 `utf8mb4`。 |
| 认证 | JWT access token（短期）+ refresh token（长期、可撤销）；access token 经 `Authorization: Bearer` 发送，refresh token 使用 Secure、HttpOnly、SameSite cookie。 |
| 图片 | `StorageService` 抽象；开发用受控本地目录，生产用 S3 兼容对象存储；图片二进制不入库。 |
| API | JSON REST，固定前缀 `/api/v1`，契约见 `api-conventions.md`。 |
| 时间与 ID | API 使用 UTC ISO 8601（带 `Z`）；主键采用数据库 bigint，外部 URL 使用 slug 或 bigint，禁止暴露存储路径。 |
| 任务执行 | 异步缩略图/通知在 MVP 可同步处理并保留 service 接口；引入队列须在独立基础设施任务完成，不能在业务任务暗中加入。 |

## 3. 逻辑架构

```text
Browser
  └─ React + Vite SPA
       ├─ Router / feature pages / shared UI
       ├─ API client / auth session / error handling
       └─ public brand & demo assets
              │ HTTPS JSON / multipart
              ▼
       Flask application (/api/v1)
       ├─ Blueprints → schemas → services → models
       ├─ authn/authz, validation, error handlers
       └─ StorageService
          ├─ MySQL (application data)
          └─ local storage (dev) / object storage (prod)
```

前端不能直接访问数据库或对象存储管理凭据。后端在读取内容、媒体和互动目标时执行可见性与权限判断。生产部署时由 Nginx 提供 HTTPS 和静态前端，反向代理 Gunicorn/Flask；数据库与对象存储不暴露给浏览器。

## 4. 目标目录

```text
YingMO/
├── AGENTS.md
├── docs/                         # PRD、架构、API、数据库和进度的权威文档
├── frontend/                     # 任务 1A 创建
│   ├── public/{brand,demo}/
│   └── src/
│       ├── app/                  # Router、providers、error boundary
│       ├── api/                  # HTTP client、endpoint modules
│       ├── components/           # 无业务归属的可复用 UI
│       ├── features/{auth,life,games,guides,profile,admin}/
│       ├── pages/                # 路由页面组合
│       ├── mocks/                # 仅迁移期 mock，集中管理
│       ├── styles/               # token、reset、全局样式
│       └── utils/
├── backend/                      # 任务 1B 创建
│   ├── app/
│   │   ├── __init__.py           # create_app、扩展和 Blueprint 注册
│   │   ├── config.py
│   │   ├── extensions.py
│   │   ├── common/               # response、errors、pagination、permissions
│   │   ├── models/
│   │   ├── services/
│   │   ├── schemas/              # 请求/响应验证与序列化
│   │   └── blueprints/
│   ├── migrations/
│   ├── tests/{unit,integration}/
│   ├── requirements.txt
│   └── run.py
├── legacy-static/                # 仅在独立迁移任务中从当前静态版本归档
└── scripts/
```

## 5. Flask Blueprint 与职责

所有 Blueprint 都注册在 `/api/v1` 下；`health` 是唯一不带业务名的公开健康检查。

| Blueprint | URL | 职责 |
| --- | --- | --- |
| `health` | `/health` | 存活/就绪检查，不泄露密钥与内部配置 |
| `auth` | `/auth` | 注册、登录、刷新、退出、当前会话 |
| `users` | `/users` | 公开资料、本人资料与内容列表 |
| `uploads` | `/uploads` | 图片上传、临时媒体删除、归属校验 |
| `life` | `/life/chapters`, `/life/posts` | 日常章节、重复候选、日常内容与可见性 |
| `games` | `/games` | 游戏、英雄、地图及新建申请/后台维护入口 |
| `guides` | `/guides` | 游戏教材、步骤、筛选和有效性反馈 |
| `interactions` | `/interactions` | 日常/教材的点赞与收藏 |
| `comments` | `/comments` | 一级评论与一级回复 |
| `notifications` | `/notifications` | 通知列表与已读状态 |
| `search` | `/search` | 分类型全站搜索与建议 |
| `reports` | `/reports` | 举报创建和本人举报查询 |
| `admin` | `/admin` | 用户、内容、章节、举报、审核和操作日志；管理员专用 |

`models` 不依赖 Blueprint；服务层可组合多个模型，但不得从一个 Blueprint 直接调用另一个 Blueprint 的 view 函数。通用互动允许多目标类型，但 service 层必须使用白名单解析目标模型并校验目标存在、可见及可互动。

## 6. 独立交付顺序与验收边界

执行状态由 `docs/progress.md` 维护。M1 后的任务按路线图顺序进行；每项只改变其所列范围并独立测试：1A（前端可构建）、1B（后端健康检查和测试）、1C（健康检查联通）、1D（静态首页 React 迁移）、2A–2D（认证闭环）、3A–3C（媒体闭环）、4A–4F（日常闭环，M4 停止验收）、5A–5E（互动/个人中心）、6A–6D（游戏分类）、7A–7E（教材闭环）、8A–8D（搜索/治理）、9A–9D（质量与上线）。详细可执行清单及每项验证标准见 `docs/progress.md`。

## 7. 仍需人工决定

1. 首次前端采用 JavaScript 还是 TypeScript（本文暂定 JavaScript）。
2. 生产对象存储供应商、区域、CDN 与图片保留/删除策略。
3. 生产部署平台、域名、Nginx/Gunicorn 运维方式和监控服务。
4. JWT 的精确有效期、是否支持多设备会话管理，以及 refresh token 的撤销表保留期。
5. 邮箱验证、密码找回与用户协议/隐私政策的正式文本和合规要求。
6. 日常“仅登录用户”是否可被所有注册用户访问，以及“仅自己”媒体的 URL 签名/代理策略。
7. 游戏目录的首批管理员维护数据与普通用户“新增申请”的审核 SLA。
