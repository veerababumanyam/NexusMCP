/**
 * Run geo-redundancy migration to create tables for multi-region deployment
 */

import { db } from ".";
import { readFileSync } from "fs";
import { join } from "path";
import { drizzle } from "drizzle-orm/neon-serverless";
import { Client } from "@neondatabase/serverless";
import dotenv from "dotenv";

dotenv.config();

async function runGeoRedundancyMigration() {
  console.log("Running geo-redundancy migration script...");

  try {
    // Read the SQL file
    const sqlFile = readFileSync(join(__dirname, "migrations", "0006_add_geo_redundancy.sql"), "utf8");
    
    // Split the SQL file into statements
    const statements = sqlFile
      .split(";")
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    console.log(`Found ${statements.length} SQL statements`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`Executing statement ${i + 1}/${statements.length}...`);
      await db.execute(statement + ";");
    }
    
    console.log("Geo-redundancy migration completed successfully!");
  } catch (error) {
    console.error("Error running geo-redundancy migration:", error);
    process.exit(1);
  }
}

runGeoRedundancyMigration().then(() => {
  console.log("Done!");
  process.exit(0);
});