import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Server-side PDF export (src/app/api/pdf) drives headless Chrome; load it with plain require.
  serverExternalPackages: ["puppeteer"],
  async redirects() {
    return [
      {
        source: "/user-groups",
        destination: "/users",
        permanent: false,
      },
      {
        source: "/user-grouping",
        destination: "/users",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
