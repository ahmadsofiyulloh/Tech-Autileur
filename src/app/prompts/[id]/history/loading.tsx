import { History } from "lucide-react";
import { SkeletonButton, SkeletonLine } from "@/components/operator/loading-skeleton";
import { SectionCard } from "@/components/operator/section-card";

export default function PromptHistoryLoading() {
  return (
    <div className="stack" aria-busy="true">
      <div className="surface-toolbar loading-skeleton-static" aria-hidden="true">
        <div className="surface-toolbar__actions mobile-action-set">
          <SkeletonButton />
          <SkeletonButton />
        </div>
      </div>
      <SectionCard icon={History} title="History Generate">
        <ul className="list prompt-history-list loading-skeleton-static" aria-hidden="true">
          {Array.from({ length: 3 }).map((_, index) => (
            <li className="prompt-history-row" key={index}>
              <div className="prompt-history-row__body">
                <SkeletonLine size="medium" />
                <SkeletonLine size="long" />
                <SkeletonLine size="short" />
              </div>
              <SkeletonButton />
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  );
}
