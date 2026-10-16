// The face of the brand. No portrait of James Parkinson survives, so the site wears his book instead: the title
// page of the 1817 essay, with the plaque from his house in Hoxton Square pinned to its corner. The live bench card
// lies on top of it; the credit line goes under the card.
import { PLATES } from "@/lib/plates";

export function Frontispiece() {
  const page = PLATES.essay, seal = PLATES.plaque;
  return (
    <figure className="frontis" aria-describedby="frontis-note">
      {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized webp files; next/image adds nothing here */}
      <img className="frontis-page" src={page.src} width={page.w} height={page.h} alt={page.alt} fetchPriority="high" decoding="async" />
      {/* eslint-disable-next-line @next/next/no-img-element -- as above */}
      <img className="frontis-seal" src={seal.src} width={seal.w} height={seal.h} alt={seal.alt} decoding="async" />
    </figure>
  );
}

export function FrontispieceNote() {
  const page = PLATES.essay, seal = PLATES.plaque;
  return (
    <p className="frontis-note" id="frontis-note">
      Under the bench: the title page of James Parkinson&apos;s <i>Essay on the Shaking Palsy</i>, London, 1817, and the plaque on his
      house in Hoxton Square. No portrait of him survives. <a href={page.source}>Wellcome Collection</a>, <a href={page.licenseUrl}>{page.license}</a>;
      plaque photograph by <a href={seal.source}>Jnicho02</a>, <a href={seal.licenseUrl}>{seal.license}</a>.
    </p>
  );
}
