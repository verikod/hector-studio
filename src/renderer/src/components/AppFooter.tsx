import { Settings, LayoutTemplate, MessageSquare, Split } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useServersStore } from '../store/serversStore';
import { Button } from './ui/button';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "./ui/tooltip";

interface AppFooterProps {
    onOpenSettings: () => void;
}

export function AppFooter({ onOpenSettings }: AppFooterProps) {
    const activeServer = useServersStore((s) => s.getActiveServer());

    // Studio State
    const studioViewMode = useStore((s) => s.studioViewMode);
    const setStudioViewMode = useStore((s) => s.setStudioViewMode);
    const isServerStudioEnabled = useStore((s) => s.isServerStudioEnabled);

    // Check if we should show studio controls
    const isStudioEnabled = activeServer?.status === 'authenticated' && isServerStudioEnabled;

    return (
        <footer className="flex-shrink-0 h-10 bg-black/60 border-t border-white/10 flex items-center px-4 justify-between backdrop-blur-md">
            {/* Left: Version info */}
            <div className="flex items-center text-xs text-gray-600">
                <span>Hector Studio v0.1.5</span>
            </div>

            {/* Center: Screen Mode Switch */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                {isStudioEnabled && (
                    <Tabs value={studioViewMode} onValueChange={(v) => setStudioViewMode(v as any)} className="w-[280px]">
                        <TabsList className="grid w-full grid-cols-3 h-8 bg-black/40 border border-white/10 rounded-lg">
                            <TabsTrigger value="design" className="text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-gray-500">
                                <LayoutTemplate size={14} className="mr-1.5" />
                                Design
                            </TabsTrigger>
                            <TabsTrigger value="split" className="text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-gray-500">
                                <Split size={14} className="mr-1.5" />
                                Split
                            </TabsTrigger>
                            <TabsTrigger value="chat" className="text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-gray-500">
                                <MessageSquare size={14} className="mr-1.5" />
                                Chat
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                )}
            </div>

            {/* Right: Settings */}
            <div className="flex items-center">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-gray-500 hover:text-white hover:bg-white/10"
                                onClick={onOpenSettings}
                            >
                                <Settings size={16} />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Settings</TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>
        </footer>
    );
}
