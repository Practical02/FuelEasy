import { apiRequest } from "@/lib/queryClient";

/** Full sales list for reports, filters, and modals (not paginated). */
export const SALES_ALL_QUERY_KEY = ["/api/sales", "all"] as const;

export const SALES_PAGE_SIZE = 50;

/** Server-side filtered + paginated list (Sales page). */
export type SalesListQuery = {
  page: number;
  limit: number;
  search?: string;
  statuses?: string[];
  clientIds?: string[];
  projectIds?: string[];
  dateFrom?: string;
  dateTo?: string;
  minAmount?: string;
  maxAmount?: string;
  minQty?: string;
  maxQty?: string;
};

export async function fetchSalesList(q: SalesListQuery): Promise<{
  data: unknown[];
  pagination?: { total: number; totalPages: number; page: number; limit: number };
}> {
  const params = new URLSearchParams();
  params.set("page", String(q.page));
  params.set("limit", String(q.limit));
  if (q.search?.trim()) params.set("search", q.search.trim());
  if (q.statuses?.length) params.set("statuses", q.statuses.join(","));
  if (q.clientIds?.length) params.set("clientIds", q.clientIds.join(","));
  if (q.projectIds?.length) params.set("projectIds", q.projectIds.join(","));
  if (q.dateFrom) params.set("dateFrom", q.dateFrom);
  if (q.dateTo) params.set("dateTo", q.dateTo);
  if (q.minAmount) params.set("minAmount", q.minAmount);
  if (q.maxAmount) params.set("maxAmount", q.maxAmount);
  if (q.minQty) params.set("minQty", q.minQty);
  if (q.maxQty) params.set("maxQty", q.maxQty);
  const res = await apiRequest("GET", `/api/sales?${params.toString()}`);
  return res.json();
}

export type FetchAllSalesOptions = {
  /** Narrow server-side load (e.g. Reports date range). */
  dateFrom?: string;
  dateTo?: string;
};

export async function fetchAllSales(
  options?: FetchAllSalesOptions,
): Promise<{
  data: unknown[];
  pagination?: { total: number; totalPages: number; page: number; limit: number };
}> {
  const params = new URLSearchParams();
  params.set("limit", "all");
  if (options?.dateFrom) params.set("dateFrom", options.dateFrom);
  if (options?.dateTo) params.set("dateTo", options.dateTo);
  const qs = params.toString();
  const res = await apiRequest("GET", `/api/sales?${qs}`);
  const json = await res.json();
  if (Array.isArray(json)) {
    return { data: json, pagination: { total: json.length, totalPages: 1, page: 1, limit: json.length } };
  }
  return {
    data: (json?.data as unknown[]) ?? [],
    pagination: json?.pagination,
  };
}

export function salesListFromResponse(json: unknown): unknown[] {
  if (Array.isArray(json)) return json;
  if (json && typeof json === "object" && "data" in json && Array.isArray((json as { data: unknown[] }).data)) {
    return (json as { data: unknown[] }).data;
  }
  return [];
}
