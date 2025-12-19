import React, { useState, useMemo, useCallback } from 'react';
import { Database, Cpu, Box, Layers, Wrench, Plus, Pencil, Trash2, Shield, FileText } from 'lucide-react';
import type { Node } from '@xyflow/react';

import { parseConfig, updateConfigSection, removeFromConfigSection } from '../../lib/config-utils';
import type { LLMConfig, ToolConfig, GuardrailConfig, DatabaseConfig, EmbedderConfig, VectorStoreConfig, DocumentStoreConfig } from '../../lib/config-utils';
import { LLMModal } from './LLMModal';
import { ToolModal } from './ToolModal';
import { GuardrailModal } from './GuardrailModal';
import { DatabaseModal, EmbedderModal, VectorStoreModal, DocumentStoreModal } from './OtherModals';
import { useStore } from '../../store/useStore';

interface InfrastructureSidebarProps {
  yamlContent: string;
  nodes: Node[];
  collapsed?: boolean;
  onToggle?: () => void;
}

interface SectionItemProps {
  name: string;
  config: any;
  color: string;
  usageCount?: number;
  onEdit: () => void;
  onDelete: () => void;
}

const SectionItem: React.FC<SectionItemProps> = ({ name, config, color, usageCount, onEdit, onDelete }) => (
  <div className="p-2 rounded border border-white/5 bg-white/5 hover:bg-white/10 transition-colors group">
    <div className="flex items-center justify-between mb-1">
      <span className={`font-heading font-medium text-xs ${color}`}>{name}</span>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {usageCount !== undefined && usageCount > 0 && (
          <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-gray-400 mr-1">
            {usageCount} refs
          </span>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="p-1 hover:bg-white/10 rounded"
          title="Edit"
        >
          <Pencil size={12} className="text-gray-400 hover:text-white" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-1 hover:bg-red-500/20 rounded"
          title="Delete"
        >
          <Trash2 size={12} className="text-gray-400 hover:text-red-400" />
        </button>
      </div>
    </div>
    <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
      {config.provider && (
        <span className="px-1 py-px rounded bg-white/5 border border-white/5">{config.provider}</span>
      )}
      {config.model && (
        <span className="truncate max-w-[120px]" title={config.model}>{config.model}</span>
      )}
      {config.type && (
        <span className="px-1 py-px rounded bg-white/5 border border-white/5 capitalize">{config.type}</span>
      )}
      {config.driver && (
        <span className="uppercase tracking-wider">{config.driver}</span>
      )}
    </div>
  </div>
);

interface SectionHeaderProps {
  icon: React.ReactNode;
  iconBgClass: string;
  title: string;
  count: number;
  isExpanded: boolean;
  dotColor: string;
  onToggle: () => void;
  onAdd: () => void;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({
  icon, iconBgClass, title, count, isExpanded, dotColor, onToggle, onAdd
}) => (
  <div className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors group">
    <button onClick={onToggle} className="flex items-center gap-3 flex-1">
      <div className={`w-8 h-8 rounded ${iconBgClass} flex items-center justify-center group-hover:opacity-80 transition-opacity`}>
        {icon}
      </div>
      <div className="text-left">
        <div className="text-sm font-medium text-gray-200">{title}</div>
        <div className="text-[10px] text-gray-500">{count} configured</div>
      </div>
    </button>
    <div className="flex items-center gap-2">
      <button
        onClick={(e) => { e.stopPropagation(); onAdd(); }}
        className="p-1 hover:bg-white/10 rounded opacity-0 group-hover:opacity-100 transition-opacity"
        title={`Add ${title.slice(0, -1)}`}
      >
        <Plus size={14} className="text-gray-400 hover:text-white" />
      </button>
      {isExpanded && (
        <div className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
      )}
    </div>
  </div>
);

export const InfrastructureSidebar: React.FC<InfrastructureSidebarProps> = React.memo(({
  yamlContent,
  nodes,
  collapsed = false,
  onToggle
}) => {
  const setYamlContent = useStore((s) => s.setStudioYamlContent);

  const [expandedSection, setExpandedSection] = useState<string | null>('llms');

  // Modal states
  const [llmModalOpen, setLlmModalOpen] = useState(false);
  const [toolModalOpen, setToolModalOpen] = useState(false);
  const [guardrailModalOpen, setGuardrailModalOpen] = useState(false);
  const [databaseModalOpen, setDatabaseModalOpen] = useState(false);
  const [embedderModalOpen, setEmbedderModalOpen] = useState(false);
  const [vectorStoreModalOpen, setVectorStoreModalOpen] = useState(false);
  const [documentStoreModalOpen, setDocumentStoreModalOpen] = useState(false);

  const [editingLLM, setEditingLLM] = useState<{ id: string; config: LLMConfig } | null>(null);
  const [editingTool, setEditingTool] = useState<{ id: string; config: ToolConfig } | null>(null);
  const [editingGuardrail, setEditingGuardrail] = useState<{ id: string; config: GuardrailConfig } | null>(null);
  const [editingDatabase, setEditingDatabase] = useState<{ id: string; config: DatabaseConfig } | null>(null);
  const [editingEmbedder, setEditingEmbedder] = useState<{ id: string; config: EmbedderConfig } | null>(null);
  const [editingVectorStore, setEditingVectorStore] = useState<{ id: string; config: VectorStoreConfig } | null>(null);
  const [editingDocumentStore, setEditingDocumentStore] = useState<{ id: string; config: DocumentStoreConfig } | null>(null);

  const infrastructure = useMemo(() => {
    try {
      const config = parseConfig(yamlContent);
      const llms = config.llms || {};
      const databases = config.databases || {};
      const embedders = config.embedders || {};
      const vectorStores = config.vector_stores || {};
      const tools = config.tools || {};
      const guardrails = config.guardrails || {};
      const documentStores = config.document_stores || {};

      // Calculate LLM usage from nodes
      const llmUsage: Record<string, number> = {};
      nodes.forEach((node) => {
        if (node.data && typeof node.data === 'object' && 'llm' in node.data) {
          const llmName = (node.data as any).llm;
          if (llmName) {
            llmUsage[llmName] = (llmUsage[llmName] || 0) + 1;
          }
        }
      });

      return {
        llms,
        databases,
        embedders,
        vectorStores,
        tools,
        guardrails,
        documentStores,
        llmUsage,
      };
    } catch (e) {
      return {
        llms: {},
        databases: {},
        embedders: {},
        vectorStores: {},
        tools: {},
        guardrails: {},
        documentStores: {},
        llmUsage: {},
      };
    }
  }, [yamlContent, nodes]);

  // Handlers for LLMs
  const handleAddLLM = useCallback(() => {
    setEditingLLM(null);
    setLlmModalOpen(true);
  }, []);

  const handleEditLLM = useCallback((id: string, config: LLMConfig) => {
    setEditingLLM({ id, config });
    setLlmModalOpen(true);
  }, []);

  const handleDeleteLLM = useCallback((id: string) => {
    const newYaml = removeFromConfigSection(yamlContent, 'llms', id);
    setYamlContent(newYaml);
  }, [yamlContent, setYamlContent]);

  const handleSaveLLM = useCallback((id: string, config: LLMConfig) => {
    const newYaml = updateConfigSection(yamlContent, 'llms', id, config);
    setYamlContent(newYaml);
  }, [yamlContent, setYamlContent]);

  // Handlers for Tools
  const handleAddTool = useCallback(() => {
    setEditingTool(null);
    setToolModalOpen(true);
  }, []);

  const handleEditTool = useCallback((id: string, config: ToolConfig) => {
    setEditingTool({ id, config });
    setToolModalOpen(true);
  }, []);

  const handleDeleteTool = useCallback((id: string) => {
    const newYaml = removeFromConfigSection(yamlContent, 'tools', id);
    setYamlContent(newYaml);
  }, [yamlContent, setYamlContent]);

  const handleSaveTool = useCallback((id: string, config: ToolConfig) => {
    const newYaml = updateConfigSection(yamlContent, 'tools', id, config);
    setYamlContent(newYaml);
  }, [yamlContent, setYamlContent]);

  // Handlers for Guardrails
  const handleAddGuardrail = useCallback(() => {
    setEditingGuardrail(null);
    setGuardrailModalOpen(true);
  }, []);

  const handleEditGuardrail = useCallback((id: string, config: GuardrailConfig) => {
    setEditingGuardrail({ id, config });
    setGuardrailModalOpen(true);
  }, []);

  const handleDeleteGuardrail = useCallback((id: string) => {
    const newYaml = removeFromConfigSection(yamlContent, 'guardrails', id);
    setYamlContent(newYaml);
  }, [yamlContent, setYamlContent]);

  const handleSaveGuardrail = useCallback((id: string, config: GuardrailConfig) => {
    const newYaml = updateConfigSection(yamlContent, 'guardrails', id, config);
    setYamlContent(newYaml);
  }, [yamlContent, setYamlContent]);

  // Handlers for Databases
  const handleAddDatabase = useCallback(() => {
    setEditingDatabase(null);
    setDatabaseModalOpen(true);
  }, []);

  const handleEditDatabase = useCallback((id: string, config: DatabaseConfig) => {
    setEditingDatabase({ id, config });
    setDatabaseModalOpen(true);
  }, []);

  const handleDeleteDatabase = useCallback((id: string) => {
    const newYaml = removeFromConfigSection(yamlContent, 'databases', id);
    setYamlContent(newYaml);
  }, [yamlContent, setYamlContent]);

  const handleSaveDatabase = useCallback((id: string, config: DatabaseConfig) => {
    const newYaml = updateConfigSection(yamlContent, 'databases', id, config);
    setYamlContent(newYaml);
  }, [yamlContent, setYamlContent]);

  // Handlers for Embedders
  const handleAddEmbedder = useCallback(() => {
    setEditingEmbedder(null);
    setEmbedderModalOpen(true);
  }, []);

  const handleEditEmbedder = useCallback((id: string, config: EmbedderConfig) => {
    setEditingEmbedder({ id, config });
    setEmbedderModalOpen(true);
  }, []);

  const handleDeleteEmbedder = useCallback((id: string) => {
    const newYaml = removeFromConfigSection(yamlContent, 'embedders', id);
    setYamlContent(newYaml);
  }, [yamlContent, setYamlContent]);

  const handleSaveEmbedder = useCallback((id: string, config: EmbedderConfig) => {
    const newYaml = updateConfigSection(yamlContent, 'embedders', id, config);
    setYamlContent(newYaml);
  }, [yamlContent, setYamlContent]);

  // Handlers for Vector Stores
  const handleAddVectorStore = useCallback(() => {
    setEditingVectorStore(null);
    setVectorStoreModalOpen(true);
  }, []);

  const handleEditVectorStore = useCallback((id: string, config: VectorStoreConfig) => {
    setEditingVectorStore({ id, config });
    setVectorStoreModalOpen(true);
  }, []);

  const handleDeleteVectorStore = useCallback((id: string) => {
    const newYaml = removeFromConfigSection(yamlContent, 'vector_stores', id);
    setYamlContent(newYaml);
  }, [yamlContent, setYamlContent]);

  const handleSaveVectorStore = useCallback((id: string, config: VectorStoreConfig) => {
    const newYaml = updateConfigSection(yamlContent, 'vector_stores', id, config);
    setYamlContent(newYaml);
  }, [yamlContent, setYamlContent]);

  // Handlers for Document Stores
  const handleAddDocumentStore = useCallback(() => {
    setEditingDocumentStore(null);
    setDocumentStoreModalOpen(true);
  }, []);

  const handleEditDocumentStore = useCallback((id: string, config: DocumentStoreConfig) => {
    setEditingDocumentStore({ id, config });
    setDocumentStoreModalOpen(true);
  }, []);

  const handleDeleteDocumentStore = useCallback((id: string) => {
    const newYaml = removeFromConfigSection(yamlContent, 'document_stores', id);
    setYamlContent(newYaml);
  }, [yamlContent, setYamlContent]);

  const handleSaveDocumentStore = useCallback((id: string, config: DocumentStoreConfig) => {
    const newYaml = updateConfigSection(yamlContent, 'document_stores', id, config);
    setYamlContent(newYaml);
  }, [yamlContent, setYamlContent]);

  if (collapsed) {
    return (
      <div className="w-16 bg-black/40 border-r border-white/10 flex flex-col items-center py-4 gap-6">
        <button onClick={onToggle} className="flex flex-col items-center gap-1 hover:bg-white/5 p-2 rounded transition-colors w-full" title="LLMs">
          <Cpu size={20} className="text-blue-400" />
          <span className="text-xs text-gray-400">{Object.keys(infrastructure.llms).length}</span>
        </button>
        <button onClick={onToggle} className="flex flex-col items-center gap-1 hover:bg-white/5 p-2 rounded transition-colors w-full" title="Tools">
          <Wrench size={20} className="text-yellow-400" />
          <span className="text-xs text-gray-400">{Object.keys(infrastructure.tools).length}</span>
        </button>
        <button onClick={onToggle} className="flex flex-col items-center gap-1 hover:bg-white/5 p-2 rounded transition-colors w-full" title="Guardrails">
          <Shield size={20} className="text-red-400" />
          <span className="text-xs text-gray-400">{Object.keys(infrastructure.guardrails).length}</span>
        </button>
        <button onClick={onToggle} className="flex flex-col items-center gap-1 hover:bg-white/5 p-2 rounded transition-colors w-full" title="Databases">
          <Database size={20} className="text-green-400" />
          <span className="text-xs text-gray-400">{Object.keys(infrastructure.databases).length}</span>
        </button>
        <button onClick={onToggle} className="flex flex-col items-center gap-1 hover:bg-white/5 p-2 rounded transition-colors w-full" title="Embedders">
          <Layers size={20} className="text-purple-400" />
          <span className="text-xs text-gray-400">{Object.keys(infrastructure.embedders).length}</span>
        </button>
        <button onClick={onToggle} className="flex flex-col items-center gap-1 hover:bg-white/5 p-2 rounded transition-colors w-full" title="Vector Stores">
          <Box size={20} className="text-orange-400" />
          <span className="text-xs text-gray-400">{Object.keys(infrastructure.vectorStores).length}</span>
        </button>
        <button onClick={onToggle} className="flex flex-col items-center gap-1 hover:bg-white/5 p-2 rounded transition-colors w-full" title="Document Stores">
          <FileText size={20} className="text-cyan-400" />
          <span className="text-xs text-gray-400">{Object.keys(infrastructure.documentStores).length}</span>
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="w-64 bg-black/40 border-r border-white/10 flex flex-col overflow-hidden">
        <div className="flex-none px-4 py-3 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Resources</h2>
          <button onClick={onToggle} className="text-gray-400 hover:text-white transition-colors" title="Collapse sidebar">
            <Layers size={16} className="rotate-90" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {/* LLMs */}
          <div className="border-b border-white/10">
            <SectionHeader
              icon={<Cpu size={16} className="text-blue-400" />}
              iconBgClass="bg-blue-500/10 group-hover:bg-blue-500/20"
              title="LLMs"
              count={Object.keys(infrastructure.llms).length}
              isExpanded={expandedSection === 'llms'}
              dotColor="bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"
              onToggle={() => setExpandedSection(expandedSection === 'llms' ? null : 'llms')}
              onAdd={handleAddLLM}
            />
            {expandedSection === 'llms' && (
              <div className="px-4 pb-3 space-y-2 bg-black/20 border-t border-white/5 pt-2">
                {Object.entries(infrastructure.llms).map(([name, config]) => (
                  <SectionItem
                    key={name}
                    name={name}
                    config={config as LLMConfig}
                    color="text-blue-300"
                    usageCount={infrastructure.llmUsage[name]}
                    onEdit={() => handleEditLLM(name, config as LLMConfig)}
                    onDelete={() => handleDeleteLLM(name)}
                  />
                ))}
                {Object.keys(infrastructure.llms).length === 0 && (
                  <div className="text-xs text-center py-2 text-gray-600 italic">No LLMs defined</div>
                )}
              </div>
            )}
          </div>

          {/* Tools */}
          <div className="border-b border-white/10">
            <SectionHeader
              icon={<Wrench size={16} className="text-yellow-400" />}
              iconBgClass="bg-yellow-500/10 group-hover:bg-yellow-500/20"
              title="Tools"
              count={Object.keys(infrastructure.tools).length}
              isExpanded={expandedSection === 'tools'}
              dotColor="bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.8)]"
              onToggle={() => setExpandedSection(expandedSection === 'tools' ? null : 'tools')}
              onAdd={handleAddTool}
            />
            {expandedSection === 'tools' && (
              <div className="px-4 pb-3 space-y-2 bg-black/20 border-t border-white/5 pt-2">
                {Object.entries(infrastructure.tools).map(([name, config]) => (
                  <SectionItem
                    key={name}
                    name={name}
                    config={config as ToolConfig}
                    color="text-yellow-300"
                    onEdit={() => handleEditTool(name, config as ToolConfig)}
                    onDelete={() => handleDeleteTool(name)}
                  />
                ))}
                {Object.keys(infrastructure.tools).length === 0 && (
                  <div className="text-xs text-center py-2 text-gray-600 italic">No tools defined</div>
                )}
              </div>
            )}
          </div>

          {/* Guardrails */}
          <div className="border-b border-white/10">
            <SectionHeader
              icon={<Shield size={16} className="text-red-400" />}
              iconBgClass="bg-red-500/10 group-hover:bg-red-500/20"
              title="Guardrails"
              count={Object.keys(infrastructure.guardrails).length}
              isExpanded={expandedSection === 'guardrails'}
              dotColor="bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"
              onToggle={() => setExpandedSection(expandedSection === 'guardrails' ? null : 'guardrails')}
              onAdd={handleAddGuardrail}
            />
            {expandedSection === 'guardrails' && (
              <div className="px-4 pb-3 space-y-2 bg-black/20 border-t border-white/5 pt-2">
                {Object.entries(infrastructure.guardrails).map(([name, config]) => (
                  <SectionItem
                    key={name}
                    name={name}
                    config={config as GuardrailConfig}
                    color="text-red-300"
                    onEdit={() => handleEditGuardrail(name, config as GuardrailConfig)}
                    onDelete={() => handleDeleteGuardrail(name)}
                  />
                ))}
                {Object.keys(infrastructure.guardrails).length === 0 && (
                  <div className="text-xs text-center py-2 text-gray-600 italic">No guardrails defined</div>
                )}
              </div>
            )}
          </div>

          {/* Databases */}
          <div className="border-b border-white/10">
            <SectionHeader
              icon={<Database size={16} className="text-green-400" />}
              iconBgClass="bg-green-500/10 group-hover:bg-green-500/20"
              title="Databases"
              count={Object.keys(infrastructure.databases).length}
              isExpanded={expandedSection === 'databases'}
              dotColor="bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]"
              onToggle={() => setExpandedSection(expandedSection === 'databases' ? null : 'databases')}
              onAdd={handleAddDatabase}
            />
            {expandedSection === 'databases' && (
              <div className="px-4 pb-3 space-y-2 bg-black/20 border-t border-white/5 pt-2">
                {Object.entries(infrastructure.databases).map(([name, config]) => (
                  <SectionItem
                    key={name}
                    name={name}
                    config={config as DatabaseConfig}
                    color="text-green-300"
                    onEdit={() => handleEditDatabase(name, config as DatabaseConfig)}
                    onDelete={() => handleDeleteDatabase(name)}
                  />
                ))}
                {Object.keys(infrastructure.databases).length === 0 && (
                  <div className="text-xs text-center py-2 text-gray-600 italic">No databases defined</div>
                )}
              </div>
            )}
          </div>

          {/* Embedders */}
          <div className="border-b border-white/10">
            <SectionHeader
              icon={<Layers size={16} className="text-purple-400" />}
              iconBgClass="bg-purple-500/10 group-hover:bg-purple-500/20"
              title="Embedders"
              count={Object.keys(infrastructure.embedders).length}
              isExpanded={expandedSection === 'embedders'}
              dotColor="bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)]"
              onToggle={() => setExpandedSection(expandedSection === 'embedders' ? null : 'embedders')}
              onAdd={handleAddEmbedder}
            />
            {expandedSection === 'embedders' && (
              <div className="px-4 pb-3 space-y-2 bg-black/20 border-t border-white/5 pt-2">
                {Object.entries(infrastructure.embedders).map(([name, config]) => (
                  <SectionItem
                    key={name}
                    name={name}
                    config={config as EmbedderConfig}
                    color="text-purple-300"
                    onEdit={() => handleEditEmbedder(name, config as EmbedderConfig)}
                    onDelete={() => handleDeleteEmbedder(name)}
                  />
                ))}
                {Object.keys(infrastructure.embedders).length === 0 && (
                  <div className="text-xs text-center py-2 text-gray-600 italic">No embedders defined</div>
                )}
              </div>
            )}
          </div>

          {/* Vector Stores */}
          <div className="border-b border-white/10">
            <SectionHeader
              icon={<Box size={16} className="text-orange-400" />}
              iconBgClass="bg-orange-500/10 group-hover:bg-orange-500/20"
              title="Vector Stores"
              count={Object.keys(infrastructure.vectorStores).length}
              isExpanded={expandedSection === 'vectorStores'}
              dotColor="bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]"
              onToggle={() => setExpandedSection(expandedSection === 'vectorStores' ? null : 'vectorStores')}
              onAdd={handleAddVectorStore}
            />
            {expandedSection === 'vectorStores' && (
              <div className="px-4 pb-3 space-y-2 bg-black/20 border-t border-white/5 pt-2">
                {Object.entries(infrastructure.vectorStores).map(([name, config]) => (
                  <SectionItem
                    key={name}
                    name={name}
                    config={config as VectorStoreConfig}
                    color="text-orange-300"
                    onEdit={() => handleEditVectorStore(name, config as VectorStoreConfig)}
                    onDelete={() => handleDeleteVectorStore(name)}
                  />
                ))}
                {Object.keys(infrastructure.vectorStores).length === 0 && (
                  <div className="text-xs text-center py-2 text-gray-600 italic">No vector stores defined</div>
                )}
              </div>
            )}
          </div>

          {/* Document Stores */}
          <div className="border-b border-white/10">
            <SectionHeader
              icon={<FileText size={16} className="text-cyan-400" />}
              iconBgClass="bg-cyan-500/10 group-hover:bg-cyan-500/20"
              title="Document Stores"
              count={Object.keys(infrastructure.documentStores).length}
              isExpanded={expandedSection === 'documentStores'}
              dotColor="bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]"
              onToggle={() => setExpandedSection(expandedSection === 'documentStores' ? null : 'documentStores')}
              onAdd={handleAddDocumentStore}
            />
            {expandedSection === 'documentStores' && (
              <div className="px-4 pb-3 space-y-2 bg-black/20 border-t border-white/5 pt-2">
                {Object.entries(infrastructure.documentStores).map(([name, config]) => (
                  <SectionItem
                    key={name}
                    name={name}
                    config={config as DocumentStoreConfig}
                    color="text-cyan-300"
                    onEdit={() => handleEditDocumentStore(name, config as DocumentStoreConfig)}
                    onDelete={() => handleDeleteDocumentStore(name)}
                  />
                ))}
                {Object.keys(infrastructure.documentStores).length === 0 && (
                  <div className="text-xs text-center py-2 text-gray-600 italic">No document stores defined</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <LLMModal
        isOpen={llmModalOpen}
        onClose={() => { setLlmModalOpen(false); setEditingLLM(null); }}
        onSave={handleSaveLLM}
        existingIds={Object.keys(infrastructure.llms)}
        editId={editingLLM?.id}
        editConfig={editingLLM?.config}
      />

      <ToolModal
        isOpen={toolModalOpen}
        onClose={() => { setToolModalOpen(false); setEditingTool(null); }}
        onSave={handleSaveTool}
        existingIds={Object.keys(infrastructure.tools)}
        editId={editingTool?.id}
        editConfig={editingTool?.config}
      />

      <GuardrailModal
        isOpen={guardrailModalOpen}
        onClose={() => { setGuardrailModalOpen(false); setEditingGuardrail(null); }}
        onSave={handleSaveGuardrail}
        existingIds={Object.keys(infrastructure.guardrails)}
        editId={editingGuardrail?.id}
        editConfig={editingGuardrail?.config}
      />

      <DatabaseModal
        isOpen={databaseModalOpen}
        onClose={() => { setDatabaseModalOpen(false); setEditingDatabase(null); }}
        onSave={handleSaveDatabase}
        existingIds={Object.keys(infrastructure.databases)}
        editId={editingDatabase?.id}
        editConfig={editingDatabase?.config}
      />

      <EmbedderModal
        isOpen={embedderModalOpen}
        onClose={() => { setEmbedderModalOpen(false); setEditingEmbedder(null); }}
        onSave={handleSaveEmbedder}
        existingIds={Object.keys(infrastructure.embedders)}
        editId={editingEmbedder?.id}
        editConfig={editingEmbedder?.config}
      />

      <VectorStoreModal
        isOpen={vectorStoreModalOpen}
        onClose={() => { setVectorStoreModalOpen(false); setEditingVectorStore(null); }}
        onSave={handleSaveVectorStore}
        existingIds={Object.keys(infrastructure.vectorStores)}
        editId={editingVectorStore?.id}
        editConfig={editingVectorStore?.config}
      />

      <DocumentStoreModal
        isOpen={documentStoreModalOpen}
        onClose={() => { setDocumentStoreModalOpen(false); setEditingDocumentStore(null); }}
        onSave={handleSaveDocumentStore}
        existingIds={Object.keys(infrastructure.documentStores)}
        embedderOptions={Object.keys(infrastructure.embedders)}
        vectorStoreOptions={Object.keys(infrastructure.vectorStores)}
        editId={editingDocumentStore?.id}
        editConfig={editingDocumentStore?.config}
      />
    </>
  );
});
