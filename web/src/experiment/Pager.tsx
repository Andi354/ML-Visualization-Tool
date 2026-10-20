import { pageCount, pageList, PAGE_SIZES } from "./model";

interface Props {
  groups: number;
  page: number;
  pageSize: number;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
}

/** Pager under the groups table (v0.3.2, M): "Seite 1 von 13", ‹ 1 2 3 … 13 ›, rows per page. */
export function Pager({ groups, page, pageSize, onPage, onPageSize }: Props) {
  if (groups <= pageSize) return null;
  const pages = pageCount(groups, pageSize);
  return (
    <div class="pager" data-testid="pager">
      <span class="pager-text" data-testid="pager-text">
        Seite {page + 1} von {pages}
      </span>
      <span class="grow" />
      <button class="pg" aria-label="vorherige Seite" data-testid="pager-prev" disabled={page === 0} onClick={() => onPage(page - 1)}>
        ‹
      </button>
      {pageList(page, pages).map((p, i) =>
        p === null ? (
          <span key={`gap${i}`} class="pg-gap muted">
            …
          </span>
        ) : (
          <button key={p} class={"pg" + (p === page ? " on" : "")} data-testid="pager-page" aria-current={p === page ? "page" : undefined} onClick={() => onPage(p)}>
            {p + 1}
          </button>
        ),
      )}
      <button class="pg" aria-label="nächste Seite" data-testid="pager-next" disabled={page === pages - 1} onClick={() => onPage(page + 1)}>
        ›
      </button>
      <span class="grow" />
      <label class="pager-size small muted">
        <select data-testid="pager-size" value={pageSize} onChange={(e) => onPageSize(Number((e.target as HTMLSelectElement).value))}>
          {PAGE_SIZES.map((n) => (
            <option key={n} value={n}>
              {n} pro Seite
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
