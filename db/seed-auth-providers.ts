import { db } from "./index";
import { authProviders } from "@shared/schema";

async function seedAuthProviders() {
  try {
    console.log("Seeding OAuth auth providers...");
    
    // Check if any providers exist
    const existingProviders = await db.query.authProviders.findMany();
    
    // Only seed if no providers exist
    if (existingProviders.length === 0) {
      console.log("No auth providers found, creating default providers...");
      
      // Default providers configuration
      const defaultProviders = [
        {
          name: "Local Authentication",
          type: "local",
          isEnabled: true,
          config: {},
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          name: "Google",
          type: "google",
          isEnabled: true, // Set to false if not configured
          config: {
            clientId: process.env.GOOGLE_CLIENT_ID || "",
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
            redirectUri: `${process.env.APP_URL || "http://localhost:5000"}/api/auth/oauth/callback`,
            authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
            tokenUrl: "https://oauth2.googleapis.com/token",
            scope: "email profile"
          },
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          name: "Microsoft",
          type: "microsoft",
          isEnabled: true, // Set to false if not configured
          config: {
            clientId: process.env.MICROSOFT_CLIENT_ID || "",
            clientSecret: process.env.MICROSOFT_CLIENT_SECRET || "",
            redirectUri: `${process.env.APP_URL || "http://localhost:5000"}/api/auth/oauth/callback`,
            authorizationUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
            tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
            scope: "user.read email profile openid"
          },
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          name: "Generic OIDC Provider",
          type: "oidc",
          isEnabled: false, // Disabled by default
          config: {
            clientId: "",
            clientSecret: "",
            redirectUri: `${process.env.APP_URL || "http://localhost:5000"}/api/auth/oidc/callback`,
            authorizationUrl: "https://your-identity-provider.com/oauth2/authorize",
            tokenUrl: "https://your-identity-provider.com/oauth2/token",
            userInfoUrl: "https://your-identity-provider.com/oauth2/userinfo",
            scope: "openid email profile"
          },
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
      
      // Insert providers
      for (const provider of defaultProviders) {
        const [newProvider] = await db
          .insert(authProviders)
          .values(provider)
          .returning();
        
        console.log(`Created ${provider.type} provider: ${provider.name}`);
      }
      
      console.log("Auth providers seeded successfully!");
    } else {
      console.log(`Found ${existingProviders.length} existing auth providers, skipping seed.`);
    }
  } catch (error) {
    console.error("Error seeding auth providers:", error);
  }
}

// Run the seed function
seedAuthProviders();