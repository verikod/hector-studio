import React, { useState, useEffect } from 'react';
import { ResourceModal, FormField, TextInput, SelectInput, TextAreaInput, ToggleInput } from './ResourceModal';
import type { ToolConfig } from '../../lib/config-utils';

const TOOL_TYPES = [
    { value: 'mcp', label: 'MCP (Model Context Protocol)' },
    { value: 'function', label: 'Built-in Function' },
    { value: 'command', label: 'Command Execution' },
];

const FUNCTION_HANDLERS = [
    { value: 'read_file', label: 'read_file - Read file contents' },
    { value: 'write_file', label: 'write_file - Write to file' },
    { value: 'grep_search', label: 'grep_search - Search files with regex' },
    { value: 'search_replace', label: 'search_replace - Find and replace' },
    { value: 'apply_patch', label: 'apply_patch - Apply code patch' },
    { value: 'web_request', label: 'web_request - Make HTTP requests' },
    { value: 'todo_write', label: 'todo_write - Task management' },
];

const MCP_TRANSPORTS = [
    { value: 'sse', label: 'SSE (Server-Sent Events)' },
    { value: 'stdio', label: 'stdio (Command)' },
    { value: 'streamable-http', label: 'Streamable HTTP' },
];

interface ToolModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (id: string, config: ToolConfig) => void;
    existingIds: string[];
    editId?: string | null;
    editConfig?: ToolConfig | null;
}

export const ToolModal: React.FC<ToolModalProps> = ({
    isOpen,
    onClose,
    onSave,
    existingIds,
    editId,
    editConfig,
}) => {
    const isEditing = !!editId;

    const [id, setId] = useState('');
    const [type, setType] = useState<'mcp' | 'function' | 'command'>('mcp');
    const [description, setDescription] = useState('');
    const [requireApproval, setRequireApproval] = useState(false);

    // MCP fields
    const [url, setUrl] = useState('');
    const [transport, setTransport] = useState('sse');
    const [command, setCommand] = useState('');
    const [args, setArgs] = useState('');
    const [env, setEnv] = useState('');
    const [filter, setFilter] = useState('');

    // Function fields
    const [handler, setHandler] = useState('');

    // Command fields
    const [workingDirectory, setWorkingDirectory] = useState('./');
    const [maxExecutionTime, setMaxExecutionTime] = useState('30s');
    const [allowedCommands, setAllowedCommands] = useState('');
    const [denyByDefault, setDenyByDefault] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (isEditing && editConfig) {
                setId(editId);
                setType(editConfig.type || 'mcp');
                setDescription(editConfig.description || '');
                setRequireApproval(editConfig.require_approval || false);
                setUrl(editConfig.url || '');
                setTransport(editConfig.transport || 'sse');
                setCommand(editConfig.command || '');
                setArgs(editConfig.args?.join(' ') || '');
                setEnv(editConfig.env ? Object.entries(editConfig.env).map(([k, v]) => `${k}=${v}`).join('\n') : '');
                setFilter(editConfig.filter?.join(', ') || '');
                setHandler(editConfig.handler || '');
                setWorkingDirectory(editConfig.working_directory || './');
                setMaxExecutionTime(editConfig.max_execution_time || '30s');
                setAllowedCommands(editConfig.allowed_commands?.join(', ') || '');
                setDenyByDefault(editConfig.deny_by_default || false);
            } else {
                setId('');
                setType('mcp');
                setDescription('');
                setRequireApproval(false);
                setUrl('');
                setTransport('sse');
                setCommand('');
                setCommand('');
                setArgs('');
                setEnv('');
                setFilter('');
                setHandler('');
                setWorkingDirectory('./');
                setMaxExecutionTime('30s');
                setAllowedCommands('');
                setDenyByDefault(false);
            }
        }
    }, [isOpen, isEditing, editId, editConfig]);

    const handleSave = () => {
        const config: ToolConfig = {
            type,
            description: description || undefined,
            require_approval: requireApproval || undefined,
        };

        if (type === 'mcp') {
            if (transport === 'stdio') {
                config.transport = 'stdio';
                config.command = command || undefined;
                config.args = args ? args.split(' ').filter(Boolean) : undefined;
            } else {
                config.transport = transport;
                config.url = url || undefined;
            }
            if (env) {
                config.env = env.split('\n').reduce((acc, line) => {
                    const [k, ...v] = line.split('=');
                    if (k && k.trim()) acc[k.trim()] = v.join('=').trim();
                    return acc;
                }, {} as Record<string, string>);
                if (Object.keys(config.env).length === 0) delete config.env;
            }
            config.filter = filter ? filter.split(',').map(s => s.trim()).filter(Boolean) : undefined;
            if (config.filter && config.filter.length === 0) delete config.filter;
        } else if (type === 'function') {
            config.handler = handler || undefined;
        } else if (type === 'command') {
            config.working_directory = workingDirectory || undefined;
            config.max_execution_time = maxExecutionTime || undefined;
            config.deny_by_default = denyByDefault || undefined;
            config.allowed_commands = allowedCommands ? allowedCommands.split(',').map(s => s.trim()).filter(Boolean) : undefined;
        }

        // Clean undefined values
        Object.keys(config).forEach(key => {
            if (config[key as keyof ToolConfig] === undefined) {
                delete config[key as keyof ToolConfig];
            }
        });

        onSave(id, config);
        onClose();
    };

    const isValid = id && type && !(!isEditing && existingIds.includes(id));

    return (
        <ResourceModal
            isOpen={isOpen}
            onClose={onClose}
            title={isEditing ? `Edit Tool: ${editId}` : 'Add Tool'}
            onSave={handleSave}
            saveDisabled={!isValid}
        >
            <FormField label="ID" required hint="Unique identifier for this tool">
                <TextInput
                    value={id}
                    onChange={setId}
                    placeholder="e.g., weather, execute_command"
                />
            </FormField>

            <FormField label="Type" required>
                <SelectInput
                    value={type}
                    onChange={(v) => setType(v as 'mcp' | 'function' | 'command')}
                    options={TOOL_TYPES}
                />
            </FormField>

            <FormField label="Description">
                <TextAreaInput
                    value={description}
                    onChange={setDescription}
                    placeholder="What does this tool do?"
                    rows={2}
                />
            </FormField>

            {/* MCP-specific fields */}
            {type === 'mcp' && (
                <>
                    <FormField label="Transport">
                        <SelectInput
                            value={transport}
                            onChange={setTransport}
                            options={MCP_TRANSPORTS}
                        />
                    </FormField>

                    {transport === 'stdio' ? (
                        <>
                            <FormField label="Command" hint="Command to run MCP server">
                                <TextInput
                                    value={command}
                                    onChange={setCommand}
                                    placeholder="e.g., npx, python"
                                />
                            </FormField>
                            <FormField label="Arguments" hint="Space-separated arguments">
                                <TextInput
                                    value={args}
                                    onChange={setArgs}
                                    placeholder="e.g., @modelcontextprotocol/server-weather"
                                />
                            </FormField>
                        </>
                    ) : (
                        <FormField label="URL" hint="MCP server URL">
                            <TextInput
                                value={url}
                                onChange={setUrl}
                                placeholder="e.g., http://localhost:3000/mcp"
                            />
                        </FormField>
                    )}


                    <FormField label="Environment Variables" hint="KEY=VALUE (one per line)">
                        <TextAreaInput
                            value={env}
                            onChange={setEnv}
                            placeholder="API_KEY=123&#10;DEBUG=true"
                            rows={3}
                        />
                    </FormField>

                    <FormField label="Tool Filter" hint="Comma-separated list of tools to expose (whitelist)">
                        <TextInput
                            value={filter}
                            onChange={setFilter}
                            placeholder="read_file, list_files"
                        />
                    </FormField>
                </>
            )}

            {/* Function-specific fields */}
            {type === 'function' && (
                <FormField label="Handler" required>
                    <SelectInput
                        value={handler}
                        onChange={setHandler}
                        options={FUNCTION_HANDLERS}
                        placeholder="Select function..."
                    />
                </FormField>
            )}

            {/* Command-specific fields */}
            {type === 'command' && (
                <>
                    <FormField label="Working Directory">
                        <TextInput
                            value={workingDirectory}
                            onChange={setWorkingDirectory}
                            placeholder="./"
                        />
                    </FormField>
                    <FormField label="Max Execution Time">
                        <TextInput
                            value={maxExecutionTime}
                            onChange={setMaxExecutionTime}
                            placeholder="30s"
                        />
                    </FormField>
                    <FormField label="Allowed Commands" hint="Comma-separated whitelist">
                        <TextInput
                            value={allowedCommands}
                            onChange={setAllowedCommands}
                            placeholder="ls, cat, grep, find"
                        />
                    </FormField>
                    <ToggleInput
                        checked={denyByDefault}
                        onChange={setDenyByDefault}
                        label="Deny by default (require whitelist)"
                    />
                </>
            )}

            <ToggleInput
                checked={requireApproval}
                onChange={setRequireApproval}
                label="Require user approval (HITL)"
            />
        </ResourceModal>
    );
};
