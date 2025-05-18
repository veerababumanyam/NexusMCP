/**
 * Edge Proxy Service
 * 
 * Manages edge nodes and provides edge caching and proxying capabilities:
 * - Region-based request routing
 * - Content caching at the edge
 * - Intelligent failover between regions
 * - Geographic content optimization
 * - Request latency monitoring
 */

import { Request, Response, NextFunction } from 'express';
import { geoRoutingService, RegionStatus } from './GeoRoutingService';
import { clusterService, NodeStatus } from './clusterService';
import { createHash } from 'crypto';
import { eventBus } from '../eventBus';

// Cache entry
interface CacheEntry {
  data: any;
  contentType: string;
  expires: number;
  region: string;
  zone: string;
  cacheControl: string;
}

// Latency measurement
interface LatencyMeasurement {
  timestamp: number;
  latency: number;
  success: boolean;
}

// Region latency info
interface RegionLatency {
  region: string;
  measurements: LatencyMeasurement[];
  avgLatency: number;
  successRate: number;
  lastUpdated: number;
}

class EdgeProxyService {
  private cache: Map<string, CacheEntry> = new Map();
  private regionLatencies: Map<string, RegionLatency> = new Map();
  private isInitialized = false;
  private cleanupInterval: NodeJS.Timer | null = null;
  private latencyCheckInterval: NodeJS.Timer | null = null;
  private readonly cleanupFrequency = 300000; // 5 minutes
  private readonly latencyCheckFrequency = 60000; // 1 minute
  private readonly maxCacheSize = 1000; // Max cache entries
  private readonly defaultTtl = 300; // 5 minutes in seconds
  private readonly cacheEnabled = true;
  
  constructor() {}
  
  /**
   * Initialize the edge proxy service
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      // Start cache cleanup interval
      this.startCacheCleanup();
      
      // Start latency check interval
      this.startLatencyChecks();
      
      // Subscribe to events
      this.subscribeToEvents();
      
      this.isInitialized = true;
      console.log('Edge Proxy Service initialized');
    } catch (error) {
      console.error('Failed to initialize Edge Proxy Service:', error);
      throw error;
    }
  }
  
  /**
   * Middleware for geo-routing requests
   */
  public geoRoutingMiddleware(): (req: Request, res: Response, next: NextFunction) => void {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Get client info
        const clientIp = this.getClientIp(req);
        const clientRegion = req.headers['x-client-region'] as string;
        const clientCountry = req.headers['x-client-country'] as string;
        
        // First check if we're running at the edge
        const isEdgeNode = clusterService.getSelfInfo().role === 'edge';
        
        if (isEdgeNode) {
          // If we're an edge node, check cache
          const cacheKey = this.generateCacheKey(req);
          const cachedResponse = this.getCachedResponse(cacheKey);
          
          if (cachedResponse) {
            res.setHeader('Content-Type', cachedResponse.contentType);
            res.setHeader('X-Edge-Cache', 'HIT');
            res.setHeader('X-Edge-Region', cachedResponse.region);
            res.setHeader('X-Edge-Zone', cachedResponse.zone);
            res.setHeader('Cache-Control', cachedResponse.cacheControl);
            return res.send(cachedResponse.data);
          }
          
          // Cache miss, proceed to route to optimal region
          res.setHeader('X-Edge-Cache', 'MISS');
        }
        
        // Get optimal region
        const regionLatencyData = Object.fromEntries(
          Array.from(this.regionLatencies.entries())
            .map(([region, data]) => [region, data.avgLatency])
        );
        
        const optimalRegion = geoRoutingService.getOptimalRegion(
          clientRegion,
          clientCountry,
          clientIp,
          regionLatencyData
        );
        
        if (!optimalRegion) {
          console.warn('No optimal region found, proceeding with default routing');
          return next();
        }
        
        // If the current node is in the optimal region, proceed
        const selfInfo = clusterService.getSelfInfo();
        if (selfInfo.region === optimalRegion.name) {
          res.setHeader('X-Routed-Region', optimalRegion.name);
          res.setHeader('X-Routing-Type', 'direct');
          return next();
        }
        
        // Otherwise, need to proxy to a node in the optimal region
        const targetNode = geoRoutingService.getBestNodeInRegion(optimalRegion.name);
        if (!targetNode) {
          console.warn(`No available node in optimal region ${optimalRegion.name}, proceeding with local handling`);
          return next();
        }
        
        // For now, we redirect to the target node
        // In a real implementation, we would proxy the request
        const targetUrl = `http://${targetNode.host}:${targetNode.port}${req.originalUrl}`;
        res.setHeader('X-Routed-Region', optimalRegion.name);
        res.setHeader('X-Routing-Type', 'redirect');
        
        // For this demo, instead of actual redirect/proxy, we just add headers
        // and allow the request to proceed
        res.setHeader('X-Would-Proxy-To', targetUrl);
        next();
      } catch (error) {
        console.error('Error in geo-routing middleware:', error);
        next();
      }
    };
  }
  
  /**
   * Middleware for caching responses at edge
   */
  public edgeCacheMiddleware(): (req: Request, res: Response, next: NextFunction) => void {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!this.cacheEnabled || req.method !== 'GET') {
        return next();
      }
      
      // Check if this is an edge node
      const selfInfo = clusterService.getSelfInfo();
      const isEdgeNode = selfInfo.role === 'edge';
      
      if (!isEdgeNode) {
        return next();
      }
      
      // Generate cache key
      const cacheKey = this.generateCacheKey(req);
      
      // Capture the original send method
      const originalSend = res.send;
      
      // Override the send method to cache the response
      // @ts-ignore
      res.send = (data: any) => {
        // Only cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 400) {
          try {
            const contentType = res.getHeader('content-type') as string || 'application/json';
            let ttl = this.defaultTtl;
            
            // Parse Cache-Control header if present
            const cacheControl = res.getHeader('cache-control') as string;
            if (cacheControl) {
              const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
              if (maxAgeMatch && maxAgeMatch[1]) {
                ttl = parseInt(maxAgeMatch[1], 10);
              }
            }
            
            // Only cache if TTL > 0
            if (ttl > 0) {
              this.cacheResponse(cacheKey, {
                data,
                contentType,
                expires: Date.now() + (ttl * 1000),
                region: selfInfo.region,
                zone: selfInfo.zone,
                cacheControl: cacheControl || `max-age=${ttl}`
              });
            }
          } catch (error) {
            console.error('Error caching response:', error);
          }
        }
        
        // Call the original send method
        return originalSend.call(res, data);
      };
      
      next();
    };
  }
  
  /**
   * Cache a response
   */
  public cacheResponse(key: string, entry: CacheEntry): void {
    // Check if we need to evict entries (LRU policy)
    if (this.cache.size >= this.maxCacheSize) {
      // Find oldest entry
      let oldestKey = '';
      let oldestExpiry = Infinity;
      
      for (const [entryKey, entryData] of this.cache.entries()) {
        if (entryData.expires < oldestExpiry) {
          oldestExpiry = entryData.expires;
          oldestKey = entryKey;
        }
      }
      
      // Remove oldest entry
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
    
    // Add new entry
    this.cache.set(key, entry);
  }
  
  /**
   * Get cached response
   */
  public getCachedResponse(key: string): CacheEntry | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    
    // Check if entry is expired
    if (entry.expires < Date.now()) {
      this.cache.delete(key);
      return undefined;
    }
    
    return entry;
  }
  
  /**
   * Invalidate cache entries by prefix
   */
  public invalidateCache(keyPrefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(keyPrefix)) {
        this.cache.delete(key);
      }
    }
  }
  
  /**
   * Get region latencies
   */
  public getRegionLatencies(): RegionLatency[] {
    return Array.from(this.regionLatencies.values());
  }
  
  // Private methods
  
  /**
   * Generate cache key for a request
   */
  private generateCacheKey(req: Request): string {
    const url = req.originalUrl || req.url;
    const method = req.method;
    const host = req.headers.host || '';
    
    // Generate hash for the key components
    return createHash('md5')
      .update(`${host}|${method}|${url}`)
      .digest('hex');
  }
  
  /**
   * Get client IP address
   */
  private getClientIp(req: Request): string {
    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor) {
      const ips = typeof forwardedFor === 'string' ? forwardedFor.split(',') : forwardedFor[0]?.split(',');
      if (ips && ips.length > 0) {
        return ips[0].trim();
      }
    }
    
    return req.socket.remoteAddress || '0.0.0.0';
  }
  
  /**
   * Start cache cleanup interval
   */
  private startCacheCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    this.cleanupInterval = setInterval(() => {
      try {
        const now = Date.now();
        let expiredCount = 0;
        
        // Remove expired entries
        for (const [key, entry] of this.cache.entries()) {
          if (entry.expires < now) {
            this.cache.delete(key);
            expiredCount++;
          }
        }
        
        if (expiredCount > 0) {
          console.log(`Removed ${expiredCount} expired cache entries`);
        }
      } catch (error) {
        console.error('Error cleaning up cache:', error);
      }
    }, this.cleanupFrequency);
  }
  
  /**
   * Start latency check interval
   */
  private startLatencyChecks(): void {
    if (this.latencyCheckInterval) {
      clearInterval(this.latencyCheckInterval);
    }
    
    this.latencyCheckInterval = setInterval(async () => {
      try {
        await this.checkRegionLatencies();
      } catch (error) {
        console.error('Error checking region latencies:', error);
      }
    }, this.latencyCheckFrequency);
  }
  
  /**
   * Check latencies to all regions
   */
  private async checkRegionLatencies(): Promise<void> {
    // Get all regions
    const regions = geoRoutingService.getRegions();
    
    for (const region of regions) {
      // Skip unavailable regions
      if (region.status === RegionStatus.UNAVAILABLE) continue;
      
      // Get a node in this region
      const node = geoRoutingService.getBestNodeInRegion(region.name);
      if (!node) continue;
      
      // Initialize region latency if not exists
      if (!this.regionLatencies.has(region.name)) {
        this.regionLatencies.set(region.name, {
          region: region.name,
          measurements: [],
          avgLatency: 0,
          successRate: 100,
          lastUpdated: Date.now()
        });
      }
      
      // Measure latency (simulated in this demo)
      // In a real implementation, this would ping the node
      const startTime = Date.now();
      const success = Math.random() > 0.1; // 90% success rate for demo
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
      const endTime = Date.now();
      const latency = endTime - startTime;
      
      // Update latency data
      const regionLatency = this.regionLatencies.get(region.name)!;
      regionLatency.measurements.push({
        timestamp: Date.now(),
        latency,
        success
      });
      
      // Keep only last 10 measurements
      if (regionLatency.measurements.length > 10) {
        regionLatency.measurements.shift();
      }
      
      // Calculate average latency and success rate
      const validMeasurements = regionLatency.measurements.filter(m => m.success);
      regionLatency.avgLatency = validMeasurements.length > 0
        ? validMeasurements.reduce((sum, m) => sum + m.latency, 0) / validMeasurements.length
        : 0;
      
      regionLatency.successRate = regionLatency.measurements.length > 0
        ? (validMeasurements.length / regionLatency.measurements.length) * 100
        : 100;
      
      regionLatency.lastUpdated = Date.now();
    }
    
    // Share latency data with cluster
    this.updateClusterLatencyData();
  }
  
  /**
   * Update cluster metadata with latency information
   */
  private async updateClusterLatencyData(): Promise<void> {
    const latencyData = Object.fromEntries(
      Array.from(this.regionLatencies.entries())
        .map(([region, data]) => [region, {
          avgLatency: data.avgLatency,
          successRate: data.successRate
        }])
    );
    
    await clusterService.updateMetadata({
      regionLatencies: latencyData,
      lastLatencyCheck: Date.now()
    });
  }
  
  /**
   * Subscribe to relevant events
   */
  private subscribeToEvents(): void {
    // Listen for region status changes
    eventBus.on('region-status-changed', () => {
      // Not needed currently
    });
    
    // Listen for failovers
    eventBus.on('failover', (data: any) => {
      console.log(`Region failover: ${data.fromRegion} -> ${data.toRegion}`);
    });
  }
  
  /**
   * Shutdown the edge proxy service
   */
  public shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    if (this.latencyCheckInterval) {
      clearInterval(this.latencyCheckInterval);
      this.latencyCheckInterval = null;
    }
  }
}

// Export singleton instance
export const edgeProxyService = new EdgeProxyService();