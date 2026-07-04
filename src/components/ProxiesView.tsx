import { motion, AnimatePresence } from 'framer-motion';
import { Globe, Wifi, WifiOff, Pencil, Shield, ArrowRight } from 'lucide-react';
import { useAppStore } from '../store/StoreContext';

export default function ProxiesView() {
  const { profiles, setEditingProfile, setActiveModal, setCurrentView } = useAppStore();

  const withProxy = profiles.filter(p => p.proxy.type !== 'none');
  const withoutProxy = profiles.filter(p => p.proxy.type === 'none');

  const handleEdit = (profileId: string) => {
    const p = profiles.find(pr => pr.id === profileId);
    if (p) {
      setEditingProfile(p);
      setActiveModal('editor');
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid #1e1e2a' }}>
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold" style={{ color: '#e8e8f0' }}>Proxies</h1>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(232,212,77,0.1)', color: '#e8d44d' }}>
            {withProxy.length} active
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl p-4" style={{ backgroundColor: '#13131c' }}>
            <div className="flex items-center gap-2 mb-2">
              <Wifi className="w-4 h-4" style={{ color: '#22c55e' }} />
              <span className="text-xs font-medium" style={{ color: '#8888a0' }}>Active Proxies</span>
            </div>
            <span className="text-2xl font-bold" style={{ color: '#22c55e' }}>{withProxy.length}</span>
          </div>
          <div className="rounded-xl p-4" style={{ backgroundColor: '#13131c' }}>
            <div className="flex items-center gap-2 mb-2">
              <WifiOff className="w-4 h-4" style={{ color: '#555570' }} />
              <span className="text-xs font-medium" style={{ color: '#8888a0' }}>No Proxy</span>
            </div>
            <span className="text-2xl font-bold" style={{ color: '#8888a0' }}>{withoutProxy.length}</span>
          </div>
          <div className="rounded-xl p-4" style={{ backgroundColor: '#13131c' }}>
            <div className="flex items-center gap-2 mb-2">
              <Globe className="w-4 h-4" style={{ color: '#e8d44d' }} />
              <span className="text-xs font-medium" style={{ color: '#8888a0' }}>Total Profiles</span>
            </div>
            <span className="text-2xl font-bold" style={{ color: '#e8d44d' }}>{profiles.length}</span>
          </div>
        </div>

        {/* Profiles with proxy */}
        {withProxy.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#555570' }}>
              Profiles with Proxy
            </h3>
            <div className="space-y-1.5">
              <AnimatePresence>
                {withProxy.map(p => (
                  <motion.div key={p.id} layout
                    initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors group"
                    style={{ backgroundColor: '#13131c' }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                      style={{ backgroundColor: p.color + '22', color: p.color }}>
                      {p.name[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium" style={{ color: '#e8e8f0' }}>{p.name}</div>
                      <div className="text-[10px] flex items-center gap-2" style={{ color: '#666680' }}>
                        <span className="uppercase font-semibold px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: 'rgba(34,197,94,0.1)', color: '#22c55e', fontSize: '9px' }}>
                          {p.proxy.type}
                        </span>
                        <span>{p.proxy.host}:{p.proxy.port}</span>
                        {p.proxy.username && <span>• {p.proxy.username}</span>}
                      </div>
                    </div>
                    <button onClick={() => handleEdit(p.id)}
                      className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                      style={{ backgroundColor: '#1e1e2a', color: '#8888a0' }}>
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Profiles without proxy */}
        {withoutProxy.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#444460' }}>
              Profiles without Proxy
            </h3>
            <div className="space-y-1.5">
              {withoutProxy.map(p => (
                <div key={p.id}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-xl group"
                  style={{ backgroundColor: '#10101a' }}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold"
                    style={{ backgroundColor: p.color + '15', color: p.color + '80' }}>
                    {p.name[0]?.toUpperCase()}
                  </div>
                  <span className="text-xs flex-1" style={{ color: '#555570' }}>{p.name}</span>
                  <button onClick={() => handleEdit(p.id)}
                    className="flex items-center gap-1 px-2 py-1 rounded text-[10px] opacity-0 group-hover:opacity-100 transition-all"
                    style={{ backgroundColor: 'rgba(232,212,77,0.08)', color: '#e8d44d' }}>
                    Add proxy <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {profiles.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
              style={{ backgroundColor: 'rgba(232,212,77,0.05)' }}>
              <Shield className="w-7 h-7" style={{ color: '#333348' }} />
            </div>
            <h3 className="text-sm font-medium mb-1" style={{ color: '#666680' }}>No profiles</h3>
            <p className="text-xs" style={{ color: '#444460' }}>Create profiles first, then configure proxies</p>
            <button onClick={() => setCurrentView('profiles')}
              className="mt-3 flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium"
              style={{ backgroundColor: '#e8d44d', color: '#0a0a0f' }}>
              Go to Profiles <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
