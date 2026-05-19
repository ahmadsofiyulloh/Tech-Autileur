import {
  SkeletonButton,
  SkeletonFilterTabs,
  SkeletonInlineSummary,
  SkeletonLine,
  SkeletonSearchToolbar,
  SkeletonVisualListCards,
} from "@/components/operator/loading-skeleton";

export default function LoadingProductsPage() {
  return (
    <div className="stack" aria-busy="true">
      <section className="product-master" aria-label="Memuat daftar produk">
        <div className="product-master__list stack">
          <SkeletonSearchToolbar />
          <SkeletonInlineSummary />
          <div className="product-filter-stack">
            <SkeletonFilterTabs count={6} />
            <SkeletonFilterTabs count={3} className="content-filter-tabs--sub" />
          </div>
          <div className="table-wrap products-table-desktop loading-skeleton-static">
            <table className="data-table dense-table product-table product-table-skeleton" aria-hidden="true">
              <thead>
                <tr>
                  <th>Produk</th>
                  <th>Keyword</th>
                  <th>Status</th>
                  <th>Update</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 5 }).map((_, index) => (
                  <tr key={index}>
                    <td>
                      <div className="product-table-product-cell">
                        <span className="product-table-thumb skeleton-media-thumb" />
                        <div className="stack-tight">
                          <SkeletonLine size="medium" />
                          <SkeletonLine size="short" />
                        </div>
                      </div>
                    </td>
                    <td>
                      <SkeletonLine size="medium" />
                    </td>
                    <td>
                      <span className="skeleton-pill" />
                    </td>
                    <td>
                      <SkeletonLine size="short" />
                    </td>
                    <td>
                      <SkeletonButton />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <SkeletonVisualListCards count={3} />
        </div>
      </section>
    </div>
  );
}
