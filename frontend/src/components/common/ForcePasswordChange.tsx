import React, { useState } from 'react';
import { KeyRound, LogOut, ShieldCheck } from 'lucide-react';
import { apiRequest } from '../../services/api';
import { logout } from '../../services/auth';

interface ForcePasswordChangeProps {
  onComplete: () => Promise<void>;
  onLogout: () => void;
}

export function ForcePasswordChange({ onComplete, onLogout }: ForcePasswordChangeProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (newPassword !== confirmation) {
      setError('New password and confirmation do not match.');
      return;
    }

    setBusy(true);
    try {
      await apiRequest('/auth/password', {
        method: 'PUT',
        body: JSON.stringify({
          currentPassword,
          password: newPassword,
          password_confirmation: confirmation,
        }),
      });
      await onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to change password.');
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    await logout();
    onLogout();
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl border border-slate-200">
        <div className="bg-[#12243d] px-8 py-7 text-white">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-orange-500 p-3"><ShieldCheck size={28} /></div>
            <div>
              <h1 className="text-xl font-bold">Secure your administrator account</h1>
              <p className="text-sm text-slate-300">The temporary installation password must be replaced.</p>
            </div>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-5 p-8">
          {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">Current password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={event => setCurrentPassword(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
              required
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">New password</span>
            <input
              type="password"
              autoComplete="new-password"
              minLength={12}
              value={newPassword}
              onChange={event => setNewPassword(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
              required
            />
            <span className="mt-1 block text-xs text-slate-500">Use at least 12 characters.</span>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">Confirm new password</span>
            <input
              type="password"
              autoComplete="new-password"
              minLength={12}
              value={confirmation}
              onChange={event => setConfirmation(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
              required
            />
          </label>

          <button
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500 py-3 font-bold text-white transition hover:bg-orange-600 disabled:opacity-60"
          >
            <KeyRound size={18} />
            {busy ? 'Updating password…' : 'Change password and continue'}
          </button>

          <button
            type="button"
            onClick={signOut}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
