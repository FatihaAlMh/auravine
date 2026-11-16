"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { FlowerStyle } from "@/lib/supabase";

export interface ParticleFlowerCanvasProps {
  primaryColor: string;
  secondaryColor: string;
  flowerStyle?: FlowerStyle;
  /** If true, starts already bloomed (used in Creator preview & Landing backdrop) */
  autoBloom?: boolean;
  /** Callback fired when the seed is tapped by the recipient */
  onSeedTap?: () => void;
  /** Callback fired when the flower finishes its growth animation (~3.9s after tap) */
  onBloomComplete?: () => void;
  className?: string;
}

type RGB = [number, number, number];

function hexToRgb01(hex: string): RGB {
  const clean = hex.replace("#", "").trim();
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean.padEnd(6, "0");
  const num = parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(num)) return [0.65, 0.35, 1.0];
  return [
    ((num >> 16) & 255) / 255,
    ((num >> 8) & 255) / 255,
    (num & 255) / 255,
  ];
}

const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const ease = (x: number) => x * x * (3 - 2 * x);
const sstep = (a: number, b: number, x: number) =>
  ease(clamp((x - a) / (b - a), 0, 1));

interface PaletteTheme {
  base: RGB;
  mid: RGB;
  tip: RGB;
  throat: RGB;
  tend: RGB;
  stem: RGB;
}

function buildPalette(primaryHex: string, secondaryHex: string): PaletteTheme {
  const pri = hexToRgb01(primaryHex);
  const sec = hexToRgb01(secondaryHex);
  const white: RGB = [1.0, 0.96, 1.0];
  const gold: RGB = [1.0, 0.88, 0.55];
  return {
    base: mix(pri, white, 0.72),
    mid: pri,
    tip: sec,
    throat: mix(pri, sec, 0.35),
    tend: mix(gold, sec, 0.25),
    stem: mix([0.18, 0.72, 0.55], sec, 0.45),
  };
}

const VS = `
attribute float aSize, aAlpha, aSeed;
attribute vec3 aColor;
uniform float uTime, uPR, uScale, uWobble, uFade;
varying vec3 vC;
varying float vA;
void main(){
  vec3 p = position;
  p += uWobble * vec3(
    sin(uTime * 1.3 + aSeed * 20.0),
    cos(uTime * 1.1 + aSeed * 31.0),
    sin(uTime * 0.9 + aSeed * 11.0)
  );
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = min(aSize * 40.0 * uScale * uPR / -mv.z, 24.0 * uPR);
  vA = aAlpha * uFade * (0.75 + 0.25 * sin(uTime * 2.0 + aSeed * 50.0));
  vC = aColor;
}`;

const FS = `
varying vec3 vC;
varying float vA;
void main(){
  float d = length(gl_PointCoord - 0.5);
  if(d > 0.5) discard;
  float a = pow(1.0 - d * 2.0, 2.2);
  float core = smoothstep(0.22, 0.0, d);
  gl_FragColor = vec4(vC + core * 0.45, a * vA);
}`;

interface LayerSpec {
  n: number;
  yaw: number;
  len: number;
  p0: number;
  p1: number;
  curl: number;
  w: number;
  ruf: number;
  share: number;
}

const STYLE_LAYERS: Record<FlowerStyle, LayerSpec[]> = {
  lily: [
    { n: 3, yaw: 0, len: 4.4, p0: 0.45, p1: 1.55, curl: 1.0, w: 1.35, ruf: 1.0, share: 0.38 },
    { n: 3, yaw: 1.0472, len: 4.0, p0: 0.35, p1: 1.25, curl: 0.9, w: 1.4, ruf: 1.0, share: 0.38 },
    { n: 6, yaw: 0.3, len: 1.8, p0: 0.1, p1: 0.55, curl: 0.5, w: 0.5, ruf: 0.3, share: 0.24 },
  ],
  rose: [
    { n: 7, yaw: 0.2, len: 3.6, p0: 0.35, p1: 1.35, curl: 1.3, w: 1.45, ruf: 0.6, share: 0.38 },
    { n: 6, yaw: 0.6, len: 2.9, p0: 0.22, p1: 0.95, curl: 1.1, w: 1.25, ruf: 0.5, share: 0.34 },
    { n: 5, yaw: 0.1, len: 2.1, p0: 0.08, p1: 0.45, curl: 0.85, w: 0.95, ruf: 0.3, share: 0.28 },
  ],
  lotus: [
    { n: 10, yaw: 0, len: 3.9, p0: 0.65, p1: 1.6, curl: 0.35, w: 1.05, ruf: 0.2, share: 0.38 },
    { n: 8, yaw: 0.39, len: 3.3, p0: 0.4, p1: 1.1, curl: 0.25, w: 0.95, ruf: 0.15, share: 0.35 },
    { n: 6, yaw: 0.2, len: 2.3, p0: 0.18, p1: 0.65, curl: 0.15, w: 0.72, ruf: 0.1, share: 0.27 },
  ],
  bouquet: [
    { n: 3, yaw: 0, len: 4.0, p0: 0.45, p1: 1.5, curl: 0.95, w: 1.25, ruf: 0.9, share: 0.38 },
    { n: 3, yaw: 1.0472, len: 3.6, p0: 0.35, p1: 1.2, curl: 0.85, w: 1.28, ruf: 0.9, share: 0.38 },
    { n: 6, yaw: 0.3, len: 1.6, p0: 0.1, p1: 0.5, curl: 0.45, w: 0.45, ruf: 0.25, share: 0.24 },
  ],
};

interface BloomHead {
  x: number;
  y: number;
  z: number;
  scale: number;
  tiltX: number;
  tiltZ: number;
}

const SINGLE_HEAD: BloomHead[] = [
  { x: 0, y: 3.0, z: 0, scale: 1.0, tiltX: 0, tiltZ: 0 },
];

const BOUQUET_HEADS: BloomHead[] = [
  { x: 0, y: 3.65, z: 0, scale: 0.86, tiltX: 0, tiltZ: 0 },
  { x: -2.05, y: 2.55, z: 0.55, scale: 0.72, tiltX: 0.12, tiltZ: 0.34 },
  { x: 1.95, y: 2.75, z: -0.5, scale: 0.70, tiltX: -0.1, tiltZ: -0.32 },
];

const LEAVES = [
  { yb: 0.25, az: 0.6, len: 2.4 },
  { yb: 0.45, az: 3.0, len: 2.8 },
  { yb: 0.8, az: 4.4, len: 2.0 },
  { yb: 1.15, az: 1.9, len: 1.7 },
];

export default function ParticleFlowerCanvas({
  primaryColor,
  secondaryColor,
  flowerStyle = "lily",
  autoBloom = false,
  onSeedTap,
  onBloomComplete,
  className = "",
}: ParticleFlowerCanvasProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [seedTapped, setSeedTapped] = useState(autoBloom);

  // Store colour computation inputs so we can re-tint dynamically without rebuilding geometry
  const recolorRef = useRef<((pri: string, sec: string) => void) | null>(null);
  const callbacksRef = useRef({ onSeedTap, onBloomComplete });
  callbacksRef.current = { onSeedTap, onBloomComplete };

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const R = Math.random;
    const TAU = Math.PI * 2;
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

    const timeU = { value: 0 };
    const scaleU = { value: 1 };

    function makeMat(fade: number, wobble: number) {
      return new THREE.ShaderMaterial({
        uniforms: {
          uTime: timeU,
          uScale: scaleU,
          uPR: { value: PR },
          uFade: { value: fade },
          uWobble: { value: wobble },
        },
        vertexShader: VS,
        fragmentShader: FS,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
    }

    function makePoints(
      pos: Float32Array,
      sizeArr: Float32Array,
      col: Float32Array,
      alpha: Float32Array,
      seedArr: Float32Array,
      mat: THREE.ShaderMaterial,
      dynamic: boolean
    ) {
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

    const activeLayers = STYLE_LAYERS[flowerStyle] || STYLE_LAYERS.lily;
    const heads = flowerStyle === "bouquet" ? BOUQUET_HEADS : SINGLE_HEAD;
    const Y0 = heads[0].y;
    const N_STEM = 2400;
    const N_CORE = 2400;
    const N_PETAL = 19000;
    const N = N_STEM + N_CORE + N_PETAL;

    const open = new Float32Array(N * 3);
    const closed = new Float32Array(N * 3);
    const cur = new Float32Array(N * 3);
    const vel = new Float32Array(N * 3);
    const size0 = new Float32Array(N);
    const size = new Float32Array(N);
    const colA = new Float32Array(N * 3);
    const alphaA = new Float32Array(N);
    const seedA = new Float32Array(N);
    const appear = new Float32Array(N);
    const type = new Uint8Array(N);
    const originX = new Float32Array(N);
    const originY = new Float32Array(N);
    const originZ = new Float32Array(N);

    // Helper to transform local bloom coordinates (around 0,0,0) into world space for a given BloomHead
    function placeOnHead(
      head: BloomHead,
      lx: number,
      ly: number,
      lz: number
    ): [number, number, number] {
      let x = lx * head.scale;
      let y = ly * head.scale;
      let z = lz * head.scale;
      if (head.tiltZ !== 0) {
        const cz = Math.cos(head.tiltZ);
        const sz = Math.sin(head.tiltZ);
        const nx = x * cz - y * sz;
        const ny = x * sz + y * cz;
        x = nx;
        y = ny;
      }
      if (head.tiltX !== 0) {
        const cx = Math.cos(head.tiltX);
        const sx = Math.sin(head.tiltX);
        const ny = y * cx - z * sx;
        const nz = y * sx + z * cx;
        y = ny;
        z = nz;
      }
      return [head.x + x, head.y + y, head.z + z];
    }

    // Metadata per particle so colors can be live-updated in Creator mode
    const metaT = new Float32Array(N);
    const metaEdge = new Float32Array(N);
    const metaBr = new Float32Array(N);
    const metaLayer = new Uint8Array(N);
    const metaSub = new Uint8Array(N); // 0=stem, 1=leaf, 2=tendril, 3=throatGlow, 4=stamenHead, 5=stamenStalk, 6=petal, 7=petalSpeckle

    function spine(L: LayerSpec, t: number, o: number): [number, number] {
      const p0 = 0.08 + (L.p0 - 0.08) * o;
      const p1 = 0.3 + (L.p1 - 0.3) * o;
      const cu = L.curl * o;
      const n = 12;
      const dt = t / n;
      let r = 0;
      let y = 0;
      for (let k = 0; k < n; k++) {
        const u = (k + 0.5) * dt;
        const phi = p0 + (p1 - p0) * u + cu * u * u * u * u;
        r += Math.sin(phi) * dt * L.len;
        y += Math.cos(phi) * dt * L.len;
      }
      return [r, y];
    }

    function petalPos(
      L: LayerSpec,
      ang: number,
      t: number,
      s: number,
      o: number
    ): [number, number, number] {
      const sp = spine(L, t, o);
      const w = L.w * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.85)), 0.7);
      const rho = sp[0] + 0.1 + 0.35 * w * (1 - s * s) * (1 - o);
      const y =
        sp[1] +
        0.3 * w * s * s * o +
        L.ruf * 0.2 * Math.sin(t * 10 + ang * 2) * s * s * o;
      const lat = s * w * (0.35 + 0.65 * o);
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      return [ca * rho - sa * lat, y, sa * rho + ca * lat];
    }

    function setP(
      i: number,
      o: [number, number, number],
      c: [number, number, number]
    ) {
      open.set(o, i * 3);
      closed.set(c, i * 3);
    }

    const TEND: { ang: number; path: [number, number][] }[] = [];
    for (let j = 0; j < 5; j++) {
      const K = (j % 2 ? -1 : 1) * (5 + R() * 2.5);
      const len = 2.6 + R() * 0.6;
      const path: [number, number][] = [[0, 0]];
      let a = 0;
      let b = 0;
      const n = 60;
      for (let k = 0; k < n; k++) {
        const u = (k + 0.5) / n;
        const psi = 0.25 + K * u * u;
        const ds = (len / n) * (1.15 - 0.7 * u);
        a += Math.sin(psi) * ds;
        b += Math.cos(psi) * ds;
        path.push([a, b]);
      }
      TEND.push({ ang: j * 1.2566 + 0.4, path });
    }

    for (let i = 0; i < N; i++) {
      seedA[i] = R();
      alphaA[i] = 0.6;
      const head = heads[i % heads.length];
      originX[i] = head.x;
      originY[i] = head.y;
      originZ[i] = head.z;

      if (i < 800) {
        type[i] = 0;
        metaSub[i] = 0;
        const frac = R();
        const yy = frac * head.y;
        const curve = Math.pow(frac, 1.35);
        const x =
          head.x * curve + 0.25 * Math.sin(frac * TAU) * (heads.length === 1 ? 1 : 0.4);
        const z = head.z * curve;
        const p: [number, number, number] = [x + gs() * 0.06, yy, z + gs() * 0.06];
        setP(i, p, p);
        metaT[i] = frac;
        size0[i] = 0.6 + R() * 0.5;
        appear[i] = frac * 1.5;
        alphaA[i] = 0.6;
      } else if (i < N_STEM) {
        type[i] = 0;
        metaSub[i] = 1;
        const lf = LEAVES[i % 4];
        let t: number;
        do {
          t = R();
        } while (R() > Math.pow(Math.sin(Math.PI * Math.pow(t, 0.8)), 0.7));
        const edge = R() < 0.2 ? 1 : 0;
        const s = edge ? (R() < 0.5 ? -1 : 1) : R() * 2 - 1;
        const w = 0.8 * (lf.len / 2.4) * Math.sin(Math.PI * Math.pow(t, 0.8));
        const r = lf.len * t * 0.95;
        const yy = lf.yb + lf.len * (0.5 * t - 0.55 * t * t) + 0.2 * w * s * s;
        const frac = clamp(lf.yb / head.y, 0, 1);
        const x0 =
          head.x * Math.pow(frac, 1.35) +
          0.25 * Math.sin(frac * TAU) * (heads.length === 1 ? 1 : 0.4);
        const z0 = head.z * Math.pow(frac, 1.35);
        const dx = Math.cos(lf.az);
        const dz = Math.sin(lf.az);
        const p: [number, number, number] = [
          x0 + dx * r - dz * s * w,
          yy,
          z0 + dx * s * w + dz * r,
        ];
        setP(i, p, p);
        metaT[i] = t;
        metaEdge[i] = edge;
        size0[i] = 0.6 + R() * 0.5;
        appear[i] = (lf.yb / Y0) * 1.5 + t * 0.4;
        alphaA[i] = 0.45;
      } else if (i < N_STEM + N_CORE) {
        type[i] = 1;
        const q = R();
        let lp: [number, number, number];
        let sz: number;
        let ap: number;
        if (q < 0.55) {
          metaSub[i] = 2;
          const T = TEND[(R() * 5) | 0];
          const u = R();
          const f = u * 60;
          const k = Math.min(59, f | 0);
          const fr = f - k;
          const A = T.path[k];
          const B = T.path[k + 1];
          const a = A[0] + (B[0] - A[0]) * fr;
          const b = A[1] + (B[1] - A[1]) * fr;
          const sc = R() < 0.15 ? 0.14 : 0.025;
          const tendScale = flowerStyle === "rose" ? 0.45 : flowerStyle === "lotus" ? 0.6 : 1.0;
          lp = [
            (Math.cos(T.ang) * a + gs() * sc) * tendScale,
            (0.5 + b + gs() * sc) * tendScale,
            (Math.sin(T.ang) * a + gs() * sc) * tendScale,
          ];
          metaT[i] = u;
          sz = 0.9 + R() * 1.0;
          ap = 2.0 + u * 1.3;
        } else if (q < 0.8) {
          metaSub[i] = 3;
          lp = [gs() * 0.45, 0.45 + gs() * 0.35, gs() * 0.45];
          metaT[i] = R();
          sz = 1.0 + R() * 1.1;
          ap = 1.3 + R() * 0.8;
        } else {
          const aa = ((R() * 6) | 0) * 1.0472 + 0.2;
          const isHead = R() < 0.3;
          const u = isHead ? 1 : R();
          const j = isHead ? 0.1 : 0.03;
          metaSub[i] = isHead ? 4 : 5;
          metaT[i] = u;
          lp = [
            Math.cos(aa) * (0.15 + 1.3 * u) + gs() * j,
            0.3 + 0.2 + 1.0 * u - 0.35 * u * u + gs() * j,
            Math.sin(aa) * (0.15 + 1.3 * u) + gs() * j,
          ];
          sz = isHead ? 1.6 : 0.8;
          ap = 1.6 + R() * 0.6;
        }
        const wp = placeOnHead(head, lp[0], lp[1], lp[2]);
        setP(i, wp, wp);
        size0[i] = sz;
        appear[i] = ap;
        alphaA[i] = 0.9;
      } else {
        type[i] = 2;
        let r = R();
        let li = 0;
        while (li < activeLayers.length - 1 && r > activeLayers[li].share) {
          r -= activeLayers[li].share;
          li++;
        }
        const L = activeLayers[li];
        const ang = (Math.floor(R() * L.n) / L.n) * TAU + L.yaw + gs() * 0.02;
        let t: number;
        do {
          t = R();
        } while (R() > Math.pow(Math.sin(Math.PI * Math.pow(t, 0.85)), 0.7));
        const kind = R();
        let s = R() * 2 - 1;
        let edge = 0;
        if (kind < 0.2) {
          s = (R() < 0.5 ? -1 : 1) * (0.94 + 0.06 * R());
          edge = 1;
        } else if (kind < 0.28) {
          s = gs() * 0.04;
          edge = 0.5;
        }
        const jit: [number, number, number] = [
          gs() * 0.04,
          gs() * 0.04,
          gs() * 0.04,
        ];
        const lo = petalPos(L, ang, t, s, 1);
        const lc = petalPos(L, ang, t, s, 0);
        const wo = placeOnHead(head, lo[0] + jit[0], lo[1] + jit[1], lo[2] + jit[2]);
        const wc = placeOnHead(head, lc[0] + jit[0], lc[1] + jit[1], lc[2] + jit[2]);
        setP(i, wo, wc);
        const sp = li < 2 && t < 0.55 && R() < 0.1 ? 1 : 0;
        const br =
          (0.75 + 0.35 * R()) * (1 + 0.45 * edge + 0.25 * Math.abs(s));
        metaSub[i] = sp ? 7 : 6;
        metaLayer[i] = li;
        metaT[i] = t;
        metaBr[i] = br;
        size0[i] = (0.6 + R() * 0.6) * (1 + 0.3 * edge + 0.8 * sp);
        appear[i] = 1.1 + li * 0.12 + t * 0.3;
        alphaA[i] = 0.5 + 0.3 * sp;
      }

      if (type[i] === 0) {
        cur.set([open[i * 3], open[i * 3 + 1], open[i * 3 + 2]], i * 3);
      } else {
        cur.set([head.x, head.y, head.z], i * 3);
      }
    }

    const flowerMat = makeMat(1.0, 0.025);
    const flower = makePoints(
      cur,
      size,
      colA,
      alphaA,
      seedA,
      flowerMat,
      true
    );
    scene.add(flower);

    /* ---------- Seed ---------- */
    const SEED_POS = new THREE.Vector3(0, 0.16, 0);
    const seedMat = makeMat(1, 0.02);
    const seedN = 200;
    const seedCol = new Float32Array(seedN * 3);
    const seedHaloFlags = new Uint8Array(seedN);
    const seedMixT = new Float32Array(seedN);
    let seedPoints: THREE.Points;
    {
      const pos = new Float32Array(seedN * 3);
      const sz = new Float32Array(seedN);
      const al = new Float32Array(seedN);
      const sd = new Float32Array(seedN);
      for (let i = 0; i < seedN; i++) {
        const halo = i >= 160;
        seedHaloFlags[i] = halo ? 1 : 0;
        seedMixT[i] = R();
        const rad = halo ? 0.25 + R() * 0.5 : 0.05 + R() * 0.12;
        const v = new THREE.Vector3(gs(), gs(), gs())
          .normalize()
          .multiplyScalar(rad);
        pos.set([v.x, SEED_POS.y + v.y * 0.8, v.z], i * 3);
        sz[i] = halo ? 2.6 : 1.3 + R() * 0.9;
        al[i] = halo ? 0.18 : 0.95;
        sd[i] = R();
      }
      seedPoints = makePoints(pos, sz, seedCol, al, sd, seedMat, true);
      scene.add(seedPoints);
    }

    /* ---------- Ground dust ---------- */
    const dustMat = makeMat(0.6, 0.12);
    const dustN = 1800;
    const dustCol = new Float32Array(dustN * 3);
    const dustMixT = new Float32Array(dustN);
    let dustPoints: THREE.Points;
    {
      const pos = new Float32Array(dustN * 3);
      const sz = new Float32Array(dustN);
      const al = new Float32Array(dustN);
      const sd = new Float32Array(dustN);
      for (let i = 0; i < dustN; i++) {
        const r = Math.pow(R(), 0.7) * 12;
        const a = R() * TAU;
        dustMixT[i] = R();
        pos.set(
          [Math.cos(a) * r, R() < 0.8 ? R() * 0.35 : R() * 3.5, Math.sin(a) * r],
          i * 3
        );
        sz[i] = 0.4 + R() * 0.7;
        al[i] = 0.18 + R() * 0.25;
        sd[i] = R();
      }
      dustPoints = makePoints(pos, sz, dustCol, al, sd, dustMat, true);
      scene.add(dustPoints);
    }

    /* ---------- Magic ring ---------- */
    const ringGroup = new THREE.Group();
    ringGroup.position.set(0, 3.4, 0);
    ringGroup.rotation.set(0.3, 0, -0.25);
    const ringMat = makeMat(0, 0.08);
    const ringN = 3000;
    const ringCol = new Float32Array(ringN * 3);
    const ringAng = new Float32Array(ringN);
    let ringPoints: THREE.Points;
    {
      const pos = new Float32Array(ringN * 3);
      const sz = new Float32Array(ringN);
      const al = new Float32Array(ringN);
      const sd = new Float32Array(ringN);
      for (let i = 0; i < ringN; i++) {
        const a = R() * TAU;
        ringAng[i] = a;
        const r = 7 + gs() * 0.8 + 0.3 * Math.sin(a * 5);
        pos.set([Math.cos(a) * r, gs() * 0.3, Math.sin(a) * r], i * 3);
        sz[i] = R() < 0.02 ? 2.6 : 0.5 + R() * 1.0;
        al[i] = 0.5 + R() * 0.4;
        sd[i] = R();
      }
      ringPoints = makePoints(pos, sz, ringCol, al, sd, ringMat, true);
      ringGroup.add(ringPoints);
      scene.add(ringGroup);
    }

    function applyPalette(priHex: string, secHex: string) {
      const TH = buildPalette(priHex, secHex);
      const priRgb = hexToRgb01(priHex);
      const secRgb = hexToRgb01(secHex);

      for (let i = 0; i < N; i++) {
        const sub = metaSub[i];
        const t = metaT[i];
        let c: RGB;
        if (sub === 0) {
          c = mix(
            [TH.stem[0] * 0.6, TH.stem[1] * 0.6, TH.stem[2] * 0.6],
            TH.stem,
            t
          );
        } else if (sub === 1) {
          const edge = metaEdge[i];
          const factor = (0.55 + 0.3 * t) * (1 + 0.5 * edge);
          c = [TH.stem[0] * factor, TH.stem[1] * factor, TH.stem[2] * factor];
        } else if (sub === 2) {
          c = mix(TH.tend, [1, 1, 1], t * 0.6);
        } else if (sub === 3) {
          c = mix(TH.throat, [1, 1, 1], t * 0.7);
        } else if (sub === 4) {
          c = TH.tend;
        } else if (sub === 5) {
          c = mix(TH.base, TH.tend, t);
        } else {
          const li = metaLayer[i];
          const br = metaBr[i];
          let baseCol: RGB;
          if (sub === 7) {
            baseCol = TH.tend;
          } else if (li === 2) {
            baseCol = mix(TH.throat, TH.base, t);
          } else {
            baseCol = mix(
              mix(TH.base, TH.mid, sstep(0, 0.4, t)),
              TH.tip,
              sstep(0.4, 1, t) * (li === 0 ? 1 : 0.65)
            );
          }
          c = [baseCol[0] * br, baseCol[1] * br, baseCol[2] * br];
        }
        colA.set(c, i * 3);
      }
      flower.geometry.attributes.aColor.needsUpdate = true;

      for (let i = 0; i < seedN; i++) {
        const c = seedHaloFlags[i]
          ? priRgb
          : mix([1, 0.95, 1], priRgb, seedMixT[i]);
        seedCol.set(c, i * 3);
      }
      seedPoints.geometry.attributes.aColor.needsUpdate = true;

      for (let i = 0; i < dustN; i++) {
        dustCol.set(mix(priRgb, secRgb, dustMixT[i]), i * 3);
      }
      dustPoints.geometry.attributes.aColor.needsUpdate = true;

      for (let i = 0; i < ringN; i++) {
        ringCol.set(
          mix(priRgb, secRgb, 0.5 + 0.5 * Math.sin(ringAng[i] * 2)),
          i * 3
        );
      }
      ringPoints.geometry.attributes.aColor.needsUpdate = true;
    }

    applyPalette(primaryColor, secondaryColor);
    recolorRef.current = applyPalette;

    /* ---------- Input & Touch Optimization ---------- */
    const ndc = { x: 0, y: 0 };
    let pointerActive = false;
    let started = autoBloom;
    let t0 = autoBloom ? -5.0 : 0;
    let msgShown = autoBloom;

    function setPointer(e: PointerEvent) {
      const rect = renderer.domElement.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      ndc.x = (cx / W) * 2 - 1;
      ndc.y = -(cy / H) * 2 + 1;
    }

    function nearSeed(e: PointerEvent) {
      const rect = renderer.domElement.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const v = SEED_POS.clone().project(camera);
      const sx = (v.x * 0.5 + 0.5) * W;
      const sy = (-v.y * 0.5 + 0.5) * H;
      // Generous hit area on mobile touch screens
      const radius =
        e.pointerType === "touch"
          ? Math.max(120, 0.14 * Math.min(W, H))
          : Math.max(75, 0.08 * Math.min(W, H));
      return Math.hypot(cx - sx, cy - sy) < radius;
    }

    const cv = renderer.domElement;
    cv.style.touchAction = "none";
    cv.style.display = "block";

    const onPointerMove = (e: PointerEvent) => {
      setPointer(e);
      pointerActive = true;
      cv.style.cursor = !started && nearSeed(e) ? "pointer" : "default";
    };

    const onPointerDown = (e: PointerEvent) => {
      setPointer(e);
      pointerActive = true;
      if (!started && nearSeed(e)) {
        started = true;
        t0 = timeU.value;
        setSeedTapped(true);
        cv.style.cursor = "default";
        callbacksRef.current.onSeedTap?.();
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") pointerActive = false;
    };

    const onPointerLeave = () => {
      pointerActive = false;
    };

    cv.addEventListener("pointermove", onPointerMove);
    cv.addEventListener("pointerdown", onPointerDown);
    cv.addEventListener("pointerup", onPointerUp);
    cv.addEventListener("pointercancel", onPointerUp);
    cv.addEventListener("pointerleave", onPointerLeave);

    function resize() {
      if (!stage) return;
      W = stage.clientWidth || window.innerWidth;
      H = stage.clientHeight || window.innerHeight;
      renderer.setSize(W, H);
      const aspect = W / H;
      camera.aspect = aspect;
      camZ = Math.max(14.5, 9.5 / (0.93 * aspect));
      camera.updateProjectionMatrix();
      scaleU.value = (clamp(H / 900, 0.6, 1.3) * camZ) / 14.5;
    }

    window.addEventListener("resize", resize);
    resize();

    /* ---------- Render Loop ---------- */
    const ro = new THREE.Vector3();
    const rd = new THREE.Vector3();
    let last = performance.now();
    const MR = 2.0;
    const MR2 = MR * MR;
    const PUSH = 55;
    let rafId = 0;

    function frame(now: number) {
      rafId = requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, 0.033);
      last = now;
      const time = timeU.value + dt;
      timeU.value = time;

      camera.position.set(Math.sin(time * 0.12) * 1.6, 4.0, camZ);
      camera.lookAt(0, 2.7, 0);
      camera.updateMatrixWorld();

      const e = started ? time - t0 : -1;
      ringGroup.children[0].rotation.y += dt * 0.22;
      seedMat.uniforms.uFade.value = started
        ? Math.max(0, 1 - e / 1.2)
        : 0.75 + 0.25 * Math.sin(time * 2.5);
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
          let bx: number;
          let by: number;
          let bz: number;
          if (type[i] === 0) {
            bx = open[i3];
            by = open[i3 + 1];
            bz = open[i3 + 2];
          } else {
            const ox = originX[i];
            const oy = originY[i];
            const oz = originZ[i];
            const mx = ox + (closed[i3] - ox + (open[i3] - closed[i3]) * b) * br;
            const my = closed[i3 + 1] + (open[i3 + 1] - closed[i3 + 1]) * b;
            const mz =
              oz + (closed[i3 + 2] - oz + (open[i3 + 2] - closed[i3 + 2]) * b) * br;
            const h = (my - oy) * 0.05 * b;
            const ph = time * 1.2 + (my - oy) * 0.8 + open[i3] * 0.6;
            bx = ox + (mx - ox) * g + h * Math.sin(ph) * g;
            by = oy + (my - oy) * g;
            bz = oz + (mz - oz) * g + h * Math.cos(ph * 0.9) * g;
          }
          size[i] = size0[i] * g;
          const cx = cur[i3];
          const cy = cur[i3 + 1];
          const cz = cur[i3 + 2];
          let vx = vel[i3];
          let vy = vel[i3 + 1];
          let vz = vel[i3 + 2];
          if (pointerActive && g > 0.05) {
            const dx = cx - ro.x;
            const dy = cy - ro.y;
            const dz = cz - ro.z;
            const tt = dx * rd.x + dy * rd.y + dz * rd.z;
            const px = dx - rd.x * tt;
            const py = dy - rd.y * tt;
            const pz = dz - rd.z * tt;
            const d2 = px * px + py * py + pz * pz;
            if (d2 < MR2) {
              const d = Math.sqrt(d2) + 1e-4;
              const f = 1 - d / MR;
              const a = (f * f * PUSH * dt) / d;
              vx += px * a;
              vy += py * a;
              vz += pz * a;
            }
          }
          vx = (vx + (bx - cx) * k * dt) * damp;
          vy = (vy + (by - cy) * k * dt) * damp;
          vz = (vz + (bz - cz) * k * dt) * damp;
          cur[i3] = cx + vx * dt;
          cur[i3 + 1] = cy + vy * dt;
          cur[i3 + 2] = cz + vz * dt;
          vel[i3] = vx;
          vel[i3 + 1] = vy;
          vel[i3 + 2] = vz;
        }
        flower.geometry.attributes.position.needsUpdate = true;
        flower.geometry.attributes.aSize.needsUpdate = true;

        if (!msgShown && e > 3.9) {
          msgShown = true;
          callbacksRef.current.onBloomComplete?.();
        }
      }

      renderer.render(scene, camera);
    }

    rafId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      cv.removeEventListener("pointermove", onPointerMove);
      cv.removeEventListener("pointerdown", onPointerDown);
      cv.removeEventListener("pointerup", onPointerUp);
      cv.removeEventListener("pointercancel", onPointerUp);
      cv.removeEventListener("pointerleave", onPointerLeave);
      renderer.dispose();
    };
    // Recreate WebGL scene when autoBloom or flowerStyle changes; color changes use recolorRef
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoBloom, flowerStyle]);

  // Live color updates without resetting the Three.js simulation
  useEffect(() => {
    recolorRef.current?.(primaryColor, secondaryColor);
  }, [primaryColor, secondaryColor]);

  return (
    <div className={`relative w-full h-full select-none ${className}`}>
      <div ref={stageRef} className="fixed inset-0 w-full h-full" />
      {!autoBloom && !seedTapped && (
        <div
          className="fixed left-0 right-0 bottom-0 text-center pointer-events-none font-serif font-light tracking-[0.14em] text-purple-100/80 animate-pulse px-6"
          style={{
            paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 7vh)",
            textShadow:
              "0 0 18px rgba(150,120,255,0.8), 0 0 40px rgba(90,120,255,0.5)",
          }}
        >
          Tap the glowing seed
        </div>
      )}
    </div>
  );
}
