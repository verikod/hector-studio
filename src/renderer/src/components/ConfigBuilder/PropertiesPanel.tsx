import React from "react";
import { X, Settings, Bot, Zap, Shield, FileText, Users } from "lucide-react";
import type { Node } from "@xyflow/react";

interface PropertiesPanelProps {
  nodeId: string;
  node?: Node;
  onClose: () => void;
  onUpdate?: (updates: Record<string, any>) => void;
  readonly?: boolean;
  // Resource options for dropdowns
  llmOptions?: string[];
  toolOptions?: string[];
  guardrailOptions?: string[];
  documentStoreOptions?: string[];
  agentOptions?: string[];
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  nodeId,
  node,
  onClose,
  onUpdate,
  readonly = false,
  llmOptions = [],
  toolOptions = [],
  guardrailOptions = [],
  documentStoreOptions = [],
  agentOptions = [],
}) => {
  if (!node) return null;

  const data = node.data as any;
  const agentType = data?.agentType || 'llm';
  const isWorkflow = ['sequential', 'parallel', 'loop'].includes(agentType);
  const isRemote = agentType === 'remote';

  const [localData, setLocalData] = React.useState({
    label: data?.label || '',
    description: data?.description || '',
    instruction: data?.instruction || '',
    llm: data?.llm || '',
    tools: data?.tools || [],
    guardrails: data?.guardrails || '',
    documentStores: data?.documentStores || [],
    subAgents: data?.subAgents || [],
    agentTools: data?.agentTools || [],

    context: data?.context || { strategy: 'none', window_size: 0, budget: 0 },
    url: data?.url || '',
  });

  React.useEffect(() => {
    setLocalData({
      label: data?.label || '',
      description: data?.description || '',
      instruction: data?.instruction || '',
      llm: data?.llm || '',
      tools: data?.tools || [],
      guardrails: data?.guardrails || '',
      documentStores: data?.documentStores || [],
      subAgents: data?.subAgents || [],
      agentTools: data?.agentTools || [],

      context: data?.context || { strategy: 'none', window_size: 0, budget: 0 },
      url: data?.url || '',
    });
  }, [data]);

  const handleChange = (field: string, value: any) => {
    setLocalData((prev) => ({ ...prev, [field]: value }));
    if (!readonly && onUpdate) {
      onUpdate({ [field]: value });
    }
  };

  const handleMultiSelect = (field: string, value: string, checked: boolean) => {
    const currentValues = localData[field as keyof typeof localData] as string[] || [];
    const newValues = checked
      ? [...currentValues, value]
      : currentValues.filter((v) => v !== value);
    handleChange(field, newValues);
  };

  return (
    <div className="w-80 bg-black/40 border-l border-white/10 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Settings size={18} className="text-gray-400" />
          <h3 className="font-semibold text-sm">Agent Properties</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-white/10 rounded transition-colors"
          title="Close"
        >
          <X size={18} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Agent ID (readonly) */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Agent ID
          </label>
          <div className="px-3 py-2 bg-white/5 border border-white/10 rounded text-sm font-mono text-gray-400">
            {nodeId}
          </div>
        </div>

        {/* Agent Type selector */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Agent Type
          </label>
          <select
            value={agentType}
            onChange={(e) => handleChange('agentType', e.target.value)}
            disabled={readonly}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-sm focus:outline-none focus:border-hector-green disabled:opacity-50"
          >
            <option value="llm">LLM Agent</option>
            <option value="sequential">Sequential Workflow</option>
            <option value="parallel">Parallel Workflow</option>
            <option value="loop">Loop Workflow</option>
            <option value="remote">Remote Agent</option>
          </select>
        </div>

        {/* Basic Info Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
            <Bot size={12} />
            <span>Basic Info</span>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Display Name</label>
            <input
              type="text"
              value={localData.label}
              onChange={(e) => handleChange('label', e.target.value)}
              disabled={readonly}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-sm focus:outline-none focus:border-hector-green disabled:opacity-50"
              placeholder="e.g., Research Assistant"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Description</label>
            <textarea
              value={localData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              disabled={readonly}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-sm focus:outline-none focus:border-hector-green resize-none disabled:opacity-50"
              rows={2}
              placeholder="What does this agent do?"
            />
          </div>
        </div>

        {/* LLM & Tools Section (for non-workflow agents) */}
        {!isWorkflow && !isRemote && (<>
          <div className="space-y-3 pt-2 border-t border-white/10">
            <div className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
              <Zap size={12} />
              <span>Model & Tools</span>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">LLM</label>
              <select
                value={localData.llm}
                onChange={(e) => handleChange('llm', e.target.value)}
                disabled={readonly}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-sm focus:outline-none focus:border-hector-green disabled:opacity-50"
              >
                <option value="">Select LLM...</option>
                {llmOptions.map((llm) => (
                  <option key={llm} value={llm}>{llm}</option>
                ))}
              </select>
            </div>

            {toolOptions.length > 0 && (
              <div>
                <label className="block text-sm font-medium mb-1.5">Tools</label>
                <div className="space-y-1 max-h-32 overflow-y-auto bg-white/5 border border-white/10 rounded p-2">
                  {toolOptions.map((tool) => (
                    <label key={tool} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-white/5 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={localData.tools.includes(tool)}
                        onChange={(e) => handleMultiSelect('tools', tool, e.target.checked)}
                        disabled={readonly}
                        className="rounded border-white/20 bg-white/5 text-hector-green focus:ring-hector-green"
                      />
                      <span>{tool}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1.5">Instruction</label>
              <textarea
                value={localData.instruction}
                onChange={(e) => handleChange('instruction', e.target.value)}
                disabled={readonly}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-sm font-mono focus:outline-none focus:border-hector-green resize-none disabled:opacity-50"
                rows={5}
                placeholder="System prompt for this agent..."
              />
            </div>
          </div>

          <div className="pt-2 border-t border-white/10">
            <label className="block text-sm font-medium mb-1.5">Context Management</label>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Strategy</label>
                <select
                  value={localData.context.strategy || 'none'}
                  onChange={(e) => handleChange('context', { ...localData.context, strategy: e.target.value })}
                  disabled={readonly}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-sm focus:outline-none focus:border-hector-green disabled:opacity-50"
                >
                  <option value="none">None (Full History)</option>
                  <option value="window">Sliding Window</option>
                  <option value="summary">Summary Buffer</option>
                </select>
              </div>

              {localData.context.strategy === 'window' && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Window Size</label>
                  <input
                    type="number"
                    value={localData.context.window_size || 10}
                    onChange={(e) => handleChange('context', { ...localData.context, window_size: parseInt(e.target.value) })}
                    disabled={readonly}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-sm focus:outline-none focus:border-hector-green disabled:opacity-50"
                    placeholder="e.g. 10"
                  />
                </div>
              )}

              {localData.context.strategy === 'summary' && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Token Budget</label>
                  <input
                    type="number"
                    value={localData.context.budget || 2048}
                    onChange={(e) => handleChange('context', { ...localData.context, budget: parseInt(e.target.value) })}
                    disabled={readonly}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-sm focus:outline-none focus:border-hector-green disabled:opacity-50"
                    placeholder="e.g. 2048"
                  />
                </div>
              )}
            </div>
          </div>
        </>)}

        {/* Workflow Sub-Agents Section */}
        {
          isWorkflow && agentOptions.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-white/10">
              <div className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
                <Users size={12} />
                <span>Sub-Agents</span>
              </div>

              <div className="space-y-1 max-h-40 overflow-y-auto bg-white/5 border border-white/10 rounded p-2">
                {agentOptions.map((agent) => (
                  <label key={agent} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-white/5 p-1 rounded">
                    <input
                      type="checkbox"
                      checked={localData.subAgents.includes(agent)}
                      onChange={(e) => handleMultiSelect('subAgents', agent, e.target.checked)}
                      disabled={readonly}
                      className="rounded border-white/20 bg-white/5 text-hector-green focus:ring-hector-green"
                    />
                    <span>{agent}</span>
                  </label>
                ))}
              </div>
            </div>
          )
        }

        {/* Remote Agent URL */}
        {
          isRemote && (
            <div className="space-y-3 pt-2 border-t border-white/10">
              <div>
                <label className="block text-sm font-medium mb-1.5">Remote URL</label>
                <input
                  type="text"
                  value={localData.url}
                  onChange={(e) => handleChange('url', e.target.value)}
                  disabled={readonly}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-sm focus:outline-none focus:border-hector-green disabled:opacity-50"
                  placeholder="http://localhost:9000"
                />
              </div>
            </div>
          )
        }

        {/* Advanced Section */}
        <div className="space-y-3 pt-2 border-t border-white/10">
          <div className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
            <Shield size={12} />
            <span>Advanced</span>
          </div>

          {guardrailOptions.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-1.5">Guardrails</label>
              <select
                value={localData.guardrails}
                onChange={(e) => handleChange('guardrails', e.target.value)}
                disabled={readonly}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-sm focus:outline-none focus:border-hector-green disabled:opacity-50"
              >
                <option value="">None</option>
                {guardrailOptions.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
          )}

          {documentStoreOptions.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-1.5 flex items-center gap-2">
                <FileText size={12} />
                Document Stores (RAG)
              </label>
              <div className="space-y-1 max-h-24 overflow-y-auto bg-white/5 border border-white/10 rounded p-2">
                {documentStoreOptions.map((store) => (
                  <label key={store} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-white/5 p-1 rounded">
                    <input
                      type="checkbox"
                      checked={localData.documentStores.includes(store)}
                      onChange={(e) => handleMultiSelect('documentStores', store, e.target.checked)}
                      disabled={readonly}
                      className="rounded border-white/20 bg-white/5 text-hector-green focus:ring-hector-green"
                    />
                    <span>{store}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {!isWorkflow && agentOptions.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-1.5">Agent Tools</label>
              <div className="space-y-1 max-h-24 overflow-y-auto bg-white/5 border border-white/10 rounded p-2">
                {agentOptions.map((agent) => (
                  <label key={agent} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-white/5 p-1 rounded">
                    <input
                      type="checkbox"
                      checked={localData.agentTools.includes(agent)}
                      onChange={(e) => handleMultiSelect('agentTools', agent, e.target.checked)}
                      disabled={readonly}
                      className="rounded border-white/20 bg-white/5 text-hector-green focus:ring-hector-green"
                    />
                    <span>{agent}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div >
    </div >
  );
};
