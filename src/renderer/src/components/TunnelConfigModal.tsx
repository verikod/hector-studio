import { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Zap, Lock } from 'lucide-react';
import { ServerConfig } from '../types';

interface TunnelConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
    workspace: ServerConfig | null;
}

export function TunnelConfigModal({ isOpen, onClose, workspace }: TunnelConfigModalProps) {
    const [token, setToken] = useState('');
    const [url, setUrl] = useState('');
    const [saving, setSaving] = useState(false);

    // Sync state with workspace config when opened
    useEffect(() => {
        if (workspace && isOpen) {
            setToken(workspace.tunnel?.token || '');
            setUrl(workspace.tunnel?.url || '');
        }
    }, [workspace, isOpen]);

    const handleSave = async () => {
        if (!workspace) return;
        setSaving(true);
        try {
            await (window as any).api.server.update(workspace.id, {
                tunnel: {
                    token: token.trim(),
                    url: url.trim()
                }
            });
            onClose();
        } catch (error) {
            useStore.getState().setError(`Failed to save tunnel config: ${(error as Error).message}`);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px] bg-[#1e1e1e] border-white/10 text-white">
                <DialogHeader>
                    <DialogTitle className="text-lg font-medium flex items-center gap-2">
                        <Lock size={18} className="text-blue-400" />
                        Cloudflare Tunnel Configuration
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Info Box */}
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-md p-3 text-sm text-blue-200">
                        <p className="flex items-start gap-2">
                            <Zap size={16} className="mt-0.5 flex-shrink-0" />
                            <span>
                                Use a <strong>Cloudflare Tunnel Token</strong> to use a persistent domain or Cloudflare Zero Trust authentication.
                                If you leave this blank, Hector sends a random Quick Tunnel (trycloudflare.com).
                            </span>
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-gray-300">Tunnel Token</Label>
                            <Input
                                type="password"
                                value={token}
                                onChange={(e) => setToken(e.target.value)}
                                placeholder="Base64 encoded tunnel token..."
                                className="bg-black/20 border-white/10 text-white font-mono text-xs"
                            />
                            <p className="text-[10px] text-gray-500">
                                Found in Cloudflare Zero Trust Dashboard → Tunnels → Your Tunnel → Overview → Install Connector (copy the token part).
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-gray-300">Custom Public URL (Optional)</Label>
                            <Input
                                type="text"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="https://hector.mydomain.com"
                                className="bg-black/20 border-white/10 text-white"
                            />
                            <p className="text-[10px] text-gray-500">
                                This is purely cosmetic for Hector to display the correct link for your named tunnel.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Authentication Section */}
                <div className="space-y-4 pt-4 border-t border-white/10 px-4 pb-4">
                    <DialogTitle className="text-md font-medium text-blue-400">Authentication</DialogTitle>
                    <div className="bg-orange-500/10 border border-orange-500/20 rounded-md p-3 text-sm text-orange-200">
                        <p className="flex items-start gap-2">
                            <Lock size={16} className="mt-0.5 flex-shrink-0" />
                            <span>
                                This workspace is protected by a <strong>Secure Token</strong>.
                                External requests must include this token in the header:
                            </span>
                        </p>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-gray-300">Secure Token (Shared Secret)</Label>
                        <div className="flex gap-2">
                            <Input
                                readOnly
                                value={workspace?.secureToken || 'Not generated yet'}
                                className="bg-black/20 border-white/10 text-white font-mono text-xs"
                            />
                            <Button
                                variant="outline"
                                size="icon"
                                className="bg-black/20 border-white/10 hover:bg-white/10 text-gray-400"
                                onClick={() => {
                                    if (workspace?.secureToken) {
                                        navigator.clipboard.writeText(workspace.secureToken);
                                    }
                                }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>
                            </Button>
                        </div>
                        <p className="text-[10px] text-gray-500">
                            Header: <code>Authorization: Bearer &lt;TOKEN&gt;</code>
                        </p>
                    </div>
                </div>

                <div className="flex justify-end gap-2 px-4 pb-4">
                    <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
                        Cancel
                    </Button>
                    <Button
                        size="sm"
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-blue-500 hover:bg-blue-600 text-white"
                    >
                        {saving ? 'Saving...' : 'Save Configuration'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
