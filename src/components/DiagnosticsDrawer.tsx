import React, { useEffect, useState } from 'react';
import { X, Activity, ArrowUpRight, ArrowDownLeft, Database, Trash2 } from 'lucide-react';
import { diagnostics } from '../lib/diagnostics.ts';
import type { BandwidthDiagnostics } from '../types/chat.ts';

interface DiagnosticsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  isFirebaseActive: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const DiagnosticsDrawer: React.FC<DiagnosticsDrawerProps> = ({
  isOpen,
  onClose,
  isFirebaseActive,
}) => {
  const [stats, setStats] = useState<BandwidthDiagnostics>(diagnostics.getStats());

  useEffect(() => {
    const unsubscribe = diagnostics.subscribe(setStats);
    return () => unsubscribe();
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-zinc-950 border-l border-zinc-800 shadow-2xl flex flex-col select-none">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-white">Spark Budget Diagnostics</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => diagnostics.reset()}
            title="Reset metrics"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            title="Close"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Metrics Summary Grid */}
      <div className="p-4 grid grid-cols-2 gap-3 border-b border-zinc-800/80 bg-zinc-900/40">
        <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800">
          <div className="flex items-center gap-1.5 text-zinc-400 text-xs mb-1">
            <ArrowUpRight className="w-3.5 h-3.5 text-blue-400" />
            <span>Estimated Sent</span>
          </div>
          <div className="text-lg font-bold text-white tabular-nums">
            {formatBytes(stats.bytesSent)}
          </div>
          <div className="text-[10px] text-zinc-500 mt-0.5 tabular-nums">
            {stats.eventsSent} signaling events
          </div>
        </div>

        <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800">
          <div className="flex items-center gap-1.5 text-zinc-400 text-xs mb-1">
            <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400" />
            <span>Estimated Received</span>
          </div>
          <div className="text-lg font-bold text-white tabular-nums">
            {formatBytes(stats.bytesReceived)}
          </div>
          <div className="text-[10px] text-zinc-500 mt-0.5 tabular-nums">
            {stats.eventsReceived} signaling events
          </div>
        </div>

        <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800">
          <div className="text-zinc-400 text-xs mb-1">Active Listeners</div>
          <div className="text-lg font-bold text-white tabular-nums">
            {stats.listenersActive}
          </div>
          <div className="text-[10px] text-emerald-400 mt-0.5">
            Strictly scoped paths
          </div>
        </div>

        <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800">
          <div className="text-zinc-400 text-xs mb-1">Total Chat Messages</div>
          <div className="text-lg font-bold text-white tabular-nums">
            {stats.messagesSent + stats.messagesReceived}
          </div>
          <div className="text-[10px] text-zinc-500 mt-0.5">
            Purged from inbox on ACK
          </div>
        </div>
      </div>

      {/* Spark Plan Limits Note */}
      <div className="px-4 py-3 bg-zinc-900/20 border-b border-zinc-800/60 text-[11px] text-zinc-400 flex items-start gap-2">
        <Database className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-zinc-200">Firebase Spark Free-Tier Targets:</span>{' '}
          Max 100 concurrent RTDB connections, 10 GB/mo downloads, 1 GB storage. Zero video media passes through Firebase.
        </div>
      </div>

      {/* Live Event Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
          Recent Event Stream (In-Memory)
        </div>
        {stats.history.length === 0 ? (
          <div className="text-center py-8 text-xs text-zinc-600">
            No events recorded yet. Start a chat to see live data.
          </div>
        ) : (
          stats.history.map((item) => (
            <div
              key={item.id}
              className="p-2.5 rounded-lg bg-zinc-900/70 border border-zinc-800 text-xs flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    item.direction === 'out' ? 'bg-blue-400' : 'bg-emerald-400'
                  }`}
                />
                <span className="font-mono text-zinc-300 shrink-0">{item.type}</span>
                <span className="text-zinc-500 truncate text-[11px]">{item.summary}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0 text-right tabular-nums">
                <span className="text-zinc-400 font-mono text-[10px]">
                  {formatBytes(item.bytes)}
                </span>
                <span className="text-zinc-600 text-[10px]">{item.time}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
