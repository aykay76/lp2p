# Testing the Protocol Implementation

## Quick Test (2 minutes)

### Step 1: Open Two Browsers
1. Open `index.html` in **Chrome**
2. Open `index.html` in **Firefox** (or another Chrome window)

### Step 2: Connect
**In Browser 1:**
- Click "Create Offer"
- Copy the generated text

**In Browser 2:**
- Paste the offer
- Click "Create Answer"
- Copy the answer

**Back in Browser 1:**
- Paste the answer
- Click "Apply Answer"

### Step 3: Observe
You should see:
- Status changes to "Connected to Browser xxx"
- System message: "Browser xxx connected"
- Message input becomes enabled

### Step 4: Send Messages
- Type "Hello!" in either browser
- Press Enter or click Send
- Message appears on both sides
- Check the console (F12) to see structured messages

## What to Look For

### In the UI
✅ Status indicator turns **green**
✅ Status text shows "Connected to Browser xxx"
✅ System message appears: "Browser xxx connected"
✅ Messages sent from one side appear on the other
✅ Timestamps on each message
✅ Different styling for sent vs received

### In the Console (F12)
✅ Peer ID generation: `"Our peer ID: peer-abc12345"`
✅ Protocol version: `"Local P2P Messenger initialized with protocol v1.0"`
✅ Data channel opened
✅ Sent messages as objects: `{ protocol: "lp2p", type: "text", ... }`
✅ Received messages as objects
✅ Handler invocations

### Example Console Output
```
Our peer ID: peer-a1b2c3d4
Local P2P Messenger initialized with protocol v1.0
Disconnected
Offer created: RTCSessionDescription {...}
Data channel opened
Sending message: Message { protocol: "lp2p", version: "1.0", type: "system", ... }
Received raw data: {"protocol":"lp2p","version":"1.0",...}
Received message: Message { type: "system", payload: { action: "hello", ... } }
Peer introduced: { id: "peer-e5f6g7h8", name: "Browser e5f6g7h8", ... }
Handling text message: Message { type: "text", payload: { text: "Hello!" } }
```

## Testing Specific Features

### 1. Hello Messages
When connection opens, both peers should:
- Auto-generate a peer ID
- Send a SYSTEM/HELLO message
- Display "Browser xxx connected"
- Update status to show peer name

**Verify in console:**
```javascript
Sending message: Message {
  type: "system",
  payload: {
    action: "hello",
    peerInfo: {
      id: "peer-abc123",
      name: "Browser abc123",
      capabilities: ["text", "file", "data"],
      version: "1.0.0",
      protocolVersion: "1.0"
    }
  }
}
```

### 2. Text Messages
Send a message "Test 123":

**Sender console:**
```javascript
Sending message: Message {
  protocol: "lp2p",
  version: "1.0",
  id: "550e8400-e29b-41d4-a716-446655440000",
  type: "text",
  from: "peer-abc123",
  to: "peer-def456",
  timestamp: 1730851200000,
  payload: { text: "Test 123", format: "plain" }
}
```

**Receiver console:**
```javascript
Received message: Message { ... }
Handling text message: Message { payload: { text: "Test 123" } }
```

### 3. Message Validation
Try to break it (in browser console):

```javascript
// Invalid message (missing required fields)
const bad = { type: "text" };
LP2P.MessageValidator.validate(bad);
// Should show: { valid: false, errors: [...] }

// Valid message
const good = LP2P.MessageFactory.createText("peer-a", "peer-b", "Hello");
LP2P.MessageValidator.validate(good);
// Should show: { valid: true, errors: [] }
```

### 4. Protocol Constants
Check the protocol exports (in console):

```javascript
LP2P.PROTOCOL
// { NAME: "lp2p", VERSION: "1.0" }

LP2P.MESSAGE_TYPES
// { TEXT: "text", FILE: "file", DATA: "data", SYSTEM: "system", CONTROL: "control" }

LP2P.SYSTEM_ACTIONS
// { HELLO: "hello", GOODBYE: "goodbye", ... }
```

### 5. Message Factory
Create messages manually (in console):

```javascript
// Text message
const text = LP2P.MessageFactory.createText("peer-a", "peer-b", "Hello");
console.log(text);

// Hello message
const hello = LP2P.MessageFactory.createHello("peer-a", {
  id: "peer-a",
  name: "Test Peer"
});
console.log(hello);

// Serialize
console.log(text.serialize());
```

## Advanced Testing

### Test Message Size Limits
```javascript
// Try to send a huge message
const huge = "x".repeat(100000);  // 100KB text
LP2P.MessageFactory.createText("a", "b", huge);
// Should work (under 64KB limit for text)

const tooBig = "x".repeat(100000);
const msg = LP2P.MessageFactory.createText("a", "b", tooBig);
LP2P.MessageValidator.validate(msg);
// Should fail: text too large
```

### Test Invalid Timestamps
```javascript
const msg = LP2P.MessageFactory.createText("a", "b", "Hello");
msg.timestamp = Date.now() - (10 * 60 * 1000);  // 10 minutes ago
LP2P.MessageValidator.validate(msg);
// Should fail: timestamp too far from current time
```

### Test Custom Handlers
```javascript
// Register a custom handler
messageHandler.register(LP2P.MESSAGE_TYPES.TEXT, (msg) => {
  console.log("CUSTOM HANDLER:", msg.payload.text);
});

// Now send a message - you'll see both handlers fire
```

## Troubleshooting

### Issue: "LP2P is not defined"
**Cause**: protocol.js not loaded
**Fix**: Make sure `<script src="protocol.js"></script>` is in index.html before main script

### Issue: Messages not appearing
**Cause**: Handler not initialized
**Fix**: Check console for `initMessageHandlers()` call

### Issue: "Remote peer not identified yet"
**Cause**: Hello message not received
**Fix**: Check data channel is open, check console for hello message

### Issue: Validation errors
**Cause**: Message structure incorrect
**Fix**: Use MessageFactory, don't create messages manually

### Issue: Connection drops immediately
**Cause**: WebRTC configuration issue
**Fix**: Check STUN servers are reachable, check console for ICE errors

## Browser Compatibility Tests

Test in different browser combinations:

| From ↓ To → | Chrome | Firefox | Edge | Safari |
|-------------|--------|---------|------|--------|
| Chrome      | ✅     | ✅      | ✅   | ⚠️     |
| Firefox     | ✅     | ✅      | ✅   | ⚠️     |
| Edge        | ✅     | ✅      | ✅   | ⚠️     |
| Safari      | ⚠️     | ⚠️      | ⚠️   | ⚠️     |

Note: Safari may require HTTPS for full WebRTC support

## Performance Testing

### Message Throughput
```javascript
// Send 100 messages rapidly
for (let i = 0; i < 100; i++) {
  const msg = LP2P.MessageFactory.createText(peerId, remotePeerId, `Message ${i}`);
  sendRawMessage(msg);
}
// Should all arrive (might take a few seconds)
```

### Message Latency
```javascript
// Measure round-trip time
const start = performance.now();
const ping = LP2P.MessageFactory.createPing(peerId, remotePeerId);

// Register one-time pong handler
messageHandler.registerAction(LP2P.MESSAGE_TYPES.SYSTEM, LP2P.SYSTEM_ACTIONS.PONG, () => {
  const end = performance.now();
  console.log(`RTT: ${end - start}ms`);
});

sendRawMessage(ping);
```

## Success Criteria

✅ Two browsers connect successfully
✅ Messages appear on both sides
✅ System messages show connection events
✅ Console shows structured message objects
✅ No validation errors in normal use
✅ Status indicator updates correctly
✅ Peer IDs are generated and displayed
✅ Message timestamps are accurate

## Next Steps After Testing

Once basic testing passes:

1. **Test with real files** - Prepare for file transfer implementation
2. **Test structured data** - Try sending JSON objects
3. **Test multi-peer** - Connect 3+ browsers (requires Option C)
4. **Test persistence** - Implement peer ID storage (requires Option B)
5. **Test security** - Add message signing (requires Option B)

## Debugging Tips

### Enable Verbose Logging
```javascript
// Add at top of script
const DEBUG = true;
function log(...args) {
  if (DEBUG) console.log('[LP2P]', ...args);
}
```

### Inspect Message Objects
```javascript
// In console, capture last received message
let lastMessage = null;
messageHandler.register(LP2P.MESSAGE_TYPES.TEXT, (msg) => {
  lastMessage = msg;
  console.log('Saved to lastMessage');
});

// Then inspect
console.log(lastMessage);
console.log(lastMessage.serialize());
```

### Monitor Data Channel
```javascript
// Log all data channel events
dataChannel.addEventListener('open', () => console.log('DC: open'));
dataChannel.addEventListener('close', () => console.log('DC: close'));
dataChannel.addEventListener('error', (e) => console.log('DC: error', e));
dataChannel.addEventListener('message', (e) => console.log('DC: message', e.data));
```

---

Happy testing! 🧪 If everything works, you're ready to build Option B (Peer Identity) or Option C (Multi-Peer)!
