import React, { useState } from 'react';
import { Video, MessageSquare, Dices, Shield, Lock, Users, Sparkles } from 'lucide-react';
import type { ChatMode } from '../types/chat.ts';

interface LandingHeroProps {
  onStart: (mode: ChatMode, nickname: string, interest: string) => void;
  onOpenSafety: () => void;
  onOpenContactDev: () => void;
}

const FUN_NICKNAMES = [
  'CosmicVoyager',
  'NightOwl',
  'SolarNomad',
  'PixelRunner',
  'MidnightEcho',
  'EchoSeeker',
  'NeonDrifter',
  'VelvetSky',
  'SilverFox',
  'AtlasWanderer',
  'LunarMist',
  'ShadowPeak',
];

const POPULAR_TOPICS = [
  'General',
  'Music',
  'Gaming',
  'Movies',
  'Tech',
  'Anime',
  'Deep Talks',
  'Books',
];

export const LandingHero: React.FC<LandingHeroProps> = ({
  onStart,
  onOpenSafety,
  onOpenContactDev,
}) => {
  const [mode, setMode] = useState<ChatMode>('text');
  const [nickname, setNickname] = useState('');
  const [interest, setInterest] = useState('');
  const [isAgeConfirmed, setIsAgeConfirmed] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const randomizeNickname = () => {
    const random = FUN_NICKNAMES[Math.floor(Math.random() * FUN_NICKNAMES.length)];
    const suffix = Math.floor(Math.random() * 900 + 100);
    setNickname(`${random}${suffix}`);
  };

  const handleLaunch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAgeConfirmed) {
      setErrorMsg('Please confirm you are at least 18 years old and agree to the community rules.');
      return;
    }
    setErrorMsg('');
    const finalNick = nickname.trim() || 'Stranger';
    onStart(mode, finalNick, interest.trim());
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8 md:py-14 flex flex-col items-center">
      {/* Consumer Headline */}
      <div className="text-center max-w-2xl mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold mb-4 border border-emerald-500/20">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>Random 1-on-1 Encounters</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-zinc-900 dark:text-white mb-4">
          Meet new people. <span className="text-emerald-600 dark:text-emerald-400">Instantly</span> &{' '}
          <span className="text-amber-500">anonymously</span>.
        </h1>
        <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto">
          Start a live video or text conversation with random strangers from around the world. No registration, no downloads, 100% free.
        </p>
      </div>

      {/* Main Configuration Card */}
      <div className="w-full max-w-lg bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-xl dark:shadow-2xl transition-colors">
        <form onSubmit={handleLaunch} className="space-y-6">
          {/* Mode Selector (Green & Orange) */}
          <div>
            <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2.5">
              Choose Experience
            </label>
            <div className="grid grid-cols-2 gap-3.5">
              <button
                type="button"
                onClick={() => setMode('text')}
                className={`flex items-center justify-center gap-2.5 py-3.5 px-4 rounded-2xl border text-sm font-semibold transition-all cursor-pointer ${
                  mode === 'text'
                    ? 'bg-emerald-500/10 border-emerald-500 text-emerald-700 dark:text-emerald-300 shadow-xs ring-2 ring-emerald-500/30'
                    : 'bg-zinc-50 dark:bg-zinc-950/60 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:border-zinc-300 dark:hover:border-zinc-700'
                }`}
              >
                <MessageSquare className="w-4 h-4 text-emerald-500" />
                <span>Text Chat</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('video')}
                className={`flex items-center justify-center gap-2.5 py-3.5 px-4 rounded-2xl border text-sm font-semibold transition-all cursor-pointer ${
                  mode === 'video'
                    ? 'bg-amber-500/10 border-amber-500 text-amber-700 dark:text-amber-300 shadow-xs ring-2 ring-amber-500/30'
                    : 'bg-zinc-50 dark:bg-zinc-950/60 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:border-zinc-300 dark:hover:border-zinc-700'
                }`}
              >
                <Video className="w-4 h-4 text-amber-500" />
                <span>Video Call</span>
              </button>
            </div>
          </div>

          {/* Nickname Input */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="nickname" className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Nickname <span className="text-zinc-400 dark:text-zinc-500 font-normal lowercase">(optional)</span>
              </label>
              <button
                type="button"
                onClick={randomizeNickname}
                className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 font-medium cursor-pointer"
              >
                <Dices className="w-3.5 h-3.5" />
                <span>Randomize</span>
              </button>
            </div>
            <input
              id="nickname"
              type="text"
              maxLength={24}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="e.g. FriendlyStranger (or leave blank)"
              className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
            />
          </div>

          {/* Matching Topic / Interest */}
          <div>
            <label htmlFor="interest" className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
              Common Interests <span className="text-zinc-400 dark:text-zinc-500 font-normal lowercase">(optional)</span>
            </label>
            <input
              id="interest"
              type="text"
              maxLength={36}
              value={interest}
              onChange={(e) => setInterest(e.target.value)}
              placeholder="e.g. music, gaming, movies"
              className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all mb-2.5"
            />

            {/* Quick Pick Topic Tags */}
            <div className="flex flex-wrap gap-1.5">
              {POPULAR_TOPICS.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  onClick={() => setInterest(topic.toLowerCase())}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    interest.toLowerCase() === topic.toLowerCase()
                      ? 'bg-amber-500 text-white dark:bg-amber-500'
                      : 'bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  {topic}
                </button>
              ))}
            </div>
          </div>

          {/* 18+ Age & Safety Agreement */}
          <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isAgeConfirmed}
                onChange={(e) => {
                  setIsAgeConfirmed(e.target.checked);
                  if (e.target.checked) setErrorMsg('');
                }}
                className="mt-1 w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
              <span className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                I certify that I am at least 18 years old and agree to follow the{' '}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    onOpenSafety();
                  }}
                  className="text-emerald-600 dark:text-emerald-400 hover:underline font-semibold"
                >
                  Community Rules
                </button>
                . I understand I will be chatting with unverified strangers.
              </span>
            </label>
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-300">
              {errorMsg}
            </div>
          )}

          {/* Launch CTA Button */}
          <button
            type="submit"
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-amber-500 hover:from-emerald-400 hover:to-amber-400 active:scale-[0.99] text-white font-bold text-sm sm:text-base transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
          >
            Start Chatting
          </button>
        </form>
      </div>

      {/* Consumer Trust & Privacy Cards (No Technical Slop) */}
      <div className="w-full max-w-lg mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 shadow-xs flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 text-xs font-bold">
            <Lock className="w-4 h-4 text-emerald-500" />
            <span>100% Anonymous</span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            No signup, email, or profile required. Your chats remain private.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 shadow-xs flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 text-xs font-bold">
            <Users className="w-4 h-4 text-amber-500" />
            <span>Instant Matching</span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Connect in seconds. If you don't click with someone, skip to the next stranger.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 shadow-xs flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 text-xs font-bold">
            <Shield className="w-4 h-4 text-emerald-500" />
            <span>Safety First</span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Strict anti-harassment rules. One-click report and instant blocking.
          </p>
        </div>
      </div>

      {/* Developer Contact Section */}
      <div className="w-full max-w-lg mt-6 p-4 rounded-2xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 shadow-xs flex items-center justify-between gap-4 transition-colors">
        <div>
          <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
            Want to contact the developer?
          </p>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Reach out directly for feedback or questions
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenContactDev}
          className="px-4 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-bold text-xs transition-all cursor-pointer whitespace-nowrap"
        >
          Contact Dev
        </button>
      </div>
    </div>
  );
};
