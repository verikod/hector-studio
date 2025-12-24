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
  const setWorkspacesEnabled = useServersStore((s) => s.setWorkspacesEnabled);

  useEffect(() => {
    // Initial load
    const loadServers = async () => {
      try {
        const servers = await (window as any).api.server.list() as ServerConfig[];
        syncFromMain(servers);

        // Check auth status for each server
        for (const server of servers) {
          // LOCAL WORKSPACES: Don't probe the server directly to avoid race conditions.
          // The main process (manager.ts) polls /health and emits 'server:status-change'
          // with 'authenticated' status only after the hector process is confirmed healthy.
          // This prevents the renderer from trying to connect before the server is ready.
          if (server.isLocal) {
            // Check if this is the active workspace and sync status
            const activeId = await (window as any).api.workspace.getActive();
            if (activeId === server.id) {
              const status = await (window as any).api.hector.getStatus();
              
              if (status === 'running') {
                // Verify with HTTP health check before trusting binary status
                // This handles the case where we reload and miss the status-change event
                console.log('[useServersInit] Hector reports running, verifying health...');
                try {
                  const healthRes = await fetch(`${server.url}/health`, {
                    signal: AbortSignal.timeout(3000)
                  });
                  if (healthRes.ok) {
                    console.log('[useServersInit] Health verified, setting authenticated');
                    setServerStatus(server.id, 'authenticated');
                  } else {
                    console.log('[useServersInit] Health check failed, setting checking');
                    setServerStatus(server.id, 'checking');
                  }
                } catch (e) {
                  console.log('[useServersInit] Health check error, setting checking:', e);
                  setServerStatus(server.id, 'checking');
                }
              } else if (status === 'error') {
                setServerStatus(server.id, 'error');
              } else if (status === 'stopped') {
                setServerStatus(server.id, 'stopped');
              } else {
                // starting or other transient state
                setServerStatus(server.id, 'checking');
              }
            } else {
              setServerStatus(server.id, 'stopped');
            }
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

    // Load initial workspaces enabled state and validate active server
    const loadWorkspacesEnabled = async () => {
      try {
        const enabled = await (window as any).api.workspaces.isEnabled();
        setWorkspacesEnabled(enabled);
        
        // If workspaces are disabled, ensure we don't have a local workspace selected
        // This handles the case where activeServerId was persisted in localStorage
        if (!enabled) {
          const { servers, activeServerId, selectServer } = useServersStore.getState();
          const activeServer = activeServerId ? servers[activeServerId] : null;
          
          if (activeServer?.config.isLocal) {
            console.log('[useServersInit] Clearing stale local workspace selection on startup');
            const remoteServer = Object.values(servers).find(s => !s.config.isLocal);
            if (remoteServer) {
              selectServer(remoteServer.config.id);
            } else {
              selectServer('');
            }
          }
        }
      } catch (error) {
        console.error('Failed to load workspaces enabled state:', error);
      }
    };

    // Load sequentially: servers first, then workspaces state
    // This ensures server list is available when validating active server
    loadServers().then(() => loadWorkspacesEnabled());

    // Subscribe to updates
    const unsubServers = (window as any).api.server.onServersUpdated((servers: ServerConfig[]) => {
      syncFromMain(servers);
    });

    const unsubStatus = (window as any).api.server.onServerStatusChange(async (data: {
      id: string;
      status: ServerStatus;
      error?: string;
    }) => {
      console.log('[useServersInit] Status change event:', data.id, data.status);
      
      let server = useServersStore.getState().servers[data.id];

      // If not in store yet (race condition), fetch and sync first
      if (!server) {
        console.log('[useServersInit] Server not in store, syncing...', data.id);
        try {
          const list = await (window as any).api.server.list();
          useServersStore.getState().syncFromMain(list);
          // Re-fetch after sync completes
          server = useServersStore.getState().servers[data.id];
          
          if (!server) {
            console.warn('[useServersInit] Server still not found after sync:', data.id);
            return; // Can't set status on non-existent server
          }
        } catch (e) {
          console.error('[useServersInit] Failed to sync servers:', e);
          return;
        }
      }

      // Now set the status - use getState() to get fresh setServerStatus
      useServersStore.getState().setServerStatus(data.id, data.status, data.error);

      // If a local workspace started, switch to it
      if (data.status === 'authenticated' && server?.config.isLocal) {
        console.log('[useServersInit] Auto-selecting authenticated workspace:', data.id);
        useServersStore.getState().selectServer(data.id);
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

    // NOTE: workspaces:enabled-changed event is now handled by useStateInit
    // to avoid redundant state updates. This hook only handles initial load.

    return () => {
      unsubServers?.();
      unsubStatus?.();
      unsubAuth?.();
    };
  }, [syncFromMain, setServerStatus, setWorkspacesEnabled]);
}

