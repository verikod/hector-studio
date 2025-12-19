import { useEffect, useRef, useCallback } from 'react';
import { useServersStore } from '../../store/serversStore';
import { useStore } from '../../store/useStore';

const POLLING_INTERVAL_MS = 10_000; // 10 seconds

/**
 * Hook that polls the active server's health endpoint every 10 seconds.
 * Automatically updates server status to 'disconnected' on failure,
 * and restores to 'authenticated' on recovery.
 * Shows toast notifications on connection state changes.
 */
export function useHealthPolling() {
    const activeServer = useServersStore((s) => s.getActiveServer());
    const setServerStatus = useServersStore((s) => s.setServerStatus);

    // Track previous status to detect transitions
    const prevStatusRef = useRef<string | null>(null);
    const isPollingRef = useRef(false);
    // Track active server ID to prevent stale closure issues
    const activeServerIdRef = useRef<string | null>(null);

    // Update ref when active server changes
    useEffect(() => {
        activeServerIdRef.current = activeServer?.config.id ?? null;
    }, [activeServer?.config.id]);

    const checkHealth = useCallback(async () => {
        // Get fresh server state from store to avoid stale closure
        const currentServer = useServersStore.getState().getActiveServer();

        if (!currentServer || isPollingRef.current) return;

        // Verify we're still on the same server (prevent stale callback execution)
        if (currentServer.config.id !== activeServerIdRef.current) {
            console.log('[health] Aborting stale health check');
            return;
        }
        
        // Only poll if currently authenticated or disconnected (recovery)
        // Skip during transient states: 'checking', 'stopping', 'stopped', 'added'
        const pollableStates = ['authenticated', 'disconnected'];
        if (!pollableStates.includes(currentServer.status)) {
            return;
        }

        isPollingRef.current = true;
        const serverIdAtStart = currentServer.config.id;

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

            const res = await fetch(`${currentServer.config.url}/health`, {
                signal: controller.signal,
            });
            clearTimeout(timeoutId);

            // Re-check: workspace may have switched during fetch
            const serverAfterFetch = useServersStore.getState().getActiveServer();
            if (serverAfterFetch?.config.id !== serverIdAtStart) {
                console.log('[health] Workspace switched during health check, ignoring result');
                return;
            }

            if (res.ok) {
                // Connection restored!
                if (currentServer.status === 'disconnected') {
                    console.log('[health] Connection restored to', currentServer.config.name);
                    setServerStatus(currentServer.config.id, 'authenticated');
                    useStore.getState().setSuccessMessage(
                        `Connected to ${currentServer.config.name}`
                    );
                }
            } else {
                throw new Error(`Health check returned ${res.status}`);
            }
        } catch (error) {
            // Re-check current state from store - workspace may have switched during fetch
            const serverAfterError = useServersStore.getState().getActiveServer();
            const stillSameServer = serverAfterError?.config.id === serverIdAtStart;
            const stillAuthenticated = serverAfterError?.status === 'authenticated';

            // Only report error if same server is still active and was authenticated
            if (stillSameServer && stillAuthenticated) {
                console.log('[health] Connection lost to', currentServer.config.name, error);
                setServerStatus(
                    currentServer.config.id,
                    'disconnected',
                    'Connection lost. Retrying...'
                );
                useStore.getState().setError(
                    `Connection lost to ${currentServer.config.name}`
                );
            }
            // Otherwise silently ignore - workspace was switched or stopped
        } finally {
            isPollingRef.current = false;
        }
    }, [setServerStatus]); // Removed activeServer from deps - using getState() instead
    
    useEffect(() => {
        // Track status transitions for debugging
        if (activeServer?.status !== prevStatusRef.current) {
            console.log('[health] Status changed:', prevStatusRef.current, '->', activeServer?.status);
            prevStatusRef.current = activeServer?.status ?? null;
        }
    }, [activeServer?.status]);
    
    useEffect(() => {
        // Only start polling if we have an active, authenticated server
        if (!activeServer || (activeServer.status !== 'authenticated' && activeServer.status !== 'disconnected')) {
            return;
        }
        
        // Initial check (with slight delay to avoid initial load race)
        const initialTimeout = setTimeout(checkHealth, 1000);
        
        // Set up interval
        const intervalId = setInterval(checkHealth, POLLING_INTERVAL_MS);
        
        return () => {
            clearTimeout(initialTimeout);
            clearInterval(intervalId);
        };
    }, [activeServer?.config.id, activeServer?.status, checkHealth]);
}
