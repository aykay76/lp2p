/**
 * Signaling helpers for LP2P
 * Provides multiple ways to exchange WebRTC offers/answers without manual copy-paste
 */

// ============================================================================
// PeerJS Cloud Signaling (cross-browser/device)
// ============================================================================

/**
 * Use PeerJS cloud server for signaling and presence
 * Handles WebRTC signaling and peer discovery in one service
 */
class PeerJSSignaling {
    constructor(options = {}) {
        this.roomCode = null;
        this.peerId = null;
        this.onOffer = null;
        this.onAnswer = null;
        this.peer = null;
        this.connections = new Map(); // Track PeerJS connections used only for signaling
        
        // Presence tracking (P2P direct pinging)
        this.presenceEnabled = options.enablePresence !== false; // Default true
        this.presenceInterval = null;
        this.presenceMap = new Map(); // peerId -> { lastSeen: timestamp }
        this.onPresenceUpdate = options.onPresenceUpdate || null;
        this.onGetKnownPeers = options.onGetKnownPeers || null; // Callback to get list of known peers
        this.onConnectionStatusChange = options.onConnectionStatusChange || null;
    }

    async connect(peerId, options = {}) {
        this.peerId = peerId;
        
        // Create PeerJS peer with global presence ID
        const peerJSId = `lp2p-${peerId}`;
        this.peer = new Peer(peerJSId, {
            debug: 0, // Set to 2 for debugging
            ...options.peerConfig
        });

        return new Promise((resolve, reject) => {
            this.peer.on('open', (id) => {
                console.log(`✅ PeerJS connected: ${id}`);
                this.setupSignalingHandlers();
                
                // Start presence tracking if enabled
                if (this.presenceEnabled) {
                    this.startPresenceTracking();
                }
                
                // Notify status change
                if (this.onConnectionStatusChange) {
                    this.onConnectionStatusChange('connected');
                }
                
                resolve(id);
            });

            this.peer.on('error', (err) => {
                console.error('❌ PeerJS error:', err);
                if (this.onConnectionStatusChange) {
                    this.onConnectionStatusChange('error', err);
                }
                reject(err);
            });
            
            this.peer.on('disconnected', () => {
                console.warn('⚠️ PeerJS disconnected');
                if (this.onConnectionStatusChange) {
                    this.onConnectionStatusChange('disconnected');
                }
            });
            
            this.peer.on('close', () => {
                console.log('🔴 PeerJS closed');
                this.stopPresenceTracking();
                if (this.onConnectionStatusChange) {
                    this.onConnectionStatusChange('closed');
                }
            });
        });
    }

    async joinRoom(roomCode, peerId) {
        this.roomCode = roomCode;
        this.peerId = peerId;
        
        // Create PeerJS peer with custom ID
        const peerJSId = `${roomCode}-${peerId}`;
        this.peer = new Peer(peerJSId, {
            debug: 0 // Set to 2 for debugging
        });

        return new Promise((resolve, reject) => {
            this.peer.on('open', (id) => {
                console.log(`PeerJS signaling connected: ${id}`);
                this.setupSignalingHandlers();
                resolve();
            });

            this.peer.on('error', (err) => {
                console.error('PeerJS error:', err);
                reject(err);
            });
        });
    }

    setupSignalingHandlers() {
        // Listen for incoming signaling connections
        this.peer.on('connection', (conn) => {
            // Check if this is a presence ping
            if (conn.metadata && conn.metadata.type === 'presence-ping') {
                console.log('👋 Presence ping from:', conn.peer);
                // Just accept the connection - it will be closed by the pinger
                conn.on('open', () => {
                    // Connection opened successfully - that's all we need for presence
                });
                return;
            }
            
            console.log('🔵 PeerJS incoming signaling connection from:', conn.peer);
            
            conn.on('open', () => {
                console.log('🟢 PeerJS signaling channel OPEN with', conn.peer);
                this.connections.set(conn.peer, conn);
            });

            conn.on('data', (data) => {
                console.log('📨 Received signaling data:', data.type, 'from', data.from, 'on connection', conn.peer);
                
                // Store the reverse mapping so we can reply
                if (data.from) {
                    const fullPeerId = `${this.roomCode}-${data.from}`;
                    console.log('🔗 Storing reverse connection mapping:', fullPeerId, '→', conn.peer);
                    this.connections.set(fullPeerId, conn);
                }
                
                if (data.type === 'offer' && this.onOffer) {
                    this.onOffer(data.sdp, data.from);
                } else if (data.type === 'answer' && this.onAnswer) {
                    this.onAnswer(data.sdp, data.from);
                }
            });

            conn.on('close', () => {
                this.connections.delete(conn.peer);
            });

            conn.on('error', (err) => {
                console.error('PeerJS connection error:', err);
            });
        });
    }

    async postOffer(offer, targetPeerId = '*') {
        const data = {
            type: 'offer',
            from: this.peerId,
            sdp: offer
        };

        if (targetPeerId === '*') {
            // Broadcast to all peers in room (connect to host)
            const hostId = `${this.roomCode}-host`;
            await this.sendToPeer(hostId, data);
        } else {
            await this.sendToPeer(`${this.roomCode}-${targetPeerId}`, data);
        }
    }

    async postAnswer(answer, targetPeerId) {
        const data = {
            type: 'answer',
            from: this.peerId,
            sdp: answer
        };
        
        await this.sendToPeer(`${this.roomCode}-${targetPeerId}`, data);
    }

    async sendToPeer(peerJSId, data) {
        console.log('📤 Attempting to send to:', peerJSId, 'Available connections:', Array.from(this.connections.keys()));
        let conn = this.connections.get(peerJSId);
        
        if (!conn) {
            // Create new signaling connection
            console.log('🔴 Creating NEW PeerJS signaling connection to:', peerJSId);
            conn = this.peer.connect(peerJSId, { reliable: true });
            
            try {
                await new Promise((resolve, reject) => {
                    conn.on('open', () => {
                        this.connections.set(peerJSId, conn);
                        console.log('🟢 PeerJS signaling channel opened to', peerJSId);
                        resolve();
                    });
                    
                    // Set up data handler for outgoing connections too!
                    conn.on('data', (data) => {
                        console.log('📨 Received signaling data on outgoing connection:', data.type, 'from', data.from);
                        
                        if (data.type === 'offer' && this.onOffer) {
                            this.onOffer(data.sdp, data.from);
                        } else if (data.type === 'answer' && this.onAnswer) {
                            this.onAnswer(data.sdp, data.from);
                        }
                    });
                    
                    conn.on('error', (err) => {
                        console.error('PeerJS connection error:', err);
                        reject(err);
                    });
                    
                    conn.on('close', () => {
                        this.connections.delete(peerJSId);
                    });
                    
                    // Timeout after 10 seconds
                    setTimeout(() => reject(new Error(`Timeout connecting to ${peerJSId}. Is the host online?`)), 10000);
                });
            } catch (err) {
                console.error('Failed to connect to peer:', err.message);
                throw err;
            }
        } else {
            console.log('✅ Using existing PeerJS connection to', peerJSId);
        }

        conn.send(data);
        console.log('✉️ Sent signaling data via PeerJS:', data.type, 'to', peerJSId);
    }

    startPresenceTracking() {
        if (!this.presenceEnabled || this.presenceInterval) return;
        
        console.log('🔎 Starting P2P presence tracking (direct peer pings)');
        
        // Do initial presence check immediately
        this.checkPeerPresence();
        
        // Then check every 30 seconds
        this.presenceInterval = setInterval(() => {
            this.checkPeerPresence();
        }, 30000);
    }
    
    /**
     * Check presence by attempting lightweight PeerJS connections to known peers
     * This is truly P2P - no server listing required!
     */
    async checkPeerPresence() {
        // Get list of known peers from callback
        if (!this.onGetKnownPeers) {
            console.warn('No onGetKnownPeers callback set - cannot check presence');
            return;
        }
        
        const knownPeers = this.onGetKnownPeers();
        if (!knownPeers || knownPeers.length === 0) {
            return;
        }
        
        console.log(`🔍 Checking presence for ${knownPeers.length} known peers...`);
        
        const now = Date.now();
        const checkPromises = knownPeers.map(peerId => this.pingPeer(peerId, now));
        
        // Wait for all pings to complete (with timeout)
        await Promise.allSettled(checkPromises);
        
        // Notify listeners of presence updates
        if (this.onPresenceUpdate) {
            this.onPresenceUpdate(Array.from(this.presenceMap.keys()));
        }
    }
    
    /**
     * Ping a specific peer to check if they're online
     * Uses a lightweight PeerJS connection that gets closed immediately
     */
    async pingPeer(peerId, timestamp) {
        if (peerId === this.peerId) return; // Don't ping ourselves
        
        const peerJSId = `lp2p-${peerId}`;
        
        // Check if we already have an active connection
        if (this.connections.has(peerJSId)) {
            const conn = this.connections.get(peerJSId);
            if (conn.open) {
                // Already connected - mark as online
                this.presenceMap.set(peerId, { lastSeen: timestamp });
                return;
            }
        }
        
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                // Timeout - peer is offline
                this.presenceMap.delete(peerId);
                if (pingConn) {
                    pingConn.close();
                }
                resolve();
            }, 5000); // 5 second timeout
            
            let pingConn;
            try {
                // Create a lightweight ping connection
                pingConn = this.peer.connect(peerJSId, {
                    reliable: false, // Use unreliable for faster connection
                    metadata: { type: 'presence-ping' }
                });
                
                pingConn.on('open', () => {
                    clearTimeout(timeout);
                    // Peer is online!
                    this.presenceMap.set(peerId, { lastSeen: timestamp });
                    console.log(`✅ ${peerId.substring(0, 12)} is online`);
                    // Close the ping connection immediately
                    pingConn.close();
                    resolve();
                });
                
                pingConn.on('error', (err) => {
                    clearTimeout(timeout);
                    // Error connecting - peer likely offline
                    this.presenceMap.delete(peerId);
                    resolve();
                });
                
                pingConn.on('close', () => {
                    resolve();
                });
            } catch (err) {
                clearTimeout(timeout);
                this.presenceMap.delete(peerId);
                resolve();
            }
        });
    }
    
    stopPresenceTracking() {
        if (this.presenceInterval) {
            clearInterval(this.presenceInterval);
            this.presenceInterval = null;
        }
        this.presenceMap.clear();
    }
    
    getOnlinePeers() {
        return Array.from(this.presenceMap.keys());
    }
    
    isPeerOnline(peerId) {
        return this.presenceMap.has(peerId);
    }
    
    /**
     * Manually trigger a presence check for all known peers
     */
    async refreshPresence() {
        console.log('🔄 Manually refreshing presence...');
        await this.checkPeerPresence();
    }

    disconnect() {
        this.stopPresenceTracking();
        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }
        this.connections.clear();
        console.log('🔌 Disconnected from PeerJS');
    }

    leaveRoom() {
        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }
        this.connections.clear();
        this.roomCode = null;
        console.log('Left PeerJS room');
    }

    static generateRoomCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }
}

// ============================================================================
// WebSocket Signaling Server (requires backend)
// ============================================================================

class WebSocketSignaling {
    constructor(serverUrl) {
        this.serverUrl = serverUrl;
        this.ws = null;
        this.roomCode = null;
        this.peerId = null;
        this.onOffer = null;
        this.onAnswer = null;
        this.onPeerJoined = null;
        this.onPeerLeft = null;
        this.onRoomMembers = null; // callback(room, members[])
    }

    /**
     * Connect to signaling server and join room
     */
    connect(roomCode, peerId) {
        return new Promise((resolve, reject) => {
            this.roomCode = roomCode;
            this.peerId = peerId;
            
            this.ws = new WebSocket(this.serverUrl);
            
            this.ws.onopen = () => {
                console.log('Connected to signaling server');
                // Join room
                this.send({
                    type: 'join',
                    room: roomCode,
                    peerId: peerId
                });
                resolve();
            };
            
            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleMessage(data);
                } catch (e) {
                    console.warn('Invalid signaling message', e);
                }
            };
            
            this.ws.onerror = (error) => {
                console.error('WebSocket error', error);
                reject(error);
            };
            
            this.ws.onclose = () => {
                console.log('Disconnected from signaling server');
            };
        });
    }

    /**
     * Handle incoming signaling messages
     */
    handleMessage(data) {
        switch (data.type) {
            case 'offer':
                if (this.onOffer && data.from !== this.peerId) {
                    this.onOffer(data.sdp, data.from);
                }
                break;
            
            case 'answer':
                if (this.onAnswer && data.to === this.peerId) {
                    this.onAnswer(data.sdp, data.from);
                }
                break;
            
            case 'peer-joined':
                if (this.onPeerJoined) {
                    this.onPeerJoined(data.peerId);
                }
                break;
            
            case 'peer-left':
                if (this.onPeerLeft) {
                    this.onPeerLeft(data.peerId);
                }
                break;
            case 'roomMembers':
                if (this.onRoomMembers) {
                    this.onRoomMembers(data.room, data.members || []);
                }
                break;
        }
    }

    /**
     * Send offer to room
     */
    sendOffer(offer, targetPeerId = '*') {
        this.send({
            type: 'offer',
            room: this.roomCode,
            from: this.peerId,
            to: targetPeerId,
            sdp: offer
        });
    }

    /**
     * Announce a list of rooms (ephemeral presence) to the signaling server
     * rooms: [{ code, name?, lastActive?, capacity?, creator? }]
     */
    announceRooms(rooms) {
        this.send({
            type: 'announceRooms',
            rooms: rooms
        });
    }

    /**
     * Query the signaling server for currently-online members of a room
     */
    queryRoomMembers(roomCode) {
        this.send({ type: 'queryRoomMembers', room: roomCode });
    }

    /**
     * Send answer to specific peer
     */
    sendAnswer(answer, targetPeerId) {
        this.send({
            type: 'answer',
            room: this.roomCode,
            from: this.peerId,
            to: targetPeerId,
            sdp: answer
        });
    }

    /**
     * Send message to server
     */
    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }

    /**
     * Disconnect from server
     */
    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}

// Export for use in main app
if (typeof window !== 'undefined') {
    window.LP2PSignaling = {
        PeerJSSignaling,
        WebSocketSignaling,
        generateQRCode
    };
}
