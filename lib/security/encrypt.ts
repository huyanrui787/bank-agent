import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto"

/**
 * 敏感字段（数据源密码等）的 AES-256-GCM 加密。
 * 密钥从 ENCRYPTION_KEY 派生（未设置时回退 JWT_SECRET）。
 * 密文格式：`<iv b64>:<authTag b64>:<ciphertext b64>`。
 * 兼容旧数据：若字段里没有 `:` 分隔符，按 legacy base64 直接解码。
 */

function deriveKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET
  if (!secret) throw new Error("ENCRYPTION_KEY/JWT_SECRET is not set")
  return createHash("sha256").update(secret).digest()
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", deriveKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv.toString("base64"), tag.toString("base64"), ciphertext.toString("base64")].join(":")
}

export function decryptSecret(enc: string | null | undefined): string | undefined {
  if (!enc) return undefined
  const parts = enc.split(":")
  if (parts.length !== 3) {
    // legacy plain base64
    try { return Buffer.from(enc, "base64").toString("utf8") } catch { return undefined }
  }
  const [ivB64, tagB64, ctB64] = parts
  try {
    const decipher = createDecipheriv("aes-256-gcm", deriveKey(), Buffer.from(ivB64, "base64"))
    decipher.setAuthTag(Buffer.from(tagB64, "base64"))
    return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64")), decipher.final()]).toString("utf8")
  } catch {
    return undefined
  }
}
