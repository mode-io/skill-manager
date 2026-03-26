import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

function normalizeBase(value: string | undefined, fallback: string): string {
  const trimmed = (value ?? fallback).trim();
  if (trimmed === "" || trimmed === "/") {
    return "";
  }
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const apiOrigin = env.VITE_API_ORIGIN ?? "http://127.0.0.1:8000";
  const apiBase = normalizeBase(env.VITE_API_BASE, "/api");

  return {
    root: "frontend",
    plugins: [react()],
    server: {
      host: "127.0.0.1",
      port: 5173,
      strictPort: true,
      proxy:
        apiBase === ""
          ? undefined
          : {
              [apiBase]: {
                target: apiOrigin,
                changeOrigin: true,
                rewrite: (path) => path.replace(new RegExp(`^${apiBase}`), ""),
              },
            },
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
    },
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["./src/test/setup.ts"],
      include: ["src/**/*.test.tsx"],
    },
  };
});
