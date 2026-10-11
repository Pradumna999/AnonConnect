import React, { useState, useRef } from 'react';
import { Send, Sparkles, Loader2 } from 'lucide-react';

interface ChatComposerProps {
  onSendMessage: (text: string) => void;
  onSendTyping: () => void;
  disabled?: boolean;
  interest?: string;
}

export const ChatComposer: React.FC<ChatComposerProps> = ({
  onSendMessage,
  onSendTyping,
  disabled = false,
  interest,
}) => {
  const [text, setText] = useState('');
  const [isLoadingTopic, setIsLoadingTopic] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastTypingSentRef = useRef<number>(0);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSendMessage(trimmed);
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);

    // Throttle typing events: at most once every 3.5 seconds
    const now = Date.now();
    if (now - lastTypingSentRef.current > 3500) {
      lastTypingSentRef.current = now;
      onSendTyping();
    }

    // Auto-adjust textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  const handleGetAIIcebreaker = async () => {
    if (isLoadingTopic) return;
    setIsLoadingTopic(true);
    try {
      const res = await fetch('/api/ai/topic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interest }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.topic) {
          setText(data.topic);
          if (textareaRef.current) {
            textareaRef.current.focus();
          }
        }
      }
    } catch (err) {
      console.warn('Failed to fetch AI icebreaker:', err);
    } finally {
      setIsLoadingTopic(false);
    }
  };

  return (
    <div className="p-3 sm:p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/90 transition-colors">
      <div className="flex items-center justify-between gap-2 mb-2 px-1">
        <button
          type="button"
          onClick={handleGetAIIcebreaker}
          disabled={disabled || isLoadingTopic}
          title="Need something fun to talk about?"
          className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 font-semibold transition-colors disabled:opacity-50 cursor-pointer"
        >
          {isLoadingTopic ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Sparkles className="w-3.5 h-3.5" />
          )}
          <span>{isLoadingTopic ? 'Thinking of a topic...' : '💡 Conversation Starter'}</span>
        </button>

        <span
          className={`text-[11px] font-medium ${
            text.length > 900 ? 'text-amber-500 font-bold' : 'text-zinc-400 dark:text-zinc-500'
          }`}
        >
          {text.length}/1000
        </span>
      </div>

      <div className="relative flex items-end gap-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-3.5 py-2.5 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all shadow-2xs">
        <textarea
          ref={textareaRef}
          rows={1}
          maxLength={1000}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={disabled ? 'Chat has ended...' : 'Type a message... (Press Enter to send)'}
          className="flex-1 max-h-32 bg-transparent text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 resize-none outline-none leading-relaxed"
        />

        <button
          type="button"
          onClick={handleSend}
          disabled={disabled || !text.trim()}
          title="Send message"
          className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white transition-all cursor-pointer shrink-0 shadow-xs"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
