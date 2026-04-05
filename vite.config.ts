import fs from 'fs';
import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// ─── Replicate helpers ───────────────────────────────────────────────

const REPLICATE_API = 'https://api.replicate.com/v1/predictions';

// IDM-VTON: imagem pessoa + imagem roupa → imagem pessoa vestida
const IDM_VTON_VERSION = '0513734a452173b8173e907e3a59d19a36266e55b48528559432bd21c7d7e985';

// Stable Video Diffusion: imagem → vídeo animado
const SVD_VERSION = '3f0457e4619daac51203dedb472816fd4af51f3149fa7a9e0b5ffcf1b8172438';

interface PredictionResult {
  id: string;
  status: string;
  output: any;
  error: string | null;
}

async function replicateCreate(
  apiToken: string,
  version: string,
  input: Record<string, any>,
): Promise<PredictionResult> {
  const resp = await fetch(REPLICATE_API, {
    method: 'POST',
    headers: {
      Authorization: `Token ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ version, input }),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Replicate create falhou (${resp.status}): ${txt}`);
  }
  return resp.json() as Promise<PredictionResult>;
}

async function replicatePoll(
  apiToken: string,
  predictionId: string,
  maxWaitMs = 300_000,
): Promise<any> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    await new Promise((r) => setTimeout(r, 3000));
    const resp = await fetch(`${REPLICATE_API}/${predictionId}`, {
      headers: { Authorization: `Token ${apiToken}` },
    });
    if (!resp.ok) throw new Error(`Replicate poll falhou (${resp.status})`);
    const data = (await resp.json()) as PredictionResult;
    if (data.status === 'succeeded') return data.output;
    if (data.status === 'failed' || data.status === 'canceled') {
      throw new Error(`Replicate ${data.status}: ${data.error || 'erro desconhecido'}`);
    }
  }
  throw new Error('Timeout: processamento excedeu 5 minutos');
}

async function downloadUrl(url: string): Promise<Buffer> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Download falhou (${resp.status}): ${url}`);
  return Buffer.from(await resp.arrayBuffer());
}

// ─── Vite config ─────────────────────────────────────────────────────

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'virtual-tryon-api',
        configureServer(server) {
          // ── POST /api/generate-video ──────────────────────────────
          server.middlewares.use('/api/generate-video', async (req, res) => {
            if (req.method !== 'POST') {
              res.statusCode = 405;
              res.end('Method Not Allowed');
              return;
            }

            try {
              const chunks: Buffer[] = [];
              for await (const chunk of req) chunks.push(chunk as Buffer);
              const body = JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}');

              // ── validação ──
              const apiToken = env.REPLICATE_API_TOKEN || process.env.REPLICATE_API_TOKEN;
              if (!apiToken) {
                res.statusCode = 400;
                res.end('Configure REPLICATE_API_TOKEN no .env.local');
                return;
              }
              if (!body.garmentImage || !body.firstFrame) {
                res.statusCode = 400;
                res.end('garmentImage e firstFrame são obrigatórios.');
                return;
              }

              console.log('[TryOn] ── Etapa 1/2: IDM-VTON (imagem try-on) ──');

              // ── ETAPA 1: IDM-VTON – gerar imagem da pessoa com a roupa ──
              const tryonPred = await replicateCreate(apiToken, IDM_VTON_VERSION, {
                human_img: body.firstFrame,       // data:image/jpeg;base64,...
                garm_img: body.garmentImage,       // data:image/jpeg;base64,...
                garment_des: body.prompt || 'Clothing item to try on',
                category: 'upper_body',
                crop: true,                        // ajusta aspecto automaticamente
                steps: 30,
                seed: 42,
              });

              console.log(`[TryOn] IDM-VTON prediction: ${tryonPred.id}`);
              const tryonOutput = await replicatePoll(apiToken, tryonPred.id);
              // tryonOutput é uma URL de imagem
              const tryonImageUrl: string =
                typeof tryonOutput === 'string' ? tryonOutput : tryonOutput[0] || tryonOutput;

              console.log(`[TryOn] ✓ Imagem try-on gerada: ${tryonImageUrl}`);
              console.log('[TryOn] ── Etapa 2/2: SVD (imagem → vídeo) ──');

              // ── ETAPA 2: Stable Video Diffusion – animar a imagem ──
              const videoPred = await replicateCreate(apiToken, SVD_VERSION, {
                input_image: tryonImageUrl,
                sizing_strategy: 'maintain_aspect_ratio',
                frames_per_second: 6,
                motion_bucket_id: 127,
                cond_aug: 0.02,
              });

              console.log(`[TryOn] SVD prediction: ${videoPred.id}`);
              const videoOutput = await replicatePoll(apiToken, videoPred.id);
              const videoUrl: string =
                typeof videoOutput === 'string' ? videoOutput : videoOutput[0] || videoOutput;

              console.log(`[TryOn] ✓ Vídeo gerado: ${videoUrl}`);

              // ── download e envio ──
              const videoBuffer = await downloadUrl(videoUrl);

              res.statusCode = 200;
              res.setHeader('Content-Type', 'video/mp4');
              res.end(videoBuffer);
            } catch (error: any) {
              console.error('[TryOn] ERRO:', error.message);
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
