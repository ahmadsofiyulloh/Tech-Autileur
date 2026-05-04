export default function DriveLoading() {
  return (
    <div className="stack" aria-busy="true">
      <div className="settings-list-toolbar">
        <div className="skeleton long" />
      </div>
      <div className="settings-inline-summary">
        <div className="skeleton short" />
      </div>
      <div className="drive-visual-grid">
        {Array.from({ length: 6 }).map((_, index) => (
          <div className="drive-tile" key={index}>
            <div className="skeleton" style={{ aspectRatio: "1 / 0.78", borderRadius: "8px" }} />
            <div className="stack-tight">
              <div className="skeleton medium" />
              <div className="skeleton short" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
