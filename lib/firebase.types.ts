/**
 * The slice of Firebase this app actually uses, described independently of the
 * SDK so the web build can supply an honest stub instead of crashing.
 *
 * `@react-native-firebase/*` is a native module: it exists in a development or
 * EAS build and nowhere else. Expo Go and `expo start --web` have no such
 * module, so importing it unguarded takes the whole app down at startup.
 */

export type AuthUser = {
  uid: string;
  phoneNumber: string | null;
};

/** Returned after an OTP has been sent; holds Firebase's verification id. */
export type PhoneConfirmation = {
  confirm: (code: string) => Promise<void>;
};

/**
 * Callbacks for a phone verification in flight.
 *
 * `onAutoVerified` is the Android-only case where Google Play services reads
 * the incoming SMS itself and completes verification with no typing at all.
 * The code is passed along when Firebase exposes it, purely so the UI can show
 * the digits landing rather than jumping silently to the next screen.
 */
export type PhoneVerificationHandlers = {
  onAutoVerified?: (code: string | null) => void;
  onAutoVerifyFailed?: (message: string) => void;
};

export type FirebaseAuthApi = {
  /** False on platforms with no native Firebase module (web, Expo Go). */
  available: boolean;
  /** Why it is unavailable, for the UI to show. Empty when available. */
  unavailableReason: string;
  onAuthStateChanged: (listener: (user: AuthUser | null) => void) => () => void;
  /** `phone` must be in E.164 form, e.g. +923001234567. */
  signInWithPhoneNumber: (
    phone: string,
    handlers?: PhoneVerificationHandlers,
  ) => Promise<PhoneConfirmation>;
  signOut: () => Promise<void>;
  /** The Firebase ID token the Django API verifies. Null when signed out. */
  getIdToken: (forceRefresh?: boolean) => Promise<string | null>;
};

/** The bits of an FCM message this app renders or routes on. */
export type PushMessage = {
  title: string;
  body: string;
  data: Record<string, string>;
};

export type FirebaseMessagingApi = {
  available: boolean;
  /** Asks for notification permission and returns the FCM token, or null. */
  requestToken: () => Promise<string | null>;
  /** Fires whenever FCM rotates the token; returns an unsubscribe function. */
  onTokenRefresh: (listener: (token: string) => void) => () => void;
  /**
   * Messages arriving while the app is open and on screen. The OS does not
   * display these — a foreground notification is the app's job.
   */
  onMessage: (listener: (message: PushMessage) => void) => () => void;
  /** The user tapped a tray notification while the app was backgrounded. */
  onNotificationOpened: (listener: (message: PushMessage) => void) => () => void;
  /** The notification that launched the app from cold, if any. */
  getInitialNotification: () => Promise<PushMessage | null>;
};
