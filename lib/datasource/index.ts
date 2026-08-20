/**
 * 数据源连接器入口。
 * - 不传 datasourceId：返回默认连接器（bank.db + 恒等映射）。
 * - 传 datasourceId：读 data_sources 表，若为 SQLite 文件数据源则按其 extra_config.columnMapping
 *   覆盖映射后连接（「换映射 = 换数据源」的最小闭环）；MySQL/Oracle 等走 RemoteConnector（Phase 2）。
 */
import path from "path"
import Database from "better-sqlite3"
import { getDb } from "@/lib/db"
import { DEFAULT_MAPPING, mergeMapping } from "./mapping"
import { SqliteConnector } from "./sqlite"
import type { BusinessDataSource } from "./types"

let _default: SqliteConnector | null = null

export function getBusinessDataSource(datasourceId?: string): BusinessDataSource {
  if (!datasourceId) {
    if (!_default) _default = new SqliteConnector(getDb(), DEFAULT_MAPPING)
    return _default
  }

  const db = getDb()
  const row = db
    .prepare("SELECT type, database_name, extra_config FROM data_sources WHERE id = ? AND enabled = 1")
    .get(datasourceId) as { type: string; database_name: string | null; extra_config: string } | undefined

  // 仅 SQLite 文件数据源可直连；其它类型回退默认（避免业务查询静默失效）
  if (!row || row.type !== "sqlite") return getBusinessDataSource()

  let extra: Record<string, unknown> = {}
  try {
    extra = JSON.parse(row.extra_config || "{}")
  } catch {
    extra = {}
  }
  const mapping = mergeMapping(DEFAULT_MAPPING, extra.columnMapping as never)
  const dbPath = row.database_name ?? "data/bank.db"
  const abs = path.isAbsolute(dbPath) ? dbPath : path.join(process.cwd(), dbPath)
  const externalDb = new Database(abs)
  return new SqliteConnector(externalDb, mapping)
}

export { SqliteConnector } from "./sqlite"
export { buildScopeWhere } from "./sqlite"
export { DEFAULT_MAPPING, mergeMapping } from "./mapping"
export type { BusinessDataSource, CustomerFilter, AlertFilter } from "./types"
export type { BusinessMapping, ColumnMap, TableMap, MappingOverride } from "./mapping"
