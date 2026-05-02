import Link from "next/link";

const foundationItems = [
  {
    title: "Supabase auth helpers",
    body: "Browser and server clients are wired to the publishable key with cookie-based SSR support.",
  },
  {
    title: "Protected dashboard route",
    body: "The dashboard is server-gated and redirects unauthenticated users to the login screen.",
  },
  {
    title: "Profile bootstrap",
    body: "New auth users automatically receive a matching public.profiles row with Asia/Jakarta timezone.",
  },
];

export default function HomePage() {
  return (
    <div className="stack">
      <section className="hero">
        <div className="chip">Sprint 1 auth foundation</div>
        <div className="stack">
          <p className="eyebrow">Affiliate AI Content OS</p>
          <h2>Foundation ready for the MVP control center.</h2>
          <p>
            The repo now has a normalized Next.js shell, strict TypeScript config, Supabase auth scaffolding, a
            protected dashboard, and a bootstrap profile path. No production workflow logic is active yet.
          </p>
        </div>
        <div className="hero-actions">
          <Link className="button primary" href="/login">
            Open login
          </Link>
          <Link className="button" href="/dashboard">
            Protected dashboard
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
