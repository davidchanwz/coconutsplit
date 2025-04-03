'use client';

import { retrieveLaunchParams } from '@telegram-apps/sdk-react';
import clsx, { ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface QueryParams {
  group_id?: string;
  chat_id?: string;
  new_group_id?: string;
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
    const param = retrieveLaunchParams().tgWebAppStartParam || "";
    const urlParams = new URLSearchParams(window.location.search);
    const newGroupId = urlParams.get('new_group_id');

    if (!param && !newGroupId) return {};

    // First check for new_group_id from URL
    if (newGroupId) {
      parseQueryParamsCache = {
        group_id: newGroupId,
        chat_id: undefined
      };
      return parseQueryParamsCache;
    }
    // Check if the param is a chat_id (starts with - and contains only numbers)
    const isChatId = /^-\d+$/.test(param);

    // Then fall back to checking tgWebAppStartParam
    parseQueryParamsCache = {
      group_id: isChatId ? undefined : param,
      chat_id: isChatId ? param : undefined
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

export function getTelegramUsername(): string | undefined {
  // Early return during SSR
  if (typeof window === 'undefined') {
    return undefined;
  }

  try {
    const launchParams = retrieveLaunchParams();

    // Get username from tgWebAppData.user.username
    if (launchParams.tgWebAppData?.user?.username) {
      return launchParams.tgWebAppData.user.username;
    }

    // Fallback to first_name if username doesn't exist
    if (launchParams.tgWebAppData?.user?.first_name) {
      return launchParams.tgWebAppData.user.first_name;
    }

    return undefined;
  } catch (error) {
    console.error("Error getting Telegram username:", error);
    return undefined;
  }
}

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

/**
 * Sends a notification to the bot server
 */
export async function sendNotificationToBot(data: any): Promise<boolean> {
  try {

    // Make sure we're using POST instead of OPTIONS
    const response = await fetch(`${process.env.NEXT_PUBLIC_BOT_API_URL}/api/notify`, {
      method: 'POST', // Ensure we're using POST method
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.NEXT_PUBLIC_BOT_API_KEY || '',
      },
      body: JSON.stringify(data),
      // Avoid preflight requests by disabling these headers:
      mode: 'cors',
      credentials: 'omit'
    });


    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', errorText);
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ Failed to send notification to bot:', error);
    return false;
  }
}

export function calculateEqualSplits(amount: number, numberOfPeople: number): number[] {
  const baseAmount = Math.floor((amount * 100) / numberOfPeople) / 100;
  const remainder = amount - (baseAmount * numberOfPeople);

  const splits = new Array(numberOfPeople).fill(baseAmount);

  // Distribute the remaining cents
  if (remainder > 0) {
    const remainderCents = Math.round(remainder * 100);
    for (let i = 0; i < remainderCents; i++) {
      splits[i % numberOfPeople] += 0.01;
    }
  }

  return splits;
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumber(num: number): string {
  return num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function calculateSplitTotal(splits: Record<string, string>): number {
  return Object.values(splits).reduce((sum, value) => {
    const num = parseFloat(value || "0");
    return sum + (isNaN(num) ? 0 : num);
  }, 0);
}