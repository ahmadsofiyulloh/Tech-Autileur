import type { AiMediaToolCard as AiMediaToolCardData } from "@/lib/ai-media/mock-data";
import { AiMediaToolCard } from "./ai-media-tool-card";

export function AiMediaToolGrid({ cards }: { cards: AiMediaToolCardData[] }) {
  return (
    <div className="ai-media-lobby__grid">
      {cards.map((card) => (
        <AiMediaToolCard key={card.id} card={card} />
      ))}
    </div>
  );
}
