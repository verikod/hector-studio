import React, { useState, useEffect } from 'react';
import { ResourceModal } from './ConfigBuilder/ResourceModal';
import { EnvVarsEditor } from './EnvVarsEditor';
import { Variable } from 'lucide-react';
import type { ServerConfig } from '../types';

interface WorkspaceEnvModalProps {
    isOpen: boolean;
    onClose: () => void;
    workspace: ServerConfig | null;
}

export const WorkspaceEnvModal: React.FC<WorkspaceEnvModalProps> = ({
    isOpen,
    onClose,
    workspace,
}) => {
    const [envVars, setEnvVars] = useState<Record<string, string>>({});
    const [globalEnvVars, setGlobalEnvVars] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen && workspace) {
            loadEnvVars();
        }
    }, [isOpen, workspace?.id]);

    const loadEnvVars = async () => {
        if (!workspace) return;

        setLoading(true);
        try {
            const [workspaceVars, globalVars] = await Promise.all([
                (window as any).api.env.getWorkspace(workspace.id),
                (window as any).api.env.getGlobal()
            ]);
            setEnvVars(workspaceVars || {});
            setGlobalEnvVars(globalVars || {});
        } catch (e) {
            console.error('Failed to load env vars:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!workspace) return;

        try {
            await (window as any).api.env.setWorkspace(workspace.id, envVars);
            onClose();
        } catch (e) {
            console.error('Failed to save workspace env vars:', e);
            alert(`Failed to save: ${e}`);
        }
    };

    if (!workspace) return null;

    return (
        <ResourceModal
            isOpen={isOpen}
            onClose={onClose}
            title={`Environment - ${workspace.name}`}
            onSave={handleSave}
            saveLabel="Save & Apply"
        >
            <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Variable size={16} className="text-green-400" />
                    <span>Environment variables for this workspace.</span>
                </div>

                {loading ? (
                    <div className="py-8 text-center text-gray-500">Loading...</div>
                ) : (
                    <EnvVarsEditor
                        envVars={envVars}
                        globalEnvVars={globalEnvVars}
                        onChange={setEnvVars}
                        showInherited={true}
                    />
                )}

                <p className="text-xs text-gray-500">
                    Changes are written to <code className="text-gray-400">{workspace.workspacePath}/.hector/.env</code>.
                    Hector will automatically reload when this file changes.
                </p>
            </div>
        </ResourceModal>
    );
};
