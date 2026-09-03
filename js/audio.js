/**
 * audio.js — Centralized Web Audio API Engine
 * Layered cinematic soundscape — NO beeps, NO simple tones.
 * Uses AudioContext modular graph: noise → filter → gain → output
 */
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.muted = false;
    this.initialized = false;
    this._sources = new Map(); // id → { src, gain }
    this._drones  = [];
  }

  /** Must be called from a user gesture */
  init() {
    if (this.initialized) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.72;
      this.masterGain.connect(this.ctx.destination);
      this.initialized = true;
      // Start ambient drone immediately
      this._startAmbient();
    } catch (e) {
      console.warn('[AudioEngine] Web Audio not available:', e);
    }
  }

  _ctx() { return this.ctx; }

  /** Low-level: create an OscillatorNode connected to master */
  _osc({ type = 'sine', freq = 60, gain = 0.15, detune = 0, duration = 2,
         fadeIn = 0.1, fadeOut = 0.4, pan = 0, dest = null } = {}) {
    if (!this.initialized) return null;
    const c = this.ctx;
    const g = c.createGain();
    const o = c.createOscillator();
    const p = c.createStereoPanner();

    o.type = type;
    o.frequency.value = freq;
    o.detune.value = detune;

    const now = c.currentTime;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(gain, now + fadeIn);
    g.gain.setValueAtTime(gain, now + duration - fadeOut);
    g.gain.linearRampToValueAtTime(0, now + duration);

    p.pan.value = pan;
    o.connect(g); g.connect(p); p.connect(dest || this.masterGain);
    o.start(now);
    o.stop(now + duration);
    return o;
  }

  /** Low-level: create a noise burst */
  _noise({ gain = 0.05, duration = 0.5, freq = 400, q = 1, type = 'bandpass',
           fadeIn = 0.02, fadeOut = 0.25, pan = 0 } = {}) {
    if (!this.initialized) return;
    const c = this.ctx;
    const bufLen = c.sampleRate * duration;
    const buf = c.createBuffer(1, bufLen, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;

    const src = c.createBufferSource();
    src.buffer = buf;

    const filt = c.createBiquadFilter();
    filt.type = type;
    filt.frequency.value = freq;
    filt.Q.value = q;

    const g = c.createGain();
    const p = c.createStereoPanner();
    const now = c.currentTime;

    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(gain, now + fadeIn);
    g.gain.setValueAtTime(gain, now + duration - fadeOut);
    g.gain.linearRampToValueAtTime(0, now + duration);

    p.pan.value = pan;
    src.connect(filt); filt.connect(g); g.connect(p); p.connect(this.masterGain);
    src.start(now);
  }

  /** Continuous pitched noise drone (returns { gainNode, source } for stopping) */
  _drone({ freq = 80, gain = 0.08, type = 'sawtooth', q = 6,
           filtFreq = 200, ramp = 1.5 } = {}) {
    if (!this.initialized) return null;
    const c = this.ctx;

    const osc = c.createOscillator();
    const filt = c.createBiquadFilter();
    const g = c.createGain();
    const now = c.currentTime;

    osc.type = type;
    osc.frequency.value = freq;
    filt.type = 'lowpass';
    filt.frequency.value = filtFreq;
    filt.Q.value = q;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(gain, now + ramp);

    osc.connect(filt); filt.connect(g); g.connect(this.masterGain);
    osc.start(now);

    return { osc, gain: g, filter: filt };
  }

  _stopDrone(drone, fadeTime = 0.8) {
    if (!drone || !this.initialized) return;
    const now = this.ctx.currentTime;
    try {
      drone.gain.gain.linearRampToValueAtTime(0, now + fadeTime);
      drone.osc.stop(now + fadeTime + 0.05);
    } catch (_) { /* already stopped */ }
  }

  // ────────────────────────────────────────────────────────────
  // AMBIENT BACKGROUND DRONE
  // ────────────────────────────────────────────────────────────
  _ambientDrone = null;
  _ambientDrone2 = null;

  _startAmbient() {
    this._ambientDrone = this._drone({ freq: 42, gain: 0.06, type: 'sine', filtFreq: 120, ramp: 2 });
    this._ambientDrone2 = this._drone({ freq: 68, gain: 0.04, type: 'sawtooth', filtFreq: 90, ramp: 3 });
  }

  // ────────────────────────────────────────────────────────────
  // PUBLIC SOUND EVENTS
  // ────────────────────────────────────────────────────────────

  /** Mechanical relay click + power relay sound */
  coreClick(pan = 0) {
    if (!this.initialized) return;
    // Short metallic transient
    this._noise({ gain: 0.22, duration: 0.08, freq: 900, q: 4, type: 'highpass',
                  fadeIn: 0.002, fadeOut: 0.05, pan });
    // Deep relay thud
    this._osc({ type: 'sine', freq: 48, gain: 0.35, duration: 0.22, fadeIn: 0.005, fadeOut: 0.18, pan });
  }

  /** Core charging up */
  coreCharge(pan = 0, colorIndex = 0) {
    if (!this.initialized) return;
    const freqs = [55, 70, 85];
    const base = freqs[colorIndex % 3];
    // Rising oscillator
    const c = this.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    const p = c.createStereoPanner();
    const now = c.currentTime;

    o.type = 'sawtooth';
    o.frequency.setValueAtTime(base, now);
    o.frequency.linearRampToValueAtTime(base * 4, now + 1.4);

    const filt = c.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = 1200; filt.Q.value = 3;

    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.18, now + 0.15);
    g.gain.setValueAtTime(0.18, now + 1.1);
    g.gain.linearRampToValueAtTime(0, now + 1.5);
    p.pan.value = pan;

    o.connect(filt); filt.connect(g); g.connect(p); p.connect(this.masterGain);
    o.start(now); o.stop(now + 1.55);

    // Electrical buzz overlay
    this._noise({ gain: 0.06, duration: 1.2, freq: 600, q: 5, type: 'bandpass',
                  fadeIn: 0.1, fadeOut: 0.5, pan });
  }

  /** Core ignition BOOM */
  coreOnline(pan = 0) {
    if (!this.initialized) return;
    // Sub boom
    this._osc({ type: 'sine', freq: 38, gain: 0.55, duration: 1.2, fadeIn: 0.01, fadeOut: 0.7, pan });
    // Mid punch
    this._osc({ type: 'sine', freq: 110, gain: 0.25, duration: 0.5, fadeIn: 0.005, fadeOut: 0.35, pan });
    // Hiss tail
    this._noise({ gain: 0.1, duration: 0.8, freq: 2200, q: 2, type: 'highpass',
                  fadeIn: 0.01, fadeOut: 0.6, pan });
  }

  /** Hover micro-tick */
  hover() {
    this._noise({ gain: 0.04, duration: 0.05, freq: 1800, q: 8, type: 'bandpass',
                  fadeIn: 0.002, fadeOut: 0.04 });
  }

  /** Synchronization — multi-layer harmonic build */
  synchronization() {
    if (!this.initialized) return;
    const c = this.ctx; const now = c.currentTime;
    [42, 63, 84, 105].forEach((f, i) => {
      this._osc({ type: 'sine', freq: f, gain: 0.08, duration: 3.5,
                  fadeIn: 0.3 + i * 0.2, fadeOut: 0.6 });
    });
    this._noise({ gain: 0.07, duration: 3.5, freq: 300, q: 4, type: 'bandpass',
                  fadeIn: 0.5, fadeOut: 1.2 });
  }

  /** System failure crackle */
  systemFailure() {
    if (!this.initialized) return;
    for (let i = 0; i < 6; i++) {
      setTimeout(() => {
        this._noise({ gain: 0.18, duration: 0.12, freq: 400 + Math.random() * 800,
                      q: 2, type: 'bandpass', fadeIn: 0.005, fadeOut: 0.1,
                      pan: (Math.random() - 0.5) * 1.4 });
      }, i * 180 + Math.random() * 80);
    }
    // Sub rumble
    this._osc({ type: 'sine', freq: 28, gain: 0.3, duration: 2.2, fadeIn: 0.4, fadeOut: 0.9 });
  }

  /** Doomsday activation rumble */
  doomsdayActivation() {
    if (!this.initialized) return;
    // Deep sub bass sweep
    const c = this.ctx; const now = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(30, now);
    o.frequency.linearRampToValueAtTime(22, now + 2.5);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.48, now + 0.8);
    g.gain.setValueAtTime(0.48, now + 2.0);
    g.gain.linearRampToValueAtTime(0, now + 2.6);
    o.connect(g); g.connect(this.masterGain);
    o.start(now); o.stop(now + 2.7);

    // Distant thunder noise
    this._noise({ gain: 0.14, duration: 2.5, freq: 140, q: 1, type: 'lowpass',
                  fadeIn: 0.4, fadeOut: 1.0 });
  }

  /** Laser charge — rising resonance */
  laserCharge(pan = 0) {
    if (!this.initialized) return;
    const c = this.ctx; const now = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    const p = c.createStereoPanner();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(60, now);
    o.frequency.exponentialRampToValueAtTime(380, now + 1.8);

    const filt = c.createBiquadFilter();
    filt.type = 'bandpass'; filt.frequency.value = 800; filt.Q.value = 4;

    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.22, now + 0.3);
    g.gain.setValueAtTime(0.22, now + 1.5);
    g.gain.linearRampToValueAtTime(0, now + 1.9);
    p.pan.value = pan;

    o.connect(filt); filt.connect(g); g.connect(p); p.connect(this.masterGain);
    o.start(now); o.stop(now + 2.0);
  }

  /** Laser fire — massive blast */
  laserFire(pan = 0) {
    if (!this.initialized) return;
    // Sub blast
    this._osc({ type: 'sine', freq: 32, gain: 0.65, duration: 1.8,
                fadeIn: 0.01, fadeOut: 0.9, pan });
    // Crack transient
    this._noise({ gain: 0.3, duration: 0.35, freq: 500, q: 1, type: 'bandpass',
                  fadeIn: 0.005, fadeOut: 0.25, pan });
    // Sustained beam hum
    this._osc({ type: 'triangle', freq: 95, gain: 0.12, duration: 2.5,
                fadeIn: 0.1, fadeOut: 1.0, pan });
  }

  /** All three beams converge */
  convergence() {
    if (!this.initialized) return;
    const c = this.ctx; const now = c.currentTime;
    // Triple harmony
    [55, 82, 110].forEach((f, i) => {
      this._osc({ type: 'sine', freq: f, gain: 0.15, duration: 3,
                  fadeIn: 0.2 + i * 0.15, fadeOut: 0.8 });
    });
    this._noise({ gain: 0.12, duration: 3, freq: 200, q: 2, type: 'lowpass',
                  fadeIn: 0.4, fadeOut: 1.0 });
  }

  /** Reality breach — dimensional crack */
  realityBreach() {
    if (!this.initialized) return;
    // Descending sweep
    const c = this.ctx; const now = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(200, now);
    o.frequency.exponentialRampToValueAtTime(22, now + 2.0);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.45, now + 0.1);
    g.gain.setValueAtTime(0.45, now + 1.6);
    g.gain.linearRampToValueAtTime(0, now + 2.2);
    o.connect(g); g.connect(this.masterGain);
    o.start(now); o.stop(now + 2.3);
    // Impact noise
    this._noise({ gain: 0.25, duration: 0.5, freq: 350, q: 1, type: 'lowpass',
                  fadeIn: 0.005, fadeOut: 0.4 });
  }

  /** Doomsday world ambient */
  doomsdayAmbient() {
    if (!this.initialized) return;
    // Wind-like noise
    this._noise({ gain: 0.09, duration: 5, freq: 300, q: 0.6, type: 'lowpass',
                  fadeIn: 1.2, fadeOut: 2.0 });
    this._osc({ type: 'sine', freq: 36, gain: 0.1, duration: 5, fadeIn: 1.5, fadeOut: 2.0 });
  }

  /** Environmental energy event */
  environmentEvent() {
    if (!this.initialized) return;
    for (let i = 0; i < 4; i++) {
      setTimeout(() => {
        this._osc({ type: 'sine', freq: 28 + i * 8, gain: 0.25, duration: 1.5,
                    fadeIn: 0.05, fadeOut: 0.9 });
        this._noise({ gain: 0.1, duration: 0.6, freq: 200, q: 1, type: 'lowpass',
                      fadeIn: 0.01, fadeOut: 0.5, pan: (Math.random() - 0.5) });
      }, i * 700);
    }
  }

  /** Gateway forming — mysterious harmonic */
  gatewayForming() {
    if (!this.initialized) return;
    [55, 110, 165].forEach((f, i) => {
      this._osc({ type: 'sine', freq: f, gain: 0.1, duration: 4,
                  fadeIn: 0.5 + i * 0.4, fadeOut: 1.2 });
    });
    this._noise({ gain: 0.06, duration: 4, freq: 160, q: 0.8, type: 'bandpass',
                  fadeIn: 0.8, fadeOut: 1.5 });
  }

  /** Gateway open — deep resonance bloom */
  gatewayOpen() {
    if (!this.initialized) return;
    const c = this.ctx; const now = c.currentTime;
    [40, 60, 80, 120].forEach((f, i) => {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.14, now + 1 + i * 0.3);
      g.gain.setValueAtTime(0.14, now + 3.5);
      g.gain.linearRampToValueAtTime(0, now + 4.5);
      o.connect(g); g.connect(this.masterGain);
      o.start(now); o.stop(now + 4.6);
    });
  }

  /** Energy absorption — descending suction */
  energyAbsorption() {
    if (!this.initialized) return;
    const c = this.ctx; const now = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(180, now);
    o.frequency.exponentialRampToValueAtTime(38, now + 3.0);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.3, now + 0.5);
    g.gain.setValueAtTime(0.3, now + 2.5);
    g.gain.linearRampToValueAtTime(0, now + 3.2);
    o.connect(g); g.connect(this.masterGain);
    o.start(now); o.stop(now + 3.3);
    // Particle noise
    this._noise({ gain: 0.08, duration: 3, freq: 400, q: 3, type: 'bandpass',
                  fadeIn: 0.3, fadeOut: 1.5 });
  }

  /** Access granted — harmonic resolution */
  accessGranted() {
    if (!this.initialized) return;
    [110, 138, 165].forEach((f, i) => {
      this._osc({ type: 'sine', freq: f, gain: 0.12, duration: 2.5,
                  fadeIn: i * 0.15, fadeOut: 0.8 });
    });
  }

  /** Final warp — rising pitch tunnel */
  finalWarp() {
    if (!this.initialized) return;
    const c = this.ctx; const now = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(38, now);
    o.frequency.exponentialRampToValueAtTime(1200, now + 2.5);
    const filt = c.createBiquadFilter();
    filt.type = 'bandpass'; filt.frequency.value = 600; filt.Q.value = 3;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.45, now + 0.4);
    g.gain.setValueAtTime(0.45, now + 2.0);
    g.gain.linearRampToValueAtTime(0, now + 2.6);
    o.connect(filt); filt.connect(g); g.connect(this.masterGain);
    o.start(now); o.stop(now + 2.7);
    this._noise({ gain: 0.2, duration: 2.5, freq: 800, q: 2, type: 'highpass',
                  fadeIn: 0.2, fadeOut: 0.8 });
  }

  /** Mute / unmute toggle */
  toggleMute() {
    if (!this.masterGain) return this.muted;
    this.muted = !this.muted;
    this.masterGain.gain.setTargetAtTime(
      this.muted ? 0 : 0.72,
      this.ctx.currentTime, 0.15
    );
    return this.muted;
  }

  /** Duck audio during video playback */
  duck(targetGain = 0.12, duration = 0.6) {
    if (!this.masterGain || !this.ctx || this.muted) return;
    this.masterGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, duration / 3);
  }

  /** Restore audio after video playback */
  unduck(targetGain = 0.72, duration = 0.8) {
    if (!this.masterGain || !this.ctx || this.muted) return;
    this.masterGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, duration / 3);
  }

  /** Fade master out (before redirect) */
  fadeOut(duration = 1.2) {
    if (!this.masterGain || !this.ctx) return;
    this.masterGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + duration);
  }
}

export const audio = new AudioEngine();
