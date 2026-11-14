// Chunked PostgREST fetch that pages past the 1000-row default cap.
// PostgREST silently truncates a plain select at ~1000 rows; presenting
// that as a total is wrong. Pages of PAGE_SIZE are fetched until a short
// page is returned or MAX_PAGES is hit (safety cap against runaway
// queries). When the cap is hit, `truncated` is true and callers MUST
// surface that to the user — never present capped figures as complete.
export const PAGE_SIZE = 1000;
export const MAX_PAGES = 20;

export interface FetchAllResult<T> {
  rows: T[];
  /** true when the safety cap stopped paging — figures may be incomplete */
  truncated: boolean;
}

interface PageResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<FetchAllResult<T>> {
  const rows: T[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await fetchPage(from, to);
    if (error) throw new Error(error.message);
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return { rows, truncated: false };
  }
  return { rows, truncated: true };
}
