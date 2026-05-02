import Link from "next/link";
import { PageHeader } from "@/components/operator/page-header";
import { SectionCard } from "@/components/operator/section-card";

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
      <PageHeader
        badge="Sprint 5.5 UI foundation"
        eyebrow="Affiliate AI Content OS"
        title="Operator dashboard foundation is in place."
        description="The repo now has a normalized Next.js shell, Supabase auth scaffolding, and the first metadata operator surfaces. No production workflow logic is active yet."
        actions={
          <>
            <Link className="button primary" href="/login">
              Open login
            </Link>
            <Link className="button" href="/dashboard">
              Protected dashboard
            </Link>
          </>
        }
      />

      <section className="grid two-up">
        {foundationItems.map((item) => (
          <SectionCard key={item.title} title={item.title}>
            <p>{item.body}</p>
          </SectionCard>
        ))}
      </section>
    </div>
  );
}
