# P2P Identity System - Design Document

## Overview

A PGP-inspired identity system for P2P applications using modern Web Crypto API. Each peer has a cryptographic identity that enables authentication, message signing, and trust management.

## Core Principles (Inspired by PGP)

### 1. Identity = Keypair
- Each peer generates an Ed25519 keypair
- Public key serves as the peer's identity
- Private key stays local, never transmitted
- Key fingerprint for human verification

### 2. Self-Sovereign Identity
- Users generate and control their own keys
- No central authority required
- Keys persist across sessions
- Can export/backup keys

### 3. Web of Trust
- Direct connections establish initial trust
- Peers can vouch for other peers
- Trust levels: Unknown, Untrusted, Marginal, Full
- Trust chains for transitive trust

### 4. Message Signing
- All messages can be signed
- Recipients verify signatures
- Tampering is detectable
- Non-repudiation

## Identity Components

### PeerIdentity Structure

```javascript
{
  // Core Identity
  id: "peer-abc123",              // Short ID (derived from public key)
  publicKey: "base64-encoded",    // Ed25519 public key
  privateKey: "base64-encoded",   // Ed25519 private key (local only)
  
  // Key Metadata
  fingerprint: "1234:5678:...",   // Human-readable fingerprint
  keyId: "ABCD1234",              // Short key ID (last 8 chars)
  created: 1730851200000,         // Timestamp of key generation
  
  // Profile Information
  profile: {
    name: "Alice",                // Display name
    email: "alice@example.com",   // Optional email
    avatar: "data:image/...",     // Optional avatar
    bio: "Developer",             // Optional bio
  },
  
  // Capabilities
  capabilities: [
    "text",                       // Supports text messaging
    "file",                       // Supports file transfer
    "data",                       // Supports structured data
    "voice",                      // Future: voice chat
    "video"                       // Future: video chat
  ],
  
  // Version Info
  version: "1.0.0",               // Identity format version
  protocolVersion: "1.0"          // Supported protocol version
}
```

### Trust Record Structure

```javascript
{
  peerId: "peer-def456",          // The peer being trusted
  publicKey: "base64-encoded",    // Their public key
  fingerprint: "1234:5678:...",   // Their fingerprint
  
  // Trust Information
  trustLevel: "full",             // unknown|untrusted|marginal|full
  trustedBy: "peer-abc123",       // Who assigned this trust
  trustedAt: 1730851200000,       // When trust was assigned
  
  // Verification
  verified: true,                 // Manually verified (like PGP signing party)
  verifiedMethod: "in-person",    // in-person|video|code|none
  verifiedAt: 1730851200000,      // When verification happened
  
  // Profile (cached from peer)
  profile: {
    name: "Bob",
    email: "bob@example.com"
  },
  
  // Trust Chain
  introducedBy: "peer-xyz789",    // Who introduced us to this peer
  signatures: [                   // Endorsements from other peers
    {
      signedBy: "peer-xyz789",
      signature: "base64-encoded",
      timestamp: 1730851200000
    }
  ]
}
```

## Cryptography

### Key Generation (Ed25519)

```javascript
// Generate keypair using Web Crypto API
const keypair = await crypto.subtle.generateKey(
  {
    name: "Ed25519",
    namedCurve: "Ed25519"
  },
  true,  // extractable
  ["sign", "verify"]
);

// Export keys
const publicKey = await crypto.subtle.exportKey("spki", keypair.publicKey);
const privateKey = await crypto.subtle.exportKey("pkcs8", keypair.privateKey);

// Convert to base64 for storage
const publicKeyB64 = btoa(String.fromCharCode(...new Uint8Array(publicKey)));
const privateKeyB64 = btoa(String.fromCharCode(...new Uint8Array(privateKey)));
```

### Fingerprint Generation

```javascript
// SHA-256 hash of public key
const hash = await crypto.subtle.digest("SHA-256", publicKeyBytes);

// Format as colon-separated hex (like SSH/PGP)
const fingerprint = Array.from(new Uint8Array(hash))
  .map(b => b.toString(16).padStart(2, '0'))
  .join(':');

// Short form: "1234:5678:9abc:def0:..."
// Full form: all 64 hex chars
```

### Message Signing

```javascript
// Sign message payload
const signature = await crypto.subtle.sign(
  "Ed25519",
  privateKey,
  messageBytes
);

// Add to message
message.signature = {
  algorithm: "Ed25519",
  publicKey: publicKeyB64,
  keyId: keyId,
  value: btoa(String.fromCharCode(...new Uint8Array(signature)))
};
```

### Signature Verification

```javascript
// Extract signature
const signatureBytes = base64ToBytes(message.signature.value);
const publicKeyBytes = base64ToBytes(message.signature.publicKey);

// Import public key
const publicKey = await crypto.subtle.importKey(
  "spki",
  publicKeyBytes,
  { name: "Ed25519", namedCurve: "Ed25519" },
  false,
  ["verify"]
);

// Verify signature
const valid = await crypto.subtle.verify(
  "Ed25519",
  publicKey,
  signatureBytes,
  messageBytes
);
```

## Trust Levels

### Unknown (Default)
- Never seen this peer before
- No trust assigned
- Messages accepted but warnings shown

### Untrusted
- Explicitly marked as untrusted
- Known bad actor
- Messages rejected or heavily warned

### Marginal
- Met once, not verified
- Introduced by trusted peer
- Messages accepted with caution

### Full
- Verified in person or through trusted chain
- Manually marked as trusted
- Messages fully accepted
- Can introduce other peers

## Trust Establishment Flow

### Scenario 1: Direct Connection (First Contact)

```
Alice ←→ Bob (both unknown to each other)

1. Alice connects to Bob via manual signaling
2. Exchange HELLO messages with public keys
3. Both peers show: "Unknown peer Bob (ABCD1234)"
4. Users manually verify fingerprints (out of band)
5. Users mark each other as "Full Trust"
6. Future messages are verified against known keys
```

### Scenario 2: Introduction

```
Alice ←→ Bob ←→ Carol

Alice trusts Bob (Full)
Bob trusts Carol (Full)
Bob introduces Carol to Alice

1. Bob sends introduction message to Alice:
   - Carol's public key
   - Carol's profile
   - Bob's signature on Carol's key
2. Alice receives introduction
3. Alice sees: "Carol, introduced by Bob (Marginal Trust)"
4. Alice can:
   - Accept with Marginal trust
   - Verify and upgrade to Full trust
   - Reject (Untrusted)
```

### Scenario 3: Trust Chain Verification

```
Alice trusts Bob (Full)
Bob trusts Carol (Full)
Carol trusts Dave (Full)

Dave connects to Alice:
1. Dave presents introduction chain:
   Bob → Carol → Dave
2. Alice verifies each signature in chain
3. If all signatures valid:
   - Dave gets "Marginal Trust" (2 hops)
4. Alice can verify Dave directly for Full trust
```

## Key Management

### Generation
- On first use, generate new keypair
- Show fingerprint to user
- Save to localStorage
- Optionally export for backup

### Storage (localStorage)
```javascript
{
  "lp2p.identity": {
    id: "...",
    publicKey: "...",
    privateKey: "...",  // Encrypted in future
    fingerprint: "...",
    profile: { ... },
    created: 1730851200000
  }
}
```

### Backup/Export
```javascript
// Export identity as JSON
{
  "lp2p-identity-export": {
    version: "1.0",
    exported: 1730851200000,
    identity: { ... },
    // Private key included - handle securely!
  }
}

// Users can:
- Save to file
- Print QR code
- Export to password manager
```

### Import
```javascript
// Import from exported JSON
// Validates format and keys
// Optionally merge with existing trust records
```

## Security Considerations

### Private Key Protection
- Never transmit private key
- Store in localStorage (future: encrypt with user password)
- Future: Use Web Crypto non-extractable keys
- Future: Hardware security key support (WebAuthn)

### Fingerprint Verification
- Users should verify fingerprints out-of-band
- Show fingerprint prominently in UI
- QR codes for easy verification
- Voice/video call for remote verification

### Trust Boundaries
- Unknown peers: warnings shown
- Untrusted peers: strong warnings or block
- Marginal peers: proceed with caution
- Full peers: normal operation

### Signature Validation
- Always verify signatures before trusting message
- Check message.from matches signature.publicKey
- Reject messages with invalid signatures
- Log verification failures

## UI Integration

### Identity Display
```
┌─────────────────────────────────────┐
│ Your Identity                        │
├─────────────────────────────────────┤
│ Name: Alice                          │
│ Key ID: ABCD1234                     │
│ Fingerprint: 1234:5678:9abc:...     │
│                                      │
│ [Edit Profile] [Export] [Backup]    │
└─────────────────────────────────────┘
```

### Peer Display
```
┌─────────────────────────────────────┐
│ 👤 Bob                    ✓ Trusted │
├─────────────────────────────────────┤
│ Key ID: EF012345                     │
│ Trust: Full (verified in person)     │
│ Connected: 5 minutes ago             │
│                                      │
│ [View Fingerprint] [Change Trust]   │
└─────────────────────────────────────┘
```

### Trust Prompt
```
┌─────────────────────────────────────┐
│ ⚠️  Unknown Peer Connected           │
├─────────────────────────────────────┤
│ Name: Carol                          │
│ Key ID: 9876FEDC                     │
│ Fingerprint: fedc:ba98:7654:...     │
│                                      │
│ Introduced by: Bob (Trusted)         │
│                                      │
│ ○ Trust (Marginal)                   │
│ ○ Trust (Full) - verify first!       │
│ ○ Don't Trust                        │
│ ○ Block                              │
│                                      │
│ [Compare Fingerprints] [Decide]     │
└─────────────────────────────────────┘
```

## Protocol Extensions

### Enhanced HELLO Message
```javascript
{
  type: "system",
  payload: {
    action: "hello",
    peerInfo: {
      id: "peer-abc123",
      publicKey: "base64-encoded",      // NEW
      fingerprint: "1234:5678:...",     // NEW
      keyId: "ABCD1234",                // NEW
      name: "Alice",
      profile: { ... },
      capabilities: [ ... ],
      version: "1.0.0",
      protocolVersion: "1.0"
    }
  },
  signature: {                          // NEW
    algorithm: "Ed25519",
    publicKey: "base64-encoded",
    keyId: "ABCD1234",
    value: "base64-signature"
  }
}
```

### Introduction Message
```javascript
{
  type: "system",
  payload: {
    action: "introduce",
    introducee: {
      id: "peer-def456",
      publicKey: "base64-encoded",
      fingerprint: "5678:9abc:...",
      profile: { ... }
    },
    endorsement: "I vouch for this peer"
  },
  signature: {
    // Introducer's signature
  }
}
```

### Trust Update Message
```javascript
{
  type: "system",
  payload: {
    action: "trustUpdate",
    peerId: "peer-def456",
    trustLevel: "full",
    verified: true,
    verifiedMethod: "video-call"
  },
  signature: { ... }
}
```

## Implementation Phases

### Phase 1: Core Identity (Current)
- Generate keypairs
- Create PeerIdentity class
- Store in localStorage
- Display identity in UI

### Phase 2: Message Signing
- Sign all outgoing messages
- Verify all incoming messages
- Show verification status in UI

### Phase 3: Trust Management
- Trust levels
- Manual trust assignment
- Trust UI

### Phase 4: Advanced Features
- Key export/import
- Introduction messages
- Trust chains
- Fingerprint QR codes

## Future Enhancements

- **Encryption**: End-to-end message encryption
- **Key Rotation**: Generate new keys, revoke old
- **Multi-Device**: Sync identity across devices
- **Hardware Keys**: WebAuthn integration
- **Revocation**: Publish key revocation certificates
- **Key Server**: Optional public key directory

---

**Next**: Implement `identity.js` with PeerIdentity class
