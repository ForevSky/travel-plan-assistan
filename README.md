# 旅行规划小助手

基于 **DeepSeek API** 的企业级旅行规划平台，支持 **CLI** 与 **Web** 双模式。

> 输出为 AI 规划建议，预约/收费/天气等信息非实时查询，出行前请核实官方公告。

## 功能特性

| 功能 | 说明 |
|------|------|
| 自然语言规划 | 例如：「我想去杭州两日游，轻松一点」 |
| 追问微调 | 例如：「再加一个人」「不想去某景点」 |
| 领域拒答 | 非旅行问题拒答并引导 |
| 结构化展示 | 每日时间轴 + 关联图示（上图下词） |
| 流式输出 | Web 端 SSE 实时展示生成过程 |
| 后台继续生成 | 切换对话时后端不中断，生成完成后自动落库 |
| 流式续订 | 切回原对话时自动续订 SSE，从当前进度继续展示 |
| 暂停生成 | 生成中可点击底部按钮停止前端展示（后端仍会跑完） |
| 会话管理 | 多会话列表、搜索、删除（生成中可切换，不影响后台任务） |
| 分享 | 分享完整会话或单条攻略，独立分享页预览 |
| 导出文件 | Web 端浏览器下载 TXT；CLI 保存至 `storage/output/` |
| API 兜底 | 失败时可选本地模板（成都/北京） |

## 快速开始

### CLI 模式

```bash
cd travel-plan-assistant
pip install -r requirements.txt
copy .env.example .env    # 填入 DEEPSEEK_API_KEY
python main.py
# 或: scripts\start-cli.ps1
```

### Web 平台（开发）

```bash
cd travel-plan-assistant
pip install -r requirements.txt
copy .env.example .env

# 终端 1：启动后端（默认 http://127.0.0.1:8000）
python web_server.py
# 或: scripts\start-api.ps1

# 终端 2：启动前端开发服务
cd frontend
pnpm install
pnpm dev
```

浏览器访问 http://localhost:5173（Vite 开发服务器，API 代理至后端）

### Web 平台（生产）

```bash
scripts\build-frontend.ps1
python web_server.py
```

浏览器访问 http://127.0.0.1:8000（后端同时托管前端静态资源）

## Web 使用说明

| 操作 | 说明 |
|------|------|
| 新建对话 | 首页输入需求，或侧栏点击「新建对话」 |
| 发送消息 | Enter 发送，Shift+Enter 换行 |
| 切换对话 | 生成中可切到其他会话，后台继续生成；切回后自动续订流式输出 |
| 暂停生成 | 生成中底部按钮变为暂停图标，点击停止前端展示（后台仍会完成并落库） |
| 删除会话 | 侧栏会话项右侧删除按钮 |
| 分享会话 | 攻略生成完成后，聊天页顶部「分享会话」 |
| 分享单条攻略 | 攻略卡片右上角分享图标 |
| 导出攻略 | 攻略卡片右上角下载图标，浏览器保存 TXT |
| 保存到服务端 | 追问态输入「保存」，写入 `storage/output/` |

**分享规则**：生成中或最后一条 AI 回复被暂停时，不展示分享入口；重新发送并完成生成后恢复。

## 项目结构

```
travel-plan-assistant/
├── main.py                     # CLI 入口
├── web_server.py               # Web API 入口
├── requirements.txt
│
├── backend/                    # Python 后端
│   ├── core/                   # 配置、LLM 网关、Prompt
│   ├── domain/                 # 领域守门、意图解析、校验
│   ├── services/               # 业务服务（规划、导出）
│   ├── application/            # CLI 应用编排
│   ├── presentation/           # CLI 输出格式化
│   ├── fallback/               # API 失败兜底
│   └── web/                    # Web API（FastAPI + SQLite）
│       ├── api/                # 路由、模型、存储
│       └── services/           # Web 聊天编排、后台生成、分享服务
│
├── frontend/                   # React 前端
│   └── src/
│       ├── app/                # 路由与布局
│       ├── features/           # home / chat / share / travel-plan
│       └── shared/             # api / components / types / utils
│
├── storage/                    # 运行时数据（不入库）
│   ├── data/                   # SQLite 会话库
│   └── output/                 # 导出攻略 TXT
│
├── scripts/                    # 启动与构建脚本
├── docs/                       # 项目文档
└── .env                        # 环境变量（本地）
```

## 架构分层

```
┌─────────────────────────────────────────────┐
│  表现层   frontend/ + presentation/         │
├─────────────────────────────────────────────┤
│  应用层   application/ + web/services/        │
├─────────────────────────────────────────────┤
│  领域层   domain/                           │
├─────────────────────────────────────────────┤
│  业务层   services/                         │
├─────────────────────────────────────────────┤
│  Prompt   core/prompts.py                   │
├─────────────────────────────────────────────┤
│  基础设施 core/ (config + llm_client)        │
└─────────────────────────────────────────────┘
```

## API 概览

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET/POST | `/api/conversations` | 列表 / 创建会话 |
| GET/PATCH/DELETE | `/api/conversations/{id}` | 详情（含 `generating` 状态）/ 重命名 / 删除 |
| POST | `/api/conversations/{id}/messages/stream` | SSE 流式发送消息 |
| GET | `/api/conversations/{id}/messages/stream` | SSE 续订进行中的生成 |
| POST | `/api/conversations/{id}/export` | 服务端导出攻略 |
| POST | `/api/conversations/{id}/share` | 创建会话分享 |
| POST | `/api/conversations/{id}/messages/{msg_id}/share` | 创建攻略分享 |
| GET | `/api/share/{token}` | 获取分享内容 |

## 配置说明

### `.env`

```env
DEEPSEEK_API_KEY=sk-your-api-key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

可选：`UVICORN_RELOAD=0` 关闭后端热重载（生产环境）

## 文档

- [技术方案（已实现版）](docs/旅行规划小助手.md)
- [项目说明报告](docs/项目说明报告.md)

## License

MIT
