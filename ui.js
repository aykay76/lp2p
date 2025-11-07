function removeOfferBlock(connectionId, blockId) {
    const entry = connections.get(connectionId);
    if (entry && entry.pc && entry.pc.connectionState !== 'connected') {
        try { entry.pc.close(); } catch(_){}
        connections.delete(connectionId);
    }
    const el = document.getElementById(blockId);
    if (el) el.remove();
}

/**
 * Update connection status UI
 */
function updateStatus(status, message) {
    statusIndicator.className = 'status-indicator ' + status;
    statusText.textContent = message;
}

/**
 * Show dialog to join existing room
 */
function showJoinRoomDialog() {
    const code = prompt('Enter room code (6 characters):');
    if (code && code.trim().length === 6) {
        joinRoom(code.trim().toUpperCase());
    } else if (code) {
        alert('Invalid room code. Must be 6 characters.');
    }
}

/**
 * Copy room code to clipboard
 */
function copyRoomCode() {
    if (currentRoomCode) {
        navigator.clipboard.writeText(currentRoomCode).then(() => {
            alert('Room code copied to clipboard!');
        }).catch(err => {
            console.error('Failed to copy:', err);
            // Fallback: select text
            const display = document.getElementById('roomCodeDisplay');
            const selection = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(display);
            selection.removeAllRanges();
            selection.addRange(range);
        });
    }
}

/**
 * Generate QR code as data URL for displaying offers/answers
 */
function generateQRCode(data, size = 256) {
    // Use a public QR API for simplicity (no dependencies)
    // For production, consider embedding qrcode.js library
    const encoded = encodeURIComponent(data);
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}`;
}


/**
 * Show QR code for room
 */
function showQRCode() {
    if (currentRoomCode) {
        const url = `${window.location.origin}${window.location.pathname}?room=${currentRoomCode}`;
        const qrUrl = LP2PSignaling.generateQRCode(url);
        const img = document.getElementById('qrCodeImage');
        img.src = qrUrl;
        img.style.display = 'block';
        addSystemMessage('📱 QR code generated - scan to join room');
    }
}

/**
 * Rooms / Channels UI
 */
async function initRoomsUI() {
    if (!window.LP2PRoomStore) return;
    const list = document.getElementById('channelsList');
    if (!list) return;
    const rooms = await window.LP2PRoomStore.getAllRooms();
    renderRoomsList(rooms);
}

function renderRoomsList(rooms) {
    const list = document.getElementById('channelsList');
    if (!list) return;
    if (!rooms || rooms.length === 0) {
        list.innerHTML = '<div class="no-rooms">No channels yet</div>';
        return;
    }

    // Sort by lastActive desc
    rooms.sort((a,b) => (b.lastActive || 0) - (a.lastActive || 0));

    let html = '';
    for (const r of rooms) {
        const name = r.name || r.code;
        const last = r.lastActive ? new Date(r.lastActive).toLocaleString() : '-';
        html += `
            <div class="channel-item">
                <div class="channel-main">
                    <strong>${name}</strong> <span class="code">${r.code}</span>
                </div>
                <div class="channel-meta">Last active: ${last}</div>
                <div class="channel-actions">
                    <button onclick="joinRoom('${r.code}')">Join</button>
                    <button onclick="(async()=>{await navigator.clipboard.writeText('${r.code}'); alert('Code copied')})()">Copy</button>
                    <button onclick="(async()=>{await LP2PRoomStore.deleteRoom('${r.code}'); initRoomsUI();})()">Delete</button>
                </div>
            </div>
        `;
    }
    list.innerHTML = html;
}

function createRoomDialog() {
    const name = prompt('Enter channel name:');
    if (!name || !name.trim()) return alert('Channel name required');
    const isDM = confirm('Make this a DM (max 2 participants)?\nPress OK for DM, Cancel for regular channel');
    createRoom({ name: name.trim(), capacity: isDM ? 2 : 0 });
}

async function createRoom({ name, capacity = 0 }){
    // generate code
    let code = null;
    if (window.LP2PSignaling && window.LP2PSignaling.PeerJSSignaling && typeof window.LP2PSignaling.PeerJSSignaling.generateRoomCode === 'function'){
        code = window.LP2PSignaling.PeerJSSignaling.generateRoomCode();
    } else {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        code = Array.from({length:6}).map(()=>chars.charAt(Math.floor(Math.random()*chars.length))).join('');
    }

    const room = {
        code,
        name,
        creator: (peerId || (ownIdentity && ownIdentity.id)) || 'anonymous',
        createdAt: Date.now(),
        lastActive: Date.now(),
        capacity: capacity || 0,
        privacy: 'invite',
        autoRejoin: true,
        metadata: {},
        version: 1,
        flags: { dm: capacity === 2 }
    };

    try {
        await LP2PRoomStore.putRoom(room);
        addSystemMessage(`Room ${name} (${code}) created locally`);
        // Announce via signaling if available
        if (window.signaling && typeof window.signaling.announceRooms === 'function'){
            window.signaling.announceRooms([{
                code: room.code,
                name: room.name,
                lastActive: room.lastActive,
                capacity: room.capacity,
                creator: room.creator
            }]);
        }
        // refresh UI
        initRoomsUI();
    } catch (err) {
        console.error('Failed create room', err);
        alert('Failed to create room: ' + err.message);
    }
}


/**
 * Display our identity information
 */
function displayIdentity() {
    const identityInfo = document.getElementById('identityInfo');
    if (!identityInfo) return;
    
    const fingerprint = ownIdentity.fingerprint;
    const keyId = ownIdentity.keyId;
    const displayName = ownIdentity.profile.name || 'Anonymous';
    
    identityInfo.innerHTML = `
        <div class="peer-info-top">
            <div>
                <strong>Your Identity</strong><br>
                Name: <strong>${displayName}</strong> 
                <button onclick="changeName()" class="edit-btn">✏️ Edit</button><br>
                Key ID: <code>${keyId}</code><br>
                Fingerprint: <code class="code-small">${fingerprint}</code>
            </div>
        </div>
    `;
}

/**
 * Change display name
 */
async function changeName() {
    const currentName = ownIdentity.profile.name;
    const newName = prompt('Enter new display name:', currentName);
    
    if (newName && newName.trim() && newName.trim() !== currentName) {
        await identityManager.updateProfile({ name: newName.trim() });
        ownIdentity = identityManager.getOwnIdentity();
        displayIdentity();
        console.log('Name updated to:', newName.trim());
    }
}

/**
 * Display peer information panel
 */
function displayPeerInfo() {
    if (!activePeerId) return;
    
    const trustRecord = identityManager.getPeer(activePeerId);
    if (!trustRecord) return;
    
    const peerInfoPanel = document.getElementById('peerInfoPanel');
    const peerName = document.getElementById('peerName');
    const peerKeyId = document.getElementById('peerKeyId');
    const peerFingerprint = document.getElementById('peerFingerprint');
    const trustLevelSelect = document.getElementById('trustLevelSelect');
    
    peerName.textContent = trustRecord.profile.name || 'Unknown';
    peerKeyId.textContent = trustRecord.keyId;
    peerFingerprint.textContent = trustRecord.fingerprint;
    trustLevelSelect.value = trustRecord.trustLevel;
    
    peerInfoPanel.style.display = 'block';
}

/**
 * Update peer roster display
 */
function updatePeerRoster() {
    const rosterList = document.getElementById('peerRosterList');
    const connectedPeerIds = new Set();
    
    // Get all connected peer IDs (direct connections)
    for (const [cid, conn] of connections.entries()) {
        if (conn.peerId && conn.dc && conn.dc.readyState === 'open') {
            connectedPeerIds.add(conn.peerId);
        }
    }
    
    // Get all known peers from identity manager
    const allPeers = identityManager.getAllPeers();
    
    if (allPeers.length === 0 && connectedPeerIds.size === 0) {
        rosterList.innerHTML = '<div class="no-peers">No peers connected</div>';
        return;
    }
    
    // Build roster HTML - show all known peers
    let html = '';
    for (const record of allPeers) {
        const pid = record.peerId;
        const name = record.profile?.name || pid.substring(0, 8);
        const trustLevel = record.trustLevel || 'unknown';
        const isSelected = pid === activePeerId;
        const isConnected = connectedPeerIds.has(pid);
        
        const trustBadges = {
            'unknown': '<span class="trust-badge trust-unknown">❓</span>',
            'untrusted': '<span class="trust-badge trust-unknown">⛔</span>',
            'marginal': '<span class="trust-badge trust-marginal">⚠️</span>',
            'full': '<span class="trust-badge trust-full">✅</span>',
            'ultimate': '<span class="trust-badge trust-ultimate">⭐</span>'
        };
        
        const statusIndicator = isConnected ? '🟢 Connected' : '⚪ Known (via host)';
        
        html += `
            <div class="peer-item ${isSelected ? 'selected' : ''}" onclick="selectPeer('${pid}')">
                <div class="peer-name">${name}${trustBadges[trustLevel] || ''}</div>
                <div class="peer-status">${statusIndicator}</div>
            </div>
        `;
    }
    
    rosterList.innerHTML = html;
}

/**
 * Update trust level for active peer
 */
async function updateTrustLevel() {
    if (!activePeerId) return;
    
    const trustLevelSelect = document.getElementById('trustLevelSelect');
    const newLevel = trustLevelSelect.value;
    
    await identityManager.setTrust(activePeerId, newLevel, 'manual');
    
    const trustEmoji = {
        'unknown': '❓',
        'untrusted': '⛔',
        'marginal': '⚠️',
        'full': '✅'
    };
    
    addSystemMessage(`Trust level updated to ${trustEmoji[newLevel]} ${newLevel}`);
    updatePeerRoster(); // Refresh to show new trust badge
    console.log('Trust level set to:', newLevel);
}

/**
 * Show fingerprint comparison dialog
 */
function showFingerprintComparison() {
    if (!activePeerId) return;
    
    const trustRecord = identityManager.getPeer(activePeerId);
    if (!trustRecord) return;
    
    const myFingerprint = ownIdentity.fingerprint;
    const peerFingerprint = trustRecord.fingerprint;
    const peerName = trustRecord.profile.name || 'Unknown';
    
    // Populate modal
    document.getElementById('myFingerprintDisplay').textContent = myFingerprint;
    document.getElementById('peerFingerprintDisplay').textContent = peerFingerprint;
    document.getElementById('peerNameDisplay').textContent = peerName;
    document.getElementById('peerNameDisplay2').textContent = peerName;
    document.getElementById('trustLevelModal').value = trustRecord.trustLevel;
    
    // Show modal
    const modal = document.getElementById('fingerprintModal');
    modal.style.display = 'flex';
}

/**
 * Close fingerprint verification modal
 */
function closeFingerprintModal() {
    const modal = document.getElementById('fingerprintModal');
    modal.style.display = 'none';
}

/**
 * Save trust level from modal
 */
async function saveTrustLevel() {
    if (!activePeerId) return;
    
    const trustLevelModal = document.getElementById('trustLevelModal');
    const newLevel = trustLevelModal.value;
    
    // Update trust level
    await identityManager.setTrust(activePeerId, newLevel, 'manual');
    
    // Update the dropdown in the peer info panel
    const trustLevelSelect = document.getElementById('trustLevelSelect');
    if (trustLevelSelect) {
        trustLevelSelect.value = newLevel;
    }
    
    // Close modal
    closeFingerprintModal();
    
    // Show confirmation
    const trustEmoji = {
        'unknown': '❓',
        'untrusted': '⛔',
        'marginal': '⚠️',
        'full': '✅'
    };
    
    addSystemMessage(`Trust level updated to ${trustEmoji[newLevel]} ${newLevel}`);
    updatePeerRoster(); // Refresh roster to show new badge
    console.log('Trust level set to:', newLevel);
}

/**
 * Add a message to the chat
 */
function addMessage(text, isSent, messageId = null, senderId = null) {
    // Clear placeholder if exists
    if (messagesDiv.children.length === 1 && messagesDiv.children[0].classList && messagesDiv.children[0].classList.contains('center-muted')) {
        messagesDiv.innerHTML = '';
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ' + (isSent ? 'sent' : 'received');
    if (messageId) {
        messageDiv.dataset.messageId = messageId;
    }
    
    // Add sender name for received messages
    if (!isSent && senderId) {
        const peer = identityManager.getPeer(senderId);
        const senderName = peer?.profile?.name || senderId.substring(0, 8);
        const senderDiv = document.createElement('div');
        senderDiv.className = 'message-sender';
        senderDiv.style.fontSize = '12px';
        senderDiv.style.fontWeight = 'bold';
        senderDiv.style.marginBottom = '4px';
        senderDiv.style.opacity = '0.8';
        senderDiv.textContent = senderName;
        messageDiv.appendChild(senderDiv);
    }
    
    const textDiv = document.createElement('div');
    textDiv.textContent = text;
    
    const timeDiv = document.createElement('div');
    timeDiv.className = 'message-time';
    timeDiv.textContent = new Date().toLocaleTimeString();
    
    messageDiv.appendChild(textDiv);
    messageDiv.appendChild(timeDiv);
    messagesDiv.appendChild(messageDiv);
    
    // Scroll to bottom
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

/**
 * Add a system message to the chat
 */
function addSystemMessage(text) {
    // Clear placeholder if exists
    if (messagesDiv.children.length === 1 && messagesDiv.children[0].classList && messagesDiv.children[0].classList.contains('center-muted')) {
        messagesDiv.innerHTML = '';
    }

    const messageDiv = document.createElement('div');
    messageDiv.style.textAlign = 'center';
    messageDiv.style.color = '#999';
    messageDiv.style.fontSize = '13px';
    messageDiv.style.margin = '10px 0';
    messageDiv.textContent = text;
    
    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

/**
 * Enable chat UI
 */
function enableChat() {
    messageInput.disabled = false;
    sendBtn.disabled = false;
    messageInput.focus();
}

/**
 * Disable chat UI
 */
function disableChat() {
    messageInput.disabled = true;
    sendBtn.disabled = true;
}

/**
 * Show username setup modal
 */
function showUsernameModal() {
    const modal = document.getElementById('usernameModal');
    modal.style.display = 'flex';
    
    const input = document.getElementById('usernameInput');
    input.focus();
    
    // Allow Enter key to submit
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            setUsername();
        }
    });
}

/**
 * Set username and create identity
 */
async function setUsername() {
    const input = document.getElementById('usernameInput');
    const username = input.value.trim();
    
    if (!username) {
        alert('Please enter a name');
        return;
    }
    
    // Hide modal
    const modal = document.getElementById('usernameModal');
    modal.style.display = 'none';
    
    // Create identity with chosen name
    identityManager = new LP2PIdentity.IdentityManager();
    await identityManager.initialize({ name: username });
    ownIdentity = identityManager.getOwnIdentity();
    
    // Use identity's ID as our peer ID
    peerId = ownIdentity.id;
    console.log('Our peer ID:', peerId);
    console.log('Our fingerprint:', ownIdentity.fingerprint);
    
    // Display identity in UI
    displayIdentity();
    
    // Initialize message handlers
    initMessageHandlers();
    
    console.log('Local P2P Messenger initialized with protocol v' + LP2P.PROTOCOL.VERSION);
    updateStatus('', 'Disconnected');
}

/**
 * Handle Enter key in message input
 */
messageInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        sendMessage();
    }
});

// Export for use in main app
if (typeof window !== 'undefined') {
    window.LP2PSignaling = {
        removeOfferBlock,
        updateStatus,
        showJoinRoomDialog,
        copyRoomCode,
        generateQRCode,
        showQRCode,
        displayIdentity,
        changeName,
        displayPeerInfo,
        updatePeerRoster,
        updateTrustLevel,
        showFingerprintComparison,
        closeFingerprintModal,
        saveTrustLevel,
        addMessage,
        addSystemMessage,
        enableChat,
        disableChat,
        showUsernameModal,
        setUsername,
        // Rooms UI
        initRoomsUI,
        renderRoomsList,
        createRoomDialog,
        createRoom
    };
}
