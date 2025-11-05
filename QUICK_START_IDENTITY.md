# Quick Start: Identity-Enabled P2P Messenger

## What You Get

✅ **Cryptographic Identity** - Ed25519 keypairs automatically generated  
✅ **Message Signing** - All messages cryptographically signed  
✅ **Signature Verification** - Incoming messages verified automatically  
✅ **Trust Management** - PGP-style trust levels for peers  
✅ **Persistent Identity** - Keys stored in localStorage, reused across sessions

## How to Use

### 1. Open the Application

```bash
# Just open the file in two browser windows
open index.html  # or double-click
```

On first load, you'll see:
```
Your Identity
Name: Browser XXXXXXXX
Key ID: a1b2c3d4
Fingerprint: a1:b2:c3:d4:e5:f6:g7:h8:...
```

### 2. Connect Two Browsers

**Browser A (Offerer):**
1. Click "Create Offer"
2. Copy the offer text

**Browser B (Answerer):**
1. Paste the offer
2. Click "Create Answer"
3. Copy the answer text

**Browser A:**
1. Paste the answer
2. Click "Apply Answer"

### 3. Watch the Identity Exchange

When connected, you'll see:
```
✓ Browser YYYYYYYY connected (verified)
```

The checkmark (✓) means the signature was valid!

### 4. Send Messages

Type a message and press Enter. You'll see:

**Your messages:**
```
You
Hello!
```

**Their messages:**
```
✓ Hello back!
```

The ✓ prefix means the message signature is valid!

## What Happens Under the Hood

### On First Load

1. **Generate Keypair** - Ed25519 public/private keys created
2. **Compute Fingerprint** - SHA-256 hash of public key
3. **Store Identity** - Saved to localStorage
4. **Display Info** - Shows your Key ID and fingerprint

### On Connection

1. **Exchange Identities** - HELLO messages contain public keys
2. **Verify Signatures** - Each HELLO message is signed and verified
3. **Add to Roster** - Peer's public key saved to localStorage
4. **Set Trust Level** - Initial trust set to "unknown"

### On Message Send

1. **Create Message** - JSON structure with text
2. **Sign Message** - Ed25519 signature added
3. **Transmit** - Sent over WebRTC data channel

### On Message Receive

1. **Deserialize** - Parse JSON
2. **Verify Signature** - Check with sender's public key
3. **Display** - Show with ✓ (verified) or ⚠ (unverified)

## Console Output

### Identity Initialization
```javascript
Our peer ID: peer-a1b2c3d4
Our fingerprint: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
Local P2P Messenger initialized with protocol v1.0
```

### Connection Established
```javascript
Data channel opened
Sending message: {type: "system", payload: {action: "hello", peerInfo: {...}}}
Received message: {type: "system", payload: {action: "hello", peerInfo: {...}}}
Added peer with fingerprint: x9y8z7w6v5u4t3s2...
Message signature valid: true
```

### Message Exchange
```javascript
Sending message: {type: "text", payload: {text: "Hello"}, signature: "base64..."}
Received message: {type: "text", payload: {text: "Hi"}, signature: "base64..."}
Message signature valid: true
```

## Checking Your Identity

### In Console
```javascript
// View your identity
console.log('My ID:', peerId);
console.log('My fingerprint:', ownIdentity.getFingerprint());
console.log('My public key:', ownIdentity.getPublicInfo());

// View known peers
console.log('Known peers:', identityManager.listPeers());

// View trust records
console.log('Trust records:', identityManager.listTrust());
```

### In localStorage

**Chrome/Edge:**
1. Press F12 (DevTools)
2. Go to "Application" tab
3. Expand "Local Storage"
4. Click on "file://"
5. Look for:
   - `lp2p_identity` - Your keypair
   - `lp2p_peers` - Known peers
   - `lp2p_trust` - Trust records

**Firefox:**
1. Press F12 (DevTools)
2. Go to "Storage" tab
3. Expand "Local Storage"
4. Look for the same keys

## Verifying a Connection

### Manual Fingerprint Verification

1. **Both users open console**
2. **User A runs:** `console.log(ownIdentity.getFingerprint())`
3. **User B sees:** Fingerprint in A's HELLO message
4. **Compare:** Match the fingerprints (can use out-of-band like phone call)
5. **If match:** Trust the connection!

### Example Verification
```
User A: a1b2:c3d4:e5f6:g7h8:i9j0:k1l2:m3n4:o5p6
User B: (checks peer roster) a1b2:c3d4:e5f6:g7h8:i9j0:k1l2:m3n4:o5p6
Result: ✓ Match! Connection is authentic
```

## Troubleshooting

### "Cannot verify: sender not in known peers"

**Cause:** Received message before HELLO exchange  
**Fix:** Wait for HELLO messages to complete

### "Message signature valid: false"

**Cause:** Message tampered or wrong public key  
**Fix:** Check peer's fingerprint, reconnect if needed

### Identity not persisting

**Cause:** localStorage disabled or cleared  
**Fix:** Check browser settings, allow localStorage for file:// URLs

### Different identity each time

**Cause:** localStorage not working  
**Fix:** Try serving via HTTP server instead of file://

## Next Steps

### Option C: Multi-Peer Connections
- Connect to more than one peer
- Maintain separate channels
- Route messages to specific peers
- Group chat functionality

### Trust Management UI
- Show list of known peers
- Change trust levels
- Display verification status
- Highlight trusted vs untrusted

### Key Export/Import
- Backup your identity
- Transfer to another browser
- Restore from backup
- Share across devices

## Security Notes

### What's Protected

✅ Message authenticity (signatures prove sender)  
✅ Message integrity (signatures prevent tampering)  
✅ Identity verification (fingerprints unique to keys)  
✅ Persistent identity (same keys across sessions)

### What's NOT Protected

❌ Message confidentiality (messages not encrypted yet)  
❌ Metadata hiding (connection info visible)  
❌ Anonymous communication (identity revealed)  
❌ Traffic analysis (message patterns visible)

**Future:** Add end-to-end encryption for message content

## Resources

- `IDENTITY_DESIGN.md` - Complete design specification
- `IDENTITY_INTEGRATION.md` - Integration details
- `identity.js` - Identity implementation code
- `PROTOCOL.md` - Message protocol specification
- `TESTING.md` - Testing procedures

## Getting Help

### Check Console First
Most issues show clear error messages in the browser console (F12)

### Common Issues
1. WebRTC connection failing → Check STUN server access
2. Signature verification failing → Check peer roster
3. Identity not loading → Check localStorage availability

### Debug Commands
```javascript
// Check identity status
console.log('Identity:', ownIdentity);
console.log('Manager:', identityManager);

// Check connection
console.log('Peer connection:', peerConnection);
console.log('Data channel:', dataChannel);
console.log('Remote peer:', remotePeerId);

// Check messages
console.log('Message handler:', messageHandler);
```

---

**Status:** ✅ Ready to use with cryptographic identity!
**Version:** 1.0
**Last Updated:** 2024
