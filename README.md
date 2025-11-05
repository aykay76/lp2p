# Local P2P Messenger

A simple browser-based peer-to-peer messaging application using WebRTC. No servers required - just open a local HTML file and connect!

## Quick Start

### Testing on the Same Machine (Two Browsers)

1. **Open the file in Browser 1** (e.g., Chrome)
   ```
   File → Open File → index.html
   ```

2. **Open the file in Browser 2** (e.g., Firefox or another Chrome window)
   ```
   File → Open File → index.html
   ```

3. **Create Connection:**

   **In Browser 1 (Peer A):**
   - Click the **"Create Offer"** button
   - Copy the text that appears in the "Peer A" text area
   
   **In Browser 2 (Peer B):**
   - Paste the copied offer into the "Peer B" text area
   - Click the **"Create Answer"** button
   - Copy the answer text that appears
   
   **Back in Browser 1 (Peer A):**
   - Paste the answer into the "Paste Answer Here" text area
   - Click the **"Apply Answer"** button

4. **Start Chatting:**
   - Once connected, the status will show "Connected" (green indicator)
   - Type messages in the input field and press Enter or click Send
   - Messages appear in real-time on both sides!

## How It Works

### WebRTC Data Channels
The application uses WebRTC's `RTCDataChannel` for peer-to-peer communication. This provides:
- **Direct connection** between browsers (no server in the middle)
- **Low latency** messaging
- **Reliable delivery** (messages arrive in order)

### Manual Signaling
Instead of a signaling server, we use a simple copy-paste mechanism:
1. **Peer A** creates an SDP offer containing connection information
2. **Peer B** receives the offer and creates an SDP answer
3. **Peer A** applies the answer
4. WebRTC handles ICE candidate exchange automatically (included in offer/answer)

### Connection Flow
```
Browser 1                              Browser 2
    |                                      |
    |-- 1. Create Offer ----------------->|
    |   (contains SDP + ICE candidates)   |
    |                                      |
    |<-- 2. Create Answer ----------------|
    |   (contains SDP + ICE candidates)   |
    |                                      |
    |-- 3. Apply Answer                   |
    |                                      |
    |<===== 4. Connected! ===============>|
    |                                      |
    |<===== Send/Receive Messages =======>|
```

## Features

### Current (Phase 1)
- ✅ Direct P2P messaging between two browsers
- ✅ **Structured message protocol** with validation
- ✅ Manual signaling via copy-paste
- ✅ Real-time message delivery
- ✅ Connection status indicators
- ✅ Peer identification and hello/goodbye messages
- ✅ Extensible protocol for future features
- ✅ Clean, modern UI
- ✅ No server or installation required

### Planned (Future Phases)
- 🔮 Automatic LAN peer discovery
- 🔮 Multiple peer connections
- 🔮 File sharing
- 🔮 Notes synchronization
- 🔮 Code repository sharing
- 🔮 Persistent storage (IndexedDB)
- 🔮 Internet-scale P2P with NAT traversal

## Troubleshooting

### Connection fails or status shows "Failed"
- Make sure you copied the entire offer/answer text
- Try refreshing both browsers and starting over
- Check browser console for error messages (F12 → Console)

### Messages not appearing
- Verify the status indicator is green and says "Connected"
- Check that both browsers completed the signaling process
- Some browsers may block WebRTC on file:// URLs - try using a local server if needed

### Using a Local Server (if needed)
If your browser restricts file:// access, run a simple HTTP server:

```bash
# Python 3
python3 -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000

# Node.js (if you have npx)
npx http-server
```

Then open: `http://localhost:8000/index.html`

## Browser Support

| Browser | Support | Notes |
|---------|---------|-------|
| Chrome  | ✅ Full | Recommended |
| Firefox | ✅ Full | Works perfectly |
| Edge    | ✅ Full | Chromium-based |
| Safari  | ⚠️ Partial | May require HTTPS |
| Opera   | ✅ Full | Chromium-based |

## Architecture

The application now uses a **structured message protocol** that provides:

- **Type Safety**: All messages are validated before sending/receiving
- **Extensibility**: Easy to add new message types (files, structured data, etc.)
- **Error Handling**: Proper error messages and validation feedback
- **Future-Proof**: Ready for authentication, encryption, and advanced features

### Message Types
- **TEXT**: Human-readable messages
- **FILE**: File transfers with chunking
- **DATA**: Structured data (notes, bookmarks, code, etc.)
- **SYSTEM**: Protocol messages (hello, goodbye, ping, error)
- **CONTROL**: UI control messages (typing indicators, read receipts)

See [PROTOCOL.md](PROTOCOL.md) for the complete specification and [examples/PROTOCOL_EXAMPLES.md](examples/PROTOCOL_EXAMPLES.md) for usage examples.

For detailed technical documentation see [ARCHITECTURE.md](ARCHITECTURE.md) for:
- System architecture and design
- Future development phases
- Security considerations
- Scaling plans

## Development

### Project Structure
```
lp2p/
├── ARCHITECTURE.md    # Technical architecture and roadmap
├── PROTOCOL.md        # Message protocol specification
├── README.md          # This file
├── index.html         # Main application
├── protocol.js        # Protocol layer implementation
└── examples/
    └── PROTOCOL_EXAMPLES.md  # Protocol usage examples
```

### Key Technologies
- **WebRTC**: RTCPeerConnection, RTCDataChannel
- **Message Protocol**: Structured, validated, extensible messaging
- **HTML5**: Modern web APIs
- **Vanilla JavaScript**: No frameworks or dependencies
- **CSS3**: Gradient backgrounds, flexbox, grid

## Examples

### Basic Message Exchange
1. Browser 1 sends: "Hello from Peer A!"
2. Browser 2 receives and displays the message
3. Browser 2 sends: "Hi from Peer B!"
4. Browser 1 receives and displays the message

### Testing Different Browser Combinations
- Chrome → Firefox
- Firefox → Chrome
- Chrome → Chrome (different windows)
- Firefox → Firefox (different windows)

All combinations should work!

## Security Notes

- Messages are transmitted directly between peers (P2P)
- Connection uses DTLS (Datagram Transport Layer Security) by default in WebRTC
- No intermediary server sees your messages
- Local file execution means no CORS issues
- Future versions will add end-to-end encryption for enhanced security

## Contributing

This is the foundation of a larger P2P framework. Future contributions could include:
- Automatic peer discovery mechanisms
- Enhanced security features
- File transfer capabilities
- Structured data synchronization
- Mobile browser support

## License

This project is open source and available for educational and commercial use.

## Questions?

Check the browser console (F12 → Console) for debug logs and error messages. All WebRTC events are logged for troubleshooting.

---

**Next Steps**: Once you've successfully connected two browsers, see [ARCHITECTURE.md](ARCHITECTURE.md) for the roadmap to Phase 2 (LAN discovery) and beyond!
