import { useRef, useState, useEffect } from "react";
import hectorIcon from "./assets/hector.png";
import { StudioMode } from "./components/ConfigBuilder/StudioMode";
import { SettingsModal } from "./components/ConfigBuilder/SettingsModal";
import { ErrorDisplay } from "./components/ErrorDisplay";
import { SuccessDisplay } from "./components/SuccessDisplay";
import { useStore } from "./store/useStore";
import { useServersStore } from "./store/serversStore";
import { useLicenseStore } from "./store/licenseStore";
import { useServersInit } from "./lib/hooks/useServersInit";
import { useHealthPolling } from "./lib/hooks/useHealthPolling";
import { useLicenseInit } from "./lib/hooks/useLicenseInit";
import { useStateInit } from "./lib/hooks/useStateInit";
import { UnifiedHeader } from "./components/UnifiedHeader";
import { CoverOverlay } from "./components/CoverOverlay";
import { LoginModal } from "./components/LoginModal";
import { InitializationCover } from "./components/InitializationCover";
import { WelcomeCover } from "./components/WelcomeCover";
import { EnableWorkspacesModal } from "./components/EnableWorkspacesModal";
import { UpdateNotification } from "./components/UpdateNotification";
import { UpdateRuntimeCover } from "./components/UpdateRuntimeCover";
import { LogDrawer } from "./components/LogDrawer";
import { LicenseModal } from "./components/LicenseModal";

// App lifecycle states
type AppState = 'initializing' | 'needs_download' | 'needs_update' | 'downloading' | 'ready';

function App() {
  // App lifecycle state machine
  const [appState, setAppState] = useState<AppState>('initializing');

  // Centralized state from stores
  const workspacesEnabled = useServersStore((s) => s.workspacesEnabled);
  const setWorkspacesEnabled = useServersStore((s) => s.setWorkspacesEnabled);
  const isLicensed = useLicenseStore((s) => s.isLicensed);

  // Initialize license state from main process
  useLicenseInit();

  // Subscribe to unified state changes from stateCoordinator
  useStateInit();

  // Listen for app:ready event from main process
  useEffect(() => {
    const unsubscribe = window.api.app.onReady((payload) => {
      console.log('[App] Received app:ready:', payload);
      // Sync initial workspaces state (also happens in useServersInit, but this is faster)
      setWorkspacesEnabled(payload.workspacesEnabled);

      // Determine initial app state
      if (payload.workspacesEnabled && !payload.hectorInstalled) {
        setAppState('needs_download');
      } else if (payload.needsRuntimeUpdate) {
        setAppState('needs_update');
      } else {
        setAppState('ready');
      }
    });
    return unsubscribe;
  }, [setWorkspacesEnabled]);

  // State for enable workspaces modal
  const [showEnableWorkspacesModal, setShowEnableWorkspacesModal] = useState(false);

  // Handle enabling workspaces - opens the wizard modal
  const handleEnableWorkspaces = () => {
    setShowEnableWorkspacesModal(true);
  };

  // Called when wizard completes successfully
  const handleEnableWorkspacesComplete = async (workspaceId?: string) => {
    setShowEnableWorkspacesModal(false);
    // Store is updated via IPC event from useServersInit

    // Explicitly select the workspace that was just started
    if (workspaceId) {
      try {
        const servers = await window.api.server.list();
        useServersStore.getState().syncFromMain(servers);
        useServersStore.getState().selectServer(workspaceId);
      } catch (e) {
        console.error('Failed to sync servers after enable:', e);
      }
    }
  };

  // Handle hector download from WelcomeCover (shows splash progress)
  const handleDownloadHector = async () => {
    setAppState('downloading');
    try {
      await window.api.workspaces.enable();
      // Store is updated via IPC event
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
  const [showLogDrawer, setShowLogDrawer] = useState(false);
  const [showLicenseModal, setShowLicenseModal] = useState(false);

  // Show license modal on app launch if not licensed (after initial check)
  useEffect(() => {
    if (isLicensed === false) {
      setShowLicenseModal(true);
    }
  }, [isLicensed]);

  // Expose license status for debugging
  useEffect(() => {
    (window as any).__hectorLicense = { isLicensed, showModal: () => setShowLicenseModal(true) };
  }, [isLicensed]);

  // Listen for open-log-drawer events from ServerList/ServerDropdown
  useEffect(() => {
    const handleOpenLogDrawer = () => setShowLogDrawer(true);
    window.addEventListener('open-log-drawer', handleOpenLogDrawer);
    return () => window.removeEventListener('open-log-drawer', handleOpenLogDrawer);
  }, []);

  // Prevent double initialization on mount
  const initializedRef = useRef(false);
  // Track active server ID to only reset session on actual switch
  const activeServerIdRef = useRef<string | null>(null);

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

      // Start a fresh chat session for the new server (only if ID changed)
      if (activeServerIdRef.current !== activeServer.config.id) {
        createSession();
        activeServerIdRef.current = activeServer.config.id;
      }

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

  if (appState === 'needs_update') {
    return (
      <UpdateRuntimeCover
        onUpdate={async () => {
          await window.api.hector.upgrade();
        }}
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
        onEnableWorkspaces={handleEnableWorkspaces}
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
              <div className="w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <img src={hectorIcon} alt="Hector" className="w-full h-full object-contain" />
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

      {/* License Upgrade Banner - shown for unlicensed users */}
      {isLicensed === false && (
        <button
          onClick={() => setShowLicenseModal(true)}
          className="w-full px-4 py-2.5 bg-gradient-to-r from-hector-green/20 to-blue-500/20 border-t border-hector-green/30 hover:from-hector-green/30 hover:to-blue-500/30 transition-all group"
        >
          <div className="flex items-center justify-center gap-2 text-sm">
            <span className="text-hector-green">🎫</span>
            <span className="text-gray-300 group-hover:text-white transition-colors">
              <span className="text-hector-green font-medium">Enable Studio Mode</span>
              {" "}— It's free! Get your Early Access license
            </span>
            <span className="text-gray-500 group-hover:text-gray-300 transition-colors">→</span>
          </div>
        </button>
      )}

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
        workspacesEnabled={workspacesEnabled}
        onLicenseDeactivated={() => {
          // License state updated via IPC event in useLicenseInit
          setShowLicenseModal(true);
        }}
        isLicensed={!!isLicensed}
      />
      <EnableWorkspacesModal
        isOpen={showEnableWorkspacesModal}
        onClose={() => setShowEnableWorkspacesModal(false)}
        onComplete={handleEnableWorkspacesComplete}
      />
      <UpdateNotification />
      <ErrorDisplay />
      <SuccessDisplay />
      <LogDrawer
        isOpen={showLogDrawer}
        onClose={() => setShowLogDrawer(false)}
      />
      <LicenseModal
        isOpen={showLicenseModal}
        onClose={() => setShowLicenseModal(false)}
        onLicenseActivated={() => {
          // License state updated via IPC event in useLicenseInit
          setShowLicenseModal(false);
        }}
        onSkip={() => {
          // User skipped license - they get chat-only mode
          console.log('[App] User skipped license activation');
          setShowLicenseModal(false);
        }}
      />
    </div>
  );
}

export default App;
