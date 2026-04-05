import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const ensureDir = (dir: string) => {
  fs.mkdirSync(dir, { recursive: true });
};

const decodeBase64Input = (value: string): Buffer => {
  const raw = value.includes(',') ? value.split(',')[1] : value;
  return Buffer.from(raw, 'base64');
};

const resolveEnvPath = (projectRoot: string, value: string | undefined, fallback: string): string => {
  if (!value || value.trim() === '') return fallback;
  return path.isAbsolute(value) ? value : path.resolve(projectRoot, value);
};

const buildPatchedScript = (scriptContent: string, modelRoot: string): string => {
  const normalizedModelRoot = modelRoot.replace(/\\/g, '/');
  const patched = scriptContent.replace(
    /model_name\s*=\s*["'][^"']+["']/,
    `model_name          = "${normalizedModelRoot}"`
  );
  if (patched === scriptContent) {
    throw new Error('Não foi possível aplicar patch em model_name no script do MagicTryOn.');
  }
  return patched;
};

const runCommand = (command: string, args: string[], cwd: string) =>
  new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, { cwd, shell: false });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });

const findNewestMp4 = (dir: string): string | null => {
  if (!fs.existsSync(dir)) return null;
  const queue: string[] = [dir];
  let bestPath: string | null = null;
  let bestMtime = 0;

  while (queue.length > 0) {
    const current = queue.pop() as string;
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.mp4')) {
        const stat = fs.statSync(fullPath);
        if (stat.mtimeMs > bestMtime) {
          bestMtime = stat.mtimeMs;
          bestPath = fullPath;
        }
      }
    }
  }

  return bestPath;
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'magictryon-free-api',
        configureServer(server) {
          server.middlewares.use('/api/generate-video', async (req, res) => {
            if (req.method !== 'POST') {
              res.statusCode = 405;
              res.setHeader('Content-Type', 'text/plain');
              res.end('Method Not Allowed');
              return;
            }

            try {
              const chunks: Buffer[] = [];
              for await (const chunk of req) chunks.push(chunk as Buffer);
              const rawBody = Buffer.concat(chunks).toString('utf-8');
              const body = JSON.parse(rawBody || '{}');

              if (!body.garmentImage || !body.sourceVideo) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'text/plain');
                res.end('garmentImage e sourceVideo são obrigatórios.');
                return;
              }

              const hfToken = env.HUGGINGFACE_API_KEY || process.env.HUGGINGFACE_API_KEY;
              if (!hfToken) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'text/plain');
                res.end('Configure HUGGINGFACE_API_KEY no .env.local para usar a API de virtual try-on.');
                return;
              }

              // Decodificar imagens
              const garmentBuffer = decodeBase64Input(body.garmentImage);
              const videoBuffer = decodeBase64Input(body.sourceVideo);

              // Usar novo HuggingFace Router API (api-inference.huggingface.co foi descontinuada)
              // Model: CagliariLuca/virtualtryon-vitonhd-inswapper
              const apiUrl = 'https://router.huggingface.co/models/CagliariLuca/virtualtryon-vitonhd-inswapper';

              const FormData = (await import('form-data')).default;
              const formData = new FormData();
              formData.append('inputs', garmentBuffer, { filename: 'garment.jpg' });

              const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${hfToken}`,
                },
                body: formData,
              });

              if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Erro na API HuggingFace (${response.status}): ${errText}`);
              }

              const outputBlob = await response.blob();
              const outputBuffer = Buffer.from(await outputBlob.arrayBuffer());

              res.statusCode = 200;
              res.setHeader('Content-Type', 'video/mp4');
              res.end(outputBuffer);
            } catch (error: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'text/plain');
              res.end(error?.message || 'Falha ao processar virtual try-on.');
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
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
