import { useState, useEffect } from 'react';
import { X, Key, ExternalLink, Loader2, CheckCircle, AlertCircle, ShoppingCart } from 'lucide-react';
import { cn } from '../lib/utils';

interface LicenseModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLicenseActivated: () => void;
    onSkip?: () => void;
}

type ActivationMode = 'choose' | 'manual';
type ActivationStatus = 'idle' | 'loading' | 'success' | 'error';

export function LicenseModal({ isOpen, onClose, onLicenseActivated, onSkip }: LicenseModalProps) {
    const [mode, setMode] = useState<ActivationMode>('choose');
    const [licenseKey, setLicenseKey] = useState('');
    const [status, setStatus] = useState<ActivationStatus>('idle');
    const [error, setError] = useState<string | null>(null);
    const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setMode('choose');
            setLicenseKey('');
            setStatus('idle');
            setError(null);
            // Get checkout URL
            window.api.license.getPortalUrl().then(url => setCheckoutUrl(url || null));
        }
    }, [isOpen]);

    const handleManualActivation = async () => {
        if (!licenseKey.trim()) {
            setError('Please enter a license key');
            return;
        }

        setStatus('loading');
        setError(null);

        try {
            const result = await window.api.license.activate(licenseKey.trim());
            if (result.success) {
                setStatus('success');
                setTimeout(() => {
                    onLicenseActivated();
                }, 1500);
            } else {
                setError(result.error || 'Invalid license key');
                setStatus('error');
            }
        } catch (err) {
            setError(String(err));
            setStatus('error');
        }
    };

    const openCheckout = () => {
        if (checkoutUrl) {
            window.open(checkoutUrl, '_blank');
        }
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md animate-in zoom-in-95 fade-in duration-200">
                <div className="bg-hector-darker border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-white/10">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-hector-green/20 rounded-lg">
                                <Key className="text-hector-green" size={20} />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-white">Activate License</h2>
                                <p className="text-xs text-gray-400">Unlock Studio Mode features</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                        {status === 'success' ? (
                            <div className="text-center py-8">
                                <CheckCircle size={48} className="mx-auto text-green-500 mb-4" />
                                <h3 className="text-lg font-medium text-white mb-2">License Activated!</h3>
                                <p className="text-sm text-gray-400">
                                    Studio Mode is now unlocked. Enjoy!
                                </p>
                            </div>
                        ) : mode === 'choose' ? (
                            <div className="space-y-4">
                                <p className="text-sm text-gray-400 text-center mb-6">
                                    Get your <span className="text-hector-green font-medium">free Early Access</span> license to unlock Studio Mode.
                                </p>

                                {/* Get License Button */}
                                <button
                                    onClick={openCheckout}
                                    className="w-full flex items-center gap-4 p-4 bg-hector-green/20 hover:bg-hector-green/30 border border-hector-green/40 rounded-xl transition-colors text-left"
                                >
                                    <div className="p-3 bg-hector-green/20 rounded-lg">
                                        <ShoppingCart className="text-hector-green" size={24} />
                                    </div>
                                    <div>
                                        <div className="font-medium text-white">Get Free License</div>
                                        <div className="text-xs text-gray-400">Opens checkout page (email required)</div>
                                    </div>
                                    <ExternalLink size={16} className="ml-auto text-gray-400" />
                                </button>

                                {/* Already have a license */}
                                <button
                                    onClick={() => setMode('manual')}
                                    className="w-full flex items-center gap-4 p-4 bg-white/5 hover:bg-white/10 border border-white/20 rounded-xl transition-colors text-left"
                                >
                                    <div className="p-3 bg-blue-500/20 rounded-lg">
                                        <Key className="text-blue-400" size={24} />
                                    </div>
                                    <div>
                                        <div className="font-medium text-white">I Have a License Key</div>
                                        <div className="text-xs text-gray-400">Enter your key to activate</div>
                                    </div>
                                </button>

                                {/* Skip option */}
                                {onSkip && (
                                    <button
                                        onClick={() => {
                                            onSkip();
                                            onClose();
                                        }}
                                        className="w-full text-center text-xs text-gray-500 hover:text-gray-400 transition-colors py-2"
                                    >
                                        Skip for now (Chat mode only)
                                    </button>
                                )}
                            </div>
                        ) : (
                            /* Manual Key Entry */
                            <div className="space-y-4">
                                <button
                                    onClick={() => {
                                        setMode('choose');
                                        setError(null);
                                        setStatus('idle');
                                    }}
                                    className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors mb-4"
                                >
                                    ← Back
                                </button>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        License Key
                                    </label>
                                    <input
                                        type="text"
                                        value={licenseKey}
                                        onChange={(e) => setLicenseKey(e.target.value)}
                                        placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
                                        className="w-full px-4 py-3 bg-black/50 border border-white/20 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-hector-green focus:border-transparent font-mono"
                                        onKeyDown={(e) => e.key === 'Enter' && handleManualActivation()}
                                        disabled={status === 'loading'}
                                    />
                                </div>

                                {error && (
                                    <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 p-3 rounded-lg">
                                        <AlertCircle size={16} />
                                        {error}
                                    </div>
                                )}

                                <button
                                    onClick={handleManualActivation}
                                    disabled={status === 'loading'}
                                    className={cn(
                                        "w-full py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2",
                                        status === 'loading'
                                            ? "bg-gray-600 cursor-not-allowed"
                                            : "bg-hector-green hover:bg-hector-green/80 text-white"
                                    )}
                                >
                                    {status === 'loading' ? (
                                        <>
                                            <Loader2 size={16} className="animate-spin" />
                                            Activating...
                                        </>
                                    ) : (
                                        'Activate License'
                                    )}
                                </button>

                                {/* Get license link */}
                                <button
                                    onClick={openCheckout}
                                    className="w-full flex items-center justify-center gap-2 p-3 text-sm text-gray-400 hover:text-white transition-colors"
                                >
                                    <ExternalLink size={14} />
                                    Don't have a key? Get one free
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
