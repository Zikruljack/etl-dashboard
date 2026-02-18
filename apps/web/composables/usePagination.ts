import type { Ref } from 'vue';

/**
 * Return type for usePagination composable.
 */
interface UsePaginationReturn {
  /** Current page number (1-based) */
  page: Ref<number>;
  /** Number of items per page */
  pageSize: Ref<number>;
  /** Total number of items */
  total: Ref<number>;
  /** Total number of pages (computed) */
  totalPages: ComputedRef<number>;
  /** Whether there is a next page */
  hasNext: ComputedRef<boolean>;
  /** Whether there is a previous page */
  hasPrev: ComputedRef<boolean>;
  /** Go to the next page */
  next: () => void;
  /** Go to the previous page */
  prev: () => void;
  /** Go to a specific page number */
  setPage: (n: number) => void;
  /** Update pagination from API response */
  setFromResponse: (pagination: { total: number; page: number; pageSize: number; totalPages: number }) => void;
  /** Reset to page 1 */
  reset: () => void;
}

/**
 * Reusable pagination state management with navigation helpers.
 * Provides reactive refs for page, pageSize, total, and computed totalPages.
 *
 * @param options - Optional initial values
 * @param options.initialPage - Starting page (default: 1)
 * @param options.initialPageSize - Items per page (default: 20)
 * @returns Reactive pagination state and helper methods
 *
 * @example
 * ```ts
 * const { page, pageSize, total, totalPages, next, prev, setFromResponse } = usePagination();
 *
 * // After API call:
 * setFromResponse(res.pagination);
 *
 * // Navigate:
 * next(); prev(); setPage(3);
 * ```
 */
export function usePagination(options: {
  initialPage?: number;
  initialPageSize?: number;
} = {}): UsePaginationReturn {
  const { initialPage = 1, initialPageSize = 20 } = options;

  const page = ref(initialPage);
  const pageSize = ref(initialPageSize);
  const total = ref(0);

  const totalPages = computed(() =>
    pageSize.value > 0 ? Math.ceil(total.value / pageSize.value) : 0,
  );

  const hasNext = computed(() => page.value < totalPages.value);
  const hasPrev = computed(() => page.value > 1);

  /**
   * Navigate to the next page if available.
   */
  function next() {
    if (hasNext.value) {
      page.value++;
    }
  }

  /**
   * Navigate to the previous page if available.
   */
  function prev() {
    if (hasPrev.value) {
      page.value--;
    }
  }

  /**
   * Navigate to a specific page number with bounds clamping.
   *
   * @param n - Target page number (1-based)
   */
  function setPage(n: number) {
    page.value = Math.max(1, Math.min(n, totalPages.value || 1));
  }

  /**
   * Update pagination state from an API paginated response.
   *
   * @param pagination - Pagination metadata from API
   */
  function setFromResponse(pagination: { total: number; page: number; pageSize: number; totalPages: number }) {
    total.value = pagination.total;
    page.value = pagination.page;
    pageSize.value = pagination.pageSize;
  }

  /**
   * Reset pagination to page 1.
   */
  function reset() {
    page.value = 1;
  }

  return {
    page,
    pageSize,
    total,
    totalPages,
    hasNext,
    hasPrev,
    next,
    prev,
    setPage,
    setFromResponse,
    reset,
  };
}
