import { SectionCard } from "@/components/operator/section-card";

export default function IntakeLoading() {
  return (
    <SectionCard badge="Loading" title="Intake">
      <div className="stack" aria-busy="true">
        <div className="skeleton short" />
        <div className="skeleton long" />
        <div className="skeleton medium" />
      </div>
    </SectionCard>
  );
}
