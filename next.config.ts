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
      // The "Business Success Seminars" (BSS) course was renamed to
      // "MBA Seminars" and its slug moved from bss to mba, so its route moved
      // from /courses/bss/... to /courses/mba/.... Keep old links working.
      { source: "/courses/bss", destination: "/courses/mba", permanent: false },
      {
        source: "/courses/bss/:path*",
        destination: "/courses/mba/:path*",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
