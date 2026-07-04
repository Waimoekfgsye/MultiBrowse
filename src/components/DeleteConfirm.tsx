import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';
import { useAppStore } from '../store/StoreContext';

export default function DeleteConfirm() {
  const { selectedProfiles, setActiveModal, deleteSelectedProfiles } = useAppStore();
  const count = selectedProfiles.size;

  const handleDelete = () => {
    deleteSelectedProfiles();
    setActiveModal(null);
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
          className="relative w-full max-w-sm rounded-2xl p-6"
          style={{ backgroundColor: '#13131c', border: '1px solid #1e1e2a' }}
        >
          <button
            onClick={() => setActiveModal(null)}
            className="absolute top-4 right-4 p-1.5 rounded-lg"
            style={{ color: '#555570' }}
          >
            <X className="w-5 h-5" />
          </button>

          <div className="text-center mb-6">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: 'rgba(239,68,68,0.1)' }}
            >
              <AlertTriangle className="w-7 h-7" style={{ color: '#ef4444' }} />
            </div>
            <h2 className="text-lg font-bold mb-1" style={{ color: '#e8e8f0' }}>Delete Profiles</h2>
            <p className="text-sm" style={{ color: '#666680' }}>
              {count} profile{count !== 1 ? 's' : ''} will be removed
            </p>
          </div>

          <p className="text-xs text-center mb-6" style={{ color: '#555570' }}>
            This action cannot be undone. All selected profiles and their data will be permanently deleted.
          </p>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveModal(null)}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium"
              style={{ backgroundColor: '#1e1e2a', color: '#8888a0' }}
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium"
              style={{ backgroundColor: '#ef4444', color: '#ffffff' }}
            >
              Delete
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
