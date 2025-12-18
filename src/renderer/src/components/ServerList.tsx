import React, { useState, useEffect } from "react";
import { Trash2, LogIn, LogOut, FolderOpen, Globe } from "lucide-react";
import { cn } from "../lib/utils";
import { useServersStore } from "../store/serversStore";
import type { ServerConfig } from "../types";

// Helper to get basename from path
const getBasename = (path: string) => {
    // Basic implementation for path basename
    return path.split(/[\\/]/).pop() || path;
};

interface ServerListProps {
    onSelectCallback: (server: ServerConfig) => void;
    onLoginRequest: (server: ServerConfig) => void;
}

export const ServerList: React.FC<ServerListProps> = ({ onSelectCallback, onLoginRequest }) => {
    const addServerToStore = useServersStore(s => s.addServer);
    const [servers, setServers] = useState<ServerConfig[]>([]);
    const [activeServerId, setActiveServerId] = useState<string | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [serverType, setServerType] = useState<'workspace' | 'remote'>('workspace');
    const [newServerName, setNewServerName] = useState("My Workspace");
    const [newServerUrl, setNewServerUrl] = useState("http://localhost:8080");
    const [authStatus, setAuthStatus] = useState<Record<string, boolean>>({});

    useEffect(() => {
        loadServers();

        // Subscribe to server updates from main process
        const unsubServers = window.api.server.onServersUpdated((updatedList) => {
            setServers(updatedList);
            // Refresh auth status for new list
            updatedList.forEach(async (s: ServerConfig) => {
                const isAuth = await window.api.auth.isAuthenticated(s.url);
                setAuthStatus(prev => ({ ...prev, [s.id]: isAuth }));
            });
        });

        // Refresh auth status periodically
        const interval = setInterval(checkAuthStatus, 10000);

        return () => {
            unsubServers();
            clearInterval(interval);
        };
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
            list.forEach(async (s: ServerConfig) => {
                const isAuth = await window.api.auth.isAuthenticated(s.url);
                setAuthStatus(prev => ({ ...prev, [s.id]: isAuth }));
            });
        } catch (err) {
            console.error("Failed to load servers", err);
        }
    };

    const checkAuthStatus = async () => {
        servers.forEach(async (s) => {
            if (s.url) {
                const isAuth = await window.api.auth.isAuthenticated(s.url);
                setAuthStatus(prev => ({ ...prev, [s.id]: isAuth }));
            }
        });
    };

    const handleAddWorkspace = async () => {
        try {
            // Open folder picker via main process
            const path = await window.api.workspace.browse();
            if (!path) return; // User cancelled

            const name = getBasename(path);
            const workspace = await window.api.workspace.add(name, path);

            // Add to store immediately to prevent race condition with status updates
            addServerToStore(workspace);

            // Auto switch to new workspace
            await window.api.workspace.switch(workspace.id);
            setActiveServerId(workspace.id);
            // List update will come via event
            setShowAddModal(false);
        } catch (err) {
            console.error("Failed to add workspace", err);
        }
    };

    const handleAddRemoteServer = async () => {
        try {
            // 1. Discover auth info
            await window.api.server.discoverAuth(newServerUrl);

            // 2. Add to backend
            const newServer = await window.api.server.add(newServerName, newServerUrl);

            // Add to store immediately
            addServerToStore(newServer);

            // List update will come via event

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
            // List update will come via event
        }
    };

    const handleSelectServer = async (server: ServerConfig) => {
        if (server.id === activeServerId) return;

        setActiveServerId(server.id);

        // Unified switch logic handled by backend
        await window.api.server.setActive(server.id);

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
                <div className="flex gap-1">
                    <button
                        onClick={() => {
                            setServerType('workspace');
                            setShowAddModal(true);
                        }}
                        title="Add Workspace"
                        className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
                    >
                        <FolderOpen size={16} />
                    </button>
                    <button
                        onClick={() => {
                            setServerType('remote');
                            setNewServerName('Remote Server');
                            setShowAddModal(true);
                        }}
                        title="Add Remote Server"
                        className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
                    >
                        <Globe size={16} />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {/* Workspaces Section */}
                <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase">Workspaces</div>
                {servers.filter(s => s.isLocal).map(server => (
                    <ServerItem
                        key={server.id}
                        server={server}
                        isActive={activeServerId === server.id}
                        onSelect={handleSelectServer}
                        onRemove={handleRemoveServer}
                        authStatus={!!authStatus[server.id]}
                        onLogin={handleLoginClick}
                        onLogout={handleLogout}
                        icon={<FolderOpen size={18} />}
                        detail={getBasename(server.workspacePath || '')}
                    />
                ))}

                {/* Remote Servers Section */}
                {servers.some(s => !s.isLocal) && (
                    <>
                        <div className="mt-4 px-2 py-1 text-xs font-semibold text-gray-500 uppercase">Remote</div>
                        {servers.filter(s => !s.isLocal).map(server => (
                            <ServerItem
                                key={server.id}
                                server={server}
                                isActive={activeServerId === server.id}
                                onSelect={handleSelectServer}
                                onRemove={handleRemoveServer}
                                authStatus={!!authStatus[server.id]}
                                onLogin={handleLoginClick}
                                onLogout={handleLogout}
                                icon={<Globe size={18} />}
                                detail={server.url}
                            />
                        ))}
                    </>
                )}

                {servers.length === 0 && (
                    <div className="text-center p-4 text-gray-500 text-sm">
                        No workspaces found.
                        <br />
                        Click <FolderOpen size={14} className="inline mx-1" /> to open a folder.
                    </div>
                )}
            </div>

            {showAddModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-white/10 rounded-xl p-6 w-full max-w-md shadow-2xl">
                        <h3 className="text-xl font-bold mb-4">
                            {serverType === 'workspace' ? 'Open Workspace' : 'Add Remote Server'}
                        </h3>

                        {serverType === 'workspace' ? (
                            <div className="space-y-4">
                                <p className="text-gray-400 text-sm">
                                    Select a folder to use as a Hector workspace. This will start a local Hector server in that directory.
                                </p>
                                <div className="flex justify-end gap-2 mt-6">
                                    <button
                                        onClick={() => setShowAddModal(false)}
                                        className="px-4 py-2 text-gray-400 hover:text-white hover:bg-white/5 rounded transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleAddWorkspace}
                                        className="px-4 py-2 bg-hector-green text-white rounded hover:bg-[#0d9668] transition-colors shadow-lg shadow-hector-green/20 flex items-center gap-2"
                                    >
                                        <FolderOpen size={16} />
                                        Browse Folder...
                                    </button>
                                </div>
                            </div>
                        ) : (
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
                                        onClick={handleAddRemoteServer}
                                        className="px-4 py-2 bg-hector-green text-white rounded hover:bg-[#0d9668] transition-colors shadow-lg shadow-hector-green/20"
                                    >
                                        Connect
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// Subcomponent for list items
const ServerItem: React.FC<{
    server: ServerConfig;
    isActive: boolean;
    onSelect: (s: ServerConfig) => void;
    onRemove: (id: string, e: React.MouseEvent) => void;
    authStatus: boolean;
    onLogin: (s: ServerConfig, e: React.MouseEvent) => void;
    onLogout: (s: ServerConfig, e: React.MouseEvent) => void;
    icon: React.ReactNode;
    detail: string;
}> = ({ server, isActive, onSelect, onRemove, authStatus, onLogin, onLogout, icon, detail }) => (
    <div
        onClick={() => onSelect(server)}
        className={cn(
            "group relative flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all border",
            isActive
                ? "bg-hector-green/10 border-hector-green/50 text-white"
                : "bg-transparent border-transparent hover:bg-white/5 text-gray-400 hover:text-gray-200"
        )}
    >
        <div className={cn(
            "p-2 rounded-lg",
            isActive ? "bg-hector-green/20 text-hector-green" : "bg-white/5 text-gray-500"
        )}>
            {icon}
        </div>

        <div className="flex-1 min-w-0">
            <div className="font-medium truncate">{server.name}</div>
            <div className="text-xs text-gray-500 truncate">{detail}</div>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {authStatus ? (
                <button
                    onClick={(e) => onLogout(server, e)}
                    title="Logout"
                    className="p-1.5 hover:bg-red-500/20 hover:text-red-400 rounded transition-colors"
                >
                    <LogOut size={14} />
                </button>
            ) : (
                <button
                    onClick={(e) => onLogin(server, e)}
                    title="Login"
                    className={cn(
                        "p-1.5 rounded transition-colors",
                        isActive ? "text-yellow-400 hover:bg-yellow-400/20" : "hover:bg-white/10"
                    )}
                >
                    <LogIn size={14} />
                </button>
            )}

            <button
                onClick={(e) => onRemove(server.id, e)}
                className="p-1.5 hover:bg-red-500/20 hover:text-red-400 rounded transition-colors"
            >
                <Trash2 size={14} />
            </button>
        </div>

        {/* Auth Indicator Dot */}
        <div className="absolute top-2 right-2">
            {authStatus && (
                <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
            )}
        </div>
    </div>
);
