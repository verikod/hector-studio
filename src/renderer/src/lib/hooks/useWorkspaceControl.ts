import { useCallback, useState } from 'react';
import { useServersStore } from '../../store/serversStore';

export function useWorkspaceControl() {
  const [isLoading, setIsLoading] = useState(false);
  const syncFromMain = useServersStore((s) => s.syncFromMain);
  const selectServer = useServersStore((s) => s.selectServer);

  const enableAndSelect = useCallback(async () => {
    setIsLoading(true);
    try {
      // Call coordinator via IPC - it handles workspace creation, starting, and state sync
      const result = await (window as any).api.workspaces.enable();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to enable workspaces');
      }
      
      const workspaceId = result.workspaceId;
      if (!workspaceId) {
        throw new Error('No workspace ID returned from enable');
      }

      // Sync server list to ensure the workspace is in our store
      // The coordinator broadcasts state, but we need the full server list sync too
      const list = await (window as any).api.server.list();
      syncFromMain(list);

      // Select the started workspace
      selectServer(workspaceId);
      
      // Persist selection
      await (window as any).api.server.setActive(workspaceId);

      console.log('[useWorkspaceControl] Enable complete, selected workspace:', workspaceId);

      return workspaceId;
    } finally {
      setIsLoading(false);
    }
  }, [syncFromMain, selectServer]);

  const disableWorkspaces = useCallback(async () => {
    setIsLoading(true);
    try {
        await (window as any).api.workspaces.disable();
        // Determine what to select next is tricky to centralize perfectly 
        // because it depends on whether we want to select a specific remote server or just clear,
        // but we can at least handle the disabling part.
    } finally {
        setIsLoading(false);
    }
  }, []);

  return {
    enableAndSelect,
    disableWorkspaces,
    isLoading
  };
}
