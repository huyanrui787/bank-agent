# AI 客户经营助手 Demo — Agent Code 执行说明

> 目标：基于《AI功能需求清单》做一个可演示的前端 Demo。  
> 数据全部使用 mock，不接真实银行/客户系统。  
> 技术栈：Next.js + TypeScript + shadcn/ui + Tailwind + impeccable.style skill。  
> Agent 目标：优先复用靠谱开源方案，做出「能点、能搜、能导出、能展示 AI 工作流」的客户演示版。

---

## 0. Demo 一句话定位

做一个面向银行/支行/客户经理的 **AI 客户经营助手**：

用户可以通过自然语言或筛选条件，让系统自动完成客户清单梳理、客户经理垂直管理、业务预警、查询分析和 agentic 技能调用，并以表格、看板、图表、导出文件、任务流的形式展示结果。

---

## 1. 需求来源整理

原始需求按 5 类组织：

| 模块 | 目标 |
|---|---|
| 客群梳理 | 按存款、贷款、合同、授信、征信、无贷有贷等规则自动筛客户清单 |
| 垂直管理 | 统计客户经理新增客户、存贷增长、续效维护、支行导入名单自动分配 |
| 业务预警 | 针对存款到期、贷款到期、融资金额大幅变动、网格/村居/企业变动进行提醒 |
| 查询分析 | 输入客户身份信息或关键词，查询客户风险、资金需求、授信、准入、上下游流水 |
| agentic能力 | 用户用自然语言调用内置技能，系统自动选择工具、执行、展示、导出 |

---

## 2. 推荐开源方案选型

### 2.1 前端基础

使用：

- **Next.js App Router**
- **TypeScript**
- **Tailwind CSS**
- **shadcn/ui**
- **impeccable.style skill**
- **lucide-react**
- **TanStack Table**
- **Recharts**
- **Zod**
- **date-fns**
- **sonner**

原因：

- shadcn/ui 适合做企业后台、CRM、数据看板。
- TanStack Table 适合做复杂客户清单：筛选、排序、分页、列显隐、行选择。
- Recharts 适合快速做业务趋势图、客户经理排名图、预警分布图。
- Zod 用于 mock API 入参校验，后续替换真实 API 时结构更稳定。
- impeccable.style skill 用于提升视觉完成度，避免 AI 生成默认粗糙界面。

### 2.2 Agent / AI 方案

Demo 阶段建议采用两层结构：

#### MVP 方案：前端内置 Mock Agent

先不接真实 LLM，只做 deterministic mock agent。

实现方式：

```txt
用户输入自然语言
  ↓
intentRouter.ts 规则识别意图
  ↓
调用 mock tools
  ↓
返回结构化结果
  ↓
渲染表格 / 图表 / 预警 / 导出
```

优点：

- 可控、稳定、适合演示。
- 不依赖 API Key。
- 不会因为模型输出不稳定影响客户演示。

#### 可扩展方案：CopilotKit + LangGraph

后续接真实模型时推荐：

- 前端：CopilotKit，用于嵌入式 AI 助手、工具调用展示、Human-in-the-loop。
- 后端：LangGraph，用于客户筛选、风险检查、导出、任务派发等多步骤 agent workflow。
- 工具协议：每个业务能力实现为一个 tool，例如 `filterCustomers`、`generateRiskReport`、`exportCustomerList`。

Demo 里先保留接口形态，暂不强依赖真实 CopilotKit / LangGraph。

---

## 3. 目标演示页面

### 3.1 页面一：AI 工作台 Dashboard

路径：

```txt
/app/page.tsx
```

展示内容：

1. 顶部：产品名称、演示环境标识、当前机构/支行选择器。
2. 4 张核心指标卡：
   - 今日筛选客户数
   - 本月新增存款客户
   - 当前业务预警数
   - AI 已执行任务数
3. 中间区域：
   - 左侧：自然语言 AI 输入框
   - 右侧：AI 执行步骤 Timeline
4. 下方：
   - 业务预警列表
   - 存贷趋势图
   - 客户经理贡献排行

示例自然语言：

```txt
请帮我梳理 XX 小区中我行日均存款大于 10 万元的客户清单，并导出 Excel。
```

预期交互：

- 用户点击「执行」
- Timeline 显示：
  1. 识别需求：客群梳理
  2. 匹配字段：小区、日均存款、联系方式
  3. 查询 mock 客户数据
  4. 生成客户清单
  5. 准备导出文件
- 右侧/下方展示结果表格
- 出现「导出 Excel」按钮

---

### 3.2 页面二：客群梳理

路径：

```txt
/app/customer-segments/page.tsx
```

功能：

- 预置筛选模板
- 自定义筛选器
- 结果表格
- 导出按钮

预置模板：

| 模板名 | 筛选逻辑 |
|---|---|
| 高日均存款客户 | 小区/网格 + 日均存款 > 指定金额 |
| 低贷高信客户 | 抵押贷款 > 指定金额 且 信用贷款 < 指定金额 |
| 有合同未用信客户 | 有效合同 = 是 且 当前用信 = 0 |
| 征信更新客户 | 近一年征信更新时间不为空 |
| 无贷有贷客户 | 本行无贷，但他行有贷 |

表格字段：

```ts
type Customer = {
  id: string
  name: string
  idNoMasked: string
  phoneMasked: string
  address: string
  community: string
  grid: string
  managerName: string
  avgDeposit: number
  mortgageLoan: number
  creditLoan: number
  hasValidContract: boolean
  usedCreditAmount: number
  creditReportUpdatedAt?: string
  hasOtherBankLoan: boolean
  riskLevel: "low" | "medium" | "high"
}
```

---

### 3.3 页面三：垂直管理

路径：

```txt
/app/vertical-management/page.tsx
```

功能：

1. 客户经理本年新引入客户清单
2. Excel 导入客户名单 mock
3. 自动分配客户经理
4. 本月新增存贷客户统计
5. 较上月增减情况

演示交互：

- 点击「导入支行客户清单」
- 使用 mock 文件名：`支行客户名单_2026_06.xlsx`
- 系统自动显示：
  - 总客户数
  - 可分配客户数
  - 已匹配客户经理数
  - 待人工确认客户数
- 点击「自动分配」
- 展示分配结果表

客户经理字段：

```ts
type Manager = {
  id: string
  name: string
  branch: string
  grid: string
  currentCustomerCount: number
  monthlyDepositIncrease: number
  monthlyLoanIncrease: number
  maintenanceScore: number
}
```

---

### 3.4 页面四：业务预警

路径：

```txt
/app/alerts/page.tsx
```

预警类型：

| 类型 | 说明 |
|---|---|
| 存款到期 | 提前半个月提醒客户经理对接 |
| 贷款到期 | 提前半个月提醒客户经理对接 |
| 融资额增长 | 融资余额较上月增长超过阈值 |
| 融资额大幅上浮 | 融资金额增加 30 万以上 |
| 新楼盘 | 辖内新增楼盘提醒 |
| 网格变动 | 村居、小区、企业发生变化 |
| 支行异常 | 存贷款数据较上月变化较大 |

预警卡片字段：

```ts
type BusinessAlert = {
  id: string
  type: "deposit_due" | "loan_due" | "financing_growth" | "new_property" | "grid_change" | "branch_abnormal"
  title: string
  severity: "info" | "warning" | "critical"
  customerName?: string
  managerName?: string
  amount?: number
  dueDate?: string
  description: string
  suggestedAction: string
  createdAt: string
  status: "pending" | "processing" | "done"
}
```

交互：

- 支持按预警类型、等级、客户经理筛选
- 支持将预警状态改为「处理中 / 已完成」
- 点击某条预警进入详情 Drawer
- Drawer 中展示：
  - 客户信息
  - 触发原因
  - AI 建议话术
  - 推荐下一步动作

---

### 3.5 页面五：查询分析

路径：

```txt
/app/analysis/page.tsx
```

核心交互：

用户输入客户身份证号、姓名、手机号或关键词，系统返回客户画像。

搜索框示例：

```txt
搜索：张三 / 6101********1234 / 高新区 XX 小区
```

结果区域：

1. 客户基本信息
2. 所在网格、小区、是否扩中
3. 最近一次走访记录
4. 存款产品推荐
5. 贷款产品推荐
6. 风险预警
7. 准入判断
8. 客户上下游流水分析
9. 自动生成调查报告

客户画像 mock 类型：

```ts
type CustomerProfile = {
  customer: Customer
  visitRecords: VisitRecord[]
  depositRecommendation: ProductRecommendation[]
  loanRecommendation: ProductRecommendation[]
  riskSignals: RiskSignal[]
  admissionResult: AdmissionResult
  cashflowAnalysis: CashflowAnalysis
  generatedReport: string
}
```

---

### 3.6 页面六：Skill Center / Agentic 能力

路径：

```txt
/app/skills/page.tsx
```

目标：

展示系统内置技能，让客户理解“不是一个聊天框，而是可执行任务的 agent”。

内置技能：

| Skill | 输入 | 输出 |
|---|---|---|
| 客户清单生成 | 筛选条件 | Excel / 表格 |
| 预警扫描 | 时间范围、机构 | 预警列表 |
| 风险解读 | 客户 ID | 风险解释 + 文件来源 |
| 调查报告生成 | 客户 ID | Markdown 报告 |
| 客户经理自动分配 | 客户名单 | 分配结果 |
| 营销话术生成 | 客户画像 | 个性化话术 |
| 数据导出 | 表格结果 | CSV / Excel |

技能卡片包含：

- skill 名称
- 描述
- 输入参数
- 输出类型
- 是否可执行
- Demo 按钮

---

## 4. 信息架构和目录结构

请按以下目录生成项目：

```txt
ai-customer-demo/
  app/
    layout.tsx
    page.tsx
    globals.css
    customer-segments/
      page.tsx
    vertical-management/
      page.tsx
    alerts/
      page.tsx
    analysis/
      page.tsx
    skills/
      page.tsx
    api/
      mock-agent/
        route.ts
      export/
        route.ts
  components/
    app-sidebar.tsx
    app-header.tsx
    ai-command-box.tsx
    ai-execution-timeline.tsx
    metric-card.tsx
    customer-table.tsx
    alert-card.tsx
    alert-detail-drawer.tsx
    manager-ranking.tsx
    deposit-loan-chart.tsx
    skill-card.tsx
    empty-state.tsx
  components/ui/
    # shadcn generated components
  lib/
    mock/
      customers.ts
      managers.ts
      alerts.ts
      products.ts
      visits.ts
    agent/
      intent-router.ts
      mock-tools.ts
      skill-registry.ts
      types.ts
    export/
      csv.ts
    utils.ts
  public/
    demo-logo.svg
  README.md
```

---

## 5. UI 设计要求

### 5.1 总体风格

使用 impeccable.style skill，目标视觉：

- 银行企业级后台
- 干净、可信、专业
- 不要科技蓝大渐变堆满
- 不要过度玻璃拟态
- 页面留白充分
- 卡片边框轻、阴影轻
- 重点数据使用大号数字
- 预警等级用 badge 表示
- AI 执行过程用 timeline / stepper 展示

### 5.2 布局

采用：

- 左侧 Sidebar
- 顶部 Header
- 主内容区 max-width full
- 页面分区使用 Card
- 表格区域需要支持横向滚动
- 移动端不作为重点，但不能完全崩

Sidebar 菜单：

```txt
AI工作台
客群梳理
垂直管理
业务预警
查询分析
Skill Center
```

### 5.3 shadcn 组件清单

安装：

```bash
pnpm dlx shadcn@latest init
pnpm dlx shadcn@latest add button card badge table input textarea select tabs dialog drawer sheet dropdown-menu command popover calendar separator scroll-area skeleton sonner tooltip progress checkbox
```

额外依赖：

```bash
pnpm add @tanstack/react-table recharts lucide-react zod date-fns clsx tailwind-merge
```

如需要导出 xlsx：

```bash
pnpm add xlsx
```

但 MVP 可先用 CSV 导出。

---

## 6. Mock 数据要求

### 6.1 客户数据

至少生成 80 条 mock 客户。

要求：

- 姓名使用中文名
- 身份证号、手机号必须脱敏展示
- 小区/网格/支行/客户经理要有重复分布，方便筛选
- 存款金额、贷款金额要有明显差异
- 需要覆盖高净值、存量、他行有贷、合同未用信等场景

示例：

```ts
export const customers: Customer[] = [
  {
    id: "C001",
    name: "张明",
    idNoMasked: "6101********1234",
    phoneMasked: "138****5678",
    address: "XX小区 3号楼 1201",
    community: "XX小区",
    grid: "高新一网格",
    managerName: "李经理",
    avgDeposit: 285000,
    mortgageLoan: 1200000,
    creditLoan: 50000,
    hasValidContract: true,
    usedCreditAmount: 0,
    creditReportUpdatedAt: "2026-04-12",
    hasOtherBankLoan: true,
    riskLevel: "medium",
  }
]
```

### 6.2 预警数据

至少生成 30 条预警。

要求：

- 不同类型都要覆盖
- critical 至少 5 条
- 每条都要有 suggestedAction

### 6.3 图表数据

生成：

- 近 6 个月存款余额
- 近 6 个月贷款余额
- 客户经理新增客户 Top 10
- 预警类型分布
- 网格客户数量分布

---

## 7. Mock Agent 设计

### 7.1 Intent 类型

```ts
export type Intent =
  | "customer_segment"
  | "vertical_management"
  | "business_alert"
  | "customer_analysis"
  | "generate_report"
  | "export_data"
  | "unknown"
```

### 7.2 Intent Router

文件：

```txt
/lib/agent/intent-router.ts
```

规则示例：

```ts
export function detectIntent(input: string): Intent {
  if (input.includes("客户清单") || input.includes("梳理") || input.includes("日均存款")) {
    return "customer_segment"
  }

  if (input.includes("客户经理") || input.includes("分配") || input.includes("新增存贷")) {
    return "vertical_management"
  }

  if (input.includes("预警") || input.includes("到期") || input.includes("融资")) {
    return "business_alert"
  }

  if (input.includes("查询") || input.includes("分析") || input.includes("风险")) {
    return "customer_analysis"
  }

  if (input.includes("报告") || input.includes("调查")) {
    return "generate_report"
  }

  if (input.includes("导出") || input.toLowerCase().includes("excel")) {
    return "export_data"
  }

  return "unknown"
}
```

### 7.3 Tool Registry

文件：

```txt
/lib/agent/skill-registry.ts
```

每个工具定义：

```ts
type SkillDefinition = {
  id: string
  name: string
  description: string
  inputSchemaDescription: string
  outputType: "table" | "chart" | "report" | "alert" | "file"
  enabled: boolean
}
```

工具列表：

```ts
filterCustomers
assignManagers
scanBusinessAlerts
analyzeCustomerRisk
generateInvestigationReport
generateMarketingScript
exportTable
```

### 7.4 Mock Agent 返回格式

```ts
export type AgentStep = {
  id: string
  title: string
  description: string
  status: "pending" | "running" | "done" | "error"
}

export type AgentResponse = {
  intent: Intent
  summary: string
  steps: AgentStep[]
  resultType: "table" | "chart" | "report" | "alert" | "file" | "empty"
  data: unknown
  suggestedNextActions: string[]
}
```

---

## 8. API 设计

### 8.1 POST /api/mock-agent

入参：

```ts
{
  "message": "请帮我梳理XX小区日均存款大于10万元的客户清单"
}
```

出参：

```ts
{
  "intent": "customer_segment",
  "summary": "已为你筛选出 XX 小区日均存款大于 10 万元的客户 12 位。",
  "steps": [
    { "id": "1", "title": "识别需求", "description": "识别为客群梳理任务", "status": "done" },
    { "id": "2", "title": "匹配字段", "description": "匹配 community=XX小区, avgDeposit>100000", "status": "done" },
    { "id": "3", "title": "生成清单", "description": "生成客户经理可跟进清单", "status": "done" }
  ],
  "resultType": "table",
  "data": [],
  "suggestedNextActions": [
    "导出 Excel",
    "生成营销话术",
    "按客户经理拆分"
  ]
}
```

### 8.2 GET /api/export

MVP 直接导出 CSV。

参数：

```txt
?type=customers
```

返回：

```txt
text/csv
```

---

## 9. 关键页面交互细节

### 9.1 AI Command Box

组件：

```txt
/components/ai-command-box.tsx
```

要求：

- Textarea 输入
- 下方展示 4 个快捷 prompt chips：
  - 梳理高日均存款客户
  - 扫描本月业务预警
  - 分析张明的风险情况
  - 生成客户经理分配方案
- 点击 chip 自动填入输入框
- 点击执行时调用 `/api/mock-agent`
- loading 时按钮显示「执行中...」

### 9.2 AI Execution Timeline

组件：

```txt
/components/ai-execution-timeline.tsx
```

要求：

- 每个 step 显示 icon
- done 显示 check
- running 显示 spinner
- error 显示 warning
- 支持空状态

### 9.3 Customer Table

组件：

```txt
/components/customer-table.tsx
```

要求：

- 使用 TanStack Table
- 支持：
  - 关键词搜索
  - 风险等级筛选
  - 客户经理筛选
  - 列排序
  - 分页
  - 选中行
- 金额格式化成人民币
- 身份证号和手机号默认脱敏

### 9.4 Alert Detail Drawer

组件：

```txt
/components/alert-detail-drawer.tsx
```

要求：

- 展示预警详情
- 展示 AI 推荐动作
- 有按钮：
  - 标记处理中
  - 标记已完成
  - 生成联系话术
  - 指派客户经理

---

## 10. 演示脚本

### 场景一：客户清单自动梳理

用户输入：

```txt
请梳理 XX 小区中我行日均存款大于 10 万元的客户清单。
```

系统展示：

- AI 执行步骤
- 客户清单表格
- 客户数量
- 客户经理分布
- 导出按钮

讲解话术：

```txt
以前客户经理需要从多个系统里查字段、拼 Excel，现在只要输入自然语言，
系统自动识别筛选条件，并输出可执行客户清单。
```

---

### 场景二：客户经理垂直管理

用户输入：

```txt
请统计各客户经理本月新增存款客户，并对比上月变化。
```

系统展示：

- 客户经理排名
- 存款新增金额
- 较上月变化
- 待维护客户

讲解话术：

```txt
支行层面可以直接看到每位客户经理的新增贡献和维护情况，
用于过程管理和绩效跟踪。
```

---

### 场景三：业务预警

用户输入：

```txt
请扫描未来半个月存款到期和贷款到期客户。
```

系统展示：

- 存款到期客户
- 贷款到期客户
- 到期金额
- 客户经理
- AI 建议动作

讲解话术：

```txt
系统主动把需要跟进的客户推给客户经理，
避免错过存款续存和贷款续作窗口。
```

---

### 场景四：客户风险查询

用户输入：

```txt
分析一下张明这个客户的风险情况，并生成调查报告。
```

系统展示：

- 客户画像
- 风险信号
- 准入判断
- 上下游资金流
- Markdown 调查报告

讲解话术：

```txt
客户经理不需要手动查多张表，系统会把客户基础信息、征信、流水、
准入规则和风险解释汇总成一份可复核的调查报告。
```

---

## 11. 开发步骤

### Step 1：初始化项目

```bash
pnpm create next-app ai-customer-demo --ts --tailwind --eslint --app
cd ai-customer-demo
pnpm dlx shadcn@latest init
```

### Step 2：安装组件和依赖

```bash
pnpm dlx shadcn@latest add button card badge table input textarea select tabs dialog drawer sheet dropdown-menu command popover calendar separator scroll-area skeleton sonner tooltip progress checkbox
pnpm add @tanstack/react-table recharts lucide-react zod date-fns clsx tailwind-merge
```

### Step 3：接入 impeccable.style skill

要求：

1. 打开 https://impeccable.style/#downloads
2. 下载或复制适用于当前 agent 的 skill
3. 将 skill 放到 agent 可读取的位置
4. 在实现 UI 前先阅读 skill 规则
5. 所有页面生成后，用 skill 做一次视觉审查和重构

Agent 执行提示：

```txt
Before implementing the UI, read and apply the impeccable.style skill.
Use it to improve spacing, hierarchy, typography, visual balance, and component composition.
Avoid generic AI dashboard visuals.
```

### Step 4：生成 mock 数据

先实现：

```txt
/lib/mock/customers.ts
/lib/mock/managers.ts
/lib/mock/alerts.ts
/lib/mock/products.ts
/lib/mock/visits.ts
```

### Step 5：实现基础布局

先做：

```txt
components/app-sidebar.tsx
components/app-header.tsx
app/layout.tsx
```

### Step 6：实现 Dashboard

完成：

```txt
app/page.tsx
components/metric-card.tsx
components/ai-command-box.tsx
components/ai-execution-timeline.tsx
components/deposit-loan-chart.tsx
components/manager-ranking.tsx
```

### Step 7：实现各业务页面

依次实现：

```txt
customer-segments
vertical-management
alerts
analysis
skills
```

### Step 8：实现 mock-agent API

完成：

```txt
app/api/mock-agent/route.ts
lib/agent/intent-router.ts
lib/agent/mock-tools.ts
lib/agent/skill-registry.ts
```

### Step 9：实现导出

MVP 使用 CSV：

```txt
app/api/export/route.ts
lib/export/csv.ts
```

### Step 10：全局 polish

检查：

- 页面是否有空状态
- loading 是否自然
- mock agent 是否稳定返回
- 表格金额格式是否正确
- 导出是否可用
- 中文字体是否自然
- 演示路径是否顺畅

---

## 12. 验收标准

### 12.1 必须完成

- [ ] 6 个页面可访问
- [ ] 左侧菜单可跳转
- [ ] Dashboard 有 AI 输入框
- [ ] 输入自然语言后能展示 AI 执行步骤
- [ ] 客群梳理能展示客户表格
- [ ] 业务预警能展示预警列表和详情
- [ ] 查询分析能展示客户画像
- [ ] Skill Center 能展示技能卡片
- [ ] 至少一个导出 CSV 功能可用
- [ ] 所有数据均为 mock

### 12.2 演示加分项

- [ ] AI 执行过程有逐步动画
- [ ] 表格支持筛选、排序、分页
- [ ] 图表展示存贷趋势
- [ ] 预警 Drawer 有 AI 建议话术
- [ ] 调查报告支持复制
- [ ] UI 经 impeccable.style skill 优化

---

## 13. 给 Coding Agent 的总提示词

可以直接复制给 Claude Code / Cursor / Codex：

```txt
你是一个资深全栈工程师和产品型前端设计师。

请根据当前 markdown 需求，生成一个 AI 客户经营助手 Demo。

技术要求：
- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- impeccable.style skill
- TanStack Table
- Recharts
- lucide-react
- mock data only

业务目标：
- 面向银行客户经理/支行管理者
- 演示 AI 如何自动完成客户清单梳理、垂直管理、业务预警、查询分析和技能调用
- 不接真实后端，不接真实银行数据
- 所有客户信息必须脱敏
- 交互必须稳定，适合现场演示

实现要求：
1. 先初始化项目和 shadcn/ui。
2. 读取并应用 impeccable.style skill。
3. 按本文目录结构生成代码。
4. 先生成 mock 数据，再实现页面。
5. 实现 /api/mock-agent，让自然语言输入可以触发 mock agent response。
6. 实现 /api/export，至少支持客户清单 CSV 导出。
7. UI 要专业、可信、像企业级银行经营后台。
8. 不要只做静态页面，至少要有 3 个可交互场景：
   - 自然语言生成客户清单
   - 预警详情 Drawer
   - 查询客户画像并生成报告
9. 代码要可运行，避免伪代码。
10. 完成后输出启动命令和主要文件说明。

请从创建项目开始执行。
```

---

## 14. README 展示文案

项目 README 可以写：

```md
# AI 客户经营助手 Demo

这是一个面向银行客户经理和支行管理人员的 AI 经营助手演示系统。

## 功能

- AI 自然语言生成客户清单
- 客户经理垂直管理
- 存款/贷款到期预警
- 融资金额异常预警
- 客户风险画像查询
- 调查报告生成
- 技能中心
- CSV 导出

## 技术栈

- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui
- TanStack Table
- Recharts
- Mock Agent

## 启动

pnpm install
pnpm dev
```

---

## 15. 后续接真实系统的接口预留

Demo 之后，如果要产品化，可以逐步替换：

| Demo 模块 | 真实系统 |
|---|---|
| mock customers | CRM / 核心客户系统 |
| mock loans | 信贷系统 |
| mock deposits | 存款/账户系统 |
| mock alerts | 规则引擎 / 数据仓库 |
| mock agent | LLM + LangGraph |
| CSV export | Excel / 权限控制 / 审计日志 |
| 本地状态 | 数据库 + 用户权限 |

产品化必须补充：

- 权限控制
- 数据脱敏
- 审计日志
- 字段血缘
- 文件来源引用
- 人工确认机制
- 合规模型输出限制
- 敏感信息访问审批
