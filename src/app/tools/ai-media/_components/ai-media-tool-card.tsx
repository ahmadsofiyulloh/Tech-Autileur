import Link from "next/link";
import type { AiMediaToolCard as AiMediaToolCardData } from "@/lib/ai-media/mock-data";

export function AiMediaToolCard({ card }: { card: AiMediaToolCardData }) {
  const Icon = card.icon;

  return (
    <Link href={card.href} className="ai-media-tool-card native-button">
      <div className="ai-media-tool-card__visual">
        {card.visualSrc ? (
          <img src={card.visualSrc} alt="" aria-hidden="true" className="ai-media-tool-card__image" loading="lazy" />
        ) : (
          <Icon className="ai-media-tool-card__fallback-icon" size={32} aria-hidden="true" />
        )}
      </div>
      <div className="ai-media-tool-card__body">
        <strong className="ai-media-tool-card__title">{card.title}</strong>
        <span className="ai-media-tool-card__label">{card.label}</span>
      </div>
    </Link>
  );
}
