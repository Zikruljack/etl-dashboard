/**
 * Options for API requests.
 * Extends Nuxt's $fetch options — body can be an object (auto-serialized).
 */
interface ApiRequestOptions {
  /** HTTP method */
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Request body — objects are auto-serialized by $fetch, no need for JSON.stringify */
  body?: Record<string, unknown> | BodyInit | null;
  /** Additional request headers */
  headers?: Record<string, string>;
  /** Query parameters */
  params?: Record<string, string | number | boolean | undefined>;
}

/**
 * Composable providing a typed HTTP client with automatic auth header injection.
 * Uses Nuxt's $fetch under the hood — body objects are auto-serialized.
 *
 * @returns Object containing the $api function
 *
 * @example
 * ```ts
 * const { $api } = useApi();
 *
 * // GET with typed response
 * const res = await $api<ApiResponse<Dataset[]>>('/datasets');
 *
 * // POST with body object (no JSON.stringify needed)
 * const res = await $api<ApiResponse<Dataset>>('/datasets', {
 *   method: 'POST',
 *   body: { name: 'My Dataset', sourceType: 'google_sheets', sourceConfig: {...} },
 * });
 * ```
 */
export function useApi() {
  const config = useRuntimeConfig();
  const authStore = useAuthStore();

  /**
   * Make an authenticated API request.
   *
   * @template T - Expected response type
   * @param path - API path (appended to apiBase, e.g. '/datasets')
   * @param options - Request options (method, body, headers, params)
   * @returns Parsed response of type T
   */
  async function $api<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    const headers: Record<string, string> = {
      ...options.headers,
    };

    if (authStore.token) {
      headers['Authorization'] = `Bearer ${authStore.token}`;
    }

    // On SSR (server-side render inside Docker), use the internal container URL to avoid
    // routing requests out of the Docker network and back in through the public interface.
    const baseUrl =
      process.server && config.apiBaseInternal
        ? config.apiBaseInternal
        : config.public.apiBase;

    const res = await $fetch<T>(`${baseUrl}${path}`, {
      method: options.method,
      body: options.body,
      params: options.params,
      headers,
    });

    return res;
  }

  return { $api };
}
