export default function DriveLoading() {
  return (
    <section className="panel stack" aria-label="Loading Drive manager">
      <div className="skeleton short" />
      <div className="skeleton long" />
      <div className="skeleton medium" />
      <div className="grid two-up">
        <div className="muted-box stack">
          <div className="skeleton long" />
          <div className="skeleton medium" />
          <div className="skeleton medium" />
        </div>
        <div className="muted-box stack">
          <div className="skeleton long" />
          <div className="skeleton medium" />
          <div className="skeleton medium" />
        </div>
      </div>
    </section>
  );
}
