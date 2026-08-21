/**
 * RAGFlow HTTP 客户端（独立部署的「知识检索引擎」，直接调其 v1 API）。
 * 对齐 lib/agent/llm.ts 的 fetch 模式：env 常量 + fetch + AbortSignal.timeout + 抛 RagflowError。
 * 不引第三方 SDK。文档解析 / 向量化 / 分块 全由 RAGFlow 承担，这里只做检索 + 数据集/文档/配置/日志管理。
 * 注意：这是 RAGFlow 的 fork 版（restful_apis），字段名用 embedding_model / chunk_method（非上游 embd_id / parser_id）。
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
  tokenCount?: number
  chunkMethod?: string
  embeddingModel?: string
  similarityThreshold?: number
  language?: string
  pagerank?: number
  parserConfig?: Record<string, unknown>
}

export type RagflowDocument = {
  id: string
  name: string
  /** 解析状态 UNSTART / RUNNING / CANCEL / DONE / FAIL（来自 run 字段） */
  status: string
  /** 启用状态 0/1（来自 RAGFlow status 字段） */
  enabled?: number
  /** 0.0 ~ 1.0 */
  progress: number
  chunkCount?: number
  tokenCount?: number
  size?: string
  createTime?: string
  progressMsg?: string
  processDuration?: number
  metaFields?: Record<string, unknown>
  suffix?: string
}

export type RagflowChunk = {
  id: string
  content: string
  documentId: string
  available: boolean
  importantKeywords?: string[]
  questions?: string[]
}

export type RetrievalTestChunk = {
  content: string
  similarity: number
  vectorSimilarity: number
  termSimilarity: number
  documentId: string
  source: string
  positions: number[][]
  highlight?: string
}

export type RetrievalTestResult = {
  chunks: RetrievalTestChunk[]
  docAggs: { docName: string; docId: string; count: number }[]
  total: number
}

export type RagflowIngestionSummary = {
  docNum: number
  chunkNum: number
  tokenNum: number
  status: { unstart: number; running: number; cancel: number; done: number; fail: number }
}

export type RagflowIngestionLog = {
  id: string
  documentId: string
  documentName: string
  sourceFrom?: string
  pipelineTitle: string
  processBeginAt?: string
  processDuration?: number
  taskType: string
  operationStatus: string
  progressMsg?: string
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

function mapDataset(d: Record<string, unknown>): RagflowDataset {
  return {
    id: String(d.id ?? ""),
    name: String(d.name ?? ""),
    description: d.description ? String(d.description) : undefined,
    documentCount: typeof d.document_count === "number" ? d.document_count : undefined,
    chunkCount: typeof d.chunk_count === "number" ? d.chunk_count : undefined,
    tokenCount: typeof d.token_num === "number" ? d.token_num : undefined,
    chunkMethod: d.chunk_method ? String(d.chunk_method) : undefined,
    embeddingModel: d.embedding_model ? String(d.embedding_model) : undefined,
    similarityThreshold: typeof d.similarity_threshold === "number" ? d.similarity_threshold : undefined,
    language: d.language ? String(d.language) : undefined,
    pagerank: typeof d.pagerank === "number" ? d.pagerank : undefined,
    parserConfig: (d.parser_config as Record<string, unknown>) ?? undefined,
  }
}

export async function listDatasets(): Promise<RagflowDataset[]> {
  const rows = await request<unknown[] | { datasets?: unknown[] }>("/api/v1/datasets?page=1&page_size=100")
  const list = Array.isArray(rows) ? rows : rows?.datasets ?? []
  return list.map((r) => mapDataset(r as Record<string, unknown>))
}

export async function getDataset(id: string): Promise<RagflowDataset> {
  const d = await request<Record<string, unknown>>(`/api/v1/datasets/${encodeURIComponent(id)}`)
  return mapDataset(d)
}

export async function createDataset(name: string, description?: string): Promise<RagflowDataset> {
  const d = (await request<Record<string, unknown>>("/api/v1/datasets", {
    method: "POST",
    json: { name, description: description ?? "" },
  })) as Record<string, unknown>
  return { id: String(d.id ?? ""), name: String(d.name ?? name), description: description }
}

export async function updateDataset(
  id: string,
  patch: { name?: string; description?: string; embeddingModel?: string; chunkMethod?: string; parserConfig?: Record<string, unknown>; language?: string; permission?: string; pagerank?: number },
): Promise<void> {
  const body: Record<string, unknown> = {}
  if (patch.name !== undefined) body.name = patch.name
  if (patch.description !== undefined) body.description = patch.description
  if (patch.embeddingModel !== undefined) body.embedding_model = patch.embeddingModel
  if (patch.chunkMethod !== undefined) body.chunk_method = patch.chunkMethod
  if (patch.parserConfig !== undefined) body.parser_config = patch.parserConfig
  if (patch.language !== undefined) body.language = patch.language
  if (patch.permission !== undefined) body.permission = patch.permission
  if (patch.pagerank !== undefined) body.pagerank = patch.pagerank
  await request(`/api/v1/datasets/${encodeURIComponent(id)}`, { method: "PUT", json: body })
}

export async function deleteDataset(id: string): Promise<void> {
  await request(`/api/v1/datasets/${encodeURIComponent(id)}`, { method: "DELETE" })
}

// ── 文档管理 ──────────────────────────────────────────────────────────────────

export async function uploadDocuments(datasetId: string, files: File[]): Promise<void> {
  const fd = new FormData()
  for (const file of files) fd.append("file", file)
  await request(`/api/v1/datasets/${encodeURIComponent(datasetId)}/documents`, { method: "POST", formData: fd })
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
      enabled: typeof d.status === "number" ? d.status : undefined,
      progress: typeof d.progress === "number" ? d.progress : 0,
      chunkCount: typeof d.chunk_count === "number" ? d.chunk_count : undefined,
      tokenCount: typeof d.token_count === "number" ? d.token_count : undefined,
      size: d.size ? String(d.size) : undefined,
      createTime: d.create_time ? String(d.create_time) : undefined,
      progressMsg: d.progress_msg ? String(d.progress_msg) : undefined,
      processDuration: typeof d.process_duration === "number" ? d.process_duration : undefined,
      metaFields: (d.meta_fields as Record<string, unknown>) ?? undefined,
      suffix: d.suffix ? String(d.suffix) : undefined,
    }
  })
}

export async function deleteDocument(datasetId: string, documentId: string): Promise<void> {
  await request(`/api/v1/datasets/${encodeURIComponent(datasetId)}/documents/${encodeURIComponent(documentId)}`, { method: "DELETE" })
}

/** 文档重命名（PATCH，body {name}） */
export async function renameDocument(datasetId: string, documentId: string, name: string): Promise<void> {
  await request(`/api/v1/datasets/${encodeURIComponent(datasetId)}/documents/${encodeURIComponent(documentId)}`, { method: "PATCH", json: { name } })
}

/** 文档启用/禁用（PATCH，body {enabled: 0|1}） */
export async function setDocumentEnabled(datasetId: string, documentId: string, enabled: boolean): Promise<void> {
  await request(`/api/v1/datasets/${encodeURIComponent(datasetId)}/documents/${encodeURIComponent(documentId)}`, { method: "PATCH", json: { enabled: enabled ? 1 : 0 } })
}

/** 文档元数据（PATCH，body {meta_fields}） */
export async function updateDocumentMetadata(datasetId: string, documentId: string, metaFields: Record<string, unknown>): Promise<void> {
  await request(`/api/v1/datasets/${encodeURIComponent(datasetId)}/documents/${encodeURIComponent(documentId)}`, { method: "PATCH", json: { meta_fields: metaFields } })
}

/** 批量启用/禁用（POST batch-update-status，body {doc_ids, status:"0"|"1"}） */
export async function batchSetDocumentStatus(datasetId: string, docIds: string[], enabled: boolean): Promise<void> {
  await request(`/api/v1/datasets/${encodeURIComponent(datasetId)}/documents/batch-update-status`, {
    method: "POST",
    json: { doc_ids: docIds, status: enabled ? "1" : "0" },
  })
}

/** 重新解析（POST /documents/ingest，无 dataset 前缀；支持删除旧 chunk + 应用自动元数据） */
export async function reparseDocuments(docIds: string[], opts?: { delete?: boolean; applyKb?: boolean }): Promise<void> {
  await request(`/api/v1/documents/ingest`, {
    method: "POST",
    json: { doc_ids: docIds, run: "1", delete: opts?.delete ?? false, apply_kb: opts?.applyKb ?? false },
  })
}

/** 停止解析（POST .../documents/stop，body {document_ids}） */
export async function stopParsing(datasetId: string, docIds: string[]): Promise<void> {
  await request(`/api/v1/datasets/${encodeURIComponent(datasetId)}/documents/stop`, { method: "POST", json: { document_ids: docIds } })
}

/** 新建空文件（POST ?type=empty，JSON body {name}） */
export async function createEmptyDocument(datasetId: string, name: string): Promise<void> {
  await request(`/api/v1/datasets/${encodeURIComponent(datasetId)}/documents?type=empty`, { method: "POST", json: { name } })
}

/** 单文档详情（GET ?id=） */
export async function getDocument(datasetId: string, documentId: string): Promise<RagflowDocument | undefined> {
  const data = await request<{ docs?: unknown[] } | unknown[]>(`/api/v1/datasets/${encodeURIComponent(datasetId)}/documents?id=${encodeURIComponent(documentId)}`)
  const list = Array.isArray(data) ? data : data?.docs ?? []
  if (list.length === 0) return undefined
  const d = list[0] as Record<string, unknown>
  return {
    id: String(d.id ?? ""),
    name: String(d.name ?? ""),
    status: String(d.run ?? "UNSTART"),
    enabled: typeof d.status === "number" ? d.status : undefined,
    progress: typeof d.progress === "number" ? d.progress : 0,
    chunkCount: typeof d.chunk_count === "number" ? d.chunk_count : undefined,
    tokenCount: typeof d.token_count === "number" ? d.token_count : undefined,
    size: d.size ? String(d.size) : undefined,
    createTime: d.create_time ? String(d.create_time) : undefined,
    progressMsg: d.progress_msg ? String(d.progress_msg) : undefined,
    metaFields: (d.meta_fields as Record<string, unknown>) ?? undefined,
    suffix: d.suffix ? String(d.suffix) : undefined,
  }
}

/** 下载文档（返回文件流，非 JSON） */
export async function downloadDocument(datasetId: string, documentId: string): Promise<{ blob: Blob; filename: string; contentType: string }> {
  const { baseUrl, apiKey } = getConfig()
  let res: Response
  try {
    res = await fetch(`${baseUrl}/api/v1/datasets/${encodeURIComponent(datasetId)}/documents/${encodeURIComponent(documentId)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    throw new RagflowError("unreachable", "RAGFlow 服务不可达")
  }
  if (!res.ok) throw new RagflowError("http_error", `RAGFlow HTTP ${res.status}`)
  const blob = await res.blob()
  const contentType = res.headers.get("Content-Type") ?? "application/octet-stream"
  const disposition = res.headers.get("Content-Disposition") ?? ""
  const m = disposition.match(/filename\*?=(?:UTF-8''|")?([^";]+)/)
  const filename = m ? decodeURIComponent(m[1]) : "document"
  return { blob, filename, contentType }
}

// ── chunk 管理 ────────────────────────────────────────────────────────────────

export async function listChunks(datasetId: string, documentId: string, page = 1, pageSize = 20): Promise<{ total: number; chunks: RagflowChunk[] }> {
  const data = await request<{ total?: number; chunks?: unknown[] }>(
    `/api/v1/datasets/${encodeURIComponent(datasetId)}/documents/${encodeURIComponent(documentId)}/chunks?page=${page}&page_size=${pageSize}`,
  )
  const chunks = (data.chunks ?? []).map((r) => {
    const c = r as Record<string, unknown>
    return {
      id: String(c.id ?? ""),
      content: String(c.content ?? ""),
      documentId: String(c.document_id ?? ""),
      available: c.available === true,
      importantKeywords: Array.isArray(c.important_keywords) ? (c.important_keywords as string[]) : undefined,
      questions: Array.isArray(c.questions) ? (c.questions as string[]) : undefined,
    }
  })
  return { total: data.total ?? chunks.length, chunks }
}

export async function createChunk(datasetId: string, documentId: string, content: string): Promise<void> {
  await request(`/api/v1/datasets/${encodeURIComponent(datasetId)}/documents/${encodeURIComponent(documentId)}/chunks`, {
    method: "POST",
    json: { content },
  })
}

export async function deleteChunks(datasetId: string, documentId: string, chunkIds: string[]): Promise<void> {
  await request(`/api/v1/datasets/${encodeURIComponent(datasetId)}/documents/${encodeURIComponent(documentId)}/chunks`, {
    method: "DELETE",
    json: { chunk_ids: chunkIds },
  })
}

export async function updateChunk(datasetId: string, documentId: string, chunkId: string, patch: { content?: string; available?: boolean }): Promise<void> {
  await request(`/api/v1/datasets/${encodeURIComponent(datasetId)}/documents/${encodeURIComponent(documentId)}/chunks/${encodeURIComponent(chunkId)}`, {
    method: "PATCH",
    json: { content: patch.content, available: patch.available === undefined ? undefined : (patch.available ? 1 : 0) },
  })
}

export async function setChunksAvailable(datasetId: string, documentId: string, chunkIds: string[], available: boolean): Promise<void> {
  await request(`/api/v1/datasets/${encodeURIComponent(datasetId)}/documents/${encodeURIComponent(documentId)}/chunks`, {
    method: "PATCH",
    json: { chunk_ids: chunkIds, available_int: available ? 1 : 0 },
  })
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

/** 检索测试：针对单个知识库，返回完整 chunk 字段（供「检索测试」tab 展示） */
export async function testRetrieval(
  datasetId: string,
  query: string,
  opts?: { topK?: number; similarityThreshold?: number; vectorSimilarityWeight?: number; highlight?: boolean; documentIds?: string[] },
): Promise<RetrievalTestResult> {
  const topK = opts?.topK ?? TOP_K
  const data = await request<{ total?: number; chunks?: unknown[]; doc_aggs?: unknown }>("/api/v1/retrieval", {
    method: "POST",
    json: {
      question: query,
      dataset_ids: [datasetId],
      document_ids: opts?.documentIds ?? [],
      page: 1,
      page_size: topK,
      top_k: topK,
      similarity_threshold: opts?.similarityThreshold ?? SIMILARITY_THRESHOLD,
      vector_similarity_weight: opts?.vectorSimilarityWeight ?? 0.3,
      highlight: opts?.highlight ?? true,
    },
  })

  const chunks = (data.chunks ?? []).map((r) => {
    const c = r as Record<string, unknown>
    return {
      content: String(c.content ?? ""),
      similarity: typeof c.similarity === "number" ? c.similarity : 0,
      vectorSimilarity: typeof c.vector_similarity === "number" ? c.vector_similarity : 0,
      termSimilarity: typeof c.term_similarity === "number" ? c.term_similarity : 0,
      documentId: String(c.document_id ?? ""),
      source: String(c.document_keyword ?? c.document_id ?? ""),
      positions: Array.isArray(c.positions) ? (c.positions as number[][]) : [],
      highlight: c.highlight ? String(c.highlight) : undefined,
    }
  })
  const aggs = Array.isArray(data.doc_aggs)
    ? (data.doc_aggs as Record<string, unknown>[]).map((a) => ({
        docName: String(a.doc_name ?? ""),
        docId: String(a.doc_id ?? ""),
        count: typeof a.count === "number" ? a.count : 0,
      }))
    : []
  return { chunks, docAggs: aggs, total: typeof data.total === "number" ? data.total : chunks.length }
}

// ── 日志 ──────────────────────────────────────────────────────────────────────

export async function getIngestionSummary(datasetId: string): Promise<RagflowIngestionSummary> {
  const d = (await request<Record<string, unknown>>(`/api/v1/datasets/${encodeURIComponent(datasetId)}/ingestions/summary`)) as Record<string, unknown>
  const status = (d.status as Record<string, number>) ?? {}
  return {
    docNum: typeof d.doc_num === "number" ? d.doc_num : 0,
    chunkNum: typeof d.chunk_num === "number" ? d.chunk_num : 0,
    tokenNum: typeof d.token_num === "number" ? d.token_num : 0,
    status: {
      unstart: status.unstart_count ?? 0,
      running: status.running_count ?? 0,
      cancel: status.cancel_count ?? 0,
      done: status.done_count ?? 0,
      fail: status.fail_count ?? 0,
    },
  }
}

export async function listIngestionLogs(datasetId: string, page = 1, pageSize = 20, logType?: "file" | "dataset"): Promise<{ total: number; logs: RagflowIngestionLog[] }> {
  const typeParam = logType ? `&log_type=${logType}` : ""
  const d = (await request<{ total?: number; logs?: unknown[] }>(
    `/api/v1/datasets/${encodeURIComponent(datasetId)}/ingestions?page=${page}&page_size=${pageSize}${typeParam}`,
  )) as { total?: number; logs?: unknown[] }
  const logs = (d.logs ?? []).map((r) => {
    const l = r as Record<string, unknown>
    return {
      id: String(l.id ?? ""),
      documentId: String(l.document_id ?? ""),
      documentName: String(l.document_name ?? ""),
      sourceFrom: l.source_from ? String(l.source_from) : undefined,
      pipelineTitle: String(l.pipeline_title ?? ""),
      processBeginAt: l.process_begin_at ? String(l.process_begin_at) : undefined,
      processDuration: typeof l.process_duration === "number" ? l.process_duration : undefined,
      taskType: String(l.task_type ?? ""),
      operationStatus: String(l.operation_status ?? ""),
      progressMsg: l.progress_msg ? String(l.progress_msg) : undefined,
    }
  })
  return { total: d.total ?? logs.length, logs }
}
