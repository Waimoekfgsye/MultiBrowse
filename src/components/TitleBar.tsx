import { useState } from 'react';
import { Minus, X, Globe, Shield, Maximize2 } from 'lucide-react';

const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

export default function TitleBar() {
  const [maximized, setMaximized] = useState(false);

  const handleMinimize = () => {
    if (isElectron) window.electronAPI?.windowMinimize();
  };

  const handleMaximize = () => {
    if (isElectron) window.electronAPI?.windowMaximize();
    setMaximized(!maximized);
  };

  const handleClose = () => {
    if (isElectron) window.electronAPI?.windowClose();
  };

  return (
    <div
      className="flex items-center justify-between h-9 px-3 select-none titlebar-drag shrink-0"
      style={{ backgroundColor: '#08080d' }}
    >
      {/* Left: logo + title */}
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded flex items-center justify-center"
          style={{ backgroundColor: 'rgba(232,212,77,0.12)' }}>
          <Shield className="w-3 h-3" style={{ color: '#e8d44d' }} />
        </div>
        <span className="text-[11px] font-semibold tracking-wider" style={{ color: '#e8d44d', fontFamily: "'JetBrains Mono', monospace" }}>
          MULTIBROWSE
        </span>
        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded"
          style={{ color: '#555570', backgroundColor: '#12121a' }}>v1.2</span>
      </div>

      {/* Right: controls */}
      <div className="flex items-center gap-0 titlebar-no-drag">
        {!isElectron && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded mr-2"
            style={{ backgroundColor: 'rgba(232,212,77,0.08)' }}>
            <Globe className="w-2.5 h-2.5" style={{ color: '#e8d44d' }} />
            <span className="text-[9px] font-mono font-medium" style={{ color: '#b8a83e' }}>WEB PREVIEW</span>
          </div>
        )}

        <button
          onClick={handleMinimize}
          className="w-10 h-9 flex items-center justify-center transition-colors"
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#1e1e2a')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <Minus className="w-4 h-4" style={{ color: '#666680' }} />
        </button>
        <button
          onClick={handleMaximize}
          className="w-10 h-9 flex items-center justify-center transition-colors"
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#1e1e2a')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <Maximize2 className="w-3.5 h-3.5" style={{ color: '#666680' }} />
        </button>
        <button
          onClick={handleClose}
          className="w-10 h-9 flex items-center justify-center transition-colors"
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.25)')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <X className="w-4 h-4" style={{ color: '#666680' }} />
        </button>
      </div>
    </div>
  );
}
