# Local P2P Application Framework - Architecture

## Overview
A browser-based peer-to-peer communication framework that starts with local file loading and simple messaging, designed to scale to LAN and internet-wide P2P applications.

## Development Phases

### Phase 1: Local Browser P2P (Current)
**Goal**: Establish basic P2P connection between two browsers on the same machine using a local HTML file.

**Key Features**:
- Single HTML file with embedded JavaScript
- WebRTC data channels for P2P communication
- Manual signaling (copy-paste offers/answers between browsers)
- Simple text messaging
- No server required

**Technical Stack**:
- HTML5 + Vanilla JavaScript
- WebRTC API (RTCPeerConnection, RTCDataChannel)
- Manual signaling via textarea copy-paste

### Phase 2: LAN Discovery (Future)
**Goal**: Automatic peer discovery within local network.

**Planned Features**:
- mDNS/Bonjour for peer discovery
- Local signaling server (optional)
- Multiple peer connections
- Peer list management

### Phase 3: Internet-Scale P2P (Future)
**Goal**: Global peer-to-peer network with NAT traversal.

**Planned Features**:
- STUN/TURN servers for NAT traversal
- DHT (Distributed Hash Table) for peer discovery
- Relay fallback for difficult NAT scenarios
- Peer reputation and routing

### Phase 4: Advanced Data Sharing (Future)
**Goal**: Rich content sharing and synchronization.

**Planned Features**:
- File sharing with chunking and resume
- Notes and document sync (CRDT-based)
- Git repository sharing
- IndexedDB for local persistence
- Structured data protocols (JSON, MessagePack)

## Technical Architecture (Phase 1)

### WebRTC Components

#### RTCPeerConnection
- Manages the P2P connection
- Handles ICE candidate gathering
- Negotiates media/data capabilities

#### RTCDataChannel
- Reliable ordered channel for messaging
- Binary and text support
- Low latency communication

### Signaling Flow (Manual)
```
Peer A (Offerer)                    Peer B (Answerer)
    |                                      |
    |-- Create Offer ------------------>  |
    |   (copy SDP to clipboard)           |
    |                                      |
    |                                      |-- Paste Offer
    |                                      |-- Create Answer
    |                                      |
    |<-- Return Answer ------------------|
    |   (copy SDP to clipboard)           |
    |                                      |
    |-- Paste Answer                      |
    |                                      |
    |<====== ICE Candidates Exchange ====>|
    |   (copy-paste candidates)            |
    |                                      |
    |<====== Data Channel Connected =====>|
    |                                      |
    |<====== Send/Receive Messages ======>|
```

### Connection States
1. **Disconnected**: No connection established
2. **Signaling**: Exchanging SDP offers/answers
3. **Connecting**: ICE candidates being exchanged
4. **Connected**: Data channel open and ready
5. **Failed**: Connection attempt failed

## File Structure (Current)
```
lp2p/
├── ARCHITECTURE.md          # This file
├── README.md               # Usage instructions
├── index.html              # Main application (single file)
└── examples/
    └── future plans...
```

## Security Considerations

### Phase 1
- All data transmitted directly between peers
- No intermediary servers (except STUN for ICE)
- Local file execution - no CORS issues
- Browser sandboxing provides isolation

### Future Phases
- End-to-end encryption for messages
- Peer authentication mechanisms
- Content signing and verification
- Permission systems for data sharing

## Browser Compatibility
- Chrome/Edge: Full support (recommended)
- Firefox: Full support
- Safari: Partial support (requires HTTPS for some features)

## Next Steps
1. ✓ Create architecture documentation
2. Implement basic HTML/JS application
3. Test P2P connection between two browsers
4. Document usage and testing procedures
5. Plan Phase 2 enhancements
