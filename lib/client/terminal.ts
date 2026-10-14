// The console's engine: types the agent's events into a scrolling element. Imperative on purpose:
// a character-by-character type-out through React state would re-render hundreds of times a second.
export type Part = [string, string?];
export type Ev = { k: string; x: string; fac?: string; gene?: string | null; [extra: string]: unknown };
export type Hooks = {
  onGene?: (g: string) => void;
  onHypothesis?: (h: unknown) => void;
  onReceipt?: () => void;
};

const FAC: Record<string, string> = { genetics: "genetics", cell: "cell type", chem: "chemistry", clinic: "trials", lit: "literature", path: "pathways" };
const ORDER = ["genetics", "cell", "chem", "clinic", "lit", "path"];
const num = (x: unknown) => { const v = Number(x || 0); return (Math.abs(v) < 0.005 ? 0 : v).toFixed(2); };

export const BANNER = [
  "",
  "     genetics ─╮         ╭─ trials",
  "    cell type ─┼── ◉ ────┼─ literature",
  "    chemistry ─╯ engram  ╰─ pathways",
  "",
];

export class Terminal {
  run = 0;
  instant = false;
  constructor(private el: HTMLElement, private hooks: Hooks = {}) {}

  private atBottom() {
    return this.el.scrollHeight - this.el.scrollTop - this.el.clientHeight < 60;
  }

  async type(parts: Part[], id: number, speed = 9, cls = "") {
    const follow = this.atBottom();
    const p = document.createElement("p");
    p.className = `cur ${cls}`.trim();
    this.el.appendChild(p);
    while (this.el.childElementCount > 600) this.el.firstElementChild?.remove();
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    for (const [text, c] of parts) {
      const s = document.createElement("span");
      if (c) s.className = c;
      p.appendChild(s);
      if (reduce || !speed || document.hidden || this.instant) { s.textContent = text; continue; }
      const t0 = performance.now();
      for (;;) {
        if (id !== this.run) { p.classList.remove("cur"); return; }
        const n = document.hidden ? text.length : Math.min(text.length, Math.ceil((performance.now() - t0) / speed) * 2);
        s.textContent = text.slice(0, n);
        if (follow) this.el.scrollTop = this.el.scrollHeight;
        if (n >= text.length) break;
        await new Promise((r) => requestAnimationFrame(r));
      }
    }
    p.classList.remove("cur");
    if (follow) this.el.scrollTop = this.el.scrollHeight;
  }

  line = (text: string, id: number, cls = "dim") => this.type([[text, cls]], id, 0);
  say = (text: string, id: number, cls = "", speed = 9) => this.type([["<engram> ", "tag"], [text, cls]], id, speed);

  async banner(id: number) {
    for (const l of BANNER) await this.type([[l]], id, 2, "art");
  }

  private convergence(rec: Record<string, { cos: number; next: number; ok: boolean }>, findings: Record<string, string>) {
    return ORDER.map((f, i) => {
      const r = rec[f] ?? { cos: 0, next: 0, ok: true };
      const joint = i === 0 ? "─╮" : i === ORDER.length - 1 ? "─╯" : i === 2 ? "─┼─▶ ◉" : "─┤";
      return `${FAC[f].padStart(12)} ${joint}`.padEnd(22) + `${(findings[f] ?? "").padEnd(9)} cos ${num(r.cos)}  next ${num(r.next)}${r.ok ? "" : "  lost"}`;
    });
  }

  async render(e: Ev, id: number): Promise<void> {
    const who = (f?: string) => (FAC[f ?? ""] ?? f ?? "").padEnd(11);
    switch (e.k) {
      case "wake": {
        const g = e.gene ?? (e.x.match(/subject: ([^.]+)/) ?? [])[1] ?? "";
        if (g) this.hooks.onGene?.(g);
        await this.type([["engram@bench:~$ ", "dim"], [`investigate ${g}`, "hi"]], id, 0);
        return this.say(e.x.split(". ").slice(1).join(". "), id);
      }
      case "src": return this.type([["   " + e.x, "dim"]], id, 4);
      case "recall": return this.say(e.x, id, "dim");
      case "open": return this.type([["   ┊ ", "dim"], [who(e.fac), "who"], ["→ " + e.x.replace(/^[a-z ]+ is /, ""), "dim"]], id, 5);
      case "find": return this.type([["   ┊ ", "dim"], [who(e.fac), "who"], ["│ " + e.x]], id, 7);
      case "merge": {
        await this.type([["   " + e.x, "dim"]], id, 5);
        const rows = this.convergence((e.rec ?? {}) as never, (e.findings ?? {}) as Record<string, string>);
        for (const r of rows) await this.type([[r]], id, 3, "art");
        return;
      }
      case "speak": this.hooks.onHypothesis?.(e.hyp); return this.say(e.x, id, "hi", 12);
      case "done": return this.say(e.x, id, "", 10);
      case "receipt": this.hooks.onReceipt?.(); return this.say(e.x, id, "hi", 8);
      case "stop": return this.say(e.x, id, "dim");
      case "say": return this.say(e.x, id, "", 9);
      case "art": for (const l of String(e.x).split("\n")) await this.type([[l]], id, 3, "art"); return;
      case "swarm": {
        const lead = !e.fac || e.fac === "swarm";
        return this.type([["   ✦ ", "dim"], [(e.fac ?? "swarm").padEnd(12), "who"], [lead ? e.x : "│ " + e.x, lead ? "hi" : ""]], id, 5);
      }
      case "atlas": return this.type([["   ◇ ", "dim"], ["atlas".padEnd(12), "who"], [e.x, "dim"]], id, 5);
      case "register": return this.type([["   ◇ ", "dim"], ["atlas".padEnd(12), "who"], [e.x]], id, 6);
      case "test": return this.type([["   ◇ ", "dim"], ["atlas".padEnd(12), "who"], ["│ " + e.x]], id, 6);
      case "pass": return this.say(e.x, id, "ok", 10);
      default: return this.type([[e.x ?? "", "dim"]], id);
    }
  }

  async renderInstant(e: Ev, id: number) {
    const was = this.instant;
    this.instant = true;
    try { await this.render(e, id); } finally { this.instant = was; }
  }
}
