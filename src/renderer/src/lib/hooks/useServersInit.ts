import { useEffect } from 'react';
import { useServersStore } from '../../store/serversStore';
import type { ServerConfig, ServerStatus } from '../../types';

/**
 * Hook to initialize servers store from main process.
 * Call this once at app root.
 */
export function useServersInit() {
  const syncFromMain = useServersStore((s) => s.syncFromMain);
  const setServerStatus = useServersStore((s) => s.setServerStatus);

  useEffect(() => {
    // Initial load
    const loadServers = async () => {
      try {
        const servers = await (window as any).api.server.list() as ServerConfig[];
        syncFromMain(servers);

        // Check auth status for each server
        for (const server of servers) {
          // For local workspaces, don't probe - wait for main process status events
          // The main process will emit 'server:status-change' with 'running' -> 'authenticated' 
          // when the hector process is healthy
          if (server.isLocal) {
            // Set to 'checking' initially; main process will emit status when ready
            setServerStatus(server.id, 'checking');
            continue;
          }
          
          // For remote servers, probe auth configuration
          const authConfig = await (window as any).api.server.discoverAuth(server.url);
          if (authConfig === null) {
            // Server unreachable - mark as such
            setServerStatus(server.id, 'unreachable');
          } else if (authConfig.enabled) {
            const isAuth = await (window as any).api.auth.isAuthenticated(server.url);
            setServerStatus(server.id, isAuth ? 'authenticated' : 'auth_required');
          } else {
            setServerStatus(server.id, 'authenticated'); // No auth required
          }
        }
      } catch (error) {
        console.error('Failed to load servers:', error);
      }
    };

    loadServers();

    // Subscribe to updates
    const unsubServers = (window as any).api.server.onServersUpdated((servers: ServerConfig[]) => {
      syncFromMain(servers);
    });

    const unsubStatus = (window as any).api.server.onServerStatusChange(async (data: {
      id: string;
      status: ServerStatus;
      error?: string;
    }) => {
      const store = useServersStore.getState();
      let server = store.servers[data.id];

      // If not in store yet (race condition), fetch and sync first
      if (!server) {
        console.log('[useServersInit] Server not in store, syncing...', data.id);
        const list = await (window as any).api.server.list();
        store.syncFromMain(list);
        server = useServersStore.getState().servers[data.id];
      }

      // Now set the status
      setServerStatus(data.id, data.status, data.error);

      // If a local workspace started, switch to it
      if (data.status === 'authenticated' && server?.config.isLocal) {
        store.selectServer(data.id);
      }
    });

    const unsubAuth = (window as any).api.auth.onAuthStatusChange((data: {
      url: string;
      authenticated: boolean;
    }) => {
      // Find server by URL and update status
      const servers = useServersStore.getState().servers;
      for (const [id, server] of Object.entries(servers)) {
        if (server.config.url === data.url) {
          setServerStatus(id, data.authenticated ? 'authenticated' : 'auth_required');
          break;
        }
      }
    });

    return () => {
      unsubServers?.();
      unsubStatus?.();
      unsubAuth?.();
    };
  }, [syncFromMain, setServerStatus]);
}
