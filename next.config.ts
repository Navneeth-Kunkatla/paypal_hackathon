import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // cacheComponents is off: the page is a live dashboard, and useChat/AG Grid
  // generate random ids at render, which prerendering rejects.
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
