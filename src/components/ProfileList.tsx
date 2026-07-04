import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Plus, LayoutGrid, LayoutList,
  Play, Square, MoreVertical, Copy, RefreshCw, Trash2,
  CheckSquare, Pencil, Monitor, Lock,
  Cpu, Fingerprint, Wifi, WifiOff, Zap, Download, X
} from 'lucide-react';
import { useAppStore } from '../store/StoreContext';
import { generateFingerprint } from '../utils/fingerprint';
import { getOSIconComponent, getBrowserIconComponent } from '../utils/osIcons';
import CustomSelect from './CustomSelect';
import UpgradeModal from './UpgradeModal';

function formatGpuMain(renderer: string) {
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
    /Adreno\s*\(TM\)\s*730/i, /Mali-G720/i, /Mali-G715/i, /Mali-G710/i,
    /Apple\s*A18\s*Pro\s*GPU/i, /Apple\s*A18\s*GPU/i, /Apple\s*A17\s*Pro\s*GPU/i,
    /Apple\s*A16\s*Bionic\s*GPU/i, /Apple\s*A15\s*Bionic\s*GPU/i,
  ];
  for (const pattern of patterns) {
    const match = renderer.match(pattern);
    if (match) return match[0].replace(/\(TM\)\s*/i, '');
  }
  const cleaned = renderer.replace(/^ANGLE\s*\(/i, '').replace(/\)$/i, '');
  const parts = cleaned.split(',').map((p) => p.trim());
  if (parts[1]) return parts[1].replace(/Direct3D11|OpenGL 4\.6|OpenGL 4\.5/gi, '').trim();
  return renderer.length > 24 ? `${renderer.slice(0, 24)}…` : renderer;
}

function formatGpuSub(renderer: string) {
  if (/NVIDIA/i.test(renderer)) return 'NVIDIA';
  if (/AMD|Radeon/i.test(renderer)) return 'AMD';
  if (/Intel/i.test(renderer)) return 'Intel';
  if (/Apple/i.test(renderer)) return 'Apple';
  if (/Adreno|Qualcomm/i.test(renderer)) return 'Qualcomm';
  if (/Mali|ARM/i.test(renderer)) return 'ARM';
  return 'GPU';
}

function formatOsMain(os: string, osVersion?: string) {
  const version = osVersion || '';
  if (os === 'Windows') return version.includes('11') ? 'Win 11' : version.includes('10') ? 'Win 10' : 'Windows';
  if (os === 'macOS') return version.match(/\d+/)?.[0] ? `macOS ${version.match(/\d+/)?.[0]}` : 'macOS';
  if (os === 'Linux') return version.includes('Ubuntu 24') ? 'Ubuntu 24' : version.includes('Ubuntu 22') ? 'Ubuntu 22' : version.includes('Fedora 40') ? 'Fedora 40' : version.includes('Fedora 39') ? 'Fedora 39' : version.includes('Debian 12') ? 'Debian 12' : 'Linux';
  if (os === 'Android') return version.replace('Android ', 'Android ');
  if (os === 'iOS') return version.replace('iOS ', 'iOS ');
  return os;
}

function formatResolution(resolution: string) {
  return resolution.replace('x', '×');
}

function getProfileLabel(name: string): string {
  const match = name.match(/(\d+)/);
  return match ? `P${match[1]}` : name[0]?.toUpperCase() || 'P';
}

export default function ProfileList() {
  const store = useAppStore();
  const [downloadPrompt, setDownloadPrompt] = useState<{ profileId: string } | null>(null);
  const [upgradeReason, setUpgradeReason] = useState<string | null>(null);
  const [pinPrompt, setPinPrompt] = useState<{ mode: 'lock' | 'unlock'; profileId: string; nextAction?: 'edit' | 'start' } | null>(null);
  const [pinValue, setPinValue] = useState('');
  const {
    profiles, searchQuery, sortBy, viewMode, selectedProfiles,
    setSearchQuery, setSortBy, setViewMode, setSelectedProfiles,
    setActiveModal, setEditingProfile, updateProfile,
    duplicateProfile, deleteProfile, addToast, setDeleteAnchor,
    permissions, plan,
  } = store;

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; profileId: string } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Filter & sort
  const filtered = profiles.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.group.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.fingerprint.os.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case 'name': return a.name.localeCompare(b.name);
      case 'status': return a.status.localeCompare(b.status);
      case 'created': return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case 'os': return a.fingerprint.os.localeCompare(b.fingerprint.os);
      default: return 0;
    }
  });

  const isAllSelected = sorted.length > 0 && sorted.every(p => selectedProfiles.has(p.id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedProfiles(new Set());
    } else {
      setSelectedProfiles(new Set(sorted.map(p => p.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedProfiles(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const doLaunch = async (id: string) => {
    const p = profiles.find(pr => pr.id === id);
    if (!p) return;
    if (p.locked) {
      addToast('info', 'Profile is locked. Unlock it first.');
      return;
    }

    if (window.electronAPI) {
      addToast('info', 'Starting Camoufox...');
      const result = await window.electronAPI.camoufox.launch(id, {
        ...p,
        startupUrls: store.startupUrls,
      });
      if (!result.success) {
        updateProfile(id, { status: 'error' });
        addToast('error', result.error || 'Launch failed');
        return;
      }
    }

    updateProfile(id, { status: 'running', lastUsed: new Date().toISOString() });
    addToast('success', 'Camoufox launched');
  };

  const handleStart = async (id: string) => {
    const p = profiles.find(pr => pr.id === id);
    if (p?.locked) {
      setPinValue('');
      setPinPrompt({ mode: 'unlock', profileId: id, nextAction: 'start' });
      return;
    }
    if (window.electronAPI) {
      const installed = await window.electronAPI.camoufox.checkInstalled();
      if (!installed) {
        setDownloadPrompt({ profileId: id });
        return;
      }
    }
    doLaunch(id);
  };

  const handleConfirmDownload = () => {
    if (!downloadPrompt) return;
    const id = downloadPrompt.profileId;
    setDownloadPrompt(null);
    doLaunch(id);
  };

  const handleStop = async (id: string) => {
    if (window.electronAPI) await window.electronAPI.camoufox.stop(id);
    updateProfile(id, { status: 'ready' });
    addToast('info', 'Profile stopped');
  };

  const handleContextMenu = (e: React.MouseEvent, profileId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, profileId });
  };

  const handleRegenFingerprint = (id: string) => {
    if (!permissions.canRegenFingerprint) { setUpgradeReason('Regenerating fingerprints'); return; }
    const p = profiles.find(pr => pr.id === id);
    if (!p) return;
    const fp = generateFingerprint(p.fingerprint.os);
    updateProfile(id, { fingerprint: fp });
    addToast('success', 'Fingerprint regenerated');
  };

  const handleBulkDelete = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!permissions.canDeleteProfile) { setUpgradeReason('Deleting profiles'); return; }
    if (selectedProfiles.size === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setDeleteAnchor({ x: rect.left, y: rect.bottom } as any);
    setActiveModal('delete');
  };

  const handleEdit = (id: string) => {
    const p = profiles.find(pr => pr.id === id);
    if (!permissions.canEditProfile) {
      setUpgradeReason('Editing profiles');
      return;
    }
    if (p?.locked) {
      setPinValue('');
      setPinPrompt({ mode: 'unlock', profileId: id, nextAction: 'edit' });
      return;
    }
    if (p) { setEditingProfile(p); setActiveModal('editor'); }
  };

  const handleToggleLock = (id: string) => {
    if (!permissions.canLockProfile) {
      setUpgradeReason('Locking profiles');
      return;
    }
    const p = profiles.find(pr => pr.id === id);
    if (!p) return;
    if (p.locked) {
      setPinValue('');
      setPinPrompt({ mode: 'unlock', profileId: id });
    } else {
      setPinValue('');
      setPinPrompt({ mode: 'lock', profileId: id });
    }
  };

  const handleSubmitPin = () => {
    if (!pinPrompt) return;
    const p = profiles.find(pr => pr.id === pinPrompt.profileId);
    if (!p) return;

    if (!/^\d{4,8}$/.test(pinValue)) {
      addToast('error', 'PIN must be 4–8 digits');
      return;
    }

    if (pinPrompt.mode === 'lock') {
      updateProfile(p.id, { locked: true, lockPin: pinValue });
      addToast('success', 'Profile locked');
      setPinPrompt(null);
      setPinValue('');
      return;
    }

    // unlock
    if (p.lockPin !== pinValue) {
      addToast('error', 'Incorrect PIN');
      return;
    }

    updateProfile(p.id, { locked: false, lockPin: '' });
    addToast('success', 'Profile unlocked');
    const next = pinPrompt.nextAction;
    setPinPrompt(null);
    setPinValue('');

    if (next === 'edit') {
      setEditingProfile(p);
      setActiveModal('editor');
    } else if (next === 'start') {
      doLaunch(p.id);
    }
  };

  const handleNewProfile = () => {
    if (!permissions.canCreateProfile) {
      setUpgradeReason('Creating more than 1 profile');
      return;
    }
    setEditingProfile(null);
    setActiveModal('editor');
  };

  const statusColor = (s: string) => {
    if (s === 'running') return '#22c55e';
    if (s === 'error') return '#ef4444';
    return '#555570';
  };

  return (
    <div className="flex flex-col h-full" onClick={() => setContextMenu(null)}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid #1e1e2a' }}>
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold" style={{ color: '#e8e8f0' }}>Profiles</h1>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(232,212,77,0.1)', color: '#e8d44d' }}>
            {profiles.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleNewProfile}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium btn-shine"
            style={{ backgroundColor: '#e8d44d', color: '#0a0a0f' }}>
            <Plus className="w-3.5 h-3.5" /> New Profile
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 px-5 py-2.5" style={{ borderBottom: '1px solid #1e1e2a' }}>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: '#555570' }} />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search profiles..."
            className="w-full pl-9 pr-3 py-1.5 rounded-lg text-xs"
            style={{ backgroundColor: '#12121a', border: '1px solid #1e1e2a', color: '#e8e8f0' }} />
        </div>
        <div className="w-[140px]">
          <CustomSelect
            value={sortBy}
            onChange={(value) => setSortBy(value as typeof sortBy)}
            options={[
              { value: 'name', label: 'Sort: Name' },
              { value: 'status', label: 'Sort: Status' },
              { value: 'created', label: 'Sort: Created' },
              { value: 'os', label: 'Sort: OS' },
            ]}
            buttonClassName="w-full flex items-center justify-between gap-3 rounded-lg px-3 py-1.5 text-left text-xs"
          />
        </div>
        <button onClick={toggleSelectAll}
          className="p-1.5 rounded-lg transition-colors" style={{ backgroundColor: isAllSelected ? 'rgba(232,212,77,0.15)' : '#1e1e2a' }}>
          <CheckSquare className="w-4 h-4" style={{ color: isAllSelected ? '#e8d44d' : '#555570' }} />
        </button>
        {selectedProfiles.size > 0 && (
          <button onClick={handleBulkDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
            <Trash2 className="w-3 h-3" /> Delete ({selectedProfiles.size})
          </button>
        )}
        <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #1e1e2a' }}>
          <button onClick={() => setViewMode('list')}
            className="p-1.5 transition-colors"
            style={{ backgroundColor: viewMode === 'list' ? 'rgba(232,212,77,0.15)' : 'transparent' }}>
            <LayoutList className="w-4 h-4" style={{ color: viewMode === 'list' ? '#e8d44d' : '#555570' }} />
          </button>
          <button onClick={() => setViewMode('grid' as any)}
            className="p-1.5 transition-colors"
            style={{ backgroundColor: viewMode === 'grid' ? 'rgba(232,212,77,0.15)' : 'transparent' }}>
            <LayoutGrid className="w-4 h-4" style={{ color: viewMode === 'grid' ? '#e8d44d' : '#555570' }} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-3">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-20">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ backgroundColor: 'rgba(232,212,77,0.05)', border: '1px solid #1e1e2a' }}>
              <Monitor className="w-8 h-8" style={{ color: '#555570' }} />
            </div>
            <h3 className="text-sm font-medium mb-1" style={{ color: '#8888a0' }}>No profiles yet</h3>
            <p className="text-xs mb-4" style={{ color: '#555570' }}>Create your first browser profile to get started</p>
            <button onClick={handleNewProfile}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium btn-shine"
              style={{ backgroundColor: '#e8d44d', color: '#0a0a0f' }}>
              <Plus className="w-3.5 h-3.5" /> Create Profile
            </button>
          </div>
        ) : viewMode === 'list' ? (
          <div>
            {/* Table header */}
            <div className="grid gap-3 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider"
              style={{ gridTemplateColumns: '24px 2fr 1.2fr 0.8fr 0.8fr 120px', color: '#555570' }}>
              <div />
              <div>Profile</div>
              <div className="flex items-center gap-1"><Cpu className="w-3 h-3" /> GPU</div>
              <div className="flex items-center gap-1"><Fingerprint className="w-3 h-3" /> FP</div>
              <div className="flex items-center gap-1"><Wifi className="w-3 h-3" /> PXY</div>
              <div className="text-right">Actions</div>
            </div>
            <AnimatePresence>
              {sorted.map(profile => (
                <motion.div key={profile.id}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="profile-row grid gap-3 px-3 py-2.5 rounded-lg mb-1 items-center group"
                  style={{ gridTemplateColumns: '24px 2fr 1.2fr 0.8fr 0.8fr 120px', backgroundColor: selectedProfiles.has(profile.id) ? 'rgba(232,212,77,0.05)' : 'transparent' }}
                  onClick={() => toggleSelect(profile.id)}
                  onContextMenu={e => handleContextMenu(e, profile.id)}
                >
                  {/* Checkbox */}
                  <div className="flex items-center">
                    <div className="w-4 h-4 rounded border flex items-center justify-center text-[10px]"
                      style={{
                        borderColor: selectedProfiles.has(profile.id) ? '#e8d44d' : '#2a2a3a',
                        backgroundColor: selectedProfiles.has(profile.id) ? 'rgba(232,212,77,0.2)' : 'transparent',
                        color: '#e8d44d',
                      }}>
                      {selectedProfiles.has(profile.id) && '✓'}
                    </div>
                  </div>

                  {/* Profile info */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 relative"
                      style={{ backgroundColor: profile.color + '22', color: profile.color }}>
                      {getProfileLabel(profile.name)}
                      <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
                        style={{ borderColor: '#0d0d14', backgroundColor: statusColor(profile.status) }} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate" style={{ color: '#e8e8f0' }}>{profile.name}</div>
                      <div className="text-[10px] truncate" style={{ color: '#555570' }}>{profile.group}</div>
                    </div>
                  </div>

                  {/* GPU */}
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold truncate" style={{ color: '#e8e8f0' }}>
                      {formatGpuMain(profile.fingerprint.webglRenderer)}
                    </div>
                    <div className="text-[10px] truncate" style={{ color: '#555570' }}>
                      {formatGpuSub(profile.fingerprint.webglRenderer)}
                    </div>
                  </div>

                  {/* Fingerprint summary */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: '#e8e8f0' }}>
                      {getOSIconComponent(profile.fingerprint.os, 13)}
                      <span>{formatOsMain(profile.fingerprint.os, profile.fingerprint.osVersion)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px]" style={{ color: '#555570' }}>
                      {getBrowserIconComponent(profile.fingerprint.browserVersion, 12)}
                      <span>{formatResolution(profile.fingerprint.screenResolution)}</span>
                    </div>
                  </div>

                  {/* Proxy */}
                  <div>
                    {profile.proxy.type !== 'none' ? (
                      <div className="flex items-center gap-1">
                        <Wifi className="w-3 h-3" style={{ color: '#22c55e' }} />
                        <span className="text-[10px] uppercase font-medium" style={{ color: '#22c55e' }}>{profile.proxy.type}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <WifiOff className="w-3 h-3" style={{ color: '#555570' }} />
                        <span className="text-[10px]" style={{ color: '#555570' }}>None</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                    {profile.status === 'running' ? (
                      <button onClick={() => handleStop(profile.id)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium transition-colors"
                        style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
                        <Square className="w-3 h-3" /> Stop
                      </button>
                    ) : (
                      <button onClick={() => handleStart(profile.id)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium transition-colors"
                        style={{ backgroundColor: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>
                        <Play className="w-3 h-3" /> Start
                      </button>
                    )}
                    <button onClick={e => handleContextMenu(e, profile.id)}
                      className="p-1 rounded transition-colors"
                      style={{ color: '#555570' }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#1e1e2a')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          /* Card view */
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
            <AnimatePresence>
              {sorted.map(profile => (
                <motion.div key={profile.id}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="rounded-xl p-4 transition-colors group"
                  style={{
                    backgroundColor: '#16161f',
                    border: `1px solid ${selectedProfiles.has(profile.id) ? 'rgba(232,212,77,0.3)' : '#1e1e2a'}`,
                  }}
                  onClick={() => toggleSelect(profile.id)}
                  onContextMenu={e => handleContextMenu(e, profile.id)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded border flex items-center justify-center text-[10px] shrink-0 mt-1"
                        style={{
                          borderColor: selectedProfiles.has(profile.id) ? '#e8d44d' : '#2a2a3a',
                          backgroundColor: selectedProfiles.has(profile.id) ? 'rgba(232,212,77,0.2)' : 'transparent',
                          color: '#e8d44d',
                        }}>
                        {selectedProfiles.has(profile.id) && '✓'}
                      </div>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold relative"
                        style={{ backgroundColor: profile.color + '22', color: profile.color }}>
                        {getProfileLabel(profile.name)}
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2"
                          style={{ borderColor: '#16161f', backgroundColor: statusColor(profile.status) }} />
                      </div>
                      <div>
                        <div className="text-sm font-medium" style={{ color: '#e8e8f0' }}>{profile.name}</div>
                        <div className="text-[10px]" style={{ color: '#555570' }}>{profile.group}</div>
                      </div>
                    </div>
                    <button onClick={e => { e.stopPropagation(); handleContextMenu(e, profile.id); }}
                      className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: '#555570' }}>
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-2.5 mb-3">
                    <div className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-2">
                        {getOSIconComponent(profile.fingerprint.os, 13)}
                        <span style={{ color: '#e8e8f0', fontWeight: 600 }}>{formatOsMain(profile.fingerprint.os, profile.fingerprint.osVersion)}</span>
                      </div>
                      <span style={{ color: '#555570' }}>{formatResolution(profile.fingerprint.screenResolution)}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div className="rounded-lg px-2.5 py-2" style={{ backgroundColor: '#10101a' }}>
                        <div style={{ color: '#555570' }}>Browser</div>
                        <div className="mt-0.5 flex items-center gap-1.5" style={{ color: '#e8e8f0', fontWeight: 600 }}>
                          {getBrowserIconComponent(profile.fingerprint.browserVersion, 12)}
                          <span className="truncate">{profile.fingerprint.browserVersion}</span>
                        </div>
                      </div>
                      <div className="rounded-lg px-2.5 py-2" style={{ backgroundColor: '#10101a' }}>
                        <div style={{ color: '#555570' }}>GPU</div>
                        <div className="mt-0.5 truncate" style={{ color: '#e8e8f0', fontWeight: 600 }}>{formatGpuMain(profile.fingerprint.webglRenderer)}</div>
                        <div className="truncate" style={{ color: '#555570' }}>{formatGpuSub(profile.fingerprint.webglRenderer)}</div>
                      </div>
                      <div className="rounded-lg px-2.5 py-2" style={{ backgroundColor: '#10101a' }}>
                        <div style={{ color: '#555570' }}>Language</div>
                        <div className="mt-0.5" style={{ color: '#e8e8f0', fontWeight: 600 }}>{profile.fingerprint.language}</div>
                      </div>
                      <div className="rounded-lg px-2.5 py-2" style={{ backgroundColor: '#10101a' }}>
                        <div style={{ color: '#555570' }}>Timezone</div>
                        <div className="mt-0.5 truncate" style={{ color: '#e8e8f0', fontWeight: 600 }}>{profile.fingerprint.timezone.split('/').pop()?.replace('_', ' ') || profile.fingerprint.timezone}</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-[10px] rounded-lg px-2.5 py-2" style={{ backgroundColor: '#10101a' }}>
                      <div className="flex items-center gap-3" style={{ color: '#8888a0' }}>
                        <span><span style={{ color: '#555570' }}>CPU</span> <span style={{ color: '#e8e8f0', fontWeight: 600 }}>{profile.fingerprint.hardwareConcurrency}</span></span>
                        <span><span style={{ color: '#555570' }}>RAM</span> <span style={{ color: '#e8e8f0', fontWeight: 600 }}>{profile.fingerprint.deviceMemory}GB</span></span>
                      </div>
                      <div>
                        {profile.proxy.type !== 'none' ? (
                          <span className="uppercase font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(34,197,94,0.1)', color: '#22c55e', fontSize: '9px' }}>{profile.proxy.type}</span>
                        ) : (
                          <span style={{ color: '#555570' }}>No proxy</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    {profile.status === 'running' ? (
                      <button onClick={() => handleStop(profile.id)}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-medium"
                        style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
                        <Square className="w-3 h-3" /> Stop
                      </button>
                    ) : (
                      <button onClick={() => handleStart(profile.id)}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-medium"
                        style={{ backgroundColor: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>
                        <Play className="w-3 h-3" /> Start
                      </button>
                    )}
                    <button onClick={() => handleEdit(profile.id)}
                      className="p-1.5 rounded-lg transition-colors"
                      style={{ backgroundColor: '#1e1e2a', color: '#8888a0' }}>
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-5 py-2 text-[10px]" style={{ borderTop: '1px solid #1e1e2a', backgroundColor: '#08080d' }}>
        <span style={{ color: '#555570' }}>{sorted.length} profile{sorted.length !== 1 ? 's' : ''}{permissions.maxProfiles > 0 ? ` / ${permissions.maxProfiles} max` : ''}</span>
        <a href="https://waimoe.online" target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 transition-colors"
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
          <Zap className="w-3 h-3" style={{ color: '#e8d44d' }} />
          <span style={{ color: '#666680', fontFamily: "'JetBrains Mono', monospace" }}>waimoe.online</span>
        </a>
      </div>

      {/* Context menu */}
      <AnimatePresence>
        {contextMenu && (
          <motion.div ref={menuRef}
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
            className="fixed z-50 rounded-xl py-1.5 shadow-2xl min-w-[180px]"
            style={{
              left: Math.min(contextMenu.x, window.innerWidth - 200),
              top: Math.min(contextMenu.y, window.innerHeight - 280),
              backgroundColor: '#16161f', border: '1px solid #1e1e2a',
            }}
            onClick={e => e.stopPropagation()}
          >
            {[
              { icon: Pencil, label: 'Edit Profile', action: () => { handleEdit(contextMenu.profileId); setContextMenu(null); }, locked: !permissions.canEditProfile },
              { icon: Copy, label: 'Duplicate', action: () => {
                if (!permissions.canDuplicateProfile) { setUpgradeReason('Duplicating profiles'); setContextMenu(null); return; }
                duplicateProfile(contextMenu.profileId); setContextMenu(null);
              }, locked: !permissions.canDuplicateProfile },
              { icon: RefreshCw, label: 'Regen Fingerprint', action: () => { handleRegenFingerprint(contextMenu.profileId); setContextMenu(null); }, locked: !permissions.canRegenFingerprint },
              { icon: Download, label: 'Export Profile', action: () => {
                if (!permissions.canExportProfiles) { setUpgradeReason('Exporting profiles'); setContextMenu(null); return; }
                const p = profiles.find(pr => pr.id === contextMenu.profileId);
                if (p) {
                  const blob = new Blob([JSON.stringify([p], null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url; a.download = `${p.name.replace(/[^a-zA-Z0-9]/g, '_')}.json`; a.click();
                  URL.revokeObjectURL(url);
                  addToast('success', 'Profile exported');
                }
                setContextMenu(null);
              }, locked: !permissions.canExportProfiles },
              { icon: Lock, label: (() => {
                  const lockedNow = profiles.find(pr => pr.id === contextMenu.profileId)?.locked;
                  const base = lockedNow ? 'Unlock Profile' : 'Lock Profile';
                  return plan === 'offline' ? `${base} (Premium only)` : base;
                })(), action: () => { handleToggleLock(contextMenu.profileId); setContextMenu(null); }, locked: !permissions.canLockProfile },
              null,
              { icon: Trash2, label: 'Delete', action: () => {
                if (!permissions.canDeleteProfile) { setUpgradeReason('Deleting profiles'); setContextMenu(null); return; }
                deleteProfile(contextMenu.profileId); addToast('success', 'Profile deleted'); setContextMenu(null);
              }, danger: true, locked: !permissions.canDeleteProfile },
            ].map((item, i) => item === null ? (
              <div key={`sep-${i}`} className="h-px my-1 mx-2" style={{ backgroundColor: '#1e1e2a' }} />
            ) : (
              <button key={item.label as string}
                onClick={item.action}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors"
                style={{ color: (item as any).danger ? '#ef4444' : '#e8e8f0' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#22222f')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <item.icon className="w-3.5 h-3.5 shrink-0" />
                <span className="flex items-center gap-1.5 min-w-0">
                  <span>{String(item.label).replace(' (Premium only)', '')}</span>
                  {String(item.label).includes('(Premium only)') && (
                    <span style={{ color: '#555570', fontSize: '10px' }}>(Premium only)</span>
                  )}
                </span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* PIN lock/unlock prompt */}
      <AnimatePresence>
        {pinPrompt && (
          <motion.div className="fixed inset-0 z-[56] flex items-center justify-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/60" onClick={() => { setPinPrompt(null); setPinValue(''); }} />
            <motion.div className="relative w-[320px] rounded-2xl p-5"
              style={{ backgroundColor: '#0e0e16', border: '1px solid #1e1e2a' }}
              initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}>
              <h3 className="text-sm font-semibold mb-1" style={{ color: '#e8e8f0' }}>
                {pinPrompt.mode === 'lock' ? 'Set profile PIN' : 'Enter profile PIN'}
              </h3>
              <p className="text-[11px] mb-4" style={{ color: '#666' }}>
                {pinPrompt.mode === 'lock'
                  ? 'Lock this profile with a 4–8 digit PIN.'
                  : 'This profile is locked. Enter its PIN to continue.'}
              </p>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                value={pinValue}
                onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSubmitPin(); }}
                autoFocus
                className="w-full px-4 py-3 rounded-xl text-center text-lg font-mono tracking-[0.35em] bg-[#0a0a0f] text-[#e8e8f0]"
                placeholder="0000"
              />
              <div className="flex gap-2 mt-4">
                <button onClick={() => { setPinPrompt(null); setPinValue(''); }}
                  className="flex-1 py-2 rounded-lg text-xs font-medium"
                  style={{ backgroundColor: '#1e1e2a', color: '#888' }}>
                  Cancel
                </button>
                <button onClick={handleSubmitPin}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold btn-shine"
                  style={{ backgroundColor: '#e8d44d', color: '#0a0a0f' }}>
                  {pinPrompt.mode === 'lock' ? 'Lock' : 'Unlock'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Download confirmation dialog */}
      <AnimatePresence>
        {downloadPrompt && (
          <motion.div
            className="fixed inset-0 z-[55] flex items-center justify-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/60" onClick={() => setDownloadPrompt(null)} />
            <motion.div
              className="relative w-[380px] rounded-2xl p-5"
              style={{ backgroundColor: '#0e0e16', border: '1px solid #1e1e2a' }}
              initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
            >
              <button onClick={() => setDownloadPrompt(null)}
                className="absolute top-3 right-3 p-1 text-[#444] hover:text-[#888]">
                <X className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(232,212,77,0.1)' }}>
                  <Download className="w-5 h-5" style={{ color: '#e8d44d' }} />
                </div>
                <div>
                  <h3 className="text-sm font-bold" style={{ color: '#e8e8f0' }}>Camoufox Not Found</h3>
                  <p className="text-[10px]" style={{ color: '#666' }}>Anti-detect Firefox engine required</p>
                </div>
              </div>
              <p className="text-xs mb-4" style={{ color: '#888' }}>
                Camoufox browser (~500 MB) needs to be downloaded to launch profiles. This is a one-time download.
              </p>
              <div className="flex gap-2">
                <button onClick={() => setDownloadPrompt(null)}
                  className="flex-1 py-2 rounded-lg text-xs font-medium"
                  style={{ backgroundColor: '#1e1e2a', color: '#888' }}>
                  Cancel
                </button>
                <button onClick={handleConfirmDownload}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold btn-shine"
                  style={{ backgroundColor: '#e8d44d', color: '#0a0a0f' }}>
                  <Download className="w-3.5 h-3.5" />
                  Download & Launch
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upgrade modal */}
      <AnimatePresence>
        {upgradeReason && (
          <UpgradeModal key="upgrade" feature={upgradeReason} onClose={() => setUpgradeReason(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
