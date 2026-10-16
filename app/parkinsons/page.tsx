import type { Metadata } from "next";
import Link from "next/link";
import { BraakStages, DatScan, SpiralTest } from "@/components/figures";
import { PlateById, PlatePair } from "@/components/plates";
import { Sec } from "@/components/sections";
import { REFS, refHref, refLink, type Ref } from "@/lib/sources";

export const metadata: Metadata = {
  title: "Parkinson's, 1817 to now",
  description: "What Parkinson's disease is, where it starts, which genes cause it, what treats it and what has not worked yet: the background to the agent's work, with sources.",
};

const R = (id: keyof typeof REFS, label: string) => <a href={refHref(REFS[id])}>{label}</a>;

type Entry = { yr: string; text: React.ReactNode; src?: React.ReactNode };
const TIMELINE: Entry[] = [
  { yr: "1817", text: <>James Parkinson publishes <i>An Essay on the Shaking Palsy</i>, 66 pages on six people. Two he met by chance in the street; one he only saw at a distance.</>, src: R("parkinson1817", "the essay") },
  { yr: "1861", text: <>Jean-Martin Charcot and Alfred Vulpian write of &ldquo;la maladie de Parkinson&rdquo;. Through the 1870s Charcot separates its slowness from weakness, adds rigidity, and describes forms without tremor.</>, src: R("goedert2018", "Goedert & Compston, 2018") },
  { yr: "1886", text: <>William Gowers draws the stooped posture for his <i>Manual of Diseases of the Nervous System</i> (1886–88); at the Salpêtrière, Paul Richer draws and sculpts Charcot&apos;s patients.</> },
  { yr: "1912", text: <>Friedrich Lewy describes round inclusions in the dorsal motor nucleus of the vagus and the nucleus basalis of Meynert.</>, src: R("goedert2013", "Goedert et al., 2013") },
  { yr: "1919", text: <>Konstantin Tretiakoff finds the pigmented neurons of the substantia nigra lost, sees the same inclusions in the survivors, and names them <i>corps de Lewy</i>.</>, src: R("lees2008", "Lees et al., 2008") },
  { yr: "1957", text: <>Arvid Carlsson shows that dopamine is a transmitter in its own right, and that L-DOPA reverses the stillness reserpine causes in animals. Nobel Prize, 2000.</>, src: R("carlsson1958", "Carlsson et al., 1958") },
  { yr: "1960", text: <>Herbert Ehringer and Oleh Hornykiewicz find dopamine depleted in the striatum of people who died with Parkinson&apos;s. In 1961 Birkmayer and Hornykiewicz give the first L-DOPA injections.</>, src: R("ehringer1960", "Ehringer & Hornykiewicz, 1960") },
  { yr: "1967", text: <>George Cotzias treats patients with high oral doses of DL-DOPA; pure levodopa follows in 1969. The FDA approves levodopa on 4 June 1970, and carbidopa/levodopa in 1975.</>, src: R("cotzias1967", "Cotzias et al., 1967") },
  { yr: "1983", text: <>J. William Langston traces parkinsonism in young drug users to MPTP, a contaminant that kills nigral neurons: the first toxin model in people.</>, src: R("langston1983", "Langston et al., 1983") },
  { yr: "1987", text: <>Alim-Louis Benabid&apos;s team stimulates the thalamus to stop tremor; stimulation of the subthalamic nucleus follows in 1993–95. The FDA approves thalamic stimulation for tremor in 1997, and subthalamic or pallidal stimulation for advanced Parkinson&apos;s in 2002.</>, src: R("limousin1995", "Limousin et al., 1995") },
  { yr: "1997", text: <>A mutation in α-synuclein (<i>SNCA</i>) causes Parkinson&apos;s in an Italian family, and Lewy bodies turn out to be made largely of α-synuclein.</>, src: <>{R("polymeropoulos1997", "Polymeropoulos et al.")}; {R("spillantini1997", "Spillantini et al.")}</> },
  { yr: "1998", text: <>Parkin (<i>PRKN</i>) is found behind juvenile recessive parkinsonism; <i>DJ-1</i> (2003), <i>PINK1</i> and <i>LRRK2</i> (2004) follow.</>, src: <>{R("kitada1998", "Kitada et al.")}; {R("zimprich2004", "Zimprich et al.")}</> },
  { yr: "2003", text: <>Heiko Braak and colleagues stage Lewy pathology: from the lower brainstem and olfactory bulb, up through the nigra, to the cortex.</>, src: R("braak2003", "Braak et al., 2003") },
  { yr: "2009", text: <>A sixteen-centre study shows that <i>GBA</i> variants raise Parkinson&apos;s risk about fivefold: the most common genetic risk factor.</>, src: R("sidransky2009", "Sidransky et al., 2009") },
  { yr: "2011", text: <><i>VPS35</i> becomes the third dominant gene. The FDA approves DaTscan, which images the dopamine transporter in the striatum.</>, src: R("vilarino2011", "Vilariño-Güell et al., 2011") },
  { yr: "2019", text: <>A genome-wide study of 37,688 cases finds 90 independent risk signals across 78 regions.</>, src: R("nalls2019", "Nalls et al., 2019") },
  { yr: "2022", text: <>A single-nucleus atlas of the human nigra finds that one population of dopamine neurons, marked by <i>SOX6</i> and <i>AGTR1</i>, selectively degenerates.</>, src: R("kamath2022", "Kamath et al., 2022") },
  { yr: "2023", text: <>A spinal-fluid test that amplifies misfolded α-synuclein detects Parkinson&apos;s with 87.7% sensitivity and 96.3% specificity.</>, src: R("siderowf2023", "Siderowf et al., 2023") },
  { yr: "2024", text: <>Two groups propose defining the disease by its biology (α-synuclein and neurodegeneration) rather than its symptoms, for research. A multi-ancestry study finds 78 loci; <i>RAB32</i> joins the genes. An extended-release levodopa capsule and a continuous levodopa infusion under the skin are approved.</>, src: <>{R("simuni2024", "Simuni et al.")}; {R("hoglinger2024", "Höglinger et al.")}; {R("kim2024", "Kim et al.")}</> },
  { yr: "2025", text: <>Two first trials of transplanted dopamine cells, from embryonic and from induced stem cells, report their safety results. The FDA approves adaptive deep brain stimulation. The exenatide phase 3 trial finds no benefit.</>, src: <>{R("tabar2025", "Tabar et al.")}; {R("sawamoto2025", "Sawamoto et al.")}; {R("vijiaratnam2025", "Vijiaratnam et al.")}</> },
  { yr: "2026", text: <>The first large trial of a LRRK2 inhibitor finds no slowing of progression. Prasinezumab, an antibody against α-synuclein, narrowly missed its phase 2b endpoint and is in phase 3. Japan&apos;s regulator recommends a conditional approval for induced-stem-cell dopamine progenitors; the FDA approves tavapadon, a once-daily dopamine agonist.</>, src: R("nikolcheva2026", "Nikolcheva et al., 2026") },
];

const GENES: [string, string, string, string][] = [
  ["SNCA", "α-synuclein, a presynaptic protein; the main component of Lewy bodies", "dominant (point mutations, extra copies)", "1997"],
  ["LRRK2", "a kinase that tags Rab proteins and acts on lysosomes; G2019S is the most common variant", "dominant", "2004"],
  ["VPS35", "the retromer, which sorts cargo out of endosomes", "dominant (D620N)", "2011"],
  ["PRKN", "parkin, which tags damaged mitochondria for removal", "recessive, early onset", "1998"],
  ["PINK1", "a mitochondrial kinase that calls parkin to damaged mitochondria", "recessive, early onset", "2004"],
  ["PARK7", "DJ-1, a guard against oxidative stress", "recessive, early onset", "2003"],
  ["GBA1", "glucocerebrosidase, a lysosomal enzyme", "risk factor, the most common", "2009"],
  ["RAB32", "a Rab protein; the risk variant activates LRRK2", "rare risk variant (S71R)", "2024"],
  ["TMEM175", "a lysosomal ion channel", "common risk locus", "GWAS"],
  ["MAPT", "tau", "common risk locus", "GWAS"],
];

const TRIALS: [string, string, string][] = [
  ["prasinezumab", "antibody against α-synuclein", "PASADENA (2022) and PADOVA (2026) missed their primary endpoints, PADOVA narrowly; phase 3 PARAISO began in 2025"],
  ["BIIB122", "LRRK2 kinase inhibitor", "LUMA found no slowing in 2026; development in sporadic Parkinson's stopped; a trial in LRRK2 carriers continues"],
  ["lixisenatide", "GLP-1 receptor agonist", "less motor worsening over 12 months in a phase 2 trial (2024)"],
  ["exenatide", "GLP-1 receptor agonist", "no benefit in phase 3 (2025); the journal later issued an expression of concern"],
  ["ambroxol", "chaperone for glucocerebrosidase", "phase 3 recruiting since 2025"],
  ["BIA 28-6156", "glucocerebrosidase activator", "missed its endpoints in people with GBA1 variants (2026)"],
  ["dopamine cell transplants", "embryonic or induced stem-cell derived", "phase 1/2 safety results in 2025; a sham-controlled phase 3 began in 2025"],
];

const PAGE_REFS: (keyof typeof REFS)[] = [
  "parkinson1817", "goedert2018", "goedert2013", "lees2008", "carlsson1958", "ehringer1960", "cotzias1967", "langston1983", "limousin1995",
  "polymeropoulos1997", "spillantini1997", "kitada1998", "bonifati2003", "valente2004", "zimprich2004", "sidransky2009", "vilarino2011",
  "braak2003", "nalls2019", "kim2024", "gustavsson2024", "hop2024", "kamath2022", "cheng2010", "kordower2013", "postuma2015", "postuma2019",
  "siderowf2023", "simuni2024", "hoglinger2024", "gbd2024", "su2025", "pagano2022", "nikolcheva2026", "meissner2024", "vijiaratnam2025",
  "tabar2025", "sawamoto2025", "dorsey2018",
];

export default function ParkinsonsPage() {
  return (
    <main>
      <section className="page-hero">
        <p className="kicker">Parkinson&apos;s, 1817 to now</p>
        <h1>Six people in London, and two centuries since.</h1>
        <p className="lede">
          James Parkinson described the shaking palsy from six people in 1817. This page is the short version of what has been learned since:
          what the disease is, where it starts, which genes cause it, what treats it, and what has not worked yet. It is background to the
          agent&apos;s work, not medical advice.
        </p>
      </section>

      <article>
        <Sec id="what" title="What it is">
          <p>
            About 11.8 million people were living with Parkinson&apos;s in 2021, more than three times as many as in 1990 ({R("gbd2024", "GBD 2021")}).
            A 2025 projection puts the number at 25.2 million by 2050, driven mostly by ageing populations ({R("su2025", "Su et al., BMJ 2025")}). Among
            the neurodegenerative diseases it is the fastest growing. Men are affected about one and a half times as often as women, and it usually
            starts in the early to mid-60s; onset before 50 is called early onset.
          </p>
          <p>
            Doctors diagnose it from slowness of movement, bradykinesia, together with a tremor at rest of 4 to 6 beats a second or with rigidity
            ({R("postuma2015", "MDS criteria, 2015")}). The face loses expression, handwriting shrinks, the voice softens, the steps shorten. Problems
            with balance come later and are not part of the definition.
          </p>
          <PlatePair a="gowers" b="richer" />
          <p>
            Much of the disease is not about movement. Years before the first tremor, many people lose their sense of smell, become constipated,
            or act out their dreams in their sleep. In a study of 1,280 people with that sleep disorder, 6.3% a year went on to a disease such as
            Parkinson&apos;s, and 73.5% after twelve years ({R("postuma2019", "Postuma et al., 2019")}). Depression, anxiety, pain, low blood pressure on
            standing and, later, dementia are common.
          </p>
          <PlateById id="writing" wide />
          <SpiralTest />
        </Sec>

        <Sec id="brain" title="Inside the brain">
          <p>
            Parkinson&apos;s destroys the pigmented dopamine neurons of the substantia nigra, the &ldquo;black substance&rdquo; of the midbrain,
            whose endings release dopamine in the striatum. By the time the motor signs appear, roughly 30 to 60 percent of the nigral dopamine
            neurons and 50 to 80 percent of their striatal endings are gone ({R("cheng2010", "Cheng et al., 2010")}; {R("kordower2013", "Kordower et al., 2013")}),
            which is why the nigra looks pale at autopsy.
          </p>
          <PlateById id="blausen" wide />
          <p>
            Inside the neurons that remain sit Lewy bodies and, in their processes, Lewy neurites: clumps made largely of misfolded α-synuclein. The
            pathology does not appear everywhere at once. It is found first in the lower brainstem and the olfactory bulb and reaches the nigra and
            then the cortex over years, in the sequence Braak staged in 2003.
          </p>
          <PlateById id="asyn" wide />
          <BraakStages />
          <p>
            Two tests now look for the disease before or beyond the symptoms. A dopamine-transporter scan shows the loss of nigral endings in the
            striatum, and since 2023 a spinal-fluid test that amplifies misfolded α-synuclein has detected Parkinson&apos;s with 87.7% sensitivity
            and 96.3% specificity ({R("siderowf2023", "Siderowf et al., 2023")}). In 2024 two groups proposed defining the disease for research by
            its biology rather than its symptoms ({R("simuni2024", "Simuni et al.")}; {R("hoglinger2024", "Höglinger et al.")}).
          </p>
          <DatScan />
        </Sec>

        <Sec id="timeline" title="Two centuries, in order">
          <PlatePair a="charcot" b="lewy" />
          <ol className="timeline">
            {TIMELINE.map((e) => (
              <li key={e.yr}>
                <span className="yr">{e.yr}</span>
                <div><p>{e.text}</p>{e.src ? <p className="src">{e.src}</p> : null}</div>
              </li>
            ))}
          </ol>
          <PlatePair a="carlsson" b="hornykiewicz" />
        </Sec>

        <Sec id="genes" title="The genes">
          <p>
            Some people with Parkinson&apos;s have a close relative with it, and a small minority carry a single gene variant that causes it.
            Genome-wide studies add dozens of common variants that each nudge the risk ({R("nalls2019", "Nalls et al., 2019")};{" "}
            {R("kim2024", "Kim et al., 2024")}). Each gene below opens the agent&apos;s record of it.
          </p>
          <div className="scroll-x">
            <table className="tbl genes-table">
              <thead><tr><th>gene</th><th>what it does</th><th>how it acts in Parkinson&apos;s</th><th className="r">found</th></tr></thead>
              <tbody>{GENES.map(([g, what, how, yr]) => (
                <tr key={g}><td><Link href={`/gene/${g}`}>{g}</Link></td><td>{what}</td><td>{how}</td><td className="r m">{yr}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </Sec>

        <Sec id="treatment" title="What treats it today">
          <p>
            Levodopa, given with carbidopa so that more of it reaches the brain, is still the most effective treatment, half a century after its
            approval. Dopamine agonists, MAO-B and COMT inhibitors stretch or smooth its effect, and amantadine damps the involuntary movements it
            can cause after years of use. In 2026 the FDA approved tavapadon, a once-daily agonist of the D1 and D5 dopamine receptors.
          </p>
          <p>
            When pills stop working smoothly, devices and pumps take over: deep brain stimulation of the subthalamic nucleus or the globus pallidus,
            now with an adaptive version that adjusts itself to brain signals (2025); focused ultrasound lesions without an incision; and
            continuous infusions of levodopa under the skin (2024) or apomorphine (2025). Exercise and physiotherapy help at every stage.
          </p>
          <p><b>None of these slows the disease.</b> They replace or modulate the dopamine that is lost.</p>
        </Sec>

        <Sec id="trials" title="What has not worked yet">
          <p>Every attempt to slow Parkinson&apos;s so far has missed or is still running. The recent ones:</p>
          <div className="scroll-x">
            <table className="tbl">
              <thead><tr><th>treatment</th><th>how it should work</th><th>where it stands</th></tr></thead>
              <tbody>{TRIALS.map(([t, how, now]) => <tr key={t}><td>{t}</td><td>{how}</td><td>{now}</td></tr>)}</tbody>
            </table>
          </div>
          <p>
            Each failure narrows the question this site&apos;s agent works on: which cells to perturb, which way, and what result would show the idea
            is wrong. <Link href="/#live">Give it a gene.</Link>
          </p>
        </Sec>

        <Sec id="symbol" title="The red tulip">
          <p>
            The &lsquo;Dr. James Parkinson&rsquo; tulip, red with a white edge, was bred in 1980 by J.W.S. Van der Wereld, a Dutch grower who had
            Parkinson&apos;s. It was adopted as the symbol of the disease on 11 April 2005. 11 April, Parkinson&apos;s birthday, has been World
            Parkinson&apos;s Day since 1997. No portrait of James Parkinson is known; the photographs that circulate under his name show other men.
          </p>
          <PlatePair a="tulip" b="plaque" />
        </Sec>

        <Sec id="refs" title="Sources">
          <ol className="refs">
            {PAGE_REFS.map((id) => { const r: Ref = REFS[id]; return <li key={id}>{r.text} <a href={refHref(r)}>{refLink(r)}</a></li>; })}
            <li>Lees, A., Eyre, P. & Brown, P. The true face of James Parkinson. Lancet Neurology 17, 507 (2018). <a href="https://doi.org/10.1016/S1474-4422(18)30174-1">doi:10.1016/S1474-4422(18)30174-1</a></li>
          </ol>
        </Sec>
      </article>
    </main>
  );
}
