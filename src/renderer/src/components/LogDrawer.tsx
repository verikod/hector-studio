import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Trash2, Copy, Pause, Play, ChevronDown, ChevronUp, Terminal } from 'lucide-react';
import { cn } from '../lib/utils';

interface LogEntry {
    line: string;
    isError: boolean;
    timestamp: number;
}

interface LogDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

export function LogDrawer({ isOpen, onClose }: LogDrawerProps) {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [isPaused, setIsPaused] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const logsEndRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Fetch initial logs
    useEffect(() => {
        if (isOpen) {
            window.api.hector.getLogs().then((initialLogs: LogEntry[]) => {
                setLogs(initialLogs);
            });
        }
    }, [isOpen]);

    // Subscribe to real-time logs
    useEffect(() => {
        if (!isOpen) return;

        const unsubscribe = window.api.hector.onLog((entry: LogEntry) => {
            setLogs(prev => {
                const newLogs = [...prev, entry];
                // Keep only last 500 entries in UI
                if (newLogs.length > 500) {
                    return newLogs.slice(-500);
                }
                return newLogs;
            });
        });

        return () => {
            unsubscribe();
        };
    }, [isOpen]);

    // Auto-scroll to bottom
    useEffect(() => {
        if (!isPaused && logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, isPaused]);

    const handleClear = useCallback(async () => {
        await window.api.hector.clearLogs();
        setLogs([]);
    }, []);

    const handleCopy = useCallback(() => {
        const text = logs.map(l => `[${new Date(l.timestamp).toLocaleTimeString()}] ${l.line}`).join('\n');
        navigator.clipboard.writeText(text);
    }, [logs]);

    const formatTime = (timestamp: number) => {
        return new Date(timestamp).toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    if (!isOpen) return null;

    return (
        <div
            className={cn(
                "fixed bottom-0 left-0 right-0 bg-black/95 border-t border-white/20 z-40 transition-all duration-200",
                isMinimized ? "h-10" : "h-64"
            )}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 h-10 bg-black/60 border-b border-white/10">
                <div className="flex items-center gap-2">
                    <Terminal size={14} className="text-hector-green" />
                    <span className="text-sm font-medium text-gray-300">Hector Process Logs</span>
                    <span className="text-xs text-gray-500">({logs.length} entries)</span>
                </div>

                <div className="flex items-center gap-1">
                    {/* Pause/Resume */}
                    <button
                        onClick={() => setIsPaused(!isPaused)}
                        className={cn(
                            "p-1.5 rounded transition-colors",
                            isPaused ? "bg-yellow-500/20 text-yellow-400" : "hover:bg-white/10 text-gray-400 hover:text-white"
                        )}
                        title={isPaused ? "Resume auto-scroll" : "Pause auto-scroll"}
                    >
                        {isPaused ? <Play size={14} /> : <Pause size={14} />}
                    </button>

                    {/* Copy */}
                    <button
                        onClick={handleCopy}
                        className="p-1.5 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
                        title="Copy all logs"
                    >
                        <Copy size={14} />
                    </button>

                    {/* Clear */}
                    <button
                        onClick={handleClear}
                        className="p-1.5 hover:bg-red-500/20 rounded text-gray-400 hover:text-red-400 transition-colors"
                        title="Clear logs"
                    >
                        <Trash2 size={14} />
                    </button>

                    {/* Minimize/Expand */}
                    <button
                        onClick={() => setIsMinimized(!isMinimized)}
                        className="p-1.5 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
                        title={isMinimized ? "Expand" : "Minimize"}
                    >
                        {isMinimized ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>

                    {/* Close */}
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
                        title="Close"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* Log Content */}
            {!isMinimized && (
                <div
                    ref={containerRef}
                    className="h-[calc(100%-2.5rem)] overflow-y-auto font-mono text-xs p-2 space-y-0.5"
                >
                    {logs.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-gray-500">
                            No logs yet. Start a workspace to see output here.
                        </div>
                    ) : (
                        logs.map((log, i) => (
                            <div
                                key={i}
                                className="flex gap-2 px-2 py-0.5 rounded hover:bg-white/5"
                            >
                                <span className="text-gray-500 flex-shrink-0">
                                    {formatTime(log.timestamp)}
                                </span>
                                <span className="text-gray-300">
                                    {log.line}
                                </span>
                            </div>
                        ))
                    )}
                    <div ref={logsEndRef} />
                </div>
            )}
        </div>
    );
}

// Button to toggle the log drawer
interface LogDrawerButtonProps {
    onClick: () => void;
    isOpen: boolean;
}

export function LogDrawerButton({ onClick, isOpen }: LogDrawerButtonProps) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "p-1.5 rounded transition-colors",
                isOpen
                    ? "bg-hector-green/20 text-hector-green"
                    : "hover:bg-white/10 text-gray-400 hover:text-white"
            )}
            title="Show Process Logs"
        >
            <Terminal size={16} />
        </button>
    );
}
