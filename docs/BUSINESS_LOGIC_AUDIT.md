# Business logic audit (2026-04-01)

This document summarizes a risk-prioritized review of `server/storage.ts` (`DatabaseStorage`) and `server/routes.ts`, with notes on the client. It is the deliverable for the “full business logic audit (and high-priority fixes)” plan.

## 1. Invariants reviewed

### FIFO inventory and COGS

- Stock batches are consumed in **purchase order** (purchase date, then `createdAt`). Sales are applied in **sale order** (sale date, `createdAt`, `id`), matching the anchor-based replay and `getFIFOPurchaseCostForQuantity`.
- `getFIFOPurchaseCostForQuantity(quantity, { excludeSaleId })` excludes the current sale from consumption so updates re-price correctly.
- `cogsAndPpgFromFifoRawTotal` rounds COGS and derives PPG from cogs/quantity to limit drift.

### Sales money fields

- `createSale` / `updateSale` recompute subtotal, VAT, total, COGS, gross profit. Revenue aggregates use `subtotal` (excludes VAT) for `getTotalRevenue`; COGS uses sum of `sales.cogs`. `getGrossProfit` = revenue ex VAT minus COGS.

### Invoices and payments

- `bulkPayInvoices` requires one client across selected invoices, allocates one cashbook inflow across invoices, then creates `payments` rows per sale up to `sale.totalAmount`. `updateInvoiceStatusIfPaid` compares allocated sum to invoice `totalAmount` (epsilon 0.009).
- `createPayment` links cashbook to invoice when possible and updates sale status from cumulative payments.

### MemStorage

- `server/storage-simple.ts` is **not** imported by the main app; production uses `server/storage.ts`. Drift of `MemStorage` vs `DatabaseStorage` only affects ad-hoc scripts/tests that import it.

## 2. Findings (pre-fix)

| Severity | Area | Issue |
|----------|------|--------|
| P0 | FIFO full replay | `computeReplayedFifoCostsForAllSales` did not verify that each sale’s quantity could be fully layered from remaining stock. If data were ever inconsistent (total sales volume > stock), replay would **silently** compute COGS from partial layers, then `applyFifoCostUpdates` would persist **wrong** COGS. The anchor-based replay `computeReplayedFifoCostsFromAnchor` already threw `FifoInsufficientStockError` in that situation; full-path replay did not. |
| P0 | API | `POST /api/sales/reconcile-fifo-costs` could be called by any authenticated user (no roles in `users`). Mitigation added: optional shared secret `FIFO_RECONCILE_SECRET` + header `X-Fuelflow-FIFO-Reconcile`. |
| P1 | `createSale` | If `getFIFOPurchaseCostForQuantity` returns null (insufficient stock), the code **still creates** the sale using manual PPG/COGS from the request. That is intentional for flexibility but can represent negative inventory; operations should not rely on “all sales are physically covered by stock” unless business rules are tightened. |
| P2 | Tests | `server/storage.test.ts` mostly mocks Drizzle; it does not assert FIFO math or allocation invariants end-to-end. |
| P2 | Concurrency | No row-level locks on `sales` / `invoices` for parallel writers; last write wins. |

## 3. Fixes implemented (this pass)

1. **FIFO full replay** — After consuming layers for each sale in `computeReplayedFifoCostsForAllSales`, if unmet quantity remains, throw `FifoInsufficientStockError` (same class as anchor replay). Prevents writing misleading COGS when the dataset is infeasible for FIFO.
2. **Reconcile endpoint** — Optional hardening: if environment variable `FIFO_RECONCILE_SECRET` is set, `POST /api/sales/reconcile-fifo-costs` requires header `X-Fuelflow-FIFO-Reconcile` to equal that secret, otherwise `403`. If the variable is **unset**, behavior is unchanged (backward compatible). The route now returns **400** with a clear message when reconciliation fails for insufficient stock, matching the delete-sale pattern.
3. **Cross-check** — `getTotalRevenue` / `getTotalCOGS` / `getGrossProfit` are consistent with per-sale `subtotal` and `cogs` (ex-VAT revenue vs COGS). Client date filters and `client/src/lib/calendar-date.ts` align display with calendar days; no code change was required in this pass.

## 4. Residual risks and recommendations

- **Integration tests** on a disposable Postgres/Neon database: create stock, multiple sales, edit quantity, delete sale, run reconcile, assert COGS and `getCostReconciliationSnapshot` (optional).
- **Production** — Set `FIFO_RECONCILE_SECRET` in the deployment environment and call reconcile only with the header from trusted operators or internal scripts.
- **Oversell policy** — If the product must **block** new sales when FIFO cannot cover quantity, enforce in `server/routes.ts` (POST) and/or `createSale` by rejecting when `getFIFOPurchaseCostForQuantity` is null; today the API allows fallback to manual PPG.
- **Concurrency** — If multiple users edit the same sale or payment simultaneously, add optimistic locking or serializable transactions only if you observe real conflicts.

## 5. File references

- FIFO replay: `computeReplayedFifoCostsForAllSales`, `applyFifoCostUpdates` — `server/storage.ts`
- Reconcile route: `POST /api/sales/reconcile-fifo-costs` — `server/routes.ts`
- Payment bulk pay: `bulkPayInvoices` — `server/storage.ts`

## 6. App-wide no-data-loss audit update (2026-04-27)

This follow-up pass widened the audit to backend multi-table flows, frontend payload/date handling, reports/cache invalidation, schema/startup safety, and operational routes. Changes were limited to guardrails, UI payload consistency, cache invalidation, and documentation. No destructive migrations or data rewrites were added.

### Additional safe fixes applied

1. **Paid sale cashbook posting** — `createSale` no longer posts a cashbook row using `clients.id` as `cashbook.account_head_id`. It now resolves or creates the client `account_heads` row and uses that id. This prevents FK failures or wrong ledger linkage when a sale is created directly with `saleStatus = "Paid"`.
2. **Client/account-head rename consistency** — `updateClient` now updates the matching client `accountHeads` name when the client name changes. This keeps later payment/cashbook lookups by client name aligned without changing historical transaction rows.
3. **Safer client delete preflight** — `deleteClient` now refuses to delete when any client sale is linked to a multi-sale invoice, matching the existing `deleteSale` safety rule. It also removes `invoice_sales` links for single-sale invoices before deleting invoice rows, and restricts account-head deletion to `type = "Client"`.
4. **Operational route guards** — `POST /api/payments/migrate-to-cashbook` and `POST /api/cashbook/reconcile-stock-purchases` now support optional `OPERATIONAL_ACTION_SECRET` via `X-Fuelflow-Operational-Action`, matching the existing optional FIFO reconcile secret pattern. If the env var is unset, behavior remains backwards compatible.
5. **Date payload consistency** — payment, stock, invoice, bulk-LPO, and cashbook date inputs now use `client/src/lib/calendar-date.ts` helpers instead of `new Date(plainYmd)` / `toISOString().split(...)`. This preserves the selected calendar day across local/UTC boundaries.
6. **Query invalidation coverage** — payment/allocation/bulk-payment flows now invalidate invoices, payment allocations, pending invoices, sales, cashbook, and reports where applicable, reducing stale invoice/payment state after cross-entity mutations.

### Additional residual risks

- **Non-transactional multi-step writes remain:** Neon HTTP paths still do best-effort sequencing in flows like invoice creation, bulk payment, and deletes. Current fixes reduce obvious orphan risks but do not replace true DB transactions.
- **Schema drift remains possible:** `schema-patches.ts` is additive/idempotent for many live columns/indexes, while `migrations/*.sql` contains a subset of those changes. `payment_projects` exists in `shared/schema.ts` but is not used by server business methods in this codebase.
- **Manual/operational endpoints remain powerful:** Set both `FIFO_RECONCILE_SECRET` and `OPERATIONAL_ACTION_SECRET` in production to require explicit headers for repair/migration actions.
- **Oversell policy remains a product decision:** The app still allows creating a sale with manual PPG if FIFO stock is insufficient; this preserves existing behavior but can represent negative inventory.
