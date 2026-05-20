type AiMediaPreviewCardProps = {
  label?: string;
  src?: string | null;
  alt?: string;
  emptyText?: string;
  className?: string;
};

export function AiMediaPreviewCard({ label = "Preview", src, alt = "Preview", emptyText = "Belum ada preview.", className }: AiMediaPreviewCardProps) {
  return (
    <div className={`ai-media-preview-card ${className ?? ""}`.trim()}>
      <span className="ai-media-preview-card__label">{label}</span>
      <div className="ai-media-preview-card__frame">
        {src ? (
          <img src={src} alt={alt} className="ai-media-preview-card__image" />
        ) : (
          <span className="ai-media-preview-card__empty">{emptyText}</span>
        )}
      </div>
    </div>
  );
}
