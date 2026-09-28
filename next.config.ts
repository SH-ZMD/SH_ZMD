import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  async redirects() {
    if (process.env.PRIMARY_DOMAIN_READY !== "true") return [];
    return [{ source: "/:path*", has: [{ type: "host", value: "sh-zmd.vercel.app" }], destination: "https://www.xinghuisama.top/:path*", permanent: true }];
  },
  async headers() {
    // 开发模式下 Next 用 eval-source-map 打包，模块靠 eval() 执行；
    // 少了 'unsafe-eval' 会被 CSP 全部拦下，导致 React 无法 hydrate、整站空白。
    const isDev = process.env.NODE_ENV === "development";
    const scriptSrc = isDev
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com"
      : "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com";
    const contentSecurityPolicy = [
      "default-src 'self'", "base-uri 'self'", "frame-ancestors 'none'", "form-action 'self'", "object-src 'none'",
      scriptSrc, "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:", "media-src 'self' blob: https:", "connect-src 'self' https:",
      "frame-src https://challenges.cloudflare.com", "font-src 'self' data:", "upgrade-insecure-requests",
    ].join('; ');
    return [{ source: "/:path*", headers: [
      { key: "Content-Security-Policy", value: contentSecurityPolicy },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
      { key: "X-Frame-Options", value: "DENY" },
    ] }];
  },
};

export default nextConfig;
