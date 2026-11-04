import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Browser tests run their own dev server beside the normal one. `next dev`
  // refuses to start twice on the same build directory (it locks
  // <distDir>/dev/lock), so the E2E runner sets NEXT_DIST_DIR to a separate
  // directory. Unset (every normal run), this is the default ".next".
  distDir: process.env.NEXT_DIST_DIR || ".next",
  /* config options here */
  experimental: {
    agentFeedback: true,
    // Enables forbidden() so signed-in users with the wrong role get a 403.
    authInterrupts: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
