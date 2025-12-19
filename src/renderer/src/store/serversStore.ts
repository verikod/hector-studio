import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ServerConfig, ServerState, ServerStatus, Agent } from '../types';

interface ServersStore {
  // State
  servers: Record<string, ServerState>;
  activeServerId: string | null;
  workspacesEnabled: boolean;
  
  // Accessors
  getActiveServer: () => ServerState | null;
  
  // Server lifecycle
  addServer: (config: ServerConfig) => void;
  removeServer: (id: string) => void;
  selectServer: (id: string) => void;
  
  // Status transitions
  setServerStatus: (id: string, status: ServerStatus, error?: string) => void;
  
  // Data updates
  setServerAgents: (id: string, agents: Agent[]) => void;
  setServerConfig: (id: string, yaml: string) => void;
  
  // Workspaces
  setWorkspacesEnabled: (enabled: boolean) => void;
  
  // Sync with main process
  syncFromMain: (servers: ServerConfig[]) => void;
}

export const useServersStore = create<ServersStore>()(
  persist(
    (set, get) => ({
      servers: {},
      activeServerId: null,
      workspacesEnabled: false,
      
      getActiveServer: () => {
        const { servers, activeServerId, workspacesEnabled } = get();
        if (!activeServerId) return null;
        
        const server = servers[activeServerId];
        if (!server) return null;
        
        // Don't return local workspaces when the feature is disabled
        if (server.config.isLocal && !workspacesEnabled) {
          return null;
        }
        
        return server;
      },
      
      addServer: (config: ServerConfig) => {
        set((state) => ({
          servers: {
            ...state.servers,
            [config.id]: {
              config,
              status: 'added',
              agents: [],
              configYaml: null,
              lastError: null,
            },
          },
          // Set as active if first server
          activeServerId: state.activeServerId ?? config.id,
        }));
      },
      
      removeServer: (id: string) => {
        set((state) => {
          const { [id]: removed, ...rest } = state.servers;
          const newActiveId = state.activeServerId === id
            ? Object.keys(rest)[0] ?? null
            : state.activeServerId;
          return {
            servers: rest,
            activeServerId: newActiveId,
          };
        });
      },
      
      selectServer: (id: string) => {
        set({ activeServerId: id });
      },
      
      setServerStatus: (id: string, status: ServerStatus, error?: string) => {
        set((state) => {
          const server = state.servers[id];
          if (!server) return state;
          
          return {
            servers: {
              ...state.servers,
              [id]: {
                ...server,
                status,
                lastError: error ?? null,
              },
            },
          };
        });
      },
      
      setServerAgents: (id: string, agents: Agent[]) => {
        set((state) => {
          const server = state.servers[id];
          if (!server) return state;
          
          return {
            servers: {
              ...state.servers,
              [id]: {
                ...server,
                agents,
              },
            },
          };
        });
      },
      
      setServerConfig: (id: string, yaml: string) => {
        set((state) => {
          const server = state.servers[id];
          if (!server) return state;
          
          return {
            servers: {
              ...state.servers,
              [id]: {
                ...server,
                configYaml: yaml,
              },
            },
          };
        });
      },
      
      setWorkspacesEnabled: (enabled: boolean) => {
        set({ workspacesEnabled: enabled });
      },
      
      syncFromMain: (configs: ServerConfig[]) => {
        set((state) => {
          const newServers: Record<string, ServerState> = {};
          
          for (const config of configs) {
            // Keep existing state if server already tracked
            const existing = state.servers[config.id];
            newServers[config.id] = existing ?? {
              config,
              status: 'added',
              agents: [],
              configYaml: null,
              lastError: null,
            };
            // Always update config in case it changed
            newServers[config.id].config = config;
          }
          
          return {
            servers: newServers,
            activeServerId: state.activeServerId && newServers[state.activeServerId]
              ? state.activeServerId
              : configs[0]?.id ?? null,
          };
        });
      },
    }),
    {
      name: 'hector_servers_ui',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        activeServerId: state.activeServerId,
        // Don't persist full server state - it comes from main process
      }),
    }
  )
);
