import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import dotenv from 'dotenv';
import { handleNoirApiRequest } from './server/apiHandler';

dotenv.config();

function noirApiProxyPlugin(): Plugin {
  const apiMiddleware = async (
    req: import('node:http').IncomingMessage,
    res: import('node:http').ServerResponse,
    next: () => void
  ) => {
    try {
      const handled = await handleNoirApiRequest(req, res);
      if (!handled) {
        next();
      }
    } catch (error) {
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(
          JSON.stringify({
            error: error instanceof Error ? error.message : 'Internal NOIR API error.',
          })
        );
      } else if (!res.writableEnded) {
        res.end();
      }
    }
  };

  return {
    name: 'noir-api-proxy',
    configureServer(server) {
      server.middlewares.use(apiMiddleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(apiMiddleware);
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), noirApiProxyPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    host: 'localhost',
  },
  preview: {
    port: 5173,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          motion: ['framer-motion'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
});
