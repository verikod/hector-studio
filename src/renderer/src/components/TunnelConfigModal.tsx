import { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Zap, Lock } from 'lucide-react';
import { ServerConfig } from '../../../main/servers/manager';

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

                <div className="flex justify-end gap-2">
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
