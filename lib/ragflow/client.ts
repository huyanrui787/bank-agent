/**
 * RAGFlow HTTP 客户端（独立部署的「知识检索引擎」，直接调其 v1 API）。
 * 对齐 lib/agent/llm.ts 的 fetch 模式：env 常量 + fetch + AbortSignal.timeout + 抛 RagflowError。
 * 不引第三方 SDK。文档解析 / 向量化 / 分块 全由 RAGFlow 承担，这里只做检索 + 数据集/文档管理。
 */

const BASE_URL = (process.env.RAGFLOW_BASE_URL ?? "").replace(/\/+$/, "")
const API_KEY = process.env.RAGFLOW_API_KEY ?? ""
const TOP_K = Number(process.env.RAGFLOW_TOP_K ?? 3)
const SIMILARITY_THRESHOLD = Number(process.env.RAGFLOW_SIMILARITY_THRESHOLD ?? 0.2)
const TIMEOUT_MS = Number(process.env.RAGFLOW_TIMEOUT_MS ?? 10_000)

export type KnowledgeHit = {
  content: string
  source: string
  similarity: number
  documentId: string
  page?: number | null
}

export type RagflowDataset = {
  id: string
  name: string
  description?: string
  documentCount?: number
  chunkCount?: number
}

export type RagflowDocument = {
  id: string
  name: string
  /** UNSTART / RUNNING / CANCEL / DONE / FAIL */
  status: string
  /** 0.0 ~ 1.0 */
  progress: number
  chunkCount?: number
  size?: string
  createTime?: string
}

export type RagflowErrorCode = "not_configured" | "unreachable" | "http_error" | "bad_response"

export class RagflowError extends Error {
  code: RagflowErrorCode
  constructor(code: RagflowErrorCode, message: string) {
    super(message)
    this.name = "RagflowError"
    this.code = code
  }
}

export function isRagflowConfigured(): boolean {
  return !!BASE_URL && !!API_KEY
}

function getConfig() {
  if (!BASE_URL || !API_KEY) {
    throw new RagflowError("not_configured", "RAGFlow 未配置（缺 RAGFLOW_BASE_URL / RAGFLOW_API_KEY）")
  }
  return { baseUrl: BASE_URL, apiKey: API_KEY }
}

/** 统一请求：Bearer 鉴权 + 超时 + 错误归类 + code 校验，返回 data 字段 */
async function request<T>(path: string, init?: RequestInit & { json?: unknown; formData?: FormData }): Promise<T> {
  const { baseUrl, apiKey } = getConfig()
  const headers: Record<string, string> = { Authorization: `Bearer ${apiKey}` }
  let body: BodyInit | undefined

  if (init?.formData) {
    body = init.formData
  } else if (init?.json !== undefined) {
    headers["Content-Type"] = "application/json"
    body = JSON.stringify(init.json)
  }

  let res: Response
  try {
    res = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { ...headers, ...(init?.headers ?? {}) },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    throw new RagflowError("unreachable", `RAGFlow 服务不可达（${baseUrl}）`)
  }

  if (!res.ok) {
    const snippet = (await res.text().catch(() => "")).slice(0, 200)
    throw new RagflowError("http_error", `RAGFlow HTTP ${res.status}：${snippet}`)
  }

  let payload: unknown
  try {
    payload = await res.json()
  } catch {
    throw new RagflowError("bad_response", "RAGFlow 返回非 JSON 响应")
  }

  const p = payload as { code?: number; message?: string; data?: unknown }
  if (typeof p.code !== "number" || p.code !== 0) {
    throw new RagflowError("bad_response", `RAGFlow 错误：${p.message ?? JSON.stringify(payload).slice(0, 200)}`)
  }
  return p.data as T
}

// ── 数据集管理 ────────────────────────────────────────────────────────────────

export async function listDatasets(): Promise<RagflowDataset[]> {
  const rows = await request<unknown[] | { datasets?: unknown[] }>("/api/v1/datasets?page=1&page_size=100")
  const list = Array.isArray(rows) ? rows : rows?.datasets ?? []
  return list.map((r) => {
    const d = r as Record<string, unknown>
    return {
      id: String(d.id ?? ""),
      name: String(d.name ?? ""),
      description: d.description ? String(d.description) : undefined,
      documentCount: typeof d.document_count === "number" ? d.document_count : undefined,
      chunkCount: typeof d.chunk_count === "number" ? d.chunk_count : undefined,
    }
  })
}

export async function createDataset(name: string, description?: string): Promise<RagflowDataset> {
  const d = (await request<Record<string, unknown>>("/api/v1/datasets", {
    method: "POST",
    json: { name, description: description ?? "" },
  })) as Record<string, unknown>
  return { id: String(d.id ?? ""), name: String(d.name ?? name), description: description }
}

export async function deleteDataset(id: string): Promise<void> {
  await request(`/api/v1/datasets/${id}`, { method: "DELETE" })
}

// ── 文档管理 ──────────────────────────────────────────────────────────────────

export async function uploadDocument(datasetId: string, file: File): Promise<void> {
  const fd = new FormData()
  fd.append("file", file)
  await request(`/api/v1/datasets/${datasetId}/documents`, { method: "POST", formData: fd })
}

export async function listDocuments(datasetId: string): Promise<RagflowDocument[]> {
  const data = await request<{ docs?: unknown[] } | unknown[]>("/api/v1/datasets/" + encodeURIComponent(datasetId) + "/documents?page=1&page_size=100")
  const list = Array.isArray(data) ? data : data?.docs ?? []
  return list.map((r) => {
    const d = r as Record<string, unknown>
    return {
      id: String(d.id ?? ""),
      name: String(d.name ?? ""),
      status: String(d.run ?? "UNSTART"),
      progress: typeof d.progress === "number" ? d.progress : 0,
      chunkCount: typeof d.chunk_count === "number" ? d.chunk_count : undefined,
      size: d.size ? String(d.size) : undefined,
      createTime: d.create_time ? String(d.create_time) : undefined,
    }
  })
}

export async function deleteDocument(datasetId: string, documentId: string): Promise<void> {
  await request(`/api/v1/datasets/${encodeURIComponent(datasetId)}/documents/${encodeURIComponent(documentId)}`, { method: "DELETE" })
}

// ── 检索 ──────────────────────────────────────────────────────────────────────

/** 全部数据集 ID（短 TTL 缓存，避免每次检索都打一次 listDatasets） */
let datasetIdsCache: { ids: string[]; at: number } | null = null
const CACHE_TTL = 30_000

async function getAllDatasetIds(): Promise<string[]> {
  if (datasetIdsCache && Date.now() - datasetIdsCache.at < CACHE_TTL) return datasetIdsCache.ids
  const datasets = await listDatasets()
  const ids = datasets.map((d) => d.id)
  datasetIdsCache = { ids, at: Date.now() }
  return ids
}

export async function searchKnowledge(
  query: string,
  opts?: { topK?: number; similarityThreshold?: number; datasetIds?: string[] },
): Promise<KnowledgeHit[]> {
  const topK = opts?.topK ?? TOP_K
  const datasetIds = opts?.datasetIds ?? (await getAllDatasetIds())
  if (datasetIds.length === 0) return []

  const data = await request<{ chunks?: unknown[] }>("/api/v1/retrieval", {
    method: "POST",
    json: {
      question: query,
      dataset_ids: datasetIds,
      page: 1,
      page_size: topK, // 实际返回条数由 page_size 控制（top_k 语义不同，见 issue #11867）
      top_k: topK,
      similarity_threshold: opts?.similarityThreshold ?? SIMILARITY_THRESHOLD,
    },
  })

  const chunks = data.chunks ?? []
  return chunks.map((r) => {
    const c = r as Record<string, unknown>
    const positions = Array.isArray(c.positions) ? (c.positions as unknown[][]) : []
    const page = positions[0]?.[0] != null ? Number(positions[0][0]) : null
    return {
      content: String(c.content ?? ""),
      source: String(c.document_keyword ?? c.document_id ?? ""),
      similarity: typeof c.similarity === "number" ? c.similarity : 0,
      documentId: String(c.document_id ?? ""),
      page,
    }
  })
}
