import { useState, useCallback, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useStore } from './store/useStore';
import { StoreContext } from './store/StoreContext';
import CustomCursor from './components/CustomCursor';
import SplashScreen from './components/SplashScreen';
import AuthModal from './components/AuthModal';
import TitleBar from './components/TitleBar';
import Sidebar from './components/Sidebar';
import ProfileList from './components/ProfileList';
import GroupsView from './components/GroupsView';
import ProxiesView from './components/ProxiesView';
import ProfileEditor from './components/ProfileEditor';
import ImportModal from './components/ImportModal';
import ExportModal from './components/ExportModal';
import DeleteConfirm from './components/DeleteConfirm';
import ToastContainer from './components/ToastContainer';
import DownloadBar from './components/DownloadBar';

type AppPhase = 'landing' | 'main';

const AUTH_KEY = 'multibrowse_auth';

function loadSavedAuth(): { email: string; token: string; offline?: boolean } | null {
  try {
    const data = localStorage.getItem(AUTH_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if ((parsed.email && parsed.token) || parsed.offline) return parsed;
    }
  } catch {}
  return null;
}

function saveAuth(email: string, token: string) {
  localStorage.setItem(AUTH_KEY, JSON.stringify({ email, token, offline: false }));
}

function saveOffline() {
  localStorage.setItem(AUTH_KEY, JSON.stringify({ email: 'offline', token: '', offline: true }));
}

function clearAuth() {
  localStorage.removeItem(AUTH_KEY);
}

export default function App() {
  const saved = loadSavedAuth();
  const initialAccount = saved?.offline ? 'offline' : (saved?.email || 'offline');
  const initialToken = saved?.offline ? '' : (saved?.token || '');

  const [phase, setPhase] = useState<AppPhase>(saved ? 'main' : 'landing');
  const [userEmail, setUserEmail] = useState(saved?.email || '');
  const [isOffline, setIsOffline] = useState(saved?.offline || false);
  const [authModal, setAuthModal] = useState<'login' | 'signup' | null>(null);

  const store = useStore(initialAccount, initialToken);

  const handleOpenAuth = useCallback((mode: 'login' | 'signup') => {
    setAuthModal(mode);
  }, []);

  const handleAuth = useCallback((email: string, token: string, remember: boolean) => {
    setUserEmail(email);
    setIsOffline(false);
    setAuthModal(null);
    setPhase('main');
    if (remember) saveAuth(email, token);
    else clearAuth();
    // Switch store to this user — pulls from cloud
    store.switchAccount(email, token);
  }, [store]);

  const handleOffline = useCallback(() => {
    setUserEmail('offline');
    setIsOffline(true);
    setPhase('main');
    saveOffline();
    store.switchAccount('offline', '');
  }, [store]);

  const handleLogout = useCallback(() => {
    setUserEmail('');
    setIsOffline(false);
    if (window.electronAPI) window.electronAPI.auth.clearToken();
    clearAuth();
    setPhase('landing');
  }, []);

  // Listen for profile stop events from Electron
  useEffect(() => {
    if (!window.electronAPI) return;
    window.electronAPI.camoufox.onProfileStopped((profileId: string) => {
      store.updateProfile(profileId, { status: 'ready' });
    });
  }, [store]);

  // On startup, reconcile profile statuses with actually running browsers
  useEffect(() => {
    if (!window.electronAPI) return;
    window.electronAPI.camoufox.listActive().then((activeIds: string[]) => {
      const activeSet = new Set(activeIds);
      // Any profile marked 'running' that isn't actually active → reset to 'ready'
      store.profiles.forEach(p => {
        if (p.status === 'running' && !activeSet.has(p.id)) {
          store.updateProfile(p.id, { status: 'ready' });
        }
      });
    }).catch(() => {});
  }, []);

  // On startup, if we already have a saved online session, push the token into Electron
  // and reconcile local profiles with the cloud once.
  useEffect(() => {
    if (!saved || saved.offline || !initialToken) return;
    if (window.electronAPI) {
      try { window.electronAPI.auth.setToken(initialToken); } catch {}
    }
    store.pullFromCloud();
  }, []);

  const renderMainContent = () => {
    switch (store.currentView) {
      case 'groups': return <GroupsView />;
      case 'proxies': return <ProxiesView />;
      default: return <ProfileList />;
    }
  };

  return (
    <StoreContext.Provider value={store}>
      <CustomCursor />

      <AnimatePresence mode="wait">
        {phase === 'landing' && (
          <SplashScreen key="landing" onOpenAuth={handleOpenAuth} onOffline={handleOffline} />
        )}

        {phase === 'main' && (
          <div key="main" className="flex flex-col h-screen" style={{ backgroundColor: '#0a0a0f' }}>
            <TitleBar />
            <div className="flex flex-1 overflow-hidden">
              <Sidebar userEmail={userEmail} onLogout={handleLogout} isOffline={isOffline} />
              <div className="flex-1 flex flex-col overflow-hidden" style={{ backgroundColor: '#0d0d14' }}>
                {renderMainContent()}
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {authModal && (
          <AuthModal key="auth-modal" initialMode={authModal} onAuth={handleAuth}
            onClose={() => setAuthModal(null)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {store.activeModal === 'editor' && <ProfileEditor key="editor" />}
        {store.activeModal === 'import' && <ImportModal key="import" />}
        {store.activeModal === 'export' && <ExportModal key="export" />}
        {store.activeModal === 'delete' && <DeleteConfirm key="delete" />}
      </AnimatePresence>

      <DownloadBar />
      <ToastContainer />
    </StoreContext.Provider>
  );
}
