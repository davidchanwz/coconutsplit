export interface QueryParams {
  group_id?: string;
  user_id?: string;
  route?: string;
}

export function parseQueryParams(): QueryParams {
  if (typeof window === 'undefined') return {};

  const hash = window.location.hash.slice(1); // Remove the # symbol
  if (!hash) return {};

  // Split by & to get individual parameters
  const params = hash.split('&').reduce((acc, param) => {
    const [key, value] = param.split('=');
    if (key && value) {
      acc[key] = decodeURIComponent(value);
    }
    return acc;
  }, {} as Record<string, string>);

  return params;
}

export function buildQueryString(params: QueryParams): string {
  return Object.entries(params)
    .filter(([_, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');
} 