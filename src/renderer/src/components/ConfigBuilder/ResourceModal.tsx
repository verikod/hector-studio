import React from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ResourceModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    onSave: () => void;
    saveDisabled?: boolean;
    saveLabel?: string;
}

export const ResourceModal: React.FC<ResourceModalProps> = ({
    isOpen,
    onClose,
    title,
    children,
    onSave,
    saveDisabled = false,
    saveLabel = 'Save',
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div
                className="bg-hector-darker border border-white/10 rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                    <h2 className="text-lg font-semibold text-white">{title}</h2>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-white/10 rounded transition-colors"
                    >
                        <X size={20} className="text-gray-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 min-h-[400px]">
                    {children}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 px-6 py-4 border-t border-white/10">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onSave}
                        disabled={saveDisabled}
                        className={cn(
                            "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                            saveDisabled
                                ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                                : "bg-hector-green hover:bg-hector-green/80 text-white"
                        )}
                    >
                        {saveLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};

// Reusable form field components
interface FormFieldProps {
    label: string;
    required?: boolean;
    hint?: string;
    children: React.ReactNode;
}

export const FormField: React.FC<FormFieldProps> = ({ label, required, hint, children }) => (
    <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">
            {label}{required && <span className="text-red-400 ml-1">*</span>}
        </label>
        {children}
        {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
);

interface TextInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    type?: 'text' | 'password' | 'number';
    className?: string;
}

export const TextInput: React.FC<TextInputProps> = ({
    value,
    onChange,
    placeholder,
    type = 'text',
    className,
}) => (
    <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
            "w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white",
            "placeholder:text-gray-500 focus:outline-none focus:border-hector-green transition-colors",
            className
        )}
    />
);

interface SelectInputProps {
    value: string;
    onChange: (value: string) => void;
    options: Array<{ value: string; label: string }>;
    placeholder?: string;
}

export const SelectInput: React.FC<SelectInputProps> = ({
    value,
    onChange,
    options,
    placeholder,
}) => (
    <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-hector-green transition-colors"
    >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
                {opt.label}
            </option>
        ))}
    </select>
);

interface TextAreaInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    rows?: number;
}

export const TextAreaInput: React.FC<TextAreaInputProps> = ({
    value,
    onChange,
    placeholder,
    rows = 3,
}) => (
    <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-hector-green transition-colors resize-none"
    />
);

interface ToggleInputProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label: string;
}

export const ToggleInput: React.FC<ToggleInputProps> = ({ checked, onChange, label }) => (
    <label className="flex items-center gap-3 cursor-pointer">
        <div
            className={cn(
                "w-10 h-5 rounded-full transition-colors relative",
                checked ? "bg-hector-green" : "bg-white/10"
            )}
            onClick={() => onChange(!checked)}
        >
            <div
                className={cn(
                    "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform",
                    checked ? "translate-x-5" : "translate-x-0.5"
                )}
            />
        </div>
        <span className="text-sm text-gray-300">{label}</span>
    </label>
);
