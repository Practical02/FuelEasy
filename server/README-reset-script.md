# Database Reset and Seed Script

## Overview
The `reset-and-seed-db.ts` script provides a comprehensive solution for clearing the database and populating it with fresh test data.

## Usage
```bash
npx tsx server/reset-and-seed-db.ts
```

## What it does

### 1. Database Clearing
- Clears all existing data from all tables in the correct order to respect foreign key constraints
- Uses direct database calls to ensure complete cleanup

### 2. Test Data Creation
Creates a complete set of test data including:

#### Account Heads
- **Supplier**: Sigma Diesel Trading Pvt Ltd
- **Owner Investment**: Owner Investment
- **Clients**: Auto-created for each client

#### Clients
- ABC Construction Co (Dubai)
- XYZ Engineering Ltd (Abu Dhabi)
- DEF Contractors (Sharjah)

#### Projects
- Dubai Marina Tower
- Abu Dhabi Bridge
- Sharjah Mall

#### Stock Purchases
- 5000 gallons at AED 2.85/gallon
- 3000 gallons at AED 2.90/gallon

#### Owner Investments
- Initial investment: AED 50,000
- Additional investment: AED 25,000

#### Sales Records
- 3 sales with different quantities and prices
- All marked as "Invoiced"

#### Invoices
- 3 invoices corresponding to the sales
- All marked as "Generated"

#### Client Payments
- Payment of AED 12,000 from ABC Construction Co (for multiple invoices)
- Payment of AED 5,670 from XYZ Engineering Ltd (for single invoice)

#### Supplier Debt Payments
- Payment of AED 14,250 to Sigma Diesel Trading Pvt Ltd

#### Payment Allocations
- Allocates the AED 12,000 payment across all 3 invoices
- Creates corresponding payment records automatically

## Features Tested
This test data allows you to test:

1. **Cashbook Management**
   - Inflows and outflows
   - Account head categorization
   - Balance calculations

2. **Payment Allocation System**
   - Allocating single payments to multiple invoices
   - Over-allocation prevention
   - Invoice status updates

3. **Supplier Debt Tracking**
   - Stock purchases on credit
   - Payment tracking
   - Outstanding balance calculations

4. **Client Payment Tracking**
   - Multiple payment methods
   - Payment history
   - Outstanding balances

5. **Invoice Management**
   - Invoice generation
   - Payment status updates
   - Allocation tracking

## Notes
- The script uses the storage interface for most operations
- Direct database calls are used only for clearing data
- All foreign key constraints are respected
- Payment records are automatically created when allocations are made
- Invoice statuses are automatically updated when fully paid

## Troubleshooting
If you encounter any errors:
1. Ensure your `.env` file has the correct `DATABASE_URL`
2. Check that the database is accessible
3. Verify that all required tables exist in the database 