import type { Clip, MediaClip, Project, SceneClip, TextClip } from '@/types';
import { getRuntime } from '@/lib/assets';

const easeOut = (t: number) => 1 - (1 - t) ** 3;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const n = parseInt(full.slice(0, 6) || 'ffffff', 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function safeColor(c: string | undefined, fallback: string): string {
  return c && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c) ? c : fallback;
}

function paletteOf(clip: SceneClip): [string, string, string] {
  return [
    safeColor(clip.palette[0], '#ff6a3d'),
    safeColor(clip.palette[1], '#8b5cf6'),
    safeColor(clip.palette[2], '#0a0a12'),
  ];
}

function drawStars(ctx: CanvasRenderingContext2D, W: number, H: number, seed: number, count: number, alpha = 1) {
  const rand = mulberry32(seed);
  for (let i = 0; i < count; i++) {
    const x = rand() * W;
    const y = rand() * H;
    const r = rand() * 1.6 + 0.3;
    const a = (rand() * 0.7 + 0.15) * alpha;
    ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function sceneAurora(ctx: CanvasRenderingContext2D, W: number, H: number, p: number, pal: string[], seed: number) {
  const [a, b, bg] = pal;
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#05060c');
  g.addColorStop(0.55, bg);
  g.addColorStop(1, '#05060c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const blobs = [
    { c: a, x: 0.28, y: 0.38, r: 0.55, f: 0.7, s: 0 },
    { c: b, x: 0.72, y: 0.52, r: 0.62, f: 1.1, s: 2 },
    { c: a, x: 0.55, y: 0.2, r: 0.35, f: 1.6, s: 4 },
    { c: b, x: 0.2, y: 0.75, r: 0.45, f: 0.9, s: 1 },
  ];
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const blob of blobs) {
    const x = (blob.x + Math.sin(p * Math.PI * 2 * blob.f + blob.s) * 0.1) * W;
    const y = (blob.y + Math.cos(p * Math.PI * 2 * blob.f * 0.8 + blob.s) * 0.09) * H;
    const rad = blob.r * Math.max(W, H) * 0.72;
    const gr = ctx.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, rgba(blob.c, 0.55));
    gr.addColorStop(0.38, rgba(blob.c, 0.18));
    gr.addColorStop(1, rgba(blob.c, 0));
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();

  // aurora ribbons
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 3; i++) {
    const yy = H * (0.18 + i * 0.12);
    const grad = ctx.createLinearGradient(0, yy, W, yy + H * 0.3);
    grad.addColorStop(0, rgba(a, 0));
    grad.addColorStop(0.3, rgba(a, 0.13));
    grad.addColorStop(0.6, rgba(b, 0.16));
    grad.addColorStop(1, rgba(b, 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(-W * 0.1, yy);
    for (let x = -W * 0.1; x <= W * 1.1; x += W / 26) {
      const y = yy + Math.sin(x / W * Math.PI * 3 + p * Math.PI * 2 + i) * H * 0.055;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W * 1.1, H * 1.2);
    ctx.lineTo(-W * 0.1, H * 1.2);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  drawStars(ctx, W, H, seed, 90, 0.5);

  const beam = ctx.createLinearGradient(W * 0.1, H, W * 0.75, 0);
  beam.addColorStop(0, 'rgba(255,255,255,0)');
  beam.addColorStop(0.5, 'rgba(255,255,255,0.045)');
  beam.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = beam;
  ctx.fillRect(0, 0, W, H);
}

function sceneNebula(ctx: CanvasRenderingContext2D, W: number, H: number, p: number, pal: string[], seed: number) {
  const [a, b, bg] = pal;
  const g = ctx.createRadialGradient(W * 0.5, H * 0.45, 0, W * 0.5, H * 0.45, Math.max(W, H) * 0.8);
  g.addColorStop(0, '#0b0a18');
  g.addColorStop(0.55, bg);
  g.addColorStop(1, '#030308');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  drawStars(ctx, W, H, seed, 220, 0.85);

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 5; i++) {
    const ang = p * Math.PI * 0.35 + i * 1.3;
    const x = W * (0.5 + Math.cos(ang) * (0.1 + i * 0.045));
    const y = H * (0.48 + Math.sin(ang * 1.2) * (0.08 + i * 0.03));
    const rad = Math.max(W, H) * (0.3 + i * 0.06);
    const col = i % 2 === 0 ? a : b;
    const gr = ctx.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, rgba(col, 0.3));
    gr.addColorStop(0.4, rgba(col, 0.08));
    gr.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();

  // planet
  const px = W * 0.72;
  const py = H * 0.3;
  const pr = Math.min(W, H) * 0.11;
  const pg = ctx.createRadialGradient(px - pr * 0.4, py - pr * 0.5, pr * 0.1, px, py, pr);
  pg.addColorStop(0, rgba(a, 0.95));
  pg.addColorStop(0.55, rgba(b, 0.55));
  pg.addColorStop(1, 'rgba(5,5,12,0.95)');
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = pg;
  ctx.beginPath();
  ctx.arc(px, py, pr, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = rgba(a, 0.35);
  ctx.lineWidth = Math.max(1, H * 0.0015);
  ctx.beginPath();
  ctx.ellipse(px, py, pr * 1.65, pr * 0.32, -0.35, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function sceneGrid(ctx: CanvasRenderingContext2D, W: number, H: number, p: number, pal: string[]) {
  const [a, b] = pal;
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#06030f');
  sky.addColorStop(0.42, '#1a0b2e');
  sky.addColorStop(0.58, '#2b0f3f');
  sky.addColorStop(1, '#06030f');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  drawStars(ctx, W, H, 991, 130, 0.6);

  const hz = H * 0.56;
  const cx = W * 0.5;
  const sunR = Math.min(W, H) * 0.2;
  const sun = ctx.createLinearGradient(0, hz - sunR * 2, 0, hz);
  sun.addColorStop(0, '#ffe08a');
  sun.addColorStop(0.45, a);
  sun.addColorStop(1, b);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, hz - sunR * 0.25, sunR, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = sun;
  ctx.fillRect(cx - sunR, hz - sunR * 2, sunR * 2, sunR * 2);
  ctx.fillStyle = 'rgba(8,3,16,0.72)';
  for (let i = 0; i < 7; i++) {
    const y = hz - sunR * 0.95 + i * sunR * 0.19;
    const h = sunR * (0.025 + i * 0.012);
    ctx.fillRect(cx - sunR, y, sunR * 2, h);
  }
  ctx.restore();

  // mountains
  ctx.fillStyle = '#0a0414';
  ctx.beginPath();
  ctx.moveTo(0, hz);
  const rand = mulberry32(77);
  let x = 0;
  while (x < W) {
    const step = W * (0.06 + rand() * 0.08);
    const peak = hz - H * (0.02 + rand() * 0.1);
    ctx.lineTo(x + step / 2, peak);
    ctx.lineTo(x + step, hz);
    x += step;
  }
  ctx.lineTo(W, hz);
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fill();

  // grid
  ctx.save();
  ctx.strokeStyle = rgba(a, 0.5);
  ctx.lineWidth = Math.max(1, H * 0.0012);
  ctx.shadowColor = rgba(a, 0.5);
  ctx.shadowBlur = H * 0.008;
  for (let i = -14; i <= 14; i++) {
    ctx.beginPath();
    ctx.moveTo(cx + i * W * 0.012, hz);
    ctx.lineTo(cx + i * W * 0.2, H);
    ctx.stroke();
  }
  const speed = (p * 1.5) % 1;
  for (let i = 0; i < 16; i++) {
    const t = ((i / 16 + speed) % 1) ** 2.2;
    const y = hz + t * (H - hz);
    ctx.globalAlpha = 0.18 + t * 0.62;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.restore();

  const haze = ctx.createLinearGradient(0, hz - H * 0.06, 0, hz + H * 0.12);
  haze.addColorStop(0, rgba(b, 0));
  haze.addColorStop(0.5, rgba(a, 0.22));
  haze.addColorStop(1, rgba(b, 0));
  ctx.fillStyle = haze;
  ctx.fillRect(0, hz - H * 0.06, W, H * 0.18);
}

function sceneParticles(ctx: CanvasRenderingContext2D, W: number, H: number, p: number, pal: string[], seed: number) {
  const [a, b, bg] = pal;
  const g = ctx.createLinearGradient(0, 0, W * 0.7, H);
  g.addColorStop(0, '#07070c');
  g.addColorStop(0.6, bg);
  g.addColorStop(1, '#0a0714');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const rand = mulberry32(seed);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 70; i++) {
    const depth = rand();
    const baseX = rand() * W;
    const speed = 0.15 + depth * 0.7;
    const y = H + 40 - ((rand() * H + p * H * 1.35 * speed) % (H + 80));
    const x = baseX + Math.sin(p * Math.PI * 2 + i) * W * 0.03 * depth;
    const r = (2 + depth * 16) * (Math.min(W, H) / 1080);
    const col = i % 3 === 0 ? b : a;
    const gr = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
    gr.addColorStop(0, rgba(col, 0.6 * (0.35 + depth * 0.65)));
    gr.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.arc(x, y, r * 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  const glow = ctx.createRadialGradient(W * 0.5, H * 0.62, 0, W * 0.5, H * 0.62, W * 0.55);
  glow.addColorStop(0, rgba(a, 0.14));
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
}

function sceneWaves(ctx: CanvasRenderingContext2D, W: number, H: number, p: number, pal: string[]) {
  const [a, b, bg] = pal;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, bg);
  g.addColorStop(0.5, '#0a0a14');
  g.addColorStop(1, '#050508');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W * 0.5, H * 0.35, 0, W * 0.5, H * 0.35, W * 0.6);
  glow.addColorStop(0, rgba(a, 0.18));
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  for (let layer = 0; layer < 7; layer++) {
    const yBase = H * (0.35 + layer * 0.075);
    const amp = H * (0.035 + layer * 0.006);
    const phase = p * Math.PI * (1.2 + layer * 0.18) + layer * 1.6;
    const grad = ctx.createLinearGradient(0, yBase - amp, 0, H);
    const col = layer % 2 === 0 ? a : b;
    grad.addColorStop(0, rgba(col, 0.26 - layer * 0.022));
    grad.addColorStop(1, rgba(col, 0.015));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += W / 80) {
      const y = yBase + Math.sin((x / W) * Math.PI * 3.2 + phase) * amp + Math.sin((x / W) * Math.PI * 7 + phase * 1.7) * amp * 0.25;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
  }

  ctx.strokeStyle = rgba(a, 0.4);
  ctx.lineWidth = Math.max(1, H * 0.001);
  ctx.beginPath();
  for (let x = 0; x <= W; x += W / 120) {
    const y = H * 0.53 + Math.sin((x / W) * Math.PI * 3.2 + p * Math.PI * 2) * H * 0.045;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function sceneSpotlight(ctx: CanvasRenderingContext2D, W: number, H: number, p: number, pal: string[]) {
  const [a, b] = pal;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#050409');
  g.addColorStop(0.62, '#0b0a12');
  g.addColorStop(1, '#030305');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const sources = [
    { x: 0.18, y: 0.05, ang: 0.42, col: a },
    { x: 0.78, y: 0.0, ang: -0.3, col: b },
    { x: 0.52, y: 0.12, ang: 0.12, col: a },
  ];
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (const s of sources) {
    const sway = Math.sin(p * Math.PI * 1.4 + s.x * 9) * 0.05;
    ctx.save();
    ctx.translate(s.x * W, s.y * H);
    ctx.rotate(s.ang + sway);
    const beam = ctx.createLinearGradient(0, 0, 0, H * 1.1);
    beam.addColorStop(0, rgba(s.col, 0.34));
    beam.addColorStop(0.55, rgba(s.col, 0.1));
    beam.addColorStop(1, rgba(s.col, 0));
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(-W * 0.02, 0);
    ctx.lineTo(W * 0.02, 0);
    ctx.lineTo(W * 0.34, H * 1.15);
    ctx.lineTo(-W * 0.22, H * 1.15);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  // floor reflection
  const floor = ctx.createLinearGradient(0, H * 0.78, 0, H);
  floor.addColorStop(0, 'rgba(255,255,255,0.06)');
  floor.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = floor;
  ctx.fillRect(0, H * 0.78, W, H * 0.22);

  // dust
  const rand = mulberry32(42);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 55; i++) {
    const x = rand() * W;
    const y = ((rand() * H) + p * H * 0.06) % H;
    const r = rand() * 2 + 0.5;
    ctx.fillStyle = `rgba(255,255,255,${(rand() * 0.3 + 0.05).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function sceneSkyline(ctx: CanvasRenderingContext2D, W: number, H: number, p: number, pal: string[], seed: number) {
  const [a, b] = pal;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#050712');
  g.addColorStop(0.5, '#101528');
  g.addColorStop(0.66, '#2a1830');
  g.addColorStop(1, '#05060a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  drawStars(ctx, W, H * 0.6, seed + 12, 120, 0.5);

  const sunX = W * 0.68;
  const sunY = H * 0.44;
  const sunR = Math.min(W, H) * 0.14;
  const sg = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
  sg.addColorStop(0, '#ffd8a8');
  sg.addColorStop(1, a);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = sg;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const horizon = H * 0.66;
  const rand = mulberry32(seed + 7);
  const layers = [
    { y: horizon, h: 0.2, col: '#0c0c16', alpha: 0.85, n: 16 },
    { y: horizon + H * 0.08, h: 0.28, col: '#07070d', alpha: 1, n: 13 },
  ];
  for (const layer of layers) {
    let x = -W * 0.03;
    while (x < W * 1.03) {
      const bw = W * (0.025 + rand() * 0.06);
      const bh = H * layer.h * (0.25 + rand() * 0.9);
      const y = layer.y - bh;
      ctx.fillStyle = layer.col;
      ctx.globalAlpha = layer.alpha;
      ctx.fillRect(x, y, bw, bh + H);
      // windows
      if (layer.alpha === 1) {
        const cols = Math.max(2, Math.floor(bw / (W * 0.012)));
        const rows = Math.max(3, Math.floor(bh / (H * 0.035)));
        for (let c = 0; c < cols; c++) {
          for (let r = 0; r < rows; r++) {
            if (rand() > 0.72) {
              ctx.fillStyle = rand() > 0.5 ? rgba(a, 0.65) : rgba(b, 0.55);
              ctx.fillRect(x + (c + 0.3) * (bw / cols), y + (r + 0.35) * (bh / rows), bw / cols * 0.34, H * 0.01);
            }
          }
        }
      }
      x += bw + W * 0.004;
    }
  }
  ctx.globalAlpha = 1;

  const haze = ctx.createLinearGradient(0, horizon - H * 0.1, 0, horizon + H * 0.24);
  haze.addColorStop(0, 'rgba(0,0,0,0)');
  haze.addColorStop(0.5, rgba(b, 0.15));
  haze.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, horizon - H * 0.1, W, H * 0.34);
}

function sceneEditorial(ctx: CanvasRenderingContext2D, W: number, H: number, p: number, pal: string[]) {
  const [a, b] = pal;
  ctx.fillStyle = '#efe9dc';
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.fillStyle = a;
  ctx.fillRect(0, H * 0.72, W, H * 0.28);
  ctx.fillStyle = b;
  ctx.fillRect(W * 0.72, 0, W * 0.28, H * 0.72);
  ctx.restore();

  ctx.strokeStyle = 'rgba(20,17,12,0.18)';
  ctx.lineWidth = Math.max(1, W * 0.0008);
  for (let i = 1; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo((W / 6) * i, 0);
    ctx.lineTo((W / 6) * i, H);
    ctx.stroke();
  }

  const cx = W * 0.4 + Math.sin(p * Math.PI * 2) * W * 0.01;
  const cy = H * 0.4;
  const r = Math.min(W, H) * 0.26;
  ctx.save();
  ctx.strokeStyle = 'rgba(20,17,12,0.5)';
  ctx.lineWidth = Math.max(2, W * 0.002);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(20,17,12,0.06)';
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(p * 0.4);
  ctx.fillStyle = 'rgba(20,17,12,0.75)';
  ctx.fillRect(-r * 0.5, -2, r, 4);
  ctx.fillRect(-2, -r * 0.5, 4, r);
  ctx.restore();

  const num = Math.floor(p * 8) + 1;
  ctx.fillStyle = 'rgba(20,17,12,0.08)';
  ctx.font = `400 ${Math.floor(H * 0.75)}px "Instrument Serif", serif`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText(String(num).padStart(2, '0'), W * 0.95, H * 0.88);
}

function drawSceneText(ctx: CanvasRenderingContext2D, clip: SceneClip, W: number, H: number, p: number, editorial: boolean) {
  if (!clip.showText || (!clip.title && !clip.subtitle)) return;
  const vertical = H > W;
  const x = vertical ? W * 0.5 : W * 0.075;
  const align = vertical ? 'center' : 'left';
  const maxW = vertical ? W * 0.82 : W * 0.62;
  const titleSize = H * (vertical ? 0.062 : 0.072);
  const subSize = H * (vertical ? 0.024 : 0.023);
  const baseY = vertical ? H * 0.68 : H * 0.7;

  const reveal = Math.min(1, p / 0.14);
  const alpha = easeOut(reveal);
  const rise = (1 - alpha) * H * 0.04;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = align as CanvasTextAlign;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = editorial ? '#14110c' : '#f7f4ec';
  ctx.font = `600 ${titleSize}px "Sora", sans-serif`;
  ctx.shadowColor = editorial ? 'rgba(255,255,255,0)' : 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = editorial ? 0 : H * 0.02;
  const lines = wrapText(ctx, clip.title, maxW, 3);
  let y = baseY + rise - (lines.length - 1) * titleSize * 1.04;
  for (const line of lines) {
    ctx.fillText(line, x, y);
    y += titleSize * 1.04;
  }
  ctx.shadowBlur = 0;

  if (clip.subtitle) {
    ctx.fillStyle = editorial ? 'rgba(20,17,12,0.7)' : 'rgba(245,242,234,0.78)';
    ctx.font = `400 ${subSize}px "Sora", sans-serif`;
    const subLines = wrapText(ctx, clip.subtitle, maxW * 0.86, 3);
    let sy = baseY + rise + subSize * 1.55;
    for (const line of subLines) {
      ctx.fillText(line, x, sy);
      sy += subSize * 1.45;
    }
  }

  // accent rule
  ctx.fillStyle = editorial ? '#14110c' : (clip.palette[0] || '#ff6a3d');
  ctx.fillRect(align === 'center' ? x - W * 0.035 : x, baseY - titleSize * 1.95 + rise, W * 0.07, Math.max(2, H * 0.0022));
  ctx.restore();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  if (!text) return [];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
      if (lines.length === maxLines - 1) break;
    } else {
      current = test;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  return lines;
}

function drawScene(ctx: CanvasRenderingContext2D, clip: SceneClip, W: number, H: number, p: number) {
  const pal = paletteOf(clip);
  ctx.save();
  switch (clip.template) {
    case 'nebula': sceneNebula(ctx, W, H, p, pal, clip.seed); break;
    case 'grid': sceneGrid(ctx, W, H, p, pal); break;
    case 'particles': sceneParticles(ctx, W, H, p, pal, clip.seed); break;
    case 'waves': sceneWaves(ctx, W, H, p, pal); break;
    case 'spotlight': sceneSpotlight(ctx, W, H, p, pal); break;
    case 'skyline': sceneSkyline(ctx, W, H, p, pal, clip.seed); break;
    case 'editorial': sceneEditorial(ctx, W, H, p, pal); break;
    default: sceneAurora(ctx, W, H, p, pal, clip.seed);
  }
  ctx.restore();
  drawSceneText(ctx, clip, W, H, p, clip.template === 'editorial');
}

function motionTransform(ctx: CanvasRenderingContext2D, clip: SceneClip, W: number, H: number, p: number) {
  let scale = 1;
  let dx = 0;
  let dy = 0;
  switch (clip.motion) {
    case 'zoom-in': scale = 1 + p * 0.14; break;
    case 'zoom-out': scale = 1.14 - p * 0.14; break;
    case 'parallax':
      scale = 1.1;
      dx = Math.sin(p * Math.PI) * W * 0.025;
      dy = Math.cos(p * Math.PI) * H * 0.015;
      break;
    case 'static': scale = 1; break;
    default:
      scale = 1.06 + p * 0.07;
      dx = Math.sin(p * Math.PI * 0.8) * W * 0.02;
      dy = -H * 0.01 + p * H * 0.02;
  }
  if (scale !== 1 || dx || dy) {
    ctx.translate(W / 2 + dx, H / 2 + dy);
    ctx.scale(scale, scale);
    ctx.translate(-W / 2, -H / 2);
  }
}

function drawMedia(ctx: CanvasRenderingContext2D, clip: MediaClip, W: number, H: number) {
  const rt = getRuntime(clip.assetId);
  const srcW = rt?.meta.width || W;
  const srcH = rt?.meta.height || H;
  const src = clip.fit === 'cover' ? Math.max(W / srcW, H / srcH) : Math.min(W / srcW, H / srcH);
  const dw = srcW * src * clip.scale;
  const dh = srcH * src * clip.scale;
  const cx = W / 2 + clip.x * W;
  const cy = H / 2 + clip.y * H;

  ctx.save();
  ctx.translate(cx, cy);
  if (clip.rotation) ctx.rotate((clip.rotation * Math.PI) / 180);
  const drawable =
    rt?.video && rt.video.readyState >= 2
      ? rt.video
      : rt?.image && rt.image.complete && rt.image.naturalWidth > 0
        ? rt.image
        : null;
  if (drawable) {
    try { ctx.drawImage(drawable as CanvasImageSource, -dw / 2, -dh / 2, dw, dh); } catch { /* noop */ }
  } else {
    const g = ctx.createLinearGradient(-dw / 2, -dh / 2, dw / 2, dh / 2);
    g.addColorStop(0, '#1a1a24');
    g.addColorStop(1, '#0a0a10');
    ctx.fillStyle = g;
    ctx.fillRect(-dw / 2, -dh / 2, dw, dh);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = `${Math.max(12, H * 0.018)}px "Sora", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(rt?.meta.name || 'Cargando medio…', 0, 0);
  }
  ctx.restore();
}

function drawTextClip(ctx: CanvasRenderingContext2D, clip: TextClip, W: number, H: number, local: number, p: number) {
  const scale = H / 1080;
  const fontSize = Math.max(8, clip.fontSize * scale);
  const maxW = clip.width * W;
  const x = clip.x * W;
  const y = clip.y * H;
  const fade = Math.min(1, local / 0.4) * Math.min(1, (clip.duration - local) / 0.4);
  let alpha = clip.opacity * Math.max(0, Math.min(1, fade));
  let offsetY = 0;
  let scaleText = 1;
  let text = clip.text;

  if (clip.animation === 'slide-up') offsetY = (1 - easeOut(Math.min(1, local / 0.6))) * fontSize * 0.6;
  if (clip.animation === 'fade') alpha *= easeOut(Math.min(1, local / 0.7));
  if (clip.animation === 'pop') {
    const t = Math.min(1, local / 0.45);
    scaleText = 0.9 + easeOut(t) * 0.1;
    alpha *= easeOut(t);
  }
  if (clip.animation === 'typewriter') {
    const chars = Math.min(text.length, Math.floor((local / Math.max(0.2, clip.duration * 0.55)) * text.length));
    text = text.slice(0, chars);
  }

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = clip.align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = clip.color;
  ctx.font = `${clip.fontWeight} ${fontSize}px "${clip.fontFamily}", ${clip.fontFamily === 'Instrument Serif' ? 'serif' : 'sans-serif'}`;
  const spacing = clip.letterSpacing * scale;
  if ('letterSpacing' in ctx) {
    (ctx as unknown as { letterSpacing: string }).letterSpacing = `${spacing}px`;
  }
  const content = clip.uppercase ? text.toUpperCase() : text;
  const lines = wrapText(ctx, content, maxW, 4);
  const lineHeight = fontSize * 1.16;
  const totalH = lines.length * lineHeight;
  const anchorX = clip.align === 'center' ? x : clip.align === 'right' ? x : x;
  const anchorY = y - totalH / 2 + lineHeight / 2;

  ctx.translate(anchorX, anchorY + offsetY);
  ctx.scale(scaleText, scaleText);
  ctx.translate(-anchorX, -anchorY);

  if (clip.background) {
    let maxLineW = 0;
    for (const line of lines) maxLineW = Math.max(maxLineW, ctx.measureText(line).width);
    const padX = fontSize * 0.5;
    const padY = fontSize * 0.35;
    const bx = clip.align === 'center' ? x - maxLineW / 2 : clip.align === 'right' ? x - maxLineW : x;
    ctx.fillStyle = 'rgba(6,6,10,0.62)';
    roundRect(ctx, bx - padX, anchorY - totalH / 2 - padY, maxLineW + padX * 2, totalH + padY * 2, fontSize * 0.18);
    ctx.fill();
  }

  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = fontSize * 0.22;
  lines.forEach((line, i) => {
    ctx.fillText(line, x, anchorY + i * lineHeight);
  });
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

let noiseTile: HTMLCanvasElement | null = null;
function getNoiseTile(): HTMLCanvasElement {
  if (noiseTile) return noiseTile;
  const c = document.createElement('canvas');
  c.width = 160;
  c.height = 160;
  const nctx = c.getContext('2d')!;
  const img = nctx.createImageData(160, 160);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  nctx.putImageData(img, 0, 0);
  noiseTile = c;
  return c;
}

function applyGrain(ctx: CanvasRenderingContext2D, W: number, H: number, amount: number) {
  if (amount <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(0.22, amount / 100 * 0.35);
  ctx.globalCompositeOperation = 'overlay';
  const pattern = ctx.createPattern(getNoiseTile(), 'repeat');
  if (pattern) {
    const ox = Math.floor(Math.random() * 160);
    const oy = Math.floor(Math.random() * 160);
    ctx.translate(-ox, -oy);
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, W + 160, H + 160);
  }
  ctx.restore();
}

function applyVignette(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.28, W / 2, H / 2, Math.max(W, H) * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.62)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

export interface RenderOptions {
  /** Optional transform for interactive preview (zoom/pan), not used for export. */
  debug?: boolean;
}

export function renderFrame(ctx: CanvasRenderingContext2D, project: Project, time: number, _opts: RenderOptions = {}): void {
  const W = project.width;
  const H = project.height;
  const sx = ctx.canvas.width / W;
  const sy = ctx.canvas.height / H;
  ctx.setTransform(sx, 0, 0, sy, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.filter = 'none';

  ctx.fillStyle = project.background || '#050508';
  ctx.fillRect(0, 0, W, H);

  const byTrack: Record<string, Clip[]> = {};
  for (const clip of project.clips) {
    (byTrack[clip.trackId] ||= []).push(clip);
  }

  for (const track of project.tracks) {
    if (track.hidden) continue;
    const clips = (byTrack[track.id] || []).slice().sort((a, b) => a.start - b.start);
    for (const clip of clips) {
      if (time < clip.start - 0.001 || time > clip.start + clip.duration + 0.001) continue;
      const local = Math.max(0, time - clip.start);
      const p = Math.min(1, local / Math.max(0.001, clip.duration));
      let alpha = clip.opacity;
      if (clip.fadeIn > 0) alpha *= Math.min(1, local / clip.fadeIn);
      if (clip.fadeOut > 0) alpha *= Math.min(1, (clip.duration - local) / clip.fadeOut);
      if (alpha <= 0.001) continue;
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      const f = clip.filter;
      ctx.filter = `brightness(${f.brightness}%) contrast(${f.contrast}%) saturate(${f.saturate}%) hue-rotate(${f.hue}deg)${f.blur ? ` blur(${f.blur}px)` : ''}`;

      if (clip.kind === 'scene') {
        ctx.save();
        motionTransform(ctx, clip, W, H, p);
        drawScene(ctx, clip, W, H, p);
        ctx.restore();
      } else if (clip.kind === 'media') {
        drawMedia(ctx, clip, W, H);
      } else if (clip.kind === 'text') {
        drawTextClip(ctx, clip, W, H, local, p);
      }
      ctx.filter = 'none';
      ctx.globalAlpha = 1;
    }
  }

  if (project.vignette) applyVignette(ctx, W, H);
  applyGrain(ctx, W, H, project.grain);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

export function renderThumbnail(project: Project, time: number, maxWidth = 480): string {
  const ratio = project.height / project.width;
  const w = Math.min(maxWidth, project.width);
  const h = Math.round(w * ratio);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) return '';
  renderFrame(ctx, project, time);
  return c.toDataURL('image/jpeg', 0.72);
}
