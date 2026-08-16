import React from 'react';
import { X, ShieldCheck, UserCheck, Check, Building } from 'lucide-react';
import { db } from '../../services/db';
import { User } from '../../types';
import { SecureImage } from './SecureFile';

interface QuickUserSwitchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserSwitched: () => void;
}

export const QuickUserSwitchModal: React.FC<QuickUserSwitchModalProps> = ({
  isOpen,
  onClose,
  onUserSwitched
}) => {
  if (!isOpen) return null;

  const users = db.getUsers().filter(user => user.status === 'active');
  const currentUser = db.getCurrentUser();

  const handleSelectUser = async (user: User) => {
    try {
      await db.setCurrentUserId(user.id);
      onUserSwitched();
      onClose();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to switch user.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-100 text-amber-700">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Secure User Impersonation</h3>
              <p className="text-xs text-slate-500">Temporarily use an active account; every switch is recorded in the audit log.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-3">
          {users.map((user) => {
            const isSelected = user.id === currentUser.id;
            return (
              <button
                key={user.id}
                onClick={() => !isSelected && handleSelectUser(user)}
                disabled={isSelected}
                className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center justify-between ${
                  isSelected 
                    ? 'border-amber-500 bg-amber-50/50 ring-1 ring-amber-500/20 cursor-default' 
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  {user.avatarUrl ? (
                    <SecureImage source={user.avatarUrl} alt={user.name} className="w-10 h-10 rounded-full object-cover border border-slate-200" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-slate-800 text-white font-bold text-sm flex items-center justify-center">
                      {user.name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs sm:text-sm text-slate-900">{user.name}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                        {user.roleName}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 font-mono mt-0.5">{user.email}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                      <Building className="w-3 h-3" />
                      <span>
                        Access: {user.companyAccess === 'all' ? 'All Companies' : `${user.companyAccess.length} Selected Companies`}
                      </span>
                    </div>
                  </div>
                </div>

                {isSelected && (
                  <div className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center shrink-0">
                    <Check className="w-4 h-4 stroke-[3]" />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
