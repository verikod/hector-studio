import React, { useState } from 'react';
import { Download, Loader2, FolderOpen, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { useWorkspaceControl } from '../lib/hooks/useWorkspaceControl';

type EnableStage = 'consent' | 'downloading' | 'creating' | 'starting' | 'complete' | 'error';

interface EnableWorkspacesModalProps {
    isOpen: boolean;
    onClose: () => void;
    onComplete: (workspaceId?: string) => void;
}

/**
 * Wizard modal for enabling local workspaces.
 * Shows consent → download progress → workspace creation → completion.
 */
export const EnableWorkspacesModal: React.FC<EnableWorkspacesModalProps> = ({
    isOpen,
    onClose,
    onComplete
}) => {
    const [stage, setStage] = useState<EnableStage>('consent');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    if (!isOpen) return null;

    const { enableAndSelect } = useWorkspaceControl();

    const handleEnable = async () => {
        try {
            // Check if hector is already installed
            const isInstalled = await window.api.hector.isInstalled();

            if (!isInstalled) {
                // Stage 1: Downloading
                setStage('downloading');
                await window.api.hector.download();
            }

            // Stage 2: Creating workspace
            setStage('creating');

            // Stage 3: Starting
            setStage('starting');

            // Use centralized logic
            const workspaceId = await enableAndSelect();

            // Give time for status change events to propagate
            await new Promise(resolve => setTimeout(resolve, 500));

            // Complete
            setStage('complete');

            // Auto-close after brief delay
            // Pass the workspaceId back to the parent
            setTimeout(() => {
                onComplete(workspaceId);
            }, 1000);

        } catch (error) {
            console.error('Enable workspaces failed:', error);
            setErrorMessage(String(error));
            setStage('error');
        }
    };

    const handleClose = () => {
        if (stage === 'consent' || stage === 'complete' || stage === 'error') {
            setStage('consent');
            setErrorMessage(null);
            onClose();
        }
        // Can't close during progress stages
    };

    const stageContent: Record<EnableStage, { icon: React.ReactNode; title: string; subtitle: string }> = {
        consent: {
            icon: <FolderOpen size={32} className="text-hector-green" />,
            title: 'Enable Local Workspaces',
            subtitle: 'This will download Hector (the AI agent runtime) and create a default workspace on your computer.'
        },
        downloading: {
            icon: <Loader2 size={32} className="text-blue-400 animate-spin" />,
            title: 'Downloading Hector...',
            subtitle: 'Please wait while we download the Hector runtime.'
        },
        creating: {
            icon: <Loader2 size={32} className="text-yellow-400 animate-spin" />,
            title: 'Creating Workspace...',
            subtitle: 'Setting up your default workspace.'
        },
        starting: {
            icon: <Loader2 size={32} className="text-green-400 animate-spin" />,
            title: 'Starting Workspace...',
            subtitle: 'Launching the Hector server.'
        },
        complete: {
            icon: <CheckCircle size={32} className="text-green-500" />,
            title: 'Workspaces Enabled!',
            subtitle: 'Your local workspace is ready to use.'
        },
        error: {
            icon: <XCircle size={32} className="text-red-500" />,
            title: 'Failed to Enable',
            subtitle: errorMessage || 'An error occurred. Please try again.'
        }
    };

    const content = stageContent[stage];
    const isWorking = ['downloading', 'creating', 'starting'].includes(stage);

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-white/10 rounded-xl p-8 w-full max-w-md shadow-2xl">
                {/* Icon */}
                <div className="flex justify-center mb-6">
                    <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
                        {content.icon}
                    </div>
                </div>

                {/* Text */}
                <div className="text-center mb-8">
                    <h2 className="text-xl font-semibold text-white mb-2">{content.title}</h2>
                    <p className="text-gray-400 text-sm">{content.subtitle}</p>
                </div>

                {/* Progress indicator for working stages */}
                {isWorking && (
                    <div className="mb-8">
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                            <span className={cn(stage === 'downloading' ? 'text-blue-400' : 'text-gray-600')}>
                                Download
                            </span>
                            <span className={cn(stage === 'creating' ? 'text-yellow-400' : 'text-gray-600')}>
                                Create
                            </span>
                            <span className={cn(stage === 'starting' ? 'text-green-400' : 'text-gray-600')}>
                                Start
                            </span>
                        </div>
                        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                            <div
                                className={cn(
                                    "h-full transition-all duration-500",
                                    stage === 'downloading' && "w-1/3 bg-blue-400",
                                    stage === 'creating' && "w-2/3 bg-yellow-400",
                                    stage === 'starting' && "w-full bg-green-400"
                                )}
                            />
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                    {stage === 'consent' && (
                        <>
                            <button
                                onClick={handleClose}
                                className="flex-1 px-4 py-3 rounded-lg font-medium transition-all bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleEnable}
                                className="flex-1 px-4 py-3 rounded-lg font-medium transition-all bg-hector-green hover:bg-hector-green/80 text-white flex items-center justify-center gap-2"
                            >
                                <Download size={18} />
                                Enable
                            </button>
                        </>
                    )}

                    {stage === 'complete' && (
                        <button
                            onClick={handleClose}
                            className="w-full px-4 py-3 rounded-lg font-medium transition-all bg-hector-green hover:bg-hector-green/80 text-white"
                        >
                            Get Started
                        </button>
                    )}

                    {stage === 'error' && (
                        <>
                            <button
                                onClick={handleClose}
                                className="flex-1 px-4 py-3 rounded-lg font-medium transition-all bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10"
                            >
                                Close
                            </button>
                            <button
                                onClick={() => {
                                    setStage('consent');
                                    setErrorMessage(null);
                                }}
                                className="flex-1 px-4 py-3 rounded-lg font-medium transition-all bg-hector-green hover:bg-hector-green/80 text-white"
                            >
                                Try Again
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
