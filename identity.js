/**
 * P2P Identity System
 * 
 * PGP-inspired cryptographic identity system using Web Crypto API.
 * Provides keypair management, message signing, and trust management.
 */

// ============================================================================
// Constants
// ============================================================================

const TRUST_LEVELS = {
    UNKNOWN: 'unknown',
    UNTRUSTED: 'untrusted',
    MARGINAL: 'marginal',
    FULL: 'full'
};

const VERIFICATION_METHODS = {
    NONE: 'none',
    CODE: 'code',           // Compared fingerprint via copy-paste
    VIDEO: 'video',         // Video call verification
    IN_PERSON: 'in-person', // Face-to-face verification
    CHAIN: 'chain'          // Verified through trust chain
};

const IDENTITY_VERSION = '1.0.0';

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert ArrayBuffer to base64 string
 */
function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
 * Convert base64 string to ArrayBuffer
 */
function base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

/**
 * Generate SHA-256 hash
 */
async function sha256(data) {
    const encoder = new TextEncoder();
    const dataBytes = typeof data === 'string' ? encoder.encode(data) : data;
    return await crypto.subtle.digest('SHA-256', dataBytes);
}

/**
 * Format fingerprint as colon-separated hex (PGP style)
 */
function formatFingerprint(hashBuffer, short = false) {
    const bytes = new Uint8Array(hashBuffer);
    const hex = Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join(':');
    
    if (short) {
        // Return first 8 bytes (16 hex chars) like "ab:cd:ef:01:23:45:67:89"
        return hex.split(':').slice(0, 8).join(':');
    }
    
    return hex;
}

/**
 * Generate short key ID from public key (last 8 hex chars)
 */
async function generateKeyId(publicKeyBytes) {
    const hash = await sha256(publicKeyBytes);
    const bytes = new Uint8Array(hash);
    const hex = Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    
    // Return last 8 characters (like PGP short key ID)
    return hex.slice(-8).toUpperCase();
}

/**
 * Generate peer ID from public key
 */
async function generatePeerId(publicKeyBytes) {
    const hash = await sha256(publicKeyBytes);
    const bytes = new Uint8Array(hash);
    const hex = Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    
    // Return 'peer-' + first 8 hex chars
    return 'peer-' + hex.slice(0, 8);
}

// ============================================================================
// PeerIdentity Class
// ============================================================================

class PeerIdentity {
    constructor(data) {
        this.id = data.id;
        this.publicKey = data.publicKey;
        this.privateKey = data.privateKey || null;
        this.fingerprint = data.fingerprint;
        this.keyId = data.keyId;
        this.created = data.created || Date.now();
        
        this.profile = data.profile || {
            name: 'Anonymous',
            email: null,
            avatar: null,
            bio: null
        };
        
        this.capabilities = data.capabilities || ['text', 'file', 'data'];
        this.version = data.version || IDENTITY_VERSION;
        this.protocolVersion = data.protocolVersion || '1.0';
    }

    /**
     * Generate a new identity with keypair
     */
    static async generate(profile = {}) {
        console.log('Generating new identity...');
        
        // Generate Ed25519 keypair
        const keypair = await crypto.subtle.generateKey(
            {
                name: 'Ed25519'
            },
            true,  // extractable
            ['sign', 'verify']
        );

        // Export keys
        const publicKeyBytes = await crypto.subtle.exportKey('spki', keypair.publicKey);
        const privateKeyBytes = await crypto.subtle.exportKey('pkcs8', keypair.privateKey);

        // Convert to base64
        const publicKeyB64 = arrayBufferToBase64(publicKeyBytes);
        const privateKeyB64 = arrayBufferToBase64(privateKeyBytes);

        // Generate fingerprint (SHA-256 of public key)
        const fingerprintHash = await sha256(publicKeyBytes);
        const fingerprint = formatFingerprint(fingerprintHash, true);

        // Generate key ID and peer ID
        const keyId = await generateKeyId(publicKeyBytes);
        const peerId = await generatePeerId(publicKeyBytes);

        console.log('Identity generated:', {
            peerId,
            keyId,
            fingerprint: fingerprint.split(':').slice(0, 4).join(':') + ':...'
        });

        return new PeerIdentity({
            id: peerId,
            publicKey: publicKeyB64,
            privateKey: privateKeyB64,
            fingerprint,
            keyId,
            created: Date.now(),
            profile: {
                name: profile.name || 'Anonymous',
                email: profile.email || null,
                avatar: profile.avatar || null,
                bio: profile.bio || null
            },
            capabilities: profile.capabilities || ['text', 'file', 'data'],
            version: IDENTITY_VERSION,
            protocolVersion: '1.0'
        });
    }

    /**
     * Import CryptoKey objects for signing/verification
     */
    async getSigningKey() {
        if (!this.privateKey) {
            throw new Error('No private key available (not owner)');
        }

        const keyBytes = base64ToArrayBuffer(this.privateKey);
        return await crypto.subtle.importKey(
            'pkcs8',
            keyBytes,
            { name: 'Ed25519' },
            false,
            ['sign']
        );
    }

    async getVerificationKey() {
        const keyBytes = base64ToArrayBuffer(this.publicKey);
        return await crypto.subtle.importKey(
            'spki',
            keyBytes,
            { name: 'Ed25519' },
            false,
            ['verify']
        );
    }

    /**
     * Sign data with private key
     */
    async sign(data) {
        if (!this.privateKey) {
            throw new Error('Cannot sign without private key');
        }

        const signingKey = await this.getSigningKey();
        const encoder = new TextEncoder();
        const dataBytes = typeof data === 'string' ? encoder.encode(data) : data;
        
        const signature = await crypto.subtle.sign(
            'Ed25519',
            signingKey,
            dataBytes
        );

        return arrayBufferToBase64(signature);
    }

    /**
     * Verify signature on data
     */
    async verify(data, signatureB64) {
        const verificationKey = await this.getVerificationKey();
        const encoder = new TextEncoder();
        const dataBytes = typeof data === 'string' ? encoder.encode(data) : data;
        const signatureBytes = base64ToArrayBuffer(signatureB64);
        
        return await crypto.subtle.verify(
            'Ed25519',
            verificationKey,
            signatureBytes,
            dataBytes
        );
    }

    /**
     * Update profile information
     */
    updateProfile(updates) {
        this.profile = { ...this.profile, ...updates };
    }

    /**
     * Get public information (safe to share)
     */
    getPublicInfo() {
        return {
            id: this.id,
            publicKey: this.publicKey,
            fingerprint: this.fingerprint,
            keyId: this.keyId,
            created: this.created,
            profile: { ...this.profile },
            capabilities: [...this.capabilities],
            version: this.version,
            protocolVersion: this.protocolVersion
        };
    }

    /**
     * Serialize for storage
     */
    toJSON() {
        return {
            id: this.id,
            publicKey: this.publicKey,
            privateKey: this.privateKey,
            fingerprint: this.fingerprint,
            keyId: this.keyId,
            created: this.created,
            profile: this.profile,
            capabilities: this.capabilities,
            version: this.version,
            protocolVersion: this.protocolVersion
        };
    }

    /**
     * Deserialize from storage
     */
    static fromJSON(json) {
        return new PeerIdentity(json);
    }

    /**
     * Export identity (including private key)
     */
    exportIdentity() {
        return {
            'lp2p-identity-export': {
                version: '1.0',
                exported: Date.now(),
                identity: this.toJSON()
            }
        };
    }

    /**
     * Import identity from export
     */
    static importIdentity(exportData) {
        if (!exportData['lp2p-identity-export']) {
            throw new Error('Invalid identity export format');
        }

        const data = exportData['lp2p-identity-export'];
        
        if (data.version !== '1.0') {
            throw new Error('Unsupported identity export version');
        }

        return PeerIdentity.fromJSON(data.identity);
    }

    /**
     * Check if this is our own identity (has private key)
     */
    isOwn() {
        return this.privateKey !== null;
    }
}

// ============================================================================
// TrustRecord Class
// ============================================================================

class TrustRecord {
    constructor(data) {
        this.peerId = data.peerId;
        this.publicKey = data.publicKey;
        this.fingerprint = data.fingerprint;
        this.keyId = data.keyId;
        
        this.trustLevel = data.trustLevel || TRUST_LEVELS.UNKNOWN;
        this.trustedBy = data.trustedBy;
        this.trustedAt = data.trustedAt || Date.now();
        
        this.verified = data.verified || false;
        this.verifiedMethod = data.verifiedMethod || VERIFICATION_METHODS.NONE;
        this.verifiedAt = data.verifiedAt || null;
        
        this.profile = data.profile || { name: 'Unknown' };
        
        this.introducedBy = data.introducedBy || null;
        this.signatures = data.signatures || [];
        
        this.notes = data.notes || '';
    }

    /**
     * Update trust level
     */
    setTrust(level, verifiedMethod = null) {
        this.trustLevel = level;
        this.trustedAt = Date.now();
        
        if (verifiedMethod) {
            this.verified = true;
            this.verifiedMethod = verifiedMethod;
            this.verifiedAt = Date.now();
        }
    }

    /**
     * Add an endorsement signature
     */
    addSignature(signedBy, signature) {
        this.signatures.push({
            signedBy,
            signature,
            timestamp: Date.now()
        });
    }

    /**
     * Serialize for storage
     */
    toJSON() {
        return {
            peerId: this.peerId,
            publicKey: this.publicKey,
            fingerprint: this.fingerprint,
            keyId: this.keyId,
            trustLevel: this.trustLevel,
            trustedBy: this.trustedBy,
            trustedAt: this.trustedAt,
            verified: this.verified,
            verifiedMethod: this.verifiedMethod,
            verifiedAt: this.verifiedAt,
            profile: this.profile,
            introducedBy: this.introducedBy,
            signatures: this.signatures,
            notes: this.notes
        };
    }

    /**
     * Deserialize from storage
     */
    static fromJSON(json) {
        return new TrustRecord(json);
    }
}

// ============================================================================
// IdentityManager Class
// ============================================================================

class IdentityManager {
    constructor() {
        this.ownIdentity = null;
        this.knownPeers = new Map();  // peerId -> TrustRecord
        this.storageKey = 'lp2p.identity';
        this.peersStorageKey = 'lp2p.knownPeers';
    }

    /**
     * Initialize - load or create identity
     */
    async initialize(profile = {}) {
        console.log('Initializing identity manager...');
        
        // Try to load existing identity
        const loaded = await this.load();
        
        if (!loaded) {
            // Generate new identity
            console.log('No existing identity found, generating new one');
            this.ownIdentity = await PeerIdentity.generate({
                name: profile.name || 'User-' + Math.random().toString(36).substring(2, 8),
                email: profile.email,
                avatar: profile.avatar,
                bio: profile.bio
            });
            await this.save();
        }
        
        console.log('Identity manager initialized:', {
            id: this.ownIdentity.id,
            keyId: this.ownIdentity.keyId,
            name: this.ownIdentity.profile.name
        });
        
        return this.ownIdentity;
    }

    /**
     * Load identity from localStorage
     */
    async load() {
        try {
            const identityData = localStorage.getItem(this.storageKey);
            if (identityData) {
                this.ownIdentity = PeerIdentity.fromJSON(JSON.parse(identityData));
                console.log('Loaded existing identity:', this.ownIdentity.id);
            }
            
            const peersData = localStorage.getItem(this.peersStorageKey);
            if (peersData) {
                const peers = JSON.parse(peersData);
                this.knownPeers.clear();
                for (const [peerId, record] of Object.entries(peers)) {
                    this.knownPeers.set(peerId, TrustRecord.fromJSON(record));
                }
                console.log('Loaded', this.knownPeers.size, 'known peers');
            }
            
            return this.ownIdentity !== null;
        } catch (error) {
            console.error('Error loading identity:', error);
            return false;
        }
    }

    /**
     * Save identity to localStorage
     */
    async save() {
        try {
            if (this.ownIdentity) {
                localStorage.setItem(this.storageKey, JSON.stringify(this.ownIdentity.toJSON()));
            }
            
            const peersObj = {};
            for (const [peerId, record] of this.knownPeers.entries()) {
                peersObj[peerId] = record.toJSON();
            }
            localStorage.setItem(this.peersStorageKey, JSON.stringify(peersObj));
            
            console.log('Identity saved to localStorage');
        } catch (error) {
            console.error('Error saving identity:', error);
        }
    }

    /**
     * Get our own identity
     */
    getOwnIdentity() {
        return this.ownIdentity;
    }

    /**
     * Update our profile
     */
    async updateProfile(updates) {
        if (this.ownIdentity) {
            this.ownIdentity.updateProfile(updates);
            await this.save();
        }
    }

    /**
     * Add or update a known peer
     */
    async addPeer(peerInfo, introducedBy = null) {
        const existing = this.knownPeers.get(peerInfo.id);
        
        if (existing) {
            // Update existing peer info
            existing.profile = peerInfo.profile || existing.profile;
            existing.publicKey = peerInfo.publicKey || existing.publicKey;
        } else {
            // Create new trust record
            const record = new TrustRecord({
                peerId: peerInfo.id,
                publicKey: peerInfo.publicKey,
                fingerprint: peerInfo.fingerprint,
                keyId: peerInfo.keyId,
                trustLevel: TRUST_LEVELS.UNKNOWN,
                trustedBy: this.ownIdentity.id,
                profile: peerInfo.profile || { name: peerInfo.id },
                introducedBy
            });
            
            this.knownPeers.set(peerInfo.id, record);
        }
        
        await this.save();
        return this.knownPeers.get(peerInfo.id);
    }

    /**
     * Get a known peer
     */
    getPeer(peerId) {
        return this.knownPeers.get(peerId);
    }

    /**
     * Get all known peers
     */
    getAllPeers() {
        return Array.from(this.knownPeers.values());
    }

    /**
     * Set trust level for a peer
     */
    async setTrust(peerId, level, verifiedMethod = null) {
        const peer = this.knownPeers.get(peerId);
        if (peer) {
            peer.setTrust(level, verifiedMethod);
            await this.save();
        }
    }

    /**
     * Export own identity
     */
    exportIdentity() {
        if (!this.ownIdentity) {
            throw new Error('No identity to export');
        }
        return this.ownIdentity.exportIdentity();
    }

    /**
     * Import identity (replaces current)
     */
    async importIdentity(exportData) {
        this.ownIdentity = PeerIdentity.importIdentity(exportData);
        await this.save();
        return this.ownIdentity;
    }

    /**
     * Export known peers list
     */
    exportKnownPeers() {
        return {
            'lp2p-peers-export': {
                version: '1.0',
                exported: Date.now(),
                peers: Array.from(this.knownPeers.values()).map(p => p.toJSON())
            }
        };
    }

    /**
     * Import known peers list (merge with existing)
     */
    async importKnownPeers(exportData) {
        if (!exportData['lp2p-peers-export']) {
            throw new Error('Invalid peers export format');
        }

        const data = exportData['lp2p-peers-export'];
        
        for (const peerData of data.peers) {
            const record = TrustRecord.fromJSON(peerData);
            this.knownPeers.set(record.peerId, record);
        }
        
        await this.save();
    }

    /**
     * Clear all data (for testing)
     */
    async clear() {
        this.ownIdentity = null;
        this.knownPeers.clear();
        localStorage.removeItem(this.storageKey);
        localStorage.removeItem(this.peersStorageKey);
    }
}

// ============================================================================
// Exports
// ============================================================================

if (typeof window !== 'undefined') {
    window.LP2PIdentity = {
        // Constants
        TRUST_LEVELS,
        VERIFICATION_METHODS,
        IDENTITY_VERSION,
        
        // Classes
        PeerIdentity,
        TrustRecord,
        IdentityManager,
        
        // Utilities
        formatFingerprint,
        arrayBufferToBase64,
        base64ToArrayBuffer
    };
}
