import { useStore } from "../store/useStore";

/**
 * Get the base URL for API requests.
 * In Electron, this uses the configured endpoint URL (defaults to localhost:8080).
 * Falls back to window.location.origin for web deployments.
 */
export function getBaseUrl(): string {
    // Get from store (this works because zustand supports getState outside React)
    const endpointUrl = useStore.getState().endpointUrl;
    if (endpointUrl) {
        return endpointUrl.replace(/\/$/, ''); // Remove trailing slash
    }
    // Default for Electron - hector server typically runs on 8080
    return "http://localhost:8080";
}

/**
 * Get auth token for current server (if available).
 * Centralized auth token retrieval - single source of truth.
 */
export async function getAuthToken(): Promise<string | null> {
    const baseUrl = getBaseUrl();
    
    // Check if we're in Electron context with auth API
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
