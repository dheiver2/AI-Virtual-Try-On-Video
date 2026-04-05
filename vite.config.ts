import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// ─── Replicate helpers ───────────────────────────────────────────────

const REPLICATE_API = 'https://api.replicate.com/v1/predictions';

// IDM-VTON latest version pinned for consistent image try-on quality.
const IDM_VTON_VERSION = '0513734a452173b8173e907e3a59d19a36266e55b48528559432bd21c7d7e985';

// Wan 2.7 VideoEdit official version pinned for high-quality source-video editing.
const WAN_VIDEO_EDIT_VERSION = '0ad0f1fc407db22e7aa41062543caa2e9d58c6f3734c165ab0b27a9f685817ea';

type GarmentCategory = 'upper_body' | 'lower_body' | 'dresses';

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
      Authorization: `Bearer ${apiToken}`,
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
  maxWaitMs = 900_000,
): Promise<any> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    await new Promise((r) => setTimeout(r, 3000));
    const resp = await fetch(`${REPLICATE_API}/${predictionId}`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });
    if (!resp.ok) throw new Error(`Replicate poll falhou (${resp.status})`);
    const data = (await resp.json()) as PredictionResult;
    if (data.status === 'succeeded') return data.output;
    if (data.status === 'failed' || data.status === 'canceled') {
      throw new Error(`Replicate ${data.status}: ${data.error || 'erro desconhecido'}`);
    }
  }
  throw new Error('Timeout: processamento excedeu 15 minutos');
}

async function downloadUrl(url: string): Promise<Buffer> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Download falhou (${resp.status}): ${url}`);
  return Buffer.from(await resp.arrayBuffer());
}

function normalizeReplicateOutput(output: unknown): string {
  if (typeof output === 'string') return output;
  if (Array.isArray(output)) return String(output[0] ?? '');
  return String(output ?? '');
}

function buildGarmentDescription(category: GarmentCategory, notes?: string): string {
  const base =
    category === 'dresses'
      ? 'dress with the exact silhouette, fabric behavior, color, neckline, hem, logos, and patterns from the garment image'
      : category === 'lower_body'
        ? 'bottom garment with the exact cut, length, fit, texture, waistband, logos, and patterns from the garment image'
        : 'top garment with the exact silhouette, sleeve length, neckline, fit, texture, logos, and patterns from the garment image';

  return [base, notes?.trim()].filter(Boolean).join('. ');
}

function buildVideoEditPrompt(notes?: string): string {
  const instructions = [
    'Edit only the main subject clothing so it matches the provided reference image exactly',
    'Preserve the original face, identity, body shape, pose timing, camera motion, lighting, and background',
    'Keep the same action and choreography from the input video',
    'Do not redesign the outfit, do not change the scene, and do not distort the body',
    'Maintain realistic garment drape and fabric details',
  ];

  if (notes?.trim()) {
    instructions.push(notes.trim());
  }

  return instructions.join('. ');
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
              if (!body.garmentImage || !body.firstFrame || !body.sourceVideo) {
                res.statusCode = 400;
                res.end('garmentImage, firstFrame e sourceVideo são obrigatórios.');
                return;
              }

              const garmentCategory: GarmentCategory =
                body.garmentCategory === 'lower_body' || body.garmentCategory === 'dresses'
                  ? body.garmentCategory
                  : 'upper_body';

              console.log('[TryOn] ── Etapa 1/2: IDM-VTON (imagem try-on) ──');

              // First, create a high-fidelity try-on still from the original first frame.
              const tryonPred = await replicateCreate(apiToken, IDM_VTON_VERSION, {
                human_img: body.firstFrame,
                garm_img: body.garmentImage,
                garment_des: buildGarmentDescription(garmentCategory, body.prompt),
                category: garmentCategory,
                crop: true,
                steps: 40,
                seed: 42,
              });

              console.log(`[TryOn] IDM-VTON prediction: ${tryonPred.id}`);
              const tryonOutput = await replicatePoll(apiToken, tryonPred.id);
              const tryonImageUrl = normalizeReplicateOutput(tryonOutput);

              console.log(`[TryOn] ✓ Imagem try-on gerada: ${tryonImageUrl}`);
              console.log('[TryOn] ── Etapa 2/2: Wan 2.7 VideoEdit (video original editado) ──');

              // Then edit the original source video so motion and scene stay intact.
              const videoPred = await replicateCreate(
                apiToken,
                WAN_VIDEO_EDIT_VERSION,
                {
                  video: body.sourceVideo,
                  reference_image: tryonImageUrl,
                  prompt: buildVideoEditPrompt(body.prompt),
                  resolution: '1080p',
                  aspect_ratio: 'auto',
                  audio_setting: 'origin',
                  seed: 42,
                },
              );

              console.log(`[TryOn] Wan VideoEdit prediction: ${videoPred.id}`);
              const videoOutput = await replicatePoll(apiToken, videoPred.id, 900_000);
              const videoUrl = normalizeReplicateOutput(videoOutput);

              if (!videoUrl) {
                throw new Error('O Replicate nao retornou URL de video.');
              }

              console.log(`[TryOn] ✓ Vídeo editado: ${videoUrl}`);

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
