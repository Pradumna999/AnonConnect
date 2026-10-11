import React from 'react';
import { ShieldCheck, X, AlertTriangle, EyeOff, Lock, UserCheck } from 'lucide-react';

interface SafetyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SafetyModal: React.FC<SafetyModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none">
      <div className="w-full max-w-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 text-emerald-600 dark:text-emerald-400 mb-2">
          <ShieldCheck className="w-6 h-6" />
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white tracking-tight">
            Community Guidelines & Safety
          </h2>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-6">
          AnonConnect is designed for friendly conversations. Please follow these principles:
        </p>

        <div className="space-y-3.5">
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 flex gap-3.5">
            <UserCheck className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-200 mb-0.5">Strictly 18+ Only</h4>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Minors are prohibited from using this service. If you encounter a user you suspect
                is underage, use the Report button immediately.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 flex gap-3.5">
            <EyeOff className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-200 mb-0.5">Keep Personal Info Private</h4>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Never share your real name, address, phone number, social media accounts, or financial details.
                Stay safe and protect your identity.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 flex gap-3.5">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-200 mb-0.5">Zero Tolerance for Inappropriate Conduct</h4>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Nudity, sexual harassment, hate speech, bullying, scamming, and illegal behavior will result
                in an immediate session ban.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 flex gap-3.5">
            <Lock className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-200 mb-0.5">Direct & Private Connections</h4>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Your video and audio streams travel directly between you and your partner. AnonConnect
                never records or stores your video calls.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-end">
          <button
            onClick={onClose}
            className="py-3 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs transition-colors cursor-pointer shadow-xs"
          >
            I Agree & Understand
          </button>
        </div>
      </div>
    </div>
  );
};
