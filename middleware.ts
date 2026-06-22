import { NextRequest, NextResponse } from "next/server"
import { verifyAccessToken } from "@/lib/auth/jwt"

const PUBLIC_PATHS = new Set([
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/refresh",
])

// Routes accessible only to specific roles
const ROLE_RESTRICTED: Record<string, string[]> = {
  "/audit": ["branch_admin", "compliance"],
  "/api/audit": ["branch_admin", "compliance"],
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Static assets and Next internals bypass middleware
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/public")
  ) {
    return NextResponse.next()
  }

  // Public routes — no auth needed
  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next()
  }

  const token = request.cookies.get("access_token")?.value
  const payload = token ? await verifyAccessToken(token) : null

  if (!payload) {
    // API routes return 401 JSON; page routes redirect to login
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Unauthorized", code: "NO_SESSION" },
        { status: 401 }
      )
    }
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("next", pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Role-restricted route check
  for (const [prefix, allowedRoles] of Object.entries(ROLE_RESTRICTED)) {
    if (pathname.startsWith(prefix) && !allowedRoles.includes(payload.role)) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Forbidden", code: "INSUFFICIENT_ROLE" }, { status: 403 })
      }
      return NextResponse.redirect(new URL("/", request.url))
    }
  }

  // Inject user context into downstream request headers
  // encodeURIComponent is required for non-ASCII values (Chinese names, branch names)
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-user-id",         payload.sub)
  requestHeaders.set("x-user-name",        encodeURIComponent(payload.name))
  requestHeaders.set("x-user-role",        payload.role)
  requestHeaders.set("x-user-branch",      encodeURIComponent(payload.branch ?? ""))
  requestHeaders.set("x-user-grid",        encodeURIComponent(payload.grid ?? ""))
  requestHeaders.set("x-user-manager-id",  payload.managerId ?? "")
  requestHeaders.set("x-request-id",       crypto.randomUUID())

  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
