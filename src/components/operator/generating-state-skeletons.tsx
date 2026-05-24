"use client";

export type ShareSkeletonProps = {
  variantCount?: number;
};

export function ShareSkeleton({ variantCount = 3 }: ShareSkeletonProps) {
  const slots = Array.from({ length: variantCount }, (_, i) => i);

  return (
    <div className="generating-state__variants">
      {slots.map((i) => (
        <div key={i} className="generating-state__variant">
          <div className="generating-state-shimmer generating-state-shimmer--75" />
          <div className="generating-state-shimmer generating-state-shimmer--90 generating-state-shimmer--delay-1" />
          <div className="generating-state-shimmer generating-state-shimmer--50 generating-state-shimmer--delay-2" />
        </div>
      ))}
    </div>
  );
}

export function PromptSkeleton() {
  return (
    <div className="generating-state__variants">
      <div className="generating-state__variant">
        <div className="generating-state-shimmer generating-state-shimmer--50" />
        <div className="generating-state-shimmer generating-state-shimmer--90" />
        <div className="generating-state-shimmer generating-state-shimmer--75 generating-state-shimmer--delay-1" />
      </div>
      <div className="generating-state__variant">
        <div className="generating-state-shimmer generating-state-shimmer--50" />
        <div className="generating-state-shimmer generating-state-shimmer--90 generating-state-shimmer--delay-1" />
        <div className="generating-state-shimmer generating-state-shimmer--90 generating-state-shimmer--delay-2" />
        <div className="generating-state-shimmer generating-state-shimmer--75 generating-state-shimmer--delay-1" />
      </div>
      <div className="generating-state__variant">
        <div className="generating-state-shimmer generating-state-shimmer--50" />
        <div className="generating-state-shimmer generating-state-shimmer--75 generating-state-shimmer--delay-2" />
      </div>
    </div>
  );
}

export function IntakeSkeleton() {
  return (
    <div className="generating-state__variants">
      <div className="generating-state__variant">
        <div className="generating-state-shimmer generating-state-shimmer--50" />
        <div className="generating-state-shimmer generating-state-shimmer--90" />
      </div>
      <div className="generating-state__variant">
        <div className="generating-state-shimmer generating-state-shimmer--50" />
        <div className="generating-state-shimmer generating-state-shimmer--75 generating-state-shimmer--delay-1" />
      </div>
      <div className="generating-state__variant">
        <div className="generating-state-shimmer generating-state-shimmer--50" />
        <div className="generating-state-shimmer generating-state-shimmer--90 generating-state-shimmer--delay-1" />
        <div className="generating-state-shimmer generating-state-shimmer--75 generating-state-shimmer--delay-2" />
      </div>
    </div>
  );
}
