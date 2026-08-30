/**
 * Platform shim. Metro resolves `.native.ts` / `.web.ts` automatically; this
 * file exists so editors and TypeScript agree on a single entry point.
 */
export { firebaseAuth, firebaseMessaging } from './firebase.web';
export type {
  AuthUser,
  FirebaseAuthApi,
  FirebaseMessagingApi,
  PhoneConfirmation,
  PhoneVerificationHandlers,
  PushMessage,
} from './firebase.types';
