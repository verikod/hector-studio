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
    
    const checkHealth = useCallback(async () => {
        if (!activeServer || isPollingRef.current) return;
        
        // Only poll if currently authenticated or disconnected (recovery)
        if (activeServer.status !== 'authenticated' && activeServer.status !== 'disconnected') {
            return;
        }
        
        isPollingRef.current = true;
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout
            
            const res = await fetch(`${activeServer.config.url}/health`, {
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            
            if (res.ok) {
                // Connection restored!
                if (activeServer.status === 'disconnected') {
                    console.log('[health] Connection restored to', activeServer.config.name);
                    setServerStatus(activeServer.config.id, 'authenticated');
                    useStore.getState().setSuccessMessage(
                        `Connected to ${activeServer.config.name}`
                    );
                }
            } else {
                throw new Error(`Health check returned ${res.status}`);
            }
        } catch (error) {
            // Connection lost
            // Check current status from store to ensure we haven't switched/stopped in the meantime
            const currentServer = useServersStore.getState().getActiveServer();
            const stillActive = currentServer?.config.id === activeServer.config.id;
            const stillAuthenticated = currentServer?.status === 'authenticated';

            if (stillActive && stillAuthenticated) {
                console.log('[health] Connection lost to', activeServer.config.name, error);
                setServerStatus(
                    activeServer.config.id,
                    'disconnected',
                    'Connection lost. Retrying...'
                );
                useStore.getState().setError(
                    `Connection lost to ${activeServer.config.name}`
                );
            }
        } finally {
            isPollingRef.current = false;
        }
    }, [activeServer, setServerStatus]);
    
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
