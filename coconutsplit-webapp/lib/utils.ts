'use client';

import { retrieveLaunchParams } from '@telegram-apps/sdk-react';

export interface QueryParams {
  group_id?: string;
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
    
    // Now we only need the group_id from the launch params
    const group_id = lp;
    
    parseQueryParamsCache = {
      group_id: group_id || undefined,
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

  return searchParams.toString();
}

/**
 * Gets the Telegram user ID from the launch parameters
 * Returns undefined if running in SSR or if user ID is not available
 */
export function getTelegramUserId(): string | undefined {
  // Early return during SSR
  if (typeof window === 'undefined') {
    return undefined;
  }
  
  try {
    const launchParams = retrieveLaunchParams();
    
    // Get user ID from tgWebAppData.user.id
    if (launchParams.tgWebAppData?.user?.id) {
      return launchParams.tgWebAppData.user.id.toString();
    }
    
    return undefined;
  } catch (error) {
    console.error("Error getting Telegram user ID:", error);
    return undefined;
  }
}
