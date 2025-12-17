import { clsx } from 'clsx';
import { useServersStore } from '../store/serversStore';
import { Wifi, WifiOff, Lock, Loader2 } from 'lucide-react';

export function ConnectionBadge() {
    const activeServer = useServersStore((s) => s.getActiveServer());

    if (!activeServer) {
        return (
            <div className="flex items-center gap-1.5 text-gray-500 text-sm">
                <WifiOff size={14} />
                <span>No server</span>
            </div>
        );
    }

    const statusConfig = {
        added: {
            icon: Loader2,
            text: 'Connecting...',
            color: 'text-blue-400',
            animate: true
        },
        auth_required: {
            icon: Lock,
            text: 'Login required',
            color: 'text-yellow-400',
            animate: false
        },
        authenticated: {
            icon: Wifi,
            text: 'Connected',
            color: 'text-green-400',
            animate: false
        },
        disconnected: {
            icon: WifiOff,
            text: 'Disconnected',
            color: 'text-red-400',
            animate: false
        },
        unreachable: {
            icon: WifiOff,
            text: 'Unreachable',
            color: 'text-gray-500',
            animate: false
        },
    };

    const config = statusConfig[activeServer.status];
    const Icon = config.icon;

    return (
        <div className={clsx('flex items-center gap-1.5 text-sm', config.color)}>
            <Icon size={14} className={config.animate ? 'animate-spin' : ''} />
            <span>{config.text}</span>
        </div>
    );
}
