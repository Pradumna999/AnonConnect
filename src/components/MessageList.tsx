import React, { useEffect, useRef } from 'react';
import type { ChatMessage } from '../types/chat.ts';

interface MessageListProps {
  messages: ChatMessage[];
  isPartnerTyping: boolean;
  partnerNickname: string;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  isPartnerTyping,
  partnerNickname,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom unless user has scrolled significantly up
  useEffect(() => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;

    if (isNearBottom && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isPartnerTyping]);

  return (
    <div
      ref={containerRef}
      className="flex-1 w-full overflow-y-auto px-4 py-4 space-y-3.5 scroll-smooth select-text bg-white dark:bg-zinc-900/40"
    >
      {messages.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500 dark:text-zinc-400">
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            Connected with <span className="text-amber-500">{partnerNickname || 'Stranger'}</span>
          </p>
          <p className="text-xs text-zinc-500 mt-1">Be respectful and friendly. Say hello!</p>
        </div>
      ) : (
        messages.map((msg) => {
          if (msg.sender === 'system') {
            return (
              <div key={msg.id} className="w-full flex justify-center my-2">
                <div className="px-3.5 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-600 dark:text-zinc-400 text-center max-w-sm font-medium shadow-2xs">
                  {msg.text}
                </div>
              </div>
            );
          }

          const isMe = msg.sender === 'me';

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-full`}
            >
              <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                <span className={`font-semibold ${isMe ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                  {isMe ? 'You' : msg.senderNickname || partnerNickname || 'Stranger'}
                </span>
                <span>·</span>
                <span>
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>

              <div
                className={`max-w-[85%] sm:max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words shadow-xs ${
                  isMe
                    ? 'bg-emerald-600 text-white rounded-br-xs'
                    : 'bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/80 text-zinc-900 dark:text-zinc-100 rounded-bl-xs'
                }`}
              >
                {msg.text}
              </div>
            </div>
          );
        })
      )}

      {/* Typing Indicator */}
      {isPartnerTyping && (
        <div className="flex items-center gap-2 px-1 text-xs text-zinc-500 dark:text-zinc-400 animate-pulse">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          <span>{partnerNickname || 'Stranger'} is typing...</span>
        </div>
      )}

      <div ref={bottomRef} className="h-1" />
    </div>
  );
};
