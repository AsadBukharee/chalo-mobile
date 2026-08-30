import {
  AuthorizationStatus,
  getInitialNotification as fbGetInitialNotification,
  getMessaging,
  getToken,
  onMessage as fbOnMessage,
  onNotificationOpenedApp as fbOnNotificationOpenedApp,
  onTokenRefresh as fbOnTokenRefresh,
  requestPermission,
  setBackgroundMessageHandler,
} from '@react-native-firebase/messaging';
import {
  getAuth,
  onAuthStateChanged as fbOnAuthStateChanged,
  PhoneAuthProvider,
  signInWithCredential,
  signInWithPhoneNumber as fbSignInWithPhoneNumber,
  signOut as fbSignOut,
  verifyPhoneNumber as fbVerifyPhoneNumber,
} from '@react-native-firebase/auth';
import type {
  AuthUser,
  FirebaseAuthApi,
  FirebaseMessagingApi,
  PhoneConfirmation,
  PhoneVerificationHandlers,
  PushMessage,
} from './firebase.types';

/**
 * Firebase on device.
 *
 * Config comes from google-services.json / GoogleService-Info.plist, which
 * app.config.js points at, so there is nothing to initialise here — the native
 * module is already configured by the time JS runs.
 *
 * Requires a development or EAS build. Expo Go has no native Firebase module.
 */

const toUser = (user: { uid: string; phoneNumber: string | null } | null): AuthUser | null =>
  user ? { uid: user.uid, phoneNumber: user.phoneNumber ?? null } : null;

/**
 * Starts phone verification, preferring the listener API.
 *
 * `signInWithPhoneNumber` is the simple call, but it hides Android's automatic
 * SMS retrieval: Google Play services can read the incoming code and finish
 * verification with no typing, and only `verifyPhoneNumber` surfaces that as an
 * event. Both send exactly one SMS, so there is no cost to preferring it.
 *
 * Auto-retrieval needs the app's signing certificate registered with Firebase
 * and Play Integrity enabled; without those it simply never fires and the user
 * types the code as before. If the listener API is missing from the installed
 * SDK we fall back to the simple call rather than breaking sign-in.
 */
const AUTO_VERIFY_TIMEOUT_SECONDS = 60;

function startVerification(
  phone: string,
  handlers?: PhoneVerificationHandlers,
): Promise<PhoneConfirmation> {
  const auth = getAuth();

  if (typeof fbVerifyPhoneNumber !== 'function') {
    return fbSignInWithPhoneNumber(auth, phone).then((confirmation) => ({
      confirm: async (code: string) => {
        await confirmation.confirm(code);
      },
    }));
  }

  return new Promise<PhoneConfirmation>((resolve, reject) => {
    let verificationId = '';
    let settled = false;

    const asConfirmation = (): PhoneConfirmation => ({
      confirm: async (code: string) => {
        // A credential built from the verification id is what actually signs
        // the user in; onAuthStateChanged then does the rest.
        const credential = PhoneAuthProvider.credential(verificationId, code);
        await signInWithCredential(auth, credential);
      },
    });

    const listener = fbVerifyPhoneNumber(auth, phone, AUTO_VERIFY_TIMEOUT_SECONDS);

    listener.on(
      'state_changed',
      (snapshot: any) => {
        switch (snapshot?.state) {
          case 'sent':
            verificationId = snapshot.verificationId ?? verificationId;
            if (!settled) {
              settled = true;
              resolve(asConfirmation());
            }
            break;

          case 'verified': {
            // Play services read the SMS for us. Sign in immediately, and hand
            // the code up so the UI can show it arriving.
            verificationId = snapshot.verificationId ?? verificationId;
            if (!settled) {
              settled = true;
              resolve(asConfirmation());
            }
            const code: string | null = snapshot.code ?? null;
            handlers?.onAutoVerified?.(code);
            if (code && verificationId) {
              signInWithCredential(auth, PhoneAuthProvider.credential(verificationId, code)).catch(
                (error) => handlers?.onAutoVerifyFailed?.((error as Error)?.message ?? ''),
              );
            }
            break;
          }

          case 'timeout':
            // Auto-retrieval gave up; manual entry still works.
            handlers?.onAutoVerifyFailed?.('');
            break;

          case 'error':
            if (!settled) {
              settled = true;
              reject(snapshot.error ?? new Error('Verification failed.'));
            }
            break;

          default:
            break;
        }
      },
      (error: unknown) => {
        if (!settled) {
          settled = true;
          reject(error);
        }
      },
    );
  });
}

export const firebaseAuth: FirebaseAuthApi = {
  available: true,
  unavailableReason: '',

  onAuthStateChanged(listener) {
    return fbOnAuthStateChanged(getAuth(), (user) => listener(toUser(user)));
  },

  signInWithPhoneNumber(phone, handlers): Promise<PhoneConfirmation> {
    return startVerification(phone, handlers);
  },

  async signOut() {
    await fbSignOut(getAuth());
  },

  async getIdToken(forceRefresh = false) {
    const user = getAuth().currentUser;
    if (!user) return null;
    return user.getIdToken(forceRefresh);
  },
};

/** FCM's message shape is loose; normalise it once, here. */
function toPushMessage(raw: any): PushMessage {
  return {
    title: raw?.notification?.title ?? raw?.data?.title ?? 'Chalo',
    body: raw?.notification?.body ?? raw?.data?.body ?? '',
    data: (raw?.data ?? {}) as Record<string, string>,
  };
}

export const firebaseMessaging: FirebaseMessagingApi = {
  available: true,

  async requestToken() {
    const messaging = getMessaging();
    // On Android 13+ this raises the POST_NOTIFICATIONS prompt; on iOS it is
    // the APNs alert prompt. Both return a status we must respect.
    const status = await requestPermission(messaging);
    const granted =
      status === AuthorizationStatus.AUTHORIZED || status === AuthorizationStatus.PROVISIONAL;
    if (!granted) return null;
    try {
      return await getToken(messaging);
    } catch (error) {
      // No Play Services, no network, or FCM not reachable — a missing push
      // token must never be fatal to signing in.
      console.warn('[fcm] could not get a token:', (error as Error)?.message);
      return null;
    }
  },

  onTokenRefresh(listener) {
    return fbOnTokenRefresh(getMessaging(), listener);
  },

  onMessage(listener) {
    return fbOnMessage(getMessaging(), (raw) => listener(toPushMessage(raw)));
  },

  onNotificationOpened(listener) {
    return fbOnNotificationOpenedApp(getMessaging(), (raw) => listener(toPushMessage(raw)));
  },

  async getInitialNotification() {
    const raw = await fbGetInitialNotification(getMessaging());
    return raw ? toPushMessage(raw) : null;
  },
};

/**
 * Background/quit-state handler.
 *
 * Firebase requires this to be registered as early as possible and outside any
 * React component — the JS context it runs in when a message wakes the app has
 * no component tree. `lib/pushBackground.ts` imports this at module scope from
 * the root layout, which is the earliest hook expo-router gives us.
 *
 * Messages carrying a `notification` block are drawn by the OS itself; this
 * handler exists so data-only messages are still acknowledged rather than
 * crashing with "no task registered".
 */
export function registerBackgroundHandler() {
  setBackgroundMessageHandler(getMessaging(), async () => {
    // Nothing to do yet: the tray notification is rendered by the system and
    // the app reads fresh state on next open. A handler must exist regardless.
  });
}
