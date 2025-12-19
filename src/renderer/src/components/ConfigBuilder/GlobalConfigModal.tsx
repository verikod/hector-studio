import React, { useState, useEffect } from 'react';
import { ResourceModal, FormField, TextInput, SelectInput, ToggleInput } from './ResourceModal';
import { parseConfig, serializeConfig } from '../../lib/config-utils';
import { useStore } from '../../store/useStore';
import { Database, Activity } from 'lucide-react';

interface GlobalConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const GlobalConfigModal: React.FC<GlobalConfigModalProps> = ({
    isOpen,
    onClose,
}) => {
    const yamlContent = useStore((s) => s.studioYamlContent);
    const setYamlContent = useStore((s) => s.setStudioYamlContent);

    const [activeTab, setActiveTab] = useState<'storage' | 'observability'>('storage');
    const [databaseOptions, setDatabaseOptions] = useState<string[]>([]);
    const [embedderOptions, setEmbedderOptions] = useState<string[]>([]);

    // Storage State
    const [tasksBackend, setTasksBackend] = useState('memory');
    const [tasksDb, setTasksDb] = useState('');
    const [sessionsBackend, setSessionsBackend] = useState('memory');
    const [sessionsDb, setSessionsDb] = useState('');
    const [memoryBackend, setMemoryBackend] = useState('memory');
    const [memoryEmbedder, setMemoryEmbedder] = useState('');
    const [memoryDb, setMemoryDb] = useState('');
    const [memoryVectorType, setMemoryVectorType] = useState('chromem');
    const [memoryChromemPath, setMemoryChromemPath] = useState('');
    const [memoryChromemCompress, setMemoryChromemCompress] = useState(false);

    const [checkpointEnabled, setCheckpointEnabled] = useState(false);
    const [checkpointBackend, setCheckpointBackend] = useState('memory');
    const [checkpointDb, setCheckpointDb] = useState('');
    const [checkpointStrategy, setCheckpointStrategy] = useState('event');
    const [checkpointInterval, setCheckpointInterval] = useState('5');
    const [checkpointAfterTools, setCheckpointAfterTools] = useState(false);
    const [checkpointBeforeLLM, setCheckpointBeforeLLM] = useState(false);
    const [checkpointAutoResume, setCheckpointAutoResume] = useState(false);
    const [checkpointTimeout, setCheckpointTimeout] = useState('3600');

    // Observability State
    const [metricsEnabled, setMetricsEnabled] = useState(false);
    const [tracingEnabled, setTracingEnabled] = useState(false);
    const [tracingExporter, setTracingExporter] = useState('otlp');
    const [tracingEndpoint, setTracingEndpoint] = useState('');
    const [samplingRate, setSamplingRate] = useState('1.0');

    useEffect(() => {
        if (isOpen) {
            const config = parseConfig(yamlContent);

            // Storage
            setTasksBackend(config.storage?.tasks?.backend || 'memory');
            setTasksDb(config.storage?.tasks?.database || '');
            setSessionsBackend(config.storage?.sessions?.backend || 'memory');
            setSessionsDb(config.storage?.sessions?.database || '');
            setMemoryBackend(config.storage?.memory?.backend || 'memory');
            setMemoryEmbedder(config.storage?.memory?.embedder || '');
            setMemoryDb(config.storage?.memory?.database || '');
            setMemoryVectorType(config.storage?.memory?.vector_provider?.type || 'chromem');
            setMemoryChromemPath(config.storage?.memory?.vector_provider?.chromem?.persist_path || '');
            setMemoryChromemCompress(config.storage?.memory?.vector_provider?.chromem?.compress || false);

            setCheckpointEnabled(config.storage?.checkpoint?.enabled || false);
            setCheckpointBackend(config.storage?.checkpoint?.backend || 'memory');
            setCheckpointDb(config.storage?.checkpoint?.database || '');
            setCheckpointStrategy(config.storage?.checkpoint?.strategy || 'event');
            setCheckpointInterval(config.storage?.checkpoint?.interval?.toString() || '5');
            setCheckpointAfterTools(config.storage?.checkpoint?.after_tools || false);
            setCheckpointBeforeLLM(config.storage?.checkpoint?.before_llm || false);
            setCheckpointAutoResume(config.storage?.checkpoint?.recovery?.auto_resume || false);
            setCheckpointTimeout(config.storage?.checkpoint?.recovery?.timeout?.toString() || '3600');

            // Observability
            setMetricsEnabled(config.observability?.metrics?.enabled || false);
            setTracingEnabled(config.observability?.tracing?.enabled || false);
            setTracingExporter(config.observability?.tracing?.exporter || 'otlp');
            setTracingEndpoint(config.observability?.tracing?.endpoint || '');
            setSamplingRate(config.observability?.tracing?.sampling_rate?.toString() || '1.0');

            // Databases
            setDatabaseOptions(Object.keys(config.databases || {}));
            setEmbedderOptions(Object.keys(config.embedders || {}));
        }
    }, [isOpen, yamlContent]);

    const handleSave = () => {
        const config = parseConfig(yamlContent);

        // Update Storage
        const memoryConfig: any = { backend: memoryBackend };
        if (memoryBackend !== 'memory' && memoryDb) memoryConfig.database = memoryDb;
        if (memoryBackend === 'vector') {
            memoryConfig.embedder = memoryEmbedder || undefined;
            if (memoryVectorType === 'chromem') {
                memoryConfig.vector_provider = {
                    type: 'chromem',
                    chromem: {
                        persist_path: memoryChromemPath || undefined,
                        compress: memoryChromemCompress || undefined,
                    }
                };
            } else {
                memoryConfig.vector_provider = { type: memoryVectorType };
            }
        }

        const checkpointConfig: any = {
            enabled: checkpointEnabled,
            backend: checkpointBackend,
        };
        if (checkpointBackend !== 'memory' && checkpointDb) checkpointConfig.database = checkpointDb;
        if (checkpointEnabled) {
            checkpointConfig.strategy = checkpointStrategy;
            if (checkpointStrategy !== 'event') checkpointConfig.interval = parseInt(checkpointInterval);
            checkpointConfig.after_tools = checkpointAfterTools;
            checkpointConfig.before_llm = checkpointBeforeLLM;
            checkpointConfig.recovery = {
                auto_resume: checkpointAutoResume,
                timeout: parseInt(checkpointTimeout),
            };
        }

        config.storage = {
            tasks: { backend: tasksBackend, ...(tasksBackend !== 'memory' && tasksDb ? { database: tasksDb } : {}) },
            sessions: { backend: sessionsBackend, ...(sessionsBackend !== 'memory' && sessionsDb ? { database: sessionsDb } : {}) },
            memory: memoryConfig,
            checkpoint: checkpointConfig,
        };

        // Update Observability
        const obsConfig: any = {};
        if (metricsEnabled) {
            obsConfig.metrics = { enabled: true };
        }
        if (tracingEnabled) {
            obsConfig.tracing = {
                enabled: true,
                exporter: tracingExporter,
                endpoint: tracingEndpoint || undefined,
                sampling_rate: parseFloat(samplingRate),
            };
        }

        if (Object.keys(obsConfig).length > 0) {
            config.observability = obsConfig;
        } else {
            delete config.observability;
        }

        setYamlContent(serializeConfig(config));
        onClose();
    };

    const dbSelectOptions = databaseOptions.map(db => ({ value: db, label: db }));
    const embedderSelectOptions = embedderOptions.map(e => ({ value: e, label: e }));
    const backendOptions = [
        { value: 'memory', label: 'In-Memory' },
        { value: 'sql', label: 'SQL Database' },
    ];

    return (
        <ResourceModal
            isOpen={isOpen}
            onClose={onClose}
            title="Global Configuration"
            onSave={handleSave}
            saveLabel="Save Configuration"
        >
            <div className="flex border-b border-white/10 mb-4">
                <button
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'storage'
                        ? 'border-hector-green text-white'
                        : 'border-transparent text-gray-400 hover:text-white'
                        }`}
                    onClick={() => setActiveTab('storage')}
                >
                    <Database size={16} />
                    Storage
                </button>
                <button
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'observability'
                        ? 'border-hector-green text-white'
                        : 'border-transparent text-gray-400 hover:text-white'
                        }`}
                    onClick={() => setActiveTab('observability')}
                >
                    <Activity size={16} />
                    Observability
                </button>
            </div>

            {activeTab === 'storage' && (
                <div className="space-y-6">
                    {/* Tasks */}
                    <div className="space-y-3">
                        <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Tasks</div>
                        <FormField label="Backend">
                            <SelectInput
                                value={tasksBackend}
                                onChange={setTasksBackend}
                                options={backendOptions}
                            />
                        </FormField>
                        {tasksBackend !== 'memory' && (
                            <FormField label="Database">
                                <SelectInput
                                    value={tasksDb}
                                    onChange={setTasksDb}
                                    options={dbSelectOptions}
                                    placeholder="Select a configured database..."
                                />
                            </FormField>
                        )}
                    </div>

                    {/* Sessions */}
                    <div className="space-y-3 pt-4 border-t border-white/10">
                        <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Sessions</div>
                        <FormField label="Backend">
                            <SelectInput
                                value={sessionsBackend}
                                onChange={setSessionsBackend}
                                options={backendOptions}
                            />
                        </FormField>
                        {sessionsBackend !== 'memory' && (
                            <FormField label="Database">
                                <SelectInput
                                    value={sessionsDb}
                                    onChange={setSessionsDb}
                                    options={dbSelectOptions}
                                    placeholder="Select a configured database..."
                                />
                            </FormField>
                        )}
                    </div>

                    {/* Memory */}
                    <div className="space-y-3 pt-4 border-t border-white/10">
                        <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Memory</div>
                        <FormField label="Backend">
                            <SelectInput
                                value={memoryBackend}
                                onChange={setMemoryBackend}
                                options={[
                                    { value: 'keyword', label: 'Keyword (Simple)' },
                                    { value: 'vector', label: 'Vector (Semantic)' },
                                ]}
                            />
                        </FormField>

                        {memoryBackend === 'vector' && (
                            <>
                                <FormField label="Embedder" required>
                                    <SelectInput
                                        value={memoryEmbedder}
                                        onChange={setMemoryEmbedder}
                                        options={embedderSelectOptions}
                                        placeholder="Select an embedder..."
                                    />
                                </FormField>
                                <FormField label="Vector Provider">
                                    <SelectInput
                                        value={memoryVectorType}
                                        onChange={setMemoryVectorType}
                                        options={[
                                            { value: 'chromem', label: 'Chromem (In-memory/File)' },
                                            { value: 'qdrant', label: 'Qdrant (External)' },
                                        ]}
                                    />
                                </FormField>
                                {memoryVectorType === 'chromem' && (
                                    <>
                                        <FormField label="Persist Path" hint="Path for vector storage">
                                            <TextInput
                                                value={memoryChromemPath}
                                                onChange={setMemoryChromemPath}
                                                placeholder=".hector/vectors"
                                            />
                                        </FormField>
                                        <ToggleInput
                                            checked={memoryChromemCompress}
                                            onChange={setMemoryChromemCompress}
                                            label="Enable Compression"
                                        />
                                    </>
                                )}
                            </>
                        )}
                    </div>

                    {/* Checkpoint */}
                    <div className="space-y-3 pt-4 border-t border-white/10">
                        <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Checkpoint & Recovery</div>
                        <ToggleInput
                            checked={checkpointEnabled}
                            onChange={setCheckpointEnabled}
                            label="Enable Checkpointing"
                        />

                        {checkpointEnabled && (
                            <>
                                <FormField label="Backend">
                                    <SelectInput
                                        value={checkpointBackend}
                                        onChange={setCheckpointBackend}
                                        options={backendOptions}
                                    />
                                </FormField>
                                {checkpointBackend !== 'memory' && (
                                    <FormField label="Database">
                                        <SelectInput
                                            value={checkpointDb}
                                            onChange={setCheckpointDb}
                                            options={dbSelectOptions}
                                            placeholder="Select a configured database..."
                                        />
                                    </FormField>
                                )}

                                <FormField label="Strategy">
                                    <SelectInput
                                        value={checkpointStrategy}
                                        onChange={setCheckpointStrategy}
                                        options={[
                                            { value: 'event', label: 'Every Event' },
                                            { value: 'interval', label: 'Fixed Interval' },
                                            { value: 'hybrid', label: 'Hybrid' },
                                        ]}
                                    />
                                </FormField>

                                {checkpointStrategy !== 'event' && (
                                    <FormField label="Interval" hint="Checkpoints every N steps">
                                        <TextInput
                                            value={checkpointInterval}
                                            onChange={setCheckpointInterval}
                                            type="number"
                                            placeholder="5"
                                        />
                                    </FormField>
                                )}

                                <div className="grid grid-cols-2 gap-4">
                                    <ToggleInput
                                        checked={checkpointAfterTools}
                                        onChange={setCheckpointAfterTools}
                                        label="After Tools"
                                    />
                                    <ToggleInput
                                        checked={checkpointBeforeLLM}
                                        onChange={setCheckpointBeforeLLM}
                                        label="Before LLM Call"
                                    />
                                </div>

                                <div className="pt-2 border-t border-white/5">
                                    <div className="text-xs text-gray-400 mb-2">Recovery</div>
                                    <ToggleInput
                                        checked={checkpointAutoResume}
                                        onChange={setCheckpointAutoResume}
                                        label="Auto Resume"
                                    />
                                    <FormField label="Recovery Timeout" hint="Seconds to wait (0 = infinite)">
                                        <TextInput
                                            value={checkpointTimeout}
                                            onChange={setCheckpointTimeout}
                                            type="number"
                                            placeholder="3600"
                                        />
                                    </FormField>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'observability' && (
                <div className="space-y-6">
                    {/* Metrics */}
                    <div className="space-y-3">
                        <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Metrics</div>
                        <ToggleInput
                            checked={metricsEnabled}
                            onChange={setMetricsEnabled}
                            label="Enable Prometheus Metrics"
                        />
                    </div>

                    {/* Tracing */}
                    <div className="space-y-3 pt-4 border-t border-white/10">
                        <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Tracing</div>
                        <ToggleInput
                            checked={tracingEnabled}
                            onChange={setTracingEnabled}
                            label="Enable OpenTelemetry Tracing"
                        />
                        {tracingEnabled && (
                            <>
                                <FormField label="Exporter">
                                    <SelectInput
                                        value={tracingExporter}
                                        onChange={setTracingExporter}
                                        options={[
                                            { value: 'otlp', label: 'OTLP (gRPC)' },
                                            { value: 'jaeger', label: 'Jaeger' },
                                            { value: 'zipkin', label: 'Zipkin' },
                                            { value: 'stdout', label: 'Standard Output' },
                                        ]}
                                    />
                                </FormField>
                                <FormField label="Endpoint" hint="e.g., localhost:4317">
                                    <TextInput
                                        value={tracingEndpoint}
                                        onChange={setTracingEndpoint}
                                        placeholder="localhost:4317"
                                    />
                                </FormField>
                                <FormField label="Sampling Rate" hint="0.0 to 1.0">
                                    <TextInput
                                        value={samplingRate}
                                        onChange={setSamplingRate}
                                        type="number"
                                        placeholder="1.0"
                                    />
                                </FormField>
                            </>
                        )}
                    </div>
                </div>
            )}
        </ResourceModal>
    );
};
