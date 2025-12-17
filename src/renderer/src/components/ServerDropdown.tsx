import { useState } from 'react';
import { ChevronDown, Plus, Server, LogIn, LogOut, Trash2, Check } from 'lucide-react';
import { useServersStore } from '../store/serversStore';
import { clsx } from 'clsx';
import type { ServerState } from '../types';

interface ServerDropdownProps {
    onLoginRequest: (serverId: string) => void;
    onLogoutRequest: (serverId: string) => void;
}

export function ServerDropdown({ onLoginRequest, onLogoutRequest }: ServerDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newName, setNewName] = useState('');
    const [newUrl, setNewUrl] = useState('');

    const servers = useServersStore((s) => s.servers);
    const activeServerId = useServersStore((s) => s.activeServerId);
    const selectServer = useServersStore((s) => s.selectServer);
    const removeServer = useServersStore((s) => s.removeServer);

    const activeServer = activeServerId ? servers[activeServerId] : null;
    const serverList = Object.values(servers);

    const handleAddServer = async () => {
        if (!newName.trim() || !newUrl.trim()) return;

        try {
            const newServer = await (window as any).api.server.add(newName.trim(), newUrl.trim());
            // Sync the new server to the store
            if (newServer) {
                const { addServer, setServerStatus } = useServersStore.getState();
                addServer(newServer);

                // Auto-detect server status (auth required or not)
                try {
                    const authConfig = await (window as any).api.server.discoverAuth(newServer.url);
                    if (authConfig?.enabled) {
                        const isAuth = await (window as any).api.auth.isAuthenticated(newServer.url);
                        setServerStatus(newServer.id, isAuth ? 'authenticated' : 'auth_required');
                    } else {
                        setServerStatus(newServer.id, 'authenticated');
                    }
                } catch (probeError) {
                    console.warn('Failed to probe server:', probeError);
                    setServerStatus(newServer.id, 'unreachable', String(probeError));
                }
            }
            setNewName('');
            setNewUrl('');
            setShowAddForm(false);
        } catch (error) {
            console.error('Failed to add server:', error);
        }
    };

    const handleRemoveServer = async (id: string) => {
        try {
            await (window as any).api.server.remove(id);
            removeServer(id);
        } catch (error) {
            console.error('Failed to remove server:', error);
        }
    };

    const handleSelectServer = async (id: string) => {
        selectServer(id);
        await (window as any).api.server.setActive(id);
        setIsOpen(false);

        // Ensure server status is current (probe if in 'added' or unknown state)
        const server = useServersStore.getState().servers[id];
        if (server && (server.status === 'added' || !server.status)) {
            const { setServerStatus } = useServersStore.getState();
            try {
                const authConfig = await (window as any).api.server.discoverAuth(server.config.url);
                if (authConfig?.enabled) {
                    const isAuth = await (window as any).api.auth.isAuthenticated(server.config.url);
                    setServerStatus(id, isAuth ? 'authenticated' : 'auth_required');
                } else {
                    setServerStatus(id, 'authenticated');
                }
            } catch (probeError) {
                console.warn('Failed to probe server on select:', probeError);
                setServerStatus(id, 'unreachable', String(probeError));
            }
        }
    };

    const getStatusColor = (status: ServerState['status']) => {
        switch (status) {
            case 'authenticated': return 'bg-green-500';
            case 'auth_required': return 'bg-yellow-500';
            case 'disconnected': return 'bg-red-500';
            case 'unreachable': return 'bg-gray-500';
            default: return 'bg-blue-500';
        }
    };

    return (
        <div className="relative">
            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={clsx(
                    'flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors',
                    'bg-gray-800 hover:bg-gray-700 border border-gray-700',
                    'text-sm font-medium'
                )}
            >
                <Server size={16} />
                <span className="max-w-[150px] truncate">
                    {activeServer?.config.name || 'No Server'}
                </span>
                {activeServer && (
                    <span className={clsx('w-2 h-2 rounded-full', getStatusColor(activeServer.status))} />
                )}
                <ChevronDown size={14} className={clsx('transition-transform', isOpen && 'rotate-180')} />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Menu */}
                    <div className="absolute top-full left-0 mt-1 w-72 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
                        {/* Server List */}
                        <div className="max-h-64 overflow-y-auto">
                            {serverList.length === 0 ? (
                                <div className="px-4 py-3 text-gray-500 text-sm text-center">
                                    No servers configured
                                </div>
                            ) : (
                                serverList.map((server) => (
                                    <div
                                        key={server.config.id}
                                        className={clsx(
                                            'flex items-center gap-2 px-3 py-2 hover:bg-gray-800 cursor-pointer group',
                                            activeServerId === server.config.id && 'bg-gray-800'
                                        )}
                                        onClick={() => handleSelectServer(server.config.id)}
                                    >
                                        <span className={clsx('w-2 h-2 rounded-full flex-shrink-0', getStatusColor(server.status))} />
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium truncate">{server.config.name}</div>
                                            <div className="text-xs text-gray-500 truncate">{server.config.url}</div>
                                        </div>
                                        {activeServerId === server.config.id && (
                                            <Check size={14} className="text-green-500 flex-shrink-0" />
                                        )}

                                        {/* Actions */}
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {server.status === 'auth_required' && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onLoginRequest(server.config.id); }}
                                                    className="p-1 hover:bg-gray-700 rounded"
                                                    title="Login"
                                                >
                                                    <LogIn size={14} />
                                                </button>
                                            )}
                                            {server.status === 'authenticated' && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onLogoutRequest(server.config.id); }}
                                                    className="p-1 hover:bg-gray-700 rounded"
                                                    title="Logout"
                                                >
                                                    <LogOut size={14} />
                                                </button>
                                            )}
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleRemoveServer(server.config.id); }}
                                                className="p-1 hover:bg-red-600 rounded"
                                                title="Remove"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Add Server Form */}
                        {showAddForm ? (
                            <div className="border-t border-gray-700 p-3 space-y-2">
                                <input
                                    type="text"
                                    placeholder="Server name"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    className="w-full px-2 py-1.5 bg-gray-800 border border-gray-600 rounded text-sm"
                                    autoFocus
                                />
                                <input
                                    type="text"
                                    placeholder="http://localhost:8080"
                                    value={newUrl}
                                    onChange={(e) => setNewUrl(e.target.value)}
                                    className="w-full px-2 py-1.5 bg-gray-800 border border-gray-600 rounded text-sm"
                                />
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleAddServer}
                                        className="flex-1 px-3 py-1.5 bg-hector-red hover:bg-hector-red/80 active:bg-hector-red/70 focus:outline-none focus:ring-2 focus:ring-hector-red/50 rounded text-sm font-medium transition-colors"
                                    >
                                        Add
                                    </button>
                                    <button
                                        onClick={() => setShowAddForm(false)}
                                        className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 active:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500/50 rounded text-sm transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={() => setShowAddForm(true)}
                                className="w-full flex items-center gap-2 px-3 py-2 border-t border-gray-700 hover:bg-gray-800 text-sm"
                            >
                                <Plus size={14} />
                                Add Server
                            </button>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
