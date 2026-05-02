import Link from "next/link";
import { PageHeader } from "@/components/operator/page-header";
import { SectionCard } from "@/components/operator/section-card";

const foundationItems = [
  {
    title: "Intake",
    body: "Reserved for mobile product intake. Links, photos, screenshots, and parsed metadata are not active yet.",
    href: "/intake",
  },
  {
    title: "Products",
    body: "Current product registry and source image metadata manager.",
    href: "/products",
  },
  {
    title: "Prompts",
    body: "Prompt pack generation, mock fallback, and task status tracking.",
    href: "/prompts",
  },
  {
    title: "Settings",
    body: "Gemini keys, Drive metadata, account logout, and future Flow or affiliate settings.",
    href: "/settings",
  },
];

export default function HomePage() {
  return (
    <div className="stack">
      <PageHeader
        badge="Operator"
        eyebrow="Private workspace"
        title="Open the production control surface."
        description="Use the current metadata and prompt tools from one compact workspace. Intake, Flow, and output package routes are placeholders until their approved sprints."
        actions={
          <>
            <Link className="button" href="/dashboard">
              Dashboard
            </Link>
            <Link className="button primary" href="/intake">
              Intake
            </Link>
          </>
        }
      />

      <section className="grid two-up">
        {foundationItems.map((item) => (
          <SectionCard
            key={item.title}
            title={item.title}
            actions={
              <Link className="button compact" href={item.href}>
                Open
              </Link>
            }
          >
            <p>{item.body}</p>
          </SectionCard>
        ))}
      </section>
    </div>
  );
}
