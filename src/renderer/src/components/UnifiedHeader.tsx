import { useState, useEffect } from 'react';
import { Rocket, DownloadCloud, Terminal, FolderOpen, Variable, LayoutTemplate, Split, MessageSquare, Globe, Loader2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useServersStore } from '../store/serversStore';

import { ServerSelector } from './ServerSelector';
import { WorkspaceEnvModal } from './WorkspaceEnvModal';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "./ui/tooltip";
import { api } from '../services/api';

import hectorIcon from '../assets/hector.png';

interface UnifiedHeaderProps {
    onLoginRequest: (serverId: string) => void;
    onLogoutRequest: (serverId: string) => void;
    onEnableWorkspaces: () => void;
}

interface TunnelState {
    workspaceId: string;
    publicUrl: string | null;
    status: 'stopped' | 'starting' | 'running' | 'error';
    error?: string;
}

export function UnifiedHeader({ onLoginRequest, onLogoutRequest, onEnableWorkspaces }: UnifiedHeaderProps) {
    const activeServer = useServersStore((s) => s.getActiveServer());
    const [showEnvModal, setShowEnvModal] = useState(false);
    const [tunnelState, setTunnelState] = useState<TunnelState | null>(null);
    const [copied, setCopied] = useState(false);

    // Studio State
    const studioViewMode = useStore((s) => s.studioViewMode);
    const setStudioViewMode = useStore((s) => s.setStudioViewMode);
    const studioIsValidYaml = useStore((s) => s.studioIsValidYaml);
    const studioYamlContent = useStore((s) => s.studioYamlContent);
    const studioIsDeploying = useStore((s) => s.studioIsDeploying);
    const setStudioIsDeploying = useStore((s) => s.setStudioIsDeploying);
    const isServerStudioEnabled = useStore((s) => s.isServerStudioEnabled);

    // Check if we should show studio controls
    const isStudioEnabled = activeServer?.status === 'authenticated' && isServerStudioEnabled;

    // Subscribe to tunnel status changes
    useEffect(() => {
        const unsubscribe = (window as any).api.tunnel.onStatusChange((state: TunnelState) => {
            if (activeServer?.config.id === state.workspaceId) {
                setTunnelState(state);
            }
        });
        return () => unsubscribe();
    }, [activeServer?.config.id]);

    // Fetch initial tunnel state when workspace changes
    useEffect(() => {
        if (activeServer?.config.isLocal && activeServer?.config.id) {
            (window as any).api.tunnel.status(activeServer.config.id).then((state: TunnelState | null) => {
                setTunnelState(state);
            });
        } else {
            setTunnelState(null);
        }
    }, [activeServer?.config.id, activeServer?.config.isLocal]);

    const handleStartTunnel = async () => {
        if (!activeServer?.config.id) return;
        try {
            await (window as any).api.tunnel.start(activeServer.config.id);
        } catch (error) {
            useStore.getState().setError(`Failed to start tunnel: ${(error as Error).message}`);
        }
    };

    const handleStopTunnel = async () => {
        if (!activeServer?.config.id) return;
        try {
            await (window as any).api.tunnel.stop(activeServer.config.id);
        } catch (error) {
            useStore.getState().setError(`Failed to stop tunnel: ${(error as Error).message}`);
        }
    };

    const handleCopyUrl = () => {
        if (tunnelState?.publicUrl) {
            navigator.clipboard.writeText(tunnelState.publicUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleDeploy = async () => {
        if (!isStudioEnabled || !studioIsValidYaml || studioIsDeploying) return;

        setStudioIsDeploying(true);
        try {
            // API now returns synchronous success/failure after reload
            const result = await api.saveConfig(studioYamlContent);

            // Reload agents to refresh UI after successful deploy
            await useStore.getState().reloadAgents();

            useStore.getState().setSuccessMessage(
                result.message || 'Configuration deployed and applied successfully!'
            );
        } catch (error) {
            useStore.getState().setError(`Deploy failed: ${(error as Error).message}`);
        } finally {
            setStudioIsDeploying(false);
        }
    };

    const handleDownload = () => {
        if (!studioYamlContent) return;
        const blob = new Blob([studioYamlContent], { type: 'text/yaml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'config.yaml';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const isTunnelRunning = tunnelState?.status === 'running';
    const isTunnelStarting = tunnelState?.status === 'starting';

    return (
        <>
            <header className="flex-shrink-0 h-12 bg-black/60 border-b border-white/10 flex items-center px-4 backdrop-blur-md z-50 gap-4">
                {/* Left: Branding */}
                <div className="flex items-center gap-4 flex-shrink-0">
                    {/* Logo */}
                    <div className="flex items-center gap-2 select-none">
                        <img src={hectorIcon} alt="Hector" className="w-5 h-5 object-contain" />
                        <span className="font-bold tracking-wide text-sm text-white hidden sm:inline">Hector Studio</span>
                        <span className="text-[10px] text-gray-500 font-mono hidden sm:inline">v{__APP_VERSION__}</span>
                    </div>
                </div>

                {/* Center: Screen Mode Tabs (Responsive Flex) */}
                <div className="flex-1 flex justify-center min-w-0">
                    {isStudioEnabled && (
                        <div className="flex items-center bg-white/5 rounded p-0.5 border border-white/10 flex-shrink-0 mx-auto">
                            <button
                                onClick={() => setStudioViewMode('design')}
                                className={cn(
                                    "flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-all",
                                    studioViewMode === 'design' ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"
                                )}
                            >
                                <LayoutTemplate size={12} />
                                <span className="hidden md:inline">Design</span>
                            </button>
                            <button
                                onClick={() => setStudioViewMode('split')}
                                className={cn(
                                    "flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-all",
                                    studioViewMode === 'split' ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"
                                )}
                            >
                                <Split size={12} />
                                <span className="hidden md:inline">Split</span>
                            </button>
                            <button
                                onClick={() => setStudioViewMode('chat')}
                                className={cn(
                                    "flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-all",
                                    studioViewMode === 'chat' ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"
                                )}
                            >
                                <MessageSquare size={12} />
                                <span className="hidden md:inline">Chat</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Right: Workspace Selection + Actions + Deploy */}
                <div className="flex items-center gap-3 justify-end min-w-0">
                    {/* Server/Workspace Selector */}
                    <div className="flex-shrink min-w-0">
                        <ServerSelector
                            onLoginRequest={onLoginRequest}
                            onLogoutRequest={onLogoutRequest}
                            onEnableWorkspaces={onEnableWorkspaces}
                        />
                    </div>

                    {/* Workspace-only quick actions */}
                    {activeServer?.config.isLocal && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-gray-400 hover:text-white hover:bg-white/10"
                                            onClick={() => window.dispatchEvent(new CustomEvent('open-log-drawer'))}
                                        >
                                            <Terminal size={14} />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Show Logs</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-gray-400 hover:text-white hover:bg-white/10"
                                            onClick={() => {
                                                if (activeServer.config.workspacePath) {
                                                    (window as any).api.workspace.openFolder(activeServer.config.workspacePath);
                                                }
                                            }}
                                        >
                                            <FolderOpen size={14} />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Open Folder</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                                            onClick={() => setShowEnvModal(true)}
                                        >
                                            <Variable size={14} />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Environment Variables</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    )}

                    {/* Deploy Actions */}
                    {isStudioEnabled && (
                        <>
                            <div className="h-5 w-px bg-white/10 flex-shrink-0" />
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-gray-400 hover:text-white flex-shrink-0"
                                            onClick={handleDownload}
                                            disabled={!studioYamlContent}
                                        >
                                            <DownloadCloud size={16} />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Download Config</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>

                            <Button
                                variant="default"
                                size="sm"
                                onClick={handleDeploy}
                                disabled={!studioIsValidYaml || studioIsDeploying}
                                className={cn(
                                    "h-8 gap-1.5 font-medium transition-all text-xs flex-shrink-0",
                                    !studioIsValidYaml ? "bg-red-500/20 text-red-400 hover:bg-red-500/30" : "bg-hector-green hover:bg-hector-green/80 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                                )}
                            >
                                <Rocket size={14} className={cn(studioIsDeploying && "animate-pulse")} />
                                <span className="hidden sm:inline">{studioIsDeploying ? 'Deploying...' : 'Deploy'}</span>
                            </Button>
                        </>
                    )}

                    {/* Share Toggle Button - Push down/up style */}
                    {activeServer?.config.isLocal && activeServer?.status === 'authenticated' && (
                        <div className="flex items-center gap-1">
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            onClick={isTunnelRunning ? handleStopTunnel : handleStartTunnel}
                                            disabled={isTunnelStarting}
                                            className={cn(
                                                "flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium relative transition-all",
                                                isTunnelRunning
                                                    ? "bg-black/40 text-green-400 border border-green-500/50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.3),0_0_15px_rgba(34,197,94,0.3)]"
                                                    : isTunnelStarting
                                                        ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 cursor-wait"
                                                        : "bg-blue-500 hover:bg-blue-600 text-white shadow-[0_2px_4px_rgba(0,0,0,0.3),0_0_15px_rgba(59,130,246,0.3)] hover:shadow-[0_2px_6px_rgba(0,0,0,0.4),0_0_20px_rgba(59,130,246,0.4)] active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]"
                                            )}
                                        >
                                            {isTunnelStarting ? (
                                                <Loader2 size={14} className="animate-spin" />
                                            ) : (
                                                <Globe size={14} />
                                            )}
                                            <span className="hidden sm:inline">
                                                {isTunnelStarting
                                                    ? 'Starting...'
                                                    : isTunnelRunning && tunnelState?.publicUrl
                                                        ? (() => {
                                                            const subdomain = tunnelState.publicUrl.replace('https://', '').split('.')[0];
                                                            return subdomain.length > 8 ? `${subdomain.slice(0, 8)}...` : subdomain;
                                                        })()
                                                        : 'Share'
                                                }
                                            </span>
                                            {/* Pulsing dot when active */}
                                            {isTunnelRunning && (
                                                <>
                                                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-400 rounded-full animate-ping opacity-75" />
                                                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-400 rounded-full" />
                                                </>
                                            )}
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        {isTunnelStarting
                                            ? 'Starting tunnel...'
                                            : isTunnelRunning
                                                ? 'Click to stop sharing'
                                                : 'Share publicly via Cloudflare Tunnel'
                                        }
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>

                            {/* Copy button - only visible when active */}
                            {isTunnelRunning && tunnelState?.publicUrl && (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <button
                                                onClick={handleCopyUrl}
                                                className="h-8 w-8 flex items-center justify-center rounded-md text-green-400 hover:text-green-300 hover:bg-green-500/10 transition-colors"
                                            >
                                                {copied ? (
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                                ) : (
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>
                                                )}
                                            </button>
                                        </TooltipTrigger>
                                        <TooltipContent>{copied ? 'Copied!' : 'Copy URL'}</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            )}
                        </div>
                    )}
                </div>
            </header>

            {/* Workspace Env Modal */}
            <WorkspaceEnvModal
                isOpen={showEnvModal}
                onClose={() => setShowEnvModal(false)}
                workspace={activeServer?.config ?? null}
            />
        </>
    );
}

