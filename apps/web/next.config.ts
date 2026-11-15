import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Paket kontrak (@openomr/schemas) menahan TypeScript mentah, jadi harus
  // dikompilasi Next. Docs: node_modules/next/dist/docs/.../transpilePackages.md
  transpilePackages: ["@openomr/schemas"],
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
