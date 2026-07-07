#!/usr/bin/env node
/**
 * EternalBeing preview — media ingest pipeline.
 *
 * Downloads curated clips (yt-dlp), cuts short windows (ffmpeg), and bakes two
 * time-aligned reels: public/media/fruit-reel.mp4 and public/media/flesh-reel.mp4.
 * Each of the 9 sections is exactly SECTION_SEC long in both reels, so holding
 * can swap layers at the same timecode. Slots without curated links (or with
 * failed downloads) get generated placeholder segments.
 *
 * NOTE: downloaded footage is for private prototyping only (see docs/PRD.md §9).
 *
 * Usage: node scripts/ingest.mjs [--placeholders-only]
 */
import { execFileSync, execFile } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
import { promisify } from 'node:util';
import path from 'node:path';

const execFileP = promisify(execFile);

const ROOT = path.resolve(import.meta.dirname, '..');
const CACHE = path.join(ROOT, 'media-cache');
const SEGS = path.join(CACHE, 'segments');
const OUT = path.join(ROOT, 'public', 'media');
const FONT = '/System/Library/Fonts/Helvetica.ttc';

const SECTION_SEC = 8;
const W = 1280, H = 720, FPS = 30;
const FRUIT_CLIPS_PER_SECTION = 4;   // 4 × 2.0s
const FLESH_CLIPS_PER_SECTION = 4;   // 4 × 2.0s — but faster source speed
const FRUIT_SPEED = 1.25;
const FLESH_SPEED = 1.8;

// Galatians 5 order. URLs and contrast pairings come straight from the
// columns of docs/EternalBeing.io.pdf: love ↔ selfish ambition, joy ↔ quarrels.
const SECTIONS = [
  {
    fruit: 'love', flesh: 'selfish-ambition',
    fruitUrls: [
      'https://www.youtube.com/watch?v=V50XaJVs5L0',
      'https://www.godtube.com/watch/?v=19B0JJNU',
      'https://www.youtube.com/watch?v=h6kkIaPPfwY',
      'https://www.youtube.com/watch?v=8jGdCgLattk',
    ],
    fleshUrls: [
      'https://x.com/DissidentWire/status/2068771070048645500',
      'https://www.tiktok.com/@shoppingchinaimportados/video/7575593930733948216',
      'https://www.youtube.com/watch?v=BiM6XgdxsUk',
      'https://www.youtube.com/watch?v=VPRZpdxg1o4',
      'https://www.youtube.com/watch?v=uUluJJ69CL4',
    ],
  },
  {
    fruit: 'joy', flesh: 'quarrels',
    fruitUrls: [
      'https://www.youtube.com/watch?v=4-94JhLEiN0',
      'https://www.youtube.com/watch?v=qBay1HrK8WU',
      'https://www.youtube.com/watch?v=ydAyvvDQrgY',
      'https://www.youtube.com/watch?v=qW3JI2NNxm0',
    ],
    fleshUrls: [
      'https://www.youtube.com/watch?v=8iE1sbpfugo',
      'https://www.youtube.com/watch?v=TUCUsNx1HTs',
      'https://www.youtube.com/watch?v=BcaHgzRHjlg',
      'https://www.youtube.com/watch?v=WkBj4d5AeqE',
    ],
  },
  { fruit: 'peace', flesh: 'hostility', fruitUrls: [], fleshUrls: [] },
  { fruit: 'patience', flesh: 'anger', fruitUrls: [], fleshUrls: [] },
  { fruit: 'kindness', flesh: 'envy', fruitUrls: [], fleshUrls: [] },
  { fruit: 'goodness', flesh: 'harmful-desire', fruitUrls: [], fleshUrls: [] },
  { fruit: 'faithfulness', flesh: 'betrayal', fruitUrls: [], fleshUrls: [] },
  { fruit: 'gentleness', flesh: 'aggression', fruitUrls: [], fleshUrls: [] },
  { fruit: 'self-control', flesh: 'indulgence', fruitUrls: [], fleshUrls: [] },
];

const PLACEHOLDERS_ONLY = process.argv.includes('--placeholders-only');

for (const d of [CACHE, SEGS, OUT, path.join(OUT, 'audio')]) mkdirSync(d, { recursive: true });

const slug = (url) => url.replace(/[^a-z0-9]+/gi, '_').slice(-60);

async function download(url) {
  const out = path.join(CACHE, `${slug(url)}.mp4`);
  if (existsSync(out)) return out;
  try {
    await execFileP('yt-dlp', [
      '--no-playlist', '--force-overwrites',
      '-f', 'bv*[height<=1080][ext=mp4]+ba[ext=m4a]/b[height<=1080][ext=mp4]/b',
      '--merge-output-format', 'mp4',
      '--max-filesize', '300M',
      '-o', out, url,
    ], { timeout: 180_000 });
    return existsSync(out) ? out : null;
  } catch (e) {
    console.warn(`  ✗ download failed: ${url}\n    ${String(e.message).split('\n')[0]}`);
    return null;
  }
}

function duration(file) {
  try {
    return parseFloat(execFileSync('ffprobe', [
      '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file,
    ]).toString());
  } catch { return 0; }
}

// Normalize every segment to identical params so concat is seamless.
// The cover scale+crop also zooms vertical (portrait) sources into landscape.
const NORM = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=${FPS},format=yuv420p`;

// Detect baked-in letterbox/pillarbox bars in the cut window so vertical
// videos padded into 16:9 (and old 4:3 uploads) get zoomed to real content.
function cropFilterFor(src, start, srcLen) {
  try {
    const res = execFileSync('sh', ['-c',
      `ffmpeg -ss ${start.toFixed(2)} -t ${srcLen.toFixed(2)} -i ${JSON.stringify(src)} ` +
      `-vf "cropdetect=limit=24:round=2:reset=0" -f null - 2>&1 | grep -o 'crop=[0-9:]*' | tail -1`,
    ]).toString().trim();
    if (!res.startsWith('crop=')) return null;
    const [cw, ch] = res.slice(5).split(':').map(Number);
    // only apply when bars are significant (>4% of either dimension)
    const probe = execFileSync('ffprobe', [
      '-v', 'error', '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height', '-of', 'csv=p=0', src,
    ]).toString().trim().split(',').map(Number);
    const [sw, sh] = probe;
    if (cw >= sw * 0.96 && ch >= sh * 0.96) return null;
    if (cw < 64 || ch < 64) return null; // cropdetect misfire on dark scenes
    return res;
  } catch {
    return null;
  }
}

function cutSegment(src, start, srcLen, speed, out) {
  const bars = cropFilterFor(src, start, srcLen);
  const vf = `${bars ? bars + ',' : ''}setpts=PTS/${speed},${NORM}`;
  execFileSync('ffmpeg', [
    '-y', '-v', 'error',
    '-ss', start.toFixed(2), '-t', srcLen.toFixed(2), '-i', src,
    '-an', '-vf', vf,
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '20', out,
  ]);
}

// Placeholder segments: warm drifting gradient (fruit) / dark harsh noise (flesh),
// with a faint slot label so it's obvious what footage to curate next.
function makePlaceholder(kind, label, secs, out) {
  const fruitSrc = `gradients=s=${W}x${H}:d=${secs}:speed=0.015:c0=0x2e2118:c1=0x6b4a2f:c2=0x8a6a45:c3=0x1c1512:type=spiral`;
  const fleshSrc = `gradients=s=${W}x${H}:d=${secs}:speed=0.08:c0=0x0a0505:c1=0x3d0f0a:c2=0x1a0505:c3=0x000000:type=circular`;
  const grain = kind === 'fruit' ? 'noise=alls=7:allf=t' : 'noise=alls=28:allf=t+u';
  const text = `drawtext=fontfile=${FONT}:text='${label}':fontsize=30:fontcolor=white@0.18:x=(w-text_w)/2:y=(h-text_h)/2`;
  execFileSync('ffmpeg', [
    '-y', '-v', 'error',
    '-f', 'lavfi', '-i', kind === 'fruit' ? fruitSrc : fleshSrc,
    '-vf', `${grain},${text},fps=${FPS},format=yuv420p`,
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '20', out,
  ]);
}

async function buildLayer(kind) {
  const perSection = kind === 'fruit' ? FRUIT_CLIPS_PER_SECTION : FLESH_CLIPS_PER_SECTION;
  const clipSec = SECTION_SEC / perSection;
  const speed = kind === 'fruit' ? FRUIT_SPEED : FLESH_SPEED;
  const srcLen = clipSec * speed;
  const segments = [];

  for (const section of SECTIONS) {
    const name = kind === 'fruit' ? section.fruit : section.flesh;
    const urls = kind === 'fruit' ? section.fruitUrls : section.fleshUrls;
    console.log(`[${kind}] ${name}`);

    const sources = [];
    if (!PLACEHOLDERS_ONLY) {
      for (const url of urls) {
        const f = await download(url);
        if (f && duration(f) > srcLen + 2) sources.push(f);
      }
    }

    for (let i = 0; i < perSection; i++) {
      const out = path.join(SEGS, `${kind}-${name}-${i}.mp4`);
      const src = sources[i % Math.max(sources.length, 1)];
      if (src) {
        const d = duration(src);
        // spread windows across the source, away from intros/outros
        const t = Math.max(1, d * (0.25 + (0.5 * i) / Math.max(perSection - 1, 1)) - srcLen / 2);
        cutSegment(src, Math.min(t, d - srcLen - 0.5), srcLen, speed, out);
        console.log(`  ✓ clip ${i + 1} from ${path.basename(src)} @ ${t.toFixed(1)}s`);
      } else {
        makePlaceholder(kind, name, clipSec, out);
        console.log(`  ○ clip ${i + 1} placeholder`);
      }
      segments.push(out);
    }
  }

  const listFile = path.join(CACHE, `${kind}-concat.txt`);
  writeFileSync(listFile, segments.map((s) => `file '${s}'`).join('\n'));
  const reel = path.join(OUT, `${kind}-reel.mp4`);
  const totalSec = SECTIONS.length * SECTION_SEC;
  execFileSync('ffmpeg', [
    '-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', listFile,
    // trim to the exact loop length so both reels stay frame-aligned,
    // and cap bitrate (grain-heavy placeholders explode CRF-only encodes)
    '-t', String(totalSec),
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
    '-maxrate', '6M', '-bufsize', '12M',
    '-movflags', '+faststart', '-an', reel,
  ]);
  console.log(`→ ${reel} (${duration(reel).toFixed(2)}s)`);
}

// Ambient vocals: copy into public media (m4a/AAC plays natively in browsers).
const vocalsSrc = path.join(ROOT, 'docs', 'childhoodvocalsG_major121bpm441hzm4a.m4a');
if (existsSync(vocalsSrc)) {
  copyFileSync(vocalsSrc, path.join(OUT, 'audio', 'childhood-vocals.m4a'));
  console.log('→ audio/childhood-vocals.m4a');
}

await buildLayer('fruit');
await buildLayer('flesh');
console.log('\nIngest complete.');
