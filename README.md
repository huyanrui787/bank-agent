# AI 客户经营助手 Demo

面向银行客户经理 / 支行管理人员的 AI 经营助手演示系统。需求来源：`ai_customer_demo_agent_spec.md`。

## 功能

- AI 工作台：自然语言指令 + 执行 Timeline，调用内置 Mock Agent
- 客群梳理：5 套预置模板 + 自定义筛选 + TanStack Table（搜索 / 排序 / 分页）
- 垂直管理：客户经理排行、绩效一览、Excel 名单导入 + AI 自动分配
- 业务预警：7 类预警来源、Drawer 详情、AI 建议话术、状态流转
- 查询分析：客户 360° 画像（风险、准入、流水、推荐、报告）
- Skill Center：7 个内置技能卡片，演示 Agentic 工具调用
- Excel / CSV 导出：`/api/export?type={customers|managers|alerts}&format={xlsx|csv}`，xlsx 走 ExcelJS，带表头样式 / 冻结首行 / 自动筛选 / 列宽 / 斑马纹

## 技术栈

- Next.js 16 App Router + Turbopack + TypeScript
- Tailwind CSS v4（手写 shadcn 风格 UI primitives，无 CLI 依赖）
- Radix UI（dialog / select / tabs / tooltip 等无障碍组件）
- TanStack Table v8、Recharts、sonner、lucide-react、zod
- **Agent 双轨**：默认走真实 LLM（OpenAI Responses API，已对接 `ntnl-openai/gpt-5.5`），失败/未配置 key 时自动 fallback 到 deterministic mock，保证现场演示稳定

## Agent 工作流

```
用户自然语言
    ↓
/api/mock-agent (Node runtime)
    ↓
runLlmAgent → gpt-5.5 (Responses API + SSE)
    ↓ tool_call
本地工具（filterCustomers / scanAlerts / analyzeCustomer / ...）
    ↑ JSON result
继续 LLM → 最终中文总结 + 结构化数据
    ↓
前端 Timeline + 表格 / 预警 / 画像 / 报告 / 文件
```

工具定义在 [lib/agent/tools.ts](lib/agent/tools.ts)，agent 主循环在 [lib/agent/llm-agent.ts](lib/agent/llm-agent.ts)，SSE 客户端在 [lib/agent/llm.ts](lib/agent/llm.ts)。

## 配置 LLM 凭证

复制 `.env.example` 为 `.env.local`，填入：

```env
LLM_PROVIDER=ntnl-openai
LLM_BASE_URL=https://new-api.ntnl.io/v1
LLM_API_KEY=sk-...        # 与本机 opencode auth.json 中 ntnl-openai.key 一致
LLM_MODEL=gpt-5.5
LLM_REASONING_EFFORT=low  # low | medium | high
USE_MOCK_AGENT=false      # true 时强制本地 mock，无需网络
```

未配置 key 时自动降级到本地 mock；运行时调用失败也会 fallback 并在工作台 Timeline 顶部弹出错误条。

## 启动

```bash
pnpm install
pnpm dev          # 默认 http://localhost:3000
PORT=3015 pnpm dev # 自定义端口
```

## 关键目录

```
app/
  page.tsx                  # AI 工作台
  customer-segments/        # 客群梳理
  vertical-management/      # 客户经理垂直管理
  alerts/                   # 业务预警
  analysis/                 # 查询分析（客户画像 / 调查报告）
  skills/                   # Skill Center
  api/mock-agent/route.ts   # 自然语言意图路由
  api/export/route.ts       # CSV 导出
components/
  app-sidebar.tsx, app-header.tsx
  ai-command-box.tsx, ai-execution-timeline.tsx
  customer-table.tsx, alert-card.tsx, alert-detail-drawer.tsx
  deposit-loan-chart.tsx, manager-ranking.tsx, cashflow-chart.tsx
  metric-card.tsx, skill-card.tsx, empty-state.tsx
  ui/                       # shadcn 风格基础组件
lib/
  mock/                     # 客户 / 经理 / 预警 / 走访 / 趋势 Mock 数据
  agent/                    # intent-router、mock-tools、skill-registry、types
  export/csv.ts             # 字段映射 + CSV 序列化
```

## 演示路径

1. 工作台输入：`梳理 高新区·锦园 中日均存款大于 10 万的客户` → 表格 + 导出按钮
2. 工作台输入：`分析 张明 的风险情况，并生成调查报告` → 360° 画像 + 报告
3. `/alerts` → 点击任一卡片 → Drawer 内 `生成联系话术` → 标记已完成
4. `/vertical-management` → `导入支行客户清单` → `AI 自动分配客户经理`
5. `/skills` → 任一技能卡片 `Demo 运行` → 查看 Timeline

所有客户姓名、身份证、手机号已脱敏，数据全部为本地 Mock，无外部依赖。
