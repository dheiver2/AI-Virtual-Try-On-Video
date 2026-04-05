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

              const apiToken = env.REPLICATE_API_TOKEN || process.env.REPLICATE_API_TOKEN;
              if (!apiToken) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'text/plain');
                res.end('Configure REPLICATE_API_TOKEN no .env.local para usar a API de virtual try-on.');
                return;
              }

              // Usar Replicate API - mais confiável para virtual try-on
              // Model: cuuupid/idm-vton (estado-da-arte em virtual try-on)
              const replicateApiUrl = 'https://api.replicate.com/v1/predictions';

              // Enviar para Replicate
              const prediction = await fetch(replicateApiUrl, {
                method: 'POST',
                headers: {
                  'Authorization': `Token ${apiToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model: 'cuuupid/idm-vton',
                  input: {
                    human_img: body.garmentImage, // Imagem da pessoa
                    garm_img: body.garmentImage,  // Imagem da roupa
                  },
                }),
              });

              if (!prediction.ok) {
                const errText = await prediction.text();
                throw new Error(`Erro ao iniciar processamento (${prediction.status}): ${errText}`);
              }

              const predictionData = await prediction.json() as any;
              const predictionId = predictionData.id;

              // Aguardar resultado (máx 300 segundos)
              let result: any = null;
              let attempts = 0;
              const maxAttempts = 60; // 60 tentativas x 5 segundos = 5 minutos

              while (attempts < maxAttempts) {
                await new Promise(r => setTimeout(r, 5000)); // Aguardar 5 segundos

                const statusResponse = await fetch(`${replicateApiUrl}/${predictionId}`, {
                  headers: { 'Authorization': `Token ${apiToken}` },
                });

                if (!statusResponse.ok) {
                  throw new Error(`Erro ao verificar status (${statusResponse.status})`);
                }

                const status = await statusResponse.json();

                if (status.status === 'succeeded') {
                  result = status.output;
                  break;
                } else if (status.status === 'failed') {
                  throw new Error(`Processamento falhou: ${status.error || 'Erro desconhecido'}`);
                }

                attempts++;
              }

              if (!result) {
                throw new Error('Timeout: processamento levou muito tempo');
              }

              // Fazer download do resultado
              const outputResponse = await fetch(result[0] || result);
              if (!outputResponse.ok) {
                throw new Error(`Erro ao baixar resultado (${outputResponse.status})`);
              }

              const outputBuffer = Buffer.from(await outputResponse.arrayBuffer());

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
