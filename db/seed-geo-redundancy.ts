/**
 * Seed script for geo-redundancy tables
 */

import { db } from ".";
import * as schema from "../shared/schema_geo_redundancy";
import { and, eq } from "drizzle-orm";

async function seedGeoRedundancy() {
  console.log("Seeding geo-redundancy tables...");

  try {
    // Check if regions table exists and has data
    const existingRegions = await db.select().from(schema.regions);
    
    if (existingRegions.length > 0) {
      console.log(`Found ${existingRegions.length} existing regions. Skipping basic region seeding.`);
    } else {
      console.log("Seeding regions...");
      
      // Seed regions
      await db.insert(schema.regions).values([
        {
          id: "us-east-1",
          name: "US East (N. Virginia)",
          status: "available",
          isPrimary: true,
          isEdgeEnabled: true,
          priority: 100,
        },
        {
          id: "us-west-2",
          name: "US West (Oregon)",
          status: "available",
          isPrimary: false,
          isEdgeEnabled: true,
          failoverRegion: "us-east-1",
          priority: 90,
        },
        {
          id: "eu-west-1",
          name: "EU West (Ireland)",
          status: "available",
          isPrimary: false,
          isEdgeEnabled: true,
          failoverRegion: "us-east-1",
          priority: 80,
        },
        {
          id: "ap-southeast-1",
          name: "Asia Pacific (Singapore)",
          status: "available",
          isPrimary: false,
          isEdgeEnabled: true,
          failoverRegion: "us-east-1",
          priority: 70,
        },
        {
          id: "ap-northeast-1",
          name: "Asia Pacific (Tokyo)",
          status: "available",
          isPrimary: false,
          isEdgeEnabled: false,
          failoverRegion: "ap-southeast-1",
          priority: 60,
        }
      ]);
      
      console.log("Regions seeded successfully.");
    }
    
    // Check if zones table exists and has data
    const existingZones = await db.select().from(schema.zones);
    
    if (existingZones.length > 0) {
      console.log(`Found ${existingZones.length} existing zones. Skipping zone seeding.`);
    } else {
      console.log("Seeding zones...");
      
      // Seed zones
      await db.insert(schema.zones).values([
        {
          id: "us-east-1a",
          regionId: "us-east-1",
          name: "us-east-1a",
          status: "available",
          isPrimary: true,
          priority: 100,
        },
        {
          id: "us-east-1b",
          regionId: "us-east-1",
          name: "us-east-1b",
          status: "available",
          isPrimary: false,
          priority: 90,
        },
        {
          id: "us-west-2a",
          regionId: "us-west-2",
          name: "us-west-2a",
          status: "available",
          isPrimary: true,
          priority: 100,
        },
        {
          id: "us-west-2b",
          regionId: "us-west-2",
          name: "us-west-2b",
          status: "available",
          isPrimary: false,
          priority: 90,
        },
        {
          id: "eu-west-1a",
          regionId: "eu-west-1",
          name: "eu-west-1a",
          status: "available",
          isPrimary: true,
          priority: 100,
        },
        {
          id: "eu-west-1b",
          regionId: "eu-west-1",
          name: "eu-west-1b",
          status: "available",
          isPrimary: false,
          priority: 90,
        },
        {
          id: "ap-southeast-1a",
          regionId: "ap-southeast-1",
          name: "ap-southeast-1a",
          status: "available",
          isPrimary: true,
          priority: 100,
        },
        {
          id: "ap-southeast-1b",
          regionId: "ap-southeast-1",
          name: "ap-southeast-1b",
          status: "available",
          isPrimary: false,
          priority: 90,
        },
        {
          id: "ap-northeast-1a",
          regionId: "ap-northeast-1",
          name: "ap-northeast-1a",
          status: "available",
          isPrimary: true,
          priority: 100,
        },
        {
          id: "ap-northeast-1c",
          regionId: "ap-northeast-1",
          name: "ap-northeast-1c",
          status: "available",
          isPrimary: false,
          priority: 90,
        }
      ]);
      
      console.log("Zones seeded successfully.");
    }
    
    // Check if country_region_map table exists and has data
    const existingCountryMaps = await db.select().from(schema.countryRegionMap);
    
    if (existingCountryMaps.length > 0) {
      console.log(`Found ${existingCountryMaps.length} existing country-region mappings. Skipping seeding.`);
    } else {
      console.log("Seeding country-region mappings...");
      
      // Seed country-region mappings
      await db.insert(schema.countryRegionMap).values([
        { countryCode: "US", regionId: "us-east-1", priority: 100 },
        { countryCode: "US", regionId: "us-west-2", priority: 90 },
        { countryCode: "CA", regionId: "us-east-1", priority: 100 },
        { countryCode: "CA", regionId: "us-west-2", priority: 90 },
        { countryCode: "MX", regionId: "us-east-1", priority: 100 },
        { countryCode: "GB", regionId: "eu-west-1", priority: 100 },
        { countryCode: "GB", regionId: "us-east-1", priority: 80 },
        { countryCode: "DE", regionId: "eu-west-1", priority: 100 },
        { countryCode: "FR", regionId: "eu-west-1", priority: 100 },
        { countryCode: "IT", regionId: "eu-west-1", priority: 100 },
        { countryCode: "ES", regionId: "eu-west-1", priority: 100 },
        { countryCode: "JP", regionId: "ap-northeast-1", priority: 100 },
        { countryCode: "JP", regionId: "ap-southeast-1", priority: 80 },
        { countryCode: "SG", regionId: "ap-southeast-1", priority: 100 },
        { countryCode: "AU", regionId: "ap-southeast-1", priority: 100 },
        { countryCode: "IN", regionId: "ap-southeast-1", priority: 100 },
        { countryCode: "CN", regionId: "ap-northeast-1", priority: 100 },
        { countryCode: "CN", regionId: "ap-southeast-1", priority: 90 }
      ]);
      
      console.log("Country-region mappings seeded successfully.");
    }
    
    // Check if multi_region_config table exists and has data
    const existingConfig = await db.select().from(schema.multiRegionConfig);
    
    if (existingConfig.length > 0) {
      console.log("Multi-region configuration already exists. Skipping seeding.");
    } else {
      console.log("Seeding multi-region configuration...");
      
      // Seed multi-region configuration
      await db.insert(schema.multiRegionConfig).values({
        id: 1,
        isEnabled: true,
        primaryRegionId: "us-east-1",
        routingStrategy: "nearest",
        autoFailover: true,
        edgeCaching: true,
        asyncReplication: true,
        maxLatencyThreshold: 500,
        healthCheckInterval: 60,
        updatedBy: 1
      });
      
      console.log("Multi-region configuration seeded successfully.");
    }
    
    // Seed geo latency data
    const existingLatencyData = await db.select().from(schema.geoLatency);
    
    if (existingLatencyData.length > 0) {
      console.log(`Found ${existingLatencyData.length} existing latency measurements. Skipping seeding.`);
    } else {
      console.log("Seeding geo-latency data...");
      
      // Get all regions
      const regions = await db.select().from(schema.regions);
      
      // Create latency measurements between all regions
      const latencyValues = [];
      
      for (const sourceRegion of regions) {
        for (const destRegion of regions) {
          if (sourceRegion.id !== destRegion.id) {
            // Simulate realistic latency based on region pairings
            let avgLatency = 100; // default
            
            // Same continent connections are faster
            if (sourceRegion.id.startsWith("us") && destRegion.id.startsWith("us")) {
              avgLatency = 35;
            } else if (sourceRegion.id.startsWith("eu") && destRegion.id.startsWith("eu")) {
              avgLatency = 30;
            } else if (sourceRegion.id.startsWith("ap") && destRegion.id.startsWith("ap")) {
              avgLatency = 50;
            } 
            // Cross-region connections
            else if (
              (sourceRegion.id.startsWith("us") && destRegion.id.startsWith("eu")) ||
              (sourceRegion.id.startsWith("eu") && destRegion.id.startsWith("us"))
            ) {
              avgLatency = 80;
            } else if (
              (sourceRegion.id.startsWith("us") && destRegion.id.startsWith("ap")) ||
              (sourceRegion.id.startsWith("ap") && destRegion.id.startsWith("us"))
            ) {
              avgLatency = 180;
            } else if (
              (sourceRegion.id.startsWith("eu") && destRegion.id.startsWith("ap")) ||
              (sourceRegion.id.startsWith("ap") && destRegion.id.startsWith("eu"))
            ) {
              avgLatency = 200;
            }
            
            latencyValues.push({
              sourceRegionId: sourceRegion.id,
              destinationRegionId: destRegion.id,
              averageLatency: avgLatency,
              minLatency: avgLatency * 0.8,
              maxLatency: avgLatency * 1.5,
              stdDeviation: avgLatency * 0.1,
              sampleCount: 100,
              successRate: 99.5,
              isActive: true
            });
          }
        }
      }
      
      if (latencyValues.length > 0) {
        await db.insert(schema.geoLatency).values(latencyValues);
      }
      
      console.log(`Seeded ${latencyValues.length} geo-latency measurements.`);
    }
    
    // Seed edge cache configuration
    const existingCacheConfig = await db.select().from(schema.edgeCacheConfig);
    
    if (existingCacheConfig.length > 0) {
      console.log(`Found ${existingCacheConfig.length} existing cache configurations. Skipping seeding.`);
    } else {
      console.log("Seeding edge cache configurations...");
      
      await db.insert(schema.edgeCacheConfig).values([
        {
          pathPattern: "/api/static/*",
          cacheTtl: 3600,
          isEnabled: true,
          regions: JSON.stringify(["us-east-1", "us-west-2", "eu-west-1", "ap-southeast-1"]),
          invalidationKey: "static-assets"
        },
        {
          pathPattern: "/api/config/*",
          cacheTtl: 300,
          isEnabled: true,
          regions: JSON.stringify(["us-east-1", "us-west-2", "eu-west-1", "ap-southeast-1", "ap-northeast-1"]),
          invalidationKey: "config-data"
        },
        {
          pathPattern: "/api/public/*",
          cacheTtl: 1800,
          isEnabled: true,
          regions: JSON.stringify(["us-east-1", "us-west-2", "eu-west-1", "ap-southeast-1"]),
          invalidationKey: "public-data"
        }
      ]);
      
      console.log("Edge cache configurations seeded successfully.");
    }
    
    console.log("Geo-redundancy tables seeded successfully!");
  } catch (error) {
    console.error("Error seeding geo-redundancy tables:", error);
    process.exit(1);
  }
}

seedGeoRedundancy().then(() => {
  console.log("Done!");
  process.exit(0);
});