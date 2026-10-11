import type { BandwidthDiagnostics, DiagnosticLogEntry } from '../types/chat.ts';

class DiagnosticsTracker {
  private stats: BandwidthDiagnostics = {
    bytesSent: 0,
    bytesReceived: 0,
    eventsSent: 0,
    eventsReceived: 0,
    messagesSent: 0,
    messagesReceived: 0,
    listenersActive: 0,
    sessionStartTime: Date.now(),
    history: [],
  };

  private listeners = new Set<(stats: BandwidthDiagnostics) => void>();

  public getStats(): BandwidthDiagnostics {
    return { ...this.stats, history: [...this.stats.history] };
  }

  public subscribe(cb: (stats: BandwidthDiagnostics) => void) {
    this.listeners.add(cb);
    cb(this.getStats());
    return () => {
      this.listeners.delete(cb);
    };
  }

  private notify() {
    const current = this.getStats();
    this.listeners.forEach((cb) => cb(current));
  }

  public recordEvent(
    direction: 'in' | 'out',
    type: string,
    payload: any,
    summary: string
  ) {
    const raw = typeof payload === 'string' ? payload : JSON.stringify(payload || {});
    // UTF-8 serialized byte estimate
    const bytes = new Blob([raw]).size;

    if (direction === 'out') {
      this.stats.bytesSent += bytes;
      this.stats.eventsSent += 1;
      if (type === 'message') this.stats.messagesSent += 1;
    } else {
      this.stats.bytesReceived += bytes;
      this.stats.eventsReceived += 1;
      if (type === 'message') this.stats.messagesReceived += 1;
    }

    const logEntry: DiagnosticLogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      time: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      direction,
      type,
      bytes,
      summary,
    };

    this.stats.history = [logEntry, ...this.stats.history].slice(0, 30);
    this.notify();
  }

  public setListenersCount(count: number) {
    this.stats.listenersActive = count;
    this.notify();
  }

  public reset() {
    this.stats = {
      bytesSent: 0,
      bytesReceived: 0,
      eventsSent: 0,
      eventsReceived: 0,
      messagesSent: 0,
      messagesReceived: 0,
      listenersActive: 0,
      sessionStartTime: Date.now(),
      history: [],
    };
    this.notify();
  }
}

export const diagnostics = new DiagnosticsTracker();
