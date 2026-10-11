# PulsePeer — Anonymous Random Video & Text Chat Platform

PulsePeer is an anonymous 1-on-1 random video and text chat platform inspired by the Omegle concept. It features an original dark aesthetic, invisible anonymous authentication, WebRTC peer-to-peer media communication, and strict Firebase Realtime Database (Spark free-tier) bandwidth optimization.

---

## 1. Core Architecture & Philosophy

```
[Browser Client A] <============== WebRTC P2P (Video / Audio) ==============> [Browser Client B]
         |                                                                             |
         | (Minimal Signaling & ACK)                               (Minimal Signaling & ACK)
         v                                                                             v
[Vercel Server Handlers / Express] <====> [Firebase Realtime Database (Queue / Inboxes / State)]
```

### The Spark Free-Tier Efficiency Contract
Firebase Realtime Database on the free Spark plan enforces strict limits:
- **Max simultaneous connections:** 100
- **Database storage:** 1 GB
- **Monthly downloads:** 10 GB

PulsePeer was architected strictly around these boundaries:
1. **Zero Media via Firebase:** All video and audio streams travel strictly peer-to-peer via `RTCPeerConnection`. No Base64 media or binary blobs ever touch the database.
2. **Ephemeral Inboxes with Immediate ACK:** Messages and WebRTC signaling events (SDP offer/answer, ICE candidates) are routed to ephemeral recipient inboxes (`inboxes/{uid}/{eventId}`) and **permanently deleted immediately upon client acknowledgment**.
3. **Lazy Connection Lifecycle:** Database listeners are not opened on the landing page. They are attached only upon starting matchmaking and disconnected upon session end.
4. **Scoped Listeners:** Clients never listen to root or global queues. Each client attaches strictly to `clientState/{uid}` and `inboxes/{uid}`.
5. **Atomic Matchmaking:** Candidate claims occur atomically on the server to prevent race conditions and duplicate pairing.

---

## 2. Realtime Database Schema

| Path | Access Rules | Purpose |
| :--- | :--- | :--- |
| `queue/{mode}/{bucket}/{uid}` | Server only (`.read: false`, `.write: false`) | Short-lived candidate entries with 60-second TTL. |
| `clientState/{uid}` | Owner read (`auth.uid === $uid`), Server write | Holds current state (`idle`, `searching`, `matched`, `ended`), room ID, and partner nickname. |
| `rooms/{roomId}` | Participants read only, Server write | Validates authorized pair of UIDs. |
| `inboxes/{uid}/{eventId}` | Owner read & write (delete-only) | Ephemeral signaling and text message events, deleted immediately upon ACK. |
| `presence/{uid}` | Authenticated read & write | Presence marker managed via `onDisconnect()`. |

---

## 3. Step-by-Step Firebase Deployment Setup

### Step 1: Create a Firebase Project
1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Click **Add project**, name it `pulsepeer-app`, and disable Google Analytics (optional).

### Step 2: Enable Anonymous Authentication
1. Navigate to **Build > Authentication** in the sidebar.
2. Click **Get Started**, choose **Sign-in method**, and enable **Anonymous**.

### Step 3: Create Realtime Database
1. Navigate to **Build > Realtime Database**.
2. Click **Create Database**. Choose your region (e.g., `us-central1` or `europe-west1`).
3. Start in **Locked mode**.

### Step 4: Deploy Restrictive Security Rules
Using Firebase CLI:
```bash
npm install -g firebase-tools
firebase login
firebase init database
# Select your project and reference database.rules.json
firebase deploy --only database
```

### Step 5: Generate Admin Service Account
1. In Firebase Console, click the **Gear Icon (Project Settings) > Service accounts**.
2. Click **Generate new private key**. Download the JSON file securely.

---

## 4. Environment Variables Configuration

Copy `.env.example` to `.env`:

### Client Configuration
```env
VITE_FIREBASE_API_KEY="AIzaSy..."
VITE_FIREBASE_AUTH_DOMAIN="pulsepeer-app.firebaseapp.com"
VITE_FIREBASE_DATABASE_URL="https://pulsepeer-app-default-rtdb.firebaseio.com"
VITE_FIREBASE_PROJECT_ID="pulsepeer-app"
VITE_FIREBASE_APP_ID="1:123456789:web:abcdef"
```

### Server Configuration (Firebase Admin)
```env
FIREBASE_ADMIN_PROJECT_ID="pulsepeer-app"
FIREBASE_ADMIN_CLIENT_EMAIL="firebase-adminsdk-xxxxx@pulsepeer-app.iam.gserviceaccount.com"
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgk...\n-----END PRIVATE KEY-----\n"
FIREBASE_ADMIN_DATABASE_URL="https://pulsepeer-app-default-rtdb.firebaseio.com"
```

### Optional Features
```env
# Gemini 3.1 Pro Preview for high-thinking conversation icebreakers
GEMINI_API_KEY="your-gemini-key"

# WebRTC TURN credentials for strict NATs (Google STUN is active by default)
TURN_SERVER_URL=""
TURN_USERNAME=""
TURN_CREDENTIAL=""

# Abuse reports destination webhook
REPORT_WEBHOOK_URL=""
```

---

## 5. Deployment to Vercel

1. Push your repository to GitHub.
2. In the [Vercel Dashboard](https://vercel.com/), click **Add New > Project** and import the repository.
3. In **Environment Variables**, add the variables detailed above.
4. Deploy!

---

## 6. Verification and Local Testing

### Run Automated Security & Matchmaking Test Suite
```bash
npm test
```
The suite verifies:
- Nickname sanitization and length validation.
- Message payload validation (<= 1,000 characters).
- Rate-limiting safeguards against spam.
- Atomic candidate claims and concurrent matching.
- Duplicate match prevention.
- Unauthorized participant room rejection.
- Zero-storage ephemeral inbox ACK removal.
- WebRTC signaling routing and session termination.

### Multi-Tab Live Testing
1. Run `npm run dev`.
2. Open `http://localhost:3000` in **Tab A** (or normal window) and `http://localhost:3000` in **Tab B** (Incognito window).
3. Select "Text Chat" or "Video Chat", click "Start Chatting" in both windows.
4. They will instantly pair and establish real-time communication!
5. Open the **Spark Diagnostics** drawer from the header to view live byte estimations and event ACK counters.

---

## 7. Known Architectural Limitations

1. **Symmetric NAT Firewalls:** Direct WebRTC peer connections use Google STUN by default. Users on restrictive enterprise or university networks behind symmetric NAT may require a configured TURN relay server.
2. **Spark 100 Simultaneous Connections:** Firebase Realtime Database on Spark supports up to 100 concurrent WebSocket connections. When traffic exceeds this, upgrade to the Blaze pay-as-you-go plan.
