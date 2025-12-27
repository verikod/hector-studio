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
const HORIZONTAL_GAP = 40;
const VERTICAL_GAP = 40;
const GROUP_PADDING = 60;

/**
 * Apply dagre auto-layout to ROOT nodes only (those without parentId)
 */
const applyDagreLayout = (
  nodes: Node[], 
  edges: Edge[], 
  direction: 'TB' | 'LR' = 'TB'
): Node[] => {
  // Only layout root nodes
  const rootNodes = nodes.filter(n => !n.parentId);
  const childNodes = nodes.filter(n => n.parentId);
  
  if (rootNodes.length === 0) return nodes;

  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: 80, ranksep: 100, marginx: 50, marginy: 50 });

  // Add root nodes to dagre
  rootNodes.forEach((node) => {
    const width = (node.style?.width as number) || NODE_WIDTH;
    const height = (node.style?.height as number) || NODE_HEIGHT;
    g.setNode(node.id, { width, height });
  });

  // Add edges between root nodes only
  edges.forEach((edge) => {
    const sourceIsRoot = rootNodes.some(n => n.id === edge.source);
    const targetIsRoot = rootNodes.some(n => n.id === edge.target);
    if (sourceIsRoot && targetIsRoot) {
      g.setEdge(edge.source, edge.target);
    }
  });

  // Run layout
  Dagre.layout(g);

  // Apply positions back to root nodes
  const positionedRootNodes = rootNodes.map((node) => {
    const nodeWithPosition = g.node(node.id);
    if (!nodeWithPosition) return node;
    
    const width = (node.style?.width as number) || NODE_WIDTH;
    const height = (node.style?.height as number) || NODE_HEIGHT;
    
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - width / 2,
        y: nodeWithPosition.y - height / 2,
      },
    };
  });

  return [...positionedRootNodes, ...childNodes];
};

/**
 * Calculate dimensions needed for a workflow container based on its children
 */
const calculateWorkflowDimensions = (
  subAgents: string[],
  workflowType: string
): { width: number; height: number } => {
  if (!subAgents || subAgents.length === 0) {
    return { width: NODE_WIDTH + GROUP_PADDING * 2, height: NODE_HEIGHT + GROUP_PADDING * 2 };
  }

  if (workflowType === 'sequential') {
    // Sequential: horizontal layout
    const totalWidth = subAgents.length * NODE_WIDTH + (subAgents.length - 1) * HORIZONTAL_GAP + GROUP_PADDING * 2;
    const totalHeight = NODE_HEIGHT + GROUP_PADDING * 2 + 30; // +30 for header
    return { width: totalWidth, height: totalHeight };
  } else {
    // Parallel/Loop: vertical layout
    const totalWidth = NODE_WIDTH + GROUP_PADDING * 2;
    const totalHeight = subAgents.length * NODE_HEIGHT + (subAgents.length - 1) * VERTICAL_GAP + GROUP_PADDING * 2 + 30;
    return { width: totalWidth, height: totalHeight };
  }
};

/**
 * Converts YAML config to React Flow visualization
 * Workflow agents are containers with sub-agents as child nodes
 */
export const yamlToGraph = (yamlContent: string): GraphData => {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  try {
    const config = parseConfig(yamlContent);

    if (!config || !config.agents || Object.keys(config.agents).length === 0) {
      return { nodes, edges };
    }

    // First pass: identify which agents are sub-agents of workflows
    const subAgentParents: Record<string, string> = {};
    Object.entries(config.agents).forEach(([agentId, agent]) => {
      const agentConfig = agent as AgentConfig;
      const type = agentConfig.type || 'llm';
      const isWorkflow = ['sequential', 'parallel', 'loop'].includes(type);
      
      if (isWorkflow && agentConfig.sub_agents) {
        agentConfig.sub_agents.forEach((subId: string) => {
          subAgentParents[subId] = agentId;
        });
      }
    });

    // Second pass: create all nodes
    Object.entries(config.agents).forEach(([agentId, agent]) => {
      const agentConfig = agent as AgentConfig;
      const type = agentConfig.type || 'llm';
      const isWorkflow = ['sequential', 'parallel', 'loop'].includes(type);
      const isRemote = type === 'remote';
      const parentId = subAgentParents[agentId];

      if (isWorkflow) {
        // Workflow container node
        const dimensions = calculateWorkflowDimensions(
          agentConfig.sub_agents || [],
          type
        );

        nodes.push({
          id: agentId,
          type: 'workflowGroup',
          position: { x: 0, y: 0 },
          data: {
            label: agentConfig.name || agentId,
            agentId,
            agentType: type,
            workflowType: type,
            subAgents: agentConfig.sub_agents || [],
            maxIterations: (agentConfig as any).loop?.max_iterations,
            config: agentConfig,
          },
          style: {
            width: dimensions.width,
            height: dimensions.height,
          },
        });

        // Create child nodes positioned inside the container
        if (agentConfig.sub_agents) {
          agentConfig.sub_agents.forEach((subAgentId: string, index: number) => {
            const subAgent = config.agents?.[subAgentId];
            if (!subAgent) return;

            let childX: number, childY: number;
            
            if (type === 'sequential') {
              // Horizontal layout
              childX = GROUP_PADDING + index * (NODE_WIDTH + HORIZONTAL_GAP);
              childY = GROUP_PADDING + 30; // Below header
            } else {
              // Vertical layout for parallel/loop
              childX = GROUP_PADDING;
              childY = GROUP_PADDING + 30 + index * (NODE_HEIGHT + VERTICAL_GAP);
            }

            nodes.push({
              id: subAgentId,
              type: 'agent',
              position: { x: childX, y: childY },
              parentId: agentId, // This makes it a child of the workflow
              extent: 'parent' as const,
              data: {
                label: subAgent.name || subAgentId,
                agentId: subAgentId,
                agentType: subAgent.type || 'llm',
                llm: subAgent.llm,
                description: subAgent.description,
                instruction: subAgent.instruction,
                tools: subAgent.tools,
                subAgents: subAgent.sub_agents,
                agentTools: subAgent.agent_tools,
                guardrails: subAgent.guardrails,
                documentStores: subAgent.document_stores,
                isRemote: subAgent.type === 'remote',
                url: subAgent.url,
                trigger: subAgent.trigger,
                config: subAgent,
              },
              style: {
                width: NODE_WIDTH,
                height: NODE_HEIGHT,
              },
            });
          });
        }
      } else if (!parentId) {
        // Regular agent (not a child of a workflow) - only add if not already added as child
        nodes.push({
          id: agentId,
          type: 'agent',
          position: { x: 0, y: 0 },
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
            trigger: agentConfig.trigger,
            notifications: agentConfig.notifications,
            config: agentConfig,
          },
          style: {
            width: NODE_WIDTH,
            height: NODE_HEIGHT,
          },
        });
      }

      // Create edges for agent_tools (agents used as tools by other agents)
      if (agentConfig.agent_tools) {
        agentConfig.agent_tools.forEach((toolAgentId: string) => {
          edges.push({
            id: `${agentId}-tool->${toolAgentId}`,
            source: agentId,
            target: toolAgentId,
            type: 'smoothstep',
            style: { stroke: '#f59e0b', strokeWidth: 2, strokeDasharray: '3 3' },
            label: 'uses as tool',
            labelStyle: { fill: '#f59e0b', fontSize: 10 },
          });
        });
      }
    });

    // Apply dagre layout to root nodes only
    const layoutedNodes = applyDagreLayout(nodes, edges, 'TB');

    return { nodes: layoutedNodes, edges };
  } catch (error) {
    console.error('Failed to parse YAML for graph:', error);
    return { nodes: [], edges: [] };
  }
};

/**
 * Cleans trigger config by removing irrelevant fields based on type.
 * Also removes empty string values.
 */
const cleanTrigger = (trigger: any): any | undefined => {
  if (!trigger || !trigger.type) return undefined;

  const cleaned: any = { type: trigger.type };

  // Common fields
  if (trigger.enabled !== undefined) cleaned.enabled = trigger.enabled;
  if (trigger.input && trigger.input.trim()) cleaned.input = trigger.input;

  if (trigger.type === 'schedule') {
    // Schedule-specific fields
    if (trigger.cron && trigger.cron.trim()) cleaned.cron = trigger.cron;
    if (trigger.timezone && trigger.timezone.trim()) cleaned.timezone = trigger.timezone;
  } else if (trigger.type === 'webhook') {
    // Webhook-specific fields
    if (trigger.path && trigger.path.trim()) cleaned.path = trigger.path;
    if (trigger.response) {
      const resp: any = {};
      if (trigger.response.mode && trigger.response.mode.trim()) resp.mode = trigger.response.mode;
      if (trigger.response.callback_url && trigger.response.callback_url.trim()) {
        resp.callback_url = trigger.response.callback_url;
      }
      if (Object.keys(resp).length > 0) cleaned.response = resp;
    }
  }

  return Object.keys(cleaned).length > 1 ? cleaned : undefined; // Must have at least type + one other field
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
        trigger: cleanTrigger(nodeData.trigger) || cleanTrigger(existingAgent.trigger),
        notifications: (nodeData.notifications?.length > 0 ? nodeData.notifications : undefined) 
          || (existingAgent.notifications?.length > 0 ? existingAgent.notifications : undefined),
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
