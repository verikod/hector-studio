import type { Agent, AgentCard } from '../types';
import { apiFetch } from '../lib/api-utils';

export const api = {
    // Fetch all agents from discovery endpoint (Hector extension)
    fetchAgents: async (): Promise<{ agents: Agent[] }> => {
        const response = await apiFetch('/agents');
        if (!response.ok) {
            throw new Error(`Failed to fetch agents: ${response.status} ${response.statusText}`);
        }
        return response.json();
    },

    fetchSchema: async () => {
        const response = await apiFetch('/api/schema');
        if (!response.ok) {
            throw new Error(`Failed to fetch schema: ${response.statusText}`);
        }
        return response.json();
    },

    // Fetch agent card (A2A spec: /.well-known/agent-card.json)
    // Note: Agent card fetch does NOT use auth - it's public per A2A spec
    async fetchAgentCard(agentUrl: string): Promise<AgentCard> {
        const cardUrl = agentUrl.endsWith('/')
            ? `${agentUrl}.well-known/agent-card.json`
            : `${agentUrl}/.well-known/agent-card.json`;

        const response = await fetch(cardUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch agent card: ${response.status} ${response.statusText}`);
        }
        return response.json();
    },

    // Fetch config (Studio Mode)
    fetchConfig: async (): Promise<string> => {
        const response = await apiFetch('/api/config');
        if (!response.ok) {
            if (response.status === 403) {
                 throw new Error('Access Denied: You do not have permission to view this configuration. (Role="admin" or "operator" required)');
            }
            throw new Error(`Failed to fetch config: ${response.status} ${response.statusText}`);
        }
        return response.text();
    },

    // Save config (Studio Mode)
    saveConfig: async (content: string): Promise<any> => {
        const response = await apiFetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/yaml' },
            body: content
        });

        const result = await response.json().catch(() => ({}));
        
        if (!response.ok) {
            // Prefer server-side error message if available
            const serverMessage = result.error || result.message;
            if (serverMessage) {
                throw new Error(serverMessage);
            }
            
             if (response.status === 403) {
                 throw new Error('Access Denied: You do not have permission to modify this configuration.');
            }
            throw new Error(`Failed to save: ${response.status}`);
        }
        return result;
    }
};
