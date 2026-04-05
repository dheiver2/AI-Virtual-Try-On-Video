import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// ─── Replicate helpers ───────────────────────────────────────────────

const REPLICATE_API = 'https://api.replicate.com/v1/predictions';

// IDM-VTON latest version pinned for consistent image try-on quality.
const IDM_VTON_VERSION = '0513734a452173b8173e907e3a59d19a36266e55b48528559432bd21c7d7e985';

// Wan 2.7 VideoEdit official version pinned for high-quality source-video editing.
const WAN_VIDEO_EDIT_VERSION = '0ad0f1fc407db22e7aa41062543caa2e9d58c6f3734c165ab0b27a9f685817ea';
const MAX_WAN_SEGMENT_SECONDS = 10;

type GarmentCategory = 'upper_body' | 'lower_body' | 'dresses';
const execFileAsync = promisify(execFile);
let cachedFfmpegPath: string | null = null;

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

function parseDataUrl(dataUrl: string): { mime: string; buffer: Buffer } {
  const match = dataUrl.match(/^data:(.+?);base64,(.+)$/);
  if (!match) {
    throw new Error('Formato de arquivo inválido. Envie mídia em base64 data URL.');
  }

  return {
    mime: match[1],
    buffer: Buffer.from(match[2], 'base64'),
  };
}

function mimeToExtension(mime: string): string {
  if (mime.includes('quicktime')) return 'mov';
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('ogg')) return 'ogv';
  return 'mp4';
}

async function resolveExecutablePath(
  primaryName: string,
  envOverride?: string,
  extraCandidates: string[] = [],
): Promise<string> {
  const candidates = [
    envOverride,
    primaryName,
    ...extraCandidates,
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Not a direct path; try executing it below.
    }

    try {
      await execFileAsync(candidate, ['-version'], { maxBuffer: 1024 * 1024 * 4 });
      return candidate;
    } catch (error: any) {
      if (error?.code !== 'ENOENT') {
        return candidate;
      }
    }
  }

  throw new Error(
    `Nao foi possivel localizar ${primaryName}. Configure ${primaryName.toUpperCase()}_PATH no .env.local.`,
  );
}

async function getFfmpegPath(): Promise<string> {
  if (cachedFfmpegPath) return cachedFfmpegPath;

  cachedFfmpegPath = await resolveExecutablePath(
    'ffmpeg',
    process.env.FFMPEG_PATH,
    [
      '/usr/bin/ffmpeg',
      '/usr/local/bin/ffmpeg',
      '/mnt/c/Users/dheiver.santos_a3dat/ffmpeg/ffmpeg-8.0.1-essentials_build/bin/ffmpeg.exe',
      '/mnt/c/ffmpeg/bin/ffmpeg.exe',
    ],
  );

  return cachedFfmpegPath;
}

async function runFfmpeg(args: string[]): Promise<void> {
  const ffmpegPath = await getFfmpegPath();
  await execFileAsync(ffmpegPath, ['-y', ...args], { maxBuffer: 1024 * 1024 * 20 });
}

async function readDurationWithFfmpeg(filePath: string): Promise<number> {
  const ffmpegPath = await getFfmpegPath();
  const { stderr } = await execFileAsync(
    ffmpegPath,
    ['-i', filePath],
    { maxBuffer: 1024 * 1024 * 8 },
  ).catch((error: any) => {
    if (typeof error?.stderr === 'string') {
      return { stderr: error.stderr };
    }
    throw error;
  });

  const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!match) {
    throw new Error('Nao foi possivel identificar a duracao do video enviado.');
  }

  const duration =
    Number.parseInt(match[1], 10) * 3600 +
    Number.parseInt(match[2], 10) * 60 +
    Number.parseFloat(match[3]);

  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error('Nao foi possivel identificar a duracao do video enviado.');
  }

  return duration;
}

function buildSegmentPlan(duration: number): Array<{ start: number; length: number }> {
  if (duration <= MAX_WAN_SEGMENT_SECONDS) {
    return [{ start: 0, length: duration }];
  }

  const segments = Math.ceil(duration / MAX_WAN_SEGMENT_SECONDS);
  const segmentLength = duration / segments;

  return Array.from({ length: segments }, (_, index) => ({
    start: index * segmentLength,
    length: Math.min(segmentLength, duration - index * segmentLength),
  })).filter((segment) => segment.length > 0.1);
}

async function splitVideoIntoSegments(
  inputPath: string,
  workDir: string,
  durationHint?: number,
): Promise<string[]> {
  const duration =
    typeof durationHint === 'number' && Number.isFinite(durationHint) && durationHint > 0
      ? durationHint
      : await readDurationWithFfmpeg(inputPath);
  const plan = buildSegmentPlan(duration);
  const segmentPaths: string[] = [];

  for (const [index, segment] of plan.entries()) {
    const outputPath = path.join(workDir, `segment-${index}.mp4`);
    await runFfmpeg([
      '-ss',
      segment.start.toFixed(3),
      '-t',
      segment.length.toFixed(3),
      '-i',
      inputPath,
      '-c:v',
      'libx264',
      '-preset',
      'medium',
      '-crf',
      '18',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-movflags',
      '+faststart',
      outputPath,
    ]);
    segmentPaths.push(outputPath);
  }

  return segmentPaths;
}

async function fileToDataUrl(filePath: string, mime: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

async function concatVideos(inputPaths: string[], outputPath: string, workDir: string): Promise<void> {
  const listFile = path.join(workDir, 'concat-list.txt');
  const content = inputPaths.map((filePath) => `file '${filePath.replace(/'/g, "'\\''")}'`).join('\n');
  await fs.writeFile(listFile, content, 'utf8');

  await runFfmpeg([
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    listFile,
    '-c',
    'copy',
    outputPath,
  ]);
}

// ─── Vite config ─────────────────────────────────────────────────────

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  if (env.FFMPEG_PATH) {
    process.env.FFMPEG_PATH = env.FFMPEG_PATH;
  }

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
              const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'virtual-tryon-'));

              try {
                console.log('[TryOn] ── Etapa 1/3: IDM-VTON (imagem try-on) ──');

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

                if (!tryonImageUrl) {
                  throw new Error('O Replicate nao retornou a imagem de try-on.');
                }

                console.log(`[TryOn] ✓ Imagem try-on gerada: ${tryonImageUrl}`);
                console.log('[TryOn] ── Etapa 2/3: segmentando video de entrada quando necessario ──');

                const source = parseDataUrl(body.sourceVideo);
                const sourcePath = path.join(workDir, `source.${mimeToExtension(source.mime)}`);
                await fs.writeFile(sourcePath, source.buffer);
                const segmentPaths = await splitVideoIntoSegments(
                  sourcePath,
                  workDir,
                  typeof body.sourceVideoDuration === 'number' ? body.sourceVideoDuration : undefined,
                );

                console.log(`[TryOn] ${segmentPaths.length} segmento(s) preparados para edicao.`);
                console.log('[TryOn] ── Etapa 3/3: Wan 2.7 VideoEdit por segmento ──');

                const editedSegmentPaths: string[] = [];

                for (const [index, segmentPath] of segmentPaths.entries()) {
                  console.log(`[TryOn] Editando segmento ${index + 1}/${segmentPaths.length}...`);
                  const segmentDataUrl = await fileToDataUrl(segmentPath, 'video/mp4');

                  const videoPred = await replicateCreate(
                    apiToken,
                    WAN_VIDEO_EDIT_VERSION,
                    {
                      video: segmentDataUrl,
                      reference_image: tryonImageUrl,
                      prompt: buildVideoEditPrompt(body.prompt),
                      resolution: '1080p',
                      aspect_ratio: 'auto',
                      audio_setting: 'origin',
                      seed: 42 + index,
                    },
                  );

                  console.log(`[TryOn] Wan VideoEdit prediction ${index + 1}: ${videoPred.id}`);
                  const videoOutput = await replicatePoll(apiToken, videoPred.id, 900_000);
                  const videoUrl = normalizeReplicateOutput(videoOutput);

                  if (!videoUrl) {
                    throw new Error(`O Replicate nao retornou URL do segmento ${index + 1}.`);
                  }

                  const editedSegmentPath = path.join(workDir, `edited-${index}.mp4`);
                  const editedBuffer = await downloadUrl(videoUrl);
                  await fs.writeFile(editedSegmentPath, editedBuffer);
                  editedSegmentPaths.push(editedSegmentPath);
                }

                const finalOutputPath =
                  editedSegmentPaths.length === 1
                    ? editedSegmentPaths[0]
                    : path.join(workDir, 'final-output.mp4');

                if (editedSegmentPaths.length > 1) {
                  await concatVideos(editedSegmentPaths, finalOutputPath, workDir);
                }

                const videoBuffer = await fs.readFile(finalOutputPath);

                res.statusCode = 200;
                res.setHeader('Content-Type', 'video/mp4');
                res.end(videoBuffer);
              } finally {
                await fs.rm(workDir, { recursive: true, force: true });
              }
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
