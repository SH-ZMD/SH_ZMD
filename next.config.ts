import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  async redirects() {
    if (process.env.PRIMARY_DOMAIN_READY !== "true") return [];
    return [{ source: "/:path*", has: [{ type: "host", value: "sh-zmd-sh-zmd-s-projects.vercel.app" }], destination: "https://5487210.xyz/:path*", permanent: true }];
  },
  async headers() {
    const contentSecurityPolicy = [
      "default-src 'self'", "base-uri 'self'", "frame-ancestors 'none'", "form-action 'self'", "object-src 'none'",
      "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com", "style-src 'self' 'unsafe-inline'",
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
