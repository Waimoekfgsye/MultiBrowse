import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Copy } from 'lucide-react';
import { useAppStore } from '../store/StoreContext';

export default function ExportModal() {
  const { profiles, setActiveModal, addToast } = useAppStore();
  const [selected, setSelected] = useState<Set<string>>(new Set(profiles.map(p => p.id)));

  const toggleProfile = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === profiles.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(profiles.map(p => p.id)));
    }
  };

  const selectedProfiles = useMemo(() => {
    return profiles.filter(p => selected.has(p.id));
  }, [profiles, selected]);

  const jsonPreview = useMemo(() => {
    return JSON.stringify(selectedProfiles, null, 2);
  }, [selectedProfiles]);

  const handleDownload = () => {
    if (selectedProfiles.length === 0) {
      addToast('error', 'Please select at least one profile');
      return;
    }
    const blob = new Blob([jsonPreview], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `multibrowse-profiles-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('success', `Exported ${selectedProfiles.length} profile(s)`);
    setActiveModal(null);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonPreview);
    addToast('success', 'Copied to clipboard');
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}
        onClick={() => setActiveModal(null)}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={e => e.stopPropagation()}
          className="relative w-full max-w-2xl max-h-[80vh] rounded-2xl flex flex-col overflow-hidden"
          style={{ backgroundColor: '#13131c', border: '1px solid #1e1e2a' }}
        >
          <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #1e1e2a' }}>
            <h2 className="text-lg font-bold" style={{ color: '#e8e8f0' }}>Export Profiles</h2>
            <button onClick={() => setActiveModal(null)} className="p-1.5 rounded-lg" style={{ color: '#555570' }}>
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 grid grid-cols-2 gap-4">
            {/* Profile selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#555570' }}>
                  Select Profiles ({selected.size}/{profiles.length})
                </label>
                <button onClick={toggleAll} className="text-[10px]" style={{ color: '#e8d44d' }}>
                  {selected.size === profiles.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {profiles.map(p => (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors"
                    style={{ backgroundColor: selected.has(p.id) ? 'rgba(232,212,77,0.08)' : 'transparent' }}
                    onMouseEnter={e => { if (!selected.has(p.id)) e.currentTarget.style.backgroundColor = '#16161f'; }}
                    onMouseLeave={e => { if (!selected.has(p.id)) e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <button
                      onClick={() => toggleProfile(p.id)}
                      className="w-4 h-4 rounded border flex items-center justify-center text-[9px] font-bold"
                      style={{
                        borderColor: selected.has(p.id) ? '#e8d44d' : '#2a2a3a',
                        backgroundColor: selected.has(p.id) ? '#e8d44d' : 'transparent',
                        color: selected.has(p.id) ? '#0a0a0f' : 'transparent',
                      }}
                    >
                      {selected.has(p.id) && '✓'}
                    </button>
                    <div
                      className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold"
                      style={{ backgroundColor: p.color + '22', color: p.color }}
                    >
                      {p.name[0]?.toUpperCase()}
                    </div>
                    <span className="text-xs" style={{ color: '#e8e8f0' }}>{p.name}</span>
                    <span className="text-[10px] ml-auto" style={{ color: '#555570' }}>{p.fingerprint.os}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* JSON preview */}
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider mb-2 block" style={{ color: '#555570' }}>
                JSON Preview
              </label>
              <div
                className="rounded-lg p-3 text-[10px] font-mono h-60 overflow-auto"
                style={{ backgroundColor: '#0a0a0f', border: '1px solid #1e1e2a', color: '#666680' }}
              >
                <pre>{jsonPreview.slice(0, 2000)}{jsonPreview.length > 2000 ? '...' : ''}</pre>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 px-6 py-4" style={{ borderTop: '1px solid #1e1e2a' }}>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm"
              style={{ backgroundColor: '#1e1e2a', color: '#8888a0' }}
            >
              <Copy className="w-4 h-4" />
              Copy JSON
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-medium"
              style={{ backgroundColor: '#e8d44d', color: '#0a0a0f' }}
            >
              <Download className="w-4 h-4" />
              Download
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
