import { Rocket, Settings, DownloadCloud, LayoutTemplate, MessageSquare, Split } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useServersStore } from '../store/serversStore';
import { ServerSelector } from './ServerSelector';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
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
    onOpenSettings: () => void;
    workspacesEnabled: boolean;
    onEnableWorkspaces: () => void;
}

export function UnifiedHeader({ onLoginRequest, onLogoutRequest, onOpenSettings, workspacesEnabled, onEnableWorkspaces }: UnifiedHeaderProps) {
    const activeServer = useServersStore((s) => s.getActiveServer());

    // Studio State
    const studioViewMode = useStore((s) => s.studioViewMode);
    const setStudioViewMode = useStore((s) => s.setStudioViewMode);
    const studioIsValidYaml = useStore((s) => s.studioIsValidYaml);
    const studioYamlContent = useStore((s) => s.studioYamlContent);
    const studioIsDeploying = useStore((s) => s.studioIsDeploying);
    const setStudioIsDeploying = useStore((s) => s.setStudioIsDeploying);
    const isServerStudioEnabled = useStore((s) => s.isServerStudioEnabled);

    // Check if we should show studio controls
    // Requires: authenticated server AND server has studio mode enabled
    const isStudioEnabled = activeServer?.status === 'authenticated' && isServerStudioEnabled;

    const handleDeploy = async () => {
        if (!isStudioEnabled || !studioIsValidYaml || studioIsDeploying) return;

        setStudioIsDeploying(true);
        try {
            await api.saveConfig(studioYamlContent);
            useStore.getState().setSuccessMessage('Configuration deployed successfully! Agents are reloading...');

            // Poll for agents with retry logic
            const reloadAgentsWithRetry = async (maxRetries = 5, delayMs = 500) => {
                for (let attempt = 0; attempt < maxRetries; attempt++) {
                    try {
                        // Wait before attempting (exponential backoff)
                        await new Promise(resolve => setTimeout(resolve, delayMs * Math.pow(1.5, attempt)));

                        await useStore.getState().reloadAgents();
                        const agents = useStore.getState().availableAgents;

                        // If we got agents, we're good
                        if (agents.length > 0) {
                            console.log(`✅ Agents reloaded after deploy (attempt ${attempt + 1})`);
                            return;
                        }

                        // If no agents yet, throw to trigger retry (unless config actually has no agents)
                        // For now we just retry if empty, assuming most configs have agents
                        console.log(`Agents list empty, retrying... (attempt ${attempt + 1})`);
                    } catch (e) {
                        console.warn(`Failed to reload agents (attempt ${attempt + 1}/${maxRetries}):`, e);
                    }
                }
                // Final attempt
                console.warn('Finished retries for agent reload');
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
        <header className="flex-shrink-0 h-14 bg-black/60 border-b border-white/10 flex items-center px-4 justify-between backdrop-blur-md z-50">
            {/* Left Zone: Identity & Context */}
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 select-none">
                    <img src={hectorIcon} alt="Hector" className="w-6 h-6 object-contain" />
                    <span className="font-bold tracking-widest text-sm text-white">HECTOR</span>
                </div>
                <div className="h-6 w-px bg-white/10" />
                <ServerSelector
                    onLoginRequest={onLoginRequest}
                    onLogoutRequest={onLogoutRequest}
                    workspacesEnabled={workspacesEnabled}
                    onEnableWorkspaces={onEnableWorkspaces}
                />
            </div>

            {/* Center Zone: Workflow Mode */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                {isStudioEnabled && (
                    <div className="bg-black/40 p-1 rounded-lg border border-white/5">
                        <Tabs value={studioViewMode} onValueChange={(v) => setStudioViewMode(v as any)} className="w-[300px]">
                            <TabsList className="grid w-full grid-cols-3 h-8 bg-transparent">
                                <TabsTrigger value="design" className="text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-gray-400">
                                    <LayoutTemplate size={14} className="mr-2" />
                                    Design
                                </TabsTrigger>
                                <TabsTrigger value="split" className="text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-gray-400">
                                    <Split size={14} className="mr-2" />
                                    Split
                                </TabsTrigger>
                                <TabsTrigger value="chat" className="text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-gray-400">
                                    <MessageSquare size={14} className="mr-2" />
                                    Chat
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>
                )}
            </div>

            {/* Right Zone: Actions */}
            <div className="flex items-center gap-2">
                {isStudioEnabled && (
                    <>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-gray-400 hover:text-white"
                                        onClick={handleDownload}
                                        disabled={!studioYamlContent}
                                    >
                                        <DownloadCloud size={18} />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Download Config</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>

                        <div className="h-6 w-px bg-white/10 mx-1" />

                        <Button
                            variant="default"
                            size="sm"
                            onClick={handleDeploy}
                            disabled={!studioIsValidYaml || studioIsDeploying}
                            className={cn(
                                "h-8 gap-2 font-medium transition-all text-xs",
                                !studioIsValidYaml ? "bg-red-500/20 text-red-400 hover:bg-red-500/30" : "bg-hector-green hover:bg-hector-green/80 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                            )}
                        >
                            <Rocket size={14} className={cn(studioIsDeploying && "animate-pulse")} />
                            {studioIsDeploying ? 'Deploying...' : 'Deploy'}
                        </Button>
                    </>
                )}

                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-gray-400 hover:text-white ml-2"
                    onClick={onOpenSettings}
                >
                    <Settings size={18} />
                </Button>
            </div>
        </header>
    );
}
