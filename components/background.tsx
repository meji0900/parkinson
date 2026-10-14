import { Entry } from "./sections";

export function Background() {
  return (
    <>
      <Entry id="background" note="Background" sub="1906 to now.">
        <h2>A disease first seen on a microscope slide.</h2>
        <p>
          In November 1906, Alois Alzheimer described the plaques and tangles he found in the brain of Auguste Deter, a patient he
          had followed since 1901. More than a century later, antibodies that clear amyloid were approved in 2023 and 2024; they
          slow decline modestly in early disease. Genetic studies now point to more than 75 risk loci, many in microglial genes
          (<i className="g">TREM2</i>, <i className="g">PLCG2</i>, <i className="g">ABI3</i>, <i className="g">SPI1</i>) and in
          lipid and endosomal genes (<i className="g">APOE</i>, <i className="g">ABCA7</i>, <i className="g">BIN1</i>,{" "}
          <i className="g">SORL1</i>).
        </p>
        <p>
          A useful hypothesis names a gene, a cell type, a direction and a readout. Most candidate lists stop at the gene. This
          agent tries to finish the sentence, and says so when it can&apos;t.
        </p>
      </Entry>
      <Entry id="limits" note="Limits" sub="Read these before the numbers.">
        <ul className="refs" style={{ listStyle: "disc" }}>
          <li>Nothing here has been tested in a lab. It is a list of experiments worth running, not medical advice.</li>
          <li>Unless real atlas data is installed, predictions are tested on a simulated cohort. Those results test the method, not biology.</li>
          <li>Readouts come from a fixed table keyed on cell type and pathway theme, so they are generic by design.</li>
          <li>Short gene symbols collide with ordinary words in abstracts, which makes the literature count noisy for them.</li>
          <li>The weights are a choice, written down in the method. Different weights would rank genes differently.</li>
          <li>Only genes are investigated, not compounds. Devnet test tokens have no value, and no token is a claim on any result.</li>
        </ul>
      </Entry>
      <Entry id="sources" note="Sources">
        <ol className="refs">
          <li>Gabitto MI et al. Integrated multimodal cell atlas of Alzheimer&apos;s disease. <i>Nat Neurosci</i> 2024. <a href="https://doi.org/10.1038/s41593-024-01774-5">doi:10.1038/s41593-024-01774-5</a></li>
          <li>Seattle Alzheimer&apos;s Disease Brain Cell Atlas (SEA-AD), Allen Institute. <a href="https://brain-map.org/consortia/sea-ad">brain-map.org/consortia/sea-ad</a></li>
          <li>Bellenguez C et al. New insights into the genetic etiology of Alzheimer&apos;s disease and related dementias. <i>Nat Genet</i> 2022. <a href="https://doi.org/10.1038/s41588-022-01024-z">doi:10.1038/s41588-022-01024-z</a></li>
          <li>Braak H, Braak E. Neuropathological stageing of Alzheimer-related changes. <i>Acta Neuropathol</i> 1991. <a href="https://doi.org/10.1007/BF00308809">doi:10.1007/BF00308809</a></li>
          <li>Plate TA. Holographic reduced representations. <i>IEEE Trans Neural Netw</i> 1995. <a href="https://doi.org/10.1109/72.377968">doi:10.1109/72.377968</a></li>
          <li>
            Open Targets Platform, <a href="https://platform.opentargets.org">platform.opentargets.org</a>; Human Protein Atlas,{" "}
            <a href="https://www.proteinatlas.org">proteinatlas.org</a>; <a href="https://clinicaltrials.gov">ClinicalTrials.gov</a>;{" "}
            <a href="https://pubmed.ncbi.nlm.nih.gov">PubMed</a>; <a href="https://reactome.org">Reactome</a>.
          </li>
        </ol>
      </Entry>
    </>
  );
}
