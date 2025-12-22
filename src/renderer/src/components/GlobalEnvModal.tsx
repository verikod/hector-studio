import React, { useState, useEffect } from 'react';
import { ResourceModal } from './ConfigBuilder/ResourceModal';
import { EnvVarsEditor } from './EnvVarsEditor';
import { Globe } from 'lucide-react';

interface GlobalEnvModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const GlobalEnvModal: React.FC<GlobalEnvModalProps> = ({
    isOpen,
    onClose,
}) => {
    const [envVars, setEnvVars] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen) {
            loadEnvVars();
        }
    }, [isOpen]);

    const loadEnvVars = async () => {
        setLoading(true);
        try {
            const vars = await (window as any).api.env.getGlobal();
            setEnvVars(vars || {});
        } catch (e) {
            console.error('Failed to load global env vars:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            await (window as any).api.env.setGlobal(envVars);
            onClose();
        } catch (e) {
            console.error('Failed to save global env vars:', e);
        }
    };

    return (
        <ResourceModal
            isOpen={isOpen}
            onClose={onClose}
            title="Global Environment Variables"
            onSave={handleSave}
            saveLabel="Save"
        >
            <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Globe size={16} className="text-blue-400" />
                    <span>These variables are available to all workspaces as defaults.</span>
                </div>

                {loading ? (
                    <div className="py-8 text-center text-gray-500">Loading...</div>
                ) : (
                    <EnvVarsEditor
                        envVars={envVars}
                        onChange={setEnvVars}
                    />
                )}

                <p className="text-xs text-gray-500">
                    Workspace-specific variables can override these values.
                    Common uses: API keys, default log levels, etc.
                </p>
            </div>
        </ResourceModal>
    );
};
