import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously, type Auth, type User } from 'firebase/auth';
import {
  getDatabase,
  ref,
  onValue,
  onChildAdded,
  off,
  set,
  onDisconnect,
  serverTimestamp,
  goOffline,
  goOnline,
  type Database,
} from 'firebase/database';
import { diagnostics } from './diagnostics.ts';
import type { ClientState, InboxEvent } from '../types/chat.ts';

// Client configuration with user's provided Firebase project credentials
const apiKey =
  import.meta.env.VITE_FIREBASE_API_KEY ||
  (window as any)?.__ENV?.NEXT_PUBLIC_FIREBASE_API_KEY ||
  'AIzaSyAnXY8vD9N8S30xFnjChBzCdudxFAeQZ9s';

const authDomain =
  import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ||
  'anonconnect-e1b76.firebaseapp.com';

const projectId =
  import.meta.env.VITE_FIREBASE_PROJECT_ID ||
  'anonconnect-e1b76';

const appId =
  import.meta.env.VITE_FIREBASE_APP_ID ||
  '1:221431965489:web:f49e40ec0ca98b9a66f210';

const databaseURL =
  import.meta.env.VITE_FIREBASE_DATABASE_URL ||
  (window as any)?.__ENV?.NEXT_PUBLIC_FIREBASE_DATABASE_URL ||
  `https://${projectId}-default-rtdb.firebaseio.com`;

export const hasFirebaseConfig = Boolean(apiKey && databaseURL && projectId);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Database | null = null;

if (hasFirebaseConfig) {
  try {
    app = getApps().length ? getApps()[0] : initializeApp({
      apiKey,
      authDomain,
      databaseURL,
      projectId,
      appId,
    });
    auth = getAuth(app);
    db = getDatabase(app);
  } catch (err) {
    console.warn('[Firebase Client] Init error, falling back to local coordinator:', err);
  }
}

export interface SessionAuthResult {
  uid: string;
  token: string;
  isRealFirebase: boolean;
  serverFirebaseConfigured: boolean;
}

// Persistent session UID across page reloads in same browser session
function getOrCreateSessionUid(): string {
  let uid = sessionStorage.getItem('pulsepeer_session_uid');
  if (!uid) {
    uid = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    sessionStorage.setItem('pulsepeer_session_uid', uid);
  }
  return uid;
}

/**
 * Invisible Anonymous Authentication
 * No login screen. Returns UID, session token, and server configuration state.
 */
export async function initializeAnonymousSession(): Promise<SessionAuthResult> {
  let uid = getOrCreateSessionUid();
  let token = `anon-${uid}`;
  let isRealFirebase = false;

  if (hasFirebaseConfig && auth) {
    try {
      let currentUser: User | null = auth.currentUser;
      if (!currentUser) {
        const userCred = await signInAnonymously(auth);
        currentUser = userCred.user;
      }
      token = await currentUser.getIdToken();
      uid = currentUser.uid;
      isRealFirebase = true;
      diagnostics.recordEvent('in', 'auth', { uid }, 'Anonymous Auth Initialized');
    } catch (err) {
      console.warn('[Firebase Auth] Anonymous sign-in failed, using session auth:', err);
    }
  }

  // Register or synchronize session with server
  let serverFirebaseConfigured = false;
  try {
    const sessionRes = await fetch('/api/session/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    if (sessionRes.ok) {
      const sessionData = await sessionRes.json();
      serverFirebaseConfigured = Boolean(sessionData.firebaseConfigured);
    }
  } catch (err) {
    console.warn('[Session Start] Server session ping failed:', err);
  }

  return {
    uid,
    token,
    isRealFirebase,
    serverFirebaseConfigured,
  };
}

/**
 * Robust Dual-Sync Connection Manager
 * Listens to Realtime Database when server Admin SDK is active,
 * and maintains continuous low-latency polling (<750ms) to ensure instant matchmaking.
 */
export class SessionConnectionManager {
  private activeListeners = 0;
  private pollInterval: any = null;
  private stateRef: any = null;
  private inboxRef: any = null;
  private presenceRef: any = null;
  private processedEventIds = new Set<string>();
  private onStateCallback: ((state: ClientState) => void) | null = null;
  private onEventCallback: ((event: InboxEvent) => void) | null = null;
  private lastClientStateStatus: string | null = null;
  private lastClientStateRoomId: string | null = null;

  constructor(
    private uid: string,
    private token: string,
    private isRealFirebase: boolean,
    private serverFirebaseConfigured: boolean = false
  ) {}

  /**
   * Listen to client's own clientState/{uid}
   */
  public attachClientStateListener(onState: (state: ClientState) => void) {
    this.onStateCallback = onState;

    // If both client and server are configured with live Firebase RTDB
    if (this.isRealFirebase && this.serverFirebaseConfigured && db) {
      try {
        goOnline(db);
        this.stateRef = ref(db, `clientState/${this.uid}`);
        onValue(this.stateRef, (snapshot) => {
          const val = snapshot.val();
          if (val) {
            diagnostics.recordEvent('in', 'clientState', val, `State update: ${val.status}`);
            this.lastClientStateStatus = val.status;
            this.lastClientStateRoomId = val.roomId;
            onState(val as ClientState);
          }
        });
        this.activeListeners++;
        diagnostics.setListenersCount(this.activeListeners);
      } catch (e) {
        console.warn('[Firebase RTDB] Error attaching clientState listener:', e);
      }
    }

    // Always ensure background poller is running to bridge server updates
    this.ensurePolling();
  }

  /**
   * Listen to newly delivered events in inboxes/{uid}
   */
  public attachInboxListener(onEvent: (event: InboxEvent) => void) {
    this.onEventCallback = onEvent;

    if (this.isRealFirebase && this.serverFirebaseConfigured && db) {
      try {
        this.inboxRef = ref(db, `inboxes/${this.uid}`);
        onChildAdded(this.inboxRef, (snapshot) => {
          const event = snapshot.val() as InboxEvent;
          if (event && event.id && !this.processedEventIds.has(event.id)) {
            this.processedEventIds.add(event.id);
            diagnostics.recordEvent('in', event.type, event.payload, `Inbox event: ${event.type}`);
            onEvent(event);
          }
        });
        this.activeListeners++;
        diagnostics.setListenersCount(this.activeListeners);
      } catch (e) {
        console.warn('[Firebase RTDB] Error attaching inbox listener:', e);
      }
    }

    this.ensurePolling();
  }

  /**
   * Minimal Presence Setup using onDisconnect()
   */
  public attachPresence() {
    if (this.isRealFirebase && db) {
      try {
        this.presenceRef = ref(db, `presence/${this.uid}`);
        set(this.presenceRef, { status: 'online', updatedAt: serverTimestamp() });
        onDisconnect(this.presenceRef).set({ status: 'offline', updatedAt: serverTimestamp() });
      } catch (e) {
        // silent
      }
    }
  }

  private ensurePolling() {
    if (this.pollInterval) return;

    // Fast 700ms polling ensures instant matchmaking transitions for waiting callers
    this.pollInterval = setInterval(async () => {
      try {
        const res = await fetch('/api/events/poll', {
          headers: { Authorization: `Bearer ${this.token}` },
        });
        if (!res.ok) return;

        const data = await res.json();

        // 1. Check and dispatch client state updates (e.g. status transition from 'searching' to 'matched')
        if (data.clientState && this.onStateCallback) {
          const state = data.clientState as ClientState;
          if (
            state.status !== this.lastClientStateStatus ||
            state.roomId !== this.lastClientStateRoomId
          ) {
            this.lastClientStateStatus = state.status;
            this.lastClientStateRoomId = state.roomId || null;
            diagnostics.recordEvent('in', 'clientState_poll', state, `State poll: ${state.status}`);
            this.onStateCallback(state);
          }
        }

        // 2. Process pending inbox events
        if (Array.isArray(data.events) && this.onEventCallback) {
          for (const ev of data.events) {
            if (!this.processedEventIds.has(ev.id)) {
              this.processedEventIds.add(ev.id);
              diagnostics.recordEvent('in', ev.type, ev.payload, `Poll event: ${ev.type}`);
              this.onEventCallback(ev);
            }
          }
        }
      } catch {
        // network drops silently caught
      }
    }, 700);

    this.activeListeners++;
    diagnostics.setListenersCount(this.activeListeners);
  }

  /**
   * Complete cleanup when user leaves or skips
   */
  public detachAll() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    if (this.isRealFirebase && db) {
      try {
        if (this.stateRef) off(this.stateRef);
        if (this.inboxRef) off(this.inboxRef);
        if (this.presenceRef) {
          set(this.presenceRef, { status: 'offline', updatedAt: serverTimestamp() });
        }
        goOffline(db);
      } catch {
        // silent
      }
    }

    this.activeListeners = 0;
    diagnostics.setListenersCount(0);
    this.processedEventIds.clear();
    this.onStateCallback = null;
    this.onEventCallback = null;
    this.lastClientStateStatus = null;
    this.lastClientStateRoomId = null;
  }
}
