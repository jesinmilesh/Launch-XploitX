/**
 * main.js — Fast Direct Cinematic Flow for XPLOITX
 *
 * Sequence:
 *   1. User activates Core 01, Core 02, Core 03.
 *   2. Directly plays the fullscreen cinematic video (video.mp4).
 *   3. Upon video completion, directly redirects to https://www.xploitxctf.me/
 */

import { audio }                                 from './audio.js';
import { initScene, stopScene }                  from './scene3d.js';
import { initVFX, clearVFX }                     from './vfx.js';

let state = 'IDLE';
let cores = { 1: false, 2: false, 3: false };
let reducedMotion = false;

const $ = id => document.getElementById(id);

// ─────────────────────────────────────────────────────────────────
// BOOTSTRAP
// ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) reducedMotion = true;

  initVFX(reducedMotion);
  initScene(reducedMotion);

  // HUD clock
  const tick = () => {
    const el = $('hud-clock');
    if (el) el.textContent = `SYS: ${new Date().toTimeString().slice(0, 8)} UTC`;
  };
  tick(); setInterval(tick, 1000);

  // Motion toggle
  $('btn-motion')?.addEventListener('click', () => {
    reducedMotion = !reducedMotion;
    const btn = $('btn-motion');
    if (btn) {
      btn.textContent = reducedMotion ? 'FX: LOW' : 'FX: MAX';
      btn.classList.toggle('active', reducedMotion);
    }
  });

  // Audio toggle
  $('btn-audio')?.addEventListener('click', () => {
    audio.init();
    const muted = audio.toggleMute();
    const btn = $('btn-audio');
    if (btn) {
      btn.textContent = muted ? 'AUDIO: OFF' : 'AUDIO: ON';
      btn.classList.toggle('active', muted);
    }
  });

  // Core click handlers
  [1, 2, 3].forEach(id => {
    const handler = e => { e.stopPropagation(); _activateCore(id); };
    $(`btn-core-${id}`)?.addEventListener('click', handler);
    $(`card-${id}`)?.addEventListener('click', handler);
    $(`card-${id}`)?.addEventListener('mouseenter', () => {
      if (!cores[id] && state === 'IDLE') audio.hover?.();
    });
  });
});

// ─────────────────────────────────────────────────────────────────
// CORE ACTIVATION
// ─────────────────────────────────────────────────────────────────
function _activateCore(id) {
  if (cores[id]) return;
  if (state !== 'IDLE' && !state.startsWith('CORE')) return;

  audio.init(); // unlock AudioContext on user gesture

  const pan = id === 1 ? -0.4 : id === 2 ? 0 : 0.4;
  audio.coreClick(pan);
  cores[id] = true;
  state = `CORE_0${id}`;

  // Animate card UI
  $(`card-${id}`)?.classList.add('online');
  const btn = $(`btn-core-${id}`);
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="btn-pulse"></span> CORE ONLINE'; }
  if ($(`s${id}-status`)) $(`s${id}-status`).textContent = 'ONLINE';
  if ($(`s${id}-output`)) $(`s${id}-output`).textContent = '100%';

  setTimeout(() => audio.coreCharge(pan, id - 1), 120);
  setTimeout(() => audio.coreOnline(pan), 820);

  const count = Object.values(cores).filter(Boolean).length;
  _updateStatusPanel(count);

  if (count === 3) {
    // Immediately after 3rd button is clicked: play video directly, then redirect!
    setTimeout(() => _advance('UPLOADED_VIDEO'), 600);
  }
}

function _updateStatusPanel(count) {
  const el  = $('status-counter');
  const msg = $('status-msg');
  const dot = $('status-dot');
  if (el)  el.textContent  = `${count} / 3 CORES ONLINE`;
  if (dot) dot.className   = 'sdot ' +
    (count === 0 ? 'sdot-standby' : count < 3 ? 'sdot-partial' : 'sdot-all');
  if (msg) msg.textContent =
    count === 0 ? 'SYSTEM STATUS: STANDBY' :
    count === 1 ? 'CORE 01 ONLINE — AWAITING 2 MORE' :
    count === 2 ? 'CORES 01 & 02 ONLINE — AWAITING FINAL CORE' :
                  'ALL REACTORS ONLINE — LAUNCHING CINEMATIC';
}

function _hideBanner() { $('cinematic')?.classList.add('hidden'); }

function _fadeOutApp() {
  const app = $('app'); if (!app) return;
  app.style.transition = 'opacity 0.8s ease';
  app.classList.add('fade-out');
}

// ─────────────────────────────────────────────────────────────────
// PLAY VIDEO DIRECTLY & REDIRECT UPON COMPLETION
// ─────────────────────────────────────────────────────────────────
function _playCinematicVideo(onComplete) {
  const layer     = $('video-layer');
  const video     = $('cinematic-video');
  const unmuteBtn = $('video-unmute-btn');
  const btnUnmute = $('btn-unmute');

  if (!layer || !video) {
    if (onComplete) onComplete();
    return;
  }

  // Display fullscreen video layer
  layer.classList.remove('hidden');
  requestAnimationFrame(() => layer.classList.add('active'));

  // Duck background audio so video soundtrack dominates
  audio.duck(0.1, 0.5);

  let finished = false;

  const finish = () => {
    if (finished) return;
    finished = true;
    layer.classList.remove('active');
    setTimeout(() => {
      layer.classList.add('hidden');
      if (onComplete) onComplete();
    }, 400);
  };

  const onEnded = () => {
    video.removeEventListener('ended', onEnded);
    finish();
  };

  video.addEventListener('ended', onEnded);

  // Play video with audio if permitted
  video.currentTime = 0;
  const playPromise = video.play();

  if (playPromise !== undefined) {
    playPromise.catch(err => {
      console.warn('[Video] Autoplay with audio restricted, playing muted:', err);
      video.muted = true;
      if (unmuteBtn) unmuteBtn.classList.remove('hidden');
      video.play().catch(e => {
        console.error('[Video] Playback failed:', e);
        finish();
      });
    });
  }

  if (btnUnmute) {
    btnUnmute.onclick = (e) => {
      e.stopPropagation();
      video.muted = false;
      if (unmuteBtn) unmuteBtn.classList.add('hidden');
    };
  }
}

// ─────────────────────────────────────────────────────────────────
// STATE MACHINE
// ─────────────────────────────────────────────────────────────────
function _advance(next) {
  state = next;
  console.log(`[XPLOITX] → ${next}`);

  switch (next) {
    // 1 ── DIRECT VIDEO PLAYBACK ──────────────────────────────────
    case 'UPLOADED_VIDEO':
      _fadeOutApp();
      clearVFX();
      _hideBanner();
      _playCinematicVideo(() => _advance('REDIRECTING'));
      break;

    // 2 ── DIRECT REDIRECT ────────────────────────────────────────
    case 'REDIRECTING':
      audio.fadeOut(0.8);
      stopScene();
      window.location.href = 'https://www.xploitxctf.me/';
      break;
  }
}
