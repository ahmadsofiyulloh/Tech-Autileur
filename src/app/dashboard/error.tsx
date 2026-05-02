"use client";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="error-box stack" role="alert">
      <div className="stack">
        <p className="eyebrow">Dashboard error</p>
        <h2>Unable to load the protected placeholder.</h2>
        <p>{error.message}</p>
      </div>
      <button className="button primary" type="button" onClick={reset}>
        Retry
      </button>
    </section>
  );
}
