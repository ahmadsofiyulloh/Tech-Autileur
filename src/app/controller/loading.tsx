import { Workflow } from "lucide-react";
import { PageHeader } from "@/components/operator/page-header";
import { SectionCard } from "@/components/operator/section-card";

export default function ControllerLoading() {
  return (
    <div className="stack">
      <PageHeader icon={Workflow} badge="Execution" title="Controller" description="Loading." />
      <SectionCard icon={Workflow} title="Loading controller">
        <div className="stack" aria-busy="true">
          <div className="skeleton short" />
          <div className="skeleton long" />
          <div className="skeleton medium" />
        </div>
      </SectionCard>
    </div>
  );
}
