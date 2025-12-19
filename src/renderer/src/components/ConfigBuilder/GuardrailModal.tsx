import React, { useState, useEffect } from 'react';
import { ResourceModal, FormField, TextInput, SelectInput, ToggleInput } from './ResourceModal';
import type { GuardrailConfig } from '../../lib/config-utils';

interface GuardrailModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (id: string, config: GuardrailConfig) => void;
    existingIds: string[];
    editId?: string | null;
    editConfig?: GuardrailConfig | null;
}

export const GuardrailModal: React.FC<GuardrailModalProps> = ({
    isOpen,
    onClose,
    onSave,
    existingIds,
    editId,
    editConfig,
}) => {
    const isEditing = !!editId;

    const [id, setId] = useState('');
    const [enabled, setEnabled] = useState(true);

    // Input validations
    const [inputLength, setInputLength] = useState(false);
    const [inputMaxLength, setInputMaxLength] = useState('10000');
    const [inputInjection, setInputInjection] = useState(false);
    const [inputSanitizer, setInputSanitizer] = useState(false);

    // Output validations
    const [outputPII, setOutputPII] = useState(false);
    const [detectEmail, setDetectEmail] = useState(true);
    const [detectPhone, setDetectPhone] = useState(true);
    const [redactMode, setRedactMode] = useState('mask');

    useEffect(() => {
        if (isOpen) {
            if (isEditing && editConfig) {
                setId(editId);
                setEnabled(editConfig.enabled !== false);
                setInputLength(editConfig.input?.length?.enabled || false);
                setInputMaxLength(editConfig.input?.length?.max_length?.toString() || '10000');
                setInputInjection(editConfig.input?.injection?.enabled || false);
                setInputSanitizer(editConfig.input?.sanitizer?.enabled || false);
                setOutputPII(editConfig.output?.pii?.enabled || false);
                setDetectEmail(editConfig.output?.pii?.detect_email !== false);
                setDetectPhone(editConfig.output?.pii?.detect_phone !== false);
                setRedactMode(editConfig.output?.pii?.redact_mode || 'mask');
            } else {
                setId('');
                setEnabled(true);
                setInputLength(false);
                setInputMaxLength('10000');
                setInputInjection(false);
                setInputSanitizer(false);
                setOutputPII(false);
                setDetectEmail(true);
                setDetectPhone(true);
                setRedactMode('mask');
            }
        }
    }, [isOpen, isEditing, editId, editConfig]);

    const handleSave = () => {
        const config: GuardrailConfig = {
            enabled,
        };

        // Build input object if any input validations enabled
        if (inputLength || inputInjection || inputSanitizer) {
            config.input = {
                chain_mode: 'all',
            };
            if (inputLength) {
                config.input.length = { enabled: true, max_length: parseInt(inputMaxLength) };
            }
            if (inputInjection) {
                config.input.injection = { enabled: true };
            }
            if (inputSanitizer) {
                config.input.sanitizer = { enabled: true, trim_whitespace: true };
            }
        }

        // Build output object if PII enabled
        if (outputPII) {
            config.output = {
                pii: {
                    enabled: true,
                    detect_email: detectEmail,
                    detect_phone: detectPhone,
                    redact_mode: redactMode,
                },
            };
        }

        onSave(id, config);
        onClose();
    };

    const isValid = id && !(!isEditing && existingIds.includes(id));

    return (
        <ResourceModal
            isOpen={isOpen}
            onClose={onClose}
            title={isEditing ? `Edit Guardrail: ${editId}` : 'Add Guardrail'}
            onSave={handleSave}
            saveDisabled={!isValid}
        >
            <FormField label="ID" required hint="Unique identifier for this guardrail">
                <TextInput
                    value={id}
                    onChange={setId}
                    placeholder="e.g., default, strict"
                />
            </FormField>

            <ToggleInput
                checked={enabled}
                onChange={setEnabled}
                label="Enabled"
            />

            {/* Input Validations */}
            <div className="pt-2 border-t border-white/10">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
                    Input Validations
                </div>

                <div className="space-y-3">
                    <ToggleInput
                        checked={inputLength}
                        onChange={setInputLength}
                        label="Length check"
                    />
                    {inputLength && (
                        <FormField label="Max Length">
                            <TextInput
                                value={inputMaxLength}
                                onChange={setInputMaxLength}
                                placeholder="10000"
                                type="number"
                            />
                        </FormField>
                    )}

                    <ToggleInput
                        checked={inputInjection}
                        onChange={setInputInjection}
                        label="Injection detection"
                    />

                    <ToggleInput
                        checked={inputSanitizer}
                        onChange={setInputSanitizer}
                        label="Sanitize input"
                    />
                </div>
            </div>

            {/* Output Validations */}
            <div className="pt-2 border-t border-white/10">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
                    Output Validations
                </div>

                <div className="space-y-3">
                    <ToggleInput
                        checked={outputPII}
                        onChange={setOutputPII}
                        label="PII detection"
                    />

                    {outputPII && (
                        <>
                            <ToggleInput
                                checked={detectEmail}
                                onChange={setDetectEmail}
                                label="Detect emails"
                            />
                            <ToggleInput
                                checked={detectPhone}
                                onChange={setDetectPhone}
                                label="Detect phone numbers"
                            />
                            <FormField label="Redact Mode">
                                <SelectInput
                                    value={redactMode}
                                    onChange={setRedactMode}
                                    options={[
                                        { value: 'mask', label: 'Mask (****)' },
                                        { value: 'remove', label: 'Remove' },
                                        { value: 'hash', label: 'Hash' },
                                    ]}
                                />
                            </FormField>
                        </>
                    )}
                </div>
            </div>
        </ResourceModal>
    );
};
