import React, { useState, useEffect } from 'react';
import { ResourceModal, FormField, TextInput, SelectInput, ToggleInput } from './ResourceModal';
import type { DatabaseConfig, EmbedderConfig, VectorStoreConfig, DocumentStoreConfig } from '../../lib/config-utils';

// Database Modal
interface DatabaseModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (id: string, config: DatabaseConfig) => void;
    existingIds: string[];
    editId?: string | null;
    editConfig?: DatabaseConfig | null;
}

export const DatabaseModal: React.FC<DatabaseModalProps> = ({
    isOpen,
    onClose,
    onSave,
    existingIds,
    editId,
    editConfig,
}) => {
    const isEditing = !!editId;

    const [id, setId] = useState('');
    const [driver, setDriver] = useState('postgres');
    const [host, setHost] = useState('');
    const [port, setPort] = useState('');
    const [database, setDatabase] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    useEffect(() => {
        if (isOpen) {
            if (isEditing && editConfig) {
                setId(editId);
                setDriver(editConfig.driver || 'postgres');
                setHost(editConfig.host || '');
                setPort(editConfig.port?.toString() || '');
                setDatabase(editConfig.database || '');
                setUsername(editConfig.username || '');
                setPassword(editConfig.password || '');
            } else {
                setId('');
                setDriver('postgres');
                setHost('');
                setPort('');
                setDatabase('');
                setUsername('');
                setPassword('');
            }
        }
    }, [isOpen, isEditing, editId, editConfig]);

    const handleSave = () => {
        onSave(id, {
            driver,
            host: host || undefined,
            port: port ? parseInt(port) : undefined,
            database: database || undefined,
            username: username || undefined,
            password: password || undefined,
        });
        onClose();
    };

    const isValid = id && !(!isEditing && existingIds.includes(id));
    const isSqlite = driver === 'sqlite' || driver === 'sqlite3';

    return (
        <ResourceModal
            isOpen={isOpen}
            onClose={onClose}
            title={isEditing ? `Edit Database: ${editId}` : 'Add Database'}
            onSave={handleSave}
            saveDisabled={!isValid}
        >
            <FormField label="ID" required>
                <TextInput value={id} onChange={setId} placeholder="e.g., main, analytics" />
            </FormField>

            <FormField label="Driver">
                <SelectInput
                    value={driver}
                    onChange={setDriver}
                    options={[
                        { value: 'postgres', label: 'PostgreSQL' },
                        { value: 'mysql', label: 'MySQL' },
                        { value: 'sqlite', label: 'SQLite' },
                    ]}
                />
            </FormField>

            {isSqlite ? (
                <FormField label="Database File" hint="Path to SQLite file">
                    <TextInput value={database} onChange={setDatabase} placeholder="./data.db" />
                </FormField>
            ) : (
                <>
                    <FormField label="Host">
                        <TextInput value={host} onChange={setHost} placeholder="localhost" />
                    </FormField>
                    <FormField label="Port">
                        <TextInput value={port} onChange={setPort} placeholder={driver === 'postgres' ? '5432' : '3306'} />
                    </FormField>
                    <FormField label="Database">
                        <TextInput value={database} onChange={setDatabase} placeholder="mydb" />
                    </FormField>
                    <FormField label="Username" hint="Use ${ENV_VAR} for secrets">
                        <TextInput value={username} onChange={setUsername} placeholder="${DB_USER}" />
                    </FormField>
                    <FormField label="Password" hint="Use ${ENV_VAR} for secrets">
                        <TextInput value={password} onChange={setPassword} placeholder="${DB_PASSWORD}" type="password" />
                    </FormField>
                </>
            )}
        </ResourceModal>
    );
};


// Embedder Modal
interface EmbedderModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (id: string, config: EmbedderConfig) => void;
    existingIds: string[];
    editId?: string | null;
    editConfig?: EmbedderConfig | null;
}

export const EmbedderModal: React.FC<EmbedderModalProps> = ({
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
    const [dimension, setDimension] = useState('');

    useEffect(() => {
        if (isOpen) {
            if (isEditing && editConfig) {
                setId(editId);
                setProvider(editConfig.provider || 'openai');
                setModel(editConfig.model || '');
                setApiKey(editConfig.api_key || '');
                setBaseUrl(editConfig.base_url || '');
                setDimension(editConfig.dimension?.toString() || '');
            } else {
                setId('');
                setProvider('openai');
                setModel('');
                setApiKey('');
                setBaseUrl('');
                setDimension('');
            }
        }
    }, [isOpen, isEditing, editId, editConfig]);

    const handleSave = () => {
        onSave(id, {
            provider,
            model: model || undefined,
            api_key: apiKey || undefined,
            base_url: baseUrl || undefined,
            dimension: dimension ? parseInt(dimension) : undefined,
        });
        onClose();
    };

    const isValid = id && !(!isEditing && existingIds.includes(id));

    return (
        <ResourceModal
            isOpen={isOpen}
            onClose={onClose}
            title={isEditing ? `Edit Embedder: ${editId}` : 'Add Embedder'}
            onSave={handleSave}
            saveDisabled={!isValid}
        >
            <FormField label="ID" required>
                <TextInput value={id} onChange={setId} placeholder="e.g., default" />
            </FormField>

            <FormField label="Provider">
                <SelectInput
                    value={provider}
                    onChange={setProvider}
                    options={[
                        { value: 'openai', label: 'OpenAI' },
                        { value: 'ollama', label: 'Ollama' },
                        { value: 'cohere', label: 'Cohere' },
                        { value: 'voyage', label: 'Voyage' },
                    ]}
                />
            </FormField>

            <FormField label="Model">
                <TextInput value={model} onChange={setModel} placeholder="e.g., text-embedding-3-small" />
            </FormField>

            <FormField label="API Key" hint="Use ${ENV_VAR} for env variables">
                <TextInput value={apiKey} onChange={setApiKey} placeholder="${OPENAI_API_KEY}" type="password" />
            </FormField>

            <FormField label="Base URL" hint="Custom endpoint (leave empty for default)">
                <TextInput value={baseUrl} onChange={setBaseUrl} placeholder="http://localhost:11434" />
            </FormField>

            <FormField label="Dimension" hint="Embedding dimension (leave empty for model default)">
                <TextInput value={dimension} onChange={setDimension} placeholder="e.g., 1536" type="number" />
            </FormField>
        </ResourceModal>
    );
};


// Vector Store Modal
interface VectorStoreModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (id: string, config: VectorStoreConfig) => void;
    existingIds: string[];
    editId?: string | null;
    editConfig?: VectorStoreConfig | null;
}

export const VectorStoreModal: React.FC<VectorStoreModalProps> = ({
    isOpen,
    onClose,
    onSave,
    existingIds,
    editId,
    editConfig,
}) => {
    const isEditing = !!editId;

    const [id, setId] = useState('');
    const [type, setType] = useState('chromem');
    const [host, setHost] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [collection, setCollection] = useState('');

    useEffect(() => {
        if (isOpen) {
            if (isEditing && editConfig) {
                setId(editId);
                setType(editConfig.type || 'chromem');
                setHost(editConfig.host || '');
                setApiKey(editConfig.api_key || '');
                setCollection(editConfig.collection || '');
            } else {
                setId('');
                setType('chromem');
                setHost('');
                setApiKey('');
                setCollection('');
            }
        }
    }, [isOpen, isEditing, editId, editConfig]);

    const handleSave = () => {
        onSave(id, {
            type,
            host: host || undefined,
            api_key: apiKey || undefined,
            collection: collection || undefined
        });
        onClose();
    };

    const isValid = id && !(!isEditing && existingIds.includes(id));

    return (
        <ResourceModal
            isOpen={isOpen}
            onClose={onClose}
            title={isEditing ? `Edit Vector Store: ${editId}` : 'Add Vector Store'}
            onSave={handleSave}
            saveDisabled={!isValid}
        >
            <FormField label="ID" required>
                <TextInput value={id} onChange={setId} placeholder="e.g., default" />
            </FormField>

            <FormField label="Type">
                <SelectInput
                    value={type}
                    onChange={setType}
                    options={[
                        { value: 'chromem', label: 'Chromem (In-memory)' },
                        { value: 'qdrant', label: 'Qdrant' },
                        { value: 'pinecone', label: 'Pinecone' },
                        { value: 'milvus', label: 'Milvus' },
                        { value: 'weaviate', label: 'Weaviate' },
                    ]}
                />
            </FormField>

            {type !== 'chromem' && (
                <>
                    <FormField label="Host" hint="Server URL">
                        <TextInput value={host} onChange={setHost} placeholder="http://localhost:6333" />
                    </FormField>
                    <FormField label="API Key" hint="Use ${ENV_VAR} for secrets">
                        <TextInput value={apiKey} onChange={setApiKey} placeholder="${VECTOR_STORE_API_KEY}" type="password" />
                    </FormField>
                </>
            )}

            <FormField label="Collection">
                <TextInput value={collection} onChange={setCollection} placeholder="documents" />
            </FormField>
        </ResourceModal>
    );
};

// Document Store Modal (simplified)
interface DocumentStoreModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (id: string, config: DocumentStoreConfig) => void;
    existingIds: string[];
    embedderOptions: string[];
    vectorStoreOptions: string[];
    editId?: string | null;
    editConfig?: DocumentStoreConfig | null;
}

export const DocumentStoreModal: React.FC<DocumentStoreModalProps> = ({
    isOpen,
    onClose,
    onSave,
    existingIds,
    embedderOptions,
    vectorStoreOptions,
    editId,
    editConfig,
}) => {
    const isEditing = !!editId;

    const [id, setId] = useState('');
    const [embedder, setEmbedder] = useState('');
    const [vectorStore, setVectorStore] = useState('');
    const [directoryPath, setDirectoryPath] = useState('');
    const [chunkSize, setChunkSize] = useState('1000');
    const [watch, setWatch] = useState(true);
    const [incrementalIndexing, setIncrementalIndexing] = useState(true);

    useEffect(() => {
        if (isOpen) {
            if (isEditing && editConfig) {
                setId(editId);
                setEmbedder(editConfig.embedder || '');
                setVectorStore(editConfig.vector_store || '');
                setDirectoryPath(editConfig.source?.path || '');
                setChunkSize(editConfig.chunking?.size?.toString() || '1000');
                setWatch(editConfig.watch !== false);
                setIncrementalIndexing(editConfig.incremental_indexing !== false);
            } else {
                setId('');
                setEmbedder(embedderOptions[0] || '');
                setVectorStore(vectorStoreOptions[0] || '');
                setDirectoryPath('');
                setChunkSize('1000');
                setWatch(true);
                setIncrementalIndexing(true);
            }
        }
    }, [isOpen, isEditing, editId, editConfig, embedderOptions, vectorStoreOptions]);

    const handleSave = () => {
        const config: DocumentStoreConfig = {
            embedder: embedder || undefined,
            vector_store: vectorStore || undefined,
            watch,
            incremental_indexing: incrementalIndexing,
        };

        if (directoryPath) {
            config.source = {
                type: 'directory',
                path: directoryPath,
            };
        }

        config.chunking = {
            size: parseInt(chunkSize) || 1000,
            overlap: 200,
            strategy: 'overlapping',
        };

        onSave(id, config);
        onClose();
    };

    const isValid = id && !(!isEditing && existingIds.includes(id));

    return (
        <ResourceModal
            isOpen={isOpen}
            onClose={onClose}
            title={isEditing ? `Edit Document Store: ${editId}` : 'Add Document Store'}
            onSave={handleSave}
            saveDisabled={!isValid}
        >
            <FormField label="ID" required>
                <TextInput value={id} onChange={setId} placeholder="e.g., docs, knowledge" />
            </FormField>

            <FormField label="Embedder">
                <SelectInput
                    value={embedder}
                    onChange={setEmbedder}
                    options={embedderOptions.map(e => ({ value: e, label: e }))}
                    placeholder="Select embedder..."
                />
            </FormField>

            <FormField label="Vector Store">
                <SelectInput
                    value={vectorStore}
                    onChange={setVectorStore}
                    options={vectorStoreOptions.map(v => ({ value: v, label: v }))}
                    placeholder="Select vector store..."
                />
            </FormField>

            <FormField label="Directory Path" hint="Path to documents folder">
                <TextInput value={directoryPath} onChange={setDirectoryPath} placeholder="./docs" />
            </FormField>

            <FormField label="Chunk Size" hint="Characters per chunk">
                <TextInput value={chunkSize} onChange={setChunkSize} placeholder="1000" type="number" />
            </FormField>

            <ToggleInput
                checked={watch}
                onChange={setWatch}
                label="Watch for Changes"
            />

            <ToggleInput
                checked={incrementalIndexing}
                onChange={setIncrementalIndexing}
                label="Incremental Indexing"
            />
        </ResourceModal>
    );
};

