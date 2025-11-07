/**
 * Local P2P Message Protocol Implementation v1.0
 * 
 * Provides structured message handling for P2P communication including
 * validation, serialization, and type-safe message creation.
 */

// ============================================================================
// Constants
// ============================================================================

const PROTOCOL = {
    NAME: 'lp2p',
    VERSION: '1.0'
};

const MESSAGE_TYPES = {
    TEXT: 'text',
    FILE: 'file',
    DATA: 'data',
    SYSTEM: 'system',
    CONTROL: 'control'
};

const FILE_ACTIONS = {
    OFFER: 'offer',
    ACCEPT: 'accept',
    REJECT: 'reject',
    CHUNK: 'chunk',
    CANCEL: 'cancel',
    COMPLETE: 'complete'
};

const SYSTEM_ACTIONS = {
    HELLO: 'hello',
    GOODBYE: 'goodbye',
    PING: 'ping',
    PONG: 'pong',
    LIST_PEERS: 'listPeers',
    PEER_LIST: 'peerList',
    ERROR: 'error',
    INTRODUCE: 'introduce', // Introduce a peer to another peer (host-mediated)
    ROOM_ANNOUNCE: 'roomAnnounce' // Announce a room's minimal metadata to peers
};

const CONTROL_ACTIONS = {
    TYPING: 'typing',
    READ: 'read',
    FOCUS: 'focus',
    AWAY: 'away'
};

const ERROR_CODES = {
    INVALID_FORMAT: 'INVALID_FORMAT',
    UNSUPPORTED_TYPE: 'UNSUPPORTED_TYPE',
    UNSUPPORTED_VERSION: 'UNSUPPORTED_VERSION',
    VALIDATION_FAILED: 'VALIDATION_FAILED',
    TOO_LARGE: 'TOO_LARGE',
    RATE_LIMIT: 'RATE_LIMIT',
    UNAUTHORIZED: 'UNAUTHORIZED'
};

const LIMITS = {
    MAX_MESSAGE_SIZE: 10 * 1024 * 1024,  // 10MB
    MAX_TEXT_SIZE: 64 * 1024,             // 64KB
    MAX_CHUNK_SIZE: 16 * 1024,            // 16KB
    MAX_DATA_SIZE: 1024 * 1024,           // 1MB
    PEER_ID_MIN: 3,
    PEER_ID_MAX: 64,
    TIME_TOLERANCE: 5 * 60 * 1000         // 5 minutes
};

// ============================================================================
// Message Class
// ============================================================================

class Message {
    constructor(type, from, to, payload, options = {}) {
        this.protocol = PROTOCOL.NAME;
        this.version = PROTOCOL.VERSION;
        this.id = options.id || crypto.randomUUID();
        this.type = type;
        this.from = from;
        this.to = to;
        this.timestamp = options.timestamp || Date.now();
        this.payload = payload || {};
        
        if (options.replyTo) {
            this.replyTo = options.replyTo;
        }
        
        if (options.metadata) {
            this.metadata = options.metadata;
        }
        
        if (options.signature) {
            this.signature = options.signature;
        }
    }

    /**
     * Serialize message to JSON string for transmission
     */
    serialize() {
        return JSON.stringify(this);
    }

    /**
     * Get message size in bytes
     */
    size() {
        return new Blob([this.serialize()]).size;
    }

    /**
     * Create a copy of this message
     */
    clone() {
        return Message.deserialize(this.serialize());
    }

    /**
     * Deserialize JSON string to Message object
     */
    static deserialize(json) {
        const data = typeof json === 'string' ? JSON.parse(json) : json;
        
        const message = new Message(
            data.type,
            data.from,
            data.to,
            data.payload,
            {
                id: data.id,
                timestamp: data.timestamp,
                replyTo: data.replyTo,
                metadata: data.metadata,
                signature: data.signature
            }
        );
        
        message.protocol = data.protocol;
        message.version = data.version;
        
        return message;
    }
}

// ============================================================================
// Message Validator
// ============================================================================

class MessageValidator {
    /**
     * Validate a message object
     */
    static validate(message) {
        const errors = [];

        // Structural validation
        errors.push(...this.validateStructure(message));
        if (errors.length > 0) {
            return { valid: false, errors };
        }

        // Type validation
        errors.push(...this.validateTypes(message));
        
        // Semantic validation
        errors.push(...this.validateSemantics(message));
        
        // Payload validation
        errors.push(...this.validatePayload(message));
        
        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Validate message structure
     */
    static validateStructure(message) {
        const errors = [];
        const required = ['protocol', 'version', 'id', 'type', 'from', 'to', 'timestamp', 'payload'];
        
        for (const field of required) {
            if (!(field in message)) {
                errors.push(`Missing required field: ${field}`);
            }
        }
        
        return errors;
    }

    /**
     * Validate field types
     */
    static validateTypes(message) {
        const errors = [];
        
        // Protocol
        if (typeof message.protocol !== 'string') {
            errors.push('protocol must be a string');
        } else if (message.protocol !== PROTOCOL.NAME) {
            errors.push(`Invalid protocol: ${message.protocol}`);
        }
        
        // Version
        if (typeof message.version !== 'string') {
            errors.push('version must be a string');
        } else if (!message.version.match(/^\d+\.\d+(\.\d+)?$/)) {
            errors.push('version must be in semver format');
        }
        
        // ID
        if (typeof message.id !== 'string') {
            errors.push('id must be a string');
        } else if (!message.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
            errors.push('id must be a valid UUID v4');
        }
        
        // Type
        if (typeof message.type !== 'string') {
            errors.push('type must be a string');
        } else if (!Object.values(MESSAGE_TYPES).includes(message.type)) {
            errors.push(`Unknown message type: ${message.type}`);
        }
        
        // From
        if (typeof message.from !== 'string') {
            errors.push('from must be a string');
        } else if (message.from.length < LIMITS.PEER_ID_MIN || message.from.length > LIMITS.PEER_ID_MAX) {
            errors.push(`from length must be between ${LIMITS.PEER_ID_MIN} and ${LIMITS.PEER_ID_MAX}`);
        }
        
        // To
        if (typeof message.to !== 'string') {
            errors.push('to must be a string');
        } else if (message.to !== '*' && (message.to.length < LIMITS.PEER_ID_MIN || message.to.length > LIMITS.PEER_ID_MAX)) {
            errors.push(`to must be '*' or length between ${LIMITS.PEER_ID_MIN} and ${LIMITS.PEER_ID_MAX}`);
        }
        
        // Timestamp
        if (typeof message.timestamp !== 'number') {
            errors.push('timestamp must be a number');
        } else if (message.timestamp < 0) {
            errors.push('timestamp must be positive');
        }
        
        // Payload
        if (typeof message.payload !== 'object' || message.payload === null) {
            errors.push('payload must be an object');
        }
        
        // Optional: replyTo
        if (message.replyTo !== undefined && typeof message.replyTo !== 'string') {
            errors.push('replyTo must be a string');
        }
        
        // Optional: metadata
        if (message.metadata !== undefined && typeof message.metadata !== 'object') {
            errors.push('metadata must be an object');
        }
        
        return errors;
    }

    /**
     * Validate semantic rules
     */
    static validateSemantics(message) {
        const errors = [];
        
        // Timestamp should be reasonable (within ±5 minutes)
        const now = Date.now();
        const timeDiff = Math.abs(now - message.timestamp);
        if (timeDiff > LIMITS.TIME_TOLERANCE) {
            errors.push(`timestamp too far from current time: ${timeDiff}ms`);
        }
        
        // Message size check
        const size = new Blob([JSON.stringify(message)]).size;
        if (size > LIMITS.MAX_MESSAGE_SIZE) {
            errors.push(`Message too large: ${size} bytes (max ${LIMITS.MAX_MESSAGE_SIZE})`);
        }
        
        return errors;
    }

    /**
     * Validate payload based on message type
     */
    static validatePayload(message) {
        const errors = [];
        
        switch (message.type) {
            case MESSAGE_TYPES.TEXT:
                errors.push(...this.validateTextPayload(message.payload));
                break;
            case MESSAGE_TYPES.FILE:
                errors.push(...this.validateFilePayload(message.payload));
                break;
            case MESSAGE_TYPES.DATA:
                errors.push(...this.validateDataPayload(message.payload));
                break;
            case MESSAGE_TYPES.SYSTEM:
                errors.push(...this.validateSystemPayload(message.payload));
                break;
            case MESSAGE_TYPES.CONTROL:
                errors.push(...this.validateControlPayload(message.payload));
                break;
        }
        
        return errors;
    }

    static validateTextPayload(payload) {
        const errors = [];
        
        if (!payload.text) {
            errors.push('text payload must have text field');
        } else if (typeof payload.text !== 'string') {
            errors.push('text must be a string');
        } else if (payload.text.length > LIMITS.MAX_TEXT_SIZE) {
            errors.push(`text too large: ${payload.text.length} bytes`);
        }
        
        if (payload.format && !['plain', 'markdown', 'html'].includes(payload.format)) {
            errors.push(`Invalid format: ${payload.format}`);
        }
        
        return errors;
    }

    static validateFilePayload(payload) {
        const errors = [];
        
        if (!payload.action) {
            errors.push('file payload must have action field');
        } else if (!Object.values(FILE_ACTIONS).includes(payload.action)) {
            errors.push(`Invalid file action: ${payload.action}`);
        }
        
        if (!payload.fileId) {
            errors.push('file payload must have fileId');
        }
        
        // Action-specific validation
        if (payload.action === FILE_ACTIONS.OFFER) {
            if (!payload.name) errors.push('file offer must have name');
            if (!payload.size || payload.size <= 0) errors.push('file offer must have valid size');
            if (!payload.mimeType) errors.push('file offer must have mimeType');
        }
        
        if (payload.action === FILE_ACTIONS.CHUNK) {
            if (payload.chunkIndex === undefined) errors.push('file chunk must have chunkIndex');
            if (!payload.data) errors.push('file chunk must have data');
        }
        
        return errors;
    }

    static validateDataPayload(payload) {
        const errors = [];
        
        if (!payload.dataType) {
            errors.push('data payload must have dataType field');
        }
        
        if (!payload.schema) {
            errors.push('data payload must have schema field');
        }
        
        if (!payload.content) {
            errors.push('data payload must have content field');
        }
        
        return errors;
    }

    static validateSystemPayload(payload) {
        const errors = [];
        
        if (!payload.action) {
            errors.push('system payload must have action field');
        } else if (!Object.values(SYSTEM_ACTIONS).includes(payload.action)) {
            errors.push(`Invalid system action: ${payload.action}`);
        }
        
        return errors;
    }

    static validateControlPayload(payload) {
        const errors = [];
        
        if (!payload.action) {
            errors.push('control payload must have action field');
        } else if (!Object.values(CONTROL_ACTIONS).includes(payload.action)) {
            errors.push(`Invalid control action: ${payload.action}`);
        }
        
        return errors;
    }
}

// ============================================================================
// Message Factory
// ============================================================================

class MessageFactory {
    /**
     * Create a text message
     */
    static createText(from, to, text, format = 'plain') {
        return new Message(MESSAGE_TYPES.TEXT, from, to, {
            text,
            format
        });
    }

    /**
     * Create a file offer message
     */
    static createFileOffer(from, to, fileInfo) {
        return new Message(MESSAGE_TYPES.FILE, from, to, {
            action: FILE_ACTIONS.OFFER,
            fileId: fileInfo.fileId || crypto.randomUUID(),
            name: fileInfo.name,
            size: fileInfo.size,
            mimeType: fileInfo.mimeType,
            chunkSize: fileInfo.chunkSize || LIMITS.MAX_CHUNK_SIZE,
            totalChunks: Math.ceil(fileInfo.size / (fileInfo.chunkSize || LIMITS.MAX_CHUNK_SIZE)),
            hash: fileInfo.hash
        });
    }

    /**
     * Create a file chunk message
     */
    static createFileChunk(from, to, fileId, chunkIndex, data, isLast = false) {
        return new Message(MESSAGE_TYPES.FILE, from, to, {
            action: FILE_ACTIONS.CHUNK,
            fileId,
            chunkIndex,
            data,
            isLast
        });
    }

    /**
     * Create a file control message (accept/reject/cancel/complete)
     */
    static createFileControl(from, to, action, fileId, reason = null) {
        const payload = {
            action,
            fileId
        };
        
        if (reason) {
            payload.reason = reason;
        }
        
        return new Message(MESSAGE_TYPES.FILE, from, to, payload);
    }

    /**
     * Create a structured data message
     */
    static createData(from, to, dataType, schema, content) {
        return new Message(MESSAGE_TYPES.DATA, from, to, {
            dataType,
            schema,
            content
        });
    }

    /**
     * Create a hello (peer introduction) message
     */
    static createHello(from, peerInfo) {
        return new Message(MESSAGE_TYPES.SYSTEM, from, '*', {
            action: SYSTEM_ACTIONS.HELLO,
            peerInfo
        });
    }

    /**
     * Create a room announce message (share minimal room metadata)
     */
    static createRoomAnnounce(from, room) {
        return new Message(MESSAGE_TYPES.SYSTEM, from, '*', {
            action: SYSTEM_ACTIONS.ROOM_ANNOUNCE,
            room
        });
    }

    /**
     * Create an introduction message (host tells one peer about another)
     */
    static createIntroduce(from, to, peerInfo) {
        return new Message(MESSAGE_TYPES.SYSTEM, from, to, {
            action: SYSTEM_ACTIONS.INTRODUCE,
            peerInfo
        });
    }

    /**
     * Create a goodbye message
     */
    static createGoodbye(from, reason = null) {
        const payload = { action: SYSTEM_ACTIONS.GOODBYE };
        if (reason) payload.reason = reason;
        return new Message(MESSAGE_TYPES.SYSTEM, from, '*', payload);
    }

    /**
     * Create a ping message
     */
    static createPing(from, to) {
        return new Message(MESSAGE_TYPES.SYSTEM, from, to, {
            action: SYSTEM_ACTIONS.PING
        });
    }

    /**
     * Create a pong message (reply to ping)
     */
    static createPong(from, to, pingId) {
        return new Message(MESSAGE_TYPES.SYSTEM, from, to, {
            action: SYSTEM_ACTIONS.PONG
        }, { replyTo: pingId });
    }

    /**
     * Create an error message
     */
    static createError(from, to, code, message, details = null, replyTo = null) {
        const payload = {
            action: SYSTEM_ACTIONS.ERROR,
            code,
            message
        };
        
        if (details) payload.details = details;
        
        const options = {};
        if (replyTo) options.replyTo = replyTo;
        
        return new Message(MESSAGE_TYPES.SYSTEM, from, to, payload, options);
    }

    /**
     * Create a typing indicator message
     */
    static createTyping(from, to, active = true) {
        return new Message(MESSAGE_TYPES.CONTROL, from, to, {
            action: CONTROL_ACTIONS.TYPING,
            active
        });
    }

    /**
     * Create a read receipt message
     */
    static createReadReceipt(from, to, messageId) {
        return new Message(MESSAGE_TYPES.CONTROL, from, to, {
            action: CONTROL_ACTIONS.READ
        }, { replyTo: messageId });
    }
}

// ============================================================================
// Message Handler Registry
// ============================================================================

class MessageHandler {
    constructor() {
        this.handlers = new Map();
    }

    /**
     * Register a handler for a message type
     */
    register(type, handler) {
        if (!this.handlers.has(type)) {
            this.handlers.set(type, []);
        }
        this.handlers.get(type).push(handler);
    }

    /**
     * Register a handler for a specific message type and action
     */
    registerAction(type, action, handler) {
        this.register(type, (message) => {
            if (message.payload.action === action) {
                handler(message);
            }
        });
    }

    /**
     * Handle an incoming message
     */
    async handle(message) {
        // Validate first
        const validation = MessageValidator.validate(message);
        if (!validation.valid) {
            console.error('Message validation failed:', validation.errors);
            throw new Error(`Invalid message: ${validation.errors.join(', ')}`);
        }

        // Call all registered handlers for this type
        const handlers = this.handlers.get(message.type) || [];
        const promises = handlers.map(handler => {
            try {
                return Promise.resolve(handler(message));
            } catch (error) {
                console.error(`Handler error for ${message.type}:`, error);
                return Promise.reject(error);
            }
        });

        await Promise.allSettled(promises);
    }

    /**
     * Clear all handlers
     */
    clear() {
        this.handlers.clear();
    }

    /**
     * Remove handlers for a specific type
     */
    clearType(type) {
        this.handlers.delete(type);
    }
}

// ====================================================================
// Message Protocol Handlers
// ====================================================================

/**
 * Initialize message handlers
 */
function initMessageHandlers() {
    messageHandler = new LP2P.MessageHandler();
    
    // Handle text messages
    messageHandler.register(LP2P.MESSAGE_TYPES.TEXT, (message) => {
        console.log('Handling text message:', message);
        
        // Add verification indicator if message was signed
        let displayText = message.payload.text;
        if (message.signature !== undefined) {
            const icon = message.signatureValid ? '✓' : '⚠';
            displayText = `${icon} ${displayText}`;
        }
        
        addMessage(displayText, false, message.id, message.from);
    });
    
    // Handle system messages
    messageHandler.registerAction(LP2P.MESSAGE_TYPES.SYSTEM, LP2P.SYSTEM_ACTIONS.HELLO, async (message) => {
        console.log('Peer introduced:', message.payload.peerInfo);
        remotePeerId = message.from;
        // Map to a connection without peerId yet
        for (const [cid, conn] of connections.entries()) {
            if (!conn.peerId && conn.dc && conn.dc.readyState === 'open') {
                conn.peerId = message.from;
                console.log('Associated connection', cid, 'with peer', conn.peerId);
                break;
            }
        }
        
        const peerInfo = message.payload.peerInfo;
        const peerName = peerInfo.profile?.name || peerInfo.name || message.from;
        
        // Add peer to known peers if we have their public key
        if (peerInfo.publicKey) {
            // Determine if this is a brand new peer (not previously known)
            const existingRecord = identityManager.getPeer(peerInfo.id);
            const trustRecord = await identityManager.addPeer(peerInfo);
            
            // Only set to unknown if this is a brand new peer; preserve existing trust if known
            if (!existingRecord) {
                // New peer: initialize trust level (already UNKNOWN by default, but we persist timestamp)
                await identityManager.setTrust(peerInfo.id, 'unknown');
            } else {
                console.log('Peer already known, preserving trust level:', existingRecord.trustLevel);
            }
            
            console.log('Added peer with fingerprint:', trustRecord.fingerprint);
            
            // Display peer info panel
            displayPeerInfo();

            // Get connection for this peer
            const newcomerConn = getConnectionByPeerId(peerInfo.id);
            
            // Host introduces itself to the newcomer
            if (newcomerConn && newcomerConn.dc && newcomerConn.dc.readyState === 'open') {
                const hostInfo = ownIdentity.getPublicInfo();
                const introSelf = LP2P.MessageFactory.createIntroduce(peerId, peerInfo.id, hostInfo);
                newcomerConn.dc.send(introSelf.serialize());
                console.log('Host introduced itself to newcomer');
            }

            // Host-mediated introductions: inform existing peers & newcomer about each other
            if (connections.size > 1) {
                const newPeerInfo = peerInfo;
                // Send newcomer info to others
                for (const [cid, conn] of connections.entries()) {
                    if (conn.peerId && conn.peerId !== newPeerInfo.id && conn.dc && conn.dc.readyState === 'open') {
                        const introMsg = LP2P.MessageFactory.createIntroduce(peerId, conn.peerId, newPeerInfo);
                        conn.dc.send(introMsg.serialize());
                    }
                }
                // Send existing peers info to newcomer
                if (newcomerConn && newcomerConn.dc && newcomerConn.dc.readyState === 'open') {
                    for (const record of identityManager.getAllPeers()) {
                        if (record.peerId !== newPeerInfo.id) {
                            const existingInfo = buildPeerInfo(record);
                            const introBack = LP2P.MessageFactory.createIntroduce(peerId, newPeerInfo.id, existingInfo);
                            newcomerConn.dc.send(introBack.serialize());
                        }
                    }
                }
            }
            
            // Show signature verification status
            if (message.signatureValid) {
                addSystemMessage(`✓ ${peerName} connected (verified)`);
            } else {
                addSystemMessage(`⚠ ${peerName} connected (unverified)`);
            }
        } else {
            addSystemMessage(`${peerName} connected`);
        }
        
        updateStatus('connected', `Connected to ${peerName}`);
        updatePeerRoster(); // Update roster when peer connects
    });

    // Handle introduction messages (host-mediated peer discovery)
    messageHandler.registerAction(LP2P.MESSAGE_TYPES.SYSTEM, LP2P.SYSTEM_ACTIONS.INTRODUCE, async (message) => {
        const info = message.payload.peerInfo;
        if (!info || !info.id) return;
        
        console.log('Received INTRODUCE for peer:', info.id, 'with profile:', info.profile);
        
        // Associate connection with this peer if not already done
        for (const [cid, conn] of connections.entries()) {
            if (!conn.peerId && conn.dc && conn.dc.readyState === 'open') {
                conn.peerId = info.id;
                console.log('Associated connection', cid, 'with introduced peer', info.id);
                break;
            }
        }
        
        const existing = identityManager.getPeer(info.id);
        if (!existing) {
            const trustRecord = await identityManager.addPeer(info);
            console.log('Added peer from INTRODUCE:', trustRecord);
            addSystemMessage(`👥 Introduced to peer ${info.profile?.name || info.id}`);
        } else {
            console.log('Peer already known from INTRODUCE:', info.id);
        }
        updatePeerRoster(); // Update roster when peer introduced
    });

        // Handle room announcements from peers (learn about channels)
        messageHandler.registerAction(LP2P.MESSAGE_TYPES.SYSTEM, LP2P.SYSTEM_ACTIONS.ROOM_ANNOUNCE, async (message) => {
            try {
                const room = message.payload.room;
                if (!room || !room.code) return;

                if (typeof window !== 'undefined' && window.LP2PRoomStore) {
                    const existing = await window.LP2PRoomStore.getRoom(room.code);
                    let shouldPut = false;
                    if (!existing) {
                        shouldPut = true;
                    } else {
                        const incomingVer = room.version || 0;
                        const existingVer = existing.version || 0;
                        if (incomingVer > existingVer) shouldPut = true;
                        else if (incomingVer === existingVer && (room.lastActive || 0) > (existing.lastActive || 0)) shouldPut = true;
                    }

                    if (shouldPut) {
                        const rec = Object.assign({
                            code: room.code,
                            name: room.name || room.code,
                            creator: room.creator || message.from,
                            createdAt: room.createdAt || Date.now(),
                            lastActive: room.lastActive || Date.now(),
                            capacity: room.capacity || 0,
                            privacy: room.privacy || 'invite',
                            version: room.version || 1,
                            metadata: room.metadata || {}
                        }, room);

                        await window.LP2PRoomStore.putRoom(rec);
                        try { addSystemMessage(`📣 Learned about room ${rec.name} (${rec.code})`); } catch(e){}
                        if (typeof initRoomsUI === 'function') initRoomsUI();
                    }
                }
            } catch (err) {
                console.warn('Failed handling ROOM_ANNOUNCE:', err);
            }
        });
    
    messageHandler.registerAction(LP2P.MESSAGE_TYPES.SYSTEM, LP2P.SYSTEM_ACTIONS.GOODBYE, (message) => {
        console.log('Peer disconnecting:', message.from);
        
        const reason = message.payload.reason || 'disconnected';
        addSystemMessage(`Peer ${reason}`);
        
        // Hide peer info panel if it was for this peer
        if (activePeerId === message.from) {
            const peerInfoPanel = document.getElementById('peerInfoPanel');
            if (peerInfoPanel) peerInfoPanel.style.display = 'none';
            activePeerId = null;
        }
        
        updatePeerRoster(); // Update roster when peer disconnects
    });
    
    messageHandler.registerAction(LP2P.MESSAGE_TYPES.SYSTEM, LP2P.SYSTEM_ACTIONS.PING, (message) => {
        console.log('Received ping from:', message.from);
        
        // Send pong response
        const pong = LP2P.MessageFactory.createPong(peerId, message.from, message.id);
        sendRawMessage(pong);
    });
    
    messageHandler.registerAction(LP2P.MESSAGE_TYPES.SYSTEM, LP2P.SYSTEM_ACTIONS.ERROR, (message) => {
        console.error('Received error from peer:', message.payload);
        addSystemMessage(`Error: ${message.payload.message}`);
    });
    
    // Handle control messages
    messageHandler.registerAction(LP2P.MESSAGE_TYPES.CONTROL, LP2P.CONTROL_ACTIONS.TYPING, (message) => {
        console.log('Peer typing:', message.payload.active);
        // Could show typing indicator in UI
    });
}

// ============================================================================
// Exports
// ============================================================================

// Make everything available globally for now (will use modules later)
if (typeof window !== 'undefined') {
    window.LP2P = {
        // Constants
        PROTOCOL,
        MESSAGE_TYPES,
        FILE_ACTIONS,
        SYSTEM_ACTIONS,
        CONTROL_ACTIONS,
        ERROR_CODES,
        LIMITS,
        
        // Classes
        Message,
        MessageValidator,
        MessageFactory,
        MessageHandler,

        // Functions
        initMessageHandlers
    };
}
