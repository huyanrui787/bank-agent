# AI 客户经营助手 · 生产化方案设计

> 版本：v1.0（草案）
> 日期：2026-08-19
> 范围：从当前 `bank-agent` demo 演进到生产级交付（面向龙湾农商行）
> 状态：待评审（Agent 框架最终选型、Chat2DB 集成方式需团队确认）

---

## 1. 背景与目标

### 1.1 现状

当前仓库是一个可演示的 **AI 客户经营助手 demo**：

- 前端：Next.js 16（App Router + Turbopack）+ TypeScript + shadcn 风格 UI + Tailwind v4
- 数据：本地 Mock（SQLite，`data/bank.db`），不接真实系统
- Agent：双轨——真实 LLM（`qwen-plus`，OpenAI 兼容 Chat Completions API + SSE）+ 本地 deterministic mock 兜底
- 执行引擎：Python `codeact` sidecar（`codeact_server.py`，端口 8765），支持多数据源 + 图表输出
- 已具备：JWT 认证（5 角色）、数据范围隔离（personal/branch/bank）、哈希链审计、可视化工作流

### 1.2 目标

在不推翻现有业务能力的前提下，把 demo 演进为**可生产交付**的银行 AI 经营助手：稳定、可观测、合规、可扩展、可多租户。

### 1.3 核心命题

> 生产开发应**复用成熟框架/库**，而非**从头手搓基础设施**。

但复用有边界：**复用「框架」与复用「成品」是两回事**。fork 一个成品意味着继承它的产品形态、技术栈、发布节奏与许可证——通常不是好买卖。正确姿势是：**横向（通用、无差异化）全复用成熟方案，纵向（业务、有护城河）自己建。**

---

## 2. 现状资产盘点（demo 里值得保留的）

| 模块 | 现状 | 结论 |
|---|---|---|
| 业务域（客群/预警/画像/权限模型/审计） | 手写，已成型 | **自建，护城河** |
| 数据范围隔离 + 脱敏 | JWT + scope + SQL WHERE 下沉 + `redactForLlm` | 已不错，**加固即可** |
| 审计日志 | 哈希链 + DB trigger 防篡改 | 已不错，**补齐血缘/来源引用** |
| Agent 编排循环 | 手写 `lib/agent/llm-agent.ts` | **换成熟框架**（不再手搓） |
| 工具定义 | `lib/agent/tools.ts` schema 清晰 | **保留，迁到新框架** |
| 代码执行引擎 | `codeact_server.py`（Python `codeact`） | **保留并加固**（选型正确） |
| 多数据源访问 | SQLAlchemy + 手维护驱动 | **重构为 connector 抽象** |
| NL→SQL / 问数 | LLM 裸写 SQL | **用成熟模式（schema 元数据 + few-shot + 校验）** |
| 可观测性 / 评测 | 无 | **补上**（生产必需） |

**一句话**：护城河是「银行域 + 合规 + 数据隔离 + 审计」，不是 agent 循环和 DB 驱动——那些是别人已经做烂、不该再手搓的部分。

---

## 3. 核心决策

### 决策 D1：复用框架，不复用成品

- QwenPaw / Chat2DB 都是**面向个人的成品**，不是多租户企业底座。
- 复用它们**底层的框架/库/规范**，不复用它们的**产品形态**。

### 决策 D2：许可证与合规边界

| 项目 | 许可证 | 结论 |
|---|---|---|
| QwenPaw | Apache 2.0 ✅ | 可改可商用，法律干净 |
| AgentScope（QwenPaw 底座） | Apache 2.0 ✅ | 同上 |
| Chat2DB 5.3.0+ | 修改版 Apache + 附加条款（`LicenseRef-Chat2DB`）⚠️ | 允许「内部自用」；对外交付/白标/OEM/嵌入式需**书面商业授权** |

> 已知团队与 Chat2DB 方存在商务关系，商业授权成本暂不设障。但**边界仍须明确**：Chat2DB 以**独立「问数引擎」服务**接入（方案 A，见 §6），而非 fork 进我方产品白标交付——这一拓扑在技术上和合规上都是最优解。

### 决策 D3：Agent 框架选型

倾向 **LangGraph（Python）**，理由与备选见 §5。

### 决策 D4：Chat2DB 作为「问数引擎」独立服务

Chat2DB 后端独立部署，承载多库连接、元数据、SQL 执行、结果集，通过 **MCP / HTTP** 接入我方 agent。详见 §6。

---

## 4. 分层复用地图（横向复用、纵向自建）

| 层 | 当前 demo | 生产策略 | 复用什么 |
|---|---|---|---|
| 业务域（经营/预警/画像/权限模型/审计） | 手写 | **自建** | 无（从 demo 演进） |
| 数据范围 / 脱敏 / 合规 | JWT + scope + 哈希链审计 | **自建并加固** | 无（核心资产） |
| Agent 编排循环 | 手写 `llm-agent.ts` | **换成熟框架** | LangGraph（倾向） |
| 工具执行 / 代码执行 | `codeact_server.py` | **保留并加固** | 已复用的 `codeact` |
| 多数据源访问 | SQLAlchemy + 一堆驱动 | **connector 抽象** | 借鉴 Chat2DB SPI 插件架构 |
| NL→SQL / 问数 | LLM 裸写 SQL | **成熟 NL2SQL 模式** | Chat2DB 上下文注入思路 + MCP |
| UI | Next.js + shadcn/Tailwind | **保持** | 无（银行风已对味） |
| 可观测性 / 评测 | 无 | **补上** | Langfuse / OpenTelemetry |

---

## 5. Agent 框架选型对比

| 候选 | 许可证 | 优 | 劣 | 结论 |
|---|---|---|---|---|
| **LangGraph** | MIT | 生产采纳度最高、生态最大、持久化/人工介入/可观测性完善；与已有 Python codeact sidecar 同语言 | 需把 agent 主循环迁到 Python | **首选** |
| AgentScope | Apache 2.0 | 多智能体能力强；QwenPaw 的 skill/governance/provider 抽象可借鉴 | 偏研究、迭代快、企业采纳度一般 | 参考，不作生产底座 |
| Vercel AI SDK | MIT | 保持 TS 栈，把现有 `llm-agent.ts` 硬化 | 生产级持久化/评测/人工确认仍需自建 | 若坚持 TS 栈则此路线 |

**结论**：agent 编排层用 **LangGraph（Python）**，与 codeact 执行引擎同侧；前端 Next.js 保持，二者经 HTTP/SSE 通信。QwenPaw/AgentScope 作为 **skill 系统、provider 抽象、governance 设计**的参考。

---

## 6. Chat2DB 集成方案

### 6.1 分三档：借什么 / 集成什么 / 跳过什么

**✅ 第一档：直接集成（不动它的代码）**

1. **MCP Server 整机集成**——`McpStarter` + `AiToolMcpAdapter` + `McpAuthInterceptor` 已把「连库 + 查元数据 + 执行 SQL」打包成 MCP 工具（带鉴权）。我方 `codeActAnalysis` 工具通过 MCP 调它，一次接上 40+ 库，不再手维护 Python 驱动。
2. **AES-GCM 凭据加密**——`AesGcmUtil` + `CommunityEncryptionKeyStore` 的「独立密钥文件 + AES-GCM」设计，替换当前 `data_sources.password_enc` 的 base64（等同明文）方案。
3. **NL2SQL 上下文注入思路**——「schema 元数据 + 库方言 + 用户上下文」喂给模型的模式，并入 `buildSystemPrompt` / `codeActAnalysis`。

**✅ 第二档：借鉴设计（自己实现，照它的架构）**

4. **SPI 驱动抽象**——「一库一插件 + 统一 `IDbMetaData`/`ISQLDialect` 接口」，新增库 = 加 connector，不改主流程。
5. **SQL 方言与元数据模型**——`TableMetadataRequest` / `ColumnMetadataRequest` / `TablesPageRequest` 分页拉元数据 + `ISQLDialect` 方言抽象。
6. **SQL 补全引擎分层**——cursor → intent → slot → candidate → evidence，长期做「问数工作台」时的天花板级参考。

**⛔ 第三档：跳过**

7. Java/Spring Boot 后端本身（我方是 TS + Python 双栈，不为复用换主栈）。
8. JCEF 桌面包 / Electron 运行时（银行交付是 B/S）。
9. 客户端 Umi/React UI（开发者工具风，不对银行味；但 `blocks/BI` 图表、`SearchResult` 虚拟滚动可参考）。

### 6.2 推荐集成拓扑（方案 A）

```
┌─────────────────────────────────────────────────────────────┐
│  我方 bank-agent（Next.js 前端 + LangGraph agent + codeact）   │
│  业务域：客户经营 / 预警 / 画像 / 权限 / 审计（自建，护城河）       │
└──────────────┬──────────────────────────────────────────────┘
               │  MCP / HTTP（带鉴权）
               ▼
┌─────────────────────────────────────────────────────────────┐
│  Chat2DB 后端（独立「问数引擎」服务，独立部署）                    │
│  多库连接 / 元数据 / SQL 执行 / 结果集 / 问数                     │
└──────────────┬──────────────────────────────────────────────┘
               │  JDBC / 驱动
               ▼
        40+ 数据库（MySQL / PG / Oracle / DM / 高斯 / ...）
```

- 我方保留：业务域 + 合规 + 数据隔离 + 审计 + agent 编排。
- Chat2DB 承担：纯粹的数据访问 + 问数执行。
- 优点：解耦、可独立扩容、许可证边界干净（独立服务，非白标）。

> 备选：**方案 B**——只借鉴设计，不部署它，把 SPI 抽象 + 加密 + NL2SQL 思路搬进 Python sidecar 自维护驱动（省一个服务，但要长期养 40+ 驱动，成本高）。**方案 C**——业务层做成 Chat2DB 插件（不推荐，被产品形态绑架）。

---

## 7. 目标架构

```
                       ┌──────────────────────────┐
                       │   Next.js 16 前端          │
                       │  shadcn/Tailwind（银行风） │
                       └────────────┬─────────────┘
                                    │ HTTP/SSE
                       ┌────────────▼─────────────┐
                       │  Agent 编排层（LangGraph） │
                       │  · 工具调用循环             │
                       │  · checkpoint / 人工确认   │
                       │  · 流式输出                │
                       └──────┬──────────┬─────────┘
                              │          │
                  ┌───────────▼───┐  ┌───▼──────────────────┐
                  │ 工具层(tools)  │  │ 执行引擎(codeact)      │
                  │ filterCustomers│  │ 沙箱 + 配额 + 审计      │
                  │ scanAlerts ... │  └───┬──────────────────┘
                  └───────────┬───┘      │
                              │     MCP/HTTP
                              │  ┌───▼──────────────────┐
                              │  │ Chat2DB 问数引擎(独立) │
                              │  │ 多库/元数据/执行/结果集 │
                              │  └──────────────────────┘
                    ┌─────────▼──────────┐
                    │ 数据层(自建)          │
                    │ · 数据范围 scope      │
                    │ · 脱敏 / 审计 / 血缘  │
                    │ · 凭据加密(AES-GCM)  │
                    └─────────────────────┘
                    · 可观测性：Langfuse / OpenTelemetry
                    · 评测：eval 集 / 回归
```

---

## 8. 分阶段实施路线

### Phase 0 — 决策（现在）
- [ ] 确认 Agent 框架选型（建议 LangGraph，备选 Vercel AI SDK 保 TS 栈）。
- [ ] 确认 Chat2DB 集成方式（建议方案 A：独立问数引擎 + MCP）。
- [ ] 与 Chat2DB 方确认商业授权边界，落到书面。

### Phase 1 — 加固（不换框架，先推到生产标准）
- [ ] 凭据加密：`data_sources.password_enc` base64 → AES-GCM + 独立密钥文件。
- [ ] `codeact_server.py`：沙箱加固、资源配额、超时、审计、密钥不入日志。
- [ ] 认证/JWT、数据范围隔离、审计、脱敏——补齐验收命门项。

### Phase 2 — 换横向底座
- [ ] 把 `llm-agent.ts` 手写循环迁到 LangGraph（工具 schema 复用 `tools.ts`）。
- [ ] 引入 Langfuse 做 trace/eval，OpenTelemetry 做监控。

### Phase 3 — 数据 / 问数增强
- [ ] 多数据源层重构为 connector 抽象（借鉴 Chat2DB SPI）。
- [ ] 接入 Chat2DB MCP，替换 `requirements.txt` 手维护驱动。
- [ ] NL→SQL 用「schema 元数据 + few-shot + 结果校验」模式，不裸写 SQL。

### Phase 4 — 企业化收口
- [ ] 多租户、HA、权限审批流。
- [ ] 字段血缘、文件来源引用、人工确认机制、敏感信息访问审批、合规模型输出限制。

---

## 9. 风险与待决事项

| # | 事项 | 风险 | 处置 |
|---|---|---|---|
| R1 | Agent 框架选型未定 | 若选错，Phase 2 返工 | Phase 0 先定，做小范围 PoC 验证 |
| R2 | Chat2DB 商业授权边界 | 若只口头、未书面，存在合规隐患 | 落到书面协议，明确「独立服务接入」性质 |
| R3 | 双栈复杂度（TS + Python + Java） | 运维面变大 | 方案 A 下 Chat2DB 独立部署、独立运维，边界清晰 |
| R4 | 多数据源驱动长期维护成本 | 自维护 40+ 驱动不现实 | 方案 A 借 Chat2DB；方案 B 才需自养 |
| R5 | LLM 裸写 SQL 的合规/正确性 | 问数结果不可信 | 加 schema 约束 + 结果校验 + 只读权限 + 审计 |

---

## 10. 附录：Chat2DB 可复用组件清单（含路径）

| 组件 | 路径（`chat2db-community-server/` 下） |
|---|---|
| SPI 驱动抽象接口 | `chat2db-community-spi/.../ai/chat2db/spi/`（`IDbMetaData` `ISQLDialect` `ISqlBuilder` `ISQLParser` `IPlugin`） |
| 元数据模型 | `.../spi/model/request/`（`TableMetadataRequest` `ColumnMetadataRequest` `TablesPageRequest`） |
| SQL 补全引擎 | `.../spi/`（`ISqlCompletion*` 系列接口） |
| 数据库插件 | `chat2db-community-plugins/chat2db-community-{mysql,postgresql,oracle,dm,gaussdb,kingbase,...}` |
| AI 聊天 / NL2SQL 适配层 | `.../web/api/adapter/ai/AiChatStreamAdapter.java`、`.../web/api/model/request/ai/ChatRequest.java` |
| MCP Server | `.../web/api/mcp/`（`McpStarter` `McpAuthInterceptor` `AiToolMcpAdapter` `McpExecuteSqlRequest`） |
| 凭据加密 | `.../tools/security/AesGcmUtil.java`、`CommunityEncryptionKeyStore.java` |
| 客户端图表 / 结果集 | `chat2db-community-client/src/blocks/BI`、`.../SearchResult` |

---

## 附：本轮讨论要点回溯

1. 复用要「复框架、不复成品」——QwenPaw 底座 AgentScope 比 QwenPaw 本身更值得复用；Chat2DB 以独立服务接入而非 fork。
2. 许可证：QwenPaw/AgentScope 为 Apache 2.0 可放心用；Chat2DB 需书面商业授权（商务关系已具备，但边界须明确）。
3. 护城河在纵向（业务 + 合规 + 隔离 + 审计），横向（agent 循环 / DB 驱动 / 问数）用成熟方案。
4. 最快落地项：AES-GCM 凭据加密（生产红线，半天可落地）。
