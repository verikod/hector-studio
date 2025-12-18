import { useEffect, useRef, useState } from "react";
import { StudioMode } from "./components/ConfigBuilder/StudioMode";
import { SettingsModal } from "./components/ConfigBuilder/SettingsModal";
import { ErrorDisplay } from "./components/ErrorDisplay";
import { SuccessDisplay } from "./components/SuccessDisplay";
import { useStore } from "./store/useStore";
import { useServersStore } from "./store/serversStore";
import { useServersInit } from "./lib/hooks/useServersInit";
import { useHealthPolling } from "./lib/hooks/useHealthPolling";
import { UnifiedHeader } from "./components/UnifiedHeader";
import { CoverOverlay } from "./components/CoverOverlay";
import { LoginModal } from "./components/LoginModal";
import { InitializationCover } from "./components/InitializationCover";
import { WelcomeCover } from "./components/WelcomeCover";

// App lifecycle states
type AppState = 'initializing' | 'needs_download' | 'downloading' | 'ready';

function App() {
  // App lifecycle state machine
  const [appState, setAppState] = useState<AppState>('initializing');

  // Listen for app:ready event from main process
  useEffect(() => {
    const unsubscribe = window.api.app.onReady((payload) => {
      console.log('[App] Received app:ready:', payload);
      if (!payload.hectorInstalled) {
        setAppState('needs_download');
      } else {
        setAppState('ready');
      }
    });
    return unsubscribe;
  }, []);

  // Handle hector download
  const handleDownloadHector = async () => {
    setAppState('downloading');
    try {
      await window.api.hector.download();
      // After download, start the default workspace
      const workspaceId = await window.api.workspace.getActive();
      if (workspaceId) {
        await window.api.workspace.start(workspaceId);
      }
      setAppState('ready');
    } catch (error) {
      console.error('Download failed:', error);
      setAppState('needs_download');
      throw error;
    }
  };

  // Handle add remote server from welcome screen
  const handleAddRemoteServer = () => {
    // Skip to ready state - user will use server selector to add remote
    setAppState('ready');
  };

  // Initialize servers from main process (only when ready)
  useServersInit();

  // Poll active server health every 10s (only when ready)
  useHealthPolling();

  const loadAgents = useStore((state) => state.loadAgents);
  const createSession = useStore((state) => state.createSession);
  const currentSessionId = useStore((state) => state.currentSessionId);
  const setEndpointUrl = useStore((state) => state.setEndpointUrl);

  const activeServer = useServersStore((s) => s.getActiveServer());
  const setServerStatus = useServersStore((s) => s.setServerStatus);

  // Modal states
  const [loginServerId, setLoginServerId] = useState<string | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editorTheme, setEditorTheme] = useState<'vs-dark' | 'vs-light' | 'hc-black'>('hc-black');

  // Prevent double initialization on mount
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    // Create a new session if none exists
    const state = useStore.getState();
    if (!currentSessionId && Object.keys(state.sessions).length === 0) {
      createSession();
    }
  }, [currentSessionId, createSession]);

  // When active server changes, update endpoint and load agents
  useEffect(() => {
    if (activeServer?.status === 'authenticated') {
      setEndpointUrl(activeServer.config.url);
      // Reset agent state completely before reloading for new server
      useStore.getState().setAvailableAgents([]);
      useStore.setState({ agentsLoaded: false }); // Reset idempotency guard
      loadAgents();

      // Check if server has studio mode enabled
      const checkStudioMode = async () => {
        try {
          const res = await fetch(`${activeServer.config.url}/health`);
          if (res.ok) {
            const data = await res.json();
            const studioEnabled = data.studio_mode !== false;
            useStore.getState().setIsServerStudioEnabled(studioEnabled);
            // If studio mode disabled, force chat view
            if (!studioEnabled) {
              useStore.getState().setStudioViewMode('chat');
            }
          }
        } catch (e) {
          console.error('Failed to check server studio mode:', e);
        }
      };
      checkStudioMode();
    }
  }, [activeServer?.config.id, activeServer?.status, setEndpointUrl, loadAgents]);

  const handleLoginRequest = (serverId: string) => {
    setLoginServerId(serverId);
    setShowLoginModal(true);
  };

  const handleLogoutRequest = async (serverId: string) => {
    const servers = useServersStore.getState().servers;
    const server = servers[serverId];
    if (!server) return;

    try {
      await (window as any).api.auth.logout(server.config.url);
      setServerStatus(serverId, 'auth_required');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleLoginSuccess = () => {
    if (loginServerId) {
      setServerStatus(loginServerId, 'authenticated');
    }
    setShowLoginModal(false);
  };

  const handleRetryConnection = async () => {
    if (!activeServer) return;

    setServerStatus(activeServer.config.id, 'added');
    try {
      const authConfig = await (window as any).api.server.discoverAuth(activeServer.config.url);
      if (authConfig?.enabled) {
        const isAuth = await (window as any).api.auth.isAuthenticated(activeServer.config.url);
        setServerStatus(activeServer.config.id, isAuth ? 'authenticated' : 'auth_required');
      } else {
        setServerStatus(activeServer.config.id, 'authenticated');
      }
    } catch (error) {
      setServerStatus(activeServer.config.id, 'unreachable', String(error));
    }
  };

  const loginServer = loginServerId ? useServersStore.getState().servers[loginServerId] : null;

  // Show covers based on app state
  if (appState === 'initializing') {
    return <InitializationCover />;
  }

  if (appState === 'needs_download' || appState === 'downloading') {
    return (
      <WelcomeCover
        onDownloadHector={handleDownloadHector}
        onAddRemoteServer={handleAddRemoteServer}
      />
    );
  }

  return (
    <div className="flex flex-col w-screen h-screen bg-black text-white overflow-hidden font-sans">
      {/* Unified Header */}
      <UnifiedHeader
        onLoginRequest={handleLoginRequest}
        onLogoutRequest={handleLogoutRequest}
        onOpenSettings={() => setShowSettings(true)}
      />

      {/* Main Content - flex-1 with min-h-0 to allow shrinking */}
      <main className="flex-1 min-h-0 relative overflow-hidden flex flex-col">
        {/* Cover Overlay (for auth/connection states) */}
        <CoverOverlay
          onLoginClick={() => activeServer && handleLoginRequest(activeServer.config.id)}
          onRetryClick={handleRetryConnection}
        />

        {/* Workspace (authenticated) or Welcome Placeholder */}
        {activeServer?.status === 'authenticated' ? (
          <StudioMode />
        ) : !activeServer ? (
          <div className="flex-1 flex items-center justify-center text-gray-500 bg-gray-900/20">
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <div className="w-8 h-8 rounded-full bg-hector-green/20" />
              </div>
              <h2 className="text-lg font-medium text-gray-300 mb-2">Welcome to Hector Studio</h2>
              <p className="text-sm text-gray-400">Add or select a server to begin</p>
            </div>
          </div>
        ) : (
          /* When server exists but not authenticated, CoverOverlay takes precedence visually, 
             but we render empty div behind to maintain layout */
          <div className="flex-1 bg-gray-900/20" />
        )}
      </main>

      {/* Modals & Overlays */}
      {loginServer && (
        <LoginModal
          server={loginServer.config}
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
          onLoginSuccess={handleLoginSuccess}
        />
      )}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        editorTheme={editorTheme}
        onThemeChange={setEditorTheme}
      />
      <ErrorDisplay />
      <SuccessDisplay />
    </div>
  );
}

export default App;
