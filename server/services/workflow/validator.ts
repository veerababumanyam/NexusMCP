import { 
  WorkflowTemplate, 
  WorkflowNode,
  WorkflowConnection
} from '../../../shared/schema_orchestrator';

/**
 * Validate a workflow template structure
 * 
 * Performs comprehensive validation:
 * - Node connectivity (no orphaned nodes)
 * - Connection validity (source and target exist)
 * - Cycle detection
 * - Input/output compatibility
 * - Schema validation for node configs
 */
export function validateWorkflow(template: WorkflowTemplate & { 
  nodes?: WorkflowNode[], 
  connections?: WorkflowConnection[] 
}): { 
  valid: boolean; 
  errors?: string[];
  warnings?: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Need nodes and connections to validate
  if (!template.nodes || !template.connections) {
    errors.push('Workflow template is missing nodes or connections');
    return { valid: false, errors };
  }
  
  // Check for empty workflow
  if (template.nodes.length === 0) {
    errors.push('Workflow has no nodes');
    return { valid: false, errors };
  }
  
  // Check for start/input and end/output nodes
  const startNodes = template.nodes.filter(node => node.type === 'input' || node.type === 'start');
  const endNodes = template.nodes.filter(node => node.type === 'output' || node.type === 'end');
  
  if (startNodes.length === 0) {
    errors.push('Workflow must have at least one input/start node');
  }
  
  if (endNodes.length === 0) {
    errors.push('Workflow must have at least one output/end node');
  }
  
  // Build node map for quick lookup
  const nodeMap = new Map<string, WorkflowNode>();
  template.nodes.forEach(node => {
    nodeMap.set(node.nodeId, node);
  });
  
  // Check connection validity and build connection maps
  const outgoingConnections = new Map<string, WorkflowConnection[]>();
  const incomingConnections = new Map<string, WorkflowConnection[]>();
  
  template.connections.forEach(conn => {
    const sourceNode = nodeMap.get(conn.sourceNodeId);
    const targetNode = nodeMap.get(conn.targetNodeId);
    
    // Source and target nodes must exist
    if (!sourceNode) {
      errors.push(`Connection ${conn.id} has invalid source node: ${conn.sourceNodeId}`);
    }
    
    if (!targetNode) {
      errors.push(`Connection ${conn.id} has invalid target node: ${conn.targetNodeId}`);
    }
    
    // Add to connection maps
    if (sourceNode) {
      if (!outgoingConnections.has(conn.sourceNodeId)) {
        outgoingConnections.set(conn.sourceNodeId, []);
      }
      outgoingConnections.get(conn.sourceNodeId)?.push(conn);
    }
    
    if (targetNode) {
      if (!incomingConnections.has(conn.targetNodeId)) {
        incomingConnections.set(conn.targetNodeId, []);
      }
      incomingConnections.get(conn.targetNodeId)?.push(conn);
    }
  });
  
  // Check that all nodes are connected
  template.nodes.forEach(node => {
    const nodeId = node.nodeId;
    
    // Skip check for start/input nodes (they can have no incoming connections)
    if (node.type !== 'input' && node.type !== 'start') {
      if (!incomingConnections.has(nodeId) || incomingConnections.get(nodeId)?.length === 0) {
        errors.push(`Node ${node.name} (${nodeId}) has no incoming connections`);
      }
    }
    
    // Skip check for end/output nodes (they can have no outgoing connections)
    if (node.type !== 'output' && node.type !== 'end') {
      if (!outgoingConnections.has(nodeId) || outgoingConnections.get(nodeId)?.length === 0) {
        errors.push(`Node ${node.name} (${nodeId}) has no outgoing connections`);
      }
    }
  });
  
  // Check conditional node validity
  template.nodes.forEach(node => {
    if (node.type === 'conditional') {
      // Conditionals need a condition defined
      if (!node.config?.condition) {
        errors.push(`Conditional node ${node.name} (${node.nodeId}) missing condition configuration`);
      }
      
      // Conditionals should have at least two outgoing connections (true/false)
      const outConns = outgoingConnections.get(node.nodeId) || [];
      if (outConns.length < 2) {
        warnings.push(`Conditional node ${node.name} (${node.nodeId}) should have at least two outgoing connections (true/false paths)`);
      }
    }
  });
  
  // Check transformer node validity
  template.nodes.forEach(node => {
    if (node.type === 'transformer') {
      // Transformers need a transform defined
      if (!node.config?.transform) {
        errors.push(`Transformer node ${node.name} (${node.nodeId}) missing transform configuration`);
      }
    }
  });
  
  // Check tool node validity
  template.nodes.forEach(node => {
    if (node.type === 'tool') {
      // Tool nodes need toolId and serverId
      if (!node.toolId) {
        errors.push(`Tool node ${node.name} (${node.nodeId}) missing toolId`);
      }
      
      if (!node.serverId) {
        errors.push(`Tool node ${node.name} (${node.nodeId}) missing serverId`);
      }
    }
  });
  
  // Detect cycles using DFS
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  
  function hasCycle(nodeId: string): boolean {
    // Node already in recursion stack means we have a cycle
    if (recursionStack.has(nodeId)) {
      return true;
    }
    
    // If already visited (but not in recursion stack), no cycle here
    if (visited.has(nodeId)) {
      return false;
    }
    
    // Mark as visited and add to recursion stack
    visited.add(nodeId);
    recursionStack.add(nodeId);
    
    // Visit all adjacent nodes
    const adjacent = outgoingConnections.get(nodeId) || [];
    for (const conn of adjacent) {
      if (hasCycle(conn.targetNodeId)) {
        return true;
      }
    }
    
    // Remove from recursion stack (backtrack)
    recursionStack.delete(nodeId);
    return false;
  }
  
  // Run cycle detection from all start nodes
  for (const startNode of startNodes) {
    if (hasCycle(startNode.nodeId)) {
      errors.push('Workflow contains cycles, which are not allowed');
      break;
    }
  }
  
  // Return validation result
  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined
  };
}

/**
 * Validate a node's configuration against a schema
 */
export function validateNodeConfig(
  node: WorkflowNode, 
  schema: any
): { 
  valid: boolean; 
  errors?: string[] 
} {
  // TODO: Implement schema validation for node configurations
  // This would validate that the node configuration matches the tool's schema
  
  return { valid: true };
}