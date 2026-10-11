import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  startMatch,
  skipMatch,
  sendChatMessage,
  sendSignaling,
  ackInboxEvent,
  getLocalInbox,
  getClientState,
  checkRateLimit,
} from '../src/server/matchmaker.ts';

describe('PulsePeer Engine Verification & Security Suite', () => {
  beforeEach(async () => {
    // Reset test users
    await skipMatch('user_alice');
    await skipMatch('user_bob');
    await skipMatch('user_charlie');
    await skipMatch('user_eve');
  });

  it('1. Enforces rate limits to protect Firebase Spark bandwidth', () => {
    const testUid = 'user_rate_tester';
    // Allow up to 5 requests in burst
    for (let i = 0; i < 5; i++) {
      assert.strictEqual(checkRateLimit(testUid, 5, 2000), true);
    }
    // 6th request is blocked
    assert.strictEqual(checkRateLimit(testUid, 5, 2000), false);
  });

  it('2. Matchmaking state transitions: solo user enters searching queue', async () => {
    const result = await startMatch('user_alice', 'text', 'AliceInWonderland');
    assert.strictEqual(result.status, 'searching');
    assert.strictEqual(result.mode, 'text');

    const aliceState = await getClientState('user_alice');
    assert.strictEqual(aliceState.status, 'searching');
  });

  it('3. Atomic candidate claims: two users match into one unique room', async () => {
    // Alice searches
    const aliceRes = await startMatch('user_alice', 'text', 'Alice');
    assert.strictEqual(aliceRes.status, 'searching');

    // Bob searches in same mode
    const bobRes = await startMatch('user_bob', 'text', 'Bob');
    assert.strictEqual(bobRes.status, 'matched');
    assert.ok(bobRes.roomId);
    assert.strictEqual(bobRes.partnerNickname, 'Alice');
    assert.strictEqual(bobRes.role, 'callee');

    // Verify Alice was also updated atomically to caller
    const aliceState = await getClientState('user_alice');
    assert.strictEqual(aliceState.status, 'matched');
    assert.strictEqual(aliceState.roomId, bobRes.roomId);
    assert.strictEqual(aliceState.partnerNickname, 'Bob');
    assert.strictEqual(aliceState.role, 'caller');
  });

  it('4. Duplicate match prevention: third user stays in queue when two pair', async () => {
    await startMatch('user_alice', 'video', 'Alice');
    await startMatch('user_bob', 'video', 'Bob');

    // Charlie joins later
    const charlieRes = await startMatch('user_charlie', 'video', 'Charlie');
    assert.strictEqual(charlieRes.status, 'searching');

    const charlieState = await getClientState('user_charlie');
    assert.strictEqual(charlieState.status, 'searching');
  });

  it('5. Interest prioritization: matches shared topic when available', async () => {
    // Alice wants "chess"
    await startMatch('user_alice', 'text', 'Alice', 'chess');
    // Bob wants "music"
    await startMatch('user_bob', 'text', 'Bob', 'music');
    // Charlie joins wanting "chess" - should pair with Alice!
    const charlieRes = await startMatch('user_charlie', 'text', 'Charlie', 'chess');
    assert.strictEqual(charlieRes.status, 'matched');
    assert.strictEqual(charlieRes.partnerNickname, 'Alice');
  });

  it('6. Text chat message delivery & unauthorized participant rejection', async () => {
    await startMatch('user_alice', 'text', 'Alice');
    const bobRes = await startMatch('user_bob', 'text', 'Bob');
    const roomId = bobRes.roomId!;

    // Alice sends message to Bob
    const sendResult = await sendChatMessage('user_alice', roomId, 'Hello Bob! How are you?');
    assert.strictEqual(sendResult.success, true);

    // Verify delivered to Bob's inbox
    const bobInbox = getLocalInbox('user_bob');
    const receivedMsg = bobInbox.find((e) => e.id === sendResult.eventId);
    assert.ok(receivedMsg);
    assert.strictEqual(receivedMsg?.payload.text, 'Hello Bob! How are you?');

    // Eve (unauthorized attacker) attempts to send message to Alice and Bob's room
    await assert.rejects(
      async () => {
        await sendChatMessage('user_eve', roomId, 'I am snooping!');
      },
      /Unauthorized room participant/
    );
  });

  it('7. Message payload validation: rejects empty messages and truncates > 1000 chars', async () => {
    await startMatch('user_alice', 'text', 'Alice');
    const bobRes = await startMatch('user_bob', 'text', 'Bob');
    const roomId = bobRes.roomId!;

    // Rejects empty
    await assert.rejects(
      async () => {
        await sendChatMessage('user_alice', roomId, '   ');
      },
      /Message cannot be empty/
    );

    // Very long string is safely bounded
    const hugeMsg = 'A'.repeat(1500);
    const sendRes = await sendChatMessage('user_alice', roomId, hugeMsg);
    const bobInbox = getLocalInbox('user_bob');
    const item = bobInbox.find((e) => e.id === sendRes.eventId);
    assert.strictEqual(item?.payload.text.length, 1000);
  });

  it('8. Ephemeral inbox ACK lifecycle: processed events are deleted to preserve storage', async () => {
    await startMatch('user_alice', 'text', 'Alice');
    const bobRes = await startMatch('user_bob', 'text', 'Bob');
    const roomId = bobRes.roomId!;

    const sendRes = await sendChatMessage('user_alice', roomId, 'Testing ACK');
    let bobInbox = getLocalInbox('user_bob');
    assert.strictEqual(bobInbox.some((e) => e.id === sendRes.eventId), true);

    // Bob acknowledges processing the event
    await ackInboxEvent('user_bob', sendRes.eventId);
    bobInbox = getLocalInbox('user_bob');
    assert.strictEqual(bobInbox.some((e) => e.id === sendRes.eventId), false);
  });

  it('9. WebRTC signaling delivery: offer and ICE candidates route correctly', async () => {
    await startMatch('user_alice', 'video', 'Alice');
    const bobRes = await startMatch('user_bob', 'video', 'Bob');
    const roomId = bobRes.roomId!;

    const mockOffer = { type: 'offer', sdp: 'v=0\r\no=- 123 456 IN IP4 127.0.0.1\r\n' };
    const sigRes = await sendSignaling('user_alice', roomId, 'offer', mockOffer);
    assert.strictEqual(sigRes.success, true);

    const bobInbox = getLocalInbox('user_bob');
    const offerEvent = bobInbox.find((e) => e.id === sigRes.eventId);
    assert.ok(offerEvent);
    assert.strictEqual(offerEvent?.type, 'offer');
  });

  it('10. Session termination & skip cleanly notifies partner', async () => {
    await startMatch('user_alice', 'text', 'Alice');
    const bobRes = await startMatch('user_bob', 'text', 'Bob');
    const roomId = bobRes.roomId!;

    // Alice skips
    await skipMatch('user_alice', roomId);

    // Alice state is back to idle
    const aliceState = await getClientState('user_alice');
    assert.strictEqual(aliceState.status, 'idle');

    // Bob gets partner_disconnected event in inbox
    const bobInbox = getLocalInbox('user_bob');
    const disconnectEv = bobInbox.find((e) => e.type === 'partner_disconnected');
    assert.ok(disconnectEv);

    // Bob state is marked ended
    const bobState = await getClientState('user_bob');
    assert.strictEqual(bobState.status, 'ended');
  });

  it('11. Two-device matchmaking auto-find: waiting Device 1 receives matched event and clientState', async () => {
    // Device 1 (Alice) starts matchmaking and waits
    const aliceStart = await startMatch('user_alice', 'text', 'Alice');
    assert.strictEqual(aliceStart.status, 'searching');

    // Verify Alice is waiting in searching status
    const alicePendingState = await getClientState('user_alice');
    assert.strictEqual(alicePendingState.status, 'searching');

    // Device 2 (Bob) joins
    const bobJoin = await startMatch('user_bob', 'text', 'Bob');
    assert.strictEqual(bobJoin.status, 'matched');
    assert.ok(bobJoin.roomId);

    // Verify Alice's client state immediately transitioned to matched
    const aliceMatchedState = await getClientState('user_alice');
    assert.strictEqual(aliceMatchedState.status, 'matched');
    assert.strictEqual(aliceMatchedState.roomId, bobJoin.roomId);
    assert.strictEqual(aliceMatchedState.partnerNickname, 'Bob');
    assert.strictEqual(aliceMatchedState.role, 'caller');

    // Verify Alice's inbox received the 'matched' awakening event
    const aliceInbox = getLocalInbox('user_alice');
    const matchedEvent = aliceInbox.find((e) => e.type === 'matched');
    assert.ok(matchedEvent, 'Alice must receive a matched event in inbox');
    assert.strictEqual(matchedEvent?.payload.roomId, bobJoin.roomId);
    assert.strictEqual(matchedEvent?.payload.partnerNickname, 'Bob');
  });
});
