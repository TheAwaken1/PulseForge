import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "node:fs";

/**
 * Dev-server middleware: POST /api/save-export
 * Saves the video blob directly to the project's output/ folder.
 * Only active during `vite dev` (Pinokio mode). Tauri export uses its own path.
 */
function saveExportPlugin() {
  return {
    name: 'pulseforge-save-export',
    configureServer(server: any) {
      server.middlewares.use('/api/save-export', (req: any, res: any, next: any) => {
        if (req.method !== 'POST') { next(); return; }
        try {
          const filename = (req.headers['x-filename'] as string) || 'export.webm';
          const outputDir = path.resolve(__dirname, '../output');
          if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
          const filePath = path.join(outputDir, filename);

          const writeStream = fs.createWriteStream(filePath);

          req.pipe(writeStream);

          writeStream.on('finish', () => {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ filename, path: filePath }));
          });

          writeStream.on('error', (e: Error) => {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message }));
          });

          req.on('error', (e: Error) => {
            writeStream.destroy();
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message }));
          });
        } catch (e: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: e.message }));
        }
      });
    },
  };
}

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [react(), saveExportPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  clearScreen: false,
  optimizeDeps: {
    exclude: ['@huggingface/transformers'],
  },
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  build: {
    chunkSizeWarningLimit: 550,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalized = id.replace(/\\/g, "/");

          if (normalized.includes("/src/layers/") || normalized.includes("/src/renderer/")) {
            return "visual-engine";
          }

          const nodeModulesIdx = normalized.lastIndexOf("/node_modules/");
          if (nodeModulesIdx !== -1) {
            const pkgPath = normalized.slice(nodeModulesIdx + "/node_modules/".length);

            if (pkgPath.startsWith("@pixi/")) {
              const parts = pkgPath.split("/");
              return `pixi-${parts[1]}`;
            }
            if (pkgPath.startsWith("pixi.js/")) return "pixi-entry";
          }

          if (normalized.includes("/node_modules/react") || normalized.includes("/node_modules/react-dom")) return "react-vendor";
          if (normalized.includes("/node_modules/@tauri-apps")) return "tauri-vendor";
        },
      },
    },
  },
}));
