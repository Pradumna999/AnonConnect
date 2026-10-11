import React from 'react';
import { ShieldCheck, Moon, Sun, MessageCircle, MessageSquareQuote } from 'lucide-react';

interface HeaderProps {
  onOpenSafety: () => void;
  onOpenContactDev: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  isInChat: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSafety,
  onOpenContactDev,
  theme,
  onToggleTheme,
  isInChat,
}) => {
  return (
    <header className="w-full border-b transition-colors sticky top-0 z-40 backdrop-blur-md bg-white/95 border-zinc-200 dark:bg-zinc-950/95 dark:border-zinc-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand Zone */}
        <div className="flex items-center gap-3 shrink-0">
          <a href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-amber-500 flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-lg tracking-tight text-zinc-900 dark:text-zinc-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  Anon<span className="text-amber-500">Connect</span>
                </span>
              </div>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 -mt-1 font-medium hidden sm:inline">
                Talk to Strangers
              </span>
            </div>
          </a>
        </div>

        {/* Navigation Links */}
        <nav className="flex items-center gap-3 sm:gap-5 text-sm">
          {/* Want to contact the developer? */}
          <button
            onClick={onOpenContactDev}
            className="text-xs sm:text-sm font-semibold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors cursor-pointer flex items-center gap-1.5 py-1 px-2 rounded-lg hover:bg-amber-500/10"
          >
            <MessageSquareQuote className="w-4 h-4 text-amber-500" />
            <span className="hidden sm:inline">Want to contact the developer?</span>
            <span className="sm:hidden">Contact Dev</span>
          </button>

          <button
            onClick={onOpenSafety}
            className="text-xs sm:text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer flex items-center gap-1.5 py-1 px-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span className="hidden md:inline">Community Rules</span>
          </button>

          {/* Light / Dark Mode Toggle */}
          <button
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="p-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 hover:text-amber-500 dark:hover:text-amber-400 hover:border-amber-500/50 transition-all cursor-pointer shadow-xs"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-zinc-700" />
            )}
          </button>
        </nav>
      </div>
    </header>
  );
};
