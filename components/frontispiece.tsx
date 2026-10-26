// The face of the brand. No portrait of James Parkinson survives, so the site wears his book instead: the title
// page of the 1817 essay, whole, with the plaque from his house in Hoxton Square pinned to its corner.
import { PLATES } from "@/lib/plates";

export function Frontispiece() {
  const page = PLATES.essay, seal = PLATES.plaque;
  return (
    <figure className="frontis">
      <div className="frontis-art">
        {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized webp files; next/image adds nothing here */}
        <img className="frontis-page" src={page.src} width={page.w} height={page.h} alt={page.alt} fetchPriority="high" decoding="async" />
        {/* eslint-disable-next-line @next/next/no-img-element -- as above */}
        <img className="frontis-seal" src={seal.src} width={seal.w} height={seal.h} alt={seal.alt} decoding="async" />
      </div>
      <figcaption>
        James Parkinson described the shaking palsy in this essay, London, 1817; the plaque is from his house in Hoxton Square. No
        portrait of him survives; the profile in this site&apos;s logo is an illustration, not his likeness. <a href={page.source}>Wellcome Collection</a>, <a href={page.licenseUrl}>{page.license}</a>; plaque
        photograph by <a href={seal.source}>Jnicho02</a>, <a href={seal.licenseUrl}>{seal.license}</a>.
      </figcaption>
    </figure>
  );
}
