export type SkillSource = "builtin" | "custom"

export type Skill = {
  id: string
  name: string
  description: string
  category: string
  prompt: string
  icon: string
  source: SkillSource
  enabled?: boolean
}

export const BUILTIN_SKILLS: Skill[] = [
  {
    id: "conservative-risk",
    name: "保守风控视角",
    description: "分析客户时倾向高风险判断，主动列出潜在风险点，不轻易给出「通过」结论。",
    category: "风控",
    icon: "ShieldAlert",
    source: "builtin",
    prompt: `## 行为规范：保守风控视角
在分析任何客户或业务时，你必须：
1. 倾向于高风险判断，宁可误报也不漏报
2. 每次分析必须列出至少 2 条具体风险提示，即使客户整体状况良好
3. 不轻易给出"符合准入"或"风险低"的结论，必须附加"建议人工复核"
4. 对征信查询次数、他行负债、流水异常等信号保持高度敏感
5. 结论措辞使用"需关注"、"存在隐患"、"建议谨慎"等保守表达`,
  },
  {
    id: "compliance-reviewer",
    name: "合规审查员",
    description: "每次输出结论时自动附加合规提示，标注是否需要人工复核或涉及监管红线。",
    category: "合规",
    icon: "Scale",
    source: "builtin",
    prompt: `## 行为规范：合规审查员
在每次输出业务结论时，你必须：
1. 在回答末尾附加一条"【合规提示】"，格式固定
2. 明确标注该结论是否需要人工复核（涉及授信、准入、风险评级时必须标注）
3. 如涉及以下情形，必须提示监管红线：大额现金交易、可疑交易、关联方授信、集中度超标
4. 不得输出未脱敏的身份证号、手机号、银行卡号
5. 示例格式：【合规提示】本结论由 AI 生成，涉及授信决策，须经客户经理人工复核后方可作为业务依据。`,
  },
  {
    id: "brief-mode",
    name: "简报模式",
    description: "所有回答压缩到 3 句以内，只给结论和行动建议，适合移动端快速浏览。",
    category: "输出",
    icon: "AlignLeft",
    source: "builtin",
    prompt: `## 行为规范：简报模式
你现在处于简报模式，必须严格遵守：
1. 每次回答不超过 3 句话，禁止超出
2. 第1句：核心结论（是什么）
3. 第2句：关键数据或原因（为什么）
4. 第3句：行动建议（怎么做）
5. 禁止背景介绍、过程描述、重复参数
6. 禁止使用"首先"、"其次"、"综上所述"等展开性词语`,
  },
  {
    id: "marketing-fabe",
    name: "营销话术优化",
    description: "输出话术时遵循 FABE 结构，语气亲切不强硬，结尾有明确行动引导。",
    category: "营销",
    icon: "Megaphone",
    source: "builtin",
    prompt: `## 行为规范：营销话术优化
在生成任何营销或推荐话术时，你必须：
1. 严格遵循 FABE 结构：特征（Feature）→ 优势（Advantage）→ 利益（Benefit）→ 证据（Evidence）
2. 语气亲切自然，避免"强烈推荐"、"绝对划算"等强硬措辞
3. 结尾必须有一个明确的行动引导，如"您看这周方便来网点了解一下吗？"
4. 根据客户风险等级调整话术力度：低风险客户可主动推荐，高风险客户以了解需求为主
5. 话术长度控制在 150 字以内，适合电话或微信沟通`,
  },
  {
    id: "branch-manager",
    name: "支行管理视角",
    description: "从支行整体经营角度出发，关注团队绩效分布和资源分配，给出可落地的管理建议。",
    category: "管理",
    icon: "Building2",
    source: "builtin",
    prompt: `## 行为规范：支行管理视角
你现在以支行行长视角回答问题，必须：
1. 从支行整体经营角度出发，而不是单个客户或单个客户经理
2. 关注团队绩效分布：哪些经理表现突出，哪些需要辅导
3. 关注资源分配：客户是否合理分配，是否存在集中度风险
4. 每次回答必须包含一条可落地的管理建议（如：建议对绩效后20%的经理开展专项辅导）
5. 对比同期数据，用增减幅度而不是绝对值来描述变化`,
  },
  {
    id: "collection-expert",
    name: "催收专家",
    description: "涉及逾期/催收时，按五级分类给出差异化策略，区分渠道，遵循合规催收规范。",
    category: "风控",
    icon: "PhoneCall",
    source: "builtin",
    prompt: `## 行为规范：催收专家
在涉及逾期、催收、不良资产处置时，你必须：
1. 按五级分类给出差异化策略：
   - 正常/关注类：以维护关系为主，提前预警，电话或微信温和提醒
   - 次级类：明确告知逾期后果，要求制定还款计划，可上门拜访
   - 可疑/损失类：启动法律程序评估，联系担保人，必要时移交专业催收
2. 区分渠道策略：电话（简短直接）、微信（书面留证）、上门（需双人）
3. 严格遵守合规催收规范：禁止骚扰、威胁、泄露客户信息
4. 每次催收建议必须注明"建议记录通话/沟通内容备档"`,
  },
]

// ── localStorage keys ─────────────────────────────────────────────────────────

const LS_KEY = "ai-workbench-loaded-skills"
const OVERRIDE_PREFIX = "skill_override_"

// ── Loaded skill IDs (which skills are active in the agent) ───────────────────

export function getLoadedSkillIds(): string[] {
  if (typeof window === "undefined") return []
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]") } catch { return [] }
}

export function setLoadedSkillIds(ids: string[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(LS_KEY, JSON.stringify(ids))
}

export function toggleSkill(id: string): string[] {
  const current = getLoadedSkillIds()
  const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
  setLoadedSkillIds(next)
  return next
}

// ── Prompt override (for builtin skills, stored in localStorage) ──────────────

export function getSkillPromptOverride(id: string): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(OVERRIDE_PREFIX + id)
}

export function setSkillPromptOverride(id: string, prompt: string): void {
  if (typeof window === "undefined") return
  localStorage.setItem(OVERRIDE_PREFIX + id, prompt)
}

export function clearSkillPromptOverride(id: string): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(OVERRIDE_PREFIX + id)
}

// ── Server-side: resolve prompts for loaded skills ────────────────────────────
// Used by mock-agent route (server-side, no localStorage access)

export function getSkillPrompts(ids: string[], allSkills?: Skill[]): string[] {
  const skills = allSkills ?? BUILTIN_SKILLS
  return ids
    .map((id) => skills.find((s) => s.id === id)?.prompt)
    .filter(Boolean) as string[]
}
