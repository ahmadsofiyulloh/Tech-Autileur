"use client";

export default function DriveError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="error-box stack" role="alert">
      <div className="stack">
        <p className="eyebrow">Drive manager error</p>
        <h2>Unable to load Drive metadata.</h2>
        <p>{error.message}</p>
      </div>
      <button className="button primary" type="button" onClick={reset}>
        Retry
      </button>
    </section>
  );
}
