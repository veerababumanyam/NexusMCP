import { db } from "./index";
import { eq } from "drizzle-orm";
import { users } from "@shared/schema";
import { authService } from "../server/services/auth-service";

async function updateAdmin() {
  try {
    console.log("Updating admin user password...");
    
    // Check if admin user exists
    const existingAdmin = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.username, "admin")
    });
    
    if (existingAdmin) {
      console.log("Admin user found, updating password...");
      const hashedPassword = await authService.hashPassword("admin@123");
      
      await db.update(users)
        .set({
          password: hashedPassword,
          fullName: "Super Admin",
          isActive: true,
          isEmailVerified: true,
          updatedAt: new Date()
        })
        .where(eq(users.id, existingAdmin.id));
      
      console.log("Admin user updated with username: admin, password: admin@123");
    } else {
      console.log("Admin user not found!");
    }
    
  } catch (error) {
    console.error("Error updating admin user:", error);
  }
}

updateAdmin();