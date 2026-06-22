import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // 允许通过公网 IP / 域名访问 dev 模式（否则客户端 JS 无法加载，登录等交互失效）
  allowedDevOrigins: [
    "aidemo.asunamage.xyz",
    "39.107.136.1",
    "39.107.136.1:3000",
  ],
}

export default nextConfig
