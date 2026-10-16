// A figure from the sources, by id, with its credit and licence under it. Missing ids render nothing.
import { PLATES } from "@/lib/plates";

export function PlateById({ id, wide = false }: { id: string; wide?: boolean }) {
  const p = PLATES[id];
  if (!p) return null;
  return (
    <figure className={`plate${wide ? " wide" : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized webp files; next/image adds nothing here */}
      <img src={p.src} width={p.w} height={p.h} alt={p.alt} loading="lazy" decoding="async" />
      <figcaption>
        {p.caption} {p.credit}, <a href={p.source}>Wikimedia Commons</a>
        {p.licenseUrl ? <>, <a href={p.licenseUrl}>{p.license}</a></> : <>, {p.license}</>}.
      </figcaption>
    </figure>
  );
}

export function PlatePair({ a, b }: { a: string; b: string }) {
  if (!PLATES[a] && !PLATES[b]) return null;
  if (!PLATES[a] || !PLATES[b]) return <PlateById id={PLATES[a] ? a : b} wide />;
  return (
    <div className="pair">
      <PlateById id={a} />
      <PlateById id={b} />
    </div>
  );
}
