import { Workflow } from "lucide-react";
import { SectionCard } from "@/components/operator/section-card";

export default function ControllerLoading() {
  return (
    <div className="stack">
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
