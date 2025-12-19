import React, { useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  type ReactFlowInstance,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Plus, Trash2, Bot } from "lucide-react";

import { PropertiesPanel } from "./PropertiesPanel";
import { AgentNode } from "./nodes/AgentNode";
import { WorkflowGroupNode } from "./nodes/WorkflowGroupNode";
import { yamlToGraph, graphToYaml } from "../../lib/canvas-converter";
import { addAgent, removeAgent, generateResourceId, getAgentNames, parseConfig, getLLMNames } from "../../lib/config-utils";
import { useStore } from "../../store/useStore";

// Custom node types
const nodeTypes = {
  agent: AgentNode,
  workflowGroup: WorkflowGroupNode,
};

interface CanvasModeProps {
  yamlContent: string;
}

/**
 * Editable canvas for designing Hector agent configurations
 * Features:
 * - Auto-layout with dagre (no manual positioning)
 * - Add/delete agents via toolbar
 * - Properties panel for editing selected agent
 * - Bidirectional YAML sync
 */
export const CanvasMode: React.FC<CanvasModeProps> = ({ yamlContent }) => {
  const [nodes, setNodes] = React.useState<Node[]>([]);
  const [edges, setEdges] = React.useState<Edge[]>([]);
  const [rfInstance, setRfInstance] = React.useState<ReactFlowInstance | null>(null);

  // Store access
  const selectedNodeId = useStore((state) => state.selectedNodeId);
  const setSelectedNodeId = useStore((state) => state.setSelectedNodeId);
  const setYamlContent = useStore((state) => state.setStudioYamlContent);

  // Parse config for available resources
  const config = useMemo(() => parseConfig(yamlContent), [yamlContent]);
  const llmNames = useMemo(() => getLLMNames(yamlContent), [yamlContent]);
  const agentNames = useMemo(() => getAgentNames(yamlContent), [yamlContent]);

  // Update visualization when YAML changes
  React.useEffect(() => {
    const { nodes: newNodes, edges: newEdges } = yamlToGraph(yamlContent);
    setNodes(newNodes);
    setEdges(newEdges);
  }, [yamlContent]);

  // Handle node selection
  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setSelectedNodeId(node.id);
    },
    [setSelectedNodeId],
  );

  // Handle pane click (deselect)
  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, [setSelectedNodeId]);

  // Add new agent
  const handleAddAgent = useCallback(() => {
    const newId = generateResourceId("new_agent", agentNames);
    const defaultLlm = llmNames.length > 0 ? llmNames[0] : "default";

    // Auto-generate name from ID (e.g. "new_agent_1" -> "New Agent 1")
    const newName = newId
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    const newYaml = addAgent(yamlContent, newId, {
      name: newName,
      llm: defaultLlm,
      instruction: "You are a helpful assistant.",
    });

    setYamlContent(newYaml);



    // Select the new node after a brief delay for re-render, and fit view
    setTimeout(() => {
      setSelectedNodeId(newId);
      if (rfInstance) {
        rfInstance.fitView({ padding: 0.2, duration: 800 });
      }
    }, 100);
  }, [yamlContent, agentNames, llmNames, setYamlContent, setSelectedNodeId, rfInstance]);

  // Delete selected agent
  const handleDeleteAgent = useCallback(() => {
    if (!selectedNodeId) return;

    // Confirm deletion
    if (!window.confirm(`Delete agent "${selectedNodeId}"?`)) return;

    const newYaml = removeAgent(yamlContent, selectedNodeId);
    setYamlContent(newYaml);
    setSelectedNodeId(null);

    // Fit view after deletion
    setTimeout(() => {
      if (rfInstance) {
        rfInstance.fitView({ padding: 0.2, duration: 800 });
      }
    }, 100);
  }, [selectedNodeId, yamlContent, setYamlContent, setSelectedNodeId, rfInstance]);

  // Handle property updates from panel
  const handlePropertyUpdate = useCallback((updates: Record<string, any>) => {
    if (!selectedNodeId) return;

    // Update node data
    setNodes((prevNodes) =>
      prevNodes.map((node) =>
        node.id === selectedNodeId
          ? { ...node, data: { ...node.data, ...updates } }
          : node
      )
    );

    // Sync to YAML
    const updatedNodes = nodes.map((node) =>
      node.id === selectedNodeId
        ? { ...node, data: { ...node.data, ...updates } }
        : node
    );
    const newYaml = graphToYaml(updatedNodes, yamlContent);
    setYamlContent(newYaml);
  }, [selectedNodeId, nodes, yamlContent, setYamlContent]);

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Delete key to remove selected agent
      if (e.key === "Delete" && selectedNodeId && !(e.target as HTMLElement)?.closest?.("input, textarea")) {
        handleDeleteAgent();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedNodeId, handleDeleteAgent]);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  return (
    <div className="flex h-full bg-gradient-to-br from-hector-darker to-black relative">
      {/* Canvas Toolbar */}
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        <button
          onClick={handleAddAgent}
          className="flex items-center gap-2 px-3 py-2 bg-hector-green hover:bg-hector-green/80 text-white text-sm font-medium rounded-lg shadow-lg transition-colors"
          title="Add new agent"
        >
          <Plus size={16} />
          <span>Add Agent</span>
        </button>

        {selectedNodeId && (
          <button
            onClick={handleDeleteAgent}
            className="flex items-center gap-2 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm font-medium rounded-lg border border-red-500/30 transition-colors"
            title="Delete selected agent"
          >
            <Trash2 size={16} />
            <span>Delete</span>
          </button>
        )}
      </div>

      {/* Agent count indicator - lower z-index to not overlap properties panel */}
      {!selectedNodeId && (
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2 px-3 py-2 bg-black/40 rounded-lg border border-white/10">
          <Bot size={16} className="text-hector-green" />
          <span className="text-sm text-gray-300">{nodes.length} agents</span>
        </div>
      )}

      {/* Main Canvas */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onInit={setRfInstance}
          nodeTypes={nodeTypes}
          defaultViewport={{ x: 50, y: 50, zoom: 0.9 }}
          minZoom={0.2}
          maxZoom={2.0}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={true}
          className="bg-gradient-to-br from-gray-900 to-gray-800"
          proOptions={{ hideAttribution: true }}
          disableKeyboardA11y={true}
          panOnScroll={true}
          panOnDrag={true}
          zoomOnScroll={true}
          preventScrolling={false}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={24}
            size={1}
            color="rgba(255, 255, 255, 0.1)"
            style={{ backgroundColor: "#111" }}
          />
          <Controls
            className="!bg-black/60 !border !border-white/10 !rounded-lg !shadow-lg [&>button]:!bg-black/40 [&>button]:!border-white/10 [&>button]:!text-gray-300 [&>button:hover]:!bg-white/10"
            showInteractive={false}
            position="bottom-right"
          />
        </ReactFlow>
      </div>

      {/* Properties Panel - Editable */}
      {
        selectedNodeId && selectedNode && (
          <PropertiesPanel
            nodeId={selectedNodeId}
            node={selectedNode}
            onClose={() => setSelectedNodeId(null)}
            onUpdate={handlePropertyUpdate}
            readonly={false}
            llmOptions={llmNames}
            toolOptions={Object.keys(config.tools || {})}
            guardrailOptions={Object.keys(config.guardrails || {})}
            documentStoreOptions={Object.keys(config.document_stores || {})}
            agentOptions={agentNames.filter(a => a !== selectedNodeId)}
          />
        )
      }

      {/* Empty state */}
      {
        nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <Bot size={48} className="text-gray-600 mx-auto mb-4" />
              <p className="text-gray-500 text-lg mb-2">No agents configured</p>
              <p className="text-gray-600 text-sm">Click "Add Agent" to get started</p>
            </div>
          </div>
        )
      }
    </div >
  );
};
