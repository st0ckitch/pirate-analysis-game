// The 3D jungle river: scenery, the ship, floating items, particles and camera.
import * as THREE from 'three';
import { C, STATUS_COLORS } from './palette.js';

export const STAGE_X = [0, 70, 140, 210];
export const RIVER_HALF = 9;
export const LANE = 6.4;
const RIVER_START = -90;
const RIVER_END = 256;
const CLIFF_X = 262;

// Deterministic random so the jungle looks the same every visit.
function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const R = rng(1414);
const rr = (a, b) => a + R() * (b - a);
const pick = arr => arr[Math.floor(R() * arr.length)];

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
const css = n => '#' + n.toString(16).padStart(6, '0');

function crateTexture(done) {
  return canvasTex(128, 128, (g, w, h) => {
    const top = done ? C.leaf300 : C.wood300, bot = done ? C.leaf500 : C.wood500, edge = done ? C.leaf700 : C.wood800;
    const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, css(top)); grd.addColorStop(1, css(bot));
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(40,20,5,0.35)'; g.lineWidth = 3;
    for (let y = 26; y < h; y += 26) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.lineWidth = 10; g.strokeStyle = 'rgba(40,20,5,0.3)';
    g.beginPath(); g.moveTo(10, h - 10); g.lineTo(w - 10, 10); g.stroke();
    g.lineWidth = 12; g.strokeStyle = css(edge); g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(12, 12, w - 24, 4);
  });
}

function labelTexture(text, sub, bg, fg = C.ink900) {
  return canvasTex(512, 160, (g, w, h) => {
    const r = 56;
    g.fillStyle = css(C.wood800);
    roundRect(g, 8, 18, w - 16, h - 26, r); g.fill();
    g.fillStyle = css(bg);
    roundRect(g, 8, 8, w - 16, h - 30, r); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.5)'; roundRect(g, 40, 14, w - 80, 8, 4); g.fill();
    g.fillStyle = css(fg); g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '700 60px Fredoka, "Baloo 2", system-ui, sans-serif';
    g.fillText(text, w / 2, sub ? 62 : 74);
    if (sub) { g.font = '600 30px Figtree, system-ui, sans-serif'; g.fillText(sub, w / 2, 110); }
  });
}
function roundRect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function haloTexture(color) {
  return canvasTex(128, 128, (g, w) => {
    const grd = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    const c = new THREE.Color(color);
    const rgb = `${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)}`;
    grd.addColorStop(0, `rgba(${rgb},0.9)`); grd.addColorStop(0.4, `rgba(${rgb},0.35)`); grd.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = grd; g.fillRect(0, 0, w, w);
  });
}

function countTris(obj) {
  let n = 0;
  obj.traverse(o => { if (o.isMesh) n += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
  return Math.round(n);
}

export class World {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xbfe6dc, 70, 230);
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1200);
    this.camMode = 'menu';
    this.camPos = new THREE.Vector3(-20, 6, 16);
    this.camLook = new THREE.Vector3(0, 2, 0);
    this.shakeAmt = 0;
    this.time = 0;
    this.items = new Set();
    this.particles = [];

    this.buildSky();
    this.buildLights();
    this.buildWater();
    this.buildBanks();
    this.buildVegetation();
    this.buildCliff();
    this.buildGates();
    this.buildShip();
    this.buildItemKits();
    this.buildParticles();

    this.resize();
    addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // Keep the river readable on tall phone screens.
    this.camera.fov = w / h < 0.8 ? 68 : w / h < 1.2 ? 58 : 50;
    this.camera.updateProjectionMatrix();
  }

  // ---------- scenery ----------
  buildSky() {
    const geo = new THREE.SphereGeometry(600, 32, 16);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(C.sky500) }, mid: { value: new THREE.Color(C.sky300) }, low: { value: new THREE.Color(0xdff3e2) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: '\nuniform vec3 top; uniform vec3 mid; uniform vec3 low; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.12 ? mix(mid, top, smoothstep(0.12, 0.6, h)) : mix(low, mid, smoothstep(-0.05, 0.12, h)); gl_FragColor = vec4(c,1.0);\n#include <colorspace_fragment>\n}',
    });
    this.sky = new THREE.Mesh(geo, mat);
    this.scene.add(this.sky);

    // Puffy low-poly clouds.
    const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xdde9f0, emissiveIntensity: 0.55, flatShading: true, fog: false });
    const puff = new THREE.IcosahedronGeometry(1, 1);
    this.clouds = new THREE.Group();
    for (let i = 0; i < 18; i++) {
      const g = new THREE.Group();
      const n = 4 + Math.floor(R() * 4);
      for (let j = 0; j < n; j++) {
        const m = new THREE.Mesh(puff, cloudMat);
        const s = rr(5, 10);
        m.scale.set(s * 1.3, s * 0.8, s);
        m.position.set(j * rr(5, 8) - n * 3, rr(-1, 2), rr(-3, 3));
        g.add(m);
      }
      g.position.set(rr(-100, 420), rr(55, 95), rr(-260, 260) + (R() < 0.5 ? -60 : 60));
      g.userData.speed = rr(0.6, 1.5);
      this.clouds.add(g);
    }
    this.scene.add(this.clouds);
  }

  buildLights() {
    this.hemi = new THREE.HemisphereLight(0xdff4ff, 0x4b7a3a, 1.35);
    this.scene.add(this.hemi);
    const sun = new THREE.DirectionalLight(0xfff0d2, 2.3);
    sun.position.set(-30, 50, 25);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const s = sun.shadow.camera; s.left = -40; s.right = 40; s.top = 40; s.bottom = -40; s.near = 1; s.far = 140;
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.04;
    this.sun = sun;
    this.scene.add(sun, sun.target);
  }

  buildWater() {
    const len = RIVER_END - RIVER_START + 40;
    const geo = new THREE.PlaneGeometry(len, RIVER_HALF * 2 + 6, Math.round(len / 1.6), 14);
    geo.rotateX(-Math.PI / 2);
    geo.translate(RIVER_START + len / 2 - 20, 0, 0);
    this.waterBase = Float32Array.from(geo.attributes.position.array);
    const mat = new THREE.MeshStandardMaterial({ color: C.water500, roughness: 0.25, metalness: 0.05, flatShading: true, transparent: true, opacity: 0.93 });
    this.water = new THREE.Mesh(geo, mat);
    this.water.receiveShadow = true;
    this.scene.add(this.water);

    // River bed so the shallow edges read as teal-green, not void.
    const bed = new THREE.Mesh(new THREE.PlaneGeometry(len, RIVER_HALF * 2 + 8), new THREE.MeshLambertMaterial({ color: C.water700 }));
    bed.rotation.x = -Math.PI / 2; bed.position.set(RIVER_START + len / 2 - 20, -1.4, 0);
    this.scene.add(bed);

    // Flow streaks drifting downstream.
    const streakGeo = new THREE.PlaneGeometry(2.6, 0.12);
    streakGeo.rotateX(-Math.PI / 2);
    const streakMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthWrite: false });
    this.streaks = new THREE.InstancedMesh(streakGeo, streakMat, 90);
    this.streakData = [];
    for (let i = 0; i < 90; i++) this.streakData.push({ x: rr(-30, 90), z: rr(-RIVER_HALF + 0.6, RIVER_HALF - 0.6), s: rr(0.5, 1.4) });
    this.scene.add(this.streaks);
    this.flowSpeed = 9;
  }

  bankHeight(x, d) {
    // d = distance from the water's edge (>= 0)
    const n = Math.sin(x * 0.11 + d * 0.2) * 1.1 + Math.sin(x * 0.037 - d * 0.13) * 2.2 + Math.cos(x * 0.21 + d * 0.31) * 0.5;
    if (d < 1.2) return -1.2 + d * 1.1;
    return 0.1 + Math.min(d, 8) * 0.12 + Math.max(0, d - 12) * 0.32 + n * Math.min(1, d / 10);
  }

  buildBanks() {
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    const len = RIVER_END - RIVER_START + 80;
    const sand = new THREE.Color(C.parch300), g1 = new THREE.Color(C.leaf500), g2 = new THREE.Color(C.leaf600), g3 = new THREE.Color(C.leaf700), tmp = new THREE.Color();
    for (const side of [-1, 1]) {
      const geo = new THREE.PlaneGeometry(len, 90, Math.round(len / 2.6), 34);
      geo.rotateX(-Math.PI / 2);
      const pos = geo.attributes.position;
      const colors = [];
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i) + RIVER_START + len / 2 - 40;
        const d = pos.getZ(i) + 45; // 0..90
        const y = this.bankHeight(x, d);
        pos.setXYZ(i, x, y, side * (RIVER_HALF - 1 + d));
        if (d < 2) tmp.copy(sand);
        else tmp.copy(g1).lerp(g2, Math.min(1, (d - 2) / 12)).lerp(g3, Math.max(0, Math.min(1, (y - 3) / 8)));
        tmp.offsetHSL(0, 0, (Math.sin(x * 1.7 + d * 2.3) * 0.5 + 0.5) * 0.03);
        colors.push(tmp.r, tmp.g, tmp.b);
      }
      geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      if (side === -1) { // flip winding so faces point up after mirroring
        const idx = geo.index.array;
        for (let i = 0; i < idx.length; i += 3) { const t = idx[i]; idx[i] = idx[i + 2]; idx[i + 2] = t; }
      }
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, mat);
      m.receiveShadow = true;
      this.scene.add(m);
    }
  }

  groundY(x, z) { return this.bankHeight(x, Math.abs(z) - (RIVER_HALF - 1)); }

  buildVegetation() {
    const dummy = new THREE.Object3D();
    const trees = [];
    for (let i = 0; i < 420; i++) {
      const x = rr(RIVER_START - 20, CLIFF_X + 6);
      const side = R() < 0.5 ? -1 : 1;
      const z = side * (RIVER_HALF + 3 + Math.pow(R(), 1.6) * 60);
      trees.push({ x, z, h: rr(3.5, 9), r: rr(1.8, 3.6), tall: R() < 0.25 });
    }
    // Trunks
    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.42, 1, 6); trunkGeo.translate(0, 0.5, 0);
    const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshLambertMaterial({ color: C.wood500, flatShading: true }), trees.length);
    // Canopies: two blobs per tree
    const leafGeo = new THREE.IcosahedronGeometry(1, 1);
    const canopy = new THREE.InstancedMesh(leafGeo, new THREE.MeshLambertMaterial({ flatShading: true }), trees.length * 2);
    const greens = [C.leaf300, C.leaf500, C.leaf500, C.leaf600, C.leaf600, C.leaf700].map(c => new THREE.Color(c));
    trees.forEach((t, i) => {
      const gy = this.groundY(t.x, t.z) - 0.2;
      const h = t.tall ? t.h * 1.7 : t.h;
      dummy.position.set(t.x, gy, t.z); dummy.rotation.set(rr(-0.08, 0.08), 0, rr(-0.12, 0.12)); dummy.scale.set(1 + h / 12, h, 1 + h / 12); dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);
      const top = gy + h;
      dummy.rotation.set(R() * 3, R() * 3, 0);
      dummy.position.set(t.x, top + t.r * 0.35, t.z); dummy.scale.set(t.r * 1.25, t.r * 0.85, t.r * 1.15); dummy.updateMatrix();
      canopy.setMatrixAt(i * 2, dummy.matrix); canopy.setColorAt(i * 2, pick(greens));
      dummy.position.set(t.x + rr(-1.2, 1.2), top + t.r * 0.9, t.z + rr(-1.2, 1.2)); dummy.scale.setScalar(t.r * 0.75); dummy.updateMatrix();
      canopy.setMatrixAt(i * 2 + 1, dummy.matrix); canopy.setColorAt(i * 2 + 1, pick(greens).clone().offsetHSL(0, 0, 0.04));
    });
    trunks.castShadow = canopy.castShadow = true;
    this.scene.add(trunks, canopy);

    // Big-leaf jungle plants along the shore (fans of flattened cones).
    const leaf = new THREE.ConeGeometry(0.42, 2.6, 4, 1); leaf.translate(0, 1.3, 0); leaf.scale(1, 1, 0.25);
    const plants = [];
    for (let i = 0; i < 170; i++) {
      const side = R() < 0.5 ? -1 : 1;
      plants.push({ x: rr(RIVER_START, CLIFF_X), z: side * (RIVER_HALF + 0.8 + Math.pow(R(), 2) * 16), s: rr(0.7, 1.6), n: 5 + Math.floor(R() * 3) });
    }
    const total = plants.reduce((a, p) => a + p.n, 0);
    const leaves = new THREE.InstancedMesh(leaf, new THREE.MeshLambertMaterial({ flatShading: true, side: THREE.DoubleSide }), total);
    let k = 0;
    const lc = [C.leaf300, C.leaf500, C.leaf600].map(c => new THREE.Color(c));
    for (const p of plants) {
      const gy = this.groundY(p.x, p.z) - 0.1;
      const c = pick(lc);
      for (let j = 0; j < p.n; j++) {
        const a = (j / p.n) * Math.PI * 2 + rr(-0.2, 0.2);
        dummy.position.set(p.x, gy, p.z);
        dummy.rotation.set(0, a, 0);
        dummy.rotateX(rr(0.45, 0.95));
        dummy.scale.setScalar(p.s * rr(0.8, 1.2));
        dummy.updateMatrix();
        leaves.setMatrixAt(k, dummy.matrix); leaves.setColorAt(k, c); k++;
      }
    }
    leaves.castShadow = true;
    this.scene.add(leaves);

    // Shore rocks.
    const rockGeo = new THREE.DodecahedronGeometry(1, 0);
    const rocks = new THREE.InstancedMesh(rockGeo, new THREE.MeshLambertMaterial({ flatShading: true }), 110);
    const rockCols = [0xa99d80, 0x8f8670, C.stone500, 0xb8aa8a].map(c => new THREE.Color(c));
    for (let i = 0; i < 110; i++) {
      const side = R() < 0.5 ? -1 : 1;
      const x = rr(RIVER_START, CLIFF_X), z = side * (RIVER_HALF - 0.6 + R() * 6);
      const s = rr(0.5, 1.8);
      dummy.position.set(x, this.groundY(x, z) - s * 0.2, z); dummy.rotation.set(R() * 3, R() * 3, R() * 3); dummy.scale.set(s * 1.3, s * 0.8, s); dummy.updateMatrix();
      rocks.setMatrixAt(i, dummy.matrix); rocks.setColorAt(i, pick(rockCols));
    }
    rocks.castShadow = rocks.receiveShadow = true;
    this.scene.add(rocks);
  }

  buildCliff() {
    const rockGeo = new THREE.DodecahedronGeometry(1, 1);
    const mat = new THREE.MeshLambertMaterial({ flatShading: true });
    const cols = [0xa99d80, 0x9b8f74, 0xb3a68a, 0x8f8670].map(c => new THREE.Color(c));
    const n = 70;
    const cliff = new THREE.InstancedMesh(rockGeo, mat, n);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < n; i++) {
      const z = rr(-80, 80);
      const gap = Math.abs(z) < 7.5;
      const h = gap ? rr(13, 15) : rr(12, 24);
      const s = rr(6, 11);
      dummy.position.set(CLIFF_X + rr(0, 14) + (gap ? 6 : 0), h - s * 0.7, z);
      dummy.rotation.set(R(), R() * 3, R());
      dummy.scale.set(s, s * rr(0.8, 1.2), s);
      dummy.updateMatrix();
      cliff.setMatrixAt(i, dummy.matrix); cliff.setColorAt(i, pick(cols));
    }
    cliff.castShadow = cliff.receiveShadow = true;
    this.scene.add(cliff);
    // Moss caps on the cliff.
    const moss = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshLambertMaterial({ flatShading: true }), 40);
    const greens = [C.leaf300, C.leaf500, C.leaf600].map(c => new THREE.Color(c));
    for (let i = 0; i < 40; i++) {
      const z = rr(-70, 70);
      if (Math.abs(z) < 8) continue;
      dummy.position.set(CLIFF_X + rr(4, 16), rr(18, 26), z); dummy.rotation.set(R(), R(), R()); dummy.scale.set(rr(3, 6), rr(2, 3.5), rr(3, 6)); dummy.updateMatrix();
      moss.setMatrixAt(i, dummy.matrix); moss.setColorAt(i, pick(greens));
    }
    this.scene.add(moss);

    // Waterfall: scrolling streak texture on a slightly curved sheet.
    this.fallTex = canvasTex(64, 256, (g, w, h) => {
      g.fillStyle = '#d9f6f4'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 90; i++) {
        g.fillStyle = `rgba(${R() < 0.5 ? '255,255,255' : '131,212,216'},${rr(0.4, 0.9)})`;
        g.fillRect(R() * w, R() * h, rr(1, 4), rr(20, 70));
      }
    });
    this.fallTex.wrapS = this.fallTex.wrapT = THREE.RepeatWrapping;
    this.fallTex.repeat.set(3, 1.5);
    const fallGeo = new THREE.CylinderGeometry(22, 22, 15, 24, 1, true, -0.33, 0.66);
    const fall = new THREE.Mesh(fallGeo, new THREE.MeshBasicMaterial({ map: this.fallTex, transparent: true, opacity: 0.92, side: THREE.DoubleSide, fog: false }));
    fall.rotation.y = -Math.PI / 2;
    fall.position.set(CLIFF_X + 22 - 1, 7.4, 0);
    this.scene.add(fall);
    // Mist at the base.
    this.mist = [];
    const mistTex = haloTexture(0xffffff);
    for (let i = 0; i < 14; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: mistTex, transparent: true, opacity: 0.6, depthWrite: false }));
      sp.position.set(CLIFF_X - rr(1, 5), rr(0.5, 3), rr(-7, 7));
      sp.scale.setScalar(rr(4, 8));
      sp.userData.phase = R() * 6;
      this.mist.push(sp); this.scene.add(sp);
    }
  }

  buildGates() {
    const STAGES = ['To Do', 'In Progress', 'In Review', 'Done'];
    const poleMat = new THREE.MeshLambertMaterial({ color: C.wood500, flatShading: true });
    const beamMat = new THREE.MeshLambertMaterial({ color: C.wood700, flatShading: true });
    this.gates = STAGE_X.map((x, i) => {
      const g = new THREE.Group();
      g.position.x = x;
      for (const side of [-1, 1]) {
        const z = side * (RIVER_HALF + 0.6);
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 9, 7), poleMat);
        pole.position.set(0, this.groundY(x, z) + 4, z);
        pole.castShadow = true;
        g.add(pole);
        // Buoy floating just inside the river.
        const buoy = new THREE.Group();
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 1.1, 10), new THREE.MeshLambertMaterial({ color: STATUS_COLORS[i] }));
        const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.6, 0.22, 10), new THREE.MeshLambertMaterial({ color: 0xffffff }));
        stripe.position.y = 0.1;
        const cap = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.7, 10), new THREE.MeshLambertMaterial({ color: STATUS_COLORS[i] }));
        cap.position.y = 0.9;
        buoy.add(body, stripe, cap);
        buoy.position.set(0, 0.2, side * (RIVER_HALF - 1.6));
        buoy.userData.phase = i * 1.3 + side;
        buoy.traverse(o => { o.castShadow = true; });
        g.add(buoy);
        (g.userData.buoys ||= []).push(buoy);
      }
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, RIVER_HALF * 2 + 3), beamMat);
      beam.position.y = 8.2; beam.castShadow = true;
      g.add(beam);
      // Lantern that lights up when the ship reaches this waypoint.
      const lantern = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), new THREE.MeshLambertMaterial({ color: C.parch200, emissive: C.sun300, emissiveIntensity: 0 }));
      lantern.position.set(0, 7.1, 0);
      g.add(lantern);
      const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(STAGES[i], `Waypoint ${i + 1}`, STATUS_COLORS[i]), transparent: true }));
      sign.scale.set(7.2, 2.25, 1);
      sign.position.set(0, 10.2, 0);
      g.add(sign);
      g.userData.lantern = lantern;
      this.scene.add(g);
      return g;
    });
  }

  buildShip() {
    const ship = new THREE.Group();
    const inner = new THREE.Group();
    ship.add(inner);
    // Procedural stand-in boat. Hidden when a GLB ship model loads (see loadShipModel).
    const body = new THREE.Group();
    inner.add(body);
    this.placeholderBody = body;
    const wood5 = new THREE.MeshLambertMaterial({ color: C.wood500, flatShading: true });
    const wood3 = new THREE.MeshLambertMaterial({ color: C.wood300, flatShading: true });
    const wood7 = new THREE.MeshLambertMaterial({ color: C.wood700, flatShading: true });
    const sun = new THREE.MeshLambertMaterial({ color: C.sun500, flatShading: true });

    // Hull: side profile extruded across the beam.
    const prof = new THREE.Shape();
    prof.moveTo(-2.3, 1.0); prof.lineTo(2.2, 1.0); prof.lineTo(2.9, 1.45); prof.lineTo(2.1, 0.05);
    prof.quadraticCurveTo(0, -0.45, -1.9, 0.0); prof.lineTo(-2.5, 1.2); prof.closePath();
    const hullGeo = new THREE.ExtrudeGeometry(prof, { depth: 2.2, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 1, steps: 1 });
    hullGeo.translate(0, 0, -1.1);
    const hull = new THREE.Mesh(hullGeo, wood5);
    // Plank lines
    for (const y of [0.35, 0.7]) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.08, 2.46), wood7);
      plank.position.set(0.05, y, 0);
      body.add(plank);
    }
    const deck = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.16, 2.0), wood3);
    deck.position.set(0.1, 0.98, 0);
    const trimL = new THREE.Mesh(new THREE.BoxGeometry(4.7, 0.14, 0.14), sun);
    trimL.position.set(0.1, 1.12, 1.13);
    const trimR = trimL.clone(); trimR.position.z = -1.13;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 5.6, 8), wood7);
    mast.position.set(0.2, 3.7, 0);
    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 6), wood7);
    boom.rotation.z = Math.PI / 2; boom.position.set(-0.95, 1.7, 0);
    // Sails
    const sailShape = new THREE.Shape(); sailShape.moveTo(0, 0); sailShape.lineTo(-2.3, 0); sailShape.quadraticCurveTo(-1.0, 1.8, 0, 4.4); sailShape.closePath();
    const sail = new THREE.Mesh(new THREE.ShapeGeometry(sailShape), new THREE.MeshLambertMaterial({ color: C.parch50, side: THREE.DoubleSide }));
    sail.position.set(0.1, 1.8, 0.02);
    const jibShape = new THREE.Shape(); jibShape.moveTo(0, 0); jibShape.lineTo(2.3, 0); jibShape.lineTo(0, 3.4); jibShape.closePath();
    const jib = new THREE.Mesh(new THREE.ShapeGeometry(jibShape), new THREE.MeshLambertMaterial({ color: C.sun300, side: THREE.DoubleSide }));
    jib.position.set(0.32, 1.5, 0.02);
    const flagShape = new THREE.Shape(); flagShape.moveTo(0, 0); flagShape.lineTo(1.1, -0.3); flagShape.lineTo(0, -0.62); flagShape.closePath();
    const flag = new THREE.Mesh(new THREE.ShapeGeometry(flagShape), new THREE.MeshLambertMaterial({ color: C.coral400, side: THREE.DoubleSide }));
    flag.position.set(0.25, 6.45, 0);
    this.flag = flag;
    body.add(hull, deck, trimL, trimR, mast, boom, sail, jib, flag);
    this.sail = sail;

    // Cargo: crates stack up on deck as tickets reach Done.
    this.cargo = [];
    const cargoMat = new THREE.MeshLambertMaterial({ map: crateTexture(true) });
    const slots = [[-1.5, 0.55], [-1.5, -0.55], [-0.85, 0.55], [-0.85, -0.55], [1.2, 0.5], [1.2, -0.5], [-1.5, 0], [1.75, 0]];
    slots.forEach(([x, z], i) => {
      const s = i >= 6 ? 0.5 : 0.62;
      const c = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), cargoMat);
      c.position.set(x, 1.06 + s / 2 + (i >= 6 ? 0.62 : 0), z);
      c.rotation.y = rr(-0.2, 0.2);
      c.visible = false;
      inner.add(c); this.cargo.push(c);
    });
    inner.traverse(o => { if (o.isMesh) o.castShadow = true; });

    // Wake foam
    const wakeTex = haloTexture(0xffffff);
    this.wake = new THREE.Mesh(new THREE.PlaneGeometry(7, 3.6), new THREE.MeshBasicMaterial({ map: wakeTex, transparent: true, opacity: 0.55, depthWrite: false }));
    this.wake.rotation.x = -Math.PI / 2;
    this.wake.position.set(-2.4, 0.16, 0);
    ship.add(this.wake);

    this.ship = ship; this.shipInner = inner;
    ship.position.set(STAGE_X[0], 0, 0);
    this.scene.add(ship);
  }

  /**
   * Replace the stand-in boat with a glTF model. The model is auto-fitted: its
   * longest horizontal axis is turned to point along the river, it is scaled to
   * `length` units, centred, and its keel sits at `draft` below the waterline.
   */
  async loadShipModel(url, { length = 6.2, draft = 0.35, flip = false, yaw = 0, deckHeight = 0.42 } = {}) {
    const [{ GLTFLoader }, { MeshoptDecoder }] = await Promise.all([
      import('three/addons/loaders/GLTFLoader.js'),
      import('three/addons/libs/meshopt_decoder.module.js'),
    ]);
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const gltf = await loader.loadAsync(url);
    const model = gltf.scene;
    model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

    // Orient: bow along +X (the direction the ship sails).
    let box = new THREE.Box3().setFromObject(model);
    let size = box.getSize(new THREE.Vector3());
    if (size.z > size.x) model.rotation.y = Math.PI / 2;
    model.rotation.y += (flip ? Math.PI : 0) + yaw;
    model.updateMatrixWorld(true);

    // Scale + place.
    box = new THREE.Box3().setFromObject(model);
    size = box.getSize(new THREE.Vector3());
    const k = length / Math.max(size.x, 1e-6);
    model.scale.multiplyScalar(k);
    model.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(model);
    const c = box.getCenter(new THREE.Vector3());
    model.position.x -= c.x;
    model.position.z -= c.z;
    model.position.y -= box.min.y + draft;

    const holder = new THREE.Group();
    holder.add(model);
    this.shipInner.add(holder);
    this.placeholderBody.visible = false;
    this.flag = this.sail = null;
    this.customShip = holder;

    // Put the cargo crates on the model's deck.
    const h = box.max.y - box.min.y;
    const deckY = -draft + h * deckHeight;
    this.cargo.forEach((cr, i) => {
      const s = cr.geometry.parameters.width;
      cr.position.y = deckY + s / 2 + (i >= 6 ? 0.62 : 0);
      cr.position.x *= length / 5.4;
    });
    return { triangles: countTris(model), size: size.multiplyScalar(k) };
  }

  setCargo(n) { this.cargo.forEach((c, i) => { c.visible = i < n; }); }

  buildItemKits() {
    this.kits = {
      crate: { geo: new THREE.BoxGeometry(1.5, 1.5, 1.5), mat: new THREE.MeshLambertMaterial({ map: crateTexture(false) }) },
      rock: { geo: new THREE.DodecahedronGeometry(1.35, 0), mat: new THREE.MeshLambertMaterial({ color: 0x8f8670, flatShading: true }) },
      log: { geo: new THREE.CylinderGeometry(0.5, 0.55, 4.6, 8), mat: new THREE.MeshLambertMaterial({ color: C.wood700, flatShading: true }) },
      orb: { geo: new THREE.IcosahedronGeometry(0.65, 0), mat: new THREE.MeshLambertMaterial({ color: C.glow300, emissive: C.glow500, emissiveIntensity: 0.9, flatShading: true }) },
    };
    this.haloGlow = haloTexture(C.glow500);
    this.haloSun = haloTexture(C.sun300);
    this.foamTex = haloTexture(0xffffff);
  }

  /** Creates a floating item mesh at (x, z). */
  spawn(type, x, z) {
    const kit = this.kits[type];
    const root = new THREE.Group();
    const m = new THREE.Mesh(kit.geo, kit.mat);
    m.castShadow = true;
    root.add(m);
    if (type === 'log') { m.rotation.x = Math.PI / 2; m.position.y = 0.1; }
    if (type === 'rock') { m.scale.set(1.2, 0.85, 1); m.position.y = 0.2; }
    if (type === 'crate') { m.position.y = 0.35; }
    if (type === 'orb') {
      m.position.y = 1.1;
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.haloGlow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      halo.scale.setScalar(3.4); halo.position.y = 1.1; root.add(halo);
    }
    if (type !== 'orb') {
      const foam = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.foamTex, transparent: true, opacity: 0.5, depthWrite: false }));
      foam.rotation.x = -Math.PI / 2; foam.position.y = 0.12;
      const fs = type === 'log' ? [2.4, 5.6] : [2.8, 2.8];
      foam.scale.set(fs[0], fs[1], 1);
      root.add(foam);
    }
    root.position.set(x, 0, z);
    root.userData = { type, body: m, phase: R() * 6 };
    this.scene.add(root);
    this.items.add(root);
    return root;
  }

  despawn(obj) {
    this.scene.remove(obj);
    this.items.delete(obj);
    obj.traverse(o => { if (o.material && o.material.map === this.foamTex && o.isMesh) { o.geometry.dispose(); o.material.dispose(); } if (o.isSprite) o.material.dispose(); });
  }

  clearItems() { for (const o of [...this.items]) this.despawn(o); }

  // ---------- particles ----------
  buildParticles() {
    const geo = new THREE.BoxGeometry(0.28, 0.28, 0.28);
    this.pMesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff }), 260);
    this.pMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.pMesh.frustumCulled = false;
    this.pData = [];
    this.scene.add(this.pMesh);
    this._pDummy = new THREE.Object3D();
    this._pCol = new THREE.Color();
  }

  burst(x, y, z, color, n = 18, power = 6) {
    for (let i = 0; i < n; i++) {
      if (this.pData.length >= 260) this.pData.shift();
      const a = R() * Math.PI * 2, up = rr(0.4, 1);
      this.pData.push({ x, y, z, vx: Math.cos(a) * power * rr(0.3, 1), vy: power * up * 1.3, vz: Math.sin(a) * power * rr(0.3, 1), life: rr(0.6, 1.1), max: 1, color, rx: R() * 3 });
    }
  }

  updateParticles(dt) {
    const d = this._pDummy;
    this.pData = this.pData.filter(p => (p.life -= dt) > 0);
    for (let i = 0; i < 260; i++) {
      const p = this.pData[i];
      if (!p) { d.scale.setScalar(0); d.updateMatrix(); this.pMesh.setMatrixAt(i, d.matrix); continue; }
      p.vy -= 18 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.rx += dt * 6;
      if (p.y < 0) { p.y = 0; p.vy *= -0.3; }
      d.position.set(p.x, p.y, p.z); d.rotation.set(p.rx, p.rx * 0.7, 0); d.scale.setScalar(Math.min(1, p.life * 2)); d.updateMatrix();
      this.pMesh.setMatrixAt(i, d.matrix);
      this.pMesh.setColorAt(i, this._pCol.set(p.color));
    }
    this.pMesh.instanceMatrix.needsUpdate = true;
    if (this.pMesh.instanceColor) this.pMesh.instanceColor.needsUpdate = true;
  }

  shake(a) { this.shakeAmt = Math.max(this.shakeAmt, a); }

  /** Lights lanterns for waypoints the ship has reached. */
  setReached(position) {
    this.gates.forEach((g, i) => {
      const on = position >= i - 0.02;
      g.userData.lantern.material.emissiveIntensity += ((on ? 1.2 : 0) - g.userData.lantern.material.emissiveIntensity) * 0.1;
    });
  }

  setCameraMode(mode) { this.camMode = mode; }

  // ---------- per frame ----------
  update(dt, ship = { x: 0, z: 0, roll: 0, speed: 0 }) {
    this.time += dt;
    const t = this.time;

    // Water waves
    const pos = this.water.geometry.attributes.position;
    const a = pos.array, b = this.waterBase;
    for (let i = 0; i < a.length; i += 3) {
      const x = b[i], z = b[i + 2];
      a[i + 1] = Math.sin(x * 0.45 + t * 2.2) * 0.1 + Math.cos(z * 0.9 + x * 0.12 + t * 1.6) * 0.08;
    }
    pos.needsUpdate = true;

    // Flow streaks (wrap around the ship)
    const d = this._pDummy;
    this.streakData.forEach((s, i) => {
      s.x -= this.flowSpeed * dt * (0.8 + s.s * 0.2);
      if (s.x < ship.x - 30) { s.x = ship.x + rr(40, 90); s.z = rr(-RIVER_HALF + 0.6, RIVER_HALF - 0.6); }
      d.position.set(s.x, 0.18, s.z); d.rotation.set(0, 0, 0); d.scale.set(s.s, 1, 1); d.updateMatrix();
      this.streaks.setMatrixAt(i, d.matrix);
    });
    this.streaks.instanceMatrix.needsUpdate = true;

    this.fallTex.offset.y += dt * 1.6;
    this.mist.forEach(m => { m.material.opacity = 0.4 + Math.sin(t * 1.5 + m.userData.phase) * 0.2; });
    this.clouds.children.forEach(c => { c.position.x += c.userData.speed * dt; if (c.position.x > 460) c.position.x = -140; });
    this.gates.forEach(g => g.userData.buoys.forEach(bu => { bu.position.y = 0.15 + Math.sin(t * 2 + bu.userData.phase) * 0.12; bu.rotation.z = Math.sin(t * 1.6 + bu.userData.phase) * 0.08; }));

    // Ship
    this.ship.position.x = ship.x;
    this.ship.position.z = ship.z;
    this.shipInner.position.y = Math.sin(t * 2.4) * 0.12 + 0.05;
    this.shipInner.rotation.x = Math.sin(t * 2.4) * 0.04 + ship.roll;
    this.shipInner.rotation.z = Math.sin(t * 1.7) * 0.03 - ship.speed * 0.006;
    if (this.flag) this.flag.rotation.y = Math.sin(t * 8) * 0.25;
    if (this.sail) this.sail.scale.x = 1 + Math.sin(t * 3) * 0.03;
    this.wake.material.opacity = 0.35 + Math.min(0.4, Math.abs(ship.speed) * 0.05);
    this.wake.scale.x = 1 + Math.min(1.2, Math.abs(ship.speed) * 0.1);

    // Items bob
    for (const it of this.items) {
      const u = it.userData;
      const ph = t * 2.2 + u.phase;
      if (u.type === 'crate') { u.body.position.y = 0.35 + Math.sin(ph) * 0.15; u.body.rotation.set(Math.sin(ph) * 0.15, t * 0.6 + u.phase, Math.cos(ph) * 0.12); }
      if (u.type === 'orb') { u.body.position.y = 1.1 + Math.sin(ph * 1.4) * 0.3; u.body.rotation.y += dt * 2; u.body.rotation.x += dt; }
      if (u.type === 'log') { u.body.rotation.y = Math.sin(ph * 0.5) * 0.1; u.body.position.y = 0.1 + Math.sin(ph) * 0.08; }
      if (u.type === 'rock') { u.body.position.y = 0.2 + Math.sin(ph) * 0.03; }
    }

    this.updateParticles(dt);

    // Sun + shadow follow the ship
    this.sun.position.set(ship.x - 30, 50, 25);
    this.sun.target.position.set(ship.x + 10, 0, 0);

    // Camera
    const desiredPos = new THREE.Vector3();
    const desiredLook = new THREE.Vector3();
    const portrait = this.camera.aspect < 0.8;
    if (this.camMode === 'play') {
      desiredPos.set(ship.x - (portrait ? 19 : 15), portrait ? 14 : 10.5, ship.z * 0.45);
      desiredLook.set(ship.x + 9, portrait ? -5 : -4.2, ship.z * 0.6);
    } else if (this.camMode === 'menu') {
      const sway = Math.sin(t * 0.15) * 1.5;
      desiredPos.set(ship.x - 5.5 + sway, 3.3, 13);
      desiredLook.set(ship.x - (portrait ? 0 : 7), 3.1, 0);
    } else if (this.camMode === 'sprints') {
      desiredPos.set(ship.x - 14, 7.5, 17);
      desiredLook.set(ship.x + 6, 3.5, -2);
    } else if (this.camMode === 'finish') {
      desiredPos.set(ship.x + 9 + Math.sin(t * 0.3) * 3, 4.5, 11);
      desiredLook.set(ship.x + 1, 2.5, 0);
    }
    const k = 1 - Math.pow(0.0025, dt);
    this.camPos.lerp(desiredPos, k);
    this.camLook.lerp(desiredLook, k);
    this.camera.position.copy(this.camPos);
    if (this.shakeAmt > 0.001) {
      this.camera.position.x += (R() - 0.5) * this.shakeAmt;
      this.camera.position.y += (R() - 0.5) * this.shakeAmt;
      this.shakeAmt *= Math.pow(0.02, dt);
    }
    this.camera.lookAt(this.camLook);
  }

  /** Projects a world point to CSS pixels. */
  toScreen(x, y, z) {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight, visible: v.z < 1 };
  }

  render() { this.renderer.render(this.scene, this.camera); }
}
