/**
 * vfx.js — 2D Canvas VFX Layer (FIXED + ENHANCED)
 *
 * SYNC          — energy conduit arcs between cores
 * INSTABILITY   — red warning flashes + sparks
 * LASER_CHARGE  — building glow at each core (FIXED gradient bug)
 * LASER_FIRE    — three massive volumetric beams, sequential ignition
 * BREACH        — reality tear rings expanding to white flash
 * WARP          — speed-line tunnel + chromatic aberration + flash
 */

let canvas, ctx;
let animId  = null;
let phase   = 'IDLE';
let phaseT  = 0;
let startMs = 0;
let onDone  = null;
let reducedMotion = false;

// Core beam colors (rgb values for flexible alpha)
const C = [
  { hex: '#ff0055', rgba: 'rgba(255,0,85,',   rgb: '255,0,85'   },
  { hex: '#00f0ff', rgba: 'rgba(0,240,255,',  rgb: '0,240,255'  },
  { hex: '#a855f7', rgba: 'rgba(168,85,247,', rgb: '168,85,247' },
];

// ─────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────

export function initVFX(reduced = false) {
  reducedMotion = reduced;
  canvas = document.getElementById('vfx-canvas');
  if (!canvas) return;
  ctx = canvas.getContext('2d');
  _resize();
  window.addEventListener('resize', _resize);
}

export function runVFXPhase(newPhase, callback) {
  if (animId) cancelAnimationFrame(animId);
  phase   = newPhase;
  phaseT  = 0;
  startMs = performance.now();
  onDone  = callback || null;
  _loop();
}

export function clearVFX() {
  phase = 'IDLE';
  if (animId) { cancelAnimationFrame(animId); animId = null; }
  if (ctx) ctx.clearRect(0, 0, _w(), _h());
}

// ─────────────────────────────────────────────────────────────────
// INTERNAL
// ─────────────────────────────────────────────────────────────────

function _resize() {
  if (!canvas) return;
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}
function _w() { return canvas?.width  || window.innerWidth;  }
function _h() { return canvas?.height || window.innerHeight; }

/** Live CSS centers of the three core cards */
function _coreCenters() {
  return [1, 2, 3].map(id => {
    const el = document.getElementById(`card-${id}`);
    if (el) {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }
    const xs = [0.2, 0.5, 0.8];
    return { x: _w() * xs[id - 1], y: _h() * 0.6 };
  });
}

function _loop() {
  if (!ctx) return;
  phaseT = (performance.now() - startMs) / 1000;
  ctx.clearRect(0, 0, _w(), _h());

  let done = false;
  switch (phase) {
    case 'SYNC':          done = _drawSync();         break;
    case 'INSTABILITY':   done = _drawInstability();  break;
    case 'LASER_CHARGE':  done = _drawLaserCharge();  break;
    case 'LASER_FIRE':    done = _drawLaserFire();    break;
    case 'BREACH':        done = _drawBreach();       break;
    case 'WARP':          done = _drawWarp();         break;
    default: return; // IDLE: stop loop, canvas already cleared
  }

  if (done) {
    ctx.clearRect(0, 0, _w(), _h());
    const cb = onDone; onDone = null; phase = 'IDLE'; animId = null;
    if (cb) cb();
    return;
  }

  animId = requestAnimationFrame(_loop);
}

// ─────────────────────────────────────────────────────────────────
// VFX PHASES
// ─────────────────────────────────────────────────────────────────

// ── SYNC: energy conduits between core cards ─────────────────────
function _drawSync() {
  const t = Math.min(1, phaseT / 2.8);
  const cores = _coreCenters();
  const cx = (cores[0].x + cores[1].x + cores[2].x) / 3;
  const cy = (cores[0].y + cores[1].y + cores[2].y) / 3;

  [[0,1],[1,2],[2,0]].forEach(([i1, i2], pi) => {
    const c1 = cores[i1], c2 = cores[i2];
    // Energy line
    ctx.save();
    ctx.lineWidth   = 3 + Math.sin(phaseT * 18 + pi) * 1.5;
    ctx.strokeStyle = C[pi].hex;
    ctx.shadowColor = C[pi].hex;
    ctx.shadowBlur  = 20;
    ctx.globalAlpha = t;
    ctx.beginPath();
    ctx.moveTo(c1.x, c1.y);
    ctx.lineTo(c1.x + (c2.x - c1.x) * t, c1.y + (c2.y - c1.y) * t);
    ctx.stroke();
    // Travelling pulse bead
    if (t > 0.1) {
      const pt = (phaseT * 1.6 + pi * 0.33) % 1;
      ctx.beginPath();
      ctx.arc(c1.x + (c2.x - c1.x) * pt, c1.y + (c2.y - c1.y) * pt, 5, 0, Math.PI * 2);
      ctx.fillStyle   = '#ffffff';
      ctx.shadowBlur  = 14;
      ctx.globalAlpha = t * 0.9;
      ctx.fill();
    }
    ctx.restore();
  });

  // Central convergence glow
  if (t > 0.5) {
    const gr = Math.min(65, (t - 0.5) * 130);
    ctx.save();
    const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, gr);
    g.addColorStop(0, `rgba(0,240,255,${t * 0.7})`);
    g.addColorStop(1, 'rgba(0,240,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, gr, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  return phaseT > 3.2;
}

// ── INSTABILITY: red alarm flashes + sparks ──────────────────────
function _drawInstability() {
  const flash = Math.abs(Math.sin(phaseT * 26)) * 0.32;
  ctx.save();
  ctx.fillStyle = `rgba(255,0,55,${flash})`;
  ctx.fillRect(0, 0, _w(), _h());
  ctx.restore();

  if (!reducedMotion) {
    const n = 8 + Math.floor(Math.random() * 10);
    for (let i = 0; i < n; i++) {
      const sx = Math.random() * _w();
      const sy = Math.random() * _h();
      ctx.save();
      ctx.fillStyle   = Math.random() > 0.4 ? '#ffffff' : '#ff0055';
      ctx.shadowColor = '#ff0055';
      ctx.shadowBlur  = 12;
      ctx.fillRect(sx, sy, Math.random() * 4 + 1, Math.random() * 14 + 3);
      ctx.restore();
    }
  }
  return phaseT > 2.2;
}

// ── LASER CHARGE: pulsing energy halo at each core ───────────────
// FIX: was using broken double-addColorStop(0,...) that overwrote itself
function _drawLaserCharge() {
  const t = Math.min(1, phaseT / 1.6);
  const cores = _coreCenters();

  cores.forEach((c, i) => {
    // Outer halo
    const r = 28 + t * 60 + Math.sin(phaseT * 22 + i * 1.3) * 10;
    ctx.save();
    const g = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, r);
    // White hot center → core color → transparent
    g.addColorStop(0,   `rgba(255,255,255,${t * 0.9})`);
    g.addColorStop(0.25, `${C[i].rgba}${t * 0.75})`);
    g.addColorStop(0.65, `${C[i].rgba}${t * 0.3})`);
    g.addColorStop(1,   `${C[i].rgba}0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Electric ring
    if (t > 0.3) {
      const ringT = (t - 0.3) / 0.7;
      ctx.save();
      ctx.beginPath();
      ctx.arc(c.x, c.y, 18 + ringT * 35, 0, Math.PI * 2);
      ctx.strokeStyle = C[i].hex;
      ctx.lineWidth   = 2.5;
      ctx.shadowColor = C[i].hex;
      ctx.shadowBlur  = 16;
      ctx.globalAlpha = Math.sin(phaseT * 12 + i) * 0.4 + 0.5;
      ctx.stroke();
      ctx.restore();
    }

    // Sparks radiating outward
    if (!reducedMotion && t > 0.5 && Math.random() < 0.35) {
      for (let s = 0; s < 3; s++) {
        const angle = Math.random() * Math.PI * 2;
        const len   = 12 + Math.random() * 20;
        ctx.save();
        ctx.strokeStyle = C[i].hex;
        ctx.lineWidth   = 1.5;
        ctx.shadowColor = C[i].hex;
        ctx.shadowBlur  = 8;
        ctx.globalAlpha = Math.random() * 0.7 + 0.2;
        ctx.beginPath();
        ctx.moveTo(c.x + Math.cos(angle) * 22, c.y + Math.sin(angle) * 22);
        ctx.lineTo(c.x + Math.cos(angle) * (22 + len), c.y + Math.sin(angle) * (22 + len));
        ctx.stroke();
        ctx.restore();
      }
    }
  });

  return phaseT > 2.0;
}

// ── LASER FIRE: three massive sequential beams ───────────────────
let _lp = []; // laser particles

function _drawLaserFire() {
  const w = _w(), h = _h();
  const t  = Math.min(1, phaseT / 3.8);
  const cores = _coreCenters();
  const tx = w * 0.5, ty = h * 0.06; // convergence apex

  // Particle spawn
  if (!reducedMotion && Math.random() < 0.75) {
    const ci = Math.floor(Math.random() * 3);
    const c  = cores[ci];
    const p  = Math.random();
    _lp.push({
      x:   c.x + (tx - c.x) * p,
      y:   c.y + (ty - c.y) * p,
      vx:  (Math.random() - 0.5) * 3,
      vy:  -Math.random() * 8 - 3,
      life: 1.0,
      col: ci,
    });
  }

  // Particle draw + decay
  _lp = _lp.filter(p => p.life > 0);
  _lp.forEach(p => {
    p.x  += p.vx; p.y += p.vy; p.life -= 0.032;
    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.fillStyle   = C[p.col].hex;
    ctx.shadowColor = C[p.col].hex;
    ctx.shadowBlur  = 8;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.5 * p.life, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  // Beams — ignite sequentially (0ms, 400ms, 800ms)
  const beamDelays = [0, 0.105, 0.21]; // fractions of t=3.8s
  cores.forEach((c, i) => {
    const startT = beamDelays[i];
    const bt = Math.max(0, Math.min(1, (t - startT) / (1 - startT) * 1.4));
    if (bt <= 0) return;

    // Outer volumetric glow (wide)
    const bw = Math.min(55, bt * 50 + Math.sin(phaseT * 28 + i * 2) * 5);
    ctx.save();
    const outerGrad = ctx.createLinearGradient(c.x, c.y, tx, ty);
    outerGrad.addColorStop(0,   `${C[i].rgba}${bt * 0.6})`);
    outerGrad.addColorStop(0.5, `${C[i].rgba}${bt * 0.45})`);
    outerGrad.addColorStop(1,   'rgba(255,255,255,0.15)');
    ctx.strokeStyle = outerGrad;
    ctx.lineWidth   = bw * 1.8;
    ctx.shadowColor = C[i].hex;
    ctx.shadowBlur  = 45;
    ctx.globalAlpha = bt * 0.45;
    ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(tx, ty); ctx.stroke();

    // Mid beam
    const midGrad = ctx.createLinearGradient(c.x, c.y, tx, ty);
    midGrad.addColorStop(0,   C[i].hex);
    midGrad.addColorStop(1,   '#ffffff');
    ctx.strokeStyle = midGrad;
    ctx.lineWidth   = bw;
    ctx.shadowBlur  = 28;
    ctx.globalAlpha = bt * 0.85;
    ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(tx, ty); ctx.stroke();

    // White hot core
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth   = Math.max(3, bw * 0.28);
    ctx.shadowBlur  = 14;
    ctx.globalAlpha = bt;
    ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.restore();

    // Bloom at beam origin (core card)
    ctx.save();
    const originG = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, 40 * bt);
    originG.addColorStop(0,   `rgba(255,255,255,${bt * 0.9})`);
    originG.addColorStop(0.5, `${C[i].rgba}${bt * 0.55})`);
    originG.addColorStop(1,   `${C[i].rgba}0)`);
    ctx.fillStyle = originG;
    ctx.beginPath(); ctx.arc(c.x, c.y, 40 * bt, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  });

  // Convergence energy sphere at apex
  if (t > 0.3) {
    const sr  = Math.min(140, (t - 0.3) * 200);
    const pls = Math.sin(phaseT * 6) * 0.1 + 0.9; // pulse scale
    ctx.save();
    const sg = ctx.createRadialGradient(tx, ty, 3, tx, ty, sr * pls);
    sg.addColorStop(0,   'rgba(255,255,255,0.98)');
    sg.addColorStop(0.15,'rgba(0,240,255,0.85)');
    sg.addColorStop(0.45,'rgba(255,0,85,0.5)');
    sg.addColorStop(0.75,'rgba(168,85,247,0.25)');
    sg.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle   = sg;
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur  = 70;
    ctx.beginPath(); ctx.arc(tx, ty, sr * pls, 0, Math.PI * 2); ctx.fill();

    // Lightning arcs from sphere
    if (!reducedMotion && Math.random() < 0.5) {
      for (let a = 0; a < 3; a++) {
        const angle = Math.random() * Math.PI * 2;
        const len   = 20 + Math.random() * 50;
        ctx.strokeStyle = Math.random() > 0.5 ? '#00f0ff' : '#ffffff';
        ctx.lineWidth   = 1.5;
        ctx.globalAlpha = Math.random() * 0.7 + 0.2;
        ctx.shadowBlur  = 12;
        ctx.beginPath();
        ctx.moveTo(tx + Math.cos(angle) * sr * 0.6, ty + Math.sin(angle) * sr * 0.6);
        ctx.lineTo(tx + Math.cos(angle) * (sr * 0.6 + len), ty + Math.sin(angle) * (sr * 0.6 + len));
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  return phaseT > 4.2;
}

// ── BREACH: dimensional tear rings expanding ─────────────────────
function _drawBreach() {
  const w = _w(), h = _h();
  const t = Math.min(1, phaseT / 2.5);
  const cx = w * 0.5, cy = h * 0.4;
  const maxR = Math.max(w, h) * 0.95;

  // Dark background as breach opens
  ctx.save();
  ctx.fillStyle = `rgba(0,0,0,${t * 0.4})`;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  for (let ring = 1; ring <= 6; ring++) {
    const rFrac = ring / 6;
    const r     = t * maxR * rFrac;
    if (r < 2) continue;
    const col = ring % 2 === 0 ? '#ff0055' : '#00f0ff';
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = col;
    ctx.lineWidth   = Math.max(1, 12 * (1 - t));
    ctx.shadowColor = col;
    ctx.shadowBlur  = 30;
    ctx.globalAlpha = (1 - t * 0.8) * 0.85;
    ctx.stroke();
    ctx.restore();
  }

  // Central void
  if (t > 0.3) {
    const vr = (t - 0.3) / 0.7 * 80;
    ctx.save();
    const vg = ctx.createRadialGradient(cx, cy, 0, cx, cy, vr);
    vg.addColorStop(0, 'rgba(0,0,0,0.95)');
    vg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = vg;
    ctx.beginPath(); ctx.arc(cx, cy, vr, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // White flash at end
  if (t > 0.78) {
    const fa = Math.min(1, (t - 0.78) / 0.22);
    ctx.save();
    ctx.fillStyle = `rgba(255,255,255,${fa * 0.98})`;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  return phaseT > 2.8;
}

// ── WARP: speed-line tunnel + chromatic aberration + flash ────────
function _drawWarp() {
  const w = _w(), h = _h();
  const t  = Math.min(1, phaseT / 2.5);
  const cx = w / 2, cy = h / 2;

  // Persist trail
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // Speed lines radiating out from center
  const lineCount = reducedMotion ? 50 : 120;
  for (let i = 0; i < lineCount; i++) {
    const angle = (i / lineCount) * Math.PI * 2;
    const near  = 15 + t * 80;
    const far   = near + 60 + t * 380 + Math.random() * 40;
    const cols4 = ['#00f0ff','#ff0055','#a855f7','#ffffff'];
    const col   = cols4[i % 4];
    ctx.save();
    ctx.strokeStyle = col;
    ctx.lineWidth   = 1.2 + t * 2.2;
    ctx.globalAlpha = 0.35 + t * 0.6;
    ctx.shadowColor = col;
    ctx.shadowBlur  = 5;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * near, cy + Math.sin(angle) * near);
    ctx.lineTo(cx + Math.cos(angle) * far,  cy + Math.sin(angle) * far);
    ctx.stroke();
    ctx.restore();
  }

  // Chromatic aberration offset layers
  if (t > 0.45) {
    const fr = (t - 0.45) * 1.8;
    ctx.save();
    ctx.fillStyle = `rgba(0,240,255,${fr * 0.15})`;
    ctx.fillRect(-4, 0, w, h);
    ctx.fillStyle = `rgba(255,0,85,${fr * 0.1})`;
    ctx.fillRect(4, 0, w, h);
    ctx.restore();
  }

  // Final white flash
  if (t > 0.85) {
    const fa = Math.min(1, (t - 0.85) / 0.15);
    ctx.save();
    ctx.fillStyle = `rgba(255,255,255,${fa})`;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  return phaseT > 2.8;
}
