"use client";

export default function ProductsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="error-box stack" role="alert">
      <div className="stack">
        <p className="eyebrow">Products error</p>
        <h2>Something went wrong while loading products.</h2>
        <p>{error.message}</p>
      </div>
      <button className="button" type="button" onClick={reset}>
        Try again
      </button>
    </section>
  );
}
