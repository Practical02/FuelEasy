import { apiRequest } from "@/lib/queryClient";

/** Full sales list for reports, filters, and modals (not paginated). */
export const SALES_ALL_QUERY_KEY = ["/api/sales", "all"] as const;

export const SALES_PAGE_SIZE = 50;

export async function fetchAllSales(): Promise<{
  data: unknown[];
  pagination?: { total: number; totalPages: number; page: number; limit: number };
}> {
  const res = await apiRequest("GET", "/api/sales?limit=all");
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
