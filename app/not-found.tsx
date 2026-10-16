import Link from "next/link";

export default function NotFound() {
  return (
    <main>
      <section className="page-hero">
        <p className="kicker">Not found</p>
        <h1>Nothing on this slide.</h1>
        <p className="lede">The page you asked for isn&apos;t in the notebook. A receipt page exists only once that receipt has been printed.</p>
        <p className="cta"><Link className="btn" href="/">Back to the console</Link><Link className="link" href="/gene">Look up a gene</Link></p>
      </section>
    </main>
  );
}
