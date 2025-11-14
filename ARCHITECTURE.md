# Local P2P Application Framework - Architecture

## Overview
A browser-based peer-to-peer communication framework using **PeerJS** for signaling and presence tracking, enabling decentralized communication with cryptographic identity verification.

## Current Architecture (Simplified)

### Core Components

1. **PeerJS Signaling & Presence**
   - Single service handles all signaling (WebRTC offers/answers)
   - **Truly P2P presence tracking** via direct peer pings
   - No server listing required - works with public PeerJS cloud
   - Peer ID format: `lp2p-{peerId}`

2. **Cryptographic Identity**
   - Ed25519 keypair generation
   - Persistent identity in localStorage
   - Fingerprint-based trust model
   - Message signing and verification

3. **WebRTC Data Channels**
   - Direct peer-to-peer connections
   - Reliable ordered messaging
   - No data passes through signaling server

4. **Room System**
   - Create/join rooms with 6-character codes
   - Multi-party connections (mesh topology)
   - Room metadata stored locally
   - Auto-rejoin on startup

### Development Phases

### Phase 1: Cloud Signaling P2P (Current)
**Goal**: Full-featured P2P messenger with automatic signaling and presence.

**Key Features**:
- ✅ PeerJS cloud signaling (no backend needed)
- ✅ **P2P presence via direct pings** (no server listing)
- ✅ Cryptographic identity with trust levels
- ✅ Room-based multi-party chat
- ✅ Message signing and verification
- ✅ Direct peer-to-peer data transfer

**Technical Stack**:
- HTML5 + Vanilla JavaScript
- WebRTC API (RTCPeerConnection, RTCDataChannel)
- PeerJS for signaling and presence
- SubtleCrypto for Ed25519 signatures
- IndexedDB for local storage

### Phase 2: Enhanced Discovery (Future)
**Goal**: Better peer discovery and connection reliability.

**Planned Features**:
- Self-hosted PeerJS servers
- Multiple signaling endpoints
- Peer reputation system
- Connection quality metrics

### Phase 3: Advanced Features (Future)
**Goal**: Rich content sharing and synchronization.

**Planned Features**:
- File sharing with chunking and resume
- Notes and document sync (CRDT-based)
- Git repository sharing
- Structured data protocols

## Technical Architecture

### PeerJS Signaling & P2P Presence Flow
```
App Startup
    |
    |-- Load Identity & Known Contacts
    |-- Connect to PeerJS (lp2p-{peerId})
    |-- Ping all known contacts directly (P2P)
    |
    |<==== Presence Results from Direct Pings ====>
    |
    |-- Status Bar Hides (connected)
    |-- Peer roster shows online peers (🟢)
    |-- Auto-refresh every 30 seconds
    |
User Creates/Joins Room
    |
    |-- Create Room Signaling Instance
    |-- Exchange offers/answers via PeerJS
    |
    |<==== WebRTC Data Channel Opens ====>
    |
    |-- Direct P2P messaging (bypasses PeerJS)
    |-- Messages are signed with Ed25519
    |-- Trust verification on peer identity
```

### How P2P Presence Works

Unlike traditional systems that require a server to list online users, this app uses **direct peer pinging**:

1. **App loads** → Gets list of known contacts from IndexedDB
2. **For each contact** → Attempts lightweight PeerJS connection
3. **If connection opens** → Peer is online! Mark with 🟢
4. **If timeout (5s)** → Peer is offline, no indicator
5. **Repeat every 30s** → Keeps presence fresh

**Advantages:**
- ✅ No server listing required (works with free PeerJS cloud)
- ✅ Truly decentralized - direct peer-to-peer checks
- ✅ Privacy-preserving - only your contacts are pinged
- ✅ Works behind NAT (uses PeerJS signaling)

**How it's different from server-based presence:**
- Traditional: Server maintains list of all connected users
- This app: Each peer directly pings their own contacts
- Result: No centralized "who's online" database

### Connection States
1. **Connecting**: Connecting to PeerJS cloud
2. **Connected**: PeerJS connection active, status bar hidden
3. **Disconnected**: Lost connection, status bar shown
4. **Signaling**: Exchanging WebRTC offers/answers
5. **Direct P2P**: Data channel open, messages flowing

### Identity & Trust Model
- **Unknown** (❓): New peer, not yet verified
- **Untrusted** (⛔): Explicitly marked as not trustworthy
- **Marginal** (⚠️): Partially verified
- **Full** (✅): Fingerprint verified out-of-band
- **Ultimate** (⭐): Your own identity

## File Structure
```
lp2p/
├── ARCHITECTURE.md          # This file
├── IDENTITY_DESIGN.md       # Identity system documentation
├── PROTOCOL.md             # Message protocol specification
├── README.md               # Usage instructions
├── index.html              # Main application
├── main.css                # Styling
├── signaling.js            # PeerJS signaling & presence
├── protocol.js             # Message protocol handlers
├── identity.js             # Cryptographic identity system
├── roomStore.js            # Room metadata storage
└── ui.js                   # UI components
```

## Security Features

### Current Implementation
- ✅ **Cryptographic Identity**: Ed25519 keypairs for each user
- ✅ **Message Signing**: All messages signed with private key
- ✅ **Signature Verification**: Validate sender authenticity
- ✅ **Trust Levels**: PGP-style trust model
- ✅ **Fingerprint Verification**: Out-of-band verification support
- ✅ **Direct P2P**: Data never touches signaling server
- ✅ **Browser Sandboxing**: Isolated execution environment

### Future Enhancements
- End-to-end encryption for message content
- Key rotation and revocation
- Web of trust graph
- Hardware security key support

## Browser Compatibility
- **Chrome/Edge**: Full support ✅ (recommended)
- **Firefox**: Full support ✅
- **Safari**: Mostly supported (requires HTTPS for IndexedDB)

## Usage

### First Time Setup
1. Open `index.html` in browser
2. Choose a display name
3. App auto-connects to PeerJS network
4. Status bar hides when connected

### Connecting to Peers
1. Share your fingerprint with peers (via identity popup)
2. Wait for peer to appear in Contacts (green indicator = online)
3. Click peer to select them
4. Click "Connect" or they appear online, click to connect
5. Verify fingerprint out-of-band
6. Set appropriate trust level

### Creating Rooms
1. Click "Create Channel"
2. Give it a name
3. Share room code with peers
4. Peers click "Join Channel" and enter code

## Advantages Over Traditional Apps

✅ **No Server Required**: PeerJS handles signaling, no backend code needed  
✅ **Decentralized**: Direct peer-to-peer connections  
✅ **Private**: Messages never stored on servers  
✅ **Verifiable**: Cryptographic identity with fingerprint verification  
✅ **Simple**: Single-page HTML app, no installation  
✅ **Extensible**: Clean protocol for adding features  

## Limitations

⚠️ **NAT Traversal**: Some networks may block P2P (need TURN server)  
⚠️ **Presence Latency**: Takes up to 5s per contact to detect online status  
⚠️ **No History**: Messages not persisted (by design)  
⚠️ **Online Only**: Both peers must be online simultaneously  

## Why No Self-Hosted Server Needed

This app uses **direct P2P pinging** for presence, which means:

✅ **Public PeerJS cloud works perfectly** - no configuration needed  
✅ **No server maintains a user list** - fully decentralized  
✅ **Privacy-preserving** - only your contacts know you're online  
✅ **Scales naturally** - each user only pings their own contacts  

The public PeerJS server only helps with NAT traversal (like STUN), not presence tracking.

## Future Roadmap
1. ✅ Self-hosted PeerJS server documentation
2. File sharing with progress tracking
3. Group video/audio calls
4. CRDT-based document collaboration
5. Mobile app (React Native)
