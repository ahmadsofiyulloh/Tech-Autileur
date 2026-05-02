export default function LoadingProductsPage() {
  return (
    <section className="panel stack" aria-busy="true">
      <div className="stack">
        <p className="eyebrow">Loading products</p>
        <h2>Preparing product metadata.</h2>
      </div>
      <div className="muted-box">Loading product records and Drive metadata references...</div>
    </section>
  );
}
