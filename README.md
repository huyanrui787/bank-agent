# AI 客户经营助手 Demo

面向银行客户经理 / 支行管理人员的 AI 经营助手演示系统。需求来源：`ai_customer_demo_agent_spec.md`。

## 功能

### 业务功能

- AI 工作台：多会话对话 + 执行 Timeline + 流式输出，可挂载技能、选择数据源与目标表
- 客群梳理：预置模板 + 自定义筛选 + TanStack Table（搜索 / 排序 / 分页）
- 垂直管理：客户经理排行、绩效一览、Excel 名单导入 + AI 自动分配
- 业务预警：7 类预警来源、Drawer 详情、AI 建议话术、状态流转、一键推送渠道
- 查询分析：客户 360° 画像（风险、准入、流水、推荐、报告）
- 技能中心：6 个内置技能（保守风控视角 / 合规审查员 / 简报模式 / 营销话术优化 / 支行管理视角 / 催收专家）+ 自定义技能，支持启停与 prompt 覆写

### 平台功能

- 编排工作流：React Flow 可视化编辑器，7 类节点（start / end / llm / tool / codeact / condition / skill）+ 7 套预置工作流，SSE 流式执行
- 数据源管理：15 种数据源在线配置与连通性测试，密码 AES-256-GCM 加密落库
- 知识库：文件列表（多文件上传 / 解析状态 / 删除）、检索测试、解析日志、切片与解析配置，背后调 RAGFlow 检索引擎（独立部署），AI 工作台语义检索并标注文件来源
- 渠道配置：企业微信机器人 / 龙龙 / 短信 / 自定义 Webhook 四类通知渠道
- 定时任务：周期规则调度，到点经渠道推送提醒（由 `instrumentation.ts` 内 30s 心跳驱动）
- 审计日志：哈希链防篡改审计流水 + 完整性校验
- 权限配置：5 内置角色 × 13 权限动作的 RBAC 管理与账号管理
- Excel / CSV 导出：`/api/export?type={customers|managers|alerts}&format={xlsx|csv}`，xlsx 走 ExcelJS，带表头样式 / 冻结首行 / 自动筛选 / 列宽 / 斑马纹
- 多数据源接入：SQLite / MySQL / PostgreSQL / SQL Server / Oracle / DB2 / Hive / Impala / Elasticsearch / DTSQL / 向量库（pgvector·Milvus·Qdrant·Weaviate·Chroma），经 Python codeact sidecar 跨库执行查询与向量检索，详见 [docs/数据源.md](docs/数据源.md)

## 演示账号

系统强制登录（未登录一律跳 `/login`）。预置账号密码均为 `demo123`：

| 用户名 | 姓名 | 角色 | 数据范围 |
| --- | --- | --- | --- |
| `lixue` | 李雪 | 客户经理 | 本人名下客户（高新一网格） |
| `wangxiaodong` | 王晓东 | 客户经理 | 本人名下客户（高新二网格） |
| `zhaomin` | 赵敏 | 客户经理 | 本人名下客户（经开网格） |
| `liuyang` | 刘洋 | 客户经理 | 本人名下客户（未央网格） |
| `zhoujianhua` | 支行长-高新 | 支行负责人 | 高新支行 |
| `admin` | 分行管理员 | 分行管理员 | 全行 + 系统配置 |
| `compliance` | 合规专员 | 合规审计 | 全行（脱敏）+ 审计 |

> 侧边栏菜单按权限动态渲染：渠道配置 / 数据源 / 审计日志 / 权限配置仅对应权限的角色可见。用不同账号登录可演示数据隔离与菜单差异。

## 技术栈

- Next.js 16 App Router + Turbopack + TypeScript、React 19
- Tailwind CSS v4（手写 shadcn 风格 UI primitives，无 CLI 依赖）
- Radix UI（dialog / select / tabs / tooltip 等无障碍组件）
- TanStack Table v8、Recharts、React Flow（@xyflow/react）、sonner、lucide-react、zod
- better-sqlite3 本地库 + jose（JWT）+ bcryptjs + ExcelJS
- Python FastAPI sidecar（codeact 沙箱）承载跨库查询与 Python 代码执行
- **RAGFlow**（独立部署的检索引擎）承载文档解析 / 向量化 / 语义检索，经 HTTP API 接入（详见 [docs/数据源.md](docs/数据源.md) 同级的 RAGFlow 集成说明）
- **Agent 双轨**：默认走真实 LLM（OpenAI 兼容 Chat Completions API，已对接 `qwen/qwen-plus`·阿里云百炼 DashScope），失败/未配置 key 时自动 fallback 到 deterministic mock，保证现场演示稳定

## 运行架构

```
┌──────────────────────────────┐     ┌────────────────────────────┐
│  Next.js 16 (:3015)          │HTTP │  Python sidecar (:8765)    │
│  UI + API Routes + Agent 主循环├────►│  FastAPI + codeact 沙箱     │
│                              │     │  /exec /schema             │
└───┬───────────────┬──────────┘     │  /datasource/test          │
    │ better-sqlite3 │ HTTP           └────────────┬───────────────┘
    ▼               ▼                            │ SQLAlchemy / 向量客户端
 data/bank.db    RAGFlow (:9380)                  ▼
 data/enterprise.db 知识检索引擎              外部库：MySQL / PG / ES /
 data/settlement.db（文档解析/向量化/检索）     Oracle / 向量库 ...
 data/guarantee.db
```

Next.js 与 Python sidecar 两个进程需常驻（见「生产部署」）；RAGFlow 为独立部署的检索引擎，未配置时知识检索返回「知识库未接入」。主库 `data/bank.db` 由 `lib/db/index.ts` 首次访问时自动建表并从 `lib/mock/` 播种，无需手动初始化。

## Agent 工作流

```
用户自然语言
    ↓
/api/mock-agent (Node runtime, SSE)
    ↓ 鉴权 → 权限校验(ai_chat) → 装配 scope / 技能 / 数据字典
streamLlmAgent → qwen-plus (Chat Completions API)
    ↓ tool_call（最多 4 轮）
本地工具（filterCustomers / scanAlerts / analyzeCustomer / ...）
  ├─ codeActAnalysis → Python sidecar → 跨库 SQL / 向量检索 / 出图
  └─ searchKnowledge → RAGFlow HTTP API → 语义检索 + 文档来源
    ↑ JSON result
继续 LLM → 最终中文总结 + 结构化数据
    ↓
前端 Timeline + 表格 / 图表 / 预警 / 画像 / 报告 / 文件
    ↓
写入哈希链审计日志（ai.chat.query）
```

可用工具（10 个）：`filterCustomers`、`getManagerPerformance`、`scanAlerts`、`analyzeCustomer`、`generateInvestigationReport`、`generateScript`、`queryDatabase`、`searchKnowledge`、`exportData`、`codeActAnalysis`。

两个设计要点：

- **schema-as-prompt**：真实表结构由 `buildSchemaPrompt` 注入 system prompt 做 NL2SQL，而非硬编码表名，因此切换数据源即可换库问数。
- **双轨兜底**：未配置 key 或 LLM 运行时失败，自动降级到 `lib/agent/mock-tools.ts` 的确定性实现（返回体标记 `_agent: "mock"` / `"mock-fallback"`），现场演示不会中断。

工具定义在 [lib/agent/tools.ts](lib/agent/tools.ts)，agent 主循环在 [lib/agent/llm-agent.ts](lib/agent/llm-agent.ts)，LLM/SSE 客户端在 [lib/agent/llm.ts](lib/agent/llm.ts)，mock 兜底在 [lib/agent/mock-tools.ts](lib/agent/mock-tools.ts)。

## 权限与合规

演示系统里合规相关的实现是完整的，不是壳子：

- **认证**：JWT 双令牌（access 15min / refresh 7d，httpOnly Cookie），refresh 轮换并吊销旧令牌；`middleware.ts` 统一校验并向下游注入 `x-user-*` 身份头。
- **RBAC**：13 个权限动作 × 5 个内置角色，权限点集中定义在 [lib/rbac/catalog.ts](lib/rbac/catalog.ts)，API 与侧边栏共用同一套 `can()` 判定。
- **数据范围隔离**：`personal / branch / bank` 三级 scope 翻译成 SQL WHERE。TypeScript 侧由 `SqliteConnector` 拼接，Python 沙箱侧另包一层 `query()` 强制注入同样的条件——两条执行路径都不能绕过。
- **数据分级与脱敏**：字段按 L1/L2/L3 分级（[lib/auth/data-classification.ts](lib/auth/data-classification.ts)），`maskPii` 角色自动脱敏；`redactForLlm` 确保 PII 不进模型上下文。
- **审计**：哈希链式审计日志（[lib/audit/log.ts](lib/audit/log.ts)），`verifyChainIntegrity` 可校验是否被篡改，`/audit` 页面仅分行管理员与合规审计可见。
- **凭证加密**：数据源密码 AES-256-GCM 加密存储，接口返回一律掩码为 `••••••••`。

## 配置 LLM 凭证

复制 `.env.example` 为 `.env.local`，填入：

```env
LLM_PROVIDER=qwen
LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
LLM_API_KEY=sk-...        # 阿里云百炼 DashScope 的 API Key
LLM_MODEL=qwen-plus
USE_MOCK_AGENT=false      # true 时强制本地 mock，无需网络
```

未配置 key 时自动降级到本地 mock；运行时调用失败也会 fallback 并在工作台 Timeline 顶部弹出错误条。

## 配置 RAGFlow 知识检索

知识库检索（`searchKnowledge` 工具）依赖 RAGFlow 独立服务，未配置时检索返回「知识库未接入」。在 `.env.local` 追加：

```env
RAGFLOW_BASE_URL=http://127.0.0.1:9380   # RAGFlow 服务地址
RAGFLOW_API_KEY=ragflow-...              # RAGFlow「API」页生成的 Key
# 可选：召回条数 / 相似度阈值 / 超时（默认 3 / 0.2 / 10000ms）
# RAGFLOW_TOP_K=3
# RAGFLOW_SIMILARITY_THRESHOLD=0.2
# RAGFLOW_TIMEOUT_MS=10000
```

拉起 RAGFlow（独立部署，官方 docker compose）：

```bash
git clone https://github.com/infiniflow/ragflow && cd ragflow/docker
# Linux 需先：sysctl -w vm.max_map_count=262144
docker compose up -d          # Web UI 默认 http://localhost:9380
```

在 RAGFlow Web UI 建知识库并上传政策/合规文档，解析完成后，登录 bank-agent（`admin`）在 `/knowledge-base` 页即可看到并管理文档，工作台问「小微企业贷款最高额度是多少？」即走语义检索并标注文件来源。

## 启动

```bash
pnpm install

# Python sidecar 依赖（首次）
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

pnpm dev          # 同时拉起 next + codeact sidecar，默认 http://localhost:3000
PORT=3015 pnpm dev # 自定义端口
```

`pnpm dev` 经 `concurrently` 同时启动 Next.js 与 Python sidecar。也可分开跑：`pnpm dev:next` / `pnpm dev:codeact`。

首次访问会自动建库并播种 `data/bank.db`，用上表任一账号登录即可。若只演示本地库能力，sidecar 非必需（仅 codeact 分析、外部数据源测试与 schema 反射会不可用）。

接入外部数据源需要额外拉起数据库容器：

```bash
docker compose -f docker-compose.databases.yml up -d   # MySQL/pgvector/ES/Qdrant/Weaviate/Chroma/Milvus
docker compose -f docker-compose.databases.yml --profile heavy up -d  # 追加 SQL Server/Oracle/DB2
bash scripts/setup_demo_databases.sh                   # 灌演示数据
```

## 生产部署（长期运行）

长期运行请用**生产模式**（`next build` + `next start`），不要长期挂 `next dev`。需同时管理两个进程：Next.js + Python codeact sidecar。

```bash
npm i -g pm2           # 安装 pm2（一次性）
pnpm build             # 构建生产版

# 用 pm2 启动两个进程
pm2 start "PORT=3015 pnpm start" --name bank-agent
pm2 start ".venv/bin/python codeact_server.py" --name codeact-sidecar

# 保存进程列表 + 开机自启
pm2 save
pm2 startup            # 按输出提示执行（macOS→launchd，Linux→systemd）
```

生产模式服务地址：`http://localhost:3015`。

常用管理命令：

```bash
pm2 status              # 看状态
pm2 logs                # 看日志（pm2 logs bank-agent 看单进程）
pm2 restart all         # 重启全部
pm2 stop all            # 停止
```

> macOS 无 systemd，开机自启用 launchd（本机已配置 `~/Library/LaunchAgents/pm2.ziggy.plist`，登录后自动 `pm2 resurrect` 恢复进程）。

## 关键目录

```
app/
  (public)/login/           # 登录页
  (app)/                    # 需鉴权的应用外壳（AppSidebar + AppHeader）
    page.tsx                #   AI 工作台
    customer-segments/      #   客群梳理
    vertical-management/    #   客户经理垂直管理
    alerts/                 #   业务预警
    analysis/               #   查询分析（客户画像 / 调查报告）
    skills/                 #   技能中心
    workflow/[id]/          #   工作流可视化编辑器
    datasources/            #   数据源配置
    channels/               #   通知渠道配置
    tasks/                  #   定时任务
    audit/                  #   审计日志
    permissions/            #   角色与账号管理
  api/
    auth/                   # login / logout / refresh / me
    mock-agent/route.ts     # Agent 主入口（SSE）
    workflows/[id]/run/     # 工作流执行（SSE）
    datasources/[id]/test/  # 连通性测试（代理到 Python sidecar）
    export/route.ts         # CSV / xlsx 导出
    roles/ users/ audit/ channels/ tasks/ skills/ schema/
components/
  app-sidebar.tsx, app-header.tsx
  chat/                     # 工作台对话：消息流、工具步骤、结果块、图表、数据源选择器
  workflow/                 # React Flow 画布、节点、节点配置面板、运行面板
  tasks/                    # 任务表单、到期提醒 Provider
  customer-table.tsx, alert-card.tsx, alert-detail-drawer.tsx
  cashflow-chart.tsx, manager-ranking.tsx, empty-state.tsx
  ui/                       # shadcn 风格基础组件
lib/
  agent/                    # llm-agent（主循环）、tools、llm、mock-tools、skill-store
  db/                       # better-sqlite3 建表 / 迁移 / 播种、schema 反射
  datasource/               # 连接器抽象、字段映射、scope-aware 查询
  auth/                     # jwt、scope、permissions、desensitize、data-classification
  rbac/                     # 权限目录、角色、用户
  workflow/                 # 节点类型、执行器、预置工作流
  channels/dispatch.ts      # 四类通知渠道分发
  audit/log.ts              # 哈希链审计日志
  security/encrypt.ts       # AES-256-GCM 凭证加解密
  tasks/                    # 定时任务存储与触发判定
  export/                   # csv.ts / xlsx.ts
  mock/                     # 客户 / 经理 / 预警 / 走访 / 知识库 / 趋势等种子数据
codeact_server.py           # Python FastAPI sidecar（:8765）
instrumentation.ts          # 30s 心跳：扫描到期任务并推送
middleware.ts               # JWT 校验 + 角色路由拦截 + 身份头注入
docs/                       # 数据源接入指南、生产化演进设计
```

## 演示路径

**核心业务链路**（用 `lixue` 或 `admin` 登录）：

1. 工作台输入：`梳理 高新区·锦园 中日均存款大于 10 万的客户` → 表格 + 导出按钮
2. 工作台输入：`分析 张明 的风险情况，并生成调查报告` → 360° 画像 + 报告
3. `/alerts` → 点击任一卡片 → Drawer 内 `生成联系话术` → 推送渠道 → 标记已完成
4. `/vertical-management` → `导入支行客户清单` → `AI 自动分配客户经理`
5. `/skills` → 开启「保守风控视角」→ 回工作台再问同一问题，对比语气与结论差异

**平台能力链路**（用 `admin` 登录）：

6. `/workflow` → 从预置模板创建「筛客 → 风险分析 → 话术生成」→ 画布上改节点 → `运行` 看 SSE 流式执行
7. `/datasources` → 新建 MySQL/向量库数据源 → `测试连接` → 回工作台选中该数据源问数（走 codeact 跨库执行）
8. `/tasks` → 建一个每日提醒 → `/channels` 配企业微信机器人 → 到点自动推送
9. `/audit` → 查看操作流水 → `校验完整性` 演示哈希链防篡改
10. `/permissions` → 调整角色权限 → 换 `compliance` 账号登录，观察菜单收窄与数据脱敏

**数据隔离对照**：分别用 `lixue`（仅本人客户）、`zhoujianhua`（高新支行）、`admin`（全行）登录同一页面，客户数与经理数逐级放大；`compliance` 登录则全行可见但身份证/手机号脱敏。

所有客户姓名、身份证、手机号已脱敏，默认数据全部为本地 SQLite 种子数据，不接外部数据源时无外部依赖。
