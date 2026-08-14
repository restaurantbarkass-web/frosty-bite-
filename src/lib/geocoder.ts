const CACHE: Record<string, any> = {};
let lastRequestTime = 0;
let abortController: AbortController | null = null;

export async function geocode(
  query: string,
  type: 'search' | 'reverse' = 'search',
  options: { lat?: number; lon?: number } = {}
) {
  const cacheKey = `${type}:${query}${options.lat ? `:${options.lat}:${options.lon}` : ''}`;
  if (CACHE[cacheKey]) return CACHE[cacheKey];

  const now = Date.now();
  if (now - lastRequestTime < 1000) {
    await new Promise((resolve) => setTimeout(resolve, 1000 - (now - lastRequestTime)));
  }

  if (abortController) abortController.abort();
  abortController = new AbortController();

  lastRequestTime = Date.now();

  const baseUrl = import.meta.env.VITE_GEOCODER_API_URL || 'https://nominatim.openstreetmap.org';
  const url =
    type === 'search'
      ? `${baseUrl}/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1`
      : `${baseUrl}/reverse?lat=${options.lat}&lon=${options.lon}&format=json&addressdetails=1`;

  try {
    const response = await fetch(url, {
      signal: abortController.signal,
      headers: { 'User-Agent': 'FrostyBiteAdmin/1.0' },
    });

    if (response.status === 429) {
      throw new Error('429');
    }

    const data = await response.json();
    CACHE[cacheKey] = data;
    return data;
  } catch (err: any) {
    if (err.name === 'AbortError') return null;
    throw err;
  }
}
