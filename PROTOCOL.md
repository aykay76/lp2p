# P2P Message Protocol Specification v1.0

## Overview

The Local P2P Message Protocol defines a standardized format for all peer-to-peer communication. It provides a flexible, extensible structure that supports text messages, file transfers, structured data exchange, and system control messages.

## Design Principles

1. **Simplicity**: Easy to understand and implement
2. **Extensibility**: New message types can be added without breaking existing code
3. **Type Safety**: Strong typing with validation
4. **Efficiency**: Minimal overhead for small messages
5. **Debuggability**: Human-readable JSON format
6. **Future-Proof**: Versioned protocol with backward compatibility

## Core Message Format

Every message follows this base structure:

```javascript
{
  // Protocol metadata
  "protocol": "lp2p",           // Protocol identifier
  "version": "1.0",             // Protocol version
  
  // Message identification
  "id": "uuid-v4",              // Unique message ID
  "type": "text|file|data|system|control",
  
  // Routing information
  "from": "peer-id",            // Sender's peer ID
  "to": "peer-id|*",            // Recipient(s), "*" for broadcast
  
  // Timing
  "timestamp": 1730851200000,   // Unix timestamp (ms)
  
  // Content
  "payload": { },               // Type-specific content
  
  // Optional fields
  "replyTo": "message-id",      // If replying to another message
  "metadata": { }               // Optional arbitrary metadata
}
```

## Message Types

### 1. TEXT - Human Messages

Plain text messages between users.

```javascript
{
  "protocol": "lp2p",
  "version": "1.0",
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "type": "text",
  "from": "peer-abc123",
  "to": "peer-def456",
  "timestamp": 1730851200000,
  "payload": {
    "text": "Hello, world!",
    "format": "plain"           // "plain" | "markdown" | "html"
  }
}
```

**Payload Schema:**
- `text` (string, required): Message content
- `format` (string, optional): Content format, default "plain"

### 2. FILE - File Transfers

File transfer messages with chunking support.

#### File Metadata (Initial Announcement)
```javascript
{
  "protocol": "lp2p",
  "version": "1.0",
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "type": "file",
  "from": "peer-abc123",
  "to": "peer-def456",
  "timestamp": 1730851200000,
  "payload": {
    "action": "offer",
    "fileId": "file-xyz789",
    "name": "document.pdf",
    "size": 1048576,            // bytes
    "mimeType": "application/pdf",
    "chunkSize": 16384,         // bytes per chunk
    "totalChunks": 64,
    "hash": "sha256-hash"       // For verification
  }
}
```

#### File Chunk
```javascript
{
  "protocol": "lp2p",
  "version": "1.0",
  "id": "550e8400-e29b-41d4-a716-446655440002",
  "type": "file",
  "from": "peer-abc123",
  "to": "peer-def456",
  "timestamp": 1730851200000,
  "payload": {
    "action": "chunk",
    "fileId": "file-xyz789",
    "chunkIndex": 0,
    "data": "base64-encoded-data",
    "isLast": false
  }
}
```

#### File Control Messages
```javascript
{
  "payload": {
    "action": "accept|reject|cancel|complete",
    "fileId": "file-xyz789",
    "reason": "optional reason for reject/cancel"
  }
}
```

**File Actions:**
- `offer`: Sender announces file availability
- `accept`: Recipient agrees to receive
- `reject`: Recipient declines
- `chunk`: Individual file chunk
- `cancel`: Either party cancels transfer
- `complete`: Transfer finished successfully

### 3. DATA - Structured Data

Application-specific structured data exchange.

```javascript
{
  "protocol": "lp2p",
  "version": "1.0",
  "id": "550e8400-e29b-41d4-a716-446655440003",
  "type": "data",
  "from": "peer-abc123",
  "to": "peer-def456",
  "timestamp": 1730851200000,
  "payload": {
    "dataType": "note",         // Application-defined type
    "schema": "note-v1",        // Schema version
    "content": {
      "title": "My Note",
      "body": "Note content",
      "tags": ["important", "work"]
    }
  }
}
```

**Common Data Types:**
- `note`: Synchronized notes
- `todo`: Task items
- `bookmark`: URL bookmarks
- `code`: Code snippets
- `config`: Configuration sync

**Payload Schema:**
- `dataType` (string, required): Type of structured data
- `schema` (string, required): Schema version for validation
- `content` (object, required): The actual data payload

### 4. SYSTEM - Protocol Messages

Internal protocol and connection management.

#### Peer Introduction
```javascript
{
  "protocol": "lp2p",
  "version": "1.0",
  "id": "550e8400-e29b-41d4-a716-446655440004",
  "type": "system",
  "from": "peer-abc123",
  "to": "*",
  "timestamp": 1730851200000,
  "payload": {
    "action": "hello",
    "peerInfo": {
      "id": "peer-abc123",
      "name": "Alice's Browser",
      "publicKey": "ed25519-public-key",
      "capabilities": ["text", "file", "data"],
      "version": "1.0.0"
    }
  }
}
```

#### Heartbeat
```javascript
{
  "type": "system",
  "payload": {
    "action": "ping"
  }
}
```

```javascript
{
  "type": "system",
  "replyTo": "ping-message-id",
  "payload": {
    "action": "pong"
  }
}
```

#### Peer List Request/Response
```javascript
{
  "type": "system",
  "payload": {
    "action": "listPeers"
  }
}
```

```javascript
{
  "type": "system",
  "replyTo": "request-message-id",
  "payload": {
    "action": "peerList",
    "peers": [
      {
        "id": "peer-abc123",
        "name": "Alice's Browser",
        "connected": true
      }
    ]
  }
}
```

**System Actions:**
- `hello`: Peer introduction on connection
- `goodbye`: Peer disconnection notice
- `ping`/`pong`: Connection keep-alive
- `listPeers`: Request connected peers
- `peerList`: Response with peer information
- `error`: Error notification

### 5. CONTROL - Application Control

Application-level control messages.

```javascript
{
  "protocol": "lp2p",
  "version": "1.0",
  "id": "550e8400-e29b-41d4-a716-446655440005",
  "type": "control",
  "from": "peer-abc123",
  "to": "peer-def456",
  "timestamp": 1730851200000,
  "payload": {
    "action": "typing",
    "active": true
  }
}
```

**Control Actions:**
- `typing`: User is typing indicator
- `read`: Message read receipt
- `focus`: Peer has app in focus
- `away`: Peer is away/inactive

## Message Validation

### Required Fields

All messages MUST include:
- `protocol`: Must be "lp2p"
- `version`: Semver format (e.g., "1.0", "1.2.0")
- `id`: Valid UUID v4
- `type`: One of the defined types
- `from`: Valid peer ID
- `to`: Valid peer ID or "*"
- `timestamp`: Valid Unix timestamp in milliseconds
- `payload`: Object (can be empty)

### Field Constraints

- `id`: UUID v4 format, must be unique
- `from`: String, 3-64 characters, alphanumeric and hyphens
- `to`: String, 3-64 characters, or "*" for broadcast
- `timestamp`: Number, within reasonable time bounds (±5 minutes for validation)
- `type`: Must be a recognized type
- `payload`: Object, max 10MB serialized size (configurable)

### Validation Levels

1. **Structural**: JSON is valid and has required fields
2. **Type**: Field values match expected types
3. **Semantic**: Content makes sense (e.g., file size > 0)
4. **Security**: No injection attempts, reasonable sizes

## Error Handling

When a message fails validation or processing:

```javascript
{
  "protocol": "lp2p",
  "version": "1.0",
  "id": "550e8400-e29b-41d4-a716-446655440006",
  "type": "system",
  "from": "peer-def456",
  "to": "peer-abc123",
  "timestamp": 1730851200000,
  "replyTo": "failed-message-id",
  "payload": {
    "action": "error",
    "code": "INVALID_FORMAT",
    "message": "Missing required field: payload.text",
    "details": { }
  }
}
```

**Error Codes:**
- `INVALID_FORMAT`: Message structure invalid
- `UNSUPPORTED_TYPE`: Message type not supported
- `UNSUPPORTED_VERSION`: Protocol version mismatch
- `VALIDATION_FAILED`: Payload validation failed
- `TOO_LARGE`: Message exceeds size limit
- `RATE_LIMIT`: Too many messages too quickly
- `UNAUTHORIZED`: Sender not authorized for action

## Extensibility

### Adding New Message Types

New message types can be added by:
1. Defining the type name
2. Documenting payload schema
3. Implementing validation rules
4. Registering handlers

### Custom Payload Fields

Applications can add custom fields to payload:
```javascript
{
  "type": "text",
  "payload": {
    "text": "Hello",
    "format": "plain",
    "customField": "value"    // Custom fields ignored by core protocol
  }
}
```

### Metadata Field

Use `metadata` for application-specific annotations:
```javascript
{
  "metadata": {
    "priority": "high",
    "encrypted": true,
    "appVersion": "2.1.0"
  }
}
```

## Version Compatibility

### Version Negotiation

Peers should exchange protocol versions in `hello` message:
```javascript
{
  "type": "system",
  "payload": {
    "action": "hello",
    "peerInfo": {
      "protocolVersion": "1.0",
      "supportedVersions": ["1.0", "0.9"]
    }
  }
}
```

### Backward Compatibility Rules

- Major version change (1.x → 2.x): Breaking changes allowed
- Minor version change (1.0 → 1.1): Additive changes only
- Unknown fields should be preserved/ignored
- Unknown message types should generate error response

## Security Considerations

### Message Signing (Future)

```javascript
{
  "signature": {
    "algorithm": "ed25519",
    "publicKey": "base64-encoded-key",
    "value": "base64-signature"
  }
}
```

### Message Encryption (Future)

```javascript
{
  "encrypted": true,
  "payload": {
    "algorithm": "xchacha20-poly1305",
    "nonce": "base64-nonce",
    "ciphertext": "base64-encrypted-payload"
  }
}
```

## Performance Considerations

- **Small messages**: Text and control should be < 1KB
- **Large messages**: Files use chunking (16KB default)
- **Batching**: Multiple small messages can be batched
- **Compression**: Consider gzip for large JSON payloads
- **Binary**: Use base64 for binary data (33% overhead acceptable)

## Implementation Notes

### Message IDs

Generate using crypto.randomUUID() or equivalent:
```javascript
const id = crypto.randomUUID();
```

### Timestamps

Use consistent time source:
```javascript
const timestamp = Date.now();
```

### JSON Serialization

Use standard JSON.stringify/parse:
```javascript
const wire = JSON.stringify(message);
const message = JSON.parse(wire);
```

### Size Limits

Recommended limits:
- Text messages: 64KB
- File chunks: 16KB
- Data messages: 1MB
- Total message: 10MB

## Examples

See `/examples` directory for:
- Basic text messaging
- File transfer flow
- Structured data exchange
- Multi-peer scenarios
- Error handling patterns

## Future Enhancements

- Message compression
- Binary protocol option (MessagePack, Protocol Buffers)
- Message priority/QoS
- Delivery receipts
- Message history sync
- Offline message queue

---

**Protocol Version**: 1.0  
**Last Updated**: 2025-11-05  
**Status**: Draft
