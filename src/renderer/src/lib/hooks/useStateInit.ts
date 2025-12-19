/**
 * useStateInit - Initializes and syncs state from the centralized stateCoordinator
 * 
 * Listens to the unified 'app:state-changed' event and updates both
 * licenseStore and serversStore atomically.
 */

import { useEffect } from 'react';
import { useLicenseStore } from '../../store/licenseStore';
import { useServersStore } from '../../store/serversStore';

interface AppState {
  isLicensed: boolean;
  licenseEmail: string | null;
  licenseKey: string | null;
  workspacesEnabled: boolean;
  hectorInstalled: boolean;
}

export function useStateInit() {
  const setLicenseStatus = useLicenseStore((s) => s.setLicenseStatus);
  const setWorkspacesEnabled = useServersStore((s) => s.setWorkspacesEnabled);

  useEffect(() => {
    // Subscribe to unified state changes from stateCoordinator
    const unsub = (window as any).api.app.onStateChanged(async (state: AppState) => {
      console.log('[useStateInit] State changed:', state);
      
      // Update license store
      setLicenseStatus({
        isLicensed: state.isLicensed,
        email: state.licenseEmail,
        key: state.licenseKey,
      });
      
      // Update workspaces state
      setWorkspacesEnabled(state.workspacesEnabled);
      
      // When workspaces are disabled, clear active server if it's a local workspace
      if (!state.workspacesEnabled) {
        const { servers, activeServerId, selectServer } = useServersStore.getState();
        const activeServer = activeServerId ? servers[activeServerId] : null;
        
        if (activeServer?.config.isLocal) {
          console.log('[useStateInit] Clearing local workspace selection');
          // Find first remote server to select, or null
          const remoteServer = Object.values(servers).find(s => !s.config.isLocal);
          if (remoteServer) {
            selectServer(remoteServer.config.id);
          } else {
            // No remote servers - just deselect
            selectServer('');
          }
        }
      }
      
      // Sync server list to ensure UI is current
      try {
        const servers = await (window as any).api.server.list();
        useServersStore.getState().syncFromMain(servers);
      } catch (e) {
        console.error('[useStateInit] Failed to sync servers:', e);
      }
    });

    return () => {
      unsub?.();
    };
  }, [setLicenseStatus, setWorkspacesEnabled]);
}

