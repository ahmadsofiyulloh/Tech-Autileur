import { Inbox } from "lucide-react";
import { SectionCard } from "@/components/operator/section-card";

export default function IntakeLoading() {
  return (
    <div className="stack">
      <SectionCard icon={Inbox} title="Loading intake">
        <div className="stack">
          <div className="skeleton long" />
          <div className="skeleton medium" />
          <div className="skeleton short" />
        </div>
      </SectionCard>
    </div>
  );
}
