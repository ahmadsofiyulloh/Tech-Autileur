import { SectionCard } from "@/components/operator/section-card";

export default function FlowLoading() {
  return (
    <SectionCard badge="Loading Flow" title="Preparing Flow placeholder.">
      <div className="stack" aria-busy="true">
        <div className="skeleton short" />
        <div className="skeleton long" />
        <div className="skeleton medium" />
      </div>
    </SectionCard>
  );
}
