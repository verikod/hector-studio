import { useState } from 'react';
import { Rocket, DownloadCloud, Terminal, FolderOpen, Variable, LayoutTemplate, Split, MessageSquare } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useServersStore } from '../store/serversStore';

import { ServerSelector } from './ServerSelector';
import { WorkspaceEnvModal } from './WorkspaceEnvModal';
import { cn, wait } from '../lib/utils';
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

export function UnifiedHeader({ onLoginRequest, onLogoutRequest, onEnableWorkspaces }: UnifiedHeaderProps) {
    const activeServer = useServersStore((s) => s.getActiveServer());
    const [showEnvModal, setShowEnvModal] = useState(false);

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

    const handleDeploy = async () => {
        if (!isStudioEnabled || !studioIsValidYaml || studioIsDeploying) return;

        setStudioIsDeploying(true);
        try {
            await api.saveConfig(studioYamlContent);
            // Don't show success yet - wait for reload verification
            // useStore.getState().setSuccessMessage('Configuration deployed successfully! Agents are reloading...');

            const reloadAgentsWithRetry = async (maxRetries = 5, initialDelayMs = 500) => {
                const { reloadAgents } = useStore.getState();

                for (let attempt = 0; attempt < maxRetries; attempt++) {
                    try {
                        // Exponential backoff
                        const delay = initialDelayMs * Math.pow(1.5, attempt);
                        await wait(delay);

                        await reloadAgents();

                        // Check freshness directly from store
                        const agents = useStore.getState().availableAgents;
                        if (agents.length > 0) {
                            console.log(`✅ Agents reloaded after deploy (attempt ${attempt + 1})`);
                            useStore.getState().setSuccessMessage('Configuration deployed and agents reloaded successfully!');
                            return;
                        }
                        console.log(`Agents list empty, retrying... (attempt ${attempt + 1})`);
                    } catch (e) {
                        console.warn(`Failed to reload agents (attempt ${attempt + 1}/${maxRetries}):`, e);
                    }
                }
                console.warn('Finished retries for agent reload - agents may still be initializing');
                useStore.getState().setError('Configuration saved, but agents failed to reload within timeout.');
            };

            await reloadAgentsWithRetry();
        } catch (error) {
            useStore.getState().setError(`Deploy error: ${(error as Error).message}`);
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

    return (
        <>
            <header className="flex-shrink-0 h-12 bg-black/60 border-b border-white/10 grid grid-cols-[1fr_auto_1fr] items-center px-4 backdrop-blur-md z-50 gap-4">
                {/* Left: Branding */}
                <div className="flex items-center gap-4 min-w-0">
                    {/* Logo */}
                    <div className="flex items-center gap-2 select-none flex-shrink-0">
                        <img src={hectorIcon} alt="Hector" className="w-5 h-5 object-contain" />
                        <span className="font-bold tracking-wide text-sm text-white hidden sm:inline">Hector Studio</span>
                        <span className="text-[10px] text-gray-500 font-mono hidden sm:inline">v0.1.5</span>
                    </div>
                </div>

                {/* Center: Screen Mode Tabs */}
                <div className="flex justify-center min-w-0">
                    {isStudioEnabled && (
                        <div className="flex items-center bg-white/5 rounded p-0.5 border border-white/10 flex-shrink-0">
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
