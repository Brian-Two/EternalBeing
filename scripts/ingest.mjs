#!/usr/bin/env node
/**
 * EternalBeing — media ingest pipeline.
 *
 * Reads clips.json (the curated 72-portion manifest), downloads just the needed
 * window of each source (yt-dlp --download-sections), cuts it to an exact
 * fixed-length slot (ffmpeg), and bakes two time-aligned reels:
 * public/media/fruit-reel.mp4 and public/media/flesh-reel.mp4.
 *
 * Every slot is slotSec long in BOTH reels, so press-and-hold swaps layers at
 * the same timecode.
 *
 * Each slot's pixels come from the first of:
 *   1. media-clips/<layer>/<word>-<n>.<ext>   hand-edited portion (always wins)
 *   2. clips.json url + start/end             curated window
 *   3. generated labelled placeholder         only if a download fails
 *
 * Slots are re-cut only when their manifest entry changes (hash sidecar), so
 * fixing one bad trim is: edit clips.json, rerun, one clip rebuilds.
 *
 * NOTE: downloaded footage is for private prototyping only (see docs/PRD.md §9).
 *
 * Usage:
 *   node scripts/ingest.mjs                          full build
 *   node scripts/ingest.mjs --clip fruit-goodness-3  force one slot (repeatable/comma-separated)
 *   node scripts/ingest.mjs --section goodness       both layers of one pair
 *   node scripts/ingest.mjs --layer flesh            one layer
 *   node scripts/ingest.mjs --reels                  re-concat only, no cutting
 *   node scripts/ingest.mjs --sheet                  regenerate media-cache/review.html
 *   node scripts/ingest.mjs --force                  ignore staleness, re-cut everything
 *   node scripts/ingest.mjs --no-reels               cut only, leave reels alone
 *   node scripts/ingest.mjs --no-download            never hit the network
 */
import { execFileSync, execFile } from 'node:child_process';
import {
  existsSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, readdirSync, rmSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { promisify } from 'node:util';
import path from 'node:path';

const execFileP = promisify(execFile);

const ROOT = path.resolve(import.meta.dirname, '..');
const CACHE = path.join(ROOT, 'media-cache');
const SECTIONS_DIR = path.join(CACHE, 'sections'); // window-only source downloads
const SEGS = path.join(CACHE, 'segments');         // finished fixed-length slots
const OUT = path.join(ROOT, 'public', 'media');
const LOCAL = path.join(ROOT, 'media-clips');      // hand-edited portions win over URLs
const FONT = '/System/Library/Fonts/Helvetica.ttc';
const MANIFEST = path.join(ROOT, 'clips.json');

// ─── args ────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flagList = (name) => argv
  .flatMap((a, i) => (a === name ? [argv[i + 1]] : a.startsWith(`${name}=`) ? [a.slice(name.length + 1)] : []))
  .flatMap((v) => (v ? v.split(',') : []))
  .map((v) => v.trim())
  .filter(Boolean);

const OPT = {
  clips: flagList('--clip'),
  sections: flagList('--section'),
  layers: flagList('--layer'),
  reelsOnly: argv.includes('--reels'),
  sheetOnly: argv.includes('--sheet'),
  force: argv.includes('--force'),
  noReels: argv.includes('--no-reels'),
  noDownload: argv.includes('--no-download'),
};
// naming a specific target implies forcing it
const TARGETED = OPT.clips.length > 0 || OPT.sections.length > 0 || OPT.layers.length > 0;

// ─── manifest ────────────────────────────────────────────────────────────────
if (!existsSync(MANIFEST)) {
  console.error(`No manifest at ${MANIFEST}`);
  process.exit(1);
}
const M = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const SLOT = M.slotSec;
const PER = M.clipsPerSection;
const W = M.output.width, H = M.output.height, FPS = M.output.fps;
const SECTION_SEC = SLOT * PER;
const TOTAL_SEC = SECTION_SEC * M.sections.length;

for (const d of [
  CACHE, SECTIONS_DIR, SEGS, OUT, path.join(OUT, 'audio'),
  path.join(LOCAL, 'fruit'), path.join(LOCAL, 'flesh'),
]) mkdirSync(d, { recursive: true });

// ─── helpers ─────────────────────────────────────────────────────────────────

/** "1:23", "11:50", "1:02:03", "10:29.2" → seconds */
function parseTime(t) {
  if (typeof t === 'number') return t;
  const parts = String(t).trim().split(':').map(Number);
  if (parts.some(Number.isNaN)) throw new Error(`bad timestamp: ${t}`);
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

const hhmmss = (s) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${h}:${String(m).padStart(2, '0')}:${sec.toFixed(2).padStart(5, '0')}`;
};

/** Stable id for the source video, used to key caches and reuse legacy downloads. */
function videoId(url) {
  let m;
  if ((m = url.match(/[?&]v=([\w-]{11})/))) return m[1];
  if ((m = url.match(/youtu\.be\/([\w-]{11})/))) return m[1];
  if ((m = url.match(/\/shorts\/([\w-]{11})/))) return m[1];
  if ((m = url.match(/x\.com\/[^/]+\/status\/(\d+)/))) return `x${m[1]}`;
  if ((m = url.match(/twitter\.com\/[^/]+\/status\/(\d+)/))) return `x${m[1]}`;
  if ((m = url.match(/tiktok\.com\/[^/]+\/video\/(\d+)/))) return `tt${m[1]}`;
  return createHash('sha1').update(url).digest('hex').slice(0, 12);
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
// Cap the long edge, not the height: a `height<=1080` cap silently rejects
// portrait sources' good formats (a 720x1280 Short is 1280 "tall") and leaves
// us upscaling a 480-wide copy into a 1280x720 slot.
const FORMAT = [
  'bv*[width<=1920][height<=1920][ext=mp4]+ba[ext=m4a]',
  'b[width<=1920][height<=1920][ext=mp4]',
  'bv*[width<=1920][height<=1920]+ba',
  'b[width<=1920][height<=1920]',
  'bv*+ba/b',
].join('/');

const NORM = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=${FPS},format=yuv420p`;

// Detect baked-in letterbox/pillarbox bars in the cut window so vertical
// videos padded into 16:9 (and old 4:3 uploads) get zoomed to real content.
function cropFilterFor(src, start, len) {
  try {
    const res = execFileSync('sh', ['-c',
      `ffmpeg -ss ${start.toFixed(2)} -t ${len.toFixed(2)} -i ${JSON.stringify(src)} ` +
      `-vf "cropdetect=limit=24:round=2:reset=0" -f null - 2>&1 | grep -o 'crop=[0-9:]*' | tail -1`,
    ]).toString().trim();
    if (!res.startsWith('crop=')) return null;
    const [cw, ch] = res.slice(5).split(':').map(Number);
    const [sw, sh] = execFileSync('ffprobe', [
      '-v', 'error', '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height', '-of', 'csv=p=0', src,
    ]).toString().trim().split(',').map(Number);
    // only apply when bars are significant (>4% of either dimension)
    if (cw >= sw * 0.96 && ch >= sh * 0.96) return null;
    if (cw < 64 || ch < 64) return null; // cropdetect misfire on dark scenes
    return res;
  } catch { return null; }
}

// Edge-energy (sobel) of a region — used to spot vertical videos padded into
// 16:9 with a *blurred* copy of themselves (blur defeats cropdetect).
function edgeEnergy(src, t, cropExpr) {
  try {
    const out = execFileSync('sh', ['-c',
      `ffmpeg -ss ${t.toFixed(2)} -i ${JSON.stringify(src)} -frames:v 1 ` +
      `-vf "${cropExpr},sobel,signalstats,metadata=print" -f null - 2>&1 ` +
      `| grep -o 'YAVG=[0-9.]*' | head -1 | cut -d= -f2`,
    ]).toString().trim();
    return parseFloat(out) || 0;
  } catch { return 0; }
}

function blurredPillarboxCrop(src, start) {
  const sides = Math.max(
    edgeEnergy(src, start, 'crop=iw/4:ih:0:0'),
    edgeEnergy(src, start, 'crop=iw/4:ih:iw-iw/4:0'),
  );
  const center = edgeEnergy(src, start, 'crop=iw/4:ih:(iw-iw/4)/2:0');
  // sharp middle + genuinely soft sides = blurred-fill vertical video:
  // take the real vertical strip, then a 16:9 window biased toward the top
  // third, where phone-video subjects usually are
  if (center > 2.5 * sides && sides < 12) {
    return 'crop=ih*9/16:ih,crop=iw:iw*9/16:0:(in_h-out_h)*0.30';
  }
  return null;
}

/** manifest "w:h:x:y" (or a full "crop=..." / chained expression) → filter string */
const cropExpr = (c) => (!c ? null : /^crop=|,/.test(c) ? c : `crop=${c}`);

// ─── sources ─────────────────────────────────────────────────────────────────

/** Whole-file downloads from earlier runs, indexed by the video id in the name. */
const legacyCache = (() => {
  const map = new Map();
  for (const f of readdirSync(CACHE)) {
    if (!f.endsWith('.mp4')) continue;
    map.set(f, path.join(CACHE, f));
  }
  return map;
})();

function legacySourceFor(id) {
  // legacy filenames were slugified (every non-alphanumeric → '_'), so compare
  // both sides in that shape or ids containing '-' never match.
  const key = id.replace(/^(x|tt)(?=\d+$)/, '').replace(/[^a-z0-9]+/gi, '_');
  for (const [name, full] of legacyCache) {
    if (name.replace(/[^a-z0-9]+/gi, '_').includes(key)) return full;
  }
  return null;
}

/**
 * Get a file containing the clip's window, plus the offset at which the window
 * starts inside it. Prefers a whole-file download we already have, then a
 * cached window, then downloads just the window (+padding).
 */
async function resolveSource(clip) {
  const id = videoId(clip.url);
  const start = parseTime(clip.start), end = parseTime(clip.end);
  const pad = clip.pad ?? 3;

  const legacy = legacySourceFor(id);
  if (legacy && duration(legacy) > end + 0.2) {
    return { file: legacy, offset: start, how: 'cached-full' };
  }

  const from = Math.max(0, start - pad);
  const to = end + pad;
  const key = `${id}__${from.toFixed(2)}-${to.toFixed(2)}`.replace(/[^\w.-]/g, '_');
  const secFile = path.join(SECTIONS_DIR, `${key}.mp4`);

  if (existsSync(secFile) && duration(secFile) > 0) {
    return { file: secFile, offset: start - from, how: 'cached-window' };
  }
  if (OPT.noDownload) return null;

  // Window-only download keeps disk use tiny (~3 MB/clip) and re-trims cheap.
  // yt-dlp fetches ranges through ffmpeg, and googlevideo 403s the URLs handed
  // out by the default YouTube client; web_embedded's URLs work and stay 1080p.
  // The extractor-arg is ignored by non-YouTube extractors (X, TikTok).
  const sectionArgs = (client) => [
    '--no-playlist', '--force-overwrites', '--no-part', '--socket-timeout', '30',
    '--download-sections', `*${hhmmss(from)}-${hhmmss(to)}`,
    '--force-keyframes-at-cuts',
    ...(client ? ['--extractor-args', `youtube:player_client=${client}`] : []),
    '-f', FORMAT,
    '--merge-output-format', 'mp4',
    '-o', secFile, clip.url,
  ];
  for (const client of ['web_embedded', 'android', null]) {
    try {
      await execFileP('yt-dlp', sectionArgs(client), { timeout: 300_000 });
      if (existsSync(secFile) && duration(secFile) > 0) break;
    } catch (e) {
      console.warn(`    · section via ${client ?? 'default'}: ${String(e.message).split('\n').filter((l) => l.includes('ERROR')).pop()?.slice(0, 90) ?? 'failed'}`);
    }
  }

  if (existsSync(secFile) && duration(secFile) > 0) {
    const got = duration(secFile);
    const want = to - from;
    // Some extractors ignore --download-sections and hand back the whole video.
    if (got > want + 5) return { file: secFile, offset: start, how: 'window→full' };
    // it only has to actually contain the requested window, padding aside
    const offset = start - from;
    if (got < offset + (end - start) - 0.05) {
      console.warn(`    ! section holds ${got.toFixed(2)}s, window needs ${(offset + end - start).toFixed(2)}s`);
      return null;
    }
    return { file: secFile, offset, how: 'window' };
  }

  // fall back to the whole file (X / TikTok extractors often ignore sections)
  const fullFile = path.join(CACHE, `${id}.mp4`);
  if (!existsSync(fullFile)) {
    // same client dance as above — the default client's URLs 403 on some videos
    for (const client of ['web_embedded', 'android', null]) {
      try {
        await execFileP('yt-dlp', [
          '--no-playlist', '--force-overwrites', '--socket-timeout', '30',
          ...(client ? ['--extractor-args', `youtube:player_client=${client}`] : []),
          '-f', FORMAT,
          '--merge-output-format', 'mp4', '--max-filesize', '400M',
          '-o', fullFile, clip.url,
        ], { timeout: 600_000 });
        if (existsSync(fullFile)) break;
      } catch (e) {
        console.warn(`    · full via ${client ?? 'default'}: ${String(e.message).split('\n').filter((l) => l.includes('ERROR')).pop()?.slice(0, 90) ?? 'failed'}`);
      }
    }
    if (!existsSync(fullFile)) return null;
  }
  if (!existsSync(fullFile)) return null;
  if (duration(fullFile) < end) {
    console.warn(`    ! source is ${duration(fullFile).toFixed(1)}s, window ends at ${end}s`);
    return null;
  }
  return { file: fullFile, offset: start, how: 'full' };
}

// ─── cutting ─────────────────────────────────────────────────────────────────

/** Encode exactly SLOT seconds, so every segment concats frame-aligned. */
function encode(args, out) {
  execFileSync('ffmpeg', [
    '-y', '-v', 'error', ...args,
    '-an', '-t', String(SLOT), '-r', String(FPS),
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '20',
    '-pix_fmt', 'yuv420p', out,
  ]);
}

function cutSegment(src, offset, winLen, layerSpeed, clip, out) {
  const speed = winLen / SLOT;
  if (Math.abs(speed - layerSpeed) > layerSpeed * 0.01) {
    console.warn(`    ! window is ${winLen.toFixed(2)}s → ${speed.toFixed(3)}×, not the ${layerSpeed}× the rest of this layer runs at`);
  }
  // explicit crop from the manifest wins; else auto-detect black bars, then
  // blurred pillarbox. Either way NORM cover-zooms what's left to landscape.
  let crop = cropExpr(clip.crop);
  if (!crop && clip.autocrop !== false) {
    crop = cropFilterFor(src, offset, winLen) ?? blurredPillarboxCrop(src, offset);
    if (crop) console.log(`    ↳ auto-crop: ${crop}`);
  } else if (crop) {
    console.log(`    ↳ manifest crop: ${crop}`);
  }
  const vf = `${crop ? crop + ',' : ''}setpts=PTS/${speed},${NORM}`;
  encode(['-ss', offset.toFixed(3), '-t', (winLen + 0.15).toFixed(3), '-i', src, '-vf', vf], out);
  return crop;
}

/** Hand-edited portion: the whole file is time-stretched to fill the slot. */
function fitSegment(src, clip, out) {
  const d = duration(src);
  const speed = d / SLOT;
  let crop = cropExpr(clip?.crop) ?? null;
  const vf = `${crop ? crop + ',' : ''}setpts=PTS/${speed.toFixed(5)},${NORM}`;
  encode(['-i', src, '-vf', vf], out);
  return speed;
}

// Placeholder segments: warm drifting gradient (fruit) / dark harsh noise (flesh),
// with a faint slot label so it's obvious what footage still needs curating.
const HAS_DRAWTEXT = (() => {
  try {
    return execFileSync('sh', ['-c', "ffmpeg -hide_banner -filters 2>/dev/null | grep -cw drawtext"])
      .toString().trim() !== '0';
  } catch { return false; }
})();

function makePlaceholder(layer, label, out) {
  const fruitSrc = `gradients=s=${W}x${H}:d=${SLOT}:speed=0.015:c0=0x2e2118:c1=0x6b4a2f:c2=0x8a6a45:c3=0x1c1512:type=spiral`;
  const fleshSrc = `gradients=s=${W}x${H}:d=${SLOT}:speed=0.08:c0=0x0a0505:c1=0x3d0f0a:c2=0x1a0505:c3=0x000000:type=circular`;
  const grain = layer === 'fruit' ? 'noise=alls=7:allf=t' : 'noise=alls=28:allf=t+u';
  const text = HAS_DRAWTEXT
    ? `,drawtext=fontfile=${FONT}:text='${label}':fontsize=30:fontcolor=white@0.18:x=(w-text_w)/2:y=(h-text_h)/2`
    : '';
  encode([
    '-f', 'lavfi', '-i', layer === 'fruit' ? fruitSrc : fleshSrc,
    '-vf', `${grain}${text},fps=${FPS},format=yuv420p`,
  ], out);
}

// ─── slot model ──────────────────────────────────────────────────────────────

function localClip(layer, word, n) {
  for (const ext of ['mp4', 'mov', 'm4v', 'webm', 'MP4', 'MOV']) {
    const p = path.join(LOCAL, layer, `${word}-${n}.${ext}`);
    if (existsSync(p)) return p;
  }
  return null;
}

/** Every slot in reel order. */
function allSlots() {
  const slots = [];
  for (const layer of ['fruit', 'flesh']) {
    for (const section of M.sections) {
      const word = section[layer];
      const label = section[`${layer}Label`] ?? word;
      const clips = section[`${layer}Clips`] ?? [];
      for (let i = 0; i < PER; i++) {
        const n = i + 1;
        slots.push({
          id: `${layer}-${word}-${n}`,
          layer, word, label, n,
          clip: clips[i] ?? null,
          seg: path.join(SEGS, `${layer}-${word}-${n}.mp4`),
          side: path.join(SEGS, `${layer}-${word}-${n}.json`),
          speed: M.speed[layer],
        });
      }
    }
  }
  return slots;
}

const selected = (s) => !TARGETED
  || OPT.clips.includes(s.id)
  || OPT.sections.includes(s.word)
  || OPT.sections.includes(s.label)
  || OPT.layers.includes(s.layer);

/** What the finished segment depends on — changing any of it forces a re-cut. */
function slotHash(s) {
  const local = localClip(s.layer, s.word, s.n);
  return createHash('sha1').update(JSON.stringify({
    clip: s.clip, speed: s.speed, slot: SLOT, w: W, h: H, fps: FPS,
    local: local ? `${local}:${duration(local).toFixed(3)}` : null,
  })).digest('hex');
}

function readSidecar(s) {
  try { return JSON.parse(readFileSync(s.side, 'utf8')); } catch { return null; }
}

// ─── build ───────────────────────────────────────────────────────────────────

const results = [];

async function buildSlot(s) {
  const hash = slotHash(s);
  const prev = readSidecar(s);
  const fresh = !OPT.force && !(TARGETED && selected(s))
    && existsSync(s.seg) && prev?.hash === hash;

  if (fresh) {
    results.push({ ...prev, id: s.id, layer: s.layer, word: s.word, label: s.label, n: s.n, skipped: true });
    return false;
  }
  if (TARGETED && !selected(s)) {
    // Not targeted. Leave it alone — unless it is missing and a reel needs it.
    if (existsSync(s.seg) || OPT.noReels) {
      results.push({ ...(prev ?? {}), id: s.id, layer: s.layer, word: s.word, label: s.label, n: s.n, skipped: true, stale: existsSync(s.seg) });
      return false;
    }
  }

  console.log(`[${s.layer}] ${s.label} ${s.n}/${PER}  (${s.id})`);
  const record = {
    hash, id: s.id, layer: s.layer, word: s.word, label: s.label, n: s.n,
    url: s.clip?.url ?? null, start: s.clip?.start ?? null, end: s.clip?.end ?? null,
    note: s.clip?.note ?? null,
  };

  const local = localClip(s.layer, s.word, s.n);
  if (local) {
    const speed = fitSegment(local, s.clip, s.seg);
    record.origin = 'media-clips';
    record.source = path.relative(ROOT, local);
    record.speed = Number(speed.toFixed(4));
    console.log(`  ★ media-clips/${s.layer}/${path.basename(local)} → ${speed.toFixed(3)}×`);
  } else if (s.clip) {
    const src = await resolveSource(s.clip);
    if (src) {
      const winLen = parseTime(s.clip.end) - parseTime(s.clip.start);
      const crop = cutSegment(src.file, src.offset, winLen, s.speed, s.clip, s.seg);
      record.origin = 'manifest';
      record.source = path.relative(ROOT, src.file);
      record.how = src.how;
      record.speed = Number((winLen / SLOT).toFixed(4));
      record.crop = crop;
      console.log(`  ✓ ${s.clip.start}–${s.clip.end} (${winLen.toFixed(1)}s) → ${record.speed}× [${src.how}]`);
    } else {
      makePlaceholder(s.layer, s.label, s.seg);
      record.origin = 'placeholder';
      record.failed = true;
      console.log(`  ○ placeholder — source unavailable`);
    }
  } else {
    makePlaceholder(s.layer, s.label, s.seg);
    record.origin = 'placeholder';
    record.failed = true;
    console.log(`  ○ placeholder — no manifest entry`);
  }

  record.duration = Number(duration(s.seg).toFixed(3));
  if (Math.abs(record.duration - SLOT) > 0.05) {
    console.warn(`  ! ${s.id} is ${record.duration}s, expected ${SLOT}s`);
  }
  writeFileSync(s.side, JSON.stringify(record, null, 2));
  results.push(record);
  return true;
}

function buildReel(layer, slots) {
  const segs = slots.filter((s) => s.layer === layer).map((s) => s.seg);
  const missing = segs.filter((f) => !existsSync(f));
  if (missing.length) {
    console.warn(`\n! skipping ${layer} reel — ${missing.length} segment(s) missing`);
    return;
  }
  const listFile = path.join(CACHE, `${layer}-concat.txt`);
  writeFileSync(listFile, segs.map((s) => `file '${s}'`).join('\n'));
  const reel = path.join(OUT, `${layer}-reel.mp4`);
  execFileSync('ffmpeg', [
    '-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', listFile,
    // trim to the exact loop length so both reels stay frame-aligned
    '-t', String(TOTAL_SEC),
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
    '-maxrate', '5M', '-bufsize', '10M',
    '-movflags', '+faststart', '-an', reel,
  ]);
  console.log(`→ ${path.relative(ROOT, reel)}  ${duration(reel).toFixed(3)}s  (${segs.length} slots)`);
}

// ─── review sheet ────────────────────────────────────────────────────────────

function writeSheet(slots) {
  const rows = slots.map((s) => readSidecar(s)).filter(Boolean);
  const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const card = (r) => {
    const seg = path.join(SEGS, `${r.id}.mp4`);
    const flags = [
      r.origin === 'placeholder' ? '<b class="bad">PLACEHOLDER</b>' : '',
      r.origin === 'media-clips' ? '<b class="hand">hand-cut</b>' : '',
      r.crop ? `<span class="crop">crop</span>` : '',
    ].filter(Boolean).join(' ');
    return `<figure class="${r.origin}">
  <video src="${esc(path.relative(CACHE, seg))}" muted loop playsinline preload="metadata"
         onmouseenter="this.play()" onmouseleave="this.pause();this.currentTime=0"></video>
  <figcaption>
    <div class="id">${esc(r.id)} ${flags}</div>
    <div class="meta">${esc(r.start ?? '')}–${esc(r.end ?? '')} · ${esc(r.speed ?? '')}× · ${esc(r.duration ?? '')}s</div>
    ${r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noreferrer">source</a>` : ''}
    ${r.note ? `<div class="note">${esc(r.note)}</div>` : ''}
    <code>npm run ingest -- --clip ${esc(r.id)}</code>
  </figcaption>
</figure>`;
  };
  const html = `<!doctype html><meta charset="utf-8"><title>EternalBeing — clip review</title>
<style>
 :root{color-scheme:dark}
 body{background:#0d0b0a;color:#e8e2da;font:13px/1.45 -apple-system,BlinkMacSystemFont,sans-serif;margin:0;padding:24px}
 h1{font-size:18px;font-weight:600;margin:0 0 4px} .sub{color:#8a817a;margin-bottom:20px}
 h2{font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#8a817a;margin:28px 0 10px;border-bottom:1px solid #262019;padding-bottom:6px}
 .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}
 figure{margin:0;background:#151110;border:1px solid #262019;border-radius:8px;overflow:hidden}
 figure.placeholder{border-color:#6b1d1d}
 figure.media-clips{border-color:#2f5d3a}
 video{width:100%;display:block;background:#000;aspect-ratio:16/9}
 figcaption{padding:8px 10px}
 .id{font-weight:600} .meta{color:#8a817a;font-size:12px}
 .note{color:#c9a227;font-size:12px;margin-top:4px}
 .bad{color:#ff6b6b} .hand{color:#6bd18a} .crop{color:#7aa2f7}
 a{color:#7aa2f7;font-size:12px} code{display:block;margin-top:6px;color:#5f574f;font-size:11px}
</style>
<h1>EternalBeing — clip review</h1>
<div class="sub">${rows.length} slots · ${SLOT}s each · section ${SECTION_SEC}s · loop ${TOTAL_SEC}s · hover a clip to play</div>
${['fruit', 'flesh'].map((layer) => M.sections.map((sec) => {
    const word = sec[layer];
    const mine = rows.filter((r) => r.layer === layer && r.word === word);
    if (!mine.length) return '';
    return `<h2>${esc(layer)} — ${esc(sec[`${layer}Label`] ?? word)}</h2><div class="grid">${mine.map(card).join('')}</div>`;
  }).join('')).join('')}
`;
  const out = path.join(CACHE, 'review.html');
  writeFileSync(out, html);
  console.log(`→ ${path.relative(ROOT, out)}`);
}

// ─── run ─────────────────────────────────────────────────────────────────────

const slots = allSlots();

if (OPT.sheetOnly) {
  writeSheet(slots);
} else if (OPT.reelsOnly) {
  buildReel('fruit', slots);
  buildReel('flesh', slots);
} else {
  console.log(`slot ${SLOT}s · fruit ${M.speed.fruit}× · flesh ${M.speed.flesh}× · section ${SECTION_SEC}s · loop ${TOTAL_SEC}s\n`);

  const touched = new Set();
  for (const s of slots) {
    if (await buildSlot(s)) touched.add(s.layer);
  }

  // Ambient vocals: copy into public media (m4a/AAC plays natively in browsers).
  const vocalsSrc = path.join(ROOT, 'docs', 'childhoodvocalsG_major121bpm441hzm4a.m4a');
  if (existsSync(vocalsSrc)) copyFileSync(vocalsSrc, path.join(OUT, 'audio', 'childhood-vocals.m4a'));

  const built = results.filter((r) => !r.skipped);
  const failed = results.filter((r) => r.failed);
  console.log(`\n${built.length} rebuilt, ${results.length - built.length} reused, ${failed.length} placeholder`);

  if (!OPT.noReels) {
    console.log('');
    for (const layer of ['fruit', 'flesh']) {
      if (touched.has(layer) || !existsSync(path.join(OUT, `${layer}-reel.mp4`))) buildReel(layer, slots);
      else console.log(`· ${layer} reel unchanged`);
    }
  }

  writeSheet(slots);

  if (failed.length) {
    console.log(`\n⚠ ${failed.length} slot(s) fell back to placeholders — need attention:`);
    for (const r of failed) console.log(`   ${r.id.padEnd(32)} ${r.url ?? '(no url)'}`);
  }
  console.log('\nIngest complete.');
}
