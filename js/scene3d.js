/**
 * scene3d.js — Three.js 3D WebGL Doomsday World
 *
 * Phases rendered here:
 *   DOOMSDAY_WORLD  — destroyed city, debris, smoke, dynamic lighting
 *   GATEWAY_FORMING — point of light grows into rings
 *   GATEWAY_OPEN    — full portal illuminates world
 *   ENERGY_ABSORB   — streams pulled into gateway
 *   FINAL_WARP      — camera rushes into portal center
 */

let scene, camera, renderer;
let clock, animId;
let isRunning = false;
let phase = 'IDLE';
let phaseT = 0;   // seconds since phase started
let prevPhaseT = 0;
let reducedMotion = false;

// ── City / environment meshes ────────────────────────────────
let buildings = [];
let groundMesh, fogPlane;
// ── Particle systems ─────────────────────────────────────────
let ashParticles, debrisParticles, energyStreams;
let ashGeo, ashPositions;
// ── Lighting ─────────────────────────────────────────────────
let ambientLight, redLight, cyanLight, gatewayLight;
// ── Gateway ──────────────────────────────────────────────────
let gatewayGroup, gatewayRings = [], portalCore;
let gatewayRadius = 0;
// ── Camera movement ──────────────────────────────────────────
let camTarget = new (typeof THREE !== 'undefined' ? THREE.Vector3 : Object)();
let camVelocity = { x: 0, y: 0, z: 0 };
let shakeIntensity = 0;

// ── Callback when a phase finishes ───────────────────────────
let onPhaseComplete = null;

export function initScene(reduced = false) {
  reducedMotion = reduced;
  if (typeof THREE === 'undefined') return;

  const canvas = document.getElementById('gl-canvas');
  if (!canvas) return;

  // Scene
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x020205, 0.018);
  scene.background = new THREE.Color(0x020205);

  // Camera
  camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 800);
  camera.position.set(0, 4, 38);
  camTarget.set(0, 3, 0);

  // Renderer
  renderer = new THREE.WebGLRenderer({ canvas, antialias: !reduced, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, reduced ? 1 : 1.8));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = !reduced;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;

  // Clock
  clock = new THREE.Clock();

  // Lighting
  ambientLight = new THREE.AmbientLight(0x0a0515, 1.0);
  scene.add(ambientLight);

  redLight = new THREE.PointLight(0xff1133, 0, 60);
  redLight.position.set(-14, 8, 10);
  scene.add(redLight);

  cyanLight = new THREE.PointLight(0x00aaff, 0, 60);
  cyanLight.position.set(14, 8, 10);
  scene.add(cyanLight);

  gatewayLight = new THREE.PointLight(0x00f0ff, 0, 120);
  gatewayLight.position.set(0, 28, -8);
  scene.add(gatewayLight);

  // Build environment
  _buildGround();
  _buildCity();
  _buildParticles();
  _buildGateway();

  // Resize
  window.addEventListener('resize', _onResize);
}

function _onResize() {
  if (!renderer || !camera) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// ────────────────────────────────────────────────────────────────
// ENVIRONMENT BUILD
// ────────────────────────────────────────────────────────────────

function _buildGround() {
  const geo = new THREE.PlaneGeometry(300, 300, 40, 40);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x06020e,
    roughness: 0.95,
    metalness: 0.25,
    envMapIntensity: 0.5
  });
  groundMesh = new THREE.Mesh(geo, mat);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.position.y = -2.5;
  groundMesh.receiveShadow = true;
  scene.add(groundMesh);

  // Ground crack lines (emissive plane)
  const crackGeo = new THREE.PlaneGeometry(80, 80);
  const crackMat = new THREE.MeshBasicMaterial({
    color: 0xff0033, transparent: true, opacity: 0.0, side: THREE.DoubleSide
  });
  const crack = new THREE.Mesh(crackGeo, crackMat);
  crack.rotation.x = -Math.PI / 2;
  crack.position.y = -2.48;
  crack.name = 'groundCrack';
  scene.add(crack);
}

function _buildCity() {
  const palette = [0x080312, 0x0a0416, 0x07030f, 0x050210, 0x0c0418];
  const rng = (a, b) => a + Math.random() * (b - a);
  const cols = [
    [-28, -18, -8, 2, 12, 22, 32],
    [-35, -24, -14, 5, 18, 28, 38]
  ];

  cols.forEach((row, layer) => {
    row.forEach(x => {
      const h = rng(10, layer === 0 ? 28 : 18);
      const w = rng(4, 8);
      const d = rng(3, 7);
      const geo = new THREE.BoxGeometry(w, h, d);
      const mat = new THREE.MeshStandardMaterial({
        color: palette[Math.floor(Math.random() * palette.length)],
        roughness: 0.8, metalness: 0.3
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x + rng(-2, 2), -2.5 + h / 2, layer === 0 ? -22 + rng(-4, 4) : -38 + rng(-5, 5));
      mesh.rotation.y = rng(-0.08, 0.08);
      // Slight random tilt for destruction feel
      mesh.rotation.z = rng(-0.04, 0.04);
      mesh.castShadow = !reducedMotion;
      mesh.receiveShadow = !reducedMotion;
      mesh.userData.baseY = mesh.position.y;
      scene.add(mesh);
      buildings.push(mesh);

      // Broken window emissive strips
      if (Math.random() > 0.5) {
        const wGeo = new THREE.BoxGeometry(w * 0.7, 0.25, d * 0.7);
        const wMat = new THREE.MeshBasicMaterial({ color: 0x001a1a, transparent: true, opacity: 0.6 });
        for (let wy = 2; wy < h - 1; wy += rng(1.8, 3.5)) {
          const wMesh = new THREE.Mesh(wGeo, wMat);
          wMesh.position.set(mesh.position.x, -2.5 + wy, mesh.position.z);
          scene.add(wMesh);
        }
      }
    });
  });
}

function _buildParticles() {
  const count = reducedMotion ? 400 : 1200;

  // Ash / floating dust
  ashGeo = new THREE.BufferGeometry();
  ashPositions = new Float32Array(count * 3);
  const ashVels = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    ashPositions[i * 3]     = (Math.random() - 0.5) * 80;
    ashPositions[i * 3 + 1] = Math.random() * 30 - 2;
    ashPositions[i * 3 + 2] = (Math.random() - 0.5) * 60 - 10;
    ashVels[i * 3]     = (Math.random() - 0.5) * 0.015;
    ashVels[i * 3 + 1] = -Math.random() * 0.008 - 0.002;
    ashVels[i * 3 + 2] = (Math.random() - 0.5) * 0.01;
  }
  ashGeo.setAttribute('position', new THREE.BufferAttribute(ashPositions, 3));
  ashGeo.userData.vels = ashVels;
  const ashMat = new THREE.PointsMaterial({ color: 0x445566, size: 0.2, transparent: true, opacity: 0.55 });
  ashParticles = new THREE.Points(ashGeo, ashMat);
  scene.add(ashParticles);
}

function _buildGateway() {
  gatewayGroup = new THREE.Group();
  gatewayGroup.position.set(0, 20, -18);
  scene.add(gatewayGroup);

  // Rings (4 nested torus rings, invisible until GATEWAY_FORMING)
  const ringColors = [0x00f0ff, 0xff0055, 0x00c8ff, 0xa855f7];
  for (let i = 0; i < 4; i++) {
    const ringGeo = new THREE.TorusGeometry((i + 1) * 3.5, 0.22, 16, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: ringColors[i],
      transparent: true,
      opacity: 0
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI * 0.08 * (i % 2 === 0 ? 1 : -1);
    ring.userData.baseOpacity = 0;
    ring.userData.spinDir = i % 2 === 0 ? 1 : -1;
    ring.userData.spinSpeed = 0.4 + i * 0.15;
    gatewayGroup.add(ring);
    gatewayRings.push(ring);
  }

  // Portal center (glowing sphere)
  const coreGeo = new THREE.SphereGeometry(2.8, 32, 32);
  const coreMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0 });
  portalCore = new THREE.Mesh(coreGeo, coreMat);
  gatewayGroup.add(portalCore);

  // XPLOITX Emblem Plane in center of portal
  const emblemCanvas = document.createElement('canvas');
  emblemCanvas.width = 512; emblemCanvas.height = 256;
  const eCtx = emblemCanvas.getContext('2d');
  eCtx.fillStyle = '#000000'; eCtx.fillRect(0, 0, 512, 256);
  eCtx.font = 'bold 72px Orbitron, sans-serif';
  eCtx.textAlign = 'center';
  eCtx.textBaseline = 'middle';
  eCtx.shadowColor = '#00f0ff'; eCtx.shadowBlur = 25;
  eCtx.fillStyle = '#00f0ff';
  eCtx.fillText('XPLOITX', 256, 100);
  eCtx.font = '24px "Share Tech Mono", monospace';
  eCtx.fillStyle = '#ff0055';
  eCtx.fillText('SYSTEM GATEWAY', 256, 170);

  const emblemTex = new THREE.CanvasTexture(emblemCanvas);
  const emblemGeo = new THREE.PlaneGeometry(12, 6);
  const emblemMat = new THREE.MeshBasicMaterial({
    map: emblemTex, transparent: true, opacity: 0, side: THREE.DoubleSide
  });
  const emblemMesh = new THREE.Mesh(emblemGeo, emblemMat);
  emblemMesh.name = 'gatewayEmblem';
  emblemMesh.position.set(0, 0, 0.5);
  gatewayGroup.add(emblemMesh);

  // Energy stream particles (pulled upward during absorption)
  const esCount = reducedMotion ? 150 : 400;
  const esGeo = new THREE.BufferGeometry();
  const esPos = new Float32Array(esCount * 3);
  for (let i = 0; i < esCount; i++) {
    esPos[i * 3]     = (Math.random() - 0.5) * 50;
    esPos[i * 3 + 1] = Math.random() * 20 - 2;
    esPos[i * 3 + 2] = (Math.random() - 0.5) * 40 - 10;
  }
  esGeo.setAttribute('position', new THREE.BufferAttribute(esPos, 3));
  const esMat = new THREE.PointsMaterial({ color: 0x00f0ff, size: 0.35, transparent: true, opacity: 0 });
  energyStreams = new THREE.Points(esGeo, esMat);
  scene.add(energyStreams);
}

// ────────────────────────────────────────────────────────────────
// PHASE SETTER
// ────────────────────────────────────────────────────────────────

export function setScene3DPhase(newPhase, callback) {
  phase = newPhase;
  phaseT = 0;
  onPhaseComplete = callback || null;

  if (!isRunning) {
    isRunning = true;
    _loop();
  }
}

export function stopScene() {
  isRunning = false;
  if (animId) cancelAnimationFrame(animId);
  if (renderer) renderer.dispose();
}

// ────────────────────────────────────────────────────────────────
// MAIN RENDER LOOP
// ────────────────────────────────────────────────────────────────

function _loop() {
  if (!isRunning) return;
  animId = requestAnimationFrame(_loop);

  const dt = Math.min(clock.getDelta(), 0.05);
  phaseT += dt;

  _updateAsh(dt);
  _updatePhase(dt);
  _updateCamera(dt);

  renderer.render(scene, camera);
}

// ────────────────────────────────────────────────────────────────
// ASH PARTICLE ANIMATION
// ────────────────────────────────────────────────────────────────

function _updateAsh(dt) {
  if (!ashGeo) return;
  const pos = ashGeo.attributes.position.array;
  const vel = ashGeo.userData.vels;
  const count = pos.length / 3;
  for (let i = 0; i < count; i++) {
    pos[i * 3]     += vel[i * 3]     + Math.sin(phaseT * 0.3 + i) * 0.003;
    pos[i * 3 + 1] += vel[i * 3 + 1];
    pos[i * 3 + 2] += vel[i * 3 + 2];
    if (pos[i * 3 + 1] < -3) {
      pos[i * 3 + 1] = 25 + Math.random() * 5;
      pos[i * 3]     = (Math.random() - 0.5) * 80;
    }
  }
  ashGeo.attributes.position.needsUpdate = true;
}

// ────────────────────────────────────────────────────────────────
// PHASE-SPECIFIC UPDATES
// ────────────────────────────────────────────────────────────────

function _updatePhase(dt) {
  switch (phase) {
    case 'DOOMSDAY_WORLD':   _phaseDoomsdayWorld(dt);  break;
    case 'ENVIRONMENT_EVENT':_phaseEnvEvent(dt);       break;
    case 'GATEWAY_FORMING':  _phaseGatewayForming(dt); break;
    case 'GATEWAY_OPEN':     _phaseGatewayOpen(dt);    break;
    case 'ENERGY_ABSORB':    _phaseEnergyAbsorb(dt);   break;
    case 'FINAL_WARP':       _phaseFinalWarp(dt);      break;
  }
}

function _phaseDoomsdayWorld(dt) {
  // Flicker red warning light
  redLight.intensity = 0.3 + Math.sin(phaseT * 18) * 0.25 * Math.random();
  cyanLight.intensity = 0.15 + Math.sin(phaseT * 7 + 1) * 0.12;

  // Buildings subtle sway / vibration from doomsday energy
  buildings.forEach((b, i) => {
    b.rotation.z = b.userData.baseZ || 0;
    if (reducedMotion) return;
    b.position.y = b.userData.baseY + Math.sin(phaseT * 1.2 + i * 0.7) * 0.04;
  });

  // Entrance: camera slowly pushes in
  if (phaseT < 3) {
    camera.position.z = 38 - phaseT * 2.8;
    camera.position.y = 4 + Math.sin(phaseT * 0.4) * 0.3;
  }

  if (phaseT > 3.5 && onPhaseComplete) {
    const cb = onPhaseComplete; onPhaseComplete = null;
    cb('ENVIRONMENT_EVENT');
  }
}

function _phaseEnvEvent(dt) {
  // Intensify lights as energy builds
  const t = Math.min(1, phaseT / 4);
  redLight.intensity = t * 2.2 + Math.sin(phaseT * 22) * 0.4 * t;
  cyanLight.intensity = t * 1.4 + Math.sin(phaseT * 11) * 0.3 * t;
  shakeIntensity = reducedMotion ? 0 : t * 0.06;

  // Ground crack glow
  const crack = scene.getObjectByName('groundCrack');
  if (crack) crack.material.opacity = t * 0.25;

  // Buildings flicker
  buildings.forEach((b, i) => {
    if (reducedMotion) return;
    b.position.y = b.userData.baseY + Math.sin(phaseT * 6 + i) * shakeIntensity * 2;
  });

  if (phaseT > 4.5 && onPhaseComplete) {
    shakeIntensity = 0;
    redLight.intensity = 0.8;
    cyanLight.intensity = 0.6;
    const cb = onPhaseComplete; onPhaseComplete = null;
    cb('GATEWAY_FORMING');
  }
}

function _phaseGatewayForming(dt) {
  const t = Math.min(1, phaseT / 3.5);
  gatewayRadius = t;

  // Rings fade in sequentially
  gatewayRings.forEach((r, i) => {
    const delay = i * 0.22;
    const ringT = Math.max(0, Math.min(1, (t - delay * 0.8) * 2.2));
    r.material.opacity = ringT * 0.85;
    r.rotation.z += r.userData.spinDir * r.userData.spinSpeed * dt;
    r.scale.setScalar(0.1 + ringT * 0.9);
  });

  // Portal core & emblem
  portalCore.material.opacity = Math.max(0, t - 0.6) * 1.8;
  portalCore.scale.setScalar(0.1 + t * 1.2);
  const emblem = gatewayGroup?.getObjectByName('gatewayEmblem');
  if (emblem) emblem.material.opacity = Math.max(0, (t - 0.3) * 1.4);

  // Gateway light ramps up
  gatewayLight.intensity = t * 4;

  // Camera tilts to look up
  camera.position.y = 4 + t * 6;
  camera.position.z = 28 - t * 4;

  if (phaseT > 4 && onPhaseComplete) {
    const cb = onPhaseComplete; onPhaseComplete = null;
    cb('GATEWAY_OPEN');
  }
}

function _phaseGatewayOpen(dt) {
  const t = Math.min(1, phaseT / 2.5);
  // Full brightness on rings
  gatewayRings.forEach((r, i) => {
    r.material.opacity = 0.85 + Math.sin(phaseT * 3 + i) * 0.1;
    r.rotation.z += r.userData.spinDir * r.userData.spinSpeed * dt;
  });

  // Gateway floods world with light
  gatewayLight.intensity = 4 + Math.sin(phaseT * 2) * 1.2;
  redLight.intensity = 0.4;
  cyanLight.intensity = 0.4;

  // Buildings receive gateway light (slightly lighter)
  ambientLight.intensity = 1.0 + t * 1.5;

  if (phaseT > 3 && onPhaseComplete) {
    const cb = onPhaseComplete; onPhaseComplete = null;
    cb('ENERGY_ABSORB');
  }
}

function _phaseEnergyAbsorb(dt) {
  const t = Math.min(1, phaseT / 4);
  // Energy streams pull upward toward gateway
  const esPos = energyStreams.geometry.attributes.position.array;
  const gwY = 20; const gwZ = -18;
  for (let i = 0; i < esPos.length / 3; i++) {
    const dx = -esPos[i * 3] * 0.008 * t;
    const dz = (gwZ - esPos[i * 3 + 2]) * 0.006 * t;
    const dy = (gwY - esPos[i * 3 + 1]) * 0.004 * t + 0.04;
    esPos[i * 3]     += dx + Math.sin(phaseT * 2 + i) * 0.02;
    esPos[i * 3 + 1] += dy;
    esPos[i * 3 + 2] += dz;
    // Reset if past gateway
    if (esPos[i * 3 + 1] > gwY + 2) {
      esPos[i * 3]     = (Math.random() - 0.5) * 50;
      esPos[i * 3 + 1] = Math.random() * 18 - 2;
      esPos[i * 3 + 2] = (Math.random() - 0.5) * 40 - 10;
    }
  }
  energyStreams.geometry.attributes.position.needsUpdate = true;
  energyStreams.material.opacity = t * 0.9;

  // Rings pulse
  gatewayRings.forEach((r, i) => {
    r.rotation.z += r.userData.spinDir * r.userData.spinSpeed * 1.5 * dt;
    r.material.opacity = 0.85 + Math.sin(phaseT * 5 + i) * 0.12;
  });

  // Battlefield becomes calmer
  redLight.intensity = Math.max(0, 0.4 - t * 0.35);
  gatewayLight.intensity = 4 + t * 3;
  ambientLight.intensity = 1.0 + t * 2;

  // Camera slowly pushes toward gateway
  camera.position.z = 24 - t * 6;
  camera.position.y = 10 + t * 4;

  if (phaseT > 5 && onPhaseComplete) {
    const cb = onPhaseComplete; onPhaseComplete = null;
    cb('ACCESS_GRANTED');
  }
}

function _phaseFinalWarp(dt) {
  // Rush camera into portal center
  const t = Math.min(1, phaseT / 2.2);
  camera.position.z = 18 - t * 36;
  camera.position.y = 14 + t * 6;

  // Rings scale out
  gatewayRings.forEach((r, i) => {
    r.scale.setScalar(1 + t * 3);
    r.material.opacity = 1 - t * 0.7;
    r.rotation.z += r.userData.spinDir * r.userData.spinSpeed * 3 * dt;
  });
  gatewayLight.intensity = 4 + t * 20;
  ambientLight.intensity = 1 + t * 8;

  if (phaseT > 2.4 && onPhaseComplete) {
    const cb = onPhaseComplete; onPhaseComplete = null;
    cb('DONE');
  }
}

// ────────────────────────────────────────────────────────────────
// CAMERA SMOOTH MOVEMENT + SHAKE
// ────────────────────────────────────────────────────────────────

function _updateCamera(dt) {
  if (!reducedMotion && shakeIntensity > 0) {
    camera.position.x += (Math.random() - 0.5) * shakeIntensity;
    camera.position.y += (Math.random() - 0.5) * shakeIntensity * 0.5;
  }
  // Subtle breathing motion
  if (phase === 'DOOMSDAY_WORLD' || phase === 'ENVIRONMENT_EVENT') {
    camera.position.x = Math.sin(phaseT * 0.15) * 0.8;
  }
  camera.lookAt(0, 6, -10);
}
