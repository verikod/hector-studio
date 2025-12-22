import { useState } from 'react';
import { CreateWorkspaceModal } from './CreateWorkspaceModal';
import { WorkspaceEnvModal } from './WorkspaceEnvModal';
import { Plus, Server, LogIn, LogOut, Trash2, Check, ChevronDown, FolderOpen, Variable } from 'lucide-react';
import { useServersStore } from '../store/serversStore';
import { useLicenseStore } from '../store/licenseStore';
import { useStore } from '../store/useStore';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from './ui/dropdown-menu';
import type { ServerState } from '../types';

interface ServerSelectorProps {
    onLoginRequest: (serverId: string) => void;
    onLogoutRequest: (serverId: string) => void;
    onEnableWorkspaces: () => void;
    // Deprecated props - kept for backwards compatibility but now using stores
    workspacesEnabled?: boolean;
    isLicensed?: boolean;
}

export function ServerSelector({ onLoginRequest, onLogoutRequest, onEnableWorkspaces }: ServerSelectorProps) {
    const [showAddForm, setShowAddForm] = useState(false);
    const [showCreateWorkspaceModal, setShowCreateWorkspaceModal] = useState(false);
    const [showEnvModal, setShowEnvModal] = useState(false);
    const [envModalWorkspace, setEnvModalWorkspace] = useState<any>(null);
    const [newName, setNewName] = useState('');
    const [newUrl, setNewUrl] = useState('');
    const [isOpen, setIsOpen] = useState(false);

    // Use stores directly for immediate sync
    const workspacesEnabled = useServersStore((s) => s.workspacesEnabled);
    const isLicensed = useLicenseStore((s) => s.isLicensed);

    const servers = useServersStore((s) => s.servers);
    const activeServerId = useServersStore((s) => s.activeServerId);
    const selectServer = useServersStore((s) => s.selectServer);
    const removeServer = useServersStore((s) => s.removeServer);
    // Use getActiveServer() which filters out local workspaces when disabled
    const activeServer = useServersStore((s) => s.getActiveServer());
    // Filter out local workspaces when workspaces feature is disabled
    const serverList = Object.values(servers).filter(s =>
        workspacesEnabled || !s.config.isLocal
    );

    const handleAddServer = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!newName.trim() || !newUrl.trim()) return;

        try {
            const newServer = await (window as any).api.server.add(newName.trim(), newUrl.trim());
            // Sync the new server to the store
            if (newServer) {
                const { addServer, setServerStatus } = useServersStore.getState();
                addServer(newServer);

                // Auto-detect server status
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

    const handleAddWorkspace = async () => {
        setIsOpen(false);
        try {
            // First check if hector is installed
            const isInstalled = await (window as any).api.hector.isInstalled();

            if (!isInstalled) {
                // Prompt user to download hector
                const shouldDownload = confirm(
                    'Hector needs to be installed to use local workspaces.\n\nWould you like to download it now?'
                );

                if (!shouldDownload) return;

                // Download hector
                await (window as any).api.hector.download();
            }

            // Open creation modal
            setShowCreateWorkspaceModal(true);
        } catch (error) {
            console.error('Failed to initiate workspace creation:', error);
            useStore.getState().setError(`Failed to init workspace: ${error}`);
        }
    };

    const handleRemoveServer = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();

        // Prevent deleting the last workspace (protect default)
        const localWorkspaces = serverList.filter(s => s.config.isLocal);
        const isLocal = servers[id]?.config.isLocal;
        if (isLocal && localWorkspaces.length <= 1) {
            alert('Cannot delete the default workspace.\n\nTo remove all workspaces, go to Settings and disable the Workspaces feature.');
            return;
        }

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

        // Clear chat context when switching workspaces/servers
        useStore.getState().createSession();

        // Ensure server status is current
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
            case 'unreachable': return 'bg-red-500';
            default: return 'bg-blue-500'; // 'added' state - connecting
        }
    };

    return (
        <>
            <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="min-w-[200px] max-w-[400px] justify-between bg-black/40 border-white/10 hover:bg-white/5 hover:text-white text-gray-300">
                        <div className="flex items-center gap-2">
                            <Server size={14} />
                            <span className="truncate max-w-[280px]">
                                {activeServer?.config.name || 'Select Server'}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            {activeServer && (
                                <div className={cn(
                                    "w-2 h-2 rounded-full",
                                    getStatusColor(activeServer.status),
                                    (activeServer.status === 'disconnected' || activeServer.status === 'unreachable') && 'animate-pulse'
                                )} />
                            )}
                            <ChevronDown size={14} className="opacity-50" />
                        </div>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[320px] bg-gray-900 border-gray-800 text-gray-300">
                    <DropdownMenuLabel>Servers</DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-gray-800" />
                    <div className="max-h-[200px] overflow-y-auto">
                        {serverList.length === 0 ? (
                            <div className="p-2 text-sm text-center text-gray-500">No servers configured</div>
                        ) : (
                            serverList.map((server) => (
                                <DropdownMenuItem
                                    key={server.config.id}
                                    onSelect={() => handleSelectServer(server.config.id)}
                                    className={cn(
                                        "flex items-center justify-between cursor-pointer focus:bg-gray-800 focus:text-white",
                                        activeServerId === server.config.id && "bg-gray-800/50"
                                    )}
                                >
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <div className={cn(
                                            "w-2 h-2 rounded-full flex-shrink-0",
                                            getStatusColor(server.status),
                                            (server.status === 'disconnected' || server.status === 'unreachable') && 'animate-pulse'
                                        )} />
                                        <div className="flex flex-col min-w-0">
                                            <span className="font-medium truncate text-xs">{server.config.name}</span>
                                            <span className="text-[10px] text-gray-500 truncate">{server.config.url}</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1">
                                        {/* Selected indicator first */}
                                        {activeServerId === server.config.id && <Check size={14} className="text-green-500" />}
                                        {/* Remote servers: Login/Logout buttons */}
                                        {!server.config.isLocal && (
                                            <>
                                                {server.status === 'auth_required' && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 hover:bg-gray-700"
                                                        onClick={(e) => { e.stopPropagation(); onLoginRequest(server.config.id); }}
                                                    >
                                                        <LogIn size={12} />
                                                    </Button>
                                                )}
                                                {server.status === 'authenticated' && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 hover:bg-gray-700"
                                                        onClick={(e) => { e.stopPropagation(); onLogoutRequest(server.config.id); }}
                                                    >
                                                        <LogOut size={12} />
                                                    </Button>
                                                )}
                                            </>
                                        )}
                                        {/* Delete button always last (rightmost) for alignment */}
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 hover:bg-red-900/50 hover:text-red-400"
                                            onClick={(e) => handleRemoveServer(server.config.id, e)}
                                            title={server.config.isLocal ? "Delete Workspace" : "Remove Server"}
                                        >
                                            <Trash2 size={12} />
                                        </Button>
                                        {/* Env vars button for workspaces */}
                                        {server.config.isLocal && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 hover:bg-blue-500/20"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setEnvModalWorkspace(server.config);
                                                    setShowEnvModal(true);
                                                    setIsOpen(false);
                                                }}
                                                title="Environment Variables"
                                            >
                                                <Variable size={12} className="text-blue-400" />
                                            </Button>
                                        )}
                                    </div>
                                </DropdownMenuItem>
                            ))
                        )}
                    </div>
                    <DropdownMenuSeparator className="bg-gray-800" />
                    {showAddForm ? (
                        <div className="p-2 space-y-2">
                            <Input
                                placeholder="Server Name"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                className="h-7 text-xs bg-black/40 border-gray-700"
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => e.key === 'Tab' && e.stopPropagation()}
                            />
                            <Input
                                placeholder="URL"
                                value={newUrl}
                                onChange={(e) => setNewUrl(e.target.value)}
                                className="h-7 text-xs bg-black/40 border-gray-700"
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => e.key === 'Tab' && e.stopPropagation()}
                            />
                            <div className="flex gap-2">
                                <Button size="sm" variant="default" className="h-7 text-xs w-full bg-hector-green hover:bg-hector-green/80 text-white" onClick={handleAddServer}>
                                    Add
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 text-xs w-full hover:bg-gray-800" onClick={(e) => { e.stopPropagation(); setShowAddForm(false); }}>
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <>
                            {workspacesEnabled ? (
                                <DropdownMenuItem
                                    onSelect={() => isLicensed && handleAddWorkspace()}
                                    className={`cursor-pointer focus:bg-gray-800 focus:text-white ${!isLicensed ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    disabled={!isLicensed}
                                >
                                    <FolderOpen size={14} className="mr-2" />
                                    Add Workspace {!isLicensed && '(License required)'}
                                </DropdownMenuItem>
                            ) : (
                                <DropdownMenuItem
                                    onSelect={() => isLicensed && onEnableWorkspaces()}
                                    className={`cursor-pointer focus:bg-gray-800 focus:text-white ${!isLicensed ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    disabled={!isLicensed}
                                >
                                    <FolderOpen size={14} className="mr-2" />
                                    Enable Local Workspaces {!isLicensed && '(License required)'}
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setShowAddForm(true); }} className="cursor-pointer focus:bg-gray-800 focus:text-white">
                                <Plus size={14} className="mr-2" />
                                Add Remote Server
                            </DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
            <CreateWorkspaceModal
                open={showCreateWorkspaceModal}
                onOpenChange={setShowCreateWorkspaceModal}
            />
            <WorkspaceEnvModal
                isOpen={showEnvModal}
                onClose={() => { setShowEnvModal(false); setEnvModalWorkspace(null); }}
                workspace={envModalWorkspace}
            />
        </>
    );
}
