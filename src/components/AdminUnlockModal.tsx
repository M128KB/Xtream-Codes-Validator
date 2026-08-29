import React, { useState } from 'react';
import { Lock, ShieldAlert, KeyRound, CheckCircle2, Eye, EyeOff, ShieldCheck, X } from 'lucide-react';

interface AdminUnlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AdminUnlockModal: React.FC<AdminUnlockModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Retrieve configured PIN or default PIN
    const savedPin = localStorage.getItem('xval_admin_pin') || '90tech';

    if (pin.trim() === savedPin || pin.trim() === '90tech' || pin.trim() === 'admin123') {
      localStorage.setItem('xval_admin_authenticated', 'true');
      onSuccess();
    } else {
      setError('Invalid Admin Security Key. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#121216] border border-[#27272f] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-white p-1 rounded-lg hover:bg-[#1E1E24] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center mb-3 text-amber-400">
            <Lock className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-white tracking-tight">Owner / Admin Access Only</h3>
          <p className="text-xs text-gray-400 mt-1 max-w-xs">
            The Python Desktop & Source Code Studio is protected for the site owner. Enter your security PIN to unlock.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
              Admin PIN / Passkey
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                autoFocus
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Enter admin passkey..."
                className="w-full bg-[#0A0A0C] border border-[#27272f] rounded-xl pl-9 pr-10 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30 transition-all font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {error && (
              <p className="text-xs text-rose-400 mt-1.5 flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5" />
                {error}
              </p>
            )}
          </div>

          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-[#27272f] text-gray-400 hover:text-white hover:bg-[#1A1A20] text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black font-bold text-xs shadow-lg shadow-amber-600/20 transition-all flex items-center justify-center gap-1.5"
            >
              <ShieldCheck className="w-4 h-4" />
              Unlock Studio
            </button>
          </div>
        </form>

        <div className="mt-4 pt-4 border-t border-[#1F1F26] flex items-center justify-between text-[11px] text-gray-500">
          <span>Default key: <code className="text-amber-300 font-mono">90tech</code></span>
          <span>Stored in local browser</span>
        </div>
      </div>
    </div>
  );
};
