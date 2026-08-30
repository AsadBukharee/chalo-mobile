import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Platform } from 'react-native';
import { api, type ApiUser } from '@/lib/api';
import { firebaseAuth, firebaseMessaging, type AuthUser, type PhoneConfirmation } from '@/lib/firebase';

/**
 * Phone-number sign-in, backed by Firebase Auth and the Chalo API.
 *
 * Riders authenticate with a phone number and an SMS code — no password, no
 * email. Firebase owns the SMS and the verification; the API trusts the ID
 * token that produces and creates the account on first sight of it.
 *
 * There is deliberately no separate sign-up: Firebase has already proved the
 * number belongs to whoever is calling, so a registration step could only be a
 * second chance to disagree with it. What the app does instead is ask the API
 * whether the account is new — `POST /api/auth/session/` answers that — and
 * either greets a returning rider or collects a name from a new one.
 *
 * Superadmins do not sign in here at all; they use email on the Next.js admin.
 */

type AuthStatus = 'loading' | 'signed-out' | 'code-sent' | 'signed-in';

type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  /** The API's account record. Null until the session call has returned. */
  profile: ApiUser | null;
  /** True when this sign-in created the account, so the UI can onboard. */
  isNewAccount: boolean;
  /** Set once the welcome screen has been shown and dismissed. */
  hasWelcomed: boolean;
  /** Non-null when the API could not be reached after a successful sign-in. */
  profileError: string | null;
  /**
   * The SMS code Android read for us, if it did. The verify screen fills its
   * boxes from this so the user sees what happened rather than the screen
   * simply vanishing under them.
   */
  autoCode: string | null;
  pendingPhone: string | null;
  error: string | null;
  busy: boolean;
  unavailableReason: string | null;
  pushToken: string | null;
  sendCode: (phoneE164: string) => Promise<boolean>;
  confirmCode: (code: string) => Promise<boolean>;
  cancelCode: () => void;
  /** Retries the session call after a network failure. */
  refreshProfile: () => Promise<void>;
  /** Saves the name a new rider typed and marks the welcome as done. */
  completeWelcome: (fullName?: string) => Promise<void>;
  signOut: () => Promise<void>;
  getIdToken: (forceRefresh?: boolean) => Promise<string | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const PUSH_TOKEN_KEY = 'chalo-push-token';

/** Firebase error codes are machine-readable; users are not. */
function describe(error: unknown): string {
  const code = (error as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/invalid-phone-number':
      return 'That phone number does not look right. Check it and try again.';
    case 'auth/invalid-verification-code':
      return 'That code is not correct. Check the SMS and try again.';
    case 'auth/code-expired':
      return 'That code has expired. Ask for a new one.';
    case 'auth/session-expired':
      return 'The code timed out. Ask for a new one.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a few minutes before trying again.';
    case 'auth/quota-exceeded':
      return 'We have hit our SMS limit for today. Please try again later.';
    case 'auth/network-request-failed':
      return 'No connection. Check your internet and try again.';
    case 'auth/missing-client-identifier':
    case 'auth/app-not-authorized':
      return 'This build is not registered with Firebase yet. Add the app SHA-1 in the Firebase console.';
    default:
      return (error as Error)?.message || 'Something went wrong. Please try again.';
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<ApiUser | null>(null);
  const [isNewAccount, setIsNewAccount] = useState(false);
  const [hasWelcomed, setHasWelcomed] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [initialising, setInitialising] = useState(true);
  const [pendingPhone, setPendingPhone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [autoCode, setAutoCode] = useState<string | null>(null);
  const confirmation = useRef<PhoneConfirmation | null>(null);

  useEffect(() => {
    if (!firebaseAuth.available) {
      setInitialising(false);
      return;
    }
    return firebaseAuth.onAuthStateChanged((next) => {
      setUser(next);
      setInitialising(false);
      if (next) {
        confirmation.current = null;
        setPendingPhone(null);
      } else {
        setProfile(null);
        setIsNewAccount(false);
        setHasWelcomed(false);
        setProfileError(null);
      }
    });
  }, []);

  /**
   * Trades the Firebase token for the API account.
   *
   * Runs on every sign-in, including one restored from disk at launch: the
   * account could have been created on another device, or the row could have
   * been removed since. Cheap, and it keeps the two systems from drifting.
   */
  const loadSession = useCallback(async () => {
    if (!firebaseAuth.available) return;
    try {
      const result = await api.session();
      setProfile(result.user);
      setIsNewAccount(result.created);
      setProfileError(null);
      // A returning rider with a name already on file has nothing to fill in,
      // so there is no welcome step to complete.
      if (!result.created && result.user.full_name) setHasWelcomed(true);
    } catch (caught) {
      // ApiError already carries a sentence worth showing; anything else gets
      // a generic one rather than a stack trace in the UI.
      setProfileError((caught as Error)?.message || 'Could not reach the server.');
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    void loadSession();
  }, [user, loadSession]);

  // Ask for push permission once the rider is signed in — asking on the login
  // screen, before they have any reason to trust us, is how you get a
  // permanent "no". The token is sent on to the API so the backend can
  // actually address this device.
  useEffect(() => {
    if (!user || !profile || !firebaseMessaging.available) return;
    let cancelled = false;

    const send = async (token: string) => {
      setPushToken(token);
      AsyncStorage.setItem(PUSH_TOKEN_KEY, token).catch(() => {});
      try {
        await api.registerDeviceToken(token, Platform.OS === 'ios' ? 'ios' : 'android');
      } catch {
        // A device that cannot register for push must still be able to book a
        // ride, so this failure is deliberately silent.
      }
    };

    firebaseMessaging.requestToken().then((token) => {
      if (cancelled || !token) return;
      void send(token);
    });
    const unsubscribe = firebaseMessaging.onTokenRefresh((token) => {
      if (!cancelled) void send(token);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [user, profile]);

  const sendCode = useCallback(async (phoneE164: string) => {
    setError(null);
    setBusy(true);
    try {
      setAutoCode(null);
      confirmation.current = await firebaseAuth.signInWithPhoneNumber(phoneE164, {
        // Play services can read the SMS itself on Android; when it does, the
        // sign-in has already happened and this is purely so the UI can show it.
        onAutoVerified: (code) => setAutoCode(code),
      });
      setPendingPhone(phoneE164);
      return true;
    } catch (caught) {
      setError(describe(caught));
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const confirmCode = useCallback(async (code: string) => {
    if (!confirmation.current) {
      setError('That code request has expired. Ask for a new one.');
      return false;
    }
    setError(null);
    setBusy(true);
    try {
      await confirmation.current.confirm(code);
      // onAuthStateChanged sets the user, which triggers loadSession.
      return true;
    } catch (caught) {
      setError(describe(caught));
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const cancelCode = useCallback(() => {
    confirmation.current = null;
    setPendingPhone(null);
    setError(null);
    setAutoCode(null);
  }, []);

  const completeWelcome = useCallback(async (fullName?: string) => {
    const name = fullName?.trim();
    if (name) {
      try {
        const updated = await api.updateMe({ full_name: name });
        setProfile(updated);
      } catch (caught) {
        // Don't strand someone on the welcome screen over a name.
        setProfileError((caught as Error)?.message || 'Could not save your name right now.');
      }
    }
    setHasWelcomed(true);
    setIsNewAccount(false);
  }, []);

  const signOut = useCallback(async () => {
    confirmation.current = null;
    setPendingPhone(null);
    setError(null);

    // Drop this device's push token first — after signing out the request has
    // no credential and the backend would keep notifying a phone nobody is
    // logged into.
    const stored = pushToken ?? (await AsyncStorage.getItem(PUSH_TOKEN_KEY).catch(() => null));
    if (stored) {
      try {
        await api.removeDeviceToken(stored);
      } catch {
        // Best effort.
      }
    }

    await firebaseAuth.signOut();
    await AsyncStorage.removeItem(PUSH_TOKEN_KEY).catch(() => {});
    setPushToken(null);
    setProfile(null);
    setHasWelcomed(false);
    setIsNewAccount(false);
  }, [pushToken]);

  const status: AuthStatus = initialising
    ? 'loading'
    : user
      ? 'signed-in'
      : pendingPhone
        ? 'code-sent'
        : 'signed-out';

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      profile,
      isNewAccount,
      hasWelcomed,
      profileError,
      autoCode,
      pendingPhone,
      error,
      busy,
      unavailableReason: firebaseAuth.available ? null : firebaseAuth.unavailableReason,
      pushToken,
      sendCode,
      confirmCode,
      cancelCode,
      refreshProfile: loadSession,
      completeWelcome,
      signOut,
      getIdToken: firebaseAuth.getIdToken,
    }),
    [
      status,
      user,
      profile,
      isNewAccount,
      hasWelcomed,
      profileError,
      autoCode,
      pendingPhone,
      error,
      busy,
      pushToken,
      sendCode,
      confirmCode,
      cancelCode,
      loadSession,
      completeWelcome,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}
