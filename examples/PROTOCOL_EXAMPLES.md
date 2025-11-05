# Message Protocol Examples

This directory contains examples of using the LP2P message protocol.

## Basic Usage Example

```javascript
// Initialize message handler
const handler = new LP2P.MessageHandler();

// Register a text message handler
handler.register(LP2P.MESSAGE_TYPES.TEXT, (message) => {
    console.log('Received text:', message.payload.text);
});

// Create and send a text message
const peerId = 'peer-abc123';
const remotePeerId = 'peer-def456';

const textMsg = LP2P.MessageFactory.createText(
    peerId,
    remotePeerId,
    'Hello, world!'
);

// Validate the message
const validation = LP2P.MessageValidator.validate(textMsg);
if (validation.valid) {
    // Serialize for transmission
    const wire = textMsg.serialize();
    dataChannel.send(wire);
} else {
    console.error('Invalid message:', validation.errors);
}

// Receive and handle a message
dataChannel.onmessage = async (event) => {
    const message = LP2P.Message.deserialize(event.data);
    await handler.handle(message);
};
```

## Text Messaging

```javascript
// Simple text
const msg1 = LP2P.MessageFactory.createText(
    'peer-alice',
    'peer-bob',
    'Hello Bob!'
);

// Markdown formatted text
const msg2 = LP2P.MessageFactory.createText(
    'peer-alice',
    'peer-bob',
    '# Hello\n\nThis is **bold** text',
    'markdown'
);

// Send the message
const wire = msg1.serialize();
console.log(wire);
// Output: {"protocol":"lp2p","version":"1.0","id":"...","type":"text",...}
```

## File Transfer

```javascript
// Step 1: Offer a file
const fileOffer = LP2P.MessageFactory.createFileOffer(
    'peer-alice',
    'peer-bob',
    {
        name: 'document.pdf',
        size: 1048576,  // 1MB
        mimeType: 'application/pdf',
        hash: 'sha256-abcdef...'
    }
);

// Step 2: Accept the file
const accept = LP2P.MessageFactory.createFileControl(
    'peer-bob',
    'peer-alice',
    LP2P.FILE_ACTIONS.ACCEPT,
    fileOffer.payload.fileId
);

// Step 3: Send chunks
const file = await getFileData();  // Your file reading logic
const chunkSize = 16384;
const totalChunks = Math.ceil(file.size / chunkSize);

for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    const chunk = file.slice(start, end);
    
    // Convert to base64
    const reader = new FileReader();
    reader.onload = () => {
        const base64 = reader.result.split(',')[1];
        
        const chunkMsg = LP2P.MessageFactory.createFileChunk(
            'peer-alice',
            'peer-bob',
            fileOffer.payload.fileId,
            i,
            base64,
            i === totalChunks - 1  // isLast
        );
        
        sendMessage(chunkMsg);
    };
    reader.readAsDataURL(chunk);
}

// Step 4: Complete
const complete = LP2P.MessageFactory.createFileControl(
    'peer-alice',
    'peer-bob',
    LP2P.FILE_ACTIONS.COMPLETE,
    fileOffer.payload.fileId
);
```

## Structured Data

```javascript
// Share a note
const noteMsg = LP2P.MessageFactory.createData(
    'peer-alice',
    'peer-bob',
    'note',
    'note-v1',
    {
        title: 'Meeting Notes',
        body: 'Discussed the new feature...',
        tags: ['work', 'important'],
        created: Date.now()
    }
);

// Share a bookmark
const bookmarkMsg = LP2P.MessageFactory.createData(
    'peer-alice',
    'peer-bob',
    'bookmark',
    'bookmark-v1',
    {
        url: 'https://example.com',
        title: 'Example Website',
        description: 'A great resource',
        tags: ['development', 'tools']
    }
);

// Share code snippet
const codeMsg = LP2P.MessageFactory.createData(
    'peer-alice',
    'peer-bob',
    'code',
    'code-v1',
    {
        language: 'javascript',
        filename: 'example.js',
        code: 'function hello() { return "world"; }',
        description: 'Simple function example'
    }
);
```

## System Messages

```javascript
// Introduce yourself when connecting
const hello = LP2P.MessageFactory.createHello('peer-alice', {
    id: 'peer-alice',
    name: 'Alice\'s Laptop',
    publicKey: 'ed25519-key-here',
    capabilities: ['text', 'file', 'data'],
    version: '1.0.0',
    protocolVersion: '1.0'
});

// Say goodbye when disconnecting
const goodbye = LP2P.MessageFactory.createGoodbye(
    'peer-alice',
    'closing browser'
);

// Ping to check connection
const ping = LP2P.MessageFactory.createPing('peer-alice', 'peer-bob');

// Respond to ping
const pong = LP2P.MessageFactory.createPong('peer-bob', 'peer-alice', ping.id);

// Send error
const error = LP2P.MessageFactory.createError(
    'peer-alice',
    'peer-bob',
    LP2P.ERROR_CODES.VALIDATION_FAILED,
    'Message payload is invalid',
    { field: 'payload.text' },
    'invalid-message-id'
);
```

## Control Messages

```javascript
// Show typing indicator
const typing = LP2P.MessageFactory.createTyping('peer-alice', 'peer-bob', true);
// ... user types ...
const notTyping = LP2P.MessageFactory.createTyping('peer-alice', 'peer-bob', false);

// Send read receipt
const read = LP2P.MessageFactory.createReadReceipt(
    'peer-bob',
    'peer-alice',
    'message-id-that-was-read'
);
```

## Message Handler Patterns

```javascript
const handler = new LP2P.MessageHandler();

// Handle all text messages
handler.register(LP2P.MESSAGE_TYPES.TEXT, (message) => {
    displayMessage(message.payload.text);
});

// Handle specific system actions
handler.registerAction(
    LP2P.MESSAGE_TYPES.SYSTEM,
    LP2P.SYSTEM_ACTIONS.HELLO,
    (message) => {
        const peer = message.payload.peerInfo;
        console.log(`${peer.name} connected`);
        addPeerToList(peer);
    }
);

// Handle file offers
handler.registerAction(
    LP2P.MESSAGE_TYPES.FILE,
    LP2P.FILE_ACTIONS.OFFER,
    async (message) => {
        const accept = await showFileAcceptDialog(message.payload);
        if (accept) {
            const response = LP2P.MessageFactory.createFileControl(
                myPeerId,
                message.from,
                LP2P.FILE_ACTIONS.ACCEPT,
                message.payload.fileId
            );
            sendMessage(response);
        }
    }
);

// Handle errors
handler.registerAction(
    LP2P.MESSAGE_TYPES.SYSTEM,
    LP2P.SYSTEM_ACTIONS.ERROR,
    (message) => {
        console.error('Peer error:', message.payload);
        showErrorNotification(message.payload.message);
    }
);
```

## Validation Examples

```javascript
// Validate before sending
const message = LP2P.MessageFactory.createText('alice', 'bob', 'Hello');
const validation = LP2P.MessageValidator.validate(message);

if (validation.valid) {
    sendMessage(message);
} else {
    console.error('Validation errors:', validation.errors);
    // Output: ["Missing required field: from", ...]
}

// Handle validation errors
try {
    await handler.handle(incomingMessage);
} catch (error) {
    // Send error back to sender
    const errorMsg = LP2P.MessageFactory.createError(
        myPeerId,
        incomingMessage.from,
        LP2P.ERROR_CODES.INVALID_FORMAT,
        error.message,
        null,
        incomingMessage.id
    );
    sendMessage(errorMsg);
}
```

## Message Metadata

```javascript
// Add custom metadata
const message = LP2P.MessageFactory.createText('alice', 'bob', 'Hello');
message.metadata = {
    priority: 'high',
    encrypted: false,
    appVersion: '2.0.0',
    customField: 'custom-value'
};

// Access metadata on receive
handler.register(LP2P.MESSAGE_TYPES.TEXT, (message) => {
    if (message.metadata?.priority === 'high') {
        handlePriorityMessage(message);
    } else {
        handleNormalMessage(message);
    }
});
```

## Reply Chains

```javascript
// Original message
const original = LP2P.MessageFactory.createText('alice', 'bob', 'What time?');
console.log('Original ID:', original.id);

// Reply to that message
const reply = LP2P.MessageFactory.createText('bob', 'alice', '3pm works');
reply.replyTo = original.id;

// Track conversation threads
const threads = new Map();
handler.register(LP2P.MESSAGE_TYPES.TEXT, (message) => {
    if (message.replyTo) {
        // This is a reply
        const thread = threads.get(message.replyTo) || [];
        thread.push(message);
        threads.set(message.replyTo, thread);
    } else {
        // New conversation
        threads.set(message.id, []);
    }
});
```

## Broadcasting

```javascript
// Send to all peers
const broadcast = LP2P.MessageFactory.createText(
    'peer-alice',
    '*',  // Broadcast to all
    'Hello everyone!'
);

// Handle broadcasts
handler.register(LP2P.MESSAGE_TYPES.TEXT, (message) => {
    if (message.to === '*') {
        console.log('Broadcast message:', message.payload.text);
    }
});
```

## Custom Data Types

```javascript
// Define your own data type
const customData = LP2P.MessageFactory.createData(
    'peer-alice',
    'peer-bob',
    'custom-widget',  // Your custom type
    'widget-v1',      // Your schema version
    {
        widgetId: 'widget-123',
        type: 'chart',
        config: {
            title: 'Sales Data',
            data: [1, 2, 3, 4, 5]
        }
    }
);

// Handle custom data types
handler.register(LP2P.MESSAGE_TYPES.DATA, (message) => {
    if (message.payload.dataType === 'custom-widget') {
        renderWidget(message.payload.content);
    }
});
```

## See Also

- [PROTOCOL.md](../PROTOCOL.md) - Full protocol specification
- [ARCHITECTURE.md](../ARCHITECTURE.md) - System architecture
- [README.md](../README.md) - Getting started guide
