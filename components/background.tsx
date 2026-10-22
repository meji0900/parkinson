// The home page's reading: where Parkinson's comes from, what is known, what this agent cannot do.
import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { REFS, refHref, refLink } from "@/lib/sources";
import { BraakStages } from "./figures";
import { PlatePair } from "./plates";
import { Sec } from "./sections";

export function Background() {
  return (
    <Sec id="background" title="Background">
      <p>
        In 1817 James Parkinson, a surgeon in Hoxton, London, published <i>An Essay on the Shaking Palsy</i>. He described six people with a
        tremor at rest, a stooping posture and a gait that broke into a run. Forty-four years later Jean-Martin Charcot and Alfred Vulpian began
        calling it Parkinson&apos;s disease, and Charcot separated its slowness from weakness and added rigidity to the picture.
      </p>
      <blockquote className="pull">
        Involuntary tremulous motion, with lessened muscular power, in parts not in action and even when supported; with a propensity to bend
        the trunk forwards, and to pass from a walking to a running pace: the senses and intellects being uninjured.
        <cite>James Parkinson, the opening definition of the essay, 1817</cite>
      </blockquote>
      <PlatePair a="essay" b="hoxton" />
      <p>
        The cells the disease destroys are the pigmented dopamine neurons of the substantia nigra, the &ldquo;black substance&rdquo; of the
        midbrain. Friedrich Lewy described round inclusions in other brainstem nuclei in 1912; in 1919 Konstantin Tretiakoff found them in the
        surviving nigral neurons, named them after Lewy, and tied the loss of those neurons to the disease. Since 1997 we have known that Lewy
        bodies are made largely of α-synuclein.
      </p>
      <PlatePair a="lewy_he" b="gowers" />
      <p>
        By the time the motor signs appear, roughly a third to a half of the nigral dopamine neurons and more than half of their endings in the
        striatum are gone. Levodopa, first injected in 1961 and approved in 1970, still treats the symptoms better than anything else. Nothing yet
        slows the disease: in 2026 the first large trial of a LRRK2 inhibitor found no effect on progression, and the antibody prasinezumab, which
        narrowly missed its own phase 2b endpoint, has moved to phase 3.
      </p>
      <p>
        Genome-wide studies have found 90 independent risk signals in people of European ancestry and 78 loci across ancestries. Rare variants
        in <i>SNCA</i>, <i>LRRK2</i>, <i>VPS35</i>, <i>PRKN</i>, <i>PINK1</i> and <i>PARK7</i> cause inherited forms, and variants in{" "}
        <i>GBA1</i> are the most common genetic risk factor. Many of these genes meet in three places: the lysosome (<i>GBA1</i>,{" "}
        <i>TMEM175</i>, <i>ATP13A2</i>), the clearing of damaged mitochondria (<i>PINK1</i>, <i>PRKN</i>), and the traffic of vesicles between
        them (<i>LRRK2</i>, <i>VPS35</i>, <i>RAB32</i>).
      </p>
      <BraakStages />
      <p>
        A hypothesis a lab can test names four things: a gene, a cell type, a direction of perturbation, and a measurable readout. {BRAND.name}
        produces hypotheses in that form. <Link href="/parkinsons">The longer history, the genes and the treatments are on their own page.</Link>
      </p>
    </Sec>
  );
}

const HOME_REFS = [
  "parkinson1817", "volpato2025", "kamath2022", "martirosyan2024", "wang2024", "asap", "braak2003", "spillantini1997", "nalls2019", "kim2024", "sidransky2009",
  "cheng2010", "nelson2015", "plate1995",
] as const;

export function Sources() {
  return (
    <Sec id="sources" title="Sources">
      <ol className="refs">
        {HOME_REFS.map((id) => {
          const r = REFS[id];
          return <li key={id}>{r.text} <a href={refHref(r)}>{refLink(r)}</a></li>;
        })}
        <li>
          Open Targets Platform <a href="https://platform.opentargets.org/disease/MONDO_0005180">platform.opentargets.org</a> · Human Protein
          Atlas <a href="https://www.proteinatlas.org/">proteinatlas.org</a> · ClinicalTrials.gov <a href="https://clinicaltrials.gov/">clinicaltrials.gov</a> ·
          PubMed <a href="https://pubmed.ncbi.nlm.nih.gov/">pubmed.ncbi.nlm.nih.gov</a> · Reactome <a href="https://reactome.org/">reactome.org</a>
        </li>
      </ol>
    </Sec>
  );
}

export function Limits() {
  return (
    <Sec id="limits" title="Limits">
      <ul className="limits">
        <li>Nothing here has been tested in a lab. It is not medical advice; if you live with Parkinson&apos;s, your neurologist is the person to ask.</li>
        <li>Unless real atlas data is installed, predictions are tested on a simulated cohort. Those results test the method, not biology.</li>
        <li>In the nigra, the dopamine neurons that remain in late disease are survivors. A change in their average can be survivorship, not a change in any cell.</li>
        <li>Predicted readouts come from a fixed table keyed on cell type and pathway, not from data on the gene.</li>
        <li>The Protein Atlas has no single-cell profile of midbrain dopamine neurons; midbrain enrichment stands in for it.</li>
        <li>Searches for short symbols such as <i>TH</i> also match unrelated papers and trials.</li>
        <li>The weights are a choice. Every entry shows the six scores behind it.</li>
        <li>Only genes are investigated, not compounds. Testnet tokens have no value, and no token is a claim on any result.</li>
      </ul>
    </Sec>
  );
}
