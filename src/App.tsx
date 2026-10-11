/**
 * AnonConnect - Anonymous Video & Text Chat
 * Clean, professional real-time anonymous stranger encounters
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header.tsx';
import { LandingHero } from './components/LandingHero.tsx';
import { VideoView } from './components/VideoView.tsx';
import { MessageList } from './components/MessageList.tsx';
import { ChatComposer } from './components/ChatComposer.tsx';
import { SafetyModal } from './components/SafetyModal.tsx';
import { ReportModal } from './components/ReportModal.tsx';
import { ContactDevModal } from './components/ContactDevModal.tsx';
import {
  initializeAnonymousSession,
  SessionConnectionManager,
} from './lib/firebaseClient.ts';
import { WebRTCManager } from './lib/webrtc.ts';
import type { ChatMode, ClientState, ChatMessage, InboxEvent, SessionStatus } from './types/chat.ts';
import { SkipForward, LogOut, Flag, Loader2 } from 'lucide-react';

export default function App() {
  // Theme state: dark / light
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('anonconnect_theme');
      if (saved === 'light' || saved === 'dark') return saved;
      return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    return 'dark';
  });

  // Sync theme with document class
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('anonconnect_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // App views
  const [isInChat, setIsInChat] = useState(false);
  const [status, setStatus] = useState<SessionStatus>('idle');
  const [mode, setMode] = useState<ChatMode>('text');
  const [nickname, setNickname] = useState('Stranger');
  const [interest, setInterest] = useState('');

  // Active room data
  const [roomId, setRoomId] = useState<string | null>(null);
  const [partnerNickname, setPartnerNickname] = useState('');
  const [partnerUid, setPartnerUid] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const [partnerDisconnected, setPartnerDisconnected] = useState(false);

  // Modals
  const [isSafetyOpen, setIsSafetyOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isContactDevOpen, setIsContactDevOpen] = useState(false);

  // Media & WebRTC state
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>('new');
  const [mediaError, setMediaError] = useState<string | null>(null);

  // References
  const connectionMgrRef = useRef<SessionConnectionManager | null>(null);
  const webrtcRef = useRef<WebRTCManager | null>(null);
  const sessionTokenRef = useRef<string>('');
  const currentUidRef = useRef<string>('');
  const currentRoomIdRef = useRef<string | null>(null);
  const typingTimerRef = useRef<any>(null);

  // Sync ref
  useEffect(() => {
    currentRoomIdRef.current = roomId;
  }, [roomId]);

  /**
   * Helper: Send authenticated API request
   */
  const apiFetch = useCallback(async (path: string, body: any) => {
    const token = sessionTokenRef.current;
    const res = await fetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    return res;
  }, []);

  /**
   * Handle Client State Transitions
   */
  const handleClientStateUpdate = useCallback(
    async (state: ClientState) => {
      setStatus(state.status);

      if (state.status === 'matched' && state.roomId) {
        setRoomId(state.roomId);
        currentRoomIdRef.current = state.roomId;
        setPartnerNickname(state.partnerNickname || 'Stranger');
        setPartnerUid(state.partnerUid || '');
        setPartnerDisconnected(false);

        setMessages([
          {
            id: `welcome_${Date.now()}`,
            sender: 'system',
            text: `Connected with ${state.partnerNickname || 'Stranger'}. Say hello!`,
            timestamp: Date.now(),
          },
        ]);

        // If video chat, initialize P2P negotiation
        if (state.mode === 'video' && webrtcRef.current) {
          webrtcRef.current.initPeerConnection(state.role || 'callee');

          if (state.role === 'caller') {
            try {
              const offer = await webrtcRef.current.createOffer();
              await apiFetch('/api/signaling/send', {
                roomId: state.roomId,
                type: 'offer',
                payload: offer,
              });
            } catch (err) {
              console.warn('[WebRTC] Error initiating offer:', err);
            }
          }
        }
      } else if (state.status === 'ended') {
        setPartnerDisconnected(true);
      }
    },
    [apiFetch]
  );

  /**
   * Inbox Event Processor
   */
  const handleInboxEvent = useCallback(
    async (event: InboxEvent) => {
      // Ignore events for previous rooms
      if (currentRoomIdRef.current && event.roomId !== currentRoomIdRef.current) {
        apiFetch('/api/events/ack', { eventId: event.id }).catch(() => {});
        return;
      }

      switch (event.type) {
        case 'matched': {
          if (!currentRoomIdRef.current || status === 'searching') {
            handleClientStateUpdate({
              status: 'matched',
              roomId: event.roomId || event.payload.roomId,
              partnerNickname: event.payload.partnerNickname,
              partnerUid: event.payload.partnerUid,
              role: event.payload.role || 'caller',
              mode: event.payload.mode,
              updatedAt: Date.now(),
            });
          }
          break;
        }

        case 'message': {
          const newMsg: ChatMessage = {
            id: event.id,
            sender: 'stranger',
            senderNickname: event.payload.senderNickname,
            text: event.payload.text,
            timestamp: event.timestamp,
          };
          setMessages((prev) => [...prev, newMsg]);
          break;
        }

        case 'offer': {
          if (webrtcRef.current && event.payload) {
            try {
              const answer = await webrtcRef.current.handleOffer(event.payload);
              await apiFetch('/api/signaling/send', {
                roomId: event.roomId,
                type: 'answer',
                payload: answer,
              });
            } catch (err) {
              console.warn('[Signaling] Failed to process offer:', err);
            }
          }
          break;
        }

        case 'answer': {
          if (webrtcRef.current && event.payload) {
            try {
              await webrtcRef.current.handleAnswer(event.payload);
            } catch (err) {
              console.warn('[Signaling] Failed to process answer:', err);
            }
          }
          break;
        }

        case 'ice': {
          if (webrtcRef.current && event.payload) {
            webrtcRef.current.addIceCandidate(event.payload).catch(() => {});
          }
          break;
        }

        case 'partner_typing': {
          setIsPartnerTyping(true);
          if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
          typingTimerRef.current = setTimeout(() => {
            setIsPartnerTyping(false);
          }, 3500);
          break;
        }

        case 'partner_disconnected': {
          setPartnerDisconnected(true);
          setMessages((prev) => [
            ...prev,
            {
              id: `sys_${Date.now()}`,
              sender: 'system',
              text: 'Stranger has left the conversation.',
              timestamp: Date.now(),
            },
          ]);
          if (webrtcRef.current) {
            webrtcRef.current.cleanupPeerConnection();
          }
          setRemoteStream(null);
          setConnectionState('disconnected');
          break;
        }
      }

      // Purge processed event from inbox
      apiFetch('/api/events/ack', { eventId: event.id }).catch(() => {});
    },
    [apiFetch, handleClientStateUpdate, status]
  );

  /**
   * Launch Chat Session
   */
  const handleStartSession = async (
    chosenMode: ChatMode,
    chosenNick: string,
    chosenInterest: string
  ) => {
    setMode(chosenMode);
    setNickname(chosenNick);
    setInterest(chosenInterest);
    setIsInChat(true);
    setStatus('searching');
    setPartnerDisconnected(false);
    setMediaError(null);

    try {
      // 1. Invisible Anonymous Auth Initialization
      const authResult = await initializeAnonymousSession();
      sessionTokenRef.current = authResult.token;
      currentUidRef.current = authResult.uid;

      // 2. Setup Scoped Connection Manager
      const connMgr = new SessionConnectionManager(
        authResult.uid,
        authResult.token,
        authResult.isRealFirebase,
        authResult.serverFirebaseConfigured
      );
      connectionMgrRef.current = connMgr;

      connMgr.attachClientStateListener(handleClientStateUpdate);
      connMgr.attachInboxListener(handleInboxEvent);
      connMgr.attachPresence();

      // 3. If Video mode, capture local camera & mic
      if (chosenMode === 'video') {
        const webrtc = new WebRTCManager({
          onLocalStream: (stream) => setLocalStream(stream),
          onRemoteStream: (stream) => setRemoteStream(stream),
          onIceCandidate: (candidate) => {
            if (currentRoomIdRef.current) {
              apiFetch('/api/signaling/send', {
                roomId: currentRoomIdRef.current,
                type: 'ice',
                payload: candidate,
              }).catch(() => {});
            }
          },
          onConnectionStateChange: (state) => setConnectionState(state),
          onError: (err) => setMediaError(err),
        });
        webrtcRef.current = webrtc;
        await webrtc.startMedia(true, true);
      }

      // 4. Request Match via Server
      const matchRes = await apiFetch('/api/match/start', {
        mode: chosenMode,
        nickname: chosenNick,
        interest: chosenInterest,
      });

      if (!matchRes.ok) {
        const err = await matchRes.json();
        throw new Error(err.error || 'Matchmaking request failed');
      }

      const matchData = await matchRes.json();
      if (matchData.status === 'matched') {
        handleClientStateUpdate(matchData);
      }
    } catch (err: any) {
      console.error('[Session Error]', err);
      setMediaError(err.message || 'Failed to start session');
      setStatus('error');
    }
  };

  /**
   * Skip to Next Stranger
   */
  const handleSkip = async () => {
    if (webrtcRef.current) {
      webrtcRef.current.cleanupPeerConnection();
    }
    setRemoteStream(null);
    setConnectionState('new');
    setPartnerDisconnected(false);
    setMessages([]);
    setRoomId(null);
    currentRoomIdRef.current = null;
    setStatus('searching');

    try {
      await apiFetch('/api/match/skip', { roomId });
      const matchRes = await apiFetch('/api/match/start', {
        mode,
        nickname,
        interest,
      });
      if (matchRes.ok) {
        const matchData = await matchRes.json();
        if (matchData.status === 'matched') {
          handleClientStateUpdate(matchData);
        }
      }
    } catch (err) {
      console.warn('[Skip Error]', err);
    }
  };

  /**
   * End Chat & Return Home
   */
  const handleEndSession = async () => {
    try {
      await apiFetch('/api/session/end', { roomId });
    } catch {
      // silent
    }

    if (connectionMgrRef.current) {
      connectionMgrRef.current.detachAll();
      connectionMgrRef.current = null;
    }

    if (webrtcRef.current) {
      webrtcRef.current.destroy();
      webrtcRef.current = null;
    }

    setLocalStream(null);
    setRemoteStream(null);
    setRoomId(null);
    currentRoomIdRef.current = null;
    setMessages([]);
    setIsInChat(false);
    setStatus('idle');
  };

  /**
   * Send Text Message
   */
  const handleSendMessage = async (text: string) => {
    if (!roomId) return;
    const optimisticMsg: ChatMessage = {
      id: `local_${Date.now()}`,
      sender: 'me',
      text,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const res = await apiFetch('/api/chat/send', {
        roomId,
        text,
      });
      if (!res.ok) {
        const data = await res.json();
        setMessages((prev) => [
          ...prev,
          {
            id: `err_${Date.now()}`,
            sender: 'system',
            text: `Failed to deliver message: ${data.error || 'Network error'}`,
            timestamp: Date.now(),
          },
        ]);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          sender: 'system',
          text: `Message delivery error: ${err.message}`,
          timestamp: Date.now(),
        },
      ]);
    }
  };

  /**
   * Send Typing Indicator
   */
  const handleSendTyping = async () => {
    if (!roomId) return;
    try {
      await apiFetch('/api/signaling/send', {
        roomId,
        type: 'partner_typing',
        payload: { isTyping: true },
      });
    } catch {
      // silent
    }
  };

  /**
   * Submit Abuse Report
   */
  const handleSubmitReport = async (payload: { reason: any; notes?: string }) => {
    if (!roomId) return;
    await apiFetch('/api/report', {
      roomId,
      reason: payload.reason,
      notes: payload.notes,
    });
    handleSkip();
  };

  // Keyboard shortcut: Esc to Skip
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isInChat && status === 'matched') {
        handleSkip();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isInChat, status, roomId]);

  // Clean cleanup on component unmount
  useEffect(() => {
    return () => {
      if (connectionMgrRef.current) connectionMgrRef.current.detachAll();
      if (webrtcRef.current) webrtcRef.current.destroy();
    };
  }, []);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col font-sans transition-colors selection:bg-emerald-500 selection:text-white">
      {/* Top Bar */}
      <Header
        onOpenSafety={() => setIsSafetyOpen(true)}
        onOpenContactDev={() => setIsContactDevOpen(true)}
        theme={theme}
        onToggleTheme={toggleTheme}
        isInChat={isInChat}
      />

      {/* Main Container */}
      <main className="flex-1 flex flex-col max-w-7xl w-full mx-auto p-3 sm:p-4 md:p-6">
        {!isInChat ? (
          <LandingHero
            onStart={handleStartSession}
            onOpenSafety={() => setIsSafetyOpen(true)}
            onOpenContactDev={() => setIsContactDevOpen(true)}
          />
        ) : (
          <div className="flex-1 flex flex-col h-[calc(100vh-5.5rem)] max-h-[920px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-xl dark:shadow-2xl transition-colors">
            {/* Active Session Action Bar */}
            <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/90 dark:bg-zinc-950/80 flex items-center justify-between gap-3 transition-colors">
              <div className="flex items-center gap-2.5">
                <button
                  onClick={handleEndSession}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-all cursor-pointer shadow-2xs"
                >
                  <LogOut className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Stop</span>
                </button>

                {/* Prominent Next Stranger Button in Vibrant Amber Orange */}
                <button
                  onClick={handleSkip}
                  title="Next Stranger (Press Esc)"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-zinc-950 font-bold text-xs transition-all shadow-sm cursor-pointer"
                >
                  <SkipForward className="w-4 h-4 fill-zinc-950" />
                  <span>Next Stranger</span>
                </button>
              </div>

              {/* Status Indicator */}
              <div className="flex items-center gap-2 text-xs">
                {status === 'searching' && (
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-medium">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Finding someone for you...</span>
                  </div>
                )}
                {status === 'matched' && (
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="hidden sm:inline text-zinc-500">Connected to:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {partnerNickname || 'Stranger'}
                    </span>
                  </div>
                )}
                {partnerDisconnected && (
                  <span className="text-red-500 font-semibold">Stranger left</span>
                )}
              </div>

              {/* Report Button */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsReportOpen(true)}
                  disabled={status !== 'matched' && !partnerDisconnected}
                  title="Report inappropriate conduct"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-red-300 dark:hover:border-red-900/60 bg-white dark:bg-zinc-900 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-40 transition-colors cursor-pointer shadow-2xs"
                >
                  <Flag className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Report</span>
                </button>
              </div>
            </div>

            {/* Main Stage Grid (Video or Text Only) */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
              {/* Searching Screen Overlay */}
              {status === 'searching' && (
                <div className="absolute inset-0 z-20 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center select-none transition-colors">
                  <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 mb-4 shadow-lg animate-pulse">
                    <Loader2 className="w-8 h-8 animate-spin" />
                  </div>
                  <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
                    Finding someone to chat with...
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 max-w-sm mb-6 leading-relaxed">
                    {interest
                      ? `Searching for a stranger interested in "${interest}", or anyone ready to talk.`
                      : 'Looking for an available stranger worldwide...'}
                  </p>
                  <button
                    onClick={handleEndSession}
                    className="px-5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
                  >
                    Cancel Search
                  </button>
                </div>
              )}

              {/* Error Notification */}
              {mediaError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/60 border-b border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-300 flex items-center justify-between">
                  <span>{mediaError}</span>
                  <button
                    onClick={() => setMediaError(null)}
                    className="underline text-red-500 ml-4 cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {/* Video Panel (If Video Mode) */}
              {mode === 'video' && (
                <div className="flex-1 lg:w-3/5 p-3 flex flex-col min-h-[260px] lg:min-h-0 bg-zinc-100 dark:bg-zinc-950/50">
                  <VideoView
                    localStream={localStream}
                    remoteStream={remoteStream}
                    partnerNickname={partnerNickname}
                    connectionState={connectionState}
                    onToggleAudio={() => webrtcRef.current?.toggleAudio() ?? false}
                    onToggleVideo={() => webrtcRef.current?.toggleVideo() ?? false}
                  />
                </div>
              )}

              {/* Text Chat Panel */}
              <div
                className={`flex flex-col ${
                  mode === 'video'
                    ? 'lg:w-2/5 border-t lg:border-t-0 lg:border-l border-zinc-200 dark:border-zinc-800'
                    : 'flex-1'
                } bg-white dark:bg-zinc-900 overflow-hidden`}
              >
                {/* Messages feed */}
                <MessageList
                  messages={messages}
                  isPartnerTyping={isPartnerTyping}
                  partnerNickname={partnerNickname}
                />

                {/* Partner Disconnected Bar */}
                {partnerDisconnected && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border-t border-amber-200 dark:border-amber-900/60 flex items-center justify-between gap-3">
                    <p className="text-xs text-amber-800 dark:text-amber-300 font-medium">
                      Stranger has left. Ready for your next conversation?
                    </p>
                    <button
                      onClick={handleSkip}
                      className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-zinc-950 text-xs font-bold transition-all cursor-pointer shrink-0 shadow-sm"
                    >
                      Find Next Stranger
                    </button>
                  </div>
                )}

                {/* Message Composer */}
                <ChatComposer
                  onSendMessage={handleSendMessage}
                  onSendTyping={handleSendTyping}
                  disabled={status !== 'matched' || partnerDisconnected}
                  interest={interest}
                />
              </div>
            </div>

            {/* In-Chat Footer Bar */}
            <div className="px-4 py-2 border-t border-zinc-200 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-950/60 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
              <button
                type="button"
                onClick={() => setIsContactDevOpen(true)}
                className="hover:text-amber-500 font-medium transition-colors cursor-pointer"
              >
                Want to contact the developer?
              </button>
              <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                AnonConnect · 100% Anonymous
              </span>
            </div>
          </div>
        )}
      </main>

      {/* Community Safety Modal */}
      <SafetyModal
        isOpen={isSafetyOpen}
        onClose={() => setIsSafetyOpen(false)}
      />

      {/* Abuse Report Modal */}
      <ReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        onSubmitReport={handleSubmitReport}
        partnerNickname={partnerNickname}
      />

      {/* Developer Contact Modal */}
      <ContactDevModal
        isOpen={isContactDevOpen}
        onClose={() => setIsContactDevOpen(false)}
      />
    </div>
  );
}
