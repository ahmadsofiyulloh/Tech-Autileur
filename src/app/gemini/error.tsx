"use client";

export default function GeminiError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="error-box stack" role="alert">
      <div className="stack">
        <p className="eyebrow">Gemini manager error</p>
        <h2>Unable to load Gemini metadata.</h2>
        <p>{error.message}</p>
      </div>
      <button className="button primary" type="button" onClick={reset}>
        Retry
      </button>
    </section>
  );
}
