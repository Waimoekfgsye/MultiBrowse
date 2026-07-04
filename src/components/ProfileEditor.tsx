import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Settings, Fingerprint, Wifi, Code, Copy, Check, RefreshCw } from 'lucide-react';
import { useAppStore } from '../store/StoreContext';
import type { BrowserProfile } from '../types';
import {
  generateFingerprint, regenerateForOS, getOSCategory,
  OS_OPTIONS, OS_VERSIONS, BROWSER_VERSIONS, MAC_RESOLUTIONS, PC_RESOLUTIONS,
  LANGUAGES, TIMEZONES, WEBGL_MAC, WEBGL_WINDOWS, WEBGL_LINUX
} from '../utils/fingerprint';
import { LOCALE_TIMEZONE_MAP, getTimezoneForLocale } from '../utils/localeTimezoneMap';
import { getOSIconComponent, getOSLabel, getOSDescription } from '../utils/osIcons';
import CustomSelect from './CustomSelect';

const TABS = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'fingerprint', label: 'Fingerprint', icon: Fingerprint },
  { id: 'proxy', label: 'Proxy', icon: Wifi },
  { id: 'json', label: 'JSON', icon: Code },
];

const COLORS = ['#e8d44d', '#22c55e', '#3b82f6', '#ef4444', '#a855f7', '#f97316', '#ec4899', '#06b6d4'];

// Fixed content height for all tabs
const CONTENT_HEIGHT = 420;

function formatRendererLabel(renderer: string) {
  const patterns = [
    /RTX\s*4090/i, /RTX\s*4080\s*SUPER/i, /RTX\s*4080/i, /RTX\s*4070\s*Ti\s*SUPER/i,
    /RTX\s*4070\s*Ti/i, /RTX\s*4070\s*SUPER/i, /RTX\s*4070/i, /RTX\s*4060\s*Ti/i,
    /RTX\s*4060/i, /RTX\s*3080/i, /RTX\s*3070/i, /RTX\s*3060/i,
    /RX\s*7900\s*XTX/i, /RX\s*7800\s*XT/i, /RX\s*6800\s*XT/i, /RX\s*6700\s*XT/i,
    /Arc\s*A770/i, /UHD\s*Graphics\s*770/i, /Iris\s*Xe/i,
    /Apple\s*M4\s*Max/i, /Apple\s*M4\s*Pro/i, /Apple\s*M4/i,
    /Apple\s*M3\s*Max/i, /Apple\s*M3\s*Pro/i, /Apple\s*M3/i,
    /Apple\s*M2\s*Max/i, /Apple\s*M2\s*Pro/i, /Apple\s*M2/i,
    /Apple\s*M1\s*Max/i, /Apple\s*M1\s*Pro/i, /Apple\s*M1/i,
    /Adreno\s*\(TM\)\s*830/i, /Adreno\s*\(TM\)\s*750/i, /Adreno\s*\(TM\)\s*740/i,
    /Adreno\s*\(TM\)\s*730/i, /Mali-G720-Immortalis\s*MC12/i, /Mali-G715-Immortalis\s*MC11/i,
    /Apple\s*A18\s*Pro\s*GPU/i, /Apple\s*A18\s*GPU/i, /Apple\s*A17\s*Pro\s*GPU/i,
    /Apple\s*A16\s*Bionic\s*GPU/i, /Apple\s*A15\s*Bionic\s*GPU/i,
  ];

  for (const pattern of patterns) {
    const match = renderer.match(pattern);
    if (match) return match[0].replace(/\(TM\)\s*/i, '');
  }

  if (renderer.includes('ANGLE (')) {
    const inner = renderer.replace(/^ANGLE\s*\(/i, '').replace(/\)$/i, '');
    const parts = inner.split(',').map((p) => p.trim());
    if (parts[1]) return parts[1].replace(/Direct3D11|OpenGL 4\.6|OpenGL 4\.5/gi, '').trim();
  }

  return renderer.length > 32 ? `${renderer.slice(0, 32)}…` : renderer;
}

export default function ProfileEditor() {
  const store = useAppStore();
  const { editingProfile, setActiveModal, setEditingProfile, updateProfile, addProfile, addToast, groups } = store;

  const isNew = !editingProfile;
  const [profile, setProfile] = useState<BrowserProfile>(() => {
    if (editingProfile) return { ...editingProfile };
    const fp = generateFingerprint();
    return {
      id: crypto.randomUUID(),
      name: `Profile ${Date.now().toString(36).slice(-4)}`,
      group: 'Default',
      status: 'ready',
      createdAt: new Date().toISOString(),
      lastUsed: '',
      proxy: { type: 'none', host: '', port: '', username: '', password: '' },
      fingerprint: fp,
      notes: '',
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    };
  });

  const [tab, setTab] = useState('general');
  const [jsonText, setJsonText] = useState('');
  const [jsonFeedback, setJsonFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setJsonText(JSON.stringify(profile, null, 2));
  }, [profile]);

  const handleOSChange = (os: string) => {
    const newFp = regenerateForOS(os, profile.fingerprint);
    setProfile(p => ({ ...p, fingerprint: newFp }));
    addToast('info', `Fingerprint regenerated for ${os}`);
  };

  const handleSave = () => {
    if (saving) return;
    setSaving(true);
    if (isNew) {
      addProfile(profile);
    } else {
      updateProfile(profile.id, profile);
      addToast('success', 'Profile updated');
    }
    setEditingProfile(null);
    setActiveModal(null);
  };

  const handleClose = () => {
    setEditingProfile(null);
    setActiveModal(null);
  };

  const handleApplyJSON = () => {
    try {
      const parsed = JSON.parse(jsonText);
      setProfile(p => ({ ...p, ...parsed, id: p.id }));
      setJsonFeedback({ type: 'success', msg: 'JSON applied successfully' });
    } catch {
      setJsonFeedback({ type: 'error', msg: 'Invalid JSON' });
    }
    setTimeout(() => setJsonFeedback(null), 3000);
  };

  const handleCopyJSON = () => {
    navigator.clipboard.writeText(jsonText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const cat = getOSCategory(profile.fingerprint.os);
  const browsers = BROWSER_VERSIONS[cat] || BROWSER_VERSIONS['Windows'];
  const resolutions = cat === 'macOS' ? MAC_RESOLUTIONS : PC_RESOLUTIONS;
  const webglOptions = cat === 'macOS' ? WEBGL_MAC : cat === 'Windows' ? WEBGL_WINDOWS : WEBGL_LINUX;
  const vendorOptions = [...new Set(webglOptions.map((w: { vendor: string }) => w.vendor))];
  const rendererOptions = webglOptions.filter((w: { vendor: string }) => w.vendor === profile.fingerprint.webglVendor);

  const inputClass = "w-full px-3 py-2 rounded-lg text-xs transition-colors";
  const inputStyle = { backgroundColor: '#0a0a0f', border: '1px solid #1e1e2a', color: '#e8e8f0' };
  const labelClass = "text-[11px] font-medium mb-1 block";
  const labelStyle: React.CSSProperties = { color: '#8888a0' };
  const selectButtonClass = "w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-xs";

  return (
    <motion.div className="fixed inset-0 z-40 flex items-center justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
        onClick={handleClose} />
      <motion.div className="relative w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col"
        style={{ backgroundColor: '#101018', border: '1px solid #1e1e2a' }}
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid #1e1e2a' }}>
          <h2 className="text-sm font-bold" style={{ color: '#e8e8f0' }}>
            {isNew ? 'New Profile' : 'Edit Profile'}
          </h2>
          <button onClick={handleClose} className="p-1 rounded-lg transition-colors"
            style={{ color: '#555570' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#e8e8f0')}
            onMouseLeave={e => (e.currentTarget.style.color = '#555570')}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-5 gap-0.5" style={{ borderBottom: '1px solid #1e1e2a' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors relative ${tab === t.id ? 'tab-active' : ''}`}
              style={{ color: tab === t.id ? '#e8d44d' : '#555570' }}>
              <t.icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          ))}
        </div>

        {/* Content — fixed height */}
        <div className="overflow-y-auto p-5" style={{ height: CONTENT_HEIGHT }}>
          <AnimatePresence mode="wait">
            {tab === 'general' && (
              <motion.div key="general" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="space-y-4">

                {/* Profile Name + Group FIRST */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass} style={labelStyle}>Profile Name</label>
                    <input value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
                      className={inputClass} style={inputStyle} placeholder="My Profile" autoFocus />
                  </div>
                  <div>
                    <label className={labelClass} style={labelStyle}>Group</label>
                    <CustomSelect
                      value={profile.group}
                      onChange={(value) => setProfile((p) => ({ ...p, group: String(value) }))}
                      options={groups.map((g) => ({ value: g.name, label: g.name }))}
                      buttonClassName={selectButtonClass}
                    />
                  </div>
                </div>

                {/* OS Selector — 5 cards */}
                <div>
                  <label className={labelClass} style={labelStyle}>Operating System</label>
                  <div className="grid grid-cols-5 gap-2">
                    {OS_OPTIONS.map(os => {
                      const isSelected = profile.fingerprint.os === os;
                      return (
                        <button key={os} onClick={() => handleOSChange(os)}
                          className="flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all text-center"
                          style={{
                            backgroundColor: isSelected ? 'rgba(232,212,77,0.1)' : '#0a0a0f',
                            border: `1.5px solid ${isSelected ? '#e8d44d' : '#1e1e2a'}`,
                            boxShadow: isSelected ? '0 0 12px rgba(232,212,77,0.1)' : 'none',
                          }}
                          onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor = '#2a2a3a'; }}
                          onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = isSelected ? '#e8d44d' : '#1e1e2a'; }}
                        >
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: isSelected ? 'rgba(232,212,77,0.12)' : '#16161f' }}>
                            {getOSIconComponent(os, 18)}
                          </div>
                          <span className="text-[10px] font-medium" style={{ color: isSelected ? '#e8d44d' : '#8888a0' }}>
                            {getOSLabel(os)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] mt-1.5" style={{ color: '#444460' }}>
                    {getOSDescription(profile.fingerprint.os)} — Changing OS regenerates fingerprint
                  </p>
                </div>

                {/* Color picker */}
                <div>
                  <label className={labelClass} style={labelStyle}>Color</label>
                  <div className="flex gap-2">
                    {COLORS.map(c => (
                      <button key={c} onClick={() => setProfile(p => ({ ...p, color: c }))}
                        className="w-7 h-7 rounded-lg transition-all"
                        style={{
                          backgroundColor: c,
                          border: profile.color === c ? '2px solid white' : '2px solid transparent',
                          transform: profile.color === c ? 'scale(1.15)' : 'scale(1)',
                        }} />
                    ))}
                  </div>
                </div>

                <div>
                  <label className={labelClass} style={labelStyle}>Notes</label>
                  <textarea value={profile.notes} onChange={e => setProfile(p => ({ ...p, notes: e.target.value }))}
                    className={`${inputClass} resize-none`} style={{ ...inputStyle, height: '64px' }}
                    placeholder="Add notes about this profile..." />
                </div>
              </motion.div>
            )}

            {tab === 'fingerprint' && (
              <motion.div key="fingerprint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass} style={labelStyle}>OS Version</label>
                    <CustomSelect value={profile.fingerprint.osVersion}
                      onChange={(value) => setProfile((p) => ({ ...p, fingerprint: { ...p.fingerprint, osVersion: String(value) } }))}
                      options={(OS_VERSIONS[cat] || []).map((v) => ({ value: v, label: v }))}
                      buttonClassName={selectButtonClass} />
                  </div>
                  <div>
                    <label className={labelClass} style={labelStyle}>Browser Version</label>
                    <CustomSelect value={profile.fingerprint.browserVersion}
                      onChange={(value) => setProfile((p) => ({ ...p, fingerprint: { ...p.fingerprint, browserVersion: String(value) } }))}
                      options={browsers.map((b) => ({ value: b, label: b }))}
                      buttonClassName={selectButtonClass} />
                  </div>
                  <div>
                    <label className={labelClass} style={labelStyle}>Screen Resolution</label>
                    <CustomSelect value={profile.fingerprint.screenResolution}
                      onChange={(value) => setProfile((p) => ({ ...p, fingerprint: { ...p.fingerprint, screenResolution: String(value) } }))}
                      options={resolutions.map((r) => ({ value: r, label: r }))}
                      buttonClassName={selectButtonClass} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass} style={labelStyle}>Language</label>
                    <CustomSelect value={profile.fingerprint.language}
                      onChange={(value) => {
                        const lang = String(value);
                        const newTz = getTimezoneForLocale(lang);
                        setProfile((p) => ({ ...p, fingerprint: { ...p.fingerprint, language: lang, timezone: newTz } }));
                      }}
                      options={LANGUAGES.map((l) => ({ value: l, label: l }))}
                      buttonClassName={selectButtonClass} />
                  </div>
                  <div>
                    <label className={labelClass} style={labelStyle}>Timezone <span className="text-[9px]" style={{ color: '#555' }}>(auto from language)</span></label>
                    <CustomSelect value={profile.fingerprint.timezone}
                      onChange={(value) => setProfile((p) => ({ ...p, fingerprint: { ...p.fingerprint, timezone: String(value) } }))}
                      options={(LOCALE_TIMEZONE_MAP[profile.fingerprint.language] || TIMEZONES).map((t) => ({ value: t, label: t }))}
                      buttonClassName={selectButtonClass} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass} style={labelStyle}>WebGL Vendor</label>
                    <CustomSelect value={profile.fingerprint.webglVendor}
                      onChange={(value) => {
                        const vendor = String(value);
                        const matchingRenderers = webglOptions.filter((w: any) => w.vendor === vendor);
                        const renderer = matchingRenderers[0]?.renderer || profile.fingerprint.webglRenderer;
                        setProfile((p) => ({ ...p, fingerprint: { ...p.fingerprint, webglVendor: vendor, webglRenderer: renderer } }));
                      }}
                      options={vendorOptions.map((v) => ({ value: v, label: v }))}
                      buttonClassName={selectButtonClass} direction="down" />
                  </div>
                  <div>
                    <label className={labelClass} style={labelStyle}>WebGL Renderer</label>
                    <CustomSelect value={profile.fingerprint.webglRenderer}
                      onChange={(value) => setProfile((p) => ({ ...p, fingerprint: { ...p.fingerprint, webglRenderer: String(value) } }))}
                      options={rendererOptions.map((w: any) => ({ value: w.renderer, label: formatRendererLabel(w.renderer) }))}
                      buttonClassName={selectButtonClass} direction="down" menuWidth="260px" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className={labelClass} style={labelStyle}>Hardware Concurrency</label>
                    <CustomSelect value={profile.fingerprint.hardwareConcurrency}
                      onChange={(value) => setProfile((p) => ({ ...p, fingerprint: { ...p.fingerprint, hardwareConcurrency: Number(value) } }))}
                      options={[2, 4, 6, 8, 10, 12, 16, 24, 32].map((n) => ({ value: n, label: String(n) }))}
                      buttonClassName={selectButtonClass} />
                  </div>
                  <div>
                    <label className={labelClass} style={labelStyle}>Device Memory (GB)</label>
                    <CustomSelect value={profile.fingerprint.deviceMemory}
                      onChange={(value) => setProfile((p) => ({ ...p, fingerprint: { ...p.fingerprint, deviceMemory: Number(value) } }))}
                      options={[2, 4, 8, 16, 32].map((n) => ({ value: n, label: String(n) }))}
                      buttonClassName={selectButtonClass} />
                  </div>
                  <div>
                    <label className={labelClass} style={labelStyle}>WebRTC Mode</label>
                    <CustomSelect value={profile.fingerprint.webrtcMode}
                      onChange={(value) => setProfile((p) => ({ ...p, fingerprint: { ...p.fingerprint, webrtcMode: String(value) as any } }))}
                      options={[{ value: 'real', label: 'Real' }, { value: 'disabled', label: 'Disabled' }, { value: 'altered', label: 'Altered' }]}
                      buttonClassName={selectButtonClass} />
                  </div>
                </div>

                {/* Toggle switches */}
                <div className="flex gap-6">
                  <label className="flex items-center gap-2">
                    <div className="relative w-9 h-5 rounded-full transition-colors" style={{ backgroundColor: profile.fingerprint.canvasNoise ? '#e8d44d' : '#1e1e2a' }}
                      onClick={() => setProfile(p => ({ ...p, fingerprint: { ...p.fingerprint, canvasNoise: !p.fingerprint.canvasNoise } }))}>
                      <div className="absolute w-3.5 h-3.5 rounded-full top-[3px] transition-all" style={{ left: profile.fingerprint.canvasNoise ? '19px' : '3px', backgroundColor: profile.fingerprint.canvasNoise ? '#0a0a0f' : '#555570' }} />
                    </div>
                    <span className="text-xs" style={{ color: '#8888a0' }}>Canvas Noise</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <div className="relative w-9 h-5 rounded-full transition-colors" style={{ backgroundColor: profile.fingerprint.audioNoise ? '#e8d44d' : '#1e1e2a' }}
                      onClick={() => setProfile(p => ({ ...p, fingerprint: { ...p.fingerprint, audioNoise: !p.fingerprint.audioNoise } }))}>
                      <div className="absolute w-3.5 h-3.5 rounded-full top-[3px] transition-all" style={{ left: profile.fingerprint.audioNoise ? '19px' : '3px', backgroundColor: profile.fingerprint.audioNoise ? '#0a0a0f' : '#555570' }} />
                    </div>
                    <span className="text-xs" style={{ color: '#8888a0' }}>Audio Noise</span>
                  </label>
                </div>

                {/* User Agent (readonly) */}
                <div>
                  <label className={labelClass} style={labelStyle}>User Agent (auto-generated)</label>
                  <div className="px-3 py-2 rounded-lg text-[11px] break-all"
                    style={{ backgroundColor: '#0a0a0f', border: '1px solid #1e1e2a', color: '#555570', fontFamily: "'JetBrains Mono', monospace" }}>
                    {profile.fingerprint.userAgent}
                  </div>
                </div>
              </motion.div>
            )}

            {tab === 'proxy' && (
              <motion.div key="proxy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }} className="space-y-4">
                <div>
                  <label className={labelClass} style={labelStyle}>Proxy Type</label>
                  <div className="grid grid-cols-4 gap-2">
                    {(['none', 'http', 'https', 'socks5'] as const).map(pt => {
                      const isSel = profile.proxy.type === pt;
                      return (
                        <button key={pt} onClick={() => setProfile(p => ({ ...p, proxy: { ...p.proxy, type: pt } }))}
                          className="py-2.5 rounded-xl text-xs font-medium transition-all"
                          style={{ backgroundColor: isSel ? 'rgba(232,212,77,0.1)' : '#0a0a0f', border: `1.5px solid ${isSel ? '#e8d44d' : '#1e1e2a'}`, color: isSel ? '#e8d44d' : '#666680' }}
                          onMouseEnter={e => { if (!isSel) e.currentTarget.style.borderColor = '#2a2a3a'; }}
                          onMouseLeave={e => { if (!isSel) e.currentTarget.style.borderColor = isSel ? '#e8d44d' : '#1e1e2a'; }}>
                          {pt === 'none' ? 'No Proxy' : pt.toUpperCase()}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {profile.proxy.type !== 'none' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className={labelClass} style={labelStyle}>Host</label>
                        <input value={profile.proxy.host} onChange={e => setProfile(p => ({ ...p, proxy: { ...p.proxy, host: e.target.value } }))} className={inputClass} style={inputStyle} placeholder="proxy.example.com" /></div>
                      <div><label className={labelClass} style={labelStyle}>Port</label>
                        <input value={profile.proxy.port} onChange={e => setProfile(p => ({ ...p, proxy: { ...p.proxy, port: e.target.value } }))} className={inputClass} style={inputStyle} placeholder="8080" /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className={labelClass} style={labelStyle}>Username (optional)</label>
                        <input value={profile.proxy.username} onChange={e => setProfile(p => ({ ...p, proxy: { ...p.proxy, username: e.target.value } }))} className={inputClass} style={inputStyle} placeholder="username" /></div>
                      <div><label className={labelClass} style={labelStyle}>Password (optional)</label>
                        <input type="password" value={profile.proxy.password} onChange={e => setProfile(p => ({ ...p, proxy: { ...p.proxy, password: e.target.value } }))} className={inputClass} style={inputStyle} placeholder="password" /></div>
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {tab === 'json' && (
              <motion.div key="json" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }} className="space-y-3 flex flex-col" style={{ height: CONTENT_HEIGHT - 40 }}>
                <div className="flex items-center justify-between">
                  <label className={labelClass} style={labelStyle}>Profile JSON</label>
                  <div className="flex gap-2">
                    <button onClick={handleApplyJSON} className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium"
                      style={{ backgroundColor: 'rgba(34,197,94,0.15)', color: '#22c55e' }}><Check className="w-3 h-3" /> Apply</button>
                    <button onClick={handleCopyJSON} className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium"
                      style={{ backgroundColor: 'rgba(232,212,77,0.15)', color: '#e8d44d' }}>
                      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
                <textarea value={jsonText} onChange={e => setJsonText(e.target.value)}
                  className="w-full rounded-lg text-[11px] resize-none p-3 flex-1"
                  style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace" }} />
                {jsonFeedback && (
                  <div className="text-xs px-3 py-2 rounded-lg" style={{
                    backgroundColor: jsonFeedback.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                    color: jsonFeedback.type === 'success' ? '#22c55e' : '#ef4444',
                  }}>{jsonFeedback.msg}</div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: '1px solid #1e1e2a' }}>
          <button onClick={() => { const fp = generateFingerprint(profile.fingerprint.os); setProfile(p => ({ ...p, fingerprint: fp })); addToast('info', 'Fingerprint regenerated'); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{ backgroundColor: '#1e1e2a', color: '#8888a0' }}>
            <RefreshCw className="w-3.5 h-3.5" /> Regenerate
          </button>
          <div className="flex gap-2">
            <button onClick={handleClose} className="px-4 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{ backgroundColor: '#1e1e2a', color: '#8888a0' }}>Cancel</button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-1.5 rounded-lg text-xs font-medium btn-shine"
              style={{ backgroundColor: '#e8d44d', color: '#0a0a0f', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving...' : (isNew ? 'Create Profile' : 'Save Changes')}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
