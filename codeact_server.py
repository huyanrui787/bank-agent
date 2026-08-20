"""
CodeAct Python sidecar for bank-agent.

POST /exec         { "code": str, "scope": {...}, "datasource": {...} }
POST /datasource/test  { "type": str, "host": str, ... }
GET  /health       → { "status": "ok" }

Start: .venv/bin/uvicorn codeact_server:app --port 8765
"""

import json
import os
import re
import time
import importlib
from pathlib import Path
from typing import Optional, Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── resolve paths ─────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent.resolve()
DB_PATH = str(BASE_DIR / "data" / "bank.db")

# codeact 子进程硬编码用 "python3"，需让它解析到 venv 里的 python（含 sqlalchemy/
# pymysql/psycopg2 等多数据源驱动），而不是系统 python3（可能缺驱动）。
_VENV_BIN = str(BASE_DIR / ".venv" / "bin")
os.environ["PATH"] = _VENV_BIN + os.pathsep + os.environ.get("PATH", "")

# ── codeact setup ─────────────────────────────────────────────────────────────
from codeact.config import CodeActConfig
from codeact.executor import ExecPythonTool, build_sqlite_preamble

_DB_NOTES = """
# 数据库说明（bank.db — 丰年银行 Demo 数据）
# 表结构：
#   customers  — 客户主表 (id, name, avg_deposit, mortgage_loan, credit_loan,
#                risk_level, segment, manager_name, manager_id, branch, grid, community,
#                has_other_bank_loan, has_valid_contract, used_credit_amount, ...)
#   managers   — 客户经理绩效 (id, name, current_customer_count,
#                monthly_new_customers, monthly_deposit_increase, monthly_loan_increase,
#                vs_last_month_deposit, maintenance_score, ...)
#   alerts     — 业务预警 (id, type, severity, title, customer_id, customer_name,
#                amount, due_date, status, description, ...)
#   visits     — 走访记录 (id, customer_id, visited_at, manager, channel, summary)
#   products   — 产品目录 (product_code, product_name, category, expected_rate, risk_hint)
#
# 金额字段单位：元（显示时除以 10000 转为"万"）
# 图表输出格式（在 print 的文本中嵌入）：
#   <<<CHART:{"type":"bar","title":"...","data":[{"name":"...","value":...},...],
#             "xKey":"name","yKeys":[{"key":"value","label":"...","color":"#1e40af"}]}>>>
# 支持的图表类型：bar / line / pie
# 示例：
#   print('<<<CHART:' + json.dumps(chart_obj) + '>>>')
"""

_config = CodeActConfig(exec_timeout=30)
_EMIT_CHART_HELPER = '''
def emit_chart(chart_type, title, data, x_key, y_keys):
    """输出图表到前端。chart_type ∈ {'bar','line','pie'}；
    data 为 list[dict]（每项含 x_key 对应键与 y_keys 中各 key 的值）；
    y_keys 为 list[dict]，每项含 key(必填)/label(可选)/color(可选，如 "#1e40af")。"""
    import json as _json
    obj = {"type": chart_type, "title": title, "data": data, "xKey": x_key, "yKeys": y_keys}
    print("<<<CHART:" + _json.dumps(obj, ensure_ascii=False) + ">>>")
'''
_base_preamble = build_sqlite_preamble(DB_PATH, extra_helpers=_EMIT_CHART_HELPER, data_notes=_DB_NOTES)

# ── scope-aware query wrapper ─────────────────────────────────────────────────

def _build_scope_preamble(scope_type: str, manager_name: Optional[str], branch: Optional[str]) -> str:
    lines = [
        "",
        "# ── Data Scope ──────────────────────────────────────────────────────────",
        f"_SCOPE_TYPE = {repr(scope_type)}",
        f"_SCOPE_MANAGER_NAME = {repr(manager_name)}",
        f"_SCOPE_BRANCH = {repr(branch)}",
        "",
        "_orig_query = query  # noqa: F821",
        "",
        "def query(sql, params=None):",
        "    params = list(params) if params else []",
        "    sql_up = sql.upper().strip()",
        "    sql_clean = sql.rstrip('; \\n')",
        "    if _SCOPE_TYPE == 'personal' and _SCOPE_MANAGER_NAME:",
        "        if 'FROM CUSTOMERS' in sql_up:",
        "            sql_clean += (' AND' if 'WHERE' in sql_up else ' WHERE') + ' manager_name = ?'",
        "            params.append(_SCOPE_MANAGER_NAME)",
        "        elif 'FROM ALERTS' in sql_up:",
        "            sql_clean += (' AND' if 'WHERE' in sql_up else ' WHERE') + ' manager_name = ?'",
        "            params.append(_SCOPE_MANAGER_NAME)",
        "    elif _SCOPE_TYPE == 'branch' and _SCOPE_BRANCH:",
        "        if 'FROM CUSTOMERS' in sql_up:",
        "            sql_clean += (' AND' if 'WHERE' in sql_up else ' WHERE') + ' branch = ?'",
        "            params.append(_SCOPE_BRANCH)",
        "        elif 'FROM MANAGERS' in sql_up:",
        "            sql_clean += (' AND' if 'WHERE' in sql_up else ' WHERE') + ' branch = ?'",
        "            params.append(_SCOPE_BRANCH)",
        "    return _orig_query(sql_clean, params if params else None)",
        "",
    ]
    return "\n".join(lines)


def _build_executor(scope_type: str = "bank", manager_name: Optional[str] = None, branch: Optional[str] = None) -> ExecPythonTool:
    if scope_type == "bank":
        return ExecPythonTool(preamble=_base_preamble, config=_config)
    return ExecPythonTool(preamble=_base_preamble + _build_scope_preamble(scope_type, manager_name, branch), config=_config)


_executor_bank = ExecPythonTool(preamble=_base_preamble, config=_config)

# ── multi-datasource preamble builders ───────────────────────────────────────

def _sqlalchemy_url(ds: "DataSourcePayload") -> str:
    """Build SQLAlchemy connection URL from datasource config."""
    t = ds.type
    user = ds.username or ""
    pw   = ds.password or ""
    host = ds.host or "localhost"
    port = ds.port
    db   = ds.database_name or ""
    extra = ds.extra_config or {}

    if t == "mysql":
        p = port or 3306
        charset = extra.get("charset", "utf8mb4")
        return f"mysql+pymysql://{user}:{pw}@{host}:{p}/{db}?charset={charset}"
    elif t == "postgresql":
        p = port or 5432
        return f"postgresql+psycopg2://{user}:{pw}@{host}:{p}/{db}"
    elif t == "sqlserver":
        p = port or 1433
        return f"mssql+pymssql://{user}:{pw}@{host}:{p}/{db}"
    elif t == "oracle":
        p = port or 1521
        service = extra.get("service_name", db)
        return f"oracle+oracledb://{user}:{pw}@{host}:{p}/?service_name={service}"
    elif t == "db2":
        p = port or 50000
        return f"db2+ibm_db://{user}:{pw}@{host}:{p}/{db}"
    elif t == "hive":
        p = port or 10000
        auth = extra.get("auth", "NONE")
        return f"hive://{user}:{pw}@{host}:{p}/{db}?auth={auth}"
    elif t == "impala":
        p = port or 21050
        return f"impala://{host}:{p}/{db}"
    elif t in ("vector_pgvector",):
        p = port or 5432
        return f"postgresql+psycopg2://{user}:{pw}@{host}:{p}/{db}"
    raise ValueError(f"No SQLAlchemy URL for type: {t}")


def _build_sqlalchemy_preamble(ds: "DataSourcePayload") -> str:
    url = _sqlalchemy_url(ds)
    return f"""
# ── External datasource via SQLAlchemy ──────────────────────────────────────
import sqlalchemy as _sa
_engine = _sa.create_engine({repr(url)}, pool_pre_ping=True, pool_size=1, max_overflow=0)

def query(sql, params=None):
    with _engine.connect() as _c:
        _r = _c.execute(_sa.text(sql), params or {{}})
        return [dict(row._mapping) for row in _r]

def query_one(sql, params=None):
    rows = query(sql, params)
    return rows[0] if rows else {{}}
"""


def _build_pgvector_preamble(ds: "DataSourcePayload") -> str:
    """PostgreSQL + pgvector：除普通 query() 外提供 vector_search()。"""
    url = _sqlalchemy_url(ds)
    return f"""
# ── PostgreSQL + pgvector ─────────────────────────────────────────────────────
import sqlalchemy as _sa
_engine = _sa.create_engine({repr(url)}, pool_pre_ping=True, pool_size=1, max_overflow=0)

def query(sql, params=None):
    with _engine.connect() as _c:
        _r = _c.execute(_sa.text(sql), params or {{}})
        return [dict(row._mapping) for row in _r]

def query_one(sql, params=None):
    rows = query(sql, params)
    return rows[0] if rows else {{}}

def vector_search(table, query_vector, top_k=10, metric="cosine", output_fields=None):
    \"\"\"pgvector 向量检索。table 需含 embedding vector 列。
    metric: cosine(余弦) / l2(欧氏) / ip(内积)；query_vector 为 list[float]。\"\"\"
    vec = "[" + ",".join(str(float(x)) for x in query_vector) + "]"
    op = {{"cosine": "<=>", "l2": "<->", "ip": "<#>"}}.get(metric, "<=>")
    cols = ", ".join('"' + f + '"' for f in output_fields) if output_fields else "*"
    sql = ("SELECT " + cols + ", embedding " + op + " %s AS _distance FROM " + table +
           " ORDER BY embedding " + op + " %s LIMIT %s")
    with _engine.connect() as _c:
        _r = _c.execute(_sa.text(sql), (vec, vec, int(top_k)))
        return [dict(row._mapping) for row in _r]
"""


def _build_qdrant_preamble(ds: "DataSourcePayload") -> str:
    extra = ds.extra_config or {}
    url = extra.get("url") or f"http://{ds.host or 'localhost'}:{ds.port or 6333}"
    api_key = extra.get("api_key", "")
    return f"""
# ── Qdrant vector database ────────────────────────────────────────────────────
from qdrant_client import QdrantClient as _QdrantClient
_qdrant = _QdrantClient(url={repr(url)}, api_key={repr(api_key) if api_key else 'None'})

def query(sql, params=None):
    raise NotImplementedError("Qdrant 不支持 SQL。请使用 vector_search() 进行向量检索。")

def query_one(sql, params=None):
    return query(sql, params)

def vector_search(collection_name, query_vector, top_k=10, output_fields=None):
    \"\"\"Qdrant 向量检索。返回 [{{id, score, ...payload}}]。\"\"\"
    hits = _qdrant.search(collection_name=collection_name, query_vector=query_vector,
                          limit=int(top_k), with_payload=True, with_vectors=False)
    out = []
    for h in hits:
        item = dict(h.payload or {{}})
        item["id"] = h.id
        item["score"] = h.score
        out.append(item)
    return out
"""


def _build_weaviate_preamble(ds: "DataSourcePayload") -> str:
    extra = ds.extra_config or {}
    host = ds.host or "localhost"
    http_port = ds.port or 8080
    grpc_port = int(extra.get("grpc_port", 50051))
    api_key = extra.get("api_key", "")
    secure = extra.get("https", "false").lower() in ("1", "true", "yes")
    return f"""
# ── Weaviate vector database (v4 client) ──────────────────────────────────────
import weaviate as _wv
_api_key = {repr(api_key)}
_headers = {{"Authorization": "Bearer " + _api_key}} if _api_key else None
_wv_client = _wv.connect_to_custom(
    http_host={repr(host)}, http_port={http_port}, http_secure={str(secure)},
    grpc_host={repr(host)}, grpc_port={grpc_port}, grpc_secure={str(secure)},
    headers=_headers,
)

def query(sql, params=None):
    raise NotImplementedError("Weaviate 不支持 SQL。请使用 vector_search() 进行向量检索。")

def query_one(sql, params=None):
    return query(sql, params)

def vector_search(collection_name, query_vector, top_k=10, output_fields=None):
    \"\"\"Weaviate 向量检索（nearVector）。返回 [{{id, score, ...properties}}]。\"\"\"
    from weaviate.classes.query import MetadataQuery as _MQ
    coll = _wv_client.collections.get(collection_name)
    resp = coll.query.near_vector(near_vector=query_vector, limit=int(top_k), return_metadata=_MQ(distance=True))
    out = []
    for o in resp.objects:
        item = dict(o.properties or {{}})
        item["id"] = str(o.uuid)
        item["score"] = o.metadata.distance if o.metadata else None
        out.append(item)
    return out
"""


def _build_chroma_preamble(ds: "DataSourcePayload") -> str:
    extra = ds.extra_config or {}
    path = extra.get("path", "")
    host = ds.host or "localhost"
    port = ds.port or 8000
    if path:
        client_line = f"_chroma = chromadb.PersistentClient(path={repr(path)})"
    else:
        client_line = f"_chroma = chromadb.HttpClient(host={repr(host)}, port={port})"
    return f"""
# ── Chroma vector database ────────────────────────────────────────────────────
import chromadb as _chromadb
{client_line}

def query(sql, params=None):
    raise NotImplementedError("Chroma 不支持 SQL。请使用 vector_search() 进行向量检索。")

def query_one(sql, params=None):
    return query(sql, params)

def vector_search(collection_name, query_vector, top_k=10, output_fields=None):
    \"\"\"Chroma 向量检索。返回 [{{id, score(distance), document, ...metadata}}]。\"\"\"
    col = _chroma.get_collection(collection_name)
    res = col.query(query_embeddings=[list(query_vector)], n_results=int(top_k),
                    include=["documents", "metadatas", "distances"])
    ids = (res.get("ids") or [[]])[0]
    docs = (res.get("documents") or [[]])[0]
    metas = (res.get("metadatas") or [[]])[0]
    dists = (res.get("distances") or [[]])[0]
    out = []
    for i, _id in enumerate(ids):
        item = dict(metas[i] if i < len(metas) and metas[i] else {{}})
        item["id"] = _id
        item["score"] = dists[i] if i < len(dists) else None
        item["document"] = docs[i] if i < len(docs) else None
        out.append(item)
    return out
"""


def _build_es_preamble(ds: "DataSourcePayload") -> str:
    extra = ds.extra_config or {}
    url = extra.get("url") or f"http://{ds.host or 'localhost'}:{ds.port or 9200}"
    api_key = extra.get("api_key", "")
    return f"""
# ── Elasticsearch datasource ─────────────────────────────────────────────────
from elasticsearch import Elasticsearch as _ES
_es_client = _ES(
    {repr(url)},
    api_key={repr(api_key) if api_key else 'None'},
    verify_certs=False,
)

def query(sql, params=None):
    \"\"\"Translate SQL via ES SQL API. Use query_es() for native DSL.\"\"\"
    resp = _es_client.sql.query(body={{"query": sql}})
    cols = [c["name"] for c in resp["columns"]]
    return [dict(zip(cols, row)) for row in resp["rows"]]

def query_es(index, dsl):
    \"\"\"Native ES query: query_es('my_index', {{"match_all": {{}}}})\"\"\"
    resp = _es_client.search(index=index, query=dsl)
    return [h["_source"] for h in resp["hits"]["hits"]]

def query_one(sql, params=None):
    rows = query(sql, params)
    return rows[0] if rows else {{}}
"""


def _build_milvus_preamble(ds: "DataSourcePayload") -> str:
    extra = ds.extra_config or {}
    host = ds.host or "localhost"
    port = ds.port or 19530
    token = extra.get("token", "")
    return f"""
# ── Milvus vector datasource ─────────────────────────────────────────────────
from pymilvus import connections as _milvus_conn, Collection as _MilvusColl
_milvus_conn.connect("default", host={repr(host)}, port={repr(str(port))}{", token=" + repr(token) if token else ""})

def vector_search(collection_name, query_vector, top_k=10, output_fields=None):
    \"\"\"Search nearest vectors. Returns list of dicts with id, score, and fields.\"\"\"
    coll = _MilvusColl(collection_name)
    coll.load()
    results = coll.search(
        data=[query_vector],
        anns_field="embedding",
        param={{"metric_type": "L2", "params": {{"nprobe": 16}}}},
        limit=top_k,
        output_fields=output_fields or [],
    )
    return [{{"id": hit.id, "score": hit.score, **hit.entity}} for hit in results[0]]

def query(sql, params=None):
    raise NotImplementedError("Milvus 不支持 SQL。请使用 vector_search() 进行向量检索。")
"""


def _build_dtsql_preamble(ds: "DataSourcePayload") -> str:
    extra = ds.extra_config or {}
    url = extra.get("url") or f"http://{ds.host or 'localhost'}:{ds.port or 8080}"
    token = extra.get("token", "")
    return f"""
# ── DTSQL datasource ─────────────────────────────────────────────────────────
import urllib.request, json as _json

def query(sql, params=None):
    req_data = _json.dumps({{"sql": sql, "params": params or []}}).encode()
    headers = {{"Content-Type": "application/json"}}
    {('headers["Authorization"] = "Bearer " + ' + repr(token)) if token else ''}
    req = urllib.request.Request({repr(url + "/query")}, data=req_data, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=30) as resp:
        result = _json.loads(resp.read())
    return result.get("rows", result)

def query_one(sql, params=None):
    rows = query(sql, params)
    return rows[0] if rows else {{}}
"""


def _build_sqlite_file_preamble(ds: "DataSourcePayload") -> str:
    """连接指定的 SQLite 文件（database_name 为文件路径），用于接入独立的外部 SQLite 库。"""
    path = ds.database_name or DB_PATH
    if not os.path.isabs(path):
        path = str(BASE_DIR / path)
    return f"""
# ── External SQLite file datasource ──────────────────────────────────────────
import sqlite3 as _sqlite3
_conn = _sqlite3.connect({repr(path)})
_conn.row_factory = _sqlite3.Row

def query(sql, params=None):
    _cur = _conn.execute(sql, params or [])
    return [dict(r) for r in _cur.fetchall()]

def query_one(sql, params=None):
    rows = query(sql, params)
    return rows[0] if rows else {{}}
"""


def build_datasource_preamble(ds: "DataSourcePayload") -> str:
    """Return Python preamble that defines query() for the given external datasource."""
    t = ds.type
    if t in ("mysql", "postgresql", "sqlserver", "oracle", "db2", "hive", "impala"):
        preamble = _build_sqlalchemy_preamble(ds)
    elif t == "vector_pgvector":
        preamble = _build_pgvector_preamble(ds)
    elif t == "vector_qdrant":
        preamble = _build_qdrant_preamble(ds)
    elif t == "vector_weaviate":
        preamble = _build_weaviate_preamble(ds)
    elif t == "vector_chroma":
        preamble = _build_chroma_preamble(ds)
    elif t == "elasticsearch":
        preamble = _build_es_preamble(ds)
    elif t == "vector_milvus":
        preamble = _build_milvus_preamble(ds)
    elif t == "dtsql":
        preamble = _build_dtsql_preamble(ds)
    elif t == "sqlite":
        # 指定了独立文件路径 → 连该文件；否则用默认 bank.db
        if ds.database_name and ds.database_name != DB_PATH:
            preamble = _build_sqlite_file_preamble(ds)
        else:
            preamble = ""
    else:
        raise ValueError(f"Unknown datasource type: {t}")

    # 统一注入 emit_chart()，使所有数据源都支持图表输出
    return preamble + _EMIT_CHART_HELPER


# ── chart extraction ──────────────────────────────────────────────────────────
_CHART_RE = re.compile(r"<<<CHART:(.*?)>>>", re.DOTALL)


def extract_charts(text: str) -> tuple[str, list[dict]]:
    charts: list[dict] = []
    for m in _CHART_RE.finditer(text):
        try:
            charts.append(json.loads(m.group(1)))
        except json.JSONDecodeError:
            pass
    return _CHART_RE.sub("", text).strip(), charts


# ── FastAPI app ───────────────────────────────────────────────────────────────
app = FastAPI(title="CodeAct Sidecar", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ScopePayload(BaseModel):
    type: str = "bank"
    managerName: Optional[str] = None
    branch: Optional[str] = None


class DataSourcePayload(BaseModel):
    type: str
    host: Optional[str] = None
    port: Optional[int] = None
    database_name: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    extra_config: Optional[dict] = None


class ExecRequest(BaseModel):
    code: str
    scope: Optional[ScopePayload] = None
    datasource: Optional[DataSourcePayload] = None


class ExecResponse(BaseModel):
    stdout: str
    stderr: str
    charts: list[dict]


class TestResponse(BaseModel):
    ok: bool
    message: str
    latency_ms: float


@app.get("/health")
def health():
    return {"status": "ok", "db": DB_PATH, "db_exists": Path(DB_PATH).exists()}


@app.post("/datasource/test", response_model=TestResponse)
def test_datasource(ds: DataSourcePayload):
    """Test connectivity for an external datasource."""
    t0 = time.monotonic()
    try:
        if ds.type == "sqlite":
            import sqlite3
            path = ds.database_name or DB_PATH
            conn = sqlite3.connect(path, timeout=5)
            conn.execute("SELECT 1")
            conn.close()

        elif ds.type in ("mysql", "postgresql", "sqlserver", "oracle", "db2", "hive", "impala"):
            import sqlalchemy as sa
            url = _sqlalchemy_url(ds)
            engine = sa.create_engine(url, connect_args={"connect_timeout": 8} if ds.type in ("mysql", "postgresql") else {})
            with engine.connect() as c:
                c.execute(sa.text("SELECT 1"))
            engine.dispose()

        elif ds.type == "vector_pgvector":
            import sqlalchemy as sa
            url = _sqlalchemy_url(ds)
            engine = sa.create_engine(url, connect_args={"connect_timeout": 8})
            with engine.connect() as c:
                c.execute(sa.text("SELECT 1"))
                row = c.execute(sa.text("SELECT extname FROM pg_extension WHERE extname = 'pgvector'")).fetchone()
                if not row:
                    raise RuntimeError("pgvector 扩展未安装（请执行 CREATE EXTENSION vector）")
            engine.dispose()

        elif ds.type == "vector_qdrant":
            extra = ds.extra_config or {}
            url = extra.get("url") or f"http://{ds.host or 'localhost'}:{ds.port or 6333}"
            from qdrant_client import QdrantClient
            client = QdrantClient(url=url, api_key=extra.get("api_key") or None, timeout=8)
            client.get_collections()

        elif ds.type == "vector_weaviate":
            extra = ds.extra_config or {}
            host = ds.host or "localhost"
            http_port = ds.port or 8080
            grpc_port = int(extra.get("grpc_port", 50051))
            secure = extra.get("https", "false").lower() in ("1", "true", "yes")
            api_key = extra.get("api_key", "")
            import weaviate as wv
            client = wv.connect_to_custom(
                http_host=host, http_port=http_port, http_secure=secure,
                grpc_host=host, grpc_port=grpc_port, grpc_secure=secure,
                headers={"Authorization": "Bearer " + api_key} if api_key else None,
            )
            if not client.is_ready():
                raise RuntimeError("Weaviate 未就绪")
            client.close()

        elif ds.type == "vector_chroma":
            extra = ds.extra_config or {}
            import chromadb
            if extra.get("path"):
                client = chromadb.PersistentClient(path=extra["path"])
                client.list_collections()
            else:
                host = ds.host or "localhost"
                port = ds.port or 8000
                client = chromadb.HttpClient(host=host, port=port)
                client.heartbeat()

        elif ds.type == "elasticsearch":
            extra = ds.extra_config or {}
            url = extra.get("url") or f"http://{ds.host or 'localhost'}:{ds.port or 9200}"
            from elasticsearch import Elasticsearch
            client = Elasticsearch(url, api_key=extra.get("api_key") or None, verify_certs=False, request_timeout=8)
            info = client.cluster.health(request_timeout=8)
            if info.get("status") not in ("green", "yellow"):
                raise RuntimeError(f"Cluster status: {info.get('status')}")

        elif ds.type == "vector_milvus":
            from pymilvus import connections
            connections.connect("_test", host=ds.host or "localhost", port=str(ds.port or 19530), timeout=8)
            connections.disconnect("_test")

        elif ds.type == "dtsql":
            extra = ds.extra_config or {}
            base_url = extra.get("url") or f"http://{ds.host or 'localhost'}:{ds.port or 8080}"
            import urllib.request
            req = urllib.request.Request(f"{base_url}/health", method="GET")
            with urllib.request.urlopen(req, timeout=8):
                pass

        else:
            raise ValueError(f"Unsupported datasource type: {ds.type}")

        latency = (time.monotonic() - t0) * 1000
        return TestResponse(ok=True, message="连接成功", latency_ms=round(latency, 1))

    except Exception as e:
        latency = (time.monotonic() - t0) * 1000
        return TestResponse(ok=False, message=str(e)[:300], latency_ms=round(latency, 1))


def _introspect_sqlite_file(path: str) -> list[dict]:
    import sqlite3
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    try:
        tables = [
            r["name"] for r in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
            )
        ]
        result = []
        for t in tables:
            cols = []
            for c in conn.execute(f'PRAGMA table_info("{t}")'):
                cols.append({
                    "name": c["name"],
                    "type": c["type"] or "TEXT",
                    "notNull": bool(c["notnull"]),
                    "pk": bool(c["pk"]),
                })
            result.append({"name": t, "columns": cols})
        return result
    finally:
        conn.close()


def _introspect_sqlalchemy(ds: "DataSourcePayload") -> list[dict]:
    import sqlalchemy as sa
    url = _sqlalchemy_url(ds)
    connect_args = {"connect_timeout": 8} if ds.type in ("mysql", "postgresql") else {}
    engine = sa.create_engine(url, connect_args=connect_args)
    try:
        insp = sa.inspect(engine)
        result = []
        for name in insp.get_table_names():
            cols = []
            for c in insp.get_columns(name):
                cols.append({
                    "name": c["name"],
                    "type": str(c["type"]),
                    "notNull": c.get("nullable") is False,
                    "pk": bool(c.get("primary_key")),
                })
            result.append({"name": name, "columns": cols})
        return result
    finally:
        engine.dispose()


class SchemaResponse(BaseModel):
    tables: list[dict]
    hint: str = ""


@app.post("/schema", response_model=SchemaResponse)
def get_schema(ds: DataSourcePayload):
    """反射外部数据源的表结构（SQL 库走 SQLAlchemy inspector，SQLite 走 PRAGMA）。"""
    try:
        if ds.type == "sqlite":
            path = ds.database_name or DB_PATH
            if not os.path.isabs(path):
                path = str(BASE_DIR / path)
            tables = _introspect_sqlite_file(path)
        elif ds.type in ("mysql", "postgresql", "sqlserver", "oracle", "db2", "hive", "impala", "vector_pgvector"):
            tables = _introspect_sqlalchemy(ds)
        else:
            # ES / Milvus / DTSQL 无通用表结构，返回空并提示走原生查询
            return SchemaResponse(
                tables=[],
                hint=f"数据源类型 {ds.type} 不支持自动取表结构，请使用其原生查询能力。",
            )
        return SchemaResponse(tables=tables)
    except Exception as e:
        return SchemaResponse(tables=[], hint=f"取表结构失败：{str(e)[:200]}")


@app.post("/exec", response_model=ExecResponse)
def exec_code(req: ExecRequest):
    # Choose preamble: external datasource takes priority over default SQLite
    try:
        if req.datasource and req.datasource.type != "sqlite":
            executor = ExecPythonTool(preamble=build_datasource_preamble(req.datasource), config=_config)
        elif req.datasource and req.datasource.type == "sqlite" and req.datasource.database_name and req.datasource.database_name != DB_PATH:
            executor = ExecPythonTool(preamble=_build_sqlite_file_preamble(req.datasource), config=_config)
        elif req.scope and req.scope.type != "bank":
            executor = _build_executor(req.scope.type, req.scope.managerName, req.scope.branch)
        else:
            executor = _executor_bank
    except Exception as e:
        return ExecResponse(stdout="", stderr=f"数据源配置错误：{e}", charts=[])

    outputs = executor.execute(req.code)
    raw = "\n".join(getattr(o, "text", str(o)) for o in outputs)

    stdout, stderr = raw, ""
    if "\n[stderr]\n" in raw:
        parts = raw.split("\n[stderr]\n", 1)
        stdout, stderr = parts[0].strip(), parts[1].strip()

    clean_stdout, charts = extract_charts(stdout)
    return ExecResponse(stdout=clean_stdout, stderr=stderr, charts=charts)


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("CODEACT_PORT", "8765"))
    uvicorn.run("codeact_server:app", host="127.0.0.1", port=port, reload=False)
