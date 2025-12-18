import React, { useEffect, useState } from 'react';
import { Download, RefreshCw, X, ArrowUpCircle } from 'lucide-react';

export const UpdateNotification: React.FC = () => {
    const [status, setStatus] = useState<'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error'>('idle');
    const [progress, setProgress] = useState(0);
    const [info, setInfo] = useState<any>(null);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        // Subscribe to update events
        const unsubscribe = window.api.app.onUpdateStatus(({ status: newStatus, data }) => {
            console.log('[UpdateNotification] Status:', newStatus, data);

            if (newStatus === 'downloading') {
                setStatus('downloading');
                setProgress(Math.round(data.percent));
            } else if (newStatus === 'available') {
                setStatus('available');
                setInfo(data);
                setDismissed(false); // Re-show if new update found
            } else if (newStatus === 'downloaded') {
                setStatus('downloaded');
                setInfo(data);
            } else if (newStatus === 'error') {
                console.error('Update error:', data);
                // Don't show error state to user mostly, keeps it distinct
            }
        });

        // Trigger an initial check just in case (though main process does it)
        // window.api.app.checkUpdate(); 

        return unsubscribe;
    }, []);

    const handleDownload = () => {
        window.api.app.startDownload();
        setStatus('downloading');
    };

    const handleInstall = () => {
        window.api.app.installUpdate();
    };

    if (dismissed || status === 'idle' || status === 'checking' || status === 'error') {
        return null;
    }

    return (
        <div className="fixed bottom-4 right-4 z-50 w-80 bg-zinc-900 border border-white/10 rounded-lg shadow-2xl p-4 animate-in slide-in-from-bottom-2 fade-in duration-300">
            <div className="flex items-start justify-between">
                <div className="flex gap-3">
                    <div className="p-2 bg-white/5 rounded-lg h-fit">
                        {status === 'downloading' ? (
                            <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" />
                        ) : status === 'downloaded' ? (
                            <ArrowUpCircle className="w-5 h-5 text-green-400" />
                        ) : (
                            <Download className="w-5 h-5 text-hector-green" />
                        )}
                    </div>
                    <div>
                        <h3 className="font-medium text-white text-sm">
                            {status === 'downloaded' ? 'Update Ready' : 'Update Available'}
                        </h3>
                        <p className="text-xs text-gray-400 mt-1">
                            {status === 'downloaded'
                                ? `Version ${info?.version} is ready to install.`
                                : `Version ${info?.version} is available.`}
                        </p>

                        {status === 'downloading' && (
                            <div className="w-full h-1 bg-white/10 rounded-full mt-2 overflow-hidden">
                                <div
                                    className="h-full bg-blue-500 transition-all duration-300"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        )}
                    </div>
                </div>

                <button
                    onClick={() => setDismissed(true)}
                    className="text-gray-500 hover:text-white transition-colors"
                >
                    <X size={16} />
                </button>
            </div>

            <div className="mt-3 flex justify-end gap-2">
                {status === 'available' && (
                    <button
                        onClick={handleDownload}
                        className="text-xs px-3 py-1.5 bg-hector-green hover:bg-hector-green/80 text-white rounded-md font-medium transition-colors"
                    >
                        Download
                    </button>
                )}
                {status === 'downloaded' && (
                    <button
                        onClick={handleInstall}
                        className="text-xs px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-md font-medium transition-colors"
                    >
                        Restart & Install
                    </button>
                )}
            </div>
        </div>
    );
};
