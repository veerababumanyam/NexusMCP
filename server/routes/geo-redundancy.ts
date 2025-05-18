/**
 * API routes for geo-redundancy and multi-region deployment features
 */

import express from "express";
import { db } from "../../db";
import { geoRoutingService, RegionStatus } from "../services/GeoRoutingService";
import { edgeProxyService } from "../services/EdgeProxyService";
import * as schema from "@shared/schema_geo_redundancy";
import { eq, and, desc, sql } from "drizzle-orm";

const router = express.Router();

/**
 * Get all regions
 */
router.get("/regions", async (req, res) => {
  try {
    const regions = await db.query.regions.findMany({
      with: {
        zones: true,
        metrics: {
          limit: 1,
          orderBy: [desc(schema.regionMetrics.timestamp)]
        }
      }
    });
    
    res.json(regions);
  } catch (error) {
    console.error("Error fetching regions:", error);
    res.status(500).json({ error: "Failed to fetch regions" });
  }
});

/**
 * Get a specific region
 */
router.get("/regions/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const region = await db.query.regions.findFirst({
      where: eq(schema.regions.id, id),
      with: {
        zones: true,
        metrics: {
          limit: 10,
          orderBy: [desc(schema.regionMetrics.timestamp)]
        },
        countryMaps: true
      }
    });
    
    if (!region) {
      return res.status(404).json({ error: "Region not found" });
    }
    
    res.json(region);
  } catch (error) {
    console.error(`Error fetching region ${req.params.id}:`, error);
    res.status(500).json({ error: "Failed to fetch region" });
  }
});

/**
 * Create a new region
 */
router.post("/regions", async (req, res) => {
  try {
    const regionData = schema.regionInsertSchema.parse(req.body);
    
    // Check if region already exists
    const existingRegion = await db.query.regions.findFirst({
      where: eq(schema.regions.id, regionData.id)
    });
    
    if (existingRegion) {
      return res.status(409).json({ error: "Region with this ID already exists" });
    }
    
    const newRegion = await db.insert(schema.regions).values(regionData).returning();
    
    res.status(201).json(newRegion[0]);
  } catch (error) {
    console.error("Error creating region:", error);
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Invalid region data", details: error.errors });
    }
    res.status(500).json({ error: "Failed to create region" });
  }
});

/**
 * Update a region
 */
router.patch("/regions/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Check if region exists
    const existingRegion = await db.query.regions.findFirst({
      where: eq(schema.regions.id, id)
    });
    
    if (!existingRegion) {
      return res.status(404).json({ error: "Region not found" });
    }
    
    // Update the region
    const updatedRegion = await db.update(schema.regions)
      .set({
        ...updateData,
        updatedAt: new Date()
      })
      .where(eq(schema.regions.id, id))
      .returning();
    
    res.json(updatedRegion[0]);
  } catch (error) {
    console.error(`Error updating region ${req.params.id}:`, error);
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Invalid region data", details: error.errors });
    }
    res.status(500).json({ error: "Failed to update region" });
  }
});

/**
 * Delete a region (with safety checks)
 */
router.delete("/regions/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if region exists
    const existingRegion = await db.query.regions.findFirst({
      where: eq(schema.regions.id, id)
    });
    
    if (!existingRegion) {
      return res.status(404).json({ error: "Region not found" });
    }
    
    // Check if this is the primary region
    if (existingRegion.isPrimary) {
      return res.status(400).json({ error: "Cannot delete the primary region" });
    }
    
    // Check if any other regions are using this as a failover region
    const dependentRegions = await db.query.regions.findMany({
      where: eq(schema.regions.failoverRegion, id)
    });
    
    if (dependentRegions.length > 0) {
      return res.status(400).json({
        error: "Cannot delete region that is used as a failover region",
        dependentRegions: dependentRegions.map(r => r.id)
      });
    }
    
    // Delete associated records first (zones, routes, latency data)
    await db.delete(schema.zones).where(eq(schema.zones.regionId, id));
    await db.delete(schema.regionRoutes).where(eq(schema.regionRoutes.sourceRegionId, id));
    await db.delete(schema.regionRoutes).where(eq(schema.regionRoutes.destinationRegionId, id));
    await db.delete(schema.geoLatency).where(eq(schema.geoLatency.sourceRegionId, id));
    await db.delete(schema.geoLatency).where(eq(schema.geoLatency.destinationRegionId, id));
    await db.delete(schema.countryRegionMap).where(eq(schema.countryRegionMap.regionId, id));
    await db.delete(schema.regionMetrics).where(eq(schema.regionMetrics.regionId, id));
    
    // Finally delete the region
    await db.delete(schema.regions).where(eq(schema.regions.id, id));
    
    res.status(204).end();
  } catch (error) {
    console.error(`Error deleting region ${req.params.id}:`, error);
    res.status(500).json({ error: "Failed to delete region" });
  }
});

/**
 * Get multi-region configuration
 */
router.get("/config", async (req, res) => {
  try {
    const config = await db.query.multiRegionConfig.findFirst({
      with: {
        primaryRegion: true
      }
    });
    
    if (!config) {
      return res.status(404).json({ error: "Multi-region configuration not found" });
    }
    
    res.json(config);
  } catch (error) {
    console.error("Error fetching multi-region configuration:", error);
    res.status(500).json({ error: "Failed to fetch multi-region configuration" });
  }
});

/**
 * Update multi-region configuration
 */
router.patch("/config", async (req, res) => {
  try {
    const updateData = req.body;
    
    // Make sure updatedBy and updatedAt are set
    updateData.updatedAt = new Date();
    updateData.updatedBy = req.user?.id || 1; // Use logged in user ID or fallback to system
    
    // Check if configuration exists
    const existingConfig = await db.query.multiRegionConfig.findFirst();
    
    if (!existingConfig) {
      // Create new configuration
      const newConfig = await db.insert(schema.multiRegionConfig).values({
        id: 1,
        ...updateData
      }).returning();
      
      return res.status(201).json(newConfig[0]);
    }
    
    // Update existing configuration
    const updatedConfig = await db.update(schema.multiRegionConfig)
      .set(updateData)
      .where(eq(schema.multiRegionConfig.id, 1))
      .returning();
    
    res.json(updatedConfig[0]);
  } catch (error) {
    console.error("Error updating multi-region configuration:", error);
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Invalid configuration data", details: error.errors });
    }
    res.status(500).json({ error: "Failed to update multi-region configuration" });
  }
});

/**
 * Get region health metrics
 */
router.get("/metrics", async (req, res) => {
  try {
    const { period } = req.query;
    let timeConstraint = sql`1=1`;
    
    // Apply time period filter
    if (period === "hour") {
      timeConstraint = sql`${schema.regionMetrics.timestamp} > NOW() - INTERVAL '1 hour'`;
    } else if (period === "day") {
      timeConstraint = sql`${schema.regionMetrics.timestamp} > NOW() - INTERVAL '1 day'`;
    } else if (period === "week") {
      timeConstraint = sql`${schema.regionMetrics.timestamp} > NOW() - INTERVAL '1 week'`;
    }
    
    const metrics = await db.select({
      regionId: schema.regionMetrics.regionId,
      avgCpuUsage: sql<number>`avg(${schema.regionMetrics.cpuUsage})`,
      avgMemoryUsage: sql<number>`avg(${schema.regionMetrics.memoryUsage})`,
      avgLatency: sql<number>`avg(${schema.regionMetrics.latency})`,
      totalRequests: sql<number>`sum(${schema.regionMetrics.requestCount})`,
      totalErrors: sql<number>`sum(${schema.regionMetrics.errorCount})`,
      avgNodes: sql<number>`avg(${schema.regionMetrics.nodeCount})`,
      avgActiveNodes: sql<number>`avg(${schema.regionMetrics.activeNodeCount})`,
      samples: sql<number>`count(*)`,
      lastUpdated: sql<Date>`max(${schema.regionMetrics.timestamp})`
    })
    .from(schema.regionMetrics)
    .where(timeConstraint)
    .groupBy(schema.regionMetrics.regionId);
    
    res.json(metrics);
  } catch (error) {
    console.error("Error fetching region metrics:", error);
    res.status(500).json({ error: "Failed to fetch region metrics" });
  }
});

/**
 * Get region latency data
 */
router.get("/latency", async (req, res) => {
  try {
    const latencyData = await db.query.geoLatency.findMany({
      with: {
        sourceRegion: true,
        destinationRegion: true
      }
    });
    
    res.json(latencyData);
  } catch (error) {
    console.error("Error fetching latency data:", error);
    res.status(500).json({ error: "Failed to fetch latency data" });
  }
});

/**
 * Get edge cache configuration
 */
router.get("/cache/config", async (req, res) => {
  try {
    const cacheConfig = await db.query.edgeCacheConfig.findMany();
    res.json(cacheConfig);
  } catch (error) {
    console.error("Error fetching edge cache configuration:", error);
    res.status(500).json({ error: "Failed to fetch edge cache configuration" });
  }
});

/**
 * Create edge cache configuration
 */
router.post("/cache/config", async (req, res) => {
  try {
    const configData = schema.edgeCacheConfigInsertSchema.parse(req.body);
    
    const newConfig = await db.insert(schema.edgeCacheConfig).values(configData).returning();
    
    res.status(201).json(newConfig[0]);
  } catch (error) {
    console.error("Error creating edge cache configuration:", error);
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Invalid cache configuration data", details: error.errors });
    }
    res.status(500).json({ error: "Failed to create edge cache configuration" });
  }
});

/**
 * Update edge cache configuration
 */
router.patch("/cache/config/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Always update the timestamp
    updateData.updatedAt = new Date();
    
    const updatedConfig = await db.update(schema.edgeCacheConfig)
      .set(updateData)
      .where(eq(schema.edgeCacheConfig.id, parseInt(id)))
      .returning();
    
    if (!updatedConfig.length) {
      return res.status(404).json({ error: "Cache configuration not found" });
    }
    
    res.json(updatedConfig[0]);
  } catch (error) {
    console.error(`Error updating cache configuration ${req.params.id}:`, error);
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Invalid cache configuration data", details: error.errors });
    }
    res.status(500).json({ error: "Failed to update cache configuration" });
  }
});

/**
 * Delete edge cache configuration
 */
router.delete("/cache/config/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.delete(schema.edgeCacheConfig)
      .where(eq(schema.edgeCacheConfig.id, parseInt(id)))
      .returning();
    
    if (!result.length) {
      return res.status(404).json({ error: "Cache configuration not found" });
    }
    
    res.status(204).end();
  } catch (error) {
    console.error(`Error deleting cache configuration ${req.params.id}:`, error);
    res.status(500).json({ error: "Failed to delete cache configuration" });
  }
});

/**
 * Invalidate cache by key
 */
router.post("/cache/invalidate", async (req, res) => {
  try {
    const { key } = req.body;
    
    if (!key) {
      return res.status(400).json({ error: "Invalid request. Key is required." });
    }
    
    // Find matching cache configs
    const matchingConfigs = await db.select()
      .from(schema.edgeCacheConfig)
      .where(eq(schema.edgeCacheConfig.invalidationKey, key));
    
    // Invalidate cache for matching keys
    edgeProxyService.invalidateCache(key);
    
    res.json({
      success: true,
      message: `Cache invalidated for key: ${key}`,
      affectedConfigs: matchingConfigs.length
    });
  } catch (error) {
    console.error("Error invalidating cache:", error);
    res.status(500).json({ error: "Failed to invalidate cache" });
  }
});

/**
 * Get the optimal region for a client
 */
router.get("/routing/optimal-region", async (req, res) => {
  try {
    const { country, ip } = req.query;
    
    // Get the client's region from headers if available
    const clientRegion = req.headers["x-client-region"] as string || undefined;
    
    // Get region latencies from edge proxy service
    const regionLatencies = edgeProxyService.getRegionLatencies();
    const latencyData = Object.fromEntries(
      regionLatencies.map(r => [r.region, r.avgLatency])
    );
    
    // Get optimal region using the geo routing service
    const optimalRegion = geoRoutingService.getOptimalRegion(
      clientRegion,
      country as string,
      ip as string,
      latencyData
    );
    
    if (!optimalRegion) {
      return res.status(404).json({ error: "No optimal region found" });
    }
    
    res.json({
      optimalRegion,
      clientInfo: {
        ip: ip || req.ip,
        region: clientRegion,
        country: country || req.headers["x-client-country"] || "unknown"
      }
    });
  } catch (error) {
    console.error("Error determining optimal region:", error);
    res.status(500).json({ error: "Failed to determine optimal region" });
  }
});

/**
 * Trigger a manual failover to a different region
 */
router.post("/failover", async (req, res) => {
  try {
    const { fromRegion, toRegion, reason } = req.body;
    
    if (!fromRegion || !toRegion) {
      return res.status(400).json({ error: "Both fromRegion and toRegion are required" });
    }
    
    // Check if regions exist
    const sourceRegion = await db.query.regions.findFirst({
      where: eq(schema.regions.id, fromRegion)
    });
    
    const destRegion = await db.query.regions.findFirst({
      where: eq(schema.regions.id, toRegion)
    });
    
    if (!sourceRegion || !destRegion) {
      return res.status(404).json({ error: "One or both regions not found" });
    }
    
    // Check if source region is the primary region
    if (!sourceRegion.isPrimary) {
      return res.status(400).json({ error: "Source region must be the primary region" });
    }
    
    // Check if destination region is already the primary
    if (destRegion.isPrimary) {
      return res.status(400).json({ error: "Destination region is already the primary region" });
    }
    
    // Update regions
    await db.batch([
      db.update(schema.regions)
        .set({ isPrimary: false })
        .where(eq(schema.regions.id, fromRegion)),
      
      db.update(schema.regions)
        .set({ isPrimary: true })
        .where(eq(schema.regions.id, toRegion))
    ]);
    
    // Update multi-region config
    await db.update(schema.multiRegionConfig)
      .set({
        primaryRegionId: toRegion,
        updatedAt: new Date(),
        updatedBy: req.user?.id || 1
      })
      .where(eq(schema.multiRegionConfig.id, 1));
    
    // Record failover history
    await db.insert(schema.failoverHistory).values({
      fromRegionId: fromRegion,
      toRegionId: toRegion,
      reason: reason || "Manual failover",
      isAutomatic: false,
      triggeredBy: req.user?.id,
      isSuccessful: true
    });
    
    res.json({
      success: true,
      message: `Failover from ${fromRegion} to ${toRegion} completed successfully`,
      timestamp: new Date()
    });
  } catch (error) {
    console.error("Error performing failover:", error);
    res.status(500).json({ error: "Failed to perform failover" });
  }
});

export default router;