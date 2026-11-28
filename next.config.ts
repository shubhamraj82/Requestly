import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["ws"],
  reactCompiler: true,
  logging: { incomingRequests: { ignore: [/^\/invite\//] } },
};

export default nextConfig;
