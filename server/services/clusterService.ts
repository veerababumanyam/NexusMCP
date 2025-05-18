/**
 * Cluster Service
 * 
 * Provides horizontal scaling capabilities through node coordination,
 * service discovery, and distributed state management.
 * 
 * Features:
 * - Node registration and heartbeat monitoring
 * - Dynamic node discovery
 * - Auto-scaling support
 * - Distributed state synchronization
 * - Work distribution across nodes
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import os from 'os';
import { db } from '../../db';
import { nodes } from '../../shared/schema';
import { eq } from 'drizzle-orm';

// Node health status
export enum NodeStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  DEGRADED = 'degraded',
}

// Node type/role
export enum NodeRole {
  MASTER = 'master',
  WORKER = 'worker',
  EDGE = 'edge',
}

// Node information
export interface NodeInfo {
  id: string;
  host: string;
  port: number;
  status: NodeStatus;
  role: NodeRole;
  region: string;
  zone: string;
  cpu: number;
  memory: number;
  startTime: Date;
  lastHeartbeat: Date;
  metadata: Record<string, any>;
}

// Work distribution configuration
export interface WorkDistributionConfig {
  strategy: 'round-robin' | 'least-loaded' | 'consistent-hash';
  weights?: Record<string, number>;
  targetNodeCount?: number;
}

class ClusterService extends EventEmitter {
  private readonly nodeId: string;
  private nodes: Map<string, NodeInfo> = new Map();
  private currentRole: NodeRole = NodeRole.WORKER; 
  private selfInfo: NodeInfo;
  private heartbeatInterval: NodeJS.Timer | null = null;
  private discoveryInterval: NodeJS.Timer | null = null;
  private readonly heartbeatFrequency = 10000; // 10 seconds
  private readonly discoveryFrequency = 30000; // 30 seconds
  private isInitialized = false;
  private workDistribution: WorkDistributionConfig = {
    strategy: 'round-robin',
  };
  
  constructor() {
    super();
    // Generate a unique ID for this node
    this.nodeId = process.env.NODE_ID || uuidv4();
    
    // Initialize self information
    this.selfInfo = {
      id: this.nodeId,
      host: process.env.HOST || this.getHostname(),
      port: parseInt(process.env.PORT || '5000'),
      status: NodeStatus.ONLINE,
      role: this.currentRole,
      region: process.env.REGION || 'default-region',
      zone: process.env.ZONE || 'default-zone',
      cpu: os.cpus().length,
      memory: os.totalmem(),
      startTime: new Date(),
      lastHeartbeat: new Date(),
      metadata: {},
    };
  }
  
  /**
   * Initialize the cluster service and connect to the cluster
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      // Register self in database
      await this.registerNode();
      
      // Start heartbeats
      this.startHeartbeat();
      
      // Start node discovery
      this.startDiscovery();
      
      // Determine role (elect master if needed)
      await this.determinRole();
      
      this.isInitialized = true;
      console.log(`Cluster node initialized: ${this.nodeId} (${this.currentRole})`);
      this.emit('initialized', this.selfInfo);
    } catch (error) {
      console.error('Failed to initialize cluster node:', error);
      throw error;
    }
  }
  
  /**
   * Shutdown the cluster service
   */
  public async shutdown(): Promise<void> {
    try {
      // Stop intervals
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }
      
      if (this.discoveryInterval) {
        clearInterval(this.discoveryInterval);
        this.discoveryInterval = null;
      }
      
      // Update status in database
      await this.updateNodeStatus(NodeStatus.OFFLINE);
      
      this.emit('shutdown', this.selfInfo);
      console.log(`Cluster node shutdown: ${this.nodeId}`);
    } catch (error) {
      console.error('Error shutting down cluster node:', error);
    }
  }
  
  /**
   * Get all active nodes in the cluster
   */
  public getNodes(): NodeInfo[] {
    return Array.from(this.nodes.values());
  }
  
  /**
   * Get active node count
   */
  public getActiveNodeCount(): number {
    return this.getNodes().filter(n => n.status === NodeStatus.ONLINE).length;
  }
  
  /**
   * Get current node info
   */
  public getSelfInfo(): NodeInfo {
    return this.selfInfo;
  }
  
  /**
   * Configure work distribution strategy
   */
  public setWorkDistribution(config: WorkDistributionConfig): void {
    this.workDistribution = {
      ...this.workDistribution,
      ...config,
    };
  }
  
  /**
   * Get target node for request based on distribution strategy
   */
  public getTargetNode(key?: string): NodeInfo | null {
    const activeNodes = this.getNodes()
      .filter(n => n.status === NodeStatus.ONLINE);
    
    if (activeNodes.length === 0) return null;
    if (activeNodes.length === 1) return activeNodes[0];
    
    // Apply distribution strategy
    switch (this.workDistribution.strategy) {
      case 'round-robin':
        // Simple round-robin using a rotating counter
        const now = Date.now();
        const index = now % activeNodes.length;
        return activeNodes[index];
        
      case 'least-loaded':
        // Find node with lowest CPU usage
        return activeNodes.sort((a, b) => 
          (a.metadata.load || 0) - (b.metadata.load || 0)
        )[0];
        
      case 'consistent-hash':
        // If we have a key, use it for consistent hashing
        if (key) {
          const hash = this.hashCode(key);
          const index = Math.abs(hash) % activeNodes.length;
          return activeNodes[index];
        }
        return activeNodes[0];
        
      default:
        return activeNodes[0];
    }
  }
  
  /**
   * Update node metadata (useful for updating load metrics)
   */
  public async updateMetadata(metadata: Record<string, any>): Promise<void> {
    this.selfInfo.metadata = {
      ...this.selfInfo.metadata,
      ...metadata,
    };
    
    // Also update in database
    await db.update(nodes)
      .set({ 
        metadata: JSON.stringify(this.selfInfo.metadata),
      })
      .where(eq(nodes.id, this.nodeId));
  }
  
  /**
   * Check if this node is the master node
   */
  public isMaster(): boolean {
    return this.currentRole === NodeRole.MASTER;
  }
  
  /**
   * Get current master node (if any)
   */
  public getMasterNode(): NodeInfo | undefined {
    return this.getNodes().find(n => n.role === NodeRole.MASTER);
  }
  
  /**
   * Get nodes in the same region
   */
  public getNodesInRegion(region: string): NodeInfo[] {
    return this.getNodes().filter(n => n.region === region);
  }
  
  // Private methods
  
  /**
   * Register current node in database
   */
  private async registerNode(): Promise<void> {
    try {
      // Check if node already exists
      const existingNode = await db.query.nodes.findFirst({
        where: eq(nodes.id, this.nodeId),
      });
      
      if (existingNode) {
        // Update existing node
        await db.update(nodes)
          .set({
            host: this.selfInfo.host,
            port: this.selfInfo.port,
            status: this.selfInfo.status,
            role: this.selfInfo.role,
            region: this.selfInfo.region,
            zone: this.selfInfo.zone,
            lastHeartbeat: new Date(),
            metadata: JSON.stringify(this.selfInfo.metadata),
          })
          .where(eq(nodes.id, this.nodeId));
      } else {
        // Insert new node
        await db.insert(nodes).values({
          id: this.nodeId,
          host: this.selfInfo.host,
          port: this.selfInfo.port,
          status: this.selfInfo.status,
          role: this.selfInfo.role,
          region: this.selfInfo.region,
          zone: this.selfInfo.zone,
          startTime: new Date(),
          lastHeartbeat: new Date(),
          metadata: JSON.stringify(this.selfInfo.metadata),
        });
      }
    } catch (error) {
      console.error('Failed to register node:', error);
      throw error;
    }
  }
  
  /**
   * Start periodic heartbeat to update node status
   */
  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    this.heartbeatInterval = setInterval(async () => {
      try {
        // Update system metrics
        this.selfInfo.metadata.load = os.loadavg()[0];
        this.selfInfo.metadata.freeMemory = os.freemem();
        this.selfInfo.lastHeartbeat = new Date();
        
        // Update in database
        await db.update(nodes)
          .set({
            lastHeartbeat: this.selfInfo.lastHeartbeat,
            metadata: JSON.stringify(this.selfInfo.metadata),
          })
          .where(eq(nodes.id, this.nodeId));
      } catch (error) {
        console.error('Error updating heartbeat:', error);
      }
    }, this.heartbeatFrequency);
  }
  
  /**
   * Start periodic node discovery
   */
  private startDiscovery(): void {
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
    }
    
    this.discoveryInterval = setInterval(async () => {
      try {
        // Fetch all active nodes from database
        const allNodes = await db.query.nodes.findMany();
        
        // Clean up expired nodes (no heartbeat for 30s)
        const now = new Date();
        const thirtySecondsAgo = new Date(now.getTime() - 30000);
        
        // Update local nodes map
        this.nodes.clear();
        
        for (const node of allNodes) {
          // Check if node is active
          const lastHeartbeat = new Date(node.lastHeartbeat);
          let status = node.status as NodeStatus;
          
          if (lastHeartbeat < thirtySecondsAgo && status !== NodeStatus.OFFLINE) {
            // Mark as offline in database if heartbeat is too old
            await db.update(nodes)
              .set({ status: NodeStatus.OFFLINE })
              .where(eq(nodes.id, node.id));
            
            status = NodeStatus.OFFLINE;
          }
          
          // Skip offline nodes
          if (status === NodeStatus.OFFLINE) continue;
          
          // Add to local map
          this.nodes.set(node.id, {
            id: node.id,
            host: node.host,
            port: node.port,
            status: status,
            role: node.role as NodeRole,
            region: node.region,
            zone: node.zone,
            cpu: node.cpu || 0,
            memory: node.memory || 0,
            startTime: new Date(node.startTime),
            lastHeartbeat: new Date(node.lastHeartbeat),
            metadata: this.parseMetadata(node.metadata),
          });
        }
        
        // Elect master if needed
        await this.determinRole();
        
        this.emit('discovery', this.getNodes());
      } catch (error) {
        console.error('Error during node discovery:', error);
      }
    }, this.discoveryFrequency);
  }
  
  /**
   * Determine node role (perform master election if needed)
   */
  private async determinRole(): Promise<void> {
    // Find current master
    const masterNode = this.getNodes().find(n => 
      n.role === NodeRole.MASTER && n.status === NodeStatus.ONLINE
    );
    
    // If no master exists, elect new master (oldest node becomes master)
    if (!masterNode) {
      const activeNodes = this.getNodes()
        .filter(n => n.status === NodeStatus.ONLINE)
        .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
      
      // If this is the oldest node, become master
      if (activeNodes.length > 0 && activeNodes[0].id === this.nodeId) {
        this.currentRole = NodeRole.MASTER;
        this.selfInfo.role = NodeRole.MASTER;
        
        // Update role in database
        await db.update(nodes)
          .set({ role: NodeRole.MASTER })
          .where(eq(nodes.id, this.nodeId));
          
        console.log(`Node ${this.nodeId} elected as master`);
        this.emit('role-change', this.currentRole);
      }
    }
  }
  
  /**
   * Update node status in database
   */
  private async updateNodeStatus(status: NodeStatus): Promise<void> {
    this.selfInfo.status = status;
    
    await db.update(nodes)
      .set({ status })
      .where(eq(nodes.id, this.nodeId));
  }
  
  /**
   * Get hostname
   */
  private getHostname(): string {
    return os.hostname();
  }
  
  /**
   * Parse metadata safely
   */
  private parseMetadata(metadata: any): Record<string, any> {
    if (!metadata) return {};
    
    try {
      if (typeof metadata === 'string') {
        return JSON.parse(metadata);
      } else if (typeof metadata === 'object') {
        return metadata;
      }
    } catch (error) {
      console.error('Error parsing metadata:', error);
    }
    
    return {};
  }
  
  /**
   * Simple hash code for consistent hashing
   */
  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
  }
}

// Export singleton instance
export const clusterService = new ClusterService();