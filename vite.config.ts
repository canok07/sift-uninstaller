import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vite';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(() => {
  return {
    // Electron loadFile() ile açıldığında asset'lerin C:\\assets yerine
    // index.html'e göre çözülmesini sağlar.
    base: './',
    plugins: [react(), tailwindcss(), {
      name: 'packaged-csp',
      apply: 'build',
      transformIndexHtml(html) {
        return html.replace("connect-src 'self' ws://127.0.0.1:3000 ws://localhost:3000", "connect-src 'none'");
      }
    }, {
      name: 'trusted-loopback-development-csp', apply: 'serve',
      transformIndexHtml(html) { return html.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'"); }
    }],
    resolve: {
      alias: {
        '@': projectRoot,
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
