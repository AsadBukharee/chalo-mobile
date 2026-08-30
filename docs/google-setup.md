# Google Cloud & Firebase — chalo-intercity

Everything below already exists in the `asadpydev@gmail.com` Google account.
This file is the record of what was set up and the few steps that still need a
human (they need signing keys that only EAS holds).

## Project

| | |
|---|---|
| Google Cloud project | **Chalo Intercity** — `chalo-intercity` |
| Project number / FCM sender ID | `679249635487` |
| Billing | linked to the account's existing billing account |
| Firebase plan | Blaze (pay as you go) — inherited from the billing link |
| Google Analytics | not enabled |

Console links:

- Cloud: <https://console.cloud.google.com/home/dashboard?project=chalo-intercity>
- Firebase: <https://console.firebase.google.com/project/chalo-intercity>

## Maps

One key, **Maps Platform API Key**, API-restricted to the 35 Maps Platform
APIs. The ones this app calls:

- Maps SDK for Android — the map surface on device
- Maps SDK for iOS
- Maps JavaScript API — the web preview
- Directions API — `components/maps/directions.ts`
- Places API — city autocomplete on the location screen
- Maps Static API — the fallback image when the live map can't load
- Geocoding API

The key lives in three places, all pointing at the same value:

- `app.config.js` → `DEFAULT_MAPS_KEY` (the fallback baked into a build)
- `eas.json` → `EXPO_PUBLIC_GOOGLE_MAPS_KEY` in all three profiles
- Anything in the environment overrides both (`EXPO_PUBLIC_GOOGLE_MAPS_KEY`,
  `GOOGLE_MAPS_API_KEY`, or the per-platform `GOOGLE_MAPS_ANDROID_KEY` /
  `GOOGLE_MAPS_IOS_KEY`)

The key ships inside the APK and can be pulled back out of it. That is normal
for a client-side Maps app — the protection is restriction, not secrecy.

## Firebase

Apps registered:

| Platform | Identifier | App ID |
|---|---|---|
| Android | `com.asadnaqvee.chalomobile` | `1:679249635487:android:6c6b5ec2363183b8399aaa` |
| iOS | `com.asadnaqvee.chalomobile` | `1:679249635487:ios:fb5643c9da2964b8399aaa` |

`google-services.json` and `GoogleService-Info.plist` sit at the project root
and are wired up by `app.config.js` (`android.googleServicesFile` /
`ios.googleServicesFile`), so `expo prebuild` and EAS pick them up.

**Authentication** — Phone sign-in is enabled. SMS quota is 1,000/day, which is
the default cap for a new billed project; raise it via Identity Platform when
that becomes the limit.

The Android app's signing fingerprints are registered, which is what lets
Firebase verify the app silently through Play Integrity instead of falling back
to a reCAPTCHA challenge:

| Type | Fingerprint |
|---|---|
| SHA-1 | `98:D7:C5:C8:04:9D:89:03:19:D9:9E:03:13:B8:7B:D4:4A:31:B6:48` |
| SHA-256 | `EF:AD:4C:0D:A1:13:F5:55:A7:7B:FA:51:BF:8A:D8:4F:F5:A0:86:F3:21:5C:76:D0:36:80:E1:7D:74:37:2F:3C` |

These come from the EAS **upload keystore** (`Build Credentials 2e2e0zCekz`,
the default), which signs development, preview and production builds alike —
one fingerprint pair covers all three profiles. Read them again any time with
`eas credentials --platform android`, or on
<https://expo.dev/accounts/asadnaqvee/projects/chalo-mobile/credentials>.

The **Play Integrity API** is enabled on the Cloud project. Firebase phone auth
needs it for silent app verification; without it every OTP is preceded by a
reCAPTCHA web view even when the fingerprints are registered.

No OAuth client was created by adding the fingerprints (those only appear when
Google Sign-In is turned on), so `google-services.json` did not change and does
not need regenerating.

**Cloud Messaging** — available on the project; `lib/firebase.native.ts` asks
for permission and reads the token once a rider signs in.

## Still to do

1. **Restrict the Maps key by application.** It is currently
   *Application restrictions: None*, meaning anyone who extracts it from the
   APK can bill your project. Now that the fingerprints above exist:
   - Android apps → `com.asadnaqvee.chalomobile` + the SHA-1
   - Then create a second key restricted to iOS apps
     (`com.asadnaqvee.chalomobile`) and set `GOOGLE_MAPS_IOS_KEY`, since one
     key cannot hold both an Android and an iOS restriction.

2. **Set a billing budget and alert.** Directions and Places are billed per
   call and the app refreshes a live route every two minutes per open journey
   screen. Cloud console → Billing → Budgets & alerts.

3. **Add the Play App Signing SHA-1** if and when the app ships to the Play
   Store. Google re-signs the upload with its own key there, so the
   fingerprint above stops matching production installs.

4. **A service-account key for sending FCM.** The backend stores device tokens
   but cannot yet push to them. Firebase console → Project settings →
   Service accounts → *Generate new private key*. That file is a real secret:
   it belongs in the Django environment, never in the repo or the app.

## Building

`@react-native-firebase/*` is a native module, so **Expo Go will not run this
app any more**. You need a development build:

```sh
cd chalo-mobile
npx expo install --fix          # pin the new deps to SDK 54's versions
npx expo prebuild --clean
eas build --profile development --platform android
```

The web build (`npm run web`) still works — `lib/firebase.web.ts` stubs the
native module out and the login gate stands down, so the browser preview shows
the app without sign-in.
