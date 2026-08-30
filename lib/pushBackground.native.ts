import { registerBackgroundHandler } from './firebase.native';

/**
 * Side-effect module: importing it registers FCM's background handler.
 *
 * Firebase insists this happen outside the React tree and as early as
 * possible, because when a background message wakes the app there is no
 * component tree to run in. Importing at the top of the root layout is the
 * earliest hook expo-router offers.
 */
registerBackgroundHandler();
