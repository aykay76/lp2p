# Protocol Layer Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         APPLICATION LAYER                        │
│                          (index.html)                            │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │     UI       │  │   Chat UI    │  │  Connection  │         │
│  │   Controls   │  │   Messages   │  │    Manager   │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
│         │                  │                  │                  │
│         └──────────────────┼──────────────────┘                 │
│                            │                                     │
└────────────────────────────┼─────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      PROTOCOL LAYER                              │
│                       (protocol.js)                              │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   MessageHandler                          │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐         │  │
│  │  │   TEXT     │  │    FILE    │  │   SYSTEM   │         │  │
│  │  │  Handler   │  │  Handler   │  │  Handler   │         │  │
│  │  └────────────┘  └────────────┘  └────────────┘         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                 MessageFactory                            │  │
│  │  createText() | createFile() | createData() | ...        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                MessageValidator                           │  │
│  │  validateStructure() | validateTypes() | ...             │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Message Class                          │  │
│  │  serialize() | deserialize() | validate() | ...          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      TRANSPORT LAYER                             │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  RTCDataChannel                           │  │
│  │         WebRTC Peer-to-Peer Connection                    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                 RTCPeerConnection                         │  │
│  │         ICE, STUN, Connection Management                  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Message Flow

### Sending a Message

```
User Input
    │
    ▼
sendMessage()
    │
    ▼
MessageFactory.createText(from, to, text)
    │
    ▼
MessageValidator.validate(message)
    │
    ├─── Valid ───────────────┐
    │                          ▼
    │                   message.serialize()
    │                          │
    │                          ▼
    │                   dataChannel.send(json)
    │                          │
    │                          ▼
    │                   [Network Transfer]
    │
    └─── Invalid ────────────┐
                              ▼
                        Error Display
```

### Receiving a Message

```
[Network Transfer]
    │
    ▼
dataChannel.onmessage(event)
    │
    ▼
Message.deserialize(event.data)
    │
    ▼
MessageValidator.validate(message)
    │
    ├─── Valid ───────────────┐
    │                          ▼
    │                   MessageHandler.handle(message)
    │                          │
    │                          ▼
    │                   Find registered handlers
    │                          │
    │                          ▼
    │                   Execute handler callbacks
    │                          │
    │                          ▼
    │                   Update UI / Process data
    │
    └─── Invalid ────────────┐
                              ▼
                        Send Error Message
                              │
                              ▼
                        Log to Console
```

## Message Types Hierarchy

```
Message (Base)
├── protocol: "lp2p"
├── version: "1.0"
├── id: UUID
├── type: ─────┬─── TEXT
│              ├─── FILE ────┬─── offer
│              │             ├─── accept
│              │             ├─── reject
│              │             ├─── chunk
│              │             ├─── cancel
│              │             └─── complete
│              │
│              ├─── DATA ────┬─── note
│              │             ├─── bookmark
│              │             ├─── code
│              │             └─── custom...
│              │
│              ├─── SYSTEM ──┬─── hello
│              │             ├─── goodbye
│              │             ├─── ping
│              │             ├─── pong
│              │             ├─── listPeers
│              │             ├─── peerList
│              │             └─── error
│              │
│              └─── CONTROL ─┬─── typing
│                            ├─── read
│                            ├─── focus
│                            └─── away
├── from: peer-id
├── to: peer-id | "*"
├── timestamp: number
├── payload: { ... }
├── replyTo: (optional)
└── metadata: (optional)
```

## Component Dependencies

```
┌─────────────────┐
│  Application    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ MessageHandler  │──────┐
└────────┬────────┘      │
         │               │
         ▼               │
┌─────────────────┐      │
│ MessageFactory  │◄─────┤
└────────┬────────┘      │
         │               │
         ▼               │
┌─────────────────┐      │
│MessageValidator │◄─────┤
└────────┬────────┘      │
         │               │
         ▼               │
┌─────────────────┐      │
│    Message      │◄─────┘
└─────────────────┘
```

## Data Flow Example: Sending "Hello"

```
Step 1: User types "Hello" and presses Send
    ↓
Step 2: sendMessage() called
    ↓
Step 3: MessageFactory.createText(peerId, remotePeerId, "Hello")
    ↓
Step 4: Creates Message object:
        {
          protocol: "lp2p",
          version: "1.0",
          id: "550e8400-e29b-41d4-a716-446655440000",
          type: "text",
          from: "peer-abc123",
          to: "peer-def456",
          timestamp: 1730851200000,
          payload: { text: "Hello", format: "plain" }
        }
    ↓
Step 5: MessageValidator.validate(message)
    ↓
Step 6: message.serialize() → JSON string
    ↓
Step 7: dataChannel.send(json)
    ↓
Step 8: [WebRTC transmits across network]
    ↓
Step 9: Remote peer receives via dataChannel.onmessage
    ↓
Step 10: Message.deserialize(data) → Message object
    ↓
Step 11: MessageValidator.validate(message)
    ↓
Step 12: MessageHandler.handle(message)
    ↓
Step 13: Finds TEXT handler
    ↓
Step 14: Handler executes: addMessage("Hello", false)
    ↓
Step 15: UI displays: "Hello" in chat
```

## Extension Points

### Adding a New Message Type

```
1. Define type constant in protocol.js:
   MESSAGE_TYPES.CUSTOM = 'custom'

2. Add to protocol spec (PROTOCOL.md)

3. Implement validator:
   validateCustomPayload(payload) { ... }

4. Add factory method:
   MessageFactory.createCustom(...) { ... }

5. Register handler in app:
   handler.register(MESSAGE_TYPES.CUSTOM, callback)
```

### Adding a New Action

```
1. Define action constant:
   CUSTOM_ACTIONS.NEW_ACTION = 'newAction'

2. Update payload validator

3. Add factory method (optional)

4. Register action handler:
   handler.registerAction(type, action, callback)
```

## Security Boundaries

```
┌─────────────────────────────────────────────┐
│  TRUSTED ZONE (Our Application)             │
│                                              │
│  ┌────────────────────────────────────────┐ │
│  │  MessageFactory (Creates valid msgs)   │ │
│  └────────────────────────────────────────┘ │
│                                              │
│  ┌────────────────────────────────────────┐ │
│  │  MessageValidator (Validates all)      │ │
│  └────────────────────────────────────────┘ │
│                                              │
└──────────────────┬───────────────────────────┘
                   │
        [Network Boundary]
                   │
┌──────────────────▼───────────────────────────┐
│  UNTRUSTED ZONE (Remote Peer)                │
│                                               │
│  ⚠️  All incoming data validated             │
│  ⚠️  Size limits enforced                    │
│  ⚠️  Type checking required                  │
│  ⚠️  Timestamp bounds checked                │
│  ⚠️  No code execution from payload          │
│                                               │
└───────────────────────────────────────────────┘
```

---

This architecture provides:
- ✅ Clear separation of concerns
- ✅ Type safety at boundaries
- ✅ Extensibility without breaking changes
- ✅ Security through validation
- ✅ Easy testing and debugging
