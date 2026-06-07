import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

import { fileURLToPath } from "url";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const isRemote = env.VITE_BACKEND === "remote";
  const apiKey = env.VITE_API_KEY || "";
  // Remote backend target (no hardcoded host). Set VITE_REMOTE_TARGET in .env.
  const remoteTarget = env.VITE_REMOTE_TARGET || "http://localhost:3400";
  const localTarget = env.VITE_LOCAL_TARGET || "http://localhost:3400";

  return {
    plugins: [react()],
    optimizeDeps: {
      esbuildOptions: {
        loader: {
          ".js": "jsx",
        },
      },
    },
    define: {
      "process.env.IS_PREACT": JSON.stringify("true"),
    },
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
        "@config": path.resolve(__dirname, "./src/components/config"),
        "@services": path.resolve(__dirname, "./src/services"),
        "@components": path.resolve(__dirname, "./src/components"),
        "@contexts": path.resolve(__dirname, "./src/contexts"),
      },
    },
    server: {
      port: 5400,
      proxy: isRemote
        ? {
            "/api/reid": {
              target: remoteTarget,
              changeOrigin: true,
              secure: false,
              headers: { "x-api-key": apiKey },
              rewrite: (path) => path.replace(/^\/api\/reid/, "/api/v1/reid"),
            },
            "/api/tiles": {
              target: remoteTarget,
              changeOrigin: true,
              secure: false,
              headers: { "x-api-key": apiKey },
              rewrite: (path) => path.replace(/^\/api\/tiles/, "/api/v1/tiles"),
            },
            "/socket.io": {
              target: remoteTarget,
              changeOrigin: true,
              secure: false,
              ws: true,
              headers: { "x-api-key": apiKey },
              rewrite: (path) => `/reid-analytics${path}`,
            },
          }
        : {
            "/api": {
              target: localTarget,
              changeOrigin: true,
            },
            "/socket.io": {
              target: localTarget,
              changeOrigin: true,
              ws: true,
            },
          },
    },
    extensions: [".js", ".ts", ".jsx", ".tsx", ".json", ".png"],
  };
});
