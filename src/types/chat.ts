/**
 * PulsePeer - Core Data Types & Protocol Schema
 * Designed for Spark Free-Tier Efficiency (Minimal Payload Sizes & Scoped Paths)
 */

export type ChatMode = 'text' | 'video';

export type SessionStatus = 
  | 'idle' 
  | 'searching' 
  | 'matched' 
  | 'connecting' 
  | 'connected' 
  | 'ended' 
  | 'error';

export interface QueueEntry {
  uid: string;
  mode: ChatMode;
  nickname: string;
  interest?: string;
  status: 'waiting' | 'claimed';
  createdAt: number;
  expiresAt: number;
  claimId?: string;
}

export interface ClientState {
  status: SessionStatus;
  roomId?: string;
  partnerNickname?: string;
  partnerUid?: string;
  role?: 'caller' | 'callee'; // Caller initiates WebRTC offer
  mode?: ChatMode;
  error?: string;
  updatedAt: number;
}

export interface RoomRecord {
  roomId: string;
  participantA: string;
  participantB: string;
  nicknameA: string;
  nicknameB: string;
  mode: ChatMode;
  createdAt: number;
  expiresAt: number;
  status: 'active' | 'closed';
}

export type InboxEventType = 
  | 'matched'
  | 'message' 
  | 'offer' 
  | 'answer' 
  | 'ice' 
  | 'partner_disconnected' 
  | 'partner_typing';

export interface InboxEvent {
  id: string;
  type: InboxEventType;
  payload: any;
  fromUid: string;
  roomId: string;
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  sender: 'me' | 'stranger' | 'system';
  senderNickname?: string;
  text: string;
  timestamp: number;
}

export interface BandwidthDiagnostics {
  bytesSent: number;
  bytesReceived: number;
  eventsSent: number;
  eventsReceived: number;
  messagesSent: number;
  messagesReceived: number;
  listenersActive: number;
  sessionStartTime: number;
  history: DiagnosticLogEntry[];
}

export interface DiagnosticLogEntry {
  id: string;
  time: string;
  direction: 'in' | 'out';
  type: string;
  bytes: number;
  summary: string;
}

export interface ReportPayload {
  roomId: string;
  reportedUid: string;
  reason: 'inappropriate' | 'spam' | 'harassment' | 'underage' | 'other';
  notes?: string;
  clientTimestamp: number;
}
