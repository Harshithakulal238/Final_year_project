
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  nitro: {
    preset: "node-server",
  },
  vite: {
    server: {
      proxy: {
        "/api/auth": {
          target: "http://localhost:5000",
          changeOrigin: true,
        },
        "/api/recommend": {
          target: "http://localhost:5001",
          changeOrigin: true,
        },
        "/api/schemes": {
          target: "http://localhost:5001",
          changeOrigin: true,
        },
      },
    },
  },
  tanstackStart: {
    server: {
      entry: "src/server.ts",
    },
  },
});
