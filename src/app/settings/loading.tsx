import { SectionCard } from "@/components/operator/section-card";

export default function SettingsLoading() {
  return (
    <SectionCard badge="Loading" title="Settings">
      <div className="stack" aria-busy="true">
        <div className="skeleton short" />
        <div className="skeleton long" />
        <div className="grid two-up">
          <div className="muted-box stack">
            <div className="skeleton medium" />
            <div className="skeleton long" />
          </div>
          <div className="muted-box stack">
            <div className="skeleton medium" />
            <div className="skeleton long" />
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
