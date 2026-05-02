import { SectionCard } from "@/components/operator/section-card";

export default function DashboardLoading() {
  return (
    <SectionCard badge="Loading dashboard" title="Preparing the protected control surface.">
      <div className="stack" aria-busy="true">
        <div className="skeleton short" />
        <div className="skeleton long" />
        <div className="skeleton medium" />
        <div className="grid two-up">
          <div className="muted-box stack">
            <div className="skeleton long" />
            <div className="skeleton medium" />
          </div>
          <div className="muted-box stack">
            <div className="skeleton long" />
            <div className="skeleton medium" />
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
