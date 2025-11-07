/**
 * Simple IndexedDB wrapper for persisting rooms (channels)
 * Store: `rooms` keyed by 6-char `code`
 */
(function(global){
    const DB_NAME = 'lp2p';
    const DB_VERSION = 1;
    const STORE_NAME = 'rooms';

    function openDB(){
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = (ev) => {
                const db = ev.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)){
                    const store = db.createObjectStore(STORE_NAME, { keyPath: 'code' });
                    store.createIndex('lastActive', 'lastActive');
                    store.createIndex('creator', 'creator');
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async function withStore(mode, fn){
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, mode);
            const store = tx.objectStore(STORE_NAME);
            let res;
            try {
                res = fn(store);
            } catch (err) {
                reject(err);
            }
            tx.oncomplete = () => resolve(res);
            tx.onerror = () => reject(tx.error);
        });
    }

    const RoomStore = {
        async putRoom(room) {
            if (!room || !room.code) throw new Error('Invalid room');
            room.version = (room.version || 0) + 1;
            room.lastActive = room.lastActive || Date.now();
            return withStore('readwrite', (store) => store.put(room));
        },

        async getRoom(code){
            const db = await openDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readonly');
                const store = tx.objectStore(STORE_NAME);
                const req = store.get(code);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
        },

        async deleteRoom(code){
            return withStore('readwrite', (store) => store.delete(code));
        },

        async getAllRooms(){
            const db = await openDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readonly');
                const store = tx.objectStore(STORE_NAME);
                const req = store.getAll();
                req.onsuccess = () => resolve(req.result || []);
                req.onerror = () => reject(req.error);
            });
        },

        async clear(){
            return withStore('readwrite', (store) => store.clear());
        }
    };

    if (typeof global !== 'undefined') {
        global.LP2PRoomStore = RoomStore;
    }

})(typeof window !== 'undefined' ? window : this);
