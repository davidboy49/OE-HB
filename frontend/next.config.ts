import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
