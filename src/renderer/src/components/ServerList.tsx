import React, { useState, useEffect } from "react";
import { Plus, Server as ServerIcon, Trash2, LogIn, LogOut } from "lucide-react";
import { cn } from "../lib/utils";
import type { ServerConfig } from "../types";

interface ServerListProps {
    onSelectCallback: (server: ServerConfig) => void;
    onLoginRequest: (server: ServerConfig) => void;
}

export const ServerList: React.FC<ServerListProps> = ({ onSelectCallback, onLoginRequest }) => {
    const [servers, setServers] = useState<ServerConfig[]>([]);
    const [activeServerId, setActiveServerId] = useState<string | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newServerName, setNewServerName] = useState("Local Server");
    const [newServerUrl, setNewServerUrl] = useState("http://localhost:8080");
    const [authStatus, setAuthStatus] = useState<Record<string, boolean>>({});

    useEffect(() => {
        loadServers();
        const interval = setInterval(checkAuthStatus, 10000); // Check every 10s
        return () => clearInterval(interval);
    }, []);

    const loadServers = async () => {
        try {
            const list = await window.api.server.list();
            setServers(list);
            const active = await window.api.server.getActive();
            if (active) {
                setActiveServerId(active.id);
                onSelectCallback(active);
            }
            // Check auth for all
            list.forEach(async (s) => {
                const isAuth = await window.api.auth.isAuthenticated(s.url);
                setAuthStatus(prev => ({ ...prev, [s.id]: isAuth }));
            });
        } catch (err) {
            console.error("Failed to load servers", err);
        }
    };

    const checkAuthStatus = async () => {
        servers.forEach(async (s) => {
            const isAuth = await window.api.auth.isAuthenticated(s.url);
            setAuthStatus(prev => ({ ...prev, [s.id]: isAuth }));
        });
    };

    const handleAddServer = async () => {
        try {
            // 1. Discover auth info
            await window.api.server.discoverAuth(newServerUrl);

            // 2. Add to backend (manager updates store including auth info if discovered)
            // Note: We need to update the server manager to store this auth info.
            // For now, let's assume the backend 'add' handles basic info, 
            // but ideally we pass the discovered auth info or the backend does discovery on add.
            // Based on our implementation, backend 'add' only takes name and url. 
            // We should probably rely on backend discovery logic if we want persistence.
            // Let's stick to the current API: add(name, url).

            const newServer = await window.api.server.add(newServerName, newServerUrl);
            setServers([...servers, newServer]);
            setShowAddModal(false);
            handleSelectServer(newServer);
        } catch (err) {
            console.error("Failed to add server", err);
            alert("Failed to connect to server. Check URL.");
        }
    };

    const handleRemoveServer = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm("Are you sure you want to remove this server?")) {
            await window.api.server.remove(id);
            loadServers();
        }
    };

    const handleSelectServer = async (server: ServerConfig) => {
        await window.api.server.setActive(server.id);
        setActiveServerId(server.id);
        onSelectCallback(server);
    };

    const handleLogout = async (server: ServerConfig, e: React.MouseEvent) => {
        e.stopPropagation();
        await window.api.auth.logout(server.url);
        checkAuthStatus();
    };

    const handleLoginClick = (server: ServerConfig, e: React.MouseEvent) => {
        e.stopPropagation();
        onLoginRequest(server);
    };

    return (
        <div className="flex flex-col h-full bg-black/40 border-r border-white/10 w-64">
            <div className="p-4 border-b border-white/10 flex justify-between items-center">
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Servers</h2>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
                >
                    <Plus size={16} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {servers.map(server => (
                    <div
                        key={server.id}
                        onClick={() => handleSelectServer(server)}
                        className={cn(
                            "group relative flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all border",
                            activeServerId === server.id
                                ? "bg-hector-green/10 border-hector-green/50 text-white"
                                : "bg-transparent border-transparent hover:bg-white/5 text-gray-400 hover:text-gray-200"
                        )}
                    >
                        <div className={cn(
                            "p-2 rounded-lg",
                            activeServerId === server.id ? "bg-hector-green/20 text-hector-green" : "bg-white/5 text-gray-500"
                        )}>
                            <ServerIcon size={18} />
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{server.name}</div>
                            <div className="text-xs text-gray-500 truncate">{server.url}</div>
                        </div>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {/* Login/Logout Actions */}
                            {authStatus[server.id] ? (
                                <button
                                    onClick={(e) => handleLogout(server, e)}
                                    title="Logout"
                                    className="p-1.5 hover:bg-red-500/20 hover:text-red-400 rounded transition-colors"
                                >
                                    <LogOut size={14} />
                                </button>
                            ) : (
                                <button
                                    onClick={(e) => handleLoginClick(server, e)}
                                    title="Login"
                                    className={cn(
                                        "p-1.5 rounded transition-colors",
                                        // If active but not auth, highlight login need
                                        activeServerId === server.id ? "text-yellow-400 hover:bg-yellow-400/20" : "hover:bg-white/10"
                                    )}
                                >
                                    <LogIn size={14} />
                                </button>
                            )}

                            <button
                                onClick={(e) => handleRemoveServer(server.id, e)}
                                className="p-1.5 hover:bg-red-500/20 hover:text-red-400 rounded transition-colors"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>

                        {/* Auth Indicator Dot */}
                        <div className="absolute top-2 right-2">
                            {authStatus[server.id] && (
                                <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                            )}
                        </div>
                    </div>
                ))}

                {servers.length === 0 && (
                    <div className="text-center p-4 text-gray-500 text-sm">
                        No servers connected.
                        <br />
                        Click + to add one.
                    </div>
                )}
            </div>

            {showAddModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-white/10 rounded-xl p-6 w-full max-w-md shadow-2xl">
                        <h3 className="text-xl font-bold mb-4">Connect to Server</h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Server Name</label>
                                <input
                                    type="text"
                                    value={newServerName}
                                    onChange={e => setNewServerName(e.target.value)}
                                    className="w-full bg-black/50 border border-white/10 rounded p-2 focus:border-hector-green focus:outline-none transition-colors"
                                    placeholder="e.g. Production"
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Server URL</label>
                                <input
                                    type="text"
                                    value={newServerUrl}
                                    onChange={e => setNewServerUrl(e.target.value)}
                                    className="w-full bg-black/50 border border-white/10 rounded p-2 focus:border-hector-green focus:outline-none transition-colors"
                                    placeholder="http://localhost:8080"
                                />
                            </div>

                            <div className="flex justify-end gap-2 mt-6">
                                <button
                                    onClick={() => setShowAddModal(false)}
                                    className="px-4 py-2 text-gray-400 hover:text-white hover:bg-white/5 rounded transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddServer}
                                    className="px-4 py-2 bg-hector-green text-white rounded hover:bg-[#0d9668] transition-colors shadow-lg shadow-hector-green/20"
                                >
                                    Connect
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
