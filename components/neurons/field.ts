// The nigral field: pigmented dopamine neurons in the margins, seen through a microscope. Scrolling moves
// the slide (the field travels at 82% of page speed, so it sits behind the text) and walks the tissue from
// Braak stage 1 to 6: Lewy bodies form inside the cells, the neuromelanin pales, dendrites die back, Lewy
// neurites gather, and the vulnerable neurons are lost one by one, the way the substantia nigra turns pale
// in Parkinson's. Fast scrolling, the pointer and the agent's own live events set off cascades of firing.
import * as THREE from "three";
import { FRAME } from "@/lib/layout";
import { makeShape, rng, type Shape } from "./grow";
import * as S from "./shaders";

const PAPER = "#eff2f6";
const INKS = ["#18212f", "#1f2b40", "#26344d", "#1b2638"];
const PULSE = "#3d7fd6";
const PAR = 0.82;
const CAM_Z = 9;
const FOV = 34;
const COOLDOWN = 1.7;

type Neuron = {
  group: THREE.Group; mats: THREE.ShaderMaterial[]; sickU: { value: number }; fireU: { value: number }; goneU: { value: number }; bornU: { value: number };
  u: number; side: number; across: number; z: number; scale: number; onset: number; sick: number; gone: number; vulnerable: boolean;
  next: number; near: [Neuron, number][];
};
export type FieldOptions = { reduced: boolean; onStage?: (stage: number, pigmented: number) => void };

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
  private neurites!: THREE.Points;
  private dust!: THREE.Points;
  private neuriteData: { u: number; side: number; across: number; z: number }[] = [];
  private dustData: { u: number; side: number; across: number; z: number }[] = [];
  private pigment!: THREE.Points;
  private pigmentData: { n: number; dx: number; dy: number; dz: number }[] = [];
  private queue: { n: Neuron; at: number }[] = [];
  private pathU = { value: 0 };
  private hh = 1; private hw = 1; private wpp = 0.01; private fieldH = 10; private narrow = false;
  private scrollT = 0; private scrollS = 0; private camY = 0; private lastCamY = 0; private excite = 0;
  private pointer: { x: number; y: number; moved: boolean } = { x: 0, y: 0, moved: false };
  private stage = 0; private pigmented = 100; private raf = 0; private running = false; private last = 0; private clock = 0;
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
    // fewer cells when the frame leaves room only on the right
    const z0 = this.zone();
    const twoSides = !z0 || z0[0] > 200;
    const count = Math.round(Math.min(64, Math.max(10, pages * (this.narrow ? 1.6 : twoSides ? 3.2 : 2.2))));
    for (let i = 0; i < 12; i++) this.shapes.push(makeShape(1000 + i * 7919));
    const somaGeo = new THREE.IcosahedronGeometry(1, 3);
    for (let i = 0; i < count; i++) {
      const shape = this.shapes[i % this.shapes.length];
      const ink = color(INKS[Math.floor(r() * INKS.length)]);
      const sickU = { value: 0 }, fireU = { value: -10 }, goneU = { value: 0 };
      // born: the cells grow out of their somas once, a beat apart, as the page opens
      const bornU = { value: this.opts.reduced ? -100 : 0.15 + r() * 1.1 };
      const own = { uInk: ink, uSick: sickU, uFireT: fireU, uGone: goneU, uPulse: color(PULSE), uBorn: bornU };
      const dendMat = new THREE.ShaderMaterial({
        vertexShader: S.dendriteVert, fragmentShader: S.dendriteFrag,
        uniforms: { ...this.shared, ...own, uSickInk: color("#a7b0be") },
      });
      const tipMat = new THREE.ShaderMaterial({ vertexShader: S.tipVert, fragmentShader: S.tipFrag, uniforms: { ...this.shared, ...own } });
      const somaMat = new THREE.ShaderMaterial({
        vertexShader: S.somaVert, fragmentShader: S.somaFrag,
        uniforms: {
          ...this.shared, ...own, uSeed: { value: r() * 10 }, uNucleus: color("#e7ecf3"),
          uMelanin: color("#3d230f"), uLewy: color("#b2456c"), uHalo: color("#f1e6df"),
        },
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
        group, mats: [dendMat, tipMat, somaMat], sickU, fireU, goneU, bornU, scale,
        // stratified: sides alternate and every stretch of the page gets its share, so no screen is empty
        u: (i + 0.1 + r() * 0.8) / count, side: i % 2 ? 1 : -1, across: 0.1 + r() * 0.8, z: -2.6 + r() * 3.6,
        // about seven in ten are the vulnerable kind; the rest survive to the end, as some nigral neurons do
        onset: 0.05 + r() * 0.6, sick: 0, gone: 0, vulnerable: r() < 0.7, next: r() * 4, near: [],
      });
    }
    this.neurites = this.points(Math.round(count * 1.5), this.neuriteData, r, (n) => ({
      aSeed: Array.from({ length: n }, () => r()), aOnset: Array.from({ length: n }, () => 0.12 + r() * 0.8), aSize: Array.from({ length: n }, () => 46 + r() * 70),
    }), S.neuriteVert, S.neuriteFrag, { uPath: this.pathU, uThread: color("#8b5a2b"), uBead: color("#6b4220"), uGone: { value: 0 } });
    this.dust = this.points(Math.round(count * 16), this.dustData, r, (n) => ({
      aSeed: Array.from({ length: n }, () => r()), aSize: Array.from({ length: n }, () => 2.2 + r() * 3.6),
    }), S.dustVert, S.dustFrag, { uInk: color("#2c4366"), uGone: { value: 0 } });

    // free neuromelanin and gathering glia, at the place of each neuron that will be lost
    const seeds: number[] = [], onsets: number[] = [], sizes: number[] = [], kinds: number[] = [];
    this.neurons.forEach((n, i) => {
      if (!n.vulnerable) return;
      const k = 7 + Math.floor(r() * 5);
      for (let j = 0; j < k; j++) {
        const glia = r() < 0.35;
        const a = r() * Math.PI * 2, d = 0.05 + r() * 0.24;
        this.pigmentData.push({ n: i, dx: Math.cos(a) * d, dy: Math.sin(a) * d * 0.8, dz: (r() - 0.5) * 0.2 });
        seeds.push(r()); onsets.push(n.onset + 0.3 + r() * 0.1); sizes.push(glia ? 8 + r() * 4 : 5 + r() * 10); kinds.push(glia ? 1 : 0);
      }
    });
    const pg = new THREE.BufferGeometry();
    pg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(this.pigmentData.length * 3), 3));
    for (const [k, v] of Object.entries({ aSeed: seeds, aOnset: onsets, aSize: sizes, aKind: kinds })) pg.setAttribute(k, new THREE.BufferAttribute(new Float32Array(v), 1));
    this.pigment = new THREE.Points(pg, new THREE.ShaderMaterial({
      vertexShader: S.pigmentVert, fragmentShader: S.pigmentFrag, transparent: true, depthWrite: false,
      uniforms: { ...this.shared, uPath: this.pathU, uMelanin: color("#3d230f"), uGlia: color("#2c4366"), uGone: { value: 0 } },
    }));
    this.pigment.frustumCulled = false;
    this.scene.add(this.pigment);
  }

  /** the reading area in px (rail and text column), or null when the page is a single centred column */
  private zone(): [number, number] | null {
    const w = window.innerWidth;
    if (w < FRAME.breakpoint) return null;
    const left = Math.max(0, (w - FRAME.max) / 2) + FRAME.pad;
    return [left, left + FRAME.rail + FRAME.gap + FRAME.col];
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
    const z0 = this.zone();
    if (z0 && !this.narrow) {
      // the frame: the rail and the text sit left, so the tissue lives to the right (and left too on wide screens)
      const w = window.innerWidth;
      const leftRoom = z0[0] - 30, rightRoom = w - z0[1] - 30;
      const px = side < 0 && leftRoom > 170 ? 10 + across * (leftRoom - 20) : z0[1] + 36 + across * Math.max(80, rightRoom);
      out.set(((px - w / 2) * this.wpp) / persp, 0, z);
    } else if (this.narrow || outer - contentHalf < 0.55) {
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
    const z0 = this.zone();
    if (z0) this.shared.uContent.value.set((z0[0] - 10) * dpr, z0[1] * dpr, 40 * dpr, 0.85);
    else this.shared.uContent.value.set((w / 2 - half) * dpr, (w / 2 + half) * dpr, 46 * dpr, this.narrow ? 0.45 : 0.8);
    this.shared.uFade.value = this.narrow ? 0.35 : 0;
    this.shared.uScale.value = dpr * CAM_Z * Math.min(1.3, Math.max(0.75, h / 900));
    const v = new THREE.Vector3();
    for (const n of this.neurons) n.group.position.copy(this.place(n.u, n.side, n.across, n.z, v));
    for (const [pts, data] of [[this.neurites, this.neuriteData], [this.dust, this.dustData]] as const) {
      const pos = pts.geometry.getAttribute("position") as THREE.BufferAttribute;
      data.forEach((d, i) => { this.place(d.u, d.side, d.across, d.z, v); pos.setXYZ(i, v.x, v.y, v.z); });
      pos.needsUpdate = true;
    }
    const pp = this.pigment.geometry.getAttribute("position") as THREE.BufferAttribute;
    this.pigmentData.forEach((d, i) => {
      const n = this.neurons[d.n];
      pp.setXYZ(i, n.group.position.x + d.dx * n.scale, n.group.position.y + d.dy * n.scale, n.group.position.z + d.dz);
    });
    pp.needsUpdate = true;
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
    if (T - n.fireU.value < COOLDOWN || n.gone > 0.6 || (!force && n.sick > 0.93)) return;
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

    let left = 0;
    for (const n of this.neurons) {
      n.sick = smooth(n.onset, n.onset + 0.24, path);
      n.sickU.value = n.sick;
      // a vulnerable cell is lost some time after its Lewy body forms
      n.gone = n.vulnerable ? smooth(n.onset + 0.22, n.onset + 0.42, path) : 0;
      n.goneU.value = n.gone;
      if (n.gone < 0.5) left++;
      n.group.visible = this.visible(n) && n.gone < 0.995;
      if (animate && n.group.visible && T >= n.next) {
        this.fire(n, T);
        n.next = T + -Math.log(1 - Math.random()) * (4.2 + 9 * n.sick) / (1 + 3.5 * this.excite) + 0.4;
      }
    }
    const pigmented = Math.round((100 * left) / Math.max(1, this.neurons.length));
    if (stage !== this.stage || pigmented !== this.pigmented) {
      this.stage = stage; this.pigmented = pigmented;
      this.opts.onStage?.(stage, pigmented);
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
  /** the cells grow out of their somas again, a beat apart */
  reset() {
    for (const n of this.neurons) { n.bornU.value = this.clock + 0.1 + Math.random() * 1.1; n.fireU.value = -10; }
    this.queue = [];
    if (!this.running) { this.clock += 3; this.shared.uTime.value = this.clock; this.renderOnce(); }
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
    on("parkinson:pulse" as keyof WindowEventMap, pulse as never);
    on("parkinson:reset" as keyof WindowEventMap, (() => this.reset()) as never);
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
    this.neurites.geometry.dispose();
    this.pigment.geometry.dispose();
    this.dust.geometry.dispose();
    this.renderer.dispose();
  }
}
