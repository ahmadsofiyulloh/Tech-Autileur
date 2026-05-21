import { mockToolCards } from "@/lib/ai-media/mock-data";
import { AiMediaToolCard } from "./ai-media-tool-card";

export type AiMediaToolGridStatusOverride = {
  cardId: string;
  status: string;
  statusTone: "success" | "info" | "warning" | "neutral" | "danger";
};

type AiMediaToolGridProps = {
  statusOverrides?: AiMediaToolGridStatusOverride[];
};

export function AiMediaToolGrid({ statusOverrides }: AiMediaToolGridProps) {
  const overrideMap = new Map<string, AiMediaToolGridStatusOverride>();
  for (const o of statusOverrides ?? []) overrideMap.set(o.cardId, o);

  return (
    <div className="ai-media-lobby__grid">
      {mockToolCards.map((card) => {
        const override = overrideMap.get(card.id);
        const finalCard = override
          ? { ...card, status: override.status, statusTone: override.statusTone }
          : card;
        return <AiMediaToolCard key={card.id} card={finalCard} />;
      })}
    </div>
  );
}
