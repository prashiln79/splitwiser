# Third-Party Integrations & Hardware APIs: Splitwiser

This document specifies all third-party SDK integrations, hardware capabilities, and configuration files utilized in Splitwiser.

---

## 1. Google Sign-In Integration

### Library: `@react-native-google-signin/google-signin` (v13.3.1)
Splitwiser integrates official Google Play Services authentication for Android and Google Sign-In for iOS.

- **Client Configuration (`src/config/firebase.ts`)**:
  ```typescript
  export const googleAuthConfig = {
    webClientId: '844099376199-fbbikh2f19e2qifrrjf9q29m9jjhv55k.apps.googleusercontent.com',
  };
  ```
- **Configuration Origin**: `google-services.json` `oauth_client` entry where `client_type === 3` (Web Application Client ID).
- **Native Android Linking**: Configured in `app.json` via plugin:
  ```json
  [
    "@react-native-google-signin/google-signin",
    {
      "iosUrlScheme": "com.googleusercontent.apps.844099376199-fbbikh2f19e2qifrrjf9q29m9jjhv55k"
    }
  ]
  ```
- **Workflow**:
  1. Calls `GoogleSignin.hasPlayServices()`.
  2. Prompts native Google Account Chooser via `GoogleSignin.signIn()`.
  3. Obtains `idToken`.
  4. Exchanges `idToken` for Firebase `GoogleAuthProvider.credential(idToken)`.
  5. Links with existing anonymous session or signs in.

---

## 2. Firebase Services (v12.19.0)

### 2.1 Firebase Authentication
- **Persistence Mechanism**: Custom persistence using `@react-native-async-storage/async-storage` via `getReactNativePersistence`:
  ```typescript
  initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
  ```
- **State Listener**: `onAuthStateChanged(auth, callback)` synchronizes current user session, triggering background Google photo updates.

### 2.2 Cloud Firestore
- **Instance**: `getFirestore(app)`
- **Project**: `money-manager-b394e`
- **Data Namespace**: `/splitwiser/data/**`
- **Synchronization**: Two-way streaming via `onSnapshot` subscriptions coupled to local SQLite.

### 2.3 Firebase Storage
- **Bucket**: `money-manager-b394e.firebasestorage.app`
- **Paths**:
  - `splitwiser/users/{uid}/profile/avatar_{timestamp}.jpg`
  - `splitwiser/groups/{groupId}/covers/cover_{timestamp}.jpg`

---

## 3. Expo Native SDK Modules

| Module | Version | Purpose |
|---|---|---|
| `expo-sqlite` | `~58.0.15` | Local persistent database in WAL mode (`splitwiser_offline.db`) |
| `expo-image-picker` | `~58.0.10` | Media selection from device gallery with aspect ratio cropping |
| `expo-image-manipulator` | `~58.0.16` | On-device image resizing, dimension bounding, and JPEG compression |
| `expo-camera` | `~58.0.14` | Direct camera access for profile avatar photo capture and receipt scanning |
| `expo-haptics` | `~58.0.7` | Native tactile feedback for tabs, buttons, keypads, and success states |
| `expo-secure-store` | `~58.0.2` | Encrypted storage for sensitive tokens, app PIN, and biometric settings |
| `expo-splash-screen` | `~58.0.13` | Native splash screen hold and smooth fade-out coordination |
| `@react-native-community/netinfo` | `12.0.1` | Network state detection for automatic offline/online sync queue triggering |
| `react-native-qrcode-svg` | `^6.3.54` | Fast native SVG QR code rendering for group invite links |

---

## 4. App Manifest & Permissions (`app.json`)

### Android Permissions Configured
- `android.permission.CAMERA`: Allows capturing avatars and receipt scanning.
- `android.permission.READ_EXTERNAL_STORAGE` / `READ_MEDIA_IMAGES`: Allows selecting photos from gallery.
- `android.permission.VIBRATE`: Enables haptic feedback.
- `android.permission.INTERNET`: Required for Firebase and Google OAuth network communication.
- `android.permission.ACCESS_NETWORK_STATE`: Monitors network transitions for the offline sync engine.

### Package Identity
- **Android Package**: `com.splitwiser.app`
- **iOS Bundle Identifier**: `com.splitwiser.app`
- **Target SDK**: Android 35 (Android 15 ready), iOS 17+

