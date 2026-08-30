import type { FirebaseAuthApi, FirebaseMessagingApi } from './firebase.types';

/**
 * Web stub.
 *
 * `@react-native-firebase/*` is native-only, so the browser build gets an API
 * of the same shape that reports itself unavailable. The login screen reads
 * `available` and explains the situation rather than throwing on import.
 */

const REASON = 'Phone sign-in runs in the Chalo app — the web preview cannot send an OTP.';

export const firebaseAuth: FirebaseAuthApi = {
  available: false,
  unavailableReason: REASON,
  onAuthStateChanged(listener) {
    listener(null);
    return () => {};
  },
  async signInWithPhoneNumber() {
    throw new Error(REASON);
  },
  async signOut() {},
  async getIdToken() {
    return null;
  },
};

export const firebaseMessaging: FirebaseMessagingApi = {
  available: false,
  async requestToken() {
    return null;
  },
  onTokenRefresh() {
    return () => {};
  },
  onMessage() {
    return () => {};
  },
  onNotificationOpened() {
    return () => {};
  },
  async getInitialNotification() {
    return null;
  },
};
