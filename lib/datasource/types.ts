import type {
  Customer,
  Manager,
  BusinessAlert,
  VisitRecord,
  ProductRecommendation,
} from "@/lib/mock/types"
import type { DataScope } from "@/lib/auth/scope"

/** 客群筛选条件（对应 filterCustomers 工具入参） */
export type CustomerFilter = {
  community?: string
  minAvgDeposit?: number
  hasOtherBankLoan?: boolean
  hasValidContract?: boolean
  unusedCredit?: boolean
}

/** 预警筛选条件（对应 scanAlerts 工具入参） */
export type AlertFilter = {
  severity?: "info" | "warning" | "critical"
  types?: string[]
  status?: "pending" | "processing" | "done"
}

/**
 * 业务数据源连接器接口。
 * 业务查询（客群 / 经理 / 预警 / 画像定位）统一走此接口，
 * 字段转译由具体实现（SqliteConnector / 后续 RemoteConnector）通过映射完成。
 * role 仅用于 Customer 的合规脱敏（compliance / readonly 角色）。
 */
export interface BusinessDataSource {
  filterCustomers(f: CustomerFilter, scope: DataScope, role?: string, limit?: number): Customer[]
  getManagers(scope: DataScope): Manager[]
  scanAlerts(f: AlertFilter, scope: DataScope, limit?: number): BusinessAlert[]
  getCustomer(query: string, scope: DataScope, role?: string): Customer | undefined
  getAlert(id: string, scope: DataScope): BusinessAlert | undefined
  getVisits(customerId?: string): VisitRecord[]
  getProducts(): ProductRecommendation[]
}
