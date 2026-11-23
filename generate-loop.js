const { spawn } = require('child_process');
const path = require('path');

const FFMPEG = 'C:/Program Files/Red Giant/Trapcode Suite/Tools/ffmpeg.exe';
const DIR = 'c:/Users/ASUS/Documents/Antigravity/[PORTO]/404';
const INPUT_MOV = path.join(DIR, 'original-fea9bb45bc88995d5a4e3f09f088461c.mov');
const SPRITE_DIR = path.join(DIR, 'sprites');

const CROP_X0 = 300;
const CROP_Y0 = 420;
const CROP_W = 1120;
const CROP_H = 500;
const CROP_FSIZE = CROP_W * CROP_H;

const ORIG_HOVER_CX = 1023 - CROP_X0; // 723
const ORIG_HOVER_CY = 662 - CROP_Y0;  // 242

const ICON_W = 1024;
const ICON_H = 1024;

const LOOP_FRAMES = 420;
const DX_TOTAL = -32;
const DY_TOTAL = 26;

const PRESETS = [
  {
    name: 'desktop',
    W: 2192,
    H: 1396,
    bgPng: path.join(DIR, 'bg-desktop.png'),
    outWebm: path.join(DIR, 'loop-desktop.webm'),
    ufoScaleX: 1.24,
    ufoScaleY: 1.24,
    ufoTravelX: 1.24,
    ufoHoverX: 1096,
    ufoHoverY: 625,
    workerScale: 0.34,
    workerOx: 910,
    workerOy: 942,
    groundY: 1235,
    pullShiftX: 76,
    pullLiftY: -135,
    tuftStroke: 3.6
  },
  {
    name: 'mobile',
    W: 1080,
    H: 1800,
    bgPng: path.join(DIR, 'bg-mobile.png'),
    outWebm: path.join(DIR, 'loop-mobile.webm'),
    ufoScaleX: 0.88,
    ufoScaleY: 0.88,
    ufoTravelX: 0.68,
    ufoHoverX: 540,
    ufoHoverY: 795,
    workerScale: 0.44,
    workerOx: 299,
    workerOy: 1101,
    groundY: 1480,
    pullShiftX: 99,
    pullLiftY: -160,
    tuftStroke: 4.4
  }
];

function runSpawnCapture(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(FFMPEG, args, { stdio: ['ignore', 'pipe', 'inherit'] });
    const chunks = [];
    proc.stdout.on('data', (d) => chunks.push(d));
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code !== 0) reject(new Error(`ffmpeg exited with code ${code}`));
      else resolve(Buffer.concat(chunks));
    });
  });
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function getExtMask(fr, R = 0, thresh = 190, maxBarrierY = 485) {
  const barrier = new Uint8Array(CROP_FSIZE);
  for (let y = 0; y < maxBarrierY; y++) {
    const rowOff = y * CROP_W;
    for (let x = 0; x < CROP_W; x++) {
      if (fr[rowOff + x] < thresh) {
        const yMin = Math.max(0, y - R);
        const yMax = Math.min(CROP_H - 1, y + R);
        const xMin = Math.max(0, x - R);
        const xMax = Math.min(CROP_W - 1, x + R);
        for (let ny = yMin; ny <= yMax; ny++) {
          const nRow = ny * CROP_W;
          for (let nx = xMin; nx <= xMax; nx++) {
            barrier[nRow + nx] = 1;
          }
        }
      }
    }
  }

  const ext = new Uint8Array(CROP_FSIZE);
  const q = new Int32Array(CROP_FSIZE);
  let head = 0;
  let tail = 0;

  for (let x = 0; x < CROP_W; x++) {
    if (!barrier[x]) {
      ext[x] = 1;
      q[tail++] = x;
    }
    const b = (CROP_H - 1) * CROP_W + x;
    if (!barrier[b] && !ext[b]) {
      ext[b] = 1;
      q[tail++] = b;
    }
  }
  for (let y = 0; y < CROP_H; y++) {
    const l = y * CROP_W;
    const r = y * CROP_W + CROP_W - 1;
    if (!barrier[l] && !ext[l]) {
      ext[l] = 1;
      q[tail++] = l;
    }
    if (!barrier[r] && !ext[r]) {
      ext[r] = 1;
      q[tail++] = r;
    }
  }

  while (head < tail) {
    const curr = q[head++];
    const cx = curr % CROP_W;
    const cy = (curr / CROP_W) | 0;
    if (cx > 0 && !barrier[curr - 1] && !ext[curr - 1]) {
      ext[curr - 1] = 1;
      q[tail++] = curr - 1;
    }
    if (cx < CROP_W - 1 && !barrier[curr + 1] && !ext[curr + 1]) {
      ext[curr + 1] = 1;
      q[tail++] = curr + 1;
    }
    if (cy > 0 && !barrier[curr - CROP_W] && !ext[curr - CROP_W]) {
      ext[curr - CROP_W] = 1;
      q[tail++] = curr - CROP_W;
    }
    if (cy < CROP_H - 1 && !barrier[curr + CROP_W] && !ext[curr + CROP_W]) {
      ext[curr + CROP_W] = 1;
      q[tail++] = curr + CROP_W;
    }
  }

  return ext;
}

function buildBackground404(cropBuf) {
  const cands = [
    200, 0, 50, 60, 65, 70, 75, 78, 80, 82, 84, 86, 88, 90, 92, 95,
    100, 105, 110, 120, 140, 320, 350, 420
  ];
  const bg = new Uint8Array(CROP_FSIZE);
  const filled = new Uint8Array(CROP_FSIZE);

  for (const f of cands) {
    const fr = cropBuf.subarray(f * CROP_FSIZE, (f + 1) * CROP_FSIZE);
    const maxY = (f >= 120 && f <= 365) ? 435 : 485;
    const ext = getExtMask(fr, 5, 195, maxY);
    for (let i = 0; i < CROP_FSIZE; i++) {
      if (!filled[i] && ext[i]) {
        bg[i] = fr[i];
        filled[i] = 1;
      }
    }
  }

  const q = [];
  for (let i = 0; i < CROP_FSIZE; i++) {
    if (!filled[i]) {
      const x = i % CROP_W;
      const y = (i / CROP_W) | 0;
      if (
        (x > 0 && filled[i - 1]) ||
        (x < CROP_W - 1 && filled[i + 1]) ||
        (y > 0 && filled[i - CROP_W]) ||
        (y < CROP_H - 1 && filled[i + CROP_W])
      ) {
        q.push(i);
      }
    }
  }

  let frontier = q;
  while (frontier.length > 0) {
    const next = [];
    const updates = [];
    for (const idx of frontier) {
      if (filled[idx]) continue;
      const x = idx % CROP_W;
      const y = (idx / CROP_W) | 0;
      let sum = 0;
      let cnt = 0;
      if (x > 0 && filled[idx - 1]) { sum += bg[idx - 1]; cnt++; }
      if (x < CROP_W - 1 && filled[idx + 1]) { sum += bg[idx + 1]; cnt++; }
      if (y > 0 && filled[idx - CROP_W]) { sum += bg[idx - CROP_W]; cnt++; }
      if (y < CROP_H - 1 && filled[idx + CROP_W]) { sum += bg[idx + CROP_W]; cnt++; }
      if (cnt > 0) {
        updates.push([idx, Math.round(sum / cnt)]);
        if (x > 0 && !filled[idx - 1]) next.push(idx - 1);
        if (x < CROP_W - 1 && !filled[idx + 1]) next.push(idx + 1);
        if (y > 0 && !filled[idx - CROP_W]) next.push(idx - CROP_W);
        if (y < CROP_H - 1 && !filled[idx + CROP_W]) next.push(idx + CROP_W);
      }
    }
    if (updates.length === 0) break;
    for (const [idx, val] of updates) {
      bg[idx] = val;
      filled[idx] = 1;
    }
    frontier = next;
  }

  let rem = 0;
  for (let i = 0; i < CROP_FSIZE; i++) {
    if (!filled[i]) rem++;
  }
  console.log('bg_404 unfilled:', rem);
  return bg;
}

async function loadRgbaSprite(name) {
  const file = path.join(SPRITE_DIR, `${name}.png`);
  const raw = await runSpawnCapture(['-v', 'error', '-i', file, '-vf', 'format=rgba', '-f', 'rawvideo', '-']);
  if (raw.length !== ICON_W * ICON_H * 4) {
    throw new Error(`Unexpected RGBA size for ${name}: ${raw.length}`);
  }
  let minX = ICON_W, maxX = -1, minY = ICON_H, maxY = -1;
  for (let y = 0; y < ICON_H; y++) {
    for (let x = 0; x < ICON_W; x++) {
      const a = raw[(y * ICON_W + x) * 4 + 3];
      if (a > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const bx0 = Math.max(0, minX - 2);
  const by0 = Math.max(0, minY - 2);
  const bx1 = Math.min(ICON_W - 1, maxX + 2);
  const by1 = Math.min(ICON_H - 1, maxY + 2);
  const pw = bx1 - bx0 + 1;
  const ph = by1 - by0 + 1;
  const color = new Uint8Array(pw * ph);
  const alpha = new Float32Array(pw * ph);

  for (let y = by0; y <= by1; y++) {
    for (let x = bx0; x <= bx1; x++) {
      const srcIdx = (y * ICON_W + x) * 4;
      const dstIdx = (y - by0) * pw + (x - bx0);
      const r = raw[srcIdx];
      const g = raw[srcIdx + 1];
      const b = raw[srcIdx + 2];
      const a = raw[srcIdx + 3] / 255;
      color[dstIdx] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      alpha[dstIdx] = a;
    }
  }
  return { bx0, by0, pw, ph, color, alpha };
}

async function loadAllSprites() {
  const names = ['barricade', 'lamp', 'leftLeg', 'rightLeg', 'torso', 'leftArm', 'rightArm', 'head', 'hat'];
  const loaded = await Promise.all(names.map((n) => loadRgbaSprite(n)));
  const out = {};
  names.forEach((n, idx) => { out[n] = loaded[idx]; });
  return out;
}

function drawTransformedPart(frameBuf, frameW, frameH, part, mat) {
  const { a, b, c, d, tx, ty } = mat;
  const det = a * d - b * c;
  if (Math.abs(det) < 1e-8) return;
  const invA = d / det;
  const invB = -b / det;
  const invC = -c / det;
  const invD = a / det;

  const corners = [
    [part.bx0, part.by0],
    [part.bx0 + part.pw, part.by0],
    [part.bx0, part.by0 + part.ph],
    [part.bx0 + part.pw, part.by0 + part.ph]
  ];
  let minCX = frameW, maxCX = 0, minCY = frameH, maxCY = 0;
  for (const [ix, iy] of corners) {
    const cx = a * ix + b * iy + tx;
    const cy = c * ix + d * iy + ty;
    if (cx < minCX) minCX = cx;
    if (cx > maxCX) maxCX = cx;
    if (cy < minCY) minCY = cy;
    if (cy > maxCY) maxCY = cy;
  }

  const xStart = Math.max(0, Math.floor(minCX) - 1);
  const xEnd = Math.min(frameW - 1, Math.ceil(maxCX) + 1);
  const yStart = Math.max(0, Math.floor(minCY) - 1);
  const yEnd = Math.min(frameH - 1, Math.ceil(maxCY) + 1);

  for (let cy = yStart; cy <= yEnd; cy++) {
    const dy = cy - ty;
    const rowOff = cy * frameW;
    for (let cx = xStart; cx <= xEnd; cx++) {
      const dx = cx - tx;
      const ix = invA * dx + invB * dy;
      const iy = invC * dx + invD * dy;
      const lx = ix - part.bx0;
      const ly = iy - part.by0;
      if (lx < 0 || lx >= part.pw - 1 || ly < 0 || ly >= part.ph - 1) continue;

      const x0 = lx | 0;
      const y0 = ly | 0;
      const fx = lx - x0;
      const fy = ly - y0;
      const idx00 = y0 * part.pw + x0;
      const idx10 = idx00 + 1;
      const idx01 = idx00 + part.pw;
      const idx11 = idx01 + 1;

      const al =
        (part.alpha[idx00] * (1 - fx) + part.alpha[idx10] * fx) * (1 - fy) +
        (part.alpha[idx01] * (1 - fx) + part.alpha[idx11] * fx) * fy;

      if (al > 0.01) {
        const col =
          (part.color[idx00] * (1 - fx) + part.color[idx10] * fx) * (1 - fy) +
          (part.color[idx01] * (1 - fx) + part.color[idx11] * fx) * fy;
        const dstIdx = rowOff + cx;
        frameBuf[dstIdx] = Math.round(frameBuf[dstIdx] * (1 - al) + col * al);
      }
    }
  }
}

function makeMat(pivotX, pivotY, deg, dx, dy) {
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    a: cos,
    b: -sin,
    c: sin,
    d: cos,
    tx: pivotX + dx - cos * pivotX + sin * pivotY,
    ty: pivotY + dy - sin * pivotX - cos * pivotY
  };
}

function mulMat(m1, m2) {
  return {
    a: m1.a * m2.a + m1.b * m2.c,
    b: m1.a * m2.b + m1.b * m2.d,
    c: m1.c * m2.a + m1.d * m2.c,
    d: m1.c * m2.b + m1.d * m2.d,
    tx: m1.a * m2.tx + m1.b * m2.ty + m1.tx,
    ty: m1.c * m2.tx + m1.d * m2.ty + m1.ty
  };
}

function applyMatPt(mat, ix, iy) {
  return [mat.a * ix + mat.b * iy + mat.tx, mat.c * ix + mat.d * iy + mat.ty];
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const vx = x2 - x1;
  const vy = y2 - y1;
  const wx = px - x1;
  const wy = py - y1;
  const c1 = vx * wx + vy * wy;
  if (c1 <= 0) return Math.hypot(px - x1, py - y1);
  const c2 = vx * vx + vy * vy;
  if (c2 <= c1) return Math.hypot(px - x2, py - y2);
  const t = c1 / c2;
  return Math.hypot(px - (x1 + t * vx), py - (y1 + t * vy));
}

function drawDiskCanvas(frameBuf, frameW, frameH, cx, cy, radius, colorVal, opacity = 1) {
  const x0 = Math.max(0, Math.floor(cx - radius - 1));
  const x1 = Math.min(frameW - 1, Math.ceil(cx + radius + 1));
  const y0 = Math.max(0, Math.floor(cy - radius - 1));
  const y1 = Math.min(frameH - 1, Math.ceil(cy + radius + 1));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dist = Math.hypot(x - cx, y - cy);
      if (dist <= radius + 1) {
        const aa = clamp(radius + 0.5 - dist, 0, 1) * opacity;
        if (aa > 0) {
          const i = y * frameW + x;
          frameBuf[i] = Math.round(frameBuf[i] * (1 - aa) + colorVal * aa);
        }
      }
    }
  }
}

function drawLineCanvas(frameBuf, frameW, frameH, x1, y1, x2, y2, thickness, colorVal, opacity = 1) {
  const half = thickness * 0.5;
  const minX = Math.max(0, Math.floor(Math.min(x1, x2) - half - 2));
  const maxX = Math.min(frameW - 1, Math.ceil(Math.max(x1, x2) + half + 2));
  const minY = Math.max(0, Math.floor(Math.min(y1, y2) - half - 2));
  const maxY = Math.min(frameH - 1, Math.ceil(Math.max(y1, y2) + half + 2));
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const d = distToSegment(x, y, x1, y1, x2, y2);
      if (d <= half + 0.8) {
        const aa = clamp(half + 0.5 - d, 0, 1) * opacity;
        if (aa > 0) {
          const i = y * frameW + x;
          frameBuf[i] = Math.round(frameBuf[i] * (1 - aa) + colorVal * aa);
        }
      }
    }
  }
}

function drawArcCanvas(frameBuf, frameW, frameH, cx, cy, rx, ry, angStart, angEnd, thickness, colorVal, opacity = 1, dashed = false) {
  const steps = Math.max(24, Math.ceil((Math.abs(angEnd - angStart) * Math.max(rx, ry)) / 2));
  for (let s = 0; s < steps; s++) {
    if (dashed && Math.floor(s / 4) % 2 === 1) continue;
    const t0 = angStart + ((angEnd - angStart) * s) / steps;
    const t1 = angStart + ((angEnd - angStart) * (s + 1)) / steps;
    drawLineCanvas(
      frameBuf, frameW, frameH,
      cx + rx * Math.cos(t0),
      cy + ry * Math.sin(t0),
      cx + rx * Math.cos(t1),
      cy + ry * Math.sin(t1),
      thickness, colorVal, opacity
    );
  }
}

function getPullEnvelope(f) {
  if (f <= 112 || f >= 381) return 0;
  if (f < 155) return 0.5 * (1 - Math.cos((Math.PI * (f - 112)) / (155 - 112)));
  if (f <= 340) return 1;
  return 0.5 * (1 + Math.cos((Math.PI * (f - 340)) / (381 - 340)));
}

function renderWorkerAndBarricade(frameBuf, cfg, sprites, f) {
  const { W, H, workerScale, workerOx, workerOy, groundY, pullShiftX, pullLiftY, tuftStroke, ufoHoverX, ufoHoverY, ufoScaleY } = cfg;
  const omegaWork = (2 * Math.PI * f) / 30;
  const omegaHover = (2 * Math.PI * (f - 150)) / 60;
  const pull = getPullEnvelope(f);

  const baseMat = { a: workerScale, b: 0, c: 0, d: workerScale, tx: workerOx, ty: workerOy };

  // Subtle barricade tremor when wrench taps
  const impactWave = pull < 0.2 ? Math.max(0, Math.sin(omegaWork)) : 0;
  const barVibX = impactWave > 0.5 ? (impactWave - 0.5) * 2.2 : 0;
  const barVibY = impactWave > 0.5 ? (impactWave - 0.5) * 1.5 : 0;
  const barMat = {
    a: workerScale,
    b: 0,
    c: 0,
    d: workerScale,
    tx: workerOx + barVibX,
    ty: workerOy + barVibY
  };

  // Draw barricade & lamp on ground
  drawTransformedPart(frameBuf, W, H, sprites.barricade, barMat);
  drawTransformedPart(frameBuf, W, H, sprites.lamp, barMat);

  // Pulsing warning light rays around the barricade beacon
  const lampCX = workerOx + 622 * workerScale + barVibX;
  const lampCY = workerOy + 460 * workerScale + barVibY;
  const lampPulse = 0.5 + 0.5 * Math.sin(omegaWork);
  if (lampPulse > 0.25) {
    const op = (lampPulse - 0.25) * 0.85;
    drawArcCanvas(frameBuf, W, H, lampCX, lampCY, 22 * (workerScale / 0.34), 22 * (workerScale / 0.34), -Math.PI * 0.85, -Math.PI * 0.15, 2.5, 20, op);
    drawArcCanvas(frameBuf, W, H, lampCX, lampCY, 32 * (workerScale / 0.34), 32 * (workerScale / 0.34), -Math.PI * 0.78, -Math.PI * 0.22, 2.0, 60, op * 0.65);
  }

  // Minimalist ground grass/surface ticks matching original cow style
  const gx0 = workerOx + 160 * workerScale;
  const gx1 = workerOx + 975 * workerScale;
  const tuftPts = [
    [gx0 - 14, groundY, gx0 - 18, groundY - 12],
    [gx0 + 185 * workerScale, groundY, gx0 + 181 * workerScale, groundY - 13],
    [gx0 + 195 * workerScale, groundY, gx0 + 201 * workerScale, groundY - 11],
    [gx1 - 12, groundY, gx1 - 16, groundY - 13],
    [gx1 - 2, groundY, gx1 + 4, groundY - 11]
  ];
  for (const [x1, y1, x2, y2] of tuftPts) {
    drawLineCanvas(frameBuf, W, H, x1, y1, x2, y2, tuftStroke, 0, 1);
  }

  // Impact spark ticks near left corner of barricade rail
  if (pull < 0.2 && Math.sin(omegaWork) > 0.35) {
    const tickOp = clamp((Math.sin(omegaWork) - 0.35) * 1.4, 0, 1) * (1 - pull * 5);
    const ix = workerOx + 494 * workerScale;
    const iy = workerOy + 520 * workerScale;
    drawLineCanvas(frameBuf, W, H, ix - 11, iy - 12, ix - 19, iy - 23, 2.8, 0, tickOp);
    drawLineCanvas(frameBuf, W, H, ix, iy - 16, ix + 1, iy - 29, 2.8, 0, tickOp);
    drawLineCanvas(frameBuf, W, H, ix + 12, iy - 11, ix + 20, iy - 22, 2.8, 0, tickOp);
  }

  // Hierarchical 2D worker transform rooted at waist (319, 580)
  const rootDx = (pullShiftX * pull + 6 * pull * Math.sin(omegaHover)) / workerScale;
  const rootDy =
    ((1 - pull) * (2.2 * Math.abs(Math.sin(omegaWork))) +
      pull * (pullLiftY + 8 * Math.sin(omegaHover))) /
    workerScale;
  const rootDeg =
    (1 - pull) * (4 + 2.5 * Math.sin(omegaWork)) +
    pull * (-12 + 5 * Math.cos(omegaHover));

  const rootLocal = makeMat(319, 580, rootDeg, rootDx, rootDy);
  const rootWorld = mulMat(baseMat, rootLocal);

  const leftLegDeg = pull * (16 * Math.sin(omegaWork));
  const rightLegDeg = pull * (-16 * Math.sin(omegaWork));
  const leftArmDeg =
    (1 - pull) * (-5 + 10 * Math.cos(omegaWork)) +
    pull * (24 + 18 * Math.cos(omegaWork));
  const rightArmDeg =
    (1 - pull) * (-56 + 24 * Math.sin(omegaWork)) +
    pull * (-108 + 22 * Math.sin(omegaWork));
  const headDeg =
    (1 - pull) * (3 + 3 * Math.sin(omegaWork)) +
    pull * (-14 + 4 * Math.sin(omegaHover));
  const hatDeg = headDeg - 6 * pull;
  const hatDy = -16 * pull - 5 * pull * Math.sin(omegaWork);

  const leftLegMat = mulMat(rootWorld, makeMat(276, 585, leftLegDeg, 0, 0));
  const rightLegMat = mulMat(rootWorld, makeMat(362, 585, rightLegDeg, 0, 0));
  const leftArmMat = mulMat(rootWorld, makeMat(246, 396, leftArmDeg, 0, 0));
  const rightArmMat = mulMat(rootWorld, makeMat(392, 396, rightArmDeg, 0, 0));
  const headMat = mulMat(rootWorld, makeMat(322, 345, headDeg, 0, 0));
  const hatMat = mulMat(rootWorld, makeMat(322, 232, hatDeg, 0, hatDy));

  // Draw order: legs -> arms -> torso (cleanly hides joints!) -> head -> hat
  drawTransformedPart(frameBuf, W, H, sprites.leftLeg, leftLegMat);
  drawTransformedPart(frameBuf, W, H, sprites.rightLeg, rightLegMat);
  drawTransformedPart(frameBuf, W, H, sprites.leftArm, leftArmMat);
  drawTransformedPart(frameBuf, W, H, sprites.rightArm, rightArmMat);
  drawTransformedPart(frameBuf, W, H, sprites.torso, rootWorld);
  drawTransformedPart(frameBuf, W, H, sprites.head, headMat);
  drawTransformedPart(frameBuf, W, H, sprites.hat, hatMat);

  // Tractor-pull wave arcs + rising dust pebbles when abducted
  if (pull > 0.05) {
    const [workerCX, workerTopY] = applyMatPt(rootWorld, 322, 160);
    const ufoBottomY = ufoHoverY + 125 * ufoScaleY;
    const waveOp = 0.65 * pull;
    for (let k = 0; k < 3; k++) {
      const phase = ((f / 22) + k / 3) % 1;
      const ryPos = workerTopY - 12 - phase * Math.max(30, workerTopY - ufoBottomY - 18);
      const rxWidth = (56 - phase * 22) * (workerScale / 0.34);
      drawArcCanvas(
        frameBuf, W, H,
        (ufoHoverX + workerCX) * 0.5, ryPos,
        rxWidth, 12 * (workerScale / 0.34),
        0.15 * Math.PI, 0.85 * Math.PI,
        2.6, 20, waveOp * (1 - 0.35 * phase), true
      );
    }

    for (let p = 0; p < 6; p++) {
      const pPhase = ((f / 28) + p * 0.17) % 1;
      const px = workerOx + (190 + p * 44) * workerScale + Math.sin(p * 2.1 + f * 0.1) * 5;
      const py = groundY - 6 - pPhase * 75 * pull;
      drawDiskCanvas(frameBuf, W, H, px, py, 2.3, 20, 0.75 * pull * (1 - pPhase * 0.6));
    }
  }
}

function buildUfoLayer(cropFr, bg404, f) {
  // Cow rises into y >= 874 (crop y >= 454) during frames 120..365; outside that range UFO swoops down to y = 886 (crop y = 466)
  const maxUfoY = (f >= 120 && f <= 365) ? 435 : 485;
  const ext0 = getExtMask(cropFr, 0, 180, maxUfoY);
  const ext4 = getExtMask(cropFr, 4, 195, maxUfoY);
  const color = new Uint8Array(CROP_FSIZE);
  const alpha = new Float32Array(CROP_FSIZE);

  let minX = CROP_W, maxX = 0, minY = maxUfoY, maxY = 0;
  for (let y = 0; y < maxUfoY; y++) {
    for (let x = 0; x < CROP_W; x++) {
      const i = y * CROP_W + x;
      if (!ext0[i]) {
        color[i] = cropFr[i];
        alpha[i] = 1;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      } else if (!ext4[i]) {
        const trans = clamp(cropFr[i] / Math.max(1, bg404[i]), 0, 1);
        const a = 1 - trans;
        if (a > 0.01) {
          color[i] = 0;
          alpha[i] = a;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
  }
  return { color, alpha, minX, maxX, minY, maxY };
}

function compositeScaledUfo(frameBuf, cfg, ufo, dxShift, dyShift) {
  const { W, H, ufoScaleX, ufoScaleY, ufoTravelX, ufoHoverX, ufoHoverY } = cfg;
  // Center of this frame's shifted UFO in crop coords:
  const srcCenterX = (ufo.minX + ufo.maxX) * 0.5 + dxShift;
  const srcCenterY = (ufo.minY + ufo.maxY) * 0.5 + dyShift;
  const dstCenterX = ufoHoverX + (srcCenterX - ORIG_HOVER_CX) * ufoTravelX;
  const dstCenterY = ufoHoverY + (srcCenterY - ORIG_HOVER_CY) * ufoScaleY;

  const halfW = ((ufo.maxX - ufo.minX) * 0.5 + 4) * ufoScaleX;
  const halfH = ((ufo.maxY - ufo.minY) * 0.5 + 4) * ufoScaleY;

  const xStart = Math.max(0, Math.floor(dstCenterX - halfW));
  const xEnd = Math.min(W - 1, Math.ceil(dstCenterX + halfW));
  const yStart = Math.max(0, Math.floor(dstCenterY - halfH));
  const yEnd = Math.min(H - 1, Math.ceil(dstCenterY + halfH));

  for (let ty = yStart; ty <= yEnd; ty++) {
    const sy = (ty - dstCenterY) / ufoScaleY + (ufo.minY + ufo.maxY) * 0.5;
    if (sy < 0 || sy >= CROP_H - 1) continue;
    const y0 = sy | 0;
    const fy = sy - y0;
    const rowOff = ty * W;

    for (let tx = xStart; tx <= xEnd; tx++) {
      const sx = (tx - dstCenterX) / ufoScaleX + (ufo.minX + ufo.maxX) * 0.5;
      if (sx < 0 || sx >= CROP_W - 1) continue;
      const x0 = sx | 0;
      const fx = sx - x0;

      const idx00 = y0 * CROP_W + x0;
      const idx10 = idx00 + 1;
      const idx01 = idx00 + CROP_W;
      const idx11 = idx01 + 1;

      const a00 = ufo.alpha[idx00], a10 = ufo.alpha[idx10];
      const a01 = ufo.alpha[idx01], a11 = ufo.alpha[idx11];
      const al = (a00 * (1 - fx) + a10 * fx) * (1 - fy) + (a01 * (1 - fx) + a11 * fx) * fy;

      if (al > 0.01) {
        // Premultiply color by alpha before bilinear interpolation so transparent edge never halos white/black!
        const c00 = ufo.color[idx00] * a00, c10 = ufo.color[idx10] * a10;
        const c01 = ufo.color[idx01] * a01, c11 = ufo.color[idx11] * a11;
        const premul = (c00 * (1 - fx) + c10 * fx) * (1 - fy) + (c01 * (1 - fx) + c11 * fx) * fy;
        const dstIdx = rowOff + tx;
        frameBuf[dstIdx] = Math.round(frameBuf[dstIdx] * (1 - al) + premul);
      }
    }
  }
}

function computeFullMAE(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += Math.abs(a[i] - b[i]);
  }
  return sum / a.length;
}

async function encodePreset(cfg, bg404, ufoLayers, sprites) {
  const { name, W, H, bgPng, outWebm } = cfg;
  const fullFsize = W * H;
  console.log(`\n=== Building ${name} (${W}x${H}) -> ${outWebm} ===`);

  const bgNew = await runSpawnCapture(['-v', 'error', '-i', bgPng, '-vf', 'format=gray', '-f', 'rawvideo', '-']);
  if (bgNew.length !== fullFsize) {
    throw new Error(`Expected bgNew ${fullFsize} bytes, got ${bgNew.length}`);
  }

  const enc = spawn(FFMPEG, [
    '-v', 'error',
    '-f', 'rawvideo',
    '-pix_fmt', 'gray',
    '-s', `${W}x${H}`,
    '-r', '60',
    '-i', '-',
    '-c:v', 'libvpx-vp9',
    '-b:v', '0',
    '-crf', '18',
    '-deadline', 'good',
    '-cpu-used', '4',
    '-tile-columns', '2',
    '-tile-rows', '1',
    '-frame-parallel', '1',
    '-g', '30',
    '-lag-in-frames', '0',
    '-auto-alt-ref', '0',
    '-pix_fmt', 'yuv420p',
    '-y', outWebm
  ], { stdio: ['pipe', 'inherit', 'inherit'] });

  const encDone = new Promise((resolve, reject) => {
    enc.on('error', reject);
    enc.on('close', (code) => {
      if (code !== 0) reject(new Error(`Encoder (${name}) exited with code ${code}`));
      else resolve();
    });
  });

  let frame0 = null;
  let frame1 = null;
  let frame419 = null;

  for (let f = 0; f < LOOP_FRAMES; f++) {
    const frameBuf = Buffer.from(bgNew);

    // 1. Render articulated line-art worker & barricade
    renderWorkerAndBarricade(frameBuf, cfg, sprites, f);

    // 2. Composite scaled & phase-matched UFO foreground
    if (f < 25) {
      const bufA = Buffer.from(frameBuf);
      const bufB = Buffer.from(frameBuf);
      compositeScaledUfo(bufA, cfg, ufoLayers[LOOP_FRAMES + f], DX_TOTAL, DY_TOTAL);
      compositeScaledUfo(bufB, cfg, ufoLayers[f], 0, 0);
      const u = f / 25;
      const alpha = u * u * (3 - 2 * u);
      for (let i = 0; i < fullFsize; i++) {
        frameBuf[i] = Math.round((1 - alpha) * bufA[i] + alpha * bufB[i]);
      }
    } else if (f >= 330) {
      const t = (f - 330) / (LOOP_FRAMES - 330);
      const e = 0.5 * (1 - Math.cos(Math.PI * t));
      compositeScaledUfo(frameBuf, cfg, ufoLayers[f], DX_TOTAL * e, DY_TOTAL * e);
    } else {
      compositeScaledUfo(frameBuf, cfg, ufoLayers[f], 0, 0);
    }

    if (f === 0) frame0 = Buffer.from(frameBuf);
    if (f === 1) frame1 = Buffer.from(frameBuf);
    if (f === LOOP_FRAMES - 1) frame419 = Buffer.from(frameBuf);

    const ok = enc.stdin.write(frameBuf);
    if (!ok) {
      await new Promise((r) => enc.stdin.once('drain', r));
    }
  }

  enc.stdin.end();
  await encDone;

  console.log(`[${name}] Full-frame MAE(frame 419 -> frame 0): ${computeFullMAE(frame419, frame0).toFixed(4)}`);
  console.log(`[${name}] Full-frame MAE(frame 0   -> frame 1): ${computeFullMAE(frame0, frame1).toFixed(4)}`);
}

async function main() {
  console.log('Decoding original video UFO crop and loading line-art sprites...');
  const [cropBuf, sprites] = await Promise.all([
    runSpawnCapture([
      '-v', 'error', '-i', INPUT_MOV,
      '-vf', `crop=${CROP_W}:${CROP_H}:${CROP_X0}:${CROP_Y0},format=gray`,
      '-f', 'rawvideo', '-'
    ]),
    loadAllSprites()
  ]);

  const totalDecoded = Math.floor(cropBuf.length / CROP_FSIZE);
  console.log('Decoded cropped frames:', totalDecoded);
  if (totalDecoded < 445) {
    throw new Error(`Expected >= 445 frames, got ${totalDecoded}`);
  }

  const bg404 = buildBackground404(cropBuf);
  console.log('Pre-extracting UFO RGBA layers for frames 0..444...');
  const ufoLayers = new Array(445);
  for (let f = 0; f < 445; f++) {
    const fr = cropBuf.subarray(f * CROP_FSIZE, (f + 1) * CROP_FSIZE);
    ufoLayers[f] = buildUfoLayer(fr, bg404, f);
  }

  for (const preset of PRESETS) {
    await encodePreset(preset, bg404, ufoLayers, sprites);
  }
  console.log('\nAll desktop & mobile loop videos generated successfully.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
