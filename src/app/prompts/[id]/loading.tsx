import { FileText, RefreshCcw } from "lucide-react";
import { SkeletonPromptDetailContent, SkeletonPromptDetailRegenerate } from "@/components/operator/loading-skeleton";
import { SectionCard } from "@/components/operator/section-card";

export default function PromptDetailLoading() {
  return (
    <div className="stack" aria-busy="true">
      <SectionCard icon={FileText} title="Output Siap Copy">
        <SkeletonPromptDetailContent />
      </SectionCard>

      <SectionCard icon={RefreshCcw} title="Regenerate Prompt">
        <SkeletonPromptDetailRegenerate />
      </SectionCard>
    </div>
  );
}
