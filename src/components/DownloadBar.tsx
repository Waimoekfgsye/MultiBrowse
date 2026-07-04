import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, CheckCircle, AlertCircle, Loader2, X } from 'lucide-react';
import type { CamoufoxDownloadProgress } from '../types';

export default function DownloadBar() {
  const [state, setState] = useState<CamoufoxDownloadProgress>({ status: 'idle' });
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!window.electronAPI) return;
    window.electronAPI.camoufox.onDownloadProgress((data) => {
      setState(data);
      if (data.status !== 'idle') setVisible(true);
    });
  }, []);

  if (!visible) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-96 rounded-xl p-4 shadow-lg"
          style={{ backgroundColor: '#1a1a25', border: '1px solid #2a2a3a' }}
        >
          {/* Header row */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {state.status === 'downloading' && <Download className="w-5 h-5" style={{ color: '#e8d44d' }} />}
              {state.status === 'extracting' && <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#e8d44d' }} />}
              {state.status === 'done' && <CheckCircle className="w-5 h-5" style={{ color: '#22c55e' }} />}
              {state.status === 'error' && <AlertCircle className="w-5 h-5" style={{ color: '#ef4444' }} />}
              <span className="text-sm font-medium" style={{ color: '#e8e8f0' }}>
                {state.status === 'downloading' && 'Downloading Camoufox Browser'}
                {state.status === 'extracting' && 'Extracting Camoufox Browser'}
                {state.status === 'done' && 'Camoufox Ready'}
                {state.status === 'error' && 'Download Failed'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {state.status === 'downloading' && (
                <span className="text-xs font-mono" style={{ color: '#e8d44d' }}>
                  {state.speed}
                </span>
              )}
              {(state.status === 'done' || state.status === 'error') && (
                <button onClick={() => setVisible(false)} className="p-1 rounded" style={{ color: '#555570' }}>
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Progress bar */}
          {(state.status === 'downloading' || state.status === 'extracting') && (
            <div className="h-2 rounded-full overflow-hidden mb-2" style={{ backgroundColor: '#12121a' }}>
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: '#e8d44d' }}
                initial={{ width: 0 }}
                animate={{ width: `${state.percent || 0}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          )}

          {state.status === 'done' && (
            <div className="h-2 rounded-full overflow-hidden mb-2" style={{ backgroundColor: '#22c55e' }}>
              <div className="h-full w-full" style={{ backgroundColor: '#22c55e' }} />
            </div>
          )}

          {/* Info row */}
          <div className="flex items-center justify-between">
            <span className="text-[10px]" style={{ color: '#555570' }}>
              {state.status === 'downloading' && `${state.downloaded} MB / ${state.total} MB`}
              {state.status === 'extracting' && 'Unpacking files...'}
              {state.status === 'done' && 'Camoufox Firefox engine installed'}
              {state.status === 'error' && (state.error || 'Unknown error')}
            </span>
            {(state.status === 'downloading' || state.status === 'extracting') && (
              <span className="text-[10px] font-mono" style={{ color: '#8888a0' }}>
                {state.percent}%
              </span>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
