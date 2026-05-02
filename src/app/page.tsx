import Link from "next/link";

const foundationItems = [
  {
    title: "Supabase metadata shell",
    body: "Client helpers are scaffolded for future auth and data access without exposing secrets.",
  },
  {
    title: "Protected dashboard route",
    body: "The dashboard is server-gated and currently serves as a placeholder control surface.",
  },
  {
    title: "PWA-ready layout",
    body: "Manifest, icon, metadata, and mobile-first shell are in place for Sprint 1 work.",
  },
];

export default function HomePage() {
  return (
    <div className="stack">
      <section className="hero">
        <div className="chip">Sprint 0 only</div>
        <div className="stack">
          <p className="eyebrow">Affiliate AI Content OS</p>
          <h2>Foundation ready for the MVP control center.</h2>
          <p>
            The repo now has a normalized Next.js shell, strict TypeScript config, Supabase client scaffolding, and a
            protected dashboard placeholder. No production workflow logic is active yet.
          </p>
        </div>
        <div className="hero-actions">
          <Link className="button primary" href="/dashboard">
            Open dashboard placeholder
          </Link>
          <span className="button" aria-hidden="true">
            No feature data yet
          </span>
        </div>
      </section>

      <section className="grid two-up">
        {foundationItems.map((item) => (
          <article className="panel" key={item.title}>
            <p className="eyebrow">{item.title}</p>
            <p>{item.body}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
