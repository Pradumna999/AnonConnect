import React, { useState } from 'react';
import { X, Instagram, Copy, Check, ExternalLink } from 'lucide-react';

interface ContactDevModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ContactDevModal: React.FC<ContactDevModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);
  const instagramId = 'brucewayne98769';

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(instagramId).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none">
      <div className="w-full max-w-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-2xl relative transition-colors">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex flex-col items-center text-center">
          {/* Instagram gradient circle */}
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 flex items-center justify-center text-white mb-4 shadow-md">
            <Instagram className="w-7 h-7" />
          </div>

          <h3 className="text-base font-bold text-zinc-900 dark:text-white mb-1">
            Want to contact the developer?
          </h3>

          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-5 leading-relaxed">
            Well here is my instagram id:
          </p>

          {/* Highlighted Handle Box */}
          <div className="w-full flex items-center justify-between p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 mb-4 transition-colors">
            <div className="flex items-center gap-2 pl-1">
              <span className="text-amber-500 font-bold">@</span>
              <span className="font-mono text-sm font-semibold text-zinc-900 dark:text-white select-all">
                {instagramId}
              </span>
            </div>

            <button
              onClick={handleCopy}
              title="Copy Instagram ID"
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-500/50 transition-all cursor-pointer shadow-2xs"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-emerald-600 dark:text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>

          {/* Action Button */}
          <a
            href={`https://instagram.com/${instagramId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-amber-500 hover:from-emerald-400 hover:to-amber-400 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
          >
            <span>Open on Instagram</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
};
