import React, { useState } from 'react';
import { Download, Loader2, Globe } from 'lucide-react';
import hectorIcon from '../assets/hector.png';

interface WelcomeCoverProps {
    onDownloadHector: () => Promise<void>;
    onAddRemoteServer: () => void;
}

/**
 * Welcome cover shown when hector is not installed.
 * Provides options to download hector or connect to a remote server.
 */
export const WelcomeCover: React.FC<WelcomeCoverProps> = ({
    onDownloadHector,
    onAddRemoteServer
}) => {
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState<string | null>(null);

    const handleDownload = async () => {
        setIsDownloading(true);
        setDownloadProgress('Starting download...');
        try {
            await onDownloadHector();
            setDownloadProgress('Download complete!');
        } catch (error) {
            console.error('Download failed:', error);
            setDownloadProgress(`Error: ${error}`);
            setIsDownloading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-50">
            <div className="flex flex-col items-center gap-8 max-w-md text-center">
                {/* Logo */}
                <div className="w-20 h-20 flex items-center justify-center">
                    <img src={hectorIcon} alt="Hector" className="w-full h-full object-contain" />
                </div>

                {/* Welcome Message */}
                <div>
                    <h1 className="text-2xl font-semibold text-white mb-2">Welcome to Hector Studio</h1>
                    <p className="text-gray-400">
                        Get started by downloading Hector or connect to an existing server.
                    </p>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col gap-3 w-full">
                    <button
                        onClick={handleDownload}
                        disabled={isDownloading}
                        className="flex items-center justify-center gap-3 w-full px-6 py-4 rounded-lg font-medium transition-all bg-hector-green hover:bg-hector-green/80 text-white disabled:opacity-50"
                    >
                        {isDownloading ? (
                            <>
                                <Loader2 size={20} className="animate-spin" />
                                <span>{downloadProgress || 'Downloading...'}</span>
                            </>
                        ) : (
                            <>
                                <Download size={20} />
                                <span>Download Hector</span>
                            </>
                        )}
                    </button>

                    <div className="flex items-center gap-3 text-gray-500 text-sm">
                        <div className="flex-1 h-px bg-gray-800" />
                        <span>or</span>
                        <div className="flex-1 h-px bg-gray-800" />
                    </div>

                    <button
                        onClick={onAddRemoteServer}
                        disabled={isDownloading}
                        className="flex items-center justify-center gap-3 w-full px-6 py-3 rounded-lg font-medium transition-all bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 disabled:opacity-50"
                    >
                        <Globe size={18} />
                        <span>Connect to Remote Server</span>
                    </button>
                </div>

                {/* Info */}
                <p className="text-xs text-gray-600">
                    Hector is the AI agent runtime that powers local workspaces.
                </p>
            </div>
        </div>
    );
};
