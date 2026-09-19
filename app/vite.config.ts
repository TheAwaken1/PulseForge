import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "node:fs";
import { spawn } from "node:child_process";

function safeExportName(value: string): string {
  const baseName = path.basename(value).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
  return !baseName || baseName === '.' || baseName === '..' ? 'export.mp4' : baseName;
}

function removeFile(filePath: string): void {
  fs.rm(filePath, { force: true }, () => {});
}

/**
 * Chromium records MP4 as a fragmented stream when MediaRecorder uses a
 * timeslice. Copying the streams through FFmpeg turns those fragments into a
 * normal indexed MP4 without re-encoding, so desktop players can display the
 * duration and seek immediately.
 */
function finalizeRecording(inputPath: string, outputPath: string, extension: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = ['-y', '-v', 'error', '-i', inputPath, '-map', '0', '-c', 'copy'];
    if (extension === '.mp4') args.push('-movflags', '+faststart');
    args.push(outputPath);

    const ffmpeg = spawn('ffmpeg', args, { windowsHide: true });
    let stderr = '';
    ffmpeg.stderr.on('data', (chunk) => {
      stderr = (stderr + chunk.toString()).slice(-16_384);
    });
    ffmpeg.on('error', (error) => reject(new Error(`Could not start FFmpeg: ${error.message}`)));
    ffmpeg.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg could not finalize the video${stderr ? `: ${stderr.trim()}` : ''}`));
    });
  });
}

/**
 * Dev-server middleware: POST /api/save-export
 * Saves the video blob directly to the project's output/ folder.
 * Only active during `vite dev` (Pinokio mode). Tauri export uses its own path.
 */
function saveExportPlugin() {
  return {
    name: 'pulseforge-save-export',
    configureServer(server: any) {
      server.middlewares.use('/api/download-export', (req: any, res: any, next: any) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') { next(); return; }
        try {
          const requestUrl = new URL(req.url || '/', 'http://localhost');
          const requestedName = requestUrl.searchParams.get('filename');
          if (!requestedName) {
            res.statusCode = 400;
            res.end('Missing filename');
            return;
          }

          const filename = safeExportName(requestedName);
          const outputDir = path.resolve(__dirname, '../output');
          const filePath = path.join(outputDir, filename);
          if (!fs.existsSync(filePath)) {
            res.statusCode = 404;
            res.end('Export not found');
            return;
          }

          const stat = fs.statSync(filePath);
          res.setHeader('Content-Type', path.extname(filename).toLowerCase() === '.webm' ? 'video/webm' : 'video/mp4');
          res.setHeader('Content-Length', String(stat.size));
          res.setHeader('Content-Disposition', `attachment; filename="${filename.replace(/"/g, '')}"`);
          if (req.method === 'HEAD') {
            res.end();
          } else {
            const readStream = fs.createReadStream(filePath);
            readStream.on('error', (error) => {
              if (!res.headersSent) res.statusCode = 500;
              res.end(error.message || 'Could not read export');
            });
            readStream.pipe(res);
          }
        } catch (error: any) {
          res.statusCode = 500;
          res.end(error.message || 'Could not download export');
        }
      });

      server.middlewares.use('/api/save-export', (req: any, res: any, next: any) => {
        if (req.method !== 'POST') { next(); return; }
        try {
          const filename = safeExportName((req.headers['x-filename'] as string) || 'export.webm');
          const outputDir = path.resolve(__dirname, '../output');
          if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
          const filePath = path.join(outputDir, filename);
          const extension = path.extname(filename).toLowerCase();
          const recordingPath = path.join(
            outputDir,
            `.recording-${process.pid}-${Date.now()}${extension || '.tmp'}`,
          );

          const writeStream = fs.createWriteStream(recordingPath);
          let uploadFailed = false;

          req.pipe(writeStream);

          writeStream.on('close', async () => {
            if (uploadFailed) return;
            try {
              await finalizeRecording(recordingPath, filePath, extension);
              removeFile(recordingPath);
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                filename,
                path: filePath,
                downloadUrl: `/api/download-export?filename=${encodeURIComponent(filename)}`,
              }));
            } catch (error: any) {
              removeFile(recordingPath);
              removeFile(filePath);
              res.statusCode = 500;
              res.end(JSON.stringify({ error: error.message || 'Could not finalize export' }));
            }
          });

          writeStream.on('error', (e: Error) => {
            uploadFailed = true;
            removeFile(recordingPath);
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message }));
          });

          req.on('error', (e: Error) => {
            uploadFailed = true;
            writeStream.destroy();
            removeFile(recordingPath);
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
