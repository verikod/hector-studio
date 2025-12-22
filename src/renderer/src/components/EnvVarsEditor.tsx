import React, { useState } from 'react';
import { Plus, Trash2, Eye, EyeOff, Globe } from 'lucide-react';
import { cn } from '../lib/utils';

interface EnvVar {
    key: string;
    value: string;
    isGlobal?: boolean; // Whether this var is inherited from global
}

interface EnvVarsEditorProps {
    envVars: Record<string, string>;
    globalEnvVars?: Record<string, string>; // For showing inherited globals
    onChange: (envVars: Record<string, string>) => void;
    showInherited?: boolean; // Whether to show inherited global vars
}

export const EnvVarsEditor: React.FC<EnvVarsEditorProps> = ({
    envVars,
    globalEnvVars = {},
    onChange,
    showInherited = false,
}) => {
    const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
    const [newKey, setNewKey] = useState('');
    const [newValue, setNewValue] = useState('');

    // Combine inherited globals with workspace vars for display
    const displayVars: EnvVar[] = [];

    if (showInherited) {
        // Add globals that aren't overridden
        for (const [key, value] of Object.entries(globalEnvVars)) {
            if (!(key in envVars)) {
                displayVars.push({ key, value, isGlobal: true });
            }
        }
    }

    // Add workspace vars
    for (const [key, value] of Object.entries(envVars)) {
        displayVars.push({ key, value, isGlobal: false });
    }

    // Sort by key
    displayVars.sort((a, b) => a.key.localeCompare(b.key));

    const toggleReveal = (key: string) => {
        const newRevealed = new Set(revealedKeys);
        if (newRevealed.has(key)) {
            newRevealed.delete(key);
        } else {
            newRevealed.add(key);
        }
        setRevealedKeys(newRevealed);
    };

    const handleAdd = () => {
        const trimmedKey = newKey.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
        if (!trimmedKey || trimmedKey in envVars) return;

        onChange({ ...envVars, [trimmedKey]: newValue });
        setNewKey('');
        setNewValue('');
    };

    const handleUpdate = (key: string, value: string) => {
        onChange({ ...envVars, [key]: value });
    };

    const handleDelete = (key: string) => {
        const { [key]: _, ...rest } = envVars;
        onChange(rest);
    };

    const isSecretKey = (key: string): boolean => {
        const secretPatterns = ['KEY', 'SECRET', 'PASSWORD', 'TOKEN', 'CREDENTIAL'];
        return secretPatterns.some(p => key.toUpperCase().includes(p));
    };

    const maskValue = (value: string): string => {
        if (value.length <= 6) return '••••••';
        return value.slice(0, 3) + '•••' + value.slice(-3);
    };

    return (
        <div className="space-y-3">
            {/* Existing variables */}
            <div className="space-y-2">
                {displayVars.length === 0 && (
                    <div className="text-center py-6 text-gray-500 text-sm">
                        No environment variables defined.
                    </div>
                )}

                {displayVars.map(({ key, value, isGlobal }) => (
                    <div
                        key={key}
                        className={cn(
                            "flex items-center gap-2 rounded-lg border p-2",
                            isGlobal
                                ? "bg-blue-500/5 border-blue-500/20"
                                : "bg-white/5 border-white/10"
                        )}
                    >
                        {/* Key */}
                        <div className="flex items-center gap-2 min-w-[140px]">
                            {isGlobal && (
                                <span title="Inherited from global">
                                    <Globe size={14} className="text-blue-400 shrink-0" />
                                </span>
                            )}
                            <span className="font-mono text-sm text-gray-300 truncate">
                                {key}
                            </span>
                        </div>

                        {/* Value */}
                        <div className="flex-1 flex items-center gap-2">
                            {isGlobal ? (
                                <span className="flex-1 font-mono text-sm text-gray-500 truncate">
                                    {isSecretKey(key) ? maskValue(value) : value}
                                </span>
                            ) : (
                                <input
                                    type={isSecretKey(key) && !revealedKeys.has(key) ? 'password' : 'text'}
                                    value={value}
                                    onChange={(e) => handleUpdate(key, e.target.value)}
                                    className="flex-1 px-2 py-1 bg-transparent border-none text-sm text-white font-mono focus:outline-none focus:ring-1 focus:ring-hector-green/50 rounded"
                                />
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1">
                            {isSecretKey(key) && !isGlobal && (
                                <button
                                    onClick={() => toggleReveal(key)}
                                    className="p-1 hover:bg-white/10 rounded transition-colors"
                                    title={revealedKeys.has(key) ? 'Hide value' : 'Show value'}
                                >
                                    {revealedKeys.has(key) ? (
                                        <EyeOff size={14} className="text-gray-400" />
                                    ) : (
                                        <Eye size={14} className="text-gray-400" />
                                    )}
                                </button>
                            )}

                            {!isGlobal && (
                                <button
                                    onClick={() => handleDelete(key)}
                                    className="p-1 hover:bg-red-500/20 rounded transition-colors"
                                    title="Delete"
                                >
                                    <Trash2 size={14} className="text-red-400" />
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Add new variable */}
            <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                <input
                    type="text"
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'))}
                    placeholder="VARIABLE_NAME"
                    className="w-40 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white font-mono placeholder:text-gray-500 focus:outline-none focus:border-hector-green"
                />
                <input
                    type="text"
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    placeholder="value"
                    className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white font-mono placeholder:text-gray-500 focus:outline-none focus:border-hector-green"
                    onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                />
                <button
                    onClick={handleAdd}
                    disabled={!newKey.trim()}
                    className={cn(
                        "p-2 rounded-lg transition-colors",
                        newKey.trim()
                            ? "bg-hector-green hover:bg-hector-green/80 text-white"
                            : "bg-gray-700 text-gray-500 cursor-not-allowed"
                    )}
                    title="Add variable"
                >
                    <Plus size={18} />
                </button>
            </div>

            {/* Help text */}
            {showInherited && Object.keys(globalEnvVars).length > 0 && (
                <p className="text-xs text-gray-500 flex items-center gap-1">
                    <Globe size={12} className="text-blue-400" />
                    Variables with globe icon are inherited from global settings
                </p>
            )}
        </div>
    );
};
