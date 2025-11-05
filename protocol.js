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
    ERROR: 'error'
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
        MessageHandler
    };
}
