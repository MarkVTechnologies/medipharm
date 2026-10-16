import useSWRInfinite from "swr/infinite";
import { fetcher, qs, type Paginated } from "../lib/api";

type Params = Record<string, string | number | boolean | null | undefined>;

/**
 * Paginated list with "load more" — paired with an intersection-observer
 * sentinel for infinite scroll on long lists (inventory, sales history).
 */
export function useInfiniteList<T>(path: string | null, params: Params = {}, perPage = 25) {
  const getKey = (index: number, previous: Paginated<T> | null) => {
    if (!path) return null;
    if (previous && previous.meta.page >= previous.meta.last_page) return null;
    return `${path}${qs({ ...params, page: index + 1, per_page: perPage })}`;
  };

  const swr = useSWRInfinite<Paginated<T>>(getKey, fetcher, { revalidateFirstPage: true, keepPreviousData: true });
  const pages = swr.data ?? [];
  const items = pages.flatMap((p) => p.data);
  const last = pages[pages.length - 1];
  const hasMore = !!last && last.meta.page < last.meta.last_page;

  return {
    ...swr,
    items,
    meta: pages[0]?.meta,
    total: pages[0]?.meta.total ?? 0,
    hasMore,
    isLoadingFirst: !swr.data && !swr.error,
    isLoadingMore: swr.isValidating && swr.size > pages.length,
    loadMore: () => (hasMore && !swr.isValidating ? swr.setSize(swr.size + 1) : undefined),
  };
}
