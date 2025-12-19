import { useCallback, useState } from 'react';
import { useServersStore } from '../../store/serversStore';

export function useWorkspaceControl() {
  const [isLoading, setIsLoading] = useState(false);
  const syncFromMain = useServersStore((s) => s.syncFromMain);
  const selectServer = useServersStore((s) => s.selectServer);

  const enableAndSelect = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Enable in backend
      const result = await (window as any).api.workspaces.enable();
      const workspaceId = (result as any).workspaceId;

      if (!workspaceId) {
        throw new Error('No workspace ID returned from enable');
      }

      // 2. Force immediate sync of server list to get the new workspace in the store
      const list = await (window as any).api.server.list();
      syncFromMain(list);

      // 3. Select the new workspace
      selectServer(workspaceId);
      
      // 4. Ensure backend knows it's active (persistence)
      await (window as any).api.server.setActive(workspaceId);

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
