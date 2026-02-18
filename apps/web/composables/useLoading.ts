import type { Ref } from 'vue';

/**
 * Return type for useLoading composable.
 *
 * @template T - Type of the resolved data
 */
interface UseLoadingReturn<T> {
  /** Reactive loading state — true while the async function is executing */
  loading: Ref<boolean>;
  /** Reactive error message — null when no error, string when error occurred */
  error: Ref<string | null>;
  /** Reactive data — null initially, populated after successful execution */
  data: Ref<T | null>;
  /**
   * Execute the async function, managing loading/error state automatically.
   * Returns the result on success, or null if an error occurred.
   *
   * @param args - Arguments to pass to the async function
   * @returns The result of the async function, or null on error
   */
  execute: (...args: unknown[]) => Promise<T | null>;
}

/**
 * Wrap an async function with automatic loading, error, and data state management.
 * Eliminates the need for manual ref(true)/try-catch-finally patterns on every page.
 *
 * @template T - Type of the resolved data
 * @param fn - Async function to wrap
 * @param options - Optional configuration
 * @param options.immediate - If true, execute the function immediately on composable creation
 * @param options.initialLoading - Initial value for loading ref (default: false, or true if immediate)
 * @returns Reactive refs for loading, error, data, and an execute function
 *
 * @example
 * ```ts
 * const { loading, error, data: datasets, execute } = useLoading(
 *   () => $api<ApiResponse<Dataset[]>>('/datasets').then(r => r.data),
 *   { immediate: true }
 * );
 * ```
 */
export function useLoading<T>(
  fn: (...args: unknown[]) => Promise<T>,
  options: { immediate?: boolean; initialLoading?: boolean } = {},
): UseLoadingReturn<T> {
  const { immediate = false, initialLoading } = options;

  const loading = ref(initialLoading ?? immediate) as Ref<boolean>;
  const error = ref<string | null>(null) as Ref<string | null>;
  const data = ref<T | null>(null) as Ref<T | null>;

  async function execute(...args: unknown[]): Promise<T | null> {
    loading.value = true;
    error.value = null;

    try {
      const result = await fn(...args);
      data.value = result;
      return result;
    } catch (e: unknown) {
      const message = extractErrorMessage(e);
      error.value = message;
      console.error(message, e);
      return null;
    } finally {
      loading.value = false;
    }
  }

  if (immediate) {
    onMounted(() => execute());
  }

  return { loading, error, data, execute };
}

/**
 * Extract a human-readable error message from an unknown error.
 * Handles Nuxt $fetch errors, API error responses, and standard Error objects.
 *
 * @param e - The caught error value
 * @returns A string error message
 */
function extractErrorMessage(e: unknown): string {
  if (e && typeof e === 'object') {
    // Nuxt $fetch error shape: e.data?.message
    const fetchErr = e as { data?: { message?: string }; message?: string };
    if (fetchErr.data?.message) return fetchErr.data.message;
    if (fetchErr.message) return fetchErr.message;
  }
  if (typeof e === 'string') return e;
  return 'An unexpected error occurred';
}
