import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The "Team" tab was renamed to "My Organization"; its route moved from
  // /team to /organization. Keep old links (bookmarks, open tabs, the
  // member-detail back path) working. Temporary (307) — not cached hard —
  // while the area is still settling.
  async redirects() {
    return [
      { source: "/team", destination: "/organization", permanent: false },
      {
        source: "/team/:path*",
        destination: "/organization/:path*",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
