import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');

const CONTENT_BUNDLE_ORDER = [
  'shared/browser-api.js',
  'shared/currencies.js',
  'shared/i18n.js',
  'shared/defaults.js',
  'shared/icons.js',
  'shared/parser.js',
  'content/styles.js',
  'content/popover.js',
  'content/content.js',
];

function stripModuleSyntax(code) {
  return code
    .replace(/^\s*import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
    .replace(/^\s*export\s+(?=(?:const|let|var|function|async\s+function|class)\b)/gm, '');
}

function buildContentBundle() {
  const parts = CONTENT_BUNDLE_ORDER.map((rel) => {
    const abs = path.join(SRC, rel);
    const raw = fs.readFileSync(abs, 'utf8');
    return `/* --- ${rel} --- */\n${stripModuleSyntax(raw).trim()}`;
  });
  return `(() => {\n'use strict';\n\n${parts.join('\n\n')}\n})();\n`;
}

// --- Pure-Node PNG icon generator (rounded indigo-violet badge with ⇄ arrows) ---
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: None
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const compressed = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq > 0 ? ((px - x1) * dx + (py - y1) * dy) / lenSq : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function generateIconPng(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const radius = size * 0.24;
  const stroke = Math.max(1.15, size * 0.082);

  // Normalized arrow segments in [0..1] space
  const segments = [
    // Top right-pointing arrow
    [0.24, 0.36, 0.76, 0.36],
    [0.61, 0.23, 0.76, 0.36],
    [0.61, 0.49, 0.76, 0.36],
    // Bottom left-pointing arrow
    [0.76, 0.64, 0.24, 0.64],
    [0.39, 0.51, 0.24, 0.64],
    [0.39, 0.77, 0.24, 0.64],
  ];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x + 0.5;
      const py = y + 0.5;

      // Signed distance to rounded rect
      const qx = Math.abs(px - size / 2) - (size / 2 - radius);
      const qy = Math.abs(py - size / 2) - (size / 2 - radius);
      const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
      const bgAlpha = Math.max(0, Math.min(1, 0.5 - outside));

      if (bgAlpha <= 0) continue;

      // Indigo (#4f46e5) to Violet (#7c3aed) diagonal gradient
      const g = Math.max(0, Math.min(1, (px + py) / (2 * size)));
      let r = 79 + (124 - 79) * g;
      let gr = 70 + (58 - 70) * g;
      let b = 229 + (237 - 229) * g;

      // Foreground arrow coverage
      let minD = Infinity;
      for (const [x1, y1, x2, y2] of segments) {
        const d = distToSegment(px, py, x1 * size, y1 * size, x2 * size, y2 * size);
        if (d < minD) minD = d;
      }
      const fgAlpha = Math.max(0, Math.min(1, stroke / 2 + 0.5 - minD));

      r = r * (1 - fgAlpha) + 255 * fgAlpha;
      gr = gr * (1 - fgAlpha) + 255 * fgAlpha;
      b = b * (1 - fgAlpha) + 255 * fgAlpha;

      const idx = (y * size + x) * 4;
      rgba[idx] = Math.round(r);
      rgba[idx + 1] = Math.round(gr);
      rgba[idx + 2] = Math.round(b);
      rgba[idx + 3] = Math.round(bgAlpha * 255);
    }
  }

  return encodePng(size, size, rgba);
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const srcPath = path.join(from, entry.name);
    const dstPath = path.join(to, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, dstPath);
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

function buildTarget(targetName) {
  const outDir = path.join(DIST, targetName);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  // Copy shared, background, popup
  copyDir(path.join(SRC, 'shared'), path.join(outDir, 'shared'));
  copyDir(path.join(SRC, 'background'), path.join(outDir, 'background'));
  copyDir(path.join(SRC, 'popup'), path.join(outDir, 'popup'));

  // Write bundled content script
  const contentDir = path.join(outDir, 'content');
  fs.mkdirSync(contentDir, { recursive: true });
  fs.writeFileSync(path.join(contentDir, 'content.bundle.js'), buildContentBundle(), 'utf8');

  // Copy icons
  const iconsDir = path.join(outDir, 'icons');
  fs.mkdirSync(iconsDir, { recursive: true });
  for (const size of [16, 32, 48, 128]) {
    const fileName = `icon-${size}.png`;
    const srcIcon = path.join(SRC, 'icons', fileName);
    if (fs.existsSync(srcIcon)) {
      fs.copyFileSync(srcIcon, path.join(iconsDir, fileName));
    } else {
      fs.writeFileSync(path.join(iconsDir, fileName), generateIconPng(size));
    }
  }

  // Merge manifests
  const base = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifests/base.json'), 'utf8'));
  const override = JSON.parse(fs.readFileSync(path.join(ROOT, `manifests/${targetName}.json`), 'utf8'));
  const merged = {
    ...base,
    ...override,
    permissions: [...new Set([...(base.permissions || []), ...(override.permissions || [])])],
  };
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(merged, null, 2) + '\n', 'utf8');

  console.log(`Built ${targetName} -> ${path.relative(ROOT, outDir)}`);
}

buildTarget('chrome');
buildTarget('firefox');
