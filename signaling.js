/**
 * Signaling helpers for LP2P
 * Provides multiple ways to exchange WebRTC offers/answers without manual copy-paste
 */

// ============================================================================
// PeerJS Cloud Signaling (cross-browser/device)
// ============================================================================

/**
 * Use PeerJS cloud server for signaling only
 * Keeps existing WebRTC implementation intact
 */
class PeerJSSignaling {
    constructor() {
        this.roomCode = null;
        this.peerId = null;
        this.onOffer = null;
        this.onAnswer = null;
        this.peer = null;
        this.connections = new Map(); // Track PeerJS connections used only for signaling
    }

    async joinRoom(roomCode, peerId) {
        this.roomCode = roomCode;
        this.peerId = peerId;
        
        // Create PeerJS peer with custom ID
        const peerJSId = `${roomCode}-${peerId}`;
        this.peer = new Peer(peerJSId, {
            debug: 2 // Set to 0 in production
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
