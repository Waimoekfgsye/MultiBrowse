import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Pencil, Trash2, Check, X, FolderOpen } from 'lucide-react';
import { useAppStore } from '../store/StoreContext';

const GROUP_COLORS = ['#e8d44d', '#22c55e', '#3b82f6', '#ef4444', '#a855f7', '#f97316', '#ec4899', '#06b6d4'];

export default function GroupsView() {
  const { groups, profiles, addGroup, updateGroup, deleteGroup, addToast } = useAppStore();
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(GROUP_COLORS[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  const getProfileCount = (groupName: string) => profiles.filter(p => p.group === groupName).length;

  const handleCreate = () => {
    if (!newName.trim()) return;
    addGroup(newName.trim(), newColor);
    setNewName('');
    setNewColor(GROUP_COLORS[0]);
  };

  const handleStartEdit = (id: string, name: string, color: string) => {
    setEditingId(id);
    setEditName(name);
    setEditColor(color);
  };

  const handleSaveEdit = () => {
    if (!editingId || !editName.trim()) return;
    updateGroup(editingId, { name: editName.trim(), color: editColor });
    setEditingId(null);
  };

  const handleDelete = (id: string, name: string) => {
    if (name === 'Default') {
      addToast('error', 'Cannot delete the Default group');
      return;
    }
    deleteGroup(id);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid #1e1e2a' }}>
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold" style={{ color: '#e8e8f0' }}>Groups</h1>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(232,212,77,0.1)', color: '#e8d44d' }}>
            {groups.length}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Create group form */}
        <div className="rounded-xl p-4" style={{ backgroundColor: '#13131c', border: '1px solid #1e1e2a' }}>
          <h3 className="text-sm font-medium mb-3" style={{ color: '#e8e8f0' }}>Create New Group</h3>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="text-[10px] font-medium uppercase tracking-wider mb-1 block" style={{ color: '#555570' }}>Name</label>
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Group name..."
                className="w-full px-3 py-2 rounded-lg text-xs"
                style={{ backgroundColor: '#0a0a0f', border: '1px solid #1e1e2a', color: '#e8e8f0' }}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
              />
            </div>
            <div>
              <label className="text-[10px] font-medium uppercase tracking-wider mb-1 block" style={{ color: '#555570' }}>Color</label>
              <div className="flex items-center gap-1">
                {GROUP_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setNewColor(c)}
                    className="w-6 h-6 rounded-full transition-transform"
                    style={{
                      backgroundColor: c,
                      transform: newColor === c ? 'scale(1.2)' : 'scale(1)',
                      boxShadow: newColor === c ? `0 0 0 2px #0a0a0f, 0 0 0 4px ${c}` : 'none',
                    }}
                  />
                ))}
              </div>
            </div>
            <button
              onClick={handleCreate}
              className="px-4 py-2 rounded-lg text-xs font-medium mt-4"
              style={{ backgroundColor: '#e8d44d', color: '#0a0a0f' }}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Group list */}
        <div className="space-y-2">
          <AnimatePresence>
            {groups.map(group => (
              <motion.div
                key={group.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-center gap-4 px-4 py-3 rounded-xl transition-colors"
                style={{ backgroundColor: '#13131c', border: '1px solid #1e1e2a' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#2a2a3a')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#1e1e2a')}
              >
                {editingId === group.id ? (
                  <>
                    <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: editColor }} />
                    <input
                      type="text"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="flex-1 px-2 py-1 rounded text-sm"
                      style={{ backgroundColor: '#0a0a0f', border: '1px solid #e8d44d', color: '#e8e8f0' }}
                      onKeyDown={e => e.key === 'Enter' && handleSaveEdit()}
                      autoFocus
                    />
                    <div className="flex items-center gap-1">
                      {GROUP_COLORS.map(c => (
                        <button
                          key={c}
                          onClick={() => setEditColor(c)}
                          className="w-5 h-5 rounded-full transition-transform"
                          style={{
                            backgroundColor: c,
                            transform: editColor === c ? 'scale(1.15)' : 'scale(1)',
                            boxShadow: editColor === c ? `0 0 0 2px #0a0a0f, 0 0 0 3px ${c}` : 'none',
                          }}
                        />
                      ))}
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={handleSaveEdit}>
                        <Check className="w-4 h-4" style={{ color: '#22c55e' }} />
                      </button>
                      <button onClick={() => setEditingId(null)}>
                        <X className="w-4 h-4" style={{ color: '#ef4444' }} />
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium" style={{ color: '#e8e8f0' }}>{group.name}</div>
                      <div className="text-[10px]" style={{ color: '#555570' }}>
                        {getProfileCount(group.name)} profile{getProfileCount(group.name) !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleStartEdit(group.id, group.name, group.color)}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ color: '#555570' }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#1e1e2a')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      {group.name !== 'Default' && (
                        <button
                          onClick={() => handleDelete(group.id, group.name)}
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ color: '#ef4444' }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)')}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {groups.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3" style={{ backgroundColor: 'rgba(232,212,77,0.05)' }}>
              <FolderOpen className="w-7 h-7" style={{ color: '#333348' }} />
            </div>
            <h3 className="text-sm font-medium mb-1" style={{ color: '#666680' }}>No groups</h3>
            <p className="text-xs" style={{ color: '#444460' }}>Create a group to organize your profiles</p>
          </div>
        )}
      </div>
    </div>
  );
}
