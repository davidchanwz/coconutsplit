'use client';

import { retrieveLaunchParams } from '@telegram-apps/sdk-react';

export interface QueryParams {
  group_id?: string;
  user_id?: string;
}

// Create a safe version that won't execute during SSR
let parseQueryParamsCache: QueryParams | null = null;

export function parseQueryParams(): QueryParams {
  // Early return with empty object during SSR
  if (typeof window === 'undefined') {
    return {};
  }
  
  // Return cached result if available to prevent multiple executions
  if (parseQueryParamsCache) {
    return parseQueryParamsCache;
  }
  
  try {
    const lp = retrieveLaunchParams().tgWebAppStartParam || "";
    console.log(lp);
    if (!lp) return {};
    
    const [group_id, user_id] = lp.split("__");
    
    parseQueryParamsCache = {
      group_id: group_id || undefined,
      user_id: user_id || undefined,
    };
    
    return parseQueryParamsCache;
  } catch (error) {
    console.error("Error parsing query params:", error);
    return {};
  }
}

export function buildQueryString(params: QueryParams): string {
  // Skip execution during SSR
  if (typeof window === 'undefined') {
    return '';
  }
  
  const searchParams = new URLSearchParams();

  if (params.group_id) searchParams.append("group_id", params.group_id);
  if (params.user_id) searchParams.append("user_id", params.user_id);

  return searchParams.toString();
}
