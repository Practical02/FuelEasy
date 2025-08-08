// Simple Node.js script to seed admin user in production
import bcrypt from 'bcryptjs';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { pgTable, text, varchar } from 'drizzle-orm/pg-core';
import { eq } from 'drizzle-orm';

// Define users table schema
const users = pgTable("users", {
  id: varchar("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

async function seedAdminProduction() {
  try {
    // Use production database URL
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      console.error("DATABASE_URL environment variable is required");
      process.exit(1);
    }

    const sql = neon(connectionString);
    const db = drizzle(sql, { schema: { users } });

    // Check if admin user already exists
    const existingAdmin = await db.select().from(users).where(eq(users.username, "admin")).limit(1);
    if (existingAdmin.length > 0) {
      console.log("Admin user already exists in production");
      return;
    }

    // Get admin password from environment variable
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      console.error("ADMIN_PASSWORD environment variable is required");
      process.exit(1);
    }

    // Hash password and create admin user
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    
    await db.insert(users).values({
      id: crypto.randomUUID(),
      username: "admin",
      password: hashedPassword
    });

    console.log("✅ Admin user created successfully in production!");
    console.log("Username: admin");
    console.log("Password: [from ADMIN_PASSWORD env var]");
    
  } catch (error) {
    console.error("❌ Error creating admin user:", error);
    process.exit(1);
  }
}

seedAdminProduction();