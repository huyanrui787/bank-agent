import type { VisitRecord } from "./types"

export const visits: VisitRecord[] = [
  {
    id: "V001",
    customerId: "C001",
    visitedAt: "2026-04-28",
    manager: "李雪",
    channel: "上门",
    summary: "上门拜访客户，沟通孩子大学学费规划，客户提到下半年有 50 万资金落地。",
  },
  {
    id: "V002",
    customerId: "C001",
    visitedAt: "2026-03-12",
    manager: "李雪",
    channel: "电话",
    summary: "电话回访理财到期事宜，客户倾向延续 R2 稳健型产品。",
  },
  {
    id: "V003",
    customerId: "C001",
    visitedAt: "2026-01-20",
    manager: "李雪",
    channel: "微信",
    summary: "通过企业微信发送春节问候并预约面谈，客户回复年后再约。",
  },
]
