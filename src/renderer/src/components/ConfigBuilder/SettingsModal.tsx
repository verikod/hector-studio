import React, { useState, useEffect } from "react";
import { X, RefreshCw, FolderOpen, Key, Trash2, Zap, Palette, Globe } from "lucide-react";
import { useStore } from "../../store/useStore";
import { useServersStore } from "../../store/serversStore";
import { useLicenseStore } from "../../store/licenseStore";
import { cn } from "../../lib/utils";

import { useWorkspaceControl } from "../../lib/hooks/useWorkspaceControl";
import { useLicenseControl } from "../../lib/hooks/useLicenseControl";

// Port Configuration subcomponent
function PortConfiguration() {
  const [port, setPort] = useState<number | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.api.workspaces.getPort().then((p) => {
      setPort(p);
      setInputValue(p?.toString() || '');
    });
  }, []);

  const handleSave = async () => {
    const newPort = parseInt(inputValue, 10);
    if (isNaN(newPort) || newPort < 1024 || newPort > 65535) {
      setError('Port must be between 1024 and 65535');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await window.api.workspaces.setPort(newPort);
      setPort(newPort);
      useStore.getState().setSuccessMessage('Port updated. Restart workspace to apply.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const hasChanged = port !== null && inputValue !== port.toString();

  return (
    <div className="p-4 border border-white/10 rounded-lg bg-white/5">
      <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
        <Globe size={16} className="text-blue-400" />
        Default Port
      </label>
      <div className="flex gap-2">
        <input
          type="number"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="flex-1 px-3 py-2 bg-black/50 border border-white/20 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-hector-green focus:border-transparent"
          placeholder="e.g. 8080"
          min={1024}
          max={65535}
        />
        <button
          onClick={handleSave}
          disabled={!hasChanged || saving}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
            hasChanged
              ? "bg-hector-green hover:bg-hector-green/80 text-white"
              : "bg-white/5 text-gray-500 cursor-not-allowed"
          )}
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
      <p className="text-xs text-gray-500 mt-2">
        All workspaces share this port. Changes apply on next workspace start.
      </p>
    </div>
  );
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  editorTheme: 'vs-dark' | 'vs-light' | 'hc-black';
  onThemeChange: (theme: 'vs-dark' | 'vs-light' | 'hc-black') => void;
  workspacesEnabled?: boolean;
  onLicenseDeactivated?: () => void;
  isLicensed?: boolean;
}

type SettingsTab = 'general' | 'license' | 'workspaces';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  editorTheme,
  onThemeChange,
  onLicenseDeactivated,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  const streamingEnabled = useStore((state) => state.streamingEnabled);
  const setStreamingEnabled = useStore((state) => state.setStreamingEnabled);

  // Centralized state from stores
  const workspacesEnabled = useServersStore((s) => s.workspacesEnabled);

  // Select individual values to avoid creating new objects
  const licenseIsLicensed = useLicenseStore((s) => s.isLicensed);
  const licenseEmail = useLicenseStore((s) => s.email);
  const licenseKey = useLicenseStore((s) => s.key);

  const { enableAndSelect, disableWorkspaces, isLoading: controlLoading } = useWorkspaceControl();
  const { deactivate, isLoading: licenseLoading } = useLicenseControl();

  const handleDeactivate = async () => {
    try {
      await deactivate();
      onLicenseDeactivated?.();
    } catch (e) {
      // Error handled in hook
    }
  };

  if (!isOpen) return null;

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'general', label: 'General', icon: <Zap size={16} /> },
    { id: 'license', label: 'License', icon: <Key size={16} /> },
    { id: 'workspaces', label: 'Workspaces', icon: <FolderOpen size={16} /> },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
        <div
          className="bg-gradient-to-br from-hector-darker to-black border border-white/20 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col pointer-events-auto animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <svg
                className="w-5 h-5 text-hector-green"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              Settings
            </h2>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-white/10">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors",
                  activeTab === tab.id
                    ? "text-white border-b-2 border-hector-green bg-white/5"
                    : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 min-h-[400px]">
            {/* General Tab */}
            {activeTab === 'general' && (
              <div className="space-y-6">
                {/* Streaming */}
                <div>
                  <label className="flex items-center justify-between cursor-pointer group">
                    <div>
                      <div className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors flex items-center gap-2">
                        <Zap size={16} className="text-yellow-400" />
                        Streaming Responses
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        Enable real-time message streaming
                      </div>
                    </div>
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={streamingEnabled}
                        onChange={(e) => setStreamingEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-black/50 border border-white/20 rounded-full peer-checked:bg-hector-green peer-checked:border-hector-green transition-all"></div>
                      <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
                    </div>
                  </label>
                </div>

                {/* Editor Theme */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                    <Palette size={16} className="text-purple-400" />
                    Editor Theme
                  </label>
                  <select
                    value={editorTheme}
                    onChange={(e) => onThemeChange(e.target.value as any)}
                    className="w-full px-4 py-2 bg-black/50 border border-white/20 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-hector-green focus:border-transparent appearance-none cursor-pointer"
                  >
                    <option value="hc-black">High Contrast (Default)</option>
                    <option value="vs-dark">Dark Visual Studio</option>
                    <option value="vs-light">Light Visual Studio</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Color scheme for the YAML editor
                  </p>
                </div>

                {/* Updates */}
                <div className="pt-4 border-t border-white/10">
                  <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                    <RefreshCw size={16} className="text-blue-400" />
                    Application Updates
                  </label>
                  <button
                    onClick={() => window.api.app.checkUpdate()}
                    className="w-full px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/20 rounded-lg text-sm text-gray-300 transition-colors flex items-center justify-center gap-2"
                  >
                    <RefreshCw size={14} />
                    Check for Updates
                  </button>
                </div>
              </div>
            )}

            {/* License Tab */}
            {activeTab === 'license' && (
              <div className="space-y-4">
                {licenseIsLicensed ? (
                  <>
                    <div className="bg-hector-green/10 border border-hector-green/30 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-hector-green text-sm font-medium">
                        ✓ Studio Mode Active
                      </div>
                      {licenseEmail && (
                        <div className="text-xs text-gray-400 mt-1">{licenseEmail}</div>
                      )}
                      {licenseKey && (
                        <div className="mt-3 pt-3 border-t border-hector-green/20">
                          <div className="text-xs text-gray-500 mb-1">License Key (save this!):</div>
                          <div className="flex items-center gap-2">
                            <code className="text-xs text-gray-300 bg-black/30 px-2 py-1 rounded font-mono truncate flex-1">
                              {licenseKey}
                            </code>
                            <button
                              onClick={() => navigator.clipboard.writeText(licenseKey!)}
                              className="text-xs text-gray-400 hover:text-white px-2 py-1 bg-white/5 hover:bg-white/10 rounded transition-colors"
                            >
                              Copy
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={handleDeactivate}
                      disabled={licenseLoading}
                      className="w-full px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg text-sm text-red-400 transition-colors flex items-center justify-center gap-2"
                    >
                      <Trash2 size={14} />
                      {licenseLoading ? 'Deactivating...' : 'Deactivate License'}
                    </button>
                  </>
                ) : (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                    <div className="text-yellow-400 text-sm font-medium">
                      Chat Mode Only
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      Activate a license to unlock Studio Mode features including the visual config editor, canvas view, and local workspaces.
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Workspaces Tab */}
            {activeTab === 'workspaces' && (
              <div className="space-y-4">
                <label className={cn(
                  "flex items-center justify-between cursor-pointer group p-4 rounded-lg border transition-colors",
                  !licenseIsLicensed
                    ? "opacity-50 cursor-not-allowed border-white/10 bg-white/5"
                    : workspacesEnabled
                      ? "border-hector-green/30 bg-hector-green/5"
                      : "border-white/10 bg-white/5 hover:bg-white/10"
                )}>
                  <div>
                    <div className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors flex items-center gap-2">
                      <FolderOpen size={16} className="text-hector-green" />
                      Local Workspaces
                      {!licenseIsLicensed && (
                        <span className="text-xs text-yellow-500 ml-2">(License required)</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Run Hector locally with managed workspace directories
                    </div>
                  </div>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={workspacesEnabled}
                      disabled={controlLoading || !licenseIsLicensed}
                      onChange={async (e) => {
                        const newValue = e.target.checked;
                        try {
                          if (newValue) {
                            await enableAndSelect();
                          } else {
                            await disableWorkspaces();
                          }
                        } catch (error) {
                          console.error('Failed to toggle workspaces:', error);
                        }
                      }}
                      className="sr-only peer"
                    />
                    <div className={cn(
                      "w-11 h-6 bg-black/50 border border-white/20 rounded-full peer-checked:bg-hector-green peer-checked:border-hector-green transition-all",
                      controlLoading && "opacity-50"
                    )}></div>
                    <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
                  </div>
                </label>

                {workspacesEnabled && (
                  <>
                    <div className="text-xs text-gray-500 p-3 bg-black/20 rounded-lg">
                      <p>When enabled, you can create and manage local workspace directories. Each workspace runs its own Hector instance with isolated configuration.</p>
                    </div>

                    {/* Port Configuration */}
                    <PortConfiguration />
                  </>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-black/20 border-t border-white/10 flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-hector-green hover:bg-hector-green/80 text-white rounded-lg font-medium transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
