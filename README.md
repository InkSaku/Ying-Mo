# 映墨 Yingmo

映墨 V2 是一个包含日常生活记录和游戏教材的 Web 内容社区。本仓库保留 V1 静态原型，并逐步建设 React + Flask 应用。

## 后端环境

后端使用 Python 3.12+、Flask、SQLAlchemy 和 Flask-Migrate。开发、测试、联调和生产统一使用 MySQL 8.0+；请在 `backend/.env` 设置带有 `charset=utf8mb4` 的 `DATABASE_URL`。测试可额外设置独立的 `TEST_DATABASE_URL`，未设置时会使用 `DATABASE_URL`，不会回退到本地文件数据库。

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pip install -r requirements-dev.txt
cp .env.example .env
flask --app run.py db init       # 仅首次、且 migrations/ 不存在时执行
flask --app run.py db upgrade
flask --app run.py run
```

开发服务默认监听 `http://127.0.0.1:5000`。健康检查地址为：

```text
GET http://127.0.0.1:5000/api/v1/health
```

运行测试：

```bash
cd backend
source .venv/bin/activate
pytest
```

`CORS_ORIGINS` 以逗号分隔允许的前端来源；开发默认示例同时包含 `http://localhost:5173` 和 `http://127.0.0.1:5173`。不要提交 `backend/.env`、虚拟环境、本地数据库文件或上传文件。

## 前端

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

前端 API 地址由 `VITE_API_BASE_URL` 配置，详见 `frontend/.env.example`。当前 React 首页已经完成静态原型迁移，包含日常与游戏教材双入口、日常照片预览、精选章节、教材卡片、深浅主题、响应式导航和开发连接状态；迁移期内容来自 `frontend/src/mocks/`，不冒充真实业务接口。

当前路由：

| 路径 | 用途 |
| --- | --- |
| `/` | React 首页 |
| `/life` | 日常空间占位页 |
| `/games` | 游戏教材占位页 |
| `/discover` | 发现占位页 |
| `/publish` | 发布占位页 |
| `/about` | 关于占位页 |
| `/404`、其他未知路径 | 404 页面 |

根目录的 `index.html`、`style.css`、`script.js` 和 `assets/` 仍是可独立运行的 V1 静态原型，没有被 React 工程覆盖。React 使用的品牌与图库副本位于 `frontend/public/assets/`，后续迁移不应修改这些副本的来源说明。

## 本地前后端联调

终端一启动后端：

```bash
cd backend
source .venv/bin/activate
flask --app run.py run
```

终端二启动前端：

```bash
cd frontend
npm install
cp .env.example .env  # 首次运行
npm run dev
```

访问 `http://127.0.0.1:5173`（或已配置 CORS 的 `http://localhost:5173`）。React 首页会请求 `GET http://127.0.0.1:5000/api/v1/health` 并在页面底部显示后端服务、环境和数据库状态。

常见问题：后端未启动时点击“重新检查”；数据库未初始化时执行 `flask --app run.py db upgrade`；API 地址或 CORS 配置错误时检查两端 `.env`；修改任一 `.env` 后重启对应进程；端口被占用时停止占用 `5000` 或 `5173` 的进程后重试。
