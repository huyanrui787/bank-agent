/**
 * 客户端安全的 SSE 流解析器。
 * 兼容 `\n\n` 与 `\r\n\r\n` 分隔，并在流结束时 flush 残留 buffer。
 * 每个 `data:` 事件解析为 JSON 后 yield。
 */

function* parseSseBlock(block: string): Generator<unknown> {
  for (const line of block.split("\n")) {
    if (!line.startsWith("data:")) continue
    const data = line.slice(5).trim()
    if (!data || data === "[DONE]") continue
    try { yield JSON.parse(data) } catch { /* 忽略无法解析的帧 */ }
  }
}

export async function* readSse(body: ReadableStream<Uint8Array>): AsyncGenerator<unknown> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buf = ""

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n")

    let idx: number
    while ((idx = buf.indexOf("\n\n")) !== -1) {
      yield* parseSseBlock(buf.slice(0, idx))
      buf = buf.slice(idx + 2)
    }
  }

  // flush 末尾残留（无尾部 \n\n 的最后一段）
  yield* parseSseBlock(buf)
}
