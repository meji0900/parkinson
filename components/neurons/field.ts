// The neuron field: living tissue in the margins, seen through a microscope. Scrolling moves the slide
// (the field travels at 82% of page speed, so it sits behind the text) and walks the tissue from Braak
// stage I to VI: plaques gather, tangles darken cell bodies, dendrites die back, firing slows. Fast
// scrolling, the pointer and the agent's own live events set off cascades of action potentials.
import * as THREE from "three";
import { makeShape, rng, type Shape } from "./grow";
import * as S from "./shaders";

const PAPER = "#f7eff3";
const INKS = ["#2a1e45", "#382760", "#463273", "#2f2350"];
const PULSE = "#e0457f";
const PAR = 0.82;
const CAM_Z = 9;
const FOV = 34;
const COOLDOWN = 1.7;

type Neuron = {
  group: THREE.Group; mats: THREE.ShaderMaterial[]; sickU: { value: number }; fireU: { value: number };
  u: number; side: number; across: number; z: number; scale: number; onset: number; sick: number; next: number; near: [Neuron, number][];
};
export type FieldOptions = { reduced: boolean; onStage?: (stage: number) => void };

const color = (hex: string) => ({ value: new THREE.Color(hex) });
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export class NeuronField {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 60);
  private shared = {
    uTime: { value: 0 }, uVel: { value: 0 }, uScale: { value: 9 }, uPaper: color(PAPER), uContent: { value: new THREE.Vector4(0, 0, 40, 0.82) },
    uFogNear: { value: 8.2 }, uFogFar: { value: 15 }, uFade: { value: 0 },
  };
  private shapes: Shape[] = [];
  private neurons: Neuron[] = [];
  private plaques!: THREE.Points;
  private dust!: THREE.Points;
  private plaqueData: { u: number; side: number; across: number; z: number }[] = [];
  private dustData: { u: number; side: number; across: number; z: number }[] = [];
  private queue: { n: Neuron; at: number }[] = [];
  private pathU = { value: 0 };
  private hh = 1; private hw = 1; private wpp = 0.01; private fieldH = 10; private narrow = false;
  private scrollT = 0; private scrollS = 0; private camY = 0; private lastCamY = 0; private excite = 0;
  private pointer: { x: number; y: number; moved: boolean } = { x: 0, y: 0, moved: false };
  private stage = 0; private raf = 0; private running = false; private last = 0; private clock = 0;
  private cleanup: (() => void)[] = [];

  constructor(private canvas: HTMLCanvasElement, private opts: FieldOptions) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
    this.renderer.setClearColor(PAPER, 1);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.camera.position.set(0, 0, CAM_Z);
    this.build();
    this.layout();
    this.listen();
    this.scrollS = this.scrollT = window.scrollY;
    if (opts.reduced) this.renderOnce(); else this.start();
  }

  private build() {
    const r = rng(20261014);
    this.narrow = window.innerWidth < 760;
    const pages = Math.max(2, document.documentElement.scrollHeight / window.innerHeight);
    const count = Math.round(Math.min(64, Math.max(10, pages * (this.narrow ? 1.6 : 3.2))));
    for (let i = 0; i < 12; i++) this.shapes.push(makeShape(1000 + i * 7919));
    const somaGeo = new THREE.IcosahedronGeometry(1, 3);
    for (let i = 0; i < count; i++) {
      const shape = this.shapes[i % this.shapes.length];
      const ink = color(INKS[Math.floor(r() * INKS.length)]);
      const sickU = { value: 0 }, fireU = { value: -10 };
      // born: the cells grow out of their somas once, a beat apart, as the page opens
      const own = { uInk: ink, uSick: sickU, uFireT: fireU, uPulse: color(PULSE), uBorn: { value: this.opts.reduced ? -100 : 0.15 + r() * 1.1 } };
      const dendMat = new THREE.ShaderMaterial({
        vertexShader: S.dendriteVert, fragmentShader: S.dendriteFrag,
        uniforms: { ...this.shared, ...own, uSickInk: color("#9d8fb0") },
      });
      const tipMat = new THREE.ShaderMaterial({ vertexShader: S.tipVert, fragmentShader: S.tipFrag, uniforms: { ...this.shared, ...own } });
      const somaMat = new THREE.ShaderMaterial({
        vertexShader: S.somaVert, fragmentShader: S.somaFrag,
        uniforms: { ...this.shared, ...own, uSeed: { value: r() * 10 }, uNucleus: color("#e8dcef"), uTangle: color("#150c24") },
      });
      const group = new THREE.Group();
      const tubes = new THREE.Mesh(shape.tubes, dendMat);
      const tips = new THREE.Points(shape.tips, tipMat);
      const soma = new THREE.Mesh(somaGeo, somaMat);
      soma.scale.copy(shape.soma);
      for (const o of [tubes, tips, soma]) { o.frustumCulled = false; group.add(o); }
      group.rotation.set((r() - 0.5) * 0.5, r() * Math.PI * 2, (r() - 0.5) * (shape.pyramidal ? 0.35 : 1.4));
      const scale = 0.85 + r() * 0.5;
      group.scale.setScalar(scale);
      this.scene.add(group);
      this.neurons.push({
        group, mats: [dendMat, tipMat, somaMat], sickU, fireU, scale,
        // stratified: sides alternate and every stretch of the page gets its share, so no screen is empty
        u: (i + 0.1 + r() * 0.8) / count, side: i % 2 ? 1 : -1, across: 0.1 + r() * 0.8, z: -2.6 + r() * 3.6,
        onset: 0.05 + r() * 0.72, sick: 0, next: r() * 4, near: [],
      });
    }
    this.plaques = this.points(Math.round(count * 1.7), this.plaqueData, r, (n) => ({
      aSeed: Array.from({ length: n }, () => r()), aOnset: Array.from({ length: n }, () => 0.12 + r() * 0.8), aSize: Array.from({ length: n }, () => 40 + r() * 75),
    }), S.plaqueVert, S.plaqueFrag, { uPath: this.pathU, uPlaque: color("#d9739d"), uPlaqueCore: color("#a52a5c") });
    this.dust = this.points(Math.round(count * 16), this.dustData, r, (n) => ({
      aSeed: Array.from({ length: n }, () => r()), aSize: Array.from({ length: n }, () => 2.2 + r() * 3.6),
    }), S.dustVert, S.dustFrag, { uInk: color("#3b2a5e") });
  }

  private points(
    n: number, data: { u: number; side: number; across: number; z: number }[], r: () => number,
    attrs: (n: number) => Record<string, number[]>, vert: string, frag: string, extra: Record<string, { value: unknown }>,
  ) {
    for (let i = 0; i < n; i++) data.push({ u: r(), side: r() < 0.5 ? -1 : 1, across: r(), z: -3 + r() * 4 });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    for (const [k, v] of Object.entries(attrs(n))) g.setAttribute(k, new THREE.BufferAttribute(new Float32Array(v), 1));
    const m = new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms: { ...this.shared, ...extra }, transparent: true, depthWrite: false });
    const p = new THREE.Points(g, m);
    p.frustumCulled = false;
    this.scene.add(p);
    return p;
  }

  /** where something sits, in world units, for the current viewport and page height */
  private place(u: number, side: number, across: number, z: number, out: THREE.Vector3) {
    const persp = CAM_Z / (CAM_Z - z); // things nearer the lens look bigger, so pull them in to stay in the margin
    const contentHalf = Math.min(window.innerWidth / 2, 499) * this.wpp;
    const outer = this.hw * 1.08;
    if (this.narrow || outer - contentHalf < 0.55) {
      out.set((side * across * this.hw * 0.95) / persp, 0, z);
    } else {
      const inner = contentHalf + 0.18;
      out.set((side * (inner + across * (outer - inner))) / persp, 0, z);
    }
    out.y = this.hh * 0.55 - u * this.fieldH;
    return out;
  }

  layout() {
    const w = window.innerWidth, h = window.innerHeight, dpr = this.renderer.getPixelRatio();
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.hh = CAM_Z * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    this.hw = this.hh * this.camera.aspect;
    this.wpp = (2 * this.hh) / h;
    this.narrow = w < 760;
    this.fieldH = document.documentElement.scrollHeight * this.wpp * PAR;
    const half = Math.min(w / 2, 499);
    this.shared.uContent.value.set((w / 2 - half) * dpr, (w / 2 + half) * dpr, 46 * dpr, this.narrow ? 0.45 : 0.8);
    this.shared.uFade.value = this.narrow ? 0.35 : 0;
    this.shared.uScale.value = dpr * CAM_Z * Math.min(1.3, Math.max(0.75, h / 900));
    const v = new THREE.Vector3();
    for (const n of this.neurons) n.group.position.copy(this.place(n.u, n.side, n.across, n.z, v));
    for (const [pts, data] of [[this.plaques, this.plaqueData], [this.dust, this.dustData]] as const) {
      const pos = pts.geometry.getAttribute("position") as THREE.BufferAttribute;
      data.forEach((d, i) => { this.place(d.u, d.side, d.across, d.z, v); pos.setXYZ(i, v.x, v.y, v.z); });
      pos.needsUpdate = true;
    }
    // neighbours for cascades: within reach, nearest first
    for (const n of this.neurons) {
      n.near = this.neurons
        .filter((m) => m !== n)
        .map((m) => [m, m.group.position.distanceTo(n.group.position)] as [Neuron, number])
        .filter(([, d]) => d < 2.1)
        .sort((a, b) => a[1] - b[1])
        .slice(0, 5);
    }
    if (!this.running) this.renderOnce();
  }

  // ---------------------------------------------------------------- firing: one neuron sets off its neighbours
  private fire(n: Neuron, T: number, force = false) {
    if (T - n.fireU.value < COOLDOWN || (!force && n.sick > 0.93)) return;
    n.fireU.value = T;
    const p = (0.16 + 0.74 * this.excite) * (1 - 0.75 * n.sick) + (force ? 0.4 : 0);
    for (const [m, d] of n.near) {
      if (Math.random() < p * (1 - m.sick * 0.7)) this.queue.push({ n: m, at: T + 0.5 + d * 0.32 + Math.random() * 0.25 });
    }
    if (this.queue.length > 160) this.queue.splice(0, this.queue.length - 160);
  }

  private visible = (n: Neuron) => Math.abs(n.group.position.y - this.camY) < this.hh * 1.9;

  private update(T: number, dt: number, animate: boolean) {
    this.camY = -this.scrollS * this.wpp * PAR;
    const vel = dt > 0 ? (this.camY - this.lastCamY) / dt : 0;
    this.lastCamY = this.camY;
    const k = 1 - Math.exp(-dt * 7);
    this.shared.uVel.value = animate ? this.shared.uVel.value + (Math.max(-0.55, Math.min(0.55, vel * 0.07)) - this.shared.uVel.value) * k : 0;
    this.excite = Math.max(this.excite * Math.exp(-dt * 1.5), Math.min(1, Math.abs(vel) / 5));
    const cam = this.camera.position;
    const tx = animate ? this.pointer.x * 0.22 + Math.sin(T * 0.11) * 0.08 : 0;
    cam.x += (tx - cam.x) * (animate ? k : 1);
    cam.y = this.camY + (animate ? this.pointer.y * 0.08 : 0);
    this.camera.lookAt(0, this.camY, 0);

    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    // linear, so the six stages spread evenly down the page
    const path = Math.min(1, Math.max(0, (this.scrollS / max - 0.03) / 0.9));
    this.pathU.value = path;
    const stage = Math.min(6, 1 + Math.floor(path * 6));
    if (stage !== this.stage) { this.stage = stage; this.opts.onStage?.(stage); }

    for (const n of this.neurons) {
      n.sick = smooth(n.onset, n.onset + 0.24, path);
      n.sickU.value = n.sick;
      n.group.visible = this.visible(n);
      if (animate && n.group.visible && T >= n.next) {
        this.fire(n, T);
        n.next = T + -Math.log(1 - Math.random()) * (4.2 + 9 * n.sick) / (1 + 3.5 * this.excite) + 0.4;
      }
    }
    if (!animate) return;
    for (let i = this.queue.length - 1; i >= 0; i--) if (this.queue[i].at <= T) { this.fire(this.queue[i].n, T); this.queue.splice(i, 1); }
    if (this.pointer.moved) {
      this.pointer.moved = false;
      const p = this.toWorld(this.pointer.x, this.pointer.y);
      for (const n of this.neurons) if (n.group.visible && n.group.position.distanceTo(p) < 0.5 * n.scale) this.fire(n, T, true);
    }
  }

  private toWorld(nx: number, ny: number) {
    const v = new THREE.Vector3(nx, ny, 0.5).unproject(this.camera).sub(this.camera.position).normalize();
    return this.camera.position.clone().addScaledVector(v, -this.camera.position.z / v.z);
  }

  private frame = (now: number) => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 0.016;
    this.last = now;
    this.clock += dt;
    this.shared.uTime.value = this.clock;
    this.scrollS += (this.scrollT - this.scrollS) * (1 - Math.exp(-dt * 9));
    this.update(this.clock, dt, true);
    this.renderer.render(this.scene, this.camera);
  };

  private renderOnce() {
    this.scrollS = this.scrollT;
    this.update(this.clock, 0, false);
    this.renderer.render(this.scene, this.camera);
  }

  start() {
    if (this.running || this.opts.reduced || document.hidden) return;
    this.running = true;
    this.last = 0;
    this.raf = requestAnimationFrame(this.frame);
  }
  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }
  setPaused(paused: boolean) {
    this.opts.reduced = paused || matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (this.opts.reduced) {
      this.stop();
      this.clock = Math.max(this.clock, 3); // a paused field shows its cells fully grown
      this.shared.uTime.value = this.clock;
      this.renderOnce();
    } else this.start();
  }

  // ---------------------------------------------------------------- input
  private listen() {
    const on = <K extends keyof WindowEventMap>(type: K, fn: (e: WindowEventMap[K]) => void, opts?: AddEventListenerOptions) => {
      window.addEventListener(type, fn, opts);
      this.cleanup.push(() => window.removeEventListener(type, fn));
    };
    let pending = 0;
    const relayout = () => { cancelAnimationFrame(pending); pending = requestAnimationFrame(() => this.layout()); };
    on("resize", relayout);
    on("scroll", () => {
      this.scrollT = window.scrollY;
      if (!this.running) requestAnimationFrame(() => this.renderOnce());
    }, { passive: true });
    on("pointermove", (e) => {
      this.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
      this.pointer.moved = true;
    }, { passive: true });
    // tapping the tissue in the margin sets off a cascade from the nearest cell
    on("pointerdown", (e) => {
      const el = e.target as HTMLElement | null;
      if (!this.running || el?.closest("a, button, input, select, textarea, label, .slide, .panel, .form, .proposal, pre, table")) return;
      const p = this.toWorld((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
      const near = this.neurons.filter(this.visible).sort((a, b) => a.group.position.distanceTo(p) - b.group.position.distanceTo(p))[0];
      if (near && near.group.position.distanceTo(p) < 1.2) { this.excite = 1; this.fire(near, this.clock, true); }
    });
    // the agent's live feed: every new event fires a cell somewhere on screen
    const pulse = () => {
      const live = this.neurons.filter((n) => this.visible(n) && n.sick < 0.9);
      if (this.running && live.length) this.fire(live[Math.floor(Math.random() * live.length)], this.clock);
    };
    on("engram:pulse" as keyof WindowEventMap, pulse as never);
    const vis = () => (document.hidden ? this.stop() : this.start());
    document.addEventListener("visibilitychange", vis);
    this.cleanup.push(() => document.removeEventListener("visibilitychange", vis));
    // content loads after the first paint: re-place the field when the page grows or shrinks
    let lastH = document.documentElement.scrollHeight;
    const ro = new ResizeObserver(() => {
      const h = document.documentElement.scrollHeight;
      if (Math.abs(h - lastH) > window.innerHeight * 0.25) { lastH = h; relayout(); }
    });
    ro.observe(document.body);
    this.cleanup.push(() => ro.disconnect());
  }

  dispose() {
    this.stop();
    this.cleanup.forEach((f) => f());
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => x.dispose());
    });
    for (const s of this.shapes) { s.tubes.dispose(); s.tips.dispose(); }
    this.plaques.geometry.dispose();
    this.dust.geometry.dispose();
    this.renderer.dispose();
  }
}
