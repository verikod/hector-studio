import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as yaml from 'js-yaml';
import { CheckCircle, XCircle, Settings, Rocket } from 'lucide-react';
import { cn } from '../../lib/utils';
import { yamlToGraph } from '../../lib/canvas-converter';
import { CanvasMode } from './CanvasMode';
import { ChatWidget } from './ChatWidget';
import { SettingsModal } from './SettingsModal';
import { ConfigEditor } from './ConfigEditor';
import { InfrastructureSidebar } from './InfrastructureSidebar';
import { useStore } from '../../store/useStore';
import { useLicenseStore } from '../../store/licenseStore';
import { api } from '../../services/api';
import { configureYamlSchema } from '../../lib/monaco';
import { EDITOR } from '../../lib/constants';

export const StudioMode: React.FC = () => {
  // Global Studio State
  const viewMode = useStore((s) => s.studioViewMode);
  const designView = useStore((s) => s.studioDesignView);
  const setDesignView = useStore((s) => s.setStudioDesignView);
  const yamlContent = useStore((s) => s.studioYamlContent);
  const setYamlContent = useStore((s) => s.setStudioYamlContent);
  const isValidYaml = useStore((s) => s.studioIsValidYaml);
  const validationError = useStore((s) => s.studioValidationError);
  const setValidationStatus = useStore((s) => s.setStudioValidationStatus);
  const rightPanelWidth = useStore((s) => s.studioRightPanelWidth);
  const setRightPanelWidth = useStore((s) => s.setStudioRightPanelWidth);

  // Local UI State
  const [lastValidYaml, setLastValidYaml] = useState<string>('');
  const editorTheme = useStore((s) => s.editorTheme);
  const setEditorTheme = useStore((s) => s.setEditorTheme);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [nodes, setNodes] = useState<any[]>([]);

  // Refs
  const editorRef = useRef<any>(null);
  const latestYamlContentRef = useRef<string>(''); // Keep this for immediate updates before debounce
  const debounceTimerRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);

  // Studio Mode Capability - from global store (set by App.tsx on server connect)
  const isServerStudioEnabled = useStore((s) => s.isServerStudioEnabled);

  // License status from centralized store
  const isLicensed = useLicenseStore((s) => s.isLicensed);

  // Combine server capability and client license
  const isStudioModeEnabled = isServerStudioEnabled && !!isLicensed;

  // Auto-collapse sidebar if studio mode disabled
  useEffect(() => {
    if (!isStudioModeEnabled) {
      setSidebarCollapsed(true);
      if (viewMode !== 'chat') {
        useStore.getState().setStudioViewMode('chat');
      }
    }
  }, [isStudioModeEnabled, viewMode]);

  // Resizable Panel Logic
  const startResizing = useCallback(() => {
    isDraggingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const stopResizing = useCallback(() => {
    isDraggingRef.current = false;
    document.body.style.cursor = 'default';
    document.body.style.userSelect = '';
  }, []);

  const resize = useCallback((e: MouseEvent) => {
    if (isDraggingRef.current) {
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth > 300 && newWidth < window.innerWidth * 0.7) {
        setRightPanelWidth(newWidth);
      }
    }
  }, [setRightPanelWidth]);

  useEffect(() => {
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResizing);
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [resize, stopResizing]);

  // Validation Logic
  const validateYaml = useCallback((content: string) => {
    try {
      const parsed = yaml.load(content) as any;

      if (!parsed || typeof parsed !== 'object') throw new Error('Root must be an object');
      if (!parsed.agents) throw new Error('Missing "agents" section');

      Object.entries(parsed.agents).forEach(([id, agent]: [string, any]) => {
        if (!agent.llm && !agent.type) throw new Error(`Agent "${id}" missing "llm" or "type"`);
        if (agent.type && ['sequential', 'parallel', 'loop'].includes(agent.type)) {
          if (!agent.sub_agents || !Array.isArray(agent.sub_agents)) {
            throw new Error(`Workflow "${id}" missing "sub_agents" array`);
          }
        }
      });

      setValidationStatus(true, '');
      setLastValidYaml(content);
      return true;
    } catch (e) {
      const error = e as Error;
      setValidationStatus(false, error.message);
      return false;
    }
  }, [setValidationStatus]);

  // Editor Change Handler
  const handleEditorChange = useCallback((value: string | undefined) => {
    const val = value || '';
    latestYamlContentRef.current = val;

    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = window.setTimeout(() => {
      setYamlContent(val);
      validateYaml(val);
      try {
        const { nodes: newNodes } = yamlToGraph(val);
        setNodes(newNodes);
      } catch { }
    }, EDITOR.DEBOUNCE_DELAY_MS);
  }, [setYamlContent, validateYaml]);

  // Auto-switch to Canvas when message sent
  const handleMessageSent = useCallback(() => {
    useStore.getState().setSelectedNodeId(null);
    if (viewMode === 'split' && designView === 'editor') {
      setDesignView('canvas');
    }
  }, [viewMode, designView, setDesignView]);

  // Sync editor content when switching back to editor or when store updates externally
  useEffect(() => {
    if (((viewMode === 'design' || viewMode === 'split') && designView === 'editor') && editorRef.current) {
      // Only update if content is different to avoid cursor jump (simple check)
      if (editorRef.current.getValue() !== latestYamlContentRef.current) {
        editorRef.current.setValue(latestYamlContentRef.current);
      }
    }
  }, [viewMode, designView, yamlContent]); // yamlContent in dep means external updates sync to editor

  // Sync Ref with Store content on mount/update (in case store has content but ref is empty)
  useEffect(() => {
    if (yamlContent && latestYamlContentRef.current !== yamlContent) {
      latestYamlContentRef.current = yamlContent;
      setLastValidYaml(yamlContent); // Assume valid if from store/server
      if (editorRef.current) {
        editorRef.current.setValue(yamlContent);
      }
    }
  }, [yamlContent]);

  const handleEditorMount = React.useCallback((editor: any) => {
    editorRef.current = editor;
    if (latestYamlContentRef.current) {
      editor.setValue(latestYamlContentRef.current);
    }
  }, []);

  // Format YAML Handler (called by internal button, but logic is here)
  const handleFormatYAML = () => {
    try {
      const current = latestYamlContentRef.current;
      const parsed = yaml.load(current);
      const formatted = yaml.dump(parsed, { indent: 2, lineWidth: -1, noRefs: true });

      latestYamlContentRef.current = formatted;
      setYamlContent(formatted);
      validateYaml(formatted);

      if (editorRef.current) {
        editorRef.current.setValue(formatted);
      }
    } catch (e) {
      const error = e as Error;
      console.error(`Format error: ${error.message}`);
    }
  };

  // Load initial config (only if studio mode is enabled)
  const endpointUrl = useStore((state) => state.endpointUrl);
  useEffect(() => {
    // Skip config fetch if studio mode is disabled (chat-only server) or not licensed
    if (!isStudioModeEnabled) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const loadConfig = async () => {
      try {
        const text = await api.fetchConfig();
        latestYamlContentRef.current = text;
        setYamlContent(text);
        setLastValidYaml(text);
        validateYaml(text);
      } catch (error) {
        console.error('Failed to load config:', error);
        // Don't show error toast for studio config - it's expected for non-studio servers
      } finally {
        setLoading(false);
      }
    };
    loadConfig();
  }, [endpointUrl, isStudioModeEnabled, setYamlContent, validateYaml]);

  // Fetch schema logic
  useEffect(() => {
    if (!isStudioModeEnabled) return;
    const initSchema = async () => {
      try {
        const schema = await api.fetchSchema();
        configureYamlSchema(schema);
        useStore.getState().setSchema(schema);
      } catch (e) {
        console.error("Failed to fetch schema:", e);
      }
    };
    initSchema();
  }, [isStudioModeEnabled]);

  if (loading && isStudioModeEnabled) {
    return (
      <div className="flex items-center justify-center h-full bg-gradient-to-br from-hector-darker to-black">
        <div className="text-white">Loading configuration...</div>
      </div>
    );
  }

  const showLeft = (viewMode === 'design' || viewMode === 'split') && isStudioModeEnabled;
  const showRight = viewMode === 'chat' || viewMode === 'split';

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-hector-darker to-black text-white">
      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        {showLeft && (
          <InfrastructureSidebar
            yamlContent={yamlContent}
            nodes={nodes}
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
        )}

        {/* Left Pane (Design View) */}
        {showLeft && (
          <div className="flex-1 flex flex-col min-w-0 bg-hector-darker/50">
            {/* Design Tools Header (Internal to Pane) */}
            <div className="h-9 border-b border-white/10 flex items-center justify-between px-3 bg-black/10">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">View</span>
                <div className="flex items-center bg-white/5 rounded-lg p-0.5">
                  <button
                    onClick={() => setDesignView('editor')}
                    className={cn("px-2 py-0.5 text-xs font-medium rounded transition-all flex items-center gap-1.5", designView === 'editor' ? "bg-hector-green text-white" : "text-gray-400 hover:text-white")}
                  >
                    <Settings size={10} />
                    <span>Code</span>
                  </button>
                  <button
                    onClick={() => setDesignView('canvas')}
                    className={cn("px-2 py-0.5 text-xs font-medium rounded transition-all flex items-center gap-1.5", designView === 'canvas' ? "bg-indigo-500 text-white" : "text-gray-400 hover:text-white")}
                  >
                    <Rocket size={10} className="rotate-45" />
                    <span>Canvas</span>
                  </button>
                </div>
              </div>

              <button
                onClick={handleFormatYAML}
                className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors text-xs font-medium px-2 py-1 rounded hover:bg-white/5"
                title="Format YAML"
              >
                <span>Format</span>
              </button>
            </div>

            <div className="flex-1 overflow-hidden relative">
              {designView === 'canvas' ? (
                <>
                  <CanvasMode yamlContent={lastValidYaml} />
                  {!isValidYaml && (
                    <div className="absolute top-4 right-4 bg-orange-500/10 text-orange-400 px-2 py-1 rounded text-xs border border-orange-500/20 backdrop-blur-sm z-50">
                      Showing last valid state
                    </div>
                  )}
                </>
              ) : (
                <div
                  className="w-full h-full"
                  onKeyDown={(e) => {
                    e.nativeEvent.stopImmediatePropagation();
                    e.stopPropagation();
                  }}
                >
                  <ConfigEditor
                    initialValue={yamlContent}
                    onChange={handleEditorChange}
                    onMount={handleEditorMount}
                    theme={editorTheme}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Resize Handle */}
        {viewMode === 'split' && isStudioModeEnabled && (
          <div
            className="w-1 cursor-col-resize hover:bg-hector-green/50 hover:shadow-[0_0_10px_rgba(16,185,129,0.5)] transition-colors active:bg-hector-green z-50 flex items-center justify-center group relative"
            onMouseDown={startResizing}
          >
            <div className="h-8 w-1 bg-white/10 rounded-full group-hover:bg-white/40 transition-colors" />
            <div className="absolute inset-y-0 -left-2 -right-2 bg-transparent z-10" />
          </div>
        )}

        {/* Right Pane (Chat) */}
        {showRight && (
          <div
            className={cn("flex flex-col border-l border-white/10 bg-black/20 flex-shrink-0", viewMode === 'chat' ? "flex-1 border-l-0" : "")}
            style={{ width: viewMode === 'chat' ? '100%' : rightPanelWidth }}
          >
            <div className="flex-1 overflow-hidden relative">
              <ChatWidget
                state={viewMode === 'chat' ? 'maximized' : 'pane'}
                onStateChange={() => { }}
                isPinned={true}
                onPinChange={() => { }}
                onMessageSent={handleMessageSent}
                hideControls={!isStudioModeEnabled || viewMode === 'chat'}
              />
            </div>
          </div>
        )}
      </div>

      {/* Status Bar */}
      {isStudioModeEnabled && (
        <div className="h-8 bg-black/80 border-t border-white/10 flex items-center justify-between px-4 text-xs select-none">
          {/* Left: Validation Status */}
          <div className="flex items-center gap-4 min-w-[200px]">
            {isValidYaml ? (
              <div className="flex items-center gap-1.5 text-green-400">
                <CheckCircle size={12} />
                <span>Valid Configuration</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-red-400" title={validationError}>
                <XCircle size={12} />
                <span className="truncate max-w-[200px]">Invalid: {validationError}</span>
              </div>
            )}
          </div>

          {/* Center: Screen Mode Tabs */}
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center">
            <div className="flex items-center bg-white/5 rounded p-0.5 border border-white/10">
              <button
                onClick={() => useStore.getState().setStudioViewMode('design')}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded transition-all",
                  viewMode === 'design' ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"
                )}
              >
                Design
              </button>
              <button
                onClick={() => useStore.getState().setStudioViewMode('split')}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded transition-all",
                  viewMode === 'split' ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"
                )}
              >
                Split
              </button>
              <button
                onClick={() => useStore.getState().setStudioViewMode('chat')}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded transition-all",
                  viewMode === 'chat' ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"
                )}
              >
                Chat
              </button>
            </div>
          </div>

          {/* Right: Settings */}
          <div className="flex items-center gap-2 min-w-[200px] justify-end">
            <span className="text-gray-600">
              {showLeft && <span>{designView.toUpperCase()}</span>}
            </span>
            <button
              onClick={() => setShowSettings(true)}
              className="p-1 text-gray-500 hover:text-white hover:bg-white/10 rounded transition-colors"
              title="Settings"
            >
              <Settings size={14} />
            </button>
          </div>
        </div>
      )}

      {showSettings && (
        <SettingsModal
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          editorTheme={editorTheme}
          onThemeChange={setEditorTheme}
        />
      )}
    </div>
  );
};
