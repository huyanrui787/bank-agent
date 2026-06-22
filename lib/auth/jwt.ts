import { SignJWT, jwtVerify } from "jose"
import { randomUUID } from "crypto"

const secret = () => {
  const s = process.env.JWT_SECRET
  if (!s) throw new Error("JWT_SECRET is not set")
  return new TextEncoder().encode(s)
}

export type AccessTokenPayload = {
  sub: string       // users.id
  name: string      // display_name
  role: "manager" | "sub_branch_head" | "branch_admin" | "compliance" | "readonly"
  branch: string | null
  grid: string | null
  managerId: string | null
  orgId: string
  jti: string
}

export type RefreshTokenPayload = {
  sub: string
  jti: string
}

export async function signAccessToken(user: Omit<AccessTokenPayload, "jti" | "orgId">): Promise<string> {
  const payload: AccessTokenPayload = {
    ...user,
    orgId: "xian_branch",
    jti: randomUUID(),
  }
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(secret())
}

export async function signRefreshToken(userId: string): Promise<{ token: string; jti: string }> {
  const jti = randomUUID()
  const token = await new SignJWT({ sub: userId, jti } as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret())
  return { token, jti }
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret())
    return payload as unknown as AccessTokenPayload
  } catch {
    return null
  }
}

export async function verifyRefreshToken(token: string): Promise<RefreshTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret())
    return payload as unknown as RefreshTokenPayload
  } catch {
    return null
  }
}
