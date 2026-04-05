import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'hf-video-api',
        configureServer(server) {
          server.middlewares.use('/api/generate-video', async (req, res) => {
            if (req.method !== 'POST') {
              res.statusCode = 405;
              res.setHeader('Content-Type', 'text/plain');
              res.end('Method Not Allowed');
              return;
            }

            const apiKey = env.HF_API_KEY || env.VITE_HF_API_KEY;
            if (!apiKey) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'text/plain');
              res.end('HF_API_KEY (ou VITE_HF_API_KEY) não configurada no .env.local');
              return;
            }

            try {
              const chunks: Buffer[] = [];
              for await (const chunk of req) {
                chunks.push(chunk as Buffer);
              }
              const rawBody = Buffer.concat(chunks).toString('utf-8');
              const body = JSON.parse(rawBody || '{}');
              const model = body.model || 'ali-vilab/i2vgen-xl';
              const hfResponse = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${apiKey}`,
                  'Content-Type': 'application/json',
                  Accept: 'video/mp4',
                  'x-use-cache': 'false',
                  'x-wait-for-model': 'true',
                },
                body: JSON.stringify({
                  inputs: body.inputs,
                  parameters: body.parameters || {},
                  options: {
                    wait_for_model: true,
                    use_cache: false,
                  },
                }),
              });

              if (!hfResponse.ok) {
                const errorText = await hfResponse.text();
                res.statusCode = hfResponse.status;
                res.setHeader('Content-Type', 'text/plain');
                res.end(errorText);
                return;
              }

              const contentType = hfResponse.headers.get('content-type') || 'video/mp4';
              const arrayBuffer = await hfResponse.arrayBuffer();
              res.statusCode = 200;
              res.setHeader('Content-Type', contentType);
              res.end(Buffer.from(arrayBuffer));
            } catch (error: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'text/plain');
              res.end(error?.message || 'Falha ao processar vídeo.');
            }
          });
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify-file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
