import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Bell } from "lucide-react";
import { CURRENCY } from "@/lib/constants";

type OverdueApi = {
  days: number;
  data: Array<{
    client: { id: string; name: string };
    invoices: Array<{ id: string; invoiceNumber: string | null; invoiceDate: string | null; pendingAmount: number; totalAmount: number }>;
    totalPending: number;
  }>;
};

export default function NotificationsBell() {
  const { data } = useQuery<OverdueApi>({ queryKey: ["/api/notifications/overdue-clients?days=30"] });

  const count = useMemo(() => data?.data?.length || 0, [data]);
  const items = data?.data || [];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="relative text-gray-500 hover:text-gray-700 p-2 lg:p-1 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
          <Bell className="w-5 h-5" />
          {count > 0 && (
            <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold leading-none text-white bg-red-600 rounded-full">
              {count}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-96" align="end">
        <DropdownMenuLabel>
          Overdue Clients {data ? `(>${data.days} days)` : ""}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <div className="px-2 py-6 text-center text-sm text-gray-500">No overdue client payments</div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {items.map((entry) => (
              <div key={entry.client.id} className="px-2 py-2 border-b last:border-0">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-gray-900 truncate pr-2">{entry.client.name}</div>
                  <div className="text-sm font-semibold text-red-600 whitespace-nowrap">
                    {CURRENCY} {entry.totalPending.toLocaleString()}
                  </div>
                </div>
                <div className="mt-1 space-y-1">
                  {entry.invoices.slice(0, 3).map((inv) => (
                    <DropdownMenuItem key={inv.id} className="flex items-center justify-between">
                      <div className="text-xs text-gray-700 truncate">
                        {inv.invoiceNumber || "Invoice"} · {inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString() : "—"}
                      </div>
                      <div className="text-xs font-medium text-gray-900">
                        {CURRENCY} {inv.pendingAmount.toLocaleString()}
                      </div>
                    </DropdownMenuItem>
                  ))}
                  {entry.invoices.length > 3 && (
                    <div className="text-[11px] text-gray-500 px-2">+{entry.invoices.length - 3} more invoices</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

