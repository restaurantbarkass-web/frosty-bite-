/**
 * Utility for safe fetch operations and non-crashing JSON parsing.
 * Prevents "Unexpected token 'A', 'A server e'... is not valid JSON" errors
 * when endpoints return HTML error pages, text responses, or 500/502 gateway errors.
 */

export interface SafeFetchResult<T = any> {
  ok: boolean;
  status: number;
  data: T | null;
  error?: string;
}

/**
 * Safely parses a Response object as JSON.
 * Gracefully handles non-JSON content types and invalid JSON syntax.
 */
export async function safeResponseJson<T = any>(response: Response, fallback: T | null = null): Promise<T | null> {
  try {
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await response.text().catch(() => '');
      console.warn(`[SafeFetch] Received non-JSON response (${response.status}):`, text.substring(0, 100));
      return fallback;
    }
    const data = await response.json();
    return data as T;
  } catch (err: any) {
    console.warn(`[SafeFetch] Failed to parse JSON from response (${response.status}):`, err.message);
    return fallback;
  }
}

/**
 * Fetch wrapper that never throws on JSON parse failures or server error HTML pages.
 */
export async function safeFetchJson<T = any>(
  input: RequestInfo | URL,
  init?: RequestInit,
  fallback: T | null = null
): Promise<SafeFetchResult<T>> {
  try {
    const res = await fetch(input, init);
    const contentType = res.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      try {
        const data = await res.json();
        return {
          ok: res.ok,
          status: res.status,
          data: data as T,
          error: !res.ok ? (data?.error || data?.message || `Server error (${res.status})`) : undefined
        };
      } catch (jsonErr: any) {
        return {
          ok: false,
          status: res.status,
          data: fallback,
          error: jsonErr.message || 'Malformed JSON response'
        };
      }
    } else {
      const rawText = await res.text().catch(() => '');
      return {
        ok: res.ok,
        status: res.status,
        data: fallback,
        error: !res.ok ? (rawText.substring(0, 120) || `Server error (${res.status})`) : undefined
      };
    }
  } catch (netErr: any) {
    console.warn('[SafeFetch] Network or fetch error:', netErr);
    return {
      ok: false,
      status: 0,
      data: fallback,
      error: netErr?.message || 'Network request failed'
    };
  }
}
