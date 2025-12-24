import * as yaml from 'js-yaml';

export interface HectorConfig {
  version?: string;
  name?: string;
  description?: string;
  llms?: Record<string, LLMConfig>;
  tools?: Record<string, ToolConfig>;
  guardrails?: Record<string, GuardrailConfig>;
  databases?: Record<string, DatabaseConfig>;
  embedders?: Record<string, EmbedderConfig>;
  vector_stores?: Record<string, VectorStoreConfig>;
  document_stores?: Record<string, DocumentStoreConfig>;
  agents?: Record<string, AgentConfig>;
  storage?: StorageConfig;
  observability?: ObservabilityConfig;
  defaults?: { llm?: string };
}

export interface StorageConfig {
  tasks?: { backend?: string; database?: string };
  sessions?: { backend?: string; database?: string };
  memory?: {
    backend?: string;
    embedder?: string; // Reference to embedder config
    database?: string; // For SQL or Redis backend
    vector_provider?: { // For vector backend
      type?: 'chromem' | 'qdrant' | 'chroma' | 'pinecone';
      chromem?: { persist_path?: string; compress?: boolean };
      qdrant?: { url?: string; api_key?: string; collection?: string };
    };
  };
  checkpoint?: {
    enabled?: boolean;
    backend?: string;
    database?: string;
    strategy?: 'event' | 'interval' | 'hybrid';
    interval?: number;
    after_tools?: boolean;
    before_llm?: boolean;
    recovery?: {
        auto_resume?: boolean;
        timeout?: number;
    };
  };
}

export interface ObservabilityConfig {
  metrics?: { enabled?: boolean };
  tracing?: {
    enabled?: boolean;
    exporter?: string;
    endpoint?: string;
    sampling_rate?: number;
  };
}

export interface LLMConfig {
  provider?: string;
  model?: string;
  api_key?: string;
  temperature?: number;
  max_tokens?: number;
  reasoning?: { budget_tokens?: number };
}

export interface ToolConfig {
  type?: 'mcp' | 'function' | 'command';
  enabled?: boolean;
  description?: string;
  url?: string;
  transport?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  filter?: string[];
  handler?: string;
  parameters?: Record<string, any>;
  allowed_commands?: string[];
  denied_commands?: string[];
  working_directory?: string;
  max_execution_time?: string;
  deny_by_default?: boolean;
  require_approval?: boolean;
  approval_prompt?: string;
}

export interface GuardrailConfig {
  enabled?: boolean;
  input?: {
    chain_mode?: string;
    length?: { enabled?: boolean; max_length?: number };
    injection?: { enabled?: boolean };
    sanitizer?: { enabled?: boolean; trim_whitespace?: boolean };
  };
  output?: {
    pii?: {
      enabled?: boolean;
      detect_email?: boolean;
      detect_phone?: boolean;
      redact_mode?: string;
    };
    content?: {
      enabled?: boolean;
      blocked_keywords?: string[];
      blocked_patterns?: string[];
    };
  };
  tool?: {
    enabled?: boolean;
    allowed_tools?: string[];
    blocked_tools?: string[];
  };
}

export interface DatabaseConfig {
  driver?: string;
  dsn?: string;
}

export interface EmbedderConfig {
  provider?: string;
  model?: string;
  api_key?: string;
  dimensions?: number;
}

export interface VectorStoreConfig {
  provider?: string;
  url?: string;
  api_key?: string;
  collection?: string;
}

export interface DocumentStoreConfig {
  embedder?: string;
  vector_store?: string;
  source?: {
    directory?: { path?: string; watch?: boolean };
    sql?: { database?: string; table?: string; query?: string };
    api?: { url?: string; method?: string };
  };
  chunker?: { size?: number; overlap?: number; strategy?: string };
  search?: { top_k?: number; hyde_llm?: string; rerank_llm?: string };
}

export interface AgentConfig {
  name?: string;
  description?: string;
  type?: string;
  llm?: string;
  tools?: string[];
  sub_agents?: string[];
  agent_tools?: string[];
  instruction?: string;
  global_instruction?: string;
  guardrails?: string;
  document_stores?: string[];
  visibility?: string;
  streaming?: boolean;
  include_context?: boolean;
  include_context_limit?: number;
  context?: {
    strategy?: string;
    window_size?: number;
    budget?: number;
    threshold?: number;
    target?: number;
  };
  reasoning?: {
    max_iterations?: number;
    enable_exit_tool?: boolean;
    enable_escalate_tool?: boolean;
  };
  structured_output?: { schema?: Record<string, any>; strict?: boolean };
  skills?: Array<{ id?: string; name?: string; description?: string; tags?: string[] }>;
  input_modes?: string[];
  output_modes?: string[];
  // Remote agent
  url?: string;
  agent_card_url?: string;
  headers?: Record<string, string>;
  timeout?: string;
  // Workflow
  max_iterations?: number;
  // Trigger
  trigger?: TriggerConfig;
}

export interface TriggerConfig {
  type?: string;
  cron?: string;
  timezone?: string;
  input?: string;
  enabled?: boolean;
}

/**
 * Parse YAML string to HectorConfig
 */
export function parseConfig(yamlContent: string): HectorConfig {
  try {
    return (yaml.load(yamlContent) || {}) as HectorConfig;
  } catch (e) {
    console.error('Failed to parse YAML:', e);
    return {};
  }
}

/**
 * Serialize HectorConfig to YAML string
 */
export function serializeConfig(config: HectorConfig): string {
  return yaml.dump(config, { indent: 2, lineWidth: -1, noRefs: true });
}

/**
 * Update a specific section in the config
 */
export function updateConfigSection(
  yamlContent: string,
  section: keyof HectorConfig,
  key: string,
  value: any
): string {
  const config = parseConfig(yamlContent);
  if (!config[section]) {
    (config as any)[section] = {};
  }
  (config[section] as Record<string, any>)[key] = value;
  return serializeConfig(config);
}

/**
 * Remove an item from a config section
 */
export function removeFromConfigSection(
  yamlContent: string,
  section: keyof HectorConfig,
  key: string
): string {
  const config = parseConfig(yamlContent);
  if (config[section] && (config[section] as Record<string, any>)[key]) {
    delete (config[section] as Record<string, any>)[key];
  }
  return serializeConfig(config);
}

/**
 * Add a new agent to the config
 */
export function addAgent(yamlContent: string, agentId: string, agentConfig: AgentConfig): string {
  return updateConfigSection(yamlContent, 'agents', agentId, agentConfig);
}

/**
 * Remove an agent from the config
 */
export function removeAgent(yamlContent: string, agentId: string): string {
  const config = parseConfig(yamlContent);
  
  // Remove the agent
  if (config.agents?.[agentId]) {
    delete config.agents[agentId];
  }
  
  // Also remove references to this agent in other agents' sub_agents and agent_tools
  if (config.agents) {
    for (const agent of Object.values(config.agents)) {
      if (agent.sub_agents) {
        agent.sub_agents = agent.sub_agents.filter(id => id !== agentId);
      }
      if (agent.agent_tools) {
        agent.agent_tools = agent.agent_tools.filter(id => id !== agentId);
      }
    }
  }
  
  return serializeConfig(config);
}

/**
 * Update an agent in the config
 */
export function updateAgent(yamlContent: string, agentId: string, updates: Partial<AgentConfig>): string {
  const config = parseConfig(yamlContent);
  if (config.agents?.[agentId]) {
    config.agents[agentId] = { ...config.agents[agentId], ...updates };
  }
  return serializeConfig(config);
}

/**
 * Get list of LLM names from config
 */
export function getLLMNames(yamlContent: string): string[] {
  const config = parseConfig(yamlContent);
  return Object.keys(config.llms || {});
}

/**
 * Get list of Tool names from config
 */
export function getToolNames(yamlContent: string): string[] {
  const config = parseConfig(yamlContent);
  return Object.keys(config.tools || {});
}

/**
 * Get list of Guardrail names from config
 */
export function getGuardrailNames(yamlContent: string): string[] {
  const config = parseConfig(yamlContent);
  return Object.keys(config.guardrails || {});
}

/**
 * Get list of Document Store names from config
 */
export function getDocumentStoreNames(yamlContent: string): string[] {
  const config = parseConfig(yamlContent);
  return Object.keys(config.document_stores || {});
}

/**
 * Get list of Agent names from config
 */
export function getAgentNames(yamlContent: string): string[] {
  const config = parseConfig(yamlContent);
  return Object.keys(config.agents || {});
}

/**
 * Generate a unique ID for a new resource
 */
export function generateResourceId(prefix: string, existingIds: string[]): string {
  let counter = 1;
  let id = prefix;
  while (existingIds.includes(id)) {
    id = `${prefix}_${counter}`;
    counter++;
  }
  return id;
}
