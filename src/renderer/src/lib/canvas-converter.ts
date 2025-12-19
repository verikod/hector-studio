import * as yaml from 'js-yaml';
import type { Node, Edge } from '@xyflow/react';
import Dagre from '@dagrejs/dagre';
import { parseConfig, type AgentConfig, type HectorConfig } from './config-utils';

export interface GraphData {
  nodes: Node[];
  edges: Edge[];
}

// Layout constants
const NODE_WIDTH = 220;
const NODE_HEIGHT = 80;
const GROUP_PADDING = 40;

/**
 * Apply dagre auto-layout to nodes and edges
 */
const applyDagreLayout = (
  nodes: Node[], 
  edges: Edge[], 
  direction: 'TB' | 'LR' = 'TB'
): Node[] => {
  if (nodes.length === 0) return nodes;

  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: 80, ranksep: 100, marginx: 50, marginy: 50 });

  // Add nodes to dagre
  nodes.forEach((node) => {
    const width = node.style?.width as number || NODE_WIDTH;
    const height = node.style?.height as number || NODE_HEIGHT;
    g.setNode(node.id, { width, height });
  });

  // Add edges to dagre
  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  // Run layout
  Dagre.layout(g);

  // Apply positions back to nodes
  return nodes.map((node) => {
    const nodeWithPosition = g.node(node.id);
    if (!nodeWithPosition) return node;
    
    const width = node.style?.width as number || NODE_WIDTH;
    const height = node.style?.height as number || NODE_HEIGHT;
    
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - width / 2,
        y: nodeWithPosition.y - height / 2,
      },
    };
  });
};

/**
 * Converts YAML config to React Flow visualization with dagre auto-layout
 */
export const yamlToGraph = (yamlContent: string): GraphData => {
  let nodes: Node[] = [];
  const edges: Edge[] = [];

  try {
    const config = parseConfig(yamlContent);

    if (!config || !config.agents || Object.keys(config.agents).length === 0) {
      return { nodes, edges };
    }

    // Track root agents vs sub-agents
    const allSubAgents = new Set<string>();
    Object.values(config.agents).forEach((agent) => {
      if (agent.sub_agents) {
        agent.sub_agents.forEach((s: string) => allSubAgents.add(s));
      }
    });

    // Process each agent
    Object.entries(config.agents).forEach(([agentId, agent]) => {
      const agentConfig = agent as AgentConfig;
      const type = agentConfig.type || 'llm';
      const isWorkflow = ['sequential', 'parallel', 'loop'].includes(type);
      const isRemote = type === 'remote';

      // Create node
      nodes.push({
        id: agentId,
        type: isWorkflow ? 'workflowGroup' : 'agent',
        position: { x: 0, y: 0 }, // Will be set by dagre
        data: {
          label: agentConfig.name || agentId,
          agentId,
          agentType: type,
          llm: agentConfig.llm,
          description: agentConfig.description,
          instruction: agentConfig.instruction,
          tools: agentConfig.tools,
          subAgents: agentConfig.sub_agents,
          agentTools: agentConfig.agent_tools,
          guardrails: agentConfig.guardrails,
          documentStores: agentConfig.document_stores,
          isRemote,
          url: agentConfig.url,
          // Full config for editing
          config: agentConfig,
        },
        style: {
          width: isWorkflow ? NODE_WIDTH + GROUP_PADDING * 2 : NODE_WIDTH,
          height: isWorkflow ? NODE_HEIGHT + GROUP_PADDING : NODE_HEIGHT,
        },
      });

      // Create edges for sub_agents (workflow children)
      if (agentConfig.sub_agents && agentConfig.sub_agents.length > 0) {
        agentConfig.sub_agents.forEach((subAgentId: string, index: number) => {
          // Edge from parent to child
          edges.push({
            id: `${agentId}->${subAgentId}`,
            source: agentId,
            target: subAgentId,
            type: 'smoothstep',
            style: { 
              stroke: type === 'sequential' ? '#3b82f6' : 
                      type === 'parallel' ? '#a855f7' : 
                      type === 'loop' ? '#14b8a6' : '#6b7280',
              strokeWidth: 2,
            },
            animated: type === 'loop',
          });

          // For sequential, also add edges between siblings
          if (type === 'sequential' && index < agentConfig.sub_agents!.length - 1) {
            const nextSubAgentId = agentConfig.sub_agents![index + 1];
            edges.push({
              id: `${subAgentId}-seq->${nextSubAgentId}`,
              source: subAgentId,
              target: nextSubAgentId,
              type: 'smoothstep',
              style: { stroke: '#3b82f6', strokeWidth: 2 },
            });
          }
        });

        // Loop back edge
        if (type === 'loop' && agentConfig.sub_agents.length > 1) {
          const lastChild = agentConfig.sub_agents[agentConfig.sub_agents.length - 1];
          const firstChild = agentConfig.sub_agents[0];
          edges.push({
            id: `loop-${lastChild}->${firstChild}`,
            source: lastChild,
            target: firstChild,
            type: 'smoothstep',
            style: { stroke: '#14b8a6', strokeWidth: 2, strokeDasharray: '5 5' },
            animated: true,
          });
        }
      }

      // Create edges for agent_tools
      if (agentConfig.agent_tools) {
        agentConfig.agent_tools.forEach((toolAgentId: string) => {
          edges.push({
            id: `${agentId}-tool->${toolAgentId}`,
            source: agentId,
            target: toolAgentId,
            type: 'smoothstep',
            style: { stroke: '#f59e0b', strokeWidth: 2, strokeDasharray: '3 3' },
          });
        });
      }
    });

    // Apply dagre auto-layout
    nodes = applyDagreLayout(nodes, edges, 'TB');

    return { nodes, edges };
  } catch (error) {
    console.error('Failed to parse YAML for graph:', error);
    return { nodes: [], edges: [] };
  }
};

/**
 * Converts React Flow graph back to YAML config
 * Note: This only updates the agents section, preserving other config
 */
export const graphToYaml = (nodes: Node[], existingYaml: string): string => {
  try {
    const config = parseConfig(existingYaml);
    
    // Update agents based on nodes
    const agents: Record<string, AgentConfig> = {};
    
    nodes.forEach((node) => {
      const nodeData = node.data as any;
      if (!nodeData.agentId) return;
      
      // Start with existing config or node config
      const existingAgent = config.agents?.[nodeData.agentId] || nodeData.config || {};
      
      agents[nodeData.agentId] = {
        ...existingAgent,
        name: nodeData.label || existingAgent.name,
        type: nodeData.agentType !== 'llm' ? nodeData.agentType : undefined,
        llm: nodeData.llm || existingAgent.llm,
        description: nodeData.description || existingAgent.description,
        instruction: nodeData.instruction || existingAgent.instruction,
        tools: nodeData.tools || existingAgent.tools,
        sub_agents: nodeData.subAgents || existingAgent.sub_agents,
        agent_tools: nodeData.agentTools || existingAgent.agent_tools,
        guardrails: nodeData.guardrails || existingAgent.guardrails,
        document_stores: nodeData.documentStores || existingAgent.document_stores,
        url: nodeData.url || existingAgent.url,
      };
      
      // Clean undefined values
      Object.keys(agents[nodeData.agentId]).forEach(key => {
        if (agents[nodeData.agentId][key as keyof AgentConfig] === undefined) {
          delete agents[nodeData.agentId][key as keyof AgentConfig];
        }
      });
    });
    
    // Preserve non-agent config
    const newConfig: HectorConfig = {
      ...config,
      agents,
    };
    
    return yaml.dump(newConfig, { indent: 2, lineWidth: -1, noRefs: true });
  } catch (error) {
    console.error('Failed to convert graph to YAML:', error);
    return existingYaml;
  }
};

/**
 * Validates YAML for canvas visualization
 */
export const validateYAMLForCanvas = (yamlContent: string): { valid: boolean; error?: string } => {
  try {
    const config = parseConfig(yamlContent);
    if (!config) {
      return { valid: false, error: 'Empty configuration' };
    }
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid YAML'
    };
  }
};
