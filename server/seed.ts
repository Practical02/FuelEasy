// Simple seed script for Drizzle ORM (ESM only)
import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Client } = pkg;
import { sales, clients, payments, projects } from '../shared/schema';

export async function seed() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  await client.connect();
  const db = drizzle(client);

  // Insert clients
  const insertedClients = await db.insert(clients).values([
    {
      name: 'Test Client',
      contactPerson: 'John Doe',
      phoneNumber: '1234567890',
      email: 'testclient@example.com',
      address: '123 Main St',
    },
  ]).returning();
  const clientId = insertedClients[0]?.id;

  // Insert projects
  const insertedProjects = await db.insert(projects).values([
    {
      name: 'Test Project',
      clientId,
    },
  ]).returning();
  const projectId = insertedProjects[0]?.id;

  // Insert sales
  // Calculate required fields
  const quantityGallons = 100;
  const salePricePerGallon = 10;
  const purchasePricePerGallon = 5;
  const vatPercentage = 5;
  const subtotal = (quantityGallons * salePricePerGallon).toFixed(2); // 1000.00
  const vatAmount = ((Number(subtotal) * vatPercentage) / 100).toFixed(2); // 50.00
  const totalAmount = (Number(subtotal) + Number(vatAmount)).toFixed(2); // 1050.00
  const cogs = (quantityGallons * purchasePricePerGallon).toFixed(2); // 500.00
  const grossProfit = (Number(subtotal) - Number(cogs)).toFixed(2); // 500.00

  const insertedSales = await db.insert(sales).values([
    {
      clientId,
      projectId,
      saleStatus: 'Invoiced',
      saleDate: new Date(),
      quantityGallons: quantityGallons.toString(),
      salePricePerGallon: salePricePerGallon.toString(),
      purchasePricePerGallon: purchasePricePerGallon.toString(),
      subtotal,
      vatAmount,
      totalAmount,
      cogs,
      grossProfit,
    },
  ]).returning();
  const saleId = insertedSales[0]?.id;

  // Insert payments
  await db.insert(payments).values([
    {
      saleId,
      paymentDate: new Date(),
      amountReceived: '200.00',
      paymentMethod: 'Cash',
    },
  ]);

  await client.end();
  console.log('Seed data inserted successfully');
}

// Run if called directly (ESM entrypoint)
if (import.meta.url === `file://${process.argv[1]}`) {
  seed().catch((err) => {
    console.error('Seed error:', err);
  });
}
