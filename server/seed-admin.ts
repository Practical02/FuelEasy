import bcrypt from "bcryptjs";
import { storage } from "./storage";
import { pathToFileURL } from "url";

async function seedAdmin() {
  try {
    // Check if admin user already exists
    const existingAdmin = await storage.getUserByUsername("admin");
    if (existingAdmin) {
      console.log("Admin user already exists");
      return;
    }

    // Get admin password from environment variable
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      console.error("ADMIN_PASSWORD environment variable is required");
      console.error("Please set ADMIN_PASSWORD=your-secure-password in your environment");
      process.exit(1);
    }

    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    const admin = await storage.createUser({
      username: "admin",
      password: hashedPassword
    });

    console.log("Admin user created successfully!");
    console.log("Username: admin");
    console.log("Password: [hidden - check your ADMIN_PASSWORD environment variable]");
    
  } catch (error) {
    console.error("Error creating admin user:", error);
  }
}

// Run the seed function if this script is executed directly
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seedAdmin();
}

export { seedAdmin };