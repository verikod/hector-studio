import React, { useState, useEffect } from "react";
import { LogIn, AlertCircle, X, Shield } from "lucide-react";
import type { ServerConfig, AuthConfig } from "../types";

interface LoginModalProps {
    server: ServerConfig;
    isOpen: boolean;
    onClose: () => void;
    onLoginSuccess: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ server, isOpen, onClose, onLoginSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [authConfig, setAuthConfig] = useState<AuthConfig | null>(null);

    useEffect(() => {
        if (isOpen && server) {
            discoverAuth();
        }
    }, [isOpen, server]);

    const discoverAuth = async () => {
        try {
            setLoading(true);
            setError(null);
            const config = await window.api.server.discoverAuth(server.url);
            setAuthConfig(config);
            if (!config) {
                setError("This server does not support authentication protocols.");
            }
        } catch (err) {
            console.error("Discovery failed", err);
            setError("Failed to discover authentication capabilities.");
        } finally {
            setLoading(false);
        }
    };

    const handleLogin = async () => {
        try {
            setLoading(true);
            setError(null);
            await window.api.auth.login(server.url);
            onLoginSuccess();
            onClose();
        } catch (err: any) {
            console.error("Login failed", err);
            setError(err.message || "Login failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-white/10 rounded-xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="p-6 pb-0 flex justify-between items-start">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-hector-green/10 rounded-xl text-hector-green">
                            <Shield size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold">Authentication Required</h3>
                            <p className="text-sm text-gray-400">Connect to {server.name}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                        <X size={20} className="text-gray-500 hover:text-white" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    <div className="bg-white/5 rounded-lg p-4 text-sm text-gray-300 border border-white/5">
                        <p>Accessing <strong>{server.url}</strong> requires authentication.</p>
                        {authConfig && (
                            <div className="mt-2 text-xs text-gray-500">
                                Provider: {authConfig.issuer}
                                {authConfig.clientId && (
                                    <span className="block mt-1 opacity-70">Client ID: ...{authConfig.clientId.slice(-6)}</span>
                                )}
                            </div>
                        )}
                    </div>

                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2 text-red-400 text-sm">
                            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                            <p>{error}</p>
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors font-medium text-sm"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleLogin}
                            disabled={loading || !!error || !authConfig}
                            className="px-6 py-2.5 bg-hector-green hover:bg-[#0d9668] text-white rounded-lg transition-all shadow-lg shadow-hector-green/20 font-medium text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <>
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Connecting...
                                </>
                            ) : (
                                <>
                                    <LogIn size={16} />
                                    Login
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
