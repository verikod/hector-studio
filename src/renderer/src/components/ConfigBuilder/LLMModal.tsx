import React, { useState, useEffect } from 'react';
import { ResourceModal, FormField, TextInput, SelectInput, ToggleInput } from './ResourceModal';
import type { LLMConfig } from '../../lib/config-utils';

const LLM_PROVIDERS = [
    { value: 'openai', label: 'OpenAI' },
    { value: 'anthropic', label: 'Anthropic' },
    { value: 'gemini', label: 'Google Gemini' },
    { value: 'ollama', label: 'Ollama' },
    { value: 'deepseek', label: 'DeepSeek' },
    { value: 'groq', label: 'Groq' },
    { value: 'mistral', label: 'Mistral' },
    { value: 'cohere', label: 'Cohere' },
];

const PROVIDER_MODELS: Record<string, Array<{ value: string; label: string }>> = {
    openai: [
        { value: 'gpt-4o', label: 'GPT-4o' },
        { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
        { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
        { value: 'o1', label: 'o1' },
        { value: 'o1-mini', label: 'o1 Mini' },
    ],
    anthropic: [
        { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
        { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
        { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
        { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
    ],
    gemini: [
        { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
        { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
        { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
    ],
    ollama: [
        { value: 'llama3.3', label: 'Llama 3.3' },
        { value: 'qwen3', label: 'Qwen 3' },
        { value: 'mistral', label: 'Mistral' },
        { value: 'codellama', label: 'Code Llama' },
    ],
    deepseek: [
        { value: 'deepseek-chat', label: 'DeepSeek Chat' },
        { value: 'deepseek-coder', label: 'DeepSeek Coder' },
    ],
    groq: [
        { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' },
        { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' },
    ],
    mistral: [
        { value: 'mistral-large-latest', label: 'Mistral Large' },
        { value: 'mistral-medium-latest', label: 'Mistral Medium' },
    ],
    cohere: [
        { value: 'command-r-plus', label: 'Command R+' },
        { value: 'command-r', label: 'Command R' },
    ],
};

interface LLMModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (id: string, config: LLMConfig) => void;
    existingIds: string[];
    editId?: string | null;
    editConfig?: LLMConfig | null;
}

export const LLMModal: React.FC<LLMModalProps> = ({
    isOpen,
    onClose,
    onSave,
    existingIds,
    editId,
    editConfig,
}) => {
    const isEditing = !!editId;

    const [id, setId] = useState('');
    const [provider, setProvider] = useState('openai');
    const [model, setModel] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [baseUrl, setBaseUrl] = useState('');
    const [temperature, setTemperature] = useState('');
    const [maxTokens, setMaxTokens] = useState('');
    const [maxToolOutputLength, setMaxToolOutputLength] = useState('');
    const [thinkingEnabled, setThinkingEnabled] = useState(false);
    const [thinkingBudget, setThinkingBudget] = useState('');
    const [showAdvanced, setShowAdvanced] = useState(false);

    // Reset form when modal opens
    useEffect(() => {
        if (isOpen) {
            if (isEditing && editConfig) {
                setId(editId);
                setProvider(editConfig.provider || 'openai');
                setModel(editConfig.model || '');
                setApiKey(editConfig.api_key || '');
                setBaseUrl(editConfig.base_url || '');
                setTemperature(editConfig.temperature?.toString() || '');
                setMaxTokens(editConfig.max_tokens?.toString() || '');
                setMaxToolOutputLength(editConfig.max_tool_output_length?.toString() || '');
                setThinkingEnabled(editConfig.thinking?.enabled || false);
                setThinkingBudget(editConfig.thinking?.budget_tokens?.toString() || '');
            } else {
                setId('');
                setProvider('openai');
                setModel('');
                setApiKey('');
                setBaseUrl('');
                setTemperature('');
                setMaxTokens('');
                setMaxToolOutputLength('');
                setThinkingEnabled(false);
                setThinkingBudget('');
            }
            setShowAdvanced(false);
        }
    }, [isOpen, isEditing, editId, editConfig]);

    const handleSave = () => {
        const config: LLMConfig = {
            provider,
            model: model || undefined,
            api_key: apiKey || undefined,
            base_url: baseUrl || undefined,
            temperature: temperature ? parseFloat(temperature) : undefined,
            max_tokens: maxTokens ? parseInt(maxTokens) : undefined,
            max_tool_output_length: maxToolOutputLength ? parseInt(maxToolOutputLength) : undefined,
        };

        // Add thinking config if enabled
        if (thinkingEnabled || thinkingBudget) {
            config.thinking = {
                enabled: thinkingEnabled,
                budget_tokens: thinkingBudget ? parseInt(thinkingBudget) : undefined,
            };
        }

        // Clean undefined values
        Object.keys(config).forEach(key => {
            if (config[key as keyof LLMConfig] === undefined) {
                delete config[key as keyof LLMConfig];
            }
        });

        onSave(id, config);
        onClose();
    };

    const isValid = id && provider && !(!isEditing && existingIds.includes(id));
    const supportsThinking = provider === 'anthropic'; // Only Anthropic supports extended thinking

    return (
        <ResourceModal
            isOpen={isOpen}
            onClose={onClose}
            title={isEditing ? `Edit LLM: ${editId}` : 'Add LLM'}
            onSave={handleSave}
            saveDisabled={!isValid}
        >
            <FormField label="ID" required hint="Unique identifier for this LLM">
                <TextInput
                    value={id}
                    onChange={setId}
                    placeholder="e.g., default, fast, reasoning"
                />
                {!isEditing && existingIds.includes(id) && (
                    <p className="mt-1 text-xs text-red-400">ID already exists</p>
                )}
            </FormField>

            <FormField label="Provider" required>
                <SelectInput
                    value={provider}
                    onChange={(v) => {
                        setProvider(v);
                        setModel(''); // Reset model when provider changes
                    }}
                    options={LLM_PROVIDERS}
                />
            </FormField>

            <FormField label="Model" hint="Leave empty to use provider default">
                <SelectInput
                    value={model}
                    onChange={setModel}
                    options={PROVIDER_MODELS[provider] || []}
                    placeholder="Select model..."
                />
            </FormField>

            <FormField label="API Key" hint="Use ${ENV_VAR} for environment variables">
                <TextInput
                    value={apiKey}
                    onChange={setApiKey}
                    placeholder="e.g., ${OPENAI_API_KEY}"
                    type="password"
                />
            </FormField>

            <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-sm text-gray-400 hover:text-white transition-colors"
            >
                {showAdvanced ? '▼ Hide advanced' : '▶ Show advanced'}
            </button>

            {showAdvanced && (
                <>
                    <FormField label="Base URL" hint="Custom API endpoint (leave empty for default)">
                        <TextInput
                            value={baseUrl}
                            onChange={setBaseUrl}
                            placeholder="e.g., http://localhost:11434"
                        />
                    </FormField>

                    <FormField label="Temperature" hint="0.0 to 2.0, controls randomness">
                        <TextInput
                            value={temperature}
                            onChange={setTemperature}
                            placeholder="e.g., 0.7"
                            type="number"
                        />
                    </FormField>

                    <FormField label="Max Tokens" hint="Maximum response length">
                        <TextInput
                            value={maxTokens}
                            onChange={setMaxTokens}
                            placeholder="e.g., 4096"
                            type="number"
                        />
                    </FormField>

                    <FormField label="Max Tool Output Length" hint="Truncate tool outputs (0 = unlimited)">
                        <TextInput
                            value={maxToolOutputLength}
                            onChange={setMaxToolOutputLength}
                            placeholder="e.g., 10000"
                            type="number"
                        />
                    </FormField>

                    {supportsThinking && (
                        <div className="space-y-3 p-3 bg-white/5 rounded-lg">
                            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Extended Thinking (Claude)</div>
                            <ToggleInput
                                checked={thinkingEnabled}
                                onChange={setThinkingEnabled}
                                label="Enable Extended Thinking"
                            />
                            {thinkingEnabled && (
                                <FormField label="Thinking Budget" hint="Token budget for thinking">
                                    <TextInput
                                        value={thinkingBudget}
                                        onChange={setThinkingBudget}
                                        placeholder="e.g., 1024"
                                        type="number"
                                    />
                                </FormField>
                            )}
                        </div>
                    )}
                </>
            )}
        </ResourceModal>
    );
};
