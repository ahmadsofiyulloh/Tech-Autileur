import Link from "next/link";
import { ArrowRight, Inbox, LayoutDashboard, Package, Settings, FileText } from "lucide-react";
import { PageHeader } from "@/components/operator/page-header";
import { SectionCard } from "@/components/operator/section-card";

const foundationItems = [
  {
    title: "Intake",
    body: "Capture queue.",
    href: "/intake",
    icon: Inbox,
  },
  {
    title: "Products",
    body: "Product records.",
    href: "/products",
    icon: Package,
  },
  {
    title: "Prompts",
    body: "Prompt packs.",
    href: "/prompts",
    icon: FileText,
  },
  {
    title: "Settings",
    body: "Config hub.",
    href: "/settings",
    icon: Settings,
  },
];

export default function HomePage() {
  return (
    <div className="stack">
      <PageHeader
        icon={LayoutDashboard}
        badge="Operator"
        title="Control surface"
        description="Daily production starts from the app shell."
        actions={
          <>
            <Link className="button" href="/dashboard">
              <LayoutDashboard size={16} aria-hidden="true" />
              Dashboard
            </Link>
            <Link className="button primary" href="/intake">
              <Inbox size={16} aria-hidden="true" />
              Intake
            </Link>
          </>
        }
      />

      <section className="grid two-up">
        {foundationItems.map((item) => (
          <SectionCard
            key={item.title}
            icon={item.icon}
            title={item.title}
            actions={
              <Link className="button compact" href={item.href}>
                <ArrowRight size={15} aria-hidden="true" />
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
