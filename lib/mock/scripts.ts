// 五级分类话术库：正常/关注/次级/可疑/损失 × 场景（营销/催收/续存/转介绍）
import type { Customer } from "./types"

export type ScriptScene = "营销" | "催收" | "续存" | "转介绍"
export type CustomerGrade = "正常" | "关注" | "次级" | "可疑" | "损失"

export type ScriptResult = {
  grade: CustomerGrade
  scene: ScriptScene
  channel: "电话" | "微信" | "上门"
  title: string
  content: string
  tips: string[]
}

function gradeFromCustomer(customer: Customer): CustomerGrade {
  if (customer.riskLevel === "high") return "次级"
  if (customer.hasOtherBankLoan && customer.mortgageLoan > 500_000) return "关注"
  if (customer.segment === "high_net_worth") return "正常"
  if (customer.segment === "stock") return "正常"
  if (customer.segment === "potential") return "关注"
  return "正常"
}

function sceneFromMessage(message: string): ScriptScene {
  if (message.includes("催收") || message.includes("逾期") || message.includes("还款")) return "催收"
  if (message.includes("续存") || message.includes("到期") || message.includes("续约")) return "续存"
  if (message.includes("转介绍") || message.includes("推荐") || message.includes("介绍")) return "转介绍"
  return "营销"
}

function channelFromMessage(message: string): "电话" | "微信" | "上门" {
  if (message.includes("微信")) return "微信"
  if (message.includes("上门") || message.includes("拜访")) return "上门"
  return "电话"
}

const scriptTemplates: Record<CustomerGrade, Record<ScriptScene, (c: Customer, channel: string) => ScriptResult>> = {
  正常: {
    营销: (c, ch) => ({
      grade: "正常",
      scene: "营销",
      channel: ch as ScriptResult["channel"],
      title: `${c.name} · 高净值营销话术`,
      content: `${c.name} 您好，我是丰年银行 ${c.managerName}。

近期我们推出了一款专为优质客户设计的专属理财方案，预期年化收益 3.45%，期限灵活，最低 10 万起购。

根据您的资产情况，您完全符合我们 VIP 客户的申购资格。这款产品目前额度有限，我想为您优先预留一份，方便您今天下午或明天上午抽 10 分钟了解一下吗？`,
      tips: [
        "强调专属性和稀缺性，提升客户重视程度",
        "避免直接报收益率，先引发兴趣再深入介绍",
        "预约具体时间，提高成交转化率",
      ],
    }),
    续存: (c, ch) => ({
      grade: "正常",
      scene: "续存",
      channel: ch as ScriptResult["channel"],
      title: `${c.name} · 存款到期续存话术`,
      content: `${c.name} 您好，我是丰年银行 ${c.managerName}。

您名下一笔定期存款即将到期，我们已经为您匹配了 3 款利率更优的接续方案，其中 3 年期定存利率可达 3.15%，比市场平均高出约 20BP。

如果您有意向续存，我可以直接为您办理，全程不超过 5 分钟。请问您方便今天到网点来一趟吗？`,
      tips: [
        "提前 7-10 天联系，给客户充足决策时间",
        "对比市场利率，突出我行优势",
        "强调便捷性，降低客户行动门槛",
      ],
    }),
    催收: (c, ch) => ({
      grade: "正常",
      scene: "催收",
      channel: ch as ScriptResult["channel"],
      title: `${c.name} · 正常类温馨提醒话术`,
      content: `${c.name} 您好，我是丰年银行 ${c.managerName}。

您有一笔贷款将于近期到期，按照我们的服务流程，提前为您做一次友情提醒。

如果您资金安排上有任何需要，我们也可以提前为您评估续贷方案，利率方面我们会给您最优惠的政策。请问您方便这两天回复我一下吗？`,
      tips: [
        "语气温和，以服务为主，避免催收感",
        "主动提供续贷方案，转化为营销机会",
      ],
    }),
    转介绍: (c, ch) => ({
      grade: "正常",
      scene: "转介绍",
      channel: ch as ScriptResult["channel"],
      title: `${c.name} · 转介绍话术`,
      content: `${c.name} 您好，感谢您一直以来对丰年银行的信任与支持！

我们近期推出了老客户推荐计划，您每成功推荐一位新客户开户，双方均可获得专属礼品和利率优惠。

您身边是否有朋友或合作伙伴有金融服务需求？我可以为他们提供一对一的专属服务，请您放心推荐。`,
      tips: [
        "先感谢客户，建立情感连接",
        "明确说明双方利益，降低推荐顾虑",
        "强调专属服务，让客户放心推荐",
      ],
    }),
  },
  关注: {
    营销: (c, ch) => ({
      grade: "关注",
      scene: "营销",
      channel: ch as ScriptResult["channel"],
      title: `${c.name} · 关注类关怀营销话术`,
      content: `${c.name} 您好，我是丰年银行 ${c.managerName}。

最近一段时间没有联系您了，想了解一下您近期的资金安排情况。我们注意到您的资产配置有一定调整空间，特别是在当前利率环境下，合理的资产配置可以帮您实现更好的收益。

我们有一款适合您当前情况的产品，方便我为您详细介绍一下吗？`,
      tips: [
        "以关怀为切入点，避免直接推销",
        "了解客户近期资金动向，判断需求",
        "根据客户反馈灵活调整话术方向",
      ],
    }),
    续存: (c, ch) => ({
      grade: "关注",
      scene: "续存",
      channel: ch as ScriptResult["channel"],
      title: `${c.name} · 关注类续存话术`,
      content: `${c.name} 您好，我是丰年银行 ${c.managerName}。

您的存款即将到期，我想提前和您沟通一下续存的事宜。考虑到您目前的资产情况，我建议您可以考虑分散配置，一部分续存定期，一部分配置短期理财，这样既保证流动性，又能提升整体收益。

您看这个方案是否符合您的需求？`,
      tips: [
        "提供组合方案，体现专业性",
        "关注客户流动性需求，不强推长期产品",
      ],
    }),
    催收: (c, ch) => ({
      grade: "关注",
      scene: "催收",
      channel: ch as ScriptResult["channel"],
      title: `${c.name} · 关注类还款提醒话术`,
      content: `${c.name} 您好，我是丰年银行 ${c.managerName}。

您有一笔贷款即将到期，请您注意安排还款资金。如果您近期资金周转有压力，请提前告知我，我们可以为您评估展期或调整还款计划的可能性。

请您务必在到期日前与我联系，避免产生不必要的逾期记录，影响您的征信。`,
      tips: [
        "明确提示征信影响，增加紧迫感",
        "主动提供解决方案，体现服务意识",
        "保持专业语气，不要过于强硬",
      ],
    }),
    转介绍: (c, ch) => ({
      grade: "关注",
      scene: "转介绍",
      channel: ch as ScriptResult["channel"],
      title: `${c.name} · 关注类转介绍话术`,
      content: `${c.name} 您好，感谢您对丰年银行的支持。

我们有一个老客户推荐计划，如果您身边有朋友需要贷款或理财服务，欢迎推荐给我，我会为他们提供最优质的服务和最优惠的政策。`,
      tips: ["简短直接，不占用客户太多时间"],
    }),
  },
  次级: {
    营销: (c, ch) => ({
      grade: "次级",
      scene: "营销",
      channel: ch as ScriptResult["channel"],
      title: `${c.name} · 次级类资产保全话术`,
      content: `${c.name} 您好，我是丰年银行 ${c.managerName}。

我想和您沟通一下您目前的贷款情况。根据我们的系统监测，您的资产负债情况需要我们共同关注。

我们希望能帮助您制定一个合理的还款计划，同时也可以探讨一些优化您资产结构的方案。请问您方便近期来网点面谈吗？`,
      tips: [
        "以帮助为出发点，避免对抗情绪",
        "强调共同解决问题，而非单方面施压",
        "尽量安排面谈，便于深入了解情况",
      ],
    }),
    续存: (c, ch) => ({
      grade: "次级",
      scene: "续存",
      channel: ch as ScriptResult["channel"],
      title: `${c.name} · 次级类存款保留话术`,
      content: `${c.name} 您好，我是丰年银行 ${c.managerName}。

您的存款即将到期，我建议您续存，这样可以保持您在我行的良好记录，对您后续的贷款申请也有帮助。

我们可以为您提供一定的利率优惠，请您考虑一下。`,
      tips: [
        "强调续存对征信记录的正面影响",
        "提供利率优惠作为激励",
      ],
    }),
    催收: (c, ch) => ({
      grade: "次级",
      scene: "催收",
      channel: ch as ScriptResult["channel"],
      title: `${c.name} · 次级类催收话术`,
      content: `${c.name} 您好，我是丰年银行 ${c.managerName}。

您名下有一笔贷款已经逾期，这会对您的个人征信产生严重影响，影响您未来的贷款、信用卡申请，甚至可能影响您的出行和消费。

请您务必在 3 个工作日内与我联系，我们可以一起商量解决方案。如果您确实有困难，我们也有相应的帮扶政策可以申请。`,
      tips: [
        "明确说明逾期后果，增加紧迫感",
        "提供帮扶政策出口，避免客户破罐破摔",
        "设定明确的联系期限",
      ],
    }),
    转介绍: (c, ch) => ({
      grade: "次级",
      scene: "转介绍",
      channel: ch as ScriptResult["channel"],
      title: `${c.name} · 次级类话术（暂不适合转介绍）`,
      content: `当前客户风险等级为次级，建议优先处理存量风险，暂不开展转介绍活动。\n\n请先通过催收或资产保全话术与客户沟通，待风险化解后再考虑转介绍。`,
      tips: ["次级客户不建议开展转介绍，避免风险扩散"],
    }),
  },
  可疑: {
    营销: (c, ch) => ({
      grade: "可疑",
      scene: "营销",
      channel: ch as ScriptResult["channel"],
      title: `${c.name} · 可疑类风险处置话术`,
      content: `${c.name} 您好，我是丰年银行 ${c.managerName}。

根据我们的风险监测系统，您的账户存在一些需要核实的情况。为了保护您的账户安全，我们需要您配合提供一些资料进行核实。

请您尽快与我联系，或直接到最近的网点办理，我们会全程协助您处理。`,
      tips: [
        "以账户安全为由，降低客户抵触情绪",
        "要求提供资料，为后续处置做准备",
        "记录所有沟通内容，留存证据",
      ],
    }),
    续存: (c, ch) => ({
      grade: "可疑",
      scene: "续存",
      channel: ch as ScriptResult["channel"],
      title: `${c.name} · 可疑类存款到期处理`,
      content: `${c.name} 您好，您的存款即将到期。请您到网点办理，届时请携带有效身份证件。`,
      tips: ["可疑类客户存款到期，建议要求到网点办理，便于核实身份"],
    }),
    催收: (c, ch) => ({
      grade: "可疑",
      scene: "催收",
      channel: ch as ScriptResult["channel"],
      title: `${c.name} · 可疑类催收话术`,
      content: `${c.name} 您好，我是丰年银行 ${c.managerName}。

您名下贷款已严重逾期，我行已启动法律追偿程序。如您希望通过协商方式解决，请在 5 个工作日内主动联系我行，届时我们可以探讨分期还款等方案。

如逾期未联系，我行将依法向法院申请强制执行，并向征信机构报送不良记录。`,
      tips: [
        "明确告知法律后果，增加压力",
        "保留协商空间，给客户出路",
        "所有沟通需录音或留存书面记录",
      ],
    }),
    转介绍: (c, ch) => ({
      grade: "可疑",
      scene: "转介绍",
      channel: ch as ScriptResult["channel"],
      title: `${c.name} · 可疑类（不适合转介绍）`,
      content: `当前客户风险等级为可疑，严禁开展转介绍活动，避免风险传导。`,
      tips: ["可疑类客户严禁转介绍"],
    }),
  },
  损失: {
    营销: (c, ch) => ({
      grade: "损失",
      scene: "营销",
      channel: ch as ScriptResult["channel"],
      title: `${c.name} · 损失类（仅限催收）`,
      content: `损失类客户已进入法律追偿阶段，不适合开展营销活动。请联系法务部门处理。`,
      tips: ["损失类客户由法务部门接管，客户经理不再直接联系"],
    }),
    续存: (c, ch) => ({
      grade: "损失",
      scene: "续存",
      channel: ch as ScriptResult["channel"],
      title: `${c.name} · 损失类存款处理`,
      content: `损失类客户存款到期，需配合法务部门进行资产保全操作，请勿单独联系客户。`,
      tips: ["配合法务部门操作，不单独联系"],
    }),
    催收: (c, ch) => ({
      grade: "损失",
      scene: "催收",
      channel: ch as ScriptResult["channel"],
      title: `${c.name} · 损失类法律催收话术`,
      content: `${c.name} 您好，我是丰年银行法务部门。

您名下贷款已被认定为损失类资产，我行已向法院提起诉讼。如您希望在判决前达成和解，请在收到本通知后 10 个工作日内联系我行法务部门。

联系电话：400-XXX-XXXX（工作日 9:00-17:00）`,
      tips: [
        "由法务部门出面，提升权威性",
        "提供和解渠道，争取回收",
        "所有沟通必须留存书面记录",
      ],
    }),
    转介绍: (c, ch) => ({
      grade: "损失",
      scene: "转介绍",
      channel: ch as ScriptResult["channel"],
      title: `${c.name} · 损失类（严禁转介绍）`,
      content: `损失类客户严禁开展任何营销活动，包括转介绍。`,
      tips: ["损失类客户严禁任何营销活动"],
    }),
  },
}

export function generateScript(customer: Customer, message: string): ScriptResult {
  const grade = gradeFromCustomer(customer)
  const scene = sceneFromMessage(message)
  const channel = channelFromMessage(message)
  return scriptTemplates[grade][scene](customer, channel)
}
