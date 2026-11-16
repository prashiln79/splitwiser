# Offline Tests & SQLite Web Behavior

## SQLite Initialization & Multi-Tab Web Concurrency Fix

### Problem
When running Splitwiser on the web platform (`npm start` -> Web), opening multiple browser tabs or refreshing triggered the following unhandled runtime error:

```text
Web ERROR [Error: Failed to execute 'createSyncAccessHandle' on 'FileSystemFileHandle': 
Access Handles cannot be created if there is another open Access Handle or Writable 
stream associated with the same file.]
```

### Root Cause
`expo-sqlite` on the web uses the browser's Origin Private File System (OPFS) via `AccessHandlePoolVFS`. Web browsers strictly enforce exclusive access locks on sync access handles (`createSyncAccessHandle`):
- Only a single `FileSystemSyncAccessHandle` can be held open on a file at any given moment.
- When `App.tsx` called `getDatabase()` unconditionally on launch to warm up local tables/indexes, opening multiple tabs or running simultaneous instances led to the second tab failing to obtain a lock on `splitwiser_offline.db`.

### Solution & Behavior
1. In Splitwiser's web architecture, persistent data and real-time syncing flow directly through Firebase Firestore. SQLite local caching is specifically targeted for native platforms (iOS and Android) to support offline SQLite storage and background synchronization.
2. In `App.tsx`, the initial `getDatabase()` warm-up call has been guarded with `Platform.OS !== 'web'`.
3. Web assets and headers: `metro.config.js` properly configures COEP (`credentialless`) and COOP (`same-origin`) alongside `.wasm` asset bundling.
4. Repositories and sync services operate on native platforms using local SQLite storage, while web operations rely directly on Firestore.

### Regression Testing
Ran test suites to verify zero regressions:
- `npm run test:balances`: 12/12 test scenarios passed.
- `npm run test:covers`: All cover photo preset tests passed.
