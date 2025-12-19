import React, { useState, useEffect } from 'react';
import { ResourceModal, FormField, TextInput, SelectInput } from './ResourceModal';
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
    const [dsn, setDsn] = useState('');

    useEffect(() => {
        if (isOpen) {
            if (isEditing && editConfig) {
                setId(editId);
                setDriver(editConfig.driver || 'postgres');
                setDsn(editConfig.dsn || '');
            } else {
                setId('');
                setDriver('postgres');
                setDsn('');
            }
        }
    }, [isOpen, isEditing, editId, editConfig]);

    const handleSave = () => {
        onSave(id, { driver, dsn: dsn || undefined });
        onClose();
    };

    const isValid = id && !(!isEditing && existingIds.includes(id));

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

            <FormField label="Connection String (DSN)" hint="Use ${ENV_VAR} for env variables">
                <TextInput value={dsn} onChange={setDsn} placeholder="${DATABASE_URL}" type="password" />
            </FormField>
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

    useEffect(() => {
        if (isOpen) {
            if (isEditing && editConfig) {
                setId(editId);
                setProvider(editConfig.provider || 'openai');
                setModel(editConfig.model || '');
                setApiKey(editConfig.api_key || '');
            } else {
                setId('');
                setProvider('openai');
                setModel('');
                setApiKey('');
            }
        }
    }, [isOpen, isEditing, editId, editConfig]);

    const handleSave = () => {
        onSave(id, { provider, model: model || undefined, api_key: apiKey || undefined });
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
                    ]}
                />
            </FormField>

            <FormField label="Model">
                <TextInput value={model} onChange={setModel} placeholder="e.g., text-embedding-3-small" />
            </FormField>

            <FormField label="API Key" hint="Use ${ENV_VAR} for env variables">
                <TextInput value={apiKey} onChange={setApiKey} placeholder="${OPENAI_API_KEY}" type="password" />
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
    const [provider, setProvider] = useState('chromem');
    const [url, setUrl] = useState('');
    const [collection, setCollection] = useState('');

    useEffect(() => {
        if (isOpen) {
            if (isEditing && editConfig) {
                setId(editId);
                setProvider(editConfig.provider || 'chromem');
                setUrl(editConfig.url || '');
                setCollection(editConfig.collection || '');
            } else {
                setId('');
                setProvider('chromem');
                setUrl('');
                setCollection('');
            }
        }
    }, [isOpen, isEditing, editId, editConfig]);

    const handleSave = () => {
        onSave(id, {
            provider,
            url: url || undefined,
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

            <FormField label="Provider">
                <SelectInput
                    value={provider}
                    onChange={setProvider}
                    options={[
                        { value: 'chromem', label: 'Chromem (In-memory)' },
                        { value: 'qdrant', label: 'Qdrant' },
                        { value: 'pinecone', label: 'Pinecone' },
                        { value: 'milvus', label: 'Milvus' },
                        { value: 'weaviate', label: 'Weaviate' },
                    ]}
                />
            </FormField>

            {provider !== 'chromem' && (
                <FormField label="URL" hint="Server URL">
                    <TextInput value={url} onChange={setUrl} placeholder="http://localhost:6333" />
                </FormField>
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

    useEffect(() => {
        if (isOpen) {
            if (isEditing && editConfig) {
                setId(editId);
                setEmbedder(editConfig.embedder || '');
                setVectorStore(editConfig.vector_store || '');
                setDirectoryPath(editConfig.source?.directory?.path || '');
                setChunkSize(editConfig.chunker?.size?.toString() || '1000');
            } else {
                setId('');
                setEmbedder(embedderOptions[0] || '');
                setVectorStore(vectorStoreOptions[0] || '');
                setDirectoryPath('');
                setChunkSize('1000');
            }
        }
    }, [isOpen, isEditing, editId, editConfig, embedderOptions, vectorStoreOptions]);

    const handleSave = () => {
        const config: DocumentStoreConfig = {
            embedder: embedder || undefined,
            vector_store: vectorStore || undefined,
        };

        if (directoryPath) {
            config.source = {
                directory: { path: directoryPath, watch: true },
            };
        }

        config.chunker = {
            size: parseInt(chunkSize) || 1000,
            overlap: 200,
            strategy: 'recursive',
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
        </ResourceModal>
    );
};
