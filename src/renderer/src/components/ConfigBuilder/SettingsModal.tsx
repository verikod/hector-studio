import React, { useState, useEffect } from "react";
import { X, Monitor, RefreshCw, FolderOpen, Key, Trash2 } from "lucide-react";
import { useStore } from "../../store/useStore";
import { useServersStore } from "../../store/serversStore";

import { useWorkspaceControl } from "../../lib/hooks/useWorkspaceControl";
import { useLicenseControl } from "../../lib/hooks/useLicenseControl";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  editorTheme: 'vs-dark' | 'vs-light' | 'hc-black';
  onThemeChange: (theme: 'vs-dark' | 'vs-light' | 'hc-black') => void;
  workspacesEnabled?: boolean;
  onWorkspacesChange?: (enabled: boolean) => void;
  onLicenseDeactivated?: () => void;
  isLicensed?: boolean; // Used to trigger refetch
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  editorTheme,
  onThemeChange,
  workspacesEnabled = false,
  onWorkspacesChange,
  onLicenseDeactivated,
  isLicensed,
}) => {
  const streamingEnabled = useStore((state) => state.streamingEnabled);
  const setStreamingEnabled = useStore((state) => state.setStreamingEnabled);
  const [licenseStatus, setLicenseStatus] = useState<{ isLicensed: boolean; email: string | null; key: string | null } | null>(null);

  const { enableAndSelect, disableWorkspaces, isLoading: controlLoading } = useWorkspaceControl();

  const servers = useServersStore((s) => s.servers);
  const activeServerId = useServersStore((s) => s.activeServerId);
  const selectServer = useServersStore((s) => s.selectServer);

  const { deactivate, getStatus, isLoading: licenseLoading } = useLicenseControl();

  // Fetch license status when modal opens or license state changes
  useEffect(() => {
    if (isOpen) {
      getStatus().then(setLicenseStatus);
    }
  }, [isOpen, isLicensed, getStatus]);

  const handleDeactivate = async () => {
    // No local loading state needed, hook handles it? 
    // Actually we need to reflect it in the button.
    // And calling deactivate() handles the API.
    try {
      await deactivate();
      setLicenseStatus({ isLicensed: false, email: null, key: null });
      onLicenseDeactivated?.();
    } catch (e) {
      // Error handled in hook or ignored here
    }
  };

  if (!isOpen) return null;

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
          className="bg-gradient-to-br from-hector-darker to-black border border-white/20 rounded-2xl shadow-2xl w-full max-w-md pointer-events-auto animate-in zoom-in-95 duration-200"
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

          {/* Content */}
          <div className="p-6 space-y-6">


            {/* Streaming */}
            <div>
              <label className="flex items-center justify-between cursor-pointer group">
                <div>
                  <div className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">
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
                <Monitor size={16} className="text-hector-green" />
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
              <label className="block text-sm font-medium text-gray-300 mb-2">
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

            {/* License Status */}
            <div className="pt-4 border-t border-white/10">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                <Key size={16} className="text-hector-green" />
                License
              </div>
              {licenseStatus?.isLicensed ? (
                <div className="space-y-3">
                  <div className="bg-hector-green/10 border border-hector-green/30 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-hector-green text-sm font-medium">
                      ✓ Studio Mode Active
                    </div>
                    {licenseStatus.email && (
                      <div className="text-xs text-gray-400 mt-1">{licenseStatus.email}</div>
                    )}
                    {licenseStatus.key && (
                      <div className="mt-2 pt-2 border-t border-hector-green/20">
                        <div className="text-xs text-gray-500 mb-1">License Key (save this!):</div>
                        <div className="flex items-center gap-2">
                          <code className="text-xs text-gray-300 bg-black/30 px-2 py-1 rounded font-mono truncate flex-1">
                            {licenseStatus.key}
                          </code>
                          <button
                            onClick={() => navigator.clipboard.writeText(licenseStatus.key!)}
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
                </div>
              ) : (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                  <div className="text-yellow-400 text-sm font-medium">
                    Chat Mode Only
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    Activate a license to unlock Studio Mode features
                  </div>
                </div>
              )}
            </div>

            {/* Workspaces */}
            {onWorkspacesChange && (
              <div className="pt-4 border-t border-white/10">
                <label className={`flex items-center justify-between cursor-pointer group ${!licenseStatus?.isLicensed ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  <div>
                    <div className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors flex items-center gap-2">
                      <FolderOpen size={16} className="text-hector-green" />
                      Local Workspaces
                      {!licenseStatus?.isLicensed && (
                        <span className="text-xs text-yellow-500 ml-2">(License required)</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Run hector locally with managed workspaces
                    </div>
                  </div>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={workspacesEnabled}
                      disabled={controlLoading || !licenseStatus?.isLicensed}
                      onChange={async (e) => {
                        const newValue = e.target.checked;
                        try {
                          if (newValue) {
                            // Enable workspaces using centralized logic
                            await enableAndSelect();
                          } else {
                            // Stop the local workspace
                            await disableWorkspaces();
                            await window.api.workspace.stop();

                            // If active server is a local workspace, deselect it
                            const activeServer = activeServerId ? servers[activeServerId] : null;
                            if (activeServer?.config.isLocal) {
                              // Find a remote server to select instead
                              const remoteServer = Object.values(servers).find(s => !s.config.isLocal);
                              if (remoteServer) {
                                selectServer(remoteServer.config.id);
                                await window.api.server.setActive(remoteServer.config.id);
                              } else {
                                // No remote servers, clear selection
                                selectServer('');
                              }
                            }
                          }
                          onWorkspacesChange && onWorkspacesChange(newValue);
                        } catch (error) {
                          console.error('Failed to toggle workspaces:', error);
                        }
                      }}
                      className="sr-only peer"
                    />
                    <div className={`w-11 h-6 bg-black/50 border border-white/20 rounded-full peer-checked:bg-hector-green peer-checked:border-hector-green transition-all ${controlLoading ? 'opacity-50' : ''}`}></div>
                    <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
                  </div>
                </label>
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
