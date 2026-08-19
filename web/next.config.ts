import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

const createNextConfig = (phase: string): NextConfig => {
  const isDev = phase === PHASE_DEVELOPMENT_SERVER;
  return {
    reactCompiler: true,
    ...(isDev
      ? {
          rewrites: () => [
            { source: "/api/:path*", destination: "http://localhost:8080/api/:path*" },
          ],
        }
      : {
          output: "export" as const,
          assetPrefix: "./",
        }),
  };
};

export default createNextConfig;

