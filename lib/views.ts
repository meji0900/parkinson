// Read models: everything the pages and the API show is computed here from the ledgers.
import { listReceipts, receiptCount } from "@/lib/agent/receipts";
import { recentRuns, runsFor } from "@/lib/agent/pipeline";
import type { RunRecord } from "@/lib/agent/types";
import { notebookNights, queueLength } from "@/lib/agent/worker";
import { AXIS_LABEL, AXIS_SHORT, cohorts, confirmation, stagesOf, type Axis } from "@/lib/atlas/cohort";
import { ALPHA, covariateWords, listExperiments, type Experiment } from "@/lib/atlas/experiments";
import { fisherExact, fmtE, fmtP, type Stat } from "@/lib/atlas/stats";
import { listStudies, STUDIES } from "@/lib/atlas/studies";
import { listCases, swarmStats } from "@/lib/atlas/swarm";
import { BRAND } from "@/lib/brand";
import { all, json, kvGet, one } from "@/lib/server/db";

const count = (sql: string, ...p: (string | number)[]) => one<{ n: number }>(sql, ...p)?.n ?? 0;

/** "the ventral tegmental area, the neighbouring dopamine nucleus that Parkinson's largely spares", or the independent cohort */
export function confirmWords() {
  const c = confirmation();
  return c.kind === "region"
    ? `the ${c.name}, the neighbouring dopamine nucleus that Parkinson's largely spares`
    : `an independent cohort, the ${c.name} (${c.donors} donors)${c.proxy ? `, where outcomes it was not staged for are checked as ${c.proxy}` : ""}`;
}

export function atlasInfo() {
  const { primary, second } = cohorts();
  const d = primary.donors;
  const conf = confirmation();
  const stage = primary.resilienceStage;
  return {
    state: "done",
    id: primary.id,
    simulated: primary.simulated,
    label: primary.label,
    region: primary.region,
    cells: primary.cells,
    donors: d.length,
    genes: primary.genes,
    groups: primary.groups,
    axes: primary.axes.map((a) => ({ key: a, label: AXIS_LABEL[a] })),
    covariates: covariateWords(primary),
    source: primary.source ?? null,
    staging: {
      stages: stagesOf(primary),
      parkinsonism: d.filter((x) => x.parkinsonism).length,
      heavy: d.filter((x) => x.braak >= stage).length,
      resilient: d.filter((x) => x.braak >= stage && !x.parkinsonism).length,
      resilience_stage: stage,
    },
    second: {
      label: second.label, region: second.region, donors: second.donors.length, simulated: second.simulated,
      kind: conf.kind, name: conf.name, short: conf.short, proxy: conf.proxy, source: second.source ?? null,
    },
  };
}

const testedOnPrimary = () => {
  const { primary } = cohorts();
  return listExperiments({ limit: 2000 }).filter((e) => e.cohort === primary.id && e.state === "tested");
};

export function funnel() {
  const { primary, second } = cohorts();
  const tested = testedOnPrimary();
  const held = tested.filter((e) => e.passed);
  const comp = held.filter((e) => e.checks?.composition?.ok).length;
  const same = held.filter((e) => e.checks?.second?.same_sign);
  const nominal = same.filter((e) => (e.checks?.second?.p ?? 1) < ALPHA).length;
  const strict = same.filter((e) => (e.checks?.second?.p ?? 1) < ALPHA / Math.max(1, held.length)).length;
  return {
    simulated: primary.simulated,
    cohort: primary.label,
    region: primary.region,
    second_region: confirmation().name,
    stages: [
      { key: "tested", n: tested.length, label: "predictions sealed, then tested" },
      { key: "held", n: held.length, label: "held in both donor halves" },
      { key: "composition", n: comp, of: held.length, label: "hold with the cell mix controlled" },
      { key: "second_same", n: same.length, of: held.length, label: `same way in the ${confirmation().name}` },
      { key: "second_nominal", n: nominal, label: "at p < 0.05 there" },
      { key: "second_strict", n: strict, label: "survive correction for every test" },
    ],
    next: { key: "lab", n: 0, label: "tested in a lab, which is what would count" },
    receipts: receiptCount(),
    swarm: swarmStats(),
    by_source: all<{ source: string; n: number; held: number }>(
      "select source, count(*) as n, coalesce(sum(passed), 0) as held from experiments where state = 'tested' and cohort = ? group by source order by n desc", primary.id,
    ),
  };
}

export function notebook() {
  const nights = notebookNights(1);
  const night = nights[0];
  const picks = night
    ? json<{ symbol: string }[]>(night.data, [])
    : all<{ symbol: string }>("select symbol from runs where passed = 1 group by symbol order by max(score) desc limit 12");
  const entries = picks
    .map((p) => runsFor(p.symbol, 1)[0])
    .filter((r): r is RunRecord => !!r && !!r.hypothesis)
    .map((r) => ({ symbol: r.symbol, name: r.name, at: r.at, hypothesis: r.hypothesis! }));
  return {
    night: night?.night ?? null,
    at: night?.at ?? null,
    pool: night?.pool ?? kvGet<number>("pool_size", 0),
    investigated: night?.investigated ?? count("select count(distinct symbol) as n from runs"),
    entries,
  };
}

export function geneRecord(symbol: string) {
  const runs = runsFor(symbol, 5);
  return {
    symbol,
    latest: runs[0] ?? null,
    history: runs.map((r) => ({ at: r.at, score: r.score, passed: r.passed, receipt: r.receipt ?? null })),
    experiments: listExperiments({ gene: symbol }),
    receipts: listReceipts(30, undefined, symbol),
    swarm: listCases(10, symbol),
    studies: listStudies().filter((s) => s.def.genes.includes(symbol)).map((s) => ({ id: s.id, title: s.def.title, state: s.state, passed: s.result?.passed ?? null })),
    planned: STUDIES.filter((s) => s.genes.includes(symbol)).map((s) => s.id),
  };
}

export function geneIndex() {
  const runs = all<{ symbol: string; name: string; score: number; at: string; passed: number }>(
    "select symbol, name, score, at, passed from runs where id in (select max(id) from runs group by symbol) order by symbol",
  );
  const exps = new Map(
    all<{ gene: string; n: number; held: number }>("select gene, count(*) as n, coalesce(sum(passed), 0) as held from experiments where state = 'tested' and cohort = ? group by gene", cohorts().primary.id)
      .map((r) => [r.gene, r]),
  );
  const genes = runs.map((r) => ({ ...r, tested: exps.get(r.symbol)?.n ?? 0, held: exps.get(r.symbol)?.held ?? 0 }));
  // genes registered by visitors or agents without a full six-source reading are listed too
  for (const [gene, e] of exps) if (!runs.some((r) => r.symbol === gene)) genes.push({ symbol: gene, name: "", score: NaN, at: "", passed: 0, tested: e.n, held: e.held });
  genes.sort((a, b) => a.symbol.localeCompare(b.symbol));
  return { genes, held: genes.filter((g) => g.held > 0) };
}

export function leaderboard(limit = 20) {
  return all<{ wallet: string; n: number; held: number; rewarded: number; last: string }>(
    `select wallet, count(*) as n, coalesce(sum(passed), 0) as held, sum(case when reward_tx is not null then 1 else 0 end) as rewarded, max(at) as last
     from experiments where wallet is not null and state = 'tested' group by wallet order by held desc, n desc limit ?`, limit,
  );
}

export function report(day: string) {
  const next = new Date(Date.parse(day + "T00:00:00Z") + 864e5).toISOString().slice(0, 10);
  const between = "at >= ? and at < ?";
  const c = (sql: string) => one<{ n: number }>(sql, day, next)?.n ?? 0;
  const genes = c(`select count(distinct symbol) as n from runs where ${between}`);
  const proposals = c(`select count(*) as n from runs where passed = 1 and ${between}`);
  const receipts = c(`select count(*) as n from receipts where ${between}`);
  const tested = c(`select count(*) as n from experiments where state = 'tested' and ${between}`);
  const held = c(`select count(*) as n from experiments where passed = 1 and ${between}`);
  const visitors = c(`select count(*) as n from experiments where source in ('visitor', 'wallet', 'onchain', 'mcp') and ${between}`);
  const cases = c(`select count(*) as n from swarm_cases where opened >= ? and opened < ?`);
  const studies = c(`select count(*) as n from studies where state = 'done' and ${between}`);
  const heldRows = all<{ gene: string; grp: string; axis: string }>(`select gene, grp, axis from experiments where passed = 1 and ${between} order by at`, day, next);
  const best = all<{ symbol: string; score: number }>(`select symbol, max(score) as score from runs where passed = 1 and ${between} group by symbol order by score desc limit 5`, day, next);
  const { primary } = cohorts();
  const post = [
    `${day}: ${BRAND.name}, an agent working on Parkinson's disease in public`,
    `${genes} genes read, ${proposals} lab proposals, ${receipts} receipts printed`,
    `${tested} sealed predictions tested on the substantia nigra atlas, ${held} held in both donor halves${primary.simulated ? " (simulated cohort)" : ""}`,
    heldRows.length ? `held today: ${heldRows.slice(0, 4).map((h) => `${h.gene} in ${h.grp}`).join(", ")}${heldRows.length > 4 ? ` and ${heldRows.length - 4} more` : ""}` : "",
    best.length ? `best case for a lab: ${best.map((b) => `${b.symbol} ${b.score.toFixed(2)}`).join(", ")}` : "",
    "every failure has a public receipt.",
  ].filter(Boolean).join("\n");
  return { day, genes, proposals, receipts, tested, held, visitors, cases, studies, held_rows: heldRows, best, post };
}

export function reportDays(limit = 21) {
  return all<{ day: string; n: number }>("select substr(at, 1, 10) as day, count(*) as n from runs group by day order by day desc limit ?", limit);
}

export function overview() {
  return { runs: recentRuns(20), queue: queueLength(), receipts: receiptCount() };
}

// ---------------------------------------------------------------- findings: the checks on what held
const PUSH_DOWN = /INHIBITOR|ANTAGONIST|BLOCKER|NEGATIVE ALLOSTERIC|DEGRADER|INVERSE AGONIST|RELEASING AGENT/;
const PUSH_UP = /AGONIST|ACTIVATOR|POSITIVE ALLOSTERIC|OPENER|STABILISER|STABILIZER|INDUCER/;

/** +1 when the gene goes the way the disease goes (up with stage or loss, or lower in resilient donors), -1 when it goes the other way */
export function diseaseSign(e: Pick<Experiment, "axis" | "discovery">) {
  const s = Math.sign(e.discovery?.effect ?? 0);
  return e.axis === "resilience" ? -s : s;
}

export function findings() {
  const { primary, second } = cohorts();
  const tested = testedOnPrimary();
  const held = tested.filter((e) => e.passed);
  const latest = new Map<string, RunRecord | null>();
  const run = (g: string) => { if (!latest.has(g)) latest.set(g, runsFor(g, 1)[0] ?? null); return latest.get(g)!; };
  const strictAlpha = ALPHA / Math.max(1, held.length);

  // genetics: does human genetics already tie the genes that held to Parkinson's, more often than genes that never held?
  const heldGenes = [...new Set(held.map((e) => e.gene))];
  const neverHeld = [...new Set(tested.map((e) => e.gene))].filter((g) => !heldGenes.includes(g));
  const gen = (g: string) => run(g)?.findings.genetics.score ?? null;
  const supported = (gs: string[]) => gs.filter((g) => (gen(g) ?? 0) >= 0.1).length;
  const known = (gs: string[]) => gs.filter((g) => gen(g) != null).length;
  const a = supported(heldGenes), b = known(heldGenes) - a, c = supported(neverHeld), d = known(neverHeld) - c;
  const genetics = {
    held: { supported: a, read: a + b }, never: { supported: c, read: c + d },
    p: a + b && c + d ? fisherExact(a, b, c, d) : null,
    rows: heldGenes.map((g) => ({ gene: g, genetics: gen(g), overall: (run(g)?.findings.genetics.detail.overall as number | undefined) ?? null }))
      .sort((x, y) => (y.genetics ?? -1) - (x.genetics ?? -1)),
  };

  // compounds: what already acts on the genes that held, and whether it pushes against the disease direction
  const drugs = heldGenes.flatMap((g) => {
    const chem = run(g)?.findings.chem.detail as { drugs?: string[]; actions?: Record<string, number>; n_drugs?: number } | undefined;
    if (!chem?.drugs?.length) return [];
    const e = held.find((x) => x.gene === g)!;
    const sign = diseaseSign(e);
    const actions = Object.entries(chem.actions ?? {}).map(([action, n]) => {
      const dir = PUSH_DOWN.test(action) ? -1 : PUSH_UP.test(action) ? 1 : 0;
      return { action: action.toLowerCase(), n, against: dir !== 0 && dir === -sign };
    });
    return [{ gene: g, group: e.group, axis: e.axis, sign, drugs: chem.drugs, n_drugs: chem.n_drugs ?? chem.drugs.length, actions }];
  });

  return {
    simulated: primary.simulated,
    region: primary.region,
    second_region: confirmation().name,
    second_kind: confirmation().kind,
    second_proxy: confirmation().proxy,
    donors: primary.donors.length,
    second_donors: second.donors.length,
    tested: tested.length,
    held,
    strict_alpha: strictAlpha,
    composition: {
      ok: held.filter((e) => e.checks?.composition?.ok).length,
      lost: held.filter((e) => e.checks?.composition && !e.checks.composition.ok).length,
    },
    second: {
      measured: held.filter((e) => e.checks?.second).length,
      same: held.filter((e) => e.checks?.second?.same_sign).length,
      nominal: held.filter((e) => e.checks?.second?.same_sign && e.checks.second.p < ALPHA).length,
      strict: held.filter((e) => e.checks?.second?.same_sign && e.checks.second.p < strictAlpha).length,
    },
    genetics,
    drugs,
    studies: listStudies(),
    by_source: funnel().by_source,
  };
}

// ---------------------------------------------------------------- case studies, written from the ledgers
export type CaseStudy = { id: string; kicker: string; title: string; ascii: string; parts: { label: string; text: string }[]; limit: string };

const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(1)}%` : "n/a");
const st = (s: Stat | null | undefined) => (s ? `${fmtE(s.effect)} (p ${fmtP(s.p)})` : "n/a");
const pad = (n: number, w = 5) => String(n).padStart(w);
const axisWords: Record<Axis, string> = {
  braak: "tracks Braak Lewy-body stage",
  nigra: "tracks nigral neuron loss",
  resilience: "differs in resilient donors",
};

export function caseStudies(): { at: string; simulated: boolean; cases: CaseStudy[] } {
  const { primary, second } = cohorts();
  const f = funnel();
  const tested = testedOnPrimary();
  const held = tested.filter((e) => e.passed);
  const cases: CaseStudy[] = [];
  const label = (n: number) => `case ${String(n).padStart(2, "0")}`;
  const simNote = primary.simulated ? " · simulated cohort: tests the method, not biology" : "";

  if (tested.length) {
    const [t, h, comp, same, nominal, strict] = f.stages.map((s) => s.n);
    const luck = (t * 0.05 * 0.025).toFixed(1);
    cases.push({
      id: "denominator", kicker: label(cases.length + 1),
      title: `The denominator: ${t.toLocaleString("en")} predictions, ${h} held, ${strict} confirmed`,
      ascii: [
        `${pad(t)}  predictions registered and hashed before the data was read`,
        `${pad(h)}  held in both donor halves of the ${primary.region}`,
        `${pad(comp)}  still hold with the cell mix controlled`,
        `${pad(same)}  point the same way in the ${confirmation().name}   (chance: about ${Math.round(h / 2)})`,
        `${pad(nominal)}  nominally significant there (p < 0.05)`,
        `${pad(strict)}  pass the strict bar there (p < 0.05 / ${Math.max(1, h)})`,
      ].join("\n"),
      parts: [
        { label: "What was tested", text: `Each gene the agent picked up got predictions it sealed before reading the atlas: ${primary.agentAxes.map((a) => AXIS_LABEL[a]).join(", and ")}${primary.agentAxes.length === 1 ? ", in its cell group and in the dopamine neurons" : ", in its cell group"}. A prediction counts only if it reaches p < 0.05 on a random half of the ${primary.donors.length} donors, then again, the same way, on the other half.` },
        { label: "What happened", text: `${h} of ${t} held: ${pct(h, t)}. If nothing were real, about ${luck} would pass by luck. The ones that held were then retested in ${confirmWords()}: ${same} point the same way, ${nominal} at p < 0.05, and ${strict} clear a bar corrected for testing ${h} things at once.` },
        { label: "What it means", text: `Consistency between the two says the direction is not noise. It does not say the change is protective or harmful, and in the nigra it can be survivorship: the dopamine neurons left in late disease are not a random sample of the ones that were there. Case 03 takes that up.` },
      ],
      limit: `limit: ${confirmation().kind === "region" ? "two regions, largely the same donors" : "two cohorts, small ones"}; no covariate adjustment in the registered test; pseudobulk, not single cells${simNote}`,
    });
  }

  const confirmed = held.filter((e) => e.checks?.second?.same_sign).sort((x, y) => (x.checks!.second!.p - y.checks!.second!.p));
  const top = confirmed[0];
  if (top) {
    const s2 = top.checks!.second!;
    const strictAlpha = ALPHA / Math.max(1, held.length);
    cases.push({
      id: "strongest", kicker: label(cases.length + 1),
      title: `${top.gene}: the strongest confirmation so far`,
      ascii: [
        `${top.gene} · ${top.group} · ${axisWords[top.axis]}`,
        `  ${primary.region.padEnd(34)} ${st(top.discovery)} → ${st(top.replication)}   held`,
        `  cell mix controlled                ${top.checks?.composition ? `${fmtE(top.checks.composition.effect)} (p ${fmtP(top.checks.composition.p)}) ${top.checks.composition.ok ? "holds" : "does not hold"}` : "n/a"}`,
        `  ${confirmation().name.padEnd(34)} ${fmtE(s2.effect)} (p ${fmtP(s2.p)})${s2.proxy ? ` ${s2.proxy}` : ""}   bar ${fmtP(strictAlpha)}`,
      ].join("\n"),
      parts: [
        { label: "What happened", text: `${top.gene} in ${top.group} ${AXIS_LABEL[top.axis]}: ${st(top.discovery)} in the discovery half and ${st(top.replication)} in the held-out half. In the ${second.region} it points the same way at p ${fmtP(s2.p)}, ${s2.p < strictAlpha ? "under" : "above"} the corrected bar of ${fmtP(strictAlpha)}.` },
        { label: "What it would take", text: `It is still a correlation in post-mortem tissue. Whether ${top.gene} drives the change or answers it is what a perturbation would test: knock it down and overexpress it in iPSC dopamine neurons seeded with α-synuclein fibrils, and measure phospho-α-synuclein and neuron survival.` },
      ],
      limit: `limit: one region confirmed, in largely the same donors · ${top.group} pseudobulk${simNote}`,
    });
  }

  const mix = held.filter((e) => e.group === "dopamine neurons" && e.checks?.composition && !e.checks.composition.ok)[0]
    ?? held.filter((e) => e.checks?.composition && !e.checks.composition.ok)[0];
  if (mix) {
    cases.push({
      id: "mix", kicker: label(cases.length + 1),
      title: `${mix.gene}: a pass that may be the survivors, not the cells`,
      ascii: [
        `${mix.gene} · ${mix.group} · ${axisWords[mix.axis]}`,
        `  halves                 ${st(mix.discovery)} → ${st(mix.replication)}   held`,
        `  cell mix controlled    ${fmtE(mix.checks!.composition!.effect)} (p ${fmtP(mix.checks!.composition!.p)})   does not hold`,
      ].join("\n"),
      parts: [
        { label: "What happened", text: `${mix.gene} held in both halves, then lost it when each donor's share of ${mix.group} was taken into account.` },
        { label: "Why it matters in Parkinson's", text: `The pigmented neurons of the nigra are the cells that die. As they go, the share of dopamine-neuron nuclei falls and the ones left are the least vulnerable. A gene that marks the survivors will look as if it moves with Lewy stage, though no neuron changed. A system that kept only the split-half result would have published ${mix.gene}; the composition check is why it is listed here instead.` },
      ],
      limit: `limit: the cell-mix control is a share of nuclei, not a count of neurons in tissue${simNote}`,
    });
  }

  const reversed = tested.filter((e) => !e.passed && e.discovery && e.replication && e.discovery.p < ALPHA && Math.sign(e.discovery.effect) !== Math.sign(e.replication.effect))
    .sort((x, y) => x.discovery!.p - y.discovery!.p)[0];
  if (reversed) {
    const sc = reversed.receipt ? listCases(200, reversed.gene).find((c) => c.receipt === reversed.receipt) : undefined;
    const note = (agent: string) => sc?.agents.find((a) => a.agent === agent)?.said ?? "n/a";
    cases.push({
      id: "reversed", kicker: label(cases.length + 1),
      title: `${reversed.gene}: a first-half pass that reversed`,
      ascii: [
        `${reversed.gene} · ${reversed.group} · ${axisWords[reversed.axis]}`,
        `  discovery ${st(reversed.discovery)}   held-out ${st(reversed.replication)}   receipt ${String(reversed.receipt ?? 0).padStart(4, "0")}`,
        sc ? `swarm   power        ${note("power")}` : "",
        sc ? `        composition  ${note("composition")}` : "",
        sc ? `        verdict      ${sc.outcome}` : "",
      ].filter(Boolean).join("\n"),
      parts: [
        { label: "What happened", text: `${reversed.gene} passed the first half of the donors at p ${fmtP(reversed.discovery!.p)}, then pointed the other way on the second. The receipt stands.` },
        { label: "Why it is here", text: "This is the failure the receipts exist to catch. A single split of donors is a noisy judge of moderate effects, and a selection on the first half inflates what it finds. The swarm reopened the case from six angles instead of letting it disappear." },
      ],
      limit: `limit: one random split per prediction, fixed by its hash${simNote}`,
    });
  }

  const sw = swarmStats();
  if (sw.count) {
    const ups = all<{ gene: string; grp: string; axis: string; result: string; passed: number }>(
      "select gene, grp, axis, result, passed from followups where same_sign = 1 order by json_extract(result, '$.p') limit 6",
    );
    cases.push({
      id: "swarm", kicker: label(cases.length + 1),
      title: "The swarm turns receipts into the next test",
      ascii: [
        `${pad(sw.count)}  swarm cases opened on failed predictions`,
        `${pad(sw.followups)}  follow-ups registered for tissue the agent had not seen`,
        `${pad(sw.same_sign)}  of those point the same way in the ${confirmation().name}`,
        `${pad(sw.confirmed)}  pass the strict bar there`,
        "",
        ...ups.map((u) => { const r = json<{ effect?: number; p?: number }>(u.result, {}); return `  ${u.gene.padEnd(9)} ${u.grp.padEnd(18)} ${u.axis.padEnd(11)} ${fmtE(r.effect ?? 0)}  p ${fmtP(r.p ?? 1)}${u.passed ? "  confirmed" : ""}`; }),
      ].join("\n"),
      parts: [
        { label: "What happened", text: `Every failed prediction got a case. The analysts checked whether the effect was underpowered, confounded by ${covariateWords(primary)}, explained by the cell mix, or carried by one donor, and proposed better-aimed predictions. Proposals that survived the challenges were sealed and tested in ${confirmation().short}, at a bar corrected for every follow-up so far.` },
        { label: "Why it matters", text: "A negative result becomes the next experiment instead of a dead end. Because the swarm works on the donors whose test failed, it cannot confirm anything there; everything it proposes goes to tissue it has not read." },
      ],
      limit: `limit: follow-ups are chosen on the full first sample, then tested on ${confirmation().kind === "region" ? "largely the same donors' second region" : "an independent cohort that has no Lewy staging"}${simNote}`,
    });
  }

  const study = listStudies().find((s) => s.state === "done" && s.id === "lysosome") ?? listStudies().find((s) => s.state === "done");
  if (study?.result) {
    const r = study.result;
    cases.push({
      id: "study", kicker: label(cases.length + 1),
      title: `${study.def.title}: ${r.passed ? "the sealed rule held" : "the sealed rule did not hold"}`,
      ascii: [
        `${study.def.genes.length} genes · ${study.def.group} · ${axisWords[study.def.axis]} · sealed ${study.registration.slice(0, 12)}`,
        `  discovery half   ${st(r.discovery)}`,
        `  held-out half    ${st(r.replication)}`,
        `  all donors       ${st(r.full)}   beats ${r.random.beaten} of ${r.random.n} matched random sets`,
      ].join("\n"),
      parts: [
        { label: "The question", text: study.def.question },
        { label: "What happened", text: `${r.reason}.` },
      ],
      limit: `limit: a gene-set score averages genes that may not move together · the random sets match expression level only${simNote}`,
    });
  }

  return { at: new Date().toISOString(), simulated: primary.simulated, cases };
}
