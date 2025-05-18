/**
 * Geo-Routing Service
 * 
 * Provides geo-based routing and load balancing for multi-region deployments with:
 * - Region-aware request routing
 * - Geographic failover capabilities
 * - Edge caching coordination
 * - Latency-based routing
 * - Region health monitoring
 */

import { EventEmitter } from 'events';
import { clusterService, NodeInfo, NodeStatus } from './clusterService';
import { db } from '../../db';
import { eq, and, desc } from 'drizzle-orm';
import { nodes } from '../../shared/schema';

// Region health status
export enum RegionStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNAVAILABLE = 'unavailable'
}

// Region information
export interface RegionInfo {
  name: string;
  status: RegionStatus;
  nodeCount: number;
  activeNodeCount: number;
  zones: string[];
  primaryRegion: boolean;
  failoverRegion?: string;
  latency: Record<string, number>; // Average latency to other regions
}

// Geo-routing strategy
export enum GeoRoutingStrategy {
  NEAREST_REGION = 'nearest', // Route to nearest region
  STICKY_REGION = 'sticky',   // Keep user in same region
  PERFORMANCE = 'performance', // Route based on region performance
  LOAD_BALANCED = 'load-balanced' // Balance load across regions
}

// Config for geo-routing
export interface GeoRoutingConfig {
  strategy: GeoRoutingStrategy;
  primaryRegion: string;
  secondaryRegions: string[];
  edgeRegions: string[];  // Edge regions for caching
  regionPriorities: Record<string, number>; // 1-100, higher = higher priority
  autoFailover: boolean;
  enableEdgeCaching: boolean;
}

class GeoRoutingService extends EventEmitter {
  private regions: Map<string, RegionInfo> = new Map();
  private config: GeoRoutingConfig = {
    strategy: GeoRoutingStrategy.NEAREST_REGION,
    primaryRegion: 'us-east-1',
    secondaryRegions: ['eu-west-1', 'ap-southeast-1'],
    edgeRegions: [],
    regionPriorities: { 'us-east-1': 100, 'eu-west-1': 80, 'ap-southeast-1': 80 },
    autoFailover: true,
    enableEdgeCaching: false
  };
  private isInitialized = false;
  private monitorInterval: NodeJS.Timer | null = null;
  private readonly monitorFrequency = 60000; // 1 minute

  constructor() {
    super();
  }

  /**
   * Initialize the geo-routing service
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Load region configuration from environment or database
      await this.loadConfig();
      
      // Discover regions from active nodes
      await this.discoverRegions();
      
      // Start region monitoring
      this.startMonitoring();
      
      this.isInitialized = true;
      console.log('Geo-routing service initialized');
      this.emit('initialized');
    } catch (error) {
      console.error('Failed to initialize geo-routing service:', error);
      throw error;
    }
  }

  /**
   * Get all regions
   */
  public getRegions(): RegionInfo[] {
    return Array.from(this.regions.values());
  }

  /**
   * Get region info
   */
  public getRegion(regionName: string): RegionInfo | undefined {
    return this.regions.get(regionName);
  }

  /**
   * Set geo-routing configuration
   */
  public setConfig(config: Partial<GeoRoutingConfig>): void {
    this.config = {
      ...this.config,
      ...config
    };
    
    // Update region priorities
    for (const region of this.regions.values()) {
      region.primaryRegion = region.name === this.config.primaryRegion;
    }
    
    this.emit('config-updated', this.config);
  }

  /**
   * Get optimal region for a request based on client info
   */
  public getOptimalRegion(
    clientRegion?: string, 
    clientCountry?: string,
    clientIp?: string,
    performanceData?: Record<string, number>
  ): RegionInfo | undefined {
    const availableRegions = Array.from(this.regions.values())
      .filter(r => r.status !== RegionStatus.UNAVAILABLE);
    
    if (availableRegions.length === 0) return undefined;
    if (availableRegions.length === 1) return availableRegions[0];
    
    // Apply routing strategy
    switch (this.config.strategy) {
      case GeoRoutingStrategy.NEAREST_REGION:
        // If client region is provided, use that or nearest alternative
        if (clientRegion) {
          const exactRegion = this.regions.get(clientRegion);
          if (exactRegion && exactRegion.status !== RegionStatus.UNAVAILABLE) {
            return exactRegion;
          }
          
          // Find nearest region based on latency data or geo proximity
          // For demo, just return the first available region
          return availableRegions[0];
        }
        
        // If client country is provided, map to nearest region
        if (clientCountry) {
          // This would use a mapping of countries to regions
          // For demo, just return primary region
          const primaryRegion = availableRegions.find(r => r.primaryRegion);
          if (primaryRegion) return primaryRegion;
        }
        
        // Default to primary region
        return availableRegions.find(r => r.primaryRegion) || availableRegions[0];
        
      case GeoRoutingStrategy.PERFORMANCE:
        // Use performance data to route to fastest region
        if (performanceData) {
          // Find region with best performance
          let bestRegion = availableRegions[0];
          let bestPerformance = performanceData[bestRegion.name] || 0;
          
          for (const region of availableRegions) {
            const performance = performanceData[region.name] || 0;
            if (performance > bestPerformance) {
              bestPerformance = performance;
              bestRegion = region;
            }
          }
          
          return bestRegion;
        }
        
        // Default to region with highest priority
        return availableRegions.sort((a, b) => 
          (this.config.regionPriorities[b.name] || 0) - 
          (this.config.regionPriorities[a.name] || 0)
        )[0];
        
      case GeoRoutingStrategy.LOAD_BALANCED:
        // Route based on load across regions
        return availableRegions.sort((a, b) => 
          (a.nodeCount / a.activeNodeCount) - (b.nodeCount / b.activeNodeCount)
        )[0];
        
      case GeoRoutingStrategy.STICKY_REGION:
        // If client has a region, use it if healthy
        if (clientRegion) {
          const stickyRegion = this.regions.get(clientRegion);
          if (stickyRegion && stickyRegion.status !== RegionStatus.UNAVAILABLE) {
            return stickyRegion;
          }
          
          // If configured, use failover region
          if (stickyRegion?.failoverRegion) {
            const failoverRegion = this.regions.get(stickyRegion.failoverRegion);
            if (failoverRegion && failoverRegion.status !== RegionStatus.UNAVAILABLE) {
              return failoverRegion;
            }
          }
        }
        
        // Default to primary region
        return availableRegions.find(r => r.primaryRegion) || availableRegions[0];
        
      default:
        return availableRegions.find(r => r.primaryRegion) || availableRegions[0];
    }
  }

  /**
   * Get best node within a region for request handling
   */
  public getBestNodeInRegion(regionName: string): NodeInfo | undefined {
    const region = this.regions.get(regionName);
    if (!region) return undefined;
    
    // Get all active nodes in this region
    const regionNodes = clusterService.getNodes().filter(
      n => n.region === regionName && n.status === NodeStatus.ONLINE
    );
    
    if (regionNodes.length === 0) return undefined;
    if (regionNodes.length === 1) return regionNodes[0];
    
    // Sort by load
    return regionNodes.sort((a, b) => 
      (a.metadata.load || 0) - (b.metadata.load || 0)
    )[0];
  }

  /**
   * Update region status
   */
  public async updateRegionStatus(regionName: string, status: RegionStatus): Promise<void> {
    const region = this.regions.get(regionName);
    if (!region) return;
    
    const oldStatus = region.status;
    region.status = status;
    
    // If region status changed, emit event
    if (oldStatus !== status) {
      this.emit('region-status-changed', { region: regionName, status });
      
      // If region is unavailable and failover is enabled, trigger failover
      if (status === RegionStatus.UNAVAILABLE && this.config.autoFailover && region.primaryRegion) {
        await this.triggerRegionFailover(regionName);
      }
    }
  }

  // Private methods

  /**
   * Load configuration from environment or database
   */
  private async loadConfig(): Promise<void> {
    // Try to get config from environment variables
    const primaryRegion = process.env.PRIMARY_REGION || this.config.primaryRegion;
    const secondaryRegions = process.env.SECONDARY_REGIONS?.split(',') || this.config.secondaryRegions;
    const edgeRegions = process.env.EDGE_REGIONS?.split(',') || this.config.edgeRegions;
    const autoFailover = process.env.AUTO_FAILOVER === 'true' || this.config.autoFailover;
    const enableEdgeCaching = process.env.ENABLE_EDGE_CACHING === 'true' || this.config.enableEdgeCaching;
    
    // Set basic config
    this.config = {
      ...this.config,
      primaryRegion,
      secondaryRegions,
      edgeRegions,
      autoFailover,
      enableEdgeCaching
    };
    
    // TODO: Load more detailed config from database
  }

  /**
   * Discover regions from active nodes
   */
  private async discoverRegions(): Promise<void> {
    try {
      // Get unique regions from all nodes in the database
      const allNodes = await db.query.nodes.findMany();
      const regionMap = new Map<string, { nodes: number, activeNodes: number, zones: Set<string> }>();
      
      // Count nodes per region
      for (const node of allNodes) {
        const regionData = regionMap.get(node.region) || { 
          nodes: 0, 
          activeNodes: 0, 
          zones: new Set<string>() 
        };
        
        regionData.nodes++;
        if (node.status === NodeStatus.ONLINE) {
          regionData.activeNodes++;
        }
        
        regionData.zones.add(node.zone);
        regionMap.set(node.region, regionData);
      }
      
      // Create region info objects
      for (const [regionName, data] of regionMap.entries()) {
        const isPrimary = regionName === this.config.primaryRegion;
        let failoverRegion: string | undefined;
        
        // Assign failover region (for primary, use first secondary; for secondaries, use primary)
        if (isPrimary && this.config.secondaryRegions.length > 0) {
          failoverRegion = this.config.secondaryRegions[0];
        } else if (this.config.secondaryRegions.includes(regionName)) {
          failoverRegion = this.config.primaryRegion;
        }
        
        this.regions.set(regionName, {
          name: regionName,
          status: data.activeNodes > 0 ? RegionStatus.HEALTHY : RegionStatus.UNAVAILABLE,
          nodeCount: data.nodes,
          activeNodeCount: data.activeNodes,
          zones: Array.from(data.zones),
          primaryRegion: isPrimary,
          failoverRegion,
          latency: {} // Initialize empty latency map
        });
      }
      
      // Ensure primary region exists
      if (!this.regions.has(this.config.primaryRegion)) {
        this.regions.set(this.config.primaryRegion, {
          name: this.config.primaryRegion,
          status: RegionStatus.UNAVAILABLE,
          nodeCount: 0,
          activeNodeCount: 0,
          zones: [],
          primaryRegion: true,
          latency: {}
        });
      }
      
      // Ensure secondary regions exist
      for (const secondaryRegion of this.config.secondaryRegions) {
        if (!this.regions.has(secondaryRegion)) {
          this.regions.set(secondaryRegion, {
            name: secondaryRegion,
            status: RegionStatus.UNAVAILABLE,
            nodeCount: 0,
            activeNodeCount: 0,
            zones: [],
            primaryRegion: false,
            failoverRegion: this.config.primaryRegion,
            latency: {}
          });
        }
      }
      
      console.log(`Discovered ${this.regions.size} regions`);
    } catch (error) {
      console.error('Error discovering regions:', error);
      throw error;
    }
  }

  /**
   * Start monitoring regions
   */
  private startMonitoring(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
    }
    
    this.monitorInterval = setInterval(async () => {
      try {
        await this.monitorRegions();
      } catch (error) {
        console.error('Error monitoring regions:', error);
      }
    }, this.monitorFrequency);
  }

  /**
   * Monitor region health
   */
  private async monitorRegions(): Promise<void> {
    // Get all nodes
    const allNodes = clusterService.getNodes();
    
    // Update region info
    for (const [regionName, region] of this.regions.entries()) {
      const regionNodes = allNodes.filter(n => n.region === regionName);
      const activeNodes = regionNodes.filter(n => n.status === NodeStatus.ONLINE);
      const degradedNodes = regionNodes.filter(n => n.status === NodeStatus.DEGRADED);
      
      region.nodeCount = regionNodes.length;
      region.activeNodeCount = activeNodes.length;
      
      // Update zone list
      region.zones = Array.from(new Set(regionNodes.map(n => n.zone)));
      
      // Determine region status
      if (activeNodes.length === 0) {
        await this.updateRegionStatus(regionName, RegionStatus.UNAVAILABLE);
      } else if (degradedNodes.length > activeNodes.length / 2) {
        await this.updateRegionStatus(regionName, RegionStatus.DEGRADED);
      } else {
        await this.updateRegionStatus(regionName, RegionStatus.HEALTHY);
      }
    }
  }

  /**
   * Handle failover when a region becomes unavailable
   */
  private async triggerRegionFailover(failedRegionName: string): Promise<void> {
    const failedRegion = this.regions.get(failedRegionName);
    if (!failedRegion || !failedRegion.failoverRegion) return;
    
    const failoverRegionName = failedRegion.failoverRegion;
    const failoverRegion = this.regions.get(failoverRegionName);
    
    if (!failoverRegion || failoverRegion.status === RegionStatus.UNAVAILABLE) {
      console.error(`Cannot failover from ${failedRegionName} to ${failoverRegionName} - failover region unavailable`);
      return;
    }
    
    console.log(`Triggering failover from ${failedRegionName} to ${failoverRegionName}`);
    
    // If failed region was primary, make failover region the new primary
    if (failedRegion.primaryRegion) {
      failedRegion.primaryRegion = false;
      failoverRegion.primaryRegion = true;
      
      // Update config
      this.config.primaryRegion = failoverRegionName;
      
      // Find index of failover region in secondary regions and remove it
      const failoverIndex = this.config.secondaryRegions.indexOf(failoverRegionName);
      if (failoverIndex !== -1) {
        this.config.secondaryRegions.splice(failoverIndex, 1);
      }
      
      // Add failed region to secondary regions if not already there
      if (!this.config.secondaryRegions.includes(failedRegionName)) {
        this.config.secondaryRegions.push(failedRegionName);
      }
      
      this.emit('failover', {
        fromRegion: failedRegionName,
        toRegion: failoverRegionName
      });
    }
  }
}

// Export singleton instance
export const geoRoutingService = new GeoRoutingService();