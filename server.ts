import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { verifyUserToken, isFirebaseConfigured } from './src/server/firebaseAdmin.ts';
import {
  startMatch,
  skipMatch,
  endSession,
  sendChatMessage,
  sendSignaling,
  ackInboxEvent,
  getLocalInbox,
  getClientState,
  setClientState,
  checkRateLimit,
  getDiagnostics,
} from './src/server/matchmaker.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '64kb' }));

// Auth & Session helper middleware
async function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  const user = await verifyUserToken(authHeader);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized: Invalid or missing session token' });
    return;
  }
  (req as any).user = user;
  next();
}

/**
 * Health & Diagnostics Endpoint
 */
app.get('/api/health', (_req, res) => {
  const diag = getDiagnostics();
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    firebaseConfigured: isFirebaseConfigured,
    activeRooms: diag.activeRooms,
    waitingInQueue: diag.waitingInQueue,
  });
});

/**
 * Start or Resume Anonymous Session
 */
app.post('/api/session/start', async (req, res) => {
  const authHeader = req.headers.authorization;
  let user = await verifyUserToken(authHeader);
  
  if (!user) {
    // Generate an anonymous fallback token for clients without Firebase pre-auth
    const generatedUid = `anon_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    user = { uid: generatedUid };
  }

  const clientState = await getClientState(user.uid);
  res.json({
    uid: user.uid,
    token: `anon-${user.uid}`,
    clientState,
    firebaseConfigured: isFirebaseConfigured,
  });
});

/**
 * Matchmaking: Request Match
 */
app.post('/api/match/start', requireAuth, async (req, res) => {
  const uid = (req as any).user.uid;
  const { mode = 'text', nickname = 'Stranger', interest } = req.body;

  if (mode !== 'text' && mode !== 'video') {
    res.status(400).json({ error: 'Invalid mode. Must be "text" or "video"' });
    return;
  }

  if (!checkRateLimit(uid, 6, 3000)) {
    res.status(429).json({ error: 'Rate limit exceeded. Please wait a moment.' });
    return;
  }

  try {
    const result = await startMatch(uid, mode, nickname, interest);
    res.json(result);
  } catch (err: any) {
    console.error('[API /api/match/start] Error:', err);
    res.status(500).json({ error: err.message || 'Matchmaking failure' });
  }
});

/**
 * Matchmaking: Skip Current Stranger
 */
app.post('/api/match/skip', requireAuth, async (req, res) => {
  const uid = (req as any).user.uid;
  const { roomId } = req.body;

  try {
    const result = await skipMatch(uid, roomId);
    res.json(result);
  } catch (err: any) {
    console.error('[API /api/match/skip] Error:', err);
    res.status(500).json({ error: err.message || 'Skip failure' });
  }
});

/**
 * Session: End Chat
 */
app.post('/api/session/end', requireAuth, async (req, res) => {
  const uid = (req as any).user.uid;
  const { roomId } = req.body;

  try {
    const result = await endSession(uid, roomId);
    res.json(result);
  } catch (err: any) {
    console.error('[API /api/session/end] Error:', err);
    res.status(500).json({ error: err.message || 'End session failure' });
  }
});

/**
 * Text Chat: Send Message
 */
app.post('/api/chat/send', requireAuth, async (req, res) => {
  const uid = (req as any).user.uid;
  const { roomId, text } = req.body;

  if (!roomId || typeof text !== 'string') {
    res.status(400).json({ error: 'Missing roomId or text payload' });
    return;
  }

  if (!checkRateLimit(uid, 12, 3000)) {
    res.status(429).json({ error: 'Slow down. Message rate limit reached.' });
    return;
  }

  try {
    const result = await sendChatMessage(uid, roomId, text);
    res.json(result);
  } catch (err: any) {
    console.error('[API /api/chat/send] Error:', err);
    res.status(400).json({ error: err.message || 'Failed to deliver message' });
  }
});

/**
 * WebRTC Signaling: Send Offer / Answer / ICE
 */
app.post('/api/signaling/send', requireAuth, async (req, res) => {
  const uid = (req as any).user.uid;
  const { roomId, type, payload } = req.body;

  if (!roomId || !type || !payload) {
    res.status(400).json({ error: 'Invalid signaling event payload' });
    return;
  }

  if (!['offer', 'answer', 'ice', 'partner_typing'].includes(type)) {
    res.status(400).json({ error: 'Unsupported signaling type' });
    return;
  }

  if (!checkRateLimit(uid, 40, 2000)) {
    res.status(429).json({ error: 'Signaling rate limit exceeded' });
    return;
  }

  try {
    const result = await sendSignaling(uid, roomId, type, payload);
    res.json(result);
  } catch (err: any) {
    console.error('[API /api/signaling/send] Error:', err);
    res.status(400).json({ error: err.message || 'Signaling failure' });
  }
});

/**
 * Inbox ACK: Delete Processed Events (Keep RTDB/Memory Near Zero)
 */
app.post('/api/events/ack', requireAuth, async (req, res) => {
  const uid = (req as any).user.uid;
  const { eventId } = req.body;

  if (eventId) {
    await ackInboxEvent(uid, eventId);
  }

  res.json({ success: true });
});

/**
 * Inbox Poll (Provides synchronization for browsers or fallback)
 */
app.get('/api/events/poll', requireAuth, async (req, res) => {
  const uid = (req as any).user.uid;
  const events = getLocalInbox(uid);
  const clientState = await getClientState(uid);

  res.json({
    events,
    clientState,
  });
});

/**
 * Abuse Reporting & Local Block Receipt
 */
app.post('/api/report', requireAuth, async (req, res) => {
  const uid = (req as any).user.uid;
  const { roomId, reason, notes } = req.body;

  console.log(`[Report Received] From: ${uid}, Room: ${roomId}, Reason: ${reason}, Notes: ${notes || 'none'}`);

  const webhookUrl = process.env.REPORT_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reporterUid: uid,
          roomId,
          reason,
          notes,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (e) {
      console.warn('[Report] Failed to forward to webhook:', e);
    }
  }

  // Automatically skip the offender
  await skipMatch(uid, roomId);

  res.json({
    success: true,
    message: 'Report logged. Stranger has been blocked for this session.',
  });
});

/**
 * AI Conversation Spark & Icebreaker
 * Powered by Gemini 3.1 Pro Preview with high thinking level
 */
app.post('/api/ai/topic', async (req, res) => {
  const { interest } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    // Elegant fallbacks if API key not yet configured
    const fallbacks = [
      "If you could instantly become a master at any skill tonight, what would you choose?",
      "What's the most underrated movie or show you've watched recently?",
      "Is cereal soup? Settle the debate once and for all.",
      "If you could travel anywhere right now with zero budget limits, where are you headed?",
      "What's a weird hill you are completely willing to die on?",
    ];
    const picked = fallbacks[Math.floor(Math.random() * fallbacks.length)];
    res.json({ topic: picked, source: 'fallback' });
    return;
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const prompt = interest
      ? `Generate a single clever, fun, thought-provoking conversation starter or debate question tailored for two strangers who share the interest "${interest}". Keep it under 25 words. Do not use quotes or introductory fluff.`
      : `Generate a single engaging, fun, thought-provoking icebreaker or debate question for two random strangers chatting online. Keep it under 25 words. Do not use quotes or introductory fluff.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: prompt,
      config: {
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.HIGH,
        },
      },
    });

    const topic = response.text?.trim() || "What's the coolest thing you learned this week?";
    res.json({ topic, source: 'gemini-3.1-pro-preview' });
  } catch (err: any) {
    console.warn('[AI Topic] Generation error:', err);
    res.json({
      topic: "If you could witness any event in human history, which would you pick?",
      source: 'fallback',
    });
  }
});

// Configure Vite middleware in development or static serving in production
async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[PulsePeer] Server active on http://0.0.0.0:${PORT} (Production: ${isProduction})`);
  });
}

export default app;

if (!process.env.VERCEL) {
  startServer().catch((err) => {
    console.error('[PulsePeer] Server startup failure:', err);
  });
}
