// Procedural neurons, drawn the way a Golgi stain shows them: a soma, branching dendrites, one axon. Most are
// nigral dopamine neurons: large multipolar cells with a few long, sparsely branching dendrites.
// Every vertex carries its distance along the tree from the soma (aDist, 0 to 1), which the shaders use
// for travelling action potentials and for dendrites dying back from the tips as the tissue gets sick.
import * as THREE from "three";

export type Rng = () => number;
export function rng(seed: number): Rng {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Seg = { pts: THREE.Vector3[]; rad: number[]; dist: number[]; kind: number; seed: number };
export type Shape = { tubes: THREE.BufferGeometry; tips: THREE.BufferGeometry; soma: THREE.Vector3; pyramidal: boolean };

const STEP = 0.034;
const RADIAL = 5;
const DOWN = new THREE.Vector3(0, -1, 0);

function grow(r: Rng, pyramidal: boolean) {
  const segs: Seg[] = [];
  const tips: { p: THREE.Vector3; dist: number; kind: number }[] = [];
  const wander = (v: THREE.Vector3, amt: number) =>
    v.add(new THREE.Vector3(r() - 0.5, r() - 0.5, (r() - 0.5) * 0.7).multiplyScalar(amt)).normalize();

  const branch = (start: THREE.Vector3, dir: THREE.Vector3, len: number, rad: number, depth: number, d0: number, kind: number) => {
    const pts = [start.clone()], radius = [rad], dist = [d0];
    let p = start.clone(), v = dir.clone().normalize(), d = d0;
    const n = Math.max(4, Math.round(len / STEP));
    for (let i = 1; i <= n; i++) {
      wander(v, kind ? 0.16 : 0.3);
      if (kind) v.lerp(DOWN, 0.035).normalize();
      p = p.clone().addScaledVector(v, STEP);
      d += STEP;
      const taper = rad * (1 - 0.6 * (i / n));
      pts.push(p); radius.push(taper); dist.push(d);
      if (depth < 3 && i > 2 && i < n - 2 && r() < (kind ? 0.025 : 0.09)) {
        const axis = new THREE.Vector3().crossVectors(v, new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5)).normalize();
        const nd = v.clone().applyAxisAngle(axis, 0.45 + r() * 0.65);
        branch(p, nd, len * (0.42 + r() * 0.28), taper * 0.7, depth + 1, d, kind);
      }
    }
    segs.push({ pts, rad: radius, dist, kind, seed: r() });
    tips.push({ p: p.clone(), dist: d, kind });
  };

  const somaR = pyramidal ? 0.075 : 0.11;
  const from = (dir: THREE.Vector3) => dir.clone().normalize().multiplyScalar(somaR * 0.8);
  if (pyramidal) {
    const up = new THREE.Vector3((r() - 0.5) * 0.3, 1, (r() - 0.5) * 0.3);
    branch(from(up), up, 0.95 + r() * 0.45, 0.02, 0, 0, 0); // apical dendrite
    const basal = 4 + Math.floor(r() * 3);
    for (let i = 0; i < basal; i++) {
      const a = (i / basal) * Math.PI * 2 + r() * 0.5;
      const dir = new THREE.Vector3(Math.cos(a), -0.35 - r() * 0.5, Math.sin(a) * 0.8);
      branch(from(dir), dir, 0.32 + r() * 0.26, 0.013, 1, 0, 0);
    }
  } else {
    // a nigral dopamine neuron: three to five thick primary dendrites, long and sparsely branched, some running
    // ventrally into the pars reticulata
    const n = 3 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + r() * 0.8;
      const ventral = r() < 0.4;
      const dir = new THREE.Vector3(Math.cos(a), ventral ? -0.6 - r() * 0.6 : Math.sin(a) * 0.9, (r() - 0.5) * 0.6);
      branch(from(dir), dir, 0.62 + r() * 0.62, 0.026, 1, 0, 0);
    }
  }
  const ax = new THREE.Vector3((r() - 0.5) * 0.5, -1, (r() - 0.5) * 0.4);
  branch(from(ax), ax, 1.0 + r() * 0.7, 0.008, 1, 0, 1); // axon
  return { segs, tips, somaR };
}

/** Tubes along every path with parallel-transport frames; the shader places each ring vertex. */
function tubes(segs: Seg[], dMax: number, aMax: number): THREE.BufferGeometry {
  let verts = 0, tris = 0;
  for (const s of segs) { verts += s.pts.length * RADIAL; tris += (s.pts.length - 1) * RADIAL * 2; }
  const center = new Float32Array(verts * 3), normal = new Float32Array(verts * 3);
  const radius = new Float32Array(verts), dist = new Float32Array(verts), kind = new Float32Array(verts), seed = new Float32Array(verts);
  const index = new Uint32Array(tris * 3);
  let v = 0, t = 0;
  const T = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3(), q = new THREE.Vector3();
  for (const s of segs) {
    const base = v;
    const norm = s.kind ? aMax : dMax;
    for (let i = 0; i < s.pts.length; i++) {
      const a = s.pts[Math.max(0, i - 1)], b = s.pts[Math.min(s.pts.length - 1, i + 1)];
      T.subVectors(b, a).normalize();
      if (i === 0) N.set(T.y, -T.x, 0).lengthSq() > 1e-4 ? N.set(T.y, -T.x, 0).normalize() : N.set(0, T.z, -T.y).normalize();
      N.addScaledVector(T, -N.dot(T)).normalize();
      B.crossVectors(T, N);
      for (let j = 0; j < RADIAL; j++) {
        const ang = (j / RADIAL) * Math.PI * 2;
        q.copy(N).multiplyScalar(Math.cos(ang)).addScaledVector(B, Math.sin(ang));
        center.set([s.pts[i].x, s.pts[i].y, s.pts[i].z], v * 3);
        normal.set([q.x, q.y, q.z], v * 3);
        radius[v] = s.rad[i]; dist[v] = Math.min(1, s.dist[i] / norm); kind[v] = s.kind; seed[v] = s.seed;
        v++;
      }
    }
    for (let i = 0; i < s.pts.length - 1; i++) {
      for (let j = 0; j < RADIAL; j++) {
        const a = base + i * RADIAL + j, b = base + i * RADIAL + ((j + 1) % RADIAL);
        const c = a + RADIAL, d = b + RADIAL;
        index.set([a, c, b, b, c, d], t);
        t += 6;
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(center, 3));
  g.setAttribute("aNormal", new THREE.BufferAttribute(normal, 3));
  g.setAttribute("aRadius", new THREE.BufferAttribute(radius, 1));
  g.setAttribute("aDist", new THREE.BufferAttribute(dist, 1));
  g.setAttribute("aKind", new THREE.BufferAttribute(kind, 1));
  g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  g.setIndex(new THREE.BufferAttribute(index, 1));
  g.computeBoundingSphere();
  return g;
}

export function makeShape(seed: number): Shape {
  const r = rng(seed);
  const pyramidal = false; // the nigra has no pyramidal cells
  const { segs, tips, somaR } = grow(r, pyramidal);
  let dMax = 0.001, aMax = 0.001;
  for (const s of segs) for (const d of s.dist) s.kind ? (aMax = Math.max(aMax, d)) : (dMax = Math.max(dMax, d));
  const tg = new THREE.BufferGeometry();
  tg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(tips.flatMap((x) => [x.p.x, x.p.y, x.p.z])), 3));
  tg.setAttribute("aDist", new THREE.BufferAttribute(new Float32Array(tips.map((x) => Math.min(1, x.dist / (x.kind ? aMax : dMax)))), 1));
  tg.setAttribute("aKind", new THREE.BufferAttribute(new Float32Array(tips.map((x) => x.kind)), 1));
  // large fusiform or polygonal somata, stretched along one axis
  const soma = pyramidal ? new THREE.Vector3(somaR * 0.9, somaR * 1.45, somaR * 0.9) : new THREE.Vector3(somaR * (1.15 + r() * 0.3), somaR * (0.8 + r() * 0.15), somaR * 0.9);
  return { tubes: tubes(segs, dMax, aMax), tips: tg, soma, pyramidal };
}
