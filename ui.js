// UI Elements
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const offerText = document.getElementById('offerText');
const answerInput = document.getElementById('answerInput');
const offerInput = document.getElementById('offerInput');
const answerText = document.getElementById('answerText');
const messagesDiv = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const setAnswerBtn = document.getElementById('setAnswerBtn');


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
            alert('Failed to copy to clipboard');
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
    // Auto-join rooms marked for autoRejoin on load
    try {
        for (const r of rooms || []) {
            if (r.autoRejoin) {
                // attempt to join room automatically
                try {
                    console.log('Auto-joining room', r.code);
                    // call joinRoom asynchronously but don't block UI
                    joinRoom(r.code).catch(e => console.warn('Auto-join failed for', r.code, e));
                } catch (e) { console.warn('Auto-join error', e); }
            }
        }
    } catch (e) { console.warn('initRoomsUI autojoin failed', e); }
}

// Presence tracking is now integrated into PeerJS signaling
// presenceMap is maintained by window.globalPeerJS via the onPresenceUpdate callback

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

    // Show compact identity badge in header; clicking opens popup with details
    identityInfo.innerHTML = `<div id="userBadge" class="user-badge" onclick="toggleIdentityPopup()">${displayName}</div>`;

    // Ensure popup element exists
    let popup = document.getElementById('identityPopup');
    if (!popup) {
        popup = document.createElement('div');
        popup.id = 'identityPopup';
        popup.className = 'identity-popup';
        popup.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <strong>Your Identity</strong>
                <button onclick="closeIdentityPopup()" class="edit-btn">✖</button>
            </div>
            <div><strong>Name:</strong> ${displayName}</div>
            <div style="margin-top:8px;"><strong>Key ID:</strong> <div class="mono">${keyId}</div></div>
            <div style="margin-top:8px;"><strong>Fingerprint:</strong> <div class="mono">${fingerprint}</div></div>
            <div style="margin-top:10px; display:flex; gap:8px;"><button onclick="changeName()" class="btn-primary">Edit Name</button></div>
        `;
        document.body.appendChild(popup);
    } else {
        // update contents
        popup.querySelector('.mono') && (popup.querySelectorAll('.mono')[0].textContent = keyId);
        popup.querySelectorAll('.mono')[1] && (popup.querySelectorAll('.mono')[1].textContent = fingerprint);
    }
}

function toggleIdentityPopup() {
    const popup = document.getElementById('identityPopup');
    if (!popup) return;
    if (popup.style.display === 'block') popup.style.display = 'none'; else popup.style.display = 'block';
}

function closeIdentityPopup() {
    const popup = document.getElementById('identityPopup');
    if (!popup) return;
    popup.style.display = 'none';
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
        
        // Online if we have an entry in presenceMap (maintained by globalPeerJS), else connected if direct dc open, else known
        const presenceMap = window.presenceMap || new Map();
        const isOnline = presenceMap.has(pid);
        const statusIndicator = isConnected ? '🟢 Connected' : (isOnline ? '🟢 Online' : '⚪ Known');
        
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
     * Prompt user to add a contact by fingerprint.
     * Attempts to derive a peerId from the fingerprint and create a direct offer.
     */
    function promptAddContact() {
        const fingerprint = prompt('Enter contact fingerprint (you can paste short or full fingerprint):');
        if (!fingerprint) return;

        // Try to derive peerId heuristically from fingerprint
        const pid = parseFingerprintToPeerId(fingerprint);
        if (!pid) return alert('Could not parse fingerprint to a peer id. Try pasting the peer id directly.');

        const ok = confirm(`Connect to peer ${pid} to fetch profile and add to contacts?`);
        if (!ok) return;

        // Initiate direct offer via presence signaling (user must configure presence server)
        if (typeof createDirectOffer === 'function') {
            createDirectOffer(pid);
            addSystemMessage(`Attempting to connect to ${pid} to fetch profile...`);
        } else {
            alert('Direct offer function not available yet. Try connecting presence first.');
        }
    }

    /**
     * Heuristic: parse a fingerprint string to derive the lp2p peer id.
     * Strips non-hex characters, uses first 8 hex characters and prefixes 'peer-'.
     */
    function parseFingerprintToPeerId(fp) {
        if (!fp || typeof fp !== 'string') return null;
        // If user pasted a peer id directly, return as-is (basic validation)
        const m = fp.trim().match(/^peer-[0-9a-fA-F]+$/i);
        if (m) return fp.trim();
        // Remove non-hex characters
        const cleaned = fp.replace(/[^0-9a-fA-F]/g, '').toLowerCase();
        if (cleaned.length < 8) return null;
        const first8 = cleaned.slice(0, 8);
        return 'peer-' + first8;
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
    // Render known peers into the roster
    try { updatePeerRoster(); } catch(e) { console.warn('updatePeerRoster failed', e); }
    
    console.log('Local P2P Messenger initialized with protocol v' + LP2P.PROTOCOL.VERSION);
    
    // Auto-connect to PeerJS (call global function from index.html)
    if (typeof initPeerJSConnection === 'function') {
        await initPeerJSConnection();
    }
}

/**
 * Handle Enter key in message input
 */
messageInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        sendMessage();
    }
});

/**
 * Initialize sidebar resizer for contacts/rooms sections
 */
function initSidebarResizer() {
    const resizer = document.getElementById('sidebarResizer');
    const contactsSection = document.getElementById('contactsSection');
    const roomsSection = document.getElementById('roomsSection');
    
    if (!resizer || !contactsSection || !roomsSection) return;
    
    let isResizing = false;
    let startY = 0;
    let startContactsHeight = 0;
    let startRoomsHeight = 0;
    
    resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        startY = e.clientY;
        startContactsHeight = contactsSection.offsetHeight;
        startRoomsHeight = roomsSection.offsetHeight;
        
        document.body.style.cursor = 'ns-resize';
        document.body.style.userSelect = 'none';
        
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        
        const deltaY = e.clientY - startY;
        const newContactsHeight = startContactsHeight + deltaY;
        const newRoomsHeight = startRoomsHeight - deltaY;
        
        // Enforce minimum heights
        const minHeight = 150;
        if (newContactsHeight >= minHeight && newRoomsHeight >= minHeight) {
            contactsSection.style.flex = `0 0 ${newContactsHeight}px`;
            roomsSection.style.flex = `0 0 ${newRoomsHeight}px`;
        }
    });
    
    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
    });
}

// Initialize resizer when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSidebarResizer);
} else {
    initSidebarResizer();
}

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
        toggleIdentityPopup,
        closeIdentityPopup,
        // Rooms UI
        initRoomsUI,
        renderRoomsList,
        createRoomDialog,
        createRoom,
        initSidebarResizer
    };
}
