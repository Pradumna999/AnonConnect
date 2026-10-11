import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getDatabase, type Database } from 'firebase-admin/database';
import { getAuth, type Auth } from 'firebase-admin/auth';

let isFirebaseConfigured = false;
let adminDb: Database | null = null;
let adminAuth: Auth | null = null;

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
let privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
const databaseURL = process.env.FIREBASE_ADMIN_DATABASE_URL || process.env.VITE_FIREBASE_DATABASE_URL || process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;

if (privateKey) {
  // Normalize escaped newlines from environment variable strings
  privateKey = privateKey.replace(/\\n/g, '\n');
}

if (projectId && clientEmail && privateKey && databaseURL) {
  try {
    const app = getApps().length
      ? getApps()[0]
      : initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey,
          }),
          databaseURL,
        });
    adminDb = getDatabase(app);
    adminAuth = getAuth(app);
    isFirebaseConfigured = true;
    console.log('[Firebase Admin] Successfully initialized with project:', projectId);
  } catch (err) {
    console.warn('[Firebase Admin] Failed to initialize with provided credentials:', err);
    isFirebaseConfigured = false;
  }
} else {
  console.log('[Firebase Admin] Credentials not fully set. Server running with embedded atomic coordinator.');
}

export async function verifyUserToken(authHeader: string | undefined): Promise<{ uid: string } | null> {
  if (!authHeader) return null;
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();
  if (!token) return null;

  if (isFirebaseConfigured && adminAuth) {
    try {
      const decoded = await adminAuth.verifyIdToken(token);
      return { uid: decoded.uid };
    } catch (err) {
      console.warn('[Firebase Admin] Token verification failed:', err);
      return null;
    }
  }

  // Fallback for local development and preview environment when Firebase credentials are not yet linked:
  // Accepts authenticated anonymous session tokens in format "anon-<uid>" or standard uid strings
  if (token.startsWith('anon-') || token.length >= 8) {
    const uid = token.startsWith('anon-') ? token : `anon-${token}`;
    return { uid };
  }

  return null;
}

export { isFirebaseConfigured, adminDb, adminAuth };
