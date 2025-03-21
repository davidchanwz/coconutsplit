import { initData } from "@telegram-apps/sdk-react";

export interface QueryParams {
  group_id?: string;
  user_id?: string;
}

export function parseQueryParams(): QueryParams {
  const lp = initData.startParam();
  if (!lp) return {};
  
  const [group_id, user_id] = lp.split("__");

  return {
    group_id: group_id || undefined,
    user_id: user_id || undefined,
  };
}

export function buildQueryString(params: QueryParams): string {
  const searchParams = new URLSearchParams();

  if (params.group_id) searchParams.append("group_id", params.group_id);
  if (params.user_id) searchParams.append("user_id", params.user_id);

  return searchParams.toString();
}
