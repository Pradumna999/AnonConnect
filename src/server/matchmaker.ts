import crypto from 'crypto';
import { adminDb, isFirebaseConfigured } from './firebaseAdmin.ts';
import type { ChatMode, ClientState, InboxEvent, QueueEntry, RoomRecord } from '../types/chat.ts';

// In-memory state store (used directly or as mirror for fast concurrency & preview)
const localQueue = new Map<string, QueueEntry>();
const localClientStates = new Map<string, ClientState>();
const localRooms = new Map<string, RoomRecord>();
const localInboxes = new Map<string, InboxEvent[]>();
const userRateLimits = new Map<string, { count: number; resetAt: number }>();

const QUEUE_TTL_MS = 60 * 1000; // 60 seconds queue TTL
const MAX_MSG_LENGTH = 1000;
const MAX_NICKNAME_LENGTH = 24;

// Periodic cleanup of expired queue entries and abandoned rooms
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [uid, entry] of localQueue.entries()) {
    if (entry.expiresAt < now) {
      localQueue.delete(uid);
    }
  }
  for (const [roomId, room] of localRooms.entries()) {
    if (room.expiresAt < now && room.status === 'closed') {
      localRooms.delete(roomId);
    }
  }
}, 30 * 1000);
if (cleanupInterval.unref) {
  cleanupInterval.unref();
}

export function checkRateLimit(uid: string, limit = 10, windowMs = 3000): boolean {
  const now = Date.now();
  const userRate = userRateLimits.get(uid);
  if (!userRate || userRate.resetAt < now) {
    userRateLimits.set(uid, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (userRate.count >= limit) {
    return false;
  }
  userRate.count++;
  return true;
}

export async function setClientState(uid: string, state: Partial<ClientState>) {
  const current = localClientStates.get(uid) || {
    status: 'idle',
    updatedAt: Date.now(),
  };
  const updated: ClientState = {
    ...current,
    ...state,
    updatedAt: Date.now(),
  };
  localClientStates.set(uid, updated);

  if (isFirebaseConfigured && adminDb) {
    try {
      await adminDb.ref(`clientState/${uid}`).set(updated);
    } catch (err) {
      console.error('[Matchmaker] Error syncing clientState to Firebase:', err);
    }
  }

  return updated;
}

export async function getClientState(uid: string): Promise<ClientState> {
  if (isFirebaseConfigured && adminDb) {
    try {
      const snap = await adminDb.ref(`clientState/${uid}`).once('value');
      const val = snap.val();
      if (val) return val as ClientState;
    } catch (err) {
      console.warn('[Matchmaker] Error fetching clientState from Firebase:', err);
    }
  }
  return localClientStates.get(uid) || { status: 'idle', updatedAt: Date.now() };
}

export async function pushInboxEvent(toUid: string, event: Omit<InboxEvent, 'id' | 'timestamp'>): Promise<InboxEvent> {
  const fullEvent: InboxEvent = {
    id: `ev_${crypto.randomUUID()}`,
    timestamp: Date.now(),
    ...event,
  };

  const currentInbox = localInboxes.get(toUid) || [];
  currentInbox.push(fullEvent);
  localInboxes.set(toUid, currentInbox);

  if (isFirebaseConfigured && adminDb) {
    try {
      await adminDb.ref(`inboxes/${toUid}/${fullEvent.id}`).set(fullEvent);
    } catch (err) {
      console.error('[Matchmaker] Error pushing event to Firebase inbox:', err);
    }
  }

  return fullEvent;
}

export async function ackInboxEvent(uid: string, eventId: string) {
  const inbox = localInboxes.get(uid);
  if (inbox) {
    localInboxes.set(uid, inbox.filter((e) => e.id !== eventId));
  }

  if (isFirebaseConfigured && adminDb) {
    try {
      await adminDb.ref(`inboxes/${uid}/${eventId}`).remove();
    } catch (err) {
      console.error('[Matchmaker] Error removing acked inbox event from Firebase:', err);
    }
  }
}

export function getLocalInbox(uid: string): InboxEvent[] {
  return localInboxes.get(uid) || [];
}

/**
 * Atomic Matchmaking Request Handler
 */
export async function startMatch(uid: string, mode: ChatMode, nickname: string, rawInterest?: string) {
  const sanitizedNick = (nickname || 'Stranger').trim().slice(0, MAX_NICKNAME_LENGTH);
  const normalizedInterest = rawInterest ? rawInterest.trim().toLowerCase().slice(0, 40) : undefined;
  const now = Date.now();

  // First check if user is already in an active room; if so, skip it cleanly
  const existingState = await getClientState(uid);
  if (existingState.roomId && existingState.status !== 'ended' && existingState.status !== 'idle') {
    await skipMatch(uid, existingState.roomId);
  }

  // Clean slate for inbox
  localInboxes.delete(uid);

  // Set client state to searching
  await setClientState(uid, {
    status: 'searching',
    mode,
    roomId: undefined,
    partnerNickname: undefined,
    partnerUid: undefined,
    role: undefined,
  });

  // Search queue for candidate
  let candidate: QueueEntry | null = null;

  // 1. Prioritize candidate with matching shared interest
  if (normalizedInterest) {
    for (const [candidateUid, entry] of localQueue.entries()) {
      if (
        candidateUid !== uid &&
        entry.mode === mode &&
        entry.status === 'waiting' &&
        entry.expiresAt > now &&
        entry.interest === normalizedInterest
      ) {
        candidate = entry;
        break;
      }
    }
  }

  // 2. If no exact interest match found:
  // Match with unrestricted candidate (who entered with no specific interest),
  // OR match if the candidate has been waiting past interest-priority window (>5s)
  if (!candidate) {
    for (const [candidateUid, entry] of localQueue.entries()) {
      if (
        candidateUid !== uid &&
        entry.mode === mode &&
        entry.status === 'waiting' &&
        entry.expiresAt > now
      ) {
        const candidateIsUnrestricted = !entry.interest;
        const currentIsUnrestricted = !normalizedInterest;
        const candidateTimeoutPassed = now - entry.createdAt > 5000;

        if (candidateIsUnrestricted || currentIsUnrestricted || candidateTimeoutPassed) {
          candidate = entry;
          break;
        }
      }
    }
  }

  if (candidate) {
    // Atomically claim candidate
    localQueue.delete(candidate.uid);
    localQueue.delete(uid);

    const roomId = `room_${crypto.randomUUID()}`;
    const roomRecord: RoomRecord = {
      roomId,
      participantA: candidate.uid, // Caller
      participantB: uid,           // Callee
      nicknameA: candidate.nickname,
      nicknameB: sanitizedNick,
      mode,
      createdAt: now,
      expiresAt: now + 30 * 60 * 1000, // 30 mins room TTL
      status: 'active',
    };

    localRooms.set(roomId, roomRecord);

    if (isFirebaseConfigured && adminDb) {
      try {
        await adminDb.ref(`rooms/${roomId}`).set(roomRecord);
        await adminDb.ref(`queue/${mode}/default/${candidate.uid}`).remove();
        await adminDb.ref(`queue/${mode}/default/${uid}`).remove();
      } catch (err) {
        console.error('[Matchmaker] Error saving room to Firebase:', err);
      }
    }

    // Update both clients
    await setClientState(candidate.uid, {
      status: 'matched',
      roomId,
      partnerNickname: sanitizedNick,
      partnerUid: uid,
      role: 'caller',
      mode,
    });

    await setClientState(uid, {
      status: 'matched',
      roomId,
      partnerNickname: candidate.nickname,
      partnerUid: candidate.uid,
      role: 'callee',
      mode,
    });

    // Notify waiting candidate immediately through their inbox event stream
    await pushInboxEvent(candidate.uid, {
      type: 'matched',
      payload: {
        status: 'matched',
        roomId,
        partnerNickname: sanitizedNick,
        partnerUid: uid,
        role: 'caller',
        mode,
      },
      fromUid: uid,
      roomId,
    });

    return {
      status: 'matched',
      roomId,
      role: 'callee',
      partnerNickname: candidate.nickname,
      partnerUid: candidate.uid,
      mode,
    };
  }

  // No candidate available yet; add to waiting queue
  const queueEntry: QueueEntry = {
    uid,
    mode,
    nickname: sanitizedNick,
    interest: normalizedInterest,
    status: 'waiting',
    createdAt: now,
    expiresAt: now + QUEUE_TTL_MS,
  };

  localQueue.set(uid, queueEntry);

  if (isFirebaseConfigured && adminDb) {
    try {
      await adminDb.ref(`queue/${mode}/default/${uid}`).set(queueEntry);
    } catch (err) {
      console.error('[Matchmaker] Error enqueuing in Firebase:', err);
    }
  }

  return {
    status: 'searching',
    mode,
  };
}

/**
 * Skip current match & cleanly notify partner
 */
export async function skipMatch(uid: string, roomId?: string) {
  // Remove from queue if waiting
  localQueue.delete(uid);

  const state = await getClientState(uid);
  const targetRoomId = roomId || state.roomId;

  if (targetRoomId) {
    const room = localRooms.get(targetRoomId);
    if (room && room.status === 'active') {
      room.status = 'closed';
      const partnerUid = room.participantA === uid ? room.participantB : room.participantA;

      // Send partner disconnection event
      await pushInboxEvent(partnerUid, {
        type: 'partner_disconnected',
        payload: { reason: 'Partner skipped or left the chat.' },
        fromUid: uid,
        roomId: targetRoomId,
      });

      // Update partner client state
      await setClientState(partnerUid, {
        status: 'ended',
        error: 'Stranger has disconnected.',
      });

      if (isFirebaseConfigured && adminDb) {
        try {
          await adminDb.ref(`rooms/${targetRoomId}`).update({ status: 'closed' });
        } catch (err) {
          console.error('[Matchmaker] Error closing room in Firebase:', err);
        }
      }
    }
  }

  // Clear caller's inbox
  localInboxes.delete(uid);

  if (isFirebaseConfigured && adminDb) {
    try {
      await adminDb.ref(`inboxes/${uid}`).remove();
    } catch (err) {
      console.warn('[Matchmaker] Error clearing inbox on skip:', err);
    }
  }

  await setClientState(uid, {
    status: 'idle',
    roomId: undefined,
    partnerNickname: undefined,
    partnerUid: undefined,
    role: undefined,
  });

  return { success: true };
}

/**
 * End chat session
 */
export async function endSession(uid: string, roomId?: string) {
  return await skipMatch(uid, roomId);
}

/**
 * Send Text Message to Stranger
 */
export async function sendChatMessage(uid: string, roomId: string, text: string) {
  if (!text || text.trim().length === 0) {
    throw new Error('Message cannot be empty');
  }

  const cleanText = text.slice(0, MAX_MSG_LENGTH);
  const room = localRooms.get(roomId);

  if (!room || room.status !== 'active') {
    throw new Error('Room is no longer active');
  }

  if (room.participantA !== uid && room.participantB !== uid) {
    throw new Error('Unauthorized room participant');
  }

  const recipientUid = room.participantA === uid ? room.participantB : room.participantA;
  const senderNick = room.participantA === uid ? room.nicknameA : room.nicknameB;

  const event = await pushInboxEvent(recipientUid, {
    type: 'message',
    payload: {
      text: cleanText,
      senderNickname: senderNick,
    },
    fromUid: uid,
    roomId,
  });

  return {
    success: true,
    eventId: event.id,
    timestamp: event.timestamp,
  };
}

/**
 * Send WebRTC Signaling (Offer, Answer, ICE)
 */
export async function sendSignaling(
  uid: string,
  roomId: string,
  type: 'offer' | 'answer' | 'ice' | 'partner_typing',
  payload: any
) {
  const room = localRooms.get(roomId);
  if (!room || room.status !== 'active') {
    throw new Error('Room is no longer active');
  }

  if (room.participantA !== uid && room.participantB !== uid) {
    throw new Error('Unauthorized room participant');
  }

  const recipientUid = room.participantA === uid ? room.participantB : room.participantA;

  const event = await pushInboxEvent(recipientUid, {
    type,
    payload,
    fromUid: uid,
    roomId,
  });

  return {
    success: true,
    eventId: event.id,
  };
}

/**
 * Get Diagnostic Summary
 */
export function getDiagnostics() {
  return {
    activeRooms: Array.from(localRooms.values()).filter((r) => r.status === 'active').length,
    waitingInQueue: localQueue.size,
    isFirebaseConfigured,
  };
}
