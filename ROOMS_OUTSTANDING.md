**Rooms & Connection — Outstanding Tasks**

This document captures the outstanding work and design notes for changing the app's connected/disconnected semantics and introducing persistent, invite-only rooms (6-character codes), client-side persistence and minimal P2P gossip. Use this as a checklist to resume work later.

**Decisions already made**
- **Connected state**: App `connected` = signaling server connection (WebSocket or PeerJS) is live.
- **Room identifier**: Keep 6-character codes as the canonical join code.
- **Persistence**: Use client-side `IndexedDB` (implemented in `roomStore.js`) to persist rooms per device.
- **Privacy**: Invite-only rooms only (no public discovery).
- **DMs**: Model as rooms with `capacity = 2`.
- **Gossip**: Minimal for now; optional lightweight replication later.

**Files added/changed so far**
- `roomStore.js` — IndexedDB wrapper for `rooms` store.
- `protocol.js` — Added `ROOM_ANNOUNCE` action, `MessageFactory.createRoomAnnounce()` and handler to persist announcements.
- `signaling.js` — Added `announceRooms()`, `queryRoomMembers()`, and `onRoomMembers` callback to `WebSocketSignaling` (client-side). Does not require server persistence; server must be updated separately to forward these messages if desired.
- `ui.js` — Added `initRoomsUI()`, `renderRoomsList()`, `createRoomDialog()` and `createRoom()` helpers. These use `LP2PRoomStore` and will call `window.signaling.announceRooms()` if available.
- `index.html` — Exposes `window.signaling` when room signaling is created and calls `initRoomsUI()` during app `init()`.

**Outstanding tasks (documented & prioritized)**

High priority
- **Create migration & rollout plan**: steps to roll out the new behaviour to users without breaking existing flows (feature flags, graceful fallback, UX wording). (file: `ROOMS_OUTSTANDING.md`, task id 5)
- **Add `#channelsList` HTML + CSS**: make the channels list visible in the app layout and style it for usability. Hook `initRoomsUI()` to it. (task id 9)
- **Send `ROOM_ANNOUNCE` proactively**: send `ROOM_ANNOUNCE` messages over open DataChannels when creating or joining a room so peers learn about rooms without server assistance. (task id 8)

Near term
- **Implement auto-rejoin**: on signaling reconnect, auto-reannounce local rooms and optionally re-initiate peer connections for `autoRejoin` rooms. (task id 11)
- **Tests**: unit tests for `roomStore` and integration tests for create/join/announce flows. Add test harness or instructions. (task id 15)
- **Documentation**: update README / QUICK_START to describe the new room semantics and invite flows. (task id 16)

Optional / Server-side (if you choose to extend the signaling server)
- **Server handlers for `announceRooms` and `queryRoomMembers`**: implement server-side message forwarding and ephemeral presence responses to enable discovery of online peers for a code. This is optional — clients will function without it using P2P announcements/gossip. (task id 10)

Medium-term / Coordination
- **Minimal P2P gossip replication**: exchange minimal room metadata between peers (deltas) to spread room registrations across devices that participated previously. Keep gossip payload small. (task id 12)
- **Conflict resolution policy**: define deterministic merge rules for identical 6-char code collisions (createdAt/version/creator tiebreak). This is currently implemented as a simple version + lastActive rule in the handler but needs formalization. (task id 13)

Future (research & improvements)
- **CRDTs**: replace simple merge rules with CRDTs for stronger convergence if needed. (task id 13)
- **Authentication / accounts**: add user accounts for cross-device durable room membership and signed room metadata. (task id 14)

Notes for resuming work
- To resume sending announcements, add calls to `LP2P.MessageFactory.createRoomAnnounce(peerId, room)` and send the serialized message on each open DataChannel (and optionally via `window.signaling.announceRooms()` if a WS server supports it).
- `roomStore.js` exposes a simple `LP2PRoomStore` API: `putRoom`, `getRoom`, `getAllRooms`, `deleteRoom`, `clear` — use these to manage local room records.
- The current `ROOM_ANNOUNCE` handler in `protocol.js` performs a minimal merge: it prefers records with higher `version` or newer `lastActive`. Consider expanding the merge policy before enabling broader gossip.

Quick commands / checks when returning
- Open the app in the browser and confirm the left-hand `channelsList` element exists; if not, add an element with id `channelsList` to the HTML and run `initRoomsUI()` from the console.
- In the console, test the room store:
  - `await LP2PRoomStore.putRoom({ code: 'ABC123', name: 'Test', creator: 'me', createdAt: Date.now() })`
  - `await LP2PRoomStore.getAllRooms()`

Who to contact / context
- This work was started by the local dev (you). The signaling server (if present) will need server-side updates only if you want a central ephemeral presence that persists beyond client gossip. Otherwise the system remains serverless/p2p-first.

If you want, I can also generate a short PR description and list of patch files to attach to a code review. Save this file and refer to it when you return to the room work.

— End of document
