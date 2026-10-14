import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page">
      <header className="phead">
        <h1>Nothing on this slide.</h1>
        <p>The page you asked for isn&apos;t in the notebook. A gene page exists only once the agent has read that gene.</p>
        <p><Link className="btn" href="/">Back to the console</Link></p>
      </header>
    </main>
  );
}
