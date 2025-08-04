import { config } from "dotenv";

// Load environment variables
config();

async function resetAndSeedDatabase() {
  try {
    console.log("🔄 Starting Database Reset and Seed Process...\n");

    // Import storage after environment is loaded
    const { storage } = await import("./storage");

    // Step 1: Clear all data (we'll use a simple approach)
    console.log("📋 Step 1: Clearing all existing data...");
    
    // Get all existing data and delete it
    const existingPayments = await storage.getPayments();
    const existingInvoices = await storage.getInvoices();
    const existingSales = await storage.getSales();
    const existingStock = await storage.getStock();
    const existingCashbook = await storage.getCashbookEntries();
    const existingProjects = await storage.getProjects();
    const existingClients = await storage.getClients();
    const existingAccountHeads = await storage.getAccountHeads();

    // Clear cashbook payment allocations first (no delete method available)
    const { drizzle } = await import("drizzle-orm/neon-http");
    const { neon } = await import("@neondatabase/serverless");
    const { sql } = await import("drizzle-orm");
    
    const connectionString = process.env.DATABASE_URL || "";
    const sql_conn = neon(connectionString);
    const db = drizzle(sql_conn);
    
    await db.execute(sql`DELETE FROM cashbook_payment_allocations`);
    console.log("✅ Cleared cashbook_payment_allocations");

    // Use direct database calls to clear everything in correct order
    await db.execute(sql`DELETE FROM cashbook_payment_allocations`);
    await db.execute(sql`DELETE FROM payments`);
    await db.execute(sql`DELETE FROM invoices`);
    await db.execute(sql`DELETE FROM sales`);
    await db.execute(sql`DELETE FROM stock`);
    await db.execute(sql`DELETE FROM cashbook`);
    await db.execute(sql`DELETE FROM projects`);
    await db.execute(sql`DELETE FROM clients`);
    await db.execute(sql`DELETE FROM account_heads`);
    
    console.log("✅ All existing data cleared");

    console.log("\n📋 Step 2: Seeding fresh data...");

    // Step 2: Create Account Heads
    console.log("  📊 Creating account heads...");
    const supplierAccountHead = await storage.createAccountHead({ 
      name: "Sigma Diesel Trading Pvt Ltd", 
      type: "Supplier" 
    });
    
    const ownerAccountHead = await storage.createAccountHead({ 
      name: "Owner Investment", 
      type: "Other" 
    });
    
    console.log("✅ Account heads created");

    // Step 3: Create Clients (this will auto-create client account heads)
    console.log("  👥 Creating clients...");
    const client1 = await storage.createClient({
      name: "ABC Construction Co",
      contactPerson: "John Smith",
      phoneNumber: "+971-50-123-4567",
      email: "john@abc.com",
      address: "Dubai, UAE"
    });
    
    const client2 = await storage.createClient({
      name: "XYZ Engineering Ltd",
      contactPerson: "Sarah Johnson",
      phoneNumber: "+971-50-234-5678",
      email: "sarah@xyz.com",
      address: "Abu Dhabi, UAE"
    });
    
    const client3 = await storage.createClient({
      name: "DEF Contractors",
      contactPerson: "Mike Wilson",
      phoneNumber: "+971-50-345-6789",
      email: "mike@def.com",
      address: "Sharjah, UAE"
    });
    
    console.log("✅ Clients created");

    // Step 4: Create Projects
    console.log("  🏗️ Creating projects...");
    const project1 = await storage.createProject({
      clientId: client1.id,
      name: "Dubai Marina Tower",
      description: "High-rise residential tower construction",
      status: "Active"
    });
    
    const project2 = await storage.createProject({
      clientId: client2.id,
      name: "Abu Dhabi Bridge",
      description: "Infrastructure bridge project",
      status: "Active"
    });
    
    const project3 = await storage.createProject({
      clientId: client3.id,
      name: "Sharjah Mall",
      description: "Shopping mall development",
      status: "Active"
    });
    
    console.log("✅ Projects created");

    // Step 5: Create Stock Purchases
    console.log("  ⛽ Creating stock purchases...");
    const stock1 = await storage.createStock({
      purchaseDate: new Date("2024-01-15"),
      quantityGallons: "5000.00",
      purchasePricePerGallon: "2.85",
      vatAmount: "712.50",
      totalCost: "14862.50"
    });
    
    const stock2 = await storage.createStock({
      purchaseDate: new Date("2024-02-15"),
      quantityGallons: "3000.00",
      purchasePricePerGallon: "2.90",
      vatAmount: "435.00",
      totalCost: "9135.00"
    });
    
    console.log("✅ Stock purchases created");

    // Step 6: Create Owner Investments
    console.log("  💰 Creating owner investments...");
    const investment1 = await storage.createCashbookEntry({
      transactionDate: new Date("2024-01-01"),
      transactionType: "Investment",
      accountHeadId: ownerAccountHead.id,
      amount: "50000.00",
      isInflow: 1,
      description: "Initial business investment",
      counterparty: "Owner",
      paymentMethod: "Bank Transfer",
      referenceType: "manual",
      isPending: 0,
      notes: "Initial capital injection"
    });
    
    const investment2 = await storage.createCashbookEntry({
      transactionDate: new Date("2024-02-01"),
      transactionType: "Investment",
      accountHeadId: ownerAccountHead.id,
      amount: "25000.00",
      isInflow: 1,
      description: "Additional investment for operations",
      counterparty: "Owner",
      paymentMethod: "Bank Transfer",
      referenceType: "manual",
      isPending: 0,
      notes: "Working capital injection"
    });
    
    console.log("✅ Owner investments created");

    // Step 7: Create Sales Records
    console.log("  📈 Creating sales records...");
    const sale1 = await storage.createSale({
      clientId: client1.id,
      projectId: project1.id,
      saleDate: new Date("2024-01-20"),
      quantityGallons: "1000.00",
      salePricePerGallon: "3.50",
      purchasePricePerGallon: "2.85",
      lpoNumber: "LPO-ABC-001",
      lpoReceivedDate: new Date("2024-01-20"),
      lpoDueDate: new Date("2024-02-20"),
      invoiceDate: new Date("2024-01-20"),
      saleStatus: "Invoiced",
      vatPercentage: "5.00"
    });
    
    const sale2 = await storage.createSale({
      clientId: client2.id,
      projectId: project2.id,
      saleDate: new Date("2024-02-20"),
      quantityGallons: "1500.00",
      salePricePerGallon: "3.60",
      purchasePricePerGallon: "2.90",
      lpoNumber: "LPO-XYZ-001",
      lpoReceivedDate: new Date("2024-02-20"),
      lpoDueDate: new Date("2024-03-20"),
      invoiceDate: new Date("2024-02-20"),
      saleStatus: "Invoiced",
      vatPercentage: "5.00"
    });
    
    const sale3 = await storage.createSale({
      clientId: client3.id,
      projectId: project3.id,
      saleDate: new Date("2024-03-20"),
      quantityGallons: "800.00",
      salePricePerGallon: "3.40",
      purchasePricePerGallon: "2.85",
      lpoNumber: "LPO-DEF-001",
      lpoReceivedDate: new Date("2024-03-20"),
      lpoDueDate: new Date("2024-04-20"),
      invoiceDate: new Date("2024-03-20"),
      saleStatus: "Invoiced",
      vatPercentage: "5.00"
    });
    
    console.log("✅ Sales records created");

    // Step 8: Create Invoices
    console.log("  📄 Creating invoices...");
    const invoice1 = await storage.createInvoice({
      saleId: sale1.id,
      invoiceNumber: "INV-001",
      invoiceDate: new Date("2024-01-20"),
      totalAmount: "3675.00",
      vatAmount: "175.00",
      status: "Generated"
    });
    
    const invoice2 = await storage.createInvoice({
      saleId: sale2.id,
      invoiceNumber: "INV-002",
      invoiceDate: new Date("2024-02-20"),
      totalAmount: "5670.00",
      vatAmount: "270.00",
      status: "Generated"
    });
    
    const invoice3 = await storage.createInvoice({
      saleId: sale3.id,
      invoiceNumber: "INV-003",
      invoiceDate: new Date("2024-03-20"),
      totalAmount: "2856.00",
      vatAmount: "136.00",
      status: "Generated"
    });
    
    console.log("✅ Invoices created");

    // Step 9: Create Client Payments
    console.log("  💳 Creating client payments...");
    
    // Get client account heads that were auto-created
    const accountHeads = await storage.getAccountHeads();
    const client1AccountHead = accountHeads.find(h => h.name === "ABC Construction Co" && h.type === "Client");
    const client2AccountHead = accountHeads.find(h => h.name === "XYZ Engineering Ltd" && h.type === "Client");
    
    if (!client1AccountHead || !client2AccountHead) {
      throw new Error("Client account heads not found");
    }
    
    const clientPayment1 = await storage.createCashbookEntry({
      transactionDate: new Date("2024-02-01"),
      transactionType: "Sale Revenue",
      accountHeadId: client1AccountHead.id,
      amount: "12000.00",
      isInflow: 1,
      description: "Payment for multiple invoices",
      counterparty: "ABC Construction Co",
      paymentMethod: "Bank Transfer",
      referenceType: "manual",
      isPending: 0,
      notes: "Payment to allocate to multiple invoices"
    });
    
    const clientPayment2 = await storage.createCashbookEntry({
      transactionDate: new Date("2024-03-01"),
      transactionType: "Sale Revenue",
      accountHeadId: client2AccountHead.id,
      amount: "5670.00",
      isInflow: 1,
      description: "Payment for invoice INV-002",
      counterparty: "XYZ Engineering Ltd",
      paymentMethod: "Bank Transfer",
      referenceType: "manual",
      isPending: 0,
      notes: "Full payment for invoice"
    });
    
    console.log("✅ Client payments created");

    // Step 10: Create Supplier Debt Payments
    console.log("  🏦 Creating supplier debt payments...");
    const supplierPayment1 = await storage.createCashbookEntry({
      transactionDate: new Date("2024-02-15"),
      transactionType: "Stock Payment",
      accountHeadId: supplierAccountHead.id,
      amount: "14250.00",
      isInflow: 0,
      description: "Payment for stock purchase LPO-001",
      counterparty: "Sigma Diesel Trading Pvt Ltd",
      paymentMethod: "Bank Transfer",
      referenceType: "stock",
      isPending: 0,
      notes: "Payment for 5000 gallons"
    });
    
    console.log("✅ Supplier debt payments created");

    // Step 11: Create Payment Allocations
    console.log("  📊 Creating payment allocations...");
    const allocation1 = await storage.createCashbookPaymentAllocation({
      cashbookEntryId: clientPayment1.id,
      invoiceId: invoice1.id,
      amountAllocated: "3675.00"
    });
    
    const allocation2 = await storage.createCashbookPaymentAllocation({
      cashbookEntryId: clientPayment1.id,
      invoiceId: invoice2.id,
      amountAllocated: "5670.00"
    });
    
    const allocation3 = await storage.createCashbookPaymentAllocation({
      cashbookEntryId: clientPayment1.id,
      invoiceId: invoice3.id,
      amountAllocated: "2655.00"
    });
    
    console.log("✅ Payment allocations created");

    console.log("\n🎉 Database reset and seeding completed successfully!");
    console.log("\n📊 Summary of created data:");
    console.log("  ✅ 3 Account Heads (Supplier, Owner, Clients auto-created)");
    console.log("  ✅ 3 Clients");
    console.log("  ✅ 3 Projects");
    console.log("  ✅ 2 Stock Purchases");
    console.log("  ✅ 2 Owner Investments");
    console.log("  ✅ 3 Sales Records");
    console.log("  ✅ 3 Invoices");
    console.log("  ✅ 2 Client Payments");
    console.log("  ✅ 1 Supplier Debt Payment");
    console.log("  ✅ 3 Payment Allocations");
    console.log("  ✅ 3 Payment Records (auto-created)");
    console.log("\n🚀 Your database is now ready for testing!");

  } catch (error) {
    console.error("❌ Error during database reset and seeding:", error);
    process.exit(1);
  }
}

// Run the reset and seed process
resetAndSeedDatabase(); 