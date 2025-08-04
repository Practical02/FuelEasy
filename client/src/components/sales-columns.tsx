"use client";

import { ColumnDef } from "@tanstack/react-table";
import type { SaleWithClient } from "@shared/schema";
import { format } from "date-fns";

export const columns: ColumnDef<SaleWithClient>[] = [
  {
    accessorKey: "saleDate",
    header: "Sale Date",
    cell: ({ row }) => format(new Date(row.original.saleDate), "PPP"),
  },
  {
    accessorKey: "client.name",
    header: "Client",
  },
  {
    accessorKey: "project.name",
    header: "Project",
  },
  {
    accessorKey: "lpoNumber",
    header: "LPO Number",
  },
  {
    accessorKey: "quantityGallons",
    header: "Quantity (Gallons)",
  },
  {
    accessorKey: "salePricePerGallon",
    header: "Sale Price/Gallon",
  },
  {
    accessorKey: "totalAmount",
    header: "Total Amount",
  },
  {
    accessorKey: "saleStatus",
    header: "Status",
  },
];
