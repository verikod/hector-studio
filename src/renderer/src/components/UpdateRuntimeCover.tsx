import React, { useState } from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';

interface UpdateRuntimeCoverProps {
    onUpdate: () => Promise<void>;
}

export const UpdateRuntimeCover: React.FC<UpdateRuntimeCoverProps> = ({
    onUpdate
}) => {
    const [isUpdating, setIsUpdating] = useState(false);
    const [progress, setProgress] = useState<string | null>(null);

    const handleUpdate = async () => {
        setIsUpdating(true);
        setProgress('Updating runtime...');
        try {
            await onUpdate();
            // App state should change automatically after this succeeds (via re-check or reload)
            // But usually we might need to reload window or wait for app:ready again?
            // Since we don't hot-reload the backend logic that checked the version, 
            // we should probably trigger a window reload or ask user to restart app.
            // But upgradeHector() updates the binary. The main process logic "isInstalled" is stateless regarding the file check?
            // "checkForUpdates" reads file.
            // If we succeed, we can call window.location.reload() to re-run initialization flow?

            setProgress('Update complete! Restarting...');
            setTimeout(() => {
                window.location.reload();
            }, 1000);

        } catch (error) {
            console.error('Update failed:', error);
            setProgress(`Error: ${error}`);
            setIsUpdating(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-50">
            <div className="flex flex-col items-center gap-8 max-w-md text-center">
                {/* Logo */}
                <div className="w-20 h-20 rounded-2xl bg-amber-500/20 flex items-center justify-center">
                    <RefreshCw className="w-10 h-10 text-amber-500" />
                </div>

                {/* Message */}
                <div>
                    <h1 className="text-2xl font-semibold text-white mb-2">Runtime Update Required</h1>
                    <p className="text-gray-400">
                        A new version of the Hector Runtime is required to continue using local workspaces.
                    </p>
                </div>

                {/* Action Button */}
                <div className="w-full">
                    <button
                        onClick={handleUpdate}
                        disabled={isUpdating}
                        className="flex items-center justify-center gap-3 w-full px-6 py-4 rounded-lg font-medium transition-all bg-amber-600 hover:bg-amber-600/80 text-white disabled:opacity-50"
                    >
                        {isUpdating ? (
                            <>
                                <Loader2 size={20} className="animate-spin" />
                                <span>{progress || 'Updating...'}</span>
                            </>
                        ) : (
                            <>
                                <RefreshCw size={20} />
                                <span>Update Runtime</span>
                            </>
                        )}
                    </button>
                </div>

                {/* Info */}
                <p className="text-xs text-gray-600">
                    This will download the compatible version of the Hector binary.
                </p>
            </div>
        </div>
    );
};
