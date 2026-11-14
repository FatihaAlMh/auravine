import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "flowers.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify(
      {
        "demo-bloom": {
          slug: "demo-bloom",
          recipient_name: "Elena",
          secret_message: "Every great bloom begins as a small, quiet seed.",
          primary_color: "#9d5cff",
          secondary_color: "#38bdf8",
          created_at: new Date().toISOString(),
        },
      },
      null,
      2
    ),
    "utf8"
  );
}

function readStore() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return {};
  }
}

function writeStore(store) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), "utf8");
}

function generateSlug() {
  return crypto.randomBytes(6).toString("base64url");
}

const APP_HTML = `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>Auravine — Send an Eternal Particle Bloom</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <style>
    :root {
      --fg: #e6dcff;
      --bg1: #1a0f3a;
      --bg2: #03030c;
      --bg3: #000000;
      box-sizing: border-box;
      padding-top: env(safe-area-inset-top, 0px);
      padding-bottom: env(safe-area-inset-bottom, 0px);
    }
    html, body {
      height: 100%;
      margin: 0;
      background-color: #000;
      color: var(--fg);
      font-family: Georgia, "Times New Roman", serif;
      -webkit-font-smoothing: antialiased;
    }
    .auravine-bg {
      background: radial-gradient(ellipse at 50% 72%, var(--bg1) 0%, var(--bg2) 58%, var(--bg3) 100%);
    }
    .glow-text {
      text-shadow: 0 0 18px rgba(150, 120, 255, 0.8), 0 0 40px rgba(90, 120, 255, 0.5);
    }
    @keyframes pulseHint {
      50% { opacity: 0.3; }
    }
    .hint-pulse {
      opacity: 0.8;
      animation: pulseHint 2.4s ease-in-out infinite;
    }
  </style>
</head>
<body class="auravine-bg min-h-screen text-[#e6dcff] selection:bg-purple-500/30 selection:text-purple-100">
  <div id="app"></div>

  <script type="module">
    import React, { useState, useEffect, useRef } from "https://esm.sh/react@18.3.1";
    import { createRoot } from "https://esm.sh/react-dom@18.3.1/client";
    import htm from "https://esm.sh/htm@3.1.1";

    const html = htm.bind(React.createElement);
    const THREE = window.THREE;

    /* ============================================================================
     * 3D Particle Flower Engine (Adapted from Particle Bloom.html with Custom Colors)
     * ============================================================================ */
    function hexToRgb01(hex) {
      const clean = (hex || "#9d5cff").replace("#", "").trim();
      const full = clean.length === 3 ? clean.split("").map(c => c + c).join("") : clean.padEnd(6, "0");
      const num = parseInt(full.slice(0, 6), 16);
      if (Number.isNaN(num)) return [0.65, 0.35, 1.0];
      return [((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255];
    }

    const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
    const ease = x => x * x * (3 - 2 * x);
    const sstep = (a, b, x) => ease(clamp((x - a) / (b - a), 0, 1));

    function buildPalette(primaryHex, secondaryHex) {
      const pri = hexToRgb01(primaryHex);
      const sec = hexToRgb01(secondaryHex);
      const white = [1.0, 0.96, 1.0];
      const gold = [1.0, 0.88, 0.55];
      return {
        base: mix(pri, white, 0.72),
        mid: pri,
        tip: sec,
        throat: mix(pri, sec, 0.35),
        tend: mix(gold, sec, 0.25),
        stem: mix([0.18, 0.72, 0.55], sec, 0.45),
      };
    }

    const VS = \`
    attribute float aSize, aAlpha, aSeed;
    attribute vec3 aColor;
    uniform float uTime, uPR, uScale, uWobble, uFade;
    varying vec3 vC;
    varying float vA;
    void main(){
      vec3 p = position;
      p += uWobble * vec3(sin(uTime*1.3+aSeed*20.), cos(uTime*1.1+aSeed*31.), sin(uTime*0.9+aSeed*11.));
      vec4 mv = modelViewMatrix * vec4(p,1.);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = min(aSize * 40. * uScale * uPR / -mv.z, 24. * uPR);
      vA = aAlpha * uFade * (0.75 + 0.25*sin(uTime*2. + aSeed*50.));
      vC = aColor;
    }\`;

    const FS = \`
    varying vec3 vC;
    varying float vA;
    void main(){
      float d = length(gl_PointCoord - 0.5);
      if(d > 0.5) discard;
      float a = pow(1.0 - d*2.0, 2.2);
      float core = smoothstep(0.22, 0.0, d);
      gl_FragColor = vec4(vC + core*0.45, a * vA);
    }\`;

    const LAYERS = [
      { n: 3, yaw: 0,      len: 4.4, p0: 0.45, p1: 1.55, curl: 1.0, w: 1.35, ruf: 1.0, share: 0.38 },
      { n: 3, yaw: 1.0472, len: 4.0, p0: 0.35, p1: 1.25, curl: 0.9, w: 1.40, ruf: 1.0, share: 0.38 },
      { n: 6, yaw: 0.3,    len: 1.8, p0: 0.10, p1: 0.55, curl: 0.5, w: 0.50, ruf: 0.3, share: 0.24 }
    ];

    const LEAVES = [
      { yb: 0.25, az: 0.6, len: 2.4 },
      { yb: 0.45, az: 3.0, len: 2.8 },
      { yb: 0.80, az: 4.4, len: 2.0 },
      { yb: 1.15, az: 1.9, len: 1.7 }
    ];

    function ParticleFlowerCanvas({ primaryColor, secondaryColor, autoBloom = false, onSeedTap, onBloomComplete }) {
      const stageRef = useRef(null);
      const [seedTapped, setSeedTapped] = useState(autoBloom);
      const recolorRef = useRef(null);
      const callbacksRef = useRef({ onSeedTap, onBloomComplete });
      callbacksRef.current = { onSeedTap, onBloomComplete };

      useEffect(() => {
        const stage = stageRef.current;
        if (!stage) return;

        const R = Math.random, TAU = Math.PI * 2;
        const gs = () => (R() + R() + R() - 1.5) / 1.5;

        const PR = Math.min(window.devicePixelRatio || 1, 2);
        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setPixelRatio(PR);
        renderer.setClearColor(0x000000, 0);
        stage.innerHTML = "";
        stage.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
        let camZ = 14.5;
        let W = stage.clientWidth || window.innerWidth;
        let H = stage.clientHeight || window.innerHeight;

        const timeU = { value: 0 }, scaleU = { value: 1 };

        function makeMat(fade, wobble) {
          return new THREE.ShaderMaterial({
            uniforms: { uTime: timeU, uScale: scaleU, uPR: { value: PR }, uFade: { value: fade }, uWobble: { value: wobble } },
            vertexShader: VS,
            fragmentShader: FS,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
          });
        }

        function makePoints(pos, sizeArr, col, alpha, seedArr, mat, dynamic) {
          const g = new THREE.BufferGeometry();
          const P = new THREE.BufferAttribute(pos, 3);
          const S = new THREE.BufferAttribute(sizeArr, 1);
          const C = new THREE.BufferAttribute(col, 3);
          if (dynamic) {
            P.setUsage(THREE.DynamicDrawUsage);
            S.setUsage(THREE.DynamicDrawUsage);
            C.setUsage(THREE.DynamicDrawUsage);
          }
          g.setAttribute("position", P);
          g.setAttribute("aSize", S);
          g.setAttribute("aColor", C);
          g.setAttribute("aAlpha", new THREE.BufferAttribute(alpha, 1));
          g.setAttribute("aSeed", new THREE.BufferAttribute(seedArr, 1));
          const pts = new THREE.Points(g, mat);
          pts.frustumCulled = false;
          return pts;
        }

        const Y0 = 3.0;
        const N_STEM = 2400, N_CORE = 2400, N_PETAL = 19000, N = N_STEM + N_CORE + N_PETAL;
        const open = new Float32Array(N * 3), closed = new Float32Array(N * 3), cur = new Float32Array(N * 3), vel = new Float32Array(N * 3);
        const size0 = new Float32Array(N), size = new Float32Array(N), colA = new Float32Array(N * 3), alphaA = new Float32Array(N), seedA = new Float32Array(N), appear = new Float32Array(N), type = new Uint8Array(N);

        const metaT = new Float32Array(N), metaEdge = new Float32Array(N), metaBr = new Float32Array(N);
        const metaLayer = new Uint8Array(N), metaSub = new Uint8Array(N);

        function spine(L, t, o) {
          const p0 = 0.08 + (L.p0 - 0.08) * o, p1 = 0.3 + (L.p1 - 0.3) * o, cu = L.curl * o;
          const n = 12, dt = t / n;
          let r = 0, y = 0;
          for (let k = 0; k < n; k++) {
            const u = (k + 0.5) * dt, phi = p0 + (p1 - p0) * u + cu * u * u * u * u;
            r += Math.sin(phi) * dt * L.len;
            y += Math.cos(phi) * dt * L.len;
          }
          return [r, y];
        }

        function petalPos(L, ang, t, s, o) {
          const sp = spine(L, t, o);
          const w = L.w * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.85)), 0.7);
          const rho = sp[0] + 0.1 + 0.35 * w * (1 - s * s) * (1 - o);
          const y = sp[1] + 0.3 * w * s * s * o + L.ruf * 0.2 * Math.sin(t * 10 + ang * 2) * s * s * o;
          const lat = s * w * (0.35 + 0.65 * o);
          const ca = Math.cos(ang), sa = Math.sin(ang);
          return [ca * rho - sa * lat, Y0 + y, sa * rho + ca * lat];
        }

        function setP(i, o, c) {
          open.set(o, i * 3);
          closed.set(c, i * 3);
        }

        const TEND = [];
        for (let j = 0; j < 5; j++) {
          const K = (j % 2 ? -1 : 1) * (5 + R() * 2.5), len = 2.6 + R() * 0.6, path = [[0, 0]];
          let a = 0, b = 0;
          const n = 60;
          for (let k = 0; k < n; k++) {
            const u = (k + 0.5) / n, psi = 0.25 + K * u * u, ds = (len / n) * (1.15 - 0.7 * u);
            a += Math.sin(psi) * ds;
            b += Math.cos(psi) * ds;
            path.push([a, b]);
          }
          TEND.push({ ang: j * 1.2566 + 0.4, path });
        }

        for (let i = 0; i < N; i++) {
          seedA[i] = R();
          alphaA[i] = 0.6;
          if (i < 800) {
            type[i] = 0; metaSub[i] = 0;
            const yy = R() * Y0, x = 0.25 * Math.sin((yy / Y0) * TAU);
            const p = [x + gs() * 0.06, yy, gs() * 0.06];
            setP(i, p, p);
            metaT[i] = yy / Y0;
            size0[i] = 0.6 + R() * 0.5;
            appear[i] = (yy / Y0) * 1.5;
            alphaA[i] = 0.6;
          } else if (i < N_STEM) {
            type[i] = 0; metaSub[i] = 1;
            const lf = LEAVES[i % 4];
            let t; do { t = R(); } while (R() > Math.pow(Math.sin(Math.PI * Math.pow(t, 0.8)), 0.7));
            const edge = R() < 0.2 ? 1 : 0, s = edge ? (R() < 0.5 ? -1 : 1) : R() * 2 - 1;
            const w = 0.8 * (lf.len / 2.4) * Math.sin(Math.PI * Math.pow(t, 0.8)), r = lf.len * t * 0.95;
            const yy = lf.yb + lf.len * (0.5 * t - 0.55 * t * t) + 0.2 * w * s * s, x0 = 0.25 * Math.sin((lf.yb / Y0) * TAU);
            const dx = Math.cos(lf.az), dz = Math.sin(lf.az);
            const p = [x0 + dx * r - dz * s * w, yy, dx * s * w + dz * r];
            setP(i, p, p);
            metaT[i] = t; metaEdge[i] = edge;
            size0[i] = 0.6 + R() * 0.5;
            appear[i] = (lf.yb / Y0) * 1.5 + t * 0.4;
            alphaA[i] = 0.45;
          } else if (i < N_STEM + N_CORE) {
            type[i] = 1;
            const q = R();
            let p, sz, ap;
            if (q < 0.55) {
              metaSub[i] = 2;
              const T = TEND[(R() * 5) | 0], u = R(), f = u * 60, k = Math.min(59, f | 0), fr = f - k, A = T.path[k], B = T.path[k + 1];
              const a = A[0] + (B[0] - A[0]) * fr, b = A[1] + (B[1] - A[1]) * fr, sc = R() < 0.15 ? 0.14 : 0.025;
              p = [Math.cos(T.ang) * a + gs() * sc, Y0 + 0.5 + b + gs() * sc, Math.sin(T.ang) * a + gs() * sc];
              metaT[i] = u; sz = 0.9 + R() * 1.0; ap = 2.0 + u * 1.3;
            } else if (q < 0.8) {
              metaSub[i] = 3;
              p = [gs() * 0.45, Y0 + 0.45 + gs() * 0.35, gs() * 0.45];
              metaT[i] = R(); sz = 1.0 + R() * 1.1; ap = 1.3 + R() * 0.8;
            } else {
              const aa = ((R() * 6) | 0) * 1.0472 + 0.2, head = R() < 0.3, u = head ? 1 : R(), j = head ? 0.1 : 0.03;
              metaSub[i] = head ? 4 : 5; metaT[i] = u;
              p = [Math.cos(aa) * (0.15 + 1.3 * u) + gs() * j, Y0 + 0.3 + 0.2 + 1.0 * u - 0.35 * u * u + gs() * j, Math.sin(aa) * (0.15 + 1.3 * u) + gs() * j];
              sz = head ? 1.6 : 0.8; ap = 1.6 + R() * 0.6;
            }
            setP(i, p, p); size0[i] = sz; appear[i] = ap; alphaA[i] = 0.9;
          } else {
            type[i] = 2;
            let r = R(), li = 0;
            while (li < LAYERS.length - 1 && r > LAYERS[li].share) { r -= LAYERS[li].share; li++; }
            const L = LAYERS[li];
            const ang = (Math.floor(R() * L.n) / L.n) * TAU + L.yaw + gs() * 0.02;
            let t; do { t = R(); } while (R() > Math.pow(Math.sin(Math.PI * Math.pow(t, 0.85)), 0.7));
            const kind = R();
            let s = R() * 2 - 1, edge = 0;
            if (kind < 0.2) { s = (R() < 0.5 ? -1 : 1) * (0.94 + 0.06 * R()); edge = 1; }
            else if (kind < 0.28) { s = gs() * 0.04; edge = 0.5; }
            const jit = [gs() * 0.04, gs() * 0.04, gs() * 0.04];
            const o = petalPos(L, ang, t, s, 1), c = petalPos(L, ang, t, s, 0);
            setP(i, [o[0] + jit[0], o[1] + jit[1], o[2] + jit[2]], [c[0] + jit[0], c[1] + jit[1], c[2] + jit[2]]);
            const sp = (li < 2 && t < 0.55 && R() < 0.1) ? 1 : 0;
            const br = (0.75 + 0.35 * R()) * (1 + 0.45 * edge + 0.25 * Math.abs(s));
            metaSub[i] = sp ? 7 : 6; metaLayer[i] = li; metaT[i] = t; metaBr[i] = br;
            size0[i] = (0.6 + R() * 0.6) * (1 + 0.3 * edge + 0.8 * sp);
            appear[i] = 1.1 + li * 0.12 + t * 0.3;
            alphaA[i] = 0.5 + 0.3 * sp;
          }
          if (type[i] === 0) cur.set([open[i * 3], open[i * 3 + 1], open[i * 3 + 2]], i * 3);
          else cur.set([0, Y0, 0], i * 3);
        }

        const flowerMat = makeMat(1.0, 0.025);
        const flower = makePoints(cur, size, colA, alphaA, seedA, flowerMat, true);
        scene.add(flower);

        const SEED_POS = new THREE.Vector3(0, 0.16, 0);
        const seedMat = makeMat(1, 0.02);
        const seedN = 200, seedCol = new Float32Array(seedN * 3), seedHalo = new Uint8Array(seedN), seedMix = new Float32Array(seedN);
        let seedPoints;
        {
          const pos = new Float32Array(seedN * 3), sz = new Float32Array(seedN), al = new Float32Array(seedN), sd = new Float32Array(seedN);
          for (let i = 0; i < seedN; i++) {
            const halo = i >= 160;
            seedHalo[i] = halo ? 1 : 0; seedMix[i] = R();
            const rad = halo ? 0.25 + R() * 0.5 : 0.05 + R() * 0.12;
            const v = new THREE.Vector3(gs(), gs(), gs()).normalize().multiplyScalar(rad);
            pos.set([v.x, SEED_POS.y + v.y * 0.8, v.z], i * 3);
            sz[i] = halo ? 2.6 : 1.3 + R() * 0.9; al[i] = halo ? 0.18 : 0.95; sd[i] = R();
          }
          seedPoints = makePoints(pos, sz, seedCol, al, sd, seedMat, true);
          scene.add(seedPoints);
        }

        const dustMat = makeMat(0.6, 0.12);
        const dustN = 1800, dustCol = new Float32Array(dustN * 3), dustMix = new Float32Array(dustN);
        let dustPoints;
        {
          const pos = new Float32Array(dustN * 3), sz = new Float32Array(dustN), al = new Float32Array(dustN), sd = new Float32Array(dustN);
          for (let i = 0; i < dustN; i++) {
            const r = Math.pow(R(), 0.7) * 12, a = R() * TAU;
            dustMix[i] = R();
            pos.set([Math.cos(a) * r, R() < 0.8 ? R() * 0.35 : R() * 3.5, Math.sin(a) * r], i * 3);
            sz[i] = 0.4 + R() * 0.7; al[i] = 0.18 + R() * 0.25; sd[i] = R();
          }
          dustPoints = makePoints(pos, sz, dustCol, al, sd, dustMat, true);
          scene.add(dustPoints);
        }

        const ringGroup = new THREE.Group();
        ringGroup.position.set(0, 3.4, 0);
        ringGroup.rotation.set(0.3, 0, -0.25);
        const ringMat = makeMat(0, 0.08);
        const ringN = 3000, ringCol = new Float32Array(ringN * 3), ringAng = new Float32Array(ringN);
        let ringPoints;
        {
          const pos = new Float32Array(ringN * 3), sz = new Float32Array(ringN), al = new Float32Array(ringN), sd = new Float32Array(ringN);
          for (let i = 0; i < ringN; i++) {
            const a = R() * TAU, r = 7 + gs() * 0.8 + 0.3 * Math.sin(a * 5);
            ringAng[i] = a;
            pos.set([Math.cos(a) * r, gs() * 0.3, Math.sin(a) * r], i * 3);
            sz[i] = R() < 0.02 ? 2.6 : 0.5 + R() * 1.0; al[i] = 0.5 + R() * 0.4; sd[i] = R();
          }
          ringPoints = makePoints(pos, sz, ringCol, al, sd, ringMat, true);
          ringGroup.add(ringPoints);
          scene.add(ringGroup);
        }

        function applyPalette(priHex, secHex) {
          const TH = buildPalette(priHex, secHex);
          const priRgb = hexToRgb01(priHex), secRgb = hexToRgb01(secHex);
          for (let i = 0; i < N; i++) {
            const sub = metaSub[i], t = metaT[i];
            let c;
            if (sub === 0) c = mix(TH.stem.map(v => v * 0.6), TH.stem, t);
            else if (sub === 1) c = TH.stem.map(v => v * (0.55 + 0.3 * t) * (1 + 0.5 * metaEdge[i]));
            else if (sub === 2) c = mix(TH.tend, [1, 1, 1], t * 0.6);
            else if (sub === 3) c = mix(TH.throat, [1, 1, 1], t * 0.7);
            else if (sub === 4) c = TH.tend;
            else if (sub === 5) c = mix(TH.base, TH.tend, t);
            else {
              const li = metaLayer[i], br = metaBr[i];
              const baseCol = sub === 7 ? TH.tend : (li === 2 ? mix(TH.throat, TH.base, t) : mix(mix(TH.base, TH.mid, sstep(0, 0.4, t)), TH.tip, sstep(0.4, 1, t) * (li === 0 ? 1 : 0.65)));
              c = baseCol.map(v => v * br);
            }
            colA.set(c, i * 3);
          }
          flower.geometry.attributes.aColor.needsUpdate = true;

          for (let i = 0; i < seedN; i++) seedCol.set(seedHalo[i] ? priRgb : mix([1, 0.95, 1], priRgb, seedMix[i]), i * 3);
          seedPoints.geometry.attributes.aColor.needsUpdate = true;

          for (let i = 0; i < dustN; i++) dustCol.set(mix(priRgb, secRgb, dustMix[i]), i * 3);
          dustPoints.geometry.attributes.aColor.needsUpdate = true;

          for (let i = 0; i < ringN; i++) ringCol.set(mix(priRgb, secRgb, 0.5 + 0.5 * Math.sin(ringAng[i] * 2)), i * 3);
          ringPoints.geometry.attributes.aColor.needsUpdate = true;
        }

        applyPalette(primaryColor, secondaryColor);
        recolorRef.current = applyPalette;

        const ndc = { x: 0, y: 0 };
        let pointerActive = false, started = autoBloom, t0 = autoBloom ? -5.0 : 0, msgShown = autoBloom;

        function setPointer(e) {
          const rect = renderer.domElement.getBoundingClientRect();
          const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
          ndc.x = (cx / W) * 2 - 1;
          ndc.y = -(cy / H) * 2 + 1;
        }

        function nearSeed(e) {
          const rect = renderer.domElement.getBoundingClientRect();
          const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
          const v = SEED_POS.clone().project(camera);
          const sx = (v.x * 0.5 + 0.5) * W, sy = (-v.y * 0.5 + 0.5) * H;
          const radius = e.pointerType === "touch" ? Math.max(120, 0.14 * Math.min(W, H)) : Math.max(75, 0.08 * Math.min(W, H));
          return Math.hypot(cx - sx, cy - sy) < radius;
        }

        const cv = renderer.domElement;
        cv.style.touchAction = "none";
        cv.style.display = "block";

        const onPointerMove = e => {
          setPointer(e); pointerActive = true;
          cv.style.cursor = (!started && nearSeed(e)) ? "pointer" : "default";
        };
        const onPointerDown = e => {
          setPointer(e); pointerActive = true;
          if (!started && nearSeed(e)) {
            started = true; t0 = timeU.value; setSeedTapped(true); cv.style.cursor = "default";
            if (callbacksRef.current.onSeedTap) callbacksRef.current.onSeedTap();
          }
        };
        const onPointerUp = e => { if (e.pointerType !== "mouse") pointerActive = false; };
        const onPointerLeave = () => { pointerActive = false; };

        cv.addEventListener("pointermove", onPointerMove);
        cv.addEventListener("pointerdown", onPointerDown);
        cv.addEventListener("pointerup", onPointerUp);
        cv.addEventListener("pointercancel", onPointerUp);
        cv.addEventListener("pointerleave", onPointerLeave);

        function resize() {
          W = stage.clientWidth || window.innerWidth;
          H = stage.clientHeight || window.innerHeight;
          renderer.setSize(W, H);
          const aspect = W / H;
          camera.aspect = aspect;
          camZ = Math.max(14.5, 9.5 / (0.93 * aspect));
          camera.updateProjectionMatrix();
          scaleU.value = clamp(H / 900, 0.6, 1.3) * camZ / 14.5;
        }
        window.addEventListener("resize", resize);
        resize();

        const ro = new THREE.Vector3(), rd = new THREE.Vector3();
        let last = performance.now(), rafId = 0;
        const MR = 2.0, MR2 = MR * MR, PUSH = 55;

        function frame(now) {
          rafId = requestAnimationFrame(frame);
          const dt = Math.min((now - last) / 1000, 0.033); last = now;
          const time = timeU.value + dt; timeU.value = time;

          camera.position.set(Math.sin(time * 0.12) * 1.6, 4.0, camZ);
          camera.lookAt(0, 2.7, 0);
          camera.updateMatrixWorld();

          const e = started ? time - t0 : -1;
          ringGroup.children[0].rotation.y += dt * 0.22;
          seedMat.uniforms.uFade.value = started ? Math.max(0, 1 - e / 1.2) : 0.75 + 0.25 * Math.sin(time * 2.5);
          ringMat.uniforms.uFade.value = ease(clamp((e - 1.6) / 2.2, 0, 1));
          dustMat.uniforms.uFade.value = 0.6 + 0.4 * ease(clamp((e - 1.5) / 2, 0, 1));

          if (started) {
            const b = ease(clamp((e - 1.9) / 1.8, 0, 1));
            const br = 1 + 0.02 * Math.sin(time * 1.3) * b;
            const k = 3 + 7 * (1 - ease(clamp((e - 3.5) / 1.0, 0, 1)));
            const damp = Math.exp(-2.4 * dt);

            if (pointerActive) {
              ro.copy(camera.position);
              rd.set(ndc.x, ndc.y, 0.5).unproject(camera).sub(ro).normalize();
            }

            for (let i = 0; i < N; i++) {
              const i3 = i * 3;
              const g = ease(clamp((e - appear[i]) / 0.7, 0, 1));
              let bx, by, bz;
              if (type[i] === 0) {
                bx = open[i3]; by = open[i3 + 1]; bz = open[i3 + 2];
              } else {
                const mx = (closed[i3] + (open[i3] - closed[i3]) * b) * br;
                const my = closed[i3 + 1] + (open[i3 + 1] - closed[i3 + 1]) * b;
                const mz = (closed[i3 + 2] + (open[i3 + 2] - closed[i3 + 2]) * b) * br;
                const h = (my - Y0) * 0.05 * b, ph = time * 1.2 + (my - Y0) * 0.8 + open[i3] * 0.6;
                bx = mx * g + h * Math.sin(ph) * g;
                by = Y0 + (my - Y0) * g;
                bz = mz * g + h * Math.cos(ph * 0.9) * g;
              }
              size[i] = size0[i] * g;
              const cx = cur[i3], cy = cur[i3 + 1], cz = cur[i3 + 2];
              let vx = vel[i3], vy = vel[i3 + 1], vz = vel[i3 + 2];
              if (pointerActive && g > 0.05) {
                const dx = cx - ro.x, dy = cy - ro.y, dz = cz - ro.z;
                const tt = dx * rd.x + dy * rd.y + dz * rd.z;
                const px = dx - rd.x * tt, py = dy - rd.y * tt, pz = dz - rd.z * tt;
                const d2 = px * px + py * py + pz * pz;
                if (d2 < MR2) {
                  const d = Math.sqrt(d2) + 1e-4, f = 1 - d / MR, a = f * f * PUSH * dt / d;
                  vx += px * a; vy += py * a; vz += pz * a;
                }
              }
              vx = (vx + (bx - cx) * k * dt) * damp;
              vy = (vy + (by - cy) * k * dt) * damp;
              vz = (vz + (bz - cz) * k * dt) * damp;
              cur[i3] = cx + vx * dt; cur[i3 + 1] = cy + vy * dt; cur[i3 + 2] = cz + vz * dt;
              vel[i3] = vx; vel[i3 + 1] = vy; vel[i3 + 2] = vz;
            }
            flower.geometry.attributes.position.needsUpdate = true;
            flower.geometry.attributes.aSize.needsUpdate = true;

            if (!msgShown && e > 3.9) {
              msgShown = true;
              if (callbacksRef.current.onBloomComplete) callbacksRef.current.onBloomComplete();
            }
          }
          renderer.render(scene, camera);
        }

        rafId = requestAnimationFrame(frame);
        return () => {
          cancelAnimationFrame(rafId);
          window.removeEventListener("resize", resize);
          renderer.dispose();
        };
      }, [autoBloom]);

      useEffect(() => {
        if (recolorRef.current) recolorRef.current(primaryColor, secondaryColor);
      }, [primaryColor, secondaryColor]);

      return html\`
        <div className="relative w-full h-full select-none">
          <div ref=\${stageRef} className="fixed inset-0 w-full h-full" />
          \${!autoBloom && !seedTapped && html\`
            <div
              className="fixed left-0 right-0 bottom-0 text-center pointer-events-none font-serif font-light tracking-[0.14em] text-purple-100 hint-pulse px-6"
              style=\${{
                paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 7vh)",
                textShadow: "0 0 18px rgba(150,120,255,0.8), 0 0 40px rgba(90,120,255,0.5)"
              }}
            >
              Tap the glowing seed
            </div>
          \`}
        </div>
      \`;
    }

    /* ============================================================================
     * Pages: Landing (/), Creator (/create), Receiver (/gift/:id)
     * ============================================================================ */
    const PRESET_PALETTES = [
      { name: "Celestial Violet", primary: "#9d5cff", secondary: "#38bdf8" },
      { name: "Rapunzel Gold", primary: "#f59e0b", secondary: "#ec4899" },
      { name: "Midnight Rose", primary: "#f43f5e", secondary: "#c084fc" },
      { name: "Aurora Emerald", primary: "#10b981", secondary: "#38bdf8" },
      { name: "Sakura Moon", primary: "#f472b6", secondary: "#fbbf24" },
    ];

    function LandingPage({ navigate }) {
      return html\`
        <main className="relative min-h-screen w-full overflow-hidden flex flex-col justify-between">
          <div className="fixed inset-0 z-0 opacity-80">
            <\${ParticleFlowerCanvas} primaryColor="#9d5cff" secondaryColor="#38bdf8" autoBloom=\${true} />
          </div>
          <div className="fixed inset-0 z-10 pointer-events-none bg-gradient-to-b from-black/60 via-transparent to-black/85" />

          <header className="relative z-20 flex items-center justify-between px-6 sm:px-12 py-6 max-w-6xl mx-auto w-full">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-300 shadow-[0_0_20px_rgba(168,85,247,0.4)]">
                ✦
              </span>
              <span className="text-xl tracking-[0.22em] uppercase font-light text-purple-100">Auravine</span>
            </div>
            <button
              onClick=\${() => navigate("/create")}
              className="text-xs sm:text-sm tracking-[0.18em] uppercase px-4 py-2 rounded-full border border-purple-300/25 bg-white/5 hover:bg-white/10 backdrop-blur-md transition cursor-pointer"
            >
              Create Yours
            </button>
          </header>

          <section className="relative z-20 flex flex-col items-center text-center px-6 pb-16 pt-24 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-950/50 border border-purple-400/25 text-purple-200/90 text-xs tracking-[0.18em] uppercase mb-6 backdrop-blur-md">
              <span className="text-pink-400">♥</span>
              <span>A Digital Bloom That Never Wilts</span>
            </div>

            <h1 className="text-4xl sm:text-6xl font-light tracking-wide leading-tight text-white glow-text mb-6">
              Plant a quiet seed for <span className="italic text-purple-200">someone special</span>.
            </h1>

            <p className="text-base sm:text-lg text-purple-100/75 max-w-xl font-sans font-light leading-relaxed mb-10">
              Craft a living constellation of 23,800 glowing particles in their favorite colors,
              hide a secret message inside the bloom, and send a private link they can awaken with a single touch.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              <button
                onClick=\${() => navigate("/create")}
                className="group relative inline-flex items-center gap-3 px-8 py-4 rounded-full bg-gradient-to-r from-purple-600 via-fuchsia-600 to-indigo-600 text-white font-sans text-sm sm:text-base font-medium tracking-wider uppercase shadow-[0_0_35px_rgba(168,85,247,0.55)] hover:shadow-[0_0_55px_rgba(168,85,247,0.85)] hover:scale-[1.02] active:scale-[0.99] transition-all cursor-pointer"
              >
                <span>Create a Flower</span>
                <span>→</span>
              </button>
              <button
                onClick=\${() => navigate("/gift/demo-bloom")}
                className="px-6 py-4 rounded-full border border-purple-300/30 bg-white/5 hover:bg-white/10 text-purple-100 font-sans text-xs sm:text-sm tracking-widest uppercase backdrop-blur-md transition cursor-pointer"
              >
                Preview Demo Gift
              </button>
            </div>

            <p className="mt-6 text-xs text-purple-300/50 font-sans tracking-widest uppercase">
              Touch or move your cursor across the petals above to interact
            </p>
          </section>
        </main>
      \`;
    }

    function CreatePage({ navigate }) {
      const [recipientName, setRecipientName] = useState("");
      const [secretMessage, setSecretMessage] = useState("");
      const [primaryColor, setPrimaryColor] = useState("#9d5cff");
      const [secondaryColor, setSecondaryColor] = useState("#38bdf8");
      const [isSubmitting, setIsSubmitting] = useState(false);
      const [errorMsg, setErrorMsg] = useState(null);
      const [generatedSlug, setGeneratedSlug] = useState(null);
      const [copied, setCopied] = useState(false);

      const generatedUrl = generatedSlug ? \`\${window.location.origin}/gift/\${generatedSlug}\` : null;

      async function handleGenerateLink(e) {
        e.preventDefault();
        setErrorMsg(null);
        if (!recipientName.trim()) return setErrorMsg("Please enter the recipient's name.");
        if (!secretMessage.trim()) return setErrorMsg("Please write a secret message for the bloom.");

        setIsSubmitting(true);
        try {
          const res = await fetch("/api/flowers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              recipient_name: recipientName.trim(),
              secret_message: secretMessage.trim().slice(0, 150),
              primary_color: primaryColor,
              secondary_color: secondaryColor,
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Failed to save flower");
          setGeneratedSlug(data.slug);
        } catch (err) {
          setErrorMsg(err.message || "Something went wrong.");
        } finally {
          setIsSubmitting(false);
        }
      }

      async function handleCopy() {
        if (!generatedUrl) return;
        await navigator.clipboard.writeText(generatedUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }

      return html\`
        <div className="relative min-h-screen w-full overflow-x-hidden flex flex-col lg:flex-row">
          <div className="relative w-full lg:w-7/12 h-[44vh] sm:h-[50vh] lg:h-screen lg:fixed lg:right-0 lg:top-0 z-0">
            <\${ParticleFlowerCanvas} primaryColor=\${primaryColor} secondaryColor=\${secondaryColor} autoBloom=\${true} />
            <div className="absolute top-4 right-4 z-10 pointer-events-none px-3.5 py-1.5 rounded-full bg-black/50 border border-white/10 backdrop-blur-md text-[11px] font-sans tracking-widest uppercase text-purple-200/80">
              Live Interactive Preview
            </div>
          </div>

          <div className="relative z-10 w-full lg:w-5/12 min-h-screen flex flex-col justify-between p-6 sm:p-10 lg:p-12 bg-gradient-to-b from-[#080514]/90 via-[#060410]/95 to-black/95 backdrop-blur-xl border-r border-white/10">
            <div>
              <div className="flex items-center justify-between mb-8">
                <button
                  onClick=\${() => navigate("/")}
                  className="inline-flex items-center gap-2 text-xs font-sans tracking-widest uppercase text-purple-300/80 hover:text-white transition cursor-pointer"
                >
                  <span>← Back</span>
                </button>
                <div className="flex items-center gap-2 text-purple-200">
                  <span className="text-purple-400">✦</span>
                  <span className="text-sm tracking-[0.2em] uppercase">Auravine Studio</span>
                </div>
              </div>

              <h1 className="text-2xl sm:text-3xl font-light text-white glow-text mb-2">Customize Your Bloom</h1>
              <p className="text-sm text-purple-200/70 font-sans mb-8">
                Design a one-of-a-kind particle flower. When they open your link, it will wait as a glowing seed until they touch it.
              </p>

              <form onSubmit=\${handleGenerateLink} className="space-y-6 font-sans">
                <div>
                  <label className="block text-xs uppercase tracking-widest text-purple-200/80 mb-2">
                    Recipient's Name
                  </label>
                  <input
                    type="text"
                    maxLength="80"
                    required
                    value=\${recipientName}
                    onChange=\${e => setRecipientName(e.target.value)}
                    placeholder="e.g., Elena"
                    className="w-full rounded-xl bg-white/5 border border-purple-300/20 px-4 py-3 text-white placeholder-purple-300/30 focus:outline-none focus:border-purple-400 transition"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs uppercase tracking-widest text-purple-200/80">
                      Secret Message
                    </label>
                    <span className=\${\`text-xs \${secretMessage.length >= 140 ? "text-amber-300" : "text-purple-300/50"}\`}>
                      \${secretMessage.length} / 150
                    </span>
                  </div>
                  <textarea
                    rows="3"
                    maxLength="150"
                    required
                    value=\${secretMessage}
                    onChange=\${e => setSecretMessage(e.target.value)}
                    placeholder="Every great bloom begins as a small, quiet seed..."
                    className="w-full rounded-xl bg-white/5 border border-purple-300/20 px-4 py-3 text-white placeholder-purple-300/30 focus:outline-none focus:border-purple-400 transition resize-none"
                  />
                </div>

                <div>
                  <div className="text-xs uppercase tracking-widest text-purple-200/80 mb-3">Petal Colors</div>
                  <div className="flex flex-wrap gap-2 mb-4">
                    \${PRESET_PALETTES.map(preset => {
                      const active = primaryColor.toLowerCase() === preset.primary.toLowerCase() && secondaryColor.toLowerCase() === preset.secondary.toLowerCase();
                      return html\`
                        <button
                          key=\${preset.name}
                          type="button"
                          onClick=\${() => { setPrimaryColor(preset.primary); setSecondaryColor(preset.secondary); }}
                          className=\${\`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs border transition cursor-pointer \${active ? "border-purple-400 bg-purple-500/20 text-white" : "border-white/10 bg-white/5 text-purple-200/70 hover:bg-white/10"}\`}
                        >
                          <span className="w-3 h-3 rounded-full" style=\${{ background: \`linear-gradient(135deg, \${preset.primary}, \${preset.secondary})\` }} />
                          <span>\${preset.name}</span>
                        </button>
                      \`;
                    })}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <label className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-purple-300/20 cursor-pointer hover:border-purple-300/40 transition">
                      <input
                        type="color"
                        value=\${primaryColor}
                        onChange=\${e => setPrimaryColor(e.target.value)}
                        className="w-9 h-9 rounded-lg bg-transparent border-0 cursor-pointer"
                      />
                      <div>
                        <div className="text-xs text-purple-200/90 font-medium">Primary Color</div>
                        <div className="text-[11px] text-purple-300/50 uppercase font-mono">\${primaryColor}</div>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-purple-300/20 cursor-pointer hover:border-purple-300/40 transition">
                      <input
                        type="color"
                        value=\${secondaryColor}
                        onChange=\${e => setSecondaryColor(e.target.value)}
                        className="w-9 h-9 rounded-lg bg-transparent border-0 cursor-pointer"
                      />
                      <div>
                        <div className="text-xs text-purple-200/90 font-medium">Secondary Color</div>
                        <div className="text-[11px] text-purple-300/50 uppercase font-mono">\${secondaryColor}</div>
                      </div>
                    </label>
                  </div>
                </div>

                \${errorMsg && html\`
                  <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-400/30 text-rose-200 text-xs">\${errorMsg}</div>
                \`}

                <button
                  type="submit"
                  disabled=\${isSubmitting}
                  className="w-full inline-flex items-center justify-center gap-2.5 py-4 px-6 rounded-xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-indigo-600 text-white font-medium text-sm tracking-wider uppercase shadow-[0_0_30px_rgba(168,85,247,0.45)] hover:shadow-[0_0_45px_rgba(168,85,247,0.75)] disabled:opacity-50 transition-all cursor-pointer"
                >
                  <span>\${isSubmitting ? "Planting Seed..." : "Generate Link"}</span>
                </button>
              </form>

              \${generatedUrl && html\`
                <div className="mt-6 p-5 rounded-2xl bg-purple-950/40 border border-purple-400/30 backdrop-blur-md space-y-3 font-sans">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-widest text-purple-300">Your Gift Link is Ready</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value=\${generatedUrl}
                      className="w-full text-xs font-mono bg-black/50 border border-white/15 rounded-lg px-3 py-2.5 text-purple-100 select-all focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick=\${handleCopy}
                      className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium transition cursor-pointer"
                    >
                      \${copied ? "Copied ✓" : "Copy"}
                    </button>
                  </div>
                  <div className="pt-1 flex justify-end">
                    <button
                      type="button"
                      onClick=\${() => navigate(\`/gift/\${generatedSlug}\`)}
                      className="inline-flex items-center gap-1.5 text-xs text-purple-300 hover:text-white transition cursor-pointer"
                    >
                      <span>Open Receiver Experience →</span>
                    </button>
                  </div>
                </div>
              \`}
            </div>

            <footer className="pt-8 text-[11px] text-purple-300/40 font-sans">
              Tip: Drag your finger or cursor across the flower preview to ripple its petals.
            </footer>
          </div>
        </div>
      \`;
    }

    function GiftReceiverPage({ slug, navigate }) {
      const [gift, setGift] = useState(null);
      const [loading, setLoading] = useState(true);
      const [seedTapped, setSeedTapped] = useState(false);
      const [bloomCompleted, setBloomCompleted] = useState(false);

      useEffect(() => {
        setLoading(true);
        fetch(\`/api/flowers/\${encodeURIComponent(slug)}\`)
          .then(r => r.ok ? r.json() : null)
          .then(data => { setGift(data); setLoading(false); })
          .catch(() => setLoading(false));
      }, [slug]);

      if (loading) {
        return html\`
          <main className="min-h-screen w-full flex flex-col items-center justify-center px-6 text-center">
            <div className="h-8 w-8 rounded-full border-2 border-purple-400 border-t-transparent animate-spin mb-4" />
            <p className="text-sm tracking-[0.2em] uppercase text-purple-200/70">Awakening your seed...</p>
          </main>
        \`;
      }

      if (!gift) {
        return html\`
          <main className="min-h-screen w-full flex flex-col items-center justify-center px-6 text-center">
            <h1 className="text-2xl sm:text-3xl font-light text-white glow-text mb-3">This seed could not be found</h1>
            <p className="text-sm text-purple-200/70 font-sans max-w-md mb-8">
              The gift link may be invalid or expired.
            </p>
            <button
              onClick=\${() => navigate("/create")}
              className="px-6 py-3 rounded-full bg-purple-600/80 hover:bg-purple-600 text-white font-sans text-xs tracking-widest uppercase transition cursor-pointer"
            >
              Create a New Flower
            </button>
          </main>
        \`;
      }

      return html\`
        <main className="relative w-full h-screen overflow-hidden select-none">
          <div
            className=\${\`fixed top-0 left-0 right-0 z-20 text-center px-6 pt-8 sm:pt-12 pointer-events-none transition-opacity duration-[2000ms] \${seedTapped ? "opacity-60" : "opacity-100"}\`}
            style=\${{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 2.25rem)" }}
          >
            <p className="max-w-xl mx-auto text-base sm:text-xl md:text-2xl font-light tracking-[0.08em] text-purple-100 glow-text leading-relaxed">
              Hey <span className="italic text-white">\${gift.recipient_name}</span>, someone special wanted to give you this...
            </p>
          </div>

          <\${ParticleFlowerCanvas}
            primaryColor=\${gift.primary_color}
            secondaryColor=\${gift.secondary_color}
            autoBloom=\${false}
            onSeedTap=\${() => setSeedTapped(true)}
            onBloomComplete=\${() => setBloomCompleted(true)}
          />

          <div
            className=\${\`fixed left-0 right-0 bottom-0 z-20 text-center px-6 pointer-events-none transition-opacity duration-[3000ms] ease-out \${bloomCompleted ? "opacity-100" : "opacity-0"}\`}
            style=\${{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 7vh)" }}
          >
            <p
              className="max-w-2xl mx-auto font-light tracking-[0.14em] text-white leading-relaxed"
              style=\${{
                fontSize: "clamp(1.05rem, 2.6vw, 1.7rem)",
                textShadow: \`0 0 18px \${gift.primary_color}, 0 0 40px \${gift.secondary_color}\`
              }}
            >
              "\${gift.secret_message}"
            </p>

            <div className=\${\`mt-6 transition-opacity duration-1000 delay-1000 \${bloomCompleted ? "opacity-70 pointer-events-auto" : "opacity-0 pointer-events-none"}\`}>
              <button
                onClick=\${() => navigate("/create")}
                className="inline-flex items-center gap-1.5 text-[11px] font-sans tracking-[0.2em] uppercase text-purple-200/70 hover:text-white transition cursor-pointer"
              >
                <span>✦ Send a flower back with Auravine</span>
              </button>
            </div>
          </div>
        </main>
      \`;
    }

    function App() {
      const [pathname, setPathname] = useState(window.location.pathname);

      useEffect(() => {
        const onPop = () => setPathname(window.location.pathname);
        window.addEventListener("popstate", onPop);
        return () => window.removeEventListener("popstate", onPop);
      }, []);

      function navigate(to) {
        window.history.pushState({}, "", to);
        setPathname(to);
      }

      if (pathname === "/create") {
        return html\`<\${CreatePage} navigate=\${navigate} />\`;
      }
      if (pathname.startsWith("/gift/")) {
        const slug = decodeURIComponent(pathname.slice("/gift/".length));
        return html\`<\${GiftReceiverPage} slug=\${slug} navigate=\${navigate} />\`;
      }
      return html\`<\${LandingPage} navigate=\${navigate} />\`;
    }

    createRoot(document.getElementById("app")).render(html\`<\${App} />\`);
  </script>
</body>
</html>`;

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  // POST /api/flowers
  if (req.method === "POST" && url.pathname === "/api/flowers") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        const data = JSON.parse(body || "{}");
        const recipient_name = String(data.recipient_name || "").trim();
        const secret_message = String(data.secret_message || "").trim().slice(0, 150);
        const primary_color = String(data.primary_color || "#9d5cff");
        const secondary_color = String(data.secondary_color || "#38bdf8");

        if (!recipient_name) {
          res.writeHead(400, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ error: "Recipient name is required." }));
        }
        if (!secret_message) {
          res.writeHead(400, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ error: "Secret message is required." }));
        }

        const slug = generateSlug();
        const record = {
          slug,
          recipient_name,
          secret_message,
          primary_color,
          secondary_color,
          created_at: new Date().toISOString(),
        };

        const store = readStore();
        store[slug] = record;
        writeStore(store);

        res.writeHead(201, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ slug, gift: record }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid request payload." }));
      }
    });
    return;
  }

  // GET /api/flowers/:slug
  if (req.method === "GET" && url.pathname.startsWith("/api/flowers/")) {
    const slug = decodeURIComponent(url.pathname.slice("/api/flowers/".length));
    const store = readStore();
    const gift = store[slug];
    if (!gift) {
      res.writeHead(404, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Flower gift not found." }));
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(gift));
  }

  // Serve SPA for /, /create, /gift/*
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(APP_HTML);
});

server.listen(PORT, () => {
  console.log(`✨ Auravine server running at http://localhost:${PORT}`);
});
