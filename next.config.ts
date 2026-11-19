import type { NextConfig } from "next";
const config: NextConfig = {
  async headers() {
    const paths = ["/cart", "/checkout", "/login", "/account", "/orders/:path*", "/admin/:path*", "/payment/:path*"];
    return paths.map(source => ({ source, headers: [{ key: "X-Robots-Tag", value: "noindex" }] }));
  },
  devIndicators: false,
  agentRules: false,
  turbopack: { root: process.cwd() },
  outputFileTracingExcludes: { "/*": ["./data/**"] },
};
export default config;