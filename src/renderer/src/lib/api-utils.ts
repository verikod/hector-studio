import { useStore } from "../store/useStore";
import { useServersStore } from "../store/serversStore";

/**
 * Get the base URL for API requests.
 * Single source of truth: derives from active server in serversStore.
 * Falls back to useStore.endpointUrl for backward compatibility (will be removed).
 */
export function getBaseUrl(): string {
    // Primary source: active server from serversStore
    const activeServer = useServersStore.getState().getActiveServer();
    if (activeServer?.status === 'authenticated') {
        return activeServer.config.url.replace(/\/$/, ''); // Remove trailing slash
    }

    // Fallback: legacy endpointUrl from useStore (deprecated)
    const endpointUrl = useStore.getState().endpointUrl;
    if (endpointUrl) {
        return endpointUrl.replace(/\/$/, '');
    }

    // Default for Electron - hector server typically runs on 8080
    return "http://localhost:8080";
}

/**
 * Get auth token for current server (if available).
 * Centralized auth token retrieval - single source of truth.
 */
export async function getAuthToken(): Promise<string | null> {
    const activeServer = useServersStore.getState().getActiveServer();
    const baseUrl = getBaseUrl();
    
    // 1. Shared Secret (Default Secure Protocol)
    if (activeServer?.config?.secureToken) {
        return activeServer.config.secureToken;
    }
    
    // 2. OIDC / Auth0 Token (if configured)
    if ((window as any).api?.auth) {
        try {
            return await (window as any).api.auth.getToken(baseUrl);
        } catch (e) {
            console.warn('[api-utils] Failed to get auth token:', e);
            return null;
        }
    }
    return null;
}

/**
 * Get headers with auth token injected.
 * Use this when you need custom fetch logic but want auth headers.
 */
export async function getAuthHeaders(
    additionalHeaders?: Record<string, string>
): Promise<Record<string, string>> {
    const headers: Record<string, string> = { ...additionalHeaders };
    const token = await getAuthToken();
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
}

/**
 * Authenticated fetch wrapper.
 * Automatically injects auth headers and uses configured base URL.
 * 
 * @param path - Relative path (e.g., '/agents') or full URL
 * @param options - Standard fetch options
 * @returns Promise<Response>
 * 
 * @example
 * // Simple GET
 * const response = await apiFetch('/agents');
 * 
 * // POST with body
 * const response = await apiFetch('/api/config', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/yaml' },
 *   body: configContent
 * });
 */
export async function apiFetch(
    path: string,
    options: RequestInit = {}
): Promise<Response> {
    const baseUrl = getBaseUrl();
    const url = path.startsWith('http') ? path : `${baseUrl}${path}`;
    
    // Merge user-provided headers with auth headers
    const existingHeaders = options.headers as Record<string, string> | undefined;
    const headers = await getAuthHeaders(existingHeaders);
    
    return fetch(url, {
        ...options,
        headers
    });
}
