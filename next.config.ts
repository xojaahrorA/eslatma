import type { NextConfig } from "next";

// APK_BUILD=1 → Capacitor uchun statik eksport (API routelarsiz, offline ilova)
const isApk = process.env.APK_BUILD === "1";

const nextConfig: NextConfig = isApk
  ? {
      output: "export",
      images: { unoptimized: true },
      typescript: { ignoreBuildErrors: true },
      reactStrictMode: false,
    }
  : {
      output: "standalone",
      /* config options here */
      typescript: {
        ignoreBuildErrors: true,
      },
      reactStrictMode: false,
    };

export default nextConfig;
